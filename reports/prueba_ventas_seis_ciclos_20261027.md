# Prueba de seis ciclos completos — 27/10/2026

Resultado: seis ciclos completados, con ventas y unidades vendidas positivas en todos.
Total vendido: **740 unidades**. Ingresos acumulados: **S/ 131,950.00**.

## Decisiones seleccionadas

Capital inicial S/200000, seis ciclos manuales, sin eventos externos ni préstamos.
En el ciclo 1 se compró una mesa y una máquina básica de ensamble y de acabados.
Se compró el molde básico en el ciclo 1, el mejorado en el 2 y el premium en el 3.
En ciclos 4–6 se reutilizaron los moldes y equipos adquiridos, sin recomprarlos.

Cada ciclo: un operario básico de corte, un costurero básico y un operario básico
de acabado; sin jefatura ni analista; garantía de producto de 30 días; cuero
sintético, accesorios económicos e hilo estándar en las cantidades calculadas
para cada plan; canal web; sin capacitación e inversión baja en marketing.
Local y limpieza corresponden a los costos obligatorios existentes.

Las cantidades y opciones se eligieron en los controles reales. No se asignaron
decisiones directamente al estado del motor. Se enviaron las cinco secciones en
cada ciclo: 30 envíos, seis cierres mediante el botón docente y seis avances.

## Resultados definitivos

| Ciclo | Plan | Producidas | Vendidas | Ingresos | Utilidad neta | Caja final |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Básico: 100 | 100 | 100 | S/ 4,250.00 | S/ -8,334.60 | S/ 183,516.53 |
| 2 | Medio: 120 | 120 | 120 | S/ 12,000.00 | S/ -1,715.30 | S/ 179,122.36 |
| 3 | Premium: 100 | 100 | 100 | S/ 25,000.00 | S/ 6,983.67 | S/ 181,631.81 |
| 4 | Mixto: 40 + 40 + 40 | 120 | 120 | S/ 15,700.00 | S/ 934.63 | S/ 185,701.06 |
| 5 | Premium: 140 | 140 | 140 | S/ 35,000.00 | S/ 12,589.83 | S/ 195,892.51 |
| 6 | Premium: 160 | 160 | 160 | S/ 40,000.00 | S/ 15,392.91 | S/ 214,664.96 |

Los ciclos con pérdida siguen teniendo ventas: utilidad e ingresos se verifican
por separado. La caja incorpora compras, cobros y ventas a crédito; no equivale
a sumar todos los ingresos al capital inicial.

## Comprobaciones

- Alumno y docente coinciden en ventas e ingresos de cada ciclo.
- Los resultados definitivos son visibles; no se presentan proyecciones como cierres.
- Se recargó la página después de cada cierre: ventas, caja e historial se conservaron.
- Se repitió cada cierre: no se duplicaron producción, cobros ni ventas.
- Los seis snapshots elegidos en navegador se procesaron con el servicio real de
  cierre y las funciones SQL actuales en PostgreSQL local desechable.
- Recibos, reportes SQL, ledger, estados financieros y reconexión coinciden.
- Se conservaron los seis períodos y sus unidades vendidas; ventas no exceden stock
  ni consumo de materiales excede existencias. Los balances cuadran a céntimos.
- Cero errores de página. No se cambió el código ni los controles de decisiones.

## Alcance y evidencias

Los seis ciclos se ejecutaron en un entorno aislado de prueba con las páginas
entregadas de alumno y docente y persistencia SQL local. No se creó ni cerró una
partida en Supabase alojado. La consulta remota de solo lectura al validador SQL
devolvió HTTP 200 y true para los precios internos 42.5 / 100 / 250, confirmando
que esa validación remota está actualizada.

Evidencias en tests/output/sales-six-cycles/: ui.log, ui-results.json, db.log,
db-results.json, remote-sql-check.json y cycle-1-sales.png a cycle-6-sales.png.
Pruebas reproducibles: tests/sales_six_cycles_ui.py y tests/sales_six_cycles_db.cjs.
