# Revisión final independiente — observaciones del jugador

Fecha de referencia: 21 de octubre de 2026, America/Lima. Skills disponible y consultada: `.agents/skills/webapp-testing/SKILL.md`. Revisión dentro de SIDE1; remoto comprobado `https://github.com/valenlysm29/SIDE1.git`; el padre contiene únicamente SIDE1. No se ejecutó SQL remoto, no se modificaron avatares, decisiones ni fórmulas del Excel.

## Revisión del código

- Historial financiero: el cierre conserva cada estado por ciclo y evita duplicar el mismo ciclo; la UI distingue cierre pendiente e historial cerrado. La demostración produce ingresos positivos con un plan factible, sin fabricar ventas para un plan inviable.
- Hallazgo adicional confirmado: el balance provisional visible al abrir un ciclo nuevo omitía activos y hacía patrimonio igual a caja aunque hubiera deuda. Se conserva una copia del último balance cerrado completo y se etiqueta su ciclo en sala/oficina; la prueba usa caja700, activos1700, deuda400 y patrimonio1300, comprueba identidad contable y que la vista no mute el cierre. Archivos: `js/app.js`, `js/student_financial_view.js`, `tests/student_financial_summary.test.js`. Verificación focal: 12/12 PASS; se repite toda la batería Node tras este ajuste.
- Caja inicial y costos: la caja íntegra se muestra antes del cierre; los costos obligatorios son compromisos previstos y se contabilizan una vez en el libro. La animación informa el costo incluido sin un débito adicional.
- Pausa: `canOperate` bloquea guardado/envío, `canReview` mantiene consulta; los controles del editor vuelven a comprobar el estado al clic. El SQL conserva identidad y CAS, bloquea las tres escrituras con fila de partida bloqueada y permite lectura/heartbeat. La migración es repetible.
- Configuración docente: Guardar conserva el borrador; Iniciar crea la sala y su espera. Las finanzas vacías representan préstamo cero y pueden confirmarse sin guardado previo.
- Presencia: la caducidad usa marcas de heartbeat y tiempo real, con tolerancia sostenida para evitar parpadeos; no depende de un booleano permanente. Eliminación mantiene los criterios existentes y el resumen distingue cifras pendientes.

## Resultados independientes

| Verificación | Resultado | Evidencia |
|---|---|---|
| Todas las pruebas Node | **482/482 PASS**, 0 omitidas; 96 archivos, repetición final tras ajuste de balance | `node-final.log`; integral inicial 481/481 |
| Oráculo Excel | **3104/3104**, diferencias 0 | `verification-1.log` … `verification-7.log` |
| SIM-1 UI | PASS, 1 ciclo, 4 empresas, móvil sin desborde | `sim_1.log` |
| SIM-2 UI | PASS, 3 ciclos, 2 empresas, móvil sin desborde | `sim_2.log` |
| SIM-3 UI | PASS, 3 ciclos, 5 empresas, móvil sin desborde | `sim_3.log` |
| Ingresos 3 ciclos SQL | PASS, ingresos S/4320 cada ciclo, historial/caja/reportes/snapshots e idempotencia | `verification-8.log` |
| Pausa SQL | PASS, migración doble aplicación, identidad, tres RPC rechazadas, lectura y reanudación | `verification-9.log` |
| Excel SQL y activación | PASS ambos | `excel_sql_db.log`, `excel_sql_activacion_db.log` |
| Expulsión SQL | PASS | `company_expulsion_db.log` |
| Correcciones acceso SQL | PASS | `access_corrections_20261020_db.log` |
| Podio programado SQL | PASS | `podio_programado_db.log` |
| Presencia tras última edición docente | **10/10 PASS** | `presence-final.log` |
| Integral escritorio/móvil sin FPS | **33/33 suites existentes PASS** tras corrección y repetición móvil; 1 opcional ausente | resumen inicial + `mobile-final.log` |
| Observaciones UI / estado | **13/13 y 10/10 PASS**, errores JavaScript 0 | `player-ui-final.log`, `student-state.log` |

Logs focales: `tests/output/observaciones-20261021/revisor/`. Integral: `tests/output/mejora-integral-2026-10-01/observaciones-20261021/runs/2026-10-22T02-32-19-739Z/`.

El oráculo ejecutó JavaScript contra esperados independientes cacheados desde Excel y versionados. No se abrió ni recalculó Excel mediante COM y no se modificaron fórmulas ni fixtures esperados. Los 3104 casos son: base351, consecuencias56, SIM1 468, SIM2 585, SIM3 1140, banca252 y mezcla252.

## Incidencias del arnés y límites

El runner integral original se detuvo antes de ejecutar pruebas: su respaldo recursivo de outputs históricos en OneDrive tardaba varios minutos sin iniciar las suites. Se ejecuta una copia temporal en `.codex-work/observaciones/run_integral_review.cjs` que conserva exactamente suites, argumentos, tiempos, assertions y captura de evidencia del runner; únicamente omite respaldo/restauración masivos de outputs. El runner versionado no se alteró para este ajuste.

La nueva prueba `player_observations_20261021_browser.py` dejaba el overlay de pausa montado después de mutar directamente el runtime de prueba a running. Se añadió `updateIntegrationUI()` al fixture de reanudación, igual al flujo de polling real. No se retiraron comprobaciones y no se cambió el producto por esa incidencia. Se conserva el log del intento inicial. La repetición completa aprobó 13/13, incluyendo el balance pendiente y su etiqueta de último cierre. Se inspeccionó la captura DOP móvil: texto y conectores legibles, con desplazamiento vertical normal y sin desborde horizontal.

La primera ejecución integral terminó con **32 PASS, 1 FAIL y 1 SKIP**. El fallo era real: en `mobile_integral_ui.cjs`, los botones Volver y Enviar de la tableta medían 44×34 y 112×40 px a 360 px de ancho. Las reglas compactas de `css/production.css`, cargadas después de `responsive.css`, anulaban el mínimo táctil de 44 px. Se corrigieron los dos mínimos para puntero táctil y la primera columna móvil pasó de 34 a 44 px para reservar el espacio del botón. No se cambiaron asserts ni se omitió la suite.

La repetición completa `node tests/mobile_integral_ui.cjs` aprobó **6 viewports (360×800, 390×844, 768×1024, 800×360, 844×390 y 1024×768), 126 capturas y 132 comprobaciones**, sin desborde, sin controles inferiores a 44 px, sin superposición del HUD y con cero errores JavaScript. Focal adicional `responsive_delivery.test.js` + `tablet_return.test.js`: **7/7 PASS**. Resultado consolidado: **33/33 suites existentes aprobadas**. El resumen integral original conserva el fallo inicial como evidencia; la repetición está en `tests/output/observaciones-20261021/revisor/mobile-final.log` y `mobile-validation.json`; las capturas están en `tests/output/mejora-integral-2026-10-01/fase2/movil/`.

El único SKIP es `side_full_flow.cjs`, runner opcional declarado que no existe en el repositorio. No se creó una prueba trivial para ocultarlo. La cobertura funcional de registro, decisiones, cierre, reinicio y tres ciclos está aportada por SIM-1/2/3, `game_lifecycle_ui.cjs`, `decisions_cycle_ui.cjs` y `world_cycle_restart.cjs`, todos aprobados. El benchmark de FPS se excluyó expresamente mediante `--no-fps`; no hubo cambios de avatares ni de motor 3D.

SQL y navegadores usan bases efímeras o fixtures aislados. La validación de RLS, heartbeat y Realtime del proyecto Supabase desplegado exige ejecutar las migraciones indicadas en el informe principal y una comprobación posterior con cuentas reales.

## Continuación

Revisión completa. El coordinador conserva responsabilidad de commits ordenados, limpieza de capturas históricas con conservación de evidencia y push a main. No se agotó el límite de uso.
