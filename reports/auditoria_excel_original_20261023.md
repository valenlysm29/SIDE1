# Auditoría reproducible del Excel original — 23/10/2026

Fuente intacta: `.codex-work\DECISIONES_SIDE_16.xlsx`. SHA-256 antes/después: `3b6b42bbbc56a2534ce7e241c607d572dd38dcf02311683609497df36a0c1eb1`. Skill xlsx aplicada; dos cargas independientes openpyxl. No se ejecutó COM ni se guardó el libro.

Se inventariaron 3047 celdas no vacías, 871 fórmulas y 215 familias estructurales. Todas las fórmulas/cachés y pertenencias a familias están en el JSON acompañante. Errores en caché original: 0.

Comparaciones nuevas contra SIDE: 727; diferencias: 6. Incluyen productividades, consumos, conversiones, precios, todos los componentes laborales de ambos regímenes, todos los activos de ambos regímenes, parámetros de los tres mercados y catálogo completo. Son comparaciones con caché original, no prueba de recálculo ni cobertura integral de transiciones de caja.

## Cobertura por hoja

| Hoja | Fórmulas | Literales numéricos | Textos |
|---|---:|---:|---:|
| Instrucciones | 0 | 0 | 9 |
| DECISIONES | 0 | 0 | 6 |
| Seleccion_Ciclo0 | 98 | 6 | 30 |
| Catalogo_Decisiones | 11 | 317 | 465 |
| FlujoWeb | 0 | 24 | 51 |
| CANTIDAD DE PRODUCCIÓN | 225 | 152 | 265 |
| Costos De Producción | 503 | 211 | 557 |
| Lotes_Produccion | 17 | 3 | 17 |
| Motor_Puntajes | 17 | 0 | 18 |
| Matriz_Consecuencias | 0 | 0 | 45 |

## Diferencias observadas contra SIDE

- corte1 NO_MYPE pagoMensual: `Costos De Producción!V11` original `1856.538462`, SIDE `1856.5384615384614`; fuente `js/engine/costos.js costoLaboral`.
- corte2 NO_MYPE pagoMensual: `Costos De Producción!V20` original `2475.384615`, SIDE `2475.3846153846152`; fuente `js/engine/costos.js costoLaboral`.
- ensamble1 NO_MYPE pagoMensual: `Costos De Producción!Z11` original `1856.538462`, SIDE `1856.5384615384614`; fuente `js/engine/costos.js costoLaboral`.
- ensamble2 NO_MYPE pagoMensual: `Costos De Producción!Z20` original `3365.538462`, SIDE `3365.5384615384614`; fuente `js/engine/costos.js costoLaboral`.
- acabado1 NO_MYPE pagoMensual: `Costos De Producción!AD11` original `1856.538462`, SIDE `1856.5384615384614`; fuente `js/engine/costos.js costoLaboral`.
- acabado2 NO_MYPE pagoMensual: `Costos De Producción!AD20` original `3365.538462`, SIDE `3365.5384615384614`; fuente `js/engine/costos.js costoLaboral`.

## Consecuencias: fórmula versus texto

Ninguna celda de Matriz_Consecuencias es una fórmula. Los efectos numéricos son reglas escritas en texto.

- **CONS-01** (numeric_text_rule): C2 `< 4 y Segmento = Premium`; D2 `Precio de venta -35%, Reputacion -2`.
- **CONS-02** (numeric_text_rule): C3 `>= 7 y Segmento = Premium`; D3 `Precio de venta +40%, Reputacion +2`.
- **CONS-03** (numeric_text_rule): C4 `< 4`; D4 `Produccion real = 70% de lo planeado (retrasos)`.
- **CONS-04** (numeric_text_rule): C5 `< 3 durante 2 ciclos seguidos`; D5 `Demanda -20%`.
- **CONS-05** (qualitative_text_rule): C6 `< 3`; D6 `El banco sube la tasa de interes del proximo prestamo`.
- **CONS-06** (qualitative_text_rule): C7 `Cantidad producida > capacidad instalada`; D7 `Retraso de entrega, costo extra por horas extra`.
- **CONS-07** (qualitative_text_rule): C8 `Cantidad producida > demanda real del mercado`; D8 `Inventario sin vender, costo de almacenaje`.
- **CONS-08** (numeric_text_rule): C9 `Jefatura = No y Eficiencia < 5`; D9 `Riesgo de descoordinacion: -5% produccion adicional`.

CONS-03 usa lo **planeado**, no la capacidad ni la producción ya limitada. CONS-06 evalúa **cantidad producida** mayor que capacidad; cambiarlo por cantidad deseada cambia el disparador textual. No especifica tarifa de horas extra. No hay redondeo en esas reglas textuales.

## Ambigüedades y contradicciones originales

- **capacity_sheets** (contradiction): 24 versus 30 days; cutting 5/7/9 versus 6/8/12; finishing 6/7/10 versus 6/8/12. Celdas: `CANTIDAD DE PRODUCCIÓN!L5`, `Costos De Producción!L5`, `CANTIDAD DE PRODUCCIÓN!E5:E7`, `Costos De Producción!E5:E7`, `CANTIDAD DE PRODUCCIÓN!E17:E19`, `Costos De Producción!E17:E19`.
- **market_model1_medium_reference** (contradiction): Medium segment model1 references economic market B91, not its B105. Both original caches equal 3500; baseline equality hides dependency error. Celdas: `CANTIDAD DE PRODUCCIÓN!H97:H100`, `CANTIDAD DE PRODUCCIÓN!B91`, `CANTIDAD DE PRODUCCIÓN!B105`.
- **market_model2_quality_reference** (contradiction): Medium and premium model2 quality percentages divide by economic reputation total D132, not their own totals. Default company reputations are equal across examples, hiding dependency difference. Celdas: `CANTIDAD DE PRODUCCIÓN!E141:E144`, `CANTIDAD DE PRODUCCIÓN!E154:E157`, `CANTIDAD DE PRODUCCIÓN!D132`, `CANTIDAD DE PRODUCCIÓN!D145`, `CANTIDAD DE PRODUCCIÓN!D158`.
- **zero_quantity** (formula_domain_error): Zero total quantity causes division by zero; literal original contains no guard. Celdas: `CANTIDAD DE PRODUCCIÓN!E37:E39`.
- **allocation_overplan** (formula_behavior): Capacity allocation can exceed an individual desired plan; later MIN limits actual output. ROUNDDOWN allocations may leave capacity unallocated. Celdas: `CANTIDAD DE PRODUCCIÓN!E37:E39`, `CANTIDAD DE PRODUCCIÓN!D56:E58`.
- **thread_purchase_cost** (contradiction): 6 reels convert to 1500 m but purchase example AB82 values only 6 m; inventory values 1500 m. Celdas: `Costos De Producción!J31:J33`, `Costos De Producción!AB82:AD82`, `Costos De Producción!V93`.

## Reglas que el original no determina

- **inverse_staff_machines_time**: No inverse planner/optimization/rounding recipe from quantity to staff, machines or lead time.
- **overtime_tariff**: CONS-06 describes overtime but supplies no amount or percentage.
- **storage_tariff**: CONS-07 describes storage but supplies no monetary rate.
- **additional_bank_rate**: CONS-05 increases next loan rate without number of percentage points.
- **inventory_physical_merma**: No universal material-waste percentage; explicit BOM and efficiency/capacity equations must remain distinct.
- **full_cash_transition**: Original has no complete per-cycle cash ledger integrating loans, sales collection schedules, salaries, acquisitions and inventory; game transition needs declared extensions.
- **depreciation_units_lifetime**: Catalog names units-of-production method but no lifetime output of 100000 units is defined.
- **market_tie_guard**: Economic price min=max division is unguarded; game tie fallback is an extension.
- **negative_price_score_guard**: Price-ideal formula can be negative; original has no clamp in that cell.

Las seis diferencias pequeñas de nómina NO_MYPE (si siguen presentes) reflejan cachés originales guardadas a seis decimales. Las fórmulas no contienen ROUND: no se debe redondear SIDE para copiar una caché truncada. El recálculo COM debe resolverlas.

## Reproducción y límites

Ejecutar `tests/audit_excel_original_20261023.py` con Python que tenga openpyxl, desde SIDE1. Usa Node para leer configuración y ejecutar costoLaboral/costoMaquinaria actuales. JSON siempre UTF-8 explícito. El proceso verifica hash antes/después y no modifica el Excel.

La cobertura de familias es un inventario exhaustivo, no una ejecución independiente de cada fórmula. Las diferencias de fórmulas entre hojas y las reglas ausentes requieren criterio explícito del integrador; no se corrige el original silenciosamente. El oráculo fresco COM y las simulaciones quedan a cargo del proceso de integración para mantener un único motor Excel activo.
