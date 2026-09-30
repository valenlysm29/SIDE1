# Fase F: rendimiento y validación de NPC

Fecha: 29-09-2026.

Actualización posterior: se integraron seis GLB urbanos en
`assets/models/npc/manifest.json`, con 7 961 900 bytes en conjunto.
La comprobación de contrato de los seis modelos pasó: archivos distintos,
skin y clips Idle/Walk/Run reales. Las cifras de FPS que siguen pertenecen a
la fase anterior, con cero modelos nuevos; no miden el rendimiento de este lote.

## Estado medido

En la medición original no había `assets/models/npc/manifest.json` ni modelos
NPC nuevos publicados. Por ello esa medición no permite certificar el coste GPU
de los seis GLB integrados después ni la antigua meta de 16 modelos distintos.

Los tiers conservan sus límites de clientes simultáneos: Baja 5, Media 8,
Alta 10 y Auto 8 (`simulator3d-config.js`). El pool procedural se limita al
tier y los NPC GLB se liberan al reciclarlos. Las geometrías y materiales
compartidos del template no se destruyen con cada clon. Las poses de NPC
distantes se actualizan a menor frecuencia y el mixer de un NPC fuera de la
vista deja de avanzar; el movimiento y la lógica siguen funcionando.

## FPS en Media

El script `tests/npc_fps_benchmark.cjs` se ejecutó en el mismo Chrome
headless con ANGLE SwiftShader y vista 1280×800 que la medición base del
proyecto. La base comunicada fue una mediana de **1 FPS**. Tras los cambios,
las cuatro muestras fueron **1, 1, 1 y 2 FPS** (mediana **1 FPS**), con
**0 NPC** activos y «RUTA SEGURA». No es una medición capaz de verificar la
degradación máxima del 10 %: SwiftShader está saturado y el contador redondea
a FPS enteros; además no se renderizó ningún modelo nuevo. Debe repetirse en
GPU real, misma cámara, mismo número de NPC y misma tier Media cuando se
incorporen los 16 GLB.

## Pruebas

- `node --check simulator3d.js` y módulos/contrato nuevos: correctos.
- Suite `node --test tests/*.test.js tests/*.test.mjs tests/world_finance.test.cjs` desde `SIDE1`:
  **196 pruebas, 193 aprobadas, 0 fallidas, 3 omitidas**. Las tres omitidas
  comprueban manifest, clips y hash/archivos al existir modelos aprobados.
- `tests/npc_city_roster.test.mjs` cubre sorteo sin reemplazo y bolsas
  independientes por escena.
- `tests/business_interiors.test.mjs` recorre el ciclo completo del mensajero
  y comprueba colisiones y continuidad sin modificar la reserva.
- `tests/npc_manifest_contract.test.mjs` no representa los 16 modelos como
  entregados: afirma cero cuando falta manifest. Cuando se publique uno,
  exigirá al menos 16 IDs únicos, archivos GLB reales, clips idle/walk/run
  presentes en manifest y GLB, y hashes distintos de todos los avatares
  elegibles y entre NPC.

No se ejecutó `supplied_npcs.cjs` porque escribe resultados e imágenes en
`tests/output/npcs/`; los artefactos preexistentes de `tests/output/` no se
modificaron en esta fase.
