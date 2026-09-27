# Entrada al mundo 3D — optimización

27 de septiembre de 2026. Cambios dentro de SIDE1.

## Cambios

- La precarga crítica comparte una promesa entre lobby y entrada. Carga Three.js, avatar, personajes urbanos y el atlas de iluminación; no crea una partida ni escribe inventario o caja. Un fallo del motor libera la promesa y permite reintentar.
- Los empleados interiores se precargan desde el lobby cuando hay acceso, o 1,5 segundos después del primer fotograma renderizado. Caminar, conducir y cruzar puertas no esperan esos modelos. Si se entra antes, dos empleados temporales se sustituyen en su posición cuando llega el modelo, sin reconstruir escena, rutas ni estado empresarial.
- El modelo casual de respaldo de 20,5 MB sólo se solicita cuando falla algún personaje urbano. Los modelos originales de cajero y vendedora conservan su calidad. Recast ya no se descarga en el inicio normal; sigue disponible para compatibilidad histórica.
- La iluminación de `RoomEnvironment` se genera una vez con `tools/bake_startup_environment.cjs`. El atlas HDR CubeUV de 128 píxeles por cara ocupa 1,57 MB y evita calcular PMREM en cada entrada. Mantiene materiales PBR y la misma fuente de iluminación; su resolución de reflejos es menor que los 256 píxeles anteriores. El archivo se valida antes de crear la textura; si falta, sigue funcionando la iluminación directa.
- Los materiales del exterior se compilan con `renderer.compileAsync` mientras permanece visible la pantalla de carga. El progreso distingue recursos, ciudad, materiales y shaders. Los interiores lejanos se desactivan antes de esa compilación.
- La revisión de NPCs detectó que elegir aleatoriamente el centro del acceso podía ocupar los dos carriles disponibles. El spawn usa primero los carriles separados y mantiene la comprobación de distancia a jugador y clientes.

## Medición antes/después

Chromium, WebGL mediante SwiftShader, 1280 × 800, servidor local, contextos nuevos y ejecución secuencial. Una muestra por escenario; no representan un promedio ni garantizan tiempos en hardware o redes diferentes. La medición con precarga prepara los recursos críticos antes de pulsar entrada y no incluye ese tiempo previo en el primer fotograma.

| Medida | Antes | Después |
| --- | ---: | ---: |
| Bytes recibidos hasta la primera imagen jugable, sin precarga | 77,11 MB | 28,71 MB |
| Preparación, sin precarga | 8,08 s | 4,66 s |
| Primera imagen jugable, sin precarga | 13,88 s | 8,72 s |
| Primera imagen jugable, con precarga | 11,83 s | 6,08 s |
| Precarga crítica previa | 0,96 s | 0,42 s |

Reducción observada: 62,8% de bytes críticos, 37,1% hasta la primera imagen sin precarga y 48,6% con precarga. Los empleados añaden sus descargas posteriormente; los 28,71 MB no son el tamaño total de todos los recursos del juego.

Evidencia local en `tests/output/loading/before-entry-optimization.json` y `after-entry-optimization.json`, generada por `tests/world_loading.cjs`. Los resultados y capturas de esta tarea permanecen dentro de `tests/output/`.

## Validación

- 144 pruebas unitarias: carga concurrente compartida, reintento tras fallo, carga diferida, atlas HDR, movimiento, colisiones, vehículos y finanzas.
- `world_entry_assets.cjs`: se retienen deliberadamente las descargas de empleados; el mundo renderiza, el jugador se mueve y entra a la tienda. Liberarlas cambia los modelos en su posición, sin duplicar actores, escena ni ledger y sin descargar Recast o el casual innecesario.
- `world_loading.cjs`: entrada fría y precargada, sin mutación financiera durante la precarga, sin errores JavaScript y controles operativos.
- `continuous_world.cjs`: las diez pruebas funcionales del mundo continuo, incluyendo inventario, vehículo, pedido, producción y ciclo completo.
- Las 16 suites de regresión pasan: `playable_hub`, `continuous_world`, `gameplay_hud`, `world_business_ui`, `world_cycle_restart`, `world_startup`, `world_loading`, `world_entry_assets`, `supplied_npcs`, `mona_npc`, `npc_locomotion`, `game_lifecycle_db`, `game_observations_db`, `game_lifecycle_ui`, `decisions_cycle_ui` y `teacher_lifecycle_ui`. Los logs individuales y las capturas están en `tests/output/continuous/`.

API consultada: [WebGLRenderer.compileAsync](https://threejs.org/docs/pages/WebGLRenderer.html) y [PMREMGenerator](https://threejs.org/docs/pages/PMREMGenerator.html), comprobadas contra Three.js r180 incluido en el proyecto. No se añaden dependencias externas ni assets de terceros.
