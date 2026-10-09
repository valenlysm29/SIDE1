# Auditoría del mundo Godot — 9 de octubre de 2026

## Alcance y protección del trabajo

Proyecto: `godot4/project.godot`, independiente del simulador web de SIDE1.
El usuario confirmó intervenir Godot, añadir un jugador básico y mantener el
estilo urbano con **24 NPC**. Rama: `codex/godot-world-continuity`.
El remoto verificado es `https://github.com/valenlysm29/SIDE1.git`.
Los cambios locales anteriores se conservan. Se guardó una copia de la versión
Git inicial de Godot en `.codex-work/godot-world-baseline/`, dentro de SIDE1.

## Diagnóstico previo a las modificaciones

### Suelo y jugador

`scripts/mapa.gd` genera la ciudad en código. Su función `_box` tiene
`collision=false` por defecto; terreno, calles, paseos, aceras y plazas no
activan ese argumento. Son superficies visibles sin `StaticBody3D` ni
`CollisionShape3D`. La tienda genera su geometría como MultiMesh y tampoco
crea colisiones de suelo, paredes o exhibidores. No se encontró una máscara
incorrecta ni un shape desescalado: el suelo físico no existe.

Las caras superiores visuales varían entre -0.05 y 0.017 m (6.7 cm), y el piso
de la tienda está a -0.005 m. Esto añade incoherencia visual, aunque no explica
por sí solo una caída física. `Main.tscn` solo tiene una cámara fija; no hay
jugador ni controlador al que atribuir una caída reproducida. El único
`CharacterBody3D` inicial es el NPC. Se distinguirán las pruebas físicas del
nuevo jugador de la descripción original del fallo.

### NPC

`Main.tscn` instancia `NpcSpawner` siempre. `_ready` crea cuatro NPC y añade
uno cada cuatro segundos hasta catorce. No existe un trigger de generación
al entrar en la tienda. Todos los puntos iniciales están cerca del centro y
todos los NPC llaman a `start_visit`, por lo que convergen hacia la tienda.
Después de salir vagan junto al origen y no repiten visitas. Falta cobertura
del barrio, gestión persistente y reducción de trabajo por distancia.

La FSM existente incluye IDLE, PATROL, INTERACT, WALK_TO_SHOP, ENTER_SHOP,
BROWSE, EXIT_SHOP y WANDER. Se conservarán la FSM, NavigationAgent3D,
DoorArea, animaciones y control de aforo.

### Navegación

La malla inicial usa una cuadrícula manual de cuatro metros y exclusiones
aproximadas para edificios y paredes. Ignora jardineras y muebles. Asignar
`agent_radius` a una malla construida manualmente no recorta automáticamente
los polígonos. Las tres rutas del test anterior pasan, pero no verifican
segmentos contra obstáculos físicos.

## Criterios de aceptación

1. Suelo físico continuo a y=0 en todo el barrio y la tienda; acabados visuales
   sin escalones físicos. Cruces, bordes y umbral probados con física real.
2. Veinticuatro NPC presentes desde el inicio, distribuidos por el mapa,
   manteniendo identidad y visibilidad al entrar y salir de la tienda.
3. Navegación conectada que respete paredes, exhibidores y jardineras con
   margen para la cápsula; visitas completas sin superar el aforo.
4. Jugador básico para recorrer el barrio; cámara panorámica conservada.
5. Pulido visual dentro del renderizador Compatibility y medición de coste
   gráfico, sin atribuir cambios de FPS a una sola causa sin evidencia.

## Método y skills

Los subagentes de suelo, NPC y navegación auditaron antes de editar. Los
frentes visual y QA se incorporan al liberarse los slots disponibles. Se
aplica `anthropics/skills/doc-coauthoring` a la entrega: recopilar evidencia,
redactar instrucciones y revisar comprensión con otro agente. Las skills
instaladas están en `../.agents/skills`, consultadas solo en lectura; ninguna
es específica de Godot. `webapp-testing` no valida física de este proyecto
nativo y no se usa para afirmar resultados de Godot.

Referencias primarias: [CharacterBody3D](https://docs.godotengine.org/en/stable/classes/class_characterbody3d.html),
[NavigationMesh](https://docs.godotengine.org/en/stable/classes/class_navigationmesh.html),
[MultiMesh](https://docs.godotengine.org/en/stable/tutorials/performance/using_multimesh.html)
y [renderizadores](https://docs.godotengine.org/en/stable/tutorials/rendering/renderers.html).

## Estado de verificación

Implementación y pruebas integradas concluidas. Suelo: 7.744 rayos de apoyo
y recorrido con el controlador real; altura constante de 0,00016 m.
Navegación: 43 rutas con cápsula libre y apoyo por tramo, 737 polígonos y
33 obstáculos. Población: 24 NPC iniciales y persistentes, identidades,
FSM, aforo y detalle por distancia verificados. Flujo integrado: tres
entradas/salidas y 960 pasos comprobados con los mismos 24 NPC presentes.
Importación final del editor sin errores.

Perfil de ambas versiones con 24 NPC: draw calls 518 → 427 y primitivos
979.400 → 472.292; tiempo mediano de frame 16,658 → 16,667 ms. No se
demuestra ganancia de FPS. Física 1,450 → 2,810 ms y construcción inicial
252,7 → 329,2 ms; la versión nueva incluye jugador y suelo físico.

Una repetición previa al refuerzo físico detectó una caída de un NPC sin
traza suficiente para establecer su mecanismo. Se conservó la evidencia,
se amplió el diagnóstico y se centralizó el movimiento en un único paso de
física por tick, con gravedad durante IDLE e INTERACT, limpieza de velocidades
RVO antiguas y espera adicional para registrar sólidos. La regresión nueva
verifica 24 arranques a y=0, 100 cambios de detalle y apoyo durante IDLE.
Las siete pruebas integradas finales pasan. El informe independiente en
`reports/GODOT_QA_RENDIMIENTO_2026_10_09.md` detalla el hallazgo y el cierre.
Guía, configuración, archivos y límites: `docs/GODOT_MUNDO_CONTINUO.md`.
