# Lógica de SIDE basada en el documento de costos

Versión del cierre: `md-20261027`. Referencia conservada en [Logica_SIDE_Costos_de_Produccion.md](Logica_SIDE_Costos_de_Produccion.md).

## Reglas aplicadas

- Un ciclo productivo equivale a 30 días. Los tres niveles producen 6, 8 y 12 bolsos por día en corte, ensamble y acabado.
- Corte utiliza una mesa como herramienta disponible, sin multiplicar productividad por cantidad de mesas. Cuenta a todos los cortadores.
- Ensamble y acabado disponen de una matriz editable de trabajadores por nivel y tipo de máquina. Los multiplicadores son 1, 1.2 y 1.5. Debe existir un equipo del tipo asignado. El documento no limita cada equipo a un trabajador. Sin una matriz anterior, se propone el tipo disponible de mayor productividad.
- Eficiencia: 90% + 1 punto porcentual por cada N3 + 4 puntos por jefatura, con protección máxima del 100%. Capacidad del ciclo: redondeo del cuello de botella diario × 30 × eficiencia.
- Se fabrica primero el molde básico, luego el mejorado y finalmente el premium. Cada paso descuenta capacidad y materiales. Las recetas permanecen 0.3/1/6, 0.4/1/7 y 0.7/1/13.
- Pueden comprarse varios tipos de molde en un mismo ciclo. Debe disponerse de al menos uno. Cada tipo se compra una sola vez y se conserva.
- El almacén suma inventario inicial y compras en unidades productivas. Consume primero los niveles bajos y solo descuenta lo realmente fabricado. Los saldos físicos no se redondean a centésimas monetarias.
- Reputación: promedio de cuatro factores 0–10: proporción de producción premium, proporción de trabajadores N3, promedio de las tres proporciones de MP premium efectivamente consumida y publicidad/10000. El denominador de hilo incluye todos sus niveles.
- Publicidad es un importe editable de S/0 a S/10,000. Se paga una vez y solo aporta su factor de reputación. Las selecciones antiguas de marketing se interpretan como 1500/6000/10000 cuando se recupera un plan anterior.
- Calidad: se eligió la fórmula real sugerida por el documento, `(factor de producción + factor de MP) / 2`, en escala 0–10. Para el puntaje de mercado se multiplica por 10. La calidad del stock terminado sobrante se conserva entre ciclos y se pondera con la de la producción nueva.
- Mercados reales: 7000×50%=3500, 5000×70%=3500 y 2000×40%=800. Conservan los pesos y precios ideales del documento. Empates de precio económico reciben 100; los puntajes de precio tienen mínimo cero.
- Demanda por restos mayores, con desempate estable por identificador. La asignación conserva exactamente el mercado. Las empresas con canal y stock participan aunque no fabriquen en ese ciclo.
- Venta = mínimo entre demanda e inventario inicial de PT + producción. La demanda no atendida se pierde; la redistribución es opcional en el documento y no se activó.
- Ingreso = precio elegido × unidades vendidas. Se eliminaron del cierre las bonificaciones/penalizaciones automáticas de precio premium, capacidad y demanda por puntos del catálogo. Los eventos externos existentes siguen siendo explícitos.

## Costos, caja e inventarios

`js/business_rules.js` centraliza régimen, remuneraciones, publicidad y costos asociados de activos. El régimen se elige en Infraestructura y se conserva después de confirmar las decisiones para evitar cambiar retroactivamente pagos ya enviados.

Se utilizan las dos columnas MYPE/No MYPE del documento. Se mantienen sus importes laborales y la excepción original de CTS del cortador con experiencia: el documento recomienda unificar CTS, pero no define una fórmula universal nueva que permita sustituir esas cifras sin inventar una regla.

Las adquisiciones incorporan instalación y capacitación según régimen. Los moldes no tienen instalación y usan capacitación del 1%/2%. Estas compras se registran como inversión, no como gasto del ciclo.

Mantenimiento mensual automático = adquisición de activos disponibles × tasa anual 5%/8% ÷ 12. Se muestra y registra en Infraestructura. El cierre solo añade una diferencia si ese pago aún no estaba registrado, para evitar duplicarlo. Depreciación mensual lineal = adquisición menos residual 5%/10%, dividido entre vida útil y 12. Se deprecia la adquisición según la fórmula de la referencia.

Para los cierres de esta versión, los materiales consumidos, la mano de obra y la depreciación se reconocen como costo de producción del ciclo, incluso si quedan bolsos sin vender, tal como propone la sección 9 del documento. Los PT nuevos se conservan en unidades sin volver a capitalizar ese costo ya reconocido. Si se recibe stock con valor contable de la versión anterior, ese valor se consume al venderlo. La MP sin consumir sí permanece valorizada en el balance.

Se mantienen las funciones existentes de canales, crédito/cobranza, garantías, financiamiento e impuesto y su presentación separada. Por ello, utilidad operativa y utilidad neta no son el mismo resultado. Los cierres y snapshots históricos conservan su cálculo original; no se reescriben.

## Ejemplo corregido y comprobado

Con la dotación y asignación de máquinas descritas en el documento:

| Resultado | Valor |
|---|---:|
| Capacidad diaria corte / ensamble / acabado | 14 / 31.4 / 24 |
| Eficiencia incluyendo ambos N3 | 92% |
| Capacidad real mensual | 386 |
| Producción básica / media / premium | 150 / 140 / 78 |
| MP consumida | S/21,962.24 |
| MP final | S/3,024.96 |
| Reputación 0–10 | 2.776017 |
| Ingresos a precios 40 / 120 / 250 y demanda suficiente | S/42,300 |

Estas cifras corrigen el consumo del Excel original. No se utilizan simultáneamente los valores antiguos de consumo de la meta deseada y la producción real limitada.

## Despliegue y comprobación

Las páginas de estudiante y docente cargan el mismo motor y la nueva dependencia `js/business_rules.js`, con versiones de caché actualizadas.

La migración [20261027_logica_documento_costos.sql](../supabase/migrations/20261027_logica_documento_costos.sql) actualiza el catálogo de Supabase para régimen, publicidad numérica, varios moldes y mantenimiento automático. Preserva las opciones antiguas para sus referencias históricas. Fue probada dos veces en PostgreSQL en memoria, sin cambiar una base remota. Debe aplicarse en el entorno donde se publique esta versión. La persistencia de las asignaciones y los factores usa el snapshot JSON existente; no requiere columnas nuevas.

Desde la raíz de SIDE1:

```powershell
node --test tests/md_logic.test.cjs tests/production_model.test.js tests/decision_review_model.test.js tests/cierre_v19.test.cjs tests/costos_runtime_v19.test.cjs tests/accounting_integrated.test.cjs tests/business_cycle.test.cjs tests/cycle_productivity.test.js tests/production_dop.test.js tests/production_calculator_selector.test.js tests/production_dop_target_ui.test.js tests/student_financial_summary.test.js tests/financial_presentation.test.cjs tests/decision_roster.test.mjs
node tests/audit_logica_md_20261027.cjs
node tests/md_logic_catalog_db.cjs
python tests/md_logic_ui.py
```

Las pruebas SQL necesitan `@electric-sql/pglite`; las de navegador necesitan Python con Playwright y Chrome. En este equipo las dependencias están disponibles en `.cache/test-runtime/node_modules` y `tests/.python-deps`; Python compatible: el runtime integrado 3.12.

Los oráculos del antiguo libro adaptado v19 permanecen como antecedentes. No son el criterio de aceptación de esta versión; los resultados esperados nuevos provienen del documento y de cálculos independientes de sus reglas.
