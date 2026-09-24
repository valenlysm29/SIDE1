-- Ejecutar DESPUÉS de supabase_migration.sql (y teacher_integration si se usa).
-- Migración transaccional, repetible; las partidas sin lifecycleVersion=2 se conservan.
begin;

create table if not exists public.side_event_catalog (
  id text primary key, scope text not null check(scope in ('group','individual')),
  probability numeric not null check(probability between 0 and 100)
);
alter table public.side_event_catalog enable row level security;
revoke all on public.side_event_catalog from anon, authenticated;

insert into public.side_event_catalog(id,scope,probability) values
('PE01','group',2),
('PE02','group',3),
('PE03','group',5),
('PE04','group',5),
('PE05','group',4),
('PE06','group',5),
('PE07','group',4),
('PE08','group',4),
('PE09','group',5),
('PE10','group',4),
('PE11','group',3),
('PE12','group',3),
('PE13','group',3),
('PE14','group',3),
('PE15','group',4),
('PE16','group',3),
('PE17','group',3),
('PE18','group',2),
('PE19','group',2),
('PE20','group',2),
('PE21','individual',6),
('PE22','group',3),
('PE23','individual',2),
('PE24','individual',3),
('PE25','group',2),
('PE26','individual',2),
('PE27','individual',3),
('PE28','individual',1),
('PE29','individual',4),
('PE30','individual',2),
('PE31','individual',1),
('PE32','individual',3),
('PE33','individual',2),
('PE34','individual',3),
('PE35','individual',2),
('PE36','individual',3),
('PE37','individual',2),
('PE38','individual',1),
('PE39','individual',4),
('PE40','individual',3),
('PE41','individual',4),
('PE42','individual',3),
('PE43','individual',4),
('PE44','individual',2),
('PE45','individual',2),
('PE46','group',5),
('PE47','group',3),
('PE48','group',5),
('PE49','group',4),
('PE50','group',3),
('PE51','group',2),
('PE52','group',4),
('PE53','group',3),
('PE54','group',2),
('PE55','group',2),
('PE56','group',2),
('PE57','group',2),
('PE58','group',3),
('PE59','group',3),
('PE60','group',2),
('PE61','group',3),
('PE62','group',2),
('PE63','group',2),
('PE64','group',2),
('PE65','group',4),
('PE66','individual',3),
('PE67','individual',3),
('PE68','individual',1),
('PE69','individual',3),
('PE70','individual',2),
('PE71','individual',2),
('PE72','group',3),
('PE73','group',2),
('PE74','individual',4),
('PE75','individual',3),
('PE76','individual',2),
('PE77','individual',3),
('PE78','group',2),
('PE79','individual',2),
('PE80','individual',2),
('PE81','individual',2),
('PE82','individual',1),
('PE83','individual',2),
('PE84','individual',1),
('PE85','group',4),
('PE86','group',2),
('PE87','group',3),
('PE88','individual',2),
('PE89','individual',2),
('PE90','individual',3),
('PE91','individual',2),
('PE92','individual',1)
on conflict(id) do update set scope=excluded.scope, probability=excluded.probability;

create or replace function public.side_runtime(p_config jsonb, p_now timestamptz default now())
returns jsonb language plpgsql stable set search_path=public as $$
declare
  r jsonb := coalesce(p_config->'runtime','{}');
  deadline timestamptz := nullif(p_config->>'gameStartAt','')::timestamptz;
  started timestamptz;
  duration integer := greatest(60,coalesce((p_config->>'roundHours')::integer,0)*3600+coalesce((p_config->>'roundMinutes')::integer,10)*60);
  total integer := coalesce((p_config->>'cycles')::integer,6);
  cycle integer;
begin
  if p_config->>'lifecycleVersion' is distinct from '2' then return r; end if;
  if r->>'phase'='finished' then return r; end if;
  if p_config->>'cycleCloseMode'='automatic' then
    if deadline is null or p_now<deadline then return r; end if;
    cycle := least(total,1+floor(extract(epoch from p_now-deadline)/duration)::integer);
    started := deadline+make_interval(secs=>(cycle-1)*duration);
    r := jsonb_build_object('round',cycle,'phase','decisions','status','running','running',true,
      'mode','automatic','duration',duration,'remaining',duration,'startedAt',started);
    if p_now>=deadline+make_interval(secs=>total*duration) then
      r := r||jsonb_build_object('phase','finished','status','simulation-finished','running',false,'remaining',0);
    end if;
  elsif r->>'phase'='decisions' and (r->>'running')::boolean then
    started := (r->>'startedAt')::timestamptz;
    if p_now>=started+make_interval(secs=>(r->>'duration')::integer) then
      r := r||jsonb_build_object('phase','results','status','finished','running',false,'remaining',0);
    end if;
  end if;
  return r;
end $$;

create or replace function public.side_initialize_game()
returns trigger language plpgsql security definer set search_path=public as $$
declare c jsonb:=new.configuracion; minutes integer; start_at timestamptz; duration integer;
begin
  if c->>'lifecycleVersion' is distinct from '2' then return new; end if;
  if jsonb_typeof(c->'enabledEvents') is distinct from 'array' or exists(
    select 1 from jsonb_array_elements_text(c->'enabledEvents') selected(id)
    where not exists(select 1 from public.side_event_catalog e where e.id=selected.id)
  ) then raise exception 'Selección de eventos inválida'; end if;
  if coalesce(c->>'cycleCloseMode','') not in ('manual','automatic') then raise exception 'Modo de partida inválido'; end if;
  if coalesce(c->>'cycles','') !~ '^([1-9]|1[0-9]|20)$' then raise exception 'Indica entre 1 y 20 ciclos'; end if;
  if coalesce(c->>'roundHours','') !~ '^[0-9]{1,4}$' or coalesce(c->>'roundMinutes','') !~ '^([0-9]|[1-5][0-9])$' then raise exception 'Duración de ciclo inválida'; end if;
  duration:=(c->>'roundHours')::integer*3600+(c->>'roundMinutes')::integer*60;
  if duration<60 then raise exception 'La duración mínima es un minuto'; end if;
  if c->>'cycleCloseMode'='automatic' then
    if coalesce(c->>'integrationDurationMinutes','') !~ '^([1-9]|[1-5][0-9]|60)$' then raise exception 'El tiempo de integración debe ser un entero entre 1 y 60 minutos'; end if;
    minutes:=(c->>'integrationDurationMinutes')::integer;
    start_at:=greatest(now(),coalesce(nullif(c->>'scheduledStart','')::timestamptz,now()))+make_interval(mins=>minutes);
  end if;
  c:=c||jsonb_build_object('codigo',new.codigo,'phase','integration','integrationMinutes',0,'integrationStartTime',coalesce(start_at-make_interval(mins=>minutes),now()),
    'gameStartAt',start_at,'gameStartedAt',null,'round',1,'eventSchedule','{}'::jsonb,
    'runtime',jsonb_build_object('round',1,'phase','integration','status','waiting','running',false,
      'mode',c->>'cycleCloseMode','duration',duration,'remaining',duration));
  new.configuracion:=c; new.estado:='esperando'; new.inicio_programado:=start_at;
  new.eventos_habilitados:=coalesce(c->'enabledEvents','[]');
  return new;
end $$;
drop trigger if exists side_initialize_game on public.partidas;
create trigger side_initialize_game before insert on public.partidas for each row execute function public.side_initialize_game();

-- Única transición automática. Se evalúa al consultar/unirse/decidir; no necesita
-- una pestaña docente ni un job por partida. FOR UPDATE serializa las peticiones.
create or replace function public.side_sync_game(p_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.partidas; c jsonb; r jsonb; schedule jsonb; selected jsonb; n integer; final_state text;
begin
  select * into p from public.partidas where id=p_id for update;
  if not found then return null; end if;
  c:=p.configuracion;
  if c->>'lifecycleVersion'='2' and p.estado<>'finalizada' then
    r:=public.side_runtime(c); schedule:=coalesce(c->'eventSchedule','{}');
    if r->>'phase'<>'integration' then
      for n in 1..(r->>'round')::integer loop
        if not schedule ? n::text then
          select coalesce(jsonb_agg(id),'[]') into selected from (
            select id from public.side_event_catalog where scope='group'
              and coalesce(c->'enabledEvents','[]') ? id and random()*100<probability order by random() limit 2
          ) candidates;
          schedule:=jsonb_set(schedule,array[n::text],jsonb_build_object('group',selected));
        end if;
      end loop;
      c:=c||jsonb_build_object('gameStartedAt',coalesce(c->>'gameStartedAt',c->>'gameStartAt',r->>'startedAt'));
    end if;
    c:=c||jsonb_build_object('runtime',r,'phase',r->>'phase','round',r->'round','eventSchedule',schedule);
    final_state:=case r->>'phase' when 'finished' then 'finalizada' when 'integration' then 'esperando' else 'activa' end;
    if c is distinct from p.configuracion or final_state<>p.estado then
      update public.partidas set configuracion=c,estado=final_state where id=p_id returning * into p;
      update public.empresas set ciclo_actual=(r->>'round')::integer where id in
        (select empresa_id from public.participantes where partida_id=p_id) and ciclo_actual<>(r->>'round')::integer;
    end if;
  end if;
  return to_jsonb(p)||jsonb_build_object('serverTime',clock_timestamp());
end $$;
revoke all on function public.side_sync_game(uuid) from public,anon,authenticated;

create or replace function public.controlar_partida(p_partida_id uuid,p_accion text,p_config jsonb default null,p_expected_round integer default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.partidas; c jsonb; r jsonb; duration integer; cycle integer; remaining integer;
begin
  select * into p from public.partidas where id=p_partida_id for update;
  if not found or auth.uid() is distinct from p.profesor_id then return jsonb_build_object('error','No tienes permiso para modificar esta partida'); end if;
  perform public.side_sync_game(p_partida_id);
  select * into p from public.partidas where id=p_partida_id;
  c:=p.configuracion; r:=coalesce(c->'runtime','{}'); cycle:=coalesce((r->>'round')::integer,1);
  if c->>'lifecycleVersion' is distinct from '2' then return to_jsonb(p)||jsonb_build_object('serverTime',clock_timestamp()); end if;
  duration:=greatest(60,(c->>'roundHours')::integer*3600+(c->>'roundMinutes')::integer*60);
  if p_accion='guardar' then
    if jsonb_typeof(p_config->'enabledEvents') is distinct from 'array' then return jsonb_build_object('error','Selección de eventos inválida'); end if;
    if exists(select 1 from jsonb_array_elements_text(p_config->'enabledEvents') selected(id) where not exists(select 1 from public.side_event_catalog e where e.id=selected.id)) then return jsonb_build_object('error','Evento desconocido'); end if;
    c:=c||jsonb_build_object('enabledEvents',p_config->'enabledEvents','eventSelectionMode',p_config->'eventSelectionMode','randomEventCount',p_config->'randomEventCount');
  elsif p_accion='iniciar' and p.estado<>'finalizada' and r->>'phase'='integration' and c->>'cycleCloseMode'='manual' then
    c:=c||jsonb_build_object('gameStartAt',now(),'gameStartedAt',now());
    r:=r||jsonb_build_object('phase','decisions','status','running','running',true,'startedAt',now(),'remaining',duration,'duration',duration);
  elsif p_accion in ('avanzar','pausar','reanudar','cerrar') and c->>'cycleCloseMode'='manual'
    and r->>'phase' in ('decisions','results') and p.estado<>'finalizada' and p_expected_round=cycle then
    if p_accion='avanzar' then
      if cycle>=(c->>'cycles')::integer then
        r:=r||jsonb_build_object('phase','finished','status','simulation-finished','running',false,'remaining',0);
      else
        r:=r||jsonb_build_object('round',cycle+1,'phase','decisions','status','running','running',true,'startedAt',now(),'duration',duration,'remaining',duration);
      end if;
    elsif p_accion='cerrar' then
      r:=r||jsonb_build_object('phase','results','status','finished','running',false,'remaining',0);
    elsif p_accion='pausar' and (r->>'running')::boolean then
      remaining:=greatest(0,(r->>'duration')::integer-floor(extract(epoch from now()-(r->>'startedAt')::timestamptz))::integer);
      r:=r||jsonb_build_object('status','paused','running',false,'remaining',remaining);
    elsif p_accion='reanudar' and r->>'status'='paused' then
      r:=r||jsonb_build_object('status','running','running',true,'startedAt',now(),'duration',r->'remaining');
    end if;
  end if;
  c:=c||jsonb_build_object('runtime',r,'phase',r->>'phase','round',r->'round');
  if c is distinct from p.configuracion then
    update public.partidas set configuracion=c,eventos_habilitados=coalesce(c->'enabledEvents','[]') where id=p_partida_id;
  end if;
  return public.side_sync_game(p_partida_id);
end $$;
revoke all on function public.controlar_partida(uuid,text,jsonb,integer) from public;
grant execute on function public.controlar_partida(uuid,text,jsonb,integer) to authenticated;

create or replace function public.buscar_partida_por_codigo(p_codigo text)
returns table (
  id uuid,
  codigo text,
  nombre text,
  curso text,
  estado text,
  segmento text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.codigo, p.nombre, p.curso, p.estado, p.segmento
  from public.partidas p
  where upper(p.codigo) = upper(trim(p_codigo))
    and p.estado in ('esperando','activa')
  limit 1;
$$;

create or replace function public.side_ciclo_actual(p_config jsonb)
returns integer language plpgsql stable set search_path=public as $$
declare
  v_start timestamptz := nullif(p_config->>'gameStartedAt','')::timestamptz;
  v_seconds numeric;
  v_duration integer;
begin
  if p_config->>'lifecycleVersion'='2' then return coalesce((public.side_runtime(p_config)->>'round')::integer,1); end if;
  if coalesce((p_config->>'integrationMinutes')::integer,0)=60
    and p_config->>'cycleCloseMode'='automatic' and v_start is not null then
    v_seconds := extract(epoch from now()-v_start);
    if v_seconds<3600 then return 1; end if;
    v_duration := greatest(60,coalesce((p_config->>'roundHours')::integer,0)*3600+coalesce((p_config->>'roundMinutes')::integer,0)*60);
    return least(coalesce((p_config->>'cycles')::integer,1),2+floor((v_seconds-3600)/v_duration)::integer);
  end if;
  return greatest(1,coalesce((p_config#>>'{runtime,round}')::integer,(p_config->>'round')::integer,1));
end;
$$;

create or replace function public.crear_empresa(
  p_partida_id uuid,
  p_nombre_estudiante text,
  p_nombre_legal text,
  p_nombre_comercial text,
  p_capital numeric default 100000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa_id bigint;
  v_participante_id uuid;
  v_ciclo integer;
  v_cfg jsonb;
  v_capital numeric;
  v_resultado jsonb;
  v_started timestamptz;
begin
  perform public.side_sync_game(p_partida_id);
  -- Lock the game so two simultaneous joins cannot duplicate the same company.
  perform 1 from public.partidas where id=p_partida_id and estado in ('esperando','activa') for update;
  if not found then
    return jsonb_build_object('error','La partida no existe o ya finalizó');
  end if;

  -- El capital lo manda la partida (modo fijo). En modo aleatorio se respeta
  -- el monto calculado por el frontend (p_capital) como respaldo.
  select configuracion into v_cfg
  from public.partidas where id = p_partida_id;
  if coalesce((v_cfg->>'integrationMinutes')::integer,0)=60 then
    v_started := nullif(v_cfg->>'gameStartedAt','')::timestamptz;
    if v_started is null or now()<v_started then
      return jsonb_build_object('error','La partida aún no ha iniciado. Espera al profesor.');
    end if;
  end if;
  if coalesce(v_cfg->>'capitalMode', 'fixed') = 'random' then
    v_capital := p_capital;
  else
    v_capital := coalesce((v_cfg->>'capital')::numeric, p_capital);
  end if;

  -- Reingreso: si ya existe participante con ese nombre comercial en la
  -- partida (mayúsculas/espacios no importan), se devuelve la empresa
  -- existente sin duplicar. Coincide con el texto del juego ("usa el mismo
  -- nombre comercial para volver a ingresar").
  select pt.empresa_id, pt.id into v_empresa_id, v_participante_id
  from public.participantes pt
  where pt.partida_id = p_partida_id
    and upper(trim(pt.empresa)) = upper(trim(p_nombre_comercial))
  limit 1;

  if v_empresa_id is not null then
    return (
      select jsonb_build_object(
        'empresa_id', e.id,
        'participante_id', v_participante_id,
        'caja_inicial', e.caja_actual,
        'ciclo_inicial', e.ciclo_actual,
        'reingreso', true,
        'configuracion', coalesce((select p.configuracion from public.partidas p where p.id = p_partida_id), '{}'::jsonb)
      )
      from public.empresas e
      where e.id = v_empresa_id
    );
  end if;

  if coalesce((v_cfg->>'integrationMinutes')::integer,0)=60 and (
    now()>=v_started+interval '1 hour' or coalesce((v_cfg#>>'{runtime,round}')::integer,1)<>1
    or coalesce(v_cfg#>>'{runtime,status}','ready') in ('finished','simulation-finished')
  ) then
    return jsonb_build_object('error','El ingreso de empresas nuevas solo está permitido durante la hora de integración del ciclo 1.');
  end if;

  -- La empresa nueva arranca en el ciclo actual de la partida (no en 1):
  -- si entra tarde (partida en ciclo 3), juega el ciclo 3. Primera empresa → 1.
  select coalesce(max(e.ciclo_actual), 1) into v_ciclo
  from public.empresas e
  where e.id in (
    select pt.empresa_id
    from public.participantes pt
    where pt.partida_id = p_partida_id
      and pt.empresa_id is not null
  );

  if v_cfg->>'lifecycleVersion'='2' then v_ciclo:=public.side_ciclo_actual(v_cfg); end if;

  -- Crear la empresa
  insert into public.empresas (nombre_legal, nombre_comercial, caja_inicial, caja_actual, ciclo_actual)
  values (p_nombre_legal, p_nombre_comercial, v_capital, v_capital, v_ciclo)
  returning id into v_empresa_id;

  -- Crear el participante vinculado a la empresa
  insert into public.participantes (partida_id, empresa_id, nombre, empresa)
  values (p_partida_id, v_empresa_id, p_nombre_estudiante, p_nombre_comercial)
  returning id into v_participante_id;

  -- Resultado (incluye la configuración para que el frontend la aplique)
  v_resultado := jsonb_build_object(
    'empresa_id', v_empresa_id,
    'participante_id', v_participante_id,
    'caja_inicial', v_capital,
    'ciclo_inicial', v_ciclo,
    'reingreso', false,
    'configuracion', coalesce(v_cfg, '{}'::jsonb)
  );

  return v_resultado;
end;
$$;

create or replace function public.guardar_decisiones(
  p_empresa_id bigint,
  p_ciclo integer,
  p_decisiones jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_decision jsonb;
  v_decision_catalogo_id integer;
  v_opcion_id integer;
  v_config jsonb;
  v_estado text;
begin
  perform public.side_sync_game(pt.partida_id) from public.participantes pt where pt.empresa_id=p_empresa_id;
  select p.configuracion,p.estado into v_config,v_estado from public.partidas p
    join public.participantes pt on pt.partida_id=p.id where pt.empresa_id=p_empresa_id limit 1;
  if v_config->>'lifecycleVersion'='2' then
    if v_estado<>'activa' or v_config#>>'{runtime,phase}'<>'decisions' or p_ciclo<>public.side_ciclo_actual(v_config) then
      return jsonb_build_object('error','Las decisiones solo se permiten en el ciclo operativo actual.');
    end if;
    update public.empresas set ciclo_actual=p_ciclo where id=p_empresa_id;
  end if;
  if coalesce((v_config->>'integrationMinutes')::integer,0)=60 and (
    v_estado='finalizada' or p_ciclo<2 or p_ciclo<>public.side_ciclo_actual(v_config)
    or nullif(v_config->>'gameStartedAt','') is null
    or now()< (v_config->>'gameStartedAt')::timestamptz+interval '1 hour'
    or (v_config->>'cycleCloseMode'='automatic' and now()>=(v_config->>'gameStartedAt')::timestamptz+interval '1 hour'+(coalesce((v_config->>'cycles')::integer,1)-1)*make_interval(secs=>greatest(60,coalesce((v_config->>'roundHours')::integer,0)*3600+coalesce((v_config->>'roundMinutes')::integer,0)*60)))
  ) then
    return jsonb_build_object('error','Las decisiones solo se permiten en el ciclo operativo actual de una partida en curso.');
  end if;
  if coalesce((v_config->>'integrationMinutes')::integer,0)=60 then
    update public.empresas set ciclo_actual=p_ciclo where id=p_empresa_id;
  end if;
  -- Iterar sobre cada decisión del array
  for v_decision in select * from jsonb_array_elements(p_decisiones)
  loop
    -- Buscar el ID del catálogo de decisiones
    select id into v_decision_catalogo_id
    from public.decisiones_catalogo
    where decision_id = (v_decision->>'decision_id')
    limit 1;

    if v_decision_catalogo_id is not null then
      -- Buscar el ID de la opción seleccionada
      if v_decision->>'opcion_id' is not null then
        select id into v_opcion_id
        from public.decisiones_opciones
        where decision_id = v_decision_catalogo_id
          and opcion_id = (v_decision->>'opcion_id')
        limit 1;
      else
        v_opcion_id := null;
      end if;

      -- Insertar o actualizar la decisión
      insert into public.empresas_decisiones (
        empresa_id, ciclo, decision_id, opcion_id, cantidad, costo_total, enviada
      ) values (
        p_empresa_id,
        p_ciclo,
        v_decision_catalogo_id,
        v_opcion_id,
        coalesce((v_decision->>'cantidad')::integer, 1),
        coalesce((v_decision->>'costo_total')::numeric, 0),
        true
      )
      on conflict (empresa_id, ciclo, decision_id)
      do update set
        opcion_id = excluded.opcion_id,
        cantidad = excluded.cantidad,
        costo_total = excluded.costo_total,
        enviada = true,
        updated_at = now();
    end if;
  end loop;

  return jsonb_build_object('success', true, 'guardadas', jsonb_array_length(p_decisiones));
end;
$$;

create or replace function public.obtener_estado_juego(
  p_empresa_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare result jsonb; c jsonb; events jsonb; n integer;
begin
  perform public.side_sync_game(pt.partida_id) from public.participantes pt where pt.empresa_id=p_empresa_id;
  select jsonb_build_object(
    'empresa', (
      select row_to_json(e) from public.empresas e
      where e.id = p_empresa_id
    ),
    'partida', (
      select jsonb_build_object(
        'id', p.id,
        'nombre', p.nombre,
        'codigo', p.codigo,
        'estado', p.estado,
        'configuracion', p.configuracion,
        'serverTime',clock_timestamp(),
        'eventos_habilitados', p.eventos_habilitados
      )
      from public.partidas p
      join public.participantes pt on pt.partida_id = p.id
      where pt.empresa_id = p_empresa_id
      limit 1
    ),
    -- Ciclo de la partida (máximo entre sus empresas). Una empresa recién
    -- creada siempre nace en 1, así que su propio ciclo no sirve para
    -- sincronizar al entrar; se usa el de la partida.
    'ciclo_partida', (
      select coalesce(max(e2.ciclo_actual), 1)
      from public.empresas e2
      where e2.id in (
        select pt2.empresa_id
        from public.participantes pt2
        where pt2.partida_id = (
          select pt3.partida_id
          from public.participantes pt3
          where pt3.empresa_id = p_empresa_id
          limit 1
        )
      )
    ),
    'decisiones_ciclo', (
      select coalesce(jsonb_agg(row_to_json(ed)), '[]'::jsonb)
      from public.empresas_decisiones ed
      where ed.empresa_id = p_empresa_id
        and ed.ciclo = (
          select e.ciclo_actual from public.empresas e
          where e.id = p_empresa_id
        )
    )
  ) into result;
  c:=result#>'{partida,configuracion}';
  if c->>'lifecycleVersion'='2' then
    events:='{}';
    if c#>>'{runtime,phase}'<>'integration' then
      for n in 1..public.side_ciclo_actual(c) loop
        events:=jsonb_set(events,array[n::text],coalesce((select jsonb_agg(id) from (
          select id from public.side_event_catalog where scope='individual' and coalesce(c->'enabledEvents','[]') ? id
          and (('x'||substr(md5(p_empresa_id::text||'|'||n::text||'|'||id),1,8))::bit(32)::bigint%100)<probability
          order by id limit 2
        ) candidates),'[]'));
      end loop;
    end if;
    result:=result||jsonb_build_object('individualEvents',events);
  end if;
  return result;
end;
$$;

create or replace function public.avanzar_ciclo(p_partida_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_profesor uuid;
  v_config jsonb;
  v_ciclo integer;
begin
  select profesor_id,configuracion into v_profesor,v_config from public.partidas where id=p_partida_id for update;
  if v_profesor is null or auth.uid() is distinct from v_profesor then
    return jsonb_build_object('error','No tienes permiso para modificar esta partida');
  end if;
  if v_config->>'lifecycleVersion'='2' or coalesce((v_config->>'integrationMinutes')::integer,0)=60 then
    v_ciclo:=public.side_ciclo_actual(v_config);
  else
    select coalesce(max(e.ciclo_actual),1)+1 into v_ciclo from public.empresas e
      join public.participantes pt on pt.empresa_id=e.id where pt.partida_id=p_partida_id;
  end if;
  update public.empresas e set ciclo_actual=v_ciclo
    where e.id in (select empresa_id from public.participantes where partida_id=p_partida_id);
  return jsonb_build_object('success',true,'nuevo_ciclo',v_ciclo);
end;
$$;

-- Validación de eventos también al escribir directamente mediante la API REST.
create or replace function public.side_validate_events()
returns trigger language plpgsql security definer set search_path=public as $$
declare c jsonb;
begin
  select p.configuracion into c from public.partidas p join public.participantes pt on pt.partida_id=p.id where pt.empresa_id=new.empresa_id limit 1;
  if c->>'lifecycleVersion'='2' then
    if tg_table_name='eventos_estudiante' then
      if not coalesce(c->'enabledEvents','[]') ? new.evento_id then raise exception 'Evento no habilitado'; end if;
    else
      select coalesce(jsonb_agg(e),'[]') into new.eventos from jsonb_array_elements(coalesce(new.eventos,'[]')) e where coalesce(c->'enabledEvents','[]') ? (e->>'id');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists side_validate_events on public.eventos_estudiante;
create trigger side_validate_events before insert or update on public.eventos_estudiante for each row execute function public.side_validate_events();
drop trigger if exists side_validate_events on public.reportes_ciclo;
create trigger side_validate_events before insert or update on public.reportes_ciclo for each row execute function public.side_validate_events();

commit;
