# Mejora del flujo de producción de SIDE — avance y límites

Fecha: 31 de octubre de 2026. Base: `258c74a`.

## Implementación

El DOP muestra las tres metas, producción factible estimada, capacidad instalada por etapa y cuello de botella. La referencia N1 + equipo básico se identifica como escenario orientativo. La capacidad real y la producción factible proceden de `calculate()`: por etapa `round(días × eficiencia × factor × suma(productividad × multiplicador del equipo))`; la capacidad de línea es el mínimo. El modelo respeta las asignaciones y una pareja por máquina, disponibilidad de moldes, materiales y recepciones. El cierre oficial no se modificó.

La alternativa técnica evalúa los niveles N1/N2/N3 y tipos de equipo de cada etapa, usando el cálculo oficial y costos incrementales de nómina y activos del catálogo. Conserva recursos existentes, estima la capacidad resultante y compara el costo con la caja. Es una búsqueda limitada: agrega una sola clase de trabajador y/o equipo por etapa y elige sucesivamente; no explora todas las mezclas ni garantiza el óptimo global. La caja no descuenta todas las decisiones en borrador ni las obligaciones futuras. La alternativa es informativa y no crea decisiones.

Se muestran alternativas de hilo por tipo, con carretes enteros, metros adquiridos y sobrante para cubrir la meta: `ceil(max(0, necesario − disponible) / metros por carrete)`. Se respetan las sustituciones por familia del motor actual; no se asigna un tipo de hilo a cada molde. Se descuentan inventario y recepciones contabilizadas. Las recepciones tardías pueden restringir la producción diaria. No se optimizan costos ni mezclas de carretes y la modalidad heredada compra hilo en metros; esta conversión es orientativa y no modifica la unidad de compra ni los inventarios. Por tanto no está terminada la compra por carretes solicitada.

## Ejemplo de 3.000 básicos

Con los recursos del fixture `economic_v19_fixture` y 10.000 m disponibles: meta 3.000, capacidad instalada 1.526 y producción factible 833 (materiales limitantes). La alternativa técnica calcula capacidad 3.024 y costo incremental S/ 53.372,64: 4 maestros y mesas de corte, 2 especializados y máquinas básicas de ensamblado, 3 operarios básicos y máquinas básicas de acabado. Es un escenario particular y no un óptimo demostrado. Se requieren 18.000 m; el faltante de 8.000 m equivale a 30 carretes estándar (8.100 m, sobran 100), 32 reforzados (8.000 m) o 40 premium (8.000 m). No se ha calculado la mezcla más barata.

## Venta de S/ 31.500

La expectativa S/ 22.500 era obsoleta: se producen y venden 90 unidades premium sin duplicación; el precio base de S/ 250 recibe el factor 1,4 por calidad premium y consecuencia CONS-02, dando S/ 350 y 90 × 350 = S/ 31.500. `tests/consecuencias_cierre_real.test.cjs` y `tests/authoritative_worker.test.cjs` confirman la regla. La prueba heredada ahora comprueba precio base, precio efectivo y consecuencia. No se modificó el motor financiero.

## Validación y pendientes

- 51 pruebas focalizadas aprobadas: producción, DOP, metas 0/100/500/1.000/3.000/5.000/10.000, carretes, recepciones, ventas y consecuencias.
- Cinco pruebas de continuidad y cierre aprobadas, incluido un escenario consecutivo de seis ciclos con crédito, recepciones e inventario.
- `tests/production_dop.test.js` contiene dos expectativas de porcentajes ausentes ya en el DOP base; no se han resuelto ni validado todos los recorridos de interfaz. No se completó la matriz para cada combinación de recursos, ni la conciliación integral de estudiante, docente y laboratorio.
- La búsqueda económica y la recomendación de hilo siguen siendo limitadas, y no se han verificado todas las modalidades. Por ello no se autoriza publicación en main bajo las condiciones del encargo.
- `git fetch origin` obtuvo referencias, pero terminó con error al actualizar `origin/develop`; `origin/main` coincidía con la base local en la comprobación efectuada. No se realizó push.

## Archivos

`js/app.js`, `js/production_model.js`, `js/production_dop.js`, `tests/production_dop_target_ui.test.js`, `tests/production_recommendations.test.cjs`, `tests/legacy_production_targets.test.cjs` y este informe. Los otros informes no rastreados preexistentes se conservaron fuera del commit.
