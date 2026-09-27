# SIDE — validación del mundo continuo

Fecha: 27 de septiembre de 2026. Repositorio: SIDE1. Rama: main.

## Mundo e interiores

El flujo normal inicializa exclusivamente `side-city`. Los constructores históricos permanecen sin llamadas desde el inicio, movimiento, directorio, edificios ni ciclos. La instrumentación de Chromium registró **cero invocaciones** de los cuatro constructores retirados.

Tienda, almacén y producción comparten escena, cámara, coordenadas y controlador con la ciudad. El jugador cruza una abertura real; la detección de zona sólo cambia contexto y HUD. No hay pantalla negra, carga de otra página, reposicionamiento, teleport ni botón de entrada. La salida es la misma puerta, frente al edificio correspondiente. El directorio indica destinos a pie. El vehículo conserva su objeto y posición.

- **Tienda:** cuatro estanterías, bolsos por niveles de existencias, exhibidor, reserva pequeña, mostrador, terminal de caja, cajero, vendedora, clientes, terminal de decisiones e inspección de los tres productos con la UI existente.
- **Almacén:** cuatro racks industriales, pallets, paquetes, recepción y preparación, terminal de pedidos, transpaleta, señalización de pasillos y trabajadores. Un pedido pendiente muestra recepción pendiente, nunca mercancía disponible ficticia.
- **Producción:** recepción de cuero, rollos y patrones, mesa de corte, máquinas de costura, ensamblado, acabado, inspección, empaque, reserva de producto terminado, operadores y consola del resumen empresarial existente. Las agujas se animan sólo con producción autoritativa pendiente.

Muros, techo, piso, puertas, luminarias y colliders pertenecen a cada edificio. Se revisaron imágenes reales de los tres interiores y sus fachadas, alturas, pasillos, alcance de terminales y cámara bajo el dintel. Los acabados usan MeshStandardMaterial con metalness/roughness distintos para acero, concreto, madera, vidrio, cuero y pintura. Los props son geometría propia a escala métrica; no se incorporaron assets externos.

## Integración financiera

El inventario, caja, ventas, comisión, pedidos, producción, capacidad y decisiones siguen perteneciendo a `simulator3d.js`, el bridge y el modelo de producción existentes. `businessVisualSnapshot()` sólo lee; `sync()` convierte esa lectura en niveles visuales 0/25/50/75/100%. Ningún interior mantiene un inventario o ledger paralelo.

La regresión completa verificó compra de 12 unidades por S/ 360, débito único, entrega única, reposición sin crear stock, venta de S/ 75 con ingreso neto S/ 74.25, reintento sin doble venta, producción 10/10 sin exceder el plan y continuidad al ciclo 2. Inspeccionar productos conserva exactamente el snapshot financiero. Preparar un nuevo ciclo permite explorar, como ya permitía main, pero bloquea compras y ventas hasta enviar sus decisiones.

## Diez pruebas funcionales en Chromium/WebGL

| Prueba | Resultado | Evidencia comprobada |
| --- | --- | --- |
| 1. Nuevo mapa único | PASS | side-city, cero llamadas legacy |
| 2. Entrada tienda | PASS | controlador real, sin saltos de coordenadas |
| 3. Salida tienda | PASS | misma puerta, exterior libre de colliders |
| 4. Almacén | PASS | racks, pallets, recepción, transpaleta, luces |
| 5. Producción | PASS | maquinaria, operadores, terminal y salida |
| 6. Colisiones | PASS | aproximación y bloqueo de muro, estante, máquina y caja |
| 7. Vehículo | PASS | conducir, frenar, bajar, visitar y conservar estacionamiento |
| 8. Inventario | PASS | pedido real, entrega idempotente, niveles de tienda/almacén |
| 9. Ciclos | PASS | misma escena, sin duplicar NPCs, listeners ni RAF |
| 10. Flujo completo | PASS | decisiones, ciudad, coche, pedido, caja, producción y siguiente ciclo |

La fixture de estas pruebas coloca al jugador únicamente al preparar escenarios aislados. Los cruces se ejecutan mediante `updatePlayer`, y el flujo completo camina entre edificios por las calles con ese mismo controlador. Los hooks se inyectan en la respuesta del navegador de pruebas y no forman parte del producto. Los pedidos y cobros utilizan los botones y handlers empresariales reales; acelerar la fecha de entrega no reemplaza la lógica de entrega. Cero errores JavaScript y cero respuestas locales HTTP fallidas en el flujo completo.

## Regresión existente

- **138/138 pruebas unitarias PASS**, cero omitidas: finanzas, producción, ciclo, portales, movimiento, vehículos, navegación, runtime y nuevas pruebas de interiores/proyección/recursos.
- **2/2 pruebas del servidor local PASS**.
- Chromium: `playable_hub`, `gameplay_hud`, `world_business_ui`, `world_cycle_restart`, `world_startup`, `world_loading`, `supplied_npcs`, `mona_npc`, `npc_locomotion`.
- Base de datos y UI: `game_lifecycle_db`, `game_observations_db`, `game_lifecycle_ui`, `decisions_cycle_ui`, `teacher_lifecycle_ui`.

Las expectativas antiguas de teleports y coordenadas retiradas se sustituyeron por cruces físicos, conservación de estado y coordenadas del mundo nuevo. Se preservaron las pruebas de caja, entrega, rig, bolsas, fallback, colisiones y layouts móviles. La prueba de Mona verifica altura canónica 1.68 m y AABB posada con tolerancia de 3 mm por respiración del rig, ya existente en main. Los esperados cambios de ciclo se comprueban con exploración separada del permiso financiero.

Ejecución reproducible desde SIDE1:

```powershell
node --test tests/*.test.js tests/*.test.mjs tests/world_finance.test.cjs
python -m unittest discover -s tests -p local_server_test.py
node tests/run_world_regression.cjs
git diff --check
```

El ejecutor crea un servidor local en puerto libre y corre las suites secuencialmente. Requiere Playwright en tests/node_modules y Chrome; CHROMIUM_PATH permite indicar otro ejecutable. Los resultados y capturas permanecen en `tests/output/continuous`, `tests/output/npcs` y `tests/output/mona`, ignorados por Git. Las capturas históricas previamente versionadas se conservan sin reemplazarlas por salidas incidentales de pruebas.

## Rendimiento y referencias

Con la misma suite, cámara inicial y viewport 1366 × 900 en Chromium SwiftShader:

| Métrica | Antes | Después |
| --- | ---: | ---: |
| Draw calls iniciales | 162 | 132 |
| Triángulos iniciales | 163384 | 195676 |
| Meshes de escena | 531 | 396 |
| Skinned meshes iniciales | 20 | 5 |
| Lotes de cinco vehículos | 165 | 70 |
| Geometrías únicas de vehículos | 26 | 3 |

Se reducen draw calls iniciales 18.5% y lotes de coches 57.6%, incorporando la arquitectura interior. Los triángulos aumentan 19.8%; estos conteos **no son un benchmark de FPS**. Los interiores reutilizan dos geometrías, materiales y lotes de existencias; detalle por proximidad, dos luces locales activas, NPCs creados al primer acceso y animación suspendida fuera del negocio. La geometría se prepara una vez; atravesar la puerta no solicita archivos.

La carga inicial conserva los modelos GLB existentes: aproximadamente 77.1 MB de recursos en la prueba local. La velocidad real de carga/FPS requiere medición en GPU de hardware y red del usuario; SwiftShader no permite prometer un objetivo de FPS. No se añadieron bibliotecas ni descargas de assets.

Se verificaron licencias MIT y referencias de Three.js, three-mesh-bvh y three-pathfinding. Se aplicaron ideas de instancing, separación visual/colisión y navegación por zonas; no se copiaron proyectos, código ni assets. Detalles, URLs y archivos afectados: [referencias](continuous_world_references.md). Auditoría de recursos: [rendimiento](continuous_performance_audit.md).
