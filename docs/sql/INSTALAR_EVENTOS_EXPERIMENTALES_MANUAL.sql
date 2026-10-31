-- SIDE: instalación manual anterior, limitada a ocho eventos individuales.
-- No incluye 20261031050037_eventos_grupales_mercado_v1.sql; no activar V2.
-- No activa partidas, no instala el cierre Edge y no modifica cierres históricos.
-- Es una instalación inicial; si ya existen estas funciones o tablas, se detiene.
BEGIN;
DO $preflight$
DECLARE missing text;
BEGIN
 SELECT string_agg(name, ', ') INTO missing FROM (VALUES
   ('public.partidas', to_regclass('public.partidas')),
   ('public.empresas', to_regclass('public.empresas')),
   ('public.participantes', to_regclass('public.participantes')),
   ('public.side_business_closures', to_regclass('public.side_business_closures')),
   ('side_private.student_claims', to_regclass('side_private.student_claims'))
 ) AS required(name, object_id) WHERE object_id IS NULL;
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'Faltan tablas requeridas: %', missing; END IF;
 IF to_regprocedure('public.side_runtime(jsonb,timestamp with time zone)') IS NULL AND to_regprocedure('public.side_runtime(jsonb)') IS NULL THEN RAISE EXCEPTION 'Falta public.side_runtime compatible'; END IF;
 IF to_regprocedure('auth.uid()') IS NULL OR to_regprocedure('auth.role()') IS NULL THEN RAISE EXCEPTION 'Faltan funciones Supabase Auth'; END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='participantes' AND column_name='expulsada_at') THEN RAISE EXCEPTION 'Falta participantes.expulsada_at'; END IF;
 IF to_regclass('public.side_event_assignments_v1') IS NOT NULL OR to_regclass('public.side_event_draws_v1') IS NOT NULL OR to_regprocedure('public.side_assign_event_v1(uuid,bigint,integer,text,integer)') IS NOT NULL OR to_regprocedure('public.side_student_events_v1(uuid,bigint)') IS NOT NULL THEN
   RAISE EXCEPTION 'Ya existe una instalación parcial o completa de eventos; no se sobrescribió. Revisar versiones antes de continuar.';
 END IF;
END $preflight$;

-- Fuente: supabase/migrations/20261031025358_desafios_autoritativos_v1.sql
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

-- Fuente: supabase/migrations/20261031030035_consulta_privada_desafios.sql
-- Optional private news: depends on the session-owned claims introduced by
-- 20261028151956_identidad_estudiante and 20261028203832_acceso_estudiante_sin_clave.
-- This migration does not enable economicEventsVersion for any game.
create or replace function public.side_student_events_v1(p_partida_id uuid,p_empresa_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; cfg jsonb; current_round integer; phase text;
begin
 if auth.uid() is null or not exists (
   select 1 from public.participantes p join side_private.student_claims claim on claim.empresa_id=p.empresa_id
   where p.partida_id=p_partida_id and p.empresa_id=p_empresa_id and claim.owner_id=auth.uid() and p.expulsada_at is null
 ) then raise exception 'No autorizado' using errcode='42501'; end if;
 select configuracion into cfg from public.partidas where id=p_partida_id;
 if cfg->>'economicEventsVersion' is distinct from 'demand-share-v1' then return '[]'::jsonb; end if;
 current_round:=coalesce((public.side_runtime(cfg)->>'round')::integer,1);
 phase:=coalesce(public.side_runtime(cfg)->>'phase','integration');
 select coalesce(jsonb_agg(jsonb_build_object(
   'eventId',e.event_id,'round',e.ciclo,'intensity',e.intensity,
   'title',case e.event_id when 'PE23' then 'Inseguridad en zona comercial' when 'PE30' then 'Falla en máquina ensambladora' when 'PE68' then 'Ataque de phishing empresarial' when 'PE69' then 'Producto viral en TikTok' when 'PE71' then 'Recomendación de influencer peruano' when 'PE74' then 'Campaña de marketing altamente efectiva' when 'PE75' then 'Campaña de marketing ineficiente' when 'PE77' then 'Inspección municipal del local' end,
   'description',case when e.event_id='PE23' then 'Si tienes una tienda física activa, afrontarás un gasto extraordinario de S/ 500 por seguridad.' when e.event_id='PE30' then 'La capacidad de ensamblado se reduce durante el ciclo y, si tienes maquinaria de ensamblado, se paga S/ 200 de reparación.' when e.event_id='PE68' then 'El incidente genera un gasto extraordinario de S/ 1.200.' when e.event_id='PE74' then 'Si inviertes en marketing este ciclo, la campaña aumenta el atractivo relativo de tu marca; las ventas dependen de la demanda y del inventario.' when e.event_id='PE75' then 'La campaña reduce el atractivo relativo de tu marca al repartir la demanda; las ventas dependen de la demanda asignada y el inventario.' when e.event_id='PE77' then 'Si tienes una tienda física activa, la inspección genera S/ 300 de gasto administrativo.' else 'La atención hacia tu marca aumenta su atractivo relativo al repartir la demanda; las ventas dependen de la demanda asignada y el inventario.' end,
   'result',case when c.partida_id is null then null else jsonb_build_object('produced',c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'receipt','produced'],'sold',c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'receipt','sold'],'eventCash',c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'financial','flujoCaja','eventos']) end,
   'status',case when c.partida_id is not null then
     case when coalesce(c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'receipt','events'],'[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id',e.event_id,'round',e.ciclo,'intensity',e.intensity,'version',case when e.event_id='PE30' then 'assembly-breakdown-v1' when e.event_id in ('PE23','PE68','PE77') then 'operating-expense-v1' else 'demand-share-v1' end)) then 'aplicado' else 'no_aplicado' end
     when e.ciclo=current_round and phase='decisions' then 'activo' else 'programado' end
 ) order by e.ciclo,e.event_id),'[]'::jsonb) into result
 from public.side_event_assignments_v1 e left join public.side_business_closures c on c.partida_id=e.partida_id and c.ciclo=e.ciclo
 where e.partida_id=p_partida_id and e.empresa_id=p_empresa_id;
 return result;
end $$;
revoke all on function public.side_student_events_v1(uuid,bigint) from public,anon,authenticated;
grant execute on function public.side_student_events_v1(uuid,bigint) to authenticated;

-- Fuente: supabase/migrations/20261031043153_programacion_desafios_autoritativa.sql
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

COMMIT;
