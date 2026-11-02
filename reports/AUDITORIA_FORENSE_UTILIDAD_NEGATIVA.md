# Auditoría forense de gastos y utilidad negativa

Fecha: 2026-11-02. Estado: cierre real conciliado; recomendaciones pendientes de validación funcional. No se ha corregido ni desplegado el motor.

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
