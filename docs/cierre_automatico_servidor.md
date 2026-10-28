# Cierre económico automático

El navegador del docente consulta resultados. `services/business_worker.cjs` ejecuta el motor económico en un servidor Node.js (22 o posterior), sin navegador ni mundo 3D. Consulta el reloj de PostgreSQL cada diez segundos, cierra los ciclos pendientes en orden y persiste resultados mediante las RPC existentes con bloqueo, revisión del estado e idempotencia.

## Activación obligatoria

El push de Git no instala el ejecutor ni aplica SQL. Desplegar conjuntamente:

1. Conservar las migraciones existentes hasta el 27/10/2026, incluidas `20261026_cierre_sin_expulsion_automatica.sql`, `20261027_corregir_ventas_generales.sql`, `20261027_preservar_ciclo_snapshot.sql` y `20261027_proteger_reportes_cerrados.sql`.
2. Aplicar `supabase/migrations/20261028_cierre_servidor.sql`. Su ejecución es repetible. Tras aplicarla, únicamente el rol de servidor puede ejecutar las RPC de cálculo/persistencia; el docente consulta `side_consultar_cierre_negocio`.
3. Instalar el checkout de SIDE1 en un servidor que permanezca encendido. Configurar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` como secretos del proceso. Nunca introducir la clave de servidor en `js/config.js`, HTML, Git o el navegador.
4. Desde SIDE1 ejecutar `node services/business_worker.cjs --once` para revisar la primera ejecución y luego `node services/business_worker.cjs` bajo un supervisor con reinicio automático. No requiere paquetes npm adicionales. Los logs incluyen partida, ciclo, éxito y error, nunca las credenciales.
5. Publicar los archivos de interfaz del mismo commit. Verificar una sala de prueba de dos ciclos con el panel docente cerrado y comprobar que se guardan ambos registros en `side_business_closures` y `reportes_ciclo`.

Si se pierde la red o hay conflicto de revisión, el ejecutor reintenta en la siguiente pasada. Si falta un primer plan confirmado o hay un plan inválido, conserva el cierre pendiente y registra la causa: no inventa ventas, no expulsa empresas ni congela un mercado incompleto. Los ciclos posteriores de esa sala esperan al anterior; otras salas continúan.

Los cierres históricos ya guardados no se recalculan. Para probar las reglas nuevas usar una sala nueva. La recuperación automática atiende cierres pendientes, no reescribe resultados definitivos anteriores.

## Impuesto y visualización

Se conserva la tasa del simulador de 29.5%. Con una duración configurada, se reconoce en el último ciclo cerrado sobre la utilidad acumulada positiva antes de impuestos, descontando el impuesto previamente reconocido si existe historia importada. Se registra como gasto e impuesto por pagar; no se inventa un pago de caja. Las pérdidas acumuladas pueden dar impuesto cero.

El historial muestra unidades producidas, vendidas e ingresos por ciclo. Un resultado ausente aparece como pendiente. Los costos confirmados siguen siendo movimientos reales, aunque aún falte el cierre. La interfaz conserva estimaciones identificadas como tales; no son ingresos definitivos.

## Verificación local

`node tests/business_worker_db.cjs` comprueba PostgreSQL, reloj automático, dos ciclos sin token docente, ventas, impuesto final, recuperación, balances y permisos. `python tests/business_worker_ui.py` renderiza el snapshot producido por esa prueba en Chromium (requiere Playwright). Evidencias en `tests/output/`.
