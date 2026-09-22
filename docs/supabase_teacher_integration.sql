-- SIDE: integración del ciclo 1, reingreso y registro en vivo.
-- Ejecutar después de docs/supabase_migration.sql en el SQL Editor de Supabase.
-- No borra empresas, decisiones ni partidas.
begin;

-- Resolve the scheduled cycle from the clock even while the teacher reconnects.
create or replace function public.side_ciclo_actual(p_config jsonb)
returns integer language plpgsql stable set search_path=public as $$
declare
  v_start timestamptz := nullif(p_config->>'gameStartedAt','')::timestamptz;
  v_seconds numeric;
  v_duration integer;
begin
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
  if coalesce((v_config->>'integrationMinutes')::integer,0)=60 then
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
  select p.configuracion,p.estado into v_config,v_estado from public.partidas p
    join public.participantes pt on pt.partida_id=p.id where pt.empresa_id=p_empresa_id limit 1;
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


-- Realtime gives immediate registration updates; the UI also polls every 3 s.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and
     not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='participantes') then
    alter publication supabase_realtime add table public.participantes;
  end if;
end $$;
commit;
