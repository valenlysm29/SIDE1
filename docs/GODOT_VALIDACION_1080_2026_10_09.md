# Godot: mundo sólido y continuo, 1080p y 24 NPC

Entrega del 9 de octubre de 2026 en rama `codex/godot-world-1080p`.
Proyecto: `godot4/project.godot`. Validado con Godot 4.7.2 oficial,
Compatibility/OpenGL 3.3, i5-12500H, RTX 3050 Laptop y 31,6 GB de RAM.
La referencia acordada con el usuario es 1920 × 1080 y 24 NPC.
La interpolación 3D requiere Godot 4.4 o posterior.

## Diagnóstico y alcance

La exploración inicial fue paralela y sin modificaciones. La losa de suelo,
el mapa generado completo, la tienda, la FSM y NPCManager **ya existían**.
No había un hueco estructural de suelo encontrado en el checkout inicial.
El diagnóstico con causas y evidencia está en
[GODOT_DIAGNOSTICO_1080_2026_10_09.md](../reports/GODOT_DIAGNOSTICO_1080_2026_10_09.md).
Se conservó un respaldo de scripts, escenas y configuración antes de editar
en `.codex-work/godot-audit-20261009/`, dentro de SIDE1.

Los defectos actuales eran máscaras que excluían otros personajes, props y
valla sin cuerpos físicos, agentes quietos/lejanos ausentes de avoidance,
reposiciones bloqueadas por un primer punto ocupado, ausencia de recuperación
de atasco, salto repetido al mantener espacio y cortes visuales por distancia.

## Física del mundo y navegación

La losa única de 176 × 176 m sigue siendo el apoyo de calle, acera y tienda.
Se añadieron ocho cajas para asientos y respaldos, 36 para postes, doce para
troncos y cuatro para los lados del perímetro. Las farolas se alinearon
fuera de los edificios. La valla visible mide 2,4 m de alto y contiene al
jugador durante carrera y salto; se eliminó su clamp de posición.
Los sólidos usan tamaños de Shape3D, sin escalar sus nodos físicos.
La escena final tiene 95 cuerpos estáticos; el dintel queda por encima de
la altura navegable y por eso no aumenta el contador de obstáculos del navmesh.

NavigationRegion3D se construye después de todos los sólidos: 93 obstáculos,
2.947 polígonos y calles, plazas y tienda conectadas. Los 45 recorridos de
regresión usan barridos de cápsula y comprueban apoyo cada metro. No hacen
falta NavigationLink3D entre superficies contiguas del mismo plano.

El generador sigue limitado a **mapa plano y StaticBody3D con BoxShape3D**.
Para edificios con plantas superpuestas, rampas navegables o colliders
distintos, ampliar el generador o hacer bake de NavigationMesh antes de
incorporar NPCs a esas áreas. La prueba de rampas de esta entrega valida el
controlador del jugador en un escenario aislado, no navegación en pendientes.

Se fija GodotPhysics3D, gravedad 9,8 m/s², 60 ticks/s, máximo ocho pasos por
frame e interpolación física. Se conserva el backend de partida:
DEFAULT equivale a GodotPhysics3D en esta configuración. No se atribuye a
Jolt una mejora sin compararlo.
[Ajustes de física oficiales](https://docs.godotengine.org/en/stable/classes/class_projectsettings.html#class-projectsettings-property-physics-3d-physics-engine).

## Jugador

Se conserva CharacterBody3D y los controles existentes. Velocidades de
caminar/correr: 4,5/7 m/s; aceleración 24 y frenado 30 m/s², configurables.
Espacio salta una vez por pulsación. La cámara acumula el ratón y aplica
la rotación en el tick físico para acompañar al cuerpo interpolado.

`step_height=0.3` permite bordillos mediante barridos de cápsula al subir,
avanzar y bajar. Comprueba techo, apoyo estático y pendiente máxima de 45°;
no permite usar NPCs como escalones. `floor_snap_length=0.3`,
`safe_margin=0.01` y `up_direction=UP`. La geometría visual apoya en y=0.
Un agente RVO comunica el movimiento del jugador a los peatones y conserva
la autoridad de los controles del usuario.

## NPCs persistentes y configuración

Se mejora el NPCManager existente, conservando su ruta `NpcSpawner` para
compatibilidad. La FSM mantiene IDLE, PATROL, INTERACT y las fases de visita.
Todos los NPC existen al arrancar, antes de visitar la tienda, repartidos
entre calles, plazas y el centro. No se borran ni se ocultan por distancia.

Configura el nodo **Main/NpcSpawner**:

| Propiedad | Valor actual | Función |
| --- | ---: | --- |
| max_npcs | 24 | Límite total de población |
| max_initial_npcs | 24 | Población creada antes del primer frame |
| spawn_positions | 24 puntos | Coordenadas locales únicas, accesibles y con suelo |
| spawn_interval | 4 s | Intervalo para intentar reponer una plaza libre |
| detail_distance | 70 m | Recupera animación y consultas frecuentes al acercarse |
| detail_hysteresis | 12 m | Reduce detalle al superar 82 m; evita alternancia constante |
| observer_path | ../Player | Referencia para distancias |

Para cambiar población, proporciona suficientes puntos iniciales libres;
el manager no duplica personajes en puntos ocupados. Los puntos iniciales
deben estar sobre el mapa plano y fuera de sólidos: se crean antes de que
Main termine de construir la navegación. Las **reposiciones** sí comprueban
proyección al navmesh, suelo y cápsula libre; exploran otros puntos si uno
está ocupado. Sólo ocurren fuera de cámara y a más de 82 m del observador.
Si ningún punto cumple, esperan otro intervalo en lugar de aparecer a la vista.

El detalle lejano suspende AnimationTree y consulta el siguiente punto de
ruta como máximo cada 0,20 s, salvo cercanía al punto. La física, gravedad,
FSM y avoidance continúan. IDLE e INTERACT envían velocidad cero a RVO y
siguen contando como obstáculos. No se desactiva toda la simulación por
distancia porque permitiría perder apoyo y contactos.

Cada 1,5 s se comprueba progreso. Ante un bloqueo se vuelve a consultar
la ruta; tras bloqueos repetidos se intenta un desvío local conectado y
libre, conservando el destino original y la FSM. No se teletransporta al NPC.
La animación mueve la cabeza y no eleva todo el cuerpo sobre el suelo.
La puerta sigue usando Area3D y el aforo de la tienda se conserva.

La tienda incorpora seis puntos de visita y reserva uno por NPC. Libera
la reserva al terminar una parada o salir; cuando todos están ocupados,
el NPC espera y reintenta sin consumir su parada. Esto evita destinos
compartidos que resultaban físicamente inalcanzables al activar contactos.
El dintel de la puerta también tiene colisión, incluida durante el salto.

## Capas y máscaras

Las capas de física tienen nombres en Project Settings. Los números de
esta tabla son bits de máscara, no índices de capa.

| Objeto | Capa | Máscara | Detecta/bloquea |
| --- | ---: | ---: | --- |
| Mundo estático | 1 | 6 | NPC y jugador |
| NPC | 2 | 7 | Mundo, NPC y jugador |
| Jugador | 4 | 3 | Mundo y NPC |
| DoorArea | 8 | 6 | Detecta NPC y jugador, sin bloquear movimiento |
| SpringArm de cámara | — | 1 | Sólo mundo |

RVO usa capas independientes: NPC capa 1/máscara 3; jugador capa 2/máscara 1,
prioridad 1. RVO propone velocidades; las cápsulas y move_and_slide mantienen
la colisión física. El callback sólo guarda velocidad y cada NPC realiza
un único move_and_slide por tick.
[NavigationAgent3D oficial](https://docs.godotengine.org/en/stable/classes/class_navigationagent3d.html).

## Render y visuales

El barrio completo permanece generado y visible; se eliminaron cortes de
distancia de ventanas, vegetación, farolas, bancos, jardineras, señalización
y marcas viales. Ambas cámaras conservan far=280 m. El motor sigue
descartando geometría fuera del encuadre. No se añadió streaming.

La tienda agrupa cajas por **material**, usando dimensiones por instancia,
en lugar de fragmentarlas por tamaño. Conserva materiales, proporciones y
colliders. Alto añade MSAA 2× para suavizar bordes; los otros presets
conservan su menor resolución y política de sombras. Se mantiene el sol,
el ambiente y las texturas procedurales existentes. Los cuerpos estilizados
apoyan visualmente en el suelo. Las bases de los bolsos coinciden con las
caras de mesa y estantes; sus texturas PBR añaden mipmaps para reducir
parpadeo por minificación. No se incorporaron assets externos.

No se activó GI ni occlusion culling. Los lotes globales de vegetación y
farolas siguen teniendo límites amplios: dividirlos o añadir oclusores es
una optimización futura que debe medirse. Quitar cortes puede aumentar
primitivas; la comparación integrada debe mostrar ese coste.

## Medición nueva antes/después

El benchmark usa GPU real, 1920 × 1080, calidad Alto y 24 NPC en ambos casos.
Reconstruye la escena y fija RNG interno a 421 + índice de NPC por escenario;
calienta 10 s y mide otros 12 s. Muestras de monitores cada 250 ms,
frame real mediante Time.get_ticks_usec. VSync solicitado y observado en
DISABLED y Engine.max_fps=0. La comparación principal se ejecutó consecutivamente
contra el respaldo original, con el mismo script de medición actual, y registra
el foco de la ventana en cada muestra. La planificación/RVO y el reloj todavía
pueden variar entre ejecuciones.

La versión posterior incluye física completa, geometría continua y MSAA 2×;
la comparación es de la entrega integrada con la calidad Alto elegida,
no un experimento que aísle cada optimización.

| Vista | FPS antes → después | Draw calls antes → después | Frame mediano antes → después | Frame p95 antes → después |
| --- | --- | --- | --- | --- |
| Panorama | 119,77 → 119,88 | 434 → 392 | 8,91 → 8,81 ms | 10,30 → 10,75 ms |
| Jugador | 119,92 → 119,89 | 445 → 389 | 8,05 → 8,37 ms | 10,24 → 10,80 ms |
| Tienda | 104,94 → 119,67 | 403 → 320 | 9,50 → 8,80 ms | 14,17 → 11,00 ms |
| Cruce calle | 117,99 → 119,24 | 445 → 390 | 9,32 → 8,59 ms | 10,54 → 10,88 ms |

Los draw calls bajan entre **9,68 % y 20,60 %**. Los FPS aumentan en la tienda
en esta pareja de ejecuciones; no hay aumento uniforme. El p95 empeora
ligeramente en las otras tres vistas. Los p99 finales son 11,17, 11,13,
11,43 y 11,30 ms, por debajo del presupuesto de 16,67 ms para 60 FPS durante
estas muestras. Esto demuestra margen en estas condiciones, sin certificar
ausencia de tirones en una sesión prolongada. La concentración cerca de
120 FPS tampoco permite inferir la capacidad máxima del hardware.

El coste físico observado sube: panorama 2,120 → 2,669 ms; jugador
2,109 → 2,831 ms; tienda 2,150 → 3,075 ms; calle 2,578 → 2,895 ms.
Las primitivas suben ligeramente, por ejemplo 697.640 → 700.988 en tienda,
al mantener geometría visible y añadir sólidos/detalles. Se documenta el
coste de contactos y avoidance persistentes junto con el ahorro de lotes.

Limitaciones de comparabilidad: el panorama original tuvo foco en 16/48
muestras, frente a 48/48 en la entrega. Las otras vistas originales tuvieron
48/48; las finales, 48/48, 48/48 y 47/47. El benchmark solicita primer plano,
pero ese dato impide describir el foco como idéntico durante toda la pareja.
Además, Alto original no tenía MSAA y Alto final usa 2×. Los NPC pueden tomar
trayectorias distintas aun con semillas iguales.

Las primeras mediciones originales rondaban 60 FPS; al repetir el respaldo
sin cambios también superó 100 FPS. Por eso **no se atribuye un salto de
60 a 120 FPS a esta intervención**. Se conservan esas ejecuciones como
evidencia de variabilidad (`godot-1080-before`, `after` y `before-recheck`),
pero la tabla usa exclusivamente `godot-1080-controlled-before.json` y
`godot-1080-controlled-after.json` de `tests/output/`.
El resumen versionable está en
[GODOT_RENDIMIENTO_1080_2026_10_09.json](../reports/GODOT_RENDIMIENTO_1080_2026_10_09.json).
Los originales incluyen memoria y monitores; TIME_PROCESS no es tiempo GPU aislado.

También se ejecutó un perfil separado por CLI, con `--profiling --gpu-profile
--quit-after 600`, a 1080p. `godot-1080-profiler.log` contiene tiempos GPU
totales de 5,688, 10,585, 22,156, 10,316 y 11,466 ms; incluye arranque sin
calentamiento. Sus pasadas de sombra están entre 0,509 y 1,323 ms, opacos
entre 0,982 y 2,306 ms y transparentes entre 0,272 y 1,238 ms. No se mezclan
con la tabla antes/después. Se usaron el profiler por CLI y Performance
Monitors; no se realizó una sesión del panel Profiler del editor.

Capturas finales revisadas: [panorama](../tests/output/godot-1080-controlled-after-overview.png),
[jugador](../tests/output/godot-1080-controlled-after-player.png) y
[tienda](../tests/output/godot-1080-controlled-after-store.png).
Se conserva el aspecto estilizado existente; las sombras aún muestran
dientes en primeros planos y los personajes siguen siendo cápsulas.

## Repetir las pruebas

Desde SIDE1, con PowerShell:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File tests/run_godot_qa.ps1
```

El ejecutor importa recursos y ejecuta trece pruebas, exige marcador de éxito,
código de salida cero y logs sin errores ni warnings; limita cada proceso
a 9.000 frames. Admite `-GodotExe 'C:\ruta\Godot_console.exe'`.
Todos los resultados se guardan bajo SIDE1/tests/output.

**Resultado final: 13/13 PASS**, incluidos importación limpia y verificación
de marcadores/códigos/logs. Ejecutor verificado con PowerShell 7. Evidencia:
`tests/output/godot-1080-final-summary.json` y trece logs del mismo prefijo.
Se observaron 7.744 muestras de suelo, 45 rutas, 818 comprobaciones de
props/perímetro/dintel, 760 del jugador, 24 identidades persistentes y
separaciones mínimas de 0,7067 m entre personajes y 0,7523 m en la puerta.

La caminata integrada mantuvo y entre 0,00025 y 0,00925 m; NPC en estrés
tuvo mínimo y=0. El salto libre alcanzó 1,3260 m y el dintel lo limitó a
1,1249 m. El bordillo de 0,20 m dejó apoyo a 0,2073 m. Son resultados de
estas fixtures, no una promesa de ausencia de defectos en cualquier mapa.

### Fallos conservados durante QA

El primer world_flow terminaba saliendo a 4,5 m/s, z=7,8105 m y contacto
sólo con suelo. El reloj fijo de dos segundos no contemplaba aceleración
y retrasos de tráfico. Ahora exige alcanzar las mismas metas geométricas
(entrada z≤3, salida z≥8), con plazo de cuatro segundos y comprobaciones
de mundo cada tick; nunca coloca al jugador entre entrada y salida.

Una ejecución de npc_flow_smoke no completó salida en 3.600 ticks y se
conserva en `godot-1080-qa-npc_flow_smoke.log`. No tenía diagnóstico suficiente
para demostrar su causa exacta. Las semillas 20261009 y 1–8 no reprodujeron
esa falta de salida antes del cambio de reservas. Independientemente,
se confirmó y corrigió el defecto lógico de seis visitantes con sólo
cuatro destinos sin exclusión. La regresión nueva exige seis destinos
únicos, seis salidas, liberación de reservas/aforo y cruce bidireccional.
La visita final conserva su plazo original de 3.600 ticks.

Otro assert de la semilla 7 confundía desplazamiento neto con inmovilidad:
el NPC había recorrido 90,5144 m y vuelto a 0,3827 m del origen, tras entrar
y salir. Se sustituyó por distancia acumulada >3 m, sin alterar los checks
de visita ni aforo. La repetición final de esa semilla recorrió 90,7277 m
y pasó ambos estados. Los fallos y repeticiones mantienen logs separados.

| Pruebas | Cobertura |
| --- | --- |
| ground_continuity | 7.744 rayos, cruce real, tienda, pared y mesa |
| map_navigation | 45 rutas, cápsula libre y apoyo por metro |
| world_population | 24 identidades, cinco sectores, aforo y LOD |
| npc_physics | 100 alternancias de detalle, gravedad IDLE y pies visuales |
| world_flow | Calle y tres entradas/salidas con teclado real; metas geométricas y plazo de 4 s por cruce |
| smoke / npc_flow_smoke | Aforo y visita completa |
| world_solids | Props, escalas, carrera y salto contra los cuatro límites, salto bajo dintel |
| render_continuity | Geometría sin cortes, capas, cámaras y NPC visibles |
| player_physics | Velocidades, salto sostenido, bordillo, rampas y techo |
| npc_contacts | NPC quieto, jugador, cruce frontal y bloqueo dinámico |
| npc_spawning | Slot ocupado, alternativa y rechazo de puntos inválidos |
| npc_shop_traffic | Seis reservas únicas y visitas/salidas; cruce simultáneo por puerta en sentidos opuestos |

Perfil gráfico, sin ejecutar otros tests o juegos simultáneamente:

```powershell
$godotExe = Join-Path (Get-Location) '.codex-work/godot/Godot_v4.7.2-stable_win64_console.exe'
$resultDir = Join-Path (Get-Location) 'tests/output'
& $godotExe --path godot4 --resolution 1920x1080 --disable-vsync --script res://tests/world_benchmark.gd --log-file (Join-Path $resultDir 'my-benchmark.log') -- --output="$(Join-Path $resultDir 'my-benchmark.json')" --captures
```

Para comprobar a mano, ejecuta Main: WASD/flechas caminan, Mayús corre,
espacio salta, botón derecho gira cámara y Tab alterna el panorama. Cruza
calles en ambos sentidos, visita las cuatro plazas, rodea bancos/árboles,
corre y salta contra el perímetro; entra y sal de la tienda mientras pasan
clientes y comprueba INTERACT y el aforo. Prueba Bajo, Medio y Alto y vigila
la consola. Las pruebas automatizadas accionan estos controladores, pero
no sustituyen una sesión humana prolongada de juego.

## Archivos de esta intervención y pendientes

Configuración y escenas: `project.godot`, `Player.tscn`, `Npc.tscn`, `Shop.tscn`.
Scripts de godot4: `mapa.gd`, `world_navigation.gd`, `world_ambience.gd`,
`player_controller.gd`, `npc_agent.gd`, `npc_manager.gd`, `shop_controller.gd`
y `quality_settings.gd`. Pruebas existentes ajustadas:
`ground_continuity.gd`, `world_flow.gd`, `npc_physics.gd`, `npc_flow_smoke.gd`.
Nuevas pruebas: `world_solids.gd`, `render_continuity.gd`, `player_physics.gd`,
`npc_contacts.gd`, `npc_spawning.gd`, `npc_shop_traffic.gd`, `world_benchmark.gd` y sus UID.
Ejecutor: `tests/run_godot_qa.ps1`. Diagnóstico e informe: este documento
y `reports/GODOT_DIAGNOSTICO_1080_2026_10_09.md`, resumen medido
`reports/GODOT_RENDIMIENTO_1080_2026_10_09.json`; guías actualizadas
`godot4/README.md` y `docs/GODOT_MUNDO_CONTINUO.md`.

INTERACT corresponde a la FSM de visita de NPC, con detección por Area3D;
no se implementó ni se verificó un sistema de diálogo del jugador con peatones.

Pendientes: sesión prolongada y otros equipos; navegación de pendientes si
se incorporan; evaluar oclusores y lotes por sector; una dirección artística
y modelos animados más elaborados. El objetivo de una mejora clara de FPS
en todo el mapa **no queda demostrado**: hay ahorro consistente de draw calls
y margen para 60 FPS en las muestras, pero no un aumento uniforme de FPS.
Queda pendiente una sesión humana prolongada para certificar estabilidad
percibida y revisar sombras/cámara en movimiento. Los cambios ajenos ya
presentes se preservaron.
