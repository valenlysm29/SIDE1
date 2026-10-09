Cambios pendientes en Supabase: SÍ

# Corrección de sala de espera y verificación de SIDE

Fecha: 9 de octubre de 2026, America/Lima. Implementación local y SQL entregados; la aplicación del SQL remoto permanece pendiente.

## Causa raíz y reproducción

En modo manual, `startGame()` en `js/docente.js` ejecutaba `prepareGame()` y, a continuación, `controlGame('iniciar')`. La primera operación creaba correctamente la sala de espera; la segunda adelantaba `gameStartAt` a la hora actual y marcaba `started_at`. La RPC de admisión, correctamente cerrada para partidas iniciadas, rechazaba entonces a empresas nuevas. Además, el vencimiento automático de la sala y su cuenta regresiva estaban condicionados al modo de cierre de ciclos.

La consulta remota del código SIDE-SD7 devuelve estado `activa`; la llamada real a `ingresar_empresa` con demo1/demo1 devuelve `PARTIDA_INICIADA`. Las políticas no permiten leer anónimamente la configuración privada de esa partida. La causa del código está comprobada; su fecha exacta y configuración remota deben confirmarse con la consulta SQL incluida en la migración. No hay evidencia suficiente para atribuir este caso a UTC frente a Lima.

## Cambios por requisito

1. La acción del profesor abre la sala sin adelantar el inicio. La cuenta regresiva y el vencimiento dependen del plazo persistido por PostgreSQL y de la hora del servidor, independiente del cierre manual o automático de ciclos.
2. La RPC serializa la admisión y sincroniza el estado antes de crear una empresa. Tras el inicio solo recupera una identidad existente. Los nombres distinguen mayúsculas y tildes; se conserva la limpieza de espacios que realiza el formulario al registrar. Los privilegios existentes impiden insertar empresas/participantes directamente desde el cliente.
3. El menú, encabezado y título de la sección del profesor ahora dicen Historial. Se conservan su icono y consulta de última partida, empresas, decisiones y resultados.
4. Se retiraron exclusivamente los estilos que tapaban la barra plateada anterior. El cambio de diseño se identificó en el commit 2a13925; el diseño anterior permanece en `css/styles.css` y sus reglas responsive.
5. Una hoja específica ajusta la selección de roles a 100dvh con dimensiones y espacios flexibles, y composición horizontal en pantallas bajas. No oculta contenido para suprimir el scroll.
6. Se verifica el flujo por suites de profesor/estudiantes, decisiones, ciclos, mundo 3D y retorno de Tablet. El temporizador del pedido al proveedor usa también el reloj compartido del servidor. Se conserva un ciclo de una hora y cero minutos sin añadir diez minutos por un valor de respaldo incorrecto. Los tiempos de admisión, avance, pausa y reanudación se toman después del bloqueo de la fila; una transacción que comenzó antes no puede consumir tiempo del ciclo nuevo ni aceptar un ingreso tardío.
7. La app comprueba versiones de la migración y muestra un mensaje en español cuando falta. No se ha ejecutado SQL remoto ni se ha reabierto automáticamente SIDE-SD7.

## Supabase y publicación

Debe aplicarse `supabase/migrations/20261009_sala_espera_identidad_exacta.sql`. Las instrucciones para principiantes y el orden de requisitos están en `docs/SUPABASE_SALA_ESPERA_20261009.md`.

Pasos para aplicarla:

1. Entra al proyecto SIDE en Supabase y abre **SQL Editor → New query**.
2. Comprueba los requisitos con la consulta de la guía. Si faltan las funciones base, ejecuta primero `supabase_game_lifecycle.sql` y después `supabase_student_admission.sql`, cada archivo completo en su propia consulta. No reemplaces el esquema de un proyecto existente.
3. Pega todo el SQL incluido al final de este informe y pulsa **Run**.
4. Verifica `waitingRoomVersion = 3`, `exactIdentityVersion = 2` y la fecha del servidor. Revisa también el diagnóstico de SIDE-SD7; una partida ya iniciada conserva su estado.
5. Crea una partida nueva con dos minutos de espera y prueba dos navegadores. Confirma la aplicación del SQL y las versiones antes de dar por lista producción.

Si el código se despliega antes del SQL, el ingreso y la creación de nuevas partidas se detienen con el mensaje «Falta aplicar la migración 20261009_sala_espera_identidad_exacta.sql en Supabase». Producción queda pendiente de tu ejecución y confirmación. Una partida ya marcada como iniciada conserva su bloqueo; para una nueva sala, el profesor debe crear otra partida después de la migración.

## Estado inicial de Git y preservación

El remoto verificado es `https://github.com/valenlysm29/SIDE1.git`. Tras `git fetch origin`, HEAD y origin/main coinciden en f288f42: no había commits locales pendientes de push. Se encontraron cambios previos sin commit (Godot, recursos, responsive, herramientas e informes); se conservan y no se incorporan indiscriminadamente a esta corrección. Se integran los 87 renglones móviles previos de `responsive.css` porque la prueba del CSS publicado demostró el solapamiento entre cifras y misiones que esos ajustes corrigen. Se corrigieron además la posición del minimapa en móvil vertical y los botones táctiles de 42 px, que ahora tienen 44 × 44 px. Se actualizan las versiones de recursos para evitar cargar código y estilos anteriores desde caché.

Todas las entregas, análisis y evidencias de esta tarea se guardan dentro de SIDE1. El contenedor conserva el mismo inventario inicial: .agents, reports, SIDE1 y skills-lock.json.

La transición lógica comparte un plazo único del servidor. Su presentación en cada navegador depende de recibir la sincronización y de la latencia de red. La prueba local usa PostgreSQL/PGlite y Chromium; no sustituye la aplicación y verificación del SQL en el proyecto real. No se modifican Edge Functions, variables de entorno ni configuración de realtime.

## Pruebas y commits

Los resultados consolidados, la cobertura y los logs están documentados en `reports/QA_SALA_ESPERA_2026_10_09.md`: **35 suites aprobadas, cero fallos pendientes; Node 300/300**. Incluyen siete suites SQL, flujo de profesor/estudiantes, decisiones/resultados/ciclos, 60 retornos de Tablet, roles en 11 tamaños y seis tamaños móviles con 126 capturas. La entrada opcional `side_full_flow.cjs` no existe; el flujo completo se cubre mediante las otras suites y no se presenta esa entrada como prueba ejecutada.

Commits de implementación: `834cc7f` (admisión y reloj servidor) y `5a2da67` (splash, Historial y layouts). Este informe, el informe QA y los runners reproducibles se incluyen en un tercer commit de documentación/pruebas. El resultado del pull con rebase y del push a main se comunica al finalizar. Los cambios anteriores ajenos a esta tarea permanecen locales sin descartarse. Pendiente externo: ejecutar y confirmar la migración de Supabase.

El benchmark funcional termina correctamente con SwiftShader, renderizado por CPU: medianas de 2 FPS en calidad baja/media y 1 FPS en alta. No se ha verificado rendimiento con GPU física; este resultado no permite afirmar fluidez del mundo 3D en producción.

## SQL íntegro listo para copiar

Contenido completo de `supabase/migrations/20261009_sala_espera_identidad_exacta.sql`. Ejecutar después de comprobar los requisitos indicados en la guía; se incluye verificación al final.

```sql
-- SIDE: sala de espera temporizada por servidor e identidad exacta.
-- Requiere las migraciones base game_lifecycle y student_admission existentes.
-- No cambia started_at ni reabre partidas ya iniciadas. Repetible, sin borrar datos.
begin;
DO $$ BEGIN
 if to_regprocedure('public.ingresar_empresa(text,text,text)') is null
   or to_regprocedure('public.side_runtime(jsonb,timestamp with time zone)') is null then
  raise exception 'Primero aplica supabase_game_lifecycle.sql y supabase_student_admission.sql';
 end if;
END $$;
create or replace function public.side_runtime(p_config jsonb, p_now timestamptz default clock_timestamp())
returns jsonb language plpgsql stable set search_path=public as $$
declare
  r jsonb := coalesce(p_config->'runtime','{}');
  deadline timestamptz := nullif(p_config->>'gameStartAt','')::timestamptz;
  started timestamptz;
  duration integer := greatest(60,coalesce((p_config->>'roundHours')::integer,0)*3600+coalesce((p_config->>'roundMinutes')::integer,10)*60);
  total integer := coalesce((p_config->>'cycles')::integer,6);
  cycle integer;
begin
  if p_config->>'lifecycleVersion' is distinct from '2' then return r; end if;
  if r->>'phase' in ('finished','cancelled') or p_config ? 'cancelledAt' then return r; end if;
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

create or replace function public.side_resolver_identidad_empresa(
  p_codigo text,
  p_nombre_legal text,
  p_nombre_comercial text
)
returns table (participante_id uuid, empresa_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text := public.side_normalizar_ingreso(p_codigo);
  v_legal text := public.side_limpiar_whitespace_ingreso(p_nombre_legal);
  v_comercial text := public.side_limpiar_whitespace_ingreso(p_nombre_comercial);
  v_partida_id uuid;
  v_codigos integer;
  v_coincidencias integer;
begin
  if v_codigo = '' or v_legal = '' or v_comercial = '' then return; end if;

  select count(*), min(p.id::text)::uuid
  into v_codigos, v_partida_id
  from public.partidas p
  where public.side_normalizar_ingreso(p.codigo) = v_codigo;
  if v_codigos <> 1 then return; end if;

  select count(*), min(pt.id::text)::uuid, min(pt.empresa_id)
  into v_coincidencias, participante_id, empresa_id
  from public.participantes pt
  where pt.partida_id = v_partida_id
    and pt.empresa_id is not null
    and public.side_limpiar_whitespace_ingreso(pt.nombre_legal_ingreso) = v_legal
    and public.side_limpiar_whitespace_ingreso(pt.nombre_comercial_ingreso) = v_comercial;

  if v_coincidencias = 1 then return next; end if;
end;
$$;

create or replace function public.ingresar_empresa(
  p_codigo text,
  p_nombre_legal text,
  p_nombre_comercial text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text := public.side_normalizar_ingreso(p_codigo);
  v_legal text := public.side_limpiar_whitespace_ingreso(p_nombre_legal);
  v_comercial text := public.side_limpiar_whitespace_ingreso(p_nombre_comercial);
  -- Valores canonicos de almacenamiento: conservan caja, tildes y puntuacion,
  -- pero eliminan whitespace de bordes y colapsan secuencias internas.
  v_legal_limpio text := public.side_limpiar_whitespace_ingreso(p_nombre_legal);
  v_comercial_limpio text := public.side_limpiar_whitespace_ingreso(p_nombre_comercial);
  v_partida_id uuid;
  v_partida public.partidas;
  v_participante_id uuid;
  v_empresa_id bigint;
  v_exactos integer := 0;
  v_codigos integer := 0;
  v_iniciada boolean;
  v_capital numeric := 100000;
  v_capital_min numeric;
  v_capital_max numeric;
begin
  -- La identidad siempre exige una terna no vacia. Ningun registro legacy con
  -- nombres NULL/vacios se puede recuperar presentando solo whitespace.
  if v_codigo = '' or v_legal = '' or v_comercial = '' then
    return jsonb_build_object(
      'success', false,
      'code', 'CREDENCIALES_INVALIDAS',
      'error', 'Los datos ingresados no coinciden con un registro existente.'
    );
  end if;

  -- Rechaza tambien codigos historicos ambiguos sin revelar cual dato fallo.
  select count(*) into v_codigos
  from public.partidas p
  where public.side_normalizar_ingreso(p.codigo) = v_codigo;

  if v_codigos <> 1 then
    return jsonb_build_object(
      'success', false,
      'code', 'CREDENCIALES_INVALIDAS',
      'error', 'Los datos ingresados no coinciden con un registro existente.'
    );
  end if;

  select p.id into v_partida_id
  from public.partidas p
  where public.side_normalizar_ingreso(p.codigo) = v_codigo
  limit 1;

  -- Esta funcion toma FOR UPDATE, resuelve el reloj automatico y persiste la
  -- fase. La misma fila queda bloqueada hasta terminar esta admision.
  perform public.side_sync_game(v_partida_id);

  select p.* into v_partida
  from public.partidas p
  where p.id = v_partida_id
  for update;

  select count(*) into v_exactos
  from public.participantes pt
  where pt.partida_id = v_partida.id
    and pt.empresa_id is not null
    and public.side_limpiar_whitespace_ingreso(pt.nombre_legal_ingreso) = v_legal
    and public.side_limpiar_whitespace_ingreso(pt.nombre_comercial_ingreso) = v_comercial;

  if v_exactos = 1 then
    -- Tambien se permite recuperar el estado terminal (finalizada/cancelada):
    -- no crea actividad nueva y evita perder resultados tras una desconexion.
    select pt.id into v_participante_id
    from public.participantes pt
    where pt.partida_id = v_partida.id
      and pt.empresa_id is not null
      and public.side_limpiar_whitespace_ingreso(pt.nombre_legal_ingreso) = v_legal
      and public.side_limpiar_whitespace_ingreso(pt.nombre_comercial_ingreso) = v_comercial
    limit 1;

    update public.participantes
    set last_seen_at = clock_timestamp()
    where id = v_participante_id;

    return public.side_respuesta_ingreso(v_participante_id, true);
  elsif v_exactos > 1 then
    return jsonb_build_object(
      'success', false,
      'code', 'CREDENCIALES_INVALIDAS',
      'error', 'Los datos ingresados no coinciden con un registro existente.'
    );
  end if;

  v_iniciada := v_partida.started_at is not null
    or v_partida.estado <> 'esperando'
    or (
      v_partida.configuracion->>'lifecycleVersion' = '2'
      and coalesce(v_partida.configuracion#>>'{runtime,phase}', '') <> 'integration'
    );

  if v_iniciada then
    return jsonb_build_object(
      'success', false,
      'code', 'PARTIDA_INICIADA',
      'error', 'La partida ya inició. Solo pueden reingresar quienes ya estaban registrados; verifica que el código, el nombre de empresa y el nombre comercial sean exactamente los registrados.'
    );
  end if;

  -- Antes del ciclo 1 una terna distinta es un alta valida aunque comparta
  -- solo uno de los nombres con otra empresa. La identidad es la terna total.
  -- Estos limites se aplican exclusivamente al alta nueva: la busqueda exacta
  -- anterior permite reingresar identidades legacy sin modificarlas.
  if char_length(v_legal_limpio) > 60
    or char_length(v_comercial_limpio) > 40
  then
    return jsonb_build_object(
      'success', false,
      'code', 'CREDENCIALES_INVALIDAS',
      'error', 'Los datos ingresados no coinciden con un registro existente.'
    );
  end if;

  -- El cliente no decide el capital. Incluso el modo aleatorio se calcula
  -- dentro de la transaccion del servidor.
  if coalesce(v_partida.configuracion->>'capitalMode', 'fixed') = 'random' then
    v_capital_min := coalesce(nullif(v_partida.configuracion->>'capitalMin', '')::numeric, 80000);
    v_capital_max := coalesce(nullif(v_partida.configuracion->>'capitalMax', '')::numeric, v_capital_min);
    if v_capital_max < v_capital_min then
      v_capital_max := v_capital_min;
    end if;
    -- Conserva la granularidad historica del juego: saltos de S/ 500.
    v_capital := v_capital_min
      + floor(random() * (floor((v_capital_max - v_capital_min) / 500) + 1)) * 500;
  else
    v_capital := coalesce(nullif(v_partida.configuracion->>'capital', '')::numeric, 100000);
  end if;

  begin
    insert into public.empresas (
      nombre_legal, nombre_comercial, caja_inicial, caja_actual, ciclo_actual
    ) values (
      v_legal_limpio, v_comercial_limpio, v_capital, v_capital, 1
    ) returning id into v_empresa_id;

    insert into public.participantes (
      partida_id, empresa_id, nombre, empresa,
      nombre_legal_ingreso, nombre_comercial_ingreso, last_seen_at
    ) values (
      v_partida.id, v_empresa_id, 'Jugador', v_comercial_limpio,
      v_legal_limpio, v_comercial_limpio, clock_timestamp()
    ) returning id into v_participante_id;
  exception when unique_violation then
    return jsonb_build_object(
      'success', false,
      'code', 'CREDENCIALES_INVALIDAS',
      'error', 'Los datos ingresados no coinciden con un registro existente.'
    );
  end;

  insert into public.side_student_state(empresa_id) values (v_empresa_id)
  on conflict (empresa_id) do nothing;

  return public.side_respuesta_ingreso(v_participante_id, false);
end;
$$;

create or replace function public.controlar_partida(p_partida_id uuid,p_accion text,p_config jsonb default null,p_expected_round integer default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.partidas; c jsonb; r jsonb; duration integer; cycle integer; remaining integer; action_time timestamptz;
begin
  select * into p from public.partidas where id=p_partida_id for update;
  if not found or auth.uid() is distinct from p.profesor_id then return jsonb_build_object('error','No tienes permiso para modificar esta partida'); end if;
  perform public.side_sync_game(p_partida_id);
  select * into p from public.partidas where id=p_partida_id;
  action_time:=clock_timestamp();
  c:=p.configuracion; r:=coalesce(c->'runtime','{}'); cycle:=coalesce((r->>'round')::integer,1);
  if p_accion='cancelar' then
    if p.estado<>'finalizada' then
      c:=c||jsonb_build_object('cancelledAt',clock_timestamp(),'phase','cancelled',
        'runtime',r||jsonb_build_object('phase','cancelled','status','simulation-finished','running',false,'remaining',0));
      update public.partidas set estado='finalizada',configuracion=c where id=p_partida_id returning * into p;
    end if;
    return to_jsonb(p)||jsonb_build_object('serverTime',clock_timestamp());
  end if;
  if c->>'lifecycleVersion' is distinct from '2' then return to_jsonb(p)||jsonb_build_object('serverTime',clock_timestamp()); end if;
  duration:=greatest(60,(c->>'roundHours')::integer*3600+(c->>'roundMinutes')::integer*60);
  if p_accion='guardar' then
    if jsonb_typeof(p_config->'enabledEvents') is distinct from 'array' then return jsonb_build_object('error','Selección de eventos inválida'); end if;
    if exists(select 1 from jsonb_array_elements_text(p_config->'enabledEvents') selected(id) where not exists(select 1 from public.side_event_catalog e where e.id=selected.id)) then return jsonb_build_object('error','Evento desconocido'); end if;
    if not public.side_valid_event_rules(coalesce(p_config->'eventRules','{}')) then return jsonb_build_object('error','Configuración de eventos inválida'); end if;
    c:=c||jsonb_build_object('eventRules',coalesce(p_config->'eventRules',c->'eventRules','{}'),'enabledEvents',p_config->'enabledEvents','eventSelectionMode',p_config->'eventSelectionMode','randomEventCount',p_config->'randomEventCount');
  elsif p_accion in ('avanzar','pausar','reanudar','cerrar') and c->>'cycleCloseMode'='manual'
    and r->>'phase' in ('decisions','results') and p.estado<>'finalizada' and p_expected_round=cycle then
    if p_accion='avanzar' then
      if cycle>=(c->>'cycles')::integer then
        r:=r||jsonb_build_object('phase','finished','status','simulation-finished','running',false,'remaining',0);
      else
        r:=r||jsonb_build_object('round',cycle+1,'phase','decisions','status','running','running',true,'startedAt',action_time,'duration',duration,'remaining',duration);
      end if;
    elsif p_accion='cerrar' then
      r:=r||jsonb_build_object('phase','results','status','finished','running',false,'remaining',0);
    elsif p_accion='pausar' and (r->>'running')::boolean then
      remaining:=greatest(0,(r->>'duration')::integer-floor(extract(epoch from action_time-(r->>'startedAt')::timestamptz))::integer);
      r:=r||jsonb_build_object('status','paused','running',false,'remaining',remaining);
    elsif p_accion='reanudar' and r->>'status'='paused' then
      r:=r||jsonb_build_object('status','running','running',true,'startedAt',action_time,'duration',r->'remaining');
    end if;
  end if;
  c:=c||jsonb_build_object('runtime',r,'phase',r->>'phase','round',r->'round');
  if c is distinct from p.configuracion then
    update public.partidas set configuracion=c,eventos_habilitados=coalesce(c->'enabledEvents','[]') where id=p_partida_id;
  end if;
  return public.side_sync_game(p_partida_id);
end $$;

-- Reemplaza únicamente el índice de identidad: no modifica registros históricos.
drop index if exists public.ux_side_identidad_ingreso;
create index if not exists idx_side_identidad_exacta on public.participantes
(partida_id, public.side_limpiar_whitespace_ingreso(nombre_legal_ingreso), public.side_limpiar_whitespace_ingreso(nombre_comercial_ingreso));
DO $$ BEGIN
 if not exists (select 1 from public.participantes where empresa_id is not null
 group by partida_id,public.side_limpiar_whitespace_ingreso(nombre_legal_ingreso),public.side_limpiar_whitespace_ingreso(nombre_comercial_ingreso)
 having count(*)>1) then
  create unique index if not exists ux_side_identidad_ingreso on public.participantes
  (partida_id,public.side_limpiar_whitespace_ingreso(nombre_legal_ingreso),public.side_limpiar_whitespace_ingreso(nombre_comercial_ingreso)) where empresa_id is not null;
 end if;
END $$;
create or replace function public.side_admission_features()
returns jsonb language sql volatile set search_path=public as $$
 select jsonb_build_object('waitingRoomVersion',3,'exactIdentityVersion',2,'serverTime',clock_timestamp());
$$;
revoke all on function public.side_admission_features() from public;
grant execute on function public.side_admission_features() to anon,authenticated;
NOTIFY pgrst, 'reload schema';
commit;
-- Verificación: deben aparecer 3 y 2, y fecha UTC del servidor.
select public.side_admission_features();
-- Diagnóstico conservador de SIDE-SD7 (no cambia estados ni borra datos).
select codigo,estado,started_at,configuracion->>'lifecycleVersion' as lifecycle,
 configuracion#>>'{runtime,phase}' as phase,configuracion->>'gameStartAt' as fin_espera,
 configuracion->>'integrationDurationMinutes' as minutos_espera
from public.partidas where codigo='SIDE-SD7';
```
