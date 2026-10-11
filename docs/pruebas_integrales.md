# Pruebas integrales de SIDE

Ejecutar desde la raíz `SIDE1`. El runner usa un servidor HTTP efímero, PostgreSQL/PGlite local y fixtures aisladas; no requiere cuentas ni escribe en Supabase remoto. Chromium usa SwiftShader para las pruebas 3D.

```powershell
node tests/run_integral.cjs --help
node tests/run_integral.cjs --phase=phase2 --list
node tests/run_integral.cjs --phase=phase2
node tests/run_integral.cjs --phase=final
```

Cada suite termina antes de iniciar la siguiente. La suite Node usa `--test-concurrency=1`: los tests que contienen fixtures de navegador también quedan serializados. Mantener un único turno de Chromium para todo el equipo.

## Qué ejecuta

1. Servidor Python: `tests/local_server_test.py`, dos comprobaciones.
2. Todos los archivos `tests/*.test.js`, `tests/*.test.mjs` y `tests/world_finance.test.cjs`, enumerados como argumentos concretos para Windows.
3. Seis runners DB: opciones de decisiones, admisión, matriz de admisión, historial docente, ciclo de partida y observaciones.
4. Los 22 runners de navegador de la línea base, incluyendo historial, PDF docente, selector de avatar, interiores y navmesh.
5. Tablet por ítem (`tablet_item_draft_ui.cjs`), revisión móvil (`mobile_integral_ui.cjs`) y recorrido integral (`side_full_flow.cjs`) cuando existan. Si alguno todavía no existe, se registra `skipped`, nunca como aprobado.
6. Benchmark de FPS Baja/Media/Alta. `--no-fps` permite reservar esta medición para el cierre; no cuenta como benchmark aprobado.

El recorrido integral está pendiente de implementación y autorización de Fase 3. El contrato de ingreso actual exige confirmar las decisiones iniciales antes de entrar al mundo mediante su botón. Las pruebas respetarán esa condición y verificarán la Tablet abierta desde el mundo, sus bloqueos y el siguiente ciclo.

## Evidencia y preservación

La línea base aprobada permanece en `tests/output/mejora-integral-2026-10-01/before/`; el runner rechaza sobrescribirla. El destino predeterminado actual es `final`, y `--phase=phase2`, `phase3` o `final` separa las ejecuciones.

Cada ejecución guarda logs, capturas y JSON en `<fase>/runs/<fecha-UTC>/`. `<fase>/summary.json` referencia la última ejecución; el resumen histórico permanece dentro de su carpeta `runs`. Los resultados registran suite, tipo, estado, código de salida, timeout y duración. Las ejecuciones parciales identifican su selección y no equivalen a una suite completa.

Antes de ejecutar, se respaldan los outputs previos en `.codex-work/mejora-side-2026-10-01/backups/`. Después se archiva la evidencia recién generada y se restauran los archivos previos de `tests/output/` y `output/pdf/`, conservando su contenido y tiempos. La carpeta de evidencia de esta mejora se excluye del respaldo porque los runners existentes no la sobrescriben. Los temporales de los hijos quedan en `.codex-work/mejora-side-2026-10-01/tmp/` mediante `TEMP`, `TMP` y `TMPDIR`.

## Límites y ejecuciones dirigidas

Timeout máximo: servidor 60 s, Node 600 s, DB 180 s y cada navegador/benchmark 480 s. En Windows se detiene únicamente el árbol del proceso hijo que agotó su límite. El runner continúa para informar el resto de suites y restaura los originales en su cierre normal o por excepción.

```powershell
node tests/run_integral.cjs --phase=phase2 --only=tablet_item_draft_ui.cjs,mobile_integral_ui.cjs --no-fps
node tests/run_integral.cjs --phase=final --only=npc_fps_benchmark.cjs
```

`--extra=nombre.cjs` añade un runner existente de `tests/`. Un fallo de suite produce salida 1. Un runner opcional ausente queda registrado por separado. No ejecutar estos comandos mientras otro subagente tenga un navegador abierto para QA.

## Línea base

Paso 0: 291/291 pruebas Node, seis runners DB y 22 de navegador aprobados; servidor Python 2/2. FPS SwiftShader a 1280×800, semilla 4107: Baja 2, Media 1 y Alta 1. Estos FPS miden rasterización por software; la validación de GPU física queda para la revisión visual del usuario.

La línea base original usó Node con la concurrencia predeterminada, antes de explicitar `--test-concurrency=1`; no hubo navegadores 3D paralelos. Los límites originales fueron 240 s, ampliados posteriormente a 480 s sin repetir suites válidas.
