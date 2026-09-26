# Auditoría financiera y ciclos — 26/09/2026

## Arquitectura encontrada y reutilizada

- Frontend estático: `app.js` coordina alumno, decisiones, borradores, confirmaciones, libro de caja y reportes; `docente.js` administra profesor, partidas y calendario. El servidor Python entrega archivos; no calcula operaciones económicas.
- `decision_catalog.js` aporta opciones/costos; `decision_review_model.js` valida y prepara movimientos; `production_model.js` determina capacidad, materiales y producción; `side_rules.js` conserva calendario y contratos de tiendas. No se han cambiado estas fórmulas.
- Fuente de caja: capital inicial más `cashLedger`, indexado por ciclo y concepto. `financial_model.js` deriva estado de resultados, flujo y balance del libro registrado y sus desgloses. Préstamos son deuda; moldes/equipos/mejoras son activos. La política académica existente trata insumos como gasto del ciclo; no se ha introducido valoración contable de inventarios ni depreciación.
- El mundo reutiliza `SIDE_GAME_BRIDGE`: ventas, comisión existente de tienda física, gastos, devoluciones y mejoras. El inventario físico, satisfacción, reputación, precios y mejoras operativas viven en `simulator3d.js` y almacenamiento local por empresa/ciclo. Las tiendas del hub deben llamar las mismas acciones, nunca crear una segunda contabilidad.
- Supabase/PostgreSQL conserva empresas, participantes, decisiones y reportes mediante servicios/RPC. `supabase_game_lifecycle.sql` administra fases `integration`, `decisions`, `results`, `finished`, `cancelled` y eventos. Polling de alumno consulta cada tres segundos usando tiempo servidor; la transición automática no necesita mantener abierta la pantalla docente.
- El guardado local por código/empresa/ciclo no equivale a un snapshot remoto completo del mundo. Reingresar desde otro navegador no reconstruye todo el libro e inventario local.

## Problemas confirmados y corregidos

1. La UI docente y el fallback local enviaban `iniciar`, pero la RPC actual no atendía esa acción. El profesor manual recibía todavía `integration`. Se restituyó el inicio manual explícito e idempotente, preservando integración programada automática y las transiciones por plazo existentes.
2. El puente permitía registrar ventas/gastos en fases cerradas. Ahora expone `canOperate()` y bloquea mutaciones fuera de la fase operativa y cantidades negativas/no finitas. El motor usa este contrato para suspender la sesión al cerrar el ciclo.
3. Un pedido cobraba S/360 y guardaba su entrega solo como temporizador RAM: recargar perdía las 12 unidades pagadas. Ahora el cargo y pedido se persisten juntos con el escritor local que revierte claves si falla. Se mantiene el precio/cantidad existente y el plazo 12/24 segundos, con fecha absoluta para sobrevivir recargas dentro del ciclo.
4. La entrega persiste un identificador con el stock antes de limpiar el pedido: repetir un tick o recuperar una escritura parcial no duplica mercancía. Una mejora solo cambia su nivel si se confirma el cargo.

## Archivos modificados / creados

Modificados: `app.js`, fragmentos económicos de `simulator3d.js`, `docs/supabase_game_lifecycle.sql`, `tests/game_lifecycle_db.cjs`.

Creados: `tests/world_finance.test.cjs`, este documento.

## Pruebas realizadas

- `node tests/game_lifecycle_db.cjs`: aprobado; inicio repetido, manual/automático, varios estudiantes, ingresos tardíos, reglas eventos, roles, pausa/reanudación/cierre, fechas límite y restricción de partida activa.
- `node tests/game_observations_db.cjs`: aprobado; códigos únicos, presencia, cancelación persistente, permisos, eventos no repetidos y agotamiento de códigos.
- `node --test tests/world_finance.test.cjs`: aprobado (6 pruebas); caja/ER/balance/flujo, comisiones/devoluciones/activos, fases cerradas, cantidades inválidas, fallo de guardado, pedidos recuperables e idempotencia de entrega. También pausa docente y reintento de checkout fallido sin pérdida de cliente ni cobro duplicado.

## Límites de la integración

- La migración SQL fue probada en PGlite con roles y aplicación repetida; **no fue desplegada en Supabase remoto**. Aplicar el archivo completo actualizado en la base configurada es necesario para corregir el inicio manual remoto.
- Las RPC académicas anteriores admiten identificadores de empresa anónimos; `guardar_reporte` recibe importes calculados en cliente. Esto no constituye contabilidad resistente a clientes maliciosos. Endurecer identidad y autoridad requiere migración coordinada de sesiones, no una modificación visual aislada.
- La persistencia local no es una transacción distribuida, ni sincroniza dos pestañas o dispositivos concurrentes. Las sincronizaciones remotas son asíncronas y pueden fallar; no se presentan como confirmaciones del servidor.
- Pedidos, stock y mejoras siguen el ámbito de ciclo existente. Un pedido pendiente al cierre queda registrado en el ciclo original; traslado de inventarios/pedidos entre ciclos requiere una regla académica explícita antes de cambiarlo.
- La garantía de entrega cubre recarga y escritura parcial de una entrega; no pretende recuperar un almacenamiento del navegador eliminado o corrupto.

## Cierre validado

El recorrido UI/WebGL de compra, recarga y entrega pasa con un único cargo de
S/360 y 12 unidades recibidas una vez. Las pruebas de ciclo/reinicio confirman
que no se vuelven a cobrar decisiones. La producción cero no recibe unidades
de demostración, y las compras se separan de la producción registrada.
La pausa docente bloquea las transacciones del mundo conservando los controles
académicos. El cobro confirma libro e inventario antes de retirar al cliente.
El inicio manual se validó además desde el botón docente con dos alumnos,
incluido el estado previamente preparado. La espera automática respeta el
reloj del servidor y continúa tras recarga o cierre de la pantalla docente.
Detalles y pruebas completas: `AUDITORIA_SIDE_2026_09_26.md`.
