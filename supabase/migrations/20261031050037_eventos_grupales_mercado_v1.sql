-- Nuevos eventos grupales opt-in; no activa versiones ni cambia cierres.
alter table public.side_event_assignments_v1 drop constraint if exists side_event_assignments_v1_event_id_check;
alter table public.side_event_assignments_v1 add constraint side_event_assignments_v1_event_id_check check (event_id in ('PE01','PE02','PE03','PE04','PE23','PE30','PE68','PE69','PE71','PE74','PE75','PE77'));
alter table public.side_event_assignments_v1 drop constraint if exists side_event_assignments_v1_intensity_check;
alter table public.side_event_assignments_v1 add constraint side_event_assignments_v1_intensity_check check (intensity between 1 and 30);

create table public.side_group_events_v1 (
 partida_id uuid not null references public.partidas(id), ciclo integer not null check(ciclo between 1 and 6),
 event_id text not null check(event_id in ('PE01','PE02','PE03','PE04')),
 intensity integer not null check(intensity between 1 and 30), roster bigint[] not null,
 created_at timestamptz not null default clock_timestamp(), primary key(partida_id,ciclo,event_id)
);
alter table public.side_group_events_v1 enable row level security;
revoke all on public.side_group_events_v1 from public,anon,authenticated,service_role;

create function public.side_assign_group_event_v1(p_partida_id uuid,p_ciclo integer,p_event_id text,p_intensity integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.partidas; old public.side_group_events_v1; roster bigint[]; current_cycle integer; phase text; company_id bigint;
begin
 select * into g from public.partidas where id=p_partida_id for update;
 if g.id is null or auth.uid() is null or g.profesor_id is distinct from auth.uid() then raise exception 'No autorizado' using errcode='42501'; end if;
 if g.configuracion->>'economicEventsVersion' is distinct from 'demand-share-v1' then raise exception 'Versión de eventos no habilitada'; end if;
 if p_ciclo is null or p_ciclo not between 1 and least(6,coalesce((g.configuracion->>'cycles')::integer,0)) or p_event_id not in ('PE01','PE02','PE03','PE04') or p_intensity is null or p_intensity<1 or p_intensity>(case p_event_id when 'PE01' then 10 when 'PE02' then 15 when 'PE03' then 25 when 'PE04' then 30 else 0 end) then raise exception 'Asignación inválida'; end if;
 select array_agg(empresa_id order by empresa_id) into roster from public.participantes where partida_id=g.id and expulsada_at is null;
 if roster is null then raise exception 'No hay empresas participantes'; end if;
 select * into old from public.side_group_events_v1 where partida_id=g.id and ciclo=p_ciclo and event_id=p_event_id;
 if found then
  if old.intensity is distinct from p_intensity or old.roster is distinct from roster then raise exception 'La asignación grupal existe con otros datos'; end if;
  return jsonb_build_object('eventId',old.event_id,'round',old.ciclo,'intensity',old.intensity,'companyCount',cardinality(old.roster),'reused',true);
 end if;
 phase:=coalesce(public.side_runtime(g.configuracion)->>'phase','integration');current_cycle:=coalesce((public.side_runtime(g.configuracion)->>'round')::integer,1);
 if phase in ('cancelled','finished') or (phase<>'integration' and p_ciclo<=current_cycle) or (phase='integration' and p_ciclo<current_cycle) then raise exception 'El ciclo ya no admite asignaciones'; end if;
 if exists(select 1 from public.side_business_closures where partida_id=g.id and ciclo=p_ciclo) then raise exception 'Ciclo cerrado'; end if;
 if exists(select 1 from public.participantes p join public.side_student_state s on s.empresa_id=p.empresa_id where p.partida_id=g.id and s.snapshot->>'decisions_submitted'='true' and s.snapshot#>array['decision_state','__cyclePlans',p_ciclo::text] is not null) then raise exception 'Ya hay decisiones confirmadas para el ciclo'; end if;
 insert into public.side_group_events_v1(partida_id,ciclo,event_id,intensity,roster) values(g.id,p_ciclo,p_event_id,p_intensity,roster);
 foreach company_id in array roster loop
  insert into public.side_event_assignments_v1(partida_id,empresa_id,ciclo,event_id,intensity) values(g.id,company_id,p_ciclo,p_event_id,p_intensity);
 end loop;
 return jsonb_build_object('eventId',p_event_id,'round',p_ciclo,'intensity',p_intensity,'companyCount',cardinality(roster),'reused',false);
end $$;
revoke all on function public.side_assign_group_event_v1(uuid,integer,text,integer) from public,anon,authenticated;
grant execute on function public.side_assign_group_event_v1(uuid,integer,text,integer) to authenticated;

create or replace function public.side_teacher_events_v1(p_partida_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.partidas where id=p_partida_id and profesor_id=auth.uid()) then raise exception 'No autorizado' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('companyId',e.empresa_id::text,'round',e.ciclo,'eventId',e.event_id,'intensity',e.intensity,'createdAt',e.created_at,
   'status',case when c.partida_id is null then 'programado' when coalesce(c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'receipt','events'],'[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id',e.event_id,'round',e.ciclo,'intensity',e.intensity,'version',case when e.event_id in ('PE01','PE02','PE03','PE04') then 'market-expansion-v1' when e.event_id='PE30' then 'assembly-breakdown-v1' when e.event_id in ('PE23','PE68','PE77') then 'operating-expense-v1' else 'demand-share-v1' end)) then 'aplicado' else 'no_aplicado' end,
   'result',case when c.partida_id is null then null else jsonb_build_object('demand',c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'receipt','marketAllocation','products'],'sold',c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'receipt','sold'],'produced',c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'receipt','produced'],'eventCash',c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'financial','flujoCaja','eventos']) end) order by e.ciclo,e.empresa_id,e.event_id),'[]'::jsonb) into result
 from public.side_event_assignments_v1 e left join public.side_business_closures c on c.partida_id=e.partida_id and c.ciclo=e.ciclo where e.partida_id=p_partida_id;
 return result;
end $$;
revoke all on function public.side_teacher_events_v1(uuid) from public,anon,authenticated;
grant execute on function public.side_teacher_events_v1(uuid) to authenticated;

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
   'title',case e.event_id when 'PE01' then 'Día del Padre' when 'PE02' then 'Día de la Madre' when 'PE03' then 'Campaña de Fiestas Patrias' when 'PE04' then 'Campaña navideña' when 'PE23' then 'Inseguridad en zona comercial' when 'PE30' then 'Falla en máquina ensambladora' when 'PE68' then 'Ataque de phishing empresarial' when 'PE69' then 'Producto viral en TikTok' when 'PE71' then 'Recomendación de influencer peruano' when 'PE74' then 'Campaña de marketing altamente efectiva' when 'PE75' then 'Campaña de marketing ineficiente' when 'PE77' then 'Inspección municipal del local' end,
   'description',case when e.event_id in ('PE01','PE02','PE03','PE04') then 'La campaña aumenta el mercado potencial compartido; las ventas siguen limitadas por la demanda asignada y las existencias.' when e.event_id='PE23' then 'Si tienes una tienda física activa, afrontarás un gasto extraordinario de S/ 500 por seguridad.' when e.event_id='PE30' then 'La capacidad de ensamblado se reduce durante el ciclo y, si tienes maquinaria de ensamblado, se paga S/ 200 de reparación.' when e.event_id='PE68' then 'El incidente genera un gasto extraordinario de S/ 1.200.' when e.event_id='PE74' then 'Si inviertes en marketing este ciclo, la campaña aumenta el atractivo relativo de tu marca; las ventas dependen de la demanda y del inventario.' when e.event_id='PE75' then 'La campaña reduce el atractivo relativo de tu marca al repartir la demanda; las ventas dependen de la demanda asignada y el inventario.' when e.event_id='PE77' then 'Si tienes una tienda física activa, la inspección genera S/ 300 de gasto administrativo.' else 'La atención hacia tu marca aumenta su atractivo relativo al repartir la demanda; las ventas dependen de la demanda asignada y el inventario.' end,
   'result',case when c.partida_id is null then null else jsonb_build_object('produced',c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'receipt','produced'],'sold',c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'receipt','sold'],'eventCash',c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'financial','flujoCaja','eventos']) end,
   'status',case when c.partida_id is not null then
     case when coalesce(c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'receipt','events'],'[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id',e.event_id,'round',e.ciclo,'intensity',e.intensity,'version',case when e.event_id in ('PE01','PE02','PE03','PE04') then 'market-expansion-v1' when e.event_id='PE30' then 'assembly-breakdown-v1' when e.event_id in ('PE23','PE68','PE77') then 'operating-expense-v1' else 'demand-share-v1' end)) then 'aplicado' else 'no_aplicado' end
     when e.ciclo=current_round and phase='decisions' then 'activo' else 'programado' end
 ) order by e.ciclo,e.event_id),'[]'::jsonb) into result
 from public.side_event_assignments_v1 e left join public.side_business_closures c on c.partida_id=e.partida_id and c.ciclo=e.ciclo
 where e.partida_id=p_partida_id and e.empresa_id=p_empresa_id;
 return result;
end $$;
revoke all on function public.side_student_events_v1(uuid,bigint) from public,anon,authenticated;
grant execute on function public.side_student_events_v1(uuid,bigint) to authenticated;

create table public.side_group_draws_v1 (
 partida_id uuid not null references public.partidas(id), source_cycle integer not null check(source_cycle between 1 and 6),
 seed uuid not null, roster bigint[] not null, outcome jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default clock_timestamp(), primary key(partida_id,source_cycle)
);
alter table public.side_group_draws_v1 enable row level security;
revoke all on public.side_group_draws_v1 from public,anon,authenticated,service_role;

create function public.side_draw_group_events_v1(p_partida_id uuid,p_source_cycle integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.partidas; d public.side_group_draws_v1; roster bigint[]; ev record; first_cycle integer; roll bigint; target_cycle integer; selected jsonb:='[]'::jsonb; phase text; current_cycle integer;
begin
 select * into g from public.partidas where id=p_partida_id for update;
 if g.id is null or auth.uid() is null or g.profesor_id is distinct from auth.uid() then raise exception 'No autorizado' using errcode='42501'; end if;
 if g.configuracion->>'economicEventsVersion' is distinct from 'demand-share-v1' then raise exception 'Versión de eventos no habilitada'; end if;
 if p_source_cycle is null or p_source_cycle not between 1 and least(6,coalesce((g.configuracion->>'cycles')::integer,0)) then raise exception 'Ciclo inválido'; end if;
 select array_agg(empresa_id order by empresa_id) into roster from public.participantes where partida_id=g.id and expulsada_at is null;
 if roster is null then raise exception 'No hay empresas participantes'; end if;
 select * into d from public.side_group_draws_v1 where partida_id=g.id and source_cycle=p_source_cycle;
 if found then return jsonb_build_object('sourceCycle',d.source_cycle,'events',d.outcome,'reused',true,'rosterChanged',d.roster is distinct from roster); end if;
 phase:=coalesce(public.side_runtime(g.configuracion)->>'phase','integration');current_cycle:=coalesce((public.side_runtime(g.configuracion)->>'round')::integer,1);
 if phase in ('cancelled','finished') or (phase<>'integration' and p_source_cycle<=current_cycle) or (phase='integration' and p_source_cycle<current_cycle) then raise exception 'El ciclo ya no admite sorteos'; end if;
 if exists(select 1 from public.side_business_closures where partida_id=g.id and ciclo=p_source_cycle) then raise exception 'Ciclo cerrado'; end if;
 if jsonb_typeof(g.configuracion->'enabledEvents') is distinct from 'array' then raise exception 'Selección de eventos no disponible'; end if;
 insert into public.side_group_draws_v1(partida_id,source_cycle,seed,roster) values(g.id,p_source_cycle,gen_random_uuid(),roster) returning * into d;
 for ev in select * from (values ('PE01',2,10),('PE02',3,15),('PE03',5,25),('PE04',5,30)) as e(id,probability,intensity) loop
  if not (g.configuracion->'enabledEvents' ? ev.id) then continue; end if;
  first_cycle:=coalesce(nullif(g.configuracion#>>array['eventRules',ev.id,'firstRound'],'')::integer,1);target_cycle:=p_source_cycle+1;
  if p_source_cycle<first_cycle or target_cycle>least(6,(g.configuracion->>'cycles')::integer) then continue; end if;
  roll:=('x'||substr(md5(d.seed::text||':'||ev.id),1,8))::bit(32)::bigint;
  if mod(roll,10000)>=ev.probability*100 then continue; end if;
  if exists(select 1 from public.side_group_events_v1 where partida_id=g.id and ciclo=target_cycle and event_id=ev.id) then raise exception 'El evento grupal ya fue asignado por otra vía'; end if;
  perform public.side_assign_group_event_v1(g.id,target_cycle,ev.id,ev.intensity);
  selected:=selected||jsonb_build_array(jsonb_build_object('eventId',ev.id,'round',target_cycle,'intensity',ev.intensity,'companyCount',cardinality(roster)));
 end loop;
 update public.side_group_draws_v1 set outcome=selected where partida_id=g.id and source_cycle=p_source_cycle;
 return jsonb_build_object('sourceCycle',p_source_cycle,'events',selected,'reused',false,'rosterChanged',false);
end $$;
revoke all on function public.side_draw_group_events_v1(uuid,integer) from public,anon,authenticated;
grant execute on function public.side_draw_group_events_v1(uuid,integer) to authenticated;

-- Ambos sorteos se registran en una sola transacción; un error revierte ambos.
create function public.side_draw_all_events_v1(p_partida_id uuid,p_source_cycle integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare individual jsonb; grupal jsonb;
begin
 individual:=public.side_draw_events_v1(p_partida_id,p_source_cycle);
 grupal:=public.side_draw_group_events_v1(p_partida_id,p_source_cycle);
 return jsonb_build_object('sourceCycle',p_source_cycle,'events',(individual->'events')||(grupal->'events'),'reused',(individual->>'reused')::boolean and (grupal->>'reused')::boolean,'rosterChanged',(individual->>'rosterChanged')::boolean or (grupal->>'rosterChanged')::boolean);
end $$;
revoke all on function public.side_draw_all_events_v1(uuid,integer) from public,anon,authenticated;
grant execute on function public.side_draw_all_events_v1(uuid,integer) to authenticated;
