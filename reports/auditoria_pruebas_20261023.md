# Auditoría: reconstrucción independiente de oráculos — 23 de octubre de 2026

## Procedencia y método

Antes de modificar artefactos se copió íntegramente `tests/oracle/` a `.codex-work/auditoria-20261023/oracle-backup/`. El archivo original `.codex-work/DECISIONES_SIDE_16.xlsx` permaneció intacto, SHA-256 `3b6b42bbbc56a2534ce7e241c607d572dd38dcf02311683609497df36a0c1eb1`.

Los esperados se reconstruyeron desde fórmulas Excel y se recalcularon mediante Microsoft Excel COM 16.0. Nunca se sustituyeron por resultados obtenidos de SIDE. `exportar_entradas.cjs` y `banca_recuperacion.cjs --exportar` exportaron exclusivamente decisiones y parámetros; los builders escribieron fórmulas y referencias. Los archivos `obtenido_*` registran después el resultado de SIDE para compararlo con esos esperados independientes.

Secuencia reproducible desde SIDE1, con el Python del runtime que dispone de openpyxl:

1. `node tests/oracle/exportar_entradas.cjs` y `node tests/oracle/banca_recuperacion.cjs --exportar`.
2. `python tests/oracle/run_oracle.py base --construir`.
3. `python tests/oracle/construir_sim2.py sim1`, `sim2` y `sim3`; este builder conserva lotes, FIFO e identidades.
4. `python tests/oracle/construir_pipeline.py banca` y `bancamezcla`.
5. `python tests/oracle/extender_finanzas.py`.
6. `python tests/oracle/run_oracle.py` para `sim2`, `sim2_premium`, `sim1_pipeline`, `sim2_pipeline`, `sim3_pipeline`, `banca_pipeline` y `bancamezcla_pipeline`.
7. `python tests/dop_excel_actual_oracle_20261022.py`: vuelve a calcular los 14 casos DOP en copias del original y los ocho escenarios históricos. El COM se ejecutó de forma secuencial y exclusiva.

## Criterios corregidos en los builders

- `run_oracle.py`: CONS-06 compara cantidad **producida** con capacidad, conforme a `Matriz_Consecuencias!C7`. La fórmula auxiliar usa B11>B10; se eliminó el uso incorrecto del plan B9. La tarifa auxiliar de horas extra sigue identificada como una extensión histórica; no se atribuye al Excel original una tarifa que no define.
- `construir_pipeline.py`: la calidad usada por el mercado sigue el modo literal del libro; para todos los segmentos el denominador es la suma de reputación del grupo económico del ciclo, conservando la referencia absoluta original `Costos De Producción!$D$122`. CONS-06 y horas extra comparan producción ejecutada con capacidad.
- `construir_sim2.py`: el mercado por lotes mantiene ese denominador económico, incluso cuando calcula otro segmento. No normaliza la fórmula dentro del segmento ni sustituye el proxy literal por calidad de materiales.

Estos cambios ajustan las extensiones históricas para que no contradigan el original. Las hojas añadidas siguen siendo extensiones documentadas y no reemplazan la auditoría directa de fórmulas del libro original.

## Transición numérica de los esperados

`reports/auditoria_transicion_oraculos_20261023.json` conserva cada clave, valor anterior y valor Excel nuevo. Se detectaron **696 cambios semánticos entre 3104 salidas**; se ignoran en ese conteo únicamente residuos flotantes dentro de la tolerancia de comparación de 1e-9.

| Escenario | Salidas | Esperados modificados |
|---|---:|---:|
| base | 351 | 0 |
| sim2, consecuencias | 28 | 3 |
| sim2_premium, consecuencias | 28 | 3 |
| sim1_pipeline | 468 | 68 |
| sim2_pipeline | 585 | 190 |
| sim3_pipeline | 1140 | 322 |
| banca_pipeline | 252 | 55 |
| bancamezcla_pipeline | 252 | 55 |

Ejemplos verificables: en el escenario de consecuencias, producir 365 con capacidad 396 ya no activa CONS-06 aunque el plan sea 520; el cargo auxiliar pasa de S/782.8282828282829 a cero. En SIM-1 empresa A ciclo 1, horas extra pasa de S/1642.2988785046725 a cero y costos totales de S/67659.29387850466 a S/66016.995. El cambio de proxy de mercado modifica asignaciones: SIM-2 A ciclo 1 pasa de 9 a 10; SIM-3 A ciclo 1 pasa de 33 a 30. Los efectos en ventas, inventario, utilidad y caja se propagan mediante fórmulas del libro reconstruido.

## Verificación

Los logs de esta ejecución están en `tests/output/auditoria-20261023/`. El coordinador mantiene por separado la auditoría directa del libro original y sus perturbaciones; este informe documenta la reconstrucción de los escenarios históricos y las regresiones de integración.
