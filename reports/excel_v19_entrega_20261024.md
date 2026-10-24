# Excel v19 y oráculo independiente

Base v16 autorizada expresamente por el usuario, dado que v18 no está disponible. Original `.codex-work/DECISIONES_SIDE_16.xlsx` intacto, SHA256 `3b6b42bbbc56a2534ce7e241c607d572dd38dcf02311683609497df36a0c1eb1`. Entrega: `docs/DECISIONES_SIDE_19.xlsx`.

Se aplicó la skill `.agents/skills/xlsx/SKILL.md`. Se leyeron todas las hojas dos veces, fórmulas y valores. LibreOffice no está instalado en PATH, ubicaciones estándar ni runtime; se usó Microsoft Excel COM16.0 como alternativa explícita. Se ejecutó CalculateFullRebuild, se guardó el archivo y se verificaron las cachés de todas sus hojas. No se afirma haber usado LibreOffice.

536 cambios registrados por celda en Control_de_cambios, con antes/después/motivo, y Supuestos con reglas no determinadas por la fuente. Las celdas del registro que empiezan con `=` son literales auditables, no fórmulas que accidentalmente recalculan. Precio nuevo en Lotes_Produccion M2:M4 con validación de Excel y resultado visible; los cuatro grupos finales del catálogo existente se seleccionan en filas24:27 de Seleccion_Ciclo0. No son decisiones nuevas.

E1 rangos completos hasta69, E2 doce costos monetarios a números y once fórmulas constantes a números (estas últimas ya eran fórmulas válidas en v16), E5 calidad por lote normalizada y fórmula v2 protegida, E6 reputación única de catálogo0–10, E7 capacidad24d y productividades CANTIDAD, E8 fechas eliminadas por referencias a calidad, E9 puntajes0–10 y Premium<7 penaliza. M5 cuenta todos los N3 y se limita100%. v1 permanece explícitamente obsoleto. Los bloques v2 duplicados incorporan stock, producción efectiva, MIN de ventas, ingresos y precio efectivo. Los ejemplos de mercado son por empresa y sus entradas adicionales pueden editarse; los escenarios independientes verifican cuatro empresas reales.

Resultado global: **1663 fórmulas, cero errores Excel**. Validador independiente:68opciones,0búsquedas truncadas,0costos sucios,0fechas corruptas,0errores. Reporta48cachés vacías: son fórmulas que devuelven cadena vacía cuando no hay selección; el exportador rechaza cachés numéricas ausentes y pasó.

`node tests/oracle_v19.cjs`: **498 comparaciones, cero diferencias**. Esperados provenientes exclusivamente del libro recalculado, nunca de salidas JS:

- Nueve escenarios de mercado×cuatro empresas: normal de cada segmento, empate, sin stock, no produjo, Premium incoherente, demanda perdida y dos ciclos de reputación baja.
- Lotes reales de la fuente con calidad10/5/4; puntajes con las cuatro selecciones existentes adicionales; nueve costos laborales MYPE.
- `E.closeMany` ejecutado con cuatro empresas y tres segmentos:12filas del libro, capacidad, producción, calidad, reputación, asignación, venta, precio efectivo, ingreso, CxC, caja, almacenaje y consumo de las tres familias de insumos.
- Capacidad real del módulo nuevo en los tres niveles laborales, con cuatro trabajadores por área y maquinaria industrial de ensamble/acabado.

El oráculo no demuestra toda combinación posible ni sustituye pruebas de navegador/servidor. La contabilidad completa multiciclo, resiliencia y SQL son verificaciones separadas del integrador. No se modificó runtime ni SQL desde esta tarea.

## Reproducción

Desde SIDE1:

1. `python tests/oracle/build_v19.py` (requiere la fuente v16 autorizada; regenera v19 sin cachés).
2. `powershell -File tests/oracle/recalc_v19.ps1` (Excel COM; obligatorio tras regenerar).
3. `python tests/oracle/export_v19.py` (verificación exhaustiva y exportación de cachés; genera plan de escenario).
4. `powershell -File tests/oracle/recalcular_com.ps1 -Plan <SIDE1>/tests/fixtures/excel_v19_scenario.json -Modelo <SIDE1>/docs/DECISIONES_SIDE_19.xlsx -LibroSalida <SIDE1>/tests/output/excel_v19/scenario.xlsx -JsonSalida <SIDE1>/tests/output/excel_v19/results.json`.
5. `python tests/oracle/export_v19.py` de nuevo para conservar resultados COM del escenario en fixtures rastreadas.
6. `node tests/oracle_v19.cjs`.

Para ejecutar el test normal desde un clon bastan los archivos rastreados `reports/excel_v19_oracle.json`, `tests/fixtures/excel_v19_scenario.json` y `tests/fixtures/excel_v19_expected.json`. No necesita v16, Excel instalado ni los temporales ignorados.
