# Contraste con HEAD de las fallas de la suite 2D

Se ejecutaron los siete archivos que contenían las 24 fallas de la suite amplia:
`cancelar_partida`, `decisions_corrections`, `excel_progreso`,
`financial_presentation`, `independent_cycle_costs_20261022`,
`resumen_analista_excel` y `world_auto_entry`.

El contraste no reemplazó archivos compartidos ni creó otro worktree. Un preload
local en `.codex-work/ventas_head_baseline.cjs` devuelve las fuentes de `git show
HEAD:<ruta>` al leer los archivos de producto modificados. Las pruebas permanecen
iguales entre ambas ejecuciones. Las capturas y scripts permanecen dentro de SIDE1.

## Resultado inicial

- HEAD: 30 pruebas; 6 aprobadas y las mismas 24 fallas identificadas por la suite amplia.
- Workspace durante la ampliación de compatibilidad de activos: las mismas 24,
  más una falla adicional en el caso de aviso de costo cero.
- La causa de esa falla adicional era la dependencia `SIDE_BUSINESS_RULES` ausente
  en el entorno VM de `independent_cycle_costs_20261022.test.cjs`. Otros siete casos
  de ese archivo ya fallaban en HEAD por la misma dependencia, al llamar `laborCost`.

Solo se actualizó la carga del harness para incluir `js/business_rules.js` antes
de producción y revisión, igual que las páginas reales. No se cambiaron
expectativas, importes ni código del producto para acomodar las pruebas.

## Contraste después de corregir la dependencia del harness

- El archivo de costos contiene **8 pruebas** y ahora pasan las 8.
- HEAD con el mismo harness: **13 aprobadas y 17 fallas** entre los siete archivos.
- Workspace con el mismo harness: **13 aprobadas y las mismas 17 fallas**.
- Los nombres de las 17 pruebas fallidas coinciden exactamente. No aparece una
  nueva prueba fallida en esta comparación.

Las fallas restantes incluyen otras dependencias ausentes en fixtures parciales
(`SIDE_BUSINESS_RULES`, `updateSectionSendButton`, `teacherSalesDetail` y recibo de
proyección) y aserciones antiguas sobre cancelación/entrada al mundo. No se
modificaron esos ámbitos. Este contraste no equivale a afirmar que la suite
completa está verde ni valida un despliegue en Supabase remoto.

Evidencia local:

- `tests/output/ventas-baseline-head-20261027.tap`.
- `tests/output/ventas-baseline-workspace-20261027.tap`.
- `tests/output/ventas-baseline-comparison-20261027.json`.
- `tests/output/ventas-baseline-head-harness-20261027.tap`.
- `tests/output/ventas-baseline-workspace-harness-20261027.tap`.
- `tests/output/ventas-baseline-comparison-harness-20261027.json`.
