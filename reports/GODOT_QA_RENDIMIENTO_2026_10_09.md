# QA independiente y rendimiento del mundo Godot

Fecha: 2026-10-09. Repositorio verificado: `https://github.com/valenlysm29/SIDE1.git`.
Todos los comandos se ejecutaron desde SIDE1. Scripts duraderos en `godot4/tests/`,
logs, JSON y capturas en `tests/output/`; snapshot original local en
`.codex-work/godot-world-baseline/godot4`.

## Diagnóstico gráfico

El mapa original de esta tarea ya agrupaba ventanas por edificio y marcas
viales por tramo en MultiMesh, con un límite espacial por lote. La entrega
conserva esa optimización previa. La tienda también agrupaba geometría por
forma y material. Los adornos nuevos comparten materiales y nuevos lotes;
se reduce la teselación de los NPC y se distribuye la población por barrios.

Los volúmenes principales del barrio permanecen visibles; los detalles
usan rangos de visibilidad. Los habitantes conservan cuerpo y posición a
distancia; el LOD reduce animación, evitación y consultas de ruta con
histéresis 70/82 m. Cuerpos y cabezas tienen 16 segmentos y ocho anillos.
No se afirma que exista LOD geométrico automático de mallas importadas.

No hay OccluderInstance3D ni activación de occlusion culling. Es una posible
prueba futura para calles con edificios, especialmente desde la cámara del
jugador; no se atribuye ninguna mejora a oclusión. Activarlo por sí solo no
construye oclusores. Godot exige representaciones estáticas simplificadas y
añade trabajo de CPU; los lotes MultiMesh no se convierten automáticamente
en oclusores al hacer bake. [Documentación oficial de oclusión](https://docs.godotengine.org/en/stable/tutorials/3d/occlusion_culling.html).

Los lotes globales de farolas y vegetación tienen cajas amplias; aún pueden
dibujar instancias fuera del encuadre cuando parte del lote está visible.
La cámara panorámica es deliberadamente exigente porque muestra mucho barrio.
No se habilitó GI ni se cambió de Compatibility.

## Evidencia funcional

Motor: Godot 4.7.2 estable. Pruebas headless con física a 60 Hz salvo la
primera ejecución de suelo, que también se verificó con reloj normal.

| Prueba | Resultado |
| --- | --- |
| ground_continuity | 7.744 rayos de apoyo de la losa; teclado real sobre WorldPlayer, cruce de calle, entrada/salida, pared y mesa. Altura mínima y máxima 0,00016 m durante la caminata. |
| map_navigation | 43 rutas; barrido de cápsula radio 0,34 m y altura 1,8 m libre, apoyo cada metro; 737 polígonos, 33 obstáculos. |
| world_population | 24 NPC constantes, identidad/visibilidad conservadas, cinco sectores, FSM y aforo. Los 24 avanzaron con LOD reducido. Población inicial también sin Shop. |
| smoke | Malla, ruta, rechazo por aforo y ciclo de visita correctos. |
| npc_flow_smoke | Primer NPC camina, entra y sale; 3.600 frames físicos y aforo respetado. |
| world_flow (nuevo) | 960 pasos físicos observados: cruce real y tres entradas/salidas seguidas. Los mismos 24 IDs permanecen; 24 peatones recorren más de 1 m (mínimo observado en suite final 11,756 m). Presets Bajo/Medio/Alto aplican escala y sombras. |
| npc_physics (nuevo) | Arranque adverso de 24 NPC con pies en y=0; callback RVO sin movimiento; callback pendiente ignorado después de desactivar detalle; cien alternancias LOD; gravedad IDLE asentando desde 0,30 m. Altura mínima 0,00000 m. |

Los presets se aplicaron mediante `_apply_quality`, sin emitir selección ni
guardar ConfigFile. Se comprobó el motor en consola y los diez logs finales
de importación, siete pruebas y dos perfiles no contienen ERROR, SCRIPT ERROR ni WARNING.
La primera preparación de la copia original necesitó importación para
registrar ShopNpc; el perfil válido se ejecutó después y su log está limpio.

La prueba de suelo usa una losa real y la de rutas usa colisiones reales:
no se limita a comprobar estados de la FSM. La prueba nueva de flujo alimenta
InputEventKey al mismo controlador del jugador. Sus únicas recolocaciones
preparan el inicio de la calle y del circuito; las tres visitas son caminadas
continuas y no usan teletransporte entre entrada y salida.

## Perfil antes/después

Dos procesos gráficos secuenciales, sin otro perfil GPU simultáneo:
NVIDIA GeForce RTX 3050 Laptop GPU, OpenGL 3.3, Compatibility, 1280×720,
calidad Alto, cámara `Main/PlayerCamera`, 12 segundos de calentamiento y
12 segundos medidos. VSync se solicita desactivado y max_fps=0; el resultado
observado permanece cercano a 60 FPS, por lo que no permite atribuir un
incremento de FPS a la optimización. Medianas de monitores cada 250 ms y
tiempo real entre frames medido con Time.get_ticks_usec.

El perfil fuerza max_npcs=max_initial_npcs=24 **antes de add_child** tanto
en la copia original como en la final. Todos los muestreos registraron 24.
La población original se concentraba alrededor de la tienda; la final está
distribuida y se mueve por barrios. Se compara la entrega integrada con igual
población y encuadre, no un experimento que aísle una única optimización.

| Métrica | Original con 24 | Final con 24 |
| --- | ---: | ---: |
| Draw calls, mediana | 518 | 427 (−17,57 %) |
| Primitivas, mediana | 979.400 | 472.292 (−51,78 %) |
| Frame mediano | 16,658 ms | 16,667 ms |
| Frame p95 | 16,995 ms | 17,154 ms |
| Frame p99 | 17,284 ms | 17,410 ms |
| Frames medidos | 721 | 720 |
| Proceso, monitor mediano | 15,980 ms | 14,723 ms |
| Física, monitor mediano | 1,450 ms | 2,810 ms |
| Construcción inicial de escena | 252,711 ms | 329,177 ms |
| Memoria estática, mediana | 46.235.897 B | 48.518.661 B |
| Memoria de vídeo, mediana | 16.097.319 B | 18.908.456 B |
| Nodos, mediana | 496 | 548 |
| Nodos huérfanos, mediana | 0 | 0 |

La física y la carga aumentan al añadir jugador, sólidos, navegación y vida
persistente. Los materiales y detalles nuevos elevan memoria. El descenso
de draw calls y primitivas no implica estabilidad en todos los equipos:
esta es una muestra de 12 segundos en una GPU, con trayectorias aleatorias.
El p95 final no mejora; no se promete un framerate estable.

Datos locales verificables:

- `tests/output/godot-profile-baseline-24.json`
- `tests/output/godot-profile-final-24.json`
- `tests/output/godot-qa-profile-baseline-24.log`
- `tests/output/godot-qa-profile-final-24.log`

`godot4/tests/world_profile.gd` reproduce el método. Requiere `--output=`
absoluto y permite `--captures`. La copia original debe importarse antes
de ejecutar scripts que dependan de clases globales.
El perfil anterior al refuerzo físico se conserva como
`tests/output/godot-profile-pre-hardening-24.json`, con log y tres imágenes
del mismo nombre base. La tabla utiliza exclusivamente el perfil final
posterior al refuerzo.

## Revisión visual y lectora

Se inspeccionaron imágenes tomadas del viewport del motor, sin captura de
escritorio: baseline overview y final overview/player/store. El original
recorta blancos intensamente; el final conserva asfalto, césped y fachadas,
carteles legibles, tienda abierta y peatones distribuidos. No se observan
bandas de profundidad de los acabados en las tres imágenes finales.
El acercamiento store muestra al jugador físicamente dentro y la cámara
SpringArm todavía cerca del umbral, que es el comportamiento de seguimiento.

La guía final `docs/GODOT_MUNDO_CONTINUO.md` permite responder sin consultar el
código: la causa era ausencia de sólidos y distribución central, no generación
de NPC por puerta; ambos límites son 24 y requieren puntos únicos suficientes;
las pruebas parten de SIDE1; el LOD preserva identidad/movimiento; el generador
de navegación está limitado al mapa plano y BoxShape3D estáticos. Incluye
las dos pruebas nuevas, el comando gráfico y las cifras con sus limitaciones.

Una repetición del conjunto detectó un NPC bajo el suelo en world_population;
diez repeticiones inmediatas no reprodujeron la caída. El log fallido se
conserva en `tests/output/godot-qa-world_population-integrated.log` y el
diagnóstico del test ahora incluye posición, velocidad, FSM, LOD, contacto,
tick y RID del terreno. El caso inicial no registró esos datos, por lo que
no se atribuye a un defecto concreto del motor.

La revisión sí encontró dos invariantes vulnerables: el callback RVO podía
mover el cuerpo fuera de su único paso físico, y IDLE/INTERACT suspendían
la física y la gravedad. El refuerzo limita move_and_slide a una sola llamada
en _physics_process; el callback únicamente guarda velocidad horizontal y
se descarta después de desactivar RVO. También conserva gravedad en espera,
deja 5 cm de despeje al crear NPC y espera un tick adicional tras sincronizar
navegación. npc_physics comprueba directamente esas invariantes y el apoyo.

Después del refuerzo pasaron las siete pruebas del conjunto, el perfil
gráfico y tres arranques nuevos de world_population junto a tres de
npc_physics. Las seis repeticiones adicionales están en los logs
`godot-qa-{world_population,npc_physics}-hardened-cold-{1,2,3}.log`.
No reapareció la caída; el historial se conserva sin sustituirlo por un
resultado aprobado.
Persisten límites explícitos:
personajes básicos de cápsulas, navegación plana, sin oclusores y medición
de rendimiento de una sola máquina/ejecución. El directorio padre conserva
los mismos elementos que al inicio; no se crearon artefactos fuera de SIDE1.
