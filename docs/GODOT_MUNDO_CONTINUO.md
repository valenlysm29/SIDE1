# Mundo continuo de Godot

**Documento histórico.** La validación vigente a 1080p y 24 NPC, con
contactos entre personajes, props sólidos y geometría sin cortes de distancia,
está en [GODOT_VALIDACION_1080_2026_10_09.md](GODOT_VALIDACION_1080_2026_10_09.md).
Las cifras a 720p y el comportamiento LOD descritos aquí corresponden
a la intervención anterior.

Proyecto: `godot4/project.godot`. Rama de trabajo:
`codex/godot-world-continuity`. Esta entrega corresponde al proyecto Godot,
independiente del simulador web de SIDE1. Se conserva el estilo urbano y se
añade el jugador básico solicitado, con **24 NPC persistentes**.

## Causa del suelo ausente

El mapa se construye en `scripts/mapa.gd`, no a partir de piezas de suelo
almacenadas en las escenas. Terreno, calle, aceras y plazas llamaban a `_box`
con `collision=false`, su valor por defecto. Por tanto había geometría visible
pero ningún suelo físico. La tienda también dibujaba el piso y los muros
mediante MultiMesh sin colisiones. Las superficies visuales diferían hasta
6,7 cm de altura. No se encontró un problema de capas ni de shapes escalados.

Ahora una única losa de 176 × 176 m con `BoxShape3D` en la capa 1 cubre todo el
barrio y la tienda, con la cara superior en **y=0**. Las calles, aceras y
plazas son acabados sin escalones físicos; las separaciones visuales de
1–6 mm evitan parpadeo por profundidad. Paredes, jambas, vitrinas, mesa y
mostrador tienen colisiones propias. No se duplica el piso en el umbral.

La versión inicial no tenía jugador controlable: solo una cámara fija.
Se añadió `WorldPlayer` sin sustituir un controlador previo. Utiliza
`floor_snap_length=0.3`, `floor_max_angle=45°`, `safe_margin=0.01`,
`up_direction=Vector3.UP`, gravedad y `move_and_slide`. Su cápsula está
en capa 4 y consulta los sólidos de capa 1. Los NPC usan capa 2 y máscara 1.

## Población persistente

Los NPC iniciales ya se creaban en `NpcSpawner._ready`; la puerta no los
generaba. El problema era que nacían cerca del centro, todos iban primero
a la tienda y solo hacían una visita. Ahora `NPCManager` mantiene el nodo
`Main/NpcSpawner`, de modo que las rutas de escena existentes siguen válidas.
`npc_spawner.gd` es un adaptador del gestor.

Los 24 NPC existen antes del primer frame visible, repartidos entre calles,
veredas, cuatro plazas, barrios y tienda. La FSM espera a que el servidor de
navegación sincronice el mapa antes de caminar. Los residentes patrullan en
torno a su barrio; los cuatro NPC centrales pueden repetir visitas. Dos
clientes comienzan dentro de la tienda y el aforo sigue siendo seis.

Se conservan IDLE, PATROL, INTERACT y las fases WALK_TO_SHOP, ENTER_SHOP,
BROWSE, EXIT_SHOP y WANDER, además de NavigationAgent3D, DoorArea,
WaitTimer y las animaciones existentes. Los destinos se proyectan sobre
la navegación y se comprueba que estén conectados.

El cuerpo se mueve exactamente una vez por tick desde `_physics_process`.
El callback de evitación RVO solo almacena la velocidad horizontal para el
siguiente paso; los cambios de FSM o detalle descartan velocidades antiguas.
IDLE e INTERACT conservan gravedad y apoyo físico. Al arrancar, cada cápsula
se coloca 5 cm sobre su punto y espera un tick de registro de los sólidos
antes de comenzar la FSM.

El gestor revisa distancias cada 0,5 s. Al superar 82 m reduce animaciones,
evitación RVO y frecuencia de consulta de ruta; al volver a menos de 70 m
recupera el detalle. La franja intermedia evita cambios repetidos de modo.
Los NPC lejanos siguen visibles, caminando y colisionando con el escenario.
No se eliminan por distancia ni al entrar o salir de la tienda.

### Configuración en Inspector

Selecciona `Main/NpcSpawner`; las propiedades exportadas están heredadas
del script `NPCManager`.

| Propiedad | Predeterminado | Uso |
| --- | --- | --- |
| `max_npcs` | 24 | Límite de población. |
| `max_initial_npcs` | 24 | Población creada inmediatamente al arrancar. |
| `spawn_positions` | 24 puntos | Coordenadas locales al gestor; usar puntos únicos, libres y sobre la navegación. |
| `shop_path` | `../Shop` | Tienda que proporciona destinos y aforo. La población también existe sin tienda. |
| `observer_path` | `../Player` | Referencia para el detalle por distancia; si falta, busca el grupo `player` y después la cámara. |
| `detail_distance` | 70 m | Distancia para recuperar todo el detalle. |
| `detail_hysteresis` | 12 m | Margen adicional antes de reducir detalle. |
| `spawn_interval` | 4 s | Intervalo para intentar cubrir plazas vacantes. |

Para mantener población completa desde el inicio, deja ambos límites
iguales y proporciona al menos ese número de puntos únicos. Si subes de
24, añade puntos suficientes; repetir puntos ocupados no crea personas
superpuestas. La reposición comprueba distancia al observador y que el
punto esté fuera del encuadre; puede esperar si no hay un lugar discreto.
El flujo normal no elimina NPC, por lo que no necesita reposiciones.

`ShopNpc.shop_visit_chance` permite ajustar visitas periódicas por NPC;
el gestor asigna 0,35 a los cuatro centrales y 0 al resto. Para cambiar
esa distribución, modifica la asignación en `NPCManager._spawn_one`.

## Navegación

`WorldNavigation.build` genera una sola NavigationRegion3D conectada a
partir de las cajas de colisión reales de edificios, tienda y jardineras.
Aplica explícitamente 0,45 m de margen para un agente de 1,8 m de altura;
el radio de evitación del NPC es 0,38 m y su cápsula física tiene 0,34 m.
Los polígonos se cortan en bordes de obstáculos, evitando una rejilla fina
innecesaria sobre todo el mapa. El resultado actual tiene 737 polígonos
y reconoce 33 obstáculos.

El generador está diseñado para este **mapa plano con BoxShape3D estáticos**.
Si añades obstáculos, créalos antes de `_make_navigation_mesh` y activa su
colisión en capa 1. Para cambios posteriores al arranque, vuelve a construir
la navegación después de añadirlos. Pendientes, escaleras, plataformas
superpuestas o colliders de otros tipos requieren ampliar el generador o
utilizar el bake de NavigationMesh; no se cubren automáticamente.

## Controles y prueba manual

Abre `godot4/project.godot` con el motor Godot 4 disponible y ejecuta Main.

1. Camina con WASD o flechas; Mayús corre y espacio salta. Arrastra el botón
   derecho para girar la cámara; Tab alterna el panorama del barrio.
2. Desde el inicio frente a la tienda, cruza una calle y sus bordes de
   pavimento en ambas direcciones. Repite cerca de las plazas y en extremos
   del barrio. El apoyo debe permanecer continuo, sin hundimiento.
3. Vuelve al acceso sur de la tienda, entra por la puerta central y sal.
   Repite mientras entran clientes: las paredes y la mesa deben bloquearte,
   y el umbral debe permitir el paso sin escalón.
4. Visita las cuatro plazas y calles exteriores antes y después de entrar
   en la tienda. Los peatones ya están presentes y siguen patrullando.
5. Acércate y aléjate de un peatón: debe seguir existiendo y moviéndose.
   Comprueba la consola del editor y los presets Bajo, Medio y Alto.

## Pruebas automatizadas

Ejecuta todos los comandos desde **SIDE1**, sin cambiar al directorio padre.
Los logs y resultados se guardan dentro de `tests/output/`. En PowerShell:

```powershell
$godotExe = Join-Path (Get-Location) '.codex-work/godot/Godot_v4.7.2-stable_win64_console.exe'
$resultsDir = Join-Path (Get-Location) 'tests/output'
& $godotExe --headless --path godot4 --editor --quit --log-file (Join-Path $resultsDir 'godot-import.log')
foreach ($testName in @('ground_continuity', 'map_navigation', 'world_population', 'npc_physics', 'world_flow', 'smoke', 'npc_flow_smoke')) {
    & $godotExe --headless --fixed-fps 60 --path godot4 --script "res://tests/$testName.gd" --log-file (Join-Path $resultsDir "$testName.log")
    if ($LASTEXITCODE -ne 0) { throw "Falló $testName; revisar su log" }
}
```

Si utilizas otro ejecutable instalado, cambia solo `$godotExe`.

| Prueba | Evidencia obtenida |
| --- | --- |
| `ground_continuity.gd` | 7.744 rayos de apoyo; teclado sobre el controlador real; cruce, entrada/salida y bloqueo de pared/mesa; altura observada constante de 0,00016 m. |
| `map_navigation.gd` | 43 rutas conectadas; cápsula libre a lo largo de cada tramo y suelo cada metro. |
| `world_population.gd` | 24 NPC iniciales y constantes; cinco sectores, identidad y visibilidad conservadas; FSM, aforo y detalle con histéresis; población también sin tienda. |
| `npc_physics.gd` | 24 arranques con pies en y=0, callbacks sin movimiento directo, 100 cambios de detalle y gravedad durante IDLE. |
| `world_flow.gd` | 960 pasos comprobados: cruce de calle, tres entradas/salidas con teclado real, 24 identidades y peatones en movimiento; presets Bajo/Medio/Alto. |
| `smoke.gd` | Malla, ruta, rechazo de exceso de aforo y fases de visita. |
| `npc_flow_smoke.gd` | Visita completa durante 3.600 frames de física. |

Una repetición anterior al refuerzo físico detectó un NPC bajo el suelo.
El registro inicial no tenía posición ni velocidad, y las siguientes diez
repeticiones no lo reprodujeron; no permite atribuir una causa concreta al
motor. Se conservó ese log, se amplió el diagnóstico y se reforzaron los
invariantes de movimiento descritos arriba, sin esconder caídas mediante
teletransporte o relajar el límite de las pruebas. La regresión nueva
comprueba apoyo durante cambios rápidos de detalle y al permanecer quieto.
La suite final de siete pruebas y tres arranques adicionales de población
y de estrés pasaron sin errores ni advertencias; el fallo no reapareció.

## Aspecto y rendimiento

Se mantiene Compatibility, MultiMesh para geometría repetida y presets de
calidad. Cuerpos y cabezas de NPC/jugador usan 16 segmentos y ocho anillos
para limitar el coste de los 24 habitantes. `WorldAmbience` recupera colores
antes sobreexpuestos mediante sol cálido y luz ambiental moderada. Añade
texturas originales de 64 px con mipmaps, señalización de tienda y plazas,
remates de fachadas, soportes de bancos y vallado visible del perímetro.
Los detalles repetidos se agrupan en siete MultiMesh, sin añadir luces
exteriores ni cambiar las colisiones. El ajuste de cámaras a far=280 m
y near=0,15/0,3 m elimina el parpadeo de las capas del pavimento a distancia.

Para repetir el perfil gráfico, ejecuta con ventana y GPU (sin `--headless`):

```powershell
& $godotExe --path godot4 --resolution 1280x720 --disable-vsync --script res://tests/world_profile.gd --log-file (Join-Path $resultsDir 'world-profile.log') -- --output="$resultsDir/world-profile.json" --captures
```

La prueba aplica calidad Alto, cámara panorámica y 24 NPC, calienta durante
12 s y mide otros 12 s. Guarda JSON y capturas de panorama, jugador y tienda.
Medición integrada en RTX 3050 Laptop, OpenGL 3.3, Godot 4.7.2, 1280 × 720,
Alto, cámara panorámica, 24 NPC en ambas versiones:

| Medida | Original con 24 NPC | Entrega con 24 NPC |
| --- | ---: | ---: |
| Draw calls, mediana | 518 | 427 (−17,6 %) |
| Primitivos, mediana | 979.400 | 472.292 (−51,8 %) |
| Tiempo de frame, mediana | 16,658 ms | 16,667 ms |
| Tiempo de frame, percentil 95 | 16,995 ms | 17,154 ms |
| Física, mediana | 1,450 ms | 2,810 ms |
| Construcción inicial de escena | 252,7 ms | 329,2 ms |

No se demuestra una mejora de FPS: ambas ejecuciones rondaron 60 FPS.
La física cuesta más porque ahora existen colisiones de suelo/tienda,
jugador y población activa. El arranque aumenta unos 76 ms; no hay carga
de barrio o generación de población al cruzar la puerta. La comparación
es del resultado completo: los NPC originales están concentrados y los
nuevos distribuidos, por lo que no aísla el efecto de cada optimización.

Las evidencias están en `tests/output/godot-profile-baseline-24.json`,
`godot-profile-final-24.json` y sus capturas. El perfil final incluye el
refuerzo físico de NPC; la medición previa se conserva como
`godot-profile-final-pre-hardening-24.json`. Para una decisión de producción,
repetir sesiones de varios minutos en el hardware objetivo, recorriendo
todos los barrios. El mapa utiliza batching, descarte por cámara y rangos
de visibilidad; no se añadió un sistema de oclusión sin medir su beneficio.

No se habilita SDFGI: solo funciona en Forward+, y cambiar el renderizador
alteraría el objetivo de compatibilidad y rendimiento. Véanse las fuentes
primarias de [renderizadores de Godot](https://docs.godotengine.org/en/stable/tutorials/rendering/renderers.html),
[SDFGI](https://docs.godotengine.org/en/stable/tutorials/3d/global_illumination/using_sdfgi.html)
y [MultiMesh](https://docs.godotengine.org/en/stable/tutorials/performance/using_multimesh.html).

## Archivos de la entrega

Modificados: `godot4/README.md`, `godot4/scenes/Main.tscn`, `godot4/scenes/Npc.tscn`,
`godot4/scripts/mapa.gd`, `godot4/scripts/shop_controller.gd`,
`godot4/scripts/npc_agent.gd`, `godot4/scripts/npc_spawner.gd`, `godot4/scripts/quality_settings.gd`
(comentario de calidad),
`godot4/tests/map_navigation.gd` y `godot4/tests/smoke.gd`.

Nuevos: `godot4/scenes/Player.tscn`, `godot4/scripts/player_controller.gd`,
`godot4/scripts/npc_manager.gd`, `godot4/scripts/world_navigation.gd`,
`godot4/scripts/world_ambience.gd`, `godot4/tests/ground_continuity.gd`,
`godot4/tests/world_population.gd`, `godot4/tests/world_flow.gd`,
`godot4/tests/npc_physics.gd`, `godot4/tests/world_profile.gd`, esta guía y los
UID de scripts generados por Godot. El informe de diagnóstico está en
`reports/GODOT_AUDITORIA_MUNDO_2026_10_09.md`; las evidencias locales están en
`tests/output/` y la copia inicial ignorada por Git en `.codex-work/`.
El informe de QA y rendimiento está en
`reports/GODOT_QA_RENDIMIENTO_2026_10_09.md`.
