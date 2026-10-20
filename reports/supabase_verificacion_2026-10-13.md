# Verificación funcional y de conexión con Supabase

Fecha: 13 de octubre de 2026, America/Lima.
Repositorio comprobado: `https://github.com/valenlysm29/SIDE1.git`.

## Resultado

437 pruebas automatizadas aprobadas, 0 fallas. La comprobación adicional de
opciones/decisiones en PostgreSQL local y las 2 pruebas del servidor local
también aprobaron. Chromium cargó ambas páginas sin errores de JavaScript y
consultó correctamente el catálogo del Supabase configurado.

## Correcciones

- Se incorporó localmente el SDK Supabase 2.117.3, la versión que entregaba la
  referencia CDN anterior durante esta revisión, junto con su licencia MIT.
  Ambas páginas funcionan con jsDelivr bloqueado y no cambian de SDK por una
  actualización automática del proveedor.
- Todas las solicitudes HTTP del cliente tienen un límite de 15 segundos,
  incluido el cuerpo de la respuesta. Se conserva la cancelación del llamante
  y la respuesta original del SDK. Una solicitud bloqueada ya no mantiene
  indefinidamente ocupados el polling, la cola de notas o la cola estudiantil.
- El transporte no repite escrituras automáticamente: una respuesta perdida
  puede corresponder a una transacción ya confirmada. Las colas conservan sus
  mecanismos existentes de revisión, comprobación de conflictos y reintento.
- La cola docente sigue enviando/reintentando aunque el almacenamiento local
  esté lleno o bloqueado. La interfaz avisa que se debe mantener abierta la
  página hasta sincronizar, y la copia local de una nota no bloquea el envío.
- El panel docente reintenta notas y actualiza datos al volver Internet;
  también reintenta notas al regresar a la pestaña.
- Se corrigió una expectativa obsoleta del test de personajes: el manifiesto
  contiene 17 personajes CC0 y el contrato exige conservar al menos 16. Se
  mantienen los controles de licencia, roles y exclusión de avatares.

La opción oficial usada para el transporte es `global.fetch`:
[documentación de inicialización de Supabase](https://supabase.com/docs/reference/javascript/initializing).

## Evidencias

- `tests/output/supabase-verificacion-final-2026-10-13.tap`: 437/437.
- `tests/output/supabase-db-2026-10-13.log`: opciones múltiples, cantidades,
  costos, reintentos idempotentes, revisiones, cancelación y permisos.
- `tests/output/local-server-2026-10-13.log`: 2/2.
- `tests/output/supabase-live-2026-10-13.json`: consultas remotas de solo lectura.
- `tests/output/supabase-browser-2026-10-13/results.json`: SDK local en ambas
  páginas, recuperación offline y solicitud bloqueada liberada en 15004 ms.
- Capturas `index.png` y `docente.png` en esa misma carpeta.

Las pruebas estudiantiles cubren borradores, cola conservada después de recarga,
respuesta de guardado perdida, recuperación de red, conflictos con otra sesión,
aislamiento entre salas y rechazo explícito de identidad. Las pruebas docentes
cubren reintentos, última edición, permisos, presencia y almacenamiento lleno.

## Supabase real y límites

La salud de autenticación, el catálogo (26 decisiones y 51 opciones), las
capacidades de admisión (waitingRoomVersion=3, exactIdentityVersion=2) y el cierre
Excel (cierreVersion=1) respondieron HTTP 200. El diagnóstico de un código
inexistente respondió correctamente y el podio rechazó una identidad inválida.
El servidor incluyó CORS para el origen local probado.

Los intentos anónimos de leer las tablas de partidas/participantes y obtener la
sala docente recibieron 401/42501. Son restricciones esperadas; no se cambiaron
permisos ni se expusieron tablas para conseguir respuestas 200.

No se usaron credenciales docentes, no se crearon sesiones/empresas/partidas
reales ni se aplicaron migraciones remotas. Por ello, las escrituras y los flujos
autenticados se validaron con base local y fixtures, no sobre una partida real.
La revisión no equivale a una prueba de carga ni permite garantizar ausencia de
fallas en todos los escenarios. Un corte de Internet, caída de Supabase o cierre
del navegador mientras su almacenamiento esté bloqueado sigue siendo una
limitación externa; se verificó recuperación de los cortes simulados.

Todos los archivos de trabajo permanecen dentro de SIDE1. Al terminar, el
directorio contenedor seguía conteniendo únicamente SIDE1.

## Repetir la revisión

Desde la raíz SIDE1:

```powershell
node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs
node tests/decision_options_db.cjs
python tests/local_server_test.py
node reports/supabase_connection_audit_2026_10_13.cjs
node tests/supabase_browser_audit.cjs
```

El último comando necesita el Playwright ya instalado en `tests/node_modules`
y Chrome en la ruta indicada por el script. Los resultados se guardan en
`tests/output/` y no forman parte de las entregas Git.
