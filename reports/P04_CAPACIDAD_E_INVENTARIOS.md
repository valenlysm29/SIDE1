# P0.4 — Capacidad productiva e inventarios

Código evaluado: `df3e42a91fdcdbead50772d2d11ba08dc67b94da`, rama `codex/p02-diagnostico-materiales`. Se consultaron P03, P02 y `docs/reporte_validacion_SIDE_6_ciclos.md`. No se cambió el código, el Excel original ni las pruebas existentes. Los scripts y salidas de esta auditoría están en `tests/output/p04/` (local e ignorado).

## Fórmulas y alcance de la comparación

En el Excel original `.codex-work/DECISIONES_SIDE_16.xlsx`, hoja `Costos De Producción`: I8 suma corte `Σ(tasa del nivel × trabajadores)`; I14 e I20 suman las asignaciones trabajador/equipo de ensamblado y acabado con multiplicadores. K5 toma el mínimo de I8, I14 e I20; L5 multiplica por 30 días; N5 redondea `L5 × M5`. Tasas por nivel: 6, 8 y 12 bolsos/día; multiplicadores de equipos básico, semiindustrial e industrial: 1, 1,2 y 1,5. El corte del Excel no limita explícitamente operarios por mesas. SIDE empareja como máximo un trabajador y una máquina por etapa, respeta asignaciones históricas válidas y asigna el resto internamente; suma capacidad de los pares, calcula cada etapa como `round(diaria × 30 × eficiencia)` y usa el mínimo. En los casos de esta auditoría las tres tasas diarias y el cuello de botella coinciden al igualar los recursos efectivos; esto no prueba todas las configuraciones de asignaciones ni todos los redondeos.

**Diferencia de eficiencia verificada:** el original usa `M5=K7+(F7+F13+F19)/100+4%*F21`, que solo suma una columna de nivel 3 en ensamblado y acabado. La copia utilizada en las pruebas históricas, `output/SIDE_prueba_cantidad_produccion_corregido.xlsx`, usa `M5=K7+SUM(F7,F13:H13,F19:H19)/100+4%*F21`; SIDE cuenta todos los trabajadores de nivel 3 de las tres etapas. Con los mismos trabajadores efectivos —corte 1 experimentado, ensamblado 3 y acabado 2, uno por equipo— se recalculó una copia del **original** con Excel 16: I8/I14/I20 = 8/31,4/24, M5 = 0,91 y N5 = 218. La copia corregida y SIDE dan las mismas tasas, M5 = 0,92 y N5 = 221. El original no equivale en este escenario; la intención de su fórmula requiere decisión documentada. No es evidencia suficiente para cambiar SIDE.

El libro original además contiene valores constantes en las celdas de producción inspeccionadas; la comparación física utiliza la **copia corregida**, cuyas fórmulas E46:E48 calculan secuencialmente básico, mejorado y premium, limitados por meta, capacidad restante y materiales. Por tanto los resultados siguientes no certifican el Excel original completo. El libro corregido es un oráculo modificado; sus diferencias frente al original deben seguir identificadas explícitamente.

## Escenarios de recursos equivalentes

Se conservó la configuración histórica salvo corte: F5=0 y F6=1 en el libro y un solo trabajador experimentado con una mesa en SIDE. Ensamblado usa tres trabajadores (tasas 6, 8, 12) asignados respectivamente a industrial, básica y semiindustrial; acabado usa dos (8 y 12) asignados a industrial y básica. Hay dos trabajadores nivel 3. Tasas resultantes: corte 8, ensamblado 31,4, acabado 24; eficiencia 92 %, 30 días y cuello de botella corte 221 unidades.

Se compararon 19 salidas por escenario: eficiencia, tres capacidades diarias, capacidad total, producción por los tres moldes, consumo de las tres familias y ocho saldos por SKU. `preparar.cjs` genera entradas y resultados SIDE en `planes.json`; `recalcular.ps1` recalcula copias con Microsoft Excel y guarda `excel.json`. Tolerancia de comparación: 1e-7. Los valores informados son cantidades físicas, no costos ni validación de ventas. Las compras del libro se convierten a las unidades físicas iguales a SIDE.

| Escenario adaptado de los seis históricos | Meta básico/mejorado/premium | Producción Excel corregido y SIDE | Resultado de las 19 salidas |
|---|---:|---:|---|
| Base, mezcla | 150/140/95 | 150/71/0 | Coinciden |
| Meta cero | 0/0/0 | 0/0/0 | Coinciden |
| Hilo insuficiente | 150/140/95 | 41/0/0 | Coinciden |
| Un molde premium | 0/0/100 | 0/0/100 | Coinciden |
| Capacidad limitada | 300/300/300 | 221/0/0 | Coinciden |
| Arrastre, tres ciclos | 50/30/20 por ciclo | 50/30/20 en cada ciclo | Coinciden en cada ciclo |

La extensión a seis ciclos sin compras posteriores produjo 50/30/20, 50/30/20, 50/30/20, 50/30/6, 0/0/0 y 0/0/0. En cada uno coincidieron las 19 salidas comparadas. Para cada ciclo se suministró a ambos la **misma apertura tomada del cierre SIDE anterior**: esto verifica cada transición con apertura equivalente, pero no es un encadenamiento independiente de los saldos Excel. Los libros recalculados son copias y se cierran sin sobrescribir el libro fuente.

Resultado: **6 de 6 escenarios adaptados coinciden en las salidas físicas enumeradas frente a la copia corregida**, no frente al Excel original ni en todas las variables económicas. Son escenarios nuevos con recursos equivalentes, no las mismas pruebas históricas aprobadas.

## Inventarios y cierres

`node --test tests/continuidad_seis_ciclos_activos.test.cjs tests/recepcion_preview_integracion.test.cjs tests/edge_lotes_equivalencia.test.cjs tests/temporal_production.test.cjs tests/p02_diagnostico_materiales.test.cjs tests/business_cycle.test.cjs` dio **45/45 aprobadas**, `tests/output/p04/regresion.log`.

La prueba local de seis cierres con PGlite, dos empresas y crédito comprueba por SKU `apertura + recibido - consumido = cierre`, continuidad de caja y balance, repetición idempotente de cierre y una recepción parcial entre ciclos. Una segunda empresa conserva producto no vendido en el ciclo 1 y vende inventario en el ciclo 2 sin producir de nuevo. Las pruebas temporales comprueban recepción explícita, pedido pendiente, fecha posterior y capacidad diaria no acumulada. Se trata de cierres autoritativos **simulados en base local**, no cierres oficiales remotos. Los escenarios de Excel anteriores usan compras instantáneas y no comparan su calendario de recepción. La comprobación cubre los flujos y SKU de las pruebas, no todos los modos o carreras.

## Estado de las seis pruebas históricas

Las pruebas originales se ejecutaron de nuevo sin alterar sus entradas ni aserciones: 0/6 aprobaron y las seis fallaron primero en N5, 386 frente a 221; sus resultados se registran en `tests/output/p04/historicas.log`. Usan dos cortadores con una mesa y, por ello, la comparación de N5 mezcla reglas distintas. Los seis escenarios adaptados anteriores muestran que la diferencia 386/221 desaparece con recursos equivalentes **en la copia corregida**. Las pruebas históricas no se declaran resueltas: conservan su entrada anterior y se detienen en la primera diferencia, sin verificar las restantes aserciones.

La fórmula de eficiencia del original sí presenta una diferencia adicional reproducible, 218 frente a 221 al igualar recursos. También están fuera de esta comparación los costos por SKU, valoraciones, precios y diferencias de reloj de recepción; no se puede concluir que no haya otras discrepancias. La limitación 1:1 es coherente con el contrato vigente y con el oráculo para los casos probados; no es una demostración de que sea la regla de negocio definitiva para todas las versiones de partida.

## Riesgos y siguiente tarea

1. Acordar y documentar si la eficiencia considera todos los trabajadores nivel 3 o solo los de las columnas originales, y el tratamiento histórico por versión. No corregir una fórmula sin esa decisión.
2. Mantener una comparación versionada con recursos, reglas y unidades equivalentes; ampliar a asignaciones, restricciones temporales y encadenamiento independiente de saldos. Conservar los seis casos históricos para describir la divergencia original.
3. Comparar costos y valoración de materias, productos terminados, ingresos y balances con un oráculo independiente; validar cierres remotos y concurrencia por separado.

La siguiente tarea concreta es revisar con la autoridad de producto la fórmula de eficiencia y formalizar el contrato de capacidad y eficiencia por versión, usando los dos resultados 218/221 como ejemplo reproducible. Después ampliar la conciliación física y económica con entradas equivalentes, sin alterar el simulador hasta acordar sus reglas.

