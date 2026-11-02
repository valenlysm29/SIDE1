# Inventario general de tareas completadas y pendientes de SIDE

Corte inicial: **1 de noviembre de 2026, Lima**. **Actualización de ejecución: 2 de noviembre de 2026, Lima**. Esta revisión incorpora la finalización operativa de Fase 1 y el despliegue SQL/Edge verificado. No modifica decisiones ni reconstruye cierres de partidas reales. Las secciones de antecedentes conservan el corte original y se subordinan a la actualización siguiente.

## Resumen del estado real

**SIDE todavía no reúne evidencia suficiente para entrega final.** Hay motor económico, cierres persistentes, interfaces, Laboratorio, modos experimentales, oráculos y pruebas relevantes. La brecha principal está en la compatibilidad y aceptación conjunta de frontend, SQL y Edge, la recuperación histórica y las funciones económicas incompletas.

Inventario actualizado: **90 tareas: 29 ✅, 45 🟡, 13 🔴 y 3 ⚪**. De las 61 tareas abiertas, **12 son P0, 40 P1, 6 P2 y 3 P3**. Estos números cuentan tareas de esta matriz, no porcentajes de avance ni número de defectos independientes. Varias se resuelven en un mismo ensayo o paquete coordinado.

Los estados ✅ certifican exclusivamente el alcance descrito: una prueba de modelo, un escenario histórico o una comprobación administrativa no certifican toda un área ni toda producción. Las tareas 🟡 tienen implementación y evidencia parcial; las 🔴 tienen falta o fallo documentado; las ⚪ carecen de evidencia suficiente para afirmar implementación/operación completas.

## F02 — Finalización operativa de Fase 1 y despliegue real

**Resultado: infraestructura de Fase 1 desplegada y verificada. La recuperación histórica queda separada y pendiente; no constituye un bloqueo de las partidas nuevas.** No se declara completada la economía ni la aceptación global de SIDE. El estado de cada una de las 90 tareas continúa reflejando sus límites: SIDE-013/059/064/067/068 y el pipeline general conservan deuda explícita.

### Separación implementada

Los commits **3c0455d**, **fe9b4e6** y **de49d92** priorizan partidas nuevas, aíslan errores de versión/red/procesamiento por partida y preservan el motor legado. Un fallo histórico no impide atender las demás; sí devuelve error/pending explícito. Se mantiene el cierre ordenado por ciclo dentro de cada partida. Una versión desconocida nunca se ejecuta con otro motor. No se cambiaron fórmulas, decisiones, versiones de partidas existentes ni cierres sellados.

Durante la implementación apareció Edge v10 y la migración de seguimiento **20261102174348**, desplegados externamente. Se conservaron el registro de ejecución, la propiedad de intentos y las RPC con fencing. Su SQL ya instalado se incorporó al repositorio con la versión exacta, sin reaplicarlo en producción. El aislamiento se adaptó a runTracked y se probó con ese contrato vigente. El legacy-runtime permanece idéntico.

### Clasificación final de los 26 huecos (sin recuperar datos)

- **2 candidatos técnicos con evidencia suficiente para propuesta de recuperación:** SIDE-019 ciclo 1 y SIDE-AYRH ciclo 1. El primero dispone de confirmación original y decisiones del ciclo recuperables por la RPC; el segundo conserva plan original. Ambos alcanzan persistencia bajo su motor original, con guardado interceptado y sin snapshots de eventos que requieran fuente adicional. No se guardaron resultados; una recuperación posterior requiere revisión académica y autorización concreta.
- **11 con evidencia incompleta**, **3 que requieren conciliación** y **10 dependientes de cierres anteriores**. Los eventos del snapshot del cliente no se consideran hechos verificados. SIDE-JRHM no se da por recuperable aunque el motor llegue a guardar: sus eventos carecen de fuente independiente demostrada.
- Diagnóstico sobre copia restaurada sin API, RPC dentro de BEGIN/ROLLBACK y persistencia interceptada; hashes de partidas, estados y cierres iguales antes/después. No se inventaron planes cero para acreditar recuperación: los planes generados por política no-plan se excluyeron expresamente del criterio de evidencia.

| Partida | Ciclo | Clasificación | Resultado de validación |
| --- | --- | --- | --- |
| SIDE-002 | 1 | EVIDENCIA_INCOMPLETA | DIAGNOSTICO_SIN_ESCRITURA |
| SIDE-019 | 1 | CANDIDATO_VERIFICABLE_SIN_ESCRITURA | DIAGNOSTICO_SIN_ESCRITURA |
| SIDE-225M | 1 | EVIDENCIA_INCOMPLETA | DIAGNOSTICO_SIN_ESCRITURA |
| SIDE-63AA | 2 | CONCILIACION_REQUERIDA | DECISION_INVALIDA |
| SIDE-63AA | 3 | DEPENDENCIA_HISTORICA | CIERRE_ANTERIOR_REQUERIDO |
| SIDE-8KP4 | 2 | EVIDENCIA_INCOMPLETA | DECISION_INVALIDA |
| SIDE-8KP4 | 3 | DEPENDENCIA_HISTORICA | CIERRE_ANTERIOR_REQUERIDO |
| SIDE-AYRH | 1 | CANDIDATO_VERIFICABLE_SIN_ESCRITURA | DIAGNOSTICO_SIN_ESCRITURA |
| SIDE-DDBN | 1 | EVIDENCIA_INCOMPLETA | DECISION_INVALIDA |
| SIDE-DT42 | 2 | CONCILIACION_REQUERIDA | DATOS_ECONOMICOS_NO_VERIFICADOS |
| SIDE-DT42 | 3 | DEPENDENCIA_HISTORICA | CIERRE_ANTERIOR_REQUERIDO |
| SIDE-FWPZ | 2 | EVIDENCIA_INCOMPLETA | DATOS_ECONOMICOS_NO_VERIFICADOS |
| SIDE-FWPZ | 3 | DEPENDENCIA_HISTORICA | CIERRE_ANTERIOR_REQUERIDO |
| SIDE-JDGT | 1 | EVIDENCIA_INCOMPLETA | DATOS_ECONOMICOS_NO_VERIFICADOS |
| SIDE-JDGT | 2 | DEPENDENCIA_HISTORICA | CIERRE_ANTERIOR_REQUERIDO |
| SIDE-JRHM | 1 | CONCILIACION_REQUERIDA | DIAGNOSTICO_SIN_ESCRITURA |
| SIDE-JRHM | 2 | DEPENDENCIA_HISTORICA | CIERRE_ANTERIOR_REQUERIDO |
| SIDE-JRHM | 3 | DEPENDENCIA_HISTORICA | CIERRE_ANTERIOR_REQUERIDO |
| SIDE-N3S3 | 1 | EVIDENCIA_INCOMPLETA | DECISION_INVALIDA |
| SIDE-U8NA | 1 | EVIDENCIA_INCOMPLETA | DIAGNOSTICO_SIN_ESCRITURA |
| SIDE-U8NA | 2 | DEPENDENCIA_HISTORICA | CIERRE_ANTERIOR_REQUERIDO |
| SIDE-X6VC | 1 | EVIDENCIA_INCOMPLETA | DECISION_INVALIDA |
| SIDE-YHM8 | 1 | EVIDENCIA_INCOMPLETA | DECISION_INVALIDA |
| SIDE-YHM8 | 2 | DEPENDENCIA_HISTORICA | CIERRE_ANTERIOR_REQUERIDO |
| SIDE-ZJ3K | 1 | EVIDENCIA_INCOMPLETA | DIAGNOSTICO_SIN_ESCRITURA |
| SIDE-ZJ3K | 2 | DEPENDENCIA_HISTORICA | CIERRE_ANTERIOR_REQUERIDO |

Evidencia: tests/output/fase01/finalizacion/historical-classification.json y classify_historical_gaps.cjs. Los códigos indican el primer rechazo observado; la clasificación no garantiza que no existan otros tras resolverlo.

### Pruebas focales y rollback

- **13 pruebas Node aprobadas, 0 fallidas finales:** aislamiento, versión, seguimiento/fencing, autorización HTTP y respuesta RPC. Archivo tracked.log. Se añaden **4** pruebas de guardia manual/automática/costos aprobadas (guards.log), sin sumar repeticiones previas.
- **54 comprobaciones negativas Auth/Data API/Edge aprobadas**, incluyendo nuevos endpoints de seguimiento y acceso directo a escritores financieros (tracked-security.log).
- Escenarios conectados **3×3 y 3×6: 27 resultados** con dos solicitudes Edge concurrentes por ciclo mientras una partida antigua conserva un préstamo inválido. Se verificaron historia sellada, transiciones, Estudiante/Docente/Laboratorio y ausencia de errores de página/recursos locales en el recorrido (connected-isolation/integration.json). El conjunto completo de interfaces sigue siendo objeto de fase 3.
- Tras preservar la incorporación externa de seguimiento: **6 resultados oficiales adicionales** —3 empresas manual y 3 automático— con propiedad de intento, guardado protegido, reintento inmutable y fase final. La partida inválida conserva cero cierres (tracked-smoke.json).
- Respaldo actualizado public/side_private/Auth/Vault restaurado en **fase01_restore3**. La primera descarga se truncó por conexión; se repitió y solo se usó la copia completa. Token de Vault recuperado por copia DPAPI ya verificada. Dumps y token permanecen ignorados por Git.
- **SQL: forward → rollback exacto de metadatos → reaplicación**, con datos de negocio iguales, conservando el seguimiento ya existente (metadata-rollback.json y rollback-tracked.log). No se revocó seguridad para hacer pasar pruebas.
- **Edge: reversión real a v10 → candidato**, autenticación y rechazo económico explícito conservados, hashes económicos sin cambios (edge-rollback-tracked.log/edge-rollback.json). Los HTTP 502 breves del recargador local se trataron como disponibilidad transitoria en el guion; ninguna prueba financiera se omitió.

### Estado real de publicación

- **Main de aplicación: de49d92c0df3f82a0b0260027bdb54802d76ba41**, publicado por fast-forward, sin fuerza. Pages aprobado: [ejecución 41497403197](https://github.com/valenlysm29/SIDE1/actions/runs/41497403197). El commit posterior de este informe solo cambia documentación.
- **Edge side-business-close v11 ACTIVE**. Los cuatro archivos descargados tras desplegar coinciden con main normalizando saltos de línea. Se conserva verify_jwt=false del mecanismo previo con token dedicado validado por RPC; pruebas remotas sin token: POST 401, GET 405.
- **SQL instalado:** `fase01_security_paths` versión remota **20261102181532**, y `bloquear_eventos_costos_no_verificados` versión **20261102181550**. Se corresponden con fuentes locales 20261102054323 y 20261102025853. Trigger presente, search_path=pg_catalog y escritores/intent RPC solo servidor verificados.
- La aplicación anterior que agotó tiempo no se había instalado. Una sesión propia del pg_dump fallido quedó idle in transaction; se identificó por usuario, PID y COPY y se cerró para liberar el bloqueo. No se cancelaron transacciones de partidas ni se alteraron sus filas.
- **158 cierres actuales al verificar; los 155 originales del respaldo conservan exactamente el hash e9444aa8211fe7a585b7c13076a8e9f8**. Los tres adicionales aparecieron fuera de los ensayos de esta tarea. No se ejecutó recuperación histórica ni se invocó manualmente el worker de producción.
- **Cron activo cada minuto**. Sus respuestas observadas siguen HTTP 503 cuando hay rechazos históricos DECISION_INVALIDA/DATOS_ECONOMICOS_NO_VERIFICADOS; es una señal verdadera, no un falso éxito. Los intentos se finalizan con outcome=error. Las partidas nuevas se procesan primero y se aíslan de dichos errores, probado en local real. No se creó una partida remota para probarlo.

### Tareas cerradas y pendientes

| ID | Estado anterior | Estado actual | Evidencia / corrección |
| --- | --- | --- | --- |
| SIDE-012 | 🟡 Implementada, pendiente de validación | ✅ Completada y verificada | F02: HTTP 204, errores por partida y seguimiento/fencing probados y desplegados en Edge v11; commits d56806d,3c0455d,fe9b4e6,de49d92 |
| SIDE-013 | 🔴 Pendiente | 🔴 Pendiente | F02: 26 huecos clasificados sin escritura; 2 candidatos, 11 sin evidencia, 3 para conciliar, 10 dependientes |
| SIDE-059 | 🔴 Pendiente | 🔴 Pendiente | F02: efectos de costos no conciliados bloqueados en selección nueva y cierre; no se modificó semántica |
| SIDE-061 | 🟡 Implementada, pendiente de validación | ✅ Completada y verificada | F02: trigger instalado y verificado; migración remota 20261102181550, fuente 20261102025853 |
| SIDE-064 | 🟡 Implementada, pendiente de validación | 🟡 Implementada, pendiente de validación | F02: clasificación con motor original en transacciones revertidas; hashes de copia sin cambios |
| SIDE-067 | 🟡 Implementada, pendiente de validación | 🟡 Implementada, pendiente de validación | F02: 54 pruebas negativas reales; search_path fijo y escritores financieros server-only verificados en producción; migración 20261102181532 |
| SIDE-069 | 🟡 Implementada, pendiente de validación | ✅ Completada y verificada | F02: SQL instalado y Edge v11 idéntica a los cuatro archivos de main de49d92; Pages success |

**Pendientes independientes:** recuperación/conciliación histórica, efectos de costos de fase 2, revisión completa de RPC y Auth, normalización total de migraciones antiguas, regresión general y pipeline de calidad, aceptación económica y de interfaz de fase 3. Ninguno se oculta como completado. La publicación focal no es certificación integral de SIDE.

## Antecedente de ejecución anterior a la finalización — 2/11/2026

**Fase 0: completada en la base de trabajo nueva. Fase 1: pendiente por bloqueo histórico/económico real; no se publica el candidato en main ni se despliega.** No se pide autorización adicional: faltan planes originales/fuentes de eventos y conciliación de un crédito inválido; autorizar una operación no reemplaza esa evidencia.

### Cambios implementados y preservación

- Base íntegra: `.codex-work/fase01-integracion`, clon completo del main remoto **4b6b57a09043d3dc604e45a88468721bdb724399**. 3.143 archivos rastreados, cero ausentes, árbol limpio inicial, verificación de conectividad y LFS aprobadas. El main del repositorio original se alineó a esa referencia conservando el anterior en `codex/preservado-main-fase0`.
- Original intacto: copias de los 17 archivos existentes modificados/no rastreados, inventario de 955 entradas y referencias/worktrees en `.codex-work/fase01-preservado`. Las ramas/objetos/archivos originales permanecen en su ubicación. La importación adicional de objetos antiguos notificó `mmap failed`; no se reparó ni descartó ese Git. La copia remota íntegra evita depender de él para ejecutar/pruebas.
- Exclusividad: el runtime legado normalizado ya coincide con main. No se reintegró código de la rama antigua. Aplicación, docente, estilos, planificación y producción no tienen cambios respecto al main base.
- Corrección real: `remoteRpc` reconoce HTTP 204 de RPC que retornan void, evitando falsos NETWORK_ERROR del registro de cierres. Los cuerpos no vacíos inválidos y errores HTTP siguen fallando. Runtime Edge regenerado desde fuente; motor legado sin cambios.
- Migración nueva `20261102054323_fase01_security_paths.sql`: fija search_path de dos sondas puras y restringe ambos escritores financieros a servicio. Una prueba Auth real detectó que el bootstrap antiguo podía reabrir `side_guardar_cierre_excel`; quedó corregido y volvió a probarse.
- Guiones reproducibles de bootstrap, restauración, respaldo DPAPI de Vault, recuperación/cron y seguridad. No se generaron informes intermedios.
- **Commit de implementación: d56806d73860cca5557b9f3c7277ac2478088c49**, rama `codex/fase01-integracion`. El commit documental de esta matriz se identifica en el historial posterior, sin autorreferencia circular.

### Evidencia F01 — pruebas ejecutadas, sin sumar repeticiones

| Comprobación | Resultado final | Evidencia dentro del clon |
| --- | --- | --- |
| Node/PostgreSQL/entrega/HTTP/Node-Edge | **30 pruebas únicas aprobadas, 0 fallidas finales** | tests/output/fase01/focal.log (14), postgres-delivery.log (11), rpc-fixed.log (8, de las cuales 7 repiten cobertura tras corrección), edge-parity.log (4) |
| Auth/Data API/Edge negativas | **34 aprobadas**; dos docentes, dos estudiantes, expulsión, guardados directos y token inválido | tests/output/fase01/security.json y security.log |
| Escenario A, motor versión 1 | **3 empresas × 3 ciclos = 9 resultados**, 3 registros de cierre; modo manual | tests/output/fase01/connected/integration.json, connected.log y capturas |
| Escenario B, motor versión 1 | **3 empresas × 6 ciclos = 18 resultados**, 6 registros; modo automático | misma evidencia; transiciones RPC reales |
| Compatibilidad motor legado versión 0 | **3 empresas × 3 ciclos = 9 resultados**, 3 registros; manual | tests/output/fase01/connected-legacy/integration.json y legacy.log |
| Concurrencia/reintento | Dos peticiones simultáneas de Edge por ciclo; resultados inmutables, sin doble cargo; PostgreSQL real y rollback focal | escenarios conectados y postgres-delivery/focal |
| Interfaz conectada | Estudiante, Docente y Laboratorio sobre Auth/HTTP/Edge reales; recarga, caída de red y lectura de historia sellada | 12 capturas de A/B más recorrido legado; sin errores de página. Legado también registra cero recursos locales fallidos |
| Respaldo y restauración real | **155 cierres**, mismo hash antes/después: `e9444aa8211fe7a585b7c13076a8e9f8` | tests/output/fase01/restore.json y recovery.json |
| Dependencias recuperadas | public, side_private, Auth y FK; Vault recuperado; programación restaurada inactiva | recovery.json; datos sensibles ignorados en SIDE1/tests/output/fase01 |
| Programación operativa | cron real -> pg_net -> Edge real: **HTTP 200 y success=true**, solo en local | recovery.log/recovery.json |
| Sintaxis/diff | Python compilado y git diff --check aprobados | fuentes del commit; sin cambio económico de fórmulas |

Los ciclos de ensayo aceleran exclusivamente el reloj de las nuevas partidas QA; no escriben el número de ciclo ni fabrican cierres. Las decisiones se envían mediante el servicio/Data API autenticado desde navegador; las recepciones se siembran por RPC de servicio en la base QA. No es aceptación completa de todos los formularios de fase 3. Edge ejecuta **el index.ts real**, no el harness history-qa.

Incidencias detectadas y corregidas: adaptador HTTP 204; permiso legacy en bootstrap; lectura Python utf-8-sig; video opcional sin ffmpeg; conflicto CAS del guion resuelto releyendo revisión y reintentando, sin desactivar CAS; salida de consola Windows corregida. No se modificaron fórmulas para aprobar pruebas. Las primeras ejecuciones fallidas se conservan como incidencias; los resultados finales anteriores corresponden a los pases corregidos.

### Respaldo, límites y recuperación

Respaldo actual descargado por CLI: `SIDE1/tests/output/fase01/production-schema.sql` y `production-data.sql`, más cron-jobs.json y copia protegida `vault-token.dpapi`. Contiene datos reales sensibles y **no se incorpora a Git**. Restaurado en `fase01_restore2`, base sin API publicada dentro del PostgreSQL aislado; ninguna Edge se ejecutó contra esos datos restaurados. Auth: 25 usuarios; side_private.student_claims: 60; partidas: 184; participantes: 186; cierres: 155. Se conservaron permisos, datos y claves foráneas.

El dump cifrado de Vault por sí solo falló con `invalid ciphertext`, demostrando la dependencia de su clave. Se añadió exportación protegida por Windows DPAPI y se probó la recuperación del token exacto por huella, sin imprimirlo. Requiere esta cuenta/equipo; en otro host puede rotarse únicamente el token dedicado después de restaurar, porque cron lo consulta por nombre en Vault. **No activar cron hasta validar token/URL/Edge.** Las órdenes cron originales se restauraron inactivas y se retiró el job QA al acabar. La prueba operativa usó exclusivamente URL local.

Reproducción de la base QA: establecer `SIDE_FASE01_WORK` a `SIDE1/.codex-work/fase01-local`; ejecutar `python tools/fase01_local_setup.py --prepare`; iniciar Supabase CLI en esa carpeta (puertos 33421/33422, excluir servicios no usados); ejecutar el mismo guion sin flags; servir `side-business-close` desde esa carpeta. Después ejecutar `tests/history_connected.py`, `tests/fase01_security.py` y los tests focales. No usar `--scheduler-only` como prueba de migraciones: únicamente recupera la etapa de programación de una instalación que ya tiene las fuentes aplicadas.

Para restauración de producción: exportar esquema/datos con public,side_private,auth,vault,cron,extensions, capturar jobs mediante SELECT (el dump de extensión cron no contiene sus jobs), `tools/fase01_vault.py backup`, `tests/fase01_restore.py <carpeta> <base-local>`, `tools/fase01_vault.py restore` y `tests/fase01_recovery_check.py`. Reaplicar cambios candidatos en la copia y comprobar invariantes antes de planear una actualización real. La instalación histórica completa mediante todos los nombres antiguos de CLI sigue pendiente en SIDE-068.

### Producción y puerta de publicación

- Main remoto y main local: **4b6b57a**; no se publicó ningún commit nuevo en main en esta ejecución.
- Edge activa **v8**, compatible byte a byte (normalizando finales de línea) con los cuatro archivos de ese main base. Tiene router y motor legado. El ajuste HTTP 204 de d56806d aún no está desplegado.
- Migraciones de guardia/secuencia/versionado/gracia, historial y estado de procesamiento están instaladas. Falta la restricción `20261102025853`; la nueva migración de seguridad `20261102054323` también queda preparada localmente.
- Corte remoto observado: **4 activas y 4 en espera**, no cinco activas. Ninguna se modificó por estas pruebas. No se impuso una versión nueva a ninguna partida existente.
- Cron remoto activo cada minuto y un secreto presente. Los rechazos económicos heredados continúan bloqueados; no se invocó manualmente Edge de producción.
- No se hace merge, push a main, aplicación SQL ni despliegue porque SIDE-013/059/064 y la puerta crítica siguen abiertos. La autorización general de publicación existe; el bloqueo es técnico y de evidencia, no de permisos de acceso.

### Cambios de estado de cada tarea trabajada

| ID | Estado anterior | Estado nuevo | Corrección / evidencia / commit | Pendiente restante |
| --- | --- | --- | --- | --- |
| SIDE-002 | 🔴 Pendiente | ✅ Completada y verificada | Clon remoto completo en .codex-work/fase01-integracion; 3143 rastreados, 0 ausentes; fsck conectividad y LFS OK; commit d56806d. | Base original preservada; usar el clon íntegro para trabajar. |
| SIDE-003 | 🟡 Implementada, pendiente de validación | ✅ Completada y verificada | Comparación exclusiva: main 4b6b57a ya contiene cierres, UI y parpadeos; sin diferencias de UI/producción en d56806d; commit d56806d. | No reintegrar la rama antigua ni copiar su frontend. |
| SIDE-004 | 🔴 Pendiente | ✅ Completada y verificada | main local original y origin/main sincronizados a 4b6b57a; referencia anterior guardada en codex/preservado-main-fase0; commit d56806d. | La rama de trabajo original y sus modificaciones permanecen intactas. |
| SIDE-005 | 🟡 Implementada, pendiente de validación | ✅ Completada y verificada | 0fb55cb revisado: legacy-runtime no difiere de main; normalización ya contenida; commit d56806d. | Sin integración adicional necesaria. |
| SIDE-007 | 🟡 Implementada, pendiente de validación | ✅ Completada y verificada | F01: Edge real + Auth/Data API: 9 y 18 resultados; concurrencia y hashes de cierres inmutables; commit d56806d. | Verificación acotada a escenarios de fase 1; no certifica economía completa ni todas las partidas reales. |
| SIDE-008 | 🟡 Implementada, pendiente de validación | ✅ Completada y verificada | F01: guardia manual probada; recorrido conectado 3 ciclos; SQL vigente en producción leído; commit d56806d. | Preservar la excepción versionada de partidas heredadas; no cambiar su historia. |
| SIDE-009 | 🟡 Implementada, pendiente de validación | ✅ Completada y verificada | F01: 6 ciclos automáticos consecutivos, 3 empresas, Edge real y RPC reales; commit d56806d. | Aceptación económica/UI completa sigue en fase 3. |
| SIDE-010 | 🟡 Implementada, pendiente de validación | ✅ Completada y verificada | F01: tests PostgreSQL de reloj/gracia/6 ciclos aprobados; escenario automático conectado aprobado; commit d56806d. | Mantener pruebas al cambiar transiciones; no adelantar relojes de partidas reales. |
| SIDE-011 | 🟡 Implementada, pendiente de validación | ✅ Completada y verificada | F01: Edge v8 coincide con cuatro archivos del main base; motores 1 y 0 probados mediante Edge real; commit d56806d. | No se cambió el motor legado. El ajuste HTTP candidato no se desplegó. |
| SIDE-012 | 🟡 Implementada, pendiente de validación | 🟡 Implementada, pendiente de validación | F01: corregido HTTP 204 en remoteRpc y Edge generada; 8 pruebas focales + motor legado real sin falso NETWORK_ERROR; commit d56806d. | Publicar corrección tras resolver bloqueo crítico de publicación; producción conserva v8. |
| SIDE-013 | 🔴 Pendiente | 🔴 Pendiente | F01: diagnóstico individual en copia restaurada: 26 huecos estructurales; tabla de evidencia abajo; commit d56806d. | Faltan planes/fuentes verificables en varios casos; no reconstruir ni sobrescribir cierres. |
| SIDE-057 | 🟡 Implementada, pendiente de validación | ✅ Completada y verificada | F01: lectura de contexto/sorteos solo servicio; PostgreSQL real y rechazo de hechos no verificables probados; commit d56806d. | Alcance: fuente/guardias; semántica completa de 92 eventos sigue en SIDE-060. |
| SIDE-059 | 🔴 Pendiente | 🔴 Pendiente | F01: costos sin base verificable siguen rechazados; no se inventó regla ni se retiró validación; commit d56806d. | Conciliar base económica de costos; el bloqueo seguro no equivale a implementar esos efectos. |
| SIDE-061 | 🟡 Implementada, pendiente de validación | 🟡 Implementada, pendiente de validación | F01: trigger de restricción probado localmente; 20261102025853 no figura instalado en producción; commit d56806d. | Instalar trigger compatible solo al superar la puerta crítica; conserva eventos existentes. |
| SIDE-064 | 🟡 Implementada, pendiente de validación | 🟡 Implementada, pendiente de validación | F01: 26 huecos inspeccionados sin resorteo; cuatro rechazos registrados por datos/crédito; commit d56806d. | Obtener decisiones/fuentes históricas y resolver cada caso antes de recuperarlo. |
| SIDE-067 | 🟡 Implementada, pendiente de validación | 🟡 Implementada, pendiente de validación | F01: 34 negativos Auth/HTTP/Edge; migración final cierra escritor legacy reabierto por bootstrap y fija dos search_path; commit d56806d. | Migración candidata no desplegada; revisión contextual restante de RPC públicas y política Auth. |
| SIDE-068 | 🔴 Pendiente | 🟡 Implementada, pendiente de validación | F01: bootstrap reproducible de manifiestos y restauración real desde vacío con Auth, side_private y FK; commit d56806d. | Cadena histórica CLI completa todavía no normalizada; no confundir manifiesto de instalación probado con todas las migraciones antiguas. |
| SIDE-069 | 🔴 Pendiente | 🟡 Implementada, pendiente de validación | F01: SQL/Edge v8/main base alineados salvo trigger de costos; endurecimiento y HTTP 204 preparados y probados; commit d56806d. | Aplicar 20261102025853 y 20261102054323 y desplegar candidato cuando se libere la puerta crítica. |
| SIDE-070 | ✅ Completada y verificada | ✅ Completada y verificada | F01: un job activo por minuto y Vault presente en producción; lectura sin invocación de partidas reales; commit d56806d. | Presencia comprobada; recuperación y operación aisladas en SIDE-071/072. |
| SIDE-071 | 🟡 Implementada, pendiente de validación | ✅ Completada y verificada | F01: cron real local -> pg_net -> Edge real HTTP 200/success; token inválido 401; programación restaurada inactiva; commit d56806d. | La operación remota conserva errores históricos económicos explícitos; no se confunden con éxito de cron. |
| SIDE-072 | ⚪ No verificable | ✅ Completada y verificada | F01: respaldo real de public/side_private/Auth/Vault; recuperación DPAPI, 155 cierres con hash idéntico y cron inactivo; commit d56806d. | DPAPI requiere esta cuenta/equipo; en otro host rotar token dedicado y probarlo antes de activar cron. Copias sensibles locales, no en Git. |
| SIDE-086 | 🟡 Implementada, pendiente de validación | ✅ Completada y verificada | F01: dos llamadas Edge concurrentes por ciclo; PostgreSQL real Node/Edge, rollback, reintentos y 36 resultados incluidos legado; commit d56806d. | Mantener hashes y pruebas; concurrencia masiva y aceptación general quedan fuera del alcance probado. |

### Diagnóstico individual de huecos históricos (solo lectura de copia restaurada)

Se enumeran **26 huecos estructurales de 16 partidas**. No todos son cierres recuperables ni un nuevo defecto: algunos corresponden a salas abandonadas o sin decisiones. Criterio: ciclos vencidos según configuración guardada de lifecycleVersion=2 y ausencia de fila sellada. Conteos de planes no prueban que sean válidos, completos o que todos fueran elegibles. La expulsión/fecha de incorporación y fuentes originales deben comprobarse antes de cualquier recuperación. «Eventos» cuenta snapshots con eventos, **no eventos verificados**. El error de un ciclo anterior bloquea continuidad de los siguientes; no se registra un éxito ficticio.

| Partida | Ciclo ausente | Planes / participantes | Snapshots con eventos | Diagnóstico / bloqueo |
| --- | --- | --- | --- | --- |
| SIDE-002 | 1 | 0/1 | 0 | Sin plan completo |
| SIDE-019 | 1 | 0/1 | 0 | Sin plan completo |
| SIDE-225M | 1 | 1/2 | 0 | Sin plan completo |
| SIDE-63AA | 2 | 1/3 | 0 | Sin plan completo |
| SIDE-63AA | 3 | 0/3 | 0 | Sin plan completo |
| SIDE-8KP4 | 2 | 1/1 | 0 | DECISION_INVALIDA |
| SIDE-8KP4 | 3 | 0/1 | 0 | Sin plan completo |
| SIDE-AYRH | 1 | 1/1 | 0 | Causa no establecida; verificar contexto original |
| SIDE-DDBN | 1 | 0/3 | 0 | Sin plan completo |
| SIDE-DT42 | 2 | 1/1 | 1 | DATOS_ECONOMICOS_NO_VERIFICADOS |
| SIDE-DT42 | 3 | 1/1 | 1 | Causa no establecida; verificar contexto original |
| SIDE-FWPZ | 2 | 4/4 | 2 | DATOS_ECONOMICOS_NO_VERIFICADOS |
| SIDE-FWPZ | 3 | 3/4 | 4 | Sin plan completo |
| SIDE-JDGT | 1 | 1/1 | 1 | Causa no establecida; verificar contexto original |
| SIDE-JDGT | 2 | 0/1 | 1 | Sin plan completo |
| SIDE-JRHM | 1 | 1/1 | 1 | DATOS_ECONOMICOS_NO_VERIFICADOS |
| SIDE-JRHM | 2 | 1/1 | 1 | Causa no establecida; verificar contexto original |
| SIDE-JRHM | 3 | 0/1 | 1 | Sin plan completo |
| SIDE-N3S3 | 1 | 0/3 | 0 | Sin plan completo |
| SIDE-U8NA | 1 | 0/1 | 0 | Sin plan completo |
| SIDE-U8NA | 2 | 0/1 | 0 | Sin plan completo |
| SIDE-X6VC | 1 | 0/1 | 0 | Sin plan completo |
| SIDE-YHM8 | 1 | 0/1 | 0 | Sin plan completo |
| SIDE-YHM8 | 2 | 0/1 | 0 | Sin plan completo |
| SIDE-ZJ3K | 1 | 0/1 | 0 | Sin plan completo |
| SIDE-ZJ3K | 2 | 0/1 | 0 | Sin plan completo |

**Desbloqueo indispensable:** recuperar planes originales faltantes y evidencia autoritativa de eventos/saldos; conciliar el préstamo inválido de SIDE-8KP4. Conceder acceso adicional o autorizar una reconstrucción no permite inventar esos hechos. Sin esa evidencia, conservar el historial y tratar la resolución académica de cada caso explícitamente. Las correcciones de infraestructura seguras quedan guardadas en el commit candidato; no se promete recuperar cifras inexistentes.

### Antecedentes del inventario inicial (1/11; sustituidos por la ejecución siguiente)

- **GitHub main ya incorpora los cierres secuenciales, las correcciones de reloj y los parpadeos.** Su publicación Pages figura exitosa. Los informes que decían «no integrado» o «no publicado» describen un corte anterior y no prevalecen sobre la referencia actual.
- **El backend sigue desalineado:** Edge activa v6 no tiene el router de versiones de main y su paquete no coincide con main. El historial de migraciones no registra cinco SQL nuevos de guardia, secuencia, costos, enrutamiento y gracia. Las definiciones remotas de side_runtime y side_sync_game no contienen sequentialCloseVersion.
- Cron y Vault **sí existen actualmente**: un job activo cada minuto y un secreto presente. No corresponde mantener «restaurar Vault/cron» como ausencia confirmada; falta demostrar operación correcta de extremo a extremo.
- Hay **155 cierres remotos**, último registrado a las 22:42:00 del 1/11 en Lima. No son prueba de cierre correcto para cada partida. Se observaron **cero órdenes y cero recepciones** en las tablas temporales; el flujo remoto de recepciones no queda acreditado.
- La antigua debilidad documentada de guardado directo legacy **no puede trasladarse sin matiz al remoto actual**: hoy ambas RPC de guardado inspeccionadas niegan EXECUTE a anon y authenticated. Falta descartar rutas indirectas y validar compatibilidad.
- La regresión reciente documentada registra 981 pruebas, 959 aprobadas y 22 fallidas; un doble se corrigió y 21 fallos fueron reproducidos en la base. **No hay una suite completa verde posterior que certifique main actual.** Ser preexistente no cierra un fallo.

## Alcance, evidencia y límites de la auditoría inicial (1/11)

Se revisaron referencias de ramas, historial transversal, cambios de main y cierre, informes de las distintas etapas, pruebas/artefactos seleccionados y consultas administrativas de solo lectura de GitHub y Supabase. El repositorio contiene 507 commits alcanzables por las referencias locales y 147 Markdown en reports. Estos son universo de fuentes disponibles, **no una afirmación de haber reejecutado cada commit o cada prueba**. Se priorizaron informes integradores y posteriores para evitar repetir auditorías extensas de lógica.

No se ejecutó otra batería general ni pruebas que crearan partidas/datos: se aprovecharon resultados existentes, se inspeccionó evidencia versionada y se contrastó infraestructura actual. Ningún resultado histórico se atribuye a esta sesión. Fuentes locales ausentes se consultaron desde objetos Git cuando estaban disponibles. No se inspeccionaron chats externos ni sistemas no conectados; por ello no se garantiza descubrir requisitos nunca documentados en estas fuentes.

### Registro de evidencia

- **E01 — Git actual:** origin verificado como [valenlysm29/SIDE1](https://github.com/valenlysm29/SIDE1). git status, branch -avv, log --all, show 294d4dd, diff origin/main HEAD, ls-remote. Referencias concretas en tabla siguiente.
- **E02 — Lectura remota actual:** proyecto Supabase SIDE, ref plfuwfdpsagzrlveqkvl; list_migrations, list_edge_functions, get_edge_function, get_advisors(security) y SELECT de catálogos, cron y conteos agregados. No se leyeron valores de secretos. [Pages run 41386402180](https://github.com/valenlysm29/SIDE1/actions/runs/41386402180), jobs build/report/deploy aprobados; pasos sin pruebas económicas. Búsqueda de PR abiertos: ninguno devuelto.
- **E03 — Cierre candidato:** [VALIDACION_FINAL_CIERRES_SIDE.md](VALIDACION_FINAL_CIERRES_SIDE.md), SQL 20261102022758, 024042, 025853, 034926 y 040000; tests cierre_guardia_manual, cierre_guardia_automatico, cierre_worker_versiones, eventos_costos_restriccion y business_edge_auth. Incluye PostgreSQL real aislado, Supabase local y límites explícitos.
- **E04 — Continuidad y recuperación:** [CORRECCION_DEFINITIVA_CIERRES_LABORATORIO_SIDE.md](CORRECCION_DEFINITIVA_CIERRES_LABORATORIO_SIDE.md), [CORRECCION_CONTINUIDAD_RESULTADOS_SIDE.md](CORRECCION_CONTINUIDAD_RESULTADOS_SIDE.md). Las ocho ausencias y SIDE-FWPZ son observaciones históricas; no se recalculó en esta sesión su estado individual.
- **E05 — Sincronización y regresión:** [AUDITORIA_PARPADEOS_SINCRONIZACION_SIDE.md](AUDITORIA_PARPADEOS_SINCRONIZACION_SIDE.md), versión publicada en main y tests/output/parpadeos-comparacion.json y parpadeos-aceptacion-final.log **leídos desde origin/main**, porque faltan en este checkout. Log focal: 45/45, sin omisiones.
- **E06 — Laboratorio:** [laboratorio_estrategico_validacion_final.md](laboratorio_estrategico_validacion_final.md), [laboratorio_estrategico_dashboard_revision.md](laboratorio_estrategico_dashboard_revision.md), [LABORATORIO_ESTRATEGICO_IMPLEMENTACION.md](LABORATORIO_ESTRATEGICO_IMPLEMENTACION.md). Modelo, escenarios, gráficos y Chromium con datos simulados; autorización real pendiente.
- **E07 — Backend/seguridad:** [auditoria_sincronizacion_github_supabase_SIDE.md](auditoria_sincronizacion_github_supabase_SIDE.md), [validacion_local_side_final.md](validacion_local_side_final.md), [continuacion_integracion_side.md](continuacion_integracion_side.md), [auditoria_integral_side_2026-10-28.md](auditoria_integral_side_2026-10-28.md). Hallazgos antiguos sujetos a contraste E02, no todos siguen abiertos.
- **E08 — Economía/finanzas:** [diagnostico_financiero_20261030.md](diagnostico_financiero_20261030.md), [estados_financieros_seis_ciclos_20261030.md](estados_financieros_seis_ciclos_20261030.md), [VALIDACION_MEJORA_UTILIDAD_SIDE.md](VALIDACION_MEJORA_UTILIDAD_SIDE.md), [AUDITORIA_RENTABILIDAD_SIDE.md](AUDITORIA_RENTABILIDAD_SIDE.md), [publicacion_20261030.md](publicacion_20261030.md).
- **E09 — Producción:** [MEJORA_FLUJO_PRODUCCION_SIDE.md](MEJORA_FLUJO_PRODUCCION_SIDE.md), [LOGICA_ACTUAL_RECOMENDACIONES_PRODUCCION_SIDE.md](LOGICA_ACTUAL_RECOMENDACIONES_PRODUCCION_SIDE.md), oráculos y pruebas de production_recommendations y producción/DOP.
- **E10 — Excel y aislamiento:** [auditoria_pruebas_20261023.md](auditoria_pruebas_20261023.md), [revision_final_excel.md](revision_final_excel.md), [revision_cruzada_final_20261024.md](revision_cruzada_final_20261024.md), [separacion_2d_3d_2026-10-23.md](separacion_2d_3d_2026-10-23.md). Resultados históricos con alcance/versiones propios.
- **E11 — Eventos y otras ramas:** [DIAGNOSTICO_EVENTOS_SIDE.md](DIAGNOSTICO_EVENTOS_SIDE.md), [ESTADO_PARA_RETOMAR_SIDE.md](ESTADO_PARA_RETOMAR_SIDE.md), ../docs/INVENTARIO_EVENTOS_VIGENTES.md; js/event_semantics_v2.js inspeccionado. Ocho IDs marcados implementados: PE23, PE30, PE68, PE69, PE71, PE74, PE75 y PE77. No implica ocho eventos íntegramente certificados.
- **E12 — Áreas históricas:** informes bloque-docente-2026-10-21, teacher_history_validation, presencia/podio, salas/códigos, supabase_verificacion_2026-10-13, GODOT_QA_RENDIMIENTO_2026_10_09 y npc_performance_validation; pruebas de admisión, teacher lifecycle/grades/history/PDF, sincronización y mundo presentes. No sustituyen un recorrido vigente.

### Local, main y producción en el corte inicial (1/11)

| Capa | Referencia/evidencia actual | Qué demuestra |
| --- | --- | --- |
| Árbol de trabajo | codex/cierre-senal-error, HEAD 0fb55cb | Incluye trabajo previo sin consolidar; no sirve como copia limpia de entrega. |
| Cambios previos del árbol | 938 archivos rastreados ausentes, 6 modificados y 10 no rastreados al inicio | Condición local confirmada; no se restauró ni atribuyó causa definitiva. Ausencias incluyen recursos visuales y otros archivos. |
| main local | d56a143 | Está 50 commits detrás de origin/main; no representa main actual. |
| main remoto | c558d9532be5edff0b903e0d04e4eb5e57746f2e, confirmado por ls-remote | Referencia publicada actual; los diffs se hicieron contra origin/main coincidente. |
| Rama cierre remota | e8361dfe7aa7b1831e0a0cb8e30a524c2b4c596b | HEAD local tiene un commit adicional de normalización. |
| Commit solicitado | 294d4dd65c07dd9db3ae442e0360ca014452871b | Cambia únicamente SQL de gracia/reloj; no es un despliegue. Su contenido ya está en main por c558d95. |
| SQL/Edge main vs HEAD | Sin diferencias de contenido en supabase al comparar commits | No volver a integrar estos cambios como si main no los tuviera. |
| Frontend main vs rama cierre | main conserva correcciones de parpadeos ausentes de la rama | Una integración/reemplazo ingenuo podría perder correcciones. |
| Pages | Run 41386402180 exitoso para c558d95 | Publicación confirmada; no es prueba de funcionamiento económico o navegador conectado. |
| Edge producción | side-business-close ACTIVE v6, verify_jwt=false; index.ts y runtime.mjs | Tiene utility-v1/contexto histórico en runtime, pero carece del router y archivos legacy de main; comparación normalizada no coincide con main. |
| Migraciones registradas | 20261028041803, seis releases 20261030214133/40/43/46/49/52 y 20261102024628 | Ocho entradas; nombres/horas pueden diferir de archivos locales. Registro no equivale a esquema íntegro. |
| Cinco SQL nuevos | 20261102022758, 024042, 025853, 034926, 040000 | Ausentes del historial remoto; reloj y sincronización inspeccionados sin versión secuencial. |
| Cron/Vault | Job activo cada minuto; un secreto presente | No acredita validez del token, respuesta económica ni restauración completa. |
| Datos remotos | 155 cierres; 0 órdenes; 0 recepciones | Sin flujo remoto acreditado del modo receipts-v1. |

Otras ramas relevantes: version-estable-1/codex/continuidad-empresarial en caa30f5; prueba_utilidad_mejora en 80c944d; codex/integracion-utility-v1 en 59ebfbb; codex/continuidad-resultados-integral en 6bca981; codex/auditoria-parpadeos en 5e7c5e2; flujo-produccion-avance en 2cb077c; p02-diagnostico-materiales en df3e42a; laboratorio-estrategico local 55dd58b/remoto conocido 763f740 y logia_prueba_mejora remoto conocido b6af5cf. Se revisaron sus aportes mediante historia/informes y main; estas últimas referencias son las disponibles localmente, no una verificación remota fresca de cada rama. También existen ramas históricas de correcciones docente/estudiante/motor y Godot: no son instrucciones de integrarlas.

## Matriz completa de tareas

Prioridades: **P0** impide funcionamiento/cierre o publicación segura; **P1** función esencial incompleta; **P2** mejora importante; **P3** mejora secundaria/opcional. IDs estables dentro de este inventario; no se suman nuevamente sus subtareas de prueba.

| ID | Área | Tarea | Estado | Evidencia | Qué falta | Prioridad |
| -- | ---- | ----- | ------ | --------- | --------- | --------- |
| SIDE-001 | Repositorio | Inventariar referencias actuales y publicación | ✅ Completada y verificada | E01/E02: main remoto c558d95; Pages correcto | Conservar referencia del corte; no equivale a aceptación funcional | P2 |
| SIDE-002 | Repositorio | Disponer de checkout íntegro y reproducible | ✅ Completada y verificada | Clon remoto completo en .codex-work/fase01-integracion; 3143 rastreados, 0 ausentes; fsck conectividad y LFS OK; commit d56806d. | Base original preservada; usar el clon íntegro para trabajar. | P0 |
| SIDE-003 | Repositorio | Conciliar rama de cierre con main vigente | ✅ Completada y verificada | Comparación exclusiva: main 4b6b57a ya contiene cierres, UI y parpadeos; sin diferencias de UI/producción en d56806d; commit d56806d. | No reintegrar la rama antigua ni copiar su frontend. | P1 |
| SIDE-004 | Repositorio | Sincronizar main local con revisión de entrega | ✅ Completada y verificada | main local original y origin/main sincronizados a 4b6b57a; referencia anterior guardada en codex/preservado-main-fase0; commit d56806d. | La rama de trabajo original y sus modificaciones permanecen intactas. | P1 |
| SIDE-005 | Repositorio | Normalización local del runtime legado | ✅ Completada y verificada | 0fb55cb revisado: legacy-runtime no difiere de main; normalización ya contenida; commit d56806d. | Sin integración adicional necesaria. | P3 |
| SIDE-006 | Calidad | Resolver regresión general en una sola revisión | 🔴 Pendiente | E05: 981 casos, 959 pasan, 22 fallan; 21 reproducidos en base | Clasificar y resolver 21 casos; nueva suite completa sobre versión candidata | P0 |
| SIDE-007 | Cierres | Guardar cierres oficiales idempotentes en servidor | ✅ Completada y verificada | F01: Edge real + Auth/Data API: 9 y 18 resultados; concurrencia y hashes de cierres inmutables; commit d56806d. | Verificación acotada a escenarios de fase 1; no certifica economía completa ni todas las partidas reales. | P0 |
| SIDE-008 | Cierres | Impedir avance manual sin cierre de todas las empresas | ✅ Completada y verificada | F01: guardia manual probada; recorrido conectado 3 ciclos; SQL vigente en producción leído; commit d56806d. | Preservar la excepción versionada de partidas heredadas; no cambiar su historia. | P0 |
| SIDE-009 | Cierres | Avance automático secuencial sin saltos | ✅ Completada y verificada | F01: 6 ciclos automáticos consecutivos, 3 empresas, Edge real y RPC reales; commit d56806d. | Aceptación económica/UI completa sigue en fase 3. | P0 |
| SIDE-010 | Cierres | Respetar gracia de sincronización y reloj real de cada ciclo | ✅ Completada y verificada | F01: tests PostgreSQL de reloj/gracia/6 ciclos aprobados; escenario automático conectado aprobado; commit d56806d. | Mantener pruebas al cambiar transiciones; no adelantar relojes de partidas reales. | P0 |
| SIDE-011 | Cierres | Enrutar motor nuevo y legado sin transformar partidas | ✅ Completada y verificada | F01: Edge v8 coincide con cuatro archivos del main base; motores 1 y 0 probados mediante Edge real; commit d56806d. | No se cambió el motor legado. El ajuste HTTP candidato no se desplegó. | P0 |
| SIDE-012 | Cierres | Distinguir error económico de HTTP exitoso | ✅ Completada y verificada | F02: HTTP 204, errores por partida y seguimiento/fencing probados y desplegados en Edge v11; commits d56806d,3c0455d,fe9b4e6,de49d92 | Mantener monitoreo; errores históricos continúan explícitos. | P0 |
| SIDE-013 | Cierres | Recuperar ciclos históricos ausentes | 🔴 Pendiente | F02: 26 huecos clasificados sin escritura; 2 candidatos, 11 sin evidencia, 3 para conciliar, 10 dependientes | Recuperación histórica independiente. No ejecutar automáticamente candidatos ni inventar planes/eventos. | P0 |
| SIDE-014 | Estudiante | Admisión, código, identidad y reingreso | 🟡 Implementada, pendiente de validación | E07/E12: Auth local y pruebas de código; controles presentes | Recorrido actual con sesión real, transferencia autorizada y expulsión | P1 |
| SIDE-015 | Estudiante | Guardar borradores y confirmar decisiones por ciclo | 🟡 Implementada, pendiente de validación | E05/E12: persistencia, cola y recuperación focales | E2E en red interrumpida; confirmar coincidencia con snapshot servidor | P1 |
| SIDE-016 | Estudiante | Aislamiento entre empresas, salas y ciclos | 🟡 Implementada, pendiente de validación | E05/E07: guardias de identidad y pruebas locales | Pruebas negativas HTTP con dos docentes y estudiantes en revisión final | P0 |
| SIDE-017 | Estudiante | Planificación, infraestructura y personal conservan decisiones | 🟡 Implementada, pendiente de validación | E05/E09: controles y DOP implementados | Validar navegación, edición y recarga sin cambios de opciones | P1 |
| SIDE-018 | Estudiante | Logística: pedido, recepción parcial y faltantes | 🟡 Implementada, pendiente de validación | E07/E08: pruebas temporales locales; remoto 0 órdenes/0 recepciones | Activación explícita de nueva sala y recorrido con entregas verificadas | P1 |
| SIDE-019 | Estudiante | Ventas por canal y distribución automática | 🟡 Implementada, pendiente de validación | E07/E08: FIFO, tiendas/web y límites locales | Probar varios canales desde formularios y cotejar cierre sellado | P1 |
| SIDE-020 | Estudiante | Compatibilidad de transferencias manuales antiguas | 🟡 Implementada, pendiente de validación | E04: restablecidas y probadas; regresión manual pendiente E05 | Versionar/autorizar planes heredados; impedir vías manipuladas | P1 |
| SIDE-021 | Estudiante | Finanzas: resumen, préstamo y caja visibles | 🟡 Implementada, pendiente de validación | E05/E08: vistas implementadas; casos focales | Validar decisión a cierre y reporte, incluidos límites y deuda | P1 |
| SIDE-022 | Estudiante | Resultados provisionales y oficiales distinguibles | 🟡 Implementada, pendiente de validación | E04/E08: fuente sellada en rutas corregidas | Revisar todas las vistas y evitar ceros inventados/estimaciones oficiales | P1 |
| SIDE-023 | Estudiante | Alertas, pausa, vencimiento y recuperación de conexión | 🟡 Implementada, pendiente de validación | E05/E12: backoff y sincronización probados focalmente | Comprobar interacción con nuevo reloj y servidor real | P1 |
| SIDE-024 | Docente | Crear/configurar partidas y recuperar borrador | 🟡 Implementada, pendiente de validación | E12: lifecycle UI aprobado históricamente | Revalidar creación vigente con flags, espera y límites de ciclos | P1 |
| SIDE-025 | Docente | Controlar inicio, pausa, reanudación, cancelación y fin | 🟡 Implementada, pendiente de validación | E03/E12: controles y pruebas locales | Recorrido actual; cierres previos a avance y cancelación sin falso éxito | P1 |
| SIDE-026 | Docente | Modos Manual, Aleatorio y Competencia equilibrada | 🟡 Implementada, pendiente de validación | E07/E11: modos experimentales y 27 cierres HTTP/Edge documentados | Probar cada modo por interfaz, persistencia y compatibilidad con catálogo vigente | P1 |
| SIDE-027 | Docente | Comparar empresas y consultar resultados oficiales | 🟡 Implementada, pendiente de validación | E04/E06: modelo y consultas implementados | Conciliar Empresas/Resultados/Laboratorio en misma partida | P1 |
| SIDE-028 | Docente | Presencia, expulsión, liberación y podio | 🟡 Implementada, pendiente de validación | E12: servicios/pruebas históricas | Validar permisos y estado tras recarga/transferencia en versión final | P1 |
| SIDE-029 | Docente | Historial, calificaciones y exportación PDF | 🟡 Implementada, pendiente de validación | E12/E08: servicios y pruebas presentes | Verificar exportación vigente contra cierre sellado y autorización | P1 |
| SIDE-030 | Laboratorio | Modelo de indicadores solo desde cierres sellados | ✅ Completada y verificada | E06: 46 pruebas focales; fuente, ratios y ausencias explícitos | Sin nueva auditoría de fórmulas puras; integración en tarea 34 | P1 |
| SIDE-031 | Laboratorio | Historial y reapertura con recarga de cierres | 🟡 Implementada, pendiente de validación | E04/E06: actualización implementada y focales | Validar aparición de cierres reales tras cerrar/reabrir | P1 |
| SIDE-032 | Laboratorio | Comparaciones, gráficos y ausencia de ciclos futuros | ✅ Completada y verificada | E06: Chromium escritorio/tablet/móvil con fixtures y pruebas del modelo | Conservar casos; prueba conectada conjunta en tarea 34 | P2 |
| SIDE-033 | Laboratorio | Escenarios numéricos compatibles sin mutar cierre | 🟡 Implementada, pendiente de validación | E06: producción sintética validada para versiones limitadas | Verificar recibos reales y límites; no prometer ventas/utilidad contrafactual | P2 |
| SIDE-034 | Laboratorio | Continuidad integral de 3 y 6 ciclos, tres empresas | 🔴 Pendiente | E03/E05/E06: capas probadas por separado, no recorrido completo | Mismo Supabase, identidades, tres interfaces y conciliación por ciclo | P0 |
| SIDE-035 | Laboratorio | Acceso de dos docentes y rechazo cruzado real | 🟡 Implementada, pendiente de validación | E06: RPC inspeccionada, sesión docente real pendiente | Login real, partida propia/ajena y comparación pantalla/RPC | P0 |
| SIDE-036 | Laboratorio | Simulación de versiones no soportadas y recepciones | 🔴 Pendiente | E06: barreras devuelven simulación no disponible | Ampliación futura, solo si se incluye en alcance académico | P3 |
| SIDE-037 | Producción | Cálculo físico de capacidad y cuellos de botella | 🟡 Implementada, pendiente de validación | E09/E10: oráculos y focales; discrepancias actuales E05 | Resolver contratos y verificar mezcla/meta/capacidad con versión final | P1 |
| SIDE-038 | Producción | Regla interna trabajador-máquina y puntaje de maquinaria | 🟡 Implementada, pendiente de validación | E08/E09: corrección utility-v1 y pruebas de vigencia | Verificar motor desplegado, historial y capacidad; sin nuevos controles UI | P1 |
| SIDE-039 | Producción | Consumo, moldes, lotes, materiales y arrastre | 🟡 Implementada, pendiente de validación | E07/E08: FIFO y seis ciclos locales | Contraste integral final y casos límite de múltiples segmentos | P1 |
| SIDE-040 | Producción | Diagnóstico exacto de materiales limitantes | 🟡 Implementada, pendiente de validación | E11: efe1483, 23 casos y 12 recomendaciones en combinación de ensayo | Parche aislado sobre main actual; temporalidad y paridad Edge | P1 |
| SIDE-041 | Producción | Recomendación integrada con recursos existentes | 🟡 Implementada, pendiente de validación | E09: seis órdenes de etapas y estimación factible | Comprobar advertencias, presupuesto y recepciones sin alterar meta | P1 |
| SIDE-042 | Producción | Búsqueda acotada de compras de hilo | ✅ Completada y verificada | E09: alternativas enteras acotadas y casos documentados | No repetir búsqueda local; mantener aviso de que no prueba óptimo global | P2 |
| SIDE-043 | Producción | Optimización global de personal/equipos/materiales | 🔴 Pendiente | E09: algoritmo acotado, no demuestra mínimo global | Mejora futura; no bloquear entrega si se rotula recomendación aproximada | P3 |
| SIDE-044 | Producción | Presentaciones físicas y descuentos informativos | 🟡 Implementada, pendiente de validación | E11: side-packs-v1 en otra rama; pruebas parciales | Revisar versiones, migración y continuidad; evitar importar cambios económicos en bloque | P1 |
| SIDE-045 | Finanzas | Costos, depreciación, mantenimiento y valorización | 🟡 Implementada, pendiente de validación | E08/E10: escenarios locales y oráculos históricos | Contrastar revisión actual y decisiones equivalentes; separar devengo/caja | P1 |
| SIDE-046 | Finanzas | Ingresos por lote, margen y costo de venta | 🟡 Implementada, pendiente de validación | E08: precio efectivo corregido y escenarios conciliados | Validar múltiples canales y ventas parciales desde interfaces | P1 |
| SIDE-047 | Finanzas | Estados y caja conciliados seis ciclos en escenario local | ✅ Completada y verificada | E08: conciliador, recepciones, CxP e impuesto; límites expresos | No repetir ese escenario sin cambios; ampliar cobertura en tarea 34 | P1 |
| SIDE-048 | Finanzas | Diagnóstico de balances históricos descuadrados | 🔴 Pendiente | E07: 12 de 75 resultados históricos; causa no determinada | Trazar origen/versiones y documentar impacto académico sin reescribir cierres | P0 |
| SIDE-049 | Finanzas | Préstamo, línea aprobada e intereses devengados | 🟡 Implementada, pendiente de validación | E08: modelo y validación de monto; seis ciclos citados sin préstamo | Probar deudas sucesivas, tasa, arrastre y límites en cierre vigente | P1 |
| SIDE-050 | Finanzas | Calendario de amortización y pago de intereses bancarios | 🔴 Pendiente | E08: no definido/implementado; intereses por pagar se acumulan | Definir regla académica, implementar luego y probar; conservar decisiones existentes | P1 |
| SIDE-051 | Finanzas | Cobros a crédito, anticipos y obligaciones proveedor | 🟡 Implementada, pendiente de validación | E08: CxC/CxP y recepciones parciales conciliadas localmente | Verificar plazos, cobranzas y pagos en flujo real; documentar extensiones al Excel | P1 |
| SIDE-052 | Finanzas | Impuesto en último ciclo de partidas de 3 y 6 | 🟡 Implementada, pendiente de validación | E03/E08: pruebas locales y casos de recuperación | Validar cierre final compartido y reflejo en tres vistas | P1 |
| SIDE-053 | Finanzas | Proyección informativa sin guardar decisiones | 🟡 Implementada, pendiente de validación | E08: motor en copia, Chrome focal, filtro de caja agregado | Verificar ubicación actual, recepción y factibilidad temporal; no afirmar liquidez diaria | P1 |
| SIDE-054 | Finanzas | Calibración educativa utility-v1 y rentabilidad por segmento | 🟡 Implementada, pendiente de validación | E08: candidatos 120/150/280, competencia y recuperación locales | 3.000 escenarios competitivos financiables; aprobar supuestos y sensibilidad | P1 |
| SIDE-055 | Finanzas | Reproducir casos históricos 41/15/4 y 360 combinaciones | ⚪ No verificable | E08: requerimiento previo sin reproducción acreditada | Localizar datos originales; evitar reconstrucción inventada; decidir vigencia del requisito | P2 |
| SIDE-056 | Eventos | Inventario estático de 92 IDs únicos | ✅ Completada y verificada | E11: catálogo e inventario; 48 grupales y 44 individuales | Conservar inventario; no confundir con efectos completos | P2 |
| SIDE-057 | Eventos | Fuente autoritativa, programación y recuperación de sorteos | ✅ Completada y verificada | F01: lectura de contexto/sorteos solo servicio; PostgreSQL real y rechazo de hechos no verificables probados; commit d56806d. | Alcance: fuente/guardias; semántica completa de 92 eventos sigue en SIDE-060. | P0 |
| SIDE-058 | Eventos | Aplicación de demanda histórica y movimientos de caja | 🟡 Implementada, pendiente de validación | E03: integración local; runtime remoto contiene contexto de eventos | Prueba remota controlada, idempotencia y continuidad con nuevas reglas | P1 |
| SIDE-059 | Eventos | Efectos de costos históricos no verificables | 🔴 Pendiente | F02: efectos de costos no conciliados bloqueados en selección nueva y cierre; no se modificó semántica | Regla económica pendiente de fase 2; no bloquea partidas nuevas con configuración admitida. | P0 |
| SIDE-060 | Eventos | Semántica económica completa de los 92 eventos | 🔴 Pendiente | E11: solo 8 IDs marcados implemented en event_semantics_v2 | Completar 84 restantes y reconciliar incluso los 8 con texto/condiciones; PE30 es compuesto | P1 |
| SIDE-061 | Eventos | Restricciones de selección antes de iniciar partida | ✅ Completada y verificada | F02: trigger instalado y verificado; migración remota 20261102181550, fuente 20261102025853 | No altera selecciones existentes; costos no soportados siguen bloqueados. | P0 |
| SIDE-062 | Eventos | Noticia privada y trazabilidad docente de aplicación | 🟡 Implementada, pendiente de validación | E11: UI y RPC experimentales, fixtures aprobados | Auth real y comprobante: programado/aplicado/no aplicado, sin filtración entre empresas | P1 |
| SIDE-063 | Eventos | Equidad, duración, combinaciones y concurrencia | 🟡 Implementada, pendiente de validación | E11: rotación PE69 y ensayos de modos parciales | Eventos positivos/negativos/grupales distintos, seis ciclos y dos conexiones | P1 |
| SIDE-064 | Eventos | Reconstrucción histórica sin resorteo ni datos inventados | 🟡 Implementada, pendiente de validación | F02: clasificación con motor original en transacciones revertidas; hashes de copia sin cambios | Revisión y eventual recuperación separadas; fuentes de eventos y saldos aún necesarias. | P0 |
| SIDE-065 | Supabase | RLS habilitado en tablas públicas inspeccionadas | ✅ Completada y verificada | E02: 20 tablas públicas con rowsecurity=true en consulta actual | No repetir comprobación de bandera; autorización efectiva en tareas 16/35/67 | P0 |
| SIDE-066 | Supabase | RPC de guardado de cierre restringidas a servidor | ✅ Completada y verificada | E02: side_guardar_cierre_excel y negocio sin EXECUTE anon/authenticated | Cierra hallazgo antiguo de acceso directo; no acredita todas las rutas RPC | P0 |
| SIDE-067 | Supabase | Auditar permisos SECURITY DEFINER y search_path | 🟡 Implementada, pendiente de validación | F02: 54 pruebas negativas reales; search_path fijo y escritores financieros server-only verificados en producción; migración 20261102181532 | Resta revisión contextual completa de otras RPC/política Auth; no bloquea este despliegue focal. | P0 |
| SIDE-068 | Supabase | Reconstrucción completa de esquema/migraciones desde cero | 🟡 Implementada, pendiente de validación | F01: bootstrap reproducible de manifiestos y restauración real desde vacío con Auth, side_private y FK; commit d56806d. | Cadena histórica CLI completa todavía no normalizada; no confundir manifiesto de instalación probado con todas las migraciones antiguas. | P0 |
| SIDE-069 | Supabase | Alinear migraciones nuevas con funciones instaladas | ✅ Completada y verificada | F02: SQL instalado y Edge v11 idéntica a los cuatro archivos de main de49d92; Pages success | Seguimiento instalado externamente conservado y versionado en el repositorio. | P0 |
| SIDE-070 | Supabase | Cron y presencia de secreto de programación | ✅ Completada y verificada | F01: un job activo por minuto y Vault presente en producción; lectura sin invocación de partidas reales; commit d56806d. | Presencia comprobada; recuperación y operación aisladas en SIDE-071/072. | P0 |
| SIDE-071 | Supabase | Operación autenticada cron→Edge→cierre y alertas | ✅ Completada y verificada | F01: cron real local -> pg_net -> Edge real HTTP 200/success; token inválido 401; programación restaurada inactiva; commit d56806d. | La operación remota conserva errores históricos económicos explícitos; no se confunden con éxito de cron. | P0 |
| SIDE-072 | Supabase | Respaldo integral y restauración ensayada | ✅ Completada y verificada | F01: respaldo real de public/side_private/Auth/Vault; recuperación DPAPI, 155 cierres con hash idéntico y cron inactivo; commit d56806d. | DPAPI requiere esta cuenta/equipo; en otro host rotar token dedicado y probarlo antes de activar cron. Copias sensibles locales, no en Git. | P0 |
| SIDE-073 | Supabase | Protección de contraseñas y sesiones | 🟡 Implementada, pendiente de validación | E02: asesor informa protección de filtradas desactivada; Auth local probado | Revisar política disponible, revocación/transferencia y sesiones vigentes | P1 |
| SIDE-074 | Supabase | Rendimiento de consultas, índices y límites operativos | ⚪ No verificable | E05: backoff/interfaz; sin carga integral ni capacidad remota acreditada | Medir curso simultáneo, consultas y tiempos; umbrales de aceptación | P2 |
| SIDE-075 | Interfaz | Parpadeos, foco y preservación de formularios | ✅ Completada y verificada | E05: main contiene 417b63d; log versionado 45/45 y comparación base | Conservar regresiones aprobadas; revisión integrada con servidor en tarea 34 | P1 |
| SIDE-076 | Interfaz | Navegación estudiantil y separación DOP/Producción | 🟡 Implementada, pendiente de validación | E01/E09: main Planificación, rama DOP y Planificación; cambios locales adicionales | Consolidar diseño autorizado sin perder campos de Ventas/Finanzas | P1 |
| SIDE-077 | Interfaz | Adaptación escritorio, tablet y móvil | 🟡 Implementada, pendiente de validación | E05/E06: fixtures y carga estática en tamaños probados | Recorrido conectado, textos largos, zoom y formularios actuales | P2 |
| SIDE-078 | Interfaz | Accesibilidad: teclado, lector y contraste | ⚪ No verificable | E06: no hay certificación completa de lector/contraste | Revisión focal de controles esenciales y errores | P2 |
| SIDE-079 | Interfaz | Carga estática y disponibilidad de recursos | 🟡 Implementada, pendiente de validación | E01/E05: Pages publicado; checkout local con assets ausentes | Comprobar recursos de entrega y CDN/red real; no culpar al motor por checkout | P1 |
| SIDE-080 | Interfaz/3D | Independencia económica de mundo 3D | ✅ Completada y verificada | E10/E11: pruebas focales de separación y no autoridad de ventas 3D | Mantener pruebas existentes; no rehacer lógica económica 3D | P1 |
| SIDE-081 | Interfaz/3D | Entrada al mundo, reinicio, NPC y navegación | 🟡 Implementada, pendiente de validación | E10/E12: mejoras y 12/12 interiores; fallos históricos de entrada/reinicio | Clasificar estado actual y probar solo flujo incluido en entrega | P2 |
| SIDE-082 | Interfaz/3D | Expansión Godot, navmesh, oclusión y perfiles de rendimiento | 🟡 Implementada, pendiente de validación | E12: QA local; cápsulas, navegación plana y una máquina | Mejora futura; comparar motor realmente entregado antes de invertir | P3 |
| SIDE-083 | Excel | Paridad histórica de oráculos y escenarios guardados | ✅ Completada y verificada | E10: 3.104 salidas y auditoría original documentada; focales independientes | No repetir esos libros sin cambio de fórmula ni exigir paridad de versiones distintas | P1 |
| SIDE-084 | Excel | Paridad actual 1–6 ciclos con mismas decisiones | 🔴 Pendiente | E05/E08/E10: seis comparaciones fallidas y no contraste completo worker/libro | Restaurar fuentes/COM; mapear versiones, adaptaciones y 1–6 ciclos | P1 |
| SIDE-085 | Excel | Resolver reputación, puntajes, consumo y mercado discrepantes | 🔴 Pendiente | E05: fallos nominados en baseline; cambios utility-v1 intencionales | Separar defecto, expectativa obsoleta y nueva regla; preservar oráculo independiente | P1 |
| SIDE-086 | Calidad | Prueba de concurrencia e idempotencia real ampliada | ✅ Completada y verificada | F01: dos llamadas Edge concurrentes por ciclo; PostgreSQL real Node/Edge, rollback, reintentos y 36 resultados incluidos legado; commit d56806d. | Mantener hashes y pruebas; concurrencia masiva y aceptación general quedan fuera del alcance probado. | P0 |
| SIDE-087 | Despliegue | Publicación Pages de main | ✅ Completada y verificada | E02: run 41386402180 build y deploy success para c558d95 | No necesita repetir publicación; aceptación de aplicación en tareas 34/90 | P2 |
| SIDE-088 | Despliegue | Pipeline de calidad previo a publicar y coordinación DB/Edge | 🔴 Pendiente | E02: workflow dinámico solo build/report/deploy; sin pruebas de producto | Puerta de regresión, contrato de versiones, rollback y comprobación posterior | P0 |
| SIDE-089 | Documentación | Guías vigentes y alcance académico definitivo | 🟡 Implementada, pendiente de validación | E03–E12: guías e informes contradictorios por revisión/fecha | Unificar versión, instalación, roles, eventos soportados y límites económicos | P1 |
| SIDE-090 | Entrega | Aceptación final reproducible de SIDE | 🔴 Pendiente | E03/E05/E08: no hay aprobación integral de versión actual | Cerrar P0/P1, ensayo académico y acta con SHA/SQL/Edge, sin fallos críticos | P0 |

## Tareas terminadas, parciales, pendientes y no verificables

### ✅ Completada y verificada

- SIDE-001: Inventariar referencias actuales y publicación.
- SIDE-002: Disponer de checkout íntegro y reproducible.
- SIDE-003: Conciliar rama de cierre con main vigente.
- SIDE-004: Sincronizar main local con revisión de entrega.
- SIDE-005: Normalización local del runtime legado.
- SIDE-007: Guardar cierres oficiales idempotentes en servidor.
- SIDE-008: Impedir avance manual sin cierre de todas las empresas.
- SIDE-009: Avance automático secuencial sin saltos.
- SIDE-010: Respetar gracia de sincronización y reloj real de cada ciclo.
- SIDE-011: Enrutar motor nuevo y legado sin transformar partidas.
- SIDE-012: Distinguir error económico de HTTP exitoso.
- SIDE-030: Modelo de indicadores solo desde cierres sellados.
- SIDE-032: Comparaciones, gráficos y ausencia de ciclos futuros.
- SIDE-042: Búsqueda acotada de compras de hilo.
- SIDE-047: Estados y caja conciliados seis ciclos en escenario local.
- SIDE-056: Inventario estático de 92 IDs únicos.
- SIDE-057: Fuente autoritativa, programación y recuperación de sorteos.
- SIDE-061: Restricciones de selección antes de iniciar partida.
- SIDE-065: RLS habilitado en tablas públicas inspeccionadas.
- SIDE-066: RPC de guardado de cierre restringidas a servidor.
- SIDE-069: Alinear migraciones nuevas con funciones instaladas.
- SIDE-070: Cron y presencia de secreto de programación.
- SIDE-071: Operación autenticada cron→Edge→cierre y alertas.
- SIDE-072: Respaldo integral y restauración ensayada.
- SIDE-075: Parpadeos, foco y preservación de formularios.
- SIDE-080: Independencia económica de mundo 3D.
- SIDE-083: Paridad histórica de oráculos y escenarios guardados.
- SIDE-086: Prueba de concurrencia e idempotencia real ampliada.
- SIDE-087: Publicación Pages de main.

### 🟡 Implementada, pendiente de validación

- SIDE-014: Admisión, código, identidad y reingreso.
- SIDE-015: Guardar borradores y confirmar decisiones por ciclo.
- SIDE-016: Aislamiento entre empresas, salas y ciclos.
- SIDE-017: Planificación, infraestructura y personal conservan decisiones.
- SIDE-018: Logística: pedido, recepción parcial y faltantes.
- SIDE-019: Ventas por canal y distribución automática.
- SIDE-020: Compatibilidad de transferencias manuales antiguas.
- SIDE-021: Finanzas: resumen, préstamo y caja visibles.
- SIDE-022: Resultados provisionales y oficiales distinguibles.
- SIDE-023: Alertas, pausa, vencimiento y recuperación de conexión.
- SIDE-024: Crear/configurar partidas y recuperar borrador.
- SIDE-025: Controlar inicio, pausa, reanudación, cancelación y fin.
- SIDE-026: Modos Manual, Aleatorio y Competencia equilibrada.
- SIDE-027: Comparar empresas y consultar resultados oficiales.
- SIDE-028: Presencia, expulsión, liberación y podio.
- SIDE-029: Historial, calificaciones y exportación PDF.
- SIDE-031: Historial y reapertura con recarga de cierres.
- SIDE-033: Escenarios numéricos compatibles sin mutar cierre.
- SIDE-035: Acceso de dos docentes y rechazo cruzado real.
- SIDE-037: Cálculo físico de capacidad y cuellos de botella.
- SIDE-038: Regla interna trabajador-máquina y puntaje de maquinaria.
- SIDE-039: Consumo, moldes, lotes, materiales y arrastre.
- SIDE-040: Diagnóstico exacto de materiales limitantes.
- SIDE-041: Recomendación integrada con recursos existentes.
- SIDE-044: Presentaciones físicas y descuentos informativos.
- SIDE-045: Costos, depreciación, mantenimiento y valorización.
- SIDE-046: Ingresos por lote, margen y costo de venta.
- SIDE-049: Préstamo, línea aprobada e intereses devengados.
- SIDE-051: Cobros a crédito, anticipos y obligaciones proveedor.
- SIDE-052: Impuesto en último ciclo de partidas de 3 y 6.
- SIDE-053: Proyección informativa sin guardar decisiones.
- SIDE-054: Calibración educativa utility-v1 y rentabilidad por segmento.
- SIDE-058: Aplicación de demanda histórica y movimientos de caja.
- SIDE-062: Noticia privada y trazabilidad docente de aplicación.
- SIDE-063: Equidad, duración, combinaciones y concurrencia.
- SIDE-064: Reconstrucción histórica sin resorteo ni datos inventados.
- SIDE-067: Auditar permisos SECURITY DEFINER y search_path.
- SIDE-068: Reconstrucción completa de esquema/migraciones desde cero.
- SIDE-073: Protección de contraseñas y sesiones.
- SIDE-076: Navegación estudiantil y separación DOP/Producción.
- SIDE-077: Adaptación escritorio, tablet y móvil.
- SIDE-079: Carga estática y disponibilidad de recursos.
- SIDE-081: Entrada al mundo, reinicio, NPC y navegación.
- SIDE-082: Expansión Godot, navmesh, oclusión y perfiles de rendimiento.
- SIDE-089: Guías vigentes y alcance académico definitivo.

### 🔴 Pendiente

- SIDE-006: Resolver regresión general en una sola revisión.
- SIDE-013: Recuperar ciclos históricos ausentes.
- SIDE-034: Continuidad integral de 3 y 6 ciclos, tres empresas.
- SIDE-036: Simulación de versiones no soportadas y recepciones.
- SIDE-043: Optimización global de personal/equipos/materiales.
- SIDE-048: Diagnóstico de balances históricos descuadrados.
- SIDE-050: Calendario de amortización y pago de intereses bancarios.
- SIDE-059: Efectos de costos históricos no verificables.
- SIDE-060: Semántica económica completa de los 92 eventos.
- SIDE-084: Paridad actual 1–6 ciclos con mismas decisiones.
- SIDE-085: Resolver reputación, puntajes, consumo y mercado discrepantes.
- SIDE-088: Pipeline de calidad previo a publicar y coordinación DB/Edge.
- SIDE-090: Aceptación final reproducible de SIDE.

### ⚪ No verificable

- SIDE-055: Reproducir casos históricos 41/15/4 y 360 combinaciones.
- SIDE-074: Rendimiento de consultas, índices y límites operativos.
- SIDE-078: Accesibilidad: teclado, lector y contraste.

## Bloqueos registrados antes de la separación histórica (superados para este despliegue)

1. **Historial no recuperable con la evidencia disponible:** 26 huecos estructurales en la copia de producción; varios no tienen planes y cuatro partidas registran rechazos de datos económicos/crédito. No se inventan cierres.
2. **Costos de eventos sin regla verificable:** se mantiene rechazo; el trigger preventivo de nuevas selecciones aún no está instalado en producción. No se sustituye por costos arbitrarios.
3. **Puerta de publicación:** HTTP 204 y endurecimiento están probados y comprometidos, pero no se integran ni despliegan mientras los controles críticos anteriores sigan abiertos. No falta autorización para desplegar: falta evidencia/consistencia económica histórica.
4. **Migraciones y seguridad más amplias:** bootstrap y restauración actuales funcionan; quedan normalización de toda la cadena histórica, despliegue candidato y revisión contextual de la superficie RPC/política Auth.
5. **Aceptación general:** los fallos de regresión históricos y la calibración económica/UI completa se mantienen para las fases posteriores; no se declara SIDE terminado.

### Regresión que debe resolverse sin repetir auditorías amplias

E05 conserva 21 nombres de fallos en la base d474b57. Agrupación para tratarlos conjuntamente:

- DOP/planificación y recomendaciones: meta 3000, recursos disponibles/faltantes, ubicación DOP, metas sin recursos y tres moldes.
- Excel real: base, capacidad limitada, material insuficiente, meta cero, prémium e inventario durante tres ciclos; algunos requieren libros/COM no disponibles.
- Contrato económico: puntajes SUM, reputación, consumo/calidad, ejemplo documental, valoración/arrastre, mezcla de materiales, suma comercial y mercado compartido.
- Contrato UI heredado: manualDistributionData/transferencias y ubicación del botón de proyección.

No son 21 defectos confirmados: pueden incluir entorno, expectativas obsoletas o discrepancias reales. Cada caso necesita causa y decisión explícita. Cambiar una prueba solo procede si se demuestra el contrato autorizado y se mantiene cobertura equivalente. Los conteos anteriores de 17, 20, 22 o 36 pertenecen a revisiones/baterías distintas y no se suman.

## Plan original de referencia por prioridades y dependencias

La fase 0 y parte de la fase 1 ya tienen evidencia nueva; consultar la sección de ejecución y la matriz actualizadas antes de repetir trabajo.

### Fase 0 — Fijar una base de trabajo íntegra

SIDE-002, 003, 004 y 005. Preservar el estado actual; recuperar archivos y evidencias; usar main remoto c558d95 como referencia inicial, sin sobrescribir modificaciones. Preparar manifiesto de SHA, versiones y supuestos. **Salida:** copia reproducible y diferencias explicadas.

No volver a fusionar toda la rama cierre: los SQL/Edge ya están en main y el frontend de la rama puede perder sincronización. Examinar solo aportes realmente exclusivos.

### Fase 1 — Cierre seguro y contrato de instalación

Resolver conjuntamente SIDE-007 a 013, 057, 059, 061, 064, 067 a 072 y 086. Dependencias: base íntegra → respaldo/restauración aislada → cadena SQL real → Edge completa versionada → autenticación cron → cierres/avances/reintentos.

- Ensayar instalación desde cero y actualización de una copia del esquema existente; comparar cuerpos y permisos, no solo nombres de migración.
- Mantener reglas y planes de partidas antiguas; versión nueva solo en nuevas partidas. Probar transferencia manual guardada y ausencia de flag.
- Cerrar manual/automáticamente cada ciclo y empresa exactamente una vez. Fallo congela avance; demora respeta gracia y mueve el inicio siguiente sin saltar ciclos.
- Diagnosticar por separado cierres históricos y balances. Entregar listado/causa/propuesta; cualquier reparación posterior será trazable y autorizada.
- Verificar token sin divulgarlo y distinguir cron ejecutado, HTTP aceptado y resultado económico persistido.

**Salida:** paquete compatible probado, restaurable y sin bypass financiero conocido. Esta fase prepara una publicación futura; esta auditoría no la ejecuta.

### Fase 2 — Completar funciones económicas y eventos esenciales

SIDE-018 a 022, 037 a 041, 044 a 054 y 058 a 063; SIDE-084/085 para contratos que condicionen reglas. Dependencias: versión económica identificada → contrato y oráculo → implementación futura → prueba Node/Edge/SQL.

- Diagnóstico de materiales y descuentos: integrar solo parche pertinente, conservar recomendaciones actuales y comprobar Edge. Revisar side-packs-v1 por separado.
- Finanzas: definir amortización y pagos; probar crédito bancario sucesivo junto con CxC/CxP, recepción, caja e impuesto final.
- utility-v1: documentar diferencias intencionales del Excel; evaluar competencia y factibilidad real, no solo caja final. La matriz de 3000 casos individuales existente no cumple el encargo de 3000 escenarios competitivos financiables.
- Eventos: usar un único registro por ID de variable, condición, duración, ámbito, límites y comprobante. Completar 92 sin reducir decisiones existentes; costos bloqueados hasta definir base verificable.
- Consolidar modos y programación; probar equilibrio, aleatoriedad, asignación manual y noticias privadas con las mismas identidades y versión.

**Salida:** reglas esenciales completas y trazables; oráculos acotados al contrato vigente. No cambiar precios por segmento ni asignación interna de personal mediante nuevos controles.

### Fase 3 — Un solo ensayo conectado para múltiples pendientes

SIDE-014 a 029, 031, 034/035, 049/051/052, 062/063, 073, 076/079 y 086. Ejecutar **3 empresas × 3 ciclos y 3 empresas × 6 ciclos**, con dos docentes para pruebas de aislamiento, en Supabase aislado y con interfaces reales.

Cubrir en un recorrido reutilizable: creación en los tres modos, confirmaciones, recursos, recepción parcial, varios canales, crédito, inventarios, evento positivo/negativo y grupal, pausa/red caída/reingreso, cierre manual/automático y reapertura del Laboratorio. Conciliar para cada empresa/ciclo:

- Decisiones confirmadas y sus versiones; materiales recibidos, consumidos y restantes por SKU/lote.
- Capacidad y producción; ventas ≤ existencias y demanda; conservación de stock por canal.
- Ingreso, costo de venta, utilidad, caja, activos, pasivos y patrimonio; continuidad entre aperturas/cierres.
- Impuesto final, intereses y pagos según regla aprobada; cada movimiento económico una sola vez.
- Estudiante, Docente y Laboratorio contra el mismo comprobante sellado; gráficos sin ciclos futuros.
- Reintento concurrente sin duplicar cierre ni avanzar sin resultados; denegación de acceso cruzado.

**Salida:** evidencia de aceptación integrada que cierra muchas tareas 🟡 a la vez; no tres nuevas auditorías independientes del motor.

### Fase 4 — Regresión, publicación segura y entrega

SIDE-006, 084/085, 088 a 090; revisión focal de interfaz y 3D incluido en la entrega. Depende de fases 1–3.

Resolver los 21 casos en una única revisión; ejecutar batería completa y recorridos requeridos una vez estabilizada. Configurar puerta de calidad previa a Pages y secuencia compatible SQL/Edge/frontend, junto con rollback ensayado. Publicación y comprobación posteriores solo en trabajo futuro autorizado. Actualizar guía docente/estudiante, instalación y límites con el manifiesto real.

**Salida:** revisión candidata sin P0/P1 abiertos, aceptación académica reproducible y guía de operación/restauración.

### Qué no necesita nuevas pruebas extensas ahora

- No rehacer oráculos históricos de 3104 salidas ni las auditorías de fórmulas ya documentadas si sus fuentes/reglas no cambian. Sí comprobar la versión actual en SIDE-084/085.
- No reauditar desde cero los modelos puros del Laboratorio ni las fórmulas de sus ratios; usar las pruebas existentes y el ensayo conectado.
- No repetir la matriz individual de 3000 casos como sustituto de la matriz competitiva pendiente.
- No volver a demostrar el inventario estático de 92 IDs, la presencia de cron/Vault, las banderas RLS ni el éxito del deploy Pages ya consultado.
- Mantener pruebas focales de no autoridad 3D, hilo acotado y parpadeos. Repetirlas cuando haya cambios que puedan afectarlas; integración final sigue siendo necesaria.

### Obligatorios y mejoras futuras

**Obligatorios:** todas las tareas P0/P1 abiertas de la matriz. Incluyen las 92 consecuencias y los tres modos porque forman parte del alcance solicitado. Si se desea entregar antes una versión con catálogo reducido o reglas financieras recortadas, eso requiere una decisión explícita de alcance; este inventario no la presume.

**P2:** accesibilidad, carga, refinamientos responsive/3D y recuperación de requisitos históricos sin fuentes. Un defecto que impida usar una pantalla o comprometa seguridad se eleva a P0/P1.

**P3:** óptimo global de recursos, ampliación de escenarios del Laboratorio, expansión Godot/navmesh y normalización cosmética exclusiva. No deben retrasar por sí solas la entrega académica. La tarea SIDE-044 de presentaciones no exige activar otra modalidad: exige resolver qué versión pertenece a la entrega y verificar la continuidad si se usa.

## Criterios objetivos para declarar SIDE finalizado

1. **Versión única identificada:** manifiesto de commit frontend, paquete/hash y versión Edge, SQL y reglas económicas. Checkout íntegro; diferencias local/main/producción explicadas.
2. **Cero P0/P1 abiertos.** Ningún estado ⚪ puede encubrir un requisito esencial; si falta evidencia se obtiene o se redefine alcance explícitamente.
3. **Cierre correcto:** cada empresa elegible tiene resultado por ciclo, sin saltos ni doble cargo; avance condicionado a cierre persistido; manual, automático, gracia, pausa y reintento aprobados.
4. **Continuidad 3 y 6 ciclos:** escenarios conectados descritos, con conciliación entre las tres interfaces y comprobantes, inventarios físicos conservados y estados contables equilibrados. Comparaciones monetarias: tolerancia documentada por redondeo; usar S/0,02 como referencia de las auditorías existentes o justificar una distinta.
5. **Finanzas verificables:** costos e ingresos trazables; impuestos finales y deuda/pagos implementados según reglas; ninguna rentabilidad o liquidez se declara a partir de casos imposibles de financiar.
6. **Eventos completos del alcance:** 92 IDs conciliados con descripciones/condiciones, tres modos persistentes, efectos autoritativos e idempotentes y privacidad demostrada.
7. **Seguridad efectiva:** pruebas negativas de dos docentes y estudiantes, propiedad de empresas, expulsión/transferencia, cierre exclusivo del servidor y revisión de avisos críticos de permisos. RLS habilitado por sí solo no basta.
8. **Regresión y oráculos:** suite obligatoria verde sobre el mismo SHA, sin ocultar fallos ni omisiones esenciales; diferencias respecto al Excel justificadas por versión y pruebas independientes aplicables.
9. **Historial tratado:** cada cierre ausente/descuadre identificado tiene causa e impacto documentados y resolución trazable, o preservación histórica expresamente aceptada; no recalcular calificaciones silenciosamente.
10. **Operación recuperable:** respaldo y restauración ensayados, cron/Edge autenticados, alerta de fallos, despliegue coordinado y rollback; comprobación posterior de versión y funcionamiento.
11. **Usabilidad y documentación:** flujo esencial utilizable en pantallas objetivo sin pérdida de datos, guías actuales y ensayo docente-estudiante de entrega aprobado.

## Control de ubicación y preservación

Todos los clones, respaldos, guiones y evidencias nuevos permanecen dentro de SIDE1. La copia original conserva sus 938 ausencias, 6 modificaciones y 11 archivos sin seguimiento del inicio; no se sobrescribió. Se agregó una referencia de respaldo para el main local anterior. Ninguna prueba escribió en partidas de producción. Los datos sensibles y el token protegido están ignorados por Git.

