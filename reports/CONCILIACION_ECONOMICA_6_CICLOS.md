# Avance de conciliación económica: alcance parcial

La prueba `continuidad_seis_ciclos_activos.test.cjs` se ejecutó con PGlite 0.5.8 local: 2 pruebas aprobadas. Un caso sigue crédito y recepciones durante seis ciclos, con una segunda empresa y arrastre de inventario y caja. Su salida contiene las trazas. No constituye aceptación de tres empresas, todos los componentes contables, concurrencia real ni eventos. No se consultó ni modificó una base remota.

Comando desde la raíz, tras instalar PGlite 0.5.8 en `.cache/test-runtime`: `$env:NODE_PATH=(Resolve-Path '.cache/test-runtime/node_modules').Path; node --test tests/continuidad_seis_ciclos_activos.test.cjs`.

La prueba `tests/excel_v2_caso_fisico.test.cjs` ejecuta dos casos físicos; comparación del Excel recalculado en `reports/RECALCULO_EXCEL_V2.json`. Falta conciliación exhaustiva de inventario valorizado por SKU, costo de ventas y resultados de tres empresas en los seis ciclos.

Trazas y snapshots del caso ejecutado: `tests/output/conciliacion_logia_6_ciclos.json` y `tests/output/conciliacion_logia_6_ciclos.log`. Son archivos locales ignorados por Git; el escenario incluye dos empresas, no tres. La segunda empresa se comprueba en cuanto a arrastre de caja, venta de inventario previo y balance, no se ha emitido su traza completa de seis ciclos.

Continuación: `node --test tests/excel_v2_caso_fisico.test.cjs tests/authoritative_worker.test.cjs tests/world_economic_independence.test.cjs tests/continuidad_seis_ciclos_activos.test.cjs`, con PGlite 0.5.8 en NODE_PATH, produjo 21 aprobaciones y 0 fallos; registro local `tests/output/continuacion_logia_v2.log`. Se añadió al caso V2 una comparación de consumo y valoración por SKU y repetición de cierre local. Sigue pendiente la prueba de tres empresas y seis ciclos con eventos.
