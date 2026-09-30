-- SIDE: Decisiones / ultima partida realizada del profesor.
-- Pegar TODO en SQL Editor, despues de supabase_migration.sql,
-- supabase_game_lifecycle.sql y supabase_student_admission.sql. Es repetible.
-- Snapshot minimo: conserva referencia + fecha de cierre; las decisiones,
-- reportes e indicadores ya persistidos NO se duplican. Las notas docentes
-- posteriores y los reportes tardios se leen desde sus fuentes existentes.
begin;

-- Fecha de cierre estable: repetir una lectura/cierre nunca la rejuvenece.
alter table public.partidas add column if not exists side_finalizada_at timestamptz;

create or replace function public.side_historial_partida_jugada(p public.partidas)
returns boolean language sql stable security definer set search_path = public as $$
  select p.configuracion->>'gameStartedAt' is not null
    or coalesce(p.configuracion#>>'{runtime,phase}', '') = 'finished'
    or exists (select 1 from public.participantes pt
      join public.reportes_ciclo r on r.empresa_id = pt.empresa_id where pt.partida_id = p.id)
    or exists (select 1 from public.participantes pt
      join public.empresas_decisiones d on d.empresa_id = pt.empresa_id where pt.partida_id = p.id)
    or (p.configuracion->>'lifecycleVersion' is distinct from '2'
      and not p.configuracion ? 'cancelledAt'
      and (to_jsonb(p)->>'started_at' is not null or p.estado = 'activa'));
$$;
revoke all on function public.side_historial_partida_jugada(public.partidas) from public, anon, authenticated;

-- El cierre automatico corresponde al vencimiento del reloj del servidor,
-- aunque una peticion lo detecte dias despues. Asi no desplaza un cierre nuevo.
create or replace function public.side_historial_fecha_automatica(p public.partidas)
returns timestamptz language sql stable security definer set search_path = public as $$
  select case when p.configuracion->>'cycleCloseMode' = 'automatic'
      and coalesce(p.configuracion#>>'{runtime,phase}', '') = 'finished'
      and not p.configuracion ? 'cancelledAt'
      and nullif(p.configuracion->>'gameStartedAt', '') is not null
      and coalesce(p.configuracion->>'cycles', '') ~ '^[0-9]+$'
      and coalesce(p.configuracion->>'roundHours', '') ~ '^[0-9]+$'
      and coalesce(p.configuracion->>'roundMinutes', '') ~ '^[0-9]+$'
    then (p.configuracion->>'gameStartedAt')::timestamptz
      + make_interval(secs => (p.configuracion->>'cycles')::integer *
        ((p.configuracion->>'roundHours')::integer * 3600 + (p.configuracion->>'roundMinutes')::integer * 60))
    end;
$$;
revoke all on function public.side_historial_fecha_automatica(public.partidas) from public, anon, authenticated;

-- Recuperacion de cierres anteriores a esta migracion. Si el servidor no
-- tenia fecha de cierre, usa inicio + duracion para automaticas y created_at
-- para legacy/manuales; esa fecha es aproximada, no una fecha inventada hoy.
update public.partidas p set side_finalizada_at = coalesce(
  nullif(p.configuracion->>'cancelledAt', '')::timestamptz,
  public.side_historial_fecha_automatica(p),
  p.created_at)
where p.estado = 'finalizada' and p.side_finalizada_at is null
  and public.side_historial_partida_jugada(p);
create index if not exists idx_side_partidas_ultimo_cierre
on public.partidas (profesor_id, side_finalizada_at desc, id desc)
where estado = 'finalizada' and side_finalizada_at is not null;

create table if not exists public.side_teacher_history (
  profesor_id uuid primary key references public.profesores(id) on delete cascade,
  partida_id uuid not null references public.partidas(id) on delete cascade,
  finalizada_at timestamptz not null,
  registrada_at timestamptz not null default clock_timestamp()
);
alter table public.side_teacher_history enable row level security;
-- El cliente tiene solo SELECT. Las escrituras pasan por funciones que
-- comprueban partida/profesor; no puede falsificar referencias ni fechas.
revoke all on table public.side_teacher_history from anon, authenticated;
grant select on table public.side_teacher_history to authenticated;
drop policy if exists "profesor lee su ultima partida" on public.side_teacher_history;
create policy "profesor lee su ultima partida" on public.side_teacher_history
for select to authenticated using (profesor_id = auth.uid()
  and exists (select 1 from public.partidas p where p.id = partida_id and p.profesor_id = auth.uid()));
drop policy if exists "profesor registra su ultima partida" on public.side_teacher_history;
create policy "profesor registra su ultima partida" on public.side_teacher_history
for insert to authenticated with check (profesor_id = auth.uid()
  and exists (select 1 from public.partidas p where p.id = partida_id
    and p.profesor_id = auth.uid() and p.estado = 'finalizada' and p.side_finalizada_at = finalizada_at));
drop policy if exists "profesor actualiza su ultima partida" on public.side_teacher_history;
create policy "profesor actualiza su ultima partida" on public.side_teacher_history
for update to authenticated using (profesor_id = auth.uid())
with check (profesor_id = auth.uid()
  and exists (select 1 from public.partidas p where p.id = partida_id
    and p.profesor_id = auth.uid() and p.estado = 'finalizada' and p.side_finalizada_at = finalizada_at));

-- Uso exclusivamente interno. Funciona tambien cuando el cierre automatico
-- lo detecta un estudiante anonimo; NO se concede EXECUTE al estudiante.
create or replace function public.side_registrar_historial_docente(p_partida_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p public.partidas;
begin
  select * into p from public.partidas where id = p_partida_id;
  if not found or p.estado <> 'finalizada' or p.side_finalizada_at is null then return; end if;
  -- Serializa reemplazos simultaneos del mismo profesor.
  perform 1 from public.profesores where id = p.profesor_id for update;
  insert into public.side_teacher_history as h (profesor_id, partida_id, finalizada_at)
  values (p.profesor_id, p.id, p.side_finalizada_at)
  on conflict (profesor_id) do update set
    partida_id = excluded.partida_id, finalizada_at = excluded.finalizada_at,
    registrada_at = clock_timestamp()
  where (excluded.finalizada_at, excluded.partida_id) > (h.finalizada_at, h.partida_id);
end;
$$;
revoke all on function public.side_registrar_historial_docente(uuid) from public, anon, authenticated;

create or replace function public.side_marcar_cierre_historial()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Ignora cualquier fecha enviada por un cliente. En UPDATE conserva el
  -- primer cierre valido y solo reconoce una transicion terminal real.
  if tg_op = 'INSERT' then
    new.side_finalizada_at := null;
  else
    new.side_finalizada_at := old.side_finalizada_at;
    if old.estado <> 'finalizada' and new.estado = 'finalizada'
      and (public.side_historial_partida_jugada(new)
        or (old.estado = 'activa' and coalesce(old.configuracion#>>'{runtime,phase}', '') <> 'integration')) then
      new.side_finalizada_at := coalesce(old.side_finalizada_at,
        least(public.side_historial_fecha_automatica(new), clock_timestamp()));
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.side_marcar_cierre_historial() from public, anon, authenticated;
drop trigger if exists side_marcar_cierre_historial on public.partidas;
create trigger side_marcar_cierre_historial before insert or update on public.partidas
for each row execute function public.side_marcar_cierre_historial();

create or replace function public.side_capturar_cierre_historial()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'finalizada' and new.side_finalizada_at is not null then
    perform public.side_registrar_historial_docente(new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.side_capturar_cierre_historial() from public, anon, authenticated;
drop trigger if exists side_capturar_cierre_historial on public.partidas;
create trigger side_capturar_cierre_historial after insert or update on public.partidas
for each row execute function public.side_capturar_cierre_historial();

-- Backfill: una sola fila por profesor, escogida por fecha de cierre.
do $$ declare p record; begin
  for p in select distinct on (profesor_id) id from public.partidas
    where estado = 'finalizada' and side_finalizada_at is not null
    order by profesor_id, side_finalizada_at desc, id desc
  loop perform public.side_registrar_historial_docente(p.id); end loop;
end; $$;

create or replace function public.obtener_ultima_partida_docente()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_id uuid; v_pending record; v_result jsonb;
begin
  if v_user is null then return jsonb_build_object('success', false, 'code', 'ACCESO_DENEGADO', 'error', 'Debes iniciar sesion como profesor.'); end if;
  -- La misma sincronizacion autoritativa existente reconoce una automatic
  -- finalizada mientras el panel estuvo desconectado. No altera otras partidas.
  for v_pending in select id from public.partidas where profesor_id = v_user
    and estado <> 'finalizada' and configuracion->>'lifecycleVersion' = '2'
  loop perform public.side_sync_game(v_pending.id); end loop;
  select p.id into v_id from public.partidas p where p.profesor_id = v_user
    and p.estado = 'finalizada' and p.side_finalizada_at is not null
    order by p.side_finalizada_at desc, p.id desc limit 1;
  if v_id is not null then perform public.side_registrar_historial_docente(v_id); end if;
  select h.partida_id into v_id from public.side_teacher_history h
    join public.partidas p on p.id = h.partida_id
    where h.profesor_id = v_user and p.profesor_id = v_user;
  if v_id is null then return null; end if;
  select jsonb_build_object(
    'partida', jsonb_build_object('id', p.id, 'codigo', p.codigo, 'nombre', p.nombre,
      'curso', p.curso, 'created_at', p.created_at, 'finalizada_at', h.finalizada_at,
      'fecha_aproximada', h.finalizada_at = p.created_at,
      'cantidad_empresas', (select count(*) from public.participantes pt where pt.partida_id = p.id),
      'ciclos_jugados', greatest(
        case when coalesce(p.configuracion#>>'{runtime,round}', p.configuracion->>'round', '') ~ '^[0-9]+$'
          then coalesce(p.configuracion#>>'{runtime,round}', p.configuracion->>'round')::integer else 0 end,
        coalesce((select max(e.ciclo_actual) from public.participantes pt join public.empresas e on e.id = pt.empresa_id where pt.partida_id = p.id), 0),
        coalesce((select max(r.ciclo) from public.participantes pt join public.reportes_ciclo r on r.empresa_id = pt.empresa_id where pt.partida_id = p.id), 0))),
    'empresas', coalesce((select jsonb_agg(jsonb_build_object(
      'id', pt.empresa_id, 'participante_id', pt.id,
      'nombre_comercial', coalesce(e.nombre_comercial, to_jsonb(pt)->>'nombre_comercial_ingreso', pt.empresa),
      'nombre_legal', coalesce(e.nombre_legal, to_jsonb(pt)->>'nombre_legal_ingreso', pt.empresa),
      'puntaje_docente', to_jsonb(pt)->'puntaje_docente',
      'caja_actual', e.caja_actual, 'ciclo_actual', e.ciclo_actual,
      'resumen_final', to_jsonb(e),
      'reportes', coalesce((select jsonb_agg(to_jsonb(r) order by r.ciclo) from public.reportes_ciclo r where r.empresa_id = pt.empresa_id), '[]'::jsonb),
      'decisiones', coalesce((select jsonb_agg(to_jsonb(d) || jsonb_build_object(
          'decision_id', coalesce(dc.decision_id, d.decision_id::text), 'categoria', dc.categoria,
          'decision_nombre', dc.decision_nombre, 'opcion_id', opt.opcion_id, 'etiqueta', opt.etiqueta)
          order by d.ciclo, dc.categoria, d.decision_id)
        from public.empresas_decisiones d
        left join public.decisiones_catalogo dc on dc.id = d.decision_id
        left join public.decisiones_opciones opt on opt.id = d.opcion_id
        where d.empresa_id = pt.empresa_id), '[]'::jsonb)) order by pt.created_at, pt.id)
      from public.participantes pt left join public.empresas e on e.id = pt.empresa_id
      where pt.partida_id = p.id), '[]'::jsonb)) into v_result
  from public.partidas p join public.side_teacher_history h on h.partida_id = p.id
  where p.id = v_id and p.profesor_id = v_user and h.profesor_id = v_user;
  return v_result;
end;
$$;
revoke all on function public.obtener_ultima_partida_docente() from public, anon, authenticated;
grant execute on function public.obtener_ultima_partida_docente() to authenticated;
commit;
