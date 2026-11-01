# Validación de mejora de utilidad de SIDE — avance parcial

Fecha: 1 de noviembre de 2026. Base: `origin/main` en `f7262256e9a0fcf268ce28ba85af8ba2c86b36a8`. Rama: `prueba_utilidad_mejora`.

## Candidatos internos versionados

La configuración experimental `utility-v1` utiliza por defecto S/ 120 / 150 / 280 para básico, mejorado y prémium. Son candidatos educativos, no precios empíricos ni activados para partidas nuevas. Las partidas sin esa versión conservan S/ 42,50 / 100 / 250. Los candidatos se resuelven internamente, se validan con el mismo verificador de precios, y pueden configurarse mediante `utilityPrices`; no se añadió ningún control al estudiante. El servidor y la Edge empaquetada usan la misma configuración explícita. La prueba `tests/precios_utilidad_versionada.test.cjs` verifica el aislamiento de versiones, los valores configurables y doce empresas por segmento con capital individual S/ 50.000.

| Segmento | Precio efectivo S/ | Producido / vendido | Utilidad S/ | Caja S/ | Movimientos negativos S/ |
|---|---:|---:|---:|---:|---:|
| Básico | 120 | 250 / 225 | 9.215,46 | 36.933,63 | 40.066,37 |
| Mejorado | 150 | 250 / 250 | 17.125,13 | 43.430,88 | 44.069,12 |
| Prémium | 280 | 50 / 50 | 3.144,91 | 39.364,70 | 24.635,30 |

Se trata de perfiles concretos en memoria, con doce empresas idénticas en cada mercado y sin recepciones parciales. Se comprobaron los movimientos negativos antes de ventas, no un calendario de tesorería completo. La prueba no justifica activar los parámetros hasta validar la regresión pendiente y su despliegue; tampoco demuestra una curva de mercado empírica. Las 20 pruebas focales de precios, calidad, demanda, maquinaria, recuperación, proyección y equivalencia Node/Edge pasaron.

## Proyección informativa en Estudiante

Producción ofrece un cálculo bajo demanda individual mediante `SIDE_CYCLE_MODEL.close` sobre copias de los datos, a partir de las decisiones actuales, sin guardar ni enviar el resultado. Presenta ingresos, costo de fabricación y unitario, costos y gastos, utilidad, caja, producción, demanda, ventas y precio efectivo. Ensaya hasta veinte metas de un único producto con los recursos y compras actuales; comunica la primera meta muestreada sin pérdida que supera el filtro de caja, o que no se encontró. No es un punto de equilibrio matemático exacto ni evalúa metas superiores a la elegida.

Se comparan contrafactuales calculados con el mismo cierre: reducción de una opción de personal, de una compra de equipo y de un insumo, y adición del canal web cuando corresponda. Se reconstruye el costo de la sección modificada. La pantalla muestra trabajadores, equipos y parejas activas por etapa y faltantes de insumos para la meta. La caja antes de ventas se estima sumando a la caja inicial los movimientos netos de las secciones de decisión una sola vez; la caja de cierre se calcula con el estado de flujo oficial. Se exigen ambas no negativas para mostrar alternativas. Se eliminó la reserva adicional que duplicaba costos. El modelo no registra fechas de cada pago dentro del ciclo: esta prueba agregada no demuestra que haya liquidez en cada fecha, ni contabiliza antes de las ventas los movimientos ajenos a las secciones. No se calcula para recepciones temporales y tampoco se presenta como reparto competitivo definitivo. Es necesario volver a pulsar calcular después de cambiar decisiones. No se modificaron controles ni se bloquean decisiones.

Corrección de reserva: las pruebas focales de `profit_projection.test.cjs` y `profit_projection_ui.test.cjs` verifican la caja previa a partir de los movimientos del cierre una sola vez, mantienen el descarte con capital insuficiente y comprueban que un caso con S/ 280.000 y caja previa de S/ 5.851,44 conserve alternativas. El flujo agregado no permite aún verificar cronológicamente compras y vencimientos.

Filtro de caja: `node --test tests/profit_projection.test.cjs tests/profit_projection_ui.test.cjs tests/competencia_utilidad_representativa.test.cjs tests/edge_lotes_equivalencia.test.cjs`: 11 pruebas aprobadas. Se verifica que las alternativas presentadas superen la reserva y que, con capital cero, no se ofrezca ninguna.

Pruebas: `node --test tests/profit_projection.test.cjs tests/student_financial_summary.test.js tests/business_projection_regression.test.js` (11 aprobadas). Se verifica que las cifras base coincidan con la proyección oficial, que los cuatro tipos de comparación se calculen y que no se modifiquen las entradas. Falta prueba visual en navegador y una evaluación completa de factibilidad de cada alternativa.

Una comprobación adicional de `tests/profit_projection.test.cjs` aprobó 3 pruebas, incluyendo la salida de la función de interfaz en un DOM simulado y sus avisos. `node --test tests/profit_projection_ui.test.cjs` pasó en Chrome sin interfaz: abre Producción, ejecuta el cálculo y verifica los resultados y que no se guarden decisiones. No sustituye una inspección visual ni la prueba de factibilidad financiera.

## Regresión general

Se ejecutaron los archivos `tests/*.test.js`, `tests/*.test.mjs` y `tests/*.test.cjs` con concurrencia 2: **947 pruebas, 927 aprobadas y 20 fallidas**; registro local `tests/output/regresion_utility_v1.log`. Incluye pruebas aprobadas de PostgreSQL real aislado y Node/Edge. Los fallos abarcan planificación DOP, comparación con Excel, reputación/mercado, transferencias manuales y pruebas de sincronización. No hay una línea base equivalente de esta ejecución para clasificarlos todos como previos o nuevos.

Las tres fallas de navegador de `decisions_apartados_ui.test.cjs` y `student_sync_ui.test.js` muestran `Unexpected token '<'`; al instrumentar la prueba, Chrome identificó la URL `js/landing-progress.js`, para la cual el interceptor de la prueba devuelve HTML. El archivo no forma parte de la proyección añadida. No se atribuye por ello una causa al resto de fallos. La regresión no está limpia y bloquea la activación automática de `utility-v1`.

Se corrigieron los interceptores de los dos fixtures para servir el JavaScript correcto. Al repetir solo esos archivos pasaron 17 pruebas, incluidos los tres casos antes fallidos. Los otros fallos de la regresión general permanecen sin clasificar mediante una ejecución de base equivalente; no se han cambiado fórmulas para hacerlos pasar. La suite general no se ha repetido después de esta corrección ni de los precios candidatos.

Después de los precios candidatos también se ejecutaron 32 pruebas focales adicionales de configuración histórica, cierre, competencia, producción, vista de estudiante y resumen financiero; todas pasaron.

**Estado: avance parcial.** Se implementaron una corrección de puntuación de maquinaria y una adaptación experimental de la bonificación prémium bajo la versión explícita `utility-v1`; no se activan automáticamente en partidas nuevas. El resto de la corrección integral sigue pendiente. Los resultados económicos siguientes caracterizan la versión anterior y no satisfacen la validación masiva. No se han actualizado cierres de Supabase.

## Avance: elasticidad de precio absoluto

Nueva regla educativa experimental para `utility-v1`: después de repartir competitivamente el mercado, cada asignación se multiplica por `min(1, max(1, precio efectivo / precio de referencia)^(-elasticidad))`. El precio efectivo pondera los lotes disponibles y sus bonificaciones o descuentos. La asignación ajustada no supera la asignada, y las ventas siguen limitadas por canal e inventario. Referencias supuestas: S/ 95 / 150 / 250; elasticidades supuestas: 1,1 / 1,2 / 1,3. Son parámetros de exploración, no precios de venta nuevos ni estimaciones empíricas. Se pueden configurar con `financialPolicy.utilityDemand`; el cálculo rechaza referencias no positivas y elasticidades negativas. La versión anterior conserva sus reglas de demanda.

Pruebas focales: `node --test tests/demanda_absoluta_utilidad.test.cjs tests/edge_lotes_equivalencia.test.cjs tests/calidad_utilidad_versionada.test.cjs tests/auditoria_mercado_20261023.test.cjs`: 13 aprobadas. Verifican el descenso de demanda al duplicar simultáneamente los precios, reparto relativo, límite de mercado, parámetros inválidos y equivalencia Node/Edge en el caso versionado. Los supuestos se exploraron en la matriz limitada siguiente y no se han activado en partidas nuevas.

## Exploración de 3.000 combinaciones en memoria

`node tests/matriz_utilidad_experimental.cjs 3000` ejecutó 3.000 combinaciones distintas, cada una con cierre anterior y experimental: 6.000 cierres individuales, sin excepciones. Cada segmento tiene 1.000 casos. Varían metas, materiales, niveles de personal, tipos y cantidades de equipos, jefatura, canal, capital inicial y precios de ensayo. Los parámetros se generan de forma determinista; el detalle se guarda localmente en `tests/output/matriz_utilidad_experimental.json`.

| Segmento | Casos | Con utilidad anterior | Con utilidad experimental | Caja final negativa anterior / experimental |
|---|---:|---:|---:|---:|
| Básico | 1.000 | 137 (13,7 %) | 137 (13,7 %) | 242 / 242 |
| Mejorado | 1.000 | 404 (40,4 %) | 404 (40,4 %) | 167 / 167 |
| Prémium | 1.000 | 917 (91,7 %) | 825 (82,5 %) | 24 / 99 |

Ejemplos experimentales: básico 250 producidos y vendidos, precio S/ 120, ventas S/ 30.000, costo de ventas S/ 15.897,72, gastos S/ 3.593,15, utilidad S/ 10.509,13 y caja S/ 34.537,05; mejorado 100 vendidos a S/ 150, utilidad S/ 3.719,91 y caja S/ 38.248,45; prémium 50 vendidos a S/ 250, utilidad S/ 1.629,91 y caja S/ 36.658,45. Los tres parten de S/ 50.000. Un básico de 50 a S/ 42,50 pierde S/ 7.497,34. Son resultados del cierre individual, no estrategias certificadas: una caja final positiva no acredita que cada compra inicial sea financiable.

**Límites:** esta matriz usa una sola empresa, sin competidores explícitos, ni recepciones parciales, ni controles de admisión financiera, ni trayectorias de varios ciclos. Los precios de ensayo son entradas explícitas del motor local, no los precios autoritativos activos en nuevas partidas. No varía analista, marketing ni capacitación. La comparación refleja conjuntamente maquinaria, calidad y elasticidad; no atribuye las diferencias a una sola corrección. La cobertura obligatoria de 3.000 escenarios competitivos y financieramente factibles todavía no está completada y estos porcentajes no son predicciones de partidas reales.

## Casos representativos competitivos y continuidad

`node --test tests/competencia_utilidad_representativa.test.cjs tests/recuperacion_utilidad_ciclos.test.cjs tests/edge_lotes_equivalencia.test.cjs tests/continuidad_seis_ciclos_activos.test.cjs`: 10 pruebas aprobadas. Los primeros dos archivos usan cierres en memoria `utility-v1`; los otros prueban Node/Edge y persistencia PostgreSQL compatible mediante PGlite, incluyendo recepciones parciales y cuentas por pagar. La regresión también aprobó pruebas existentes de cierres compartidos y concurrentes en PostgreSQL real aislado; no prueban la nueva versión con los escenarios de competencia. No son una prueba integral en el servicio remoto.

Doce empresas idénticas compiten por básico, con precio experimental explícito S/ 120, capital individual S/ 50.000, 250 unidades planeadas, insumos económicos, dos equipos y dos trabajadores básicos por etapa, sin jefatura y con web. Como comprobación conservadora se cargaron al capital todos los movimientos negativos antes de las ventas. Los balances cuadraron. Este precio coincide con el candidato `utility-v1`, todavía no activado para nuevas partidas.

| Empresas | Demanda por empresa | Producido / vendido | Ventas S/ | Utilidad S/ | Caja final S/ | Movimientos negativos S/ |
|---:|---:|---:|---:|---:|---:|---:|
| 3 | 902 | 250 / 250 | 30.000 | 10.603,13 | 39.303,63 | 40.696,37 |
| 6 | 451 | 250 / 250 | 30.000 | 10.603,13 | 39.303,63 | 40.696,37 |
| 12 | 225 | 250 / 225 | 27.000 | 9.215,46 | 36.933,63 | 40.066,37 |

La prueba verifica también que al aumentar todos los precios baja la demanda conjunta. Es un único perfil con empresas idénticas, no demuestra factibilidad para todas las estrategias ni reproduce recepciones parciales en ese perfil.

En un ejemplo local prémium de seis ciclos con los candidatos actuales, la empresa pierde S/ 6.174,75 en el primero, acumula inventario terminado por S/ 33.991,07 y después vende ese inventario junto con la producción del segundo ciclo. Resultados posteriores: S/ 10.414,71; 9.478,58; 9.478,58; 9.478,58 y 5.263,15. La suma es positiva en el segundo ciclo; el impuesto del sexto es S/ 4.215,43 y la caja final S/ 188.672,87. Otro caso tiene resultados positivos en todos los ciclos y el tercero, sin canal, pierde en cada ciclo. En este último la caja cae por debajo de cero en el quinto: los cierres posteriores ilustran el comportamiento contable del motor, no una trayectoria financiable. La prueba de duración tres aplica impuesto en su último ciclo y recupera el acumulado. En estos ejemplos la deuda financiera es cero; la continuidad de cuentas por pagar con recepciones parciales se comprueba por separado en el test PGlite indicado.

## Avance: calidad prémium

El contraste directo con el libro prioritario confirma que `Lotes_Produccion!I2` suma los aportes de calidad de cuero, accesorios, hilo y molde mediante `INDEX`/`MATCH`; el catálogo asigna 1 a cada insumo económico y 4 al molde prémium. El total 7 cumple la condición `Matriz_Consecuencias!C3` y produce el +40 % y +2 de reputación de esa matriz. Por tanto, el comportamiento anterior coincide con el Excel; no se clasifica como error de implementación.

Clasificación 4: **nueva regla educativa experimental**, no calibrada como afirmación de mercado. En `utility-v1`, CONS-02 exige además que las tres familias del lote sean íntegramente de sus respectivos insumos prémium y tengan composición trazable. Se conserva la fórmula de puntuación y el descuento de CONS-01. Las partidas sin versión mantienen el Excel. Un lote anterior sin composición no recibe la nueva bonificación, sin inventar insumos. El precio y el cambio de reputación usan la misma condición por lote. Esto evita la prima automática para insumos económicos, pero su exigencia estricta debe evaluarse con la matriz económica antes de activarla; no es una conclusión empírica sobre calidad.

`node --test tests/calidad_utilidad_versionada.test.cjs tests/puntaje_maquinaria_utilidad.test.cjs tests/edge_lotes_equivalencia.test.cjs tests/consecuencias_cierre_real.test.cjs tests/lotes_fifo_integrado.test.cjs tests/excel_calidad_comercial.test.cjs`: 25 pruebas aprobadas. Para el mismo lote prémium económico, la calidad sigue siendo 7 y el precio pasa de S/ 350 a S/ 250 en la versión experimental; con las tres familias prémium permanece en S/ 350. El caso histórico sin composición tampoco recibe el bono. No son resultados de una simulación masiva ni prueba de rentabilidad.

## Avance: puntuación de maquinaria versionada

Clasificación 1: corrección de implementación. Con `financialPolicy.economicRulesVersion = 'utility-v1'`, los equipos de ensamblado y acabados se obtienen de las compras registradas hasta el ciclo de cierre, sumando movimientos negativos de baja; solo se puntúa una opción por grupo. Compras futuras y selecciones de catálogo sin equipo disponible no otorgan puntos. Las partidas sin esta versión conservan el comportamiento anterior. La versión se propaga por `services/finance_config.js` y el código Edge se regeneró desde las mismas fuentes. Falta integrarla en la creación persistente de partidas nuevas y validar el resto de reglas antes de activarla.

Pruebas: `node --test tests/puntaje_maquinaria_utilidad.test.cjs tests/diagnostico_utilidad_maquinaria.test.cjs tests/consecuencias_cierre_real.test.cjs tests/lotes_fifo_integrado.test.cjs` (20 aprobadas); `node --test tests/edge_lotes_equivalencia.test.cjs` (4 aprobadas). Una primera prueba Edge falló por un fixture sin ciclo de activo; tras corregir el fixture pasó. Las pruebas de continuidad de seis ciclos y de independencia 3D también pasaron en la ejecución que detectó ese fallo del fixture. Estas pruebas no sustituyen la matriz ni la regresión general.

## Hallazgos reproducidos

1. **Puntuación de maquinaria:** con `ENSAMBLE.purchases[1].ens_ind=1` y `ACABADOS.purchases[1].aca_ind=1`, sin cantidades ni opciones en esas entradas, producción reconoce un equipo y una pareja trabajador-equipo por etapa, pero `scores()` no incluye `INF-04` ni `INF-07`. La prueba `tests/diagnostico_utilidad_maquinaria.test.cjs` fija este comportamiento actual. Puede afectar los umbrales de CONS-03 y CONS-08; este caso concreto no demuestra que esas penalizaciones se disparen injustamente. La corrección requiere respetar ciclo y propiedad, verificar que no se dupliquen equipos y versionarla para no cambiar partidas antiguas.
2. **Calidad de lote:** `tests/lotes_fifo_integrado.test.cjs` documenta calidad 7 para molde prémium con cuero sintético, accesorios económicos e hilo estándar. El umbral actual de CONS-02 es 7 y multiplica el precio por 1,4. Se ha comprobado el comportamiento del código; no se ha determinado aún si corresponde modificar la regla del Excel.
3. **Economía de un ciclo:** los ejemplos siguientes muestran que vender todo no garantiza utilidad y que los recursos importan. No son estrategias optimizadas ni la matriz de 360 escenarios citada en el encargo.

## Línea base local: tres simulaciones

Cada caso usa `economic_v19_fixture.cjs`, capital inicial S/ 200.000, una empresa, 90 unidades planificadas y materiales abundantes. La demanda es la del fixture; no se comparan aquí competidores. No se verificó factibilidad completa de presupuesto ni se simularon recepciones parciales en estos tres ejemplos. La caja incluye compras de materiales que permanecen en inventario.

| Caso | Producido / vendido | Precio efectivo S/ | Ventas S/ | Costo ventas S/ | Gastos operativos S/ | Utilidad neta S/ | Caja final S/ | Inventario MP / PT S/ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Básico, 1 equipo y trabajador por etapa | 90 / 90 | 42,50 | 3.825,00 | 11.420,94 | 6.623,00 | -14.218,94 | 87.674,60 | 84.870,00 / 0 |
| Prémium, 1 equipo y trabajador por etapa | 90 / 90 | 350,00 | 31.500,00 | 18.127,74 | 6.899,75 | 6.472,51 | 109.537,85 | 78.163,20 / 0 |
| Prémium, 4 equipos y trabajadores por etapa | 90 / 90 | 350,00 | 31.500,00 | 33.523,07 | 6.989,75 | -9.012,82 | 71.550,65 | 78.163,20 / 0 |

En estos casos anteriores el precio prémium de S/ 250 recibe CONS-02. Los valores no deben interpretarse como predicción de demanda ni como recomendaciones de precios; la tabla de candidatos al principio presenta otros perfiles, no una comparación aislada del mismo escenario.

## Excel, fórmulas y parámetros

Se localizó `.codex-work/fuente_logia/SIDE_prueba_cantidad_produccion (2).xlsx`; SHA-256 `a07710cd97447d0a5f1b79f2e7e200b01565abbf4a8ee3ff02055fa2768189b3`. El Python inicial carecía de `openpyxl`; se utilizó después el runtime incluido para comprobar directamente las celdas de calidad indicadas arriba. No se afirma un contraste independiente integral. El informe preexistente `reports/AUDITORIA_RENTABILIDAD_SIDE.md` recoge referencias y análisis anteriores, que deben volver a comprobarse contra el libro.

La configuración anterior `md-20261027` conserva precios base S/ 42,50 / 100 / 250, el multiplicador prémium 1,4 y los umbrales de eficiencia 4 y 5. La selección de maquinaria, los requisitos de bonificación, los precios candidatos y la elasticidad cambiaron solo para `utility-v1`. Las pruebas disponibles aún no acreditan la calibración para todo el universo de partidas.

## Verificación realizada

- `node --test tests/diagnostico_utilidad_maquinaria.test.cjs`: 2 pruebas aprobadas, tres cierres de referencia y una caracterización de maquinaria.
- `node --test tests/excel_calidad_comercial.test.cjs tests/consecuencias_cierre_real.test.cjs tests/world_economic_independence.test.cjs tests/edge_lotes_equivalencia.test.cjs`: 13 pruebas aprobadas. Los casos cubiertos incluyen consecuencias, independencia 3D y equivalencia Node/Edge; no acreditan equivalencia universal.
- No se ejecutó la regresión general ni se identificaron regresiones nuevas en las pruebas ejecutadas.

## Pendiente indispensable

- Reproducir con datos verificables los 41/15/4 cierres históricos y las 360 combinaciones. No se han consultado ni reescrito cierres remotos en esta sesión.
- Diseñar y persistir la versión económica para partidas nuevas y antiguas, y corregir la selección de maquinaria con pruebas de vigencia, inexistencia, duplicación, CONS-03, CONS-08 y capacidad.
- Comparar directamente las fórmulas y valores del Excel; analizar materias primas, personal, depreciación, mantenimiento, gastos, garantías e impuestos antes de justificar precios o demanda.
- Construir y ejecutar al menos 3.000 combinaciones reproducibles con recursos, canales, competencia, presupuestos, recepciones e inventarios solicitados; informar porcentajes rentables por segmento y sensibilidad. Porcentaje aún no calculado.
- Implementar proyección orientativa previa al cierre y probarla sin bloquear decisiones; verificar que estudiante, docente, laboratorio, servidor y Edge concilien las mismas reglas.
- Ejecutar los escenarios requeridos de tres y seis ciclos, recuperación desde pérdida, no recuperación, eventos, ventas parciales, impuestos y arrastres. La recuperación no está demostrada por estas pruebas.

Hasta completar esas tareas no se puede afirmar que los tres segmentos tengan estrategias rentables y factibles bajo condiciones normales ni que los cambios sean seguros para despliegue.
