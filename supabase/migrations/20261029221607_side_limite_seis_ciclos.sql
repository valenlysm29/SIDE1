-- Apply only to new games and explicit changes to their cycle count.
-- Existing records are neither rewritten nor blocked by unrelated updates.
create or replace function public.side_validar_limite_ciclos_nuevos()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.configuracion->'cycles' is not distinct from old.configuracion->'cycles' then
    return new;
  end if;
  if jsonb_typeof(new.configuracion->'cycles') not in ('number','string')
     or coalesce(new.configuracion->>'cycles','') !~ '^[1-6]$' then
    raise exception 'El número de ciclos debe ser un entero entre 1 y 6' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists side_validar_limite_ciclos_nuevos on public.partidas;
create trigger side_validar_limite_ciclos_nuevos before insert or update of configuracion
on public.partidas for each row execute function public.side_validar_limite_ciclos_nuevos();
