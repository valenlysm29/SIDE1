# Ventas e ingresos conectados con el docente — 27/10/2026

## Causa

El motor ya calculaba ventas físicamente válidas y el alumno podía consultar
una proyección con sus cinco apartados confirmados. Sin embargo, el reporte
enviado al servidor solo contenía los movimientos contabilizados: ingresos
cero mientras el ciclo estaba abierto. El docente no leía el plan confirmado,
no mostraba unidades vendidas y escogía el ciclo de la empresa, que podía
seguir en el período anterior. Con Realtime conectado, la lectura financiera
se espaciaba a 30 segundos aunque la interfaz anunciaba tres segundos.

## Corrección

- El reporte del alumno transporta `liveProjection` dentro del JSON existente
  `estado_resultados`. Los campos contables de ingresos, caja e inventario
  mantienen sus valores registrados. También transporta el recibo definitivo
  y las unidades vendidas cuando existe un cierre.
- La RPC docente conserva su contrato y añade `contexto_juego`: sala, código,
  ciclo del servidor, fase, configuración financiera y snapshot confirmado.
  Solo el profesor propietario puede leerlo. No hay escrituras en esa lectura.
- `services/live_results.js` calcula la misma proyección individual del alumno
  con el motor económico existente. Usa materiales, capacidad, personal,
  canales, precios internos, inventarios, eventos y programación financiera.
  Un plan sin confirmar o de otro ciclo no genera una proyección.
- El docente consulta los resultados cada tres segundos con la página visible,
  incluso con Realtime conectado. Conserva el retroceso de reintentos cuando
  falla la conexión. Muestra ingresos, unidades y detalle por segmento en
  Empresas y Resultados. Los importes conservan los céntimos del precio interno.
- La estimación se identifica expresamente como individual. El cierre compartido
  del mercado la reemplaza; sus ventas, unidades y estados financieros prevalecen
  sobre lecturas antiguas en tránsito. La exportación identifica las estimaciones.
- La lectura del JSON del reporte permite compatibilidad con el SQL anterior
  cuando ambos navegadores ya cargaron el código nuevo y el alumno sincronizó
  su plan. La migración permite leer directamente los snapshots, incluso si
  falta ese reporte o fue enviado por una versión anterior del cliente.

No se modificaron el catálogo, las opciones, los controles ni el flujo de envío
de los apartados de decisiones. Tampoco se añadieron precios editables ni
asignaciones de personal a la interfaz. Los históricos no se recalcularon.

## SQL y aplicación

Instalación v19 actualizada: aplicar
`supabase/migrations/20261027_resultados_en_vivo.sql`.

Si también faltan las correcciones previas de cierre/precios/snapshots, aplicar
el paquete completo `docs/sql/20261023_despliegue_cierre_v19.sql`, que ahora
incluye la nueva migración al final. El paquete está destinado a una instalación
con las tablas y migraciones de admisión existentes, no a una base vacía.

Actualizar los archivos web y recargar las páginas del alumno y docente. Se
actualizaron las versiones de los scripts para renovar la caché del navegador.
Esta tarea preparó y probó el SQL en PostgreSQL local desechable. No aplicó
migraciones ni escribió decisiones en el Supabase alojado.

Las ventas definitivas se contabilizan al cerrar el ciclo, conforme al motor.
En juego se muestra una estimación: el reparto entre empresas puede cambiar
el resultado definitivo. Un plan sin materiales o sin canal conserva ventas
cero; la presentación no inventa stock ni dinero.

## Validación

- `tests/output/live-sales-final.log`: 62/62 verificaciones de motor, reportes,
  aislamiento, presencia, cierre, entrega estática y estabilidad de decisiones.
- `tests/output/live-sales-sync.log`: 50/50 verificaciones de sincronización,
  recuperación de sesión, envíos, contratos, notas y presentación financiera.
- `tests/live_sales_db.cjs`: tres ciclos mediante RPC y servicio de cierre real
  sobre PostgreSQL desechable. Cada ciclo: 90 unidades y S/ 3.825, tanto en la
  proyección como en el cierre de la empresa de prueba. Verifica lectura sin
  escrituras, reporte compatible, caja sin cobro anticipado, permisos, aislamiento,
  persistencia, reconexión y cierre idempotente. Resultado en
  `tests/output/live-sales-db.json`.
- `tests/cierre_v19_db.cjs`: paquete SQL aplicado dos veces, autorización,
  resolución de todas las empresas, planes recuperados, CAS e idempotencia.
- `tests/live_sales_ui.py`: Chromium con alumno/docente en contextos independientes,
  cinco confirmaciones reales, envío de proyección por el transporte existente,
  actualización automática con Realtime conectado, unidades e ingresos visibles,
  compatibilidad con SQL anterior y reemplazo definitivo. Sin errores de página.
  Evidencias en `tests/output/live-sales-ui/`, inspeccionadas visualmente.
- `tests/sales_recovery_ui.py`: los tres segmentos con los cinco botones de
  confirmación existentes, proyecciones, ventas definitivas, recarga y caja intacta
  al proyectar. Sin controles nuevos ni errores de página.

Todos los archivos de trabajo se mantuvieron en SIDE1. El directorio contenedor
continúa teniendo únicamente la carpeta SIDE1.
