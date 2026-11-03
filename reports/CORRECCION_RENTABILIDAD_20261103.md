# Rentabilidad SIDE — corrección publicada, 3 de noviembre de 2026

## Causa comprobada
Proyecto Supabase SIDE: plfuwfdpsagzrlveqkvl. Partida SIDE-EWX8, ciclo 1, empresas 203 (Val2) y 204 (Demo1).
La etiqueta de la partida era excel-16, pero sus cierres se procesaban por side_business_closures con el motor md-20261027, trabajador secuencial 1. No existía economicRulesVersion en su configuración. Tener utility-v1 en el código no lo activaba: el valor predeterminado se añadía únicamente en la creación desde el frontend, no en las altas directas de base de datos.

Demo1 registraba sus máquinas en purchases, mientras la puntuación anterior solo buscaba quantities/optionIds. Su eficiencia se calculaba como 3 en vez de 5. Se aplicaban CONS-03 (100 × 70% = 70) y CONS-08 (70 × 95%, truncado = 66), aunque disponía de recursos para 100. utility-v1 ya reconoce las compras vigentes; activar la regla corrige esta reducción indebida sin eliminar penalizaciones reales.

Los precios internos anteriores eran S/ 42.50, 100 y 250. En Demo1, costo de ventas S/ 6,598.30 y gastos operativos S/ 6,401.62 superaban ingresos de S/ 2,805.00. En Val2, costo de ventas S/ 30,531.24 y gastos operativos S/ 22,459.75 superaban ingresos de S/ 30,000.00. Val2 contrataba seis operarios de producción, jefatura, analista de S/ 5,000, marketing y canal físico más web para 300 ventas.

Se revisaron materiales consumidos, salarios, gastos, mantenimiento, depreciación, garantías y demanda. No se encontró un doble cargo que explique estas pérdidas: compra de máquinas se mantiene como inversión, depreciación como gasto devengado y material sobrante como inventario. El mantenimiento programado y el mantenimiento por activos son conceptos existentes distintos; no se eliminaron cargos sin evidencia. Tampoco se rebajaron salarios ni se inventaron ingresos.

## Implementación
- Trigger de Supabase añade utility-v1 a nuevas partidas lifecycleVersion=2 aunque se creen por SQL/API sin frontend.
- Los clientes con configuración desactualizada no pueden borrar una activación existente.
- Migración activa las partidas abiertas compatibles sin versión desde el primer ciclo aún no sellado. Partidas finalizadas/canceladas y partidas con todos sus ciclos cerrados quedan fuera.
- SIDE-EWX8 queda con utility-v1 desde el ciclo 2. Su ciclo 1 oficial se conserva exactamente.
- Frontend, Node y ambos trabajadores Edge respetan economicRulesEffectiveRound. Se conserva el motor contable histórico de cada trabajador; trabajador 0 conserva su depreciación histórica de moldes.
- Se renovó la referencia de caché de finance_config.js en Estudiante y Docente. No se modificó la presentación ni las decisiones de Ventas/Finanzas.
- Edge Function side-business-close versión 16 desplegada y sus cuatro archivos descargados y comparados con los probados.

## Resultados reproducidos y escenarios
Los siguientes son recálculos de prueba, NO sustituciones de cierres oficiales.

| Escenario C1 | Producción | Ventas | Precio S/ | Utilidad neta S/ | Caja final S/ |
|---|---:|---:|---:|---:|---:|
| Demo1 original, reglas antiguas | 66 | 66 | 42.50 | -10,194.92 | 81,014.98 |
| Demo1 mismo plan, utility-v1 | 100 | 100 | 120 | -2,017.35 | 88,279.03 |
| Demo1 eficiente: canal web y publicidad cero, demás plan igual | 100 | 100 | 120 | 782.65 | 91,079.03 |
| Val2 original, reglas antiguas | 300 | 300 | 100 | -22,990.99 | 41,094.41 |
| Val2 mismo plan, utility-v1 | 300 | 300 | 150 | -8,140.99 | 52,194.41 |

La activación corrige precios y puntuación; no hace rentable automáticamente una estructura sobredimensionada. Los controles sin hilo, sin canal o con cuatro veces más personal siguen arrojando pérdidas.

Viabilidad de los precios solicitados: pruebas C1 con doce competidores reales simulados, capital de S/ 50,000 por empresa, dotación y materiales explícitos, demanda finita:

| Segmento | Precio S/ | Ventas por empresa | Utilidad neta S/ | Caja final S/ |
|---|---:|---:|---:|---:|
| Básico | 120 | 225 | 9,219.73 | 36,933.63 |
| Estándar | 150 | 250 | 17,144.13 | 43,430.88 |
| Prémium | 280 | 50 | 3,200.32 | 39,364.70 |

Estos importes son parámetros del simulador validados en esos perfiles, no precios de mercado externos ni una garantía para cualquier decisión. La demanda absoluta disminuye al elevar los precios; ventas nunca exceden stock ni demanda.

Continuidad con utility-v1, seis ciclos y recepciones/crédito verificados: utilidades 10,953.07; 10,953.07; 10,505.07; 10,505.07; 10,505.07; 4,112.43. Acumulado S/ 57,533.78; caja final S/ 241,500.06. Se comprueban inventarios, cobros, vencimientos, impuestos finales e idempotencia.

## Validación
47 pruebas aprobadas: 34 de rentabilidad real, activación SQL, equivalencia frontend/Node/Edge, caja, contabilidad, inventario, impuestos y seis ciclos; 13 de precios, puntuación, competencia, elasticidad y rutas de trabajadores. Logs locales en tests/output/rentabilidad-criticas.log y tests/output/rentabilidad-precios.log.

En Supabase se probó en una transacción revertida el alta directa sin versión y el guardado desde un cliente antiguo. Ambos conservaron la activación correcta; no se conservó ninguna sala QA. El contexto servidor transmite la configuración completa al trabajador.

Hashes globales antes/después idénticos:
- side_business_closures: 4ddca1a638bc0800e5b458246e3a5440
- side_excel_cierres: 121b7fc1f6988db4a71f54a5c4a56459
- reportes_ciclo (filas completas): d9d876913f6b4369fbca2bf9dc0f1dcf

Se preservaron todos los cierres y reportes históricos. Los resultados económicos nuevos son pruebas locales con el código de Edge descargado/verificado; no se fabricó un cierre oficial rentable en producción.

Publicación preparada sobre origin/main en un checkout aislado dentro de SIDE1 para preservar los cambios locales previos. Remoto verificado: https://github.com/valenlysm29/SIDE1.git.
