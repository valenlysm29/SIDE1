# QA A8 final — integración Excel (2026-10-11)

Skill utilizada: `.agents/skills/webapp-testing/SKILL.md`. Chrome real con Playwright, modo local, registro normal y todas las peticiones de red bloqueadas. No se utilizaron datos de producción.

| Simulación | Empresas | Ciclos | Cifras SIDE vs Excel COM | Diferencias | Errores de página |
| --- | ---: | ---: | ---: | ---: | ---: |
| SIM-1 | 4 | 1 | 468 | 0 | 0 |
| SIM-2 | 2 | 3 | 504 | 0 | 0 |
| SIM-3 | 5 (una eliminada) | 3 | 1008 | 0 | 0 |

Las 1980 comparaciones incluyen los 33 campos del adaptador financiero por empresa/ciclo activo. SIM-1 también verifica 351 componentes del Excel original. Las ejecuciones finales se repitieron desde cero después de las correcciones A6/A9 y la ampliación del oráculo A7.

Las tres simulaciones verifican registro, controles de decisiones, cierre docente real, entrada exacta del importe de préstamo/reputación literal, cantidades y precios de cada lote, personal por nivel/área, compras, igualdad de estados financieros entre cierre docente y estudiante, `cashBalance()`, HUD y resumen. Confirman ausencia de nuevos descuentos del ledger al enviar y al actualizar el HUD, y conservación de la animación ante cambios reales de caja. La comparación financiera usa el mismo contrato JSON persistido porque JSON normaliza -0 a 0; no se relajan importes.

Se detectó y corrigió en A6 un recorte móvil: los paneles tenían 523.21875 px dentro de un viewport de 390 px y un ancestro ocultaba el desborde. En las tres ejecuciones finales los paneles miden 355 px y terminan en x=365; el documento mide 390 px. Se inspeccionó visualmente la captura móvil final: las cuatro métricas y los párrafos se muestran completos; las tablas mantienen su desplazamiento horizontal propio.

Prueba adicional `tests/transicion_excel_browser.cjs`: registro real y preparación de una máquina legacy ya pagada (3500), préstamo anterior (5000) e inventario explícito (12). La UI bloquea activar el modelo durante el ciclo con movimientos confirmados; permite activarlo en el siguiente. Conserva caja 1001500, máquina, deuda, stock y ledger sin descontar otra vez. PASS, cero errores de página; evidencia `transicion-browser.json` y `.png`.

El doble de `node:assert/strict` del ejecutor de componentes usa Object.is para equal y lanza en ok falsos; un require inesperado lanza. No se suprimen errores de página. El sincronizador exige `tickStudentGame` real en cada página de estudiante y no lo ejecuta en el docente. Fixtures de producción/costos/SIM-1 usan `fixtures_excel.cjs` y `celdas_excel.json`; escenarios de consecuencias conservan entradas independientes de sus hojas Oracle.

Evidencia: `reports/sim/sim_excel_1.log`, `_2.log`, `_3.log`, JSON de paridad y cierres, capturas por ciclo y móvil, geometría de paneles, y `transicion_browser.log`. `node --check` limpio para ambos ejecutores modificados.

Este informe certifica las simulaciones y la transición indicadas. La regresión completa y autorización de publicación se determinan por el informe general del coordinador.
