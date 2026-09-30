# Rediseño de la ciudad de decisiones de SIDE — 30-09-2026

## Entrega por frente

| Frente | Hecho | Pendiente y riesgo |
| --- | --- | --- |
| A — mapa | Distrito transitable de 176 × 176 m, vías principales y secundarias, manzanas, aceras, áreas verdes, fondo instanciado y niebla. Tienda, Almacén y Producción conservan puertas físicas; Oficina, Banco, Proveedores y Buzón de noticias tienen estaciones visibles y accesibles. Cámara, límites y cuadrícula de navegación usan la nueva escala. | Oficina, Banco y Proveedores ahora son visitables; se conservan sus parcelas y fachadas, con apertura física de puertas. La escala aumenta el trabajo de sombras en Alta. |
| B — orientación | Siete rótulos proyectados que evitan HUD/minimapa, minimapa a escala con jugador y destino, clic para marcar rumbo, aviso de zona y objetivo de ciclo. Los iconos son los integrados y los textos están en español. | En pantallas pequeñas se ocultan rótulos cercanos entre sí. El minimapa dirige y enfoca, pero no teletransporta. |
| C — decisiones | `deriveWorldDecisionState` calcula en forma pura zonas, stock, entregas, producción, demanda, caja, objetivos, eventos deduplicados por ID y consecuencias. El render consume esa proyección; se actualizan estantes, almacén, máquinas, presencia de clientes, avisos y decoraciones climáticas/comerciales. El cierre guarda un resumen por ciclo. | La posición de cada NPC no representa una transacción individual de Supabase; el libro y las decisiones existentes siguen siendo la fuente de verdad. |
| D — NPC | 16 GLB urbanos Quaternius CC0, 14 440 740 bytes en total, con Idle/Walk/Run del mismo rig y sin desplazamiento de raíz. Roles por zona, selección sin repetir modelos próximos, carga diferida por tier y respaldo procedural. Yuka + three-pathfinding se usan para peatones exteriores en Media/Alta/Auto; Baja conserva rutas AABB. | Variedad de edades y complexiones limitada por las fuentes. Las rutas interiores usan navmesh por sala y Yuka en Media/Alta/Auto, con AABB de respaldo; Baja conserva AABB. El courier entre edificios conserva su ruta protegida por AABB. |

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


## Ampliación: interiores propios de decisiones — 30-09-2026

Trabajo en paralelo A/B/C para las salas, D para navegación y selección de NPC,
e integración de puertas, estado, decisiones y regresiones. Se parte del HEAD
`085807d`, que ya incluye cuatro commits de orientación posteriores al informe
original; se conservan esos cambios y los archivos locales ajenos a esta tarea.

- **Oficina:** dos escritorios/pantallas, archivo, reunión, pizarra de caja,
  deuda, utilidad, ciclo, producción y pedidos; terminal que abre la categoría B.
- **Banco:** ventanilla de préstamos E, cajero, asesoría, espera y fila marcada.
- **Proveedores:** mostrador F, catálogo, muestras y personal de atención;
  panel de unidades pendientes del pedido real.

Se reutiliza el mundo continuo: entrada y salida caminando sin teletransporte,
`zoneAt`, límites originales y cámara con restricción de colisiones y altura.
Oficina entra por `(19, 69.5)` hacia +Z; Banco por `(69.5, 19)` hacia +X;
Proveedores por `(-69, -19)` hacia −X (X local, offset 150 en el render).
Las tres fachadas sólidas anteriores se ahuecan conservando parcela, altura,
techo y paleta; solo se separan paredes y paneles alrededor de la puerta.
No se rediseñan calles, rótulos exteriores ni categorías/algoritmos de decisiones.
Las antiguas estaciones exteriores B/E/F se trasladan a sus salas.

El render lee `businessVisualSnapshot()` y `SIDE_GAME_BRIDGE.creditState()`;
la deuda proviene del mismo `creditOutstanding()` de la aplicación y la utilidad
del mismo `financialReport()` que el HUD. Pedidos, producción y caja no se
copian a un libro ni inventario independiente. Si falta un dato se muestra
«Sin datos». Las muestras son decorado, no unidades disponibles.

Las salas detalladas se construyen una sola vez al acercarse a menos de 24 m,
y sus colliders se registran entonces en el grafo común antes de la llegada
normal a la puerta. En el spawn inicial las tres salas tienen cero hijos y no
se cargan GLB adicionales; los builders procedurales son módulos pequeños.
Baja no construye ni importa las dependencias de navmesh interior. No se añadió
trabajo de carga de modelos al camino crítico de entrada en Baja. Esto es un
contrato de carga/recursos, no una promesa de milisegundos idénticos en red real.
Media/Alta/Auto construyen una cuadrícula de 0,5 m por sala a demanda y usan
three-pathfinding + Yuka; el planificador y avance AABB protegen el movimiento
cuando falla una dependencia o un tramo. Los clientes de caja también usan el
navegador interior. La fila espera en puntos libres y la separación evita
atravesar mobiliario y actores; la ambientación no genera préstamos ni ventas.

El personal nuevo solo se crea a partir de los 16 CC0 aprobados, por rol;
si una plantilla aún no está disponible, se reintenta sin introducir otro
avatar. La selección estricta excluye modelos de actores próximos y los
reemplazos no excluyen su propia plantilla anterior. Se normaliza la altura
con Box3 y el manifiesto; las visitas reutilizan actores y geometría. Props
procedurales instanciados, sin activos externos nuevos (CREDITS actualizado).

### Presupuesto gráfico verificado

Escena real a 1366 × 900, cámara de primera persona inmediatamente dentro de
cada puerta y render congelado. Cada celda es **draw calls / triángulos**.

| Tier | Oficina | Banco | Proveedores |
| --- | ---: | ---: | ---: |
| Baja | 54 / 15 534 | 56 / 17 198 | 66 / 16 756 |
| Media | 55 / 21 432 | 59 / 28 298 | 70 / 28 324 |
| Alta | 54 / 26 116 | 59 / 28 298 | 70 / 28 324 |
| Auto | 55 / 24 166 | 55 / 23 660 | 70 / 28 324 |

Son cifras de una vista concreta, no el máximo de todas las posiciones. La
selección/animación de NPC puede variar entre ejecuciones. El runner impone
un límite conservador de 300 llamadas y 200 000 triángulos por vista probada.
El exterior conserva sus llamadas: Baja **135 / 50 920**, Media **145 / 64 100**,
Alta **145 / 64 488**, dentro de los presupuestos existentes 150/60 000,
160/75 000 y 160/75 000. El cambio de fachadas suma 96 triángulos frente a la
medición anterior, sin añadir draw calls en esa vista exterior.

Chrome headless usa **SwiftShader (CPU)**: estas mediciones cuentan geometría
y llamadas del renderer y **no representan FPS de una GPU real**. Se revisaron
las tres capturas; la escala del personal y la pizarra de tres líneas quedaron
corregidas. Datos y capturas locales reproducibles en
`tests/output/decision-interiors-performance.json` y
`tests/output/decision-interiors-{office,bank,suppliers}.png`.

### Riesgos pendientes

Validar FPS y tiempos de entrada en el equipo/GPU y red objetivo. El navmesh
grueso puede recurrir a AABB en pasos estrechos; la carga fallida de un NPC
puede dejar temporalmente un puesto sin personal. Las cifras interiores no
cubren todas las cámaras ni grandes multitudes. Los cambios y la ambientación
son locales; no hubo push ni publicación.


### Validación de esta ampliación

- `node --check`: aplicación, simulador y módulos modificados aprobados.
- **229/229 tests Node**, incluidos los 214 originales, pruebas posteriores de
  orientación móvil y 8 casos nuevos de interiores, navmesh y selección estricta.
- **16/16 runners de navegador aprobados**. Se actualizaron las expectativas
  de tres a seis salas y de estaciones exteriores a terminales interiores. El
  runner `playable_hub.cjs` se repitió tras actualizar su QA para llamar
  `updateBusinessZone()` antes de buscar un terminal; el batch y el resultado
  corregido se conservan explícitamente en el JSON de validación.
- Runner nuevo **12/12 sala × tier**: entrada/salida, puertas libres, muebles
  registrados en collider común, categorías B/E/F, navmesh por tier, visitas
  sin actores extra, modelos CC0 sin IDs duplicados a menos de 24 m, roles y
  alturas medidas con Box3 dentro de ±0,1 m del manifiesto. Tres capturas revisadas.
- `outdoor_performance.cjs` aprobado sin ampliar sus presupuestos.

Resumen auditable y cifras: [decision_interiors_validation_2026-09-30.json](decision_interiors_validation_2026-09-30.json).
Commits por frente e integración desde `d9b8ad5`; todos locales, sin push.
Los cambios ajenos de modelos y archivos de entrada se conservaron fuera de
los commits de esta tarea. Los runners actualizan sus salidas locales habituales.
No se crearon archivos de esta tarea fuera de `SIDE1`.
