# Fase 2 · Panel del profesor

Fecha: 01/10/2026. Subagente: Profesor. Skill leída: `../.agents/skills/frontend-design/SKILL.md`. Sistema aplicado: `docs/design_system.md` y tokens de `css/design-system.css` (fase 1).

## Criterio y alcance

El panel funciona como seguimiento empresarial: Empresas muestra presencia, avance y evaluación; Resultados conserva los estados financieros como columnas verticales por empresa; Decisiones organiza los registros reales por ciclo de la última partida. Se mantienen navy, dorado, Montserrat y los iconos existentes. Encabezados con iconos ofrecen una referencia concreta al apartado, sin añadir ilustraciones ni avatares.

La primera revisión del plan descartó repetir el mismo tratamiento de tarjetas para todo: la presencia conserva su tarjeta por empresa, las finanzas se leen como un libro vertical y el historial se despliega por ciclo. Se retiró la animación de entrada de estos tres apartados y la pulsación de presencia para evitar parpadeos visuales durante actualizaciones.

## Cambios

- `docente.html`: encabezados y ayudas en español, etiquetas accesibles de secciones, nombre visual Decisiones, iconos de Empresas/Resultados/Decisiones existentes; conserva IDs y `data-tab="historial"`.
- `css/docente.css`: estilos acotados a los tres apartados; texto secundario AA basado en los tokens, foco dorado, controles de al menos 44 px, nombres completos con salto de línea, filas financieras legibles, estados pendientes y completados explícitos, grid de empresas con anchura mínima adaptable.
- `js/docente.js`: únicamente cambia el literal del título de Historial por «Decisiones · última partida», autorizado por el coordinador. No cambia el controlador ni el estado.
- `tests/teacher_history_ui.cjs`: únicamente se actualizan tres expectativas de texto del renombrado visual. Las verificaciones funcionales no se relajan.

El render de empresas conserva su contrato actual de reutilización de nodos. No se modifican nota docente, podio, servicios, auth, ciclos, catálogo, exportaciones ni Supabase.

## Validación

- `node --check js/docente.js`: PASS.
- `node --test tests/teacher_history.test.js tests/teacher_lifecycle.test.js tests/teacher_podium.test.js`: 13/13 PASS. Evidencia: `tests/output/mejora-integral-2026-10-01/fase2/profesor/node.log`.
- `git diff --check` en archivos propios: PASS.
- Preparado script visual aislado `.codex-work/mejora-side-2026-10-01/capture_profesor.cjs`: escritorio 1366×900; 360×800, 390×844, 768×1024 y horizontal 844×390. Comprueba DOM y foco después de dos actualizaciones, conservación de la nota pendiente, objetivos de 44 px, desborde y errores de consola. Datos ficticios sólo dentro de la fixture de prueba y marcados como tales; no escribe en servicios.
- Capturas de referencia revisadas: `before/screens/profesor-empresas-1366.png` y `before/screens/profesor-resultados-390.png` en el directorio de evidencia de mejora integral. Las capturas previas están vacías; la revisión posterior también cubre datos de prueba y nombres largos.

## Cierre tras reanudar

El primer recorrido visual encontró un desborde a 768 px: `docente.css` cambiaba a navegación móvil a 760 px y `responsive.css` ya colocaba la barra en flujo a 820 px. La combinación mantenía el margen lateral de escritorio. Se armonizó el límite docente a 820 px, se permitió envolver las acciones de cabecera a 1180 px y se habilitó el desplazamiento de la barra lateral para alturas pequeñas. No se cambió `responsive.css` ni la lógica de navegación.

- Captura final: **15/15 PASS**. Empresas, Resultados y Decisiones en 1366×900, 360×800, 390×844, 768×1024 y 844×390. Datos de prueba explícitos y nombres largos; `renderResults()` se invoca después de inyectar los datos para comprobar los cuatro estados financieros llenos.
- `resultado.json`: cero errores de consola/página, ancho de documento sin desborde, controles visibles de al menos 44 px. Dos actualizaciones de Empresas conservan el mismo nodo, el foco y la nota pendiente de guardado.
- `tests/teacher_history_ui.cjs`: **PASS escritorio y móvil**: estados vacíos, empresas y ciclos múltiples, nota cero, indicadores, lectura sin edición, escape de HTML, reemplazo por última partida, mensajes de migración pendiente y navegación existente.
- Evidencia: `tests/output/mejora-integral-2026-10-01/fase2/profesor/`: 15 PNG, `resultado.json`, `captura.log`, `history.log`, `history-desktop.png`, `history-mobile.png` y `node.log`.
- Los dos PNG anteriores de `tests/output/teacher-history/` se respaldaron dentro de `.codex-work` y se restauraron mediante `finally`; SHA-256 original/restaurado coincide en ambos archivos.
- Revisadas visualmente las 15 vistas. El coordinador revisó Empresas móvil y Resultados lleno a 390 px. Los nombres completos se muestran en el encabezado y las filas financieras conservan etiquetas y cifras verticales. La fixture visual del historial conserva un aviso de conexión no disponible porque no usa Supabase; la suite funcional independiente sí cubre las respuestas del servicio.

Navegador liberado al terminar ambos runners secuenciales. Entrega del subagente lista para commit local autorizado. La comprobación responsiva final corresponde al subagente Móvil y la suite completa al revisor de fase 6; a 768 px se comunicó una oportunidad de ampliar la columna de decisiones del historial, que conserva texto completo y no desborda.
