# Auditoría de diez fallos históricos de producción

Base: `1cd6c3ba4cbacda7fcde30c74b29205ce559039f`, más la corrección de diagnóstico incluida en el commit de este documento. `node --test tests/legacy_production_targets.test.cjs tests/md_logic.test.cjs tests/production_dop.test.js`: 26 pruebas, 16 aprobadas y 10 fallidas. Se conservaron las expectativas originales; una divergencia frente a un documento antiguo no autoriza cambiar decisiones o fórmulas.

| Prueba y ubicación | Esperado → observado | Clasificación y causa | Acción |
|---|---|---|---|
| `legacy_production_targets.test.cjs:8` | ingreso premium 22.500 → 31.500 | Diferencia de reglas: la venta efectiva puede aplicar factor premium 1,4 sobre precio base 250 (`js/engine/cierre.js`, config de consecuencias); no se demuestra que el test cubra ese factor. | Pendiente de contrato comercial; no se modifica precio. |
| `md_logic.test.cjs:14` | corte 14/día, línea 386 → 8/día, 221 | Diferencia justificada para contrato actual: el ejemplo suma dos cortadores en una mesa; SIDE empareja como máximo uno por mesa. `reports/auditoria_logica_md_2026-10-27.md` describe expresamente la divergencia. | Conservada regla actual; oráculo independiente confirma 8×30×0,92→221. |
| `md_logic.test.cjs:18` | factor producción 2,119565 → 0 | No resuelto por falta de evidencia suficiente: la capacidad distinta cambia el mix efectivo y la reputación posterior; no puede aislarse como error de reputación con este fixture. | Pendiente prueba controlada de reputación con entradas equivalentes. |
| `md_logic.test.cjs:26` | 368 → 221 unidades | Diferencia de reglas: deriva del cuello de corte anterior y detiene la comprobación antes de precios e inventarios. | Mantener restricción actual; comprobar otros componentes con escenarios equivalentes. |
| `md_logic.test.cjs:33` | mantenimiento 10,4167 → 1.000 | Expectativa desactualizada respecto al código actual: `BUS.maintenance` usa costo correctivo fijo al existir máquinas, no costo anual proporcional del ejemplo; existen decisiones históricas contradictorias, por lo que la corrección normativa requiere confirmación independiente. | No alterar reglas de mantenimiento. |
| `md_logic.test.cjs:40` | mantenimiento de sección 0 → 1.000 | Expectativa desactualizada frente a catálogo/mantenimiento vigente; la prueba no valida su objetivo posterior de ausencia de doble cobro. | Pendiente prueba específica de doble cobro acorde al contrato vigente. |
| `md_logic.test.cjs:47` | estimación de moldes 20,8333 → 0 | Diferencia de reglas: mantenimiento vigente excluye moldes y depende de existencia de maquinaria; el resto de la prueba no llega a comprobarse. | Mantener comportamiento; validar propiedad de moldes por prueba independiente. |
| `production_dop.test.js:39` | `<strong>0%</strong>` → porcentaje ausente | Prueba desactualizada frente al cambio de DOP: `render(plan,{round})` no acepta ni presenta `producedPercent`, usa proyección. | No cambiar DOP solo para recuperar una expectativa visual. |
| `production_dop.test.js:48` | `<strong>37%</strong>` → porcentaje ausente | Prueba desactualizada por mismo cambio; el escape de la etiqueta sí ocurre antes de la aserción fallida. | No alterar pruebas ni presentación sin requisito. |
| `production_dop.test.js:68` | `4 unidades totales` → `10 unidades totales` | Diferencia de representación: para un plan sin modo temporal `output=plan.target`, no la cantidad limitada de la instantánea. Riesgo de interpretación, pues se rotula como proyección; no se ha confirmado si se exige otro comportamiento para ese adaptador. | Pendiente definir el contrato del adaptador; no se declara defecto corregido. |

## Defecto adicional demostrado y corregido

`js/production_model.js` comparaba `supportedUnits` calculado con receta media contra el total secuencial `materialCapacity`. Metas básico 10 + premium 10, cuero 5 m², 100 accesorios y 1.000 m de hilo producen correctamente 10 + 2, pero antes reportaban `limitingMaterials=[]` pese a que el cuero impide completar la meta. La prueba nueva falla tanto en la base `1cd6c3b` como en `origin/main` `2cb077c` y pasa tras corregir el cálculo diagnóstico. Se determina el límite por material y por molde, respetando la prioridad y los empates; no cambia producción, inventarios, decisiones ni costos. `supabase/functions/side-business-close/runtime.mjs` se regeneró con `node tools/build_business_edge.cjs`.

La corrección es adicional a los diez fallos: ninguno de ellos se declara resuelto. Ver `tests/oraculo_capacidad_independiente.test.cjs` y `tests/output/auditoria_10_actual.log` (este último ignorado por Git).

## Ejecución posterior a la corrección

La selección focal que incluye oráculo, producción, recepciones, paridad Node/Edge, eventos, presentaciones y los tres archivos históricos terminó con **74 pruebas: 64 aprobadas, 10 fallidas, 0 canceladas** (`tests/output/regresion_produccion_final.log`). Las 10 son las enumeradas arriba; no se cambió su expectativa. Las 7 pruebas de Excel se repitieron después de la corrección y siguieron fallando (`tests/output/auditoria_excel_final_20261031.log`).
