# Correcciones de sincronización de SIDE1

Fecha: 30 de septiembre de 2026, hora de Lima.

## Resultado

Se corrigieron los tres defectos reproducidos en la verificación funcional y
la entrada docente que omitía autenticar las credenciales de demostración.
Los cambios están en la carpeta local de SIDE1.

## Cambios

- **Borradores:** el guardado pasa el código de categoría correcto y envía
  las decisiones normalizadas, además del estado y el reporte financiero.
- **Guardados pendientes:** `services/student_sync.js` conserva una cola en
  `localStorage`, por identidad y ciclo. Agrupa las ediciones pendientes de
  cada categoría y reintenta al reconectar, durante la consulta periódica y
  al volver a la página. La cola sobrevive a una recarga del mismo navegador.
- **Guardados parciales:** si el snapshot ya se confirmó, se reintentan solo
  las decisiones o reportes pendientes. Si se perdió la respuesta del guardado,
  una lectura verifica el contenido y la revisión antes de continuar.
- **Conflictos entre sesiones:** las escrituras conservan la revisión esperada.
  Un conflicto recupera el estado del servidor y conserva una copia de lo
  pendiente en `SIDE_STUDENT_SYNC_CONFLICT_<identidad>`. No reenvía la edición
  antigua con la revisión de otra sesión. Una lectura antigua tampoco reduce
  una revisión que ya fue confirmada.
- **Recuperación de sesión:** un fallo técnico conserva la identidad y la sesión,
  muestra el problema de conexión y permite reintentar automáticamente o con
  el botón «REINTENTAR CONEXIÓN». El acceso a operaciones permanece bloqueado
  mientras se valida. Solo un rechazo explícito de identidad elimina la sesión.
- **Estado visible:** la sala y el menú de decisiones indican si se está
  sincronizando, si hay cambios pendientes o si se completó el guardado remoto.
- **Profesor:** con Supabase configurado, toda entrada usa
  `signInWithPassword()` antes de abrir el panel. El acceso de demostración
  directo se conserva para el modo local sin Supabase configurado. No se creó
  ninguna cuenta remota ni se cambió una contraseña.

Se actualizaron las versiones de las rutas JavaScript en `index.html` para
evitar reutilizar el código anterior desde caché.

## Validación

- Suite general de JavaScript: **262 pruebas aprobadas, 0 fallos**.
- Servidor HTTP local: **2 pruebas aprobadas**.
- Regresiones de interfaz: **4 suites aprobadas**: ciclo de partidas con dos
  estudiantes y PostgreSQL local, decisiones y presentación en seis tamaños,
  ciclo docente y reingreso, y arranque del mundo 3D por confirmación global y
  por apartados.
- Las pruebas nuevas cubren borrador real mediante su botón, reconexión,
  persistencia tras recargar, escritura parcialmente confirmada, respuesta
  perdida, conflicto con otra sesión, cambio de identidad durante una escritura,
  errores técnicos, rechazo explícito, recuperación manual y automática, y
  autenticación docente.

Comandos reproducibles desde la raíz de SIDE1:

```powershell
node --test tests/*.test.js tests/*.test.mjs tests/world_finance.test.cjs
python tests/local_server_test.py
node --test tests/student_sync.test.js tests/student_sync_ui.test.js
node tests/run_world_regression.cjs game_lifecycle_ui.cjs decisions_cycle_ui.cjs teacher_lifecycle_ui.cjs world_startup.cjs
```

Evidencia:

- `tests/output/sync-fixes-all-tests-2026-09-30.log`
- `tests/output/sync-fixes-focused-2026-09-30.log`
- `tests/output/sync-fixes-integration-2026-09-30.log`
- `tests/output/continuous/regression.json`

Las pruebas de conectividad fallida utilizan servicios simulados y perfiles
aislados. No se verificaron escrituras exitosas entre dispositivos contra el
Supabase de producción con cuentas reales. No se aplicaron migraciones ni se
publicaron estos cambios en el servidor remoto.

La verificación anterior y sus reproducciones se conservan como evidencia del
estado previo; los diagnósticos anteriores que suponían el acceso docente
directo no representan el nuevo flujo de autenticación.
