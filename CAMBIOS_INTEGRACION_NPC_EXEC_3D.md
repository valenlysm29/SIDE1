# Integración de los modelos GLB ejecutivos en el simulador 3D

`CAMBIOS_NPC_EJECUTIVOS.md` dejaba `assets/models3d/npc_exec_male.glb` y
`npc_exec_female.glb` como modelado 3D independiente ("no se cargan
automáticamente en `simulator3d.js`"). Este cambio corrige eso: ahora el
personal de tienda usa esos dos modelos GLB directamente dentro del
simulador Three.js, en vez de la geometría procedural por primitivas, para
que los asesores se vean lo más realistas posible.

## Qué cambió en `simulator3d.js`

- **`execModelTemplates`** (nuevo, junto a `npcModelTemplate`): guarda las
  escenas GLB cargadas para `male` y `female`.
- **`loadExecModelTemplates()`** (nueva función, llamada desde `init()` justo
  después de `loadNpcModelTemplate()`): carga
  `assets/models3d/npc_exec_male.glb` y `npc_exec_female.glb` con el mismo
  `GLTFLoader` ya usado para el avatar Mixamo. A diferencia de ese avatar
  (con esqueleto y animaciones, clonado vía `SkeletonUtils`), estos GLB son
  mallas estáticas sin esqueleto: la función valida que cada escena tenga
  los nodos-pivote nombrados `Arm_L/R`, `Forearm_L/R`, `Hand_L/R`, `Leg_L/R`
  (los mismos que ya reporta `VALIDACION_MODELOS_GLB.txt`) antes de
  aceptarla. Si un archivo falta, no carga o no tiene esos nodos, ese género
  queda en `null` y el asesor correspondiente conserva el respaldo
  procedural — mismo criterio de tolerancia a fallos que el resto del
  proyecto ("si un GLB no carga, el juego conserva un modelo procedural de
  respaldo").
- **`STAFF_LOOKS`**: cada look ahora incluye `execModel: 'male'` /
  `execModel: 'female'`. `forceProcedural` se mantiene como respaldo (evita
  el clon animado del avatar Mixamo, que no tiene puntos de anclaje para
  lentes/botones/cabello largo).
- **`person(cfg)`**: nueva rama, evaluada antes del cuerpo procedural
  completo, que usa `execModelTemplates[cfg.execModel]` cuando está
  disponible: clona la escena (`clone(true)`, sin `SkeletonUtils` porque no
  hay esqueleto), ubica los pivotes `Torso/Hips/Head/Arm_*/Forearm_*/Hand_*/
  Leg_*` por nombre y los guarda en `g.userData.parts` con el mismo formato
  que ya consume `setPersonPose()`. Como los colores de traje/corbata/blazer
  ya vienen horneados en el GLB (coinciden exactamente con los hex de
  `STAFF_LOOKS`), no hace falta tintar materiales.
- **`setPersonPose()`**: los offsets verticales de cabeza/torso/cadera
  (antes constantes fijas `1.63/1.10/0.74`) ahora salen de
  `g.userData.baseY`, tomado de la posición real de esos nodos al crear el
  personaje. El cuerpo procedural sigue usando esas mismas constantes por
  defecto (comportamiento idéntico al anterior); el modelo GLB ejecutivo usa
  su propia geometría (`Torso`≈1.15, `Hips`≈0.77, `Head`≈1.67) sin necesidad
  de tocar sus vértices para encajar en el esquema de animación existente.

## Validado

- `node --check simulator3d.js` sin errores de sintaxis.
- `node --test tests/*.test.js`: 62/62 OK (sin regresiones).
- Verificación directa del JSON embebido en ambos `.glb` (fuera del
  navegador): los nodos `Arm_L`, `Arm_R`, `Forearm_L`, `Forearm_R`, `Hand_L`,
  `Hand_R`, `Leg_L`, `Leg_R`, `Torso`, `Hips` y `Head` están presentes por
  nombre en los dos archivos, tal como espera `loadExecModelTemplates()`.

## Pendiente / fuera de alcance

`npc_male.glb`, `npc_female.glb` y `npc_staff.glb` (los otros GLB de
`assets/models3d/`, documentados en `MODELOS_GLB_REALISMO.md`) siguen sin
cargarse en `simulator3d.js`; esta integración se limitó a los dos modelos
ejecutivos aportados. Si se quiere el mismo tratamiento para clientes o
personal genérico, se puede reutilizar `loadExecModelTemplates()` como
plantilla (misma convención de nodos-pivote).
