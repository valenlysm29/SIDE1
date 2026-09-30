-- Ejecutar sobre una instalación que ya tiene supabase_game_lifecycle.sql.
-- Repetible: cambia solo la generación de códigos de las nuevas partidas.
begin;

-- Two readable letters and one digit (SIDE-WG2); preserve all existing codes.
-- Serialize allocation and exclude historical games so codes are never reused.
create or replace function public.side_next_game_code()
returns text language plpgsql volatile security definer set search_path=public as $$
declare
  code text;
  letters constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  digits constant text := '23456789';
begin
  perform pg_advisory_xact_lock(731924);
  select candidate into code from (
    select 'SIDE-' || substr(letters,a,1) || substr(letters,b,1) || substr(digits,d,1) as candidate
    from generate_series(1,length(letters)) a
    cross join generate_series(1,length(letters)) b
    cross join generate_series(1,length(digits)) d
  ) codes
  where not exists(select 1 from public.partidas p where p.codigo=codes.candidate)
  order by random() limit 1;
  if code is null then
    raise exception 'Se agotaron los 4608 códigos alfanuméricos de partida. Contacta al administrador para ampliar el formato.';
  end if;
  return code;
end $$;
revoke all on function public.side_next_game_code() from public,anon;
grant execute on function public.side_next_game_code() to authenticated;
alter table public.partidas alter column codigo set default public.side_next_game_code();

create or replace function public.side_game_features()
returns jsonb language sql immutable as $$select '{"observationsVersion":1,"gameCodeVersion":2}'::jsonb$$;
revoke all on function public.side_game_features() from public,anon;
grant execute on function public.side_game_features() to authenticated;

commit;
