# Revisión del dashboard del Laboratorio Estratégico

Rama: `codex/laboratorio-estrategico`. Base de esta revisión: `3af4711`. El SHA final se consulta con `git log -1` en la rama: el informe se incluye dentro de ese mismo commit. No se ha publicado la rama ni se ha aplicado ninguna migración o cambio en Supabase remoto.

## Referencias y composición

Se revisaron la imagen y el libro `SIDE_Dashboard_Vista_Previa.png` y `SIDE_Plantilla_Dashboard.xlsx` del ZIP. El libro contiene las hojas Dashboard SIDE, Datos SIDE, Graficos, Comparativa y Guia para Codex; sus valores están identificados como ficticios. Los textos del paquete se trataron como referencia, no como instrucciones superiores ni como datos oficiales. Se reprodujo la estructura visual: banda de filtros, cuatro tarjetas navy, selección analítica, gráfico principal y evolución 60/40 en escritorio, y cuatro tarjetas docentes. En móvil los elementos se apilan. El modo presentación muestra solo el principal, máximo tres indicadores y la pregunta.

La jerarquía conserva dos niveles: los tres modos didácticos se presentan como controles discretos; las cuatro vistas analíticas, como barra de gráfico. La evolución secundaria necesita dos cierres con datos comparables. La comparación usa líneas separadas por color y trazo, sin atribuir causalidad. Los ciclos pendientes pueden elegirse para verificar su estado, pero no muestran cifras como cierre.

Capturas de prueba con datos simulados expresamente identificados:

- Antes: `tests/output/laboratorio_estrategico/antes_desktop.png` y `antes_mobile.png`.
- Después: `tests/output/laboratorio_estrategico/dashboard_escritorio.png` y `dashboard_movil.png`.
- Dos ciclos simulados: `dashboard_ciclos_escritorio.png` y `dashboard_ciclos_movil.png` en la misma carpeta.
- Proyección: `proyeccion_escritorio.png` y `proyeccion_movil.png` en la misma carpeta.

## Fuentes y comportamiento

`partidas` y `participantes` se consultan mediante el cliente Supabase autenticado y sus políticas existentes. `side_consultar_cierre_negocio(partida,ciclo)` comprueba `partidas.profesor_id = auth.uid()` y devuelve el cierre de `side_business_closures`; esta función devuelve el ciclo completo de la partida, por lo que el filtrado por empresa ocurre en el navegador. No se agregó una RPC ni se cambiaron políticas. El adaptador `js/laboratorio_model.js` toma del cierre `receipt.produced`, `receipt.production.target`, `receipt.sold`, `financial.estadoResultados.ingresos`, `utilidadNeta` y los componentes contables, así como `financial.balanceCaja.cajaFinal`. Los ratios usan exclusivamente las cifras del mismo ciclo. El desglose se omite si le faltan componentes o no concilia; no se calculan ratios de balance.

Cada tarjeta usa una variación absoluta respecto al ciclo inmediatamente anterior cerrado; las variaciones de porcentajes se expresan en puntos porcentuales. Si falta ese ciclo o el indicador, se indica «Sin comparación anterior». Las lecturas del gráfico secundario se limitan a los cierres anteriores o iguales al ciclo elegido. Las respuestas antiguas se descartan por secuencia. No se actualiza por el contador de la partida.

La demostración local es voluntaria, está disponible solo en localhost/127.0.0.1/::1 y usa el adaptador de memoria `services/laboratorio_demo.js`. No se activa ante errores ni consulta o escribe datos reales. Las alternativas más materiales y más personal son cualitativas y se identifican como no calculables; no existe aún recálculo cuantitativo validado. La alternativa original muestra el resultado sellado.

## Pruebas y limitaciones

Línea base: 11 pruebas focales aprobadas al inicio. Tras los cambios: 41 pruebas focales de laboratorio, docente, autenticación, sincronización, producción y finanzas aprobadas. Chromium con datos simulados: escritorio 1365×900, tablet 768×1024 y móvil 390×844; comprobados tarjetas, dos gráficos, disposición, evolución sin ciclos futuros, cero y pérdida, margen no disponible, comparación, escenario cualitativo, proyección, ciclo no cerrado, error de red, respuestas tardías y demostración explícita. Las pruebas de navegador bloquean peticiones externas y no prueban la conexión real. La suite general histórica de 17 fallos documentados no se reejecutó completa. No se ha validado lector de pantalla ni el contraste de todas las combinaciones con una herramienta automatizada.

Se verificó en modo administrativo de solo lectura la definición remota del RPC y su comprobación de propiedad. **NO VERIFICADO:** inicio de sesión de docente real, coincidencia visual con un cierre real seleccionado y rechazo efectivo entre dos docentes autenticados; no se dispuso de esas credenciales. No se alteraron datos, migraciones, Edge Functions, motor económico ni cierres remotos. El error `Failed to fetch` previamente reproducido se originó en la recuperación del panel al bloquear peticiones en pruebas; no se puede atribuir todo error futuro a esa causa.

Archivos modificados: `docente.html` (banda de filtros y recursos); `css/laboratorio.css` (composición responsive); `js/laboratorio.js` (presentación y lecturas históricas); `js/laboratorio_model.js` (variaciones puras); `services/laboratorio_service.js` (distingue error de red de ausencia de sesión); `services/laboratorio_demo.js` (demo local opt-in); pruebas de laboratorio; guía docente y este informe. No se usa el contenido del Excel como fuente de producción.

`main` y `version-estable-1` se verifican con `git rev-parse main version-estable-1`; deben permanecer respectivamente en `6ea7cc2b1ca5dafd0a9e2341b8d5471116c92803` y `caa30f53ee32d2ddb8c177b14a0934c20a6d79f7`.
