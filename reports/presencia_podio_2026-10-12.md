# Presencia estable y publicación programada — 12 de octubre de 2026

## Causa raíz y arreglo

Tres causas reproducidas: `loadReports` publicaba provisionalmente los datos de
localStorage mientras esperaba Supabase (el lobby filtraba esos registros y las
empresas desaparecían); el lobby reconstruía su HTML cada segundo; el tracker
permitía que respuestas antiguas degradaran un heartbeat reciente y contaba
callbacks duplicados como confirmaciones de inactividad. También había claves
por reporte/nombre y una segunda caché de estados de presencia.

Ahora se conserva el roster visible hasta confirmar el siguiente snapshot, se
descartan respuestas de otra sala/generación y se reconcilia el máximo
`last_seen_at` por partida/empresa. Un solo tracker sirve a Realtime, polling,
Sala de espera y Empresas. Los nodos se conservan por `empresa_id`. Conexión
inmediata ante heartbeat fresco; inactividad tras 120 s de edad y 15 s sostenidos.
El heartbeat estudiante existente es cada 3 s; no requiere SQL de presencia.
Volver de segundo plano solicita un refresco inmediato. Una pestaña congelada
indefinidamente puede dejar de enviar heartbeat y debe aparecer inactiva.

## Podio

Antes solo existía una publicación en localStorage. Se agregó modal Ahora /
Programar, horas/minutos (1 minuto–72 horas), hora local con zona, confirmación,
contador, publicar ahora, cancelar y reprogramar, usando los tokens existentes
de `css/design-system.css`. Se conservan las notas pendientes, justificación
docente y sugerencia SIDE separada. La justificación en edición sobrevive al
polling.

`podios_publicados` conserva fecha efectiva y snapshot de notas/justificación al
confirmar. La RPC calcula y ordena el podio desde las notas en Supabase, con
desempate por nombre. Lectura estudiante exige identidad exacta y `now()` dentro
del intervalo [publicar_en, publicar_en + 24 h). La publicación automática es
declarativa, sin cron ni navegador docente. Solo el dueño puede operar las RPC;
RLS y permisos impiden lectura ajena y escrituras REST directas. Se agregó vista
estudiantil; los errores de consulta ocultan el podio sin perder progreso.

## SQL que debe ejecutar el usuario

**Falta aplicar SQL en Supabase; este trabajo no modificó producción.**

En una instalación que ya tiene las migraciones actuales, ejecutar completo
`supabase/migrations/2026-10-12_podio_programado.sql`. Es idempotente.

Prerrequisitos, en orden si faltan: `supabase_migration.sql` (solo base nueva) →
`supabase_game_lifecycle.sql` → `supabase_student_admission.sql` →
`20261009_sala_espera_identidad_exacta.sql` → parches existentes de salas del
11/12 de octubre → `20260929_guardar_puntaje_docente.sql` →
`2026-10-12_podio_programado.sql`, todos bajo `supabase/migrations/`.
No reinstalar lifecycle sobre los parches de una instalación actual.
Recargar los navegadores tras aplicar SQL; se versionaron los assets cambiados.

## Verificación y límites

- Regresión presencia: 3/4 fallaban antes del arreglo; 5/5 pasan después.
- Chromium presencia: dos empresas, jitter, respuestas atrasadas, interrupción
  de 70 s, desconexión sostenida, reconexión, carga financiera bloqueada,
  conservación de nodos, Sala/Empresas y móvil 390 px: PASS.
- 15 runners DB existentes y servidor Python 2/2: PASS.
- SQL podio repetido: ahora, programar, cancelar, reprogramar, límites,
  visibilidad anterior/posterior, vencimiento exacto a 24 h, propietario y RLS:
  PASS. PGlite carece de ICU; solo en los fixtures se sustituye la colación
  española `es-x-icu` por C. La colación española de producción no se verificó.
- Navegador podio: Ahora, Programar 1 minuto real con página docente cerrada,
  reprogramar 2 minutos, cancelar, publicar ahora, zona Lima, móvil y validación:
  PASS. El vencimiento a 24 h se prueba desplazando fechas SQL, sin esperar un día.
- Notas docentes/recarga/snapshot congelado y publicación bloqueada ante notas
  pendientes: PASS. Servicio estudiante 4/4; Chromium estudiante confirma
  ocultación/expiración/recuperación, texto seguro y DOM estable: PASS.
- Suite general inicial: 423/424, fallo previo `decision_roster.test.mjs:21`
  (17 actores frente a 16). Se mantiene sin alterar esa prueba ni el manifiesto.
- Suite general final: **432/433**, mismo único fallo previo; sin regresiones
  nuevas. Sintaxis JavaScript y `git diff --check`: PASS.
- Historial docente (escritorio/móvil) y PDF (descarga, vista previa, nombres
  largos, 48 eventos, nota cero, empresas excluidas, roster vacío): PASS.

Los logs y capturas están en `tests/output/`, con prefijos `presencia_podio_`,
`presence_`, `podio_programado_`, `student_podium_` y `teacher_grades_updated_`.
Pendiente: aplicar SQL y E2E con cuentas reales en Supabase; latencia/Realtime
real, suspensión prolongada de pestañas y colación ICU remota. No se ejecutó la
colección completa de benchmarks/diagnósticos 3D; se ejecutó la suite general y
los recorridos del panel relevantes. La vista estudiantil se verificó como
componente aislado en Chromium; no sustituye el E2E remoto del juego completo.
Inicialmente se retuvieron commits y push por el fallo previo de la suite.
Después de revisar los resultados, el usuario autorizó explícitamente el push
a main; se entregan los cambios con ese único fallo previo documentado.

Todo el trabajo y temporales permanecen dentro de SIDE1. Contenedor antes y
después: solo SIDE1. Remoto verificado: `https://github.com/valenlysm29/SIDE1.git`.
