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
