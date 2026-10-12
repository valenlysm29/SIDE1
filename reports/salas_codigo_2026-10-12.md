# Salas por código — 12 de octubre de 2026

## Diagnóstico antes de editar

Se revisaron `supabase/schema.sql`, las migraciones de lifecycle/admisión/identidad exacta y las cuatro correcciones del 11-Oct; `services/partida_service.js`, `services/empresa_service.js`, `js/docente.js`, `js/app.js` y sus formularios. Tres subagentes trabajaron por frente (SQL, docente y estudiante), primero en lectura y después en implementación; integración y revisión final en el agente principal. Skills utilizadas: `.agents/skills/frontend-design/SKILL.md` y `.agents/skills/webapp-testing/SKILL.md`; ninguna faltó.

### Causas confirmadas y límites de la evidencia

1. **Normalización inconsistente:** el formulario y servicio aceptaban exclusivamente `SIDE-` seguido de 3/4 caracteres. Un código pegado sin guion o con espacios internos se rechazaba antes de ejecutar Supabase; el formato nuevo de seis caracteres tampoco podía entrar. Reproducción cubierta por pruebas con el formulario y servicio reales. Además, normalizar solamente el alta dejaba fallar el polling con código sin guion: prueba PostgreSQL confirmó la necesidad de normalizar también el resolver de identidad.
2. **Espera indefinida:** el feature probe y las RPC de admisión/polling carecían de timeout. Una promesa de red pendiente dejaba bloqueado el ingreso. Ahora cada petición estudiante vence a los 15 segundos y ofrece reintento.
3. **Código aparente:** el panel generaba/reutilizaba `SIDE_ASSIGNED_GAME_CODE` local antes de tener una fila confirmada. Podía enseñar un código persistido como si fuera una sala real. Se retiró ese generador; el borrador muestra «Código pendiente» y solo se comparte el código devuelto por el servidor.
4. **Cancelación con contrato incompleto:** ya había botones copiar/cancelar en este HEAD; cancelar usaba `controlar_partida('cancelar')`, que guardaba `finalizada` + JSON `cancelledAt`. El CHECK solo admitía esperando/activa/finalizada. La admisión antigua comprobaba identidad antes del estado terminal y permitía recuperar una cancelada; el cliente la rechazaba después. Ahora el servidor rechaza el ingreso antes y conserva un estado explícito `cancelada`, hora y fila histórica.
5. **Selección/copia:** faltaba `user-select:text` explícito; se conservó la copia moderna y alternativa existente, se restauró foco tras el input temporal y se agregó feedback accesible «Copiado». Los controles se habilitan exclusivamente con una sala confirmada.

El texto amarillo «Sala de espera configurada…» **no existe en el código actual**. El informe previo `diagnostico_crear_partida_2026-10-11.md` documenta el antiguo éxito basado solo en caché; el HEAD inicial de esta tarea ya consulta `crear_sala_docente` y valida identidad/reloj. El E2E actual confirma INSERT real y sala visible; no se atribuye el texto antiguo a una causa actual sin evidencia. Se cambiaron las versiones de assets para evitar reutilizar JS anterior.

### Supabase configurado: comprobación remota de solo lectura

Se consultaron las RPC públicas con la publishable key ya configurada, sin credenciales privadas, sin listar salas y sin crear participantes. El código de diagnóstico fue deliberadamente inexistente (`SIDE-DIAGNOSTICO-INEXISTENTE`).

| RPC | Respuesta observada |
| --- | --- |
| `side_admission_features()` | HTTP 200, waitingRoomVersion=3, exactIdentityVersion=2 |
| `side_estado_codigo_sala(código inexistente)` | HTTP 200, PARTIDA_NO_ENCONTRADA |
| `ingresar_empresa(código inexistente, nombres diagnóstico)` | HTTP 200, CREDENCIALES_INVALIDAS |
| `unirse_partida_por_codigo(código inexistente, nombres diagnóstico)` | HTTP 404, PGRST202: función no encontrada |
| `side_game_features()` como anon | HTTP 401, 42501: permiso denegado; esperado para función docente |

**No está confirmado que RLS impida el ingreso actual.** El esquema base sí tenía una política de INSERT participante que dependía de una partida no visible a anon; las migraciones de admisión ya sustituyen ese camino por SECURITY DEFINER. El cliente actual no inserta participantes directamente y la RPC instalada responde. Tampoco hay default fijo en los SQL actuales: existía generación 3/4 caracteres y reserva histórica. No se recibió una terna concreta de una sala afectada ni una sesión docente remota, por lo que no se afirma que todos los fallos observados por el usuario tengan una única causa en producción.

## Cambios por archivo

| Archivo | Cambio |
| --- | --- |
| `supabase/migrations/2026-10-12_salas_codigo.sql` | Generador seis caracteres sin 0/O/1/I/L; mutex, reserva histórica y UNIQUE normalizado; alias del generador existente; default/trigger; RPC unión y cancelación; CHECK/cancelled_at; RLS docente y bloqueo de accesos REST estudiante; normalización del resolver; protección terminal del endpoint antiguo. |
| `services/partida_service.js` | `cancelar` llama nueva RPC, timeout, error real en consola y exige confirmación de la misma fila cancelada. |
| `services/empresa_service.js` | Nueva RPC de ingreso, normalización consistente y timeout/abort para admisión, feature probe, polling y guardado de estado. |
| `js/docente.js` | Retira código local ficticio; copia con foco/feedback; cancelación y visibilidad por propietario; deshabilita compartir al terminar. |
| `css/docente.css`, `docente.html` | Selección de códigos, foco, controles táctiles y estados accesibles; versiones de assets. |
| `js/app.js`, `index.html` | Formato nuevo/legado/demo, normalización al escribir/pegar, errores específicos/reintento, cancelación con aviso persistente y retorno al inicio. |
| `tests/salas_codigo_db.cjs` | PostgreSQL real PGlite, repetición SQL, 1000 INSERT, permisos/RLS, reingreso y cancelación. |
| `tests/salas_codigo_service.test.cjs`, `tests/salas_codigo_student.test.cjs` | Doble Supabase, contrato de cancelación, normalización, timeout/reintento, identidad exacta y rechazo terminal. |
| Tests existentes de compartir/cancelar/admisión y runners crear/lifecycle/compartir | Actualiza contrato y agrega recorrido completo con SQL real local. |

No se agregaron decisiones ni se modificó su menú. No existe cupo definido en el esquema/flujo previo, por lo que no se inventó un límite ni un rechazo «sala llena». Se conserva el rechazo de nuevas identidades después de iniciar. SIDE-000 y códigos existentes permanecen; los códigos retirados no vuelven a asignarse.

## Verificación

Referencia antes de editar: `node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs`: **413/414**, único fallo previo `decision_roster.test.mjs:21`, manifiesto 17 actores frente a expectativa 16. Log `tests/output/salas_baseline.tap`.

Ejecución final del mismo comando: **420/421**, exactamente el mismo fallo previo ajeno a salas; sin regresiones nuevas. Log `tests/output/salas_final.tap`. No se cambió el manifiesto ni se debilitó su prueba. Los dos fallos de expectativas detectados durante integración fueron corregidos y la ejecución final los supera.

Pruebas de base de datos aprobadas: `salas_codigo_db.cjs` (SQL tres veces consecutivas, 1000 códigos únicos/formato, demo, entrada anon, estados terminales, reingreso activo exacto, nombres distintos rechazados, dueño/otro profesor/anon, RLS sin listados, polling y no reutilización/reapertura; además upgrade completo con migraciones del 11-Oct y SQL nuevo dos veces), `crear_partida_db.cjs`, `student_admission_db.cjs`, `student_admission_matrix_db.cjs`, `waiting_room_db.cjs`, `game_lifecycle_db.cjs` y `decision_options_db.cjs`. Logs locales `tests/output/salas_*db.log` y `salas_admission_matrix.log`. Suite focal de copia/cancelación/servicios: 15/15 (`salas_codigo_unit.log`).

El runner de creación detectó una regresión durante integración: el trigger reservado lanzaba 23505 sin identificar la restricción, por lo que `crear_sala_docente` no reconocía una colisión reintentable. Se corrigió el identificador y se amplió su whitelist existente de reintentos. La prueba SQL ahora fuerza una primera colisión SIDE-000 y comprueba éxito en segundo intento, y fuerza colisión permanente para verificar rechazo sin falso éxito.

Browser E2E `compartir_sala_ui.cjs`: **PASS** con HTML/JS/servicios reales y PostgreSQL PGlite por HTTP; Supabase Auth y transporte son fixtures, sin mutaciones remotas. Comprueba recuperación/copia, nueva creación y código distinto, ingreso minúsculas/sin guion, cancelación docente, retorno estudiante al inicio y rechazo de reingreso. También migración de recuperación faltante. Capturas/JSON/log en `tests/output/salas_codigo/` y `tests/output/salas_e2e.log`.

Runner `student_change_room_ui.cjs`: **PASS**, tres escenarios de cambio de sala y respuestas atrasadas. `crear_partida_ui.cjs`: **PASS** completo después de corregir la colisión (creación real, móvil, copia, recarga, errores/reintentos, dos pestañas, espera/en curso, códigos, Manual/Automático). `game_lifecycle_ui.cjs`: **PASS** completo (fallo/reintento de cancelar, ambos alumnos reciben aviso y vuelven al inicio, relojes, reingreso y modo automático). Nueve pruebas unitarias docente de compartir/cancelar: **PASS**. `node --check` de los cuatro scripts/servicios modificados y `git diff --check`: **PASS**. Capturas revisadas visualmente del panel móvil y retorno al inicio con aviso.

## Despliegue y comprobación

**Sí, falta ejecutar SQL en Supabase:** el push de JavaScript no instala funciones. No se ejecutó SQL de escritura en producción. Si ya existen `crear_sala_docente(jsonb,text,text,text,uuid,uuid)` y admisión 3/2, ejecutar únicamente el archivo nuevo completo. Su preflight valida los prerrequisitos y revierte sin cambios si faltan.

Si el preflight falla, aplicar en orden los archivos completos: `supabase_game_lifecycle.sql` → `supabase_student_admission.sql` → `20261009_sala_espera_identidad_exacta.sql` → `2026-10-11_fix_crear_partida.sql` → `2026-10-12_salas_codigo.sql`. Para una instalación sin tablas usar primero `supabase_migration.sql`; conservar las otras migraciones de decisiones/Excel/reportes ya propias de la instalación. No reinstalar lifecycle después del parche sin reaplicar identidad exacta y los parches posteriores. La nueva migración no requiere reinstalar las cuatro correcciones del 11-Oct; las reutiliza cuando existen.

Recargar con Ctrl+F5. Entrar como docente, iniciar sala y comprobar confirmación verde, código SIDE de seis caracteres y botones Copiar/Cancelar. Copiar y pegar en una ventana privada estudiante con ambos nombres; debe entrar a la sala de espera y aparecer su empresa en docente. Cancelar y confirmar: debe desaparecer la sala activa y el estudiante volver al inicio con aviso; reutilizar el código debe informar cancelación. Crear otra: debe mostrar otro código. En curso, solo la misma terna código/nombre legal/nombre comercial debe reingresar.

Pendiente externo: aplicar migración y repetir el recorrido con cuentas reales en Supabase. La prueba remota de punta a punta no se realizó porque no hay sesión docente ni acceso de administración SQL disponible. El fallo previo de actores queda separado de este trabajo.

Todos los artefactos de esta tarea permanecen dentro de SIDE1. El contenedor del proyecto solo tenía SIDE1 al comenzar y al verificar antes de entrega. Remoto verificado: `https://github.com/valenlysm29/SIDE1.git`.

Entrega organizada en commits SQL, docente, estudiante e integración/informe. Se autoriza el push solicitado a main al pasar todas las pruebas relevantes de salas; el único fallo de la suite general es el mismo fallo previo del manifiesto de NPC documentado arriba. El push no aplica SQL ni confirma que el hosting haya desplegado el JavaScript.
