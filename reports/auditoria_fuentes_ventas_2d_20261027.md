# Auditoría de las fuentes del motor 2D — 27/10/2026

Revisión de solo lectura de los dos libros, el Markdown de costos recibido y los
documentos de lógica anteriores. No se modificaron libros, `index` ni el mundo 3D.

## Fuentes revisadas individualmente

| Fuente | Comprobación | Aplicación al motor vigente |
| --- | --- | --- |
| `docs/Logica_SIDE_Costos_de_Produccion.md` | Lectura completa de sus 11 secciones y ajustes recomendados. El bloque oficial de ventas es A113:N152; las filas 65–109 son un boceto excluido expresamente. | Criterio actual: capacidad → materiales → producción → reputación/calidad → mercado → ventas → ingresos y gastos. |
| `docs/DECISIONES_SIDE_logica_produccion.xlsx` | Inspección de las 10 hojas y fórmulas/valores guardados; extracción específica de Costos K5:N5, producción, consumo y bloque A113:N152. | Conserva el ejemplo original de 368 producidas y reputación 11.187635/40. La producción E46:E48 está escrita a mano y el consumo original descuenta la meta, no la producción efectiva. Debe aplicarse la corrección del Markdown. |
| `docs/DECISIONES_SIDE_19.xlsx` | Inspección de las 15 hojas y fórmulas/valores guardados, incluidos sus oráculos añadidos. | Es un libro previamente adaptado: Costos N5=265, C113:F113=0, G113 enlaza a Motor_Puntajes!B10=0. No reproduce el documento actual de forma literal. |
| `docs/logica_excel/ESPECIFICACION.md` | Revisión de reglas consolidadas, diferencias por hoja, secuencia del ciclo, tablas de mercado y datos enviados al profesor. | Antecedente de octubre: propone 24 días, reputación de fila 65 y algunas consecuencias numéricas antiguas. Estas reglas fueron sustituidas por la especificación actual de 30 días y bloque oficial 113. |
| `docs/logica_excel/metadatos_excel.json` | Identificación de la fuente y las 10 hojas originales. | Su SHA identifica DECISIONES SIDE (16), no los dos libros actuales. No debe presentarse como verificación de los archivos actuales. |
| `docs/logica_excel/fixtures_excel.json` | Procedencia de los bloques producción, costos, mercado y consecuencias. | Útil como evidencia histórica literal; las expectativas actuales deben calcularse desde el Markdown de costos y consumos reales. |
| `docs/LOGICA_PRODUCCION_EXCEL.md` | Revisión de capacidad, reservas y mezcla proporcional. | Describe una modificación de otro bloque del libro; declara expresamente que no modificó entonces el motor JavaScript. No sustituye la prioridad N1→N2→N3 del documento actual. |
| `docs/actualizacion_logica_documento_20261027.md` | Revisión de las reglas actuales, continuidad de decisiones existentes, valoración y separación de costos/caja. | Consistente con el documento vigente y con los controles existentes. Precios y asignación por máquina se resuelven internamente. |
| `docs/COSTOS_CICLO_Y_CALCULADORA.md` | Revisión de continuidad de personal, costo fijo y libro por sección. | Los costos de cada sección deben persistirse una vez; una proyección de ventas no puede abonar caja ni borrar gastos. |
| `docs/separacion_2d_3d.md` | Revisión del contrato de publicación y recibos recreativos. | Ventas y unidades económicas salen del motor 2D; los recibos, puntos y pedidos 3D no generan ingresos económicos. |

Los dos libros actuales no contienen errores en sus valores guardados. Esto solo
describe sus cachés: no prueba un recálculo de todas las fórmulas en Excel. No se
guardó ni alteró ninguno de los archivos fuente.

## Contraste numérico independiente

El documento conserva entradas del Excel antes de corregir sus referencias. Al
aplicar sus propios ajustes recomendados, el escenario produce:

- Capacidad por día: corte 14, ensamble 31.4, acabado 24.
- Eficiencia 0.92 contando los dos trabajadores N3; capacidad mensual 386.
- Meta 150/140/95; fabricación efectiva 150/140/78 por el límite de hilo.
- Consumos reales: cuero 155.6 m², accesorios 368 unidades e hilo 2894 metros.
- Reputación 2.776017/10, calculada sobre materiales realmente consumidos.
- Ventas con demanda suficiente: 368 unidades. A precios 40/120/250: S/42300.
- MP consumida S/21962.24 e inventario MP final S/3024.96 con descuento base de 8%.

La cifra S/22613.60 del ejemplo original valoriza material de bolsos deseados
que no se fabricaron. Reutilizarla junto a la producción corregida descuadra los
inventarios. El costo de adquirir equipos sale de caja y se registra como activo;
la depreciación y el mantenimiento corresponden al ciclo.

## Hallazgos para la corrección del flujo

Las fórmulas actuales no necesitan ventas ficticias ni recursos 3D. Un plan
físicamente viable produce y vende mediante el motor existente. La avería debe
buscarse también en la representación de planes heredados, guardado y cierre.

La interfaz permite infraestructura y personal sin selección porque esas
decisiones son opcionales. Si falta una etapa productiva, el cálculo entrega cero
correctamente; el diagnóstico debe identificar el recurso faltante, sin fabricar
stock ni ingresos de demostración. Las compras de cuero e hilo de la interfaz se
expresan en m² y metros, respectivamente; no deben multiplicarse nuevamente por
pieles, rollos o carretes del Excel.

También se observó una diferencia de tipado en código legado: el motor compara
los ciclos numéricamente, mientras algunas lecturas de borradores usaban igualdad
estricta. Un ciclo guardado como texto exige normalización consistente para no
convertir una decisión existente en un borrador vacío. Es un caso de compatibilidad,
no evidencia por sí solo de la causa de una partida real.

## Verificación ejecutada

41/41 pruebas focales aprobadas al comenzar la revisión: `md_logic`,
`production_model`, `mercado_excel`, `revenue_excel_current` y `sales_recovery`.
Cubren el ejemplo numérico completo, los tres segmentos, stock inicial, límites
físicos, costos, varias empresas, tres ciclos e idempotencia del cierre.

La evidencia de fuentes se conserva localmente en
`tests/output/excel_sources_audit_20261027.json`, con SHA-256, inventario por hoja
y fórmulas/valores específicos. El script de extracción permanece en
`tests/output/audit_excel_sources_20261027.py`. No se usaron estas pruebas para
afirmar que la base remota tenga aplicadas todas las migraciones.
