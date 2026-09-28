# Presupuesto de rendimiento — Tienda y Producción

## Contrato de medición

La prueba usa Chromium con SwiftShader, viewport 1366 × 900, estado financiero
fijo y personajes diferidos desactivados. Las cámaras son reproducibles:

- Tienda: jugador `(131, 1.72, 19)`, cámara `(142, 11.5, 33)`, FOV 52.
- Producción: jugador `(170, 1.72, -19)`, cámara `(181, 11.5, -5)`, FOV 52.
- Exterior: cámara inicial del hub usada por `outdoor_performance.cjs`.

| Zona / tier | Baseline calls / tris | Techo calls / tris |
| --- | ---: | ---: |
| Tienda Baja | 186 / 72.132 | 195 / 75.738 |
| Tienda Media-Alta | 190 / 72.516 | 218 / 90.645 |
| Producción Baja | 141 / 62.140 | 148 / 65.247 |
| Producción Media-Alta | 145 / 62.692 | 166 / 78.365 |
| Exterior Baja | 101 / 53.546 | 106 / 56.223 |
| Exterior Media | 107 / 55.158 | 123 / 68.947 |
| Exterior Alta | 107 / 55.546 | 123 / 69.432 |

## Resultado final

| Zona / tier | Calls | Delta | Holgura | Tris | Delta | Holgura | Drawables props | Instancias | Luces reales |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Tienda Baja | 193 | +7 | 2 | 73.036 | +904 | 2.702 | 20 | 19 | 0 |
| Tienda Media | 205 | +15 | 13 | 74.036 | +1.520 | 16.609 | 31 | 24 | 1 |
| Tienda Alta | 205 | +15 | 13 | 74.036 | +1.520 | 16.609 | 31 | 24 | 2 |
| Producción Baja | 148 | +7 | 0 | 63.290 | +1.150 | 1.957 | 8 | 6 | 0 |
| Producción Media | 164 | +19 | 2 | 69.382 | +6.690 | 8.983 | 33 | 23 | 1 |
| Producción Alta | 164 | +19 | 2 | 69.382 | +6.690 | 8.983 | 33 | 23 | 2 |
| Exterior Baja | 101 | 0 | 5 | 53.546 | 0 | 2.677 | 11 | 37 | 0 |
| Exterior Media | 107 | 0 | 16 | 55.158 | 0 | 13.789 | 20 | 68 | 0 |
| Exterior Alta | 107 | 0 | 16 | 55.546 | 0 | 13.886 | 20 | 70 | 0 |

Todos los tiers respetan sus techos. El exterior queda exactamente igual a la
Tanda 3. La política local de `PointLight` es 0/1/2 en Baja/Media/Alta tanto en
Tienda como en Producción; ninguna de estas luces proyecta sombras.

## Ajustes aplicados

- Los primitives con un mismo material se compactan antes de crear el
  `InstancedMesh`, conservando materiales, triángulos, matrices y recursos GLB.
- Baja conserva las siluetas procedurales baratas para costura, planchado,
  storage y luminarias; Media/Alta usan los GLB detallados.
- Puertas y paneles de ventana detallados se reservan para Media/Alta; la
  fachada y el portal procedural permanecen visibles y transitables en Baja.
- Las cuatro luminarias de Producción comparten un solo batch instanciado.

No se cambió ningún collider, entrada, ruta ni hotspot.

## Carga y caché

La medición carga mediante el `GLTFLoader` real los ocho GLB nuevos y las cinco
referencias compartidas del Almacén. Cada URL compartida se solicita exactamente
una vez; no hay copias `production_*` de esos cinco archivos, errores GLTF ni
respuestas HTTP 4xx.

## Repetir la medición

Desde la raíz `SIDE1`:

```powershell
node tests/production_performance.cjs
```

El comando falla si un presupuesto se excede, cambia la política de luces, un
GLB no carga o una referencia compartida deja de usar la caché. Para aislar un
caso durante diagnóstico pueden definirse `SIDE_PERF_ZONE` y `SIDE_PERF_TIER`.

SwiftShader da conteos reproducibles, pero **no representa el FPS de una GPU
real**. En un equipo modesto se debe recorrer Tienda y Producción en los tres
tiers, observar los cambios de luminarias/sombras y medir FPS y frame time con
las herramientas del navegador.
