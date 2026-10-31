-- Experimental random scheduling only covers the eight effects implemented by
-- the current engine. This migration does not enable a game or change history.
create table public.side_event_draws_v1 (
 partida_id uuid not null references public.partidas(id),
 source_cycle integer not null check(source_cycle between 1 and 6),
 seed uuid not null,
 roster bigint[] not null,
 outcome jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default clock_timestamp(),
 primary key(partida_id,source_cycle)
);
alter table public.side_event_draws_v1 enable row level security;
revoke all on public.side_event_draws_v1 from public,anon,authenticated,service_role;

create function public.side_draw_events_v1(p_partida_id uuid,p_source_cycle integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.partidas; d public.side_event_draws_v1; company record; ev record; participants bigint[]; selected jsonb := '[]'::jsonb; roll bigint; target_cycle integer; first_cycle integer; runtime jsonb;
begin
 select * into g from public.partidas where id=p_partida_id for update;
 if g.id is null or auth.uid() is null or g.profesor_id is distinct from auth.uid() then raise exception 'No autorizado' using errcode='42501'; end if;
 select * into d from public.side_event_draws_v1 where partida_id=g.id and source_cycle=p_source_cycle;
 if found then
  select array_agg(empresa_id order by empresa_id) into participants from public.participantes where partida_id=g.id;
  return jsonb_build_object('sourceCycle',d.source_cycle,'events',d.outcome,'reused',true,'rosterChanged',participants is distinct from d.roster);
 end if;
 if g.configuracion->>'economicEventsVersion' is distinct from 'demand-share-v1' then raise exception 'Versión de eventos no habilitada'; end if;
 if p_source_cycle is null or p_source_cycle not between 1 and least(6,coalesce((g.configuracion->>'cycles')::integer,0)) then raise exception 'Ciclo inválido'; end if;
 runtime:=public.side_runtime(g.configuracion);
 if coalesce(runtime->>'phase','integration') in ('cancelled','finished') or (coalesce(runtime->>'phase','integration')<>'integration' and p_source_cycle<=coalesce((runtime->>'round')::integer,1)) or (coalesce(runtime->>'phase','integration')='integration' and p_source_cycle<coalesce((runtime->>'round')::integer,1)) then raise exception 'El ciclo ya no admite sorteos'; end if;
 if exists(select 1 from public.side_business_closures where partida_id=g.id and ciclo=p_source_cycle) then raise exception 'Ciclo cerrado'; end if;
 if jsonb_typeof(g.configuracion->'enabledEvents') is distinct from 'array' then raise exception 'Selección de eventos no disponible'; end if;
 select array_agg(empresa_id order by empresa_id) into participants from public.participantes where partida_id=g.id;
 if participants is null then raise exception 'No hay empresas participantes'; end if;
 insert into public.side_event_draws_v1(partida_id,source_cycle,seed,roster) values(g.id,p_source_cycle,gen_random_uuid(),participants) returning * into d;
 for company in select unnest(participants) as id loop
  for ev in select * from (values ('PE23',2,0,1),('PE30',2,0,25),('PE68',1,0,1),('PE69',3,1,20),('PE71',2,1,15),('PE74',4,1,12),('PE75',3,1,6),('PE77',3,0,1)) as e(id,probability,offset_cycle,intensity) loop
   if not (g.configuracion->'enabledEvents' ? ev.id) then continue; end if;
   first_cycle:=coalesce(nullif(g.configuracion#>>array['eventRules',ev.id,'firstRound'],'')::integer,1);
   target_cycle:=p_source_cycle+ev.offset_cycle;
   if p_source_cycle<first_cycle or target_cycle>least(6,(g.configuracion->>'cycles')::integer) then continue; end if;
   -- Uniform unsigned 32-bit hash. Each catalog event gets its own draw.
   roll:=('x'||substr(md5(d.seed::text||':'||company.id::text||':'||ev.id),1,8))::bit(32)::bigint;
   if mod(roll,10000)>=ev.probability*100 then continue; end if;
   if exists(select 1 from public.side_business_closures where partida_id=g.id and ciclo=target_cycle) then raise exception 'Ciclo cerrado'; end if;
   insert into public.side_event_assignments_v1(partida_id,empresa_id,ciclo,event_id,intensity) values(g.id,company.id,target_cycle,ev.id,ev.intensity) on conflict do nothing;
   if not found then raise exception 'El evento ya fue asignado por otra vía'; end if;
   selected:=selected||jsonb_build_array(jsonb_build_object('companyId',company.id::text,'eventId',ev.id,'round',target_cycle,'intensity',ev.intensity));
  end loop;
 end loop;
 update public.side_event_draws_v1 set outcome=selected where partida_id=g.id and source_cycle=p_source_cycle;
 return jsonb_build_object('sourceCycle',p_source_cycle,'events',selected,'reused',false,'rosterChanged',false);
end $$;
revoke all on function public.side_draw_events_v1(uuid,integer) from public,anon,authenticated;
grant execute on function public.side_draw_events_v1(uuid,integer) to authenticated;
