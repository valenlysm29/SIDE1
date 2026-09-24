# Corrección de integración, Ciclo 1 y eventos

## Instalación

El proyecto ya está modificado. Para usar el flujo nuevo entre dispositivos:

1. En el proyecto Supabase asociado a `config.js`, ejecutar **todo** `docs/supabase_game_lifecycle.sql` en SQL Editor. Requiere las tablas y RPC de `docs/supabase_migration.sql` ya instaladas. Si se utiliza `supabase_teacher_integration.sql`, ejecutarlo antes de esta nueva migración, nunca después.
2. Publicar los archivos modificados juntos o abrir `INICIAR_JUEGO.bat` para la ejecución local.
3. Crear una partida nueva. En manual, **Guardar configuración** abre el ingreso; **Iniciar partida** comienza las decisiones. En automático, guardar o iniciar programa el plazo de integración.

La migración es transaccional y repetible. Se probó ejecutándola dos veces sobre PostgreSQL local. No se ejecutó sobre la base Supabase remota: esta sesión no tenía conexión administrativa a ella. El frontend detecta si falta la RPC nueva antes de crear una partida, y muestra el archivo que debe instalarse.

## Arquitectura y causa

Frontend HTML/CSS/JavaScript sin React/Vue. `docente.js` controla el panel del profesor y `app.js` la interfaz del estudiante. `side_rules.js` contiene reglas compartidas. Los servicios en `services/` llaman a Supabase mediante su SDK y RPC PostgreSQL. `servidor_local.py` solo sirve archivos; no es el backend multijugador.

Supabase/PostgreSQL almacena `partidas.configuracion`, `empresas`, `participantes`, decisiones y reportes. El estado se consulta con polling; existe además Realtime para el listado de participantes del profesor. `localStorage` conserva cachés y la demostración local. El nuevo polling de estado reutiliza los servicios y opera cada tres segundos. El contador se dibuja cada segundo.

El error provenía de combinar `integrationMinutes === 60` y `round === 1` para bloquear decisiones: el Ciclo 1 completo se trataba como una hora de integración, y la operación comenzaba recién en el Ciclo 2. Parte del avance manual dependía de intervalos del docente. La interfaz del alumno solo habilitaba un botón y no navegaba automáticamente. Existía además código para un modo de integración cuyo selector ya no estaba en el HTML.

## Comportamiento nuevo

- **Manual:** guardar abre una partida en integración. Los estudiantes entran y ven «Esperando que el profesor inicie la partida». `Iniciar partida` / `Iniciar Ciclo 1` llama al servidor. La fase pasa a `decisions`, con `round: 1`; los estudiantes avanzan automáticamente al recibir la actualización. El inicio repetido conserva el mismo instante y ciclo.
- **Automático:** campo de 1–60 minutos, predeterminado 5. El servidor calcula `integrationStartTime` y `gameStartAt`; el segundo nunca depende de la hora del estudiante ni de un `setTimeout`. El horario opcional representa el comienzo de la integración y se envía con zona horaria. Todos los ciclos configurados son operativos; la integración no consume un ciclo.
- **Cuenta regresiva:** `MM:SS`, basada en hora del servidor y reloj monotónico del navegador. Llegar a cero provoca una consulta inmediata; el cliente habilita decisiones cuando el servidor confirma la fase. Si la conexión tarda, muestra «Sincronizando el inicio…» y sigue reintentando. El polling normal limita la propagación habitual a aproximadamente tres segundos, más la latencia de red.
- **Ingreso tardío/recarga:** se consulta la misma fecha persistida. No se crea un plazo nuevo. Un estudiante puede entrar en el ciclo operativo actual. La sesión de estudiante se conserva en `sessionStorage`; salir explícitamente la elimina.
- **Profesor desconectado:** consultar el estado, ingresar o guardar decisiones resuelve la transición en PostgreSQL. El comienzo efectivo sigue siendo `gameStartAt`, incluso si todos los navegadores estuvieron cerrados. No requiere cron: la actualización de la fila se materializa en la siguiente petición y recupera el ciclo que corresponda al tiempo transcurrido.
- **Temporizadores:** existe un polling y un intervalo de representación por sesión de estudiante; se limpian al salir/abandonar la página y se restauran sin duplicarlos. El contador de integración reutiliza ese intervalo de representación.
- **Eventos:** «Seleccionar todos» incluye los 92 eventos, incluso con filtros activos; cambia a «Deseleccionar todos». Se mantiene la selección individual en ambos modos. La selección aleatoria de la interfaz toma candidatos habilitados y visibles. El sorteo de eventos durante la partida también usa exclusivamente habilitados. Una lista vacía produce cero eventos.

## Persistencia y protección

Las partidas nuevas usan `configuracion.lifecycleVersion: 2`, `phase`, `integrationDurationMinutes`, `integrationStartTime`, `gameStartAt`, `gameStartedAt` y `runtime.phase`. Las fases son `integration`, `decisions`, `results` y `finished`; el ciclo es un dato independiente. El estado SQL conserva `esperando`, `activa` y `finalizada` para compatibilidad.

`side_sync_game` es el único resolvedor automático. Usa `SELECT ... FOR UPDATE`. `controlar_partida` comprueba al profesor propietario, reutiliza ese resolvedor e impide repetir el inicio. El avance manual compara además el ciclo esperado, por lo que una petición repetida no salta dos ciclos. Pausa, reanudación y cierre manual también se guardan en el servidor. Guardar la configuración de eventos no puede sobrescribir el reloj ni la fase con una caché del navegador.

Se añade `side_event_catalog` con ID, ámbito y probabilidad del catálogo existente. El servidor sortea eventos grupales una sola vez por ciclo y devuelve eventos individuales estables por empresa/ciclo. Los triggers rechazan eventos individuales deshabilitados y filtran eventos deshabilitados en los reportes. Las decisiones se rechazan durante integración, después del cierre y para ciclos incorrectos. El servicio JavaScript ahora propaga también los errores de negocio devueltos dentro del JSON de la RPC.

Las partidas antiguas sin versión 2 conservan su calendario original, incluida la antigua hora del Ciclo 1. No se renumeran decisiones ni se reinician partidas en curso. Para utilizar integración previa y decisiones en Ciclo 1, crear una partida nueva.

## Archivos cambiados en esta corrección

| Archivo | Cambio |
| --- | --- |
| `app.js` | Sincronización, contador con hora del servidor, navegación automática, reingreso, sesión y eventos del servidor. |
| `docente.js` | Preparación e inicio, acciones y reloj persistidos, recepción de estado, selección total/individual y aleatoria. |
| `side_rules.js` | Separación de fase/ciclo para versión 2, calendario operativo y soporte de demostración local; mantiene reglas antiguas. |
| `services/partida_service.js` | RPC de control y verificación de instalación de la migración. |
| `services/decisiones_service.js` | Propaga rechazos de negocio del servidor. |
| `docente.html` | Campo de minutos, textos del flujo y versiones de recursos. |
| `index.html` | Versiones de recursos modificados. |
| `styles.css` | Contador visible con la tipografía y colores del lobby. |
| `docs/supabase_game_lifecycle.sql` | Migración, funciones, catálogo y validaciones de base de datos. |
| `tests/game_lifecycle_db.cjs`, `tests/lifecycle_db_fixture.cjs` | Pruebas ejecutables con PostgreSQL local PGlite. |
| `tests/game_lifecycle_ui.cjs` | Pruebas de navegador conectadas a las RPC reales en PostgreSQL local. |
| `tests/teacher_lifecycle_ui.cjs` | Adapta las expectativas del inicio manual y mantiene la comprobación de compatibilidad antigua. |
| `tests/package.json` | Dependencias reproducibles de las nuevas pruebas. |
| `docs/CORRECCION_INICIO_PARTIDA.md`, `docs/README.md` | Entrega, instalación y resultados. |

Los demás cambios que ya estaban en el directorio de trabajo se conservaron; no forman parte de esta corrección.

## Validación

Se probaron los nueve escenarios solicitados: manual, automático con dos minutos, llegada con un minuto restante, ingreso después del comienzo, recarga real, varios estudiantes, seleccionar todos, excluir individualmente y ningún evento.

Se usaron fechas persistidas controladas para acelerar las esperas; también se observó una cuenta regresiva llegar a cero y navegar automáticamente. Se verificaron el cierre del navegador docente, reloj del estudiante adelantado cinco horas, doble inicio, repetición de avance, límites de minutos, autorización de RPC, pausa/reanudación/cierre y limpieza de intervalos al salir. No hubo errores JavaScript en las pruebas nuevas del navegador. Se revisaron capturas de escritorio y móvil.

La suite general `node --test tests/*.test.js` dio **76 aprobadas y 6 fallos preexistentes**. Los seis son de `cycle_productivity.test.js`, que llama a funciones ausentes (`cycleProductivity`, `singleStore` y registros de producción). Se reprodujeron en una copia reconstruida del código anterior a la corrección. No se alteró la lógica productiva para resolverlos.

Las pruebas del servidor HTTP local pasan. La prueba de interfaz anterior de ciclo, podio y cinco tamaños de pantalla también pasa con las nuevas expectativas manuales. No se validaron credenciales, políticas particulares ni disponibilidad de la instancia Supabase de producción, ni se ejecutó una partida completa del mundo 3D.

Para repetir las pruebas (Node.js, Python y Chrome instalados):

```powershell
npm install --prefix tests
npm --prefix tests run lifecycle:db
npm --prefix tests run lifecycle:ui
node --test tests/*.test.js
python -m unittest discover -s tests -p local_server_test.py
```

Si Chrome no está en la ruta habitual de Windows, establecer `CHROMIUM_PATH` con la ruta de su ejecutable. Se puede establecer `PYTHON_BIN` para otro intérprete. Las pruebas usan una base aislada; no modifican Supabase remoto.

## Límites adicionales existentes

La demostración local usa almacenamiento del navegador y no sincroniza equipos distintos; el multijugador requiere Supabase y la migración. Las RPC antiguas de estudiantes identifican empresas por ID/nombre comercial y no usan una identidad autenticada individual; esta corrección conserva ese modelo y no equivale a una auditoría de seguridad integral. Las políticas y los cálculos financieros existentes requieren revisión aparte si se necesita impedir manipulación deliberada por estudiantes.
