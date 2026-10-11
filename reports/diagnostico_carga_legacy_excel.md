# Diagnóstico dirigido de entrada legacy — 2026-10-11

No se modificó código de producción ni 3D. Se comparó el flujo con baseline `9fbe6ec012db7e1440459551f62b40992df261d6` y se ejecutó una vez cada prueba afectada con consola de navegador añadida en copias locales.

## Evidencia

- `commitReviewedSections` completó con `true` en ambas pruebas. El cuerpo legacy conserva baseline; el único guard nuevo requiere `decisionState.__excel.habilitado`.
- `startSimulationLoading` conserva la preparación, loadDecisionState, validación de identidad/acceso y enter del baseline. La nueva salida previa se limita a Excel habilitado.
- `continuous_world`: antes de entrar, Excel `undefined`, `canExplore=true`, `simulationLoadingActive=false`, `canOperate=true`. La entrada devolvió `true`, `running=true`, `lastError=''`. El nuevo ciclo también devolvió `true`. Pasaron escenarios 1–9, incluyendo conservación de escena/listeners/RAF y caja. La comprobación final falló porque el navegador emitió `A user gesture is required to request Pointer Lock.`. No se reprodujo el retorno `false` original de línea 68.
- `world_cycle_restart`: después de confirmar Miguel, Excel `undefined`, `canExplore=true`, `simulationLoadingActive=true`, `canOperate=true`. La preparación todavía mostraba `initialized=false`, `renderedFrames=0`, `lastError=''` en la observación inmediatamente anterior a la espera. Volvió a expirar la espera de 30 segundos del test. La instrumentación no captura estado posterior al timeout, por lo que no permite afirmar si la preparación terminó después o qué recurso demoró.

## Alcance de la conclusión

Los guard de Excel no bloquearon estas ejecuciones legacy. No se identificó una modificación de integración que explique el fallo de carga original; no corresponde atribuirlo definitivamente a carga transitoria ni cambiar 3D sin más evidencia. Queda abierto el timeout de reinicio y el error Pointer Lock observado en la ejecución dirigida.

Logs: `reports/sim/final-continuacion-2/continuous_diagnostic.log`, `reports/sim/final-continuacion-2/world_cycle_restart_diagnostic_runner.log` y `world_cycle_restart_diagnostic.cjs.log`. Copias instrumentadas y runner en `.codex-work/`; no se añadieron pruebas permanentes.

## Continuación 3 — medición controlada (en curso)

Se congelaron baseline `9fbe6ec012db7e1440459551f62b40992df261d6` y HEAD `459c062d87dc6615e9a0cb8a5111624572608286` en copias aisladas dentro de `.codex-work/`. Se verificaron 744 y 785 blobs respectivamente con SHA-1 Git, incluyendo assets/vendor; los archivos ajenos sin commit quedan fuera. La instrumentación solo añade métricas al arnés copiado y captura estado tras timeout. No se cambia el juego, no se concede Pointer Lock ni se modifica el timeout.

Condiciones idénticas: Chrome instalado, Playwright del proyecto, headless, `--enable-webgl --use-angle=swiftshader --enable-unsafe-swiftshader`, servidores locales efímeros sin caché. Una suite a la vez; alternancia baseline/HEAD por pareja para repartir la deriva de carga/caché del sistema. Cada ejecución abre y cierra su propio navegador.

Plan: cinco parejas por suite (20 ejecuciones). Datos vivos: `reports/sim/carga-legacy-cont3/summary.json`; los logs incluyen `WAIT_START`, `WAIT_END`, diagnósticos y errores de página. Los intentos con sintaxis inválida del arnés ocurrieron antes de lanzar Chrome y se excluyen del muestreo (`intento-arnes-invalido.json`).


### Resultado final de las 20 ejecuciones

| Suite | Versión | Pasa / total | Mediana preparación inicial | Mediana primera espera | Mediana suite completa |
|---|---|---:|---:|---:|---:|
| continuous_world.cjs | baseline | 5/5 | No registrada | 6.130 s | 57.674 s |
| continuous_world.cjs | head | 5/5 | No registrada | 5.354 s | 64.585 s |
| world_cycle_restart.cjs | baseline | 5/5 | 3.219 s | 2.993 s | 58.122 s |
| world_cycle_restart.cjs | head | 5/5 | 3.406 s | 3.061 s | 55.737 s |

| Suite | Corrida | Baseline | HEAD | Preparación baseline / HEAD |
|---|---:|---|---|---|
| continuous_world.cjs | 1 | PASS | PASS | Primera espera: 9.637 / 9.862 s |
| continuous_world.cjs | 2 | PASS | PASS | Primera espera: 6.130 / 6.082 s |
| continuous_world.cjs | 3 | PASS | PASS | Primera espera: 6.460 / 4.586 s |
| continuous_world.cjs | 4 | PASS | PASS | Primera espera: 5.604 / 5.354 s |
| continuous_world.cjs | 5 | PASS | PASS | Primera espera: 5.747 / 4.333 s |
| world_cycle_restart.cjs | 1 | PASS | PASS | 3.486 / 3.526 s |
| world_cycle_restart.cjs | 2 | PASS | PASS | 3.526 / 3.508 s |
| world_cycle_restart.cjs | 3 | PASS | PASS | 3.219 / 3.406 s |
| world_cycle_restart.cjs | 4 | PASS | PASS | 3.187 / 2.762 s |
| world_cycle_restart.cjs | 5 | PASS | PASS | 2.752 / 2.725 s |

Los dos bloqueos quedan resueltos por estabilidad de HEAD (5/5 en cada suite; criterio exigido ≥4/5), con baseline también 5/5. No se reprodujo Pointer Lock y no se concedió ni simuló su permiso. No se cambió ningún timeout, NPC ni código del mundo. La mediana de preparación de reinicio cambia 5.79%; este muestreo no muestra una regresión de preparación. No demuestra la causa de los fallos anteriores: sí demuestra que ambos flujos completos pasan de forma estable en las condiciones comunes documentadas.

Evidencia publicable ligera: `reports/sim/carga-legacy-cont3/summary_compacto.json`, arneses reproducibles `tests/diagnostico_carga_legacy_excel.cjs` y `tests/diagnostico_carga_resumir.cjs`. Diagnósticos completos, logs y manifiestos de blobs se conservan localmente; sus SHA-256 quedan en el resumen. Skill aplicada: `.agents/skills/webapp-testing/SKILL.md`, reutilizando los runners Playwright existentes pedidos por el usuario.
