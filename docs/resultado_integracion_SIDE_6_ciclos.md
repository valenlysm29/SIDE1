# Resultado de integración SIDE 1–6 ciclos

**Estado: INCOMPLETO.** Revisión local basada en `d66669c8ed50dfd203cd8911b4186bdcd41a837e` y cambios de trabajo sin commit. Supabase remoto no se modificó ni desplegó.

| Requisito | Archivo y evidencia | Estado |
|---|---|---|
| Límite SQL partidas nuevas | `supabase/migrations/20261029221607_side_limite_seis_ciclos.sql`; `node --test tests/limite_ciclos_sql.test.cjs`: 1/1 | IMPLEMENTADO Y VERIFICADO EN PGLite. Una partida anterior con 7 ciclos admite cambios ajenos a la duración; cambiar la duración a un valor inválido se rechaza. Aplicar migración local/servidor queda fuera de esta ejecución. |
| Libro de eventos de pedidos | `js/material_orders.js`; `tests/material_orders.test.cjs`: recepción parcial, repetición, cancelación, exceso y empresa | IMPLEMENTADO COMO COMPONENTE AISLADO. No está conectado a persistencia, pagos, preview o cierre; no constituye la solución del juego. |
| Capacidad temporal | `js/temporal_production.js`; `tests/temporal_production.test.cjs`: recepción día 7 y fuera de ciclo, molde ausente | IMPLEMENTADO COMO COMPONENTE AISLADO. Recibe capacidad diaria y stock agregado; no gestiona SKU/valoración ni calcula etapas; no está integrado al motor. |
| Preview y cierre con recepción real | `js/production_model.js`, `js/engine/cierre.js`, `js/cycle_model.js`, `js/financial_model.js` | NO IMPLEMENTADO. Todavía suman compras como disponibles. No usar componentes aislados como evidencia de integración. |
| Cuentas por pagar, fechas, valor, persistencia e idempotencia transaccional | Código actual y componentes aislados | NO IMPLEMENTADO / NO VALIDADO. El libro aislado no procesa pagos ni exige fecha real del evento externa. |
| 1–6 cierres y continuidad financiera | `tests/cycle_snapshot_round.test.cjs` prueba 3 cierres locales | PARCIAL. No existe en esta ejecución la matriz pedida de 6 ciclos con dos empresas y órdenes. |
| Atomicidad, concurrencia, rollback y permisos | `docs/sql/20261023_despliegue_cierre_v19.sql` contiene bloqueos; pruebas locales anteriores | NO VALIDADO para peticiones simultáneas o rollback inducido. No implica certificación de SQL remoto. |
| Versión histórica | `js/cycle_model.js`, `tests/business_cycle.test.cjs` | PARCIAL: recibo previo se reutiliza; no se reproduce un motor histórico por versión. |
| Excel equivalente | `tests/equivalencia_fuente_side.cjs` | NO VERIFICADO. Excel literal emplea una mesa con dos operarios; SIDE limita a uno. No son contratos equivalentes. |
| Fallos iniciales | `docs/reporte_validacion_SIDE_6_ciclos.md` | 17 detallados; siguen sin resolución individual. |

## Pruebas

- Línea base `node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs`: 814 pruebas, 797 aprobadas y 17 fallidas; `tests/output/integracion_inicio_20261029.log`.
- `node --test tests/material_orders.test.cjs tests/limite_ciclos_sql.test.cjs`: 3 aprobadas, 0 fallidas.
- `node --test tests/temporal_production.test.cjs tests/material_orders.test.cjs`: 4 aprobadas, 0 fallidas.
- Los 17 fallos reproducidos y su diagnóstico provisional están en `docs/reporte_validacion_SIDE_6_ciclos.md`; no se han modificado expectativas para ocultarlos.

No se informa una matriz inventada de caja, deuda, inventario o conciliación de seis ciclos. Tampoco se afirma paridad con Excel ni validación de UI de recepción, Edge desplegada o infraestructura remota.

Suite final sobre el código actual: `node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs`: 819 pruebas, 802 aprobadas, 17 fallidas, 0 omitidas; `tests/output/integracion_final_20261029.log`. Las 17 fallas corresponden a las mismas pruebas de la línea base. No hay certificación integral mientras sigan fallando y la recepción no esté conectada.

## Continuación: cierre local y diagnóstico diferencial

- `services/partida_service.js`: rechaza un número de ciclo fuera del total configurado antes de calcular o persistir, aunque el RPC entregue contexto. Edge local regenerada con `node tools/build_business_edge.cjs`.
- `node --test tests/authoritative_worker.test.cjs tests/edge_lotes_equivalencia.test.cjs tests/cierre_rollback_local.test.cjs`: 13 aprobadas, 0 fallidas. `cierre_rollback_local.test.cjs` induce excepción en el guardado de reportes a través del RPC real y verifica que no persiste cierre, reporte, revisión, snapshot ni caja; reintento posterior exitoso. Esto demuestra rollback en PGlite, no peticiones simultáneas ni validación remota.
- Comparación controlada: `node --require ./.codex-work/audit-capacity/use_legacy.cjs --test tests/md_logic.test.cjs tests/legacy_production_targets.test.cjs tests/revenue_excel_current.test.cjs tests/sales_projection.test.cjs tests/production_dop.test.js`: 36 pruebas, 29 aprobadas, 7 fallidas. El preload sustituye exclusivamente el módulo de producción por `git show HEAD:js/production_model.js`, sin modificar el árbol. El ejemplo de capacidad y la prueba de reparto de ventas pasan con la regla anterior; siete fallos continúan incluso con ese módulo, por lo que no puede atribuirse su causa únicamente al cambio de capacidad. Registro: `tests/output/capacidad_legacy_comparacion.log`.
- **Recepción real: NO IMPLEMENTADA.** Las compras continúan utilizándose inmediatamente en previsualización y cierre. Los auxiliares de pedidos y producción temporal permanecen aislados. El worker elimina campos económicos suministrados por el estudiante; no se conectaron recepciones de cliente sin fuente verificable, y falta implementar la persistencia autoritativa y la contabilización.
- Siguen pendientes la prueba de concurrencia real, seis ciclos completos con pedidos y finanzas, las 17 regresiones y un oráculo Excel equivalente. Supabase remoto no fue modificado ni desplegado.
- Seguridad pendiente: en el SQL examinado `side_guardar_cierre_negocio` valida forma, pertenencia y token, pero recibe `p_cierre` calculado por el llamador; sus comprobaciones de forma no demuestran que importes y unidades fueran recalculados por servidor. Requiere una frontera de ejecución y autorización que impida registrar resultados financieros manipulados. No se ha modificado este contrato en esta continuación.
- Suite general final de esta continuación: `node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs`: 821 pruebas, 804 aprobadas, 17 fallidas, 0 omitidas; registro `tests/output/conexion_real_final_20261029.log`. Ejecutada después de los últimos cambios de código y pruebas; revisión Git base `d66669c8ed50dfd203cd8911b4186bdcd41a837e` con cambios locales sin commit.

## Verificación local adicional 2026-10-29

La conclusión anterior de que el RPC necesariamente queda expuesto a un profesor fue incompleta: `supabase/migrations/20261028_cierre_servidor.sql` revoca `EXECUTE` a `authenticated` y concede acceso a `service_role`. `node tests/business_worker_db.cjs` y `node tests/business_worker_db.cjs --edge` pasaron con las migraciones locales instaladas en PGlite: dos cierres, reinicio sin duplicación e intento de escritura por rol autenticado con ventas/caja/stock de 999999 rechazado por permisos; snapshot y número de reportes se conservaron. Esto valida la configuración local de prueba, no la instalación remota ni que el rol de servicio no pueda manipular resultados. El test esperaba S/22500, pero el escenario tiene 90 premium con calidad 7: CONS-02 aplica 250×1.4 = S/350 y total S/31500. Se corrigió esa expectativa y se comprobó explícitamente el precio.

| Caso | Estado |
|---|---|
| A–D: recepción pendiente, día 7, parciales y crédito en entrypoints reales | PENDIENTE: preview/cierre todavía suman compras; `production_model.js:165`, `engine/cierre.js:33`, `cycle_model.js:50`. Los auxiliares no están conectados. |
| E: rollback y concurrencia | Rollback en PGlite previamente comprobado; concurrencia representativa de PostgreSQL PENDIENTE. |
| F: seis ciclos y dos empresas | PENDIENTE; la prueba local anterior solo cubre dos cierres sin pedidos. |
| G: resultados manipulados | Rechazo por privilegios comprobado para `authenticated` en PGlite con migración de servidor; aislamiento por orden no implementado; ciclo fuera de rango validado en worker. |
| Excel y 17 fallos | PENDIENTE; no hay paridad de contratos equivalentes. |

No se modificó ni conectó Supabase remoto ni se desplegó Edge. El modelo físico y financiero de recepción sigue sin conexión; no considerar esta verificación como cumplimiento P0.

Suite final de esta continuación: `node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs`: 821 pruebas, 804 aprobadas, 17 fallidas y 0 omitidas; `tests/output/recepcion_final_20261029.log`. El script de integración SQL `tests/business_worker_db.cjs` no está incluido en ese glob y fue ejecutado por separado en sus modos Node y Edge, ambos aprobados.

## Continuación P0.1 — lectura autorizada local (30-10-2026)

**Estado general: PENDIENTE.** Esta actualización no demuestra el recorrido real alumno/docente y no habilita P0.2 ni declara P0 completo.

| Requisito | Estado | Evidencia o límite |
|---|---|---|
| Lectura del libro con propiedad de empresa | IMPLEMENTADO Y VALIDADO EN PGLITE | `side_material_preview_v1` comprueba `auth.uid()`, docente propietario o claim del alumno, empresa activa, versión, fase y ciclo actual. No otorga acceso al RPC de servicio. |
| Transporte de solo lectura | IMPLEMENTADO Y VALIDADO CON MOCK | `DecisionesService.obtenerContextoMaterial` usa el cliente alumno o docente y rechaza respuesta incompleta, empresa/ciclo ajenos y revisión inválida; devuelve error ante fallo de red. |
| UI de alumno y docente, refresco y errores visibles | PENDIENTE | Los entrypoints existentes no llaman el nuevo servicio; `js/app.js:872` calcula sin fuente asíncrona y `js/docente.js:1062` consume el reporte existente. No se ha demostrado A–E en la UI. |
| Crear órdenes desde una decisión confirmada y recibir en recorrido real | BLOQUEADO EN LA INTEGRACIÓN ACTUAL | `supabase/migrations/20261030162649_side_pedidos_autoritativos.sql` define RPC de creación/recepción exclusivas de servicio; no se encontró un ejecutor de aplicación que las invoque desde la confirmación. Las pruebas existentes las llaman directamente. Debe integrarse un ejecutor autorizado y probar su ciclo de vida. |
| Cierre CAS y crédito | VALIDADO EN PGLITE EN FASE ANTERIOR | No es prueba de concurrencia real ni de interfaz; ver `docs/resultado_p0_recepciones_SIDE.md`. |
| PostgreSQL concurrente | BLOQUEADO EN ENTORNO | No se encontró `psql` ni `postgres` en PATH; Docker está instalado pero el daemon no responde (`dockerDesktopLinuxEngine` no existe). No se usó un servidor remoto. |
| Pedidos mixtos, matriz activa 1–6, Excel y diagnóstico individual de 17 fallos | PENDIENTE | Se mantiene la puerta de salida P0.1 indicada por el usuario. La tabla de seis ciclos anterior no acredita actividad productiva tardía. |

La migración incremental local `supabase/migrations/20261030172347_material_preview_autorizado.sql` depende de `20261028151956_identidad_estudiante.sql` y `20261030162649_side_pedidos_autoritativos.sql`. La revisión y los eventos se calculan con el mismo criterio que `side_material_context_v1`; el corte corresponde al final del ciclo solicitado y solo incluye recepciones efectivamente registradas. El servicio de aplicación está en `services/decisiones_service.js`. No se escriben snapshots históricos ni se otorga acceso público a las tablas.

`node --test tests/material_preview_autorizado.test.cjs tests/material_preview_service.test.cjs tests/recepcion_preview_integracion.test.cjs tests/material_orders_db.test.cjs`: 10 aprobadas, 0 fallidas (`tests/output/material_preview_fase1_20261030.log`). La prueba SQL compara la revisión y eventos con el libro de servicio, verifica propietario/docente, denegación de acceso cruzado, identidad ausente, rol anónimo y ciclo incorrecto. La prueba del servicio usa mocks; no es prueba de navegador ni demuestra actualización o invalidación de interfaz. El fixture previo de 125 unidades sigue comprobado mediante invocación directa del libro SQL, no por los entrypoints reales.

Las conciliaciones anteriores por ciclo proceden de `tests/output/credito_dos_empresas_20261030.log`, no de esta nueva lectura. El resumen de cambios rastreados se obtiene con `git diff --stat`; ese comando no incluye los archivos todavía no rastreados. En esta continuación se modificó `services/decisiones_service.js` y se añadieron la migración y las pruebas `tests/material_preview_autorizado.test.cjs` y `tests/material_preview_service.test.cjs`. No se hizo commit, conexión a Supabase remoto ni despliegue.

Suite posterior a los cambios: `node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs`: 839 pruebas, 822 aprobadas, 17 fallidas y 0 omitidas (`tests/output/material_preview_suite_20261030.log`). Los nombres de las 17 fallas coinciden con el registro anterior; no se ha demostrado su causa ni corregido ninguna individualmente. El log contiene aserciones y trazas exactas; su clasificación y comparación por contrato con HEAD/Excel sigue pendiente.

## P0.1 — confirmación atómica y vistas locales (30-10-2026)

**P0.1 INCOMPLETO.** Se implementaron los eslabones de confirmación y de lectura en las vistas; falta probar el recorrido completo de confirmación → recepción legítima → ambas interfaces → cierre sobre un mismo backend de prueba. El proyecto no contiene un ejecutor o una regla aprobada que determine por sí mismo una recepción efectiva: `side_record_material_receipt_v1` sigue restringido al rol de servicio. No se convirtió la fecha prevista en recepción automática. El test día 7 existente invoca la operación de servicio desde el fixture, no desde un flujo operativo de proveedor.

Cambios de esta ejecución:
- `supabase/migrations/20261030173958_ordenes_confirmacion_atomica.sql`: extrae el cálculo existente de orden a una función privada, conserva el wrapper exclusivo de servicio y añade un trigger de snapshot confirmado para salas receipts-v1 en fase de decisiones. Crea en la misma transacción las órdenes derivadas del plan, catálogo y configuración; un conflicto revierte el guardado. La clave existente por partida/empresa/ciclo/SKU evita duplicados. Debe desplegarse solo tras validar su composición con las migraciones de identidad y de cierre; aquí se aplicó únicamente a PGlite. El bloqueo de snapshot precede al de partida dentro del trigger, por lo que la interacción concurrente con escritores que bloquean en orden inverso requiere validación PostgreSQL real; no se afirma ausencia de interbloqueos.
- `js/app.js`: consulta el libro del alumno mediante `DecisionesService`, lo mantiene fuera del estado persistido, rechaza respuestas obsoletas por secuencia/empresa/ciclo y bloquea la vista temporal si no hay datos verificados. La proyección financiera individual temporal se mantiene deshabilitada. El refresco se realiza durante la sincronización del estado y después de confirmar; se invalida al perder la red.
- `js/docente.js`: consulta el libro de la empresa y calcula producción con el motor compartido sobre su plan confirmado; comprueba sala y generación y descarta cambios de ciclo/fase durante la consulta. En fallo muestra el estado no verificado. No demuestra todavía el circuito real contra el backend integrado.
- `js/material_preview.js`, `index.html` y `docente.html`: presentación compartida de pedido, recibido, pendiente, fechas, pago, costo unitario, materiales, meta, capacidad y producción factible, con revisión y corte. `js/production_dop.js` diferencia la meta de la producción factible en modo temporal; los requisitos de meta se conservan.
- `tests/ordenes_confirmacion_atomica.test.cjs` y `tests/p01_preview_browser.test.cjs`: comprueban respectivamente el guardado de borrador/confirmación/reintento/conflicto en PGlite y las vistas DOM de alumno y docente con transporte simulado. La prueba del trigger usa el fixture local de identidad y no reemplaza una prueba con todas las migraciones de autenticación ni de permisos PostgreSQL reales.

`node --test tests/p01_preview_browser.test.cjs tests/ordenes_confirmacion_atomica.test.cjs tests/material_preview_autorizado.test.cjs tests/material_preview_service.test.cjs tests/recepcion_preview_integracion.test.cjs tests/material_orders_db.test.cjs tests/credito_proveedor_pglite.test.cjs tests/cierre_temporal_persistido_pglite.test.cjs tests/edge_lotes_equivalencia.test.cjs`: **20 aprobadas, 0 fallidas**, registro `tests/output/p01_final_focal_20261030.log`. Las vistas DOM usan un libro de prueba y respuestas simuladas; el fixture de 125 unidades, la comparación Node/Edge, el rollback y la contabilización se prueban por separado en PGlite. No se afirma la aceptación A–G integral. En particular, faltan la prueba de interfaz con recepción efectiva y cierre del mismo libro/revisión, la verificación de respuesta demorada entre empresas/ciclos en ambos entrypoints y un ejecutor legítimo de recepción.

El estado del árbol y el resumen de diferencias rastreadas están en `tests/output/p01_git_status_20261030.log` y `tests/output/p01_git_diff_stat_20261030.log`; el primero enumera también los archivos no rastreados, que `git diff --stat` no cuenta. No se hizo commit, despliegue, conexión ni cambio en Supabase remoto. El contenedor del proyecto solo contiene SIDE1.

Suite general final: `node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs` → **842 pruebas, 825 aprobadas, 17 fallidas, 0 omitidas**, registro `tests/output/p01_final_suite_20261030.log`. Antes eran 839/822/17; los nombres de las 17 fallas coinciden. No se atribuye causalidad ni se declaran corregidas.
