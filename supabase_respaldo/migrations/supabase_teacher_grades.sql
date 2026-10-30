-- Apply after supabase_migration.sql. Teacher grades are independent of student reports.
begin;
alter table public.participantes add column if not exists puntaje_docente numeric(4,2)
  check (puntaje_docente between 0 and 20);
create or replace function public.guardar_puntaje_docente(p_partida_id uuid,p_empresa_id bigint,p_puntaje numeric)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if p_puntaje is null or p_puntaje<0 or p_puntaje>20 then
    return jsonb_build_object('error','La nota debe estar entre 0 y 20.');
  end if;
  if not exists(select 1 from public.partidas where id=p_partida_id and profesor_id=auth.uid()) then
    return jsonb_build_object('error','Solo el profesor de la partida puede calificar.');
  end if;
  update public.participantes set puntaje_docente=round(p_puntaje,2)
    where partida_id=p_partida_id and empresa_id=p_empresa_id;
  if not found then return jsonb_build_object('error','La empresa no pertenece a esta partida.'); end if;
  return jsonb_build_object('success',true,'puntaje',round(p_puntaje,2));
end;
$$;
revoke all on function public.guardar_puntaje_docente(uuid,bigint,numeric) from public;
grant execute on function public.guardar_puntaje_docente(uuid,bigint,numeric) to authenticated;
commit;
