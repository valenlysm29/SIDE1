# Diagnóstico financiero y empresarial — 30 de octubre de 2026

## Alcance y reproducción

Trabajado en `codex/continuidad-empresarial`; `version-estable-1` y `codex/respaldo-continuidad-20261030` permanecen sin cambios. No hay despliegue. El ensayo usa PGlite, migraciones indicadas en el test y el worker Node. Crea decisiones y recepciones directamente en la base aislada; no demuestra el flujo real de formularios ni el servidor remoto.

Desde SIDE1:

```powershell
$env:SIDE_EVIDENCE_FILE='tests/output/continuidad_estados_20261030.json'
node --test tests/continuidad_seis_ciclos_activos.test.cjs
node tests/conciliar_estados_seis_ciclos.cjs
node tests/restaurar_decisiones_oraculo.cjs
```

Los tres estados por ciclo y su conciliación están en `reports/estados_financieros_seis_ciclos_20261030.md`. El JSON de evidencia incluye las decisiones, comprobantes, puntos de venta, lotes y estados completos. Los cálculos de conciliación verifican ecuaciones de los estados, ventas por punto, límites por demanda e inventario, ingresos por lote, materiales recibidos y consumidos, arrastre de efectivo, utilidades y obligaciones. La prueba incluye recepción parcial y su posterior entrega, crédito de proveedor, cuentas por cobrar, impuesto final, dos empresas y reintento. No toma préstamo bancario: deuda e intereses bancarios son cero en estos seis ciclos.

## Estado de la lógica

| Área | Evidencia y alcance | Pendiente |
|---|---|---|
| Compras, recepción y materiales | En `receipts-v1`, recepción parcial, consumo y arrastre concilian en seis ciclos; el pago del proveedor se registra una vez. | El modo heredado de compra instantánea sigue existiendo; no se validó la activación de recepciones ni los formularios de una partida real. |
| Producción y ventas | Para el escenario ensayado, cantidades producidas, vendidas, inventario y ventas por web se concilian con demanda y lotes. La segunda empresa conserva y vende inventario. | Falta una partida integral con varios canales, asignaciones manuales, más segmentos y decisiones reales del estudiante. |
| Estados y caja | Los seis estados concilian internamente; depreciación y costo de ventas se incluyen en sus importes correspondientes y no se descuentan una segunda vez de caja. | Conciliar no demuestra exactitud independiente de todos los costos, impuestos ni todas las decisiones. Falta prueba integral de múltiples configuraciones. |
| Préstamos | El cierre reconoce financiamiento y deuda y calcula interés devengado. | Este escenario no solicita préstamos; el modelo no define calendario de amortización ni pago de intereses y acumula intereses por pagar. No se puede afirmar que los pagos bancarios estén implementados. Deben validarse tasas de deudas sucesivas y su arrastre en el cierre efectivo. |
| Presentación | La vista compartida de alumno incluye anticipos, cuentas por pagar e impuesto pagado; el detalle docente incluye anticipos y proveedores. Los ciclos cerrados de `live_results` usan la instantánea financiera sellada. Se corrigió el precio efectivo de nuevas ventas para que coincida con el ingreso por unidad. | Revisar las demás rutas y reportes, incluido PDF y proyecciones de la aplicación, para asegurar siempre el origen del servidor. La corrección no reescribe cierres anteriores. |

## Relación con Excel

- **Casos equivalentes comprobados:** `tests/restaurar_decisiones_oraculo.cjs` comparó 3.104 salidas de escenarios guardados con resultados previamente recalculados en Excel, sin diferencias. Esa prueba usa el motor y escenarios del oráculo; no demuestra equivalencia del worker actual ni de las decisiones de la partida de seis ciclos con el libro original.
- **Adaptaciones:** el juego modela recepciones temporales, inventario y ventas por canal; el Excel fuente no define toda esa secuencia. El libro contiene hojas de producción con 24 y 30 días, y el escenario ensayado usa 30. La hoja Costos puede consumir materiales para cantidades deseadas aunque se fabrique menos; el juego usa consumo real. El reparto del juego usa restos mayores para conservar el mercado, mientras el Excel redondea las empresas individualmente.
- **Defectos detectados y corregidos aquí:** una vista recalculaba un cierre usando el libro mutable del cliente; el campo `effectivePrice` de una venta podía mostrar el precio base incluso cuando un lote premium se cobraba con recargo. Faltaban cuentas por pagar e impuesto pagado en la presentación compartida. Estos cambios se aplican a lecturas o cierres nuevos y no alteran datos ya cerrados.
- **Comparación pendiente:** ejecutar Excel original con las mismas decisiones de los seis ciclos y mapear, una a una, las fórmulas aplicables y las extensiones que el libro no cubre. No se presenta esa comparación como realizada.

La suite de 17 fallos históricos no se ha modificado ni desactivado. La lógica empresarial y financiera no se declara terminada.
