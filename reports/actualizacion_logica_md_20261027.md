# Validación de la actualización de lógica

Versión `md-20261027`, implementada el 27/10/2026 en SIDE1. Alcance y reglas: [guía de la actualización](../docs/actualizacion_logica_documento_20261027.md). La [auditoría previa](auditoria_logica_md_2026-10-27.md) conserva el diagnóstico anterior a estos cambios.

## Resultado

- **97 pruebas automatizadas aprobadas, 0 fallidas**: producción, cálculo del documento, costos, cierre, contabilidad, continuidad de ciclos, DOP y presentación financiera. Incluyen 13 pruebas específicas de la nueva especificación.
- **24 comprobaciones de conformidad, 0 diferencias** en el diagnóstico de ejemplos basado en el Markdown. Se ejecutan las mismas categorías revisadas anteriormente, adaptando su lectura a los nuevos controles monetarios y a los mercados derivados; no es un porcentaje de cobertura total.
- **Prueba de navegador aprobada** sobre las páginas entregadas, con Chrome y Playwright, sin conectarse a cuentas reales: selector No MYPE, compra de varios moldes, importes laborales y activos, matriz editable, validación de filas, guardado, publicidad S/3000, tope S/10000, sincronización de su importe, móvil sin desbordamiento, confirmación y cierre de 100 unidades por S/4000.
- **Migración SQL aprobada en PostgreSQL en memoria**, aplicada dos veces: régimen y opciones sin duplicados, publicidad numérica, moldes múltiples, mantenimiento automático y conservación de opciones antiguas. No hubo escritura en Supabase remoto.
- Verificación de sintaxis de JavaScript modificado y `git diff --check` sin errores.

El caso numérico principal obtiene capacidad 386, producción 150/140/78, MP consumida S/21962.24, saldo MP S/3024.96 y reputación 2.776017/10. Con demanda suficiente y precios 40/120/250, ingreso S/42300. Se verificó además venta del inventario anterior sin fabricación nueva, saldos físicos menores de 0.01 y ausencia de doble cobro de mantenimiento.

## Evidencias regenerables

- `tests/output/auditoria_md_20261027/verificacion_final.txt`.
- `tests/output/auditoria_md_20261027/conformidad_final.json`.
- `tests/output/md_logic_ui/result.json` y capturas de producción, publicidad y asignación de personal en escritorio/móvil.
- Scripts: `tests/md_logic.test.cjs`, `tests/md_logic_ui.py`, `tests/md_logic_catalog_db.cjs` y `tests/audit_logica_md_20261027.cjs`.

Los resultados temporales permanecen dentro de SIDE1 e ignorados por Git. Los documentos originales de Downloads no se modificaron. El Markdown se conservó también dentro de `docs/` con contenido idéntico. El directorio contenedor sigue teniendo únicamente SIDE1 como carpeta de trabajo del proyecto.

## Publicación

El código y la migración están preparados localmente. Para publicar esta versión debe aplicarse `supabase/migrations/20261027_logica_documento_costos.sql` sobre la base configurada y distribuir los archivos web actualizados. Esta tarea no realizó un despliegue, commit ni push. Las cifras históricas cerradas conservan su versión original.
