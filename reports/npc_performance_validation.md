# Rendimiento y validación de NPC — 29-09-2026

El manifiesto de producción contiene **16 GLB urbanos** con 14 440 740 bytes
en conjunto. Son 16 geometrías y atuendos originales distintos; cada GLB
contiene skin y clips Idle/Walk/Run in-place del mismo rig. Los archivos
individuales pesan entre 450 848 y 1 460 044 bytes. La suite automatizada
comprueba IDs únicos, licencia, integridad del GLB, clips ligados al esqueleto
y ausencia de desplazamiento horizontal de raíz.

## Rendimiento observado

Se ejecutó `tests/npc_fps_benchmark.cjs` en Chrome headless con ANGLE
SwiftShader a 1280×800. Con los **16 modelos cargados**, el monitor mostró
aproximadamente **1 FPS**, mientras había otras mediciones y procesos activos.
SwiftShader es renderizado por software y estaba saturado: esta cifra no es un
FPS de hardware ni sirve para estimar Baja, Media, Alta o Auto. Tampoco permite
cuantificar la variación respecto a la línea base, que también rondaba 1 FPS.

El costo de memoria de plantillas aumenta con el catálogo, pero el render
simultáneo continúa limitado por tier: Baja 5 clientes, Media 8, Alta 10 y
Auto 8 (`simulator3d-config.js`). Se comparte la geometría de cada plantilla
entre clones. El runtime reduce la frecuencia de pose para NPC lejanos y
suspende el mixer cuando salen de la vista. El plan de streaming por tier en
`services/npc_streaming.mjs` propone mantener 4/8/16/8 plantillas según
Baja/Media/Alta/Auto y dar prioridad a la zona próxima. El integrador debe
conectarlo a `simulator3d.js` y evitar expulsar plantillas con clones vivos.

**FPS estimado por tier en GPU real:** sin estimación defendible todavía.
Se requiere una medición en un equipo modesto, misma cámara y número de NPC,
por tier, después de conectar el streaming. El límite de NPC y la carga
diferida reducen el riesgo, pero no constituyen una medición.

## Pruebas actuales de esta tanda

- `node --test tests/*.test.js tests/*.test.mjs tests/world_finance.test.cjs`:
  suite completa en verde al integrar el catálogo.
- `tests/npc_city_pack.test.mjs`: valida los 16 GLB, skin, clips y movimiento
  in-place sin contar avatares jugables.
- `tests/npc_streaming.test.mjs`: prioridad por zona, límites por tier y
  protección de clones activos.
- `tests/npc_optional_navigation.test.mjs` y
  `tests/npc_navmesh_grid.test.mjs`: ruta segura con fallback AABB, avance Yuka
  sujeto a colisiones y cuadrícula de navmesh fuera de sólidos.
- Smoke de navegador real: three-pathfinding 1.3.0 construyó una zona de
  cuadrícula; la ruta entre dos puntos rodeó el obstáculo central.

La capa Yuka/three-pathfinding es opcional. Necesita construir su geometría
cuando la ciudad y sus colliders estén listos. Si falta un módulo, no existe
una ruta completa o ésta cruza un collider dinámico, se usa el planificador
AABB existente.
