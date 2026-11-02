# Parpadeo de Rondas y eventos — comprobación conectada

Fecha: 1 de noviembre de 2026 (Lima). Base: `origin/main`, `c558d95`.

## Causa comprobada

Página docente real servida por HTTP, Chromium de escritorio a 1366 × 900 y Supabase local activo en `127.0.0.1:55321`. Sin interceptar RPC, sustituir servicios, simular respuestas ni adelantar el reloj: la sala esperó su minuto real antes de iniciar. Se crearon cuentas y partidas nuevas de prueba; no se alteraron partidas anteriores.

`MutationObserver` registró durante 11 segundos de ciclo activo:

| Componente | Antes: lotes de mutación | Corrección final |
| --- | ---: | ---: |
| Noticias (`cycleNews`) | 3 | 0 |
| Resumen de habilitados | 3 | 0 |
| Tabla de eventos | 3 | 0 |
| Estado del ciclo | 3 | 0 |
| Cronómetro | 14 | 11 (cambios esperados del texto) |

Las sustituciones coincidían con el sondeo de tres segundos: `applyTeacherState()` ejecutaba de nuevo los renderizados y se eliminaban los nodos originales aun con datos idénticos. El reloj invocaba además el renderizado de la sala cada segundo. El contador debe cambiar; la reconstrucción de noticias, controles y tabla no era necesaria.

También se identificó una fuente adicional durante cierres pendientes: las consultas de ciclos anteriores escribían avisos sobre el mismo estado del ciclo. Se evita repetir el mismo texto y alternar avisos de ciclos anteriores.

## Cambios

- Separación de la actualización temporal y la vista: cada respuesta sigue ajustando la referencia horaria del servidor; solo los cambios de configuración, fase, ciclo o ejecución invalidan la vista.
- Noticias y resumen no sustituyen HTML idéntico. La tabla conserva filas e inputs por identificador de evento; solo modifica sus propiedades y agrega o retira filas cuando cambia el filtro. Los listeners se instalan una vez por input.
- El tick actualiza los textos temporales, sin recorrer de nuevo empresas ni reconstruir configuración y eventos.
- Los cierres ya confirmados se reutilizan en memoria por partida, generación y ciclo. Los pendientes siguen consultándose. No cambia el cálculo, la persistencia ni el proceso oficial de cierre.
- Nueva versión del recurso docente para evitar caché del navegador.

## Comprobación visual y funcional

1. **Antes:** partida `6d9be971-6821-4c75-89f4-b2a7f3ef6d85`, captura, vídeo continuo y medición del comportamiento original.
2. **Noticias y eventos:** partida `304f593d-0a68-41d5-88bc-69870af327a5`, empresa unida mediante Auth y Data API reales, tres ciclos hasta `finished`. Se comprobaron noticias generadas al cambiar de ciclo, filtros, selección y conservación del foco durante sincronizaciones. Sin errores JavaScript. Este recorrido no certifica cierres económicos: no se habían confirmado planes.
3. **Aceptación final:** partida `370323c5-5a93-4a52-83e3-827d4fc47c5a`, tres planes vacíos guardados mediante Data API y tres cierres confirmados con el servicio oficial, consultados y mostrados en Resultados. Se comprobaron cortar, avanzar, finalizar, editar repetición y filtrar eventos. Se midieron también ventanas de siete segundos en ciclos posteriores sin nuevas mutaciones de noticias, tabla, resumen ni estado. Final: ciclo 3, fase `finished`, foco conservado y cero errores JavaScript. Los planes vacíos verifican presentación y transporte de resultados, no una simulación productiva con ventas.

El Supabase local carece de `side_legacy_event_context_v1`. Un intento de cierre con eventos históricos habilitados se detuvo con `EVENTOS_NO_VERIFICADOS`; no se eludió esa validación ni se aplicaron migraciones. Para comprobar Resultados se deshabilitaron los eventos desde la interfaz de la nueva partida de aceptación. La comprobación de noticias y la de cierres se documentan por separado por esta limitación previa. No se afirma una validación de producción ni de todos los escenarios económicos.

Regresiones relevantes: **84 aprobadas, 0 fallidas**, incluyendo sincronización del estudiante, presencia, notas, historial, podio, eventos, último ciclo, resultados sellados, cierres pendientes y reutilización aislada de cierres confirmados. Se mantuvieron las comprobaciones visuales existentes a 1366 y 390 px. Sin cambios en SQL, migraciones, servicios económicos ni opciones de Ventas y Finanzas.

## Evidencias y reproducción

- `tests/teacher_flicker_connected.py`: recorrido conectado, servidor estático y configuración local de prueba. Requiere Python Playwright, Chrome y el proyecto Supabase local `side-cli-verificacion` ya iniciado. Solo escribe datos nuevos de prueba.
- `tests/output/flicker-comparison.json`: comparación resumida.
- `tests/output/flicker-before/measurements.json`, `flicker-after/measurements.json` y `flicker-acceptance/measurements.json`: observaciones y solicitudes reales.
- En esas mismas carpetas: vídeos continuos `.webm`, capturas de ciclos y capturas de resultados. Los vídeos permanecen como evidencia local para no añadir archivos grandes al historial.
- `tests/output/flicker-regressions.log`: ejecución final de las 84 regresiones.

Trabajo aislado dentro de `SIDE1/.codex-work/flicker-main`, preservando la rama y las eliminaciones preexistentes del directorio principal. Remoto verificado: `https://github.com/valenlysm29/SIDE1.git`.
