# Conversión de props — Tienda

La primera tanda se genera con `python tools/prepare_shop_props.py`. El script
consume únicamente los GLB seleccionados y con evidencia local de licencia en
`.codex-work/asset-staging/shop-selected-source/`.

## Decisiones técnicas

- Sistema de coordenadas: mano derecha, eje Y vertical y unidades en metros.
- Origen: centro del footprint en X/Z y base exacta del modelo en Y = 0.
- Escala: alturas reales de referencia (0,75 m para la mesa, 0,95 m para el
  mostrador, 1,85/0,92 m para estantes, 0,88 m para el espejo y 0,32 m para la
  caja registradora).
- Orientación: se conserva el frente original de cada asset; la escena puede
  rotar instancias alrededor de Y sin compensaciones adicionales.
- Geometría: se conservan los modelos low-poly originales, se aplican y
  aplanan sus transformaciones y se eliminan vértices no referenciados. No se
  mezclan grupos con materiales distintos.
- Espejo: se reduce únicamente su grosor para que funcione como pieza mural,
  manteniendo sus proporciones visibles.
- Formato: GLB autocontenido, sin texturas externas. El script rechaza salidas
  vacías, descentradas, sin materiales, mayores de 1 MiB o con altura errónea.

Los resultados de cada ejecución quedan en
`docs/shop-props-validation.json`, con hashes SHA-256, bounds, dimensiones,
triángulos, materiales, texturas, tamaño y el estado de cada validación.

## Salidas

- `assets/models3d/props/shop_table_display.glb`
- `assets/models3d/props/shop_checkout_counter.glb`
- `assets/models3d/props/shop_checkout_counter_end.glb`
- `assets/models3d/props/shop_shelf_tall.glb`
- `assets/models3d/props/shop_shelf_low.glb`
- `assets/models3d/props/shop_mirror_wall.glb`
- `assets/models3d/props/shop_cash_register.glb`

La procedencia y las obligaciones de atribución se documentan en `CREDITS.md`;
este documento solo cubre la transformación técnica.
