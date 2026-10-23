# Verificación independiente DOP y Excel — 22 de octubre de 2026

Autor: verificador independiente; no modificó código de producto. No se realizaron escrituras SQL.

## Oráculo reproducible

`tests/dop_excel_actual_oracle_20261022.py` llama secuencialmente al helper existente `tests/oracle/recalcular_com.ps1`, con rutas absolutas y copias bajo `tests/output/dop-20261022/independent/`. Nunca escribe `esperado_*.json` ni los libros versionados.

Fuente exacta: `.codex-work/DECISIONES_SIDE_16.xlsx`, SHA-256 `3b6b42bbbc56a2534ce7e241c607d572dd38dcf02311683609497df36a0c1eb1`. El runner comprueba el hash antes y después; Microsoft Excel COM recalcula con `CalculateFullRebuild` y guarda. Se exige versión 16.0 y estado de cálculo 0.

Se recalculan el original intacto, 14 variantes con cambios únicamente en D37:D39 de `CANTIDAD DE PRODUCCIÓN`, y ocho escenarios históricos. Las salidas directas son las nueve celdas de requerimientos D42/G42/J42, E43/H43/K43, F44/I44/L44, el total D36, la capacidad de ejemplo N5 y el reparto E37:E39. Los valores esperados de las pruebas nuevas proceden del archivo recalculado, sin usar aritmética JavaScript como oráculo.

Los ocho históricos son base, sim2, sim2_premium, sim1_pipeline, sim2_pipeline, sim3_pipeline, banca_pipeline y bancamezcla_pipeline; suman 3104 salidas. Sus libros `ORACULO_*` incluyen extensiones históricas documentadas y normalización `_xlfn.IFS`; no se presentan como copias intactas del original.

Los errores se conservan en las salidas de auditoría: COM devuelve HRESULT numérico para celdas con error, mientras la lectura posterior `data_only` registra el error Excel real. El original intacto recalculado presenta siete errores: CANTIDAD E75/G75/E123/G123 `#DIV/0!` y Lotes J2:J4 `#NAME?`. Las trece variantes con meta positiva mantienen esos siete. La variante de meta cero presenta 26 errores por propagación de divisiones por cero; E37:E39 son `#DIV/0!`, que no se comparan numéricamente con el control de cero de la interfaz. Las nueve necesidades de materiales son cero y sí se comparan con el juego.

## Pruebas nuevas

- `tests/dop_excel_independent_20261022.test.cjs`: compara los 14 requerimientos con Excel real, comprueba independencia de existencias con una fixture que efectivamente cambia el inventario, datos inversos explícitamente indefinidos y las 3104 salidas históricas contra el motor actual.
- `tests/dop_excel_independent_20261022_browser.cjs`: ejecutado secuencialmente en 1150×666, 1440×900 y 390×844. Incluye las 14 metas por tamaño, cambio de molde, existencias cero y sobrantes mediante controles reales de Logística, caja/ledger/HUD/proyección sin compras ficticias, guardado y reingreso, orden del DOP y siete conectores. Se avanzan tres ciclos automáticos por tamaño mediante el reloj de Playwright, sin asignar manualmente el número de ciclo. En ciclos 2 y 3 se verifica recibo, ledger, caja y HUD con el cargo Excel de S/ 2712,32, y que guardar la meta no agregue compras.

## Resultados finales

| Comprobación | Resultado |
| --- | --- |
| Excel COM real | 23 recálculos: original + 14 variantes + 8 históricos; todos versión 16.0 y estado 0 |
| Requerimientos directos | 14/14 variantes; 126 salidas de materiales y 14 totales coinciden con SIDE |
| Históricos recalculados | 3104/3104 salidas coinciden con el expected versionado, y con el motor actual |
| Node independiente | 23/23 pruebas, cero fallos |
| Node solo fixture versionado | 23/23 pruebas, cero fallos; no requiere resultados locales ignorados |
| Navegador real | 631 comprobaciones, cero errores JavaScript, 3 tamaños × 3 ciclos |
| Integridad | hash original intacto; ningún cambio en `esperado_*.json` ni en libros `ORACULO_*` |

Los ocho históricos aportan respectivamente 351, 28, 28, 468, 585, 1140, 252 y 252 salidas. Evidencia: `tests/output/dop-20261022/independent/summary.json`, `independent_excel_run.log`, `independent_node.log`, `independent_node_fixture_only.log` y `browser/summary.json`. La ejecución de navegador terminó el 2026-10-23 a las 04:21:47 UTC, todavía 22 de octubre en Lima.

El fixture versionable compacto `tests/oracle/dop_cantidad_20261022.json` contiene procedencia, timestamp UTC, hash, las 14 variantes y las 3104 salidas de Excel real. El test usa el recálculo local si existe y este fixture como alternativa en un checkout limpio. `SIDE_ORACLE_FIXTURE_ONLY=1` fuerza esta alternativa; se ejecutó correctamente. El runner Excel conserva una copia del fixture anterior en la salida ignorada antes de refrescarlo.

Las primeras ejecuciones del arnés de navegador se corrigieron por dos cuestiones de prueba: los insumos están en Logística, y el reloj detenido impide ejecutar `requestAnimationFrame` hasta avanzar unos milisegundos. La ejecución final permite esos cuadros sin llamar artificialmente al render del producto. No se rebajaron expectativas de cargos ni de metas.

## Revisión visual y límites

Se generaron capturas adicionales de las secciones visibles, desplazando el contenedor interno, bajo `browser/visible-*.png`. Se inspeccionaron directamente el diagrama de 1150, los requerimientos de 1440, los costos de 390 y la comparación de 390. En escritorio se leen la meta 397, los datos inversos indefinidos y los requerimientos 119,1 m², 397 accesorios y 2382 m. En móvil, las tablas extensas requieren desplazamiento horizontal interno; no hay desbordamiento horizontal global en las comprobaciones.

Observación visual comunicada a integración: en la captura móvil de costos, el párrafo introductorio parece cortarse a la derecha. La captura de comparación centró filas intermedias porque la sección supera el alto visible. Se ajustó el helper para futuras capturas con alineación al inicio, pero no se repitió navegador mientras integración ejecutaba Node. Esta observación no se presenta como revisión visual cerrada de todas las celdas móviles.

El resultado prueba los requerimientos directos y la compatibilidad histórica señalada. No demuestra una fórmula inversa para personal, maquinaria, tiempo ni costo total: el libro no las define, y la interfaz lo indica. Las reglas adicionales del juego y las discrepancias entre hojas se documentan en `reports/auditoria_motor_dop_2026-10-22.md`; no se atribuye igualdad total del juego con cada fórmula del libro original.
