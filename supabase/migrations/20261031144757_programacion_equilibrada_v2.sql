-- Experimental opt-in scheduling: same-kind market shocks, rotated over the
-- roster. No game is activated by this migration. Group events stay independent.
create table public.side_balanced_draws_v1 (
 partida_id uuid not null references public.partidas(id), ciclo integer not null check(ciclo between 1 and 6),
 roster bigint[] not null, outcome jsonb not null, created_at timestamptz not null default clock_timestamp(),
 primary key(partida_id,ciclo)
);
alter table public.side_balanced_draws_v1 enable row level security;
revoke all on public.side_balanced_draws_v1 from public,anon,authenticated,service_role;

create function public.side_schedule_balanced_v1(p_partida_id uuid,p_ciclo integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.partidas; previous public.side_balanced_draws_v1; v_roster bigint[]; ids text[]:=array['PE69','PE71','PE75'];
 company bigint; ev text; result jsonb:='[]'::jsonb; assignment jsonb; idx integer:=0; severity integer; base integer;
begin
 select * into g from public.partidas where id=p_partida_id for update;
 if g.id is null or auth.uid() is null or g.profesor_id is distinct from auth.uid() then raise exception 'No autorizado' using errcode='42501'; end if;
 if g.configuracion->>'economicEventsVersion' is distinct from 'demand-share-v1' then raise exception 'Versión de eventos no habilitada'; end if;
 if p_ciclo is null or p_ciclo not between 1 and least(6,coalesce((g.configuracion->>'cycles')::integer,0)) then raise exception 'Ciclo inválido'; end if;
 select array_agg(empresa_id order by empresa_id) into v_roster from public.participantes where partida_id=g.id and expulsada_at is null;
 if cardinality(v_roster) is distinct from 3 then raise exception 'Esta programación experimental requiere exactamente tres empresas activas'; end if;
 select * into previous from public.side_balanced_draws_v1 where partida_id=g.id and ciclo=p_ciclo;
 if found then
  if previous.roster is distinct from v_roster then raise exception 'La lista de empresas cambió desde la programación'; end if;
  return jsonb_build_object('round',p_ciclo,'events',previous.outcome,'reused',true);
 end if;
 if exists(select 1 from public.side_balanced_draws_v1 b where b.partida_id=g.id and b.roster is distinct from v_roster) then raise exception 'La lista de empresas cambió durante la programación'; end if;
 if jsonb_typeof(g.configuracion->'enabledEvents') is distinct from 'array' or not (g.configuracion->'enabledEvents' ?& ids) then raise exception 'Habilita PE69, PE71 y PE75 antes de programar'; end if;
 severity:=case when p_ciclo<=2 then 2 when p_ciclo<=4 then 4 else 6 end;
 base:=mod(('x'||substr(md5(g.id::text),1,8))::bit(32)::bigint,3)::integer;
 foreach company in array v_roster loop
  -- Mirror the first three rounds: each company receives each event at a
  -- total intensity of 8 over six rounds (2+6, 2+6, or 4+4).
  ev:=ids[1+mod(base+idx+case when p_ciclo<=3 then p_ciclo-1 else 6-p_ciclo end,3)];
  assignment:=public.side_assign_event_v1(g.id,company,p_ciclo,ev,severity);
  result:=result||jsonb_build_array(assignment);idx:=idx+1;
 end loop;
 insert into public.side_balanced_draws_v1(partida_id,ciclo,roster,outcome) values(g.id,p_ciclo,v_roster,result);
 return jsonb_build_object('round',p_ciclo,'events',result,'reused',false);
end $$;
revoke all on function public.side_schedule_balanced_v1(uuid,integer) from public,anon,authenticated;
grant execute on function public.side_schedule_balanced_v1(uuid,integer) to authenticated;



