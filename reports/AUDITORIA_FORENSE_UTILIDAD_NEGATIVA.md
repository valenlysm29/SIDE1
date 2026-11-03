# Auditoría forense de gastos y utilidad negativa

Fecha: 2026-11-02. Las secciones originales documentan el corte del commit `9c8d176`, antes de corregir el motor. El seguimiento al final de este informe documenta la corrección posterior y sus validaciones; no hubo despliegue ni cambios en históricos.

## Evidencia e identificación

Consulta de solo lectura al proyecto Supabase SIDE `plfuwfdpsagzrlveqkvl`. Coincidencia exacta de las seis cifras denunciadas en `side_business_closures`:

- Partida `fc48d77b-c0d4-41b1-af60-e96cb603f608`, código `SIDE-H57S`, nombre persistido «Prueba aislada Laboratorio 3 ciclos».
- Empresa 188, nombre comercial `demo1`. El nombre de la partida no se ha usado para sustituir su evidencia con una simulación.
- Ciclo 2 de 3; cierre `2026-11-02 18:13:03.278141+00` (13:13:03 Lima). Ciclo 1: `18:10:05.807501+00`.
- `partidas.motor_version=excel-16`; recibo económico `modelVersion=md-20261027`, `economicRulesVersion=utility-v1`, capacidad `one-worker-per-resource-20261029`, régimen MYPE. Son identificadores distintos, no versiones intercambiables.
- Edge Function recuperada en modo lectura: `side-business-close`, versión 11, paquete `ezbr_sha256=6f079ba7b3cd93f7a136044f0c8bd5feb85c6bcac5ac38d52b6e6f87c5a53b40`. Esto identifica lo desplegado al consultar, no demuestra qué paquete ejecutó originalmente el cierre.

Evidencia íntegra local: `tests/output/forense_utilidad/cierres_reales.json`, dos cierres con decisiones, ledger, secciones y snapshots. `reportes_ciclo` de empresa 188 también contiene ingresos 11400, costos 20168.91, utilidad -8768.91 y caja 72695.90 en C2. No se consultaron identidades de alumnos.

## Causa raíz demostrada

La empresa vende toda su producción de 95 unidades esenciales a S/120. El margen bruto de S/4363.66 no cubre S/13132.57 de gastos de operación. El analista contratado cuesta S/5000 por ciclo, además del local, limpieza, dos componentes de mantenimiento, alquiler comercial, marketing, comisión y garantía.

No hay una resta adicional de S/9243.57 después de S/13132.57: los administrativos son parte de los gastos de operación. La pérdida reproduce exactamente el cálculo actual. La adecuación de todas sus políticas económicas requiere validar los puntos señalados abajo.

## Desglose exacto de administrativos C2

Todas las rutas siguientes parten de `cierre.resultadosPorEmpresa[188]`; las secciones son `financialSections[2]`. `recordedNet` concuerda con el movimiento de categoría del ledger; no son movimientos individuales bancarios independientes.

| Concepto | S/ | Decisión / registro de origen |
|---|---:|---|
| Local | 2000.00 | B.items LOCAL_PROD, local_std; ledger 2:B=-3500 |
| Limpieza | 712.32 | C.items LIMPIEZA, limpieza; ledger 2:C=-5784.72 |
| Jefatura | 0.00 | C.items JEFATURA, no_jefatura |
| Analista de compras | 5000.00 | F.items ANALISTA_COMPRAS, si_analista; ledger 2:F=-6999.80 |
| Capacitación | 0.00 | E.items INV_RRHH, cap_no |
| Marketing en administrativos | 0.00 | INV_MARKETING=1500 se clasifica en ventas |
| Mantenimiento elegido | 1500.00 | B.items MANTENIMIENTO, correctivo; etiqueta «Mantenimiento preventivo» |
| Mantenimiento automático | 31.25 | ledger 2:MANTENIMIENTO_AUTO=-31.25; receipt.maintenanceCost |
| Eventos | 0.00 | receipt.events vacío; sin ledger EVENT en este cierre |
| Almacenaje, ociosidad y otros | 0.00 | ALMACENAJE=0; capacidadOciosa=0; otros=0 |
| **Total** | **9243.57** | **2000+712.32+5000+1500+31.25** |

Las decisiones conservan `round=2`; las opciones persistentes tienen `optionRounds=1`. Esto acredita la configuración aplicada, no un nuevo clic del usuario en C2. El analista sí consta contratado. Los mismos cinco cargos administrativos aparecen una vez en C1 y una vez en C2; la repetición entre ciclos no es una doble contabilización dentro de C2.

Gastos de ventas: tienda Los Olivos S/1800 (`2:D`), marketing bajo S/1500 (`2:E`), comisión S/114 (`2:COMISION_VENTAS`, 1% de 11400) y garantía S/475 (95 × S/5, pt_30). Total S/3889. La garantía es provisión, no un pago de caja del ciclo.

## Fórmulas y conciliación

Fuentes: `js/financial_model.js` (`calculate`, `buildStatement`), `js/cycle_model.js` (`close`), `js/business_rules.js` (`maintenance`), `js/decision_catalog.js`.

- Compra MP: 675+331.20+993.60=1999.80. Quedan 1.5 m² de cuero, 5 accesorios y 30 m de hilo, valor S/99.99. Consumo S/1899.81.
- Mano de obra: tres personas ×1690.80=S/5072.40, reconocida en producción, no nuevamente en administrativos.
- Depreciación S/64.13; producción=1899.81+5072.40+64.13=7036.34. Todo lo producido se vende y no hay PT final: costo de ventas=7036.34.
- Ventas=95×120=11400. Bruta=11400−7036.34=4363.66.
- Operación=9243.57+3889=13132.57. Resultado=4363.66−13132.57=−8768.91. Intereses e impuesto C2=0; impuesto diferido al ciclo final.
- Caja C2=81445.67+10980−19729.77=72695.90. Cobros=11400−3420+3000=10980; los S/3000 son CxC de C1, no nuevas ventas.
- Balance C2: efectivo 72695.90 + CxC 3420 + MP 99.99 + activos fijos 7734.74 =83950.63; pasivo y patrimonio=provisión garantía 975 + capital 100000 − pérdidas acumuladas 17024.37 =83950.63.

`tests/forense_utilidad.cjs` elimina todos los `__financialSnapshots`, recalcula desde los movimientos y recibos reales y exige igualdad exacta de estado de resultados, balance general y flujo de caja para C1 y C2. Diferencia obtenida: cero en todos esos campos. También verifica que la suma de items de cada sección concuerde con su ledger.

## Errores, anomalías y límites contables

| Comprobación | Resultado |
|---|---|
| Salarios duplicados | No en este cierre: S/5072.40 en fabricación; se excluyen de administrativos |
| Materiales otra vez en administrativos | No: compras se excluyen de administrativos; consumo e inventario se separan |
| Depreciación duplicada | No: S/64.13 en fabricación; ociosidad cero |
| Compra de maquinaria como gasto | No: S/7863 de C1 capitalizados; compras nuevas C2=0 |
| Canales | S/1800 en gastos de ventas; vendedores sin salario fijo adicional, comisión 1% |
| Analista sin contratar | No aplica: si_analista consta en ambos recibos |
| Obligaciones antiguas | Cobro de CxC correctamente separado de ingresos; alquiler y analista vuelven como costos del nuevo ciclo |
| Eventos | Sin eventos en el cierre real; no permite concluir sobre todos los eventos del catálogo |
| Fijos una vez | Un item por categoría y un movimiento agregado por ciclo; no se observó duplicado |

**Dos mantenimientos:** el seleccionado S/1500 y el automático S/31.25 coexisten. `business_rules.maintenance` aplica 5% anual MYPE sobre 2500+3500+1200+300=7500, dividido entre 12. En `cycle_model.close` solo se descuenta del automático un mantenimiento marcado `automaticMaintenance` o `type=info`; la decisión de tipo choice no cumple. Es comportamiento explícito del código, pero potencial solapamiento económico. Debe definirse si la intervención opcional es adicional o sustituye la cuota base. No eliminar ninguno sin esa definición.

**Molde:** el catálogo declara `noDepreciation:true`, pero el modelo financiero incluye MOLDE con vida de cinco años sin comprobar ese indicador. El recibo suma S/4.75 mensuales por molde (300×.95/60). Es una inconsistencia técnica demostrable entre catálogo y cálculo; no explica por sí sola la pérdida. Si la política correcta fuera no depreciarlo, C2 tendría costo de ventas 7031.59 y pérdida 8764.16, manteniendo lo demás constante. No se modificó el histórico.

**Presentación del desglose:** `desgloseCostos` tiene columnas superpuestas: maquinaria incluye depreciación y mantenimiento; materiales y manoObra ya forman costoVentas. No deben sumarse todas sus claves. `otros=7389` no equivale a «gasto desconocido»: es el residual después de los componentes elegidos por esa fórmula y contiene, entre otros, analista y ventas. Recomendar un desglose conciliable sin solapamientos.

El ledger del cierre es evidencia interna de la simulación; no prueba facturas ni pagos reales fuera de SIDE. Tampoco conserva una trazabilidad inmutable del clic que originó cada opción.

## Rentabilidad por producto C2

| Producto | Producido / vendido | Costo real unitario | Precio efectivo | Margen bruto |
|---|---:|---:|---:|---:|
| Esencial | 95 / 95 | 74.06673684 | 120.00 | 45.93326316; 38.2777% de ventas |
| Urbano | 0 / 0 | No determinable | Sin venta; referencia 150 | No determinable |
| Premium | 0 / 0 | No determinable | Sin venta; referencia 280 | No determinable |

No se inventa costo ni precio efectivo para líneas sin fabricación o ventas. Solo esencial absorbe los costos de esta empresa en el análisis siguiente.

Gastos comerciales variables reales: comisión S/1.20/unidad y garantía S/5/unidad; S/589 en total. Comerciales fijos: 1800+1500=3300. Administrativos: 9243.57. Costos fijos de fabricación para analizar volumen: salarios 5072.40 y depreciación 64.13. Total fijo económico=17680.10. Material variable=1899.81/95=19.998 por unidad.

Punto de equilibrio a precio 120 y misma estructura: `ceil(17680.10/(120×.99−19.998−5))=189 unidades`. La capacidad declarada de procesos es 162 antes de penalizaciones: este equilibrio excede la estructura actual. No es una promesa de poder producir o vender ese volumen; expandirse cambia costos y demanda.

Para vender exactamente 95 unidades, precios de referencia para **margen operativo antes de impuesto sobre ventas**: `P=(20168.91−114)/(95×(.99−m))`. Se mantiene todo salvo la comisión que crece con el precio; garantía y volumen constantes.

| Margen | Precio analítico S/ |
|---|---:|
| 10% | 237.20 |
| 15% | 251.31 |
| 20% | 267.22 |
| 25% | 285.28 |

Son umbrales condicionales, no precios impuestos ni garantía de rentabilidad: el motor ajusta demanda al precio. No son márgenes netos después del impuesto final acumulado. La empresa ya vende todo; la causa inmediata no es inventario invendido. CONS-08 reduce la meta 100 a 95 por falta de jefatura y baja eficiencia; CONS-04 reduce demanda 20%, pero todavía hay demanda 2165 frente a 95 disponibles.

## Pruebas reproducibles ejecutadas

1. `node tests/forense_utilidad.cjs`: reconstrucción de los dos cierres reales sin snapshots y ocho escenarios contables separados. Resultados en `tests/output/forense_utilidad/resultados.json`.
2. `node --test tests/accounting_integrated.test.cjs tests/continuidad_seis_ciclos_activos.test.cjs tests/cierre_excel_remoto.test.cjs`: 19 pruebas aprobadas, cero fallos. Incluye MP/PT, activos, ociosidad, garantías, crédito, congelación de históricos, tres ciclos remoto simulado y dos continuidades de seis ciclos con recursos físicos y persistencia local PGlite. Compara runtime Node y bundle Edge local sobre la misma base aislada, con rollback entre ejecuciones.
3. `node --test tests/forense_edge_desplegado.test.cjs`: 3 pruebas aprobadas, cero fallos. Repite la integración anterior importando una copia del runtime descargado de Edge v11, sin invocar el endpoint de producción. Log en `tests/output/forense_utilidad/edge_pruebas.log`. La prueba de crédito parcial exige igualdad profunda Node/Edge/persistido; las dos de seis ciclos verifican continuidad persistida. No acredita igualdad universal de todas las combinaciones.

| Escenario contable aislado | Resultado / observación |
|---|---|
| Sin producción | -30; costoVentas=0, mano de obra ociosa a gasto |
| Producción sin ventas | -10; PT=120, costoVentas=0 |
| Venta parcial (4 de 10) | +42.86; costoVentas=48, PT=72 |
| Venta completa (10) | +117.73; costoVentas=120, PT=0 |
| Fijos elevados | -823; costos no se eliminan para evitar pérdida |
| Recursos contables alternativos | +236.18; integración adicional cubre máquinas/materiales y dos empresas |
| Tres ciclos | Tercer resultado +19.21 tras liquidación tributaria acumulada |
| Seis ciclos | Sexto resultado -128.59 por impuesto acumulado; no indica pérdida operativa del ciclo |

Los ocho casos nuevos son pruebas del modelo financiero con entradas controladas; no todos atraviesan Edge y persistencia. La integración completa cubre crédito, ventas, recursos y seis ciclos; el remoto de tres ciclos es un mock, no la Edge desplegada. Queda pendiente extender la matriz completa de ocho escenarios a ambos runtimes y persistencia con oráculo económico independiente. No se presenta esa cobertura pendiente como aprobada.

## Recomendaciones y pendientes

- Resolver la política de mantenimiento opcional frente a automático; agregar prueba específica de sustitución o acumulación una vez definida.
- Resolver la contradicción de depreciación del molde y comprobar el efecto en ciclos futuros sin reescribir históricos.
- Mostrar desglose no solapado y distinguir gasto devengado, compra de activo y salida de caja.
- Evaluar el costo del analista frente a ahorro: C2 aplica descuento 10% y paga S/5000 por el servicio; el costo es desproporcionado para compras de S/1999.80. No descontratar automáticamente ni cambiar decisiones de interfaz.
- Completar la matriz integrada de ocho escenarios y casos de eventos; conservar oráculos independientes y probar contra versión fijada de código. No usar solo balances cuadrados como prueba de corrección económica.
- Guardar hash del motor ejecutor en cada cierre futuro: las etiquetas actuales y la versión Edge consultada no establecen procedencia exacta del binario histórico.

No hubo escrituras a Supabase, cambios de caja, edición de cierres, migraciones, despliegues ni publicación en main. Se preservaron cambios previos del usuario; el commit de auditoría incluye únicamente informe, pruebas y evidencia. El contenedor del proyecto contiene únicamente SIDE1 al revisar; todos los artefactos creados permanecen dentro del repositorio.

Conclusión: la pérdida reportada está conciliada exactamente con los movimientos persistidos y tiene una causa económica demostrada. Persisten anomalías de política y cobertura pendientes; no se declara solucionado el problema general.

## Seguimiento: mantenimiento y molde no depreciable (2026-11-02)

Este seguimiento sustituye los pendientes relativos a mantenimiento y depreciación del corte inicial. No sustituye ni reescribe las cifras históricas anteriores.

### Mantenimiento: conceptos independientes, sin eliminación de cargos

La definición ya existía antes de esta corrección: `docs/actualizacion_logica_documento_20261027.md`, sección «Costos, caja e inventarios», dice: «La opción original de mantenimiento preventivo por S/1500 se conserva como intervención opcional independiente». La prueba anterior `tests/md_logic.test.cjs`, «base maintenance recurs in the engine while the optional decision keeps its original fee», expresa la misma regla y pasa tanto con el código previo como con el corregido.

Por tanto, los S/1500 de la intervención y los S/31.25 de cuota mensual son conceptos independientes según la política vigente del proyecto. No existe evidencia para anular uno de ellos como duplicación. Esto determina la semántica de SIDE; no afirma que esas tarifas sean económicamente óptimas.

No se modificó la lógica de mantenimiento. La prueba nueva `tests/forense_correcciones.test.cjs` exige:

- Con intervención seleccionada: mantenimiento total 1531.25; automático en ledger -31.25.
- Sin intervención: total 31.25; diferencia de caja exactamente 1500, sin cambiar el resto del cálculo.
- Si una sección antigua ya contiene el mantenimiento automático identificado por `type=info`/`automaticMaintenance`: ledger automático adicional cero; gasto y caja iguales al caso de cuota única.
- En la matriz de continuidad se alterna la intervención entre ciclos impares y pares y se comprueba el cargo de cada ciclo. Nunca se descuenta dos veces el automático ya registrado.

### Corrección: respetar noDepreciation

`js/financial_model.js` omite del bucle de depreciación cualquier definición de activo con `noDepreciation === true`. No pone a cero importes acumulados anteriores ni genera un asiento de reversión. Se regeneró el paquete candidato `supabase/functions/side-business-close/runtime.mjs` desde las fuentes; el paquete histórico archivado y `legacy-runtime.mjs` permanecen intactos.

Efectos comprobados por las pruebas específicas:

- El molde configurado no genera depreciación nueva con método lineal, acelerado ni por unidades.
- La compra sigue como inversión y activo fijo. Un molde de S/300 conserva S/300 de valor en el escenario aislado, sin gasto de fabricación ni reducción de activo por depreciación.
- Sin producción, sin ventas, con ventas parciales y con ventas completas no se imputa depreciación del molde a gasto o inventario. Si se permite depreciarlo, el caso de control conserva S/4.75, costo de ventas S/4.75 y activo S/295.25.
- Las máquinas mantienen su depreciación. Para los recursos de la partida real, el total mensual nuevo es S/59.38 en vez de S/64.13.
- En un contrafactual de C2 que conserva C1 congelado, el costo de ventas es S/7031.59, la pérdida S/8764.16 y el activo fijo S/7739.49. El acumulado de depreciación anterior del molde, S/4.75, se conserva; no se devuelve ni se cobra de nuevo. El balance cuadra y el flujo de caja de ese contrafactual es idéntico al histórico.
- La corrección no genera un movimiento de caja por depreciación. En escenarios rentables puede cambiar el impuesto final y, por esa razón legítima, el pago tributario; la matriz verifica ambos estados y su conciliación.

`tests/forense_edge_desplegado.test.cjs` ahora caracteriza expresamente la diferencia entre Edge v11 archivada y el candidato corregido. Ya no exige igualdad con el defecto antiguo: reproduce depreciación 64.13/costo 7091.89 en v11 y 59.38/7087.14 en la candidata para el escenario C1, con igual flujo. La igualdad exigida para publicar el candidato es Node actual frente a Edge actual y al cierre persistido.

### Hallazgo adicional de la validación: deriva de céntimos en ventas parciales

La matriz `utility-v1` de seis ciclos encontró un tercer defecto que impedía dar por terminada la validación: el costo de ventas se redondeaba en el estado de resultados, pero se retiraba del inventario su valor fraccionario sin redondear. Además, el consumo de MP se calculaba sobre valores internos fraccionarios mientras el saldo presentado de MP ya estaba expresado en céntimos. Las diferencias podían acumularse aunque cada ciclo individual pareciera cuadrar con una tolerancia de dos céntimos.

Corrección en `financial_model.js`: el consumo contable de MP conserva la identidad saldo inicial + compras recibidas − saldo final. El costo de producción se distribuye entre productos en céntimos enteros por proporciones y restos mayores deterministas. Cada lote reconoce el costo vendido en céntimos y conserva exactamente la diferencia como valor del stock. Los recibos agregados sin lotes siguen la misma conservación. La suma de costos asignados coincide con el costo a repartir; no se introduce una contrapartida artificial en caja, patrimonio o resultados para cuadrar el balance.

Evidencia anterior de QA: `tests/output/forense_v2/descuadre_antes.json`. Reproducción de seis ciclos con diez ventas por ciclo:

| Concepto final C6 | Antes del redondeo corregido | Después, reproducción local |
|---|---:|---:|
| Activos | 132114.29 | 132114.30 |
| Pasivo + patrimonio | 132114.32 | 132114.30 |
| PT | 38394.88 | 38394.89 |
| Caja | 85070.42 | 85070.42 |

`tests/forense_redondeo.test.cjs` exige balance sin diferencia de céntimos en cada uno de los seis ciclos, conservación de PT inicial + producción − costo de ventas, costo de ventas igual a la suma de los lotes vendidos y PT igual a la suma de sus lotes restantes. También prueba reparto entre varios productos con y sin lotes, usando costos indivisibles entre unidades (por ejemplo S/30.04). La matriz PostgreSQL dejó de tolerar diferencias de S/0.02: sus ecuaciones monetarias solo admiten error numérico inferior a 0.0000001, sin permitir diferencias de un céntimo.

Los snapshots históricos siguen prevaleciendo sobre las fórmulas corregidas; no se recalculan ni se revierten diferencias antiguas. Esta corrección aplica al cálculo nuevo.

### Verificación de los históricos preservados

`tests/forense_utilidad.cjs` reproduce los movimientos históricos sin snapshots con el motor archivado que originaba sus reglas. Separadamente exige que el motor actual, al leer los snapshots congelados, devuelva exactamente los estados originales. Esto evita presentar un recálculo con política corregida como si fuera un cierre histórico.

Dos consultas remotas de solo lectura, antes y después del cambio, confirmaron los mismos `md5(cierre::text)`:

| Ciclo | Hash remoto conservado |
|---|---|
| 1 | 0702184c38c36b78e16deb0b21b978f1 |
| 2 | 265260f6bfd6fcd86fa3685e3fc8176e |

Evidencia: `tests/output/forense_utilidad/historicos_v2.json`. No se escribió en Supabase ni se alteraron partidas activas. Las escrituras de validación se realizan únicamente en PostgreSQL de prueba aislado.

### Alcance de integración y fallos previos

La prueba `tests/forense_postgres.test.cjs` arranca PostgreSQL 17 real en un contenedor sin red y un servicio de prueba Supabase Edge Runtime v1.77.8 (Deno) en localhost, sin credenciales de producción. No es un mock de almacenamiento ni PGlite. Usa las funciones SQL existentes de contexto y guardado de cierres; cada escritura se confirma y se relee desde conexiones PostgreSQL independientes.

Node y el módulo Edge reciben el mismo contexto real. Deno ejecuta el paquete candidato con las respuestas de lectura de esas RPC reproducidas. Se exige igualdad exacta de los tres estados financieros. Al comparar el cierre completo solo se normaliza `factorPrecioAbsoluto` a 14 cifras significativas: `Math.pow` produjo 0.773386514735649 en Node y 0.7733865147356489 en Deno, sin diferencia en unidades, precio, demanda entera ni dinero. Ningún campo monetario recibe esa tolerancia. El módulo Edge candidato también envía el mismo cierre calculado a la RPC real de PostgreSQL. Se contrastan cierre, reporte, ledger, secciones y snapshot. Esto valida cálculo en Deno y persistencia SQL real; no afirma que se haya invocado o actualizado el endpoint remoto de producción.

La matriz usa partidas QA independientes y cubre sin producción, producción sin ventas, ventas parciales, ventas completas, fijos elevados, recursos alternativos y una configuración rentable. Las ventas parciales se obtienen mediante la transferencia existente de diez unidades a la tienda por ciclo; el resto queda en PT. La configuración rentable usa premium, materiales correspondientes y la opción válida de no contratar analista; se conservan sus demás costos, comisión, garantía e impuesto. No se cambian precios ni tarifas para pasar las pruebas.

Se comprueban las identidades de resultados, caja, flujo operativo/inversión/financiamiento, activo/pasivo/patrimonio, arrastre de caja y resultados, reconstrucción desde movimientos, reintentos idempotentes y hashes de todos los cierres previos de cada partida QA. El selector de versión también se verifica para evitar usar la candidata en partidas históricas de otra versión.

La batería ampliada inicial dio 45/48: fallaron tres pruebas de `tests/md_logic.test.cjs` (ejemplo de matriz/capacidad, reputación por consumo y cierre completo de ese ejemplo). `node tests/forense_baseline_md.cjs` repite exactamente esos tres fallos con `js/financial_model.js` del commit `9c8d176`: esperado 368 unidades frente a 221 en el ejemplo de cierre. No son regresiones de esta corrección. No se alteraron las expectativas ni se eliminaron esas pruebas; siguen pendientes fuera del alcance de estos dos problemas. Logs: `regresion_v2.log` y `baseline_md_v2.log` en `tests/output/forense_utilidad/`.

### Resultado final de las validaciones

- Batería crítica: **42 pruebas aprobadas, 0 fallos**. Incluye molde, mantenimiento, conservación de céntimos, históricos, garantías, crédito, Node/Edge, continuidad y concurrencia sobre PostgreSQL.
- Inventarios y ventas: **25 pruebas aprobadas, 0 fallos**, ejecutando `tests/lotes_fifo_integrado.test.cjs`, `tests/legacy_asset_inventory.test.cjs` y `tests/sales_accounting_integration.test.cjs`.
- `node --test tests/forense_postgres.test.cjs`: **1 prueba integrada aprobada**, con **14 escenarios temporales y 63 cierres confirmados y releídos en PostgreSQL real**. Son siete configuraciones, cada una repetida durante tres y seis ciclos. Todos los estados financieros comparados coinciden entre Node, Deno Edge y persistencia, sin diferencia de céntimos en balance.
- `node tests/forense_utilidad.cjs`: los dos cierres reales siguen reproduciéndose con el motor archivado, y el motor corregido sigue leyendo sus snapshots sin cambios; también pasan sus ocho controles contables.
- Repetición de `tests/md_logic.test.cjs` después de todas las correcciones: 10 aprobadas y los mismos 3 fallos previos. Evidencia adicional `md_actual_v2.log`. Por tanto, no se afirma que la totalidad del repositorio tenga pruebas verdes.

En conjunto son **68 pruebas críticas/de inventarios/integración aprobadas**, además de la reproducción histórica y sus controles. Logs finales: `criticas_v2.log`, `inventarios_v2.log`, `postgres_v2.log` y `replay_v2.log`, dentro de `tests/output/forense_utilidad/`. La evidencia de los 63 cierres y las huellas del código probado están en `tests/output/forense_v2/postgres.json`. Para repetir la matriz completa no deben establecerse los filtros opcionales `SIDE_FORENSE_SCENARIO` ni `SIDE_FORENSE_CYCLES`.

Resultados del último ciclo de cada escenario QA, en soles (no son nuevos cierres de la partida real):

| Configuración | Utilidad C3, partida de 3 ciclos | Utilidad C6, partida de 6 ciclos |
|---|---:|---:|
| Sin producción | -17675.35 | -16175.35 |
| Producción sin ventas | -10743.57 | -9243.57 |
| Ventas parciales | -12114.29 | -10614.28 |
| Ventas completas | -8804.37 | -7424.99 |
| Fijos elevados | -11661.19 | -10294.51 |
| Recursos alternativos | -11261.05 | -9894.37 |
| Configuración rentable | 3111.92 | 2874.53 |

Los resultados positivos y negativos se conservan conforme a las decisiones y reglas, incluido el impuesto acumulado final. Vender toda la producción no implica que los gastos fijos estén cubiertos.

**Estado de estos hallazgos:** mantenimiento investigado y confirmado como dos conceptos independientes; depreciación del molde corregida; deriva de céntimos descubierta y corregida. Las validaciones críticas de estos cambios están completadas. Permanecen los tres fallos previos de producción documentados, las limitaciones de procedencia del binario histórico y cualquier cobertura del motor no ejecutada aquí. No se declara corregido todo SIDE.

Se conserva la misma rama `codex/auditoria-forense-utilidad-negativa`. No se hizo merge a main ni se desplegaron migraciones o Edge Functions. Las funciones SQL existentes solo se cargaron en contenedores QA temporales, ya eliminados. El endpoint de producción continúa con su versión desplegada anterior; este informe valida el candidato de la rama, no un cambio ya operativo en producción.

## Continuación integral (2–3 de noviembre de 2026)

El estado anterior corresponde al corte de la auditoría, no al estado operativo posterior. La continuación autorizada está documentada en `reports/VALIDACION_FINAL_RENTABILIDAD_SIDE.md`, rama `codex/finalizacion-rentabilidad`, integrada con `main` hasta `3ebcdfe`. Se resolvieron los tres fallos de expectativas de producción: una mesa admite un trabajador; el control con segunda mesa reproduce las 368 unidades originales. Se verificaron estrategias rentables de tres y seis ciclos con tres competidores, casos de pérdida y recuperación, recepción física de materiales y concordancia de Node, Edge y PostgreSQL en las tres interfaces. La versión 13 del backend de producción coincide con el paquete validado; se conserva el motor histórico. El informe final y sus evidencias registran publicación, controles e integridad de todos los cierres existentes, sin reescribirlos.
