# Validación SIDE 1–6 ciclos — 2026-10-29

Estado: NO COMPLETO. Todo el trabajo se realizó localmente.

## Fallos iniciales reproducidos

| Archivo y línea | Prueba | Diagnóstico / estado |
|---|---|---|
| `tests\decisions_corrections.test.js:123:1` | visual DOP handles empty, zero and valid targets and updates from active drafts | INDETERMINADA: contrato visual esperado no coincide con HTML; falta establecer línea base anterior y resolver. |
| `tests\equivalencia_fuente_side.cjs:14:25` | Excel real y producción SIDE: base | EXPECTATIVA_HEREDADA_OBSOLETA: Excel usa una mesa para dos operarios; N5 386 frente a 221. Pendiente oráculo versionado. |
| `tests\equivalencia_fuente_side.cjs:14:25` | Excel real y producción SIDE: meta_cero | EXPECTATIVA_HEREDADA_OBSOLETA: Excel usa una mesa para dos operarios; N5 386 frente a 221. Pendiente oráculo versionado. |
| `tests\equivalencia_fuente_side.cjs:14:25` | Excel real y producción SIDE: material_insuficiente | EXPECTATIVA_HEREDADA_OBSOLETA: Excel usa una mesa para dos operarios; N5 386 frente a 221. Pendiente oráculo versionado. |
| `tests\equivalencia_fuente_side.cjs:14:25` | Excel real y producción SIDE: premium | EXPECTATIVA_HEREDADA_OBSOLETA: Excel usa una mesa para dos operarios; N5 386 frente a 221. Pendiente oráculo versionado. |
| `tests\equivalencia_fuente_side.cjs:14:25` | Excel real y producción SIDE: capacidad_limitada | EXPECTATIVA_HEREDADA_OBSOLETA: Excel usa una mesa para dos operarios; N5 386 frente a 221. Pendiente oráculo versionado. |
| `tests\equivalencia_fuente_side.cjs:30:1` | Excel real y SIDE: inventario arrastrado durante tres ciclos | EXPECTATIVA_HEREDADA_OBSOLETA: Excel usa una mesa para dos operarios; N5 386 frente a 221. Pendiente oráculo versionado. |
| `tests\legacy_production_targets.test.cjs:8:1` | saved numeric production targets use the chosen mold and generate sales in every segment | INDETERMINADA: resultado distinto; falta aislar si deriva de capacidad o de regresión preexistente. |
| `tests\md_logic.test.cjs:14:1` | document example: matrix, all N3 efficiency, 30 days and sequential production | EXPECTATIVA_HEREDADA_OBSOLETA: corte 14 frente a 8 con una mesa. Pendiente actualizar fixture sin perder comparación histórica. |
| `tests\md_logic.test.cjs:18:1` | corrected actual consumption gives exact reputation and quality factors | INDETERMINADA: resultado distinto; falta aislar si deriva de capacidad o de regresión preexistente. |
| `tests\md_logic.test.cjs:26:1` | full closure preserves chosen prices, inventory balances and corrected MP valuation | INDETERMINADA: resultado distinto; falta aislar si deriva de capacidad o de regresión preexistente. |
| `tests\production_dop.test.js:39:1` | rendering an empty plan preserves inputs and shows zero output, percent and mold detail | INDETERMINADA: contrato visual esperado no coincide con HTML; falta establecer línea base anterior y resolver. |
| `tests\production_dop.test.js:48:1` | material requirement labels are escaped and coverage is supplied by the model | INDETERMINADA: contrato visual esperado no coincide con HTML; falta establecer línea base anterior y resolver. |
| `tests\production_dop.test.js:71:1` | persisted adapter plans render real comparison stock without mutating snapshots | INDETERMINADA: contrato visual esperado no coincide con HTML; falta establecer línea base anterior y resolver. |
| `tests\reputacion_excel_real.test.cjs:4:1` | suma comercial real de Excel y conversión de escala para demanda | INDETERMINADA: resultado distinto; falta aislar si deriva de capacidad o de regresión preexistente. |
| `tests\revenue_excel_current.test.cjs:11:1` | catalog reputation is unique, bounded and independent from advertising spend proxy | INDETERMINADA: resultado distinto; falta aislar si deriva de capacidad o de regresión preexistente. |
| `tests\sales_projection.test.cjs:31:1` | the final shared market replaces the individual reference and cannot sell stock twice | INDETERMINADA: resultado distinto; falta aislar si deriva de capacidad o de regresión preexistente. |

## Pruebas

- Suite inicial `node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs`: 810 pruebas, 793 aprobadas, 17 fallidas. Registro `tests/output/auditoria_6_ciclos_inicio_20261029.log`.
- `node --test tests/cycle_snapshot_round.test.cjs tests/authoritative_worker.test.cjs tests/business_edge_auth.test.cjs tests/crear_partida_service.test.cjs`: 38 aprobadas, 0 fallidas. PGlite aislado cubre tres cierres y recuperación de reportes; no demuestra concurrencia.
- `node --test tests/production_model.test.js`: 13 aprobadas, 0 fallidas.
- `node --test tests/authoritative_worker.test.cjs`: 10 aprobadas, 0 fallidas.
- `node --test tests/side_rules.test.js tests/edge_lotes_equivalencia.test.cjs`: 12 aprobadas, 0 fallidas.

## Cobertura y límites

Calendario: 1–6 validados en `cycleSchedule`; el worker rechaza total 7. La validación de base de datos no está actualizada: `supabase/migrations/supabase_game_lifecycle.sql` admite hasta 20. No se ha demostrado cierre integral para cada total ni una matriz de inventario/caja/deuda de seis ciclos; no se fabrican valores. El identificador de capacidad en nuevos recibos no habilita reproducción histórica por sí solo.

Excel: los seis casos fallan primero en N5 (386 frente a 221) con entradas que asignan dos operarios a una mesa. No existe aquí comparación completa entre reglas equivalentes. Los estados monetarios existentes redondean a centavos; la comparación Excel de estas pruebas usa tolerancia 1e-8 para intermedios.

Recepción: NO IMPLEMENTADO. `production_model.js`, `engine/cierre.js`, `cycle_model.js` y `financial_model.js` tratan compras como disponibles; corregir requiere un contrato común de pedidos, contabilización y persistencia. UI de pedidos, pruebas de concurrencia/rollback y Edge desplegada: NO VALIDADO. Supabase remoto: sin cambios ni validación.

Archivos modificados: `js/production_model.js`, `js/side_rules.js`, `js/cycle_model.js`, `services/partida_service.js`, `supabase/functions/side-business-close/runtime.mjs`, pruebas y documentos de auditoría.

Suite general posterior: `node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs`: 812 pruebas, 795 aprobadas y 17 fallidas; `tests/output/auditoria_6_ciclos_final_20261029.log`. Fue iniciada antes de los últimos ajustes puntuales de validación y de las pruebas adicionales de worker y recibo; estas se ejecutaron separadamente con resultados verdes indicados arriba. No se presenta como validación completa de la última revisión.
