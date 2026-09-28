# Presupuesto de rendimiento exterior

## Contrato

La comparación se hace antes de cargar los personajes diferidos y con la misma
cámara de entrada al hub. El baseline contractual anterior a la Tanda 3 es de
123 draw calls y 55.666 triángulos.

| Tier | Techo de draw calls | Techo de triángulos |
| --- | ---: | ---: |
| Baja | 129 | 58.449 |
| Media | 141 | 69.582 |
| Alta | 141 | 69.582 |

## Resultado con los 12 GLB cargados

| Tier | Draw calls | Delta baseline | Triángulos renderer | Delta baseline | Batches GLB | Drawables GLB | Instancias GLB | Triángulos GLB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Baja | 101 | -22 (-17,9 %) | 53.546 | -2.120 (-3,8 %) | 7 | 11 | 37 | 4.510 |
| Media | 107 | -16 (-13,0 %) | 55.158 | -508 (-0,9 %) | 12 | 20 | 68 | 7.768 |
| Alta | 107 | -16 (-13,0 %) | 55.546 | -120 (-0,2 %) | 12 | 20 | 70 | 8.156 |

Todos los tiers quedan dentro del presupuesto. No fue necesario recortar
instancias: al ocultar cada fallback procedural cuando carga su GLB equivalente,
el total de draw calls disminuye respecto del baseline. Baja mantiene aves y
detalle secundario apagados; Media usa dos aves y Alta cuatro.

Como diagnóstico de fallback, la misma ejecución midió el mundo antes del
streaming de GLB en 132/53.458 (Baja), 140/57.550 (Media) y 140/57.814 (Alta).
La ruta normal con los GLB cargados es la que se valida contra el contrato.

## Repetir la medición

Desde la raíz `SIDE1`:

```powershell
node tests/outdoor_performance.cjs
```

El comando levanta un servidor local efímero, bloquea toda solicitud externa,
abre Chromium con SwiftShader, carga los 12 archivos mediante el `GLTFLoader`
real y falla si falta un asset, ocurre un error de carga o un tier supera su
techo. También imprime las métricas del renderer y de `outdoorProps` en JSON.

## FPS real

SwiftShader sirve para verificar geometría, draw calls y presupuestos de forma
reproducible, pero **no representa el rendimiento de una GPU real**. El FPS debe
medirse manualmente en un equipo modesto, recorriendo la plaza, la hilera de
árboles y las esquinas con semáforos en Baja, Media y Alta. Conviene observar
especialmente los cambios al entrar o salir del radio de culling y el movimiento
de las aves en Media/Alta.
