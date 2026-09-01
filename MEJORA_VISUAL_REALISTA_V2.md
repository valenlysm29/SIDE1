# SIDE 3D — Mejora visual realista V2

Esta versión corrige el problema por el cual los modelos GLB generados no se cargaban antes de construir la escena 3D.

## Cambios visibles
- El cargador de modelos se ejecuta antes de `buildStaticWorld()`.
- NPC masculino, femenino y personal rediseñados con articulaciones jerárquicas en hombros, codos, rodillas y manos.
- Rostros con ojos, nariz, boca, orejas y peinados diferenciados.
- Torso y prendas con geometría trapezoidal para evitar el aspecto de bloques.
- Tres bolsos rediseñados con asas, anillos, cierres, herrajes, costuras y formas distintas.
- Caja/POS rediseñada con cinta, scanner, monitor, terminal de tarjeta, impresora y zona de embolsado.
- Estanterías boutique con iluminación bajo repisa.
- Automóviles GLB con carrocería, cabina, cristales, ruedas y aros.
- Farolas GLB con geometría más detallada.
- Edificios con cornisas, ventanas físicas, repisas, puerta de acceso y marquesina.
- Fachada con marcos de vidrio, tiradores y zócalo.
- Vidrios MeshPhysicalMaterial con mayor sensación de cristal.
- Cielo degradado 3D, fog más lejano y exposición ajustada.
- Piso de boutique tipo parquet/herringbone en lugar de color plano.
- Sombras de contacto ligeras debajo de personajes y vehículos, sin activar sombras WebGL costosas.
- Modal de ingreso reducido para no ocupar casi toda la pantalla.

## Referencias técnicas
Los proyectos proporcionados por el usuario se usaron como referencia de escala, jerarquía visual y experiencia de simulador. Los modelos de esta versión fueron generados específicamente para SIDE y no copian los modelos GPL del proyecto Supermarket.
