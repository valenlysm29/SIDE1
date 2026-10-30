-- Aplicar después de docs/supabase_migration.sql.
-- El cliente llama rpc('guardar_puntaje_docente', {p_partida_id, p_empresa_id, p_puntaje}).
begin;

alter table public.participantes
  add column if not exists puntaje_docente numeric(4,2)
  check (puntaje_docente between 0 and 20);

create or replace function public.guardar_puntaje_docente(
  p_partida_id uuid,
  p_empresa_id bigint,
  p_puntaje numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_puntaje numeric(4,2);
begin
  if p_puntaje is null or p_puntaje < 0 or p_puntaje > 20 then
    return jsonb_build_object('error', 'La nota debe estar entre 0 y 20.');
  end if;

  -- El dueño se comprueba dentro de la misma sentencia que escribe la nota.
  -- Un id de empresa válido de otra partida no puede recibir una calificación.
  v_puntaje := round(p_puntaje, 2);
  update public.participantes as participante
     set puntaje_docente = v_puntaje
   where participante.partida_id = p_partida_id
     and participante.empresa_id = p_empresa_id
     and exists (
       select 1
         from public.partidas as partida
        where partida.id = participante.partida_id
          and partida.profesor_id = auth.uid()
     );

  if not found then
    return jsonb_build_object('error', 'No se pudo calificar esta empresa en la partida.');
  end if;

  return jsonb_build_object('success', true, 'puntaje', v_puntaje);
end;
$$;

revoke all on function public.guardar_puntaje_docente(uuid, bigint, numeric) from public;
revoke all on function public.guardar_puntaje_docente(uuid, bigint, numeric) from anon;
grant execute on function public.guardar_puntaje_docente(uuid, bigint, numeric) to authenticated;

notify pgrst, 'reload schema';
commit;
