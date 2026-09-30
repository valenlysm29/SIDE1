# Curación del lote Mixamo recibido, 29 de septiembre de 2026

**Histórico del primer lote de 17 FBX.** El inventario cerrado posterior de
35 FBX y las decisiones vigentes están en [mixamo_delta_2026-09-29.md](mixamo_delta_2026-09-29.md).

El inventario actual contiene 17 FBX, todos **With Skin**: una armature,
de 1 a 8 mallas vinculadas al esqueleto y una acción principal de nombre
interno genérico `Armature|mixamo.com|Layer0`. No hay ningún FBX separado
**Without Skin** para Idle, Walking o Running. Los nombres de archivo no
demuestran por sí mismos el tipo ni la propiedad In Place de una acción.
Los datos por archivo, incluidos SHA-256, huesos, jerarquía, matrices de
reposo, FPS cuando se midió y errores de importación, están en
`reports/mixamo_current_inventory.json`; el detalle bruto de Blender está
en `reports/mixamo_inventory/`. Las vistas existentes están en
`tests/output/mixamo_curate/`.
Las huellas de nombres y jerarquía agrupan estos 17 esqueletos en **12
familias**. Coincidir en cantidad de huesos (16 archivos tienen 65; uno
tiene 67) no demuestra compatibilidad de rest pose. Ninguna combinación
personaje/clip se declara compatible sin los FBX de animación separados.

## Candidatos de ropa urbana (aún sin aprobación técnica completa)

| FBX original | Presentación observada | Vestuario | Rol sugerido | Falta |
| --- | --- | --- | --- | --- |
| `Dwarf Walk (1).fbx` | mujer | blazer azul oscuro, pantalón beige | tienda | Idle, Walk normal validado, Run y deformación |
| `Dwarf Walk (2).fbx` | mujer | casaca clara, pantalón oscuro | cliente | Idle, Walk normal validado, Run y deformación |
| `Dwarf Walk.fbx` | hombre | blazer, jean | tienda | Idle, Walk normal validado, Run y deformación |
| `Walk (2).fbx` | mujer | polo rayado, jean | cliente | Idle, Walk In Place validado, Run y deformación |
| `Walk (6).fbx` | mujer | traje azul de oficina | tienda | Idle, Walk In Place validado, Run y deformación |
| `Walking (2).fbx` | hombre | polo gris, jean | cliente | Idle, Walk In Place validado, Run y deformación |
| `Walking.fbx` | hombre | suéter azul oscuro, pantalón | cliente | Idle, Walk In Place validado, Run y deformación |

Los siete personajes son visualmente distintos. Hay cuatro de presentación
femenina y tres masculina; ninguna ficha afirma identidad de género, edad,
etnia o autor original que no se pueda verificar. No se convierten en
aprobados por tener una acción Walk integrada. Las acciones Dwarf Walk y
Strut Walking no sustituyen al Walk normal solicitado.

## Descartes visuales o de acción

| Archivo | Motivo concreto |
| --- | --- |
| `Dwarf Walk (3).fbx` | Conjunto de entrenamiento gris con capucha; Dwarf Walk no es Walk normal. |
| `Reloading.fbx` | La acción de recarga no sirve como Idle, Walk ni Run; casco sin rol de seguridad establecido. |
| `Strut Walking (1).fbx` | Atuendo deportivo negro ceñido; Strut Walking no sustituye Walk normal. |
| `Strut Walking.fbx` | Camiseta y shorts de aspecto menos realista; Strut Walking no sustituye Walk normal. |
| `Walk (1).fbx` | Figura muy estilizada, gafas y atuendo fuera del estilo cotidiano de SIDE. |
| `Walk (3).fbx` | Figura muy estilizada, gafas y atuendo fuera del estilo cotidiano de SIDE. |
| `Walk (4).fbx` | Sudadera con shorts deportivos; no corresponde a los roles empresariales previstos. |
| `Walk (5).fbx` | Chaqueta deportiva con leggings; ropa de ejercicio. |
| `Walk.fbx` | Camiseta con shorts deportivos; no corresponde a los roles previstos. |
| `Walking (1).fbx` | Camiseta con shorts deportivos; no corresponde a los roles previstos. |

Todos los FBX, incluidos los diez descartados visualmente, carecen en este
lote de Idle y Run separados. La compatibilidad de rigs, la pose de reposo
entre personaje y clips, el movimiento horizontal In Place y la deformación
con los tres clips **no se pueden aprobar sin esos archivos**. No se ha
generado GLB final, por lo que el manifest de producción permanece ausente
y las 16 plazas de `manifest.pending.json` siguen vacías.

Para continuar hacen falta exportaciones Mixamo **Without Skin, In Place**
de Idle, Walk normal y Running compatibles con cada rig, y al menos nueve
personajes urbanos adicionales con una presentación equilibrada (el lote
actual de siete candidatos tiene cuatro mujeres y tres hombres). Se deben
conservar los FBX originales privados en `incoming/mixamo/`.

## Validación ejecutada

- Importación Blender 5.2.2 de los 16 FBX que aún no tenían informe detallado:
  1 armature y todas las mallas skinned en cada archivo, sin error técnico
  de importación. `Walk.fbx` reutilizó su informe válido anterior.
- Comprobación estructurada: 17 hashes de FBX distintos, 7 candidatos
  visuales, 16 plazas todavía `null`: **PASS**.
- `node --check` en los módulos y tests modificados: **PASS**.
- `node --test tests/*.test.js tests/*.test.mjs tests/world_finance.test.cjs`:
  **193 pass, 0 fail, 3 skip**. Los tres skip exigen GLB finales ausentes.
- Regresión de navegador `playable_hub.cjs`, `world_loading.cjs`,
  `world_entry_assets.cjs`, `supplied_npcs.cjs`: **PASS** tras actualizar
  aserciones que contaban avatares elegibles como NPC y trataban los manifests
  opcionales vacíos como errores.
- Regresión `continuous_world.cjs`: **FAIL** al intentar caminar en línea recta
  desde `(131,19)` a `(126,19.15)` dentro de Tienda; el jugador se detiene en
  `(129.206,19.15)`. No se cambió la geometría ni la ruta desde esta tarea de
  curación. La causa exacta de la colisión requiere una revisión separada.
- Rest pose comparada con clips separados, In Place, deformación en cinco
  muestras por clip y GLB final: **no ejecutables** porque faltan Idle,
  Walk normal separado y Running; no se registran como PASS.
