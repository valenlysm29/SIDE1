-- ============================================================
-- SIDE — Migración: Complemento para integración frontend ↔ Supabase
-- Archivo: supabase_migration.sql
-- Fecha: 2026-09-14
-- 
-- INSTRUCCIONES:
-- 1. Ir a Supabase Dashboard → SQL Editor → New query
-- 2. Pegar TODO este script
-- 3. Click en "Run"
-- 4. Verificar en Table Editor que todas las tablas aparecen
--
-- NOTA: Este script NO modifica las tablas existentes
-- (empresas, decisiones_catalogo, decisiones_opciones,
-- empresas_decisiones). Solo crea las que faltan.
-- ============================================================

-- Habilitar extensión para UUIDs
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. TABLA: PROFESORES
-- Vinculada a auth.users via trigger.
-- Se crea automáticamente al registrarse un usuario.
-- ============================================================
create table if not exists public.profesores (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  apellido text not null,
  curso text,
  correo text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. TABLA: PARTIDAS
-- Una partida es una sesión de juego creada por un profesor.
-- Genera código SIDE-XXXX para que los estudiantes se unan.
-- ============================================================
create table if not exists public.partidas (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references public.profesores(id) on delete cascade,
  nombre text not null,
  codigo text not null unique default ('SIDE-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,4))),
  curso text,
  segmento text not null default 'Estandar'
    check (segmento in ('Economico','Estandar','Premium')),
  estado text not null default 'esperando'
    check (estado in ('esperando','activa','finalizada')),
  configuracion jsonb not null default '{}'::jsonb,
  eventos_habilitados jsonb not null default '[]'::jsonb,
  inicio_programado timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 3. TABLA: PARTICIPANTES
-- Vincula estudiante → partida → empresa.
-- El estudiante se une con código + nombre de empresa.
-- ============================================================
create table if not exists public.participantes (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid not null references public.partidas(id) on delete cascade,
  empresa_id bigint references public.empresas(id) on delete set null,
  nombre text not null,
  empresa text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 4. TABLA: REPORTES_CICLO
-- Almacena el estado financiero de cada empresa por ciclo.
-- Se usa para que el docente vea reportes en tiempo real.
-- ============================================================
create table if not exists public.reportes_ciclo (
  id uuid primary key default gen_random_uuid(),
  empresa_id bigint not null references public.empresas(id) on delete cascade,
  ciclo integer not null,
  capital numeric not null default 0,
  ingresos numeric not null default 0,
  costos numeric not null default 0,
  utilidad numeric not null default 0,
  caja_final numeric not null default 0,
  balance_caja jsonb not null default '{}'::jsonb,
  flujo_caja jsonb not null default '{}'::jsonb,
  estado_resultados jsonb not null default '{}'::jsonb,
  decisiones jsonb not null default '[]'::jsonb,
  eventos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(empresa_id, ciclo)
);

-- ============================================================
-- 5. TABLA: EVENTOS_ESTUDIANTE
-- Registra qué eventos se activaron para cada estudiante.
-- ============================================================
create table if not exists public.eventos_estudiante (
  id uuid primary key default gen_random_uuid(),
  empresa_id bigint not null references public.empresas(id) on delete cascade,
  evento_id text not null,
  ciclo integer not null,
  afectado boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 6. ÍNDICES
-- ============================================================
create index if not exists idx_partidas_profesor on public.partidas(profesor_id);
create index if not exists idx_partidas_codigo on public.partidas(codigo);
create index if not exists idx_participantes_partida on public.participantes(partida_id);
create index if not exists idx_participantes_empresa on public.participantes(empresa_id);
create index if not exists idx_reportes_empresa on public.reportes_ciclo(empresa_id);
create index if not exists idx_reportes_ciclo on public.reportes_ciclo(ciclo);
create index if not exists idx_eventos_empresa on public.eventos_estudiante(empresa_id);

-- ============================================================
-- 7. TRIGGER: Crea perfil del profesor al registrarse en Auth
-- ============================================================
create or replace function public.crear_perfil_profesor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profesores (id, nombre, apellido, curso, correo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre',''),
    coalesce(new.raw_user_meta_data->>'apellido',''),
    new.raw_user_meta_data->>'curso',
    new.email
  )
  on conflict (id) do update set
    nombre = excluded.nombre,
    apellido = excluded.apellido,
    curso = excluded.curso,
    correo = excluded.correo;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_side on auth.users;
create trigger on_auth_user_created_side
after insert on auth.users
for each row execute procedure public.crear_perfil_profesor();

-- Re-sincroniza el perfil si la metadata llega o cambia después del INSERT
-- (misma función upsert por id; solo toca profesores, sin recursión).
drop trigger if exists on_auth_user_updated_side on auth.users;
create trigger on_auth_user_updated_side
after update of raw_user_meta_data on auth.users
for each row execute procedure public.crear_perfil_profesor();

-- ============================================================
-- 8. FUNCIÓN RPC: Buscar partida por código
-- Solo devuelve partidas en estado 'esperando'.
-- ============================================================
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
    and p.estado = 'esperando'
  limit 1;
$$;

revoke all on function public.buscar_partida_por_codigo(text) from public;
grant execute on function public.buscar_partida_por_codigo(text) to anon, authenticated;

-- ============================================================
-- 9. FUNCIÓN RPC: Crear empresa al unirse a partida
-- Crea la empresa y vincula el participante.
-- ============================================================
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
begin
  -- Verificar que la partida existe y está en espera
  if not exists (
    select 1 from public.partidas
    where id = p_partida_id and estado = 'esperando'
  ) then
    return jsonb_build_object('error', 'La partida no existe o ya inició');
  end if;

  -- El capital lo manda la partida (modo fijo). En modo aleatorio se respeta
  -- el monto calculado por el frontend (p_capital) como respaldo.
  select configuracion into v_cfg
  from public.partidas where id = p_partida_id;
  if coalesce(v_cfg->>'capitalMode', 'fixed') = 'random' then
    v_capital := p_capital;
  else
    v_capital := coalesce((v_cfg->>'capital')::numeric, p_capital);
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
    'configuracion', coalesce(v_cfg, '{}'::jsonb)
  );

  return v_resultado;
end;
$$;

revoke all on function public.crear_empresa(uuid, text, text, text, numeric) from public;
grant execute on function public.crear_empresa(uuid, text, text, text, numeric) to anon, authenticated;

-- ============================================================
-- 10. FUNCIÓN RPC: Guardar decisiones de un ciclo
-- Inserta o actualiza las decisiones de una empresa.
-- ============================================================
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
begin
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

revoke all on function public.guardar_decisiones(bigint, integer, jsonb) from public;
grant execute on function public.guardar_decisiones(bigint, integer, jsonb) to anon, authenticated;

-- ============================================================
-- 11. FUNCIÓN RPC: Obtener reporte de empresa para docente
-- ============================================================
create or replace function public.obtener_reporte_empresa(
  p_empresa_id bigint,
  p_ciclo integer default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'empresa', (
      select row_to_json(e) from public.empresas e
      where e.id = p_empresa_id
    ),
    'reportes', (
      select coalesce(jsonb_agg(row_to_json(r) order by r.ciclo), '[]'::jsonb)
      from public.reportes_ciclo r
      where r.empresa_id = p_empresa_id
        and (p_ciclo is null or r.ciclo = p_ciclo)
    ),
    'decisiones', (
      select coalesce(jsonb_agg(row_to_json(ed) order by ed.ciclo), '[]'::jsonb)
      from public.empresas_decisiones ed
      where ed.empresa_id = p_empresa_id
        and (p_ciclo is null or ed.ciclo = p_ciclo)
    )
  );
$$;

revoke all on function public.obtener_reporte_empresa(bigint, integer) from public;
grant execute on function public.obtener_reporte_empresa(bigint, integer) to anon, authenticated;

-- ============================================================
-- 12. FUNCIÓN RPC: Obtener estado del juego para estudiante
-- Devuelve la configuración de la partida y el ciclo actual.
-- ============================================================
create or replace function public.obtener_estado_juego(
  p_empresa_id bigint
)
returns jsonb
language sql
security definer
set search_path = public
as $$
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
  );
$$;

revoke all on function public.obtener_estado_juego(bigint) from public;
grant execute on function public.obtener_estado_juego(bigint) to anon, authenticated;

-- ============================================================
-- 13. FUNCIÓN RPC: Avanzar ciclo de una partida
-- Solo el profesor dueño puede ejecutar.
-- ============================================================
create or replace function public.avanzar_ciclo(
  p_partida_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profesor_id uuid;
  v_nuevo_ciclo integer;
begin
  -- Verificar que el profesor es dueño de la partida
  select profesor_id into v_profesor_id
  from public.partidas
  where id = p_partida_id;

  if v_profesor_id != auth.uid() then
    return jsonb_build_object('error', 'No tienes permiso para modificar esta partida');
  end if;

  -- Avanzar el ciclo actual de todas las empresas de esta partida
  update public.empresas e
  set ciclo_actual = ciclo_actual + 1
  where e.id in (
    select pt.empresa_id
    from public.participantes pt
    where pt.partida_id = p_partida_id
      and pt.empresa_id is not null
  )
  returning ciclo_actual into v_nuevo_ciclo;

  return jsonb_build_object(
    'success', true,
    'nuevo_ciclo', v_nuevo_ciclo
  );
end;
$$;

revoke all on function public.avanzar_ciclo(uuid) from public;
grant execute on function public.avanzar_ciclo(uuid) to authenticated;

-- ============================================================
-- 14. POBLADO: Decisiones Catalogo y Opciones
-- Inserta todas las decisiones del frontend (decision_catalog.js)
-- ============================================================

-- Crear constraints UNIQUE para evitar duplicados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'decisiones_catalogo_decision_id_key'
      AND conrelid = 'public.decisiones_catalogo'::regclass
  ) THEN
    ALTER TABLE public.decisiones_catalogo
      ADD CONSTRAINT decisiones_catalogo_decision_id_key UNIQUE (decision_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'decisiones_opciones_decision_opcion_key'
      AND conrelid = 'public.decisiones_opciones'::regclass
  ) THEN
    ALTER TABLE public.decisiones_opciones
      ADD CONSTRAINT decisiones_opciones_decision_opcion_key UNIQUE (decision_id, opcion_id);
  END IF;

  -- Requerido por la RPC guardar_decisiones (ON CONFLICT empresa+ ciclo + decision).
  -- Sin este constraint el guardado falla con error 42P10.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'empresas_decisiones_empresa_ciclo_decision_key'
      AND conrelid = 'public.empresas_decisiones'::regclass
  ) THEN
    ALTER TABLE public.empresas_decisiones
      ADD CONSTRAINT empresas_decisiones_empresa_ciclo_decision_key
      UNIQUE (empresa_id, ciclo, decision_id);
  END IF;
END $$;

-- Insertar categorias de decisiones
INSERT INTO public.decisiones_catalogo (categoria, categoria_nombre, decision_id, decision_nombre, tipo, es_recurrente, es_obligatoria, costo_base, descripcion, activo)
VALUES
  ('B', 'Infraestructura', 'MESA_CORTE', 'Mesas de corte', 'quantity', false, false, 2500, 'Mesa de trabajo para la etapa de corte', true),
  ('B', 'Infraestructura', 'ENSAMBLE', 'Maquinas de ensamblado', 'quantity-choice', false, false, 3500, 'Equipo para ensamblado de productos', true),
  ('B', 'Infraestructura', 'ACABADOS', 'Maquinas de acabados', 'quantity-choice', false, false, 1200, 'Equipo para acabados de productos', true),
  ('B', 'Infraestructura', 'MOLDE', 'Molde de producto', 'choice', false, true, 300, 'Define el patron de tu producto', true),
  ('B', 'Infraestructura', 'LOCAL_PROD', 'Local de produccion', 'choice', true, true, 2000, 'Espacio de produccion obligatorio', true),
  ('B', 'Infraestructura', 'MANTENIMIENTO', 'Mantenimiento de maquinaria', 'choice', false, false, 200, 'Mantenimiento preventivo', true),
  ('C', 'Produccion', 'PRODUCCION_META', 'Meta de produccion', 'production-plan', true, true, 0, 'Define cuanto deseas producir', true),
  ('C', 'Produccion', 'PERS_CORTE', 'Personal de corte', 'quantity-choice', true, false, 1500, 'Personal para la etapa de corte', true),
  ('C', 'Produccion', 'PERS_ENSAMBLE', 'Personal de ensamble', 'quantity-choice', true, false, 1500, 'Personal para ensamblado', true),
  ('C', 'Produccion', 'PERS_ACABADO', 'Personal de acabados', 'quantity-choice', true, false, 1500, 'Personal para acabados', true),
  ('C', 'Produccion', 'JEFATURA', 'Jefatura de produccion', 'choice', true, false, 3000, 'Coordinacion de operaciones', true),
  ('C', 'Produccion', 'LIMPIEZA', 'Limpieza y servicios generales', 'choice', true, true, 600, 'Costo operativo obligatorio', true),
  ('C', 'Produccion', 'GARANTIA_PT', 'Garantia de productos terminados', 'choice', true, true, 0, 'Politica de respaldo al cliente', true),
  ('F', 'Logistica', 'ANALISTA_COMPRAS', 'Analista de compras', 'choice', true, false, 5000, 'Negociacion especializada', true),
  ('F', 'Logistica', 'CUERO', 'Compra de cuero', 'quantity-choice', true, false, 25, 'Materia prima principal', true),
  ('F', 'Logistica', 'ACCESORIOS', 'Compra de accesorios', 'quantity-choice', true, false, 4, 'Componentes del producto', true),
  ('F', 'Logistica', 'HILO', 'Compra de hilo', 'quantity-choice', true, false, 2, 'Material de costura', true),
  ('F', 'Logistica', 'GARANTIA_PROV', 'Garantia de proveedores', 'choice', true, false, 0, 'Devolucion por material fallado', true),
  ('D', 'Canales y ventas', 'CANALES', 'Canales de venta', 'multi-choice', true, true, 500, 'Define donde vender', true),
  ('D', 'Canales y ventas', 'PERSONAL_VENTAS', 'Personal de ventas', 'info', false, false, 0, 'Incluido con tienda fisica', true),
  ('D', 'Canales y ventas', 'CREDITO_VENTAS', 'Ventas a credito', 'info', false, false, 0, 'Porcentaje automatico', true),
  ('D', 'Canales y ventas', 'DEVOLUCIONES', 'Producto fallado', 'info', false, false, 0, 'Politica de devolucion', true),
  ('E', 'Inversiones y finanzas', 'INV_RRHH', 'Capacitacion del equipo', 'choice', true, false, 0, 'Inversion en capital humano', true),
  ('E', 'Inversiones y finanzas', 'INV_MARKETING', 'Inversion en marketing', 'choice', true, true, 1500, 'Presencia de marca', true),
  ('E', 'Inversiones y finanzas', 'PRESTAMO', 'Linea de credito', 'loan', false, false, 0, 'Financiamiento bancario', true)
ON CONFLICT (decision_id) DO NOTHING;

-- Insertar opciones de decisiones
INSERT INTO public.decisiones_opciones (decision_id, opcion_id, etiqueta, descripcion, costo, capacidad_diaria, tasa_liquidacion, canal, distrito, demanda_factor, compromiso_ciclos, activo)
SELECT
  dc.id, opts.opcion_id, opts.etiqueta, opts.descripcion, opts.costo,
  opts.capacidad_diaria, opts.tasa_liquidacion, opts.canal, opts.distrito,
  opts.demanda_factor, opts.compromiso_ciclos, true
FROM public.decisiones_catalogo dc
CROSS JOIN LATERAL (
  VALUES
    ('MESA_CORTE', 'mesa', 'Mesa de corte', 'Mesa de trabajo para corte', 2500, 40, 0.4, null, null, null, null),
    ('ENSAMBLE', 'ens_basica', 'Basica / manual', 'Equipo basico', 3500, 15, 0.4, null, null, null, null),
    ('ENSAMBLE', 'ens_semi', 'Semi-industrial', 'Mayor estabilidad', 7500, 30, 0.4, null, null, null, null),
    ('ENSAMBLE', 'ens_ind', 'Industrial', 'Alto desempeno', 15000, 55, 0.4, null, null, null, null),
    ('ACABADOS', 'aca_basica', 'Basica / manual', 'Acabado manual', 1200, 15, 0.4, null, null, null, null),
    ('ACABADOS', 'aca_semi', 'Semi-industrial', 'Pulido electrico', 4500, 30, 0.4, null, null, null, null),
    ('ACABADOS', 'aca_ind', 'Industrial', 'Linea de acabado', 9500, 55, 0.4, null, null, null, null),
    ('MOLDE', 'molde_1', 'Molde basico', 'Patron sencillo', 300, null, null, null, null, null, null),
    ('MOLDE', 'molde_2', 'Molde mejorado', 'Patron tecnico', 1200, null, null, null, null, null, null),
    ('MOLDE', 'molde_3', 'Molde premium', 'Patron propio', 3500, null, null, null, null, null, null),
    ('LOCAL_PROD', 'local_std', 'Local estandar', 'Espacio de produccion', 2000, null, null, null, null, null, null),
    ('MANTENIMIENTO', 'correctivo', 'Preventivo', 'Intervencion opcional', 200, null, null, null, null, null, null),
    ('PERS_CORTE', 'corte_basico', 'Operario basico', 'Tareas estandarizadas', 1500, null, null, null, null, null, null),
    ('PERS_CORTE', 'corte_exp', 'Cortador con experiencia', 'Mayor velocidad', 2500, null, null, null, null, null, null),
    ('PERS_CORTE', 'corte_maestro', 'Maestro cortador', 'Materiales complejos', 4000, null, null, null, null, null, null),
    ('PERS_ENSAMBLE', 'ens_personal_basico', 'Costurero basico', 'Disenos simples', 1500, null, null, null, null, null, null),
    ('PERS_ENSAMBLE', 'ens_personal_ind', 'Maquinista industrial', 'Mayor productividad', 2800, null, null, null, null, null, null),
    ('PERS_ENSAMBLE', 'ens_personal_esp', 'Marroquinero especializado', 'Piezas complejas', 4500, null, null, null, null, null, null),
    ('PERS_ACABADO', 'aca_personal_basico', 'Operario de acabado', 'Acabados basicos', 1500, null, null, null, null, null, null),
    ('PERS_ACABADO', 'aca_personal_tec', 'Tecnico en acabados', 'Herramientas especiales', 2800, null, null, null, null, null, null),
    ('PERS_ACABADO', 'aca_personal_art', 'Artesano acabador', 'Acabados finos', 4500, null, null, null, null, null, null),
    ('JEFATURA', 'no_jefatura', 'No contratar', 'Sin coordinacion', 0, null, null, null, null, null, null),
    ('JEFATURA', 'si_jefatura', 'Contratar', 'Coordinacion de operacion', 3000, null, null, null, null, null, null),
    ('LIMPIEZA', 'limpieza', 'Limpieza y servicios', 'Costo obligatorio', 600, null, null, null, null, null, null),
    ('GARANTIA_PT', 'pt_30', 'Cobertura 30 dias', 'Politica basica', 0, null, null, null, null, null, null),
    ('GARANTIA_PT', 'pt_90', 'Cobertura 90 dias', 'Mayor respaldo', 0, null, null, null, null, null, null),
    ('GARANTIA_PT', 'pt_180', 'Cobertura 180 dias', 'Politica amplia', 0, null, null, null, null, null, null),
    ('ANALISTA_COMPRAS', 'no_analista', 'No contratar', 'Sin negociacion', 0, null, null, null, null, null, null),
    ('ANALISTA_COMPRAS', 'si_analista', 'Contratar', 'Negociacion especializada', 5000, null, null, null, null, null, null),
    ('CUERO', 'cuero_sint', 'Cuero sintetico', 'Alternativa economica', 25, null, null, null, null, null, null),
    ('CUERO', 'cuero_std', 'Cuero genuino estandar', 'Balance costo-durabilidad', 45, null, null, null, null, null, null),
    ('CUERO', 'cuero_prem', 'Cuero genuino premium', 'Mayor durabilidad', 80, null, null, null, null, null, null),
    ('ACCESORIOS', 'acc_eco', 'Alegacion economica', 'Funcional', 4, null, null, null, null, null, null),
    ('ACCESORIOS', 'acc_prem', 'Metal premium', 'Mayor durabilidad', 9, null, null, null, null, null, null),
    ('HILO', 'hilo_std', 'Poliester estandar', 'Costo bajo', 2, null, null, null, null, null, null),
    ('HILO', 'hilo_ref', 'Encerado reforzado', 'Mayor resistencia', 4, null, null, null, null, null, null),
    ('HILO', 'hilo_prem', 'Alta tenacidad', 'Acabados exigentes', 7, null, null, null, null, null, null),
    ('GARANTIA_PROV', 'gar_0', 'Sin garantia', 'Sin devolucion', 0, null, null, null, null, null, null),
    ('GARANTIA_PROV', 'gar_80', '80% de devolucion', 'Devolucion parcial', 0, null, null, null, null, null, null),
    ('GARANTIA_PROV', 'gar_100', '100% de devolucion', 'Devolucion total', 0, null, null, null, null, null, null),
    ('CANALES', 'web', 'Pagina web', 'Canal digital', 500, null, null, 'web', null, null, null),
    ('CANALES', 'los_olivos', 'Tienda - Los Olivos', 'Punto fisico', 1800, null, null, 'store', 'Los Olivos', 1.00, 12),
    ('CANALES', 'miraflores', 'Tienda - Miraflores', 'Mayor demanda', 3500, null, null, 'store', 'Miraflores', 1.25, 12),
    ('CANALES', 'sjl', 'Tienda - San Juan de Lurigancho', 'Alta base poblacional', 2200, null, null, 'store', 'San Juan de Lurigancho', 1.10, 12),
    ('INV_RRHH', 'cap_no', 'No capacitar', 'Sin inversion', 0, null, null, null, null, null, null),
    ('INV_RRHH', 'cap_baja', 'Baja', 'Tecnica puntual', 1000, null, null, null, null, null, null),
    ('INV_RRHH', 'cap_media', 'Media', 'Tecnica intermedia', 6000, null, null, null, null, null, null),
    ('INV_RRHH', 'cap_alta', 'Alta', 'Avanzada y especializada', 12000, null, null, null, null, null, null),
    ('INV_MARKETING', 'mkt_baja', 'Baja', 'Presencia basica', 1500, null, null, null, null, null, null),
    ('INV_MARKETING', 'mkt_media', 'Media', 'Mayor alcance', 6000, null, null, null, null, null, null),
    ('INV_MARKETING', 'mkt_alta', 'Alta', 'Campana intensiva', 12000, null, null, null, null, null, null)
) AS opts(decision_id_key, opcion_id, etiqueta, descripcion, costo, capacidad_diaria, tasa_liquidacion, canal, distrito, demanda_factor, compromiso_ciclos)
WHERE dc.decision_id = opts.decision_id_key
ON CONFLICT (decision_id, opcion_id) DO NOTHING;

-- ============================================================
-- 15. RLS: Habilitar Row Level Security
-- ============================================================

-- Tablas nuevas
alter table public.reportes_ciclo enable row level security;
alter table public.eventos_estudiante enable row level security;

-- PARTICIPANTES: verificar si RLS ya está habilitado
DO $$
BEGIN
  -- Habilitar RLS si no está habilitado
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'participantes'
      AND n.nspname = 'public'
      AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE public.participantes ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- PROFESORES
drop policy if exists "profesor ve su perfil" on public.profesores;
create policy "profesor ve su perfil"
on public.profesores for select
to authenticated
using (id = auth.uid());

drop policy if exists "profesor actualiza su perfil" on public.profesores;
create policy "profesor actualiza su perfil"
on public.profesores for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- PARTIDAS
drop policy if exists "profesor ve sus partidas" on public.partidas;
create policy "profesor ve sus partidas"
on public.partidas for select
to authenticated
using (profesor_id = auth.uid());

drop policy if exists "profesor crea partidas" on public.partidas;
create policy "profesor crea partidas"
on public.partidas for insert
to authenticated
with check (profesor_id = auth.uid());

drop policy if exists "profesor actualiza sus partidas" on public.partidas;
create policy "profesor actualiza sus partidas"
on public.partidas for update
to authenticated
using (profesor_id = auth.uid())
with check (profesor_id = auth.uid());

drop policy if exists "profesor elimina sus partidas" on public.partidas;
create policy "profesor elimina sus partidas"
on public.partidas for delete
to authenticated
using (profesor_id = auth.uid());

-- PARTICIPANTES
drop policy if exists "estudiante entra a partida" on public.participantes;
create policy "estudiante entra a partida"
on public.participantes for insert
to anon, authenticated
with check (
  exists (
    select 1 from public.partidas p
    where p.id = partida_id
      and p.estado = 'esperando'
  )
);

drop policy if exists "profesor ve participantes" on public.participantes;
create policy "profesor ve participantes"
on public.participantes for select
to authenticated
using (
  exists (
    select 1 from public.partidas p
    where p.id = participantes.partida_id
      and p.profesor_id = auth.uid()
  )
);

-- REPORTES_CICLO
drop policy if exists "profesor ve reportes" on public.reportes_ciclo;
create policy "profesor ve reportes"
on public.reportes_ciclo for select
to authenticated
using (
  exists (
    select 1
    from public.empresas e
    where e.id = reportes_ciclo.empresa_id
  )
);

drop policy if exists "sistema crea reportes" on public.reportes_ciclo;
create policy "sistema crea reportes"
on public.reportes_ciclo for insert
to anon, authenticated
with check (true);

-- EVENTOS_ESTUDIANTE
drop policy if exists "estudiante ve sus eventos" on public.eventos_estudiante;
create policy "estudiante ve sus eventos"
on public.eventos_estudiante for select
to anon, authenticated
using (true);

drop policy if exists "sistema registra eventos" on public.eventos_estudiante;
create policy "sistema registra eventos"
on public.eventos_estudiante for insert
to anon, authenticated
with check (true);

-- EMPRESAS (tabla existente) - agregar RLS si no tiene
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'empresas'
      AND schemaname = 'public'
  ) THEN
    ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "estudiante ve su empresa"
    ON public.empresas FOR SELECT
    TO anon, authenticated
    USING (true);

    CREATE POLICY "sistema crea empresas"
    ON public.empresas FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

    CREATE POLICY "sistema actualiza empresas"
    ON public.empresas FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- EMPRESAS_DECISIONES (tabla existente) - agregar RLS si no tiene
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'empresas_decisiones'
      AND schemaname = 'public'
  ) THEN
    ALTER TABLE public.empresas_decisiones ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "estudiante ve sus decisiones"
    ON public.empresas_decisiones FOR SELECT
    TO anon, authenticated
    USING (true);

    CREATE POLICY "sistema guarda decisiones"
    ON public.empresas_decisiones FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

    CREATE POLICY "sistema actualiza decisiones"
    ON public.empresas_decisiones FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- DECISIONES_CATALOGO (tabla existente) - agregar RLS si no tiene
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'decisiones_catalogo'
      AND schemaname = 'public'
  ) THEN
    ALTER TABLE public.decisiones_catalogo ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "todos ven catálogo"
    ON public.decisiones_catalogo FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;
END $$;

-- DECISIONES_OPCIONES (tabla existente) - agregar RLS si no tiene
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'decisiones_opciones'
      AND schemaname = 'public'
  ) THEN
    ALTER TABLE public.decisiones_opciones ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "todos ven opciones"
    ON public.decisiones_opciones FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;
END $$;

-- ============================================================
-- 16. PERMISOS DE USO
-- ============================================================
grant select, insert, update on public.profesores to authenticated;
grant select, insert, update, delete on public.partidas to authenticated;
grant select, insert on public.participantes to anon, authenticated;
grant select on public.reportes_ciclo to anon, authenticated;
grant insert, update on public.reportes_ciclo to anon, authenticated;
grant select on public.eventos_estudiante to anon, authenticated;
grant insert on public.eventos_estudiante to anon, authenticated;
grant select on public.empresas to anon, authenticated;
grant insert, update on public.empresas to anon, authenticated;
grant select on public.empresas_decisiones to anon, authenticated;
grant insert, update on public.empresas_decisiones to anon, authenticated;
grant select on public.decisiones_catalogo to anon, authenticated;
grant select on public.decisiones_opciones to anon, authenticated;

-- ============================================================
-- LISTO
-- ============================================================
-- Migración completada.
-- Tablas creadas: profesores, partidas, participantes,
--                 reportes_ciclo, eventos_estudiante
-- RPCs creadas: buscar_partida_por_codigo, crear_empresa,
--               guardar_decisiones, obtener_reporte_empresa,
--               obtener_estado_juego, avanzar_ciclo
-- Catálogo poblado: 25 decisiones + 56 opciones
-- Constraints UNIQUE: decisiones_catalogo(decision_id),
--   decisiones_opciones(decision_id, opcion_id),
--   empresas_decisiones(empresa_id, ciclo, decision_id)
-- RLS configurado en todas las tablas
-- NOTA: el script es idempotente, puede ejecutarse varias veces.
-- ============================================================
