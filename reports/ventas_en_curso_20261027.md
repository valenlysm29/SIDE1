# Ventas visibles durante el ciclo

El usuario aclaró que consultaba los ingresos mientras el ciclo estaba en curso.
SIDE calculaba y registraba la venta económica únicamente al cierre. Por eso un
plan válido aparecía con cero ingresos antes del cierre. La partida indicada
fue SIDE-EB2B; su plan confirmado de 10 bolsos básicos produce una referencia
individual de 10 unidades vendidas y S/425, con los precios internos vigentes.
La consulta de la partida fue de lectura; no se escribieron decisiones reales.

Se añadió `SIDE_CYCLE_MODEL.project`: ejecuta el mismo cálculo físico y
financiero del cierre sobre copias. Aplica capacidad, materiales, mezcla,
reputación, calidad, mercado, stock y precio por unidad. Devuelve un recibo
provisional y estados financieros, sin exponer un estado o ledger para guardar.
No sustituye un cierre existente ni modifica históricos.

Al confirmar los cinco apartados, el Resumen y el detalle de Ventas muestran
unidades vendidas e ingresos estimados. La proyección es individual: no conoce
los planes privados de las otras empresas. El cierre compartido conserva el
reparto definitivo entre participantes y sustituye la proyección. Los importes
de caja proyectados se identifican como estimados; la caja guardada del HUD,
la cola de sincronización, los inventarios y los reportes remotos conservan
los movimientos efectivamente registrados.

No se cambió el catálogo, opciones, precios, botones ni distribución de las
decisiones. Los únicos textos adaptados corresponden a resultados calculados,
para identificar claramente una proyección frente a un cierre definitivo.

Validación:

- 19 pruebas de motor/documento/catálogo: el ejemplo del documento conserva su
  producción e ingresos; un plan básico válido proyecta 100 unidades y S/4250.
- Proyectar repetidamente no modifica decisiones, caja, ledger ni inventario.
  La falta de material o de canal mantiene ventas cero; no se inventa stock.
- Con dos empresas y mercado limitado, el cierre compartido reemplaza la
  referencia individual y respeta las 3500 unidades del mercado económico.
- Chromium verifica los cinco envíos reales de la interfaz, la aparición de
  100 unidades/S/4250 estimados, reportes guardados aún sin ventas anticipadas,
  caja intacta, desaparición de la proyección al cerrar y resultado definitivo.
- 38 pruebas adicionales de interfaz de sincronización, revisión y catálogo.
- PostgreSQL desechable confirma la persistencia del cierre, su idempotencia y
  ventas positivas para planes completos mediante el servicio real de cierre.

Las ventas definitivas siguen dependiendo de cerrar el ciclo con el docente;
la nueva proyección permite consultar el resultado esperado antes de ese paso.
