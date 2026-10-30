# Recepciones SIDE — avance P0 local

**INCOMPLETO.** La previsualización dispone de un modo temporal explícito, pero no existe todavía persistencia autoritativa de órdenes ni cierre financiero para ese modo. El flujo habitual sin `__materialOrders` conserva la suma inmediata heredada; P0 no está cumplido.

## Cambios

- `js/production_model.js`: cuando el estado incluye `__materialOrders`, reconstruye el libro con `material_orders.apply`, valida identidad de empresa y llama `temporal_production.calculate` usando capacidad de la etapa limitante, eficiencia, moldes, metas, stock inicial y recepciones registradas. En este modo, las compras pendientes no se suman a la existencia y se devuelve detalle temporal y cantidad pendiente. Las recepciones son entradas de una **proyección**, no han sido verificadas por servidor. La cantidad se agrega por familia de materiales, no se conservan aún los consumos ni el costo por SKU/lote.
- `index.html` y `docente.html`: cargan los dos módulos antes del cálculo de producción. No se creó todavía una interfaz para capturar o consultar órdenes persistidas; el modo solo se activa si otro consumidor suministra el libro explícito.
- `js/cycle_model.js`: rechaza cierres con ese libro hasta que haya valoración y persistencia autoritativas. Un recibo histórico ya existente se reutiliza antes de esa comprobación. No hay cierre persistido con recepción temporal.
- `supabase/functions/side-business-close/runtime.mjs`: regenerado localmente mediante `node tools/build_business_edge.cjs`; no desplegado.
- `tests/recepcion_preview_integracion.test.cjs`: prueba `production_model.calculate` con el libro real. Hilo solicitado de 1300 m y sin recepción produce 0; con recepción al inicio del día 7 y demás insumos, produce 100, sin producción en los días 0–6. Otro escenario, con 2600 m recibidos al día 7, capacidad de ciclo 162 y meta 200, produce 125 y consume 1625 m de hilo. El cierre rechaza el ledger para no guardar valoraciones falsas.

## Pruebas y alcance

- `node --test tests/recepcion_preview_integracion.test.cjs tests/edge_lotes_equivalencia.test.cjs tests/production_model.test.js`: 17 aprobadas, 0 fallidas.
- `node --test tests/limite_ciclos_sql.test.cjs tests/cierre_rollback_local.test.cjs`: 2 aprobadas, 0 fallidas; rollback en PGlite no demuestra concurrencia de PostgreSQL.
- `node tests/business_worker_db.cjs --edge`: pasó con dos cierres históricos, sin libro temporal; no prueba recepción real.
- Caso A: **parcial**, solo preview explícito; cierre se rechaza. B: **parcial**, solo preview. C y D: **pendientes** en entrypoints de juego. E: rollback anterior en PGlite, concurrencia pendiente. F y H: pendientes. G: permisos locales verificados con fixture anterior, no se ha validado autorización de órdenes.

Persisten las 17 regresiones descritas en `docs/reporte_validacion_SIDE_6_ciclos.md`. La paridad con Excel equivalente, los pagos a crédito, el arrastre de órdenes y la valoración están sin verificar. No se modificó ni conectó Supabase remoto y no se desplegó Edge.

Suite general final tras los cambios de código y pruebas: `node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs`: **824 pruebas, 807 aprobadas, 17 fallidas, 0 omitidas**. Registro `tests/output/p0_recepciones_final_v2_20261029.log`; los 17 fallos previos permanecen sin resolver. La suite no demuestra P0: el nuevo contrato solo se ha probado como previsualización y el cierre lo rechaza.

## Continuación local — 30 de octubre de 2026

Ruta efectiva: `js/app.js:productionPlan` → `production_model.calculate` (preview); decisión confirmada → `side_contexto_cierre_negocio` → `services/partida_service.js:cerrarNegocio` → `cycle_model.closeMany` → `side_guardar_cierre_negocio` → snapshot y reporte. El worker toma los saldos del cierre anterior y descarta los campos económicos enviados por el navegador. No existe todavía una consulta de órdenes/recepciones autoritativas en esa ruta.

Cambios de esta continuación:
- `temporal_production.calculateBySku` y `production_model.calculate`: la previsualización con libro explícito conserva `consumedBySku`, `stockBySku` y consumo por día, con sustitución en el orden existente de SKU de cada familia. La prueba usa 650 m de hilo estándar inicial y 650 m de hilo prémium recibido el día 7: ambos se consumen una vez y el hilo prémium no se consume antes de su llegada. Aún no hay valoración por lote ni persistencia de este resultado.
- `production_model.calculate` rechaza una versión de materiales no heredada cuando no recibe libro. `partida_service.cerrarNegocio` rechaza explícitamente con `RECEPCIONES_NO_DISPONIBLES` cualquier versión de materiales no heredada, sin persistir un cierre con compras instantáneas. Una sala sin versión mantiene la lógica anterior; no se han migrado ni cambiado partidas existentes. El nuevo marcador de versión debe provenir de configuración confiable; no se ha implementado su activación ni las órdenes persistidas.
- `node tools/build_business_edge.cjs`: bundle local regenerado con 16 módulos. `node --test tests/recepcion_preview_integracion.test.cjs tests/authoritative_worker.test.cjs tests/edge_lotes_equivalencia.test.cjs tests/material_orders.test.cjs tests/temporal_production.test.cjs`: 22 aprobadas, 0 fallidas; log `tests/output/p0_sku_temporal_20261030.log`.
- `node --test tests/limite_ciclos_sql.test.cjs tests/cierre_rollback_local.test.cjs`: 2 aprobadas, 0 fallidas en PGlite. No valida simultaneidad real de PostgreSQL.

| Caso | Estado y comando |
|---|---|
| A pendiente | PARCIAL: `node --test tests/recepcion_preview_integracion.test.cjs`; solo preview con libro inyectado. El worker de versión temporal rechaza cierre, no lo persiste. |
| B día 7 / 125 | PARCIAL: mismo comando, solo preview; falta igualdad con cierre persistido. |
| C parciales/idempotencia | PARCIAL: `node --test tests/material_orders.test.cjs`; libro en memoria, no base ni valoración. |
| D crédito, pago y costo | NO EJECUTADO: falta contrato financiero y persistencia de órdenes. |
| E rollback y concurrencia | PARCIAL: `node --test tests/cierre_rollback_local.test.cjs`, rollback del flujo heredado en PGlite; concurrencia y rollback de recepciones no ejecutados. |
| F seis ciclos, dos empresas | NO EJECUTADO: no existe cierre temporal persistible. |
| G seguridad y versiones | PARCIAL: `node --test tests/authoritative_worker.test.cjs`; rechazo de versión temporal incompleta. Las pruebas previas de privilegios no verifican órdenes. |

Sin migraciones nuevas ni operaciones remotas. El bloqueo concreto sigue en `cycle_model.close`: se rechaza `__materialOrders` porque `engine/cierre.materialUse`, `cycle_model` y `financial_model` todavía consumen/valoran compras completas, y el worker no recupera recepciones verificadas de la base. La integración P0 y la comparación Excel equivalente siguen INCOMPLETAS. Las 17 regresiones anteriores no se han corregido en esta continuación; ver `docs/reporte_validacion_SIDE_6_ciclos.md`.

`node --test tests/edge_lotes_equivalencia.test.cjs tests/recepcion_preview_integracion.test.cjs tests/authoritative_worker.test.cjs`: 19 aprobadas, 0 fallidas. Incluye comparación Node/Edge del rechazo `RECEPCIONES_NO_DISPONIBLES` sin escribir cierre. `node tests/business_worker_db.cjs` y `node tests/business_worker_db.cjs --edge` también pasaron localmente con el contrato heredado; no prueban órdenes temporales. No hubo despliegue ni conexión remota.

Suite final tras los últimos cambios: `node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs`: **828 pruebas, 811 aprobadas, 17 fallidas y 0 omitidas**; `tests/output/p0_sku_final_v2_20261030.log`. Las 17 fallas previas permanecen; no se ha cumplido P0.

## Continuación local: órdenes persistidas — 30 de octubre de 2026

**P0 INCOMPLETO.** Migración local `supabase/migrations/20261030162649_side_pedidos_autoritativos.sql`, aplicada solo en PGlite de pruebas. Crea `side_material_orders_v1` y `side_material_receipts_v1`; habilita RLS, revoca acceso directo y expone funciones para el rol de servicio. `side_confirm_material_order_v1` deriva SKU/cantidad del plan confirmado y precio/descuentos del catálogo/configuración; exige parámetros explícitos de plazo y pago. `side_record_material_receipt_v1` registra recepciones parciales bajo bloqueo, rechaza exceso/día no alcanzado e identifica reintentos. `side_material_context_v1` lee hechos por partida/empresa/corte y devuelve su revisión. El registro manual se admite exclusivamente desde servicio; no se implementó cancelación ni entrega automática.

Ruta de pruebas: decisión confirmada guardada en `side_student_state` → `side_confirm_material_order_v1` → `side_record_material_receipt_v1` → `side_material_context_v1` → `production_model.calculate` → `temporal_production.calculateBySku` → `engine/cierre.materialLots` para consumo por SKU/modelo. El worker `cerrarNegocio` consulta esa fuente para salas temporales, pero devuelve `RECEPCIONES_NO_DISPONIBLES` antes de guardar; la lectura y su revisión aún no están ligadas a la transacción de cierre. La interfaz normal aún no recupera el libro del servidor.

Prueba PGlite `node --test tests/material_orders_db.test.cjs`: 2 aprobadas. En un fixture, el servidor deriva una orden de 1300 m a S/1.84/m; una recepción de 300 m produce 23 unidades y consume 299 m en la previsualización; el reintento no agrega stock y un exceso se rechaza. En otro, una orden de 2600 m con recepción al inicio del día 7 alimenta el mismo cálculo: capacidad nominal 162, producción 125, consumo 1625 m, saldo 975 m. Los insumos iniciales de este fixture se suministraron al cálculo de prueba; no constituyen una conciliación contable persistida.

`node --test tests/material_orders_db.test.cjs tests/recepcion_preview_integracion.test.cjs tests/authoritative_worker.test.cjs tests/edge_lotes_equivalencia.test.cjs tests/cierre_v19.test.cjs`: 31 aprobadas, 0 fallidas, log `tests/output/p0_ordenes_persistidas_20261030.log`. `node tests/business_worker_db.cjs --edge`: pasó con el cierre heredado; no demuestra cierre temporal exitoso. `node tools/build_business_edge.cjs`: 16 módulos empaquetados localmente.

| Caso | Estado y evidencia |
|---|---|
| A pedido pendiente | PARCIAL: `node --test tests/material_orders_db.test.cjs`; orden y preview desde PGlite dan 0, el worker no persiste cierre temporal. |
| B día 7 | PARCIAL: mismo comando, 125/162 y 1625 m en preview desde PGlite; cierre/valoración no implementados. |
| C parcial/reintento | PARCIAL: mismo comando, recepción de 300 m, repetición idempotente, exceso rechazado y segunda recepción; sin conciliación contable. |
| D crédito/pago/costo | NO EJECUTADO: el modo de pago se registra, no existen aún pasivo, vencimiento ni pago integrados. |
| E rollback/seguridad | PARCIAL: permisos de recepción/contexto probados; rollback previo solo para cierre heredado. Sin prueba de rollback temporal ni concurrencia PostgreSQL. |
| F históricos | PARCIAL: el cierre previo se reutiliza y el flujo heredado mantiene sus pruebas; falta transición versionada y prueba integral. |
| G paridad servidor | PARCIAL: Node/Edge coinciden en rechazo seguro; no hay cierre temporal exitoso. |

Pendientes concretos: `cycle_model.close` rechaza `__materialOrders`; `financial_model.calculate` valora compras de la sección completa en vez de recepciones, no lleva anticipos/CxP, y `side_guardar_cierre_negocio` no incorpora la revisión de `side_material_context_v1`. No retirar la protección hasta conectar estos puntos y guardar todo atómicamente. La política de vencimiento de crédito no se ha inventado y requiere configuración/contrato. No se modificó ni conectó Supabase remoto y no se desplegó Edge.

Suite general final después de la última modificación SQL: `node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs`: **831 pruebas, 814 aprobadas, 17 fallidas, 0 omitidas**; `tests/output/p0_pedidos_final_v2_20261030.log`. El orden de bloqueo de recepción se ajustó a partida → pedido; la prueba PGlite volvió a pasar, pero eso no demuestra concurrencia real.

## Primer cierre temporal contado persistido — 30 de octubre de 2026

**P0 INCOMPLETO.** Se habilitó un alcance limitado: una partida temporal `receipts-v1`, exactamente un ciclo, pago `cash`, sin inventario inicial de materia prima, y con una sola orden por SKU que corresponda a la decisión confirmada y al precio de catálogo. Crédito, pagos posteriores, existencias iniciales valorizadas y más de un ciclo se rechazan; no se ha implementado su política financiera.

Ruta local: decisión confirmada → `side_confirm_material_order_v1` → `side_record_material_receipt_v1` → `side_material_context_v1` → `partida_service.cerrarNegocio` recupera el libro de servidor → `production_model.calculate`/`temporal_production.calculateBySku` → `engine/cierre` → `cycle_model.close` → `financial_model.calculate` → `side_guardar_cierre_temporal_v1` verifica revisiones bajo bloqueo y llama al guardado existente. La prueba obtiene el preview de la misma consulta SQL; la interfaz normal todavía no consulta esa fuente.

La [migración local `20261030165204_side_cierre_revision_pedidos.sql`] añade el guardado temporal restringido al rol de servicio, bloqueo de partida/ciclo, comparación de revisiones y reutilización del recibo previo. Se probó con revisión antigua, que devuelve `ORDENES_DESACTUALIZADAS`; se aplicó únicamente a PGlite desechable. No se modificó ni conectó Supabase remoto y no se desplegó Edge.

Política limitada: el gasto de compra contado registrado en el ledger del ciclo se paga una vez al cierre. La porción pagada no recibida se mantiene como `anticiposMateriales`; los materiales recibidos se valoran al costo unitario del pedido y se asigna el valor consumido al producto. Se conserva el promedio ponderado por SKU existente; no se afirma FIFO por lote de materia prima. El costo de producto terminado solo se reconoce como costo de ventas al vender. Los pagos y vencimientos de crédito no están implementados.

| Hito | Evidencia local | Estado |
|---|---|---|
| Pedido y recepción | `node --test tests/material_orders_db.test.cjs`: decisiones persistidas, parcial, duplicado, exceso, permisos y lectura por empresa | Probado en PGlite. |
| Pendiente | `node --test tests/cierre_temporal_persistido_pglite.test.cjs`: hilo sin recepción, producción/consumo/stock cero, anticipo S/4784 | Cierre contado guardado; fixture de un ciclo. |
| Día 7 | `node --test tests/material_orders_db.test.cjs`: libro SQL, preview y cierre iguales día por día, 125 unidades y 1625 m consumidos | Cierre contado guardado. |
| CAS | Misma prueba: revisión anterior rechazada, cierre existente reutilizado | Probado en PGlite; concurrencia real no probada. |
| Rollback | `tests/cierre_temporal_persistido_pglite.test.cjs`: error inducido en reporte revierte cierre/snapshot/caja; luego reintento | Probado para el cierre; las recepciones ya habían sido guardadas en transacciones previas y se conservan. |
| Node/Edge | `tests/material_orders_db.test.cjs`: ejecuta Node dentro de transacción, revierte y cierra con Edge, compara recibos completos | Probado para fixture contado de un ciclo. |
| Crédito | Worker rechaza explícitamente `credit` | Pendiente; no hay CxP ni vencimiento. |

Conciliación observada del fixture día 7, emitida por la prueba (`tests/output/p0_cierre_bisagra_20261030.log`): hilo 2600 m recibidos = 1625 m consumidos + 975 m finales; valor recibido S/4784, valor consumido S/2990 y saldo S/1794. Se fabricaron y vendieron 125 unidades; ventas S/43750, costo de ventas S/15675.94, utilidad S/21936.07, caja inicial S/100000 y caja final S/94435.61. El saldo de anticipo en este caso es 0; el caso de hilo pendiente mantiene S/4784 como anticipo. Estas cifras proceden de los fixtures, no de una partida remota.

`node --test tests/material_orders_db.test.cjs tests/cierre_temporal_persistido_pglite.test.cjs tests/accounting_integrated.test.cjs tests/authoritative_worker.test.cjs tests/edge_lotes_equivalencia.test.cjs`: 27 aprobadas, 0 fallidas. `node tests/business_worker_db.cjs` y `node tests/business_worker_db.cjs --edge` pasaron para cierres heredados. Se regeneró Edge local con `node tools/build_business_edge.cjs` (16 módulos). Siguen pendientes: CxP/pagos a crédito y continuidad, UI con fuente de servidor, pruebas de PostgreSQL concurrente y paridad Excel; las 17 regresiones anteriores no se han tratado.

Validación adicional: el cierre temporal contado ahora rechaza una caja final negativa; `node --test tests/cierre_temporal_persistido_pglite.test.cjs tests/material_orders_db.test.cjs tests/accounting_integrated.test.cjs tests/edge_lotes_equivalencia.test.cjs` produjo 15 aprobadas y 0 fallidas (`tests/output/p0_cierre_bisagra_final_20261030.log`). La recepción del pedido es una operación previa y separada del guardado del cierre: el rollback probado no borra recepciones ya confirmadas. La prueba de caja insuficiente es de función local; no acredita control de liquidez durante cada día productivo.

Suite general final después de la comprobación de caja y regeneración de Edge: `node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs`: **832 pruebas, 815 aprobadas, 17 fallidas, 0 omitidas**. Registro `tests/output/p0_cierre_final_v2_20261030.log`. Las 17 fallas previas se mantienen sin cambios; no se ha declarado P0 completo.

## Actualización local: crédito y continuidad (30-10-2026)

**P0 INCOMPLETO.** Esta sección actualiza el alcance descrito anteriormente: `receipts-v1` admite cierres consecutivos hasta seis ciclos y compras a crédito, con órdenes y recepciones verificadas en el servidor. El código mantiene la ruta de cierre y el guardado CAS existentes; Edge se regeneró localmente. No se ha modificado ni desplegado Supabase remoto.

La recepción aceptada reconoce inventario y CxP por su valor, con detalle de pedido y recepción. El plazo configurable `supplierCreditTermCycles` se interpreta desde el ciclo de recepción y, si no se configura, es de un ciclo: es un supuesto nuevo de SIDE, no una regla atribuida al Excel. El pago se calcula al cierre del ciclo, en orden de vencimiento e identificador de recepción, hasta la caja disponible; el saldo insoluto continúa como pasivo, incluso tras el último ciclo. No se incorporan intereses. Los pagos quedan en el snapshot inmutable del cierre; no existe tabla independiente de pagos. Los anticipos de contado se arrastran y reclasifican al recibir. Se conserva la valoración por promedio ponderado por SKU.

El ciclo posterior recupera saldos desde el cierre anterior y comprueba la continuidad de órdenes y recepciones históricas. Una recepción nueva con fecha anterior a ese cierre provoca rechazo explícito; requiere reconciliación y no reescribe la historia. La modalidad se configura para toda la sala, de modo que aún no se admiten órdenes mixtas contado/crédito en una misma sala. La carga del libro verificado en las previsualizaciones de alumno y docente sigue pendiente; tampoco se ha probado concurrencia contra PostgreSQL real ni la duración individual de 3, 4 y 5 ciclos.

Evidencia reproducible: `node --test tests/accounting_integrated.test.cjs tests/credito_proveedor_pglite.test.cjs tests/material_orders_db.test.cjs tests/cierre_temporal_persistido_pglite.test.cjs tests/authoritative_worker.test.cjs tests/edge_lotes_equivalencia.test.cjs` produjo 32 aprobadas y 0 fallidas. Registro: `tests/output/credito_regresion_final_20261030.log`. Incluye crédito parcial, comparación de cierre Node/Edge, reintento y rollback conservando recepciones previas, dos ciclos contado y crédito, seis ciclos con dos empresas y rechazo del séptimo. La segunda empresa conserva producto terminado en el primer ciclo y lo vende en el segundo. Estos son fixtures PGlite; no acreditan seguridad completa de interfaz ni concurrencia PostgreSQL.

En el fixture de crédito de dos ciclos, la empresa recibe 1300 m de hilo en cada ciclo, consume 1300 y 1235 m, y termina con 0 y 65 m respectivamente. Sus CxP son S/14352 y S/2392; en el segundo ciclo paga S/14352. La caja inicial/final es S/200000 / S/206704.45 y S/206704.45 / S/212192.51. El fixture contado equivalente conserva un anticipo de S/2392 en el primer ciclo y lo reclasifica en el segundo. Los datos completos por SKU y ciclo, incluidos materiales, ventas, CxC, costo y utilidad, están en `tests/output/credito_dos_empresas_20261030.log` bajo `CICLOS_CREDIT_2`, `CICLOS_CASH_2` y `CICLOS_CREDIT_6`.

Quedan pendientes la integración de interfaz y fallos de red, prueba integral de permisos por empresa y concurrencia PostgreSQL, modalidad mixta, matriz completa de duraciones, diagnóstico individual de regresiones y comparación Excel corregida bajo contratos equivalentes. La simulación de seis ciclos no cubre compras nuevas ni producción en los últimos cuatro períodos; no constituye la aceptación integral H.

Suite general: `node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs`: 837 pruebas, 820 aprobadas, 17 fallidas y ninguna omitida; registro `tests/output/credito_suite_completa_20261030.log`. Los 17 fallos no se han diagnosticado individualmente ni corregido en esta fase. `node tests/business_worker_db.cjs` y `node tests/business_worker_db.cjs --edge` pasaron para el contrato heredado.
