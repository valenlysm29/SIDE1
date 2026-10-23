# Verificación SIDE frente al Excel original

Fecha: 23/10/2026 (Lima). Repositorio: https://github.com/valenlysm29/SIDE1.git. Base de verificación: `13f5946`.

## Resultado y alcance

15 escenarios documentados (E01–E15): **14 con resultados comparables, 111 mediciones coincidentes y 0 diferencias**, con tolerancia absoluta declarada de 0,01 en `Resumen!B4`. E12 se registra **NO COMPARABLE**: el original no define caja integrada por ciclo. No se convierte esa ausencia en un esperado cero.

El oráculo amplio contra el original informa **4.220 comprobaciones comparables, 0 diferencias**, de 4.272 comprobaciones intentadas. Excluye 52 errores de la fuente y contiene 4.100 comparaciones numéricas. Estos conteos son distintos de las 111 mediciones de los escenarios manuales y no deben sumarse.

- Pruebas Node relevantes: **170/170**, sin fallos ni omitidas.
- SIM-1: **PASS**, un ciclo y cuatro empresas.
- SIM-2: **PASS**, tres ciclos y dos empresas.
- SIM-3: **PASS**, tres ciclos y cinco empresas.
- Navegador: DOP por cantidad, costos independientes (153 comprobaciones) y ciclo/pestañas: **PASS**.
- E01–E09: motor de planificación y página real en una partida local registrada, sin red externa.
- E10, E11, E13, E14 y E15: motor y componente de edición original montado de forma aislada en Chromium. Esta evidencia no acredita por sí sola la navegación completa de una partida para esos cinco casos. Las tres SIM sí ejercitan registro, decisiones y cierre docente local.
- E12: capital cero controlado, con reaplicación de fijos y observación de caja −2.712,32. No acredita rechazo de compra por falta de caja ni tiene esperado equivalente en el original.

## Entregables

- `GUIA_VERIFICACION_SIDE_vs_EXCEL.pdf`: preparación, escenarios, capturas, registro imprimible, equivalencias y construcción manual del comparativo.
- `COMPARATIVO_SIDE_vs_EXCEL.xlsx`: Resumen y cinco hojas temáticas; valores esperados con celdas de origen, diferencias, porcentajes y estados con fórmulas, formato condicional y hojas de trazabilidad.
- Este resumen. Los JSON, generadores y la carpeta `evidencia/` permiten revisar la procedencia de los resultados.

## Fuente y recálculo independiente

Fuente intacta: `.codex-work/DECISIONES_SIDE_16.xlsx`.

SHA-256: `3b6b42bbbc56a2534ce7e241c607d572dd38dcf02311683609497df36a0c1eb1`.

Se leyó el original dos veces con openpyxl, conservando por separado fórmulas y valores. Se recalcularon doce copias exactas mediante Microsoft Excel COM 16.0, modificando únicamente entradas. E13 se volvió a recalcular tras capturar las opciones efectivamente guardadas por la pantalla. Las fórmulas del original no se modificaron. Las consecuencias proceden de condiciones y efectos escritos en `Matriz_Consecuencias`, que no contiene fórmulas.

Los resultados E01–E11 y E13 se leyeron de las copias recalculadas. E14 y E15 se deducen de las condiciones y porcentajes literales originales, no del código de SIDE: calidad 4 no activa castigo ni premio; calidad 12 activa +40% y +2 de reputación.

## Hallazgos y límites que no deben ocultarse

1. **Selección histórica y pantalla actual:** la selección histórica de E13 daba eficiencia/reputación/salud `17 / 8 / −3` en el motor sin normalizar, frente a `16 / 6 / −1` después de guardarla en el componente de pantalla. `js/engine/ui_excel.js:25–36` (`prepararDecisiones`) filtra opciones y deriva otras de campos actuales; `:248` guarda el borrador. No se corrigió la lógica. La evidencia inicial se conserva en `evidencia/E13-seleccion-efectiva.json`. El caso final utiliza la selección efectiva, que se introdujo en el Excel original y se recalculó: **6,2 de calidad, 16 de eficiencia, 6 de reputación y −1 de salud**, con costos unitarios **96 / 51 / 31**. La igualdad final no borra la incompatibilidad del caso histórico.
2. **Cantidad cero:** `CANTIDAD DE PRODUCCIÓN!E37:E39` divide entre cero; `D42:L44` devuelve necesidades brutas cero y sí se compara. Los errores no se reemplazaron por cero. También existen errores heredados en otras celdas, incluidos `#NAME?` al recalcular algunas fórmulas del original; véanse los JSON.
3. **Capacidad:** 396 corresponde al ejemplo del libro; no existe un máximo universal de cantidad ni una receta inversa original de cantidad a personal, máquinas y tiempo. La igualdad del DOP probada aquí cubre cantidades y necesidades materiales explícitas; no valida como fórmula Excel lo que el libro no define.
4. **Stock:** E03 y E08 solicitan la misma cantidad (10). Las necesidades brutas permanecen 3 m² de cuero, 10 accesorios y 60 m de hilo; la disponibilidad modifica el faltante. El stock del navegador se controla en la prueba local; no se afirma que el usuario pueda escribir directamente el inventario en el menú.
5. **Calidad baja:** el lote completo más básico del catálogo suma 4. El caso manual E14 prueba esa frontera. Calidad 3 es un control técnico artificial y no se presenta como lote completo seleccionable.
6. **Caja:** se verifican los recibos y sus sumas dentro de SIDE, pero el original no tiene un libro mayor completo que permita certificar toda la caja por ciclo. La caja inicial de las capturas es 100.000 y, tras fijos de 2.712,32, queda 97.287,68. Esos importes son evidencia operativa de SIDE, no esperados atribuidos al Excel.
7. **Menú vigente:** las capturas muestran Infraestructura, Producción, Logística, Ventas, Finanzas y Resumen. La guía da equivalencias con los nombres anteriores; no se cambió el menú para ajustarlo a la petición.
8. **NPC/3D:** esta ejecución se limita a pruebas relevantes de cálculo y decisiones. No se ejecutó ni se declara verde la regresión completa de NPC/3D; antecedentes de fallos se mantienen separados en `reports/atribucion_regresion_excel.md`. Ninguno se contabiliza como fallo de paridad Excel.

## Reproducción técnica

Ejecutar desde la raíz SIDE1. Los comandos ejecutados fueron:

```text
node tests/auditoria_original_20261023.cjs
node --test tests/*excel*.test.cjs tests/*20261023.test.cjs tests/dop_confirmation_capacity.test.cjs tests/production_dop.test.js tests/production_model.test.js tests/production_dop_target_ui.test.js tests/production_calculator_selector.test.js
node tests/sim_1.cjs
node tests/sim_2.cjs
node tests/sim_3.cjs
node tests/dop_excel_independent_20261022_browser.cjs
node tests/independent_cycle_costs_20261022_browser.cjs
node tests/decisions_cycle_ui.cjs
node tests/verificacion_side_browser.cjs
node tests/verificacion_caja_cero_browser.cjs
node tests/verificacion_componentes_browser.cjs
node tests/verificacion_side_datos.cjs
```

Las evidencias de ejecución están en `evidencia/`. Los runners nuevos guardan capturas y datos locales en `tests/output/verificacion/`. Para recalcular una copia de un caso con las entradas documentadas puede usarse `powershell -NoProfile -ExecutionPolicy Bypass -File tests/verificacion_recalcular_caso.ps1 -Caso E13`; requiere Excel de escritorio instalado y la fuente original local. No modifica el original.

El comparativo se construye con `reports/verificacion/construir_comparativo.py` y se recalcula con `reports/verificacion/recalcular_comparativo.ps1`. La guía se construye con `reports/verificacion/construir_guia.py`. Los generadores requieren sus datos JSON y las capturas locales; el PDF y el XLSX entregados se pueden abrir por separado.

## Supabase y cambios del proyecto

**No debe ejecutar SQL ni ninguna acción en Supabase.** No se consultó ni modificó Supabase en estas pruebas. No se cambió la lógica del juego, decisiones, avatares ni mundo 3D. Solo se añadieron documentación, artefactos y runners de verificación locales.

## Revisión final de artefactos

El comparativo se abrió normalmente y se recalculó en Excel 16.0: **369 fórmulas, 0 errores, 111 OK, 0 DIFERENCIA, 0 PENDIENTE y 1 NO COMPARABLE**. El PDF tiene **27 páginas A4**, todas renderizadas y revisadas visualmente sin texto cortado ni tablas desbordadas; constancia en `evidencia/revision_visual_pdf.json`. La auditoría independiente terminó con **11.900 controles aprobados y 0 fallos**: hash, entradas, fórmulas, valores, registros de navegador, celdas del comparativo y números del PDF. Dictamen en `AUDITORIA_INDEPENDIENTE.md` y detalle en `auditoria_independiente.json`. La aceptación se limita a las comparaciones y modalidades de prueba descritas; no certifica caja sin oráculo ni una partida completa para los cinco casos de componente aislado.
