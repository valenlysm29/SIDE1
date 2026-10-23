# QA integral SIDE — 23 de octubre de 2026

Responsabilidad: agente independiente QA, sin edición de código productivo. Ejecución desde SIDE1; resultados en tests/output.

## Validación ejecutada

- `node --test tests/business_cycle.test.cjs tests/accounting_integrated.test.cjs tests/sales_accounting_integration.test.cjs tests/financial_presentation.test.cjs tests/production_dop.test.js`: **34/34 PASS**, registro `tests/output/qa-critical-current-20261023.log`.
- `node tests/integral_cycle_ui_20261023.cjs`: **PASS**, Chromium contra HTML/CSS/JS entregados de index.html. Tres ciclos consecutivos con decisiones y borradores, secciones financieras generadas por SIDE_REVIEW_MODEL, cargos reales del ledger, productionPlan(), productionDopHtml(), captureCyclePlan(), settleCycle(), financialReport() y renderStudentStatus(). Verifica 100 unidades producidas por ciclo, ventas positivas limitadas a existencias, ingresos unidades × 75, Costo de Ventas positivo, impuesto 29.5%, histórico inmutable, cierre repetido sin operaciones y ausencia de excepciones JS. Evidencia `tests/output/qa-integral-20261023/browser-cycle-results.json` y `student-dop-and-finance.png`.
- `node tests/game_lifecycle_ui.cjs`: **PASS**, PGlite + Chromium. Profesor crea partida desde interfaz, código/enlace, dos estudiantes, espera, apertura decisiones, permisos puente 3D, eventos, cancelación con fallo/reintento, automático, reloj, recarga, reingreso desde otro cliente, diseño móvil y cero errores JS. Registro `tests/output/qa-lifecycle-ui-20261023.log`.
- `node tests/business_closure_independent_db.cjs`: **PASS** tras ajustar expectativas de caja para comisión real de 1%. Autorización, CAS/revisión obsoleta, idempotencia, cierre alumno desconectado, rechazo cierre prematuro y capital posterior. Registro `tests/output/qa-closure-db-20261023.log`. El agente financiero amplía posteriormente con snapshots SQL: volver a ejecutar esa versión antes de publicar.
- Prueba directa closeMany con inventario previo 10 y producción 0: **PASS**, vendió 10, ingresos 750 e inventario final 0, manteniendo mercado/reputación existente. Registro `tests/output/qa-prior-stock-20261023.log`.

## Hallazgos

- Tres fallas de production_dop_target_ui.test.js estaban ya en baseline: exigen la presentación antigua inversa del Excel, incompatible con el DOP operativo actual. No se atribuyen a correcciones recientes y no se presentaron como pruebas exitosas. Ejecución inicial: 29/32 PASS, log `qa-critical-20261023.log`.
- Prueba DB esperaba 199750 de caja con ventas 750; omite comisión 7.50 exigida. Expectativa corregida a 199742.50, y ajuste de capital equivalente a 249742.50. El canal web sí está presente; no se añadió un canal para ocultar errores.
- Root detectó que SQL no persistía snapshots financieros: delegado al agente financiero para corrección y prueba reproducible. No aprobar publicación sin pasar su test actualizado.

## Límites de la evidencia

El test nuevo ejecuta funciones de aplicación dentro del navegador y genera decisiones/secciones mediante APIs reales, pero no automatiza cada clic de selección ni usa Supabase remoto. Lifecycle cubre profesor/estudiantes con PostgreSQL PGlite y servicios conectados al fixture. La prueba 3D del root usa WebGL real; el lifecycle sustituye exclusivamente el cargador 3D para validar navegación. No se afirma despliegue de migraciones en Supabase remoto ni escritura en cuentas reales.

## Archivos propios

- tests/integral_cycle_ui_20261023.cjs: regresión nueva navegador y tres ciclos.
- tests/business_closure_independent_db.cjs: expectativas de caja con comisión (ediciones posteriores del agente financiero).
- reports/qa-integral-20261023.md: este reporte.
