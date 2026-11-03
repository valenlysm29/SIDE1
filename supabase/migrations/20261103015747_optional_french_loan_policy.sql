begin;
-- Explicit opt-in at creation only. No defaults, no historical conversion.
create or replace function public.side_validar_politica_prestamo()
returns trigger language plpgsql set search_path=pg_catalog as $$
declare policy jsonb:=new.configuracion->'loanPolicy';term text;
begin
 if tg_op='UPDATE' and policy is distinct from old.configuracion->'loanPolicy' then
  raise exception 'La política de préstamos se fija al crear la partida.' using errcode='23514';
 end if;
 if policy is null then return new; end if;
 if jsonb_typeof(policy)<>'object' or policy->>'version' is distinct from 'french-v1'
 or exists(select 1 from jsonb_object_keys(policy) k where k not in ('version','termCycles'))
 or new.configuracion->>'sequentialCloseVersion' is distinct from '1' then
  raise exception 'Política de préstamos no soportada.' using errcode='23514';
 end if;
 if policy ? 'termCycles' then
  term:=policy->>'termCycles';
  if jsonb_typeof(policy->'termCycles')<>'number' or term !~ '^[1-6]$'
  or term::integer>(new.configuracion->>'cycles')::integer then
   raise exception 'Plazo del préstamo inválido.' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists zzz_side_validar_politica_prestamo on public.partidas;
create trigger zzz_side_validar_politica_prestamo before insert or update of configuracion on public.partidas
for each row execute function public.side_validar_politica_prestamo();
revoke all on function public.side_validar_politica_prestamo() from public,anon,authenticated;
-- Fail closed if an older Edge is restored while opt-in games exist.
create or replace function public.side_validar_cierre_prestamo()
returns trigger language plpgsql set search_path=pg_catalog as $$
declare policy jsonb; result jsonb; fin jsonb; loan jsonb; total numeric; payable numeric;
begin
 select configuracion->'loanPolicy' into policy from public.partidas where id=new.partida_id;
 if policy is null then return new; end if;
 if jsonb_typeof(new.cierre->'resultadosPorEmpresa') is distinct from 'object' then raise exception 'Cierre de préstamo incompatible' using errcode='23514'; end if;
 for result in select value from jsonb_each(new.cierre->'resultadosPorEmpresa') loop
  fin:=result->'financial';
  if fin->>'loanPolicyVersion' is distinct from policy->>'version'
  or jsonb_typeof(fin->'loanBook') is distinct from 'array'
  or jsonb_typeof(fin->'loanPayments') is distinct from 'array' then
   raise exception 'Motor incompatible con la política de préstamo' using errcode='23514';
  end if;
  total:=0;payable:=0;
  for loan in select value from jsonb_array_elements(fin->'loanBook') loop
   if jsonb_typeof(loan->'balance') is distinct from 'number' or jsonb_typeof(loan->'interestArrears') is distinct from 'number'
   or (loan->>'balance')::numeric<0 or (loan->>'interestArrears')::numeric<0
   or (loan->>'lastAccruedRound')::integer is distinct from new.ciclo then
    raise exception 'Calendario de préstamo inconsistente' using errcode='23514';
   end if;
   total:=total+(loan->>'balance')::numeric;payable:=payable+(loan->>'interestArrears')::numeric;
  end loop;
  if jsonb_typeof(fin#>'{balanceGeneral,deuda}') is distinct from 'number'
  or jsonb_typeof(fin#>'{balanceGeneral,interesesPorPagar}') is distinct from 'number'
  or total<>(fin#>>'{balanceGeneral,deuda}')::numeric or payable<>(fin#>>'{balanceGeneral,interesesPorPagar}')::numeric then
   raise exception 'Saldo de préstamo no conciliado' using errcode='23514';
  end if;
 end loop;
 return new;
end $$;
drop trigger if exists side_validar_cierre_prestamo on public.side_business_closures;
create trigger side_validar_cierre_prestamo before insert on public.side_business_closures
for each row execute function public.side_validar_cierre_prestamo();
revoke all on function public.side_validar_cierre_prestamo() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
