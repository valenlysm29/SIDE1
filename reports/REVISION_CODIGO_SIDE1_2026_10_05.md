# Revisión de código y funcionamiento de SIDE1

Fecha: 5 de octubre de 2026, hora de Lima. Se revisa el commit `310763fdddf35fd772ff347dcebed87ea5846d63` con los cambios locales anteriores. El remoto verificado es `https://github.com/valenlysm29/SIDE1.git`.

## Resultado

Se confirmaron tres defectos de sincronización y registro y dos de interfaz móvil, uno de ellos de menor prioridad. Las pruebas generales pueden aprobar aunque ciertos escenarios no estén cubiertos. No se puede afirmar que todo funcione correctamente.

La revisión conserva el código de la aplicación y los cambios locales anteriores rastreados por Git. Los scripts nuevos de diagnóstico se guardan en `reports/`; sus resultados, en `tests/output/revision-2026-10-05/`. No se crearon cuentas, partidas remotas, commits ni pushes, ni se aplicaron migraciones.

## Hallazgos reproducibles

### 1. [P1] Una decisión pendiente de un ciclo cerrado bloquea los guardados siguientes

Ubicación: `services/student_sync.js:51`, `65–69` y `92–93`.

La cola toma siempre el primer trabajo de la empresa. Cuando la operación normalizada es rechazada porque su ciclo ya terminó, se conserva y se reintenta como si fuera un fallo transitorio. `mergeNewer()` combina únicamente trabajos del mismo ciclo, por lo que el trabajo del ciclo siguiente queda detrás del anterior y nunca se procesa.

Reproducción con la cola real y las migraciones en PostgreSQL/PGlite local: falla la escritura del ciclo 1, el docente avanza al ciclo 2 y vuelve la conexión. El snapshot del ciclo 1 se acepta, pero sus decisiones se rechazan con «Las decisiones solo se permiten en el ciclo operativo actual». Encolar una decisión del ciclo 2 vuelve a intentar exclusivamente la del ciclo 1. Ambos trabajos permanecen pendientes y no se envía ninguna operación del ciclo 2.

Consecuencia: una interrupción de red cerca del cierre de un ciclo puede impedir sincronizar las decisiones posteriores de esa empresa, incluso después de recuperar la conexión y recargar la página.

Corrección recomendada: devolver un código explícito para operaciones de ciclos cerrados y resolverlas por separado, conservando evidencia del cambio rechazado. Permitir procesar los trabajos vigentes y reconciliar el snapshot con el ciclo autoritativo antes de reintentar.

### 2. [P2] Retirar una decisión opcional conserva su selección anterior en las filas normalizadas

Ubicación: `js/app.js:1232–1236`, `1278`, y `supabase/migrations/20260930_preservar_opciones_decisiones.sql:87–91`.

`buildSupabaseDecision()` devuelve `null` cuando no quedan opciones o cantidades positivas. `syncSectionToSupabase()` omite esa decisión. La migración elimina filas anteriores únicamente para los identificadores incluidos en el payload, de modo que nunca recibe la orden de borrar la decisión vaciada.

Reproducción: guardar mantenimiento preventivo por S/ 200, desmarcarlo y volver a guardar la sección. El estado local queda sin selección; el payload omite `MANTENIMIENTO`; la base local conserva una fila con cantidad 1 y costo S/ 200. Sucede también al llevar a cero la totalidad de una decisión de cantidades o deshacer una adquisición del ciclo.

Consecuencia: el historial docente puede registrar decisiones que el estudiante retiró. El snapshot y el reporte pueden estar actualizados mientras `empresas_decisiones` sigue desactualizada.

Corrección recomendada: enviar explícitamente las decisiones vaciadas, por ejemplo mediante una lista de identificadores a reemplazar independiente de las opciones seleccionadas. La operación SQL debe borrar esos identificadores aunque no queden opciones, sin inventar una opción o una cantidad.

### 3. [P2] Los costos exportados no coinciden con los movimientos calculados

Ubicación: `js/app.js:1266`, `1288`, y `js/teacher_history.js:48`, `74`.

El exportador recalcula costos desde el precio base del catálogo. En materiales omite el descuento del analista; en ventas de activos multiplica el precio completo por la cantidad negativa y omite la tasa de liquidación. El historial docente muestra ese `costo_total` como costo registrado.

Reproducciones con el modelo y el exportador reales:

| Operación | Movimiento calculado por el juego | Costo normalizado exportado |
| --- | --- | --- |
| 100 compras de cuero estándar con analista en ciclo 1 | Salida S/ 3,960 | S/ 4,500 |
| Liquidar una máquina básica de ensamblado al 40% | Entrada S/ 1,400 | S/ −3,500 |

Consecuencia: los importes por decisión del historial docente no concilian con los movimientos de caja y el desglose de la revisión. Esto no demuestra que el saldo local se calcule mal; la divergencia está en el registro exportado.

Corrección recomendada: construir el payload desde el mismo desglose utilizado para contabilizar, conservando descuento, valor de liquidación y conceptos adicionales como indemnización. Evitar un segundo cálculo basado en precios nominales y acordar cómo representar ingresos por disposición de activos.

### 4. [P2] El minimapa tapa las misiones en una pantalla táctil pequeña

Ubicación: `css/responsive.css:924`, `943–944`.

En 360×640 con entrada táctil, las reglas colocan las misiones a 220 px desde arriba y el minimapa a 240 px desde abajo, dentro de la misma columna derecha. Sus áreas se superponen. El mayor z-index del minimapa tapa parte del encabezado, el control de plegado y la lista de misiones.

La suite `world_orientation_mobile.cjs` falla en la comprobación «compact map avoids gameplay controls and mission panel». La captura `tests/output/revision-2026-10-05/isolated/orientation-mobile/after-360x640.png` confirma visualmente el solapamiento.

Corrección recomendada: reservar áreas que no se superpongan para mapa, misiones y controles táctiles; adaptar posición o estado plegado de las misiones a la altura disponible. Verificar 360×640, 390×844 y modo horizontal con entrada táctil real o emulada.

### 5. [P3] Algunos controles táctiles quedan por debajo del tamaño exigido por las pruebas

Ubicación: `css/responsive.css:909–911` y `css/simulator3d.css:79`.

La ampliación a 44×44 px de los controles táctiles solo se aplica hasta 820 px de ancho. En horizontal a 844×390, los siete botones de movimiento e interacción miden 42×44 px: el ancho conserva el valor base de 42 px. La suite `mobile_integral_ui.cjs` falla al comprobar que todos los botones táctiles visibles alcanzan 44×44 px.

Es un defecto de usabilidad y de cumplimiento del requisito definido en la suite, sin evidencia de pérdida de datos. Corrección recomendada: aplicar el tamaño mínimo también por tipo de puntero táctil, independientemente del ancho; verificar que aumentar el tamaño conserve la separación entre controles.

## Validación

El resultado consolidado está en `tests/output/revision-2026-10-05/summary.json`; conserva los fallos del primer intento y los resultados de las repeticiones, sin presentar los intentos fallidos como aprobados.

| Área | Resultado final |
| --- | --- |
| Node: 60 archivos de pruebas | 296 aprobadas, 0 fallos |
| Servidor Python | 2 aprobadas, 0 fallos |
| Base de datos PGlite | 6 suites aprobadas |
| Navegador Chromium | 22 suites aprobadas, 2 fallidas |
| Benchmark SwiftShader | Ejecución aprobada; mediana 1 FPS en Baja, Media y Alta |
| Recorrido opcional `side_full_flow.cjs` | Omitido: el archivo no existe |

Las dos suites de navegador que permanecen fallidas son `world_orientation_mobile.cjs` y `mobile_integral_ui.cjs`; corresponden a los hallazgos 4 y 5. La primera se detuvo en 360×640 y la segunda en 844×390: sus tamaños posteriores no quedaron certificados. La revisión móvil integral pasó antes en 360×800, 390×844, 768×1024 y 800×360.

`npc_locomotion.cjs` agotó una navegación de 30 segundos en el primer intento y aprobó al repetirlo sin cambiar sus tiempos ni aserciones. `decisions_cycle_ui.cjs` y `teacher_report_pdf_ui.cjs` fallaron inicialmente por rutas de salidas externas que el aislamiento de Node no cubría; después de corregir el adaptador, ambas aprobaron con las aserciones originales. El PDF se comprobó mediante sus botones reales, descarga, vista previa, limpieza de URL y escenarios con nombres largos, 48 eventos, datos faltantes y nota cero.

El runner original se detuvo durante el respaldo de evidencias históricas de OneDrive, antes de iniciar suites. Se ejecutó el mismo runner en memoria con respaldo/restauración sustituidos por aislamiento de salidas mediante un preload de Node. Las fuentes y las aserciones originales de las suites no cambian; las rutas de salida del test PDF se sustituyen en memoria porque su descarga la escribe el driver de Playwright. Se mantuvo un único navegador de QA a la vez.

La primera ejecución de PDF regeneró el auxiliar ignorado `tests/output/teacher-pdf/button-download.pdf` antes de corregir ese aislamiento. Se conservó el PDF nuevo dentro de esta revisión y se recuperó el auxiliar desde la copia de evidencia de `before`, con su fecha. La línea base `before` no se modificó. La plantilla temporal `decisions.html` generada por Python se trasladó al aislamiento y se eliminó allí al completar su repetición. El estado de los archivos rastreados por Git coincide con el observado al iniciar la revisión.

La comprobación final del directorio contenedor conserva los cuatro nombres presentes al inicio: `.agents`, `reports`, `SIDE1` y `skills-lock.json`. No se crearon archivos ni carpetas de trabajo fuera de `SIDE1`.

### Comprobación remota de solo lectura

Auth, catálogo, opciones y consultas de columnas respondieron HTTP 200. El catálogo contiene 26 decisiones y 51 opciones; no hay identificadores, categorías, tipos u opciones locales faltantes. Los RPC de historial y características rechazaron la llamada anónima con `42501`, conforme a sus permisos. Las consultas con `limit=0` comprueban estructura accesible, no registros reales ni los permisos de una sesión docente.

No se dispuso de una sesión docente real ni una identidad estudiantil autorizada para comprobar escrituras y sincronización remotas entre dispositivos. Las pruebas de base de datos usan PGlite y las pruebas de interfaz usan fixtures. El rendimiento de Chromium con SwiftShader no certifica el rendimiento en una GPU o teléfono físico. El proyecto alternativo de Godot y las herramientas de conversión de modelos no forman parte de la ejecución integral de la aplicación web.

## Evidencia y reproducción

- `tests/output/revision-2026-10-05/reproductions.json`: datos de los tres defectos.
- `tests/output/revision-2026-10-05/summary.json`: resultados consolidados y enlaces relativos a los logs físicos de esta revisión.
- `tests/output/revision-2026-10-05/isolated/orientation-mobile/after-360x640.png`: solapamiento del minimapa y las misiones.
- `tests/output/revision-2026-10-05/isolated/mejora-integral-2026-10-01/fase2/movil/results.json`: medidas de los siete controles táctiles en 844×390.
- `tests/output/revision-2026-10-05/remote-readonly.json`: respuestas remotas y comparación del catálogo.
- `reports/review_reproductions_2026_10_05.cjs`: reproducción local de los defectos.
- `reports/review_remote_readonly_2026_10_05.cjs`: diagnóstico GET de Supabase.
- `reports/review_integral_2026_10_05.cjs` y `review_output_isolation_2026_10_05.cjs`: ejecución de las suites sin sobrescribir las salidas históricas.

Desde `SIDE1`:

```powershell
node reports/review_reproductions_2026_10_05.cjs
node reports/review_remote_readonly_2026_10_05.cjs
node reports/review_integral_2026_10_05.cjs --phase=review
node reports/review_integral_2026_10_05.cjs --phase=review-retry --only=npc_locomotion.cjs,decisions_cycle_ui.cjs,teacher_report_pdf_ui.cjs --no-fps
node reports/review_summary_2026_10_05.cjs
```
