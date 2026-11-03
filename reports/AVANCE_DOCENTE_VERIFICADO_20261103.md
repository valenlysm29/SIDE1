# Corrección del avance docente de SIDE

## Causa y comportamiento corregido

El control manual esperaba `teacherRead`, que representa solamente la primera lectura de Supabase, y después abandonaba la operación si `teacherBusy` seguía activo. La sincronización mantiene ese indicador durante las consultas posteriores de cierres: un clic durante ese intervalo se perdía silenciosamente. La reproducción comparada contra `origin/main` dio `accepted:false, writes:0`; con la corrección dio `accepted:true, writes:1`.

Además, el botón se calculaba desde el modo seleccionado en el formulario y no desde una validación de confirmaciones y cierres en PostgreSQL. No distinguía el procesamiento de un cierre confirmado y el mensaje de procesamiento podía ser reemplazado por una actualización de la vista.

Ahora el control espera toda la sincronización, conserva el ciclo esperado al hacer clic y excluye clics repetidos. La disponibilidad proviene del servidor. Solo cuentan empresas participantes no expulsadas con envío confirmado, marcador del ciclo actual y plan válido distinto de `source: no-plan`. Al confirmar todas, la sincronización de una partida manual inicia el cierre oficial. El botón permanece bloqueado mientras se procesa y se habilita cuando el cierre está completo. PostgreSQL vuelve a comprobar estos requisitos bajo el bloqueo de la partida y conserva la comparación del ciclo esperado: dos sesiones no pueden saltar ciclos.

Las confirmaciones pendientes se muestran por empresa. Los errores de conexión y de cierre se muestran como errores, con reintento automático. La vista se actualiza cuando cambia la disponibilidad, aunque el número de ciclo y el reloj no cambien.

## Validación completada

- 204 pruebas del control de publicación aprobadas, incluidas las nuevas regresiones de confirmaciones, disponibilidad y clic durante sincronización.
- Partidas de **3 y 6 ciclos manuales**, cada una con **tres empresas**, ejecutadas en Supabase local aislado: Auth real, PostgREST, PostgreSQL 17, Realtime y la Edge Function real `side-business-close`. No se simularon respuestas RPC ni se construyeron sellos económicos para estas pruebas.
- Alta de empresas y avance mediante interfaz; planes enviados por el servicio real de estudiantes, con autorización y revisión del snapshot. Las confirmaciones se enviaron por separado: mientras faltaban empresas, el botón permaneció deshabilitado y el servidor identificó cuántas faltaban.
- Dos pestañas docentes abiertas, cinco clics repetidos y una segunda sesión intentando avanzar el mismo ciclo. El ciclo subió exactamente una vez. En el primer ciclo se pulsó durante una consulta de sincronización en curso.
- Cada cierre se calculó mediante dos solicitudes concurrentes al trabajador Edge: una procesó y la otra respetó la propiedad del intento, sin duplicar el sello.
- Se compararon huellas de cierres previos en cada ciclo; caja inicial contra caja final anterior, inventarios iniciales contra los anteriores, deuda, estados financieros y equilibrio contable. Se conservaron 9 resultados empresa/ciclo en la partida de 3 y 18 en la de 6.
- Las pestañas de estudiantes y la segunda pestaña docente recibieron el siguiente ciclo sin recargarse. Se verificaron los estados financieros de estudiantes y los ciclos confirmados del laboratorio. Se verificó también la lectura histórica tras recargar al finalizar.
- Sin errores JavaScript ni recursos locales fallidos en los recorridos aprobados. La primera ejecución de seis ciclos se detuvo al interactuar con una pestaña docente en segundo plano; se repitió completa trayéndola al frente y desactivando la ralentización de pestañas de Chromium. No se omitió ningún ciclo ni comprobación económica.
- La nueva lectura de disponibilidad rechazó acceso anónimo con HTTP 401 y acceso de un usuario no docente con HTTP 403.

## Evidencia

`tests/output/avance-docente/reproduccion.json` registra el clic perdido antes y el único avance después. `release.log` contiene las 204 pruebas. `e2e/integration-3.json` e `e2e/integration-6.json` registran los ciclos y las comprobaciones; `e2e/enabled-3-1.png`, `e2e/enabled-6-6.png` y las capturas del laboratorio muestran los estados reales de la instalación aislada. `security.json` registra las denegaciones de acceso.

Una copia compacta de los resultados se conserva en `reports/avance-docente/continuidad.json`. Las capturas y archivos completos permanecen dentro de SIDE1, en `tests/output/`, ignorados por Git.

## Supabase remoto

Migración aplicada: `20261103133130_validacion_avance_docente` en el proyecto SIDE (`plfuwfdpsagzrlveqkvl`). Edge Function desplegada y activa en versión **15**, con la autenticación por token dedicado existente. No se modificó el modelo económico: se regeneró su paquete porque incluye el servicio actualizado.

La consulta autenticada con el propietario de `SIDE-H57S` devuelve `ready:true`, ciclo 2, una empresa, cero pendientes y cierre confirmado. La comprobación se hizo en una transacción de lectura, sin avanzar esa partida.

Los **164 cierres históricos** remotos mantuvieron la misma huella agregada antes y después del despliegue: `aaf1eab64751ae9040a5d792c364185c`. No se avanzaron, cancelaron ni reescribieron partidas reales para probar la corrección.

## Archivos de la corrección

`js/docente.js`, `services/partida_service.js`, `docente.html`, `index.html`, `supabase/migrations/20261103_validacion_avance_docente.sql`, `supabase/schema.sql`, `supabase/bootstrap/manifest.json`, `supabase/functions/side-business-close/runtime.mjs`, `tools/check_release.cjs`, `tests/avance_docente_integridad.test.cjs`, `tests/avance_docente_ui.test.cjs`, `tests/avance_docente_e2e.py`, las pruebas de reintento/cancelación/cierre provisional adaptadas al nuevo límite de sincronización y este informe con su evidencia compacta.

Se preparó la publicación desde una copia aislada de `origin/main` dentro de `.codex-work/avance-main`. El árbol original conserva los cambios y eliminaciones que ya existían. El directorio padre no recibió artefactos de trabajo de SIDE.
