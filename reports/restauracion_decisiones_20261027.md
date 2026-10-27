# Restauración de Decisiones y corrección de envíos

Se aplica la indicación del usuario: el documento de costos define el motor; no autoriza cambios de decisiones ni nuevos campos de interfaz.

## Cambios

- El catálogo completo de `js/decision_catalog.js` vuelve al estado anterior a la actualización del motor, commit `86a746e`. Ventas y Finanzas conservan exactamente decisiones, opciones, nombres, tarifas y orden.
- Se retira el bloque de precios por segmento de Producción, las tablas de trabajadores por máquina y la leyenda repetida de indemnización.
- Se elimina el selector añadido de régimen y se restaura la compra original de un molde por selección y el mantenimiento preventivo opcional.
- La asignación de personal y los precios se resuelven internamente. Los borradores anteriores se normalizan para no exigir completar campos que ya no existen. No se reescriben cierres históricos.
- El botón de envío usa un único cálculo de disponibilidad, presupuesto y requisitos. El HUD ya no sobrescribe ese estado. Las validaciones conservan su mensaje específico.
- Al completar los cinco envíos individuales se marca también la confirmación global y el snapshot del ciclo. El envío individual repetido no vuelve a cobrar ni altera un apartado confirmado.
- El mantenimiento automático del motor reconoce pagos automáticos de la versión previa y distingue la intervención preventiva opcional, para evitar cobros duplicados.
- Se añade en `AGENTS.md` la regla permanente de conservar las decisiones al trabajar en el motor. Se actualizan las versiones de caché de los archivos web afectados.

## Evidencia

Antes de corregir, se reprodujo un botón habilitado que no enviaba Producción: un borrador con asignación anterior incompatible terminaba mostrando «Completa las decisiones obligatorias de esta pestaña». Después se confirmó el mismo apartado sin exigir esa tabla.

- **98 pruebas automatizadas aprobadas, 0 fallidas**, incluidas comparación del catálogo anterior, cálculo del documento, cierre, contabilidad y presentación.
- **24 comprobaciones del motor, 0 diferencias**. La comprobación de publicidad valida su factor interno, no exige un control monetario nuevo.
- **Prueba de navegador aprobada** con clics reales: ausencia de los bloques retirados; borradores antiguos con asignaciones y precios inválidos; molde anterior múltiple normalizado; envíos individuales de Producción, Ventas, Infraestructura, Finanzas y Logística; presupuesto; bloqueo después del envío; «Enviar todo»; snapshot completo; y cierre con el motor de 30 días.
- **Restauración SQL aprobada en PostgreSQL en memoria**, dos veces por escenario, con y sin la migración previa. Se conservan los identificadores y las decisiones históricas y se restauran las tres opciones de marketing.

Resultados locales regenerables en `tests/output/decisions_restored_20261027/` y `tests/output/auditoria_md_20261027/restauracion_pruebas_final.txt`. No se modificó Supabase remoto. Si se instaló la migración de catálogo anterior, puede aplicarse `supabase/migrations/20261027_restaurar_decisiones_interfaz.sql` para devolver también esos metadatos a la versión previa.
