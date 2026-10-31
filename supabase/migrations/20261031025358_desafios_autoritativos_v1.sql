-- Version opt-in: audited individual competitive attention events, one cycle.
-- No historical closures or existing games are changed by this migration.
create table if not exists public.side_event_assignments_v1 (
  partida_id uuid not null references public.partidas(id),
  empresa_id bigint not null references public.empresas(id),
  ciclo integer not null check (ciclo between 1 and 6),
  event_id text not null check (event_id in ('PE23','PE30','PE68','PE69','PE71','PE74','PE75','PE77')),
  intensity integer not null check (intensity between 1 and 25),
  created_at timestamptz not null default clock_timestamp(),
  primary key (partida_id, empresa_id, ciclo, event_id)
);
alter table public.side_event_assignments_v1 drop constraint if exists side_event_assignments_v1_event_id_check;
alter table public.side_event_assignments_v1 add constraint side_event_assignments_v1_event_id_check check (event_id in ('PE23','PE30','PE68','PE69','PE71','PE74','PE75','PE77'));
alter table public.side_event_assignments_v1 drop constraint if exists side_event_assignments_v1_intensity_check;
alter table public.side_event_assignments_v1 add constraint side_event_assignments_v1_intensity_check check (intensity between 1 and 25);
alter table public.side_event_assignments_v1 enable row level security;
revoke all on public.side_event_assignments_v1 from public, anon, authenticated, service_role;

-- Assignment is immutable and must precede the decisions phase of the cycle.
create or replace function public.side_assign_event_v1(p_partida_id uuid,p_empresa_id bigint,p_ciclo integer,p_event_id text,p_intensity integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.partidas; phase text; current_cycle integer; prior public.side_event_assignments_v1;
begin
 select * into g from public.partidas where id=p_partida_id for update;
 if g.id is null or auth.uid() is null or g.profesor_id is distinct from auth.uid() then raise exception 'No autorizado' using errcode='42501'; end if;
 if g.configuracion->>'economicEventsVersion' is distinct from 'demand-share-v1' then raise exception 'Versión de eventos no habilitada'; end if;
 if p_ciclo is null or p_ciclo not between 1 and least(6,coalesce((g.configuracion->>'cycles')::integer,0)) or p_event_id is null or p_event_id not in ('PE23','PE30','PE68','PE69','PE71','PE74','PE75','PE77') or p_intensity is null or p_intensity<1 or p_intensity>(case p_event_id when 'PE23' then 1 when 'PE30' then 25 when 'PE68' then 1 when 'PE69' then 20 when 'PE71' then 15 when 'PE74' then 12 when 'PE75' then 6 when 'PE77' then 1 else 0 end) then raise exception 'Asignación inválida'; end if;
 if not exists(select 1 from public.participantes where partida_id=g.id and empresa_id=p_empresa_id) then raise exception 'Empresa fuera de la partida'; end if;
 phase:=coalesce(public.side_runtime(g.configuracion)->>'phase','integration');
 current_cycle:=coalesce((public.side_runtime(g.configuracion)->>'round')::integer,1);
 if phase in ('cancelled','finished') or (phase <> 'integration' and p_ciclo<=current_cycle) or (phase='integration' and p_ciclo<current_cycle) then raise exception 'El ciclo ya no admite asignaciones'; end if;
 if exists(select 1 from public.side_business_closures where partida_id=g.id and ciclo=p_ciclo) then raise exception 'Ciclo cerrado'; end if;
 if exists(select 1 from public.side_event_assignments_v1 where partida_id=g.id and empresa_id=p_empresa_id and ciclo=p_ciclo and event_id<>p_event_id) then raise exception 'Ya existe otro desafío para la empresa en ese ciclo'; end if;
 insert into public.side_event_assignments_v1(partida_id,empresa_id,ciclo,event_id,intensity) values(g.id,p_empresa_id,p_ciclo,p_event_id,p_intensity) on conflict do nothing;
 select * into prior from public.side_event_assignments_v1 where partida_id=g.id and empresa_id=p_empresa_id and ciclo=p_ciclo and event_id=p_event_id;
 if prior.intensity is distinct from p_intensity then raise exception 'La asignación ya existe con otra intensidad'; end if;
 return jsonb_build_object('eventId',prior.event_id,'companyId',prior.empresa_id::text,'round',prior.ciclo,'intensity',prior.intensity);
end $$;
revoke all on function public.side_assign_event_v1(uuid,bigint,integer,text,integer) from public,anon,authenticated;
grant execute on function public.side_assign_event_v1(uuid,bigint,integer,text,integer) to authenticated;

-- Only the trusted worker receives the canonical assignment, never arbitrary effects.
create or replace function public.side_event_context_v1(p_partida_id uuid,p_empresa_id bigint,p_ciclo integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare ev jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server only' using errcode='42501'; end if;
 if not exists(select 1 from public.participantes where partida_id=p_partida_id and empresa_id=p_empresa_id) then raise exception 'Empresa fuera de la partida'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',event_id,'round',ciclo,'intensity',intensity) order by event_id),'[]'::jsonb) into ev from public.side_event_assignments_v1 where partida_id=p_partida_id and empresa_id=p_empresa_id and ciclo=p_ciclo;
 return jsonb_build_object('companyId',p_empresa_id::text,'round',p_ciclo,'events',ev);
end $$;
revoke all on function public.side_event_context_v1(uuid,bigint,integer) from public,anon,authenticated;
grant execute on function public.side_event_context_v1(uuid,bigint,integer) to service_role;

create or replace function public.side_teacher_events_v1(p_partida_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.partidas where id=p_partida_id and profesor_id=auth.uid()) then raise exception 'No autorizado' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('companyId',e.empresa_id::text,'round',e.ciclo,'eventId',e.event_id,'intensity',e.intensity,'createdAt',e.created_at,
   'status',case when c.partida_id is null then 'programado' when coalesce(c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'receipt','events'],'[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id',e.event_id,'round',e.ciclo,'intensity',e.intensity,'version',case when e.event_id='PE30' then 'assembly-breakdown-v1' when e.event_id in ('PE23','PE68','PE77') then 'operating-expense-v1' else 'demand-share-v1' end)) then 'aplicado' else 'no_aplicado' end,
   'result',case when c.partida_id is null then null else jsonb_build_object('demand',c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'receipt','marketAllocation','products'],'sold',c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'receipt','sold'],'produced',c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'receipt','produced'],'eventCash',c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'financial','flujoCaja','eventos']) end) order by e.ciclo,e.empresa_id,e.event_id),'[]'::jsonb) into result
 from public.side_event_assignments_v1 e left join public.side_business_closures c on c.partida_id=e.partida_id and c.ciclo=e.ciclo where e.partida_id=p_partida_id;
 return result;
end $$;
revoke all on function public.side_teacher_events_v1(uuid) from public,anon,authenticated;
grant execute on function public.side_teacher_events_v1(uuid) to authenticated;
