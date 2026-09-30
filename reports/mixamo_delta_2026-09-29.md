# Inventario diferencial Mixamo, lote cerrado el 29-09-2026

Comparación contra los 17 FBX del inventario anterior: **35 FBX actuales,
18 nuevos, 3 modificados, 14 sin cambios**. Blender 5.2.2 inspeccionó solo
los nuevos o modificados; el detalle por FBX está en `mixamo_inventory/`, el
resumen en `mixamo_current_inventory.json` y el diferencial con SHA-256 y
fingerprints completos en `mixamo_delta_2026-09-29.json`. Los renders de las
nuevas mallas se guardaron en `tests/output/mixamo_delta/`.

## Archivos nuevos o modificados

`rig` es el prefijo del hash SHA-256 de matrices de reposo; el valor completo,
hash de nombres y hash de jerarquía están en el JSON. `—` en In Place indica
que el archivo es personaje With Skin, no clip independiente.

| Archivo | Cambio | Tipo real | Rig | Acción medida | In Place | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| `Slow Run (1).fbx` | nuevo | Run Without Skin | `4a77fc45` | 44 frames, 0,72 s | **No**, Hips avanza 2,191 m | Rechazado: root motion y rest pose incompatible. |
| `Slow Run.fbx` | nuevo | Run Without Skin | `df062970` | 43 frames, 0,70 s | **No**, Hips avanza 2,053 m | Rechazado: root motion y rest pose incompatible. |
| `Strut Walking (1).fbx` | modificado | otro clip Without Skin | `f2d26b73` | 87 frames, 1,43 s | Sí | Strut no sustituye Walk normal; rest pose incompatible. |
| `Strut Walking (2).fbx` | nuevo | otro clip Without Skin | `96079a9c` | 87 frames, 1,43 s | Sí | Strut; rest pose incompatible. |
| `Strut Walking (3).fbx` | nuevo | otro clip Without Skin | `4a77fc45` | 87 frames, 1,43 s | Sí | Strut; rest pose incompatible. |
| `Strut Walking (4).fbx` | nuevo | otro clip Without Skin | `b3271363` | 87 frames, 1,43 s | Sí | Strut; rest pose incompatible. |
| `Strut Walking (5).fbx` | nuevo | otro clip Without Skin | `e95967cb` | 87 frames, 1,43 s | Sí | Strut; rest pose incompatible. |
| `Strut Walking (6).fbx` | nuevo | otro clip Without Skin | `0e97e0e1` | 86 frames, 1,42 s | Sí | Strut; rest pose incompatible. |
| `Strut Walking (7).fbx` | nuevo | otro clip Without Skin | `ad2296b6` | 86 frames, 1,42 s | Sí | Strut; rest pose incompatible. |
| `Strut Walking.fbx` | modificado | otro clip Without Skin | `a27fe321` | 87 frames, 1,43 s | Sí | Strut; rest pose incompatible. |
| `Walking (3).fbx` | nuevo | personaje With Skin | `a5e6f5c3` | marcha embebida, 58 frames | — | Candidato visual: ropa urbana negra. Faltan 3 clips compatibles. |
| `Walking (4).fbx` | nuevo | personaje With Skin | `6b4a670d` | marcha embebida, 58 frames | — | Candidata visual: polo gris y jean. Faltan 3 clips compatibles. |
| `Walking (5).fbx` | nuevo | personaje With Skin | `6b4a670d` | marcha embebida, 58 frames | — | Duplicado visual de `Walking (4)`. |
| `Walking (6).fbx` | nuevo | personaje With Skin | `2759ecca` | marcha embebida, 58 frames | — | Candidato visual: suéter azul; reemplaza al anterior `Walking.fbx`. |
| `Walking (7).fbx` | nuevo | personaje With Skin | `c46d15c8` | marcha embebida, 58 frames | — | Duplicado visual de `Dwarf Walk (3)`. |
| `Walking (8).fbx` | nuevo | personaje With Skin | `535ca6e1` | marcha embebida, 58 frames | — | Duplicado del personaje estilizado `Walk (1)`. |
| `Walking 1).fbx` | nuevo | personaje With Skin | `b0c0bc2c` | marcha embebida, 58 frames | — | Candidato visual: polo y shorts cargo. Faltan 3 clips compatibles. |
| `Walking 2).fbx` | nuevo | personaje With Skin | `2256c835` | marcha embebida, 58 frames | — | Duplicado visual de `Walk (6)`. |
| `Walking.fbx` | modificado | Walk Without Skin | `694f37aa` | 42 frames, 1,37 s | Sí, Hips avanza 0,00006 m | Rest pose incompatible con `Dwarf Walk (2)`. |
| `Walking1.fbx` | nuevo | personaje With Skin | `1f2b631f` | marcha embebida, 58 frames | — | Duplicado del personaje con uniforme deportivo de `Walk`. |
| `character.fbx` | nuevo | personaje With Skin | `008b2266` | ninguna acción | — | Misma apariencia que `Walking (1)`; solo pose base. |

La acción interna de los FBX With Skin se llama genéricamente
`Armature|mixamo.com|Layer0`. La descripción “marcha embebida” se basa en el
nombre de descarga y el rango de acción; **no** acredita un clip separado
Walk In Place. El conjunto actual tiene **24 FBX With Skin**, **0 Idle
Without Skin**, **1 Walking Without Skin**, **2 Slow Run Without Skin** y
**8 Strut Walking Without Skin**.

## Compatibilidad y movimiento

`mixamo_clip_compatibility.json` compara huesos, `(bone,parent)`, matrices de
reposo, transformaciones de armature y Hips. Hay grupos que comparten nombres
y jerarquía, pero **0 emparejamientos EXACT MATCH o COMPATIBLE** con un
personaje With Skin. Las diferencias máximas en matrices de reposo de las
parejas con nombre/jerarquía coincidente son al menos 4,82 unidades Blender;
el umbral de asignación directa del pipeline es 0,002. Ningún clip se asignó
a otro armature ni se cambió la rest pose de una malla.

Las once acciones Without Skin se muestrearon en nueve frames. Los ocho
Strut y Walking tienen desplazamiento horizontal neto de Hips de 0,00006 a
0,00318 m; los dos Slow Run tienen 2,053 y 2,191 m. Los Strut se rechazan
como reemplazo de Walk normal; Slow Run se rechaza por no ser In Place.
No se recibió Idle. No hay combinación Idle/Walk/Run completa que permita
iniciar una prueba de deformación o exportar un GLB final.

## Curación visual actual

La reevaluación solicitada acepta shorts y sudaderas cuando el conjunto es
cotidiano. Los **14 candidatos visualmente distintos** son:

| Presentación observada | Archivos representativos | Ropa/rol posible |
| --- | --- | --- |
| Mujer (7) | `Dwarf Walk (1)`, `Dwarf Walk (2)`, `Walk (2)`, `Walk (4)`, `Walk (5)`, `Walk (6)`, `Walking (4)` | Blazer, casaca, polo con jean, sudadera/shorts, casaca/leggings, traje azul; tienda o cliente. |
| Hombre (7) | `Dwarf Walk (3)`, `Dwarf Walk`, `Walking (1)`, `Walking (2)`, `Walking (3)`, `Walking (6)`, `Walking 1)` | Sudadera/joggers, blazer/jean, camiseta/shorts, polo/jean, streetwear, suéter/pantalón, polo/shorts cargo; tienda o cliente. |

La presentación es una descripción visual, no una afirmación de identidad.
Los siete candidatos de la primera curación se conservan por apariencia;
el archivo del suéter azul pasó de `Walking.fbx` a `Walking (6).fbx` porque
el primero fue reemplazado por un FBX de animación. No se cuentan copias del
mismo personaje con otra acción como modelos únicos. Dos personajes urbanos
visualmente distintos más harían falta incluso si los catorce llegaran a
aprobar todas las pruebas técnicas; **hoy faltan 16 modelos aprobados**.

Los descartes vigentes adicionales son: `Reloading.fbx` (recarga y casco
fuera del rol), `Walk (1).fbx` y `Walk (3).fbx` (estilo caricaturesco),
`Walk.fbx` y `Walking1.fbx` (uniforme deportivo blanco), y las copias
enumeradas en la tabla diferencial. Los archivos de animación rechazados no
se usan como personajes.

## Entrega y pruebas

`assets/models/npc/manifest.pending.json` conserva 16 plazas con
`archivo: null`. No se creó GLB final ni manifest de producción: 0 plazas
completadas, 16 pendientes, 0 duplicados publicados. Los archivos Mixamo
permanecen en el directorio privado ignorado por Git. La procedencia
individual de los catorce candidatos se registra en `CREDITS.md`; los FBX
no aportan nombre o autor original verificable.

No se ejecutó la comprobación de deformación con Idle/Walk/Run, inspección
de GLB ni carga de tres clips en el juego: ningún personaje reúne los clips
requeridos. Esto es **pendiente**, no PASS. El fallo anterior de
`continuous_world.cjs` en una colisión de Tienda queda fuera de alcance.

## Validación de esta continuación

- SHA-256 de los 35 FBX actuales frente al inventario, reparto 24/11,
  catorce candidatos visuales, once clips medidos, cero parejas compatibles
  y dieciséis plazas honestamente pendientes: **PASS**.
- Compilación Python de los scripts del pipeline: **PASS**.
- `node --check simulator3d.js` y tests de navegador modificados en la fase
  anterior: **PASS**.
- `node --test tests/*.test.js tests/*.test.mjs tests/world_finance.test.cjs`:
  **193 PASS, 0 FAIL, 3 SKIP**. Los tres SKIP requieren un manifest GLB final.
- `supplied_npcs`, `world_entry_assets`, `world_loading` y `playable_hub`:
  no se repitieron en esta continuación porque el usuario pidió ejecutarlos
  **una vez existan GLB finales**; ninguno existe. Su última ejecución en el
  estado anterior fue PASS.
- `continuous_world`: último resultado anterior FAIL por colisión en Tienda;
  no se ejecutó ni modificó aquí.
