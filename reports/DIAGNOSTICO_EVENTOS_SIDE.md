# Diagnóstico preliminar de eventos SIDE — no concluido

Base: rama `logia_prueba_mejora`, commit `55dd58be0e002822be20c128ab4cbed57e640ead`. Auditoría estática, no prueba de partidas reales ni de Supabase.

- `js/docente.js`, funciones `triggerGroupEvents` y `eventSchedule`: selección grupal con `Math.random`, probabilidades del catálogo y programación en `localStorage`. La configuración puede sincronizarse, pero aún no se ha demostrado persistencia y recuperación de cada ocurrencia entre dispositivos.
- `services/partida_service.js` aproximadamente líneas 410–413: rechaza eventos económicos en `__cycleBusiness` si no pueden verificarse independientemente. Aproximadamente línea 502: construye entradas de cierre con `events: []`. Esta ruta no entrega eventos seleccionados al cierre; no implica que se hayan inspeccionado todas las rutas o despliegues reales.
- `supabase/functions/side-business-close/runtime.mjs` incluye código equivalente y soporte parcial de factores genéricos. No se han comprobado versiones desplegadas ni permisos, concurrencia o aplicaciones persistidas.

Pendiente: comprobar servidor y migraciones en entorno aislado, trazar individual/grupal y avisos, instrumentar ocurrencia y aplicación idempotente, evaluar semántica de los 92 eventos y probar los tres modos. No se han implementado correcciones.

Prueba local sobre el commit base: `node --test tests\ciclo_excel.test.cjs tests\caja_excel.test.cjs tests\auditoria_mercado_20261023.test.cjs tests\auditoria_costos_caja_20261023.test.cjs`: 26 pasan, 0 fallan. No prueba eventos reales.

La preparación del worktree falló con `fatal: mmap failed: Invalid argument`; hay archivos rastreados ausentes del checkout. No usar este árbol para ejecutar ni evaluar la implementación hasta repararlo. El índice se restauró a HEAD sin modificar el árbol principal.

## Bloqueo de reparación del checkout — 30/10/2026

Se comprobó que `logia_prueba_mejora` apunta a `55dd58be0e002822be20c128ab4cbed57e640ead` y presenta 1.947 archivos rastreados ausentes por el checkout interrumpido; no hay modificaciones rastreadas adicionales ni cambios preparados. Este diagnóstico es el único archivo no rastreado. El árbol principal sigue en `main` con su informe no rastreado previo intacto.

El objeto Git `a38323f1f22ac6fa697ab0cd626f031bbb710d72` correspondiente a `docs/production-performance.md` está marcado como archivo de OneDrive sin conexión (`attrib`: O, punto de análisis). `git cat-file -s HEAD:docs/production-performance.md` permaneció bloqueado a la espera de lectura. La prueba de marcar temporalmente el objeto para disponibilidad local no completó la hidratación; se retiró la marca y se detuvo la lectura bloqueada. Existe espacio libre suficiente y OneDrive está en ejecución. La indisponibilidad de objetos es evidencia directa de un obstáculo para recuperar el checkout; no se ha demostrado que explique por sí sola todos los fallos `mmap`. No se han sobrescrito ni eliminado objetos, ni se ha intentado cambiar otro árbol. Es necesario restaurar el acceso de OneDrive a estos objetos o proporcionar una copia íntegra de los objetos Git dentro de SIDE1 y verificar el checkout antes de continuar.

El Excel adjunto por separado tiene SHA-256 `a07710cd97447d0a5f1b79f2e7e200b01565abbf4a8ee3ff02055fa2768189b3`, igual al del paquete. No se ha alterado.

## Auditoría en el clon limpio

`js/events_catalog.js` contiene 92 IDs únicos: 48 grupales y 44 individuales. Campos de efecto declarados: 36 `revenuePct`, 35 `costPct`, 21 `cashDelta`. Véase `docs/INVENTARIO_EVENTOS_VIGENTES.md`. Esta estructura no acredita un efecto económico coherente por evento: por ejemplo, PE26 describe interrupción de producción pero declara un cambio de ingresos. La semántica debe versionarse y auditarse por ID antes de activarla en el cierre.

El panel selecciona candidatos grupales aleatoriamente en `triggerGroupEvents` (`js/docente.js`), guarda un calendario en `localStorage` y el estudiante consulta el calendario en `activeStudentEvents` (`js/app.js`). La foto de decisiones puede incluir eventos. Sin embargo, la ruta autorizada `cerrarNegocio` (`services/partida_service.js`) rechaza `__cycleBusiness[ciclo].events` no verificables y alimenta el cierre con `events: []`. La prueba existente `authoritative_worker.test.cjs` verifica ese rechazo, que se mantiene como barrera de seguridad. No se ha demostrado la configuración, anuncio o aplicación en una partida real. Desplegado remoto desconocido.

No hay todavía implementación de los tres modos, fuente autoritativa de programación y aplicación, asignación justa o efectos económicos por variable primaria. No se ha modificado el motor ni el panel; no se han añadido migraciones ni se ha conectado una base remota. Se requiere implementar y probar los límites de propiedad, concurrencia, idempotencia y cierre sellado en un entorno aislado antes de habilitar eventos.

Suite focalizada local: 60 pruebas aprobadas, 0 fallidas; incluye una prueba de rechazo de eventos no verificados y cuatro pruebas de aislamiento 3D. Registro `tests/output/auditoria_logia_v2.log`. No acredita ausencia de todos los canales posibles de influencia 3D, ni flujo docente-alumno-servidor con eventos.

## Implementación experimental PE69 — `demand-share-v1`

Añadida migración aislada `20261031025358_desafios_autoritativos_v1.sql`: tabla con RLS y acceso directo revocado, RPC de asignación por docente propietario antes de la fase de decisiones y listado de asignaciones para ese docente. La asignación es inmutable, acotada a PE69 e intensidad 1–20, y la consulta del trabajador requiere `service_role`. La versión se activa únicamente con `economicEventsVersion: demand-share-v1` y no modifica juegos ni cierres históricos por sí misma.

El trabajador obtiene las asignaciones por empresa mediante RPC y rechaza respuestas inválidas. Mantiene la comprobación que bloquea eventos económicos del snapshot del cliente. PE69 adapta la notoriedad viral a un multiplicador del puntaje relativo de competencia antes de repartir la demanda; el mercado total se conserva y las ventas siguen limitadas por existencias. El recibo guarda ID, intensidad, ciclo y versión. El paquete Edge se regeneró.

Pruebas locales: PGlite comprueba propietario, empresa, fase, inmutabilidad y acceso exclusivo del trabajador; una prueba vertical con tres empresas inserta asignación, ejecuta cierre y vuelve a consultar el cierre sin duplicarlo; un escenario A/B comprueba ventas y reparto; Node y Edge coinciden. Comando: `node --test tests/evento_autoritativo_db.test.cjs tests/evento_autoritativo_vertical.test.cjs tests/evento_autoritativo_worker.test.cjs` con PGlite en `NODE_PATH`.

Limitaciones bloqueantes para activación: falta UI docente y noticia privada del estudiante; la identidad estudiantil existente usa código de sala y nombres, no una identidad autenticada vinculada a la empresa. Aún no se ha demostrado una forma segura de consultar asignaciones privadas por estudiante, así que no se ha expuesto una RPC pública para ello. No hay modos equilibrado ni aleatorio, no se han clasificado o implementado los otros 91 eventos, ni hay prueba concurrente de dos conexiones, ni seis ciclos con tres empresas y eventos. No aplicar esta migración en una base remota ni habilitar el flag hasta completar y revisar el flujo.

## Continuación V2: clasificación, servicios y autorización estudiantil

La afirmación anterior sobre ausencia de vinculación de identidad era incompleta: las migraciones `20261028151956_identidad_estudiante.sql` y `20261028203832_acceso_estudiante_sin_clave.sql` definen `side_private.student_claims`, vinculan empresa a `auth.uid()` y condicionan la transferencia a la liberación del docente. Se ejecutó `tests/identity_session_only_db.cjs` en PGlite. No se ha verificado el estado de ninguna instalación remota ni la identidad real de Supabase.

Se agregó `20261031030035_consulta_privada_desafios.sql`: su RPC comprueba sesión, titularidad y pertenencia a partida, excluye expulsados y devuelve únicamente asignaciones de la empresa vinculada. No habilita la versión experimental por defecto. El estado `aplicado` exige la presencia de ID, ciclo, intensidad y versión en el recibo sellado. Pruebas PGlite rechazan acceso anónimo, acceso de otra sesión y acceso tras transferencia; validan recuperación desde otra sesión autorizada. Son pruebas locales con fixture, no reemplazan Postgres real, autenticación real ni pruebas completas de concurrencia. La UI no consume aún esta RPC.

`js/event_semantics_v2.js` propone variable primaria para los 92 IDs; solo PE69 está implementado. La clasificación y los eventos compuestos requieren revisión antes de activar más efectos. Se agregaron métodos de servicio para asignar/consultar desafíos desde docente y consultar la noticia desde la sesión del alumno. Los tres modos y el panel siguen sin implementarse.

La prueba PGlite `tests/evento_seis_ciclos_tres_empresas.test.cjs` cierra seis ciclos con tres empresas y rota PE69 entre ellas. Comprueba asignaciones, reparto, conservación física por SKU, balances, continuidad de caja y reintentos. Solo usa un tipo de evento; no prueba tres modos, eventos grupales, efectos positivos y negativos, UI ni cierres simultáneos de dos conexiones. Suite focalizada: 33 aprobadas, 0 fallidas (`tests/output/desafios_v2_focal.log`).

## Continuación: interfaz de la ruta experimental PE69

En el panel docente, cuando una partida ya tiene explícitamente `economicEventsVersion=demand-share-v1`, se muestra una asignación manual experimental de PE69 por empresa, ciclo e intensidad y un historial consultado al servidor. La RPC del docente ahora distingue programado, aplicado y no aplicado a partir del recibo sellado y devuelve demanda asignada y unidades vendidas; no presenta una diferencia causal A/B como si fuera un resultado observado. La versión sigue ausente por defecto y no se ha aplicado ninguna migración remota.

La aplicación del alumno consulta la RPC privada usando su sesión de alumno y muestra título, descripción, ciclo y estado. Los datos son solo de presentación: no se incorporan a la foto económica ni se usan como autoridad del cierre. La carga comprueba empresa, partida y época de sesión, descarta respuestas tardías y borra noticias al perder la sesión; un error se muestra como indisponibilidad, no como ausencia confirmada. Para V2 se evita incluir eventos antiguos calculados en el navegador en `cycleBusinessData`.

Pruebas: `tests/teacher_challenge_v1_browser.cjs` y `tests/student_challenge_news_browser.cjs` verifican la interfaz con respuestas simuladas. `tests/evento_autoritativo_vertical.test.cjs` prueba por separado en PGlite asignación, consulta privada, rechazo de otra empresa, cierre, historial y repetición con tres empresas. La suite focal registró 38 aprobadas (`tests/output/prioridad_eventos_focal.log`); incluye caso Excel, seis ciclos de PE69 rotado, Node/Edge y regresión 3D. No es un único E2E HTTP con identidades Supabase reales ni acredita dos conexiones concurrentes.

Pendientes: otros 91 eventos, tres modos de asignación, progresión y balance de dificultad, eventos generales, prueba de tres empresas/seis ciclos con desafíos distintos, autenticación y concurrencia en PostgreSQL real y validación integral. No habilitar ni desplegar V2 mientras sigan pendientes.
