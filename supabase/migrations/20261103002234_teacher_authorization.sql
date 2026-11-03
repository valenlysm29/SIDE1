begin;
-- Profiles describe identities; they do not confer the teacher role. Preserve
-- the institutional domain and existing private exception records.
create schema if not exists side_private;
create table if not exists side_private.docentes_excepciones (
 correo text primary key,
 motivo text not null
);
alter table side_private.docentes_excepciones enable row level security;
revoke all on side_private.docentes_excepciones from public,anon,authenticated;
create or replace function public.side_correo_docente_permitido(p_correo text)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select lower(btrim(coalesce(p_correo,''))) ~ '^[^[:space:]@]+@upch\.pe$'
 or exists(select 1 from side_private.docentes_excepciones e where e.correo=lower(btrim(p_correo)));
$$;
revoke all on function public.side_correo_docente_permitido(text) from public,anon,authenticated;
grant execute on function public.side_correo_docente_permitido(text) to service_role;

create or replace function public.side_docente_autorizado()
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from auth.users u join public.profesores p on p.id=u.id
 where u.id=auth.uid() and not coalesce(u.is_anonymous,false)
 and u.email_confirmed_at is not null and public.side_correo_docente_permitido(u.email));
$$;
revoke all on function public.side_docente_autorizado() from public,anon;
grant execute on function public.side_docente_autorizado() to authenticated,service_role;

-- Keep each original business/ownership check and signature. Add the role
-- predicate before any statement can change a game. Reapplication is safe.
do $migration$
declare f record; definition text;
begin
 for f in select p.oid,p.proname,l.lanname from pg_proc p
 join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
 where n.nspname='public' and p.proname=any(array[
 'crear_sala_docente','recuperar_sala_docente','controlar_partida','cancelar_partida',
 'avanzar_ciclo','guardar_puntaje_docente','side_expulsar_empresa','side_liberar_empresa',
 'side_podio_docente','side_draw_events_v1','side_assign_event_v1',
 'side_guardar_configuracion_v19','side_registrar_entrega_proveedor_v1']) loop
  definition:=pg_get_functiondef(f.oid);
  if position('SIDE_TEACHER_AUTH_V1' in definition)>0 then continue; end if;
  if f.lanname<>'plpgsql' or definition !~* '\mbegin\M' then
   raise exception 'Unsupported teacher RPC body: %',f.proname;
  end if;
  definition:=regexp_replace(definition,'\mbegin\M',
   E'begin\n -- SIDE_TEACHER_AUTH_V1\n if not public.side_docente_autorizado() then raise exception ''Acceso docente no autorizado.'' using errcode=''42501''; end if;','i');
  execute definition;
 end loop;
 if to_regprocedure('public.crear_sala_docente(jsonb,text,text,text,uuid,uuid)') is null then
  raise exception 'Missing room creation prerequisite';
 end if;
end $migration$;

alter table public.profesores enable row level security;
drop policy if exists "profesor ve su perfil" on public.profesores;
create policy "profesor ve su perfil" on public.profesores for select to authenticated using(id=auth.uid());
drop policy if exists "profesor actualiza su perfil" on public.profesores;
create policy "profesor actualiza su perfil" on public.profesores for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
drop policy if exists "profesor crea partidas" on public.partidas;
create policy "profesor crea partidas" on public.partidas for insert to authenticated with check(profesor_id=auth.uid() and public.side_docente_autorizado());
drop policy if exists "profesor actualiza sus partidas" on public.partidas;
create policy "profesor actualiza sus partidas" on public.partidas for update to authenticated using(profesor_id=auth.uid() and public.side_docente_autorizado()) with check(profesor_id=auth.uid() and public.side_docente_autorizado());
drop policy if exists "profesor elimina sus partidas" on public.partidas;
create policy "profesor elimina sus partidas" on public.partidas for delete to authenticated using(profesor_id=auth.uid() and public.side_docente_autorizado());
notify pgrst,'reload schema';
commit;
