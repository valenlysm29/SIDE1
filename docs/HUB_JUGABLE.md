# Plaza SIDE jugable

El turno comienza en una plaza hecha con geometría Three.js. Las calles, edificios,
vehículos estacionados, mobiliario y peatones se renderizan en tiempo real.
No se utiliza la imagen conceptual como fondo del mundo.

## Cómo jugar

Después de enviar las decisiones e iniciar el turno:

- Haz clic en el mundo para controlar la mirada con el mouse; Escape libera el cursor.
- WASD o flechas: caminar. Shift: correr. Espacio: saltar. V: primera/tercera persona.
- Sigue la flecha y el marcador hasta tienda, producción y almacén. E permite entrar.
- El botón PLAZA vuelve a la entrada del edificio visitado.
- Acércate al kiosco central y pulsa E para elegir Miraflores, Los Olivos o San Juan
  de Lurigancho. La pantalla física y el directorio muestran la misma selección.
- Dentro de la tienda continúa la gestión existente: caja, clientes, stock y misiones.

La exploración de las tres zonas se guarda como progreso de la empresa. Los
distritos comparten el interior y la contabilidad existentes: el selector identifica
el destino y permite visitarlo, pero no crea inventarios independientes ni compras.
Los vehículos exteriores son decoración con colisiones; no tienen conducción.

## Implementación y validación

`services/hub_world.js` construye el exterior, agrupa geometría repetida y expone
colisiones, entradas y rutas. `simulator3d.js` controla el personaje, la cámara,
el directorio y la transición a los interiores. `services/npc_motion.js` mantiene
los pies apoyados durante los giros, resuelve rodillas y tobillos y anima brazos,
respiración y cambios de dirección. `hub-world.css` adapta HUD y directorio a móvil.

Desde la raíz del proyecto, con las dependencias de `tests` instaladas:

```powershell
node tests/playable_hub.cjs
node --test tests/simulator3d_config.test.js tests/npc_navigation.test.js tests/npc_assets.test.js tests/static_delivery.test.js tests/responsive_delivery.test.js
```

La prueba de la plaza inicia su propio servidor. Verifica geometría WebGL, controles,
cámara, peatones, colisiones, las tres entradas, progreso, directorio, reconstrucción
y disposición móvil. Usa pasos de simulación deterministas para no depender de la
velocidad del renderizador por software; no es una medición de FPS del equipo.

Con el proyecto servido por HTTP, estas pruebas adicionales aceptan `SIDE_TEST_URL`
(por defecto `http://127.0.0.1:8772/`):

```powershell
node tests/npc_locomotion.cjs
node tests/world_cycle_restart.cjs
```

Las capturas y resultados quedan en `tests/output/`, fuera del control de versiones.
