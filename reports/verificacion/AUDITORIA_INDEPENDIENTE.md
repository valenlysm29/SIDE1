# Dictamen de auditoría independiente

23/10/2026. Revisión de lectura, sin modificar el juego ni Supabase.

**Resultado: 11.900 controles aprobados, 0 fallos.** Se revisaron 15 escenarios: 111 resultados numéricos comparables coinciden; el registro de caja E12 queda NO COMPARABLE porque el Excel original no contiene una transición completa de caja por ciclo.

Fuente: `.codex-work/DECISIONES_SIDE_16.xlsx`, SHA-256 `3b6b42bbbc56a2534ce7e241c607d572dd38dcf02311683609497df36a0c1eb1`. Se verificaron independientemente el hash, las entradas de las doce copias recalculadas, las fórmulas preservadas y los valores esperados leídos directamente de sus celdas. La comparación de fórmulas reconoce la serialización de Excel: objetos ArrayFormula, mayúsculas, `=+` y prefijos `_xludf`/`_xlfn`. Los errores heredados se conservan como evidencia; esta normalización no convierte errores en resultados numéricos.

Las reglas de E14 y E15 se contrastaron con el texto original de `Matriz_Consecuencias!C2:D3`: calidad 4 no activa la condición estricta `<4` ni el premio `>=7`; calidad 12 activa el premio de 40% y reputación +2. Son interpretaciones de reglas escritas, no resultados de fórmulas inexistentes.

Los 111 valores obtenidos se contrastaron además con los registros independientes del navegador: E01–E09 en una partida local registrada y E10/E11/E13/E14/E15 en el componente original aislado. La segunda modalidad verifica componentes, no una partida completa para esos casos. E12 prepara un estado local de caja cero y observa caja −2.712,32 tras fijos; no demuestra rechazo de una compra ni creación normal de una partida con capital cero. Estos límites permanecen explícitos en la entrega.

Se comprobó el libro final: cinco hojas temáticas y Resumen, 112 registros, 111 OK, 0 DIFERENCIA, 0 PENDIENTE y 1 NO COMPARABLE; tolerancia 0,01 en Resumen!B4; diferencias, porcentajes y estados con fórmulas reales; valores almacenados tras recálculo; reglas de formato condicional y ausencia de errores de fórmula. Excel COM 16.0 informa 369 fórmulas y 0 errores; el libro abre normalmente, sin reparación.

El PDF tiene 27 páginas A4. Se extrajo su texto y se contrastaron los valores esperados de las 111 mediciones con cada sección individual, junto con la tolerancia y la fuente. La revisión visual de las 27 páginas fue realizada por el subagente de guía y consta en `evidencia/revision_visual_pdf.json`. Esta auditoría independiente comprobó su cobertura y realizó la revisión numérica/textual; no suplanta la inspección visual registrada.

Se contrastaron los registros de las pruebas: oráculo original con 4.220 controles comparables y cero diferencias; Node 170/170; SIM-1, SIM-2, SIM-3 y los runners relevantes de navegador en verde. No se atribuye a estas pruebas cobertura de NPC/3D.

Durante la integración se descartó una versión anterior del comparativo sin valores recalculados. La versión final volvió a verificarse completamente. También se comprobó la corrección de E13: la selección histórica daba 17/8/−3 y la selección vigente guardada da 16/6/−1. La selección vigente se volvió a introducir en una copia del Excel y sus resultados se leyeron después de recalcular. No se ocultó la incompatibilidad histórica ni se cambió la lógica del juego.

El script `auditar_independiente.py` y `auditoria_independiente.json` contienen los controles reproducibles y sus resultados. No es necesario ejecutar SQL ni ninguna acción en Supabase.
