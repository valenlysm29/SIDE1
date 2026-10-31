# Validación independiente de capacidad

El oráculo de `tests/oraculo_capacidad_independiente.test.cjs` duplica constantes y realiza aritmética propia; no invoca funciones SIDE para generar valores esperados. Compara con `production_model.calculate` en pruebas automatizadas. Las dos pruebas temporales tienen expectativas calculadas manualmente y comparan con `temporal_production.calculateBySku`; no constituyen un oráculo temporal general.

## Reglas examinadas

- Para cada etapa, ordenar trabajadores por productividad 12, 8, 6 y equipos por multiplicador 1,5, 1,2, 1; emparejar sin repetir recurso. Corte dispone solo de mesa ×1. La suma diaria es `Σ pares × tasa × multiplicador`.
- Eficiencia `E=(90 + número de trabajadores nivel 3 + (jefatura?4:0))/100`; capacidad por etapa `C=round(diaria×30×E)`. La capacidad de línea es el mínimo de las tres. Asignaciones históricas explícitas se respetan primero si existen, limitadas por recursos.
- Con material disponible al inicio, producir secuencialmente básico, mejorado, premium: para cada molde `q=floor(min(meta, capacidad restante, cuero/r_c, accesorios/r_a, hilo/r_h))`; descontar `q×receta` y capacidad. Recetas `(m², unidades, m)`: básico `(0,3;1;6)`, mejorado `(0,4;1;7)`, premium `(0,7;1;13)`.
- En el modo temporal, cada día se añade únicamente lo recibido ese día; capacidad acumulada redondeada hacia abajo se distribuye por día y la capacidad no usada caduca. Pedidos sin recepción no son stock. Al comparar el flujo temporal con la capacidad mensual debe observarse que el primero usa `floor` acumulado y la segunda `round`.

## Resultados

`node --test tests/oraculo_capacidad_independiente.test.cjs`: ver ejecución final; 14 escenarios de capacidad/materiales, dos escenarios temporales manuales, dos comprobaciones de diagnóstico de faltantes y una de asignación histórica. Se cubren meta menor, igual y mayor que capacidad; trabajadores y equipos insuficientes; cuellos de corte, ensamble y acabado; cuero insuficiente; mezcla de tres moldes, inventario inicial, niveles y jefatura; recepción parcial y recepción futura. Se verificaron cantidades finales y, en el caso temporal, capacidad caducada y pendiente.

Ejemplo: 1 trabajador básico y 1 máquina básica por etapa: `6×30×0,90=162` unidades. Una meta de 2.000 con materiales suficientes produce 162. Ejemplo mixto con meta (10 básico, 0 mejorado, 10 premium), 5 m², 100 accesorios y 1.000 m: básico consume 3 m² y premium consume 1,4 m²; resultado (10,0,2), sobrante 0,6 m², cuero limitante. El diagnóstico de cuero fallaba antes de la corrección; la producción era 12 antes y después.

Los 16 casos denominados «oráculo» también pasaron contra la extracción de `origin/main` `2cb077c`; la prueba específica de cuero limitante falló allí. No se ha demostrado equivalencia para todas las combinaciones, capacidad con eventos, eficiencia mayor a 100 %, o distribución temporal de todos los escenarios. El oráculo no valida la calidad comercial ni fórmulas financieras.

Ejecución final del archivo de oráculo: **19 aprobadas, 0 fallidas**. Incluye 16 pruebas de escenarios, dos pruebas del diagnóstico de materiales y una de asignaciones históricas.

Control de regresión adicional: `node tests/comparar_produccion_base.cjs` comparó 500 escenarios pseudoaleatorios deterministas contra el código de `1cd6c3b`, excluyendo únicamente `limitingMaterials`; el resto del plan fue idéntico. Para regenerar la copia aislada, desde la raíz crear `.codex-work/produccion_base_1cd6c3b` si no existe y ejecutar `git archive --format=tar 1cd6c3b js tests/economic_v19_fixture.cjs | tar -xf - -C .codex-work/produccion_base_1cd6c3b`; no sobrescribir una copia existente. Es una muestra y no prueba equivalencia universal.
