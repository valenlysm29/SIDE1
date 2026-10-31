# Comparación de Excel y SIDE

Se localizó `SIDE_prueba_cantidad_produccion_corregido.xlsx` en `C:\Users\Asus\OneDrive\Documentos\side_side_va\SIDE1\output\`, fuera de la copia de trabajo actual. Se leyó y copió, sin sobrescribir, a `output/` dentro de esta copia. SHA-256 en origen y copia: `FDCE4C8843EFCA1B9A9E03C45EFF1D4F989C248BE7384682A59F147A57813CB9`; ZIP íntegro, 10 hojas y 589 fórmulas. Es una copia **corregida** cuyo nombre y estructura coinciden con la referencia que esperan las pruebas; su autoría y cadena completa de procedencia no se pudieron demostrar. No se afirma que sea el Excel original. El original documentado por el proyecto es otro archivo con SHA-256 `45d2897365a442d2730c09935f53c0b1173f697a0dcb9708c0b9846cde3d32c2` (`reports/auditoria_excel_documentos_2d_20261027.md`).

Se ejecutaron las siete pruebas con Microsoft Excel COM 16.0, sobre copias de trabajo, mediante `node --test tests/equivalencia_fuente_side.cjs tests/reputacion_excel_real.test.cjs`: **0 aprobadas, 7 fallidas**. El registro local es `tests/output/auditoria_excel_20261031.log` y los valores recalculados están en `tests/output/excel_equivalencia_actual/`; ambos se ignoran en Git. El archivo de referencia de `output/` también se ignora; para repetir es preciso obtener esa copia o una fuente autenticada equivalente.

| Prueba | Resultado | Primera diferencia |
|---|---|---|
| base | FALLIDO | N5 Excel 386 vs SIDE 221 |
| meta cero | FALLIDO | N5 386 vs 221 |
| material insuficiente | FALLIDO | N5 386 vs 221 |
| premium | FALLIDO | N5 386 vs 221 |
| capacidad limitada | FALLIDO | N5 386 vs 221 |
| inventario tres ciclos | FALLIDO en ciclo 1 | N5 386 vs 221; no se comprobó la continuidad restante |
| reputación | FALLIDO | factor de producción Excel 2,119565217391304 vs SIDE 0 |

En la hoja `Costos De Producción`, `I8=SUM(I5:I7)` suma 6+8=14 para dos cortadores aunque hay una mesa; `K5=MIN(I8,I14,I20)=14`, `L5=K5*30=420`, `M5=0,92` y `N5=ROUND(L5*M5,0)=386`. SIDE limita un trabajador por mesa y el mejor par produce 8/día; `round(8×30×0,92)=221`. Ambas cuentas son reproducibles, pero no son reglas equivalentes. El libro usa prioridad por molde en `E46:E48` mediante `ROUNDDOWN(MIN(...),0)`; recetas básicas, mejoradas y premium son 0,3/0,4/0,7 m², un accesorio y 6/7/13 m de hilo. El contraste de reputación queda afectado por el cambio de mezcla producida y requiere un caso con producción equivalente para aislar su causa.

Las pruebas de Excel se detienen en la primera diferencia; no acreditan equivalencia ni divergencia de las demás celdas. La regla de un trabajador por mesa está documentada en `reports/auditoria_logica_md_2026-10-27.md` y las instrucciones del proyecto mantienen la asignación interna; no se sustituyó por la regla del libro.

La repetición posterior al ajuste de diagnóstico confirmó **7 fallidas de 7**, sin cambios en el primer punto de divergencia. El ajuste no modifica capacidad ni producción. Los datos de esta prueba no demuestran procedencia del archivo más allá de su copia local y hash.
