# Atribución de regresiones — integración Excel SIDE

Baseline exacto: **`9fbe6ec012db7e1440459551f62b40992df261d6`**, HEAD del usuario antes de esta tarea. No se modificó ese commit, ni se hizo stash, reset o limpieza destructiva del directorio de trabajo.

La comparación se ejecuta contra `.codex-work/atribucion-9fbe6ec/`, dentro de SIDE1. Se extrajeron 224 archivos tracked de código, hojas de estilo, HTML, tests, iconos y manifiesto desde los blobs del commit. `BASELINE.json` registra el commit y lista completa. No se copiaron los archivos actuales como sustituto de la línea base.

`git archive` completo y selectivo falló con `fatal: mmap failed: Invalid argument`. La alternativa reproducible usa Git del runtime y opciones por comando `core.packedGitWindowSize=1m`, `core.packedGitLimit=1m`, sin cambiar configuración persistente. Los scripts son `tests/atribucion_extraer.cjs` y `tests/atribucion_regresion.cjs`.

Las pruebas usan las dependencias existentes de `SIDE1/tests/node_modules` mediante `NODE_PATH`, el mismo Node, Python del runtime y Chrome instalado. Las pruebas de interfaz cargan el HTML y scripts de cada versión usando su propio `browser_fixture.py`, bloquean red y no llaman Supabase. No se reemplazaron assertions para obtener resultados verdes.

## Comparación antes/actual

| Suite y fallo | Antes, commit del usuario | Actual | Atribución |
|---|---|---|---|
| `decision_roster.test.mjs`: manifiesto aprobado esperaba 16 NPC | Falla: **17 !== 16** | Falla: **17 !== 16** | **Preexistente demostrado.** Mismo test y mismo resultado con manifiesto del commit; no causado por motor Excel. No se tocó el manifiesto ni el contrato de 16. |
| `decisions_corrections.test.js`: doble DOM sin `getBoundingClientRect` | Cinco casos fallan `TypeError`, `app.js:729` al medir layout | Suite pasa tras la corrección del agente principal | **Preexistente demostrado y corregido** durante la integración. No es un error de cálculo Excel; el doble de DOM del test no implementaba la medición que HEAD ya invocaba. |
| `mobile_integral_ui.cjs`: objetivos táctiles en 800×360 | Falla: `tablet-B 800: targets under44`; los mismos dos botones con altura 40 | Falla equivalente: mismos botones y medidas | **Preexistente demostrado** mediante navegador baseline y actual. |
| `decisions_cycle_ui.cjs`: comprobación de desplazamiento | Falla `window.scrollY>0`, línea 97, después de aprobar los flujos previos | Falla equivalente en la misma assertion y línea | **Preexistente demostrado** mediante navegador baseline y actual. |

Evidencia exacta: `reports/sim/atribucion-regresion/antes-<suite>.log`, `actual-<suite>.log`, `resultados.json` y `huellas.json` con SHA-256 de manifiesto, tests y CSS de las dos versiones. Las primeras invocaciones prematuras de baseline carecían de archivos todavía en extracción; fueron descartadas y sus logs se sustituyeron por la ejecución válida después de terminar `BASELINE.json`. No se cuentan errores MODULE_NOT_FOUND como fallos del producto.

## Log integral original

La corrida existente `tests/output/mejora-integral-2026-10-01/logica-excel/runs/2026-10-11T15-19-56-587Z/` registró:

- Unitarios: manifiesto NPC 17 frente a 16 y cinco errores del doble DOM.
- Navegador `mobile_integral_ui.cjs`: `tablet-B 800: targets under44`; `exitDecisions` y `topSubmitAllDecisions` con altura 40.
- Navegador `decisions_cycle_ui.cjs`: validó seis tamaños de tablet y los flujos de decisiones/producción antes de fallar el desplazamiento en línea 97.
- El resto de suites DB/navegador registradas en ese resumen pasó; `side_full_flow.cjs` se omitió porque no existe. La corrida no demuestra una regresión completa verde y la preservación de outputs quedó inconclusa.

Ese log sirve para identificar la primera falla; la atribución se fundamenta en las ejecuciones antes/actual, no en asumir que un fallo es ajeno por el nombre del archivo.

## Regresión final

Pendiente de ejecutar cuando termine la integración del agente A6. No se inicia mientras se editan UI/motor para evitar comparar versiones cambiantes. El agente principal conservará el log de la nueva corrida en `reports/sim/` y consignará suites, fallos y omisiones. Esta atribución no transforma fallos preexistentes en pruebas aprobadas ni autoriza el push sin cumplir los criterios completos.

## Seguimiento de fallos intermitentes de la corrida excel-final

La corrida `tests/output/mejora-integral-2026-10-01/excel-final/runs/2026-10-11T16-28-49-507Z/` registró timeout de 30 s en `world_startup.cjs:67`, al esperar `assets.detailsReady`. Para compararla se completaron **todos los assets y vendor tracked** de la línea base exacta. Cada archivo se verificó mediante SHA-1 con cabecera de blob Git; solo se reutilizaron enlaces duros cuando el contenido coincidía con el OID del commit. Las diferencias se extrajeron desde Git y se verificaron. Evidencia: `reports/sim/atribucion-startup/assets-verificados.json`.

Una ejecución completa por versión de `world_startup.cjs`, con servidor HTTP propio para cada checkout, pasó tanto `all` como `sections`: baseline exit 0, 94 277 ms; actual exit 0, 82 253 ms. Los valores `loadMs` respectivos fueron 38 390/39 384 y 28 982/34 342 ms; miden la prueba completa de cada modo, no exclusivamente el intervalo de espera de detalles. El timeout original **no se reprodujo**: no queda demostrado que sea preexistente ni causado por Excel. Logs y resultados: `reports/sim/atribucion-startup/{antes.log,actual.log,resultados.json}`. No se cambiaron assertions ni tiempos de la suite.

La misma corrida original falló en `supplied_npcs.cjs:136`, `customers complete a decision`, después de aprobar la rama normal y durante fallback. El primer intento de baseline abortó antes de assertions porque faltaba `tools/npc_preview.html`: quedó conservado como `reports/sim/atribucion-supplied-npcs/intento-invalido-404.log`, excluido de toda atribución causal. El preview se completó con el blob exacto `9ca3a4d4eafe587b880d688bfb96ce939200a905` del commit; evidencia en `preview-verificado.json`. No se copiaron resultados actuales al baseline.

La ejecución válida única de NPC por versión aprobó la rama `supplied player assets with procedural city NPCs`, pero ambas excedieron el límite externo de 240 s del corredor durante fallback, con `exitCode: null`. El corredor mató los procesos; esto **no equivale a una assertion fallida de la suite**, ni demuestra preexistencia de `customers complete a decision`. La assertion original queda **sin atribuir y sin resolver**; no se repitió la versión actual ni se modificaron NPC/3D. Logs `reports/sim/atribucion-supplied-npcs/{antes.log,actual.log}`; ejecución actual en `primer-intento-resultados.json` y baseline válido en `resultados.json`. El primer resultado baseline 404 en el primer JSON es inválido y debe excluirse.

La corrida final del coordinador `reports/sim/final-continuacion-2/regresion-db-navegador.log` añadió `continuous_world.cjs:68`, donde `startSimulationLoading()` devolvió false tras aprobar el commit de decisiones de línea 67. Se ejecutó únicamente el baseline exacto; la versión actual ya estaba cubierta por esa corrida final y no se repitió. El baseline terminó **exit 0, diez escenarios aprobados, 129 845 ms**: ese fallo concreto **no se reprodujo antes**, por lo que permanece **sin atribuir y sin resolver**, sin justificar un push. Evidencia: `reports/sim/atribucion-continuous-world/{antes.log,resultados.json}`.

La misma corrida final añadió timeout de 30 s en `world_cycle_restart.cjs`, función `active`, línea 53 (invocada desde línea 68). No se amplió la atribución con otra suite: queda **sin atribuir y sin resolver**, conforme al límite de ejecuciones solicitado. Estos pendientes no se convierten en preexistentes por coexistir con otros fallos ya demostrados; no se modificaron mundo 3D, manifiestos ni NPC durante este seguimiento.

## Resultado final único del coordinador
Regresión final: startup y supplied_npcs PASS; continuous_world FAIL inicio=false y world_cycle_restart FAIL timeout30s siguen sin resolver. Scroll y botones40px reproducen los fallos previos ya demostrados. Node361/362, único manifiestoNPC17/16 previo. No hay push. Evidencia consolidada en reports/sim/final-continuacion-2/regresion-integral-summary.json y log regresion-db-navegador.log.
