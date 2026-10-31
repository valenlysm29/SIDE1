# Auditoría parcial Excel V2 y SIDE

Estado: **incompleta**. Base `55dd58be0e002822be20c128ab4cbed57e640ead`, rama `logia_prueba_mejora`. Fuente `SIDE_prueba_cantidad_produccion (2).xlsx`, SHA-256 `a07710cd97447d0a5f1b79f2e7e200b01565abbf4a8ee3ff02055fa2768189b3`. No se ha modificado el original. `INVENTARIO_FORMULAS_EXCEL_V2.md` relaciona las 586 fórmulas, no las valida. Conteos: Seleccion_Ciclo0 98; Catalogo_Decisiones 11; Costos De Producción 443; Lotes_Produccion 17; Motor_Puntajes 17.

## Recalculo y caso físico

Se ejecutó Excel `CalculateFullRebuild` con copia de idéntico SHA, abierta de solo lectura y cerrada sin guardar. Evidencia `reports/RECALCULO_EXCEL_V2.json`; reproducir con `tests/recalcular_excel_v2.ps1`. El resultado siguiente distingue fórmulas y entradas manuales:

| Celda | Interpretación | Resultado | Clasificación |
|---|---|---:|---|
| K5 `MIN(I8,I14,I20)`; L5 `K5*30`; M5 `K7+(F7+F13+F19)/100+4%*F21`; N5 `ROUND(L5*M5,0)` | Cuello de botella, días, eficiencia y capacidad ajustada | 14; 420; 0,91; 382 | Igual para el caso probado en `js/production_model.js`; las asignaciones y todos los perfiles requieren comparación adicional |
| D46:D48 | Metas manuales | 150, 140, 95 | Entradas del libro, no producción efectiva |
| E46:E48; E49 | Producción manual y suma | 150, 140, 78; 368 | E46:E48 son entradas manuales, no prueba de que Excel calcule la producción |
| H49:J49 | Necesidades de metas | 167,5; 385; 3.115 | Conservada; no es consumo efectivo |
| L49:N49 | Necesidades de producción consignada | 155,6; 368; 2.894 | Igual para el caso físico probado |
| F54:F61 | Kardex usa H49:J49 y limita por compras | 167,5; 385; 2.900 | Error demostrado del Excel respecto a la etiqueta CARDEX (LO REAL), para este caso: exceso 11,9; 17; 6 |
| G54:G61 | Saldos según salidas del propio Kardex | 32,5; 5; 0 | Diferencia frente a físico calculado 44,4; 22; 6; pendiente comprobación SKU y costo de cierre oficial |

La necesidad de hilo planeada excede 2.900: 150×6 + 140×7 deja 1.020; 78×13 consume 1.014 y quedan 6. Capacidad 382 no debe igualarse a producción 368. D52 dice `CARDEX (LO REAL)`; J2:J4 de Lotes_Produccion contiene IFS. El Excel no se ha corregido ni sustituido.

`tests/excel_v2_caso_fisico.test.cjs` comprueba el motor de producción de SIDE y límites de hilo, no equivale a probar Kardex o costos de cierre persistido. `js/engine/produccion.js` es otro motor con reparto proporcional; no se ha demostrado que sea el motor de cierre autorizado ni que sea equivalente en este caso. `js/production_model.js`, `js/cycle_model.js`, `js/engine/cierre.js` y `services/partida_service.js` componen rutas principales; pedidos y recepciones están en `js/material_orders.js`, `js/temporal_production.js` y migraciones de Supabase.

## Pendiente de equivalencia

Costos por SKU y valoración, activos, depreciación, reparto por segmento, impuestos, préstamos, todos los perfiles de capacidad y comparaciones de seis ciclos siguen pendientes de auditoría exhaustiva. El conteo de fórmulas no demuestra equivalencia. No se ha modificado ninguna regla productiva ni financiera. Las pruebas parciales de seis ciclos solo cubren dos empresas y no incluyen desafíos.

## Continuación: cierre y valoración por SKU

El inventario de fórmulas se regeneró usando el texto y rango de `ArrayFormula` en lugar de su representación Python. Se verificó el SHA del libro, el conteo 586, ausencia de objetos representados y estabilidad del archivo al regenerarlo. No se han validado por ello sus equivalencias.

La prueba `tests/excel_v2_caso_fisico.test.cjs` ejecuta ahora el cierre local completo con el caso 382/368. Mantiene las metas, comprueba lotes de material y saldos por SKU (cuero sintético 0, estándar 14,4, premium 30; accesorios económicos 0 y premium 22; hilo estándar 0, reforzado 0 y premium 6), su conservación física y los valores de inventario bajo las decisiones y descuentos del escenario. En ese fixture los materiales consumidos valen S/ 22.082,24; toda la producción se vende, por lo que costo de ventas y costo de producción del ciclo coinciden. El cierre repetido recupera el mismo recibo y el balance concilia. Estos importes se derivan de las reglas SIDE del fixture, no de la valoración recalculada SKU por SKU del Excel; no se declara equivalencia económica general.
