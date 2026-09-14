# Mejora de realismo 3D — modelos GLB locales

Esta versión reemplaza varios objetos procedurales del simulador por modelos GLB originales, optimizados y almacenados dentro del propio proyecto.

## Modelos incluidos

- `assets/models3d/npc_male.glb`
- `assets/models3d/npc_female.glb`
- `assets/models3d/npc_staff.glb`
- `assets/models3d/bag_esencial.glb`
- `assets/models3d/bag_urbano.glb`
- `assets/models3d/bag_premium.glb`
- `assets/models3d/checkout.glb`
- `assets/models3d/shelf.glb`
- `assets/models3d/sofa.glb`

Los modelos fueron creados específicamente para SIDE y no se copiaron los modelos de los proyectos de referencia.

## Cambios visuales y técnicos

- NPC masculino, femenino y personal de tienda con superficies más suaves y mejor silueta.
- Colores de piel, camisa, pantalón, cabello y corbata se personalizan al clonar el modelo.
- Animaciones de caminar e idle con `THREE.AnimationMixer`.
- Brazos, antebrazos, piernas, cabeza y manos se animan durante el desplazamiento.
- El bolso comprado se coloca en la mano derecha del NPC y acompaña la animación.
- Tres diseños de bolso diferenciados: Esencial, Urbano y Premium.
- Caja/POS 3D completa con mostrador, cinta, scanner, monitor, teclado e impresora.
- Estanterías GLB reutilizadas para exhibición, ampliaciones y mobiliario de pared.
- Sofá GLB en la zona de espera.
- Geometrías GLB se comparten entre clones para reducir memoria y llamadas de creación.
- Materiales se clonan por instancia, permitiendo variar NPC sin duplicar la geometría.
- Si un GLB no carga, el juego conserva un modelo procedural de respaldo.

## Compatibilidad

Los GLB se cargan desde rutas locales (`assets/models3d/`) mediante un cargador GLB ligero integrado en `simulator3d.js`. Esto evita añadir otra dependencia externa para cargar los modelos. Three.js continúa usando la misma carga definida por el proyecto.
