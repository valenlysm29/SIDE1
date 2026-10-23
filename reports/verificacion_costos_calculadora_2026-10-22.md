# Verificación independiente — costos al iniciar ciclo y calculadora por molde

Fecha de tarea: 22/10/2026, America/Lima. Verificador F no escribió código de producto. Las pruebas usan los scripts entregados y un servidor HTTP local; no conectan ni ejecutan SQL en producción.

## Resultado

- **8/8 pruebas Node**, sin fallos.
- **153 comprobaciones de navegador**, sin excepciones JavaScript.
- Escritorio **1150×666** y móvil **390×844**, con **tres ciclos automáticos en cada tamaño**, avanzados mediante el reloj de Playwright y el runtime real de la página; sin pulsar avance docente.

## Costos y caja real

En una empresa nueva sin decisiones opcionales, cada aviso contiene exactamente Local de producción S/2.000 y Limpieza S/600. El total de **S/2.600** coincide con la suma de filas, el débito real del libro por categoría, `cashBalance()`, el saldo del aviso y el HUD. No se valida una proyección paralela como sustituto de caja real.

Las tres transiciones son **100.000 → 97.400 → 94.800 → 92.200**. Recargar/reingresar y guardar las secciones que contienen estos costos no generan segundos cargos. El recibo permanece en `buildStudentSnapshot().decision_state.__cycleCosts`; la hidratación con `hydrateRemoteProgress()` conserva el reconocimiento y el débito sin duplicarlo, incluso retirando el acknowledgement local del fixture.

Se comprobó también:

- Integración y pausa no cobran; reanudar cobra una sola vez.
- Borradores de compra de maquinaria, personal o préstamo no entran en el descuento automático.
- Continuidad de un operario de corte previamente contratado (S/1.500) y tienda de Los Olivos (S/1.800) entra en el siguiente aviso: total **S/5.900**, igual al descuento real. Marketing y préstamo de un ciclo anterior no se repiten automáticamente.
- Costos fijados en cero exclusivamente en el fixture: no hay aviso ni movimiento.
- Otra empresa no hereda recibo ni reconocimiento de la empresa anterior.
- Dejar abierto el aviso del ciclo2 y avanzar automáticamente al3 reemplaza el aviso por el del ciclo3; el recibo2 no queda reconocido falsamente.

## Calculadora y DOP

Hay **un selector de molde y un único campo numérico**. Alternar moldes conserva las cantidades de los otros moldes y el total agregado del plan. Para10unidades se comprobaron las cantidades conocidas del modelo:

| Molde | Cuero m² | Accesorios | Hilo m |
|---|---:|---:|---:|
| Básico |3|10|60|
| Mejorado |4|10|70|
| Premium |7|10|130|

El DOP recibe el mismo total que `productionPlan()` y la calculadora; comparar moldes aún no adquiridos no compra activos ni mueve caja. Escribir un negativo queda en0 inmediatamente. No hay desborde horizontal global en los dos tamaños.

## Hallazgo corregido durante verificación

La primera ejecución llegó hasta el final del escritorio con todo el cobro/aviso/ciclos en verde, pero al pegar−5 el campo no quedaba en0 por el manejo global de `beforeinput`. El dueño de estudiante corrigió la normalización visible y su evento de entrada. La repetición completa posterior pasó tanto escritorio como móvil; no se relajó la expectativa para ocultar el fallo.

## Evidencia y límites

- Pruebas: `tests/independent_cycle_costs_20261022.test.cjs` y `tests/independent_cycle_costs_20261022_browser.cjs`.
- Resultados: `tests/output/costos-calculadora-20261022/summary.json` (**153checks, errors=[]**).
- Capturas: `notice-1150-cycle-1/2/3.png`, `notice-390-cycle-1/2/3.png`, `calculator-dop-1150.png` y `calculator-dop-390.png`.
- El modal móvil fue inspeccionado visualmente: filas, importes, antes/después y Entendido caben completos. La captura de la calculadora confirma selector y campo único; la conexión con DOP fue validada sobre sus atributos y modelo renderizados.

La prueba de snapshot/hidratación usa el contrato real de la página sobre datos locales; no afirma una prueba de red de Supabase ni sincronización simultánea entre equipos reales. La batería completa y el despliegue corresponden al orquestador.

## Cierre del orquestador

- Batería Node completa, secuencial: **479/479**, cero fallos, omitidas o canceladas; 104,3 segundos. Log: `tests/output/costos-calculadora-20261022/node-aprobacion.log`.
- La comprobación PostgreSQL local adicional de opciones, cantidades, CAS, idempotencia y permisos pasa: `decision-options-db.log`.
- Dos escenarios de prueba antiguos se preparan ahora después del aviso reconocido o con el modo Excel explícitamente activado antes del ingreso. Conservan las comprobaciones de sincronización, una única escritura y revisión CAS; no omiten el cobro real de los ocho contratos nuevos independientes.
- Revisadas las capturas del modal en escritorio y móvil: importe, total, caja anterior/posterior y botón Entendido legibles. Repositorio sin artefactos nuevos fuera de SIDE1; las capturas y logs pesados permanecen locales.
- Archivos principales: `js/app.js`, `js/production_dop.js`, `js/cycle_cost_notice.js`, `index.html`, `css/production.css` y `css/cycle-costs.css`. El cálculo numérico de producción y los módulos matemáticos del motor no se modifican.
- Registro inicial: se usa el mismo desglose y las mismas claves por categoría de guardar/enviar. El HUD habitual muestra caja registrada; no presenta el gasto de un borrador opcional como un débito ya realizado.
- **No requiere SQL nuevo.** El recibo y su reconocimiento se sincronizan dentro de `decision_state` con la cola existente. No se ejecutó SQL ni se escribieron cuentas o partidas reales durante la verificación.
- Guía de comportamiento: `docs/COSTOS_CICLO_Y_CALCULADORA.md`.
