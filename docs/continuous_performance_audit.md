# Auditoría de rendimiento del mundo continuo

## Vehículos: comparación reproducible

Se construyó la flota con Three.js real en Node, primero a partir de
`HEAD:services/hub_vehicles.js` y luego con la implementación actual. Estos
conteos describen objetos renderizables y recursos; no son una medición de FPS.

| Métrica de los cinco coches | Antes | Después |
| --- | ---: | ---: |
| Meshes / lotes renderizables | 165 | 70 |
| Geometrías únicas | 26 | 3 |
| Coches | 5 | 5 |
| Ruedas independientes | 20 | 20 |

La reducción de objetos renderizables es de 57.6%. Las tres geometrías
compartidas son caja, cabina y neumático. Las piezas estáticas de carrocería
se instancian por material dentro del grupo de cada coche; las llantas usan
dos instancias en un lote por rueda. Se conservan triángulos, dimensiones,
rotación de pilares, sombras, inclinación de carrocería, dirección, giro de
ruedas, colisiones, estacionamiento y luces de freno independientes.

Los lotes calculan sus bounding spheres para frustum culling. Al liberar la
flota se liberan buffers de instancia y cada geometría/material compartido
una vez. No se añadieron dependencias ni modelos externos.

## Interiores

`services/business_interiors.mjs` comparte una geometría de caja y otra de
cilindro. Muebles y productos repetidos utilizan InstancedMesh por material,
sala y nivel de inventario. Los cinco estados de existencias cambian la
visibilidad de cuatro grupos fijos, sin reconstruir geometría por ciclo.

El detalle de cada edificio se dibuja dentro de un radio de 24 metros.
Esto es activación por proximidad: la geometría se crea una sola vez al
inicializar el mundo, no carga diferida de archivos. Evita esperas al cruzar
la puerta y permite ver muebles al acercarse. Las envolventes permanecen
visibles como parte de la ciudad.

Cada sala tiene dos PointLight sin shadow maps, activadas solo mientras el
jugador está dentro. Las lámparas visibles usan material emisivo compartido.
Los NPCs ambientales se crean en la primera entrada a cada sala, se reutilizan
al volver y dejan de animarse/renderizarse al salir. Las agujas de costura se
actualizan exclusivamente en la sala activa y según la proyección financiera.

`sync()` es una proyección de solo lectura del modelo empresarial: no inicia
transacciones, RAF, listeners, entregas ni timers. Los ciclos modifican los
grupos existentes. `dispose()` del interior es idempotente, retira su grupo y
libera materiales, texturas, geometrías propias y buffers de instancia.

## Runtime

El mundo conserva una escena y el bucle existente. Cambiar de zona no crea
otro renderer, cámara, mundo ni RAF. Suspensión y cierre del turno paran
operaciones; la pausa visible permite un dibujo y mantiene física y NPCs
inactivos. Estos contratos tienen pruebas en `world_runtime.test.js` y
`business_interiors.test.mjs`.

## Validación y límites

`tests/continuous_performance.test.mjs` verifica geometrías compartidas,
límite de 70 lotes de vehículos, bounding spheres, conservación de pivotes,
materiales de freno separados, memoria del coche detenido y disposición
única de geometrías. `vehicle_motion.test.mjs` mantiene las pruebas de
dirección, frenado y colisión. Estas dos suites pasaron 6/6 pruebas.

Los conteos de renderer dependen de cámara, NPCs ya creados, inventario y
sombras. El registro de navegador del equipo antes del batching final fue
171 calls / 195582 triangles; el mapa anterior a esta fase fue registrado
con 162 calls / 163384 triangles. No se deben interpretar estas tomas como
un benchmark de FPS ni comparar cámaras o inventarios distintos. La
medición final del navegador debe usar el mismo recorrido y estado.

Medición final con `playable_hub.cjs`, cámara inicial y viewport 1366 × 900:
132 calls / 195676 triangles / 396 meshes / 5 skinned meshes. Frente al
baseline de la misma suite: draw calls -18.5%, meshes -25.4%, triángulos
+19.8%. Se incorporaron interiores y se redujo trabajo repetido; no se afirma
una mejora medida de FPS. El informe de validación recoge el alcance y las
limitaciones de esta comparación con GPU por software.
