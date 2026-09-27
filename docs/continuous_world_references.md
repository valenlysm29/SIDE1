# SIDE: mundo continuo, contratos y referencias

Fecha de revisión: 27 de septiembre de 2026. Perfiles especializados: gameplay financiero (agente 4), optimización 3D (agente 6), investigación GitHub (agente 7). El diseño urbano, los interiores y el controlador se coordinaron con los agentes responsables de esos archivos.

## Contrato financiero: una sola fuente de verdad

El mundo representa el estado empresarial existente. No tiene caja, inventario, pedidos ni producción independientes.

| Dato o acción | Fuente autoritativa existente | Uso físico |
| --- | --- | --- |
| Caja | `app.js`, `SIDE_GAME_BRIDGE`, `cashLedger`, `financial_model.js` | HUD y terminales leen el saldo; las operaciones conservan los asientos existentes. |
| Productos exhibidos | `simulator3d.js`, `inventory.display` | Bolsos en las estanterías; niveles visuales de llenado. |
| Productos almacenados | `inventory.reserve` | Cajas/pallets y mercancía en racks. |
| Venta | `serveNextQueuedCustomer()` / `recordSale()` / `bridge().recordSimulatedSale()` | Caja registradora; conserva comisión, sold y escritura conjunta del estado. |
| Reposición | `restockDisplays()` | Traslada unidades existentes del almacén a exhibición. |
| Pedido | `orderSupplierStock()` / `applyExpense()` | Terminal de recepción; un pedido pendiente y un débito de 360 por 12 unidades. |
| Entrega | `tickSupplier()` / `inventory.lastSupplierOrderId` | Actualiza almacén una sola vez; el ID persistido impide duplicar recepción al recargar. |
| Producción | `bridge().productionPlan()` / `production_model.js` / `inventory.producedUnits` | Corte, ensamblado/costura y acabado de bolsos; no se interpreta stock comprado como producción. |
| Inversiones | `buyUpgrade()` / `bridge().recordOperatingExpense()` | Se reutilizan límites, validación de caja y clasificación contable. |
| Ciclo | Claves existentes con `storageContext()` y puente de partida | Entrar y salir sólo cambia contexto espacial, no inicia ni reinicia un ciclo. |

El inventario tiene esquema 2 y conserva `display`, `reserve`, `sold`, `producedUnits`, `totalTarget` y `lastSupplierOrderId`. Un registro histórico sin `producedUnits` conserva productividad desconocida; no se fabrica un dato de producción a partir de existencias o compras.

Snapshot de lectura acordado con los agentes de runtime y entorno:

```js
{
  displayStock, reserveStock, displayCapacity, warehouseCapacity,
  storeFill, warehouseFill, // ratios 0..1, cuantizados visualmente en 0/25/50/75/100%
  pendingUnits, productionActive, producedUnits, plannedUnits,
  products: [{ id, color, display, reserve }],
  productionPlan, cash, round,
  machines: { cutting, assembly, finishing }, workers
}
```

`storeFill` usa stock total exhibido dividido entre capacidad total de todos los productos. `warehouseFill` usa reserva dividida entre capacidad. `productionActive` requiere turno operativo y producción pendiente del plan. `sync(snapshot)` sólo adapta instancias, señalización y estados visuales. No escribe almacenamiento ni invoca movimientos de caja. La actualización puede repetirse sin cobrar, entregar, vender ni producir.

Los procesos del modelo existente son cuero → corte de piezas → clasificación/preparación de accesorios → ensamblado y colocación de accesorios → acabado. El entorno usa esta cadena para dar sentido a mesas, máquinas, rollos, puestos de inspección y empaque. Los pedidos actuales son bolsos terminados, no un segundo suministro ficticio de materias primas.

## GitHub y fuentes primarias

Se consultaron los archivos de licencia y los ejemplos originales. Las implementaciones nuevas de SIDE son propias; no se copiaron proyectos, snippets ni assets y no se añadieron dependencias. La ausencia de una licencia general de SIDE en la raíz no se tomó como permiso para relicenciar su código. Una futura incorporación de código MIT deberá conservar sus avisos de copyright y licencia; los assets deben verificarse por separado.

| Repositorio | Licencia verificada | Referencia concreta e idea evaluada | Aplicación en SIDE |
| --- | --- | --- | --- |
| [mrdoob/three.js](https://github.com/mrdoob/three.js) | [MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE) | [Instancing performance](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_instancing_performance.html) y [API InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html): agrupar geometría/material y actualizar matrices/volúmenes cuando corresponde. | `services/hub_world.js`, sistema de interiores: materiales/geometrías compartidos y lotes por edificio. Three.js ya estaba incorporado; no se actualiza la versión por esta investigación. |
| [mrdoob/three.js](https://github.com/mrdoob/three.js) | [MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE) | [FPS example](https://github.com/mrdoob/three.js/blob/dev/examples/games_fps.html): movimiento con pasos pequeños para evitar atravesar obstáculos entre frames. | Revisión de `services/player_motion.mjs`: conservar el controlador propio con subpasos y colisiones; no incorporar otra física ni otro controlador. |
| [mrdoob/three.js](https://github.com/mrdoob/three.js) | [MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE) | [Portal example](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_portal.html): cámara y render targets adicionales para vistas de portales. | Alternativa evaluada y descartada: edificios contiguos en las mismas coordenadas eliminan el coste y la necesidad de portales/teletransportes. Decisión arquitectónica en `simulator3d.js` y servicios del mundo. |
| [gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | [MIT, Garrett Johnson](https://github.com/gkjohnson/three-mesh-bvh/blob/master/LICENSE) | [Character movement](https://github.com/gkjohnson/three-mesh-bvh/blob/master/example/characterMovement.js): cápsula y consultas espaciales contra mallas complejas, con transformación al espacio del collider. | Referencia de separación geometría visual/colisión. No se instala BVH: muros, racks y máquinas actuales tienen colliders rectangulares económicos. Reevaluar si se introducen mallas arquitectónicas irregulares. `services/player_motion.mjs`, colisiones del mundo. |
| [donmccurdy/three-pathfinding](https://github.com/donmccurdy/three-pathfinding) | [MIT, Don McCurdy](https://github.com/donmccurdy/three-pathfinding/blob/main/LICENSE) | API de zonas, rutas y `clampStep`: limitar movimiento a superficies transitables y grupos conectados. | Revisión arquitectónica de `services/npc_navigation.mjs`: rutas por zonas válidas, obstáculos dilatados por radio y ningún atajo a través de paredes. Se conserva navegación propia; no se añade otro grafo o navmesh en paralelo. |

Los ejemplos con modelos de terceros, incluidos los enlazados por el ejemplo BVH, se usaron únicamente para estudiar arquitectura. No se descargaron sus ciudades, interiores, texturas, personajes ni maquinaria. Los edificios y props de SIDE se generan con geometría del proyecto, ajustada a su escala y producción de bolsos.

Reverificación del agente 7: las tres licencias originales enlazadas y los cinco archivos de ejemplo se abrieron mediante navegación el 27 de septiembre de 2026. MIT permite reutilizar código con sus avisos; en esta fase se usan ideas arquitectónicas y geometría propia. La navegación por zonas, las colisiones AABB y las entradas contiguas evitan introducir dependencias de física, portales o assets de ciudades ajenas. No se considera que la licencia de una librería cubra los modelos de terceros que aparecen en sus demos.

## Rendimiento y validación

Baseline medido por `tests/playable_hub.cjs` en Chromium con SwiftShader, viewport 1366 × 900, escena inicial anterior a esta fase:

| Métrica | Antes |
| --- | ---: |
| Meshes totales de la escena | 531 |
| Skinned meshes | 20 |
| Draw calls del frame inicial | 162 |
| Triángulos del frame inicial | 163384 |

Es una medición con GPU por software, no una predicción de FPS en hardware real. Sólo deben compararse encuadres y estados equivalentes. `renderer.info.render.calls` cuenta el trabajo del frame; el total de objetos de escena y el de meshes visibles son medidas distintas.

Criterios acordados de implementación:

- Mantener exterior e interiores en una sola escena y un solo RAF. No recrear vehículos al cruzar puertas.
- Agrupar estructuras repetidas por geometría/material; separar detalle por edificio para poder ocultarlo por distancia.
- Precargar detalle al aproximarse y mantenerlo durante la visita; suspender animaciones industriales y NPCs interiores cuando su zona está inactiva.
- Mantener una cantidad fija de instancias para mercancía. Cambiar visibilidad/cantidad al cruzar umbrales de stock en lugar de destruir/reconstruir geometrías con cada venta.
- Compartir texturas/materiales PBR; usar roughness/metalness apropiados. Evitar una luz con sombras por lámpara; luminarias emisivas y luz local acotada.
- Mantener bounds de instancias que cubran todas sus posiciones; volver a calcularlos si una actualización mueve objetos fuera del volumen inicial.
- Liberar geometrías, materiales, texturas e instancias al destruir la escena. Revisar estabilidad de memoria, listeners y RAF en cambios de ciclo.

Validación financiera ejecutada durante la auditoría: `node --test tests/business_projection_regression.test.js tests/business_visual_snapshot.test.js tests/world_finance.test.cjs tests/production_model.test.js` → **24 PASS, 0 FAIL**. Incluye entrega idempotente incluso ante interrupción, débito único, venta atómica con reintento, bloqueo de operaciones durante pausa, conciliación de caja y producción limitada por materiales/personas/máquinas. Los cinco casos de snapshot comprueban la proyección de stock/capacidad/pedidos, lectura repetida sin mutación, independencia de compras y producción, pausa de animaciones y saturación visual sin alterar cantidades. Cinco casos adicionales ejecutan la reposición y la reserva real de clientes: conservan stock total, caja y producción; una reposición repetida no escribe ni cobra dos veces; retirar un producto actualiza enseguida la presentación; inventario histórico de producción desconocida y almacén lleno no animan una producción que el runtime no puede efectuar. Las pruebas integradas del mundo continuo y la comparación final se documentan en el informe de entrega de esta fase.
