# Estado público del código y cancelación real — 2026-10-11

La comprobación anterior `p_config ? 'cancelledAt'` (`20261009_sala_espera_identidad_exacta.sql:22`, `supabase_game_lifecycle.sql:489`) confundía una clave presente con una cancelación real. En PGlite una sala con `cancelledAt: null` queda congelada en integración después de alcanzar el inicio; antes de esta corrección `side_sync_game` conserva esa fase. Después pasa a decisiones y `guardar_decisiones` permite el ciclo actual. No se reabre ninguna sala realmente cancelada/finalizada.

El helper `side_config_cancelada(jsonb)` considera falsos null, false, 0 y texto vacío (incluidos equivalentes textuales); un marcador real o phase cancelled siguen bloqueando. Se conserva el cuerpo del runtime v3 y se sustituye solamente su condición de cancelación. El guard de `guardar_decisiones(bigint,integer,jsonb)` se cambia mediante reemplazo dirigido de su definición instalada; una definición inesperada hace que la migración aborte con mensaje específico. La recuperación `recuperar_sala_docente(uuid,jsonb)` sustituye únicamente su guard de cancelledAt por el mismo helper y conserva el guard finishedAt. Esto evita convertir false/0/textos falsos en una finalización persistida. No se altera ningún cálculo financiero, `guardar_puntaje_docente`, tablas de empresas ni las decisiones existentes.

La nueva RPC `side_estado_codigo_sala(p_codigo text)` es de solo lectura. Devuelve únicamente el código solicitado normalizado (`codigo`) y una categoría (`code`): `DISPONIBLE`, `PARTIDA_CANCELADA`, `PARTIDA_FINALIZADA`, `CODIGO_RETIRADO`, `PARTIDA_NO_ENCONTRADA` o `CODIGO_AMBIGUO`. Nunca devuelve nombres, identidad, UUID, empresas, listas ni el registro histórico. Disponible indica sala existente no terminal; la admisión conserva su validación de identidad y tiempo. El código público compartido por el profesor permite comprobar su categoría al rol anónimo/autenticado. La tabla privada sigue inaccesible.

Pruebas: `node tests/estado_codigo_sala_db.cjs` y `node --check tests/estado_codigo_sala_db.cjs` PASS. Reproducción antes/después del null, marcadores falsos/reales, runtime y decisiones, recuperación legacy con null/false/0/textos falsos sin cierre y cierre real intacto, SQL dos veces, categorías mínima, salas eliminadas/retiradas, finalizadas, canceladas, espera, datos ambiguos heredados y permisos anónimos sin acceso al registro.

## Orden de aplicación

Después de los requisitos previos descritos en `reports/codigos_sala_no_reutilizables_2026-10-11.md`:

1. `2026-10-11_codigos_sala_no_reutilizables.sql`.
2. `2026-10-11_estado_codigo_sala.sql` (texto completo abajo).

Excel no es requisito de estos cambios. No se ejecutó nada en producción. No reinstalar un runtime/generador anterior después de estas correcciones.

## Diagnóstico y comprobación de solo lectura

```sql
select to_regprocedure('public.side_estado_codigo_sala(text)'),
       to_regprocedure('public.side_config_cancelada(jsonb)'),
       to_regclass('side_private.codigos_sala_reservados');
-- Después deben existir los tres objetos.
select public.side_admission_features(); -- waitingRoomVersion >= 3.
select pg_get_functiondef('public.side_runtime(jsonb,timestamp with time zone)'::regprocedure);
select pg_get_functiondef('public.guardar_decisiones(bigint,integer,jsonb)'::regprocedure);
select pg_get_functiondef('public.recuperar_sala_docente(uuid,jsonb)'::regprocedure);
-- Las tres definiciones deben usar side_config_cancelada, nunca solo ? cancelledAt.
select public.side_config_cancelada('{"cancelledAt":null}'::jsonb) marcador_nulo,
       public.side_config_cancelada('{"cancelledAt":false}'::jsonb) marcador_false,
       public.side_config_cancelada('{"phase":"cancelled"}'::jsonb) cancelacion_real;
-- false, false, true.
select has_function_privilege('anon','public.side_estado_codigo_sala(text)','EXECUTE') anon,
       has_function_privilege('authenticated','public.side_estado_codigo_sala(text)','EXECUTE') authenticated;
-- true, true; la respuesta tiene solo code y codigo (este último es el mismo código público solicitado).
select public.side_estado_codigo_sala('REEMPLAZAR POR EL CÓDIGO REAL');
```

## SQL exacto

```sql
-- Después de 2026-10-11_codigos_sala_no_reutilizables.sql y sala de espera v3.
-- Solo categorías públicas del código: ninguna identidad ni listado de salas.
begin;
do $$ begin
 if to_regclass('side_private.codigos_sala_reservados') is null
  or to_regprocedure('public.side_runtime(jsonb,timestamp with time zone)') is null
  or to_regprocedure('public.side_admission_features()') is null then
  raise exception 'Aplica primero 20261009_sala_espera_identidad_exacta.sql y 2026-10-11_codigos_sala_no_reutilizables.sql.';
 end if;
 if coalesce((public.side_admission_features()->>'waitingRoomVersion')::integer,0)<3 then
  raise exception 'Actualiza primero la sala de espera con 20261009_sala_espera_identidad_exacta.sql (versión 3).';
 end if;
end $$;

create or replace function public.side_config_cancelada(p_config jsonb)
returns boolean language sql immutable parallel safe set search_path=pg_catalog as $$
 select coalesce(p_config->>'phase'='cancelled',false)
  or coalesce(p_config#>>'{runtime,phase}'='cancelled',false)
  or coalesce(lower(btrim(p_config->>'cancelledAt')) not in ('','false','0','null'),false);
$$;
revoke all on function public.side_config_cancelada(jsonb) from public,anon,authenticated;
-- side_runtime conserva su contrato invoker; este helper solo evalúa el JSON
-- que entrega el propio llamador, sin leer datos de la base.
grant execute on function public.side_config_cancelada(jsonb) to anon,authenticated;

create or replace function public.side_runtime(p_config jsonb, p_now timestamptz default clock_timestamp())
returns jsonb language plpgsql stable set search_path=pg_catalog as $$
declare
  r jsonb := coalesce(p_config->'runtime','{}');
  deadline timestamptz := nullif(p_config->>'gameStartAt','')::timestamptz;
  started timestamptz;
  duration integer := greatest(60,coalesce((p_config->>'roundHours')::integer,0)*3600+coalesce((p_config->>'roundMinutes')::integer,10)*60);
  total integer := coalesce((p_config->>'cycles')::integer,6);
  cycle integer;
begin
  if p_config->>'lifecycleVersion' is distinct from '2' then return r; end if;
  if r->>'phase' in ('finished','cancelled') or public.side_config_cancelada(p_config) then return r; end if;
  if p_config->>'cycleCloseMode'='automatic' then
    if deadline is null or p_now<deadline then return r; end if;
    cycle := least(total,1+floor(extract(epoch from p_now-deadline)/duration)::integer);
    started := deadline+make_interval(secs=>(cycle-1)*duration);
    r := jsonb_build_object('round',cycle,'phase','decisions','status','running','running',true,
      'mode','automatic','duration',duration,'remaining',duration,'startedAt',started);
    if p_now>=deadline+make_interval(secs=>total*duration) then
      r := r||jsonb_build_object('phase','finished','status','simulation-finished','running',false,'remaining',0);
    end if;
  elsif r->>'phase'='integration' and deadline is not null and p_now>=deadline then
    r:=r||jsonb_build_object('phase','decisions','status','running','running',true,
      'round',1,'startedAt',deadline,'duration',duration,'remaining',duration);
    if p_now>=deadline+make_interval(secs=>duration) then
      r:=r||jsonb_build_object('phase','results','status','finished','running',false,'remaining',0);
    end if;
  elsif r->>'phase'='decisions' and (r->>'running')::boolean then
    started := (r->>'startedAt')::timestamptz;
    if p_now>=started+make_interval(secs=>(r->>'duration')::integer) then
      r := r||jsonb_build_object('phase','results','status','finished','running',false,'remaining',0);
    end if;
  end if;
  return r;
end $$;

create or replace function public.side_estado_codigo_sala(p_codigo text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare normalized text:=public.side_normalizar_ingreso(p_codigo); n integer;
 c jsonb; estado text;
begin
 select count(*) into n from public.partidas p
  where public.side_normalizar_ingreso(p.codigo)=normalized;
 if n>1 then return jsonb_build_object('code','CODIGO_AMBIGUO','codigo',upper(normalized)); end if;
 if n=1 then
  select p.configuracion,p.estado into c,estado from public.partidas p
   where public.side_normalizar_ingreso(p.codigo)=normalized;
  if public.side_config_cancelada(c) then return jsonb_build_object('code','PARTIDA_CANCELADA','codigo',upper(normalized)); end if;
  if estado='finalizada' or c->>'phase'='finished' or c#>>'{runtime,phase}'='finished' then
   return jsonb_build_object('code','PARTIDA_FINALIZADA','codigo',upper(normalized));
  end if;
  return jsonb_build_object('code','DISPONIBLE','codigo',upper(normalized));
 end if;
 if exists(select 1 from side_private.codigos_sala_reservados where codigo=upper(normalized)) then
  return jsonb_build_object('code','CODIGO_RETIRADO','codigo',upper(normalized));
 end if;
 return jsonb_build_object('code','PARTIDA_NO_ENCONTRADA','codigo',upper(normalized));
end $$;
revoke all on function public.side_estado_codigo_sala(text) from public;
grant execute on function public.side_estado_codigo_sala(text) to anon,authenticated;

-- Cambia únicamente el guard de cancelación en la función existente:
-- conserva validaciones, permisos y lógica de decisiones del servidor instalado.
do $$ declare definition text;
begin
 if to_regprocedure('public.guardar_decisiones(bigint,integer,jsonb)') is null then
  raise exception 'Falta guardar_decisiones: aplica primero supabase_game_lifecycle.sql.';
 end if;
 definition:=pg_get_functiondef('public.guardar_decisiones(bigint,integer,jsonb)'::regprocedure);
 if strpos(definition,'v_config ? ''cancelledAt''')>0 then
  definition:=replace(definition,'v_config ? ''cancelledAt''','public.side_config_cancelada(v_config)');
  execute definition;
 elsif strpos(definition,'public.side_config_cancelada(v_config)')=0 then
  raise exception 'La firma de guardar_decisiones tiene un guard de cancelación diferente. Revisa su definición antes de aplicar esta corrección.';
 end if;
end $$;
-- La recuperación heredada tampoco puede convertir un marcador falso en
-- una finalización persistida. Se conserva íntegro el guard finishedAt.
do $$ declare definition text;
begin
 if to_regprocedure('public.recuperar_sala_docente(uuid,jsonb)') is null then
  raise exception 'Aplica primero 2026-10-11_fix_crear_partida.sql y 2026-10-11_recuperar_salas_compatibles.sql.';
 end if;
 definition:=pg_get_functiondef('public.recuperar_sala_docente(uuid,jsonb)'::regprocedure);
 if strpos(definition,'nullif(p.configuracion->>''cancelledAt'','''') is not null')>0 then
  definition:=replace(definition,'nullif(p.configuracion->>''cancelledAt'','''') is not null','public.side_config_cancelada(p.configuracion)');
  execute definition;
 elsif strpos(definition,'public.side_config_cancelada(p.configuracion)')=0 then
  raise exception 'La recuperación tiene un guard de cancelación diferente. Revisa recuperar_sala_docente antes de aplicar esta corrección.';
 end if;
end $$;
notify pgrst,'reload schema';
commit;
```
