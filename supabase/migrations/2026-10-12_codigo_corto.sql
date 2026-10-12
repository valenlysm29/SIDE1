-- Ejecutar después de 2026-10-12_salas_codigo.sql. Repetible.
-- 31 símbolos, 31^4 = 923521 combinaciones; nunca reutiliza códigos históricos.
begin;

do $$ begin
 if to_regprocedure('public.unirse_partida_por_codigo(text,text,text)') is null
 or to_regprocedure('side_private.reservar_codigo_sala()') is null
 or to_regclass('side_private.codigos_sala_reservados') is null then
  raise exception 'Aplica primero 2026-10-12_salas_codigo.sql antes del código corto.';
 end if;
end $$;

lock table public.partidas in share row exclusive mode;
lock table side_private.codigos_sala_reservados in share row exclusive mode;

create or replace function public.side_normalizar_codigo_sala(p_codigo text)
returns text language sql immutable parallel safe set search_path=pg_catalog as $$
 with entrada as (
  select upper(regexp_replace(coalesce(p_codigo,''),'[[:space:]]','','g')) as codigo
 )
 select case
  when codigo ~ '^SIDE-?[A-Z0-9]+$' then regexp_replace(codigo,'^SIDE-?','SIDE-')
  when codigo<>'SIDE' and codigo ~ '^([A-Z0-9]{3,4}|[A-Z0-9]{6})$' then 'SIDE-'||codigo
  else codigo
 end from entrada;
$$;
revoke all on function public.side_normalizar_codigo_sala(text) from public;
grant execute on function public.side_normalizar_codigo_sala(text) to anon,authenticated;

-- La función IMMUTABLE cambió: reconstruir sus claves, sin cambiar las salas.
create unique index if not exists ux_side_codigo_sala_normalizado
 on public.partidas(public.side_normalizar_codigo_sala(codigo));
reindex index public.ux_side_codigo_sala_normalizado;
-- Consulta eficiente del registro permanente, incluso para reservas antiguas bare.
create index if not exists ix_side_reservas_codigo_normalizado
 on side_private.codigos_sala_reservados(public.side_normalizar_codigo_sala(codigo));
reindex index side_private.ix_side_reservas_codigo_normalizado;

create or replace function public.generar_codigo_sala()
returns text language plpgsql volatile security definer set search_path=pg_catalog as $$
declare alphabet constant text:='ABCDEFGHJKMNPQRSTUVWXYZ23456789'; code text; attempt integer; n integer;
begin
 -- El trigger de reserva usa el mismo bloqueo y conserva códigos tras borrar salas.
 perform pg_advisory_xact_lock(731924);
 for attempt in 1..100 loop
  code:='SIDE-';
  for n in 1..4 loop
   code:=code||substr(alphabet,1+floor(random()*length(alphabet))::integer,1);
  end loop;
  if not exists(select 1 from side_private.codigos_sala_reservados r
   where public.side_normalizar_codigo_sala(r.codigo)=code)
  and not exists(select 1 from public.partidas p
   where public.side_normalizar_codigo_sala(p.codigo)=code) then
   return code;
  end if;
 end loop;
 raise exception 'No se pudo asignar un código único tras 100 intentos. Reintenta crear la sala; si persiste, contacta al administrador. No se reutilizan códigos históricos.';
end $$;
revoke all on function public.generar_codigo_sala() from public,anon;
grant execute on function public.generar_codigo_sala() to authenticated;
-- side_next_game_code y el trigger existentes delegan en este generador.
alter table public.partidas alter column codigo set default public.generar_codigo_sala();

create or replace function public.unirse_partida_por_codigo(p_codigo text,p_nombre_legal text,p_nombre_comercial text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare code text:=public.side_normalizar_codigo_sala(p_codigo); game public.partidas;
begin
 -- También conserva códigos históricos de 3 caracteres, incluido SIDE-000.
 if code !~ '^SIDE-([A-Z0-9]{3,4}|[A-Z0-9]{6})$' then
  return jsonb_build_object('success',false,'code','CODIGO_INVALIDO','error','El código debe tener el formato SIDE-XXXX. También se aceptan códigos antiguos y SIDE-000.');
 end if;
 select * into game from public.partidas where public.side_normalizar_codigo_sala(codigo)=code for update;
 if not found then
  return jsonb_build_object('success',false,'code','PARTIDA_NO_ENCONTRADA','error','No existe una sala con ese código. Comprueba el código del docente.');
 end if;
 perform public.side_sync_game(game.id);
 select * into game from public.partidas where id=game.id;
 if game.estado='cancelada' or public.side_config_cancelada(game.configuracion) then
  return jsonb_build_object('success',false,'code','PARTIDA_CANCELADA','error','La sala fue cancelada por el docente. Solicita un código nuevo.');
 end if;
 if game.estado='finalizada' then
  return jsonb_build_object('success',false,'code','PARTIDA_FINALIZADA','error','La sala ya finalizó. Solicita un código nuevo.');
 end if;
 -- Mantiene la identidad exacta de ingreso/reingreso instalada anteriormente.
 return public.ingresar_empresa(game.codigo,p_nombre_legal,p_nombre_comercial);
end $$;
revoke all on function public.unirse_partida_por_codigo(text,text,text) from public;
grant execute on function public.unirse_partida_por_codigo(text,text,text) to anon,authenticated;

notify pgrst,'reload schema';
commit;
