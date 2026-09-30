# Curación de NPC urbanos para SIDE

Estado: **6 modelos urbanos aprobados e integrados** (3 mujeres y 3 hombres). Se descargaron del espejo GitHub [FreeModels](https://github.com/agentkaerf/FreeModels), se contrastó la licencia CC0 con las páginas oficiales de [Women](https://quaternius.com/packs/ultimatemodularwomen.html) y [Men](https://quaternius.com/packs/ultimatemodularcharacters.html), se renderizó cada candidato para revisar la ropa y se conservaron solo seis con pantalón. Cada GLB tiene skin y 24 clips, incluidos Idle, Walk y Run. El inventario Mixamo previo sigue descrito en [mixamo_delta_2026-09-29.md](mixamo_delta_2026-09-29.md).

## Modelos elegibles que quedan excluidos

El selector actual usa exactamente `chico1`, `chico2`, `chico3` y `mona` ([catálogo](../services/character_manager.mjs)). Sus archivos son `assets/models3d/npcs/chico1.glb`, `chico2.glb`, `chico3.glb` y `mona.glb`. Ninguno debe figurar en el nuevo manifest NPC, aunque el juego hoy también cree instancias no jugables de algunos.

## Criterio de aceptación visual

| Rol | Ropa admitida | Se descarta |
| --- | --- | --- |
| Cliente y transeúnte | Polo, camisa, blusa, jean, pantalón, falda o vestido cotidiano, casaca ligera, zapatillas o zapatos urbanos | Fantasía, armadura, militar, superhéroe, disfraz, traje de baño, deporte extremo |
| Tienda | Camisa y pantalón de vestir, traje, blazer o chaleco formal, zapatos | Atuendo ceremonial, aventura, ropa de combate |
| Almacén | Polo o camisa sencilla, chaleco de trabajo, pantalón resistente, calzado cerrado; casco solo para rol que lo requiera | Armadura, uniforme militar, casco decorativo |
| Producción | Polo, camisa o blusa de trabajo, pantalón cómodo, calzado cerrado; protección solo si la tarea lo requiere | Ropa ajena al trabajo textil |

Meta de distribución para 16 modelos únicos: ocho presentaciones femeninas y ocho masculinas, al menos cuatro apariencias de edades adultas, varias complexiones y tonos de piel claros, medios y oscuros repartidos entre roles. Estos rasgos se registrarán **por observación del modelo**, sin inferir etnia ni identidad de género de una etiqueta de archivo. `género` indicará la presentación visual útil para el casting; `no determinado` será válido si no se aprecia.

## Fuentes oficiales y decisión provisional

| Lote | Información publicada por el autor | Decisión de curación |
| --- | --- | --- |
| [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) ([itch.io](https://quaternius.itch.io/universal-base-characters)) | La página describe seis bases en proporciones Regular, Teen y Superhero; el ZIP **Standard recibido contiene solamente Superhero Female y Male** y peinados. `License_Standard.txt` confirma CC0. | Ambos cuerpos llevan ropa interior y silueta de superhéroe, según `Preview.png`; ninguno sirve de NPC urbano vestido. Los otros cuatro cuerpos descritos en la página no están en el ZIP Standard. |
| [Ultimate Modular Men](https://quaternius.com/packs/ultimatemodularcharacters.html) y [Women](https://quaternius.com/packs/ultimatemodularwomen.html) | Personajes modulares con 24 animaciones por modelo, CC0; glTF disponibles en [FreeModels](https://github.com/agentkaerf/FreeModels). | Se aprobaron 3 hombres y 3 mujeres con ropa apropiada para sus roles. |
| [Mixamo](https://www.mixamo.com/) | El usuario descargará personajes vestidos manualmente en `assets/models/incoming/mixamo/`. | Revisar ropa y licencia de cada descarga recibida. No registrar un modelo ausente. |
| [En3D](https://github.com/menyifang/En3D) | Código del repositorio; la licencia de avatares y pesos requiere confirmación separada. | **Bloqueado** para uso hasta confirmación escrita de ambas licencias; tampoco puede cerrar la meta de 16 aún. |

## Inventario aprobado

| ID | Archivo fuente | Rol | Presentación | Edad aparente | Complexión | Tono de piel | Ropa dominante | Decisión |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `city_woman_casual` | `quaternius-city/woman_casual.gltf` | cliente | Mujer | Adulta | Media | Clara | Camiseta, pantalón naranja, zapatillas | Aprobado |
| `city_man_casual` | `quaternius-city/man_casual.gltf` | cliente | Hombre | Adulto | Media | Clara | Polo gris, jean, zapatillas | Aprobado |
| `city_woman_suit` | `quaternius-city/woman_suit.gltf` | tienda | Mujer | Adulta | Media | Clara | Blazer, pantalón negro | Aprobado |
| `city_man_suit` | `quaternius-city/man_suit.gltf` | tienda | Hombre | Adulto | Media | Clara | Traje oscuro con pantalón | Aprobado |
| `city_woman_worker` | `quaternius-city/woman_worker.gltf` | producción | Mujer | Adulta | Media | Clara | Chaleco, pantalón y casco | Aprobado |
| `city_man_worker` | `quaternius-city/man_worker.gltf` | almacén | Hombre | Adulto | Media | Clara | Chaleco, pantalón y casco | Aprobado |

## Inventario descartado o bloqueado

| Modelo o lote | Motivo |
| --- | --- |
| `chico1.glb`, `chico2.glb`, `chico3.glb`, `mona.glb` | Avatares elegibles existentes: prohibido repetirlos. |
| `Superhero_Female_FullBody.gltf` / `.fbx` | Presentación femenina; edad aparente adulta; complexión atlética muy musculosa; piel con variantes claras y oscuras; ropa dominante: ropa interior negra. No apta para cliente ni trabajo empresarial. Los dos formatos son el mismo modelo; el glTF tiene skin pero **0 clips**. |
| `Superhero_Male_FullBody.gltf` / `.fbx` | Presentación masculina; edad aparente adulta; complexión muy musculosa; piel con variantes claras y oscuras; ropa dominante: bóxer negro, torso desnudo. No apto para cliente ni trabajo empresarial. Los dos formatos son el mismo modelo; el glTF tiene skin pero **0 clips**. |
| Peinados y cejas del mismo ZIP | Accesorios sin cuerpo ni vestimenta; no constituyen modelos NPC distintos. |
| Universal Animation Library 2 | Es una biblioteca de clips y maniquí, no personajes vestidos. |
| `Casual_Hoodie` hombre | Sudadera con pantalón corto; se exigió pantalón largo para este lote. |
| `Formal` mujer | Vestido; no cumple la preferencia de polo/camisa y pantalón del usuario. |
| `Punk` hombre y mujer | Estilo llamativo y pantalones rotos; no encaja con el reparto cotidiano seleccionado. |
| Muestra En3D | Pendiente de licencia escrita de avatares y pesos, además de curación visual. |
| Mixamo recibido después de esta fase | Véase el reporte diferencial Mixamo: 24 FBX With Skin, 11 animaciones Without Skin; falta Idle, Walk compatible y Run compatible In Place. |

La inspección visual original de las bases se basó en `base-characters/Universal Base Characters[Standard]/Preview.png`. La revisión de los seis modelos aprobados se hizo con renders de sus glTF exactos. El objetivo previo de 16 apariencias distintas sigue incumplido: hay seis modelos nuevos reales, sin contar recolores como modelos adicionales.

`assets/models/npc/manifest.json` registra los seis GLB entregados. `manifest.pending.json` sigue siendo una lista separada de candidatos Mixamo sin aprobar.
