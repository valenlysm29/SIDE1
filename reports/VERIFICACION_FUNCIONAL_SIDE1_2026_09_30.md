# Verificación funcional de SIDE1

Actualización posterior: los fallos descritos aquí se corrigieron en el código
local. Consulta [cambios y validación](CORRECCIONES_SINCRONIZACION_SIDE1_2026_09_30.md).
Este informe conserva los resultados del estado anterior a las correcciones.

Fecha: 30 de septiembre de 2026, hora de Lima.
Código: commit `7b06e34` y cambios locales presentes al iniciar la revisión.

## Resultado

SIDE1 funciona en los escenarios locales comprobados, pero conserva tres
defectos reproducibles de sincronización. La disponibilidad del backend y el
éxito de las pruebas locales no permiten dar por verificado todo el flujo
remoto entre estudiantes y docente.

La revisión no cambió el código de la aplicación ni aplicó migraciones al
proyecto remoto. Se conservaron los cambios locales anteriores.

## Pruebas realizadas

| Área | Resultado |
| --- | --- |
| JavaScript: decisiones, producción, finanzas, admisión, personajes, navegación y contratos del mundo | 241 pruebas aprobadas, 0 fallos |
| Servidor HTTP local: arranque, puerto ocupado y recursos de entrada | 2 pruebas aprobadas |
| Base de datos local: ciclo de partidas | Aprobado |
| Base de datos local: observaciones, cancelación, presencia y eventos | Aprobado |
| Base de datos local: admisión y reingreso de estudiantes | Aprobado |
| Base de datos local: matriz de admisión, casos 1–19 | Aprobado |
| Base de datos local: historial docente, permisos y aislamiento de cuentas | Aprobado |
| PDF docente: descarga y vista previa desde los botones reales | Aprobado |
| Regresión de interfaz y WebGL | 12 suites aprobadas, 0 fallos |

Las 12 suites de navegador comprobaron plaza y movimiento, colisiones, entrada
a edificios, HUD, pedidos y entregas sin cobros duplicados, pausa y reanudación,
arranque y reintento de carga, sesiones independientes por ciclo, decisiones
en seis tamaños de pantalla, ciclos manuales y automáticos con dos estudiantes,
cancelación, panel e historial docente, selección de personajes y orientación
móvil. La última suite pasó en 360×640, 390×844 y 844×390, con emulación táctil.
La comprobación del PDF docente se ejecutó adicionalmente y también pasó.

Comandos ejecutados desde la raíz de SIDE1:

```powershell
node --test tests/*.test.js tests/*.test.mjs tests/world_finance.test.cjs
python tests/local_server_test.py
node tests/game_lifecycle_db.cjs
node tests/game_observations_db.cjs
node tests/student_admission_db.cjs
node tests/student_admission_matrix_db.cjs
node tests/teacher_history_db.cjs
node tests/teacher_report_pdf_ui.cjs
node tests/run_world_regression.cjs playable_hub.cjs gameplay_hud.cjs world_business_ui.cjs world_startup.cjs world_loading.cjs world_cycle_restart.cjs decisions_cycle_ui.cjs game_lifecycle_ui.cjs teacher_lifecycle_ui.cjs teacher_history_ui.cjs character_selection_ui.cjs world_orientation_mobile.cjs
node reports/functionality_audit_2026_09_30.cjs
```

## Fallos confirmados

### 1. El borrador no sincroniza las filas de decisiones

Prioridad alta. En `js/app.js:924`, `saveCurrentSection()` pasa el objeto de
categoría a `syncSectionToSupabase()`. En `js/app.js:1165`, la sincronización
espera un código de texto y busca la categoría por ese código.

Reproducción en un navegador aislado: seleccionar el canal web y guardar el
borrador. El resultado es `saved: true`, con llamadas a `snapshot` y `report`,
pero ninguna a `decisions`. Invocar luego `syncSectionToSupabase('D')` produce
las llamadas a `snapshot` y `decisions`.

Consecuencia: el snapshot y el reporte se intentan guardar, mientras las filas
normalizadas de decisiones quedan sin actualizar. La ruta de confirmación
utiliza el código de categoría y no presenta este mismo defecto.

Corrección recomendada: pasar `cat.cat` en el guardado del borrador y verificar
la llamada al servicio de decisiones.

### 2. Las escrituras fallidas no se recuperan al reconectar

Prioridad alta. `queueStudentSnapshot()`, en `js/app.js:1103`, devuelve `false`
ante un fallo y no conserva una operación pendiente para reintentar. El evento
`online`, en `js/app.js:1351`, solicita una lectura del estado.

Reproducción: hacer que el servicio de escritura devuelva `Failed to fetch`.
El guardado devuelve `false`. Después de emitir `online`, el contador de
intentos de escritura sigue en uno.

Consecuencia: volver a tener conexión no asegura que los cambios locales
pendientes lleguen al servidor. Se requiere otro guardado exitoso.

Corrección recomendada: conservar y reintentar las operaciones pendientes por
identidad y ciclo, respetando la revisión del estado remoto y mostrando si la
sincronización sigue pendiente.

### 3. Un error de red al restaurar la sesión elimina el ingreso guardado

Prioridad media. `restoreStudentSession()`, en `js/app.js:1337–1342`, interpreta
una lectura fallida como identidad inválida y elimina `SIDE_STUDENT_SESSION`.

Reproducción: recargar una sesión guardada haciendo que la lectura del estado
devuelva `Failed to fetch`. Se observa el mensaje «No se pudo validar el ingreso
con los datos proporcionados», `sessionKept: false` y `studentConnected: false`.

Consecuencia: una interrupción técnica obliga a volver a ingresar. Además,
el evento de reconexión no restaura esa sesión porque exige estar conectado.

Corrección recomendada: distinguir rechazo de identidad y fallo técnico;
conservar la sesión y permitir reintentar ante errores transitorios.

## Conexión real con Supabase

La revisión remota comenzó a las 16:55, hora de Lima:

- Auth y catálogos respondieron HTTP 200.
- El catálogo remoto contiene 26 decisiones y 51 opciones. No se encontraron
  decisiones u opciones faltantes ni diferencias de categoría o tipo.
- Las consultas de estructura de partidas y participantes respondieron HTTP
  200 con `limit=0`; esto no comprueba acceso docente a registros reales.
- El SDK cargó y las consultas desde Chromium no produjeron excepciones
  JavaScript ni solicitudes fallidas.
- Las funciones privadas rechazaron el acceso anónimo con `42501`, como se
  esperaba por sus permisos.
- Los RPC de ingreso, estado, snapshot, decisiones y reporte reconocieron sus
  parámetros y rechazaron las identidades vacías con `CREDENCIALES_INVALIDAS`.
- La consulta GET de diagnóstico a `controlar_partida` recibió HTTP 405 /
  `25006`: la función requiere una transacción de escritura para `FOR UPDATE`.
  La aplicación usa POST mediante `rpc()`; ese resultado del diagnóstico no
  se clasifica como fallo de la aplicación.
- Se observó un 404 para `/favicon.ico`, sin impacto en los flujos comprobados.

El acceso docente de demostración en `js/app.js:401` abre el panel sin llamar
a `signInWithPassword()`. En un navegador limpio no hay sesión de Supabase, y
crear una partida devuelve «Debes iniciar sesión como profesor». Para usar
partidas remotas se necesita el flujo de autenticación real.

## Alcance y evidencia

Las suites de base de datos utilizan PostgreSQL local mediante PGlite. Las
pruebas de navegador usan almacenamiento aislado, servicios de prueba y, para
el mundo 3D, WebGL en Chromium con SwiftShader. No certifican el rendimiento
en teléfonos físicos o en la GPU del usuario.

No se contó con una sesión docente real ni una identidad estudiantil válida
para verificar escrituras exitosas y sincronización entre dispositivos contra
producción. Los fallos de conectividad fueron inducidos en servicios simulados;
no significan que Supabase estuviera caído durante la revisión.

Evidencia:

- `tests/output/functionality-audit-2026-09-30/results.json`: respuestas remotas
  y reproducción de los tres defectos.
- `tests/output/verification-supabase-2026-09-30.log`: salida del diagnóstico.
- `tests/output/verification-ui-2026-09-30.log`: salida de las suites de interfaz.
- `tests/output/continuous/regression.json`: resultado por suite de interfaz.
- `tests/output/verification-pdf-2026-09-30.log`: resultado de descarga y vista previa.
- `tests/output/hub/`, `tests/output/gameplay/` y
  `tests/output/orientation-mobile/`: capturas de las suites del mundo 3D.
- `reports/functionality_audit_2026_09_30.cjs`: diagnóstico adaptado a las rutas
  actuales de `js/` y a una carpeta de evidencia independiente.
