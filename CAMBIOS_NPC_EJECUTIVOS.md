# Variedad de personal de tienda (asesor/a) en el simulador 3D

Continúa la reforma descrita en `REFORMA_3D_2026_09_10.md` (reemplazar los NPC
clonados del único modelo Mixamo por variedad de personajes). Este cambio se
enfoca en el **personal de tienda** (`buildSalesStaff()`), usando como
referencia dos imágenes de vestuario ejecutivo aportadas por el usuario.

## Qué cambió en `simulator3d.js`

- **`STAFF_LOOKS`** (nuevo, junto a `CUSTOMER_ARCHETYPES`): dos configuraciones
  de vestuario distintas en vez del uniforme genérico único:
  - Asesor: saco/traje azul marino (`0x2c4a72`), pantalón a juego, corbata
    celeste, cabello oscuro, **lentes**.
  - Asesora: blazer/chaleco crema sin mangas (`0xf2ede2`), pantalón sastre
    beige (`0xc9a877`), cabello oscuro largo y ondulado, **botones** al frente
    en vez de corbata.
- **`person(cfg)`**: ahora acepta `cfg.forceProcedural` para omitir el clon del
  avatar Mixamo (`assets/models/yuka.glb`) y usar siempre el cuerpo
  procedural — necesario para que lentes, botones y cabello largo queden bien
  ubicados (el clon animado no expone puntos de anclaje para accesorios).
- Nuevo soporte de accesorios en el cuerpo procedural: `cfg.glasses` (aros +
  puente), `cfg.longHair` (mechones laterales además del cabello trasero) y
  `cfg.buttons` (fila de botones al frente, alternativa a la corbata).
- **`buildSalesStaff()`**: en vez de generar los N asesores con la misma
  configuración (`shirt/pants/tie` fijos, solo alternando género), ahora
  alterna entre los dos looks de `STAFF_LOOKS`.

Sin cambios en la lógica económica: `CUSTOMER_ARCHETYPES`, `salesStaff()` y el
resto del sistema de decisiones/ventas quedan intactos. Validado con
`node --check simulator3d.js` y `node --test tests/*.test.js` (62/62 OK).

## Modelos GLB nuevos (opcional, fuera del simulador Three.js)

`tools/generate_models_glb_v3.py` — mismo estilo low-poly/PBR por primitivas
que `generate_models_glb_v2.py` — genera dos modelos GLB independientes con el
mismo diseño, por si se quieren usar fuera del navegador (vista previa en
Blender, otro motor, etc.):

- `assets/models3d/npc_exec_male.glb`
- `assets/models3d/npc_exec_female.glb`

Estos dos archivos **no** se cargan automáticamente en `simulator3d.js` (que
construye el personal de tienda con geometría Three.js en tiempo real vía
`person()`), se entregan como modelado 3D independiente de los personajes de
referencia.
