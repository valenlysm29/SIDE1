# Avance de ciclos SIDE — 4 de noviembre de 2026

Base revisada: origin/main 7fc8486. Se trabajó en una copia aislada dentro de SIDE1 para conservar el árbol original y sus cambios previos.

## Causas reproducidas

1. La disponibilidad exigía confirmaciones explícitas incluso después de un corte manual o vencimiento del reloj con cierre oficial completo. En resultados ya no se permite confirmar: el requisito impedía continuar indefinidamente. La regresión falla en la base anterior en partidas de 3 y 6 ciclos. Se observaron también tres partidas remotas con cierre completo y confirmaciones pendientes; no se avanzaron partidas reales.
2. La recuperación `no-plan` arrastraba cantidades de materiales del borrador sin órdenes verificadas. El trabajador rechazaba la compra y no podía sellar el ciclo. Se reprodujo con Auth, PostgREST, PostgreSQL y Edge reales del entorno local.

## Corrección

- El servidor autoriza el avance desde resultados cuando existe cierre oficial completo para todas las empresas participantes. Mantiene autorización docente, bloqueo de fila, ciclo esperado y prohibición de saltar un cierre incompleto. La unanimidad de confirmaciones sigue iniciando el cierre anticipado como antes.
- La recuperación de un plan ausente conserva producción cero y excluye del plan recuperado las cantidades de compras del ciclo sin orden confirmada. Conserva el borrador original y no fabrica confirmaciones. Solo repara recuperaciones no selladas; los sellos existentes se devuelven intactos. Los reintentos conservan token y revisión una vez normalizado el plan.
- La interfaz da prioridad al cierre oficial, muestra procesamiento en resultados y bloquea los tres controles mientras una operación está en curso. Incluye nueva versión de recurso para evitar la caché anterior.
- No se editaron fórmulas, precios, costos, impuestos, inventarios, decisiones de Ventas/Finanzas ni opciones de interfaz. No se requiere desplegar un motor Edge nuevo.

## Verificación

La aceptación conectada usa Supabase local aislado en el puerto 57421, tres empresas, Chromium, Auth real y el trabajador Edge real. El reloj solo se acelera en partidas QA nuevas. Los envíos de planes se hacen por el servicio real de estudiantes; no se simulan respuestas RPC ni sellos económicos. Los tests de PostgreSQL embebido usan sellos mínimos para aislar las transiciones y no sustituyen la aceptación conectada.

Los archivos completos de capturas y registros permanecen en `tests/output/` dentro de SIDE1. El resultado final de aceptación y publicación se registra en `reports/ciclos-definitivo/`.

## Aceptación completada

- 219 pruebas críticas y 3 pruebas de guías aprobadas.
- Cuatro partidas completas: 3 y 6 ciclos con todas las empresas confirmadas; 3 y 6 con dos empresas confirmadas y una sin confirmar por ciclo. 54 resultados oficiales empresa/ciclo. En la evidencia antigua `confirmedCompanies` cuenta resultados financieros sellados, no confirmaciones del estudiante.
- Cortes reales con la guía abierta, cierre por tiempo en el primer ciclo de seis, recarga docente antes de cada avance del escenario con borrador, finalización e historial tras recarga. Dos pestañas docentes, cinco clics seguidos y otra pestaña intentando el mismo avance; ningún salto de ciclo.
- Igualdad de estados financieros del estudiante con el sello oficial, historial completo del laboratorio idéntico, tabla docente con las tres empresas, propagación del siguiente ciclo a las pestañas abiertas, cero errores JavaScript y cero recursos locales fallidos.
- Concurrencia del trabajador Edge, continuidad de caja, inventario, deuda y equilibrio contable; huellas de cierres previos iguales en cada ciclo.
- Anónimo rechazado con 401, no docente con 403 y propietario incorrecto rechazado en regresión de servidor.
- No quedan fallos críticos en el alcance validado. Las ejecuciones fallidas durante la corrección se resolvieron y las partidas completas se repitieron desde el inicio.

## Verificación remota de la migración

Migración `avance_cierre_oficial` aplicada en el proyecto SIDE. Los 180 cierres históricos mantienen la huella `ae6855d3443d797e269fb99bd6c72988`. La lectura autenticada del propietario de una partida con cierre completo y una confirmación pendiente devuelve `ready:true`; se hizo en transacción de solo lectura, sin avanzar la partida. La preparación de borradores corregida está instalada.
