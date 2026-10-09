# Continuación local de NPC Quaternius — 09-10-2026

Se incorpora únicamente `city_man_farmer`. El manifiesto pasa de 16 a 17 NPC (8 mujeres, 9 hombres); se conservan las 16 entradas y los hashes de sus GLB. No se modifica el selector, los archivos ni los manifiestos fuente de `chico1`, `chico2`, `chico3` y `mona`. `manifest.pending.json` conserva su contenido previo: sus 20 plazas pertenecen al trabajo Mixamo y no son el catálogo CC0.

## Validación de los archivos entrantes

Se revisaron los informes de curación, rendimiento, Formal y Hoodie y el README del pipeline. Los únicos glTF adicionales del lote Quaternius-city eran Farmer y los dos Punk. Las carpetas `quaternius/modular-women` y `quaternius/animated-women` están vacías; las bases Superhero y la biblioteca de animación conservan su exclusión previa, sin generar personajes o clips nuevos.

Se aplicaron las mismas transformaciones de `build_city_npcs.cjs`: `dedup()`, `prune()` y `textureCompress` con Sharp, 1024 px y calidad 85. Se usó un conversor local aislado en `tests/output/quaternius-2026-10-09/convert.cjs` para no reconstruir ni sobrescribir los 16 GLB previos. Después se ejecutó **el script actual `validate_npc_glb.py`, sin cambiar umbrales**, en Blender 5.2.2 LTS sobre los tres GLB. Cada validación produjo `REVIEW_REQUIRED`, sin errores; se revisaron visualmente los nueve PNG Idle/Walk/Run antes de tomar las decisiones siguientes.

| Candidato | Bytes GLB | Rig, clips y raíz | Revisión visual | Decisión |
| --- | ---: | --- | --- | --- |
| `man_farmer` | 1 243 692 | Correctos | Camisa, overol, botas cerradas; sombrero de trabajo. Poses sin colapso o estiramiento visible. | Aprobado como proveedor, rol base almacén; no se asigna a caja, oficina o banco. |
| `man_punk` | 1 245 136 | Correctos | Chaleco sin mangas y jean roto; se confirma la exclusión de vestuario previa. | Excluido; sin entrada de manifiesto ni GLB de producción. |
| `woman_punk` | 1 293 328 | Correctos | Top y pantalón roto; se confirma la exclusión de vestuario previa. | Excluida; sin entrada de manifiesto ni GLB de producción. |

Farmer tiene 5 476 triángulos, texturas contenidas en el GLB y los 24 clips originales, incluyendo Idle, Walk y Run. La altura de catálogo es 1,76 m, consistente con los otros personajes masculinos de este pack. No se sintetizaron animaciones ni se mezclaron rigs. El archivo se distingue por SHA-256 de los avatares del jugador y de todos los NPC previos. Total del catálogo: **15 684 432 bytes**.

## Procedencia

La página oficial de [Ultimate Modular Men](https://quaternius.com/packs/ultimatemodularcharacters.html) identifica el pack de Quaternius bajo CC0. Se cotejó el archivo local con [Farmer.gltf del espejo](https://github.com/agentkaerf/FreeModels/blob/main/Ultimate%20Modular%20Men-%20Feb%202022/Individual%20Characters/glTF/Farmer.gltf): ambos tienen SHA-256 `46d3e85fa8d848ee479ab8e4672c16724ee4ea51f3af5733705a153937f93555`. El GLB final tiene SHA-256 `f8de24356098eb479d882f22f87e3a0d485f9bc828352adfc1e0e901ce4618ca`. La declaración de licencia y la diferencia entre inventario histórico y actual quedan registradas en [SOURCE_VERIFICATION.md](../LICENSES/SOURCE_VERIFICATION.md).

## Evidencia y límites

- Verificación final: **14 pruebas aprobadas, 0 fallos** mediante `node --test tests/npc_manifest_contract.test.mjs tests/npc_city_pack.test.mjs tests/npc_city_roster.test.mjs tests/npc_clip_controller.test.mjs tests/npc_streaming.test.mjs`. Se comprobaron también la igualdad de las 16 entradas previas, sus hashes GLB, los cuatro hashes de avatares, el manifiesto pendiente y el inventario del directorio contenedor; sin cambios fuera de SIDE1.
- [Evidencia JSON](quaternius_validation_2026-10-09.json): muestras de geometría, deriva de Hips, inventario de texturas, revisión visual, decisiones y hashes.
- `tests/output/quaternius-2026-10-09/`: línea base, GLB candidatos, informes numéricos y nueve renders. El script `approve.cjs` registra la incorporación; es un script de una sola ejecución protegido contra sobrescrituras.
- Los informes previos Formal y Hoodie se conservan. Formal quedó en `REVIEW_REQUIRED`; Hoodie tiene un fallo de profundidad en la validación original y otro informe relajado. No se usan para justificar nuevas aprobaciones ni se retiran sus entradas previas en esta continuación.
- La revisión visual usa una pose intermedia por clip y cinco muestras numéricas. No sustituye una inspección de todo el ciclo ni una medición de rendimiento en GPU. No se afirma que esta tanda haya revalidado los 16 NPC existentes.
