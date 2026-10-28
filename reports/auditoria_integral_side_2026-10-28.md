# Auditoría inicial SIDE — Supabase y economía

Estado: diagnóstico parcial; no está listo para despliegue. Rama fix/ventas-ingresos-impuesto, commit 908cdfa. Antes de la auditoría existían sin seguimiento package.json, package-lock.json, supabase/migrations/20260913000000_esquema_inicial.sql y supabase_respaldo/; se conservaron.

## Esquema y migraciones

Docker responde; `supabase status` informa que no existe el contenedor `supabase_db_SIDE1`. No se completó reconstrucción local. `supabase/schema.sql` y la migración provisional crean participantes, pero no definen empresas_decisiones, decisiones_catalogo ni decisiones_opciones. `supabase/migrations/supabase_migration.sql` presupone esas tablas y empresas. Hay nombres históricos incompatibles con CLI y versiones repetidas de ocho dígitos. Renombrarlos sin un mapa completo y cotejo de historia puede alterar orden y generar incompatibilidad. No se modificaron SQL ni producción.

## Trazabilidad económica

`js/production_model.js` calcula capacidad y producción; `js/engine/cierre.js` calcula demanda por segmento, ventas como mínimo de stock y demanda e ingresos como ventas por precio. `js/cycle_model.js` conserva stock y liquidaciones. `js/financial_model.js` calcula valores consumidos, depreciación, crédito e impuesto. `services/partida_service.js` envía el cierre a RPC de persistencia; reportes y snapshots se consultan desde `js/docente.js` y `js/student_financial_view.js`.

Hallazgos: no existe asignación ni registro de ventas por tienda; los canales seleccionados no condicionan el reparto y existen competidores sintéticos activados por defecto. No se puede afirmar que las unidades correspondan a operaciones por tienda. El cierre consume cash_ledger y financial_sections procedentes del cliente, comprometiendo integridad de caja y costos; una solución integral requiere modificar el motor/servicio servidor, prohibido en esta auditoría. El criterio md reconoce como costo toda la producción del ciclo incluso si queda stock, lo que difiere de costo de ventas contable y requiere decisión de negocio y cambio del motor. Estos problemas son críticos o altos y no se solucionan de forma segura con SQL aislado.

## Pruebas

69 pruebas focales económicas: aprobadas. `node tests/side_three_cycles_db.cjs`: tres ciclos PGlite, ventas, impuesto final y reintento aprobados. `node tests/business_worker_db.cjs --edge`: dos ciclos y impuesto final aprobados. Estas pruebas no acreditan reconstrucción Supabase, identidad real, tiendas ni RLS integral. Las pruebas obligatorias restantes están bloqueadas o no se ejecutaron en Supabase local.

## Pendientes y reversión

Reconstruir definición fiel de las tablas faltantes desde fuente autorizada y elaborar una cadena local aislada sin reescribir historia aplicada. Validar todos los RPC, RLS, concurrencia y conservación histórica sobre Supabase local. Diseñar operaciones por tienda y cálculo financiero autoritativo en servidor; ambos requieren cambios de JS/Edge no autorizados. No hay correcciones SQL que revertir. Producción permaneció intacta; no se modificó código fuente.
