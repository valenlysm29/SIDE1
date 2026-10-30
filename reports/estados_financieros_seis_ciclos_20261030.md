# Estados financieros conciliados — escenario local de seis ciclos

Cifras en soles; fuente: cierres persistidos por el worker en PGlite, empresa principal del test `continuidad_seis_ciclos_activos.test.cjs`. Las cifras son un escenario de prueba, no una partida real ni evidencia de todas las decisiones. `pagosOperacion` incluye pagos a proveedores; no debe sumarse de nuevo el detalle de esos pagos. Los valores de depreciación están incluidos en el costo de ventas de este escenario.

## Estado de resultados

| Concepto | C1 | C2 | C3 | C4 | C5 | C6 |
|---|---:|---:|---:|---:|---:|---:|
| ventasTotales | 35000.00 | 33250.00 | 33250.00 | 33250.00 | 33250.00 | 33250.00 |
| costoVentas | 13582.94 | 13164.34 | 13569.67 | 13588.10 | 13589.70 | 13589.90 |
| utilidadBruta | 21417.06 | 20085.66 | 19680.33 | 19661.90 | 19660.30 | 19660.10 |
| gastosAdministrativos | 2763.15 | 2763.15 | 2763.15 | 2763.15 | 2763.15 | 2763.15 |
| gastosVentas | 850.00 | 832.50 | 832.50 | 832.50 | 832.50 | 832.50 |
| gastosOperacion | 3613.15 | 3595.65 | 3595.65 | 3595.65 | 3595.65 | 3595.65 |
| utilidadOperativa | 17803.91 | 16490.01 | 16084.68 | 16066.25 | 16064.65 | 16064.45 |
| ingresosFinancieros | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| gastosFinancieros | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| utilidadAntesImpuestos | 17803.91 | 16490.01 | 16084.68 | 16066.25 | 16064.65 | 16064.45 |
| impuestoRenta | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 12991.82 |
| utilidadNeta | 17803.91 | 16490.01 | 16084.68 | 16066.25 | 16064.65 | 3072.63 |

## Balance general

| Concepto | C1 | C2 | C3 | C4 | C5 | C6 |
|---|---:|---:|---:|---:|---:|---:|
| efectivo | 206704.45 | 215621.90 | 236149.35 | 250248.80 | 264348.25 | 265455.88 |
| cuentasPorCobrar | 7000.00 | 8312.50 | 9975.00 | 11637.50 | 13300.00 | 14962.50 |
| anticiposMateriales | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| inventarioMP | 5980.00 | 418.60 | 879.87 | 1322.71 | 1763.95 | 2204.99 |
| inventarioPT | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| activosFijos | 12471.46 | 12332.92 | 12194.38 | 12055.84 | 11917.30 | 11778.76 |
| activos | 232155.91 | 236685.92 | 259198.60 | 275264.85 | 291329.50 | 294402.13 |
| deuda | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| cuentasPorPagarProveedores | 14352.00 | 2392.00 | 8820.00 | 8820.00 | 8820.00 | 8820.00 |
| impuestosPorPagar | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| interesesPorPagar | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| provisionGarantias | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| capital | 200000.00 | 200000.00 | 200000.00 | 200000.00 | 200000.00 | 200000.00 |
| resultadosAcumulados | 17803.91 | 34293.92 | 50378.60 | 66444.85 | 82509.50 | 85582.13 |
| patrimonio | 217803.91 | 234293.92 | 250378.60 | 266444.85 | 282509.50 | 285582.13 |
| pasivoPatrimonio | 232155.91 | 236685.92 | 259198.60 | 275264.85 | 291329.50 | 294402.13 |

## Estado de flujo de efectivo

| Concepto | C1 | C2 | C3 | C4 | C5 | C6 |
|---|---:|---:|---:|---:|---:|---:|
| cajaInicial | 200000.00 | 206704.45 | 215621.90 | 236149.35 | 250248.80 | 264348.25 |
| cobrosVentas | 28000.00 | 31937.50 | 31587.50 | 31587.50 | 31587.50 | 31587.50 |
| reembolsos | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| pagosOperacion | -8685.55 | -23020.05 | -11060.05 | -17488.05 | -17488.05 | -17488.05 |
| impuestoRenta | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | -12991.82 |
| eventos | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| otros | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| operacion | 19314.45 | 8917.45 | 20527.45 | 14099.45 | 14099.45 | 1107.63 |
| compraActivos | -12610.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| ventaActivos | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| inversion | -12610.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| financiamiento | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| flujoNeto | 6704.45 | 8917.45 | 20527.45 | 14099.45 | 14099.45 | 1107.63 |
| cajaFinal | 206704.45 | 215621.90 | 236149.35 | 250248.80 | 264348.25 | 265455.88 |

Las ecuaciones de resultado, balance, flujo, caja, ventas por canal y movimiento de materiales fueron verificadas automáticamente a dos centavos de tolerancia. La prueba no cubre amortización ni pago de intereses bancarios: no existe un calendario definido en el modelo actual. La conciliación no prueba por sí sola la corrección de cada importe ni la equivalencia con Excel.
