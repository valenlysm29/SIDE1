# Verificación de SIDE1 y comunicación con Supabase

Fecha: 30 de septiembre de 2026, aproximadamente 16:10, hora de Lima.
Código revisado: repositorio SIDE1, commit `f29e9ca`, con los cambios locales existentes.
Proyecto remoto: `plfuwfdpsagzrlveqkvl.supabase.co`.

## Resultado

La conexión básica funciona: Supabase responde, la clave pública es aceptada,
el SDK carga en Chromium y el navegador consulta los catálogos sin errores de
red ni CORS. Sin embargo, **la sincronización tiene tres defectos reproducidos**.
Por eso no se puede afirmar que toda la comunicación funcione correctamente.

Los errores siguientes se comprobaron con el código actual en un navegador
aislado. Los fallos de red se simularon; no representan una caída de Supabase
durante esta revisión.

## 1. Guardar un borrador omite el envío de las decisiones

**Prioridad alta.** En `app.js:924`, `saveCurrentSection()` llama a
`syncSectionToSupabase(cat)` pasando el objeto completo de la categoría.
La función, en `app.js:1169`, espera el código de texto, como `D`, y busca una
categoría con `c.cat === cat`. Al recibir un objeto no encuentra coincidencia y
retorna sin enviar las decisiones.

Reproducción: seleccionar el canal web y guardar el borrador. La interfaz
devuelve éxito y muestra «Borrador guardado sin enviar». Los servicios reciben
un guardado de snapshot y un reporte, pero **ningún guardado de decisiones**.
Al invocar la misma sincronización con `'D'`, sí se llama al servicio de
decisiones.

Consecuencia: el snapshot y el reporte pueden conservar el borrador, mientras
faltan sus filas normalizadas de decisiones. El panel docente que consulta
esas filas puede mostrar información incompleta. El envío confirmado tiene
otra ruta que sí pasa `plan.cat`, por lo que el defecto identificado corresponde
al guardado del borrador.

Corrección recomendada: pasar `cat.cat` en esa llamada y verificar que guardar
el borrador también envíe las decisiones al servicio.

## 2. Las escrituras fallidas no se reintentan al reconectar

**Prioridad alta.** `queueStudentSnapshot()`, en `app.js:1103–1131`, consume la
operación y devuelve `false` si falla. No conserva un trabajo pendiente con
reintento. El evento `online`, en `app.js:1351`, solamente solicita una lectura
del estado remoto.

Reproducción: el servicio devuelve `Failed to fetch`. Se realiza un intento,
la función retorna `false` y la consola registra únicamente
«SIDE: el estado remoto quedó pendiente». Tras disparar la reconexión, el número
de intentos de escritura sigue siendo uno.

Consecuencia: el servidor puede quedarse con el estado anterior hasta un nuevo
guardado que termine correctamente. La operación que falló no se recupera por
el solo hecho de volver a estar conectado. Además, el aviso genérico no conserva
el detalle técnico y los llamadores no ofrecen una confirmación de sincronización.

Corrección recomendada: conservar la última operación pendiente por empresa y
ciclo, reintentar al reconectar y mostrar su estado; mantener las revisiones
para evitar sobrescribir cambios de otra sesión.

## 3. Un fallo de red al restaurar la sesión se muestra como datos inválidos

**Prioridad media.** `refreshStudentGame()` retorna `false` ante un fallo técnico.
`restoreStudentSession()`, en `app.js:1337–1342`, interpreta cualquier retorno
negativo como ingreso inválido, borra `SIDE_STUDENT_SESSION` y desconecta al
estudiante.

Reproducción: recargar con una sesión de prueba guardada y hacer que la consulta
de estado devuelva `Failed to fetch`. El resultado observado es:

- Mensaje: «No se pudo validar el ingreso con los datos proporcionados».
- Sesión eliminada.
- `studentConnected = false`.

Consecuencia: un problema de conectividad se confunde con un rechazo de identidad.
El estudiante pierde la sesión recuperable y el evento `online` tampoco inicia
la recuperación, porque exige `studentConnected`.

Corrección recomendada: distinguir errores técnicos de rechazos de identidad,
conservar la sesión ante problemas transitorios y permitir reintentar.

## Limitación del acceso docente de demostración

El acceso de demostración documentado abre `docente.html` directamente en
`app.js:401`, sin llamar a `auth.signInWithPassword()`. En una sesión limpia,
el panel queda sin sesión autenticada de Supabase. Se comprobó que el servicio
de creación de partida responde «Debes iniciar sesión como profesor» antes de
insertar datos.

Es una limitación del flujo de demostración, no una caída del servidor. Para
operar partidas remotas se necesita un profesor autenticado. Los HTTP 401 con
código `42501` obtenidos al consultar funciones privadas sin sesión son
restricciones esperadas; no deben interpretarse como migraciones faltantes.

## Comprobaciones realizadas

- Auth remoto: HTTP 200.
- Catálogo remoto: HTTP 200, 26 decisiones y 51 opciones.
- Comparación con el catálogo local: sin decisiones u opciones faltantes y sin
  diferencias de categorías o tipos.
- Consultas de estructura de partidas y participantes, incluida la relación
  con empresas y las columnas de presencia y puntaje: HTTP 200 con `limit=0`.
  Esto comprueba estructura y disponibilidad, no acceso docente a filas reales.
- RPC de ingreso, lectura de estado, snapshot, decisiones y reporte: las firmas
  utilizadas por SIDE son reconocidas. Las peticiones con identidad vacía
  respondieron HTTP 200 y `CREDENCIALES_INVALIDAS`, sin crear empresas.
- SDK, consultas de catálogo e ingreso con código inexistente desde Chromium:
  sin fallos de solicitudes ni excepciones JavaScript.
- Las funciones privadas de características, reportes, notas e historial existen
  y rechazan correctamente el acceso anónimo con `42501`.
- La prueba GET de `controlar_partida` devolvió HTTP 405 / `25006` porque la
  función usa `SELECT FOR UPDATE` y GET se ejecuta en una transacción de lectura.
  **Es una limitación deliberada del método de prueba**; SIDE usa POST mediante
  `rpc()`, por lo que no se reporta como fallo de la aplicación.
- 41 pruebas automatizadas iniciales: todas aprobadas.
- Cinco suites de PostgreSQL local: ciclo de partidas, observaciones, admisión,
  matriz de admisión e historial docente; todas aprobadas.
- Dos suites de interfaz en Chromium: ciclo de partidas con varios estudiantes
  e historial docente en escritorio y móvil; ambas aprobadas.
- Falta menor al cargar la página: `/favicon.ico` devuelve 404. No afecta la
  comunicación con Supabase.

## Alcance y evidencia

Se verificaron el código local, el arranque de las páginas, las respuestas reales
de Supabase y flujos con PostgreSQL local. No se dispuso de una sesión docente
real ni de una identidad estudiantil registrada para confirmar escrituras
exitosas y sincronización entre dispositivos contra producción. Las pruebas
locales no sustituyen esa comprobación. Tampoco se hizo una sesión completa del
mundo 3D ni se accedió a los registros internos del servidor Supabase.

No se modificó el código de la aplicación ni se aplicaron migraciones al proyecto
remoto. Las peticiones de escritura de diagnóstico se limitaron a identidades
vacías rechazadas por el servidor. Las reproducciones usaron servicios simulados
y almacenamiento aislado.

Evidencia detallada: `tests/output/supabase-audit-2026-09-30/results.json`.
Script reproducible: `reports/supabase_audit_2026_09_30.cjs`.
