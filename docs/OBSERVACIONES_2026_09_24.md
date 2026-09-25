# Correcciones de la partida — 24/09/2026

## Cambios

- **Invitaciones:** botones «Copiar código» y «Copiar enlace». Se habilitan después de guardar/crear la partida. El enlace abre el formulario del alumno con el código precargado y lo valida contra Supabase.
- **Código:** nuevas partidas con tres dígitos, desde `SIDE-000` hasta `SIDE-999`. La base de datos asigna un código libre bajo bloqueo y mantiene la unicidad. Los códigos históricos se conservan. Si se ocupan los 1000 códigos, se informa el agotamiento sin reutilizar historias. `SIDE-000` ya no fuerza accidentalmente el modo demo cuando Supabase está configurado.
- **Espera:** botón de decisiones deshabilitado también desde el HTML, con apariencia de acción bloqueada. Las rutas de entrada verifican el estado. Al terminar la integración se consulta el servidor y se abre el menú automáticamente.
- **Eventos:** cada evento tiene «Desde ciclo» y «Repetir». Desmarcar «Repetir» permite una sola ocurrencia grupal por partida, o individual por empresa. La probabilidad, el desplazamiento y la duración del efecto se conservan. El servidor guarda los sorteos individuales, incluso los vacíos, para que una recarga o cambio de configuración no vuelva a sortear ciclos anteriores. Los cambios rigen para sorteos futuros. Las partidas existentes conservan la repetición por defecto.
- **Cancelación:** botón docente con confirmación; el servidor conserva los resultados y registra fecha/estado terminal. El alumno recibe un aviso persistente, reloj detenido y «Volver al inicio». Se bloquean ingresos y decisiones, se detiene el mundo 3D y la cancelación sobrevive a recargas. Una cancelación fallida no se anuncia como exitosa.
- **Tarjeta de empresa:** el campo de nota y su botón se acomodan al ancho disponible, evitando el recorte de «Sin calificar».

## Conexión

La pantalla anterior mezclaba actividad guardada en `localStorage` con reportes remotos. Al fusionar los datos se perdía `conectada` y se fabricaba una fecha de actualización del reporte, aunque ese dato no probaba actividad del alumno. Además, `app.js`/`docente.js` creaban otro cliente Supabase aparte del cliente de los servicios.

Ahora todos usan el mismo cliente. Las consultas del alumno confirman `participantes.last_seen_at` como máximo una vez cada 15 segundos; el docente considera reciente una señal de menos de 90 segundos. «Sin actividad reciente» no significa necesariamente pérdida de red: también puede ser una pestaña suspendida. Sin información de presencia se muestra «Presencia sin confirmar». Un fallo de consulta conserva los últimos datos y muestra «Sincronización pendiente» mientras se reintenta.

La comprobación remota de solo lectura obtuvo HTTP 200 del servicio Auth y de `controlar_partida` con ID nulo (rechazo esperado por permisos). Esto confirma respuesta en ese momento, no descarta caídas intermitentes. No se consultaron datos de alumnos ni se modificó esa base.

Referencia técnica: [Supabase: presencia](https://supabase.com/docs/guides/realtime/presence) y [latidos de Realtime](https://supabase.com/docs/guides/troubleshooting/realtime-heartbeat-messages). La solución usa la señal de las consultas existentes, por lo que no depende de un canal WebSocket de presencia.

## Aplicación en Supabase

**Pendiente en el servidor remoto:** ejecutar el archivo completo `docs/supabase_game_lifecycle.sql` actualizado en el SQL Editor del proyecto configurado. Está preparado para la instalación que ya tiene `docs/supabase_migration.sql`. Es transaccional y repetible; no borra partidas, empresas ni decisiones. Agrega la señal de presencia, el historial de sorteos, la asignación de códigos y las funciones de cancelación/eventos. La creación verifica `side_game_features` para evitar generar partidas con un backend anterior.

Después, servir los archivos actualizados y recargar las páginas de docentes y alumnos. Los recursos modificados tienen una versión nueva para evitar caché antigua. No se ejecutó la migración ni se publicó la aplicación en un servidor remoto desde esta tarea.

## Verificación

- 27 pruebas unitarias: reglas, cancelación, cliente único, referencias HTML y estilos adaptables.
- `node tests/game_lifecycle_db.cjs`: flujo existente, roles, límites del contador, ingreso y decisiones.
- `node tests/game_observations_db.cjs`: códigos únicos y agotamiento, actividad remota, cancelación y permisos, eventos con/sin repetición, persistencia del historial y validación.
- `node tests/game_lifecycle_ui.cjs`: Chromium con PostgreSQL PGlite y dos alumnos, copiar invitación, controles de eventos, cancelación fallida/reintento, feedback, contador, docente cerrado, reingreso, recarga real y reloj desfasado.

Las pruebas de navegador usan servicios conectados a la base local de pruebas; no acreditan funcionamiento con cuentas reales del proyecto Supabase. Capturas en `tests/output/observations-student-cancelled.png` y `tests/output/observations-company-mobile.png`.
