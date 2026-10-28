# Contraste independiente de fuentes originales y motor 2D — 27/10/2026

## Fuente recibida hoy y preservación

La inspección por nombre y fecha de los documentos SIDE de Descargas identificó dos fuentes recibidas el 27/10/2026: `DECISIONES SIDE (19).xlsx` (11:45, 100359 bytes) y `Logica_SIDE_Costos_de_Produccion.md` (12:11, 29699 bytes). No se modificaron archivos de Descargas.

Se conservó una copia exacta del Excel original en `docs/referencias/DECISIONES_SIDE_19_original.xlsx`. Es una referencia de solo lectura, distinta del libro adaptado `docs/DECISIONES_SIDE_19.xlsx`, que se mantiene intacto.

| Archivo | SHA-256 |
| --- | --- |
| Original recibido y copia `docs/referencias/DECISIONES_SIDE_19_original.xlsx` | `45d2897365a442d2730c09935f53c0b1173f697a0dcb9708c0b9846cde3d32c2` |
| Markdown recibido y copia `docs/Logica_SIDE_Costos_de_Produccion.md` | `66908066c0b93b1275c137061271ff9d67885d4e3a3a9caedb03fec78936a0d5` |
| Libro anteriormente adaptado `docs/DECISIONES_SIDE_19.xlsx` | `7c5eac34a8ae254b37d47492cca027d028b5a4c8358a6c3a5388a776711b1faf` |
| Libro de reservas `docs/DECISIONES_SIDE_logica_produccion.xlsx` | `1beb0ec1e73eb2cec94576ca64b2594b34bf840874f6ecd5aa930ef63c93a6d7` |

El Markdown del usuario y las correcciones que este propone sobre el bloque oficial de Costos del original recibido son el criterio vigente. Ni el número «19» ni el nombre de una prueba demuestran que el libro adaptado conserve esa lógica.

## Inspección individual de las hojas originales

Lectura independiente de fórmulas y valores en caché mediante dos aperturas de `openpyxl`. No se guardó ni recalculó el libro. Las 11 hojas no contienen errores de fórmula en sus valores guardados; esto no garantiza un recálculo nuevo.

| Hoja | Celdas pobladas / fórmulas | Papel y resultado de la revisión |
| --- | --- | --- |
| Instrucciones | 9 / 0 | Contexto de uso del libro; no genera ventas. |
| DECISIONES | 6 / 0 | Grupos de decisión; no es estado productivo persistido. |
| Seleccion_Ciclo0 | 134 / 98 | Elecciones/consultas al catálogo. No representa por sí sola las cantidades físicas de cada ciclo. |
| Catalogo_Decisiones | 793 / 11 | 68 opciones y aportes. Sus puntajes históricos no sustituyen la reputación operativa especificada en el bloque 113. |
| FlujoWeb | 75 / 0 | Descripción del flujo web; no contiene cierre contable ni recibo de ventas. |
| CANTIDAD DE PRODUCCIÓN | 640 / 223 | Otro modelo de producción y asignación. Sus reglas deben distinguirse del bloque Costos que el documento actual selecciona. |
| Costos De Producción | 1273 / 503 | Fuente seleccionada por el documento actual. Producción, consumo, reputación y mercados revisados por coordenada. |
| Copia de Costos De Producción | 1273 / 503 | Idéntica celda por celda a Costos; cero diferencias de valor/fórmula. No es un segundo escenario. |
| Lotes_Produccion | 37 / 17 | Datos/selecciones de lotes del modelo anterior; no deben convertir un plan de la interfaz habitual en una fila vacía. |
| Motor_Puntajes | 35 / 17 | Suma aportes del catálogo. No usar como sustituto de `G113 / 4` en el motor vigente. |
| Matriz_Consecuencias | 45 / 0 | Consecuencias del modelo anterior. El documento vigente selecciona el bloque de mercado 113–152 y sus ajustes; no debe recibir penalizaciones automáticas duplicadas de ese otro motor. |

El nombre de dos hojas contiene en los archivos caracteres mal codificados; la evidencia local identifica las hojas por prefijo para no confundir una hoja ausente con datos vacíos.

## Diferencias concretas entre el original y el libro adaptado

Todas las celdas siguientes pertenecen a la hoja Costos. Los valores son cachés de los respectivos archivos.

| Celdas | Original recibido hoy | `docs/DECISIONES_SIDE_19.xlsx` adaptado | Implicación |
| --- | --- | --- | --- |
| E5:E7 | Valores 6 / 8 / 12 | Enlaces a CANTIDAD, cachés 5 / 7 / 9 | Productividad distinta. |
| L5 | `=K5*30`, 420 | `=K5*24`, 288 | Ciclo de 30 frente a 24 días. |
| M5 | `=K7+(F7+F13+F19)/100+4%*F21`, 0.91 | Suma todos los N3 y limita a 1, 0.92 | El Markdown pide corregir la omisión N3; 0.92 es coherente con ese ajuste. |
| N5 | 382 | 265 | No son el mismo escenario de capacidad. Con productividad y días actuales más la corrección N3 debe resultar 386. |
| C113:F113 | Fórmulas operativas, factores 2.119565 / 2.857143 / 3.210927 / 3 | Valores cero | El libro adaptado no puede usarse como expectativa de reputación operativa vigente. |
| G113 | `=SUM(C113:F113)`, 11.18763508 | `=Motor_Puntajes!B10`, 0 | Sustitución por otra definición de reputación. |
| E118 | `ROUND(D118/$D$122*100,0)`, 20 | `MAX(0,MIN(10,N118))*10`, 0 | Calidad proxy de reputación frente a calidad de un lote vacío. La fórmula actual debe usar materiales realmente consumidos y producción. |
| J118 | 1292 | 0 | La demanda de los ejemplos diverge antes de considerar inventario. No demuestra una partida real con cero ventas. |

`docs/DECISIONES_SIDE_logica_produccion.xlsx` conserva en su hoja Costos las cifras originales de 30 días y los factores de reputación. Su hoja CANTIDAD, en cambio, fue modificada para reservas y reparto proporcional: no se deben mezclar sus 397 de capacidad y 190 producidas con el algoritmo secuencial vigente.

## Documentos revisados individualmente

| Documento | Regla aplicable / contradicción |
| --- | --- |
| `docs/Logica_SIDE_Costos_de_Produccion.md` | Bloque oficial A113:N152; filas 65–109 excluidas. Corrige eficiencia, consumo real, inventario inicial, escala reputación, precios empatados, restos mayores y tope por inventario. Ingresos y resultados son propuestas añadidas por el documento; el Excel no contiene una celda consolidada de ingresos. |
| `docs/actualizacion_logica_documento_20261027.md` | Implementación vigente: 30 días, prioridad N1→N2→N3, calidad real, reputación promedio 0–10 y gasto productivo completo del ciclo. Conserva los controles existentes. |
| `docs/LOGICA_PRODUCCION_EXCEL.md` | Variante de reservas proporcionales. Declara expresamente que entonces no modificaba el motor JavaScript. Es antecedente, no regla alternativa que se deba combinar con la secuencia del documento actual. |
| `docs/logica_excel/ESPECIFICACION.md` | Referencia del libro 16: 24 días, productividad distinta, bloque 65, redondeo literal y consecuencias. Sus defaults contradicen el documento actual y solo corresponden a antecedentes/oráculos del modelo anterior. |
| `docs/politica_contable_cierre.md` | Política anterior: capitaliza MP/MOD/depreciación en PT y reconoce costo al vender. La versión actual reconoce el costo de producción del ciclo aunque no se venda todo. Debe leerse con la actualización de 27/10; no mezclar ambos reconocimientos ni capitalizar otra vez costos ya gastados. |
| `docs/COSTOS_CICLO_Y_CALCULADORA.md` | Costos fijos/continuidad registrados una vez por categoría/ciclo; los borradores opcionales no afectan caja. Es compatible con proyecciones de ventas sin contabilizar caja. |
| `docs/separacion_2d_3d.md` | Pedidos/puntos/recibos recreativos no generan ni bloquean ventas económicas. La verificación de ventas debe actuar exclusivamente sobre decisiones, inventarios y recibos 2D. |
| `docs/decisiones-no-negativas.md` y `AGENTS.md` | Conservar decisiones y opciones de Ventas y Finanzas. Precios por segmento y asignación de personal por máquina se resuelven internamente. No agregar campos para reparar la lógica. |

## Contraste numérico independiente

Al corregir el original según su documento: capacidades diarias 14 / 31.4 / 24, eficiencia 0.92, capacidad mensual 386, fabricación 150 / 140 / 78 (368 total). Se consumen 155.6 m² de cuero, 368 accesorios y 2894 metros de hilo. El consumo por opciones es 60 sintético, 95.6 estándar, 0 premium; 200 accesorios económicos, 168 premium; 0 hilo estándar, 1500 reforzado y 1394 premium.

Con descuento de 8%: MP comprada S/24987.20, consumida S/21962.24, inventario final S/3024.96. Reputación corregida 2.7760170074/10. Con demanda suficiente y precios del ejemplo 40 / 120 / 250: se venden 368 unidades e ingresan S/42300. El ejemplo puede tener pérdida: ventas positivas no significan utilidad positiva. Los importes S/22613.60 de consumo y S/2373.60 de inventario del Excel corresponden al consumo de la meta deseada y no deben reutilizarse junto a la fabricación limitada.

## Pruebas y límites de esta revisión

Se ejecutaron 29 pruebas de `md_logic`, `decision_catalog_stability`, `mercado_excel` y `revenue_excel_current`: todas aprobadas. Cubren producción corregida, materiales, reputación, ingresos por 368 unidades, inventario inicial, competencia, restos mayores, contabilidad y conservación de decisiones. Que las pruebas del motor puro aprueben no verifica que una partida remota reciba su plan, tenga todas las migraciones o muestre el recibo correcto.

La revisión identifica una confusión real de fuentes, pero no atribuye por sí sola las ventas cero de una partida a esa confusión. El diagnóstico del flujo debe comprobar por ciclo el plan confirmado, las tres etapas productivas, los materiales en unidades productivas, el canal de ventas, el cierre persistido y el resultado que lee el profesor. Un escenario sin recursos físicos puede dar cero legítimamente; no debe recibir stock ni ventas ficticias para ocultar la avería.

Evidencia de lectura local: `tests/output/auditoria_excel_documentos_2d.json`, `tests/output/auditoria_excel_origen_comparacion.json` y `tests/output/auditoria_excel_original_hojas.json`. No se editó `index`, código del mundo 3D ni fuentes Excel.
