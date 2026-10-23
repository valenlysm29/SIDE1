# Verificación DOP por cantidad — 22 de octubre de 2026

Se aplicó `.agents/skills/xlsx/SKILL.md`. Todas las operaciones y evidencias se mantuvieron dentro de SIDE1. Este trabajo no ejecutó modificaciones en Supabase.

## Pruebas añadidas y actualizadas

- `tests/dop_excel_editor_quantity.test.cjs`: 19 pruebas. Incluye los 14 casos del fixture del Excel real, con cantidades cero, mínima positiva, 396, 397, mezcla de moldes y 1000. Se comparan necesidades con las celdas D36 y D42:L44, sin derivar los esperados de constantes del motor. Cambiar stock o personal no cambia los requerimientos. Una meta mayor a N5 conserva su cantidad; N5 es la capacidad del ejemplo, no un máximo del juego. Cambiar solo la meta no cobra faltantes ni modifica la entrada.
- `tests/dop_excel_independent_20261022_browser.cjs`: se añadieron 24 comprobaciones de ayuda accesible, anuncios de total y actualización con teclado conservando foco. Runner final: **767 comprobaciones, cero errores de navegador**, a 1150, 1440 y 390 px. Comprueba los 14 casos reales, faltantes, stock físico, caja, guardado y recuperación, ciclos 2 y 3 y ausencia de desbordes.
- `tests/player_ui_contracts_20261021.test.cjs`: sustituido el contrato anterior de paquetes enteros redondeados por la división literal del Excel: 3/1 y 60/270. Se conserva la prueba de no sustituir cuero por otra calidad.
- `tests/decision_cards_20261022_browser.cjs`: se corrigió el arnés, que montaba un editor deshabilitado y luego exigía radios. Se inicia habilitado y se excluye la casilla de activación del modelo de la cobertura de tarjetas de decisiones. Runner verde con las cinco pestañas, guardados, caja y diseño en 390/1280 px.
- `tests/decisions_cycle_ui.cjs`: actualizado al selector único de molde y al atributo de meta actual del DOP. Se prueba el desplazamiento del contenedor real `decisionFormScroll`, incluida la llegada al final. El diagnóstico midió 7313 px de contenido dentro de un panel de 376 px; exigir `window.scrollY` correspondía al diseño anterior. Se mantuvieron las exigencias de legibilidad, ausencia de solapes y alcance del contenido.
- `tests/dop_excel_actual_oracle_20261022.py`: añadido lector de errores cacheados que reconoce también cadenas exactas de error con `data_type=s`. Verificado contra el archivo original: E75, G75, E123 y G123 contienen `#DIV/0!` como cadenas. No se modificó el libro original; esta comprobación no requiere COM y no cambia los resultados numéricos esperados. El siguiente recálculo completo incorporará `original_cached_errors` en los metadatos del fixture.

## Resultados finales

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Node completo, ejecución posterior a los cambios UI | **533/533 PASS** | `tests/output/dop-20261022/node-final.log` |
| Editor contra Excel real | **19/19 PASS** | `tests/output/dop-20261022/editor-quantity-node.log` |
| Oráculo COM real, 14 casos nuevos | **0 diferencias** | `tests/output/dop-20261022/independent/summary.json` |
| Oráculos históricos, 8 escenarios | **3104 salidas, 0 diferencias** | mismo resumen; fixture versionado |
| SIM-3, UI real, 3 ciclos, 5 empresas | **1140 salidas, 0 diferencias** | `tests/output/logica_excel/sim-3-paridad.json`, `tests/output/dop-20261022/sim3-revalidation.log` |
| Persistencia DB local, cantidades escalares y opciones | **PASS** | `tests/output/dop-20261022/decision-options-db-revalidation.log` |
| Navegador principal DOP | **767 PASS** | `tests/output/dop-20261022/browser/summary.json` |
| Tarjetas del editor | **PASS** | `tests/output/dop-20261022/decision-cards-final.log` |
| Ciclo de decisiones, seis resoluciones, cinco pestañas, teclado y guardado | **PASS** | `tests/output/dop-20261022/browser/decisions_cycle_ui-final.log` |
| Contratos UI/responsive después del ajuste CSS | **16/16 PASS** | `tests/output/dop-20261022/css-targeted-final.log` |

SIM-1 y SIM-2 fueron ejecutadas por integración y comunicadas verdes; sus pipelines históricos también están cubiertos por las 3104 salidas del oráculo. El agente Pruebas ejecutó SIM-3. Los oráculos históricos contienen extensiones documentadas; no equivalen a fórmulas que existan en el libro original. El fixture conserva procedencia COM y SHA-256 del archivo original.

La primera ejecución ampliada Node tuvo 532/533: falló exclusivamente la expectativa antigua de redondear presentaciones. Después de corregir ese contrato, la ejecución completa terminó 533/533. No hubo fallos NPC en esta ejecución.

El runner de decisiones también expuso un problema previo de legibilidad de insignias de pestañas: la regla adaptable fijaba 10 px, frente al mínimo de 11 px y 24 px de altura exigido por el contrato. `git show 159e5fc:css/production.css` confirmó que la regla ya existía antes de esta tarea. UI corrigió el mínimo sin cambiar las decisiones ni las pestañas y volvió a ejecutar el runner completo: verde en seis resoluciones. No se rebajó la aserción.
