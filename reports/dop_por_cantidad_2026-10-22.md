# DOP por cantidad deseada — 22/10/2026

## Alcance y punto de partida

Base: `7cb8e98`. Repositorio inicialmente limpio. Se conserva el menú de decisiones y no se modifican avatares ni mundo 3D. No se ejecuta SQL en producción.

Fuente de verdad: copia íntegra del archivo proporcionado, `.codex-work/DECISIONES_SIDE_16.xlsx`, SHA-256 `3b6b42bbbc56a2534ce7e241c607d572dd38dcf02311683609497df36a0c1eb1`. Se leen fórmulas y valores en dos pasadas y el original no se sobrescribe. Los recálculos se realizarán sobre copias dentro de SIDE1.

## Antes

El objetivo ya multiplicaba coeficientes por molde para ciertos insumos, pero los nodos principales del DOP usaban `producibleUnits`, limitado por existencias y capacidad. Las materias primas del diagrama mostraban disponibilidad en lugar de necesidad; la antigua recomendación repartía la capacidad instalada entre moldes. Así, una meta positiva con almacén vacío podía mostrar un proceso de cero unidades.

## Contrato solicitado

1. La cantidad deseada y el molde definen los requisitos, sin leer existencias.
2. El DOP muestra primero esos requisitos de la meta.
3. Después se comparan necesidades y recursos disponibles, con faltantes, sobrantes y costos que el Excel permita determinar.
4. La producción ejecutable del motor puede seguir limitada por recursos; no se confunde con la meta ni se utiliza para construir sus necesidades.
5. Una comparación o estimación no compra recursos ni descuenta caja automáticamente.

## Criterios de Excel detectados

Las hojas de cantidad y costos tienen reglas de capacidad distintas. Cada resultado conservará su hoja y celda de procedencia; no se forzará una igualdad inexistente entre ellas. El libro no define una dotación inversa única de trabajadores y máquinas para cualquier meta, ni un redondeo de contratación mínimo. Esas ausencias se indicarán explícitamente y no se reemplazarán por fórmulas inventadas.

## Fórmulas y casos

La trazabilidad completa está en `reports/dop_excel_fuentes_2026-10-22.md` y los 14 casos en `reports/dop_excel_casos_2026-10-22.json`.

| Molde | Cantidad | Cuero m² | Accesorios | Hilo m | Celdas calculadas |
|---|---|---|---|---|---|
| Básico | D37 | D37 × D31 (0,3) | D37 × G31 (1) | D37 × J31 (6) | D42 / G42 / J42 |
| Mejorado | D38 | D38 × E32 (0,4) | D38 × H32 (1) | D38 × K32 (7) | E43 / H43 / K43 |
| Premium | D39 | D39 × F33 (0,7) | D39 × I33 (1) | D39 × L33 (13) | F44 / I44 / L44 |

Total deseado: D36 = SUM(D37:D39). Se prueban cero, una unidad, mezclas, capacidad del ejemplo, exceso de capacidad y cantidades grandes; el libro no define un máximo global. No se añade redondeo de paquetes ni una contratación mínima. La normalización a unidades enteras del control de producción ya existía; la precisión de 15 cifras coincide con la utilizada por el motor para evitar pérdida de unidades por aritmética binaria.

Los costos teóricos de material usan `Costos De Producción!V76:W83`: requerimiento físico × precio por unidad × (1 − 8%). Cada faltante ofrece esos escenarios por calidad. No se selecciona una calidad por el stock comprado y no se inventa un costo total cuando faltan decisiones de dotación. Las presentaciones de compra se convierten mediante D32:K33 para cobrar compras reales. El analista conserva el descuento parametrizado del juego.

## Cambios integrados

- `js/production_model.js`: contrato puro `requirementsFor()`, necesidades independientes de stock y comparación posterior. La producción posible sigue siendo una comparación operativa, no una recomendación de meta.
- `js/production_dop.js`, `js/app.js`, `css/production.css`: cantidad como primer control, selector de molde, actualización en vivo, necesidades y costos antes de existencias; faltantes/sobrantes al final. Se conservan las pestañas y el menú.
- `js/engine/costos.js`, `js/decision_review_model.js`: precios de compra, nómina MYPE y adquisición con instalación/capacitación reutilizados entre pantalla y cargo real. HUD conserva centavos; editar una meta no compra recursos ni mueve el ledger.
- Se preservan el aviso de costos iniciales, su confirmación por ciclo y el guardado del estudiante. El costo inicial con local y limpieza es ahora S/ 2712,32 según la fórmula MYPE, no S/ 2600 de los sueldos base.
- `index.html`: claves de caché actualizadas a `20261022-dop-cantidad` para los recursos modificados.

## Auditoría completa y límites encontrados

Ver `reports/auditoria_motor_dop_2026-10-22.md`: diez hojas, 871 celdas de fórmula, costos, unidades, consumo, capacidad, tiempos, consecuencias, ventas y caja. Se corrigieron nómina, conversión de presentaciones de compra, descuento general y costos de instalación/capacitación del editor histórico. Las discrepancias se documentan con función, celdas, valor anterior y valor corregido.

El Excel tiene contradicciones: sus hojas de cantidad y costos usan productividad/días y dotaciones distintas (capacidad de ejemplo 396 frente a 382); precios por unidad productiva frente a algunos ejemplos incrustados incompatibles; sueldos de corte distintos entre catálogo y costos. Para nómina se usa la fórmula completa de Costos, sin reemplazarla por normativa externa. Los ejemplos no se reescriben para obtener una falsa igualdad.

Al recalcular una copia intacta del original aparecen siete errores: cuatro `#DIV/0!` en CANTIDAD E75/G75/E123/G123 y tres `#NAME?` en Lotes J2:J4. La caché original no mostraba esos errores. Las variantes cero además dividen por cero en E37:E39; el juego protege la meta cero, sin atribuir esa protección al Excel. La compatibilidad `_xlfn.IFS` del oráculo histórico se aplica solo a sus copias.

No se afirma paridad de todas las reglas de la UI histórica con el libro: emparejamiento de trabajadores/máquinas, tope histórico de eficiencia, contabilidad simplificada, mantenimiento mensual, depreciación, liquidación, indemnización y crédito tienen diferencias o extensiones explícitas en el informe de auditoría. Las reglas no definidas por el Excel no se sustituyen por valores inventados.

## Pendientes de criterio del modelo

1. Elegir qué hoja manda para capacidad y definir una asignación inversa/criterio de optimización para recomendar dotación, maquinaria y horas desde una meta. El libro recibe esas entradas; no permite deducir una única combinación.
2. Resolver las contradicciones de unidades y ejemplos de materia prima y confirmar los sueldos base de corte. Se aplicó la tabla de unidades y el cálculo completo de Costos de manera explícita.
3. Definir la integración del mantenimiento mensual/depreciación con el flujo histórico y qué activos devengan cargos durante el ciclo, sin duplicar su control preventivo. Los préstamos tampoco tienen cuotas definidas en el libro.
4. Los valores históricos pendientes de consecuencias y costos de tiendas siguen identificados como configuración del juego, no como fórmulas de Excel.

Estas limitaciones no alteran los requerimientos físicos por cantidad, que sí tienen fórmula directa y se verifican contra el libro real.

## Supabase

**No hay SQL pendiente ni se debe actualizar Supabase para este cambio.** Se conservan el esquema y el contrato de snapshot; la cantidad usa el campo existente `PRODUCCION_META.moldTargets`. No se ejecutó SQL en producción.

## Verificación y punto de control

- Fuente original preservada y hash verificado antes/después del recálculo.
- 14 casos nuevos: recalculados con Microsoft Excel 16.0 en copias; comparación independiente en curso.
- Ocho escenarios históricos / 3104 salidas: recálculo independiente en curso.
- Pruebas dirigidas de modelo/DOP/UI: 20/20; costos/revisión: 27/27; aviso/caja: 8/8.
- Siguiente paso exacto: terminar navegador independiente, correr Node completo y SIM-1/2/3 secuencialmente, registrar resultados, publicar y comprobar GitHub Pages.
