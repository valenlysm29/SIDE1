# Diagnóstico de creación de partida — 2026-10-11

## Causa comprobada antes del parche

En HEAD inicial `92ebb13`, `js/docente.js:361` devuelve éxito desde `prepareGame()` cuando `SIDE_GAME_STATUS.active` está guardado, sin consultar Supabase. `startGame()` en línea 414 anuncia «Sala de espera configurada…» aunque no hubo creación ni comprobación de existencia. Reproducción: guardar `{active:true}` en esa clave y pulsar/invocar Iniciar partida; cero llamadas de creación/control. No se puede atribuir el caso de producción a una migración sin inspeccionar su base: no se accedió a producción.

Además, `ensureSupabasePartida()` (277–280) reutiliza cualquier ID guardado; una partida finalizada puede devolverse como éxito si el navegador no conserva `finishedAt`. El índice de `supabase/schema.sql:289` limita solamente `estado='activa'` y no existe en el script `supabase_migration.sql`: según la instalación, varias salas en espera compiten al iniciar o quedan varias activas. El guard de promesa protege una página, no dos pestañas. El aviso amarillo también se emite en modo local, sin fila del servidor.

La ruta de caché y el aviso existen en `9fbe6ec`: no son regresión Excel. Manual y Automático comparten esta ruta. Excel agrega reconciliación de cierres al consultar partidas terminadas; la creación nueva no debe depender de esa reconciliación.

## Plan de corrección

Consultar siempre la sala del docente en el servidor, recuperar su identidad/reloj y ofrecer reanudar o reemplazar con confirmación. Crear mediante RPC serializada por docente y petición idempotente; no confiar en códigos de borrador. Mostrar éxito solo con fila e identidad confirmadas; error persistente rojo con reintento. Conservar el diseño docente existente y añadir sala con código/copiar, tiempo y empresas. Validar junto a los campos. Entregar migración repetible y validar localmente.

## Evidencia y verificación

Los detalles de A0, A1 y A2 y las capturas se guardan en `reports/sim/crear_partida/`. Los resultados finales y las consultas de despliegue se incluyen en este informe.

### Reproducción y alcance

A0 levantó HTTP local con HTML, JavaScript y servicio reales; autenticación docente simulada y RPC/REST respaldadas por PostgreSQL PGlite. A2 repitió el navegador con fuentes congeladas de `9fbe6ec`. Ninguna petición llegó a Supabase remoto. Esto prueba el flujo con una sesión autenticada fixture; no prueba credenciales ni la instalación de producción.

| Caso antes del arreglo | Base `9fbe6ec` y HEAD inicial `92ebb13` |
|---|---|
| Primera sala; Manual, espera 2 min, 3 ciclos de 5 min, PE01–PE04 | Se inserta realmente una fila esperando; el aviso amarillo es engañoso pero no prueba fallo de INSERT |
| Nueva sala con una previa esperando | No crea ni consulta; conserva ID/código anterior y vuelve a anunciar sala configurada |
| Nueva sala con una previa en curso | Mismo fallo; anuncia espera aun con runtime decisions |
| Previa cancelada o finalizada | Puede crear nueva si la caché contiene el cierre; caché vieja impide esa ruta |
| Recarga durante espera | Mantiene ID y deadline al existir migraciones; no descubre sala de otro navegador sin caché |
| Migración ausente | Preflight informa error con el mismo toast amarillo, sin reintento persistente |
| SDK ausente y sin configuración | Permite éxito local sin fila del servidor |

`a0_evidencia.json` y `base_9fbe6ec/a2_base_evidencia.json` contienen peticiones, respuestas, estado UI y filas por variante; `a2_vm_resultados.json` prueba cero llamadas con `active:true`/ID nulo. `a2_db_resultados.json` compara Manual/Automático, SQL Excel presente/ausente: configuración y espera exactas en ambos. Las capturas incluyen antes/después y recarga. Son artefactos locales; no se publican las capturas pesadas ni logs.

### Cambio implementado

- `crear_sala_docente` serializa por docente con advisory lock, identifica cada petición con UUID, devuelve conflicto de sala anterior y reemplaza solamente el ID confirmado. Conserva los triggers de validación y reloj, y reintenta colisiones reales del código.
- `obtener_sala_docente` recupera la sala del usuario autenticado y la hora del servidor; no depende de localStorage. Prioriza activas en instalaciones antiguas con varias salas abiertas.
- El panel muestra «Creando sala…», éxito verde solo con identidad/estado/reloj válidos, error rojo persistente y Reintentar. La sala muestra código/copiar, tiempo, empresas y el comportamiento Manual o Automático. Se puede reanudar o reemplazar con confirmación.
- Los campos de espera, ciclos, duración y reglas de eventos muestran errores próximos al control. La configuración enviada se comprueba exactamente en E2E.
- Se eliminó el atajo de éxito por caché y la dependencia de reconciliar cierres Excel para crear otra partida. Una respuesta perdida reutiliza la petición; si esa sala ya terminó, informa el cierre y el siguiente reintento usa otro UUID.
- Revisión independiente A2 corrigió dos éxitos falsos adicionales: reanudar una sala cerrada por otra pestaña y reintentar una petición ya finalizada. Se conservaron RLS, `guardar_puntaje_docente`, mundo/NPC y `js/engine/*`.

### Supabase: diagnóstico, ejecución y comprobación

**No se ejecutó nada en producción.** Ejecuta primero las consultas de solo lectura incluidas abajo. El script también está en `reports/sim/crear_partida/diagnostico_supabase_solo_lectura.sql`.

Resultados esperados: `controlar_partida(uuid,text,jsonb,integer)`, `crear_sala_docente(jsonb,text,text,text,uuid,uuid)` y `obtener_sala_docente()`; columna `partidas.creation_request_id uuid` nullable; índice parcial `ux_side_creation_request(profesor_id,creation_request_id)`; código único/default `side_next_game_code()`; triggers de inicialización e identidad presentes. RLS en partidas activada, políticas por `profesor_id=auth.uid()`, nuevas funciones SECURITY DEFINER con search_path public y EXECUTE para authenticated, sin EXECUTE para anon/PUBLIC. Las consultas muestran todos los nombres reales para compararlos, incluido el índice de activa que depende del script base aplicado.

**Orden para una base que ya tiene la espera v3/identidad v2:** ejecutar únicamente el SQL exacto del fix incluido abajo (también `supabase/migrations/2026-10-11_fix_crear_partida.sql`). Se puede ejecutar dos veces.

**Si faltan prerrequisitos**, aplicar en SQL Editor, uno por uno y en este orden, el contenido completo de los archivos existentes:
1. `supabase/migrations/supabase_migration.sql` si faltan las tablas base. No sustituir una base instalada por `schema.sql`.
2. `supabase/migrations/supabase_game_lifecycle.sql`.
3. `supabase/migrations/supabase_student_admission.sql`.
4. `supabase/migrations/20261009_sala_espera_identidad_exacta.sql`.
5. `supabase/migrations/2026-10-11_fix_crear_partida.sql` (SQL copiable abajo).

No reinstalar lifecycle después de espera sin reaplicar espera: sobrescribe su runtime Manual. El fix comprueba las versiones y esa transición antes de instalar. Si falla ese guard, reaplicar los prerrequisitos en el orden indicado y repetir el fix.

**Excel:** `2026-10-11_logica_excel.sql` no es requisito para crear la sala ni la causa de este fallo. No se puede afirmar que falte en tu Supabase sin sus resultados de diagnóstico. `excel_opcional_instalado=false` indica que aún falta ese script si quieres cierre remoto y reportes Excel; se aplica después de los prerrequisitos existentes. Ya está en el HEAD inicial publicado (`origin/main`), así que los commits de esta corrección no incluyen integración Excel.

Después de aplicar, repetir las consultas: los cuatro indicadores de creación/recuperación/lifecycle/admisión deben ser true; Excel es opcional. Abrir Panel Docente y crear una sala: debe mostrar verde y código real. Recargar y comprobar mismo código/deadline. Crear otra debe ofrecer reanudar/reemplazar; confirmar reemplazo debe cancelar la anterior y devolver un nuevo código.

#### Consultas copiables de solo lectura

```sql
-- Solo lectura. Ejecutar en SQL Editor para comparar instalación con contrato esperado.
-- No invoca RPCs de negocio ni modifica datos.
select n.nspname as esquema,p.proname as funcion,
       pg_get_function_identity_arguments(p.oid) as firma,
       pg_get_function_result(p.oid) as retorno,
       p.prosecdef as security_definer,p.proconfig as opciones,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('crear_sala_docente','obtener_sala_docente','controlar_partida','side_admission_features',
  'side_game_features','side_excel_features','side_sync_game','side_initialize_game','side_next_game_code')
order by p.proname,firma;

select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name in ('partidas','participantes')
  and column_name in ('id','profesor_id','codigo','estado','configuracion','eventos_habilitados',
                      'creation_request_id','last_seen_at')
order by table_name,ordinal_position;

select tab.relname as tabla,con.conname as restriccion,con.contype as tipo,
       pg_get_constraintdef(con.oid) as definicion
from pg_constraint con join pg_class tab on tab.oid=con.conrelid
join pg_namespace ns on ns.oid=tab.relnamespace
where ns.nspname='public' and tab.relname='partidas'
order by con.conname;

select tablename,indexname,indexdef from pg_indexes
where schemaname='public' and tablename='partidas' order by indexname;

select tab.relname as tabla,t.tgname as trigger,t.tgenabled as habilitado,
       pg_get_triggerdef(t.oid) as definicion
from pg_trigger t join pg_class tab on tab.oid=t.tgrelid
join pg_namespace ns on ns.oid=tab.relnamespace
where ns.nspname='public' and tab.relname in ('partidas','side_student_state','reportes_ciclo')
  and not t.tgisinternal order by tabla,trigger;

select tab.relname as tabla,tab.relrowsecurity as rls_activado,
       tab.relforcerowsecurity as rls_forzado
from pg_class tab join pg_namespace ns on ns.oid=tab.relnamespace
where ns.nspname='public' and tab.relname='partidas';
select tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname='public' and tablename='partidas'
order by policyname;

-- Verificación final de firmas exactas (resultado esperado: todos true salvo Excel opcional).
select
 to_regprocedure('public.crear_sala_docente(jsonb,text,text,text,uuid,uuid)') is not null as crear_sala_instalada,
 to_regprocedure('public.obtener_sala_docente()') is not null as recuperar_sala_instalada,
 to_regprocedure('public.controlar_partida(uuid,text,jsonb,integer)') is not null as lifecycle_instalado,
 to_regprocedure('public.side_admission_features()') is not null as admision_instalada,
 to_regprocedure('public.side_excel_features()') is not null as excel_opcional_instalado;

```

#### SQL exacto del fix (último paso del orden anterior)

```sql
-- Ejecutar después de lifecycle, student_admission y 20261009_sala_espera_identidad_exacta.
-- Repetible. No modifica guardar_puntaje_docente ni funciones de Excel.
begin;
do $$ declare features jsonb; probe jsonb; begin
 if to_regprocedure('public.side_sync_game(uuid)') is null
    or to_regprocedure('public.side_admission_features()') is null then
  raise exception 'Primero aplica supabase_game_lifecycle.sql, supabase_student_admission.sql y 20261009_sala_espera_identidad_exacta.sql';
 end if;
 features:=public.side_admission_features();
 if features->>'waitingRoomVersion' is distinct from '3' or features->>'exactIdentityVersion' is distinct from '2' then
  raise exception 'Primero aplica 20261009_sala_espera_identidad_exacta.sql';
 end if;
 -- Detecta reinstalación de lifecycle después de espera, aun con feature probe viejo.
 probe:=public.side_runtime('{"lifecycleVersion":2,"cycleCloseMode":"manual","cycles":3,"roundHours":0,"roundMinutes":5,"gameStartAt":"2000-01-01T00:00:00Z","runtime":{"phase":"integration"}}'::jsonb,'2000-01-01T00:00:01Z'::timestamptz);
 if probe->>'phase' is distinct from 'decisions' then
  raise exception 'Reaplica 20261009_sala_espera_identidad_exacta.sql después de lifecycle; falta inicio manual automático';
 end if;
end $$;
alter table public.partidas add column if not exists creation_request_id uuid;
create unique index if not exists ux_side_creation_request on public.partidas(profesor_id,creation_request_id) where creation_request_id is not null;

create or replace function public.obtener_sala_docente()
returns jsonb language plpgsql security definer set search_path=public as $$
declare owner_id uuid:=auth.uid(); game_id uuid; result jsonb;
begin
 if owner_id is null then return jsonb_build_object('error','Debes iniciar sesión como docente.','code','NO_AUTORIZADO'); end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,731925));
 -- Sincronizar primero evita considerar activa una sala automática ya finalizada.
 for game_id in select id from public.partidas where profesor_id=owner_id and estado in ('esperando','activa') order by (estado='activa') desc,created_at loop
  result:=public.side_sync_game(game_id);
  if result->>'estado' in ('esperando','activa') then return result; end if;
 end loop;
 return null;
end $$;

create or replace function public.crear_sala_docente(
 p_config jsonb,p_nombre text,p_curso text,p_segmento text,p_request_id uuid,p_reemplazar_id uuid default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare owner_id uuid:=auth.uid(); previous jsonb; game public.partidas; attempt integer; failed_constraint text;
begin
 if owner_id is null or not exists(select 1 from public.profesores where id=owner_id) then
  return jsonb_build_object('error','Debes iniciar sesión con un perfil docente válido.','code','NO_AUTORIZADO');
 end if;
 if p_request_id is null or coalesce(trim(p_nombre),'')='' or p_config->>'lifecycleVersion' is distinct from '2' then
  return jsonb_build_object('error','La solicitud de creación es inválida. Revisa la configuración.','code','CONFIG_INVALIDA');
 end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,731925));
 -- Un reintento con respuesta perdida siempre recupera la misma fila.
 select * into game from public.partidas where profesor_id=owner_id and creation_request_id=p_request_id;
 if found then return public.side_sync_game(game.id); end if;
 previous:=public.obtener_sala_docente();
 if previous is not null then
  if p_reemplazar_id is null or (previous->>'id')::uuid<>p_reemplazar_id then
   return jsonb_build_object('error','Ya tienes una sala en espera o en curso. Reanúdala o ciérrala antes de crear otra.','code','SALA_ACTIVA','partida',previous);
  end if;
  -- Solo la sala exacta confirmada; nunca cierra otra sala que apareció entretanto.
  update public.partidas set estado='finalizada',configuracion=configuracion||jsonb_build_object(
   'cancelledAt',clock_timestamp(),'phase','cancelled','runtime',coalesce(configuracion->'runtime','{}')||
   jsonb_build_object('phase','cancelled','status','simulation-finished','running',false,'remaining',0)
  ) where id=p_reemplazar_id and profesor_id=owner_id;
  previous:=public.obtener_sala_docente();
  if previous is not null then
   return jsonb_build_object('error','Hay otra sala anterior pendiente. Reanúdala o ciérrala.','code','SALA_ACTIVA','partida',previous);
  end if;
 elsif p_reemplazar_id is not null and not exists(select 1 from public.partidas where id=p_reemplazar_id and profesor_id=owner_id) then
  return jsonb_build_object('error','La sala anterior no pertenece a tu sesión. Recarga el panel.','code','NO_AUTORIZADO');
 end if;
 for attempt in 1..3 loop
  begin
   insert into public.partidas(profesor_id,nombre,curso,segmento,configuracion,eventos_habilitados,creation_request_id)
   values(owner_id,trim(p_nombre),nullif(trim(p_curso),''),coalesce(nullif(p_segmento,''),'Estandar'),
    p_config-array['cancelledAt','finishedAt','runtime','phase','gameStartAt','gameStartedAt','integrationStartTime','eventSchedule'],
    coalesce(p_config->'enabledEvents','[]'),p_request_id) returning * into game;
   return public.side_sync_game(game.id);
  exception when unique_violation then
   get stacked diagnostics failed_constraint=constraint_name;
   -- Reintenta solamente una colisión de código; otros conflictos se preservan.
   if failed_constraint not in ('partidas_codigo_key','ux_side_codigo_partida') or attempt=3 then raise; end if;
  end;
 end loop;
 return null;
end $$;
revoke all on function public.obtener_sala_docente() from public,anon;
revoke all on function public.crear_sala_docente(jsonb,text,text,text,uuid,uuid) from public,anon;
grant execute on function public.obtener_sala_docente() to authenticated;
grant execute on function public.crear_sala_docente(jsonb,text,text,text,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;

```

## Resultado final de verificación

- 57 unitarias aprobadas, incluidas 11 nuevas del servicio; cero fallos ni omitidas. Las nueve pruebas iniciales nuevas fallaban contra el servicio de 9fbe6ec antes del parche (evidencia local a1_unitarias_antes.txt).
- Siete suites SQL/PGlite aprobadas: crear_partida_db, game_lifecycle_db, waiting_room_db, game_observations_db, student_admission_db, student_admission_matrix_db y teacher_history_db. El fix se aplica dos veces; incluye permisos/roles, rollback del reemplazo inválido, identidad exacta, request perdido y colisiones reales.
- Seis suites Chromium aprobadas en secuencia: crear_partida_ui, game_lifecycle_ui, teacher_lifecycle_ui, waiting_tutorial_ui, teacher_history_ui y teacher_grades_ui. La nueva comprueba primera sala, anteriores en cuatro estados, confirmación/reanudación, errores/reintento, migración ausente, demo SIDE-000, doble clic, dos sesiones concurrentes, request perdido y cancelado, recarga sin caché, participantes/copia, Manual/Automático, comienzo único y móvil sin desbordamiento.
- node --check aprobado en los nueve archivos JavaScript modificados/agregados. git diff --check aprobado.
- Revisión independiente A2 aprobada tras resolver sus dos hallazgos. No hay nuevos fallos pendientes. No se modificaron NPC, mundo 3D ni js/engine; los fallos ajenos conocidos no se incorporaron a esta validación.

El primer lote se detuvo en waiting_tutorial_ui: su reloj instalado seguía avanzando en tiempo real, por lo que 6999 ms más el tiempo entre llamadas podía exceder 7000 ms. El mismo fallo ('2' frente a '1', línea 72) se reprodujo en la copia base 9fbe6ec, cuyo tutorial y test son idénticos a HEAD. Se corrigió exclusivamente la prueba pausando su reloj antes de reiniciar la diapositiva y medir el límite; las aserciones de 6999/7000 ms permanecen intactas. Se reanudó el lote desde esa prueba y solo se ejecutó lo pendiente; las suites aprobadas no se repitieron.

Resultados y logs locales: tests/output/crear_partida_verificacion/resultado.json y archivos .log. Capturas de entrega: reports/sim/crear_partida/antes_manual.png, despues_manual.png, base_9fbe6ec/, after_success_verde.png, after_manual.png, after_recarga.png, after_error_reintento.png, after_mobile.png y after_*_ciclo1.png. La red mock y respuestas completas están en a0_evidencia.json y after_evidencia.json; pageErrors vacío. Capturas/logs pesados permanecen locales e ignorados, sin entrar al push.

Para repetir las pruebas nuevas desde SIDE1:

```powershell
node --test tests/crear_partida_service.test.cjs
node tests/crear_partida_db.cjs
node tests/crear_partida_ui.cjs
```

Para las pruebas de fixture Python, PYTHON_BIN apunta al Python instalado del runtime Codex; Chromium usa C:/Program Files/Google/Chrome/Application/chrome.exe salvo CHROMIUM_PATH explícito. Ningún test necesita Supabase remoto.

## Git y ubicación

HEAD inicial y origin/main tras fetch: 92ebb13; la integración Excel ya estaba publicada. La corrección se entrega en commits separados de servidor/migración, interfaz/E2E y documentación. No se incluyen cambios NPC/modelos, Excel original, .codex-work, capturas ni logs. Se comprobó que el remoto es https://github.com/valenlysm29/SIDE1.git y que el contenedor del proyecto conserva únicamente SIDE1, sin nuevas carpetas o archivos de trabajo externos.

Commits de corrección independientes de Excel: c1f98a2 (servicio y migración) y d70a774 (experiencia docente y E2E). La documentación y el resumen compacto verificacion_final.json acompañan la entrega en un tercer commit. Todos los requisitos de prueba para publicar por fast-forward se cumplieron; el hash final de publicación se entrega en el mensaje de cierre.
