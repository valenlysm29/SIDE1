# Oráculo Excel independiente de SIDE

Todas las fórmulas de las diez hojas originales se copian desde el Excel fuente local ignorado `.codex-work/DECISIONES_SIDE_16.xlsx`. No se versiona ese fuente. El hash y los volcados están en `docs/logica_excel/`.

LibreOffice no está instalado. La alternativa comprobada es Microsoft Excel 16.0 mediante una instancia COM propia, invisible, con enlaces externos desactivados y `CalculateFullRebuild()`. El script cierra exclusivamente su instancia. Cada JSON registra el motor y estado de cálculo final.

Desde SIDE1, usando Python con openpyxl:

```powershell
node tests/oracle/exportar_entradas.cjs
python tests/oracle/run_oracle.py base --construir --comparacion
python tests/oracle/run_oracle.py sim2
python tests/oracle/run_oracle.py sim2_premium
python tests/oracle/construir_pipeline.py
python tests/oracle/run_oracle.py sim3_pipeline
python tests/oracle/construir_sim2.py
python tests/oracle/run_oracle.py sim2_pipeline
node tests/oracle/comparar_pipeline.cjs sim2
node tests/oracle/comparar_pipeline.cjs sim3
```

Para la simulación base completa en UI, con cuatro empresas y tres lotes por empresa:

```powershell
python tests/oracle/construir_sim2.py sim1
python tests/oracle/run_oracle.py sim1_pipeline
node tests/oracle/comparar_pipeline.cjs sim1
python tests/oracle/crear_libro_paridad.py
```

`entradas_simulaciones.json` contiene configuración y decisiones de los escenarios, nunca resultados del motor. `construir_pipeline.py` escribe fórmulas de Excel por empresa y ciclo; `construir_sim2.py` amplía con lotes múltiples, consumo secuencial, inventarios por identidad y venta FIFO entre segmentos. Las fórmulas de MO referencian las celdas originales. Los costos texto se convierten en una tabla auxiliar vinculada al catálogo original. El recálculo independiente exporta `esperado_*_pipeline.json`; solo después el comparador ejecuta SIDE y genera `obtenido_*`.

El comparador exporta `valoresDesdeResultados(resultados,mapCompanyIds)` y `comparar(valores,esperado)` para verificar los mismos resultados en navegador. Enteros y cadenas se comparan exactamente; decimales, a tolerancia relativa 1e-9.

Cobertura: base 351 salidas originales; SIM-2 282 salidas de seis empresa-ciclos con dos lotes de B y cambio de identidad; SIM-3 564 salidas de doce empresa-ciclos con cuatro empresas activas, quinta eliminada, réplica e inventarios. Las consecuencias independientes añaden 28+28 salidas, incluidos mensajes literales.

Los libros conservan cuatro errores heredados en `CANTIDAD DE PRODUCCIÓN!E75/G75/E123/G123`; los originales tienen las mismas divisiones por cero. Ninguna salida comparada usa esas celdas. No se afirma que el libro original completo esté libre de errores. Las fórmulas nuevas han sido inspeccionadas y no tienen errores de Excel.

`ORACULO_SIDE_paridad.xlsx` reúne las hojas originales y la comparación contra SIDE. Las filas pendientes quedan marcadas cuando aún no existe archivo obtenido. El original fuente nunca se sobrescribe; archivos de ejecución y planes temporales permanecen dentro de `.codex-work/oracle/`.


Verificación bancaria con recuperación antes del préstamo:

```powershell
node tests/oracle/banca_recuperacion.cjs --exportar
python tests/oracle/run_oracle.py banca_pipeline
node tests/oracle/banca_recuperacion.cjs
```

La construcción inicial de ORACULO_banca.xlsx usa `construir_pipeline.construir` con escenario/config de entradas_banca_recuperacion.json. Esperados actuales: SIM1 336, SIM2 306, SIM3 612 y banca153, todos con cero diferencias. El libro de comparación consolidado tiene1814 resultados.


Finanzas se generan mediante fórmulas independientes (capital inicial explícito1000000 en los escenarios):

```powershell
node tests/oracle/exportar_entradas.cjs
node tests/oracle/banca_recuperacion.cjs --exportar
python tests/oracle/construir_pipeline.py
python tests/oracle/construir_sim2.py sim1
python tests/oracle/construir_sim2.py sim2
python tests/oracle/construir_pipeline.py banca
python tests/oracle/construir_pipeline.py bancamezcla
python tests/oracle/extender_finanzas.py
python tests/oracle/run_oracle.py sim1_pipeline
python tests/oracle/run_oracle.py sim2_pipeline
python tests/oracle/run_oracle.py sim3_pipeline
python tests/oracle/run_oracle.py banca_pipeline
python tests/oracle/run_oracle.py bancamezcla_pipeline
node tests/oracle/comparar_pipeline.cjs sim1
node tests/oracle/comparar_pipeline.cjs sim2
node tests/oracle/comparar_pipeline.cjs sim3
node tests/oracle/banca_recuperacion.cjs
node tests/oracle/banca_recuperacion.cjs --mezcla
python tests/oracle/crear_libro_paridad.py
```

Cobertura final:351base+468SIM1+504SIM2+1008SIM3+252bancarecuperación+252bancamezcla+56consecuencias=2891comparaciones sin diferencias. Cada empresa-ciclo agrega33campos financial: estadoResultados, balanceCaja, flujoCaja, balanceGeneral y financiamiento. Los intereses de deuda antigua conservan su tasa y se mezclan por saldo con nuevos préstamos; penalización afecta solo el préstamo siguiente. El generador no importa caja.js; el comparador de obtenidos sí llama adjuntarCaja, como hace UI.


Cobertura de cada lote y mercado extendida a las tres simulaciones: SIM2 585/0 y SIM3 1140/0. Cada lote compara calidad, producción, capacidadAsignada y precioEfectivo; cada mercado de cada empresa/segmento compara puntajePrecio, puntajeTotal, porcentaje, asignado, demandaAjustada, calidadMercado y reputacionEscalada. SIM2 incluye el mercado Premium de inventario anterior en ciclo3. SIM3 incluye explícitamente la réplica de B en ciclo2. No cambian entradas ni cálculos del motor.

Para conservar esta cobertura, construir los tres modelos usando el generador multilote:

```powershell
python tests/oracle/construir_sim2.py sim1
python tests/oracle/construir_sim2.py sim2
python tests/oracle/construir_sim2.py sim3
python tests/oracle/extender_finanzas.py
```

Libro final:351+468+585+1140+252+252+56=3104 comparaciones, cero diferencias y cero pendientes.
