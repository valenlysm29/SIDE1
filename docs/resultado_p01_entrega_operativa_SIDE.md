# P0.1 — entrega operativa y validación local

**Estado: P0.1 INCOMPLETO.** El recorrido vertical se ejecutó en una base PGlite con entrega desde el formulario docente y lectura de libro real por ambas páginas mediante un puente de pruebas; sigue faltando demostrar la identidad y el transporte HTTP completos contra un backend local con todas las migraciones, los escenarios de error de red y respuesta tardía de extremo a extremo y la concurrencia PostgreSQL real.

| Condición | Estado | Evidencia o límite |
|---|---|---|
| Política explícita y fecha efectiva | IMPLEMENTADO Y PROBADO EN PGLITE | `deliveryPolicy=explicit_provider_event_v1` exige un evento del docente dueño; el día se deriva del reloj del servidor, no del cliente. Por convenio, el día 0 empieza al iniciar el ciclo y el día 7 después de 7/30 de su duración configurada. No hay recepción automática. La opción debe figurar expresamente en la configuración de la sala. |
| Registro autorizado y parcial | IMPLEMENTADO Y PROBADO EN PGLITE | `side_registrar_entrega_proveedor_v1` verifica propiedad de partida, política, participante, pedido, fase, elegibilidad, cantidad y cierre; el helper privado conserva el control de excedente y repetición. Estudiante sin propiedad, identidad ausente y acceso a la RPC interna fueron rechazados en el test. |
| Acción docente | IMPLEMENTADO Y PROBADO EN DOM | El formulario del detalle de resultados aparece para un libro verificado y política habilitada; conserva identificador de evento en sessionStorage para reintentos y solo confirma éxito después de la respuesta del servidor. |
| Libro y cálculo | PROBADO EN PGLITE Y DOM | Ambas páginas leen `side_material_preview_v1` a través del puente de test hacia la misma base; el listado de participantes y snapshot del docente se suministran como fixture, y el guardado del alumno se invoca mediante la RPC de snapshot, no mediante clic en el formulario de confirmación. |
| Cierre, CAS y Node/Edge | PROBADO EN PGLITE | La misma base y revisión alimentan el cierre Node en transacción revertida y Edge local en transacción persistida; la revisión vieja se rechaza y reintentar devuelve el mismo cierre. La recepción queda confirmada antes del cierre. |
| Rollback de cierre | PROBADO EN PRUEBA SEPARADA | `cierre_temporal_persistido_pglite.test.cjs` y `credito_proveedor_pglite.test.cjs`; no se indujo el fallo dentro de la prueba vertical nueva. |
| Orden de bloqueo | IMPLEMENTADO, VALIDACIÓN PARCIAL | El wrapper de guardado autenticado bloquea partida antes de escribir el snapshot y activar el trigger de órdenes. La operación docente y cierre bloquean partida antes de pedido/cierre. No se han auditado todas las rutas históricas ni probado contención con dos conexiones PostgreSQL reales. |
| PostgreSQL real | BLOQUEADO POR ENTORNO | `psql`, `postgres` y `pg_ctl` no estaban en PATH ni en las rutas estándar revisadas. Docker instalado sin daemon Linux disponible. PGlite no demuestra concurrencia PostgreSQL. |
| Red, respuestas tardías, recarga y permisos integrales | PENDIENTE | Hay pruebas aisladas DOM y de RPC; no cubren todos los escenarios E con transporte real y migración completa de identidad. |

## Archivos de esta iteración

- `supabase/migrations/20261030180225_entrega_operativa_autorizada.sql`: reloj de entrega, helper privado que reutiliza la validación de recepción existente, wrapper de servicio conservado, RPC de declaración docente y guardado de snapshot con bloqueo de partida previo. Depende de las migraciones de identidad, pedidos, lectura, confirmación y cierres previas. Aplicada solo a PGlite desechable.
- `services/decisiones_service.js`: llamada autenticada de docente que valida la confirmación del servidor.
- `js/docente.js`: formulario de entrega para órdenes pendientes bajo la política explícita; invalida formularios cuando el libro no está verificado.
- `tests/entrega_operativa_db.test.cjs`: prueba política, elegibilidad, recepción parcial, reintento, exceso, permisos y rechazo de nueva entrega tras cierre.
- `tests/p01_entrega_vertical.test.cjs`: borrador, confirmación, entregas, ambas vistas, revisión, CAS, cierre Node y Edge en una base; las consultas del libro y la acción de entrega llegan a PGlite por un puente Playwright, no por PostgREST.

## Conciliación del fixture vertical ejecutado

El fixture usa un molde premium, meta 200, una máquina y un operario por etapa, compra contado y plazo de entrega configurado en cero: cuero y accesorios se registran en el día 0 y el hilo se declara efectivamente en el día 7. No es el fixture histórico con tres moldes, por lo que no se comparan sus cajas como si fueran el mismo plan.

| Dato | Resultado observado |
|---|---:|
| Hilo pedido / recibido | 2.600 m / 2.600 m |
| Hilo consumido / final | 1.625 m / 975 m |
| Valor hilo recibido / consumido / final | S/ 4.784 / S/ 2.990 / S/ 1.794 |
| Producción / ventas | 125 / 125 unidades |
| Caja inicial / final | S/ 100.000 / S/ 95.953,86 |
| Ventas / costo de ventas / utilidad neta | S/ 43.750 / S/ 15.652,19 / S/ 21.963,07 |
| Anticipo final | S/ 0 |

La prueba compara la revisión de las dos lecturas y la revisión del cierre, y confirma igualdad del resultado de Node y Edge después de revertir la transacción Node. El registro reproducible es `tests/output/p01_entrega_vertical_20261030.log`; las cantidades y montos provienen del recibo persistido de prueba. Los casos de crédito y rollback permanecen en las pruebas focalizadas anteriores, no se atribuyen a este fixture contado.

No se han habilitado pedidos mixtos ni alterado el Excel o las 17 regresiones heredadas. El estado Git completo, incluidos no rastreados, está en `tests/output/p01_entrega_git_final.log`; el resumen de archivos rastreados en `tests/output/p01_entrega_diff_stat.log`. El directorio contenedor tenía únicamente SIDE1. Sin commits, despliegues ni conexiones o modificaciones de Supabase remoto.

Prueba focalizada final: `node --test tests/p01_entrega_vertical.test.cjs tests/entrega_operativa_db.test.cjs tests/ordenes_confirmacion_atomica.test.cjs tests/material_preview_autorizado.test.cjs tests/material_preview_service.test.cjs tests/p01_preview_browser.test.cjs tests/material_orders_db.test.cjs tests/cierre_temporal_persistido_pglite.test.cjs tests/credito_proveedor_pglite.test.cjs tests/edge_lotes_equivalencia.test.cjs`: **16 aprobadas, 0 fallidas**, `tests/output/p01_entrega_focal_final.log`.

Tras corregir una regresión detectada en una prueba de DOM mínimo y rechazar cantidades numéricas no finitas, `node --test tests/financial_presentation.test.cjs tests/entrega_operativa_db.test.cjs tests/p01_entrega_vertical.test.cjs` produjo 7 aprobadas y 0 fallidas (`tests/output/p01_entrega_ajuste_final.log`). La suite completa final `node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs` produjo **844 pruebas, 827 aprobadas, 17 fallidas y 0 omitidas** (`tests/output/p01_entrega_suite_final_v3.log`); antes fueron 842/825/17 y los nombres de las 17 fallas coinciden. No se ha diagnosticado ni resuelto su causa en esta iteración.
