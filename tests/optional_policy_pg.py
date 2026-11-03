"""Transactional negative contracts against the dedicated empty installation only."""
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
checks = """
begin;
do $$
declare uid uuid:=gen_random_uuid(); gid uuid:=gen_random_uuid(); other uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email,email_confirmed_at,is_anonymous) values(uid,'policy-test@upch.pe',now(),false);
 insert into public.profesores(id,nombre,apellido) values(uid,'Policy','QA') on conflict(id) do nothing;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 insert into public.partidas(id,profesor_id,nombre,codigo,configuracion)
 values(gid,uid,'Transactional optional policy QA','POLICYQA',
 '{"cycles":3,"sequentialCloseVersion":"1","loanPolicy":{"version":"french-v1"},"economicEventsVersion":"demand-share-v1"}');
 if (select configuracion->>'loanPolicy' from partidas where id=gid) is null then raise exception 'Missing opt-in'; end if;
 perform public.side_challenge_mode_v1(gid,'balanced');
 begin perform public.side_challenge_mode_v1(gid,'invalid'); raise exception 'Expected invalid mode rejection'; exception when invalid_parameter_value then null; end;
 begin update partidas set configuracion=configuracion-'loanPolicy' where id=gid; raise exception 'Expected immutable policy rejection'; exception when check_violation then null; end;
 begin update partidas set configuracion=jsonb_set(configuracion,'{loanPolicy}','{"version":"french-v1","termCycles":6}') where id=gid; raise exception 'Expected policy rejection'; exception when check_violation then null; end;
 begin perform public.side_schedule_balanced_v1(gid,1); raise exception 'Expected roster rejection'; exception when raise_exception then if sqlerrm not like '%tres empresas%' then raise; end if; end;
 begin insert into side_business_closures(partida_id,ciclo,cierre) values(gid,1,'{"resultadosPorEmpresa":{"1":{"financial":{}}}}'); raise exception 'Expected old Edge rejection'; exception when check_violation then null; end;
 begin insert into side_business_closures(partida_id,ciclo,cierre) values(gid,1,'{"resultadosPorEmpresa":{"1":{"financial":{"loanPolicyVersion":"french-v1","loanBook":[],"loanPayments":[],"balanceGeneral":{"deuda":5,"interesesPorPagar":0}}}}}'); raise exception 'Expected unbalanced debt rejection'; exception when check_violation then null; end;
 perform set_config('request.jwt.claim.sub',other::text,true);
 begin perform public.side_challenge_mode_v1(gid,'manual'); raise exception 'Expected unauthorized rejection'; exception when insufficient_privilege then null; end;
 if has_function_privilege('anon','public.side_challenge_mode_v1(uuid,text)','execute') or has_function_privilege('anon','public.side_schedule_balanced_v1(uuid,integer)','execute') or has_table_privilege('authenticated','public.side_balanced_draws_v1','select') then raise exception 'Unexpected public access'; end if;
end $$;
rollback;
select 'optional-policy: 10 transactional checks passed, zero persisted rows';
"""
result = subprocess.run(['docker','exec','-i','supabase_db_sidecleanfinal','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],input=checks,text=True,capture_output=True)
print(result.stdout)
if result.returncode:
    raise RuntimeError(result.stderr)
