# Sincronización: diagnóstico dirigido — 2026-10-13

## Alcance y dictamen

Se continuó desde `reports/estado_continuacion_2026-10-11.md` sobre el estado real encontrado: HEAD y origin/main `914b3ad4cc70542a694aaaebcbee77dad903ebea`, remoto `valenlysm29/SIDE1`, árbol inicialmente limpio. No se retrocedió a los commits antiguos del informe.

**La verificación dirigida pasa, pero no se reprodujo el timeout histórico ni se identificó su causa inicial. No se declara corregido ese timeout.** Se corrigió una deficiencia comprobable de limpieza del arnés y se añadió ejecución selectiva y diagnóstico reproducible. No se modificó código de producción por una hipótesis sin evidencia.

## Qué falló realmente

`reports/sim/final-continuacion-3/node-todos.log`, líneas 398–414, registra el subtest `online retries failed writes before reading and does not erase the local draft`, 138291.7916 ms. La excepción fue `locator.check: Timeout 30000ms exceeded`, en `draft()`, línea 55 original. El selector CANALES/web resolvió un checkbox; la última etapa registrada fue esperar visibilidad, habilitación y estabilidad.

Esto sucedió **antes** de guardar el borrador fallido y disparar `online`: el log no demuestra que se bloqueara la cola de sincronización. Tampoco distingue falta de frames, cambio de geometría, ocultamiento o saturación del navegador. La duración del subtest incluye su preparación y no equivale a la duración exacta de `check`. El fallo de la suite padre contabiliza el mismo incidente, no otra causa.

## Reproducción exclusiva

Se ejecutaron secuencialmente un solo Chrome de prueba a la vez, headless, ejecutable `C:/Program Files/Google/Chrome/Application/chrome.exe`, versión `156.0.8078.12`. No se lanzaron otras suites de navegador ni se cerraron los procesos Chrome preexistentes del usuario. “Exclusivo” se refiere a las ejecuciones de prueba de esta tarea, no a la ausencia de otras aplicaciones del equipo.

1. Suite UI original sin cambios: **10/10 PASS**, caso online **2290.3023 ms**. Log `reports/sim/student_sync_2026-10-13_initial.log`.
2. Diez ejecuciones instrumentadas del primer caso de guardado y del caso online originales, en ese orden: **10/10 parejas PASS**. Caso online **2773.76–3127.24 ms**. Evidencia en `reports/sim/student-sync-2026-10-13/summary.json`, `metrics.json` y diez logs de menos de 4 KB cada uno.
3. Tras corregir limpieza del arnés: `node tests/verificacion_excel_final.cjs --only=student-sync`: **20/20 PASS**, cero cancelados o saltados; caso online **3111.7782 ms**, proceso 43886 ms. Incluye `student_sync.test.js` y la suite UI. Sintaxis de los tres scripts del alcance sin errores. Resultado en `reports/sim/final-student-sync-2026-10-13/summary.json` y `student-sync.log`.

La instrumentación conserva los dos cuerpos originales y sus assertions. Añade observación de frames, rectángulos y long tasks; no fuerza clicks, no modifica CSS, Pointer Lock, reloj ni timeouts. En las muestras guardadas, el checkbox está habilitado, el documento y menú visibles, acceso permitido y rectángulo constante `(89, 654.25, 19, 19)`. Las muestras terminan al concluir `check`; no describen un fallo que no ocurrió.

El fixture HTML inyectado mide **48947542 bytes** (aproximadamente 49 MB decimales). Esa carga merece atención si vuelve a fallar, pero estas ejecuciones no demuestran que causara el timeout. No se reemplazaron recursos ni se redujo fidelidad visual para obtener un PASS.

## Cambios

- `tests/student_sync_ui.test.js`: `t.afterEach` cierra todos los contextos restantes. Antes, cada contexto se cerraba sólo al llegar al final exitoso de su subtest; una excepción en `draft()` dejaba esa página activa hasta el `finally` de toda la suite. La limpieza evita acumulación y contaminación de casos posteriores, **no explica ni acredita corregir el primer timeout**.
- `tests/verificacion_excel_final.cjs`: `--only=student-sync` ejecuta únicamente las dos suites de sincronización y sintaxis pertinente, con salida separada de `final-continuacion-3`. La ejecución completa conserva su comportamiento.
- `tests/diagnostico_student_sync.cjs`: arnés selectivo de las dos primeras pruebas, observación de geometría/frames/acceso y logs por ejecución; futuras muestras usan directorios nuevos bajo `reports/sim/student-sync-*`. Reproducir con `node tests/diagnostico_student_sync.cjs --runs=10`. Para no alterar las condiciones, ejecutarlo sin otras pruebas Chrome simultáneas.

## Límites y continuación

La causa inicial queda **pendiente de reproducción**. El siguiente fallo necesita la observación de frames, geometría y estado que ahora aporta el arnés; el log histórico solo no permite elegir responsable entre aplicación y navegador. Diez éxitos exclusivos no demuestran preexistencia, ausencia de intermitencia ni una corrección causal. No se amplió el timeout ni se silenció el error.

No se repitieron las mediciones 3D/NPC, los oráculos, SIM-1/2/3, SQL ni la batería integral previamente aprobada. Los resultados antiguos permanecen intactos y el pendiente NPC del informe anterior permanece fuera de este alcance. No hubo commit, push ni SQL remoto. El contenedor del proyecto sigue teniendo únicamente `SIDE1`; todos los artefactos de esta tarea están dentro del repositorio.
