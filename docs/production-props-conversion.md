# Tanda 4: conversión de props de Tienda y Producción

El pipeline reproducible es `python tools/prepare_production_props.py`. Valida
los hashes SHA-256 de los seis archivos fuente antes de procesarlos y genera dos
modelos originales de SIDE. Todas las salidas usan metros, eje Y vertical,
origen en la base (`Y=0`), centro en X/Z, datos embebidos y cero texturas.

## GLB nuevos

| Archivo | Licencia / autor | Bytes | Triángulos | Geometrías | Materiales |
| --- | --- | ---: | ---: | ---: | ---: |
| `shop_entry_door.glb` | CC0-1.0, Kenney | 11.172 | 156 | 4 | 4 |
| `shop_window_panel.glb` | CC0-1.0, Kenney | 11.940 | 152 | 7 | 4 |
| `shop_ceiling_light.glb` | CC0-1.0, Kenney | 5.008 | 60 | 2 | 2 |
| `shop_atm.glb` | CC BY 3.0, J-Toastie | 42.040 | 702 | 6 | 6 |
| `production_garment_rack.glb` | CC0-1.0, Kenney | 9.604 | 190 | 1 | 1 |
| `production_mannequin.glb` | CC0-1.0, reyshapes | 11.408 | 462 | 1 | 1 |
| `production_overlock_machine.glb` | Original SIDE | 10.028 | 288 | 12 | 4 |
| `production_ironing_station.glb` | Original SIDE | 11.196 | 224 | 15 | 4 |

Total nuevo: **112.396 bytes (109,76 KiB), 2.234 triángulos, 48 geometrías**.
Está por debajo del objetivo ideal de 180 KiB y del máximo contractual de
350 KiB.

El ATM se modificó para normalizar escala, origen y materiales, conforme a su
atribución CC BY 3.0. La overlock y la estación de planchado son diseños
low-poly originales generados por el propio pipeline.

## Assets reutilizados sin duplicar

| Archivo existente | Licencia | Bytes | Triángulos | Geometrías | Materiales |
| --- | --- | ---: | ---: | ---: | ---: |
| `warehouse_sewing_machine.glb` | Original SIDE | 13.264 | 432 | 12 | 4 |
| `warehouse_cutting_table.glb` | CC0-1.0, Kenney | 15.580 | 226 | 5 | 4 |
| `warehouse_fabric_rolls.glb` | CC BY 3.0, Poly by Google | 48.756 | 1.968 | 1 | 1 |
| `warehouse_rack_tall.glb` | CC0-1.0, Quaternius | 20.304 | 536 | 3 | 3 |
| `warehouse_pendant_light.glb` | CC0-1.0, Quaternius | 8.416 | 269 | 3 | 3 |

Total reutilizado: **106.320 bytes, 3.431 triángulos**. El coste efectivo de los
13 GLB únicos disponibles para la tanda es **218.716 bytes (213,59 KiB) y 5.665
triángulos**; los cinco reutilizados ya se distribuían desde la Tanda 2 y no se
copian ni se vuelven a generar.

## Reproducibilidad y validación

Dos ejecuciones consecutivas produjeron hashes SHA-256 idénticos para los ocho
GLB nuevos. El reporte completo, incluidos bounds, escala, hashes, materiales y
checks de autocontención, está en `docs/production-props-validation.json`.
