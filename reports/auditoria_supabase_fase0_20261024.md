# Auditoría Supabase Fase 0 — 24/10/2026

Auditoría de solo lectura de código e historial. No se consultó ni modificó producción. Los informes anteriores documentan pruebas PGlite, no despliegue remoto.

| Causa / estado | Síntoma | Archivo:línea | Arreglo propuesto |
|---|---|---|---|
| Cálculo económico en navegador docente | Sin docente el temporizador avanza pero ingresos quedan pendientes | services/partida_service.js:357-394; js/docente.js:510 | Ejecutor confiable que importe el motor puro; RPC exclusiva de servicio e idempotencia |
| Contexto exige plan remoto | Confirmaciones locales no compiten | supabase/migrations/20261023_cierre_negocio.sql:24-32 | Confirmar snapshot y resolver faltantes antes de cerrar |
| Cierre parcial irreversible | Planes tardíos quedan excluidos incluso tras sincronizarse | mismo SQL:21,24-32,66 | Resolver cada empresa elegible mediante plan confirmado, réplica o eliminación antes de congelar mercado |
| Triggers históricos reinstalables | Sobrescritura de snapshot/reporte | 2026-10-11_logica_excel.sql:84-96; 2026-10-22_revertir_correcciones_conversacion.sql:107-119 | Retirar triggers y evitar reinstalar migraciones antiguas |
| e.estado corregido en fuente local | Toast remoto con función antigua | 20261023_corregir_contexto_cierre_estado.sql:2,18 | Aplicar función que usa participantes.expulsada_at; no existe coincidencia literal rota activa local |
| Polling roster 3s y Realtime simultáneos | Lecturas redundantes y cola continua | js/docente.js:188-203,821-840 | Polling de respaldo según estado del canal y coalescer eventos |
| Canal sin callback de estado/backoff | Error Realtime invisible | js/docente.js:203 | Monitorizar estado, reconectar con backoff e indicador |
| Reportes individuales secuenciales | Pantalla aparentemente estática | js/docente.js:771-777 | Paralelismo limitado, mantener último dato confirmado |
| Reporte fallido reducido a null | RLS/red ocultos tras datos viejos | js/docente.js:774-777 | Mostrar errores por empresa sin sustituir por ceros |
| Outbox reintentada por polling fijo | Tormenta de reintentos con red caída | services/student_sync.js:46-102; js/app.js:398-405 | Backoff en cola y reset al reconectar |
| Configuración sin revisión CAS | Otra sesión docente puede sobrescribir | js/docente.js:155-181 | Versión esperada y conflicto visible |

## Arreglos ya presentes

- Singleton Supabase y timeout HTTP de 15s: services/supabase_client.js:20-47.
- Presencia monotónica con reloj servidor e histéresis 90s/120s+15s: services/teacher_sync.js:5-40; js/docente.js:472-479,843.
- Tarjetas diferenciales: js/docente.js:912-958; no reconstruirlas de nuevo.
- Canal único por partida y limpieza en cambio/pagehide: js/docente.js:191-194,1260.
- Snapshot alumno CAS, reconocimiento de respuesta perdida y copia de conflicto: services/student_sync.js:56-95; js/app.js:425-438.
- Cierre transaccional con bloqueo de filas, token CAS e idempotencia: 20261023_cierre_negocio.sql:45-66. No dispone todavía de advisory lock ni cálculo económico servidor.

## Aplicación remota y mínimo seguro

El paquete docs/sql/20261023_despliegue_cierre_completo.sql concatena retiro de triggers, cierre y corrección de contexto. La documentación afirma que no se aplicó remotamente en sesiones previas; no prueba qué está aplicado actualmente. Hace falta diagnóstico autenticado para acreditar funciones, columnas, RLS y triggers activos.

No habilitar el RPC de resultados arbitrarios para estudiantes: hoy PostgreSQL valida autorización, revisiones y estructura, pero no recalcula el resultado económico. Un cierre autónomo seguro necesita Edge Function/worker que importe el mismo motor puro, resuelva faltantes y persista con RPC reservada al ejecutor. No copiar una fórmula parcial a SQL ni afirmar autonomía mientras dependa de docente.
