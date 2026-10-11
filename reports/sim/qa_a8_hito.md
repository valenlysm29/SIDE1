# Hito QA A8 — integración Excel (2026-10-11)

Se empleó `.agents/skills/webapp-testing/SKILL.md`. Navegador Chrome real, Playwright, modo local y todas las peticiones de red bloqueadas; no se utilizaron datos de producción.

Corrida actual: SIM-1 obtuvo 336 salidas del cierre real contra Excel, SIM-2 306 y SIM-3 612: todas con 0 diferencias. SIM-1 también verificó 351 componentes base. El oráculo todavía necesita cubrir los campos financieros adicionales del adaptador de caja; no se declara paridad completa de caja.

Las tres recorridas verificaron registro normal, controles de decisiones, cierre docente, préstamo y reputación literal exactos, cantidades de todos los lotes, personal y compras, reportes financieros idénticos entre docente/estudiante, `cashBalance()`, HUD y resumen, ausencia de nuevos descuentos del ledger al confirmar y actualización del HUD, y animación de caja ante un cambio real. El transporte JSON normaliza -0 a 0; el comparador financiero usa el mismo contrato persistido sin relajar importes.

La nueva comprobación móvil encontró un fallo: en SIM-3 ambos paneles `.excel-resultados` tienen ancho 523.21875 px y borde derecho 533.21875 px dentro de un viewport de 390 px. El documento no desborda porque un ancestro recorta el contenido. El fallo ya se remitió a A6. SIM-1 y SIM-2 anteriores pasaron el control de desborde del documento; deben repetirse con esta comprobación más estricta de cada panel.

El doble de `node:assert/strict` del ejecutor de componentes usa Object.is para equal y lanza en ok falsos; un require inesperado lanza. No se suprimen errores de página. El sincronizador exige `tickStudentGame` real en cada página de estudiante y no lo ejecuta en el docente. Fixtures de producción/costos/SIM-1 usan `fixtures_excel.cjs` y `celdas_excel.json`; escenarios de consecuencias conservan las entradas independientes de sus hojas Oracle.

Pendiente: correcciones A9/A6, reparación móvil, extensión del oráculo de caja y nueva ejecución completa de las tres simulaciones desde cero. No publicar hasta completar esos pasos y la regresión final.
