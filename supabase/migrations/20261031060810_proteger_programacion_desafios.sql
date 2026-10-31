-- Impide programar efectos después de decisiones confirmadas. No activa partidas.
create or replace function public.side_assign_event_v1(p_partida_id uuid,p_empresa_id bigint,p_ciclo integer,p_event_id text,p_intensity integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.partidas; phase text; current_cycle integer; prior public.side_event_assignments_v1;
begin
 select * into g from public.partidas where id=p_partida_id for update;
 if g.id is null or auth.uid() is null or g.profesor_id is distinct from auth.uid() then raise exception 'No autorizado' using errcode='42501'; end if;
 if g.configuracion->>'economicEventsVersion' is distinct from 'demand-share-v1' then raise exception 'Versión de eventos no habilitada'; end if;
 if p_ciclo is null or p_ciclo not between 1 and least(6,coalesce((g.configuracion->>'cycles')::integer,0)) or p_event_id is null or p_event_id not in ('PE23','PE26','PE30','PE38','PE39','PE44','PE68','PE69','PE70','PE71','PE74','PE75','PE77','PE91','PE92') or p_intensity is null or p_intensity<1 or p_intensity>(case p_event_id when 'PE26' then 10 when 'PE38' then 1 when 'PE39' then 6 when 'PE44' then 1 when 'PE23' then 1 when 'PE30' then 25 when 'PE68' then 1 when 'PE70' then 12 when 'PE91' then 7 when 'PE92' then 12 when 'PE69' then 20 when 'PE71' then 15 when 'PE74' then 12 when 'PE75' then 6 when 'PE77' then 1 else 0 end) then raise exception 'Asignación inválida'; end if;
 if not exists(select 1 from public.participantes where partida_id=g.id and empresa_id=p_empresa_id) then raise exception 'Empresa fuera de la partida'; end if;
 phase:=coalesce(public.side_runtime(g.configuracion)->>'phase','integration');
 current_cycle:=coalesce((public.side_runtime(g.configuracion)->>'round')::integer,1);
 if phase in ('cancelled','finished') or (phase <> 'integration' and p_ciclo<=current_cycle) or (phase='integration' and p_ciclo<current_cycle) then raise exception 'El ciclo ya no admite asignaciones'; end if;
 if exists(select 1 from public.side_business_closures where partida_id=g.id and ciclo=p_ciclo) then raise exception 'Ciclo cerrado'; end if;
 if exists(select 1 from public.side_student_state where empresa_id=p_empresa_id and snapshot->>'decisions_submitted'='true' and (snapshot#>array['decision_state','__cyclePlans',p_ciclo::text] is not null or (p_event_id in ('PE70','PE91','PE92') and snapshot#>array['decision_state','__cyclePlans',(p_ciclo+1)::text] is not null))) then raise exception 'Ya hay decisiones confirmadas para el ciclo'; end if;
 if p_event_id in ('PE70','PE91','PE92') then
  if p_ciclo+1>least(6,(g.configuracion->>'cycles')::integer) then raise exception 'El evento requiere dos ciclos disponibles'; end if;
  if exists(select 1 from public.side_business_closures where partida_id=g.id and ciclo=p_ciclo+1) then raise exception 'Ciclo posterior cerrado'; end if;
  if exists(select 1 from public.side_event_assignments_v1 where partida_id=g.id and empresa_id=p_empresa_id and ciclo=p_ciclo+1 and (event_id<>p_event_id or intensity<>p_intensity)) then raise exception 'Ya existe otro desafío en el ciclo posterior'; end if;
 end if;
 if exists(select 1 from public.side_event_assignments_v1 where partida_id=g.id and empresa_id=p_empresa_id and ciclo=p_ciclo and event_id<>p_event_id) then raise exception 'Ya existe otro desafío para la empresa en ese ciclo'; end if;
 insert into public.side_event_assignments_v1(partida_id,empresa_id,ciclo,event_id,intensity) values(g.id,p_empresa_id,p_ciclo,p_event_id,p_intensity) on conflict do nothing;
 if p_event_id in ('PE70','PE91','PE92') then insert into public.side_event_assignments_v1(partida_id,empresa_id,ciclo,event_id,intensity) values(g.id,p_empresa_id,p_ciclo+1,p_event_id,p_intensity) on conflict do nothing; end if;
 select * into prior from public.side_event_assignments_v1 where partida_id=g.id and empresa_id=p_empresa_id and ciclo=p_ciclo and event_id=p_event_id;
 if prior.intensity is distinct from p_intensity then raise exception 'La asignación ya existe con otra intensidad'; end if;
 return jsonb_build_object('eventId',prior.event_id,'companyId',prior.empresa_id::text,'round',prior.ciclo,'intensity',prior.intensity);
end $$;
revoke all on function public.side_assign_event_v1(uuid,bigint,integer,text,integer) from public,anon,authenticated;
grant execute on function public.side_assign_event_v1(uuid,bigint,integer,text,integer) to authenticated;


create or replace function public.side_draw_events_v1(p_partida_id uuid,p_source_cycle integer)
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
  for ev in select * from (values ('PE23',2,0,1),('PE26',2,0,10),('PE38',1,0,1),('PE39',4,0,6),('PE44',2,0,1),('PE30',2,0,25),('PE68',1,0,1),('PE69',3,1,20),('PE70',2,0,12),('PE91',2,1,7),('PE92',1,0,12),('PE71',2,1,15),('PE74',4,1,12),('PE75',3,1,6),('PE77',3,0,1)) as e(id,probability,offset_cycle,intensity) loop
   if not (g.configuracion->'enabledEvents' ? ev.id) then continue; end if;
   first_cycle:=coalesce(nullif(g.configuracion#>>array['eventRules',ev.id,'firstRound'],'')::integer,1);
   target_cycle:=p_source_cycle+ev.offset_cycle;
   if p_source_cycle<first_cycle or target_cycle>least(6,(g.configuracion->>'cycles')::integer) or (ev.id in ('PE70','PE91','PE92') and target_cycle+1>least(6,(g.configuracion->>'cycles')::integer)) then continue; end if;
   -- Uniform unsigned 32-bit hash. Each catalog event gets its own draw.
   roll:=('x'||substr(md5(d.seed::text||':'||company.id::text||':'||ev.id),1,8))::bit(32)::bigint;
   if mod(roll,10000)>=ev.probability*100 then continue; end if;
   if exists(select 1 from public.side_business_closures where partida_id=g.id and ciclo=target_cycle) then raise exception 'Ciclo cerrado'; end if;
   if exists(select 1 from public.side_student_state where empresa_id=company.id and snapshot->>'decisions_submitted'='true' and (snapshot#>array['decision_state','__cyclePlans',target_cycle::text] is not null or (ev.id in ('PE70','PE91','PE92') and snapshot#>array['decision_state','__cyclePlans',(target_cycle+1)::text] is not null))) then raise exception 'Ya hay decisiones confirmadas para el ciclo'; end if;
   insert into public.side_event_assignments_v1(partida_id,empresa_id,ciclo,event_id,intensity) values(g.id,company.id,target_cycle,ev.id,ev.intensity) on conflict do nothing;
   if not found then raise exception 'El evento ya fue asignado por otra vía'; end if;
   selected:=selected||jsonb_build_array(jsonb_build_object('companyId',company.id::text,'eventId',ev.id,'round',target_cycle,'intensity',ev.intensity));
   if ev.id in ('PE70','PE91','PE92') then
    if exists(select 1 from public.side_business_closures where partida_id=g.id and ciclo=target_cycle+1) then raise exception 'Ciclo posterior cerrado'; end if;
    insert into public.side_event_assignments_v1(partida_id,empresa_id,ciclo,event_id,intensity) values(g.id,company.id,target_cycle+1,ev.id,ev.intensity) on conflict do nothing;
    if not found then raise exception 'La continuación del evento ya fue asignada'; end if;
    selected:=selected||jsonb_build_array(jsonb_build_object('companyId',company.id::text,'eventId',ev.id,'round',target_cycle+1,'intensity',ev.intensity));
   end if;

  end loop;
 end loop;
 update public.side_event_draws_v1 set outcome=selected where partida_id=g.id and source_cycle=p_source_cycle;
 return jsonb_build_object('sourceCycle',p_source_cycle,'events',selected,'reused',false,'rosterChanged',false);
end $$;
revoke all on function public.side_draw_events_v1(uuid,integer) from public,anon,authenticated;
grant execute on function public.side_draw_events_v1(uuid,integer) to authenticated;
