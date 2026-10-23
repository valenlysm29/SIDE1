# Corrección de consecuencias — 23/10/2026

Fuente: `.codex-work/DECISIONES_SIDE_16.xlsx`, hoja `Matriz_Consecuencias`. Se leyó la skill xlsx local y se verificaron directamente las celdas originales mediante XML ZIP del libro, sin guardarlo ni cambiar sus fórmulas. El Python por defecto no dispone de openpyxl; para este contraste puntual se usa la biblioteca estándar y se comprueba tanto el texto guardado como la ausencia de fórmula en la celda.

`A7=CONS-06`, `C7="Cantidad producida > capacidad instalada"`, `D7="Retraso de entrega, costo extra por horas extra"`. Son textos originales, no fórmulas numéricas. Por ello la corrección inequívoca afecta el disparador; no se introduce una tarifa nueva.

| Archivo y línea | Antes | Después | Criterio |
|---|---|---|---|
| `js/engine/consecuencias.js:24` (ahora 24–28) | `max(0, planeado - capacidad)` | `max(0, producido - capacidad)`, solo con ambos datos numéricos presentes | `Matriz_Consecuencias!C7` dice producida, no planeada |
| `js/engine/ciclo.js:11` | Evaluación previa sin cantidad producida | Se pasa `produccion.totalProducido` | Usa la producción ya limitada por materiales y capacidad |
| `js/engine/ciclo.js:17` | Evaluación final sin cantidad producida | Se pasa `produccion.totalProducido` posterior a factores de consecuencias | El costo debe evaluar la ejecución efectiva |
| `js/engine/ciclo.js:45` | Evaluación parcial de demanda con producido pero sin capacidad | Sin cambio de contrato; nueva guardia evita suponer capacidad cero | La llamada se usa únicamente para CONS-07 |

Ejemplo comprobable: planeado 200, producido 60, capacidad 100. Antes se activaba CONS-06 y, con costo laboral 1000 y configuración histórica del 25 %, se cobraban 250. Ahora no se activa y el costo es cero. Con producido 120 y capacidad 100 sí se activa, aunque planeado sea 10; la tarifa histórica conservada da 50. La igualdad producido=capacidad no activa, porque el Excel exige `>`.

La ejecución de `CANTIDAD DE PRODUCCIÓN!E37:E39` reparte la capacidad con ROUNDDOWN, y `D56:E58` limita producción por capacidad, materiales y cantidad deseada. Los factores posteriores del motor solo reducen producción. En ese flujo CONS-06 resulta inalcanzable: producido no supera capacidad. Esta consecuencia puede evaluarse directamente sobre un estado explícito que sí tenga exceso, pero el motor no debe inventar dicho exceso a partir de la meta del estudiante. Mantener la regla inalcanzable en el flujo topado respeta la fuente mejor que reemplazar producida por planeada para forzar su aparición.

Pruebas nuevas: `tests/auditoria_consecuencias_20261023.test.cjs` (4). Cubren producido menor/igual/mayor a capacidad con metas independientes; ausencia de datos en una evaluación parcial; capacidad explícita cero; y el pipeline topado con meta 1000. Se actualizaron expectativas legítimas de `tests/puntajes_excel.test.cjs`, `tests/dop_confirmation_capacity.test.cjs` y `tests/ciclo_excel.test.cjs`. SIM-2 espera ahora las siete reglas alcanzables y cero horas extra; la octava se prueba directamente con producción superior a capacidad. Resultado dirigido: **23/23**, cero fallos y cero omitidas.

No se modificaron los JSON de resultados esperados del oráculo: su reconstrucción desde fuentes y recálculo Excel queda a cargo de integración. Debe corregirse también la extensión histórica `tests/oracle/run_oracle.py`, cuyo disparador usaba B9 (planeado) en lugar de B11 (producido); no era una fórmula del libro original.

Pendientes de criterio conservados explícitamente: Matriz D7 no define la tasa del 25 % ni el prorrateo del costo de horas extra, presentes en la configuración histórica. Tampoco se cambia CONS-03: su relación entre 70 % de lo planeado y el límite físico del motor requiere una interpretación conjunta; este parche no introduce otra fórmula silenciosa. No se modifican Supabase, decisiones, avatares ni mundo 3D.
