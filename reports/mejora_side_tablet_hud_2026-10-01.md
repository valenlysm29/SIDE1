# Fase 2 · Tablet y HUD · 01/10/2026

Estado: implementación, revisión Node y recorrido Chromium de Tablet completos.
Las posiciones finales del HUD en móvil y su rendimiento se verifican en los
subagentes Móvil y QA; este informe no cierra toda la Fase 2. Commit local
autorizado y coordinado por el agente principal; no se hizo push.

## Skill y dirección visual

Se leyó `../.agents/skills/frontend-design/SKILL.md` y el sistema de diseño de
Fase 1, `docs/design_system.md` (commit `d07639a`). La Tablet se trata como el
cuaderno de administración de la empresa: cada fila muestra la regla, su costo
y una acción de borrador; el oro identifica el presupuesto, la selección y el
foco. El HUD usa una franja de instrumentos navy opaca, cifras tabulares y los
iconos y logo existentes. No se agregan imágenes ni efectos al renderizador.

## Cambios localizados

- `css/production.css`: tokens SIDE en pestañas, selección y presupuesto;
  información secundaria legible; fila con acción local; foco de 3 px y
  steppers/acciones con altura mínima de 44 px. Se conservan el flujo de
  producción y las posiciones responsivas que revisará el subagente Móvil.
- `css/simulator3d.css`: colores SIDE en Caja, Utilidad, Stock, Tiempo,
  Satisfacción y clientes perdidos; misiones con texto y controles legibles;
  acciones del HUD de 44 px. Las superficies principales sustituyen el
  desenfoque heredado por fondo opaco; no se añaden sombras. No se toca el mapa.
- `js/app.js`: presentación en `renderDecisionRow` y nuevo handler en
  `bindDecisionControls`. El botón **Guardar borrador** llama únicamente a
  `persistCurrentDraftOnly()`, que ya existe para el autoguardado. Ese mecanismo
  copia los borradores de la sección en almacenamiento local. El texto explica
  el alcance y confirma «Borrador local guardado; pendiente de envío. Incluye los
  cambios de esta sección.». Captura retorno falso, error de escritura y error
  de lectura del almacenamiento durante las guardas de bloqueo.
  Respeta las reglas existentes de acceso operativo, ciclo bloqueado, sección
  enviada e ítem bloqueado incluso si el estado cambia con la Tablet abierta.
- `tests/tablet_item_draft.test.js`: comprueba almacenamiento, datos financieros
  inmutables, errores de cuota, sección ausente y bloqueos.
- `tests/tablet_item_draft_ui.cjs`: recorrido real de Tablet en origen efímero
  local, sin Supabase, en 1366×900, 360×800, 390×844, 768×1024 y 844×390;
  comprueba guardado, error, cierre del ciclo mientras se edita, bloqueo,
  desborde, tamaño táctil y errores locales.

No se modifican compras, catálogo, ledger, envío, ciclos, esquema Supabase,
personajes ni avatares. La copia local no constituye recibo remoto. El botón de
borrador por fila no utiliza `saveCurrentSection()`.

## Validación registrada

`node --check js/app.js`: correcto.

`node --test tests/tablet_item_draft.test.js tests/tablet_return.test.js tests/decisions_corrections.test.js tests/production_dop.test.js`:
**23/23 pruebas correctas**, 0 fallas. Incluye 5 nuevas pruebas del borrador por
fila y 18 comprobaciones previas de retorno, decisiones y diagrama productivo.

`node --check tests/tablet_item_draft_ui.cjs`: correcto.

`git diff --check` sobre los archivos propios: sin errores de whitespace.

`node tests/tablet_item_draft_ui.cjs`: **5/5 tamaños correctos**, con Chromium en
turno exclusivo y TEMP/TMP/TMPDIR dentro de SIDE1. Escritura local comprobada,
sin cambio de estado financiero/decisiones/envío; error de cuota capturado;
fase `results` cerrada mientras la Tablet permanece abierta impide guardar;
sección enviada deshabilita la acción. Sin errores de página ni respuestas HTTP
locales de error y sin desborde horizontal. El botón de borrador mide al menos
44 px de alto. El runner bloquea redes externas de forma intencionada y no
certifica disponibilidad de Supabase ni ausencia general de errores de consola;
esa cobertura corresponde a la Fase 3.

El primer intento falló por un error del fixture: seleccionaba categoría `A`
(Resumen sin ítems) en vez de `B` (Infraestructura). Se corrigió únicamente el
runner y la ejecución posterior pasó. Una última repetición justificada conservó
5/5 resultados y regeneró capturas desde arriba junto con una captura del
viewport, evitando la posición intermedia de cabecera sticky en imágenes largas.
Chromium y ambos procesos finales quedaron cerrados.

Evidencia: `tests/output/mejora-tablet-hud-2026-10-01/tablet-item-draft-results.json`
y diez PNGs `tablet-draft-<ancho>x<alto>.png` / `*-viewport.png` en la misma
carpeta. Se inspeccionaron las vistas desktop y 390 px: el botón, su mensaje de
guardado local, los costos y el presupuesto son legibles; los estados envuelven
el texto en español. Los otros tamaños pasaron las comprobaciones del runner.

## Pendientes de la fase integral

1. Inspeccionar el HUD del mundo 3D. El subagente Móvil debe prevalecer
   sobre la prioridad de `#simulator3d` en sus ajustes y conservar Utilidad en
   móvil, dado que el CSS heredado de `hub-world.css` la ocultaba. Respetar los
   contratos en 390 px: `location.right <= stats.left` y
   `missions.top >= stats.bottom`, con misiones visibles. La geometría móvil
   sigue pendiente; las cinco aprobaciones anteriores cubren sólo la Tablet.
2. Revisar presupuesto gráfico/FPS con la suite integral final, sin atribuir
   mejoras de FPS sólo por haber eliminado filtros CSS.
3. Revisar el flujo completo y los datos remotos con QA; este subagente no
   modifica la lógica de partida ni confirma envío remoto.
