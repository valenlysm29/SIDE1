-- Reparación incremental del motor 2D. Requiere cierre v19 ya instalado.
-- Conserva el ciclo de confirmación y restaura reportes desde cierres guardados.
-- No recalcula ventas ni modifica decisiones, cierres o caja actual.

-- SOURCE: supabase/migrations/20261027_preservar_ciclo_snapshot.sql
-- Conserva el ciclo al que pertenecen las confirmaciones del estudiante.
-- Repetible. El cliente también recupera snapshots anteriores sin este campo.
begin;
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
    'round', coalesce(p_snapshot->'round', p_snapshot#>'{decision_state,__snapshotRound}', 'null'::jsonb),
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

commit;

-- SOURCE: supabase/migrations/20261027_proteger_reportes_cerrados.sql
-- El reporte y la caja definitivos prevalecen sobre previews tardios.
-- Valida primero identidad y revision. No cambia cierres ni decisiones.
begin;
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

  -- A final teacher closure owns its report and cash. A delayed preview with
  -- a renewed CAS revision must not erase its sales or its settlement receipt.
  -- The state row above serializes this check with the closure transaction.
  if to_regclass('public.side_business_closures') is not null then
    if exists (
      select 1 from public.side_business_closures c
      join public.participantes t on t.partida_id=c.partida_id
      where t.id=v_participante_id and c.ciclo=p_ciclo
        and (c.cierre->'resultadosPorEmpresa') ? v_empresa_id::text
    ) then
      return jsonb_build_object('success', true, 'closed', true);
    end if;
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

-- Repair reports previously overwritten by a preview, using only the stored
-- authoritative closure. Do not recompute economics or change company cash:
-- current cash can include movements from a later cycle.
with authoritative as (
  select c.ciclo, t.empresa_id, item.value->'financial' as fin,
    item.value->'receipt' as receipt
  from public.side_business_closures c
  cross join lateral jsonb_each(case when jsonb_typeof(c.cierre->'resultadosPorEmpresa')='object' then c.cierre->'resultadosPorEmpresa' else '{}'::jsonb end) item
  join public.participantes t on t.partida_id=c.partida_id
    and t.empresa_id::text=item.key
  where jsonb_typeof(item.value#>'{financial,estadoResultados,ingresos}')='number'
    and jsonb_typeof(item.value#>'{financial,estadoResultados,costos}')='number'
    and jsonb_typeof(item.value#>'{financial,estadoResultados,utilidad}')='number'
    and jsonb_typeof(item.value#>'{financial,balanceCaja,cajaFinal}')='number'
    and jsonb_typeof(item.value#>'{financial,flujoCaja}')='object'
    and jsonb_typeof(item.value#>'{financial,balanceGeneral}')='object'
    and jsonb_typeof(item.value#>'{receipt,sold}')='number'
    and jsonb_typeof(item.value#>'{receipt,revenue}')='number'
    and item.value#>>'{receipt,round}'=c.ciclo::text
)
update public.reportes_ciclo r set
  ingresos=(a.fin#>>'{estadoResultados,ingresos}')::numeric,
  costos=(a.fin#>>'{estadoResultados,costos}')::numeric,
  utilidad=(a.fin#>>'{estadoResultados,utilidad}')::numeric,
  caja_final=(a.fin#>>'{balanceCaja,cajaFinal}')::numeric,
  balance_caja=a.fin->'balanceCaja', flujo_caja=a.fin->'flujoCaja',
  estado_resultados=coalesce(r.estado_resultados,'{}'::jsonb)
    ||(a.fin->'estadoResultados')
    ||jsonb_build_object('balanceGeneral',a.fin->'balanceGeneral','cycleReceipt',a.receipt)
from authoritative a
where r.empresa_id=a.empresa_id and r.ciclo=a.ciclo
  and (r.ingresos is distinct from (a.fin#>>'{estadoResultados,ingresos}')::numeric
    or r.costos is distinct from (a.fin#>>'{estadoResultados,costos}')::numeric
    or r.utilidad is distinct from (a.fin#>>'{estadoResultados,utilidad}')::numeric
    or r.caja_final is distinct from (a.fin#>>'{balanceCaja,cajaFinal}')::numeric
    or r.estado_resultados->'cycleReceipt' is distinct from a.receipt);

commit;
