-- Aplicar DESPUÉS de supabase_student_admission.sql y las migraciones de ciclo.
-- PostgreSQL 15+: una fila por opción; NULLS NOT DISTINCT evita duplicar escalares.
-- Conserva las filas existentes. No puede reconstruir opciones ya sobrescritas.
begin;
do $$
declare
  old_key record;
begin
  -- Instalaciones anteriores pueden tener otro nombre para la misma clave.
  for old_key in
    select c.conname from pg_constraint c
    where c.conrelid='public.empresas_decisiones'::regclass and c.contype='u'
      and (select array_agg(a.attname::text order by a.attname)
        from unnest(c.conkey) k(attnum) join pg_attribute a
          on a.attrelid=c.conrelid and a.attnum=k.attnum)
        = array['ciclo','decision_id','empresa_id']
  loop
    execute format('alter table public.empresas_decisiones drop constraint %I',old_key.conname);
  end loop;
  for old_key in
    select i.indexrelid::regclass as index_name from pg_index i
    where i.indrelid='public.empresas_decisiones'::regclass
      and i.indisunique and i.indpred is null and i.indexprs is null
      and not exists(select 1 from pg_constraint c where c.conindid=i.indexrelid)
      and (select array_agg(a.attname::text order by a.attname)
        from unnest(i.indkey) k(attnum) join pg_attribute a
          on a.attrelid=i.indrelid and a.attnum=k.attnum)
        = array['ciclo','decision_id','empresa_id']
  loop
    execute format('drop index %s',old_key.index_name);
  end loop;
  if not exists (select 1 from pg_constraint
    where conrelid='public.empresas_decisiones'::regclass
      and conname='empresas_decisiones_empresa_ciclo_decision_opcion_key') then
    alter table public.empresas_decisiones
      add constraint empresas_decisiones_empresa_ciclo_decision_opcion_key
      unique nulls not distinct (empresa_id, ciclo, decision_id, opcion_id);
  end if;
end $$;

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
  -- Polls confirm presence in the database; a roster read never fabricates activity.
  update public.participantes set last_seen_at=clock_timestamp()
    where empresa_id=p_empresa_id and (last_seen_at is null or last_seen_at<clock_timestamp()-interval '15 seconds');
  select p.configuracion,p.estado into v_config,v_estado from public.partidas p
    join public.participantes pt on pt.partida_id=p.id where pt.empresa_id=p_empresa_id limit 1;
  if v_config ? 'cancelledAt' then return jsonb_build_object('error','La partida ha sido cancelada por el profesor.'); end if;
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
  if p_decisiones is null or jsonb_typeof(p_decisiones) <> 'array' then
    return jsonb_build_object('success', false, 'error', 'Las decisiones deben ser un arreglo.');
  end if;
  -- Cada llamada contiene la selección completa de las decisiones incluidas.
  -- Reemplazar únicamente estas decisiones conserva los otros apartados/ciclos.
  delete from public.empresas_decisiones ed
  using public.decisiones_catalogo dc
  where ed.empresa_id = p_empresa_id and ed.ciclo = p_ciclo
    and ed.decision_id = dc.id
    and dc.decision_id in (select entry->>'decision_id' from jsonb_array_elements(p_decisiones) entry);
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
      on conflict (empresa_id, ciclo, decision_id, opcion_id)
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
-- La entrada pública sigue siendo guardar_decisiones_estudiante, que valida
-- identidad y revisión. Esta implementación permanece privada.
revoke all on function public.guardar_decisiones(bigint, integer, jsonb) from public, anon, authenticated;
commit;
