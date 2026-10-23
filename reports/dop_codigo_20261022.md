# Revisión del contrato de DOP en el editor Excel — 22/10/2026

Se revisaron `js/decision_catalog.js`, `js/production_model.js`, `js/engine/produccion.js` y `js/engine/ui_excel.js`. La ruta principal ya tenía un contrato de requisitos independiente del stock. El editor Excel aún entregaba el formato antiguo a `production_dop.js`: su fallback dejaba incompletos costos, faltantes y sobrantes. Además recomendaba `Math.ceil(faltante / conversión)` pese a que el libro no define ese redondeo.

Se corrige exclusivamente `js/engine/ui_excel.js`, sin alterar las fórmulas de ejecución del motor:

- `dopPlan` entrega `requirements` calculado con cantidad deseada × coeficiente del molde (`CANTIDAD DE PRODUCCIÓN!D37:D44`, G42:I44 y J42:L44), antes de consultar disponibilidad.
- Los escenarios teóricos de materiales aplican los precios `Costos De Producción!V76:W83`, incluido el 8 % literal. Un lote con calidad seleccionada puede valorar sus materiales; no se inventa costo global de personal/equipos.
- Personal, maquinaria y tiempo inversos se mantienen como datos no definidos para una meta positiva: el Excel recibe dotación como entrada, sin una única fórmula inversa.
- `comparison` suma inventario físico y compras convertidas del ciclo. Compara cada calidad elegida por separado: cuero premium sobrante no borra un faltante de sintético. Expone faltantes, sobrantes y costos teóricos de completar la calidad elegida.
- La equivalencia de compras muestra faltante / conversión (`Costos De Producción!D32:K33`) sin redondear a paquetes enteros. La división visible conserva su denominador para que los decimales de presentación no se confundan con una nueva regla de cálculo.

Se leyó la skill frontend-design local. Se conserva la estructura y los estilos del editor, sus pestañas y menú. No se modifican `app.js`, avatares, mundo 3D ni Supabase.

Validación: 12 pruebas dirigidas existentes de DOP, representación y confirmación pasan. Las cuatro regresiones nuevas de `tests/dop_excel_editor_quantity.test.cjs` comprueban independencia de stock/capacidad, separación de calidades, cantidad cero y ausencia de redondeo inventado. Junto con confirmación, 7/7 pruebas pasan. La verificación integral y las simulaciones corresponden a la integración del agente principal.

No se requiere SQL ni actualización de Supabase. Se conserva el guardado por cantidad del lote y no se agregan decisiones.
