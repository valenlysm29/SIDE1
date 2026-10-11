# Inspección del primer lote de 15 FBX en `mixamo/pending`

Blender 5.2.2 importó los 15 FBX realmente. Todos tienen un armature de 65
huesos, una acción y **cero mallas**; los cinco `Idle` tampoco contienen un
personaje visual. Los tres archivos dentro de cada grupo comparten nombres,
jerarquía, matrices de rest pose y transformación de armature. No se asumió
compatibilidad por el número escrito en el nombre del archivo.

| Grupo por rig | Idle | Walk | Run | Hips neto Idle / Walk / Run (m) | Base visual compatible |
| --- | --- | --- | --- | --- | --- |
| `4a77fc45` | `personaje1_Idle.fbx` | `personaje1_Walking.fbx` | `personaje1_Running.fbx` | 0 / 0 / 0 | Ninguna; delta mínimo 6,1259 |
| `df062970` | `personaje2_Idle.fbx` | `perosnaje2_Walking.fbx` | `perosnaje2Running.fbx` | 0 / 0 / 0 | Ninguna; delta mínimo 5,8995 |
| `1788d222` | `personaj3Idle.fbx` | `perosnaje3Walking.fbx` | `personaje3Running.fbx` | 0 / **1,751981** / 0 | Ninguna; delta mínimo 4,6834 |
| `f57f94b1` | `perosnaje4Idle.fbx` | `perosnaje4Walking.fbx` | `personaje4Running.fbx` | 0 / 0 / 0 | Ninguna; delta mínimo 5,6258 |
| `ab5389e8` | `perosnaje5Idle (1).fbx` | `peronsaje5Walking (1).fbx` | `personaje5Running (1).fbx` | 0 / 0 / 0 | Ninguna; delta mínimo 5,9434 |

Se compararon los cinco rigs con los **24 FBX que sí tienen malla y skin** en
`assets/models/incoming/mixamo/`. Hubo **0 emparejamientos compatibles**. El
umbral máximo de diferencia de rest pose del conversor es 0,002; los valores
de la tabla son las menores diferencias observadas entre matrices de reposo
cuando al menos coincidían los nombres de huesos. El Walk del tercer grupo
además no es In Place. No se asignó ninguno de estos clips a otro personaje,
no se exportó GLB y no se declaró PASS de deformación.

Evidencia detallada de Blender:
`.codex-work/npc_pending_inventory.json` y
`.codex-work/npc_pending_comparison.json`, ambas rutas dentro de `SIDE1`.

## Continuación: reemplazo de `personaje3Walking.fbx`

El archivo anterior `perosnaje3Walking.fbx` (sin malla) fue reemplazado en el
directorio por `personaje3Walking.fbx` de 50 068 928 bytes. Blender lo importó
como **7 mallas skinned**, 29 352 vértices, armature de 65 huesos y una acción
de frames 1–62. Su SHA-256 es
`9217653f1cd023a1e68775a18c175d568d95c092ee7d00ce67e7137f52318ff4`.
El hash de matrices de rest pose es
`2256c8355623ff8039656923c8566d62bcc3110edbbf707fbd1cf52f04ebc23b`;
coincide exactamente con `Walk (6).fbx` y `Walking 2).fbx`, que ya representan
la misma candidata visual de traje azul. Hips tiene desplazamiento horizontal
neto de 0,000000046 m y oscilación en ejes X/Y de 0,04150 / 0,02824 m: la
acción recibida es In Place según esa medida.

Se comparó el nuevo armature con los **11 clips sin malla del lote anterior**
y los **14 clips sin malla que permanecen en pending**. Hubo **0 de 25** clips
con los mismos nombres de huesos; por tanto, tampoco existe un trío
Idle/Walk/Run compatible para el traje azul. En particular,
`personaj3Idle.fbx` y `personaje3Running.fbx` mantienen el rig `1788d222`,
distinto del `2256c835` de la nueva malla. La enumeración completa de FBX
en `assets/models/` halló 35 del lote Mixamo anterior, los 15 en `pending` y
los FBX Quaternius; una búsqueda adicional en `SIDE1` encontró archivos
Kenney de escenarios, no otro personaje Mixamo con skin. No se exportó GLB.

Evidencia de esta continuación: `.codex-work/npc_pending_inventory.json`
(actualizado con el FBX nuevo) y `.codex-work/npc_new_skin_comparison.json`.
El JSON `npc_pending_comparison.json` conserva el análisis del lote inicial.
