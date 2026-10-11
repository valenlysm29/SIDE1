# A2 — Atribución base 9fbe6ec / HEAD inicial 92ebb13

Fecha: 2026-10-11. Sin conexiones a producción. Reproducciones VM con código exacto extraído por `git show`; PostgreSQL PGlite en memoria. Scripts auxiliares locales en `.codex-work/crear_partida/`.

## Resultado reproducible

1. En ambos commits, inicializar `state.partidaId = null` y `gameStatus() = {active:true}`, ejecutar `startGame()`: cero llamadas a `ensureSupabasePartida`, pero aparece «Sala de espera configurada. El Ciclo 1 inicia al terminar el tiempo.». Evidencia: `a2_vm_resultados.json`, escenarios `cached-active-without-row`. El short-circuit de `prepareGame` en `js/docente.js:361-362` acepta el estado del navegador como prueba de existencia de sala; `startGame` en `js/docente.js:408-415` publica el aviso de éxito. Ambas funciones ya tenían ese comportamiento en 9fbe6ec. Afecta ambos modos porque ocurre antes de consultar `cycleCloseMode`.
2. `services/partida_service.js:56-102`, `crear()`, es idéntico en 9fbe6ec y HEAD inicial. Mock autenticado con versiones requeridas llama `side_admission_features`, `side_game_features`, `controlar_partida` (sondeo), INSERT, `controlar_partida` (sincronizar). No llama a `side_excel_features`. La creación funciona igual aunque la función Excel no exista (`a2_vm_resultados.json`).
3. Las migraciones base, lifecycle, admisión y sala de espera no cambian entre ambos commits (`git diff --exit-code 9fbe6ec HEAD --` los cuatro SQL: salida vacía, exit 0). PGlite con esas migraciones produce una fila real en estado esperando, phase integration y plazo exacto de 120000ms tanto en Manual como Automático, con 3 ciclos de 5 minutos y eventos PE01–PE04. Repetido con la migración Excel aplicada: mismo resultado. Evidencia: `a2_db_resultados.json`.

## Relación con integración Excel

El falso éxito de una sala guardada solo en localStorage es anterior a Excel. `2026-10-11_logica_excel.sql` añade triggers sobre `side_student_state` y `reportes_ciclo`, ninguno sobre `partidas`; su ausencia no bloquea la primera creación.

HEAD añade un riesgo distinto al crear después de una finalizada: `prepareGame` exige `refreshTeacherGame()` antes de liberar el id previo (`js/docente.js:364`), y esa sincronización intenta cierres Excel pendientes (`js/docente.js:346`). Un error de conexión/cierre puede impedir esa ruta. Esto no explica el toast amarillo sin creación con `active:true`, que se reprodujo ya en base. No se debe eliminar la recuperación financiera para corregir la sala: la UX debe mostrar el fallo y ofrecer reanudar/cerrar según estado confirmado del servidor.

## Límites

Los mocks prueban la atribución del flujo y PGlite comprueba la persistencia local. No se inspeccionó el Supabase del usuario; no puede afirmarse qué migraciones están aplicadas allí. La captura original no fue adjuntada al chat.

## Comparación real en Chromium (base / HEAD inicial)

Se ejecutó el mismo arnés HTTP local y PGlite de A0, congelando HTML/JS/CSS a `9fbe6ec` mediante `git show`, con Chromium y todos los destinos externos bloqueados. El navegador A0 se cerró antes de iniciar A2. Login docente simulado en `auth.getUser`, sin credenciales reales. Capturas y red completa: `base_9fbe6ec/a2_base_evidencia.json` y PNGs de esa carpeta; referencia HEAD: `a0_evidencia.json` y PNGs de A0.

Las 13 variantes tuvieron idéntico estado, número de filas y texto del aviso entre ambos commits:

| Variante | Resultado en ambos commits |
| --- | --- |
| Primera sala Manual | 1 fila real, esperando, integration, aviso amarillo |
| Nueva con anterior en espera | Reutiliza mismo id, sigue 1 fila, aviso amarillo |
| Nueva con anterior en curso | Reutiliza mismo id, sigue decisions, aviso dice sala de espera |
| Recarga durante espera | Recupera mismo id y reloj, sigue 1 fila |
| Nueva después de cancelar | Nuevo id, 2 filas acumuladas |
| Nueva después de finalizar | Nuevo id, 3 filas acumuladas |
| Primera sala Automático | Nueva fila, integration, mismo aviso amarillo |
| SDK no disponible | Cero nuevas filas y aviso de recarga |
| Migración admisión ausente | Cero nuevas filas, aviso de migración pendiente |

Así, la imposibilidad de crear otra sala activa y el aviso engañoso son anteriores a Excel. La primera creación con migraciones completas sí se guarda en base de datos; no se puede inferir un fallo de inserción en producción a partir del aviso original.
