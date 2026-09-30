# Fase D: animación y movilidad NPC

## Animación disponible hoy

`services/npc_clip_controller.mjs` prepara el controlador de nuevos GLB con estados `idle`, `idle2`, `walk`, `run`, `talk`, `carry`, `pickup`, `inspect`, `pay` y `sit` cuando existan clips con esos nombres. La transición dura 0,2 s. La velocidad de `walk` y `run` se calcula con la distancia **real** recorrida después de resolver colisiones, no con la velocidad solicitada. Si el clip trae traslación del hueso raíz, se estima su velocidad en metros por segundo; para clips en sitio el importador debe proporcionar `clipSpeeds` medidos. Sin esa referencia se conserva el tiempo original y **no se afirma ausencia de patinaje**.

| Modelo nuevo | Clips disponibles | Retarget real | Bloqueo |
| --- | --- | --- | --- |
| Ninguno | Ninguno | Ninguno | No hay FBX Mixamo ni GLB NPC aprobados. |

El ZIP **Universal Animation Library 2[Standard]** sí llegó. `UAL2_Standard.glb` y `UAL2_Standard_RM.glb` contienen los mismos 43 nombres de animación, sobre un rig de 65 joints; `_RM` es la variante con movimiento raíz. Clasificación de clips potencialmente civiles:

| Clip exacto | Posible uso | Límite |
| --- | --- | --- |
| `Idle_No_Loop` | Quieto básico | Requiere verificar pose, rig y ciclo tras retarget. |
| `Idle_FoldArms_Loop` | Quieto alternativo u observación | Brazos cruzados no equivale a `inspect`. |
| `Idle_TalkingPhone_Loop` | Transeúnte con teléfono | No equivale a conversación presencial sin teléfono visible. |
| `Walk_Carry_Loop` | Transporte en almacén | Requiere comprobar que el objeto siga ambas manos; no sustituye walk normal. |
| `Yes` | Respuesta breve | No equivale a clip `talk` en bucle. |
| `Consume` | Solo uso contextual | Acción de beber/comer ajena al flujo actual de bolsas. |

No hay walk normal, run, pickup, inspect, pay o sit en el lote Standard. `Zombie_Walk_Fwd_Loop` se excluye para esta ciudad; los clips de combate, escudo, ninja, campo y tala tampoco corresponden al contexto. Los dos `Superhero_*FullBody.gltf` del otro ZIP Standard contienen **0 animaciones cada uno** y ya fueron descartados por vestuario. No se retargetearon clips por nombre de hueso: faltan personajes vestidos y rigs compatibles aprobados en los que comprobar pose de reposo, escala y ejes. El fallback procedural actual se conserva.

`assets/models/incoming/mixamo/` no contiene FBX Mixamo con skin ni animaciones. `assets/models/npc/` no contiene GLB aprobados y Blender no está disponible en este entorno. Por tanto, la verificación por modelo sigue en **0 modelos**: ningún test de deformación o contacto de pies se ha ejecutado sobre un NPC. `tools/model-pipeline/verify_npc_animation.py` deja preparada una comprobación headless de armadura, skin, jerarquía de reposo, vértices sin peso y cajas deformadas en tres tiempos de idle/walk/run, además de registrar posiciones de huesos de pies. Estas muestras numéricas no prueban por sí solas ausencia visual de patinaje.

## Rutas y colisiones

SIDE ya dispone de `services/npc_navigation.mjs`: `planPath` rodea rectángulos de estantes, cajas y paredes con radio corporal, y `advance` resuelve giro, frenado y separación de vecinos. Hay pruebas deterministas de desvío, muros inalcanzables y encuentros entre personas. `simulator3d.js` contiene una NavMesh opcional generada con Recast a partir de rectángulos interiores; el arranque normal la evita y el mapa de ciudad completo no está convertido a una malla navegable. `three-pathfinding` requiere una NavMesh geométrica utilizable, ausente en estos lotes. Se conserva el planificador de waypoints/AABB existente como ruta segura por zona, sin afirmar que cubra nuevos trayectos que la fase E aún no ha definido.

## Integración pendiente

La fase E puede importar `createNpcClipController` al instanciar cada GLB aprobado y pasarle el mixer, clips y velocidades medidas por clip. Llamará `update(dt, {distance, requested, visible})` tras `npcNavigation.advance`, usando el desplazamiento devuelto por ese método. Se evita conectar clips inexistentes a los personajes elegibles o sustituir sus controladores.
