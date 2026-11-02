# Auditoría y corrección de parpadeos y sincronización SIDE

Fecha: 1 de noviembre de 2026 (America/Lima).

## Resultado y alcance

Se corrigieron causas comprobadas de reconstrucción innecesaria del DOM y una carrera entre consultas forzadas. No se cambiaron decisiones, opciones, fórmulas, resultados oficiales, políticas RLS, autenticación, migraciones ni el motor económico del 3D. No se instalaron dependencias.

**La aceptación global permanece pendiente.** La batería general ejecutó 981 pruebas: 959 aprobadas y 22 fallidas. Se reprodujeron 21 de esos fallos con el código original de `origin/main`; el restante correspondía al doble de DOM de una prueba que carecía de `contains()`, actualizado y vuelto a comprobar. Los fallos anteriores impiden considerar cumplida la condición del usuario para integrar y publicar en `main`.

Trabajo aislado en `.codex-work/parpadeos/`, rama `codex/auditoria-parpadeos`, creada desde `origin/main` (`d474b57`). Se conservaron los cambios locales de la copia principal, que además recibió cambios de otros trabajos durante la sesión. No se integraron esos cambios en esta rama.

## Causas encontradas y correcciones

| Área | Causa comprobada | Corrección |
|---|---|---|
| Estudiante, `renderTabs()` | Cada llamada destruía todos los botones y registraba listeners sobre los nuevos nodos. Incluso volver a pulsar la pestaña activa reconstruía el formulario. | Se conservan botones por categoría, se actualizan clases e insignias y se registra un listener por botón. Pulsar la pestaña activa no reconstruye el editor. |
| Estudiante, `hydrateRemoteProgress()` | Hidratar reconstruía el editor aunque los valores persistidos fueran iguales; una revisión remota distinta podía quitar el foco durante la escritura. | Comparación de los valores persistidos; restauración de borradores por empresa/ciclo; el refresco visual se aplaza mientras el foco permanece dentro del editor. Los datos oficiales sí se actualizan. |
| Estudiante, `refreshStudentGame()` | Dos llamadas forzadas esperaban la misma consulta y después iniciaban dos nuevas lecturas simultáneas. La espera tampoco revalidaba el epoch inicial. | Se comparte la siguiente lectura activa y se revalida la sesión después de esperar. En la reproducción anterior hubo 3 lecturas y concurrencia 2; ahora hay 2 lecturas y concurrencia máxima 1. Se conservan las guardias de identidad y revisión existentes. |
| Estudiante, `renderStudentStatus()` y noticias | El tick de un segundo reemplazaba estados financieros y noticias idénticos; se perdían los detalles abiertos. | Comparación del HTML generado mediante `WeakMap`, sin depender de la normalización del navegador. Si cambia el contenido financiero se conserva la apertura de los detalles. |
| Estudiante, Finanzas | El evento `input` del deslizador de crédito llamaba a `setLoan(..., true)`, reconstruyendo el control durante el arrastre. | Actualización directa del deslizador, campo numérico, etiqueta y línea disponible. Se mantienen los límites y el guardado del borrador. |
| Estudiante, materiales | Reintentar sin libro disponible volvía a escribir el mismo mensaje en el DOM. | El aviso solo se reemplaza si cambia su contenido. |
| Docente, `loadReports()` | Antes de consultar se modificaban los reportes mostrados: se eliminaban formularios de entrega y se sustituía la recepción por «no verificada». Al llegar la respuesta se reconstruía nuevamente. | Se mantiene la última vista mientras se construye la siguiente respuesta completa. Se conservan las guardias de sala, generación, revisión y edición de entregas. Un fallo de comunicación sigue usando el estado de error existente; no se inventa una nueva verificación. |
| Docente, `renderResults()` | Estadísticas, comparación, selector y detalle se reemplazaban en cada consulta aunque los datos fueran iguales. | Comparación independiente del HTML de cada componente. Los formularios reciben listeners únicamente cuando se crean nodos nuevos. Los detalles abiertos se conservan cuando cambia el contenido. |
| Docente, Realtime | El callback de estado rechazaba canales antiguos, pero el callback de datos no tenía la misma guardia de generación. | Los eventos de canales obsoletos se ignoran antes de modificar presencia o programar consultas. |
| Caché | Las páginas conservaban las versiones anteriores de los scripts modificados. | Se actualizaron las versiones de `app.js` y `docente.js` en las páginas de entrada. |

No se introdujeron animaciones para disimular reconstrucciones.

## Revisión de las demás rutas

- `startStudentSync()` ya cancela los intervalos anteriores. `tickStudentGame()` conserva sus cambios legítimos al avanzar de ciclo; no se alteraron cierres ni cargos. Las consultas normales y la cola de escritura ya tenían controles de exclusión, revisión y reintento; se reparó específicamente el caso de consultas forzadas.
- Los formularios de Infraestructura, Producción, Logística, Ventas, Finanzas y Planificación comparten las rutas de hidratación y pestañas corregidas. La prueba de navegación recorre las siete categorías, incluido Resultados, repetidamente. Las opciones existentes se conservaron.
- Docente ya agrupaba avisos de Realtime y protegía reportes mediante generación de sala y revisión de cierres. Se mantuvo la consulta de reconciliación financiera aun cuando Realtime está conectado: la publicación de presencia no contiene todos los estados financieros.
- Laboratorio ya tiene secuencia de solicitudes, comparación de firmas y conservación de datos durante errores parciales. La prueba de navegador confirma que refrescar datos idénticos conserva el gráfico. No se modificó su lógica.
- El 3D mantiene su propio bucle visual y manejo de visibilidad. Las pruebas de independencia económica y de rendimiento estructural pasan. **No se realizó una medición de FPS ni una partida completa dentro del 3D**; no se certifica su rendimiento en hardware móvil real.
- El servidor local entrega `Cache-Control: no-store`. No se encontró una causa reproducida que justificase modificar CSS, fuentes, CSP o CORS. La carga real de HTML/JS/recursos locales pasó sin errores JavaScript ni respuestas locales 4xx/5xx en ambos tamaños de pantalla. Se bloquearon deliberadamente servicios externos durante ese recorrido; sus errores de fuente, CDN y consulta remota se registraron como tales.
- Se consultaron el changelog y la [documentación oficial de las suscripciones de Supabase](https://supabase.com/docs/reference/javascript/subscribe). No se cambió la API del cliente ni la configuración de seguridad.

## Pruebas y evidencias

Todas las rutas siguientes están dentro de esta copia de trabajo, salvo la ejecución de autenticación local indicada expresamente.

| Validación | Resultado y alcance |
|---|---|
| Reproducción anterior | `tests/output/parpadeos-reproduccion-base.log`: fallan las cinco nuevas regresiones originales al usar `app.js` y `docente.js` de `d474b57`; las pruebas anteriores de recuperación continúan pasando. El padre de las subpruebas también figura como fallido en el total de Node. |
| Aceptación final | `tests/output/parpadeos-aceptacion-final.log`: **45/45 aprobadas**, ninguna omitida. Incluye foco, valores, desplazamiento, borrador después de perder el foco, pestañas estables, crédito, detalles, lecturas demoradas, reconexión y datos oficiales. |
| Tres sesiones de navegador | Tres contextos Chromium abiertos simultáneamente, con almacenamiento aislado y respuestas controladas; cambios rápidos por las siete pestañas y desconexión/reconexión. No representan tres sesiones conectadas a producción. |
| Partidas de 3 y 6 ciclos | `tests/evento_seis_ciclos_tres_empresas.test.cjs` ahora ejecuta ambas duraciones con tres empresas, cierres persistidos, eventos, continuidad de caja, conservación de inventario e idempotencia. Utiliza PostgreSQL embebido PGlite y el worker real; no es una partida completa de navegador contra Supabase. |
| Integración adicional | `tests/output/parpadeos-integracion.log`: 45/45 aprobadas; cola durable, backoff, presencia, aislamiento de resultados, cierres, Laboratorio y separación del 3D. |
| Supabase local | `tests/output/parpadeos-supabase-local.log`: Auth y Data API reales en `http://127.0.0.1:55321`, proyecto local de prueba existente. Reingreso, RLS entre empresas, rechazo de escritura ajena, expulsión y recuperación. Ejecución desde la raíz principal usando `tests/local_auth_rls_cli_test.py`; solo se crearon datos de prueba locales. |
| Escritorio y móvil | Chromium a 1366 px y 390 px. Resultados del docente y gráfico de Laboratorio conservan los nodos al recibir los mismos datos. Capturas: `tests/output/parpadeos-docente-1366.png` y `parpadeos-docente-390.png`. Emulación de tamaño, no dispositivos físicos. |
| Carga estática real | `tests/output/parpadeos-carga-real.json`: ambas páginas en ambos tamaños, sin desbordamiento horizontal, sin errores JavaScript y sin solicitudes locales fallidas. Servicios externos interceptados deliberadamente. |
| Consola y red del fixture | `tests/output/parpadeos-student-diagnostics.json`: no hay excepciones de página. Se registraron errores de decodificación de portada y MIME del módulo 3D porque el fixture sirve HTML para rutas auxiliares; no se omiten ni se confunden con una validación del 3D. El recorrido de carga estática real no reproduce esos fallos locales. |
| Batería general | `tests/output/parpadeos-suite-final.log`: 981 pruebas, 959 aprobadas, 22 fallidas. Una falla del doble de DOM fue corregida posteriormente y se vuelve a ejecutar en la aceptación final; quedan 21 fallos anteriores. |
| Comparación con la base | `tests/output/parpadeos-fallos-base.log` y `parpadeos-bloqueos-base.log`: reproducen los 21 fallos restantes con el código original. `parpadeos-comparacion.json` registra los nombres y no encuentra fallos adicionales sin correspondencia, salvo el doble de DOM ya corregido. |

Para ejecutar las pruebas principales desde la raíz de la copia de trabajo:

```powershell
node --test --test-concurrency=2 tests/student_sync_ui.test.js tests/parpadeos_docente.test.cjs tests/financial_presentation.test.cjs tests/cycle_snapshot_round.test.cjs tests/evento_seis_ciclos_tres_empresas.test.cjs tests/independent_cycle_costs_20261022.test.cjs
node --test --test-concurrency=2 tests/*.test.js tests/*.test.mjs tests/*.test.cjs
```

La segunda orden **no pasa actualmente** por los bloqueos descritos. Los registros publicados conservan los mensajes y resultados; se normalizaron saltos de línea y espacios al final de línea. La prueba de comparación histórica utilizó los archivos originales de Git; no modificó ni publicó la base.

## Pendientes y límites de aceptación

Los 21 fallos anteriores se agrupan en:

1. Expectativas antiguas de DOP: ubicación del componente, textos, capacidades y recomendaciones que difieren del comportamiento ya presente en `main`.
2. Una prueba que llama a `manualDistributionData()`, función ausente en la base actual, y otra que busca el botón de proyección en Producción aunque actualmente está en Planificación.
3. Discrepancias entre escenarios económicos esperados y la base actual: reputación, capacidades, consumo y mercado compartido. No se cambiaron fórmulas para satisfacerlas.
4. Pruebas de Excel que requieren libros locales ausentes y/o automatización COM disponible. Las rutas y errores concretos están en los registros.

El listado completo de nombres está en `tests/output/parpadeos-comparacion.json`. Falta resolver o actualizar esas pruebas de acuerdo con el comportamiento autorizado, y realizar un recorrido integral con tres empresas, docente y Laboratorio conectados al mismo Supabase local durante los 3 y 6 ciclos. Las validaciones realizadas cubren esas capas por separado; no se afirma haber completado ese recorrido integral ni una certificación en producción.

## Archivos modificados

- `js/app.js`, `js/docente.js`: correcciones de sincronización y actualización de vistas.
- `index.html`, `docente.html`: versiones de scripts.
- `tests/student_sync_ui.test.js`, `tests/parpadeos_docente.test.cjs`: regresiones funcionales y de navegador.
- `tests/evento_seis_ciclos_tres_empresas.test.cjs`: cobertura de ambas duraciones.
- `tests/decisions_corrections.test.js`, `tests/financial_presentation.test.cjs`, `tests/independent_cycle_costs_20261022.test.cjs`: actualización de los dobles de DOM para las operaciones reales usadas por el código. Se conservaron sus aserciones económicas.
- Este informe y las evidencias seleccionadas en `tests/output/parpadeos-*`.

## Rama, commits y publicación

Rama de trabajo: `codex/auditoria-parpadeos`.

Base: `d474b57`, confirmada igual a `origin/main` al finalizar las correcciones.

No se integra ni se despliega en `main` porque la aceptación global sigue bloqueada. No existen migraciones nuevas ni cambios destructivos de producción. La publicación de avances y los identificadores finales se registran en el cierre de este informe.


Cierre de publicación:

- Correcciones: commit `417b63dd66f56670a6fa373650a71e8ff55bd5b8`.
- La rama fue publicada correctamente en [GitHub](https://github.com/valenlysm29/SIDE1/tree/codex/auditoria-parpadeos). Este informe y sus evidencias se añaden en el siguiente commit de la misma rama.
- Aceptación final: **45 pruebas aprobadas, 0 fallidas, 0 omitidas**, duración aproximada 44 segundos. Sintaxis JavaScript y `git diff --check` sin errores.
- Publicación de producción: **no realizada**; `main` no recibió estos cambios. Bloqueo: 21 fallos anteriores reproducidos, más el recorrido integral local pendiente descrito arriba.
- El directorio contenedor del proyecto continúa teniendo únicamente `SIDE1`; no se crearon carpetas de trabajo fuera de él.
