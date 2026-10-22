# Bloque D: configuración y apertura de la partida

Fecha: 21 de octubre de 2026 (America/Lima).

| Observación | Diagnóstico | Decisión y justificación | Archivos | Verificación | Pendientes |
| --- | --- | --- | --- | --- | --- |
| 9. Guardar configuración inicia la partida | Bug de flujo: el manejador original de `saveAll` llamaba `prepareGame()` si no había partida activa. Esa llamada crea una sala y fija la cuenta regresiva autoritativa; el Ciclo 1 comienza al vencer esa espera. Por eso guardar iniciaba indirectamente la partida. Al comenzar este bloque ya existía la corrección local del manejador. Quedaba un texto que prometía abrir el ingreso al guardar. | Guardar valida y conserva un borrador local; **Iniciar partida** ejecuta la creación de sala en Supabase y abre la espera. Ambos modos conservan el comienzo automático del Ciclo 1 tras la espera; el modo manual controla después pausas, cierres y avances, y el automático conserva su programación. Es coherente porque permite preparar y revisar sin arrancar la cuenta regresiva mientras el docente todavía configura. Se corrigieron el banner y el mensaje de guardado para explicar el siguiente paso. | `js/docente.js`, `tests/game_lifecycle_ui.cjs` | Runner Chromium con el HTML y JS actuales y PostgreSQL PGlite local: guardar válido persiste el borrador, no crea fila ni sala/runtime, mantiene Iniciar habilitado; guardar inválido conserva el borrador anterior y no crea filas. Se prueba en manual y automático y luego se continúa con creación, espera e inicio mediante los RPC existentes. Además, 5 pruebas Node de recuperación/cierre docente pasan. | Ninguno propio del bloque; la integración y el push corresponden al agente principal. |

## Alternativa y reversión

También sería válido abrir una sala sin cuenta regresiva al guardar, pero exigiría introducir otro estado de vida y controles adicionales en servidor y admisión. Se eligió el borrador local para conservar el contrato actual de sala de espera y el inicio automático. Para revertir esta elección habría que restaurar el manejador `saveAll` previo que invocaba `prepareGame()` y los dos textos modificados; eso volvería a arrancar la espera al guardar y reintroduciría la observación.

## SQL

No se necesita SQL nuevo por la observación 9. No se ejecutó nada contra Supabase remoto. El runner ejecuta únicamente migraciones existentes sobre una base PGlite efímera local. La sala sigue usando los RPC y las migraciones de vida de partida ya existentes en el repositorio.

## Skills y alcance

Disponible y consultada: `.agents/skills/webapp-testing/SKILL.md`. Se amplió el runner Playwright Node existente para reutilizar su fixture DOM y PostgreSQL local, evitando duplicar la preparación de servidor y sesiones. No se modificó el motor, el menú de decisiones ni los avatares.

## Evidencia de ejecución

- `node --test tests/docente_excel_reintento.test.cjs tests/docente_excel_recuperacion.test.cjs`: 5/5 correctas.
- `node tests/game_lifecycle_ui.cjs`: correcto, código de salida 0. Guardado válido/inválido PASS en ambos modos; espera→inicio manual y automático PASS; ingreso, recuperación, reloj del servidor, cancelación/reintento, presencia y captura móvil del runner PASS; ningún error JavaScript del navegador. Capturas bajo `tests/output/short_code/lifecycle/`.
