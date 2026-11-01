# P0.2 — Diagnóstico de materiales

**Estado: LISTO PARA REVISIÓN**, sujeto a los límites indicados abajo. Rama `codex/p02-diagnostico-materiales`, basada en `main` `b28a4711163900ffd2a1944449a63d0d5106ac51`. No se integró ni desplegó.

## Cambios

- `js/production_model.js`: identifica materiales limitantes por molde y consumo secuencial; registra empates y no señala faltantes de un molde que cumple la meta. Conserva las funciones de recomendaciones existentes. La capacidad de materiales y el cálculo de unidades mantienen su función; el cálculo de límites enteros equivale a aplicar el piso al mínimo para valores no negativos.
- `js/temporal_production.js`: registra, durante la simulación diaria existente, las familias que impidieron usar capacidad disponible para una meta incompleta; al finalizar descarta los bloqueos de moldes cuya meta se alcanzó. El diagnóstico usa inventario efectivo y recepciones registradas del día, no pedidos pendientes. Una recepción tardía puede haber impedido producción en días anteriores aun cuando al final sobre material. No se altera la asignación de producción ni de inventario.
- `supabase/functions/side-business-close/runtime.mjs`: mismas modificaciones en las copias empaquetadas del modelo y motor temporal de Edge. Se añade `temporal.limitingMaterials` con nombres de familia en inglés; el diagnóstico público del plan conserva etiquetas en español y orden de materiales.
- `tests/p02_diagnostico_materiales.test.cjs`: oráculo aritmético y casos de mezcla, empates, stock, recepciones y continuidad. El oráculo procede de las pruebas de `efe1483`, ampliadas para el calendario.
- `reports/P02_DIAGNOSTICO_MATERIALES.md`: este informe.

La etiqueta temporal identifica bloqueos observados mientras había capacidad diaria libre, solo para moldes que terminan con meta incompleta. Es un diagnóstico de circunstancias observadas, no una atribución contrafactual exclusiva: un retraso puede coexistir con falta de capacidad posterior. Los demás indicadores agregados del plan, como `materialCapacity` y `shortfall`, no se han redefinido.

## Pruebas locales

Comando ejecutado desde la raíz:

```powershell
node --test tests/p02_diagnostico_materiales.test.cjs tests/production_recommendations.test.cjs tests/temporal_production.test.cjs tests/recepcion_preview_integracion.test.cjs tests/edge_lotes_equivalencia.test.cjs tests/continuidad_seis_ciclos_activos.test.cjs
```

**50 aprobadas, 0 fallidas.** Incluye 25 pruebas de diagnóstico y oráculo (un molde, mezcla, empates, meta completa, insuficiencia, recibos temprano, tardío y posterior al ciclo, y continuidad física durante 3 y 6 ciclos); 12 de recomendaciones; 8 de producción temporal y vista previa; 3 de equivalencia/rechazo Edge; y 2 de cierre temporal, incluida una partida de 6 ciclos con inventario y obligaciones. La prueba de cierre temporal compara el resultado completo de Node y Edge con una recepción parcial; la prueba de lotes compara el cierre completo sin libro temporal. En estos escenarios no se observaron diferencias entre ambas implementaciones. La continuidad de 3 ciclos es una prueba del motor físico; la de 6 incluye cierres persistidos locales. No se ha probado un despliegue remoto.

Las 12 pruebas de recomendaciones pasan y se conservaron las funciones `recommendResources`, `recommendIntegrated` y `threadAlternatives`, sin modificar sus controles. No se ejecutó la suite completa, las interfaces, ni todos los escenarios de concurrencia. No se abordaron los fallos históricos ni se verificó que estén resueltos. La prueba de presentaciones de la otra rama no forma parte de este parche ni se ha ejecutado en esta validación.

## Riesgos pendientes

- Las pruebas no agotan todas las combinaciones de recepciones parciales, múltiples moldes y capacidad diaria; el diagnóstico temporal registra bloqueos ocurridos, no cuantifica la contribución causal de cada factor.
- La representación añade un campo diagnóstico en el resultado temporal y los consumidores externos deberían tolerar campos adicionales. No se cambiaron precios, mantenimiento, eventos, opciones ni reglas económicas.
- Edge se comprobó localmente con su runtime empaquetado; falta revisión y, si se autoriza posteriormente, validación del despliegue y de la infraestructura real.
- La referencia `origin/develop` seguía sin actualizarse por el error registrado en el informe de continuidad; no interviene en la base del parche.
