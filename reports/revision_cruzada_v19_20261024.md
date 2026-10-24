# Revisión cruzada J — 24/10/2026

Revisor independiente del runtime y SQL: agente A/H, autor únicamente de auditoría y workbook/oráculo. No modificó archivos de motor, servicios, UI o SQL. Revisó implementaciones de cierre, configuración, servicio remoto, persistencia SQL, sincronización y presentación. Esta revisión no afirma haber inspeccionado la base de producción.

## Hallazgos

### J1 — Pérdida de clasificación financiera al recalcular cierre remoto: corregido

`js/cycle_model.js` reconstruye el ledger y secciones cuando el plan replicado no trae recibos de sección. El servicio remoto recalculaba con las secciones originales vacías y perdía la clasificación de compras/MP. Reproducción independiente: fixture de cuatro maestros/área, estado de ciclo2, ledger vacío, capital200000. Cierre inicial: ingreso3825, costos62139.15, inventarioMP34823.10. Recálculo anterior del servicio: ingreso3825, costos96962.25, inventarioMP0. No era una diferencia de redondeo.

Se informó al integrador/B y se corrigió allí: `js/cycle_model.js:55` devuelve financialSections; `services/partida_service.js:383` conserva esas secciones y el ledger ajustado; `supabase/migrations/2026-10-23_cierre_planes_v19.sql:153` persiste financial_sections junto al estado y ledger. Reejecución del revisor: comparación deepEqual integral entre cierre y recálculo financiero, aprobada. El oráculo498comparaciones sigue sin diferencias.

### J2 — Costos efectivos del runtime y v19 aún divergentes: requiere resolución explícita

Al momento de esta revisión, `js/decision_catalog.js:48`, `:53`, `:58` usa remuneraciones base4000/4500/4500 y `production_model` suma sus costos directamente. El fixture de cuatro operarios N3 por área da plan.costs.labor52000, frente a56384.64 usando nómina MYPE del Excel (costoLaboral). MP del runtime en `js/decision_catalog.js:85` y `:94` usa cuero premium140 y hilo premium0.22, mientras la fuente corregida conserva80 y7; accesorios premium5 frente a9. Mantenimiento UI200 frente al catálogo Excel1500 para el nivel equivalente. Son valores heredados de sesiones previas, pero la regla actual exige Excel como única fuente.

Se comunicó al integrador/B con reproducción Node. No se debe afirmar paridad integral de costos/caja de todas las decisiones mientras esto siga así. Resolver exige usar valores y fórmulas v19 en las opciones existentes y costos, o una decisión explícita del usuario que autorice actualizar la fuente con aquellos valores. El revisor no cambió el menú ni inventó esa aprobación.

El oráculo498/0 acredita las salidas detalladas en el informe Excel: mercado, producción física, consumos, calidad, reputación, ingresos, crédito y nueve componentes de costo laboral de la función Excel. **No acredita igualdad del costo total operativo del runtime con Excel**; J2 prueba esa frontera de cobertura.

## Verificaciones positivas

- Precio elegido validado en cliente y trigger de servidor, rangos40–45/120–200/220–400; no se infiere precio desde el mundo3D.
- Motor puro sin DOM/red/reloj, resultados deterministas y cierre integrado reutiliza recibo del mismo ciclo.
- Competidores filtrados por lote realmente producido; ventas limitadas por inventario y demanda, precioScore limitado y empate protegido; calidad real reemplaza el proxy de reputación.
- SQL manual con bloqueo de partida/ciclo, control de profesor, token de revisiones, conjuntos completos de empresas y escritura atómica. Ningún SQL de esta revisión fue aplicado en producción.
- Se resuelven planes omitidos en servidor antes del reparto: expulsión primera omisión y réplica posterior, con gracia de sincronización en automático.
- Outbox durable con comprobación de revisión y firma de escritura, reintento creciente y recuperación al volver la red.
- Limpieza de canal docente y guarda de generación, polling de respaldo y UI estable en listas; errores visibles y reintentos acotados.
- Experiencia por segmento muestra stock, demanda, precio, ingreso y motivos de venta0, usando recibo económico.
- Excel fresco1663fórmulas sin errores; 68opciones,0rangos truncados,0costos textuales sucios,0fechas corruptas.498comparaciones JS vs cachés COM independientes sin diferencias en el alcance declarado.

## Límites que deben quedar visibles en entrega

1. La RPC persiste con control concurrente, pero el reparto todavía se calcula en JavaScript del docente. Con el docente desconectado, se recupera al reconectarse; no existe ejecución autónoma programada de cierre en servidor. Es el mínimo seguro admitido por la instrucción, no cumplimiento de independencia del navegador.
2. La disponibilidad real de migraciones/triggers de Supabase no se prueba leyendo archivos. El SQL manual requiere ejecución por el usuario y diagnóstico posterior autenticado.
3. LibreOffice no está instalado. Se usó Microsoft Excel COM16.0 con CalculateFullRebuild, no se fingió recálculo LibreOffice.
4. Garantía180d aS/10, crédito progresivo, medios de marketing no cuantificados, FIFO de mezclas, almacenaje, tasas y aceleración contable son supuestos configurables, no cifras deducidas de fórmulas originales.
5. CONS06 no permite producción física por encima de capacidad; informa el exceso de meta, sin cobrar horas extra inventadas. El parámetro de25% queda reservado a un eventual modelo de horas extra que sí autorice esa producción.

## Adenda del integrador tras el dictamen independiente

J2 se corrigió después de este dictamen, sin cambiar opciones del menú: `decision_catalog.js` usa nómina MYPE de las fórmulas de Costos De Producción, materiales físicos25/45/80,4/9,2/4/7 y mantenimiento1500. La comparación independiente con las cachés COM de los nueve costos laborales, más el ejemplo de cuatro N3 por área, está en `tests/costos_runtime_v19.test.cjs`: costo56384.64, no52000. Se conserva la diferencia entre sueldo referencial del catálogo y nómina completa. La revisión A identificó el fallo; esta adenda y su corrección fueron realizadas por el integrador, no se atribuyen al revisor.

La prueba también verifica descuento único de MP y balance inicial sin duplicar cuentas por cobrar. El oráculo original mantiene498comparaciones sin diferencias en su alcance. Las tarifas heredadas de tiendas y analista se centralizaron en `engine/config.js`, junto con los demás supuestos. CONS03 se ajustó expresamente a70% **de lo planeado** antes de límites físicos; CONS08 se aplica adicionalmente a la producción limitada.
