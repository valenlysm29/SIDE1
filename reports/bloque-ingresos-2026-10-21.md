# Bloque A: ingresos, caja inicial y producción por lotes

Fecha: 21 de octubre de 2026 (Lima). Trabajo dentro de SIDE1, conservando cambios locales anteriores. No se modificó ninguna fórmula del motor, el menú de decisiones ni avatares. No se consultaron ni modificaron partidas de Supabase remoto.

## Diagnóstico y decisiones

| Observación | Diagnóstico | Decisión y justificación | Archivos | Verificación | Pendientes |
| --- | --- | --- | --- | --- | --- |
| 1. Ingresos siempre cero | El motor genera ingresos con planes factibles. Un plan sin mesa/molde, personal, materiales o lotes produce cero legítimamente. Se confirmó un bug de presentación/persistencia del historial: `adjuntarCaja` perdía `financialHistory` en cada cierre y al abrir otro ciclo la UI mostraba resultados cero sin conservar los anteriores. Las correcciones locales de entrada ya solucionaban esta pérdida y distinguían resultados pendientes. No existe evidencia para atribuir una causa única a la partida remota específica del usuario. | Conservar la corrección del historial, la distinción entre proyección y cierre y el aviso de producción cero. No fabricar ventas ni stock para enmascarar planes inviables. Asegurar ingresos y contabilidad en tres cierres reales del motor, más SQL de persistencia local con migraciones reales. | Correcciones locales conservadas: `js/engine/caja.js`, `js/app.js`, `js/student_financial_view.js`, `js/engine/ui_excel.js`, `tests/caja_excel.test.cjs`. Nuevos: `tests/ingresos_tres_ciclos.test.cjs`, `tests/ingresos_tres_ciclos_db.cjs`. | 21/21 pruebas de motor/caja/cierre; tres ciclos actuales local/RPC simulada idénticos; tres ciclos SQL PostgreSQL local con ingresos positivos, reportes, caja de empresa y snapshots; oráculo 3104/3104 sin diferencias. | Para identificar causa de una partida remota concreta hace falta su snapshot/configuración/cierres; no se afirma haber diagnosticado datos no disponibles. |
| 3. Caja inicial con costos ya descontados | En el modelo actual los gastos obligatorios se calculan en la proyección, pero el libro registra la salida una vez al cierre. La pantalla anterior podía dar a entender que la proyección era el saldo real. | Conservar capital íntegro al iniciar; explicar la reserva/proyección de local y limpieza y contabilizar al cierre. Es coherente con ingresos, consumo y utilidad del mismo período y evita cobro doble. Alternativa válida: reservar caja al inicio; revertir la decisión requeriría registrar un anticipo y compensarlo al cierre, nunca restar ambos. | `js/engine/caja.js` (sin nueva fórmula), `js/engine/ui_excel.js` y UI de caja coordinada con bloque C; prueba nueva de inmutabilidad al preparar plan y débito idempotente. | `Preparar el plan no descuenta caja; local y limpieza son gasto de cada cierre`; caja inicial S/100000 exacta; dos movimientos obligatorios negativos una vez; reintento idéntico. | Ningún SQL nuevo para este criterio. |
| 5. Plan por lotes | Existe: hasta tres lotes con cantidad, segmento, molde, precio y materiales; infraestructura, operarios y compras alimentan el mismo plan. Capacidad por área se calcula sobre 24 días; MP se consume secuencialmente, sobrantes se arrastran; activos se conservan y sólo se paga su incremento. Los costos y stocks se muestran en proyección y cierre. | Conservar las decisiones existentes y completar explicación del plan mediante DOP/proyección y aviso de plan inviable en UI (bloque C). No introducir tiempos unitarios ni almacenamiento máximo nuevos: el modelo sólo define capacidad por día/ciclo y costo de almacenaje de productos sobrantes. | `js/engine/produccion.js`, `ciclo.js`, `costos.js` investigados sin alterar fórmulas; `js/engine/ui_excel.js` correcciones locales conservadas; pruebas nuevas. | Producción y puntajes del modo actual iguales al modo Excel para las mismas entradas; conservación de cada MP; no recomprar activos en ciclos 2/3; pruebas existentes de FIFO, múltiples precios y stock anterior. | No existe decisión independiente de planificar tiempos ni límite físico de bodega en estas reglas: no se agrega. |

## Cadena auditada

1. Editor: `SIDE_EXCEL_UI.prepararDecisiones` conserva compras, activos, personal y lotes; los planes confirmados por ciclo se guardan en `planesPorCiclo`.
2. Producción: `normalizarActual` exige mesa y molde disponibles; `calcularProduccion` limita por capacidad y MP, convierte unidades de compra y mantiene identidades de materiales.
3. Resultados: `cerrarCiclo` añade producción a inventario, reparte demanda por segmento, vende FIFO y calcula ingresos como suma de vendido × precio efectivo. El canal comercial cobra y puntúa; no se añadió una prohibición de vender sin canal porque el reparto Excel no contiene ese bloqueo. No debe confundirse costo del canal con demanda garantizada.
4. Caja: `adjuntarCaja` transforma devengo a efectivo: caja final = inicial + ingresos + préstamos − pagos operativos − compras de activos; depreciación no consume caja y sólo MP consumida afecta utilidad. La utilidad puede ser negativa con ingresos positivos.
5. Cierre remoto: `PartidaService.cerrarExcel` calcula en JavaScript con el mismo motor; `side_guardar_cierre_excel` valida CAS, reconciliación y completitud. Persiste `side_excel_cierres`, `reportes_ciclo` (ingresos/costos/utilidad/caja), `empresas.caja_actual` y `side_student_state.snapshot.decision_state.__excel` (resultado/historial). Sus triggers protegen el cierre ante reportes/snapshots tardíos.

## Demostración reproducible de tres ciclos

`node --test tests/ingresos_tres_ciclos.test.cjs` usa el motor actual `side-lotes-2026-10-20`, canal web, una mesa/molde y personal en las tres áreas. Compra 25 unidades de cuero, 80 juegos de accesorios y 2 carretes por ciclo; planea 100 unidades a S/40. El recurso limitante son los accesorios. Local y RPC simulada producen resultados idénticos:

| Ciclo | Plan | Producción / ventas | Ingresos | Costos del resultado | Utilidad | Caja inicial | Caja final |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 100 | 80 / 80 | 3200 | 10109.695 | -6909.695 | 100000 | 85158.03 |
| 2 | 100 | 80 / 80 | 3200 | 10109.695 | -6909.695 | 85158.03 | 78179.06 |
| 3 | 100 | 80 / 80 | 3200 | 10109.695 | -6909.695 | 78179.06 | 71200.09 |

Puntajes de los tres ciclos: calidad 4, eficiencia 5, reputación 3. Hay ventas y pérdidas coherentes: el margen no cubre estructura y personal. El escenario no promete rentabilidad. Diferencia caja/utilidad: compras de activos y variación de inventario; se comprueban ambas conciliaciones con tolerancia relativa 1e-9. Evidencia: `tests/output/ingresos-tres-ciclos-20261021.json`.

`node tests/ingresos_tres_ciclos_db.cjs` ejecuta las migraciones reales sobre PostgreSQL local embebido (PGlite), con otro plan de 200 unidades y compras más grandes. Recupera contexto e historial desde SQL antes de cada cierre y comprueba cada valor persistido y el reintento idempotente. Ingresos S/4320 en ciclos 1, 2 y 3; utilidad -8052.9120370370365; caja 64863.17296296296, 37589.34592592593 y 10315.518888888895. Evidencia: `tests/output/ingresos-tres-ciclos-sql-20261021.json`. No usa credenciales ni red de Supabase.

## Paridad y comandos ejecutados

- `node --test tests/ingresos_tres_ciclos.test.cjs tests/caja_excel.test.cjs tests/ciclo_excel.test.cjs tests/cierre_excel_remoto.test.cjs`: 21 aprobadas.
- `node tests/ingresos_tres_ciclos_db.cjs`: aprobado.
- `node tests/paridad_base.cjs`: 351 sin diferencias.
- `node tests/paridad_consecuencias.cjs`: 56 sin diferencias.
- `node tests/oracle/comparar_pipeline.cjs sim1`: 468 sin diferencias.
- `node tests/oracle/comparar_pipeline.cjs sim2`: 585 sin diferencias.
- `node tests/oracle/comparar_pipeline.cjs sim3`: 1140 sin diferencias.
- `node tests/oracle/banca_recuperacion.cjs` y `--mezcla`: 252 + 252 sin diferencias.

Total **3104/3104**. Esta corrida ejecutó nuevamente JavaScript contra los esperados independientes ya calculados en Excel y versionados; no volvió a abrir/recalcular Excel mediante COM. No se modificaron entradas, esperados ni fórmulas. Los escenarios del modo actual además comprueban igualdad de producción/puntajes con las fórmulas Excel y las identidades contables; los costos propios ya definidos del modo actual, como web, conservan su regla existente. Logs: `tests/output/ingresos-oracle-*.log`.

El bloque no requiere migración SQL nueva. Las pruebas usan las existentes de 11/10, 12/10 y `2026-10-20_correcciones_docente_estudiante.sql`. El orden completo de despliegue y cualquier SQL de otros bloques se entrega en el informe principal. No se ejecutó SQL remoto.

## Continuación

Bloque A completado; sin bloqueo de uso. El revisor principal debe ejecutar la batería Node completa, SIM-1/2/3 de navegador y corredores desktop/móvil tras integrar los otros bloques. No crear commits parciales de los archivos compartidos mientras otros agentes editan; el responsable principal ordena commits y push a main.
