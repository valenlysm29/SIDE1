# Observaciones del estudiante SIDE — 21 de octubre de 2026

Remoto verificado: `https://github.com/valenlysm29/SIDE1.git`. Se revisaron y conservaron los cambios locales existentes al iniciar. Skills aplicadas: `frontend-design` y `webapp-testing`, disponibles en `.agents/skills/`; ninguna skill necesaria estuvo ausente. Trabajo distribuido en cuatro bloques y revisión final independiente. No se agregaron decisiones ni se modificaron avatares elegibles o fórmulas del motor.

Antes de modificarlo se confirmó en `js/production_dop.js` que DOP significa
**Diagrama de Operaciones del Proceso** y pertenece al módulo de Producción.

## Prioridad 1: ingresos

Se confirmó un bug de historial y presentación: al avanzar se perdía `financialHistory` y el nuevo ciclo abierto mostraba ceros sin distinguirlos de un cierre sin ventas. Se conserva el historial y se explican resultados pendientes. Además, el ciclo abierto conserva el balance general completo del último cierre (activos, deuda y patrimonio), etiquetado como tal; una prueba nueva verifica su ecuación contable y evita mutar el cierre. El motor genera ventas cuando el plan es factible; falta de personal, mesa/molde o material puede producir cero legítimamente. No se fabricaron ventas ni se alteró la demanda para esconder un plan inviable.

Tres cierres consecutivos del motor actual producen/venden 80 unidades y registran **S/3200 de ingresos por ciclo**. Caja: S/100000 → S/85158,03 → S/78179,06 → S/71200,09. Utilidad: −S/6909,695 por ciclo, coherente con costos S/10109,695. Se concilian caja, activos, inventario, deuda y puntajes. Otra prueba ejecuta las migraciones SQL reales sobre PostgreSQL local, persiste y recupera tres cierres de S/4320 de ingresos cada uno y verifica reintentos idempotentes.

El oráculo vuelve a comparar el motor actual con los esperados independientes previamente calculados en Excel: **3104/3104 coincidencias, cero diferencias** (351 + 56 + 468 + 585 + 1140 + 252 + 252). No se volvió a recalcular Excel mediante COM. La paridad literal y las reglas versionadas propias del motor actual se verifican por separado; no se afirma que los costos añadidos de un motor versionado existan en el libro original.

No se accedió a datos de una partida remota real. Para atribuir la causa exacta de aquella partida faltaría su snapshot/configuración/cierres; las pruebas locales demuestran la cadena completa y la persistencia SQL, no la conectividad del proyecto remoto.

## Matriz de observaciones

| Observación | Diagnóstico | Decisión tomada y justificación | Archivos tocados | Cómo se verificó | Pendientes |
|---|---|---|---|---|---|
| 1. Sin ingresos | Bug de historial/presentación; motor sí vende con recursos. Cero también es resultado válido de un plan inviable. | Conservar historial por ciclo y distinguir pendiente de cierre; advertir producción cero. No cambiar fórmulas ni inventar stock/ventas. | `js/engine/caja.js`, `js/app.js`, `js/student_financial_view.js`, `js/engine/ui_excel.js`; tests de caja e ingresos3ciclos. | Tres ciclos motor local/RPC simulada y tres persistidos en PostgreSQL local; oráculo3104. | Diagnóstico de la partida remota específica requiere sus datos. |
| 2. Conectado pegado | Remoto ya tenía heartbeat y tolerancia; booleano local y etiqueta estudiante no caducaban. | Presencia por última señal: remoto/local vencen tras120s+15s de tolerancia; estudiante deja de confirmar servidor después15s. El cierre de pestaña no es detectable instantáneamente. Reloj docente refresca estado incluso si una consulta espera. | `js/app.js`, `js/docente.js`. | Tracker jitter/respuestas atrasadas, navegador TTL/desconexión, regresión presencia docente. | Validar dos sesiones reales tras despliegue. |
| 3. Gastos al inicio | Proyección podía confundirse con caja real. | Capital íntegro al empezar; mostrar compromiso previsto y cobrar una vez al cierre, junto con ventas/costos del período. Evita duplicidad y conserva Excel. | `js/engine/ui_excel.js`, `js/app.js`, caja/historial. | Caja inicial100000; proyección no debita; cierre idempotente concilia. | Ninguno local. |
| 4. Costos visibles | Mejora: bloque quedaba al final y neto positivo ocultaba gastos fijos. | Local y limpieza exactos arriba del editor; cash flash del cambio real incluye su desglose sin otro débito; movimiento reducido. | `js/engine/ui_excel.js`, `js/app.js`, `css/design-system.css`. | Navegador escritorio/móvil, pruebas caja/idempotencia. | Ninguno local. |
| 5. Plan por lotes | Existe y alimenta motor; explicación incompleta. | Conservar hasta3lotes con cantidades/materiales/molde/precio, capacidad24días, personal, activos, compras e inventario; completar DOP/proyección. Sin límite de bodega ni tiempos nuevos inventados. | `js/engine/ui_excel.js`, `js/production_dop.js`; pruebas de ingresos. | Tres ciclos con inventarios, capacidad, activos y ventas; SIM1/2/3. | Ninguno local. |
| 6. Pausa | Bug: fase decisions autorizaba envíos aunque status paused. | Overlay claro, reloj congelado, aviso al reanudar; permitir preparación en memoria, bloquear guardado/envío en UI y tres RPC. | `js/side_rules.js`, `js/app.js`, editor, CSS; nueva migración pausa. | Node, navegador y SQL local repetido: lectura/heartbeat siguen, CAS y datos no cambian durante pausa. | Usuario debe aplicar SQL. |
| 7. Empresa eliminada | Bloqueo docente existía; faltaban resumen/motivo correcto y reflejo del flag motor en docente. | Conservar expulsión docente por inactividad y eliminación del flujo antiguo por falta de primer envío. Motor actual autoenvía borrador; caja negativa no crea quiebra nueva. Bloquear operación y mostrar resumen último conocido, aclarando pendiente. | `js/app.js`, `js/docente.js`. | Expulsión/reingreso/cola/listado en escritorio y móvil; resumen y motivo legacy. | Aplicar migración de expulsión si falta; validar remoto. |
| 8. Calculadora MP en DOP | Mejora coherente con diagrama productivo; agregación por familia ocultaba faltantes de calidad elegida. | Mostrar necesidad/stock/faltante por material y compras adicionales redondeadas a unidad de venta. Compra sigue siendo decisión del estudiante. | `js/engine/ui_excel.js`, `js/production_dop.js`. | Caso cuero distinto no cubre material elegido, conversión hilo, actualización y conectores móvil. | Ninguno local. |
| 9. Guardar inicia | Bug: saveAll llamaba prepareGame y abría cuenta regresiva. | Guardar conserva borrador validado; Iniciar partida crea sala/espera. Inicio automático al acabar espera intacto en ambos modos. | `js/docente.js`, `tests/game_lifecycle_ui.cjs`. | Chromium+PostgreSQL local manual/automático, guardar válido/inválido sin creación; espera→inicio. | Ninguno propio. |
| 10. Finanzas exige guardar | Bug de flujo/visibilidad local; plan canónico confirma todas las secciones juntas. | Envío directo sin Guardar previo; préstamo cero válido. Aclarar alcance global y exigir plan productivo válido al confirmar desde cualquier sección. | `js/app.js`, `js/decision_catalog.js`, editor. | Finanzas vacías envío directo y plan completo sin guardado previo, navegador. | Ninguno local. |
| 11. Cuándo DOP | Mejora de explicación y bug de índice al omitir lotes incompletos. | Disponible en Producción desde ciclo1 durante preparación; se actualiza con borrador, consulta tras confirmar y durante pausa; ventas se resuelven al cierre. Conservar índice original. | `js/production_dop.js`, `js/engine/ui_excel.js`. | Pruebas de contratos, bloqueo dinámico tras montar y reanudación; navegador escritorio/móvil. | Ninguno local. |

## Decisiones alternativas y reversión

- Costos iniciales: reservar caja al empezar también es válido, pero requeriría registrar un anticipo y compensarlo al cierre. Restar ahora y volver a cobrar al cerrar sería incorrecto y rompería la conciliación. No se aplica ese cambio contable.
- Pausa: se eligió revisión sin consolidación para respetar intervención docente. Para permitir envíos habría que retirar conjuntamente el guard `paused` de `gameAccess`, `canSave` del editor y la envoltura SQL, además de actualizar textos/pruebas. No revertir una sola capa.
- Recomendación MP: se puede quitar `materialRecommendationHtml` y su montaje DOP sin cambiar decisiones o motor; se conserva porque ayuda a interpretar capacidad y faltantes.
- Guardar: restaurar el antiguo manejador que invoca `prepareGame` vuelve a abrir la espera al guardar. Se eligió el borrador local para que configurar no arranque una cuenta regresiva.
- Confirmación: en motor por lotes se mantiene un único envío de cinco secciones; separarlo requeriría componer versiones parciales del plan y no es una reversión de una línea.

## SQL: ejecutar por el usuario, en este orden

**No se ejecutó SQL en Supabase remoto.** En el SQL Editor de tu proyecto SIDE:

1. Tener aplicada `supabase/migrations/2026-10-20_correcciones_docente_estudiante.sql` y sus prerrequisitos del despliegue existente. Si ya está aplicada, no hace falta repetirla.
2. Ejecutar `supabase/migrations/2026-10-21_expulsion_empresa.sql` si falta. Es la migración existente que permite expulsar/reactivar y rechazar operación/reingreso del eliminado.
3. Ejecutar **`supabase/migrations/2026-10-21_pausa_escrituras_estudiante.sql`**. Es nueva, transaccional y repetible. Bloquea las tres RPC de escritura con `CICLO_PAUSADO`, preservando identidad, revisiones/CAS, lectura y heartbeat.

Las dependencias se comprueban al ejecutar y el SQL falla con un mensaje claro si falta el paso anterior. Para instalaciones antiguas, consultar primero `docs/expulsion-empresa.md`; no ejecutar todas las migraciones indiscriminadamente. Después verificar docente+estudiante reales: entrar, pausar, intentar enviar, reanudar, enviar, expulsar y comprobar resumen/bloqueo.

## Verificación y evidencia

- Bloques detallados: [ingresos](bloque-ingresos-2026-10-21.md), [estado](bloque-estado-2026-10-21.md), [UI](bloque-ui-2026-10-21.md), [docente](bloque-docente-2026-10-21.md).
- Revisión independiente y resultados completos: `reports/revision-final-observaciones-2026-10-21.md`.
- Suite Node completa: **482/482** aprobadas, sin omisiones; oráculo **3104/3104**; SIM1/2/3 escritorio/móvil aprobados.
- Integral: **33/33 suites existentes aprobadas**. El intento inicial encontró dos botones menores de44px en móvil; se corrigió la cascada CSS en `css/production.css` y la repetición completa pasó6viewports,132comprobaciones y126capturas, sin errores JavaScript. El runner opcional `side_full_flow.cjs` no existe y se registró como ausente; no se contó como aprobado. La cobertura de cierres/partidas corresponde a SIM1/2/3, `game_lifecycle_ui.cjs` y los runners de estados existentes.
- UI focal final:13/13 comprobaciones de observaciones y10/10 de presencia/pausa/eliminación. Pruebas PostgreSQL locales de ingresos, pausa, expulsión, Excel, acceso y podio aprobadas.
- Histórico estudiante reparado: comprobaba visibilidad de un título interno que CSS oculta intencionalmente y exigía cero cuando el campo también rechaza negativos mediante beforeinput. Se validan editor visible, título adjunto y estado no negativo; no se cambia producto para acomodar la prueba. Los cinco tamaños y el flujo canónico terminan aprobados.
- Capturas, JSON y logs nuevos en `tests/output/`; análisis e informes en `reports/`; temporales en `.codex-work/`, todo dentro SIDE1.

## Continuación

Implementación y revisión de los cuatro bloques completas. Los cambios se organizan en commits de historial/ingresos, estados y UI, flujo docente, arneses, balance pendiente, accesibilidad móvil e informe. La entrega incluye commits ordenados y publicación a main; el hash final se informa en la respuesta de cierre. No hubo bloqueo por límite de uso. Pendientes remotos: aplicar el SQL en el orden indicado y validar con las cuentas/datos reales de la partida; no fueron utilizados aquí.

## Commits de implementación

- 50e0a5f: historial e ingresos entre ciclos.
- 34b9b7e: pausa, eliminación, costos, DOP y envío.
- 89e45c2: guardar/iniciar y presencia docente.
- cf9dfe4: cobertura Node y arneses de navegador.
- 17e7da2: balance cerrado durante ciclo pendiente.
- c8d165f: accesibilidad táctil y balance visible en navegador.
- Commit documental final: este informe, revisión independiente, auditoría previa contextualizada y README con orden SQL.
