# Mona y organización de SIDE1

> Actualización 2026.09.22.2: Mona ahora tiene esqueleto y marcha. El documento
> vigente de movimiento, tamaños y pruebas es [NPCS_Y_MOVIMIENTO.md](NPCS_Y_MOVIMIENTO.md).
> Lo que sigue registra la integración estática inicial y la organización de carpetas.

## Dentro del juego

Mona está junto a la entrada de la tienda, a la izquierda al comenzar el turno,
en x = -3, z = 10,7. Acércate y pulsa **E**, o el control de interacción táctil,
para hablar con ella. Orienta sobre caja, exhibidores y abastecimiento según el
estado del juego. No añade empleados contratados ni cambia costos o ventas.

El GLB proporcionado no contiene esqueleto ni animaciones. Mona conserva su pose
original; no se le aplican las animaciones de otros personajes. Tiene colisión y
un único puesto, incluso al regresar de Decisiones o reconstruir el mundo.
Si su archivo no se puede cargar, un personaje existente ocupa el puesto y la
interacción continúa disponible. `SIDE3D.diagnostics().mona` informa ese estado.

- Modelo de ejecución: `assets/models3d/npcs/mona.glb`.
- Original intacto: `tools/model-sources/mona/mona.original.glb`.
- Procedencia, hashes y medidas: `tools/model-sources/mona/manifest.json`.
- Configuración de posición y altura: `simulator3d-config.js`, `NPCS.mona`.
- Adaptador GLB y recursos compartidos: `services/mona_npc.js`.
- Visor: `tools/mona_preview.html`, servido desde el servidor del juego.

Se redujo de 74.999.312 a 3.948.040 bytes y de 1.499.830 a 50.000 triángulos.
Se conservaron UV, color, normales y mapa de metal/rugosidad; color a 2048 px y
mapas auxiliares a 1024 px. Se normalizó la altura a 1,68 unidades y se apoyaron
los pies en el suelo. Se limitó a 1 el factor especular original de 2, fuera del
rango admitido por glTF. Se compararon visualmente el original y el resultado.

El modelo fue aportado por el usuario. No se le atribuye una licencia nueva.
La simplificación usa [meshoptimizer 0.25.0](https://github.com/zeux/meshoptimizer),
cuya licencia MIT se conserva en `tools/model-pipeline/meshoptimizer/LICENSE.md`.

## Organización

Todo el proyecto y los resultados de este trabajo están dentro de **SIDE1**.
Las rutas activas de páginas y scripts se mantienen para conservar el arranque.

| Carpeta | Contenido |
| --- | --- |
| Raíz de SIDE1 | Páginas, scripts, estilos y `INICIAR_JUEGO.bat` |
| `assets/` | Recursos gráficos utilizados por el juego |
| `services/` | Adaptadores y servicios del juego |
| `vendor/` | Motor 3D y dependencias locales de ejecución |
| `tools/` | Generadores, visor, herramientas y modelos originales |
| `tests/` | Pruebas activas; capturas nuevas en `tests/output/mona/` |
| `docs/` | Documentación del proyecto |
| `reports/financial/` | Análisis financiero anterior, Excel corregido y sus archivos auxiliares |
| `archive/` | Copias históricas conservadas que no carga el juego |

Movimientos realizados:

- `assets/tests/` → `archive/legacy-asset-tests/`.
- `assets/assets/` → `archive/nested-assets/`.
- `assets/new/` → `archive/reference-captures/`.
- `app.js.bak` → `archive/app.js.bak`.
- La carpeta externa `outputs/` → `SIDE1/reports/financial/`.

El Excel anterior está ahora en
`reports/financial/produccion_audit_20260921/DECISIONES_SIDE_corregido.xlsx`.
Se retiró únicamente el enlace a dependencias externas de aquella carpeta de
trabajo. Los archivos originales aportados en Descargas no se han modificado.

## Comprobación y reconstrucción del modelo

El juego funciona con sus archivos locales. No necesita instalar herramientas
de modelado. Para comprobarlo, ejecuta `INICIAR_JUEGO.bat` desde SIDE1.

Para regenerar el GLB, instala `sharp` en `tools/model-pipeline/` usando su
`package.json`, y ejecuta `node tools/prepare_mona.cjs` con `SHARP_PATH` apuntando
a ese módulo. También admite un `sharp` ya disponible mediante `NODE_PATH`.
El optimizador no se descarga al jugar: está incluido como herramienta local.

Pruebas: `node --test tests/*.test.js`, `python tests/local_server_test.py` y,
con Playwright disponible, `node tests/mona_npc.cjs`.
El último utiliza `SIDE_TEST_URL` (por defecto `http://127.0.0.1:8772/`), contextos
aislados y bloquea hosts externos. Comprueba carga, escala, pies, interacción,
reconstrucciones repetidas, móvil y fallo controlado de carga del modelo.

`MONA_PREVIEW_ONLY=1` limita la prueba al visor. `MONA_ORIGINAL_PREVIEW=1`
incluye una captura del original. Ninguna prueba usa una partida del usuario.

## Resultado de la validación

- NPC: carga local sin hosts externos, proporciones, textura y apoyo en el suelo correctos.
- Interacción con **E**, diseño móvil y tres reconstrucciones consecutivas: correctos.
- Archivo GLB bloqueado: aparece el personaje de respaldo y sigue funcionando la interacción.
- Entrada al juego con envío conjunto o por secciones: correcta en ambos recorridos.
- Servidor local: dos pruebas correctas. Sintaxis de los scripts modificados: correcta.
- Suite general: 62 de 68 pruebas pasan. Las seis de `cycle_productivity.test.js`
  ya fallaban por funciones ausentes (`cycleProductivity`, `singleStore` y
  `cycleProductionRecord`). Coinciden con el registro previo
  `tests/output/baseline-existing-failures.txt`; no se modificó esa lógica.
- Se verificaron los 123 archivos históricos trasladados contra Git, considerando
  la normalización de saltos de línea de Windows. Ninguno perdió contenido.
