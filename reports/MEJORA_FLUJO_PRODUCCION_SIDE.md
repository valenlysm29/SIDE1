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

## Continuación: capacidad, materiales y porcentaje

El DOP ahora compara la capacidad de la alternativa con `producibleUnits` recalculado mediante el motor y con los materiales y moldes existentes: en el ejemplo, la capacidad de 3.024 no significa que ya se puedan producir 3.000; la estimación sigue en 833. Enumera los faltantes de material. Las compras sugeridas siguen sin simularse como recibidas.

La búsqueda de hilo compara mezclas enteras hasta 30.000 combinaciones; para más combinaciones compara alternativas de un tipo. Usa los costos y descuentos del modelo según la modalidad de unidades físicas o presentaciones. No explora toda sobrecompra potencial que podría activar descuentos, ni optimiza conjuntamente insumos, recursos y presupuesto; no se afirma optimalidad. Para el ejemplo de 8.000 m faltantes, prueba 30 carretes estándar, 8.100 m, S/ 14.904 adicionales en la modalidad heredada y 100 m sobrantes. El consumo y almacenamiento no cambian. Las recepciones futuras y la caja conjunta deben resolverse antes de afirmar viabilidad.

Las dos pruebas de porcentaje revelaban una omisión: el adaptador Excel suministra `producedPercent`, pero el DOP lo ignoraba. Se muestra ahora únicamente si se suministra y como porcentaje factible estimado. Las dos pruebas pasan sin cambiar sus expectativas.

El servidor informa `origin/main` en `258c74a92b6b1f87eab73b49eed3cc3a0233e38a`; la referencia remota de `develop` es `00bdec4`, mientras la referencia local anterior es `cb5b209`. El fetch general notificó que la referencia ya existía; no se eliminó ni sobrescribió. La consulta directa y el fetch específico de main funcionaron.

Siguen pendientes el óptimo global comprobado, la recomendación conjunta de todos los materiales con presupuesto y una validación integral de las vistas durante seis ciclos. Por esos motivos la rama se respalda, pero no se integra a main.

## Continuación: escenario conjunto y búsqueda por orden de etapas

La búsqueda de recursos compara seis órdenes de etapas y elige el candidato de menor costo encontrado. Sigue limitada a agregar un tipo de trabajador y/o equipo por etapa; no enumera todas las mezclas ni prueba el óptimo. El cálculo usa `calculate()` para evaluar capacidades y eficiencia, con una pareja por equipo. Para los materiales se consideran cuero, accesorios e hilo, descuentos y versiones de compra. Para cuero y accesorios se prueban alternativas de un solo tipo; para hilo se conserva la búsqueda acotada de carretes. Se presentan costos de recursos y materiales, comparación orientativa con caja, y producción recalculada con el motor si las compras son instantáneas. El escenario no modifica decisiones. Para el libro temporal no se simulan recepciones inexistentes y no se afirma la producción futura.

Con el fixture de 3.000 básicos: capacidad inicial 1.526, producción inicial 833, alternativa encontrada de recursos S/ 53.372,64 y capacidad 3.024. Faltan 650 m² de cuero (alternativa S/ 14.950), 2.000 accesorios (S/ 7.360) y 8.000 m de hilo (30 carretes estándar, S/ 14.904, sobran 100 m). Total incremental estimado S/ 90.586,64; bajo la modalidad instantánea y con esos recursos y materiales disponibles, `calculate()` estima 3.000 unidades. No se encontró una alternativa más barata en esta búsqueda limitada; no se ha demostrado que no exista. La caja mostrada no descuenta todos los compromisos futuros ni todo borrador pendiente.

Persisten la falta de un óptimo global comprobado, la búsqueda conjunta con presupuesto insuficiente y recepciones, y la conciliación integral de las vistas en modalidades de tres y seis ciclos. La solución no debe publicarse en main como finalizada hasta completar estas verificaciones.

Pruebas de esta continuación: 62 focalizadas aprobadas; 23 aprobadas en tres y seis ciclos, cierre, docente y laboratorio; 14 aprobadas de decisiones y calculadora. Se corrigió el mensaje vacío del DOP detectado en esta última suite y se repitió con éxito. Estas pruebas no constituyen la conciliación integral de todas las vistas. La búsqueda por seis órdenes tarda aproximadamente 0,2–0,35 segundos en los casos de 3.000–10.000 del fixture; se requiere una validación adicional de rendimiento en navegador y escenarios mayores.
