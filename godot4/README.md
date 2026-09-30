# SIDE Ciudad de Bolsos — Godot 4

Proyecto Godot 4 independiente del simulador web que permanece en la raíz de
`SIDE1`. Abre `project.godot` con Godot 4.7.2 y ejecuta la escena principal.
La cámara muestra el barrio y la tienda central; los NPC aparecen y realizan
visitas automáticamente.

## Estructura

- `scenes/Main.tscn` y `scripts/mapa.gd`: ciudad, luz, niebla, mobiliario en
  MultiMesh y malla de navegación continua con interior de la tienda.
- `scenes/Shop.tscn` y `scripts/shop_controller.gd`: puerta con Area3D, aforo,
  vitrinas y tres variantes de bolso con materiales PBR originales.
- `scenes/Npc.tscn`, `scenes/NpcSpawner.tscn` y `scripts/npc_*.gd`: FSM,
  navegación, evitación y animaciones idle/walk/interact.
- `CREDITS.md`: procedencia y licencias de los recursos usados.

## Comprobación

Desde esta carpeta:

```text
godot --headless --path . --editor --quit
godot --headless --path . --script res://tests/smoke.gd
```

La prueba comprueba la ruta desde la calle a la tienda, el aforo y la visita
completa de un NPC. La malla se genera al iniciar la escena a partir del mapa;
sus polígonos no se almacenan como recurso binario.
