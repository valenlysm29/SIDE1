# Reorganización del DOP del estudiante

El DOP se separó de Producción para facilitar la consulta de metas, capacidad y recomendaciones sin recargar las decisiones operativas.

En «DOP y Planificación» se reúnen la meta por molde, la proyección de rentabilidad y el DOP con sus capacidades, recursos, faltantes, compras y costos estimados. La meta comparte el borrador de Producción y queda bloqueada cuando esa decisión se envía. Las recomendaciones siguen siendo informativas.

Producción conserva las demás decisiones, sus controles de guardado y envío y los datos de la meta compartida. No se añadieron decisiones de precios ni asignación de personal por máquina.

Archivos modificados: `js/app.js`, `index.html`, `tests/dop_navegacion.test.cjs` y este informe. No se cambiaron los motores ni las fórmulas de capacidad, materiales, costos, inventarios o cierre; tampoco se modificaron Docente ni Laboratorio.

Pruebas: navegación, persistencia y bloqueo de la meta en escritorio y móvil; sintaxis de JavaScript; pruebas del modelo de producción, recomendaciones y continuidad de tres y seis ciclos. Estas verificaciones pasaron. Cuatro pruebas antiguas de `dop_resource_planning.test.cjs`, `production_dop.test.js` y `production_dop_target_ui.test.js` fallaron por expectativas sobre textos o recursos del DOP; los archivos del motor y presentación que ejercitan no fueron modificados en esta tarea. No se realizó una partida completa conectada a un servidor.
