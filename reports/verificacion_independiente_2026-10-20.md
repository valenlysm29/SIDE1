# Verificación independiente SIDE — 20/10/2026

Verificador F: no escribió código de producto. Rama `codex/verificador-20261020`; pruebas leen la entrega integrada de SIDE1 y escriben únicamente evidencia local. Sin cuentas reales, SQL remoto, cambios en partidas publicadas ni alteraciones del Excel original.

## Alcance y resultados

- Playwright/Chromium real mediante servidor HTTP local: SIM-A, SIM-B y SIM-C, **tres ciclos y cinco empresas en cada simulación**, 45 resultados empresa/ciclo; **442 comprobaciones**. Cada simulación incluye una empresa que nunca envía, otra con préstamo de S/ 5.000, otra con borradores sin confirmar. SIM-C cambia segmento/molde en ciclos 2 y 3.
- Cada resultado verifica libro único, caja inicial + entradas − salidas = caja final, activos = deuda + patrimonio, flujo reconciliado, arrastre entre ciclos y coincidencia del reporte docente y la caja del estudiante con el libro. No enviar cobra local S/ 2.000 + limpieza S/ 712,32 cada ciclo. Los borradores de C quedan registrados como autoenviados. El préstamo de B ingresa solo una vez.
- Navegador independiente docente: **39 comprobaciones**. Navegador estudiante: **19 comprobaciones**, incluidas descripciones únicas, gramática y limpieza.
- Escritorio 1150×666 y 1440×900; móvil 360×740, 390×844 y 414×896. Formularios canónicos sin desborde global y al menos 60% de altura útil. Tabla de eventos accesible por teclado y desplazamiento horizontal.
- **Runtime 3D real**: `SIDE3D.prepare/enter` originales, Three y activos locales, sin sustituir SIDE3D. Entrada confirmada, avatar renderizado y cero excepciones JavaScript; el recorrido conserva el libro sin cargos arcade. Se detectó inicialmente la misión imposible de atender clientes sin economía arcade; raíz la corrigió a visitas al local/producción/almacén. La segunda ejecución confirma recorrido explícito y ausencia de misión imposible. El cálculo real `missionValue` completa cada visita al recibir su marca correspondiente.
- Excel original abierto en modo fórmulas y valores; SHA-256 `3b6b42bbbc56a2534ce7e241c607d572dd38dcf02311683609497df36a0c1eb1`, sin guardar ni sobrescribir. La paridad histórica completa se ejecuta por el orquestador. **Las extensiones autorizadas del motor nuevo no tienen un Excel original con esos mismos cobros**: estas simulaciones verifican sus cifras configuradas e invariantes, no afirman una equivalencia inexistente con el libro anterior.

Evidencia: `tests/output/correcciones-2026-10-20/independiente/{verification,teacher-independent,student-independent,visual-runtime}.json`, capturas `SIM-*-cycle-*.png`, `canonical-*`, `teacher-events-independent-*` y `actual-world-new-lots.png`. Acceso: logs `independent-access-db.log` y `independent-access-browser.log`.

## Matriz de los 57 errores

«Verificado» corresponde al código integrado y las comprobaciones descritas; no significa SQL aplicado ni sitio publicado actualizado. «Inspección» indica que la evidencia es código/texto y no una nueva reproducción visual de ese detalle. 18, 33 y 36 ya tenían su corrección de base y se comprueban como regresiones.

| ID | Dictamen | Evidencia concreta |
|---|---|---|
| 1 | Verificado | Radio aleatorio seleccionable antes de iniciar y bloqueado con razón después. |
| 2 | Verificado | Estado checked y borde de selección diferenciados. |
| 3 | Verificado | Controles disabled y aviso de bloqueo visible. |
| 4 | Verificado | Guardar configuración deshabilitado al bloquear partida. |
| 5 | Verificado | Bienvenida cambia a consulta de partida activa. |
| 6 | Verificado | Fecha se deriva del inicio real y fin se identifica como estimación sin pausas. |
| 7 | Inspección + regresión DOM | Texto manual identifica inicio automático del ciclo 1 y control docente posterior. |
| 8 | Inspección + regresión DOM | Terminología docente unificada como sala de espera. |
| 9 | Verificado | Modal de eventos también deshabilitado con partida activa. |
| 10 | Verificado | Selección inicial vacía produce 15 eventos seleccionados. |
| 11 | Verificado | 1 seleccionado de 92 y contador plural. |
| 12 | Verificado | Tabla con tabindex, ayuda y desplazamiento, cinco tamaños. |
| 13 | Verificado | Menú y título Rondas y eventos. |
| 14 | Verificado | Cambio de sección restablece scrollY = 0. |
| 15 | Verificado | Un solo botón Copiar código. |
| 16 | Verificado | Ciclo pausado nunca figura en curso. |
| 17 | Verificado | Mismo libro/estado de resultados para las cinco empresas en 45 resultados. |
| 18 | Regresión de corrección previa | Heartbeat reciente se conserva ante siguiente snapshot sin marca. |
| 19 | Verificado | 25 muestra aviso inmediato y se limita a 20 al salir del campo. |
| 20 | Verificado | Etiquetas identifican Infraestructura/Logística y explican conteos. |
| 21 | Verificado | Caja inicial ciclo N corresponde al cierre N−1; capital inicial en ciclo 1. |
| 22 | Verificado | 45 identidades de reconciliación de caja. |
| 23 | Verificado | 45 balances con efectivo y activo/deuda/patrimonio reconciliados. |
| 24 | Verificado | Operación/inversión/financiamiento suman variación de caja. |
| 25 | Verificado | Carga PDF con indicador/aria-busy; controles recuperados al terminar. Generación real PDF verificada en recheck/teacher_report_pdf_ui.cjs.log (descarga y visor reales). |
| 26 | Verificado | Ausencia conserva Sin datos en panel y mapeo PDF; cero explícito no se pierde. |
| 27 | Inspección + DOM | Nombre común Simulador de Decisiones Financieras. |
| 28 | Verificado | Sin datos suficientes cuando puntajes están en cero. |
| 29 | Verificado | Publicar podio deshabilitado sin empresas calificadas. |
| 30 | Verificado | Menú y volver a inicio type=button. |
| 31 | Verificado | Empresa A sin envío paga S/ 2.712,32 en todos los ciclos de las tres SIM. |
| 32 | Verificado local | Borrador guardado sin envío se incluye en cierre y registra envioAutomatico/autoenviadas. Ruta servidor validada en PGlite. |
| 33 | Regresión de corrección previa | Sin solicitud permanece S/ 70.000 disponible en UI heredada. |
| 34 | Verificado | Advertencias accesibles warning/urgent en 60/15 segundos. |
| 35 | Verificado | HUD/reporte y libro coinciden tras cada cierre; saldo estimado único en UI heredada. |
| 36 | Regresión de corrección previa | Sin comprar molde, 50 unidades muestran requerimiento de 15 m². |
| 37 | Verificado | Escribir −5 normaliza inmediatamente a 0. |
| 38 | Inspección | Contrato expresa 12 ciclos mensuales y aclara fin de partida sin cargos posteriores. |
| 39 | Verificado | Al menos 60% de área de trabajo en cinco tamaños, sin overflow global. |
| 40 | Inspección + regresión existente | Eliminado Puedes bajar de 0; liquidación describe activos poseídos. |
| 41 | Verificado | Editor canónico distribuye capacitación en C y marketing en D sin otra sección; configuración heredada conserva compatibilidad. |
| 42 | Verificado | Resumen no expone Supabase. |
| 43 | Verificado | Limpieza una sola etiqueta y Costo por ciclo. |
| 44 | Verificado | Secuencia de pestañas se conserva al cambiar ciclo. |
| 45 | Verificado | Arrastre de caja inicial en 45 resultados, no capital original fijo. |
| 46 | Verificado | Estado synced confirma cambios sincronizados. |
| 47 | Verificado | Personal/porcentaje automáticos no aparecen como decisión GUARDADA. |
| 48 | Verificado | Descripción única en reglas de ventas automáticas. |
| 49 | Verificado | Cada compra aporta 1 unidad. |
| 50 | Verificado | Cabeceras canónicas coinciden con Infraestructura/Producción/Ventas/Finanzas/Logística. |
| 51 | Verificado local | PGlite: terna exacta, 10 fallos/bloqueo15min, no bypass legacy, RLS y podio mínimo. Requiere migración para activar en producción. |
| 52 | Verificado local | Cliente rechaza dominio y servidor valida dominio/excepciones. Requiere migración en producción. |
| 53 | Verificado local | Confirmación, mostrar/ocultar y recuperación con llamadas Auth simuladas en DOM real. Entrega de correo/URL permitida requiere configuración de la cuenta real. |
| 54 | Verificado | Placeholders explícitos Escribe… y campos vacíos. |
| 55 | Verificado | Empezar disponible al preparar DOM crítico, sin contador artificial. |
| 56 | Verificado | Fin de ciclo no muestra Revisa y registra. |
| 57 | Verificado local | Ambas páginas usan release.js y muestran 2026.10.20.1. Verificación pública tras despliegue pertenece al orquestador. |

## Catálogo: 21 filas

| Fila | Dictamen de revisión | Evidencia / límite |
|---|---|---|
| 1 | Alineada | Catálogo/config de maquinaria conservados; instalación/capacitación/mantenimiento explicitados. |
| 2 | Alineada en motor nuevo | Mesa y moldes comprados obligatorios antes de fabricar; pruebas motor y UI. |
| 3 | Alineada | Consumos por molde preservados, regresión sin comprar molde. |
| 4 | Alineada con aclaración | Conversión de compras y precio por unidad de producción explícitos; interpretación de precio de carrete requiere confirmación Joe. |
| 5 | Alineada | Config de productividad/eficiencia preservada por versión y oráculo. |
| 6 | Alineada | Costos originales; capacitación C y marketing D canónicos. |
| 7 | Alineada | Catálogo Excel congelado de 68 opciones preservado. |
| 8 | Alineada | 24 días productivos dentro de un ciclo mensual. |
| 9 | Alineada nueva partida | Una mesa; falta de compra impide producir. |
| 10 | Alineada UI/cobro con decisión documentada | Corte usa Costos De Producción 1500/2000/3800; contradicción del catálogo queda por confirmar. |
| 11 | Alineada UI/cobro | Sueldo y desglose mensual con beneficios derivados de costoLaboral. |
| 12 | Alineada UI/cobro | Empresa sin envío paga local2000 + limpieza712,32; jefatura desglosada. |
| 13 | Alineada nueva partida | motor_version permanente; editor canónico sin checkbox, cinco secciones mismo plan. |
| 14 | Supuestos documentados | Horas extra25%, almacén2/unidad, TEA+3pp centralizados, confirmación Joe pendiente. |
| 15 | Fuera del cálculo, explícito | Control docente informa que distritos no afectan reparto por segmentos; fallback autorizado. |
| 16 | Alineada con extensión del juego | Tiendas distritales+web cobradas como UI; no agrega distritos San Miguel/SMP del libro. Verificación de Resumen detectó fallback excel16 y raíz lo corrigió. |
| 17 | Alineada a menú autorizado | Preventivo200; niveles Excel ocultos inactivos; mantenimiento del activo se explica por separado. |
| 18 | Extensión autorizada | Garantía30/90/180 preservada; no afecta caja. |
| 19 | Fuera de alcance, defaults neutros | Proveedor/pago/lead time no expuestos y selecciones ocultas filtradas en motor nuevo. |
| 20 | Fuera de alcance | No añade inventarios/depreciación al menú. |
| 21 | Extensión autorizada | Analista5000/garantía proveedor preservados; devolución por evento no definido no se inventa. |

## Hallazgos devueltos y reparación

1. **Misiones 3D del juego anterior incompatibles con recorrido nuevo**: detectadas en runtime real; raíz cambió a visitas alcanzables. Reejecución real sin errores, sin cargos y sin misión de clientes.
2. **Resumen de motor nuevo usaba preview excel16**: detectadas llamadas sin overrides; raíz incorporó helper de versión y regresión del alquiler. Revalidación de UI compara cifra mostrada de costos estimados incluyendo tienda de Los Olivos S/1.800 con motor nuevo.
3. Un fallo inicial de prueba de aviso60s fue una carrera del temporizador de la propia prueba: comprobar actualización y clase en la misma evaluación resolvió el determinismo, sin cambio de producto.

## Límites explícitos

- Se verifican datos locales y PGlite; no se aplicó migración ni se validó SMTP/recuperación contra cuentas reales.
- El recorrido 3D nuevo no ejecuta economía arcade adicional; su economía se registra en cierre por lotes. Partidas anteriores conservan su motor. No se afirma que ambos modos tengan las mismas misiones.
- La equivalencia histórica exacta contra Excel y los runners completos preexistentes deben quedar en verde en el registro del orquestador; este verificador no sustituye esa batería con invariantes.
- La captura muestra render/avatar real y navegación básica; no es una revisión visual exhaustiva de cada NPC o animación, cuya lógica no fue alterada.


## Último punto de control

La repetición secuencial final completó **22/22 comprobaciones**: cinco tamaños sin desborde y área útil ≥60%, Resumen usando motor actual con alquiler de Los Olivos S/1.800, entrada real 3D, recorrido explícito sin cargos duplicados y tres misiones de visita alcanzables. `visual-runtime.json` terminó el 20/10 a las 19:25:48 de Lima, sin errores JavaScript ni failure. La ayuda Cómo se cierra el ciclo está colapsada por defecto en el HTML generado; el runner abre los details para inspeccionar los controles en las capturas. **La pendiente visual anterior queda cerrada.**

## Revisión independiente del bloqueo de despliegue

Se revisó `ba76695` sin navegador y se encontró un bypass funcional: ante RPC de cierre faltante y ausencia de snapshots, el panel permitía continuar incluso una partida del motor nuevo. La reproducción independiente extrajo `closeExcelRemoteRound()` real en VM y obtuvo `true` donde correspondía `false`.

Corrección `3d8a675` validada por inspección y cinco casos independientes en VM, sin editar producto:

- Motor nuevo + RPC faltante + cero reportes: **false**, cierre bloqueado.
- Motor heredado explícito + RPC faltante + cero reportes: **true**, compatibilidad conservada.
- Partida heredada sin versión + RPC faltante + cero reportes: **true**.
- Motor heredado con empresa ya habilitada por lotes + RPC faltante: **false**.
- Error de cierre distinto de migración, aun heredado sin reportes: **false**.

El gate de características bloquea los controles canónicos remotos si el servidor no anuncia el motor correspondiente. La migración anuncia características dentro de una transacción: un fallo de prerrequisitos revierte también ese anuncio. Recuperar un cierre ya persistido sigue siendo idempotente. La ejecución visual secuencial final quedó posteriormente completada, como registra el punto de control anterior. La revisión del gate no ejecutó Chromium ni repitió simulaciones.


## Auditoría final consolidada — lectura de evidencia

No se repitieron pruebas ni se abrió navegador en esta auditoría. Se consolidó por nombre de suite, usando la última ejecución de integral → recheck → final-repaired, sin sumar reintentos como pruebas diferentes.

| Ejecución | Suites | Pasan | Fallan |
|---|---:|---:|---:|
| integral | 38 | 30 | 8 |
| recheck | 11 | 7 | 4 |
| final-repaired | 3 | 3 | 0 |
| Consolidado por nombre | **41** | **40** | **1 preexistente** |

La batería Node final en `final-node-sequential.log` contiene **465 pruebas, 465 pasan, 0 fallan, 0 canceladas, 0 omitidas**. La paridad Excel conserva **3104 comparaciones**, descompuestas en 351 + 468 + 585 + 1140 + 252 + 252 + 28 + 28. Las cinco salidas paridad pipeline registran cero diferencias; las tablas base/consecuencias son concordantes.

### Última ejecución por suite

| Suite | Última ejecución | Resultado |
|---|---|---|
| `local_server_test.py` | integral | PASS |
| `decision_options_db.cjs` | integral | PASS |
| `student_admission_db.cjs` | integral | PASS |
| `student_admission_matrix_db.cjs` | integral | PASS |
| `teacher_history_db.cjs` | integral | PASS |
| `game_lifecycle_db.cjs` | integral | PASS |
| `game_observations_db.cjs` | integral | PASS |
| `waiting_room_db.cjs` | integral | PASS |
| `playable_hub.cjs` | integral | PASS |
| `continuous_world.cjs` | integral | PASS |
| `gameplay_hud.cjs` | integral | PASS |
| `world_business_ui.cjs` | integral | PASS |
| `world_cycle_restart.cjs` | recheck | PASS |
| `world_startup.cjs` | final-repaired | PASS |
| `world_loading.cjs` | integral | PASS |
| `world_entry_assets.cjs` | recheck | PASS |
| `supplied_npcs.cjs` | recheck | FALLO PREEXISTENTE DEMOSTRADO |
| `mona_npc.cjs` | integral | PASS |
| `npc_locomotion.cjs` | integral | PASS |
| `game_lifecycle_ui.cjs` | final-repaired | PASS |
| `decisions_cycle_ui.cjs` | final-repaired | PASS |
| `teacher_lifecycle_ui.cjs` | recheck | PASS |
| `tablet_return_browser.cjs` | integral | PASS |
| `npc_world_fixes_browser.cjs` | integral | PASS |
| `world_orientation_mobile.cjs` | integral | PASS |
| `teacher_history_ui.cjs` | integral | PASS |
| `teacher_report_pdf_ui.cjs` | recheck | PASS |
| `character_selection_ui.cjs` | integral | PASS |
| `decision_interiors_browser.cjs` | integral | PASS |
| `npc_navmesh_browser.cjs` | integral | PASS |
| `access_corrections_20261020_db.cjs` | integral | PASS |
| `excel_sql_db.cjs` | integral | PASS |
| `excel_sql_activacion_db.cjs` | integral | PASS |
| `sim_1.cjs` | integral | PASS |
| `sim_2.cjs` | integral | PASS |
| `sim_3.cjs` | integral | PASS |
| `transicion_excel_browser.cjs` | integral | PASS |
| `engine_corrections_20261020_browser.cjs` | integral | PASS |
| `access_corrections_20261020_browser.cjs` | recheck | PASS |
| `podio_programado_db.cjs` | recheck | PASS |
| `podio_programado_ui.cjs` | recheck | PASS |

### Excepción preexistente demostrada

`supplied_npcs.cjs` falla tanto en el código actual (recheck) como en la base aislada **d1c83f3** (base-proof), con el mismo mensaje y línea: **AssertionError: customers complete a decision**, línea **136**, actual=false/expected=true, después de PASS NPC world supplied player assets with procedural city NPCs. Ninguna de las dos ejecuciones agotó el timeout del runner. No se presenta esta suite como verde ni se atribuye su fallo a las correcciones.

El antiguo fallo de `teacher_lifecycle_ui.cjs` también se reprodujo en la base (esperaba /24 horas/i y recibió VISTA PREVIA); su runner actualizado ya pasa en recheck. El único fallo vigente del consolidado es supplied_npcs.

### Evidencia adicional comprobada

- **Automático:** final-repaired/game_lifecycle_ui.cjs.log confirma cuenta regresiva de servidor, recarga, desfase de reloj, varios clientes, rechazo tardío y reingreso exacto en otro dispositivo; sin errores JS.
- **Móvil:** ese mismo log cubre calificaciones/presencia móviles; recheck/teacher_lifecycle_ui.cjs.log confirma estado fijo en cinco tamaños. La verificación visual independiente conserva sus cinco tamaños de escritorio/móvil.
- **Podio programado:** recheck/podio_programado_ui.cjs.log registra publicación automática real de **1 minuto**, con navegador docente cerrado; límites inválidos, cancelar, reprogramar, publicar ahora y caducidad de24h pasan.
- **3D:** independiente/visual-runtime.json conserva **22 checks**, entered=true, guided=true, hasArcadeMission=false, ledgerBefore=ledgerAfter={}, errores JS=[] y cierre temporal final.
- **PDF real:** recheck/teacher_report_pdf_ui.cjs.log confirma descarga/visor reales, exclusión de eliminadas, limpieza URL, lista vacía, ausencia de SDK, nombres largos,48eventos, datos faltantes y nota0. Existen button-download.pdf y stress.pdf con páginas renderizadas en tests/output/teacher-pdf/.
- **Simulaciones nuevas:**442checks, tres SIM × tres ciclos × cinco empresas =45resultados empresariales; reporter39y estudiante19 permanecen completos.

**Dictamen:** apto para push conforme a la excepción autorizada para el fallo NPC preexistente demostrado. No quedan fallos nuevos ni pendientes de ejecución local en esta consolidación. El dictamen no aplica SQL remoto ni confirma todavía la versión publicada: publicación, comprobación de release compartida y ejecución manual de SQL siguen siendo pasos de despliegue del orquestador/usuario.
