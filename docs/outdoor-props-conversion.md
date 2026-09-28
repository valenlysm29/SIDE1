# Tanda 3: conversión de props exteriores

`tools/prepare_outdoor_props.py` normaliza los 12 GLB CC0 seleccionados en
`.codex-work/asset-staging/outdoor-selected-source/` y escribe los resultados
en `assets/models3d/props/`. El área de staging no se modifica.

## Criterios

- Sistema diestro, Y arriba y unidades en metros.
- Origen en la base (`Y=0`) y centro geométrico en X/Z.
- Nombres deterministas `outdoor_*` y verificación SHA-256 de cada fuente.
- Conservación de geometría low-poly y grupos de materiales originales.
- Transformaciones de nodos aplanadas y vértices no referenciados eliminados.
- GLB autocontenidos: sin archivos ni texturas externas.
- La banca se ensancha únicamente sobre X después de normalizar su altura para
  corregir las proporciones demasiado estrechas del archivo fuente.

## Resultado

- 12 GLB, 130.772 bytes (127,71 KiB), 2.928 triángulos y 20 geometrías.
- Cero texturas embebidas y cero URI externas.
- Todos los modelos son CC0 1.0. Las evidencias y URLs exactas están en el
  manifiesto del staging y en `CREDITS.md`.
- El lote queda por debajo del objetivo ideal de 200 KiB y del máximo de
  350 KiB.

El detalle por asset —hash, medidas, triángulos, geometrías, materiales y
comprobaciones— está en `docs/outdoor-props-validation.json`.

## Reproducción y determinismo

Desde la raíz `SIDE1`:

```powershell
python tools/prepare_outdoor_props.py
```

La conversión se ejecutó dos veces consecutivas. Los SHA-256 de los 12 GLB y
del reporte JSON fueron idénticos entre ambas ejecuciones.
