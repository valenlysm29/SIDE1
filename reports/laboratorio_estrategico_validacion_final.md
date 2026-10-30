# Validación final — Laboratorio Estratégico experimental

## Fuentes y autorización

La rama usa Supabase Auth (`getUser`), las políticas RLS de `partidas` y `participantes`, y el RPC de solo lectura `side_consultar_cierre_negocio(partida,ciclo)`. El RPC existente comprueba en PostgreSQL `partidas.profesor_id = auth.uid()` y devuelve `side_business_closures.cierre`; el selector consulta ciclos 1–6 y ofrece solo los que tienen cierre. El resultado contiene `receipt` y `financial`, de los que proceden producción, ventas y estados financieros sellados. `reportes_ciclo` y decisiones editables no sustituyen el cierre. El RPC entrega el cierre completo del ciclo de la partida autorizada al navegador, por lo que filtrar por empresa en servidor sigue pendiente.

La inspección administrativa de solo lectura confirmó la función y un resumen de versiones de recibos: 63 con `md-20261027` sin versión explícita de capacidad, 8 `excel-v19`, 4 sin versión y 1 con la versión de capacidad `one-worker-per-resource-20261029`; no se presentan como una prueba de acceso docente. El cliente no incorpora `service_role`. No se ejecutaron escrituras, migraciones ni Edge Functions remotas.

**Prueba real bloqueada:** no había sesiones o credenciales de dos docentes autorizados disponibles. No se simuló autorización con una cuenta privilegiada. Quedan sin verificar el ingreso real, la selección de una partida propia con cierre, la comparación pantalla/RPC en esa sesión y el rechazo real de otra partida. Las pruebas locales de autorización o la inspección de la función no sustituyen esas pruebas. La rama se publica como experimental con esta limitación.

## Indicadores y escenarios

Ventas provienen de `financial.estadoResultados.ingresos`, utilidad de `utilidadNeta`, margen es utilidad/ventas × 100 si ventas no son cero y cumplimiento es `receipt.produced / receipt.production.target × 100` con meta positiva. Valores ausentes no se reemplazan por cero; la revisión financiera es parcial, no una auditoría contable. Las series y comparaciones proceden del mismo ciclo sellado y de la misma partida. La concordancia con un cierre real específico sigue sin verificar con sesión docente.

`js/laboratorio_scenarios.js` reutiliza `SIDE_ECONOMIC_CLOSURE.prepare` y, a través de él, `SIDE_PRODUCTION_MODEL.calculate`. Sobre copias reconstruye decisiones y apertura del recibo, y solo admite `modelVersion=md-20261027`, capacidad `one-worker-per-resource-20261029`, ausencia de órdenes temporales y datos necesarios. Antes de calcular compara con el cierre original: meta, producción, capacidades, eficiencia, procesos, materiales y líneas por molde. Si falta algo o no se reproduce exactamente, devuelve «Simulación numérica no disponible». Las alternativas cambian una cantidad de un material o una categoría y nivel de personal elegidos explícitamente. El cálculo muestra exclusivamente unidades producidas; no predice ventas, costos ni utilidad. El escenario original es el cierre oficial. No se escribe ni modifica el objeto original: probado localmente con comparación completa del objeto y con el navegador bloqueando solicitudes externas.

Estas barreras son conservadoras: la mayoría de los recibos revisados no declara la versión de capacidad, y los pedidos temporales no se recalculan. Que un escenario sintético pase no demuestra que un cierre real particular cumpla los requisitos. La validación local demuestra determinismo para los casos probados, no equivale a una prueba remota con docentes.

## Pruebas

- 46 pruebas Node focales: 46 aprobadas, 0 fallidas. Incluyen producción limitada por materiales, trabajadores y máquinas, alternativas que no aumentan producción, repetibilidad, copia sin mutación, versiones incompletas, resultados financieros, autenticación aislada y sincronización.
- Chromium con datos simulados locales: escritorio, tablet y móvil, filtros de ciclos cerrados, comparación, presentación, errores, solicitudes tardías y modo de demostración. Escenario cuantitativo con cierre sintético generado por el motor y captura `tests/output/laboratorio_estrategico/simulacion_motor_local.png`. Estas pruebas no prueban lectura o autorización real.
- La suite completa histórica no se volvió a ejecutar; sus 17 fallos están documentados anteriormente. Ninguna prueba se modificó para ocultar una regresión.

## Publicación y protección

Base: `226068e` en `codex/laboratorio-estrategico`. Se verificaron las referencias remotas `main=6ea7cc2b1ca5dafd0a9e2341b8d5471116c92803` y `version-estable-1=caa30f53ee32d2ddb8c177b14a0934c20a6d79f7`; `origin/laboratorio-estrategico` no existía al iniciar. La publicación solicitada consiste en un push sin fuerza a esa rama únicamente, sin merge ni despliegue explícito. El repositorio no contiene workflows propios en la revisión local; la API pública muestra el workflow dinámico de GitHub Pages y los últimos despliegues en `main`. La configuración privada de Pages no pudo consultarse mediante la API pública (404); se contrastarán los despliegues públicos tras el push, sin afirmar más de lo observado.
