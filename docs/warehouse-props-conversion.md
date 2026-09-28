# Conversión de props — Almacén

La segunda tanda se genera con `python tools/prepare_warehouse_props.py`. El
pipeline verifica por SHA-256 los 16 GLB externos contra el manifiesto de
selección y exige la evidencia local de las licencias CC0 y CC BY 3.0 antes de
crear una salida.

## Decisiones técnicas

- Sistema de coordenadas: mano derecha, Y vertical y unidades en metros.
- Origen: base exacta en Y = 0 y centro del footprint en X/Z.
- Escala: altura real para mobiliario, carga, maquinaria y elementos murales;
  footprint de 0,90 m para la flecha plana, que no tiene altura geométrica.
- Orientación: se conserva el frente original; la integración solo necesita
  rotaciones alrededor de Y.
- Geometría: las transformaciones de nodos se aplanan, se eliminan vértices no
  referenciados y se preservan por separado los materiales PBR. No se usan
  texturas externas.
- Presupuesto: el objetivo agregado es 200–300 KiB. El estado y el total exacto
  se registran en `docs/warehouse-props-validation.json`.

## Máquina de coser SIDE

El asset externo descartado medía 805.132 bytes debido a su textura, pese a
tener solo 606 triángulos. El pipeline lo sustituye por un modelo procedural
original, propiedad de SIDE, construido con primitivas low-poly y cuatro
materiales PBR sin texturas. Incluye base, cuerpo, brazo, cabezal, aguja,
prensatelas, guíahilo, carrete, tensor y volante, con una altura final de
0,52 m. De este modo se cubre la categoría de maquinaria textil sin incorporar
el archivo rechazado ni una nueva obligación de atribución.

## Salidas

El pipeline produce 17 GLB autocontenidos bajo `assets/models3d/props/`: cuatro
variantes de cajas, puerta de carga, ventana industrial, flecha de piso,
baliza, pallet, rack, sacos, mesa de corte, lámpara, transpaleta, rollos de
tela, extintor y máquina de coser. El reporte JSON conserva para cada uno el
hash de fuente y salida, licencia, bounds, escala, bytes, triángulos,
geometrías, materiales, texturas y checks técnicos.

La procedencia y los textos de atribución de los assets externos se mantienen
en `CREDITS.md`; este documento registra únicamente su transformación técnica.
