# Validacion de SIDE v2026.09.07.2

## Resultado

- **57 comprobaciones de interfaz del estudiante** completadas en Chromium.
- **16 comprobaciones de regresion del docente** completadas en Chromium.
- **9 pruebas unitarias de reglas** aprobadas con Node.js.
- **2 pruebas del servidor local** aprobadas con Python.
- Sintaxis JavaScript correcta en los 9 archivos principales.
- 42 referencias locales de las paginas de entrada resueltas.

## Que se comprobo

El recorrido usa los botones reales de perfil, formulario del estudiante,
tutorial y entrada a decisiones. Para el boton de la sala se reviso su rectangulo
completo y cinco puntos de interaccion, no solo la existencia del elemento en el
DOM. Se comprobaron nueve ventanas: 1792x862, 1366x768, 1280x720, 1024x600,
768x600, 390x844, 375x667, 320x568 y 844x390. El pie mantiene su posicion al
desplazar los resultados, y no hay desbordamiento horizontal en esos casos.

Para cada distrito se comprobaron la aparicion del campo dentro de su tarjeta,
su visibilidad sin superposicion de las barras, los botones - / + y la escritura
directa sin desmarcar el canal. Se verificaron cantidades independientes, costos,
numero de vendedores, guardar sin doble cargo, restaurar un borrador en una
pagina reconstruida y bloqueo al enviar. Tambien se verifico la seleccion movil.

Se volvio a probar el calendario automatico del docente, la duracion exacta de
los ciclos y los iconos. Las pruebas unitarias cubren compatibilidad con partidas
anteriores y compromisos de tiendas. El servidor se probo mediante solicitudes
HTTP locales desde Python, incluidas las referencias versionadas, cabeceras de
no cache y el rechazo de un puerto ocupado.

## Alcance y limitaciones

Las pruebas de navegador cargan en memoria los HTML, CSS, JavaScript e imagenes
locales de la entrega y usan un sustituto compatible de Web Storage. El entorno
bloquea la navegacion de Chromium a servidores locales, por lo que estas pruebas
no se presentan como pruebas del despliegue HTTP en un navegador real del usuario.
Las capturas son reales de Chromium durante las pruebas, con datos de prueba y
la tipografia de respaldo disponible: la fuente externa de Google no se cargo.

No se probaron Supabase en produccion, cuentas remotas, una partida 3D completa,
Safari/Firefox ni la ejecucion del archivo .bat en Windows. No se modificaron las
credenciales originales de Supabase ni su esquema SQL. El codigo del servidor
local si fue probado con Python en este entorno.

## Reproducir

```sh
node --test tests/side_rules.test.js
python tests/local_server_test.py
python tests/ui_final_checks.py
```

Las dos pruebas visuales requieren Python, Playwright y Chromium instalados.
Para la regresion docente, ejecutar `tests/browser_checks.py` con la variable de
entorno `SIDE_TEST_GROUP=teacher`. La variable `CHROMIUM_PATH` permite indicar
la ubicacion del ejecutable y `SIDE_QA_OUTPUT` la carpeta de resultados.

Resultados: `tests/RESULTADOS_FINAL_V2.json`, con huellas SHA-256 de las fuentes.
Capturas: `tests/capturas_final_v2/`.
Los informes anteriores que siguen en el proyecto son historicos.
