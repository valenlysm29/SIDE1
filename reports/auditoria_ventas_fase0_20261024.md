# Auditoría de ventas — Fase 0, 24/10/2026

Solo lectura del producto; no se consultó ni modificó Supabase remoto. Se revisaron git log, reports/auditoria_integral_2026-10-23.md, docs/despliegue_cierre_20261023.md y código actual.

## Diagnóstico

Hay DOS motores. El ejecutado por la partida actual es `js/cycle_model.js`, con `production_model.js`, `revenue_model.js` y `financial_model.js`. `js/engine/ciclo.js` contiene otro cierre, usado por oráculos y pruebas históricas. Una prueba verde de ese segundo motor no certifica la partida real. Ejemplo: `tests/cierre_excel_remoto.test.cjs:5-11` carga SIDE_EXCEL_UI y llama `cerrarExcel`, mientras la partida usa `cerrarNegocio`.

No es posible afirmar que las migraciones faltan en producción sin consultar el esquema remoto. Sí está confirmado que el repositorio entrega SQL marcado explícitamente «No ejecutado en Supabase» y que el cierre requiere ese despliegue. El error reportado `e.estado` es compatible con una función remota antigua: el SQL actual de contexto filtra `participantes.expulsada_at`, sin leer esa columna inexistente.

## Traza del flujo real

| Paso | Fuente y números | Bloqueo/cero posible |
|---|---|---|
| Confirmación | `js/company_summary.js:85-111`: valida, guarda decisiones/ledger, `captureCyclePlan`, encola snapshot antes del reporte | Guardado local no implica confirmación remota; la UI termina diciendo confirmado «en este equipo» |
| Plan | `js/app.js:1411-1413`: captura `__cyclePlans[round]={state,production:productionPlan()}` | Si no existe o no llega al snapshot remoto, el servidor omite la empresa |
| Recuperación plan | `js/app.js:1462-1469`: reconstruye solo el ciclo ACTUAL si `simulationSubmissionComplete()` | No replica decisiones históricas al construir planes de ciclos posteriores |
| Sincronización | `js/app.js:1498-1523`: StudentSync con CAS revision, guardarEstado y outbox | Red/RLS/migración puede dejar snapshot local pendiente |
| Cierre docente | `js/docente.js:510`: sincronizar y cerrar ciclos vencidos; `:1017-1034` llama cerrarNegocio | Docente cerrado/desconectado: ningún ejecutor servidor calcula el reparto |
| Contexto remoto | `services/partida_service.js:360-372`: RPC contexto, extrae planes, llama closeMany | `SIN_PLANES_CONFIRMADOS` es no-op provisional; no persiste ventas |
| Filtro SQL | `supabase/migrations/20261023_cierre_negocio.sql:23-38`: participantes activos + snapshot con plan del ciclo | Empresa sin plan queda fuera incluso si decidió en ciclo anterior |
| Capacidad | `js/production_model.js:125-155`: 24 días, eficiencia min(1,.90+.01*N3+.04*jefatura); empareja trabajador/equipo por área, toma mínimo | Sin personal o equipo en cualquier área: capacidad 0 |
| Insumos y molde | `js/production_model.js:156-182`: molde disponible, insumos comprados ciclo actual + inventario; mínimo(meta elegible, capacidad procesos, capacidad material) | Sin molde o algún insumo: producción 0; entradas de personal/insumos de otro round se ignoran |
| Perfil mercado | `js/revenue_model.js:8-29`: reputación operativa derivada de producción, N3, utilización y publicidad | No utiliza la reputación del catálogo; no calcula calidad del lote |
| Precio | `js/revenue_model.js:5,29` y `js/cycle_model.js:12,25`: valores por defecto 75/95/125; precios solo argumento externo | No existe precio económico elegido en las decisiones actuales; defaults fuera de rangos solicitados |
| Participantes | `js/revenue_model.js:33-37`: canal web/distritos y quantity=target + inventario >0 | Sin canal vende 0; empresa con meta positiva y producción 0 aún compite y roba demanda |
| Reparto | `js/engine/mercado.js:3-20`: ponderaciones v2, calidad proxy reputación, denominador económico compartido | Reproduce errores del Excel antiguo E5; precio score medio/premium puede ser negativo |
| Stock/ventas | `js/cycle_model.js:20-28`: disponibles=producción+stock, demanda=floor(asignado*factorEventos), sold=floor(MIN(stock,demanda)) | Demanda o stock 0 => 0; demanda no atendida se pierde |
| Ingresos | `js/cycle_model.js:29-34`: suma sold*price, ledger SIM_VENTAS=ingresos; comisión 1% | No aplica CONS-01/02 ni crédito a ventas del runtime |
| Persistencia | `services/partida_service.js:386`; SQL `side_guardar_cierre_negocio` bloquea partida/estados y revisiones | Migración faltante, CAS o SQL antiguo impiden persistir |
| Caja/estados | `js/financial_model.js:16-20,45-54,86-87`: ventas ledger -> flujo/caja; snapshots financieros congelados | Sin cierre ledger no registra ingresos; reporte permanece pendiente |

## Hipótesis y riesgos confirmados

1. Migraciones no ejecutadas: NO VERIFICABLE remoto. Entrega previa admite no ejecución; la reparación exacta ya existe en docs/sql/20261023_despliegue_cierre_completo.sql.
2. Plan confirmado/sincronizado requerido: CONFIRMADO. SQL excluye empresas sin el plan, antes de calcular.
3. Docente requerido para calcular: CONFIRMADO. El servidor actual autoriza y persiste resultados del navegador, no ejecuta fórmulas. La guía lo declara explícitamente.
4. Sin recursos no hay ventas: CONFIRMADO, además probado. Requiere mensaje al estudiante por cada limitación.
5. Precio faltante: CONFIRMADO. Se inventan defaults 75/95/125.
6. Consecuencias y reglas de FlujoWeb no conectadas: CONFIRMADO para runtime. `js/engine/ciclo.js:25` sí replica/elimina, pero no participa en closeMany actual. El runtime no ejecuta el módulo consecuencias.
7. Empresa tardía excluida definitivamente: SQL congela el primer cierre por partida/ciclo y devuelve ese mismo cierre al reintentar. Si hay una empresa con plan, puede cerrar sin las demás. Cuando llega un plan tardío, ese cierre ya no la incorpora. La cola solo resuelve el caso de ningún plan, no el cierre parcial.
8. Separación 3D: CONFIRMADA en ruta vigente: ciclo ignora ledger recreativo salvo cierres históricos congelados; contexto de negocio contiene eventos, sin lecturas del simulador. No reconstruir esta separación.

## Diseño mínimo propuesto para implementación

Mantener contrato del runtime (state/ledger/receipt/financial) y reemplazar su lógica económica por módulo puro en js/engine, usando adaptador de IDs UI a códigos de las 68 opciones. Config única para pesos, rangos, precios, puntajes y supuestos. El plan llevará precios por segmento; calcular calidad por receta de cada lote y reputación única 0–10 desde aportes. Orden: capacidad, consecuencias de eficiencia, producción/consumos, calidad, reputación y su historial, demanda/reparto v2 con participantes que produjeron, stock, precios efectivos e ingresos, crédito, costos, caja/estados. Mantener idempotencia con recibo por ciclo y sin Date/random. No confiar en producción capturada del navegador: recalcular desde decisiones.

El cierre servidor debe reutilizar ese módulo en Edge Function o implementar una RPC verificable. Mientras no haya ejecutor instalado y programado, no declarar autonomía del cierre. No aceptar resultados arbitrarios de estudiantes con SECURITY DEFINER.

Resolver ausencia de planes ANTES de congelar reparto: primera falta elimina; posteriores replican último plan válido con round actualizado y compras recurrentes coherentes. Conservar eliminación docente. Registrar inclusión/exclusión explícita en recibo.

## Verificación realizada

`node --test tests/business_cycle.test.cjs tests/cierre_excel_remoto.test.cjs tests/business_empty_closure.test.cjs tests/world_economic_independence.test.cjs`: **18/18**, cero fallos. Casos: 3 ciclos con 100 ventas a S/75; ausencia de insumos/personal; plan vacío provisional; separación 3D; idempotencia y CAS simulado. Las pruebas antiguas cerrarExcel no validan cerrarNegocio ni despliegue real.

No hay package.json en raíz, ni script de build/lint declarado allí. README.md:49 documenta batería `node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs`. No se ejecutó batería completa durante esta auditoría.

## Implementación E — cierre v19

Se añadieron `js/engine/config.js` y `js/engine/cierre.js`; `js/cycle_model.js` usa ese cálculo en el flujo real y conserva su contrato de recibo, ledger y snapshot financiero. `revenue_model.js` ahora adapta el mismo módulo. El motor recalcula desde decisiones; una producción inyectada por un navegador no crea unidades. Los archivos no leen DOM, Supabase, reloj ni simulador3d.

El reparto literal antiguo se conserva exclusivamente para oráculos históricos en `engine/mercado.js`; la ruta del juego usa v19 corregida. Las consecuencias Premium y reputación baja tienen entrada genérica `settleMarketCompanies` para contrastarlas con celdas Excel, además de `prepare/allocate/closeMany` para decisiones físicas reales.

### Efectos y límites

| Regla | Estado final |
|---|---|
| Capacidad, producción y consumo | Recalculados; límites por meta, molde, personal/equipo y materiales; ninguna demanda crea producción |
| Calidad/reputación | Calidad suma molde y aportes de materiales realmente consumidos FIFO, tope10; reputación única aportes catálogo+consecuencias, tope10 |
| CONS01/02 | Premium<7 precio×.65/reputación−2; >=7 precio×1.4/reputación+2. La UI actual ata Premium a molde3: con tres materiales básicos ya alcanza7, de modo que la penalización solo se alcanza en la API de lotes genéricos/oráculo. No se añadió menú para forzar ese caso |
| CONS03/08 | Factores .7 y .95 posteriores al límite físico y sujetos a umbrales; consumos ajustados a producción efectiva |
| CONS04 | Historial de reputación final; segundo ciclo consecutivo<3 demanda×.8 |
| CONS05 | +3pp configurable al próximo préstamo, interés incremental solo sobre el nuevo principal; no recarga deuda anterior |
| CONS06 | La meta superior a capacidad muestra explicación. La producción nunca rebasa capacidad efectiva: no existe producción extra que cobrar ni retraso ficticio. Autorizar horas extra/reprogramación sigue pendiente |
| CONS07 | Stock no vendido se conserva, almacenajeS/2/u configurable y asiento de caja |
| Crédito | 20% inicial+5pp/ciclo+5pp con analista, tope70%, siguiendo UI existente; base docente soportada; cobra al siguiente ciclo, reconoce cuentas por cobrar e ingresos devengados |
| Garantía | 30dS/5;90dS/10;180dS/10 es SUPUESTO nuevo explícito centralizado |
| Depreciación | A lineal, B por producido/100000, C doble lineal con límite de valor restante; B/C son SUPUESTOS sin fórmula original suficiente. Solo contabilidad, no caja. Se leen códigos existentes en selección persistida, sin menú nuevo |
| Mantenimiento/inventarios | Aportes de puntaje de códigos existentes; bonificación física adicional neutral/configurable. No se generan inventarios gratuitos |
| Canales/marketing/capacitación | Supuestos centralizados: cobertura base neutral; tiendas adicionales+5%tope25%; marketing0/12/20%;capacitación0/8/12%. El marketing no vuelve a alimentar reputación mediante gasto/publicidad |
| Plan replicado sin ledger | Reconstruye una sola vez cada categoría faltante mediante el mismo decision_review_model y reglas de costos actuales; conserva asientos presentes |

### Supuestos de adaptación inevitables

La UI histórica no ofrece las68 opciones como68 controles separados: hay opciones del Excel sin selector equivalente y grupos físicos que admiten mezcla. No se amplió ese menú. El adaptador mapea IDs actuales y acepta códigos ya existentes en `__catalogSelection`; cuando hay múltiples niveles seleccionados toma una contribución por grupo. La calidad de una mezcla usa la composición efectivamente consumida por familia y aplica esa mezcla común a los lotes del ciclo. Ambos criterios deben ser aprobados como supuestos, no presentados como fórmulas históricas demostradas.

### Evidencia actualizada

- Oráculo fresco v19: `node tests/oracle_v19.cjs`:9casos mercado,303comprobaciones,0diferencias, Excel COM16 porque LibreOffice no está disponible.
- Pruebas dirigidas de cierre/contabilidad/independencia:33/33verdes.
- Adaptador revenue actualizado:7/7verdes, incluyendo dependencias navegador y servicio remoto simulado.
- `node tests/business_closure_independent_db.cjs`:PASSdespliegue repetido, autorización docente, CAS, idempotencia, persistencia snapshot y ajuste de capital posterior.
- Las fixtures de pruebas antiguas se actualizaron a decisiones físicas completas: inyectar producción o asignación ya no es un contrato válido. Las comparaciones antes/después del3D siguen siendo igualdad exacta.
- La batería completa y la verificación real en Supabase corresponden a la integración final; estas pruebas locales no certifican un ejecutor servidor desplegado.
