# Bloque B: presencia, pausa y eliminación — 2026-10-21

Skill aplicada: `.agents/skills/webapp-testing/SKILL.md` (Playwright Python nativo). Investigación inicial sin modificaciones hasta confirmación del bloque de ingresos: el coordinador confirmó tres ciclos con ingresos y oráculo 3104/3104 antes de autorizar este bloque. No se ejecutaron escrituras en Supabase real.

| Observación | Diagnóstico | Decisión y justificación | Archivos tocados | Verificación | Pendientes |
|---|---|---|---|---|---|
| 2. Conectado | Presencia remota ya usa heartbeat `last_seen_at`, con umbral 120 s más 15 s de inactividad sostenida; evita parpadeos, preserva máxima marca ante respuestas atrasadas. El modo local usaba un booleano sin vencimiento. El estudiante afirmaba conexión confirmada sin fecha de última respuesta. | Conservar tolerancia remota existente (una pestaña cerrada deja de figurar conectada al vencer TTL; no se puede detectar instantáneamente una desconexión física). Aplicar el mismo tracker al modo local; publicar lastSeenAt por actividad y señalar desconexión local al pagehide. El tick docente repinta Empresas aun mientras el poll espera. El estudiante pasa a “sin confirmar” después de 15 s sin respuesta válida y muestra error de red/poll. | `js/docente.js`, `js/app.js`, ajuste espera DOM de `tests/teacher_presence_ui.py` | Node tracker: jitter, snapshots viejos, pérdida temporal, caducidad y recuperación. Navegador: TTL local, confirmación estudiante vencida, desconexión. | Comprobación con dos navegadores/cuentas reales después de aplicar SQL de despliegue, sin ejecutarlo en esta tarea. |
| 6. Pausa | Bug confirmado: `gameAccess` devolvía canOperate=true con runtime.status=paused y phase=decisions. El reloj ya respetaba remaining, pero no explicaba pausa; faltaban overlay y aviso de reanudación. Las RPC de escritura solo validaban phase. | Congelar reloj y persistencia/envío; permitir revisar y preparar en memoria. Es coherente con una pausa docente: nadie consolida cambios durante ella. Overlay “Ciclo en pausa” permite abrir revisión; banner permanece; reanudar avisa. Para revertir política, retirar rama paused de gameAccess y guard canSave del editor; hacerlo también en servidor y textos para mantener coherencia. | `js/side_rules.js`, `js/app.js`, `css/design-system.css`, migración nueva `supabase/migrations/2026-10-21_pausa_escrituras_estudiante.sql`; guard canSave del editor realizado por bloque C | Node prueba las tres variantes de ciclo, prioridad cancelación, revisión y bloqueo. PGlite ejecuta SQL real dos veces y comprueba tres RPC bloqueadas, identidad exacta, lectura/heartbeat activo, snapshot/CAS intacto y guardado tras reanudar. Browser prueba overlay, 137 s congelados, revisión, guardar/enviar rechazados y aviso reanudar. | Ejecutar SQL indicado abajo en Supabase por el usuario. |
| 7. Empresa eliminada | Existía expulsión docente persistente y bloqueo de sesión/cola. Faltaba resumen; texto siempre atribuía inactividad incluso regla legacy. Mapeo remoto docente no consideraba flag de eliminación del motor. | Conservar criterio existente: docente elimina/reactiva por inactividad; modelo Excel anterior elimina al no recibir primer envío. Modelo actual autoenvía borrador/defaults; caja negativa no es causa automática de eliminación. No inventar umbral de quiebra que alteraría Excel. Mostrar resumen del último estado local conocido (caja, ingresos y utilidad), con aviso si no hay cierre. Detectar flag de historial y distinguir motivo. | `js/app.js`, `js/docente.js` | `company_expulsion_ui.py` desktop/móvil: rechazo remoto no falsifica éxito, confirmación docente, listado activo/eliminado, sesión y outbox bloqueadas, reingreso rechazado, no desborde. Nuevo runner comprueba resumen y motivo legacy. SQL de expulsión y pruebas existentes conservados. | La expulsión docente necesita migración preexistente `2026-10-21_expulsion_empresa.sql` si no fue aplicada. |

## Orden SQL para ejecutar por el usuario

1. Tener aplicada `2026-10-20_correcciones_docente_estudiante.sql` y sus prerrequisitos documentados.
2. Ejecutar `supabase/migrations/2026-10-21_expulsion_empresa.sql` (existente; si ya fue aplicada, es repetible).
3. Ejecutar `supabase/migrations/2026-10-21_pausa_escrituras_estudiante.sql` (nueva, transaccional y repetible).

La nueva migración envuelve las tres RPC de escritura con CAS existentes y conserva sus argumentos/revisiones, permisos e identidad exacta. No toca lectura, heartbeat, cierre contable ni fórmulas. PGlite valida el SQL completo en una base aislada. No sustituye una validación de RLS/Realtime del proyecto remoto.

## Evidencia y comandos

- `node --test tests/student_pause.test.cjs tests/side_rules.test.js tests/company_expulsion.test.cjs tests/teacher_presence_regression.test.js`: 25/25.
- Prueba basal antes de cambios `node --test tests/teacher_presence_regression.test.js tests/company_expulsion.test.cjs tests/side_rules.test.js`: 21/21.
- `node tests/company_expulsion_db.cjs`: PASS (expulsión persistente, permisos y conservación).
- `node tests/student_pause_db.cjs`: PASS (PGlite, SQL repetible y comportamiento completo).
- Python runtime incluido, `PYTHONPATH=tests/.python-deps`, `PYTHONDONTWRITEBYTECODE=1`: `tests/company_expulsion_ui.py` completo PASS; conserva capturas en `tests/output/company-expulsion/`.
- Nuevas pruebas UI: `tests/student_state_20261021_browser.py`: 10 comprobaciones PASS (incluye presencia local), capturas y resultados en `tests/output/student-state-20261021/`.
- Regresión de presencia remota: `tests/teacher_presence_ui.py`: PASS desktop/móvil con dos empresas, jitter, snapshots atrasados, expiración y recuperación, evidencia en `tests/output/teacher-presence/`.

Inspección visual realizada: overlay de pausa desktop y resumen de eliminación a 390 px, sin desborde ni texto oculto.

Estado de continuación: cambios implementados; revisión final, oráculo completo, SIM-1/2/3, commits y push coordinados por agente principal. Sin cambios en avatares ni fórmulas motor/Excel por este bloque.
