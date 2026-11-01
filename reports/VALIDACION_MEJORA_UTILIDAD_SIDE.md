# Validación de mejora de utilidad de SIDE — avance parcial

Fecha: 1 de noviembre de 2026. Base: `origin/main` en `f7262256e9a0fcf268ce28ba85af8ba2c86b36a8`. Rama: `prueba_utilidad_mejora`.

**Estado: no se ha completado la corrección integral ni se han modificado reglas económicas.** Los resultados siguientes son caracterizaciones de la versión anterior; no demuestran que una propuesta sea segura ni satisfacen la validación masiva solicitada. No se han actualizado cierres de Supabase.

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

En estos casos el precio prémium de S/ 250 recibe CONS-02. Los valores no deben interpretarse como predicción de demanda ni como recomendaciones de precios. No hay tabla posterior a la corrección porque no se ha incorporado ninguna.

## Excel, fórmulas y parámetros

Se localizó `.codex-work/fuente_logia/SIDE_prueba_cantidad_produccion (2).xlsx`; SHA-256 `a07710cd97447d0a5f1b79f2e7e200b01565abbf4a8ee3ff02055fa2768189b3`. Esta sesión confirmó el archivo y su huella; la lectura directa con el Python disponible falló por falta de `openpyxl`, por lo que no se afirma un contraste independiente integral. El informe preexistente `reports/AUDITORIA_RENTABILIDAD_SIDE.md` recoge referencias y análisis anteriores, que deben volver a comprobarse contra el libro.

La configuración actual `md-20261027` conserva precios base S/ 42,50 / 100 / 250, el multiplicador prémium 1,4 y los umbrales de eficiencia 4 y 5. **Parámetros nuevos: ninguno. Fórmulas modificadas: ninguna.** La discrepancia de maquinaria es candidata a clasificación 1, corrección de implementación; calidad y demanda requieren contraste antes de clasificarse. No se han evaluado suficientemente los escenarios de precios A y B ni el efecto de una elasticidad absoluta.

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
