-- Read-only routing for the trusted worker; existing games default to v0.
create or replace function public.side_version_worker_cierre(p_partida_id uuid)
returns text language plpgsql stable security definer set search_path=pg_catalog as $$
declare v text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server only' using errcode='42501'; end if;
 select configuracion->>'sequentialCloseVersion' into v from public.partidas where id=p_partida_id;
 if not found then return null; end if;
 return coalesce(v,'0');
end $$;
revoke all on function public.side_version_worker_cierre(uuid) from public,anon,authenticated;
grant execute on function public.side_version_worker_cierre(uuid) to service_role;
