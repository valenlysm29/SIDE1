# Auditoría de cálculos: DOP y motor SIDE

Fecha: 22/10/2026. Auditoría separada de la implementación de la pantalla. Fuente: `.codex-work/DECISIONES_SIDE_16.xlsx`, SHA-256 `3b6b42bbbc56a2534ce7e241c607d572dd38dcf02311683609497df36a0c1eb1`. Se leyó el original con fórmulas y con valores; el original no se guardó. También se inspeccionó la copia recalculada por Microsoft Excel 16.0. Inventario de las diez hojas, errores y nómina: `tests/output/dop-20261022/audit_readonly.json`.

## Cobertura de revisión

No se limitó la revisión al DOP. Las diez hojas contienen 871 celdas de fórmula (incluidas fórmulas matriciales) y se contrastaron estas familias:

| Hoja | Familias y código contrastado | Resultado / criterio |
|---|---|---|
| Instrucciones | alcance de lotes y calidad por lote | Documento de reglas; sin fórmulas propias. No se agregan decisiones. |
| DECISIONES | cuatro grupos adicionales frente al catálogo congelado | Los grupos retirados de la UI no se vuelven a exponer por esta tarea. |
| Catalogo_Decisiones | 68 opciones, precios, aportes y descripciones | `js/engine/catalogo_excel.js` mantiene el catálogo completo. No confundir costo referencial de catálogo con nómina mensual de Costos. |
| Seleccion_Ciclo0 | búsquedas de código y aportes de columnas F:I | `js/engine/puntajes.js:12`: filtra grupos autorizados y suma por grupo. La ampliación histórica del rango 2:57 es explícita. |
| Lotes_Produccion | SUMPRODUCT cantidades/costos, calidad por lote, umbrales 0/4/7 | `js/engine/puntajes.js:5`: costos referenciales sumados por lote y calidad ponderada. No es el costo material físico de manufactura. |
| Motor_Puntajes | B6 y B9:B11, niveles 4/7 | `js/engine/puntajes.js:12`: ponderación por cantidad deseada y aportes; no se sustituye por unidades fabricadas. |
| Matriz_Consecuencias | ocho condiciones, precios ±35%/+40%, reputación ±2, producción 70% y -5%, demanda -20% | `js/engine/consecuencias.js:13`: reglas textuales más las constantes históricas expresamente pendientes; no hay nuevas tarifas. |
| CANTIDAD DE PRODUCCIÓN | personal × productividad × máquina, cuello de botella, 24 días, eficiencia literal, reparto ROUNDDOWN, necesidades y consumo real, inventario, ventas | `js/engine/produccion.js:36/79`, `inventario.js`, `mercado.js:3`; se mantienen separadas las necesidades deseadas y la producción limitada por materiales. |
| Costos De Producción | nómina MYPE/NO_MYPE, adquisición/instalación/capacitación, mantenimiento, depreciación, materia prima, reputación y mercados | `js/engine/costos.js:19/32/78` y `mercado.js:3`; las funciones literales existentes se reutilizan en el editor histórico. |
| FlujoWeb | ciclo manual/automático, espera y resultados | Sin fórmulas; flujo de estados, no fuente de importes. |

Revisión transversal: `js/engine/ciclo.js` limita producción y aplica consecuencias, consume solo lo fabricado, arrastra inventarios, vende FIFO y replica decisiones según las reglas históricas. `js/engine/caja.js:12` conserva una única ecuación de cierre: caja inicial + cobros + préstamos − pagos operativos − compras de activos. La depreciación es gasto sin desembolso; la compra de materias primas se paga aunque aún no se consuma. `js/financial_model.js` concilia el libro de movimientos del flujo histórico; no se usa su contabilidad simplificada para afirmar que existe paridad literal de todas las cuentas con el Excel.

## Discrepancias corregidas del flujo histórico

| Hallazgo | Código previo | Excel y salida correcta | Corrección |
|---|---|---|---|
| Nómina cobrada como sueldo base y corte N2/N3 tomado del catálogo | `js/decision_review_model.js`, antigua `unitCost` tomaba `option.cost`; `js/production_model.js`, `payroll` sumaba los mismos costos | Costos U11/U20/U29 = 1690,80 / 2254,40 / 4191,36. Antes: 1500 / 2500 / 4000. Ensamble/acabado Y11/Y20/Y29 y AC11/AC20/AC29 = 1690,80 / 3104,16 / 4952,40. Antes: 1500 / 2800 / 4500. | Reutilizar `SIDE_EXCEL_COSTOS.costoLaboral(rol,nivel,'MYPE').pagoMensual`. MYPE es el régimen predeterminado que ya usa el motor; no se añadió un selector. |
| Jefatura y limpieza sin cargas laborales | La misma función cobraba 3000 y 600 | Costos U39 = 3321,60; Y39 = 712,32. Con local 2000: total obligatorio **2712,32**, caja **97287,68** sobre 100000. | Mismo proveedor de nómina; no se redondean importes del motor. |
| Precios productivos cobrados como si fueran precio por presentación de compra | `unitCost` y `materialCost` multiplicaban cantidad de pieles/carretes por 45/4/etc., sin convertir rendimiento ni aplicar 8% | Costos D32:K33 convierte pieles a m² y carretes a metros; V76:W83 aplica precio por unidad productiva y 8%. Ejemplo: una piel estándar = 2 × 45 × 0,92 = **82,80**; un carrete básico = 270 × 2 × 0,92 = **496,80**. | Nueva función común `precioCompraMateriaPrima`, reutilizada por caja/revisión y plan. El analista aplica después su descuento histórico. |
| Descuento del analista duplicado en el modelo de revisión | `discount` volvía a escribir 12 − 2 por ciclo con mínimo 2 | Parámetros existentes `ANALISTA_BASE`; no son una fórmula nueva del libro | Se reutiliza `descuentoAnalista()` del motor. |
| Compra de activos sin instalación ni capacitación | `unitCost` y rama MOLDE solo cobraban adquisición: mesa 2500, ensamble básico 3500, acabado básico 1200, molde básico 300 | Costos U45:U47, Y45:Y47, AC45:AC47 y U53:U54: desembolsos MYPE **2625 / 3675 / 1260 / 303** | Se reutiliza `costoMaquinaria(...).salidaCompra` en los cargos y su precio visible. La liquidación conserva la política previa sobre adquisición, sin devolver instalación/capacitación. No se vuelve a comprar un activo ya conservado. |
| Precio visible y cargo podían usar caminos separados | `app.js` calculaba `optionUnitCost` independientemente | La misma cantidad debe tener el mismo costo en el DOP, la revisión y la caja | La integración delega el precio visible a `SIDE_REVIEW_MODEL.unitCost`. |

Las opciones conservan su costo referencial para metadatos históricos; los cargos efectivos se consultan mediante la función común. Las descripciones del catálogo aclaran régimen MYPE, presentación de compra y descuento general. No se reescriben movimientos de caja ya guardados.

## Diferencias del Excel y extensiones que no se ocultaron

1. **Capacidad contradictoria entre hojas:** CANTIDAD E5:E7=5/7/9, E17:E19=6/7/10 y L5=24 días; Costos usa 6/8/12 y 30 días. N5 del ejemplo recalculado da respectivamente **396 y 382**. La configuración operativa conserva CANTIDAD; el oráculo de cada hoja usa sus propias entradas y tabla. No se modifica una hoja para forzar igualdad.
2. **No existe inversa única cantidad → operarios/máquinas/tiempo.** Las dotaciones y asignaciones de máquinas son entradas; no hay regla de optimización, redondeo a trabajadores, ni horas por jornada. El DOP informa la necesidad de materiales, escenarios de costo por calidad y las magnitudes no determinadas como pendientes. No asigna un personal mínimo inventado.
3. **Eficiencia literal:** CANTIDAD M5 cuenta N3 solo en F7/F13/F19; no todas las máquinas. No impone tope de 100%. El motor Excel mantiene esta literalidad. El emparejamiento personal/máquina y el tope histórico de la comparación operativa se distinguen de las fórmulas originales; no se presentan como una inversa del Excel.
4. **Mermas:** no hay tasa explícita de merma de materias primas en estas hojas. El consumo se obtiene por unidad realmente fabricada y coeficiente de molde. Las reducciones de producción de CONS-03/08 no se convierten en una tasa de compra adicional ni en desperdicio inventado.
5. **Nómina:** la suma anual usa un solo mes de Essalud, CTS manual y divisores 12,5/13. Se conserva la fórmula literal, sin cambiarla silenciosamente por normativa externa. Corte N2/N3 de Catálogo (2500/4000) contradice Costos (2000/3800); para cobrar nómina se usa Costos, porque incluye el cálculo completo.
6. **Materias primas:** AB76:AC84 usa algunas cantidades incrustadas incompatibles con los metros convertidos de D33:K33. El cálculo toma la tabla rotulada de precio por unidad productiva V76:X83 y la conversión explícita. Los consumos del ejemplo F54:F61 y la valorización AB88:AC96 tampoco están totalmente enlazados; el fixture literal se conserva y el juego consume lo efectivamente fabricado. No se inventa CEILING de paquetes.
7. **Consecuencias sin importe definido:** horas extra 25%, almacenaje S/ 2 por unidad, +3 pp TEA, política de descuentos multiplicativos y algunos costos de tiendas siguen siendo decisiones configuradas históricamente, identificadas en `PENDIENTE_DEFINIR`; no se atribuyen al Excel.
8. **Mercados:** el juego ya usa calidad propia del motor, mientras la columna de calidad de los ejemplos de ventas es participación de reputación. La modalidad literal de prueba y la operativa se mantienen diferenciadas. Las sumas independientes de ROUND pueden dar 799 en un mercado de 800; no se añade reparto del resto.
9. **Caja y préstamos:** el libro no fija cuotas de amortización ni calendario de cobranza; no se inventan cuotas ni cobros adicionales. La tasa mensual y los estados financieros del juego son generalizaciones históricas documentadas, verificadas por fórmulas independientes del oráculo.
10. **Maquinaria y contabilidad histórica:** Costos separa adquisición, instalación, capacitación, mantenimiento y depreciación. La compra del editor histórico ya reutiliza la suma explícita de adquisición+instalación+capacitación. Su contabilidad sigue contabilizando suministros como gasto al comprar y activos por el importe pagado, sin un asiento mensual adicional de depreciación; no se reintroduce por esta tarea el sistema de cierre que el usuario revirtió. La cuota de mantenimiento mensual del motor Excel existe, pero añadirla al débito inicial del flujo histórico requeriría precisar qué activos comprados durante el ciclo la devengan y si reemplaza el control preventivo actual. Se documenta como diferencia pendiente de integración de reglas, no como igualdad literal. La liquidación al 40%, indemnización al 50%, crédito disponible y comisiones de venta son extensiones del juego, no fórmulas literales del libro. No declarar igualdad total de reglas que el Excel no define.

## Errores originales comprobados

- CANTIDAD E75/G75/E123/G123: **#DIV/0!** aparece al recalcular una copia intacta del original (su caché previa no mostraba errores). C75 además apunta a F51 en vez de un cociente de producción. Para reputación se utiliza Costos C65:G65.
- Lotes J2:J4: `IFS` sin prefijo se recalcula como **#NAME?** en Excel 16.0 aunque la caché original contenga 0. El oráculo histórico usa compatibilidad `_xlfn.IFS` únicamente en copias. No se tocó el original ni se afirmó que el libro completo está libre de errores.
- Cuando las cantidades deseadas son todas cero, CANTIDAD E37:E39 divide por D36=0. La protección explícita del juego devuelve necesidades 0 y no inventa una dotación ni compra. Esa protección no se atribuye a la fórmula original.

## Verificación de esta área

- Lectura independiente de las diez hojas y de las once salidas de nómina MYPE de la copia Excel recalculada; hash original sin cambios.
- `node --test tests/decision_review_model.test.js tests/costos_excel.test.cjs`: **27/27**, sin fallos. Incluye la regresión de todos los niveles de nómina, compra de activos con instalación/capacitación y compras reales del fixture: **S/ 24987,20** netos.
- Los nuevos escenarios del DOP y el oráculo recalculado, las simulaciones y la batería completa corresponden a la integración final; sus resultados se registran en el informe principal. Este documento no sustituye una corrida pendiente por una afirmación de éxito.

No se ejecutó SQL ni se modificaron Supabase, avatares o mundo 3D desde esta área.
