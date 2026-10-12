# Ingreso a salas y códigos no reutilizables — 2026-10-12

Base: `ebd46de`, rama `main`. La captura muestra una sala cancelada; no demuestra por sí sola que la sala nueva esté cancelada en producción. No se consultó ni modificó Supabase de producción. Los siguientes defectos se reprodujeron localmente antes de corregirlos.

## Causas y reproducción

1. **Sesión anterior sobre el ingreso nuevo.** En la base, `js/app.js` restauraba la sesión guardada aunque la URL invitara a otra sala, y el estado confirmado solo se asociaba a empresa. Una respuesta demorada de la sala cancelada A podía sustituir el ingreso manual a B. Ahora `js/app.js:88`, `:297`, `:440`, `:460` y `:1577` vinculan configuración, ciclo y runtime a empresa, UUID y código de sala, invalidan respuestas anteriores y respetan el código de la invitación. `tests/student_change_room_ui.cjs` reproduce invitación B con sesión A cancelada, ingreso manual B durante recuperación demorada de A y rechazo de código cancelado/retirado seguido de ingreso válido. `tests/student_room_scope.test.js` cubre también localStorage compartido entre pestañas.
2. **Código liberado al borrar la partida.** `supabase/migrations/supabase_game_codes.sql:7` solo excluía códigos presentes en `partidas`. Crear, borrar y reinsertar el código era posible. La nueva migración de registro conserva cada código aunque se elimine su partida, reserva bajo bloqueo transaccional y PK, y rechaza cambios de código y reapertura de salas finalizadas. `tests/codigos_sala_db.cjs` verifica códigos variables, cancelación/finalización/borrado, reinserción incluso con el mismo UUID, normalización y expansión a cuatro caracteres. No se fija ningún código de ejemplo.
3. **Clave de cancelación confundida con cancelación real.** `20261009_sala_espera_identidad_exacta.sql:22` y `supabase_game_lifecycle.sql:489` comprobaban presencia de `cancelledAt`; `null` podía congelar el inicio o bloquear decisiones. `2026-10-11_estado_codigo_sala.sql:15` define el criterio común, usado por runtime, decisiones y recuperación. `js/side_rules.js:44`, servicios y aplicación aplican el mismo criterio. `tests/estado_codigo_sala_db.cjs` demuestra antes/después con null y otros marcadores falsos. Una fecha real o fase cancelled permanece bloqueada.
4. **Rechazo poco preciso.** Una identidad nueva en una sala terminal podía recibir `PARTIDA_INICIADA` o `CREDENCIALES_INVALIDAS`. `services/empresa_service.js:43` consulta una categoría pública mínima después del rechazo. Distingue cancelada, finalizada, retirada, desconocida y ambigua; si falta la RPC conserva el rechazo original y registra el detalle. No admite alumnos saltándose la RPC atómica de identidad. `tests/student_code_status.test.cjs` comprueba ambos rechazos, ausencia de diagnóstico, datos ajenos y marcadores falsos.

Son defectos de sesión, admisión y persistencia de códigos; no se modificó `js/engine/*`, NPC, modelos, cálculos Excel ni `guardar_puntaje_docente`. Afectan el ingreso en Manual y Automático. El registro histórico no existía antes de la integración Excel: su migración no resuelve estos defectos ni es requisito de las dos nuevas migraciones.

## Entrega Supabase: sí requiere SQL

En una base que ya tenga lifecycle, admisión, sala de espera v3, `2026-10-11_fix_crear_partida.sql` y `2026-10-11_recuperar_salas_compatibles.sql`, ejecutar **el contenido completo de estos archivos, en este orden**, en el editor SQL:

1. [2026-10-11_codigos_sala_no_reutilizables.sql](../supabase/migrations/2026-10-11_codigos_sala_no_reutilizables.sql).
2. [2026-10-11_estado_codigo_sala.sql](../supabase/migrations/2026-10-11_estado_codigo_sala.sql).

Ambos son idempotentes y se aplicaron dos veces en PGlite. El segundo solicita recarga del esquema de PostgREST. Los textos SQL completos copiables y las consultas de diagnóstico de columnas, restricciones, triggers, firmas y permisos están en [registro de códigos](codigos_sala_no_reutilizables_2026-10-11.md) y [estado del código](estado_codigo_sala_2026-10-11.md). Si falta un requisito, aplicar primero el script indicado por el error; no reinstalar después generadores/runtime antiguos sin volver a aplicar las correcciones. No ejecutar SQL para reabrir la partida cancelada de la captura: crear una sala nueva y compartir su código nuevo.

Comprobación de solo lectura después de aplicar:

```sql
select to_regclass('side_private.codigos_sala_reservados') registro,
       to_regprocedure('public.side_estado_codigo_sala(text)') estado_codigo,
       to_regprocedure('public.side_config_cancelada(jsonb)') cancelacion;
-- Los tres valores deben existir.
select public.side_config_cancelada('{"cancelledAt":null}'::jsonb) falso,
       public.side_config_cancelada('{"phase":"cancelled"}'::jsonb) verdadero;
-- false, true.
select tgname, pg_get_triggerdef(oid)
from pg_trigger
where tgrelid='public.partidas'::regclass and not tgisinternal;
-- Incluye side_reservar_codigo_sala, BEFORE INSERT OR UPDATE.
select public.side_estado_codigo_sala('REEMPLAZAR_POR_CODIGO_NUEVO');
-- DISPONIBLE para sala vigente; PARTIDA_CANCELADA/FINALIZADA/RETIRADO según historia.
```

No se puede determinar desde el repositorio si tu base tiene aplicado `2026-10-11_logica_excel.sql`. No hace falta para esta corrección; revisar sus funciones por separado si se necesita la integración Excel.

**Límite histórico:** el registro incorpora las salas existentes y conserva todas las asignaciones posteriores. Los códigos de partidas borradas antes de instalarlo solo se recuperan de respaldos; no se puede garantizar esa historia perdida sin recuperarla. PGlite serializa las consultas: las pruebas simultáneas son locales, no equivalen a una prueba multinodo PostgreSQL. Bloqueo y PK protegen la reserva en el servidor.

## Verificación final

- 92 pruebas unitarias: todas verdes, ninguna omitida.
- 10 suites SQL: códigos, estado, recuperación, creación, lifecycle, espera, observaciones, admisión, matriz de admisión e historial. Todas verdes.
- 10 suites de navegador, secuenciales: cambio de sala, sincronización, compartir/copiar e ingreso real con PGlite, admisión, creación, lifecycle, docente, tutorial de espera, historial y calificaciones. Todas verdes.
- `node --check` de aplicación, reglas, servicios y pruebas modificadas; `git diff --check`: PASS. Tras añadir recarga de PostgREST se repitió estado SQL: PASS.
- Revisión independiente con hallazgos corregidos y aprobación: [informe](revision_independiente_codigos_sesion_2026-10-11.md).
- Resumen de ejecución: [resultado JSON](sim/crear_partida/verificacion_codigos_sesion_final.json). Logs permanecen en `tests/output/codigos_sesion_verificacion/`.
- Capturas locales, excluidas de Git por peso: `reports/sim/crear_partida/cambio_sala_invitacion.png`, `cambio_sala_manual.png`, `cambio_sala_codigo_retirado.png`, `recuperar_compartir_docente.png` y `recuperar_compartir_estudiante.png`. El ingreso manual muestra la nueva sala y su cuenta regresiva, sin el estado cancelado de la anterior.

Skills `webapp-testing` y `frontend-design` encontradas en `.agents/skills/` y consultadas; `xlsx` no aplica. Subagentes de registro SQL, sesión y revisión independiente; como máximo tres simultáneos. Artefactos y comandos dentro de SIDE1; el contenedor no tiene archivos nuevos de esta tarea.
