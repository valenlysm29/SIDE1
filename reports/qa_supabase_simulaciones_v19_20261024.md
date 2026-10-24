# QA independiente de persistencia, sincronización y simulaciones v19

Fecha: 24/10/2026. Pruebas locales; no hubo escrituras ni migraciones en Supabase alojado.

| Ejecución | Resultado | Qué acredita |
|---|---|---|
| `node tests/cierre_v19_db.cjs` | PASS | Paquete SQL exacto aplicado dos veces; todas las empresas resueltas; primera omisión elimina; réplica de plan; recuperación de confirmación; autorización; precios inválidos rechazados; gracia automática; persistencia económica; cierre repetido reutiliza resultado |
| Demo desechable SIDE-000 incluida en esa prueba | 3 empresas venden 100 unidades y generan S/4.250 cada una | Decisiones físicas válidas atraviesan motor compartido, cierre SQL y snapshot. La cuarta empresa nunca decidió y se elimina |
| `node --test tests/student_sync.test.js tests/student_sync_backoff.test.cjs tests/teacher_presence_regression.test.js tests/business_empty_closure.test.cjs tests/roster_realtime_v19.test.cjs` | 20/20 PASS | Backoff evita que polling repita envíos; confirmación perdida y CAS; cola durable; canal único; reconciliación lenta cuando Realtime funciona; reconexión y limpieza; presencia monotónica con histéresis |
| `node tests/simulaciones_v19.cjs` | PASS | SIM-1/2/3: 3 ciclos × 4 empresas por simulación, una por segmento y una mixta; determinismo; cierre duplicado; producción/stock; crédito y cobranza; inventario remanente; precios empatados; ausencia de insumos, personal o molde |
| Sintaxis de docente, servicio, diagnóstico; `git diff --check` | PASS | Integridad sintáctica, sin errores de whitespace |

La evidencia detallada de 36 cierres de empresa está en `tests/output/simulaciones_v19.json` (local e ignorada por Git).

La ampliación final de PostgreSQL también pasó: instala triggers históricos de prueba y comprueba su retiro por el paquete exacto; rechaza un token CAS obsoleto sin crear cierre; una segunda empresa confirma durante la gracia automática y aparece junto con la primera al vencer los 30 segundos, sin expulsión prematura. El plazo automático coincide con `side_runtime` del servidor (`gameStartAt + ciclo × duración`); sus controles sólo admiten pausa/reanudación en modo manual, donde no se aplica esa gracia.

La revisión cruzada posterior detectó y corrigió un defecto adicional: `PartidaService` recalculaba finanzas con las secciones originales vacías después de que el motor reconstruyera sus desgloses. Eso convertía compras de materia prima sin consumir en gasto. Ahora el resultado transporta `financialSections`, el servicio usa esas secciones, conserva la política financiera efectiva del recibo y SQL persiste el desglose junto con el ledger completo, incluidos ajustes de capital. La prueba PostgreSQL ahora cierra mediante el servicio real y compara costos e inventario MP de cada empresa (incluida la réplica) contra el motor directo. Además borra el snapshot financiero en memoria y recalcula con los datos persistidos: los costos e inventario siguen coincidiendo. Resultado PASS.

SIM-1 comprueba ventas positivas por segmento cuando hay producción y existencias. SIM-2 introduce inventario inicial alto, empate de precios y materiales económicos en el segmento Premium. SIM-3 mantiene tres empresas sin un recurso imprescindible (cuero, personal de corte o molde) y una empresa mixta válida: las tres primeras producen/venden cero con motivo; la cuarta vende. Todas las simulaciones verifican que las ventas no superan stock/demanda, que ingresos son unidades por precio efectivo y que el crédito del ciclo anterior se cobra una sola vez.

## Hallazgos y límites independientes

- La UI conserva `PRODUCCION_META.prices` y los rangos coinciden con el motor y la validación SQL. Los recibos distinguen precio elegido y efectivo. Se notificó al coordinador que el motivo genérico «No produjo en este segmento» debía complementarse con el recurso faltante, y que `sale.demand` representa demanda ajustada frente a `assignedDemand` base.
- CONS-01 se prueba por la entrada de lotes del oráculo (`settleMarketCompanies`) con calidad 6, precio S/250: precio efectivo S/162,50 y reputación −2. **No puede dispararse a través del flujo físico actual de la UI:** el molde Premium aporta 4 puntos y los tres materiales más baratos aportan 1 cada uno, por lo que el mínimo es 7. Se mantuvo esa intención del catálogo y se notificó la limitación, sin inventar una prueba integrada que la dispare.
- El mismo oráculo independiente verifica reputación baja dos ciclos (demanda 3500 → 2800) y demanda no atendida perdida: una empresa con stock cero no redistribuye sus 1750 unidades a su competidora.
- La desconexión docente **no se presenta como éxito de cierre autónomo**: el ejecutor económico sigue en navegador. La persistencia SQL y recuperación son seguras, pero hacen falta despliegue de worker/Edge y programación para resolverlo completamente. Ver `docs/despliegue_cierre_v19.md`.
- No se acreditó el estado remoto de RLS, triggers o migraciones. El script diagnóstico es de solo lectura por defecto y la demo requiere `--demo-local SIDE-000`; nunca escribe en una partida real.

## Cierre final de la carrera de configuración docente

Se añadió `2026-10-23_configuracion_version_v19.sql` al final del paquete exacto: `config_revision`, incremento sólo para cambios de configuración editable (excluye reloj/runtime/eventos ya resueltos), RPC autenticada del propietario con bloqueo y revisión esperada. El formulario conserva su revisión separada de las nuevas respuestas del polling, por lo que una pestaña obsoleta recibe conflicto visible sin sobrescribir configuración. La ruta del servicio con dos argumentos conserva compatibilidad con fixtures anteriores; el cliente actualizado envía la revisión explícitamente.

`node tests/configuracion_version_v19_db.cjs`: PASS despliegue repetido, dos sesiones, rechazo de revisión vieja, permiso de propietario/anon y ausencia de revisiones falsas por runtime. `node --test tests/configuracion_version_v19.test.cjs`: 2/2 PASS formulario en conflicto y contrato servicio. El paquete completo actualizado pasó otra vez `node tests/cierre_v19_db.cjs`. No hubo escrituras en producción.

Revisión de concurrencia final: se probaron dos guardados propios encolados con la misma revisión de formulario. El segundo usa únicamente la revisión reconocida por el primer guardado propio, nunca una versión posterior del polling; 3/3 pruebas unitarias PASS. El diagnóstico SQL ahora exige la RPC de configuración CAS y la columna config_revision: sin ese último bloque no da todos los contratos válidos. La exclusión de eventSchedule es segura en el contrato actual: controlar_partida('guardar') acepta eventRules/enabledEvents/modo/cantidad aleatoria y programación financiera validada, pero no escribe eventSchedule recibido; éste se genera por side_sync_game.
