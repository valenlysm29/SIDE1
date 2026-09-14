# Mejora 3D basada en proyectos de referencia

Se revisaron dos proyectos proporcionados por el usuario como referencia técnica:

- `supermarket-stable`: proyecto web/Three.js con arquitectura por entidades/componentes, raycasting, puertas, caja, física y guardado. El repositorio incluye licencia GPLv3.
- `store-simulator-game-master`: proyecto Unity con compradores mediante rutas/NavMesh, stock de estanterías, trabajadores, caja, puertas, sonido y expansión. El repositorio principal incluye licencia MIT; algunos assets de terceros pueden tener condiciones propias.

## Criterio de integración

No se copiaron modelos, texturas, sonidos ni fragmentos de código de estos proyectos. SIDE conserva su implementación web con Three.js y sus sistemas educativos. Se recrearon únicamente patrones generales de diseño de simuladores.

## Mejoras aplicadas

1. **Interacción por mirada / raycast**
   - El punto de mira detecta el objeto que está frente a la cámara.
   - Se evita activar una caja o estante solo por estar cerca pero mirando hacia otro lado.
   - El retículo cambia de estado cuando existe un objeto interactuable válido.

2. **Clientes con recorrido de compra variable**
   - Cada cliente visita entre 2 y 4 puntos de exhibición antes de decidir.
   - Los puntos se seleccionan de forma distinta por cliente.
   - Se conservan preferencias por segmento, precio, reputación, marketing y stock.

3. **Espacio personal entre NPCs**
   - Los clientes aplican una separación suave entre sí mientras caminan.
   - Reduce superposiciones y grupos de NPCs ocupando exactamente el mismo punto.

4. **Feedback contextual breve**
   - Los clientes pueden mostrar mensajes cortos al comparar productos, no encontrar stock, encontrar la cola llena o esperar demasiado.
   - Los mensajes son temporales para no ensuciar visualmente la tienda.

5. **Producto físico en caja**
   - Al abrir el POS aparece el bolso en el mostrador.
   - Al escanear, el bolso se desplaza hacia el escáner.
   - Al cobrar, continúa hacia la zona de empaquetado.

6. **Sonidos de pasos**
   - Se generan pasos suaves cuando el jugador camina o corre.
   - La cadencia cambia al correr.

7. **Ajustes 3D**
   - Sensibilidad del mouse.
   - Campo de visión (FOV).
   - Calidad Baja / Media / Alta / Auto.
   - Atajo `P` para abrir/cerrar ajustes.

8. **Auto-guardado visible**
   - Inventario y estado operativo se guardan periódicamente.
   - El HUD muestra brevemente `PROGRESO GUARDADO`.

9. **Rendimiento**
   - Se mantiene el sistema de calidad adaptativa existente.
   - Las nuevas rutinas están limitadas al máximo reducido de NPCs y no generan geometría continuamente.
   - El cálculo de interacción se ejecuta con la frecuencia del prompt, no como una búsqueda pesada en cada objeto del mundo.

## Próximas mejoras compatibles

- Dos colas/cajas realmente independientes cuando se compre la segunda caja.
- Sistema de empleados por estados: atender, reponer, descansar y transportar producto.
- Carga de modelos GLB propios optimizados para personas, bolsos y mobiliario.
- Occlusion/frustum culling más agresivo para edificios y almacén.
- Animación de manos/bolso con modelos riggeados cuando existan assets propios.

10. **Vehículo de proveedor visible**
    - Cuando se pide stock desde la computadora de administración aparece un vehículo de proveedor en la calle.
    - El vehículo se aproxima, espera la entrega y se retira cuando el inventario llega.
    - Su movimiento usa `delta time` para no depender de los FPS.

11. **Sombras de contacto ligeras**
    - Los personajes tienen una sombra circular suave para que no parezcan flotar sobre el piso.
    - Es una técnica liviana que evita activar sombras dinámicas costosas.

12. **Pausa real en Ajustes 3D**
    - Al abrir los ajustes con `P`, el turno queda pausado.
    - Al cerrar, el juego reanuda sin descontar el tiempo que el usuario estuvo configurando la cámara.
