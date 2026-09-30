# Rediseño de la ciudad de decisiones de SIDE — 30-09-2026

## Entrega por frente

| Frente | Hecho | Pendiente y riesgo |
| --- | --- | --- |
| A — mapa | Distrito transitable de 176 × 176 m, vías principales y secundarias, manzanas, aceras, áreas verdes, fondo instanciado y niebla. Tienda, Almacén y Producción conservan puertas físicas; Oficina, Banco, Proveedores y Buzón de noticias tienen estaciones visibles y accesibles. Cámara, límites y cuadrícula de navegación usan la nueva escala. | Los edificios exteriores nuevos son fachadas y estaciones; no tienen interiores visitables. La escala aumenta el trabajo de sombras en Alta. |
| B — orientación | Siete rótulos proyectados que evitan HUD/minimapa, minimapa a escala con jugador y destino, clic para marcar rumbo, aviso de zona y objetivo de ciclo. Los iconos son los integrados y los textos están en español. | En pantallas pequeñas se ocultan rótulos cercanos entre sí. El minimapa dirige y enfoca, pero no teletransporta. |
| C — decisiones | `deriveWorldDecisionState` calcula en forma pura zonas, stock, entregas, producción, demanda, caja, objetivos, eventos deduplicados por ID y consecuencias. El render consume esa proyección; se actualizan estantes, almacén, máquinas, presencia de clientes, avisos y decoraciones climáticas/comerciales. El cierre guarda un resumen por ciclo. | La posición de cada NPC no representa una transacción individual de Supabase; el libro y las decisiones existentes siguen siendo la fuente de verdad. |
| D — NPC | 16 GLB urbanos Quaternius CC0, 14 440 740 bytes en total, con Idle/Walk/Run del mismo rig y sin desplazamiento de raíz. Roles por zona, selección sin repetir modelos próximos, carga diferida por tier y respaldo procedural. Yuka + three-pathfinding se usan para peatones exteriores en Media/Alta/Auto; Baja conserva rutas AABB. | Variedad de edades y complexiones limitada por las fuentes. Los NPC interiores siguen su máquina de estados y rutas AABB; la navegación opcional no sustituye todas esas rutas. |

## Integración y contratos

El catálogo de 16 GLB excluye los cuatro avatares elegibles. El loader activa 6 plantillas en Baja, 10 en Media/Auto y 16 en Alta; la caché puede conservar modelos ya descargados al bajar de tier. El límite simultáneo de NPC y la frecuencia de animación lejana siguen el perfil gráfico. El mapa conserva instancing, culling, caché, carga diferida y respaldos procedurales. Las decisiones de las cinco categorías, los ciclos y Supabase no se escriben desde la proyección visual.

La orientación usa coordenadas locales del mapa y el render añade el desplazamiento del hub una sola vez. Las estaciones exteriores llaman las acciones de decisión existentes. El buzón de noticias es un objeto físico con collider. La navegación opcional construye una cuadrícula libre de edificios y usa rutas AABB si falla una dependencia o un tramo.

## Curación y licencias

El detalle de los 16 candidatos aprobados, los descartes Mixamo/En3D y la ropa observada está en [npc_curation.md](npc_curation.md). Autor, fuente y licencia de cada modelo figuran en [CREDITS.md](../CREDITS.md). En3D quedó descartado por licencia de avatares no confirmada; Mixamo no se usó por clips y rigs incompatibles. No se incorporaron activos de esas fuentes al manifiesto aprobado. Los 16 GLB no incorporan imágenes de textura (`images: []`), por lo que no hay texturas que comprimir; usan materiales y geometría de bajo peso.

## Rendimiento

| Tier | Plantillas activas | Peatones exteriores simultáneos | SwiftShader aislado, mediana | FPS de GPU real |
| --- | ---: | ---: | ---: | --- |
| Baja | 6 | 2 | 3 FPS | Sin medición defendible |
| Media | 10 | 3 | 1 FPS | Sin medición defendible |
| Alta | 16 | 5 | 1 FPS | Sin medición defendible |
| Auto | 10 | 3 | No muestreado | Sin medición defendible |

El runner headless de Chrome usa SwiftShader (CPU), por lo que sus FPS no predicen los de una GPU modesta. En 1280 × 800, `npc_fps_benchmark.cjs` midió cuatro muestras por tier y verificó que el catálogo activo sea 6/10/16. La prueba de escena exterior pasó con **135 llamadas y 50 824 triángulos en Baja**, **145 y 64 004 en Media**, **145 y 64 392 en Alta**. Una validación visual y un muestreo de FPS en el equipo objetivo siguen siendo necesarios antes de publicar.

## Validación

`node --check` de `app.js`, `simulator3d.js` y los servicios nuevos pasó; `node --test` completó **214/214** casos. La regresión completa de navegador `run_world_regression.cjs` terminó con **16/16 runners aprobados**, incluidos recorrido continuo, interfaz y ciclos, carga diferida de NPC y pruebas de Supabase. También pasaron `outdoor_performance.cjs`, `npc_navmesh_browser.cjs` y `npc_fps_benchmark.cjs`. Los commits son locales y no se hizo push.
