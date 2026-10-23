# Auditoría ejecutada de costos, inventario y caja — 23 de octubre de 2026

## Resultado

Se corrigió un defecto reproducible de precisión de inventario en dos módulos del motor. Con inventario inicial 0.1, compra 0.7 y consumo 0.8, SIDE rechazaba una operación válida como sobreconsumo. Con 0.1+0.2−0.3 dejaba existencias fantasma de aproximadamente 5.55e-17. La suma disponible ahora se normaliza **antes** de comparar y restar, siguiendo las quince cifras significativas que ya utiliza producción; no se añadió un redondeo comercial ni una tolerancia que permita sobreconsumo real.

Se agregó una extracción independiente y reproducible de **294 celdas originales** y una batería de **10 pruebas nuevas**. Incluye los siete componentes de los 22 perfiles de nómina, los componentes de los 20 perfiles de activos, los ocho materiales y sus conversiones/precios, nómina completa por tipo de máquina, stock decimal, caja cero, deuda previa a tasa cero y compras de activos durante cuatro ciclos. Se mantienen los 29 casos previos relevantes.

## Fuente y método

Fuente intacta: `.codex-work/DECISIONES_SIDE_16.xlsx`, SHA-256 `3b6b42bbbc56a2534ce7e241c607d572dd38dcf02311683609497df36a0c1eb1`. Se consultó `.agents/skills/xlsx/SKILL.md` y se abrió el libro dos veces con openpyxl, para fórmulas y para valores en caché. No se guardó el Excel original.

Extracción ejecutable: `tests/auditoria_costos_original_20261023.py`. Salida versionada: `tests/oracle/auditoria_costos_original_20261023.json`. Cada esperado conserva hoja, celda, fórmula o literal y valor original; no se calcula con JavaScript ni se copia de la salida del motor.

Este extracto contiene la **caché original**, no un recálculo COM. La integración principal administra el recálculo real de Excel y las simulaciones. Los tests financieros sin celda original comprueban identidades o reglas históricas y se identifican expresamente como tales.

## Defecto corregido y evidencia anterior

| Archivo / función | Entradas | Antes | Ahora |
|---|---|---|---|
| `js/engine/costos.js`, `calcularCostos` | inicial0.1 + compra0.7 − consumo0.8 | `RangeError: Consumo superior al inventario disponible` | Stock0, valor inventario0 |
| `js/engine/inventario.js`, `actualizarInventario` | mismas entradas | `RangeError: Inventario negativo` | Stock0 |
| Ambos módulos | inicial0.2 + compra0.7 − consumo0.9 | rechaza saldo correcto | Stock0 |
| Ambos módulos | inicial0.3 + compra0.6 − consumo0.9 | rechaza saldo correcto | Stock0 |
| Ambos módulos | inicial0.1 + compra0.2 − consumo0.3 | saldo fantasma5.55e-17 | Stock0 |
| `costos.js`, `consumirAlmacen` | las mismas disponibilidades y necesidades | disponibilidad binaria podía producir faltante residual | disponibilidad, consumo y saldo consistentes |
| `costos.js`, modo `excel_literal` | valorización del mismo consumo exacto | validación binaria también podía rechazarlo | valoración válida, inventario0 |

Origen del cálculo: Costos `G54:G61=D+E−F`; CANTIDAD `G63:G71=D+E−F`. La política de precisión de quince cifras ya figura en `config_excel.js:PRECISION_INVENTARIO` y se aplicaba antes en `produccion.js`. El error era aplicar la normalización solo al resultado final o no aplicarla en costos, después de haber comparado cantidades con distinto residuo binario. La validación aún rechaza, por ejemplo, consumir0.800000001 de stock0.8.

La reproducción del código previo cargó los módulos de la revisión Git anterior mediante `Module._compile`, sin sobrescribir archivos de trabajo. Los ocho casos fallaban: seis excepciones y dos residuos. Evidencia con revisión y entradas: `tests/output/auditoria-costos-caja-20261023-baseline.json`.

## Contraste amplio con el libro original

| Área | Celdas fuente | Comprobación ejecutada |
|---|---|---|
| Nómina corte/ensamble/acabado N1/N2/N3, MYPE y NO_MYPE | Costos `U5:V29`, `Y5:Z29`, `AC5:AD29` | 18 perfiles×7 componentes: sueldo, Essalud, gratificación, CTS, vacaciones, anual y mensual |
| Jefatura y limpieza, ambos regímenes | Costos `U33:V39`, `Y33:Z39` | 4 perfiles×7 componentes |
| Local | Costos `AC33:AD33` | S/2000 por mes en ambos regímenes |
| Maquinaria, mesa y moldes, ambos regímenes | Costos `U45:V71`, `Y45:Z66`, `AC45:AD66` | 20 perfiles: adquisición, instalación cuando corresponde, capacitación, mantenimiento, depreciación anual y suma anual |
| Materia prima y conversión | Costos `V76:W83`, `D32:K32` | 8 materiales: precio lista, descuento original8%, presentación productiva |
| Compra y precio mostrado | mismas celdas y regla histórica del analista | Una presentación tiene el mismo costo que las unidades convertidas cobradas; analista en ciclos1/2/6/9/30 concilia con el mismo motor |
| Matriz de trabajadores | mismos perfiles de nómina | Agregación independiente por cada celda manual/semi/industrial, tres niveles y ambos regímenes, dos jefes y local/limpieza |
| Caja y activos | tarifas originales de activos + reglas financieras históricas | 20 perfiles, cuatro ciclos: compra1, omitir sin recompra, ampliar a3 pagando2, reducir pedido a1 sin liquidar ni recomprar |
| Caja y deuda | no existe estado de caja mensual original | Capital/base cero se preserva; deuda previa a tasa cero conserva0; préstamo nuevo se pondera y no vuelve a tarificar la deuda anterior |

No se encontraron discrepancias en los 294 valores originales contrastados. Las fórmulas de nómina mantienen deliberadamente Essalud anual literal de un mes y las CTS manuales; no se sustituyeron con normativa externa. La compra del activo usa adquisición+instalación+capacitación; mantenimiento y depreciación se mantienen separados. No se introdujo porcentaje de merma: el libro no lo define.

## Contradicciones y límites que siguen explícitos

- Costos `L5=K5*30` y CANTIDAD `L5=K5*24` son horizontes distintos; también difieren productividades. Se usa CANTIDAD para ejecución de producción y la tabla Costos para dinero. No se mezclaron ambas capacidades.
- Costos `AB77/AB82/AB83` multiplica precios por55/6/7 aunque las conversiones de `E33/J33/K33` dan110/1500/1400. Para compras generales se mantienen precio por unidad productiva `V76:X83` y conversión `D32:K32`; el ejemplo incoherente no sustituye esos datos rotulados.
- Costos `F55=107.5` mientras `AB89=45*107`. La valorización ejemplificada y el consumo del almacén no están enlazados; se sigue consumiendo lo realmente fabricado, sin truncar107.5 a107.
- El descuento8% tiene fórmula original. La combinación multiplicativa con proveedor2%, contado3% y negociación del analista no tiene fórmula combinada original; se conserva la regla histórica, con cobertura de conciliación, sin presentarla como fórmula Excel.
- El Excel no contiene balance/caja mensual, tasa base20%, tarifa almacenajeS/2, tarifa horas extra25%, incremento3pp ni calendario de amortización. Se conservan únicamente las reglas históricas ya declaradas pendientes; esta auditoría no inventa valores para reemplazarlas ni afirma paridad con celdas inexistentes.
- La duración por unidad, mínima dotación óptima e inversa de maquinaria por objetivo no están definidas. La compra mínima y redondeo a máquinas/personas no se inventaron. No se tocó menú, decisiones, avatares ni mundo3D.

## Verificación y entrega

Generador ejecutado con Python de dependencias Codex: 22 perfiles laborales,20 activos,8 materiales,294 celdas. Suite ejecutable: `tests/auditoria_costos_caja_20261023.test.cjs`.

Comando de verificación: `node --test tests/auditoria_costos_caja_20261023.test.cjs tests/costos_excel.test.cjs tests/caja_excel.test.cjs tests/produccion_excel.test.cjs tests/ciclo_excel.test.cjs`. Resultado final: **39/39 pruebas**, cero fallos. Log: `tests/output/auditoria-costos-caja-20261023.log`.

Archivos de producto cambiados: únicamente `js/engine/costos.js` y `js/engine/inventario.js`. La revisión de caja no identificó otro defecto inequívoco; sus casos límite se verificaron sin cambiar `caja.js`. No se modificaron constantes ni reglas financieras. **No requiere actualización de Supabase y no se ejecutó SQL.**
