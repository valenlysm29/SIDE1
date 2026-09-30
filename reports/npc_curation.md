# Curación de NPC urbanos para SIDE

Estado: **0 modelos aprobados para producción**. Este documento recoge la fase Quaternius Standard. El inventario Mixamo actual de 35 FBX, con 14 candidatos visuales y clips incompatibles o faltantes, se detalla en [mixamo_delta_2026-09-29.md](mixamo_delta_2026-09-29.md). Una ficha solo se aprueba si el archivo existe, se ve vestido para su zona y tiene licencia confirmada. No se cuentan cambios de color o escala como modelos distintos.

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
| [Ultimate Modular Men](https://quaternius.com/packs/ultimatemodularcharacters.html) | Once personajes modulares, 24 animaciones, CC0. | Revisar cada combinación de cuerpo y prendas. Puede aportar varones urbanos y trabajadores; no aporta por sí solo equilibrio femenino. |
| [Mixamo](https://www.mixamo.com/) | El usuario descargará personajes vestidos manualmente en `assets/models/incoming/mixamo/`. | Revisar ropa y licencia de cada descarga recibida. No registrar un modelo ausente. |
| [En3D](https://github.com/menyifang/En3D) | Código del repositorio; la licencia de avatares y pesos requiere confirmación separada. | **Bloqueado** para uso hasta confirmación escrita de ambas licencias; tampoco puede cerrar la meta de 16 aún. |

## Inventario aprobado

| ID | Archivo fuente | Rol | Presentación | Edad aparente | Complexión | Tono de piel | Ropa dominante | Decisión |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — | — | — | Ningún modelo aprobado. El ZIP Standard recibido no incluye personajes con ropa de ciudad. |

## Inventario descartado o bloqueado

| Modelo o lote | Motivo |
| --- | --- |
| `chico1.glb`, `chico2.glb`, `chico3.glb`, `mona.glb` | Avatares elegibles existentes: prohibido repetirlos. |
| `Superhero_Female_FullBody.gltf` / `.fbx` | Presentación femenina; edad aparente adulta; complexión atlética muy musculosa; piel con variantes claras y oscuras; ropa dominante: ropa interior negra. No apta para cliente ni trabajo empresarial. Los dos formatos son el mismo modelo; el glTF tiene skin pero **0 clips**. |
| `Superhero_Male_FullBody.gltf` / `.fbx` | Presentación masculina; edad aparente adulta; complexión muy musculosa; piel con variantes claras y oscuras; ropa dominante: bóxer negro, torso desnudo. No apto para cliente ni trabajo empresarial. Los dos formatos son el mismo modelo; el glTF tiene skin pero **0 clips**. |
| Peinados y cejas del mismo ZIP | Accesorios sin cuerpo ni vestimenta; no constituyen modelos NPC distintos. |
| Universal Animation Library 2 | Es una biblioteca de clips y maniquí, no personajes vestidos. |
| Ultimate Modular Men | Lote aún ausente de `incoming`; no se aprueba por ficha web ni por nombre de archivo. |
| Muestra En3D | Pendiente de licencia escrita de avatares y pesos, además de curación visual. |
| Mixamo recibido después de esta fase | Véase el reporte diferencial Mixamo: 24 FBX With Skin, 11 animaciones Without Skin; falta Idle, Walk compatible y Run compatible In Place. |

La inspección visual se basó en `base-characters/Universal Base Characters[Standard]/Preview.png`, que muestra exactamente los dos cuerpos disponibles en el ZIP Standard con ropa interior, y en la lista de archivos de `Base Characters/Godot - UE` y `Base Characters/Unity`. El objetivo de 16 se considera incumplido mientras no existan 16 modelos distintos, vestidos, inspeccionados y licenciados. No se atribuyen edades, complexiones ni tonos de piel a modelos que no se han recibido.

`assets/models/npc/manifest.pending.json` reserva 16 plazas (8 mujeres y 8 hombres) por rol. No es el manifiesto de producción ni cuenta como modelos entregados; sus rutas permanecen vacías hasta recibir, inspeccionar y convertir cada FBX.
