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
