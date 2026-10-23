# Costos al iniciar el ciclo y calculadora por molde

La calculadora de Producción ocupa un único panel rectangular. El desplegable cambia el molde visible; cada molde conserva su cantidad. El total y el DOP consolidan esas cantidades desde el mismo `productionPlan()`. Comparar un molde no lo compra. Cantidades negativas quedan en cero inmediatamente.

Al iniciar un ciclo activo del flujo de decisiones habitual, `ensureCycleFixedCosts()` registra los costos obligatorios y de continuidad que ya define el modelo: local, limpieza y, cuando existen elecciones guardadas del ciclo anterior, personal o canales con costo recurrente. Reutiliza `SIDE_REVIEW_MODEL` y `prepareSectionSave()`, sin añadir fórmulas ni decisiones. No inventa amortizaciones de préstamos ni repite marketing, capacitación, compras de activos o insumos.

Antes, el HUD restaba una proyección de costos y borradores aunque el libro de caja aún no tuviera ese movimiento; el guardado de sección lo registraba después. Ahora el descuento fijo se registra al iniciar, el HUD habitual muestra la caja registrada y la ventana explica ese mismo movimiento. Un borrador opcional no altera la caja guardada. La proyección de decisiones sigue disponible en su resumen.

Los movimientos usan las mismas claves por ciclo y categoría que guardar/enviar. Un guardado posterior sustituye el total de su sección, sin sumar otra vez el costo fijo. Una categoría que ya tiene un movimiento en el ciclo no recibe un cobro retroactivo deducido de un neto mixto. Las partidas por lotes que ya existían conservan su cierre propio; esta entrega no vuelve a habilitar su bloque opcional ni cambia sus fórmulas.

El recibo queda en `decision_state.__cycleCosts[ciclo]`, con filas, total, caja antes/después y reconocimiento. «Entendido», Escape o cerrar el modal marcan el aviso como reconocido. La copia local usa sala, empresa e identidad; la sincronización utiliza el snapshot y la cola existentes. Reingresar con un snapshot sincronizado conserva ese reconocimiento. Una sesión sin conexión guarda localmente y sincroniza cuando recupera conexión; no se promete reconocimiento instantáneo entre dispositivos desconectados.

Integración y pausa no registran costos nuevos. El aviso no pausa el reloj; si cambia el ciclo mientras sigue abierto, muestra el recibo del nuevo ciclo sin reconocer falsamente el anterior. Sin descuentos nuevos no hay ventana. Otros diálogos de acceso o recuperación conservan prioridad.

## Supabase

**Esta mejora no requiere SQL nuevo ni cambios de esquema.** El recibo y su reconocimiento usan el campo JSON `decision_state` que ya admite el snapshot. No se ejecutó SQL ni se hicieron escrituras sobre partidas o cuentas reales de Supabase durante las pruebas.

## Verificación

El informe independiente está en `reports/verificacion_costos_calculadora_2026-10-22.md`. Los logs y las capturas locales están en `tests/output/costos-calculadora-20261022/`. La batería Node incluye comprobaciones nuevas que comparan el aviso con el débito real del libro, no con una segunda fórmula de costos.
