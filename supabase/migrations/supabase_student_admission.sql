-- SIDE - admision atomica de estudiantes y reingreso seguro
-- Ejecutar en Supabase SQL Editor DESPUES de:
--   1. docs/supabase_migration.sql
--   2. docs/supabase_game_lifecycle.sql
--
-- Es repetible y no elimina partidas, empresas, decisiones ni reportes.
-- La fase autoritativa anterior al ciclo 1 es `configuracion.runtime.phase =
-- 'integration'`. `partidas.started_at` deja una marca irreversible cuando la
-- partida sale de esa fase, incluso si luego cambia a results/finalizada.

begin;

-- Canoniza el whitespace igual que el cliente JavaScript. PostgreSQL no
-- incluye necesariamente NBSP, separadores Unicode ni BOM en [[:space:]],
-- por eso se convierten explicitamente a espacio ASCII antes de colapsar.
create or replace function public.side_limpiar_whitespace_ingreso(p_valor text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select btrim(
    regexp_replace(
      translate(
        coalesce(p_valor, ''),
        chr(160) || chr(5760)
          || chr(8192) || chr(8193) || chr(8194) || chr(8195)
          || chr(8196) || chr(8197) || chr(8198) || chr(8199)
          || chr(8200) || chr(8201) || chr(8202)
          || chr(8232) || chr(8233) || chr(8239)
          || chr(8287) || chr(12288) || chr(65279),
        repeat(' ', 19)
      ),
      '[[:space:]]+', ' ', 'g'
    )
  );
$$;

revoke all on function public.side_limpiar_whitespace_ingreso(text)
from public, anon, authenticated;

-- No depende de unaccent: cubre las tildes del castellano, ignora mayusculas
-- y reutiliza exactamente la limpieza de whitespace usada al almacenar.
create or replace function public.side_normalizar_ingreso(p_valor text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select translate(
    lower(public.side_limpiar_whitespace_ingreso(p_valor)),
    'áéíóúüñ' || chr(769) || chr(776) || chr(771),
    'aeiouun'
  );
$$;

revoke all on function public.side_normalizar_ingreso(text) from public, anon, authenticated;

-- Marca servidor confiable e irreversible del inicio del ciclo 1.
alter table public.partidas add column if not exists started_at timestamptz;

update public.partidas p
set started_at = coalesce(p.created_at, clock_timestamp())
where p.started_at is null
  and (
    p.estado in ('activa', 'finalizada')
    or p.configuracion->>'gameStartedAt' is not null
    or coalesce(p.configuracion#>>'{runtime,phase}', '') in ('decisions', 'results', 'finished')
  );

create or replace function public.side_marcar_inicio_partida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.started_at is null and (
    new.estado in ('activa', 'finalizada')
    or new.configuracion->>'gameStartedAt' is not null
    or coalesce(new.configuracion#>>'{runtime,phase}', '') in ('decisions', 'results', 'finished')
  ) then
    new.started_at := clock_timestamp();
  end if;

  -- Una partida que ya comenzo nunca vuelve a aceptar altas, aun si una
  -- actualizacion posterior intentara borrar la marca.
  if tg_op = 'UPDATE' and old.started_at is not null then
    new.started_at := old.started_at;
  end if;
  return new;
end;
$$;

drop trigger if exists side_marcar_inicio_partida on public.partidas;
create trigger side_marcar_inicio_partida
before insert or update on public.partidas
for each row execute function public.side_marcar_inicio_partida();

-- Copia inmutable de los dos nombres con que se registro el participante.
-- No se compara contra nombres que la empresa pudiera editar posteriormente.
alter table public.participantes add column if not exists nombre_legal_ingreso text;
alter table public.participantes add column if not exists nombre_comercial_ingreso text;

update public.participantes pt
set nombre_legal_ingreso = coalesce(nullif(btrim(pt.nombre_legal_ingreso), ''), e.nombre_legal),
    nombre_comercial_ingreso = coalesce(nullif(btrim(pt.nombre_comercial_ingreso), ''), e.nombre_comercial, pt.empresa)
from public.empresas e
where e.id = pt.empresa_id
  and (
    nullif(btrim(pt.nombre_legal_ingreso), '') is null
    or nullif(btrim(pt.nombre_comercial_ingreso), '') is null
  );

-- Ambos indices pueden contener claves calculadas por una version anterior de
-- la funcion IMMUTABLE. Se descartan antes de cualquier consulta de colisiones
-- para impedir que el planner responda usando claves obsoletas.
drop index if exists public.ux_side_identidad_ingreso;
drop index if exists public.idx_side_participante_ingreso;

create index idx_side_participante_ingreso
on public.participantes (
  partida_id,
  public.side_normalizar_ingreso(nombre_legal_ingreso),
  public.side_normalizar_ingreso(nombre_comercial_ingreso)
);

-- Si la instalacion historica no contiene triples duplicados, el indice
-- tambien actua como ultima barrera. Si ya los contiene, no se borra ni se
-- fusiona progreso automaticamente; la RPC igualmente serializa por partida y
-- evita que aparezcan duplicados nuevos.
do $$
begin
  if to_regclass('public.ux_side_identidad_ingreso') is null
    and not exists (
      select 1
      from public.participantes pt
      where pt.empresa_id is not null
        and public.side_normalizar_ingreso(pt.nombre_legal_ingreso) <> ''
        and public.side_normalizar_ingreso(pt.nombre_comercial_ingreso) <> ''
      group by pt.partida_id,
        public.side_normalizar_ingreso(pt.nombre_legal_ingreso),
        public.side_normalizar_ingreso(pt.nombre_comercial_ingreso)
      having count(*) > 1
    )
  then
    create unique index ux_side_identidad_ingreso
    on public.participantes (
      partida_id,
      public.side_normalizar_ingreso(nombre_legal_ingreso),
      public.side_normalizar_ingreso(nombre_comercial_ingreso)
    )
    where empresa_id is not null
      and public.side_normalizar_ingreso(nombre_legal_ingreso) <> ''
      and public.side_normalizar_ingreso(nombre_comercial_ingreso) <> '';
  end if;
end;
$$;

-- Snapshot necesario para recuperar estado local en otro dispositivo.
create table if not exists public.side_student_state (
  empresa_id bigint primary key references public.empresas(id) on delete cascade,
  snapshot jsonb not null default jsonb_build_object(
    'decision_state', '{}'::jsonb,
    'cash_ledger', '{}'::jsonb,
    'financial_sections', '{}'::jsonb,
    'section_submissions', '{}'::jsonb,
    'decisions_submitted', false,
    'selected_character', null
  ),
  revision bigint not null default 0,
  updated_at timestamptz not null default clock_timestamp(),
  constraint side_student_state_object check (jsonb_typeof(snapshot) = 'object'),
  constraint side_student_state_revision check (revision >= 0)
);

alter table public.side_student_state add column if not exists revision bigint not null default 0;

alter table public.side_student_state enable row level security;
revoke all on public.side_student_state from public, anon, authenticated;

-- Resuelve la empresa solo cuando codigo + nombre legal + nombre comercial
-- identifican una unica fila. Las RPC publicas traducen null a un error
-- generico para no indicar cual dato fue incorrecto.
create or replace function public.side_resolver_identidad_empresa(
  p_codigo text,
  p_nombre_legal text,
  p_nombre_comercial text
)
returns table (participante_id uuid, empresa_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text := public.side_normalizar_ingreso(p_codigo);
  v_legal text := public.side_normalizar_ingreso(p_nombre_legal);
  v_comercial text := public.side_normalizar_ingreso(p_nombre_comercial);
  v_partida_id uuid;
  v_codigos integer;
  v_coincidencias integer;
begin
  if v_codigo = '' or v_legal = '' or v_comercial = '' then return; end if;

  select count(*), min(p.id::text)::uuid
  into v_codigos, v_partida_id
  from public.partidas p
  where public.side_normalizar_ingreso(p.codigo) = v_codigo;
  if v_codigos <> 1 then return; end if;

  select count(*), min(pt.id::text)::uuid, min(pt.empresa_id)
  into v_coincidencias, participante_id, empresa_id
  from public.participantes pt
  where pt.partida_id = v_partida_id
    and pt.empresa_id is not null
    and public.side_normalizar_ingreso(pt.nombre_legal_ingreso) = v_legal
    and public.side_normalizar_ingreso(pt.nombre_comercial_ingreso) = v_comercial;

  if v_coincidencias = 1 then return next; end if;
end;
$$;

revoke all on function public.side_resolver_identidad_empresa(text, text, text)
from public, anon, authenticated;

-- Construye una respuesta sin profesor_id ni datos de otras empresas.
create or replace function public.side_respuesta_ingreso(
  p_participante_id uuid,
  p_reingreso boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa public.empresas;
  v_partida public.partidas;
  v_ciclo integer;
  v_decisiones jsonb := '[]'::jsonb;
  v_historial jsonb := '[]'::jsonb;
  v_reporte jsonb;
  v_snapshot jsonb;
  v_snapshot_revision bigint := 0;
  v_eventos jsonb := '{}'::jsonb;
begin
  select e.*
  into v_empresa
  from public.participantes pt
  join public.empresas e on e.id = pt.empresa_id
  where pt.id = p_participante_id;

  select p.*
  into v_partida
  from public.participantes pt
  join public.partidas p on p.id = pt.partida_id
  where pt.id = p_participante_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'CREDENCIALES_INVALIDAS',
      'error', 'Los datos ingresados no coinciden con un registro existente.'
    );
  end if;

  v_ciclo := case
    when v_partida.configuracion->>'lifecycleVersion' = '2'
      then public.side_ciclo_actual(v_partida.configuracion)
    else greatest(1, coalesce(v_empresa.ciclo_actual, 1))
  end;

  select coalesce(jsonb_agg(
    to_jsonb(ed) || jsonb_build_object(
      'decision_key', dc.decision_id,
      'option_key', opt.opcion_id
    ) order by ed.updated_at, ed.id
  ), '[]'::jsonb)
  into v_decisiones
  from public.empresas_decisiones ed
  join public.decisiones_catalogo dc on dc.id = ed.decision_id
  left join public.decisiones_opciones opt on opt.id = ed.opcion_id
  where ed.empresa_id = v_empresa.id and ed.ciclo = v_ciclo;

  select coalesce(jsonb_agg(
    to_jsonb(ed) || jsonb_build_object(
      'decision_key', dc.decision_id,
      'option_key', opt.opcion_id
    ) order by ed.ciclo, ed.updated_at, ed.id
  ), '[]'::jsonb)
  into v_historial
  from public.empresas_decisiones ed
  join public.decisiones_catalogo dc on dc.id = ed.decision_id
  left join public.decisiones_opciones opt on opt.id = ed.opcion_id
  where ed.empresa_id = v_empresa.id;

  select to_jsonb(rc)
  into v_reporte
  from public.reportes_ciclo rc
  where rc.empresa_id = v_empresa.id and rc.ciclo = v_ciclo
  order by rc.created_at desc
  limit 1;

  select s.snapshot, s.revision
  into v_snapshot, v_snapshot_revision
  from public.side_student_state s
  where s.empresa_id = v_empresa.id;

  v_snapshot := coalesce(v_snapshot, jsonb_build_object(
    'decision_state', '{}'::jsonb,
    'cash_ledger', '{}'::jsonb,
    'financial_sections', '{}'::jsonb,
    'section_submissions', '{}'::jsonb,
    'decisions_submitted', false,
    'selected_character', null
  ));

  select coalesce(jsonb_object_agg(s.ciclo::text, s.events order by s.ciclo), '{}'::jsonb)
  into v_eventos
  from public.side_individual_event_schedule s
  where s.empresa_id = v_empresa.id;

  return jsonb_build_object(
    'success', true,
    'empresa_id', v_empresa.id,
    'participante_id', p_participante_id,
    'reingreso', p_reingreso,
    -- Compatibilidad temporal con consumidores de crear_empresa.
    'caja_inicial', v_empresa.caja_actual,
    'ciclo_inicial', v_ciclo,
    'configuracion', coalesce(v_partida.configuracion, '{}'::jsonb),
    'empresa', to_jsonb(v_empresa),
    'partida', jsonb_build_object(
      'id', v_partida.id,
      'codigo', v_partida.codigo,
      'nombre', v_partida.nombre,
      'curso', v_partida.curso,
      'estado', v_partida.estado,
      'segmento', v_partida.segmento,
      'configuracion', coalesce(v_partida.configuracion, '{}'::jsonb),
      'eventos_habilitados', coalesce(v_partida.eventos_habilitados, '[]'::jsonb),
      'serverTime', clock_timestamp()
    ),
    'ciclo_partida', v_ciclo,
    'empresas_unidas', (
      select count(distinct joined.empresa_id)
      from public.participantes joined
      where joined.partida_id=v_partida.id and joined.empresa_id is not null
    ),
    'decisiones_ciclo', v_decisiones,
    'decisiones_historial', v_historial,
    'reporte_ciclo', v_reporte,
    'snapshot', v_snapshot,
    'snapshot_revision', coalesce(v_snapshot_revision, 0),
    'individualEvents', v_eventos
  );
end;
$$;

revoke all on function public.side_respuesta_ingreso(uuid, boolean) from public, anon, authenticated;

create or replace function public.ingresar_empresa(
  p_codigo text,
  p_nombre_legal text,
  p_nombre_comercial text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text := public.side_normalizar_ingreso(p_codigo);
  v_legal text := public.side_normalizar_ingreso(p_nombre_legal);
  v_comercial text := public.side_normalizar_ingreso(p_nombre_comercial);
  -- Valores canonicos de almacenamiento: conservan caja, tildes y puntuacion,
  -- pero eliminan whitespace de bordes y colapsan secuencias internas.
  v_legal_limpio text := public.side_limpiar_whitespace_ingreso(p_nombre_legal);
  v_comercial_limpio text := public.side_limpiar_whitespace_ingreso(p_nombre_comercial);
  v_partida_id uuid;
  v_partida public.partidas;
  v_participante_id uuid;
  v_empresa_id bigint;
  v_exactos integer := 0;
  v_codigos integer := 0;
  v_iniciada boolean;
  v_capital numeric := 100000;
  v_capital_min numeric;
  v_capital_max numeric;
begin
  -- La identidad siempre exige una terna no vacia. Ningun registro legacy con
  -- nombres NULL/vacios se puede recuperar presentando solo whitespace.
  if v_codigo = '' or v_legal = '' or v_comercial = '' then
    return jsonb_build_object(
      'success', false,
      'code', 'CREDENCIALES_INVALIDAS',
      'error', 'Los datos ingresados no coinciden con un registro existente.'
    );
  end if;

  -- Rechaza tambien codigos historicos ambiguos sin revelar cual dato fallo.
  select count(*) into v_codigos
  from public.partidas p
  where public.side_normalizar_ingreso(p.codigo) = v_codigo;

  if v_codigos <> 1 then
    return jsonb_build_object(
      'success', false,
      'code', 'CREDENCIALES_INVALIDAS',
      'error', 'Los datos ingresados no coinciden con un registro existente.'
    );
  end if;

  select p.id into v_partida_id
  from public.partidas p
  where public.side_normalizar_ingreso(p.codigo) = v_codigo
  limit 1;

  -- Esta funcion toma FOR UPDATE, resuelve el reloj automatico y persiste la
  -- fase. La misma fila queda bloqueada hasta terminar esta admision.
  perform public.side_sync_game(v_partida_id);

  select p.* into v_partida
  from public.partidas p
  where p.id = v_partida_id
  for update;

  select count(*) into v_exactos
  from public.participantes pt
  where pt.partida_id = v_partida.id
    and pt.empresa_id is not null
    and public.side_normalizar_ingreso(pt.nombre_legal_ingreso) = v_legal
    and public.side_normalizar_ingreso(pt.nombre_comercial_ingreso) = v_comercial;

  if v_exactos = 1 then
    -- Tambien se permite recuperar el estado terminal (finalizada/cancelada):
    -- no crea actividad nueva y evita perder resultados tras una desconexion.
    select pt.id into v_participante_id
    from public.participantes pt
    where pt.partida_id = v_partida.id
      and pt.empresa_id is not null
      and public.side_normalizar_ingreso(pt.nombre_legal_ingreso) = v_legal
      and public.side_normalizar_ingreso(pt.nombre_comercial_ingreso) = v_comercial
    limit 1;

    update public.participantes
    set last_seen_at = clock_timestamp()
    where id = v_participante_id;

    return public.side_respuesta_ingreso(v_participante_id, true);
  elsif v_exactos > 1 then
    return jsonb_build_object(
      'success', false,
      'code', 'CREDENCIALES_INVALIDAS',
      'error', 'Los datos ingresados no coinciden con un registro existente.'
    );
  end if;

  v_iniciada := v_partida.started_at is not null
    or v_partida.estado <> 'esperando'
    or (
      v_partida.configuracion->>'lifecycleVersion' = '2'
      and coalesce(v_partida.configuracion#>>'{runtime,phase}', '') <> 'integration'
    );

  if v_iniciada then
    return jsonb_build_object(
      'success', false,
      'code', 'PARTIDA_INICIADA',
      'error', 'La partida ya inició. Solo pueden reingresar quienes ya estaban registrados; verifica que el código, el nombre de empresa y el nombre comercial sean exactamente los registrados.'
    );
  end if;

  -- Antes del ciclo 1 una terna distinta es un alta valida aunque comparta
  -- solo uno de los nombres con otra empresa. La identidad es la terna total.
  -- Estos limites se aplican exclusivamente al alta nueva: la busqueda exacta
  -- anterior permite reingresar identidades legacy sin modificarlas.
  if char_length(v_legal_limpio) > 60
    or char_length(v_comercial_limpio) > 40
  then
    return jsonb_build_object(
      'success', false,
      'code', 'CREDENCIALES_INVALIDAS',
      'error', 'Los datos ingresados no coinciden con un registro existente.'
    );
  end if;

  -- El cliente no decide el capital. Incluso el modo aleatorio se calcula
  -- dentro de la transaccion del servidor.
  if coalesce(v_partida.configuracion->>'capitalMode', 'fixed') = 'random' then
    v_capital_min := coalesce(nullif(v_partida.configuracion->>'capitalMin', '')::numeric, 80000);
    v_capital_max := coalesce(nullif(v_partida.configuracion->>'capitalMax', '')::numeric, v_capital_min);
    if v_capital_max < v_capital_min then
      v_capital_max := v_capital_min;
    end if;
    -- Conserva la granularidad historica del juego: saltos de S/ 500.
    v_capital := v_capital_min
      + floor(random() * (floor((v_capital_max - v_capital_min) / 500) + 1)) * 500;
  else
    v_capital := coalesce(nullif(v_partida.configuracion->>'capital', '')::numeric, 100000);
  end if;

  begin
    insert into public.empresas (
      nombre_legal, nombre_comercial, caja_inicial, caja_actual, ciclo_actual
    ) values (
      v_legal_limpio, v_comercial_limpio, v_capital, v_capital, 1
    ) returning id into v_empresa_id;

    insert into public.participantes (
      partida_id, empresa_id, nombre, empresa,
      nombre_legal_ingreso, nombre_comercial_ingreso, last_seen_at
    ) values (
      v_partida.id, v_empresa_id, 'Jugador', v_comercial_limpio,
      v_legal_limpio, v_comercial_limpio, clock_timestamp()
    ) returning id into v_participante_id;
  exception when unique_violation then
    return jsonb_build_object(
      'success', false,
      'code', 'CREDENCIALES_INVALIDAS',
      'error', 'Los datos ingresados no coinciden con un registro existente.'
    );
  end;

  insert into public.side_student_state(empresa_id) values (v_empresa_id)
  on conflict (empresa_id) do nothing;

  return public.side_respuesta_ingreso(v_participante_id, false);
end;
$$;

revoke all on function public.ingresar_empresa(text, text, text) from public;
grant execute on function public.ingresar_empresa(text, text, text) to anon, authenticated;

-- Lectura segura para polling/reingreso. Reutiliza la sincronizacion de ciclo
-- existente, pero el cliente nunca elige una empresa solo por su id.
create or replace function public.obtener_estado_estudiante(
  p_codigo text,
  p_nombre_legal text,
  p_nombre_comercial text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participante_id uuid;
  v_empresa_id bigint;
begin
  select r.participante_id, r.empresa_id
  into v_participante_id, v_empresa_id
  from public.side_resolver_identidad_empresa(
    p_codigo, p_nombre_legal, p_nombre_comercial
  ) r;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'CREDENCIALES_INVALIDAS',
      'error', 'Los datos ingresados no coinciden con un registro existente.'
    );
  end if;

  -- Conserva todos los efectos de sincronizacion del lector historico
  -- (reloj, ciclo y calendario individual) sin exponer su firma por id.
  perform public.obtener_estado_juego(v_empresa_id);
  update public.participantes set last_seen_at = clock_timestamp()
  where id = v_participante_id;

  return public.side_respuesta_ingreso(v_participante_id, true);
end;
$$;

revoke all on function public.obtener_estado_estudiante(text, text, text) from public;
grant execute on function public.obtener_estado_estudiante(text, text, text) to anon, authenticated;

-- Escrituras operativas seguras: validan la misma terna y recien entonces
-- delegan en las implementaciones de ciclo de vida existentes.
drop function if exists public.guardar_decisiones_estudiante(text, text, text, integer, jsonb);
create or replace function public.guardar_decisiones_estudiante(
  p_codigo text,
  p_nombre_legal text,
  p_nombre_comercial text,
  p_ciclo integer,
  p_decisiones jsonb,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participante_id uuid;
  v_empresa_id bigint;
  v_revision bigint;
begin
  select r.participante_id, r.empresa_id
  into v_participante_id, v_empresa_id
  from public.side_resolver_identidad_empresa(
    p_codigo, p_nombre_legal, p_nombre_comercial
  ) r;
  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'CREDENCIALES_INVALIDAS',
      'error', 'Los datos ingresados no coinciden con un registro existente.'
    );
  end if;

  insert into public.side_student_state(empresa_id)
  values (v_empresa_id)
  on conflict (empresa_id) do nothing;
  select s.revision into v_revision
  from public.side_student_state s
  where s.empresa_id = v_empresa_id
  for update;
  if p_expected_revision is null or v_revision is distinct from p_expected_revision then
    return jsonb_build_object(
      'success', false,
      'code', 'ESTADO_DESACTUALIZADO',
      'error', 'El estado cambió en otra sesión. Recarga antes de volver a guardar.',
      'snapshot_revision', coalesce(v_revision, 0)
    );
  end if;
  return public.guardar_decisiones(v_empresa_id, p_ciclo, p_decisiones);
end;
$$;

revoke all on function public.guardar_decisiones_estudiante(text, text, text, integer, jsonb, bigint) from public;
grant execute on function public.guardar_decisiones_estudiante(text, text, text, integer, jsonb, bigint) to anon, authenticated;

drop function if exists public.guardar_reporte_estudiante(text, text, text, integer, jsonb);
create or replace function public.guardar_reporte_estudiante(
  p_codigo text,
  p_nombre_legal text,
  p_nombre_comercial text,
  p_ciclo integer,
  p_reporte jsonb,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participante_id uuid;
  v_empresa_id bigint;
  v_resultado jsonb;
  v_revision bigint;
begin
  select r.participante_id, r.empresa_id
  into v_participante_id, v_empresa_id
  from public.side_resolver_identidad_empresa(
    p_codigo, p_nombre_legal, p_nombre_comercial
  ) r;
  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'CREDENCIALES_INVALIDAS',
      'error', 'Los datos ingresados no coinciden con un registro existente.'
    );
  end if;

  insert into public.side_student_state(empresa_id)
  values (v_empresa_id)
  on conflict (empresa_id) do nothing;
  select s.revision into v_revision
  from public.side_student_state s
  where s.empresa_id = v_empresa_id
  for update;
  if p_expected_revision is null or v_revision is distinct from p_expected_revision then
    return jsonb_build_object(
      'success', false,
      'code', 'ESTADO_DESACTUALIZADO',
      'error', 'El estado cambió en otra sesión. Recarga antes de volver a guardar.',
      'snapshot_revision', coalesce(v_revision, 0)
    );
  end if;

  v_resultado := public.guardar_reporte(v_empresa_id, p_ciclo, p_reporte);
  if coalesce((v_resultado->>'success')::boolean, false) then
    update public.empresas
    set caja_actual = coalesce(nullif(p_reporte->>'caja_final', '')::numeric, caja_actual),
        ciclo_actual = greatest(ciclo_actual, p_ciclo)
    where id = v_empresa_id;
  end if;
  return v_resultado;
end;
$$;

revoke all on function public.guardar_reporte_estudiante(text, text, text, integer, jsonb, bigint) from public;
grant execute on function public.guardar_reporte_estudiante(text, text, text, integer, jsonb, bigint) to anon, authenticated;

-- Las variantes historicas por id quedan disponibles solo para llamadas
-- internas SECURITY DEFINER y para el propietario de la base.
revoke all on function public.obtener_estado_juego(bigint) from public, anon, authenticated;
revoke all on function public.guardar_decisiones(bigint, integer, jsonb) from public, anon, authenticated;
revoke all on function public.guardar_reporte(bigint, integer, jsonb) from public, anon, authenticated;

-- Lectura del panel docente: SECURITY DEFINER no omite la comprobacion de
-- propiedad. Un profesor autenticado solo puede consultar sus propias partidas.
create or replace function public.obtener_reporte_empresa(
  p_empresa_id bigint,
  p_ciclo integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.participantes pt
    join public.partidas p on p.id = pt.partida_id
    where pt.empresa_id = p_empresa_id and p.profesor_id = auth.uid()
  ) then
    return jsonb_build_object(
      'success', false,
      'code', 'ACCESO_DENEGADO',
      'error', 'No tienes permiso para consultar esta empresa.'
    );
  end if;

  return jsonb_build_object(
    'empresa', (
      select to_jsonb(e) from public.empresas e where e.id = p_empresa_id
    ),
    'reportes', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.ciclo), '[]'::jsonb)
      from public.reportes_ciclo r
      where r.empresa_id = p_empresa_id
        and (p_ciclo is null or r.ciclo = p_ciclo)
    ),
    'decisiones', (
      select coalesce(jsonb_agg(to_jsonb(ed) order by ed.ciclo), '[]'::jsonb)
      from public.empresas_decisiones ed
      where ed.empresa_id = p_empresa_id
        and (p_ciclo is null or ed.ciclo = p_ciclo)
    )
  );
end;
$$;

revoke all on function public.obtener_reporte_empresa(bigint, integer) from public, anon, authenticated;
grant execute on function public.obtener_reporte_empresa(bigint, integer) to authenticated;

-- Guardar tambien exige la misma terna. No basta conocer un empresa_id.
drop function if exists public.guardar_estado_estudiante(text, text, text, jsonb);
create or replace function public.guardar_estado_estudiante(
  p_codigo text,
  p_nombre_legal text,
  p_nombre_comercial text,
  p_snapshot jsonb,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participante_id uuid;
  v_empresa_id bigint;
  v_snapshot jsonb;
  v_revision bigint;
  v_updated_at timestamptz := clock_timestamp();
begin
  select r.participante_id, r.empresa_id
  into v_participante_id, v_empresa_id
  from public.side_resolver_identidad_empresa(
    p_codigo, p_nombre_legal, p_nombre_comercial
  ) r;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'CREDENCIALES_INVALIDAS',
      'error', 'Los datos ingresados no coinciden con un registro existente.'
    );
  end if;

  if p_expected_revision is null or p_expected_revision < 0 then
    return jsonb_build_object(
      'success', false,
      'code', 'ESTADO_DESACTUALIZADO',
      'error', 'El estado cambió en otra sesión. Recarga antes de volver a guardar.'
    );
  end if;

  if jsonb_typeof(p_snapshot) is distinct from 'object'
    or octet_length(p_snapshot::text) > 1048576
  then
    return jsonb_build_object(
      'success', false,
      'code', 'SNAPSHOT_INVALIDO',
      'error', 'El estado de la empresa no tiene un formato válido.'
    );
  end if;

  -- Lista blanca: no se conserva contenido arbitrario fuera del contrato.
  v_snapshot := jsonb_build_object(
    'decision_state', coalesce(p_snapshot->'decision_state', '{}'::jsonb),
    'cash_ledger', coalesce(p_snapshot->'cash_ledger', '{}'::jsonb),
    'financial_sections', coalesce(p_snapshot->'financial_sections', '{}'::jsonb),
    'section_submissions', coalesce(p_snapshot->'section_submissions', '{}'::jsonb),
    'decisions_submitted', coalesce(p_snapshot->'decisions_submitted', 'false'::jsonb),
    'selected_character', coalesce(p_snapshot->'selected_character', 'null'::jsonb)
  );

  -- Dos dispositivos validos comparten la misma empresa: nunca crean otra
  -- fila. Compare-and-swap impide que una escritura atrasada pise la reciente.
  insert into public.side_student_state(empresa_id)
  values (v_empresa_id)
  on conflict (empresa_id) do nothing;

  update public.side_student_state
  set snapshot = v_snapshot,
      revision = revision + 1,
      updated_at = v_updated_at
  where empresa_id = v_empresa_id and revision = p_expected_revision
  returning revision into v_revision;

  if not found then
    select revision into v_revision
    from public.side_student_state
    where empresa_id = v_empresa_id;
    return jsonb_build_object(
      'success', false,
      'code', 'ESTADO_DESACTUALIZADO',
      'error', 'El estado cambió en otra sesión. Recarga antes de volver a guardar.',
      'snapshot_revision', coalesce(v_revision, 0)
    );
  end if;

  update public.participantes
  set last_seen_at = v_updated_at
  where id = v_participante_id;

  return jsonb_build_object(
    'success', true,
    'updated_at', v_updated_at,
    'snapshot_revision', v_revision
  );
end;
$$;

revoke all on function public.guardar_estado_estudiante(text, text, text, jsonb, bigint) from public;
grant execute on function public.guardar_estado_estudiante(text, text, text, jsonb, bigint) to anon, authenticated;

-- Cierra los caminos antiguos: desde ahora empresa + participante solo nacen
-- dentro de ingresar_empresa, bajo el mismo bloqueo de la fila de partida.
revoke insert on table public.empresas from anon, authenticated;
revoke insert on table public.participantes from anon, authenticated;
revoke insert, update on table public.empresas_decisiones from anon, authenticated;
revoke insert, update on table public.reportes_ciclo from anon, authenticated;
revoke select on table public.empresas_decisiones from anon;
revoke select on table public.reportes_ciclo from anon;
grant select on table public.empresas_decisiones to authenticated;
grant select on table public.reportes_ciclo to authenticated;

drop policy if exists "sistema crea empresas" on public.empresas;
drop policy if exists "sistema actualiza empresas" on public.empresas;
drop policy if exists "estudiante ve su empresa" on public.empresas;
drop policy if exists "estudiante entra a partida" on public.participantes;
drop policy if exists "sistema guarda decisiones" on public.empresas_decisiones;
drop policy if exists "sistema actualiza decisiones" on public.empresas_decisiones;
drop policy if exists "estudiante ve sus decisiones" on public.empresas_decisiones;
drop policy if exists "sistema crea reportes" on public.reportes_ciclo;
drop policy if exists "profesor ve reportes" on public.reportes_ciclo;

drop policy if exists "profesor ve decisiones de sus partidas" on public.empresas_decisiones;
create policy "profesor ve decisiones de sus partidas"
on public.empresas_decisiones for select
to authenticated
using (
  exists (
    select 1
    from public.participantes pt
    join public.partidas p on p.id = pt.partida_id
    where pt.empresa_id = empresas_decisiones.empresa_id
      and p.profesor_id = auth.uid()
  )
);

create policy "profesor ve reportes"
on public.reportes_ciclo for select
to authenticated
using (
  exists (
    select 1
    from public.participantes pt
    join public.partidas p on p.id = pt.partida_id
    where pt.empresa_id = reportes_ciclo.empresa_id
      and p.profesor_id = auth.uid()
  )
);

drop policy if exists "profesor ve empresas de sus partidas" on public.empresas;
create policy "profesor ve empresas de sus partidas"
on public.empresas for select
to authenticated
using (
  exists (
    select 1
    from public.participantes pt
    join public.partidas p on p.id = pt.partida_id
    where pt.empresa_id = empresas.id and p.profesor_id = auth.uid()
  )
);

-- Los nombres comerciales y legales no pueden quedar enumerables por REST;
-- el estudiante obtiene solo su empresa mediante RPC con la terna validada.
revoke select, update on table public.empresas from anon;
revoke update on table public.empresas from authenticated;

do $$
declare
  v_funcion record;
begin
  for v_funcion in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'crear_empresa'
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      v_funcion.firma
    );
  end loop;
end;
$$;

commit;
