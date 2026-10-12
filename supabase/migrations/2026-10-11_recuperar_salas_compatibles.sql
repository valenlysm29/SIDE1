-- Recuperación explícita por el docente; no elimina ni cancela partidas.
-- Orden: lifecycle -> student_admission -> 20261009_sala_espera_identidad_exacta
-- -> 2026-10-11_fix_crear_partida -> este archivo. No requiere logica_excel.
begin;
do $$ begin
 if to_regprocedure('public.obtener_sala_docente()') is null
    or to_regprocedure('public.side_sync_game(uuid)') is null
    or to_regprocedure('public.side_valid_event_rules(jsonb)') is null then
  raise exception 'Aplica primero 2026-10-11_fix_crear_partida.sql y sus requisitos';
 end if;
end $$;

create or replace function public.recuperar_sala_docente(p_partida_id uuid,p_config jsonb default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 owner_id uuid:=auth.uid(); p public.partidas; c jsonb; r jsonb;
 untouched boolean; duration integer; minutes integer; deadline timestamptz;
 cycle integer; phase text;
begin
 if owner_id is null or not exists(select 1 from public.profesores where id=owner_id) then
  return jsonb_build_object('error','Debes iniciar sesión como docente.','code','NO_AUTORIZADO');
 end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,731925));
 select * into p from public.partidas where id=p_partida_id and profesor_id=owner_id for update;
 if not found then return jsonb_build_object('error','Esta sala no pertenece a tu sesión.','code','NO_AUTORIZADO'); end if;
 -- Un reintento y las pestañas adicionales recuperan el reloj establecido.
 if p.estado='finalizada' or nullif(p.configuracion->>'cancelledAt','') is not null
    or nullif(p.configuracion->>'finishedAt','') is not null
    or p.configuracion#>>'{runtime,phase}' in ('finished','cancelled')
    or p.configuracion->>'phase' in ('finished','cancelled') then
  -- La configuración terminal es autoridad; corrige solamente el estado
  -- antiguo para que no bloquee la creación voluntaria de otra sala.
  if p.estado<>'finalizada' then
   update public.partidas set estado='finalizada' where id=p.id returning * into p;
  end if;
  return to_jsonb(p)||jsonb_build_object('serverTime',clock_timestamp());
 end if;
 untouched:=p.estado='esperando' and p.started_at is null
  and nullif(p.configuracion->>'gameStartedAt','') is null
  and nullif(p.configuracion#>>'{runtime,startedAt}','') is null
  and coalesce(p.configuracion#>>'{runtime,phase}','') not in ('decisions','results')
  and coalesce(p.configuracion->>'phase','') not in ('decisions','results')
  and coalesce(p.configuracion->>'round','1')='1'
  and coalesce(p.configuracion#>>'{runtime,round}','1')='1'
  and (p.configuracion->'eventSchedule' is null or p.configuracion->'eventSchedule' in ('null'::jsonb,'{}'::jsonb))
  and not exists(select 1 from public.participantes pt join public.empresas e on e.id=pt.empresa_id where pt.partida_id=p.id and e.ciclo_actual>1)
  and not exists(select 1 from public.participantes pt join public.empresas_decisiones d on d.empresa_id=pt.empresa_id where pt.partida_id=p.id)
  and not exists(select 1 from public.participantes pt join public.reportes_ciclo d on d.empresa_id=pt.empresa_id where pt.partida_id=p.id);
 if (p.configuracion->>'lifecycleVersion'='2'
    and p.configuracion->>'gameStartAt' is not null
    and p.configuracion#>>'{runtime,phase}' in ('integration','decisions','results')
    and p.configuracion#>>'{runtime,round}' ~ '^[1-9][0-9]*$') then
  cycle:=(p.configuracion#>>'{runtime,round}')::integer;
  -- Un runtime aparentemente moderno tampoco puede retroceder evidencias
  -- históricas más avanzadas ni reabrir integración con actividad existente.
  if (p.configuracion#>>'{runtime,phase}'<>'integration' or untouched)
   and (case when coalesce(p.configuracion->>'round','') ~ '^[1-9][0-9]*$'
    then (p.configuracion->>'round')::integer else cycle end)<=cycle
   and not exists(select 1 from jsonb_each(case when jsonb_typeof(p.configuracion->'eventSchedule')='object' then p.configuracion->'eventSchedule' else '{}'::jsonb end)
    where case when key ~ '^[1-9][0-9]*$' then key::integer>cycle else false end)
   and not exists(select 1 from public.participantes pt join public.empresas e on e.id=pt.empresa_id where pt.partida_id=p.id and e.ciclo_actual>cycle)
   and not exists(select 1 from public.participantes pt join public.empresas_decisiones d on d.empresa_id=pt.empresa_id where pt.partida_id=p.id and d.ciclo>cycle)
   and not exists(select 1 from public.participantes pt join public.reportes_ciclo rc on rc.empresa_id=pt.empresa_id where pt.partida_id=p.id and rc.ciclo>cycle) then
   return public.side_sync_game(p.id);
  end if;
 end if;
 c:=jsonb_build_object('lifecycleVersion',2,'cycleCloseMode','manual','cycles',3,
  'roundHours',0,'roundMinutes',5,'integrationDurationMinutes',2,'enabledEvents',p.eventos_habilitados)
  ||p.configuracion;
 -- Configuración nueva solo si nunca hubo actividad operativa.
 if untouched and p_config is not null then c:=c||p_config; end if;
 if coalesce(c->>'cycleCloseMode','') not in ('manual','automatic')
  or coalesce(c->>'cycles','') !~ '^([1-9]|1[0-9]|20)$'
  or coalesce(c->>'roundHours','') !~ '^[0-9]{1,4}$'
  or coalesce(c->>'roundMinutes','') !~ '^([0-9]|[1-5][0-9])$'
  or coalesce(c->>'integrationDurationMinutes','') !~ '^([1-9]|[1-5][0-9]|60)$' then
  return jsonb_build_object('error','Revisa los ciclos, su duración y el tiempo de espera.','code','CONFIG_INVALIDA');
 end if;
 duration:=(c->>'roundHours')::integer*3600+(c->>'roundMinutes')::integer*60;
 if duration<60 or jsonb_typeof(c->'enabledEvents') is distinct from 'array' then
  return jsonb_build_object('error','Revisa la duración y los eventos de la sala.','code','CONFIG_INVALIDA');
 end if;
 if exists(select 1 from jsonb_array_elements_text(c->'enabledEvents') selected(id)
  where not exists(select 1 from public.side_event_catalog e where e.id=selected.id))
  or not public.side_valid_event_rules(coalesce(c->'eventRules','{}')) then
  return jsonb_build_object('error','Revisa los eventos de la sala.','code','CONFIG_INVALIDA');
 end if;
 c:=c-array['cancelledAt','finishedAt'];
 if untouched then
  minutes:=(c->>'integrationDurationMinutes')::integer;
  deadline:=greatest(clock_timestamp(),case when c->>'cycleCloseMode'='automatic'
    then coalesce(nullif(c->>'scheduledStart','')::timestamptz,clock_timestamp()) else clock_timestamp() end)+make_interval(mins=>minutes);
  r:=jsonb_build_object('round',1,'phase','integration','status','waiting','running',false,
   'mode',c->>'cycleCloseMode','duration',duration,'remaining',duration);
  c:=c||jsonb_build_object('integrationStartTime',deadline-make_interval(mins=>minutes),
   'gameStartAt',deadline,'gameStartedAt',null,'integrationMinutes',0,
   'eventSchedule',case when jsonb_typeof(c->'eventSchedule')='object' then c->'eventSchedule' else '{}'::jsonb end);
 else
  -- No reconstruir un reloj automático a partir de información incompleta:
  -- conserva el ciclo y los resultados; el docente puede reanudar el reloj.
  r:=coalesce(c->'runtime','{}');
  select greatest(coalesce(max(e.ciclo_actual),1),
   coalesce((select max(rc.ciclo) from public.participantes pt join public.reportes_ciclo rc on rc.empresa_id=pt.empresa_id where pt.partida_id=p.id),1),
   coalesce((select max(d.ciclo) from public.participantes pt join public.empresas_decisiones d on d.empresa_id=pt.empresa_id where pt.partida_id=p.id),1),
   case when coalesce(r->>'round','') ~ '^[1-9][0-9]*$' then (r->>'round')::integer else 1 end,
   case when coalesce(c->>'round','') ~ '^[1-9][0-9]*$' then (c->>'round')::integer else 1 end,
   coalesce((select max(key::integer) from jsonb_each(case when jsonb_typeof(c->'eventSchedule')='object' then c->'eventSchedule' else '{}'::jsonb end)
    where key ~ '^[1-9][0-9]*$'),1))
   into cycle from public.participantes pt join public.empresas e on e.id=pt.empresa_id where pt.partida_id=p.id;
  phase:=case when coalesce(r->>'phase',c->>'phase')='results'
   or (exists(select 1 from public.participantes pt where pt.partida_id=p.id and pt.empresa_id is not null)
    and not exists(select 1 from public.participantes pt where pt.partida_id=p.id and pt.empresa_id is not null
     and not exists(select 1 from public.reportes_ciclo rc where rc.empresa_id=pt.empresa_id and rc.ciclo=cycle)))
   then 'results' else 'decisions' end;
  r:=r||jsonb_build_object('round',cycle,'phase',phase,'status',case when phase='results' then 'finished' else 'paused' end,
   'running',false,'mode','manual','duration',duration,'remaining',case when phase='results' then 0 else duration end);
  c:=c||jsonb_build_object('cycleCloseMode','manual','cycles',greatest(cycle,(c->>'cycles')::integer),
   'gameStartAt',coalesce(p.started_at,p.created_at),'gameStartedAt',coalesce(p.started_at,p.created_at));
 end if;
 c:=c||jsonb_build_object('lifecycleVersion',2,'codigo',p.codigo,'phase',r->>'phase','round',r->'round','runtime',r);
 update public.partidas set configuracion=c,eventos_habilitados=c->'enabledEvents',
  estado=case when untouched then 'esperando' else 'activa' end,
  inicio_programado=case when untouched then deadline else inicio_programado end where id=p.id;
 return public.side_sync_game(p.id);
end $$;
revoke all on function public.recuperar_sala_docente(uuid,jsonb) from public,anon;
grant execute on function public.recuperar_sala_docente(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
