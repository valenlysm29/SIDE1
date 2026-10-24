# Revisión cruzada independiente de SQL/UI — 24/10/2026

Revisor B/E. Alcance independiente: cambios de SQL, outbox, presencia y UI escritos por root/C. No se presenta como revisión independiente del motor económico que este agente implementó.

| Prioridad | Hallazgo | Archivo/línea observados | Resolución |
|---|---|---|---|
| P1 | Confirmación central podía aceptar precio inválido aunque el formulario secundario lo validaba; quedaba sección bloqueada local y trigger rechazaba sincronización | `js/company_summary.js:55-74`, `js/app.js:1188-1194` | Root añadió validación de precios a reviewProblems; comprobado presente en revisión final |
| P2 | Cambios solo de precio no marcaban borrador y draft puro podía perder precios al leer confirmación | `js/company_summary.js:36-37`, `js/decision_review_model.js:18-21` | Root añadió precios a comparación y draft/revisión |
| P1 (detectado por A y revisado coordinadamente) | Servicio recalculaba finanzas de plan replicado usando secciones vacías originales y perdía clasificación de MP/compras | `services/partida_service.js:383-385` | E devuelve result.financialSections; C las usa y persiste en snapshot junto con ledger. Prueba independiente de recálculo sin snapshot congelado pasa |
| Observación descartada | Evento Realtime tardío al cambiar sala | `js/docente.js:218-222,227` | C confirmó guard row.partida_id===state.partidaId antes de observar presencia; no hay contaminación. Solo queda posible reconciliación redundante inocua |

No se encontró bloqueo adicional de autorización: contexto y persistencia requieren profesor propietario por auth.uid; roles anon/public no reciben funciones de cierre; diagnóstico requiere usuario autenticado. La persistencia mantiene CAS, bloqueo de partida, advisory transaccional y validación del conjunto completo de empresas. Esto no equivale a recalcular fórmulas financieras en servidor: el ejecutor autónomo sigue pendiente de despliegue/rediseño documentado.

La réplica cambia round de decisiones recurrentes y conserva historial purchases de activos; los activos físicos se obtienen desde ese historial y no se compran otra vez. La compra de moldes real también conserva purchases. Los planes heredados sin historial purchases necesitan especial cuidado: el adaptador puede reconocer opción antigua como molde disponible, pero no hay prueba documental del precio de adquisición histórico. No se alteraron esos datos remotos.

El outbox conserva escrituras, usa revisiones y confirma respuesta perdida mediante firma del snapshot; los nuevos fallos transitorios aplican backoff y evento online. Hay una sola instancia de cola en la aplicación. No se observó otra suscripción redundante introducida por los cambios.

## Verificación ejecutada tras las correcciones coordinadas

- `node --test tests/cierre_v19.test.cjs`:7/7. El test nuevo comprueba igualdad exacta de estados financieros al recalcular con secciones reconstruidas y sin snapshot congelado.
- `node tests/business_closure_independent_db.cjs`:PASS autorización, CAS, cierre idempotente, persistencia financiera y capital posterior. Se actualizó el contrato de CAP_ADJ: se conserva el importe50000 bajo clave idempotente; reabrir el snapshot mantiene la misma caja.
- La revisión no ejecutó SQL ni operaciones en Supabase real.

Adenda: se corrigió además el consumo de historial purchases para depreciar activos en formato real de UI, sin depender de quantities artificial. Regresión de producción real, depreciación positiva, método acelerado y caja invariable: tests/cierre_v19.test.cjs ahora8/8verdes.
