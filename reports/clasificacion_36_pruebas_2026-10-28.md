# Clasificación de 36 pruebas del 28 de octubre de 2026

Comparación ejecutada con 17 archivos en copia de HEAD `4cbd8bbf5d47c895d30c6b00a10bc64401d58334` en `tests/output/ui-base`. Resultados en `tests/output/side-baseline-36.log`; dos fallos adicionales de la copia se deben a archivos no incluidos y no están en esta tabla. La suite original: `tests/output/side-node-suite-final-20261028.log`. Los fallos preexistentes que conciernen al cierre o ventas no se excluyen de la puerta de calidad.

| Prueba y línea | Falla en HEAD | Causa | Acción |
|---|---|---|---|
| `cancelar_partida.test.cjs:35` — un fallo de cancelación conserva la identidad heredada para reintentar sin falso éxito | Sí | Harness sin confirmedReportClosures impedía cancelar | Corregida: se incorpora el mapa real al doble |
| `cancelar_partida.test.cjs:49` — un poll detenido en cierre de negocio no reaplica su sala activa después de cancelar | Sí | Harness sin confirmedReportClosures impedía cancelar | Corregida: se incorpora el mapa real al doble |
| `cierre_v19.test.cjs:16` — document quality feeds market without changing the player price | No | Calidad competitiva ahora es reputación relativa, con sintéticos | Actualizada: calidad 25 y tres competidores sintéticos |
| `costos_runtime_v19.test.cjs:12` — active materials charge Excel physical unit cost with volume discount exactly once | No | Descuento antes incondicional; ahora umbral 100 | Actualizada: verifica 10 unidades sin descuento y 100 con 8 % |
| `cycle_independent_audit.test.cjs:25` — teacher closure displays persisted revenue and stops on a rejected closure | Sí | Doble usaba RPC antigua de cierre docente | Corregida: doble usa RPC de consulta |
| `decision_review_model.test.js:38` — material purchases use physical units and the retained quantity discount | No | Descuento antes incondicional; ahora umbral por opción | Actualizada: verifica importe por opción y umbral |
| `decisions_corrections.test.js:27` — untouched zero production stays pending and a changed target becomes a draft | Sí | Harness omitía dependencias reales de producción | Corregida: cargar dependencias reales |
| `decisions_corrections.test.js:41` — store checkboxes accumulate districts, keep web, and update prices independently | Sí | Harness omitía dependencias reales de producción | Corregida: cargar dependencias reales |
| `decisions_corrections.test.js:63` — single-store draft saves and reloads with one charge and one basic seller | Sí | Harness omitía dependencias reales de producción | Corregida: cargar dependencias reales |
| `decisions_corrections.test.js:73` — multiple stores survive draft restoration and repeated saves with correct charges and sellers | Sí | Harness omitía dependencias reales de producción | Corregida: cargar dependencias reales |
| `decisions_corrections.test.js:88` — existing contracts prevent closure but allow adding districts in later cycles | Sí | Harness omitía dependencias reales de producción | Corregida: cargar dependencias reales |
| `decisions_corrections.test.js:113` — DOP renders once in Production and nowhere in the other categories or summary | Sí | Harness omitía dependencias reales de producción | Corregida: cargar dependencias reales |
| `decisions_corrections.test.js:123` — visual DOP handles empty, zero and valid targets and updates from active drafts | Sí | Harness omitía dependencias reales de producción | Corregida: cargar dependencias reales |
| `excel_progreso.test.cjs:14` — HUD and report count current-cycle section confirmations and ignore obsolete Excel envelopes | Sí | Harness omitía updateSectionSendButton | Corregida: cargar función real y sus dependencias |
| `excel_progreso.test.cjs:21` — draft readiness never claims submission and the review remains accessible after confirmation | Sí | Harness omitía updateSectionSendButton | Corregida: cargar función real y sus dependencias |
| `legacy_asset_inventory.test.cjs:77` — legacy equipment review and maintenance preserve the same acquisition costs and holdings as canonical history | Sí | Snapshot legacy y canónico serializan historial distinto | Deuda previa relacionada con inventario; bloquea calidad |
| `legacy_production_targets.test.cjs:38` — numeric and text cycle identifiers preserve identical material consumption, sales and remaining stock | Sí | Snapshot conserva round como texto frente a número | Deuda previa relacionada con cierre; bloquea calidad |
| `limpieza_runtime.test.cjs:20` — materials use physical units and bounded affordable thread purchases | No | unitCost sin cantidad ya no puede asumir descuento incondicional | Actualizada: comprueba compra de 10 y 700 metros |
| `live_sales.test.cjs:36` — no materials or channel means no sale, and financial schedule is identical to student ledger | No | Sin canal ahora puede vender con stock | Actualizada: verifica ventas con stock y sin canal, y cero sin material |
| `live_sales.test.cjs:47` — shared final closure replaces individual preview, survives reload and remains idempotent | No | Competidores sintéticos reducen asignación de cada empresa | Actualizada: 875 unidades y dos perfiles sintéticos en el reparto |
| `live_sales.test.cjs:62` — teacher follows server room cycle even when company report still names the previous cycle | Sí | Vista docente no aplica proyección provisional remota | Actualizada: ciclo vigente pendiente sin proyección remota |
| `live_sales.test.cjs:73` — a closure arriving during a roster read also replaces its cached sold units | No | Vista docente no aplica proyección provisional remota | Actualizada: dato pendiente se sustituye por cierre confirmado |
| `md_logic.test.cjs:26` — full closure preserves chosen prices, inventory balances and corrected MP valuation | No | Valoración depende del nuevo umbral de descuento | Actualizada: costo consumido y stock valorizado por opción |
| `md_logic.test.cjs:52` — largest remainder conserves all markets and ties are independent of input order | No | ROUND individual y participantes sintéticos sustituyen restos mayores | Actualizada: ROUND individual, error acotado y orden estable |
| `md_logic.test.cjs:56` — price guards support identical prices, arbitrary chosen prices and zero total scores | No | El reparto incluye competidores sintéticos | Actualizada: prueba de empate sin sintéticos con total redondeado |
| `md_logic.test.cjs:72` — all production costs are recognized in the cycle while unsold PT units carry forward | No | Sin canal ya no impide ventas del stock | Actualizada: stock excede demanda y se verifica arrastre |
| `resumen_analista_excel.test.cjs:6` — Cycle 2 summary uses the current analyst discount consistently with review and production | Sí | Harness omite motor y espera rótulo obsoleto | Corregida: carga motor y valida rótulo vigente |
| `revenue_excel_current.test.cjs:20` — unsold goods carry forward and opening stock can sell without current production | No | Sin canal ya no impide vender stock | Actualizada: comprueba stock de 5000, ventas y arrastre |
| `revenue_excel_current.test.cjs:27` — remote service ignores world prices and preserves confirmed decision expenses | No | Mock de sala omite duración obligatoria | Corregida: contexto simulado declara cycles; cierre remoto verifica ingresos y gastos |
| `sales_accounting_integration.test.cjs:5` — channel gate prevents fictitious revenue and commission even with finished stock | No | Sin canal ya no impide ventas | Actualizada: ventas y comisiones con stock incluso sin canal |
| `sales_accounting_integration.test.cjs:23` — shared closing keeps company stock and cash isolated | No | Sin canal ya no impide ventas | Actualizada: ventas y caja de cada empresa por separado |
| `sales_projection.test.cjs:25` — the projection honors inputs and channels instead of manufacturing sales | No | Sin canal ya no impide ventas | Actualizada: comprueba cero sin insumos y ventas sin canal |
| `sales_projection.test.cjs:31` — the final shared market replaces the individual reference and cannot sell stock twice | No | Simulados toman parte del mercado | Actualizada: verifica cuotas y dos competidores sintéticos |
| `world_auto_entry.test.cjs:20` — confirmed remote plan enters the durable snapshot queue even if report rendering fails | Sí | Harness omitía setCyclePlanSyncPending | Corregida: se incorpora la dependencia al doble |
| `world_auto_entry.test.cjs:30` — the final individual section enters the world after the whole batch is saved | Sí | Flujo anterior muestra resumen en lugar de abrir mundo | Deuda previa: no se alteró flujo 3D y mantiene aserción |
| `world_auto_entry.test.cjs:34` — send all enters automatically once and duplicate confirmation cannot charge again | Sí | Flujo anterior muestra resumen en lugar de abrir mundo | Deuda previa: no se alteró flujo 3D y mantiene aserción |

## Prueba de navegador

`teacher_results_isolation_ui.cjs` interceptaba `cerrarNegocio` pero la interfaz consulta `consultarCierreNegocio`: nunca recibía el cierre y no incrementaba `reportsRevision`, de manera que la segunda lectura no se encolaba. Se modificó el doble para responder a la RPC actual con un comprobante realista; se conservaron los asserts y el timeout. `node tests/teacher_results_isolation_ui.cjs`: PASS.

## SIM-1/2/3

La expectativa 7 frente a 5 también falla en HEAD. Proviene del antiguo puntaje por componentes y molde; el motor actual informa calidad física `(factor producción + factor MP)/2`: con 100 % N3 y 0 % material premium resulta 5. El reparto vigente usa la cuota de reputación, no esa calidad física; así, la expectativa de 7 pertenece al modelo anterior, no demuestra por sí sola un error del reparto solicitado. El mismo test exige consecuencias antiguas que alteran precio/reputación y asigna demanda a una empresa sin stock; ambas contradicen las reglas actuales. Hace falta separar explícitamente la cobertura del motor legado de la del contrato vigente, manteniendo sus respectivas aserciones.
