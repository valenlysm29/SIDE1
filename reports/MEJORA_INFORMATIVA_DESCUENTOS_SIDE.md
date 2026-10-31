# Mejora informativa de descuentos SIDE

## Recuperación

El espacio `.codex-work/logia_prueba_mejora` permaneció bloqueado como `initializing`, con archivos faltantes y cambios sin seguimiento. Se conservó intacto. Un primer clon compartido falló al extraer archivos con `fatal: mmap failed: Invalid argument`; también se conservó. Se creó una copia independiente de GitHub en `.codex-work/descuentos-remoto`, sobre el commit remoto `efe148351162d90838cc0fc9047736dbe1089f15`, con los archivos necesarios para la implementación y pruebas.

## Mensajes y cálculos

En Logística, «Beneficio del analista de compras» está disponible antes de confirmar y se despliega al seleccionarlo. Indica su costo por ciclo, la tasa del ciclo y la evolución obtenidas de la configuración y el motor; explica que el ahorro depende de la compra y que el costo del analista se cobra por separado.

Para cada opción con cantidad positiva se presenta precio unitario, cantidad, subtotal bruto, descuento comercial o motivo de su ausencia, descuento del analista cuando está contratado, ahorro total y costo final. El descuento comercial depende del umbral y tasa configurados para la opción; el analista se aplica posteriormente, sobre el importe ya descontado. El desglose obtiene los importes a partir de la misma función de precio usada por el modelo de decisiones; no se suman porcentajes. Los importes son una estimación de la decisión actual hasta que se confirme la compra. En salas con recepciones, el cargo efectivo depende además de las recepciones y condiciones correspondientes.

Ejemplo con configuración predeterminada: 12.000 metros de hilo estándar sin analista tienen subtotal S/ 24.000, descuento comercial S/ 1.920 y total S/ 22.080. Con analista en ciclo 1, el ahorro adicional es S/ 2.649,60 y el costo de materiales S/ 19.430,40; la contratación se cobra aparte.

## Validación

- `node --test tests/descuentos_informativos.test.cjs tests/costos_runtime_v19.test.cjs tests/business_cycle.test.cjs`: pruebas de tasas por ciclo, umbral configurable, cantidades, sin/con analista, persistencia del estado, conciliación del cierre y no duplicación.
- `node --test tests/independent_cycle_costs_20261022.test.cjs tests/costos_excel.test.cjs tests/ui_excel.test.cjs`: regresiones de costos, cierres y motor.
- `node tests/descuentos_informativos_browser.cjs`: navegador de escritorio y móvil, selección, actualización de cantidad, recarga real del borrador y comparación con costo de decisión. Capturas locales en `tests/output/descuentos-informativos/`.
- `tests/clean_decisions_20261023_browser.cjs` falla en una aserción existente que exige que 700 metros cuesten menos de S/ 1.000. La propia prueba vigente `business_cycle.test.cjs` y el motor establecen S/ 1.288 para 700 metros sin analista. No se alteraron precios ni esa prueba histórica.
- La prueba de navegador usa un fixture local; no valida una compra contra Supabase desplegado ni recepciones reales.
