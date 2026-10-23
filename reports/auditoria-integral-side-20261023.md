# Auditoría, corrección y validación SIDE — 23 de octubre de 2026

## Resultado y alcance

Cinco especialistas participaron: DOP, producción/ventas, contabilidad, frontend e integración/QA. Se respetó el límite de cuatro agentes simultáneos incluido el coordinador. Todo el trabajo se realizó dentro de SIDE1, sobre main y el remoto https://github.com/valenlysm29/SIDE1.git, inicialmente sin modificaciones locales.

El flujo activo es index.html / docente.html → production_model / revenue_model / cycle_model / financial_model y servicios de partida. El motor antiguo engine/ui_excel y engine/caja no está cargado por las páginas entregadas; sus pruebas no acreditan por sí solas el flujo actual.

## Causas reproducidas y correcciones

**DOP.** production_dop asumía que todo plan tenía materials; planes persistidos con requirements/comparison provocaban excepción al acceder a materials.find. También asumía ResizeObserver y SVG montado. Ahora normaliza ambos formatos sin modificar el snapshot, monta con observación opcional, conserva los conectores y limpia los listeners. Las pruebas reproducen estas condiciones; no se afirma que fueran la causa de toda incidencia histórica de navegador.

**Ventas.** Al reconstruir el plan enviado para el cierre se perdía el inventario de materias primas vigente y la semilla contable; se conservaban sólo ciertos campos internos. restoreState conserva el estado interno vigente con las decisiones congeladas. El cierre conserva inventarios MP/PT, recibo y datos contables por ciclo. Además se corrigieron ingresos sin canal, comisión omitida para web, y pérdida de ventas POS cuando la demanda final resultaba menor que las ventas ya realizadas. El total se limita a existencias y sustituye el importe del ciclo sin sumarlo dos veces. Los eventos comerciales dejan de multiplicar ingresos sin unidades: afectan la demanda antes de servirla. No se alteraron probabilidades ni tablas de reparto del mercado.

**Contabilidad.** El modelo anterior llevaba compras de insumos directamente a gasto, mantenía activos al costo sin depreciación y no calculaba renta ni intereses en la ruta activa. Ahora reconoce compras de MP en inventario, consumo real, costo productivo y costo de las unidades vendidas; el PT no vendido permanece valorizado. Se separan MOD, administración, comercialización, activos, deuda, intereses y tributos. Los activos y el principal del crédito quedan fuera del gasto. Comisión: 1% de ventas efectivas. Se registran provisiones de garantías con tarifas respaldadas por catálogo. Impuesto e intereses se devengan como pasivos; no se inventan pagos que no existan en el ledger.

**Históricos y persistencia.** Cada cierre congela política, decisiones, recibo e inventarios valorizados. Se añadieron snapshots financieros inmutables. La revisión final detectó que SQL descartaba ese campo: la función de guardado ahora lo conserva y la migración adicional recupera snapshots de cierres persistidos sin sobrescribir los existentes. Se probaron autorización docente, CAS, cierre atómico, rechazo prematuro e idempotencia.

**Presentación.** Alumno, oficina, historial y profesor comparten las doce filas del ER (incluidos los dos gastos operativos). El balance muestra inventarios y activos netos. Las advertencias de política se muestran escapadas; se actualizaron versiones de caché de los scripts modificados.

## Fórmulas verificadas

- Ventas = suma de unidades efectivamente vendidas × precio de cada producto.
- Utilidad bruta = ventas − costo de ventas.
- Gastos de operación = administración + ventas.
- Utilidad operativa = utilidad bruta − gastos de operación.
- Utilidad antes de impuestos = utilidad operativa + ingresos financieros − gastos financieros.
- Impuesto = máximo(0, utilidad antes de impuestos × 0.295).
- Utilidad neta = utilidad antes de impuestos − impuesto.
- Tasa del ciclo = (1 + TEA/100)^(meses del ciclo/12) − 1.

Convención: ciclo contable mensual, año de doce meses; no se confunde con los 24 días laborables productivos. Redondeo monetario a céntimos. Depreciación lineal y vidas útiles existentes, con configuración explícita documentada en docs/politica_contable_cierre.md. No se presume rendimiento financiero de caja.

## Pruebas ejecutadas

| Ejecución | Resultado y evidencia local |
|---|---|
| Suite global inicial | 593 pruebas, 558 aprobadas, 35 fallidas; tests/output/integral-baseline-20261023.log |
| Suite global final | 615 pruebas, 580 aprobadas, 35 fallidas; tests/output/integral-final-verified-20261023.log |
| Comparación de nombres de fallas globales | Sin nuevas fallas respecto de baseline |
| Suite crítica final de ocho archivos | 48/48 aprobadas; tests/output/integral-critical-final-20261023.log |
| Chromium, tres ciclos con aplicación entregada | Aprobada; tests/integral_cycle_ui_20261023.cjs; tests/output/qa-integral-20261023/ |
| Profesor/estudiantes, PostgreSQL local y Chromium | Aprobada; tests/output/integral-lifecycle-20261023.log |
| Cierre PostgreSQL actualizado, snapshots y redeploy | Aprobada; tests/output/integral-closure-final-20261023.log |
| Almacén y WebGL real | Aprobada; entrega/cobro únicos tras recarga, pausa/reanudación, sin excepciones; tests/output/integral-world-business-20261023.log |
| Sintaxis de ocho JS modificados y git diff --check | Aprobadas |

La batería crítica cubre utilidad positiva, pérdida, ausencia de ventas, compras de activos, crédito/TEA, inventario sin vender, inventario previo, canales, comisión, garantías, impuesto, snapshots y fórmulas. El navegador de tres ciclos usa funciones reales de aplicación y desgloses/ledger confirmados; no automatiza cada clic del catálogo. El lifecycle sí crea partidas desde interfaz y conecta estudiantes a PostgreSQL local. No se presenta esa evidencia como prueba de Supabase remoto.

Las 35 fallas globales preexistentes NO están aprobadas: incluyen referencias a funciones retiradas de UI Excel, oráculos de DOP anterior, expectativas de costos automáticos anteriores y un contrato estático que prohíbe cargar engine/ aunque mercado/costos activos lo necesitan. Permanecen en la suite para revisión, sin borrarlas ni deshabilitarlas. Las nuevas pruebas actuales pasan, pero la suite global aún retorna código 1.

## Archivos modificados

Producción: index.html, docente.html, js/app.js, js/cycle_model.js, js/docente.js, js/financial_model.js, js/production_dop.js, js/revenue_model.js, js/student_financial_view.js y services/partida_service.js.

Persistencia: supabase/migrations/20261023_cierre_negocio.sql y nueva supabase/migrations/20261023_persistir_snapshots_financieros.sql.

Pruebas: business_closure_independent_db.cjs, business_cycle.test.cjs, production_dop.test.js, revenue_excel_current.test.cjs, student_financial_summary.test.js; nuevas accounting_integrated.test.cjs, financial_presentation.test.cjs, sales_accounting_integration.test.cjs e integral_cycle_ui_20261023.cjs.

Documentación: docs/politica_contable_cierre.md, reports/qa-integral-20261023.md y este informe. Los registros y capturas de ejecución permanecen locales en tests/output.

## Estado, límites y despliegue

DOP, ventas, ER y su integración pasan las pruebas críticas descritas. El mundo 3D conserva su implementación y pasó la prueba de negocio WebGL.

La cobertura de garantía de 180 días no tiene tarifa fuente: requiere financialPolicy.warrantyUnitCosts[180]; se muestra advertencia y no se inventa gasto. Las garantías 30/90 usan S/5 y S/10 por unidad vendida del catálogo existente. Los inventarios migrados sin cantidades iniciales necesitan corrección explícita para atribuir consumo; no se reescriben resultados históricos importados.

Las migraciones se ejecutaron en PGlite local, no en el Supabase alojado. Para actualizar una instalación existente debe aplicarse 20261023_persistir_snapshots_financieros.sql después de 20261023_cierre_negocio.sql. El push de Git no aplica SQL a Supabase ni demuestra un despliegue web. Hash final y recepción de origin/main se verifican al publicar y se comunican en la respuesta de entrega.

Se comprobó que el directorio padre contiene únicamente SIDE1; no se crearon artefactos fuera del proyecto. No se modificó ningún repositorio ajeno.
