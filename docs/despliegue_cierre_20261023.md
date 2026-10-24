# Despliegue del cierre y aislamiento del mundo 3D

**Guía histórica sustituida por v19.** Para el cliente actual usar [despliegue_cierre_v19.md](despliegue_cierre_v19.md) y el paquete completo `docs/sql/20261023_despliegue_cierre_v19.sql`. No volver a ejecutar el paquete antiguo sobre una instalación v19: reemplazaría funciones nuevas. El texto siguiente se conserva como registro de la sesión anterior.

Ejecutar el SQL exacto de `docs/sql/20261023_despliegue_cierre_completo.sql` en el SQL Editor de Supabase del proyecto SIDE. El archivo concatena, sin cambiar su SQL y en este orden:

1. `supabase/migrations/20261023_retirar_motor_anterior.sql`.
2. `supabase/migrations/20261023_cierre_negocio.sql`.
3. `supabase/migrations/20261023_corregir_contexto_cierre_estado.sql`.

Son idempotentes. La función base de cierre ya incorpora la persistencia de snapshots financieros de `20261023_persistir_snapshots_financieros.sql`; no hace falta ejecutar esa variante antes de este paquete. No se ejecutaron contra Supabase desde este trabajo. No ejecutar posteriormente migraciones históricas que reinstalen `side_excel_snapshot_protegido` o `side_excel_reporte_protegido`. Requieren el esquema existente de SIDE: `empresas`, `participantes` (incluido `expulsada_at`), `side_student_state`, `reportes_ciclo`, `partidas`, y `side_ciclo_actual`. Las bases antiguas deben aplicar primero las migraciones de admisión y ciclo de vida descritas en las guías principales; este archivo no reconstruye una base vacía.

Después de desplegar el cliente y aplicar el SQL, abrir el panel docente y reconectar la sala. Su sincronización reintenta los ciclos pendientes en orden, y el cierre persistido es idempotente. Un cierre existente no se recalcula ni se alteran resultados históricos. El contexto evita persistir un cierre completamente vacío si existen participantes activos, con `SIN_PLANES_CONFIRMADOS`. El cliente lo trata como resultado provisional pendiente: los botones del docente pueden continuar sin exigir que un alumno confirme, y la sincronización puede reintentar después. Los planes mal formados sí devuelven el error `PLANES_PENDIENTES`. Una empresa sin plan no bloquea el cierre de otras que sí confirmaron. Las empresas sin `__cyclePlans[ciclo]` confirmado y sincronizado quedan fuera: confirmar decisiones en el equipo del estudiante y comprobar el estado de sincronización antes de cerrar. La confirmación ahora encola directamente el snapshot antes de renderizar reportes; el outbox conserva y reintenta los envíos fallidos. Al construir un snapshot se recupera también un plan faltante de una confirmación local interrumpida.

El mundo 3D conserva ventas, precios, compras, devoluciones y mejoras únicamente en su almacenamiento `side3d_*`. No publica movimientos en caja ni presta sus ventas/precios al cierre. El motor ignora cantidades vendidas del mundo y retira sus gastos/ingresos heredados de ciclos aún no cerrados. Al cargar, el cliente limpia también esos movimientos antes de mostrar caja y conserva el ledger original en `SIDE_WORLD_LEDGER_BACKUP_*`. Conserva los importes y reglas del modelo de decisiones: demanda asignada, producción, costos, eventos y comisión. Los recibos de ciclos cerrados permanecen congelados.

## Límite del cierre automático

El reparto actual ejecuta las fórmulas JavaScript en el navegador autenticado del docente; PostgreSQL autoriza y persiste el resultado con revisión CAS y bloqueo transaccional. Cerrar ese navegador sigue dejando ingresos pendientes hasta reconectar. Dar permiso de cierre a estudiantes sería inseguro porque el servidor no recalcula/verifica las fórmulas del resultado recibido. Un cierre realmente autónomo requiere trasladar el mismo motor a una Edge Function o worker confiable, programarlo al vencer el ciclo, reutilizar el token/revisiones y persistir mediante una función exclusiva del ejecutor. No se implementó ese rediseño ni se duplicaron fórmulas en SQL. La recuperación existente al reconectar y la cola de confirmación reducen pérdidas de sincronización; no sustituyen un ejecutor de servidor.

## Verificación posterior en la sala real

Comprobar que el panel carga sin `column e.estado does not exist`, pausar/reanudar/cortar/avanzar un ciclo autorizado, y esperar que desaparezca el cierre pendiente tras confirmar su persistencia. La ausencia de noticia grupal puede ser correcta si no hay noticia habilitada/programada; no prueba un error de ventas. La verificación local con PostgreSQL embebido y servicios simulados no acredita el despliegue remoto.
