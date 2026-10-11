# A1 — diagnóstico servidor, antes del parche

Inspección de HEAD, sin acceso a Supabase de producción.

## Hallazgos verificables

1. `js/docente.js:361`: `prepareGame()` devuelve `true` solamente porque `SIDE_GAME_STATUS.active` es verdadero en localStorage. No comprueba ID, existencia ni dueño contra servidor. `startGame():414` anuncia entonces «Sala de espera configurada…». Reproducción determinista: ejecutar la función con `gameStatus() => ({active:true})` y un servicio que cuenta sus llamadas: resultado `true`, cero llamadas. También funciona con `state.partidaId=null`; no hay sala creada. Manual y Automático comparten la rama. `refreshStartButton():464–469` bloquea el botón por el mismo dato local. El aviso no prueba creación.
2. `js/docente.js:277–280`: si hay cualquier ID local, se sincroniza y reutiliza, aun finalizada, sin verificar estado antes de declarar preparación exitosa. `prepareGame():364` solo libera ID si el local tiene `finishedAt`. Limpieza al iniciar `:969–976` es asíncrona y deja `SIDE_GAME_STATUS.active` al confirmar ID inexistente.
3. `services/partida_service.js:96–104`: INSERT REST y sincronización son operaciones separadas. Si se pierde la respuesta, se puede dejar una sala esperando; no hay request ID persistente. `schema.sql:289`: índice `ux_side_una_partida_activa_por_profesor` cubre solo `estado='activa'` (no existe en `supabase_migration.sql`; el comportamiento depende del script base aplicado). Dos salas esperando del mismo docente se insertan; cuando ambas se sincronizan después del plazo, la segunda puede fallar por índice único. Una pestaña nueva no busca la sala remota existente.
4. `js/docente.js:10` y `css/docente.css:37`: todos los toast comparten amarillo, incluido éxito y error. El aviso final reemplaza «Partida creada en Supabase» de `:304`.

## Contratos existentes

| Uso cliente | Definición del repositorio | Firma/condición |
|---|---|---|
| `side_admission_features` | `20261009_sala_espera_identidad_exacta.sql:316` | sin args; waitingRoomVersion=3, exactIdentityVersion=2 |
| `side_game_features` | `supabase_game_lifecycle.sql:5`, game_codes | sin args; observationsVersion=1, gameCodeVersion=2 |
| `controlar_partida` | lifecycle y espera `:255` | `(p_partida_id uuid,p_accion text,p_config jsonb default null,p_expected_round integer default null)`; auth.uid dueño; FOR UPDATE |
| `buscar_partida_por_codigo` | schema / lifecycle | `(p_codigo text)` |
| `avanzar_ciclo` | migration / lifecycle | `(p_partida_id uuid)` |
| INSERT partidas | schema / migration | profesor_id, nombre, curso, segmento, configuracion, eventos_habilitados; código default `side_next_game_code()` |
| listar participantes | migration / lifecycle / admission | empresa_id, puntaje_docente, last_seen_at; FK empresas; campos legacy tienen fallback |
| obtener partidas | tabla | SELECT propio bajo RLS |
| cierre Excel | `2026-10-11_logica_excel.sql:14,34` | contexto(uuid,integer), guardar(uuid,integer,text,jsonb); independientes de INSERT partidas |

RLS base permite SELECT/INSERT/UPDATE/DELETE solo `profesor_id=auth.uid()`. FK profesor exige perfil existente. Código UNIQUE; generador lifecycle toma advisory lock global, excluye códigos históricos, nunca envía SIDE-000 desde `crear`. Trigger `side_initialize_game` valida eventos contra catálogo, 1–20 ciclos, duración mínima minuto, espera 1–60 y modo; inicializa fecha/espera. Trigger admission `side_marcar_inicio_partida` conserva started_at. `side_sync_game` bloquea fila y fija transición al deadline; espera del 09/10 agrega transición también en Manual. Repetir consultas no reinicia el reloj.

## Riesgos exclusivos de instalación remota

No se afirma cuál migración tiene aplicada producción. Sin lifecycle, admission o espera, preflight devuelve error específico; falta de columnas puede fallar en REST. La consulta de readiness con ID null solo revisa error de transporte; el error JSON de permisos es deliberadamente ignorado. Un servidor con firma diferente causa PGRST202. Instalar espera ANTES de lifecycle/admission falla por guard; reinstalar lifecycle DESPUÉS de espera restaura runtime viejo y quita inicio Manual automático, aunque feature probe siga diciendo v3. Orden correcto: base → lifecycle → admission → espera → fix.

Excel no cambia funciones ni triggers de partidas. Sus triggers son `side_student_state` y `reportes_ciclo`, por tanto no bloquean crear/iniciar sala inicial. Falta Excel puede afectar cierre/recuperación de salas antiguas en results, por llamadas `refreshTeacherGame:346` → `closeExcelRemoteRound:795–800`, pero no explica un amarillo sin RPC de creación. La atribución base/HEAD la documenta A2.

## Plan

Verificar existencia remota antes de éxito/reanudar; recuperación por dueño aunque no exista caché; creación RPC atómica serializada por docente con request UUID, conflicto reanudable o reemplazo confirmado; mensajes éxito/error distintos, campos validados visibles; conservar reloj de servidor y transiciones existentes. Entregar diagnóstico SQL solo lectura y fix idempotente, sin ejecutar producción.

## Evidencia ejecutada y corrección servidor

`a1_reproduccion.txt`: VM con fuente HEAD anterior al parche devolvió preparación exitosa con ID nulo, cero llamadas servidor y cero sala creada. `a1_unitarias_antes.txt`: las nuevas nueve pruebas del servicio ejecutadas contra fuente base `9fbe6ec` fallan 9/9, exit 1. Contra servicio corregido pasan 9/9.

`tests/crear_partida_db.cjs` pasa con migración aplicada dos veces: request idempotente tras respuesta perdida; conflicto esperando/en curso; cancelada/finalizada permiten nueva; reemplazo solo ID exacto; recarga; inicio Manual y Automático una vez; colisión real de código con reintento y colisión permanente rechazadas; instalación con índice activo estricto; legacy con activa y espera vencida; privilegios authenticated/anon y aislamiento por dueño. La migración valida versiones exactas de espera y prueba el runtime Manual antes de instalar, evitando un lifecycle reinstalado fuera de orden. El trigger existente valida números/eventos; creación descarta runtime y cancelación enviados por navegador.
