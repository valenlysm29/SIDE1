# Auditoría empresarial SIDE: avance local

Esta matriz es parcial; no certifica el motor completo ni la base de datos remota. Fecha: 2026-10-29.

| Regla | Evidencia y estado anterior | Cambio y estado posterior | Verificación |
|---|---|---|---|
| 30 días productivos | `js/production_model.js`, constante WORKING_DAYS=30. CUMPLE PARCIALMENTE: permite `ctx.workingDays` y falta verificar el flujo completo. | Sin cambio. | `production_model.test.js`, capacidad y días. |
| Recursos físicos | `pairedDailyCapacity` asignaba todos los operarios a una máquina existente; corte asignaba todos a una mesa. NO CUMPLÍA. | Emparejamiento limitado por unidades disponibles, respeta asignaciones guardadas y distribuye remanentes determinísticamente. CUMPLE para el cálculo examinado. | `production_model.test.js`: cada mesa/máquina atiende como máximo una persona; `edge_lotes_equivalencia.test.cjs`. |
| Recetas y prioridad | `MOLD_REQUIREMENTS` y bucle de `calculate`: básico, mejorado, premium; consumo según unidades planificadas. CUMPLE PARCIALMENTE: falta demostrar recepción y cierre integral. | Sin cambio. | `production_model.test.js` y `lotes_fifo_integrado.test.cjs`. |
| Impuesto final | `js/financial_model.js` usa `policy.cycles` y acumulación. CUMPLE PARCIALMENTE: falta verificar todos los ciclos y persistencia. | Sin cambio. | `final_cycle_tax.test.cjs`. |
| Paridad servidor/edge | `services/business_runtime.cjs` utiliza módulos fuente; `supabase/functions/side-business-close/runtime.mjs` contiene copia empaquetada. CUMPLE PARCIALMENTE: existen copias que deben sincronizarse. | Se aplicó el mismo cambio a ambas copias. | `edge_lotes_equivalencia.test.cjs`; no verifica despliegue remoto. |
| Recepción y plazos | `production_model.js` suma compras del ciclo como disponibles sin comprobar recepción. NO CUMPLE el contrato de plazos en esa previsualización. | Pendiente; requiere integrar pedidos y disponibilidad con persistencia autoritativa. | Inspección de `calculate`, variable `purchasesAvailable`. |
| Ciclos 1–6, cierre atómico y concurrencia | Hay pruebas y lógica de ciclos existentes, pero no se ha demostrado el contrato completo extremo a extremo. CUMPLE PARCIALMENTE / PENDIENTE DE VERIFICACIÓN. | Sin cambio. | Pendiente fixture integral, simultaneidad, UI y base local. |
| Crédito, cuentas, inventarios y competencia | Existen suites de FIFO, consecuencias y finanzas; la cobertura seleccionada no demuestra todos los supuestos del encargo. CUMPLE PARCIALMENTE. | Sin cambio. | Ver pruebas seleccionadas y suite general; falta escenario integrado de seis ciclos. |
| Compatibilidad histórica | No se modificaron snapshots ni migraciones existentes. PENDIENTE DE VERIFICACIÓN: el cambio de capacidad aún no está versionado para reproducción de cierres anteriores. | No recalcular snapshots históricos. | Pendiente prueba de versionado/reproducción. |

Línea base antes del cambio: 39 pruebas seleccionadas aprobadas, 0 fallidas. Después: 41 aprobadas, 0 fallidas (incluye prueba nueva y equivalencia edge). El oráculo Excel y Supabase remoto no fueron ejecutados ni validados en esta revisión. El cambio de capacidad debe versionarse antes de usarlo para recalcular partidas históricas.

Suite general ejecutada: `node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs`: 810 pruebas, 793 aprobadas, 17 fallidas, 0 omitidas. Registro: `tests/output/auditoria_6_ciclos_node.log`. Entre los fallos, `md_logic.test.cjs` espera que dos operarios compartan una mesa (14 unidades/día frente a 8 ahora); otras fallas visuales y de paridad requieren investigación individual y no se atribuyen todas al cambio sin línea base equivalente. El conjunto selectivo `node --test tests/md_logic.test.cjs tests/produccion_excel.test.cjs tests/production_dop.test.js` produjo 22 aprobadas y 6 fallidas.

## Continuación 2026-10-29

- **IMPLEMENTADO + VALIDADO (módulos locales):** `js/side_rules.js` limita el calendario a 1–6; `services/partida_service.js` rechaza configuración de cierre superior a 6. La copia Edge se sincronizó. Pruebas `side_rules.test.js`, `authoritative_worker.test.cjs` y `edge_lotes_equivalencia.test.cjs`.
- **IMPLEMENTADO + VALIDADO (unidad):** recibos nuevos incluyen `capacityRulesVersion`; un recibo histórico existente se reutiliza intacto en `business_cycle.test.cjs`. Esto no implementa reproducción del motor histórico.
- **NO IMPLEMENTADO:** pedidos, recepción y valoración asociada; la suma inmediata de compras permanece en previsualización y cierre.
- **NO VALIDADO:** concurrencia y rollback real, matriz completa de 1–6, interfaz de recepción y Edge remoto. La base SQL histórica admite hasta 20 en `supabase_game_lifecycle.sql`; la restricción aún no se implementó a nivel persistencia.
- La suite inicial se reprodujo: 810 pruebas, 793 aprobadas y 17 fallidas. Desglose individual y limitaciones en `reporte_validacion_SIDE_6_ciclos.md`.

## Continuación: pedidos y restricción SQL local

- `supabase/migrations/20261029221607_side_limite_seis_ciclos.sql` valida 1–6 en inserciones y modificaciones de duración, sin transformar registros anteriores. `tests/limite_ciclos_sql.test.cjs` pasa en PGlite, incluida reaplicación y registro histórico de 7.
- `js/material_orders.js` y `js/temporal_production.js` son componentes aislados con pruebas de recepción y capacidad por día. **No están conectados al flujo real**: la previsualización, cierre, estados contables y Edge continúan usando compras inmediatas. No se ha validado el requisito de recepción real ni la persistencia de órdenes.
- Ver `docs/resultado_integracion_SIDE_6_ciclos.md` para evidencia y límites.
