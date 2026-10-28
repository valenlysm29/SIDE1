# Cierre económico sin navegador docente

Implementado: ejecutor Node de servidor, consulta docente de solo lectura, migración de permisos, impuesto final acumulado, historial de ventas por ciclo, valor pendiente distinto de cero y advertencias de recursos faltantes. El mundo 3D no interviene en el cierre económico.

Validación local:

- PostgreSQL PGlite: sala automática de dos ciclos, sin UID docente, con persistencia real mediante las funciones SQL. 90 unidades vendidas y S/22,500 de ingresos por ciclo; utilidad antes de impuestos S/9,897.91 por ciclo; impuesto S/0 en el primero y S/5,839.77 en el segundo. Balance cuadrado y resultado conservado al reconectar. Repetir el ejecutor no duplica cierres. Roles de navegador no pueden persistir resultados del mercado.
- 47 pruebas Node aprobadas: contabilidad, cierre remoto simulado, ciclos, impuesto, configuración, presentación e independencia del 3D.
- Chromium `business_worker_ui.py`: carga el snapshot de PostgreSQL en la interfaz real; muestra ambos ciclos, ventas e impuesto; el ciclo pendiente conserva el cierre anterior y no publica cero unidades vendidas. Sin errores de página.
- Chromium `sales_recovery_ui.py`: tres segmentos, cinco confirmaciones reales por escenario, estimaciones y resultados definitivos, controles existentes y recarga. Sin errores de página.
- `git diff --check` sin errores. El directorio padre contiene únicamente SIDE1; no se generaron artefactos fuera del proyecto.

Evidencias reproducibles: `tests/output/business-worker-two-cycles.json`, `business-worker-state.json`, `server-close-regression.log`, `business-worker-ui/` y `sales-recovery-ui/` (resultados locales ignorados por Git).

No se aplicó SQL en Supabase ni se inició un ejecutor remoto: no hay credenciales de servidor configuradas. El push no activa esta infraestructura. Seguir `docs/cierre_automatico_servidor.md` antes de usar la nueva versión en una sala remota. Los cierres históricos definitivos no se reescriben; el impuesto se registra como obligación por pagar, no como pago automático de caja.
