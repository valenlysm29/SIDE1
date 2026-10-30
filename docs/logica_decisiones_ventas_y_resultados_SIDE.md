# Lógica de decisiones, ventas y resultados de SIDE

Referencia del código del proyecto revisado el 28 de octubre de 2026. Este documento describe el comportamiento implementado; no modifica decisiones, parámetros ni resultados. Los valores configurables de una sala, los eventos, la competencia y la versión del cierre pueden cambiar los resultados. Para una partida cerrada prevalece el resultado persistido de esa partida.

## 1. Flujo de una empresa

1. El docente configura la sala: capital, ciclos, tiempo, eventos y parámetros financieros disponibles.
2. El estudiante registra decisiones de infraestructura, producción, logística, ventas y finanzas. Guardar un borrador no equivale a enviar; la interfaz debe confirmar que el servidor recibió el plan.
3. El plan combina recursos comprados, recursos disponibles de ciclos anteriores, personal e insumos. La revisión muestra si la meta puede cumplirse.
4. Al cierre se determinan producción, inventario, demanda, ventas y movimientos financieros. El cierre económico se consolida por empresa y ciclo; los resultados definitivos no deben confundirse con la proyección previa.
5. La materia prima y los productos terminados no vendidos pueden pasar al ciclo siguiente. Los equipos y moldes adquiridos también permanecen disponibles según su historial.

## 2. Decisiones disponibles

### Infraestructura

Se puede adquirir mesas de corte, máquinas básicas, semiindustriales o industriales de ensamblado y acabados, y un molde básico, mejorado o premium. El molde elegido para una meta debe estar disponible. El local de producción y los servicios de limpieza son costos obligatorios recurrentes; existe además mantenimiento preventivo opcional.

Las compras de equipos y moldes son inversión en activos, no ventas ni gasto inmediato equivalente al precio completo del activo. El costo de adquisición incorpora instalación y capacitación según el régimen interno; el molde no incluye instalación. Una compra previa no debe cobrarse otra vez solo por usar el equipo en otro ciclo.

### Producción

El estudiante indica la **meta por tipo de molde**, contrata personal para corte, ensamblado y acabados, y puede elegir jefatura. También selecciona una garantía para productos terminados. La asignación de trabajadores a máquinas se resuelve internamente; no hay una decisión adicional para distribuirlos por máquina.

Una meta es un objetivo, no unidades ya fabricadas. La revisión comprueba la disponibilidad del molde, los insumos y la capacidad de los tres procesos. La confirmación completa requiere una meta positiva, recursos suficientes para la meta y un canal activo. Los borradores pueden guardarse para seguir editándolos; el cierre programado puede ocurrir aunque no se hayan completado decisiones, por lo que no debe suponerse que un borrador incompleto se ejecutará como un plan válido.

### Logística

Se compran cueros en m², accesorios en unidades e hilos en metros. Las compras se suman al inventario de materia prima disponible; el sistema consume solo lo usado en la fabricación. El analista de compras es opcional y tiene un costo por ciclo. También se puede elegir garantía de proveedores.

Precios base del catálogo, antes de descuentos:

| Material | Opciones y precio base |
|---|---|
| Cuero | Sintético S/ 25/m²; estándar S/ 45/m²; premium S/ 80/m² |
| Accesorios | Económicos S/ 4/u.; premium S/ 9/u. |
| Hilo | Estándar S/ 2/m; reforzado S/ 4/m; premium S/ 7/m |

Por defecto, una compra de una misma opción desde 100 unidades físicas obtiene un 8 % de descuento; el docente puede configurar el umbral. El descuento del analista se aplica adicionalmente: comienza en 12 % y baja 2 puntos por ciclo hasta un mínimo de 2 %. No se aplica al sueldo ni a los equipos. Los importes que muestra el resumen dependen de las opciones y de la configuración efectiva de la sala.

### Ventas

Se elige página web y/o tiendas en Los Olivos, Miraflores y San Juan de Lurigancho. Sus tarifas base por ciclo son, respectivamente, S/ 500, S/ 1,800, S/ 3,500 y S/ 2,200. Las tiendas físicas tienen un compromiso mínimo de 12 ciclos según el catálogo; cada tienda incluye un vendedor básico. La comisión es el 1 % de las ventas, sin un sueldo fijo adicional de ese vendedor.

Se puede usar distribución automática o asignar manualmente unidades a los puntos activos. Una tienda o una página web no garantizan ventas: también debe haber producto disponible y demanda asignada en ese punto.

### Finanzas

El estudiante puede seleccionar capacitación, marketing y un importe de préstamo dentro de su línea disponible. El préstamo proporciona financiamiento y deuda: **no es ingreso por ventas ni utilidad**. La línea inicial se presenta como 70 % de la caja y puede variar después según la caja y los activos. La tasa inicial la configura el docente.

Opciones de capacitación: sin capacitación, baja S/ 1,000, media S/ 6,000 y alta S/ 12,000. Marketing: baja S/ 1,500, media S/ 6,000 y alta S/ 12,000. Son decisiones opcionales y sus desembolsos afectan la caja; gastar más no asegura una ganancia.

## 3. Cómo se calcula la producción

Un ciclo representa 30 días productivos. Las tasas base por trabajador de niveles 1, 2 y 3 son 6, 8 y 12 unidades diarias. En ensamblado y acabado las máquinas aplican multiplicadores de 1, 1.2 y 1.5 para básica, semiindustrial e industrial. El cálculo empareja internamente personal y máquinas disponibles; en corte se requiere una mesa disponible.

La eficiencia del plan es 90 %, más un punto porcentual por cada trabajador de nivel 3 y cuatro puntos si hay jefatura. La función de planificación observada suma esos componentes sin aplicar explícitamente un límite de 100 %; otros cálculos o versiones pueden usar límites distintos. La capacidad de cada proceso se obtiene de su capacidad diaria, 30 días y la eficiencia, redondeada a unidades. El proceso con menor capacidad limita la línea.

Receta por unidad:

| Molde / segmento | Cuero | Accesorios | Hilo |
|---|---:|---:|---:|
| Básico / económico | 0.3 m² | 1 | 6 m |
| Mejorado / medio | 0.4 m² | 1 | 7 m |
| Premium | 0.7 m² | 1 | 13 m |

La producción efectiva está limitada por la meta, la capacidad de la línea, los materiales y la disponibilidad del molde. Si se planifican varios moldes, se procesan en orden básico, mejorado y premium, descontando capacidad e insumos a medida que se usan. Se fabrican unidades enteras; no se crea inventario si falta capacidad o material.

**Ejemplo:** 100 unidades premium requieren 70 m² de cuero, 100 accesorios y 1,300 m de hilo, además del molde premium y capacidad suficiente en las tres etapas.

## 4. Demanda, ventas e ingresos

El motor trabaja con tres segmentos y estos precios internos predeterminados:

| Segmento | Precio por unidad | Mercado base × penetración |
|---|---:|---:|
| Económico | S/ 42.50 | 7,000 × 50 % = 3,500 |
| Medio | S/ 100.00 | 5,000 × 70 % = 3,500 |
| Premium | S/ 250.00 | 2,000 × 40 % = 800 |

Estos precios se resuelven internamente; no hay que añadir campos de precio a la interfaz. Pueden existir valores válidos heredados de planes anteriores. El mercado se reparte entre empresas elegibles mediante puntajes y restos mayores; para competir se considera, según el segmento, precio, calidad y reputación. La asignación también puede verse afectada por eventos. La demanda de una empresa no es necesariamente todo el mercado.

La reputación combina factores de producción premium, personal de nivel 3, proporción de materia prima premium consumida y publicidad. La calidad emplea factores de producción y materia prima. Usar materiales premium o más marketing puede afectar esos indicadores y sus costos; no garantiza ventas ni utilidad.

Para cada punto de venta, las unidades vendidas no pueden superar su demanda asignada ni el stock disponible en ese punto. La demanda que no se atiende se pierde. El ingreso del segmento es **unidades efectivamente vendidas × precio efectivo**; el ingreso total suma los segmentos. El stock terminado no vendido se conserva para el siguiente ciclo.

Una empresa puede tener ventas cero por falta de meta, molde, personal, maquinaria, insumos, producto disponible, canal o demanda asignada. También puede vender y, aun así, tener pérdida si sus costos y gastos superan los ingresos.

## 5. Crédito, cobros y caja

Por defecto, el porcentaje de ventas a crédito comienza en 20 %, aumenta 5 puntos por ciclo y puede aumentar 5 puntos con analista; el máximo es 70 %. El porcentaje inicial puede ser configurado por el docente. Esta proporción se calcula internamente: no es una decisión editable del estudiante.

Las ventas del ciclo incluyen contado y crédito. La porción a crédito se registra como cuenta por cobrar; el cobro de saldos anteriores entra en la caja conforme a la regla del cierre. Por tanto, **ventas del ciclo y cobros del ciclo no tienen por qué coincidir**. La caja también se ve afectada por compras, gastos, inversión en activos, financiamiento, devoluciones e impuesto pagado.

## 6. Costos, utilidad e impuesto

El cálculo financiero distingue el consumo de materia prima de la compra: la materia prima no utilizada permanece en inventario valorizado. También distingue compras de activos, depreciación, mano de obra, gastos comerciales y pagos efectivos. En el modelo financiero actual, el costo de productos terminados fabricados se asigna a unidades disponibles, reconociéndose el costo de las unidades vendidas; si no se fabrica, la mano de obra y depreciación ociosas se reconocen como gasto, sin inventar unidades. Los cierres históricos mantienen sus snapshots y pueden reflejar criterios de versiones anteriores.

Además de salarios y materiales, pueden existir local y limpieza, tiendas, marketing, mantenimiento, depreciación, comisión, garantías e intereses. En la configuración base la garantía comercial estima S/ 5 por unidad vendida para 30 días y S/ 10 para 90 o 180 días; se registra una provisión. La tasa anual efectiva de un préstamo se convierte a la duración del ciclo: `(1 + TEA)^(meses/12) - 1`.

El estado de resultados utiliza estas relaciones:

```text
Ventas netas = ventas - devoluciones
Utilidad bruta = ventas netas - costo de ventas
Gastos de operación = gastos administrativos + gastos de ventas
Utilidad operativa = utilidad bruta - gastos de operación
Utilidad antes de impuestos = utilidad operativa + ingresos financieros - gastos financieros
Utilidad neta = utilidad antes de impuestos - impuesto a la renta
```

Los ingresos financieros son distintos de las ventas. Tener ingresos financieros cero no significa que las ventas sean cero.

Cuando la sala configura el número de ciclos, el impuesto a la renta se liquida al final sobre la utilidad antes de impuestos acumulada, descontando impuestos anteriores si los hubiera. Una base acumulada negativa no genera impuesto positivo. En la configuración del motor, MYPE aplica 10 % hasta 15 UIT y 29.5 % al exceso; el régimen general aplica 29.5 %. El código usa UIT de S/ 5,500 y admite parámetros de sala. Estas cifras describen la configuración del simulador, no una determinación tributaria real.

## 7. Qué revisar en una prueba de dos ciclos

En el resumen previo comprueba: molde disponible, meta por ese molde, capacidad de corte/ensamblado/acabado, cantidad de cada insumo, canal activo y caja suficiente. Confirma todas las decisiones y espera la confirmación del servidor. Tras el cierre compara la producción y las ventas efectivas, el inventario final, los ingresos, el costo y la utilidad; luego verifica que el siguiente ciclo recupera el saldo y los activos anteriores.

Un escenario de prueba aislado con un molde premium, meta de 100, 70 m² de cuero sintético, 100 accesorios económicos, 1,300 m de hilo estándar, una mesa, una máquina básica de cada proceso, un trabajador básico en cada proceso y una tienda Los Olivos produjo y vendió 100 unidades en el cálculo del motor. A S/ 250/u., sus ingresos fueron S/ 25,000 por ciclo. Es un ejemplo condicionado a demanda suficiente, configuración y ausencia de eventos, no una garantía de utilidad en otra partida.

## 8. Fuentes dentro del proyecto

- `js/decision_catalog.js`: opciones y precios del catálogo.
- `js/production_model.js` y `js/business_rules.js`: capacidad, consumo, salarios, activos y mantenimiento.
- `js/engine/config.js` y `js/engine/cierre.js`: segmentos, demanda, asignación, canales y ventas.
- `js/cycle_model.js` y `js/financial_model.js`: inventarios, movimientos y estados financieros.
- `js/company_summary.js` y `js/app.js`: revisión y confirmación de decisiones.
- `services/business_runtime.cjs` y `supabase/functions/side-business-close/`: ejecución del cierre del servidor.

La documentación anterior `docs/actualizacion_logica_documento_20261027.md` es un antecedente útil, pero algunas descripciones de contabilización pueden corresponder a versiones previas. Ante una diferencia, se debe revisar el snapshot y la versión efectiva de la partida, sin reescribir cierres históricos.
