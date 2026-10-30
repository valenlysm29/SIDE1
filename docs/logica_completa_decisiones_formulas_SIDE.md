# Lógica de las decisiones y fórmulas de SIDE

**Estado de referencia:** código de `main`, commit `d66669c`, revisado el 28 de octubre de 2026. Este documento explica el código del proyecto y sus valores predeterminados; una sala puede tener parámetros diferentes y los cierres ya guardados conservan sus resultados. El servidor realiza el cierre definitivo. Una vista previa en el navegador puede diferir del resultado compartido entre empresas.

**Cómo leer las fuentes:** «Excel» identifica una referencia documental o una regla de sus hojas; «SIDE» identifica una decisión de implementación, parámetro o integración del simulador. Que una regla esté implementada no demuestra equivalencia global con el libro. En particular, las 223 comparaciones guardadas de producción son parciales y usan una tolerancia de `1e-8`; no cubren todas las decisiones ni los resultados financieros. El oráculo histórico de mercado que da 92 utiliza otro indicador de calidad y no debe confundirse con la fórmula literal que da 86,3 en el caso descrito abajo.

## 1. Cadena general

```text
Configuración de la sala y decisiones confirmadas
  → compras, personal, préstamos y recursos acumulados
  → capacidad y meta por molde
  → producción efectiva y consumo de materiales
  → calidad de cada lote y consecuencias
  → reputación, competencia y demanda por segmento
  → distribución a canales y ventas por lote
  → ingresos, costos, caja, deuda y estados financieros
  → inventarios y saldos para el siguiente ciclo
```

Cada empresa tiene su propio plan y sus propios saldos. En un cierre compartido, las empresas con existencias en un segmento compiten por su mercado. Los valores manuales del libro Excel no se copian como ventas de la empresa.

## 2. Mapa de decisiones

| Decisión | Opciones o dato | Efecto que se ejecuta | Dónde mirar |
|---|---|---|---|
| Mesas de corte | Cantidad | Compra un activo; al menos una mesa habilita la capacidad del personal de corte. Sin mesa, capacidad de corte cero. | `js/production_model.js`, `js/business_rules.js` |
| Ensamblado | Cantidad de máquinas básicas, semiindustriales e industriales | Compra activos y habilita el uso del tipo de máquina; el multiplicador afecta la capacidad del personal asignado. | `js/production_model.js` |
| Acabados | Cantidad de máquinas básicas, semiindustriales e industriales | Igual que ensamblado, en la etapa de acabados. | `js/production_model.js` |
| Molde | Básico, mejorado, prémium | Activo que habilita una línea; determina receta y aporte a la calidad del lote. | `js/production_model.js`, `js/engine/cierre.js` |
| Local de producción | Opción estándar obligatoria | Desembolso operativo recurrente del catálogo. | `js/decision_catalog.js`, `js/decision_review_model.js` |
| Mantenimiento | Preventivo opcional | Desembolso preventivo opcional; además el cierre calcula mantenimiento automático de activos y descuenta únicamente el mantenimiento automático ya registrado como tal. El preventivo opcional se cobra aparte. No se presume que aumente la capacidad física. | `js/business_rules.js`, `js/cycle_model.js` |
| Meta de producción | Unidades deseadas por molde | Define necesidades del DOP y techo de producción; no garantiza fabricación ni ventas. | `js/production_model.js` |
| Personal de corte, ensamblado y acabados | Cantidades por nivel | Cada trabajador aporta productividad y costo laboral; los de nivel 3 también aumentan la eficiencia física. | `js/production_model.js`, `js/business_rules.js` |
| Jefatura | Contratar o no | Tiene costo laboral; añade 4 puntos porcentuales de eficiencia física. Su ausencia participa en CONS-08. | `js/engine/cierre.js` |
| Limpieza | Servicio obligatorio | Desembolso operativo recurrente. | `js/decision_catalog.js` |
| Garantía de producto terminado | 30, 90 o 180 días | Seleccionar no genera cobro directo; el cierre calcula una provisión por unidad vendida según las tarifas configuradas. | `js/financial_model.js` |
| Analista de compras | Contratar o no | Costo recurrente; descuento en materiales que depende del ciclo y bonificación en el porcentaje automático de ventas a crédito. | `js/business_rules.js`, `js/engine/cierre.js` |
| Cuero, accesorios e hilo | Cantidad de cada calidad | Compra materia prima, afecta caja e inventario; el consumo efectivo determina costo y calidad del lote. | `js/production_model.js`, `js/financial_model.js` |
| Garantía de proveedor | 0 %, 80 %, 100 % | Política seleccionable sin desembolso inmediato. La selección por sí sola no demuestra que ocurra una falla ni crea automáticamente una devolución. | `js/decision_catalog.js` |
| Canales | Web y tiendas en Los Olivos, Miraflores y SJL; cantidad de tiendas | Costos de canales y puntos disponibles. La demanda se reparte entre puntos activos y las ventas dependen del stock asignado. | `js/engine/cierre.js`, `js/decision_review_model.js` |
| Distribución | Automática o cantidades manuales por punto y producto | Transfiere productos del almacén al punto. Una transferencia no es venta; no puede exceder el stock central. | `js/engine/cierre.js` |
| Capacitación | Ninguna, baja, media o alta | Desembolso y posible aporte del catálogo al puntaje. Los porcentajes de `config.training` no prueban por sí solos un aumento de capacidad en el cierre físico actual. | `js/decision_review_model.js`, `js/engine/cierre.js` |
| Marketing | Baja, media o alta | Desembolso y aporte a la reputación operativa según el importe reconocido; también puede aportar al puntaje del catálogo. No equivale automáticamente a multiplicar ventas por el porcentaje de `config.marketing`. | `js/business_rules.js`, `js/engine/cierre.js` |
| Préstamo | Importe solicitado | Aumenta caja y deuda, sujeto a línea y validación del servidor. Genera intereses; no es ingreso por venta. | `js/decision_review_model.js`, `services/partida_service.js`, `js/financial_model.js` |
| Ventas a crédito | Información automática | El porcentaje se calcula por ciclo y configuración; no es un campo de decisión del estudiante. | `js/engine/cierre.js` |

El catálogo de la interfaz está en `js/decision_catalog.js`. El precio por segmento y la asignación de trabajadores a máquinas son internos: este documento no propone añadir controles para ellos.

## 3. Infraestructura, sueldos y compras

### 3.1 Capacidad y activos

Los precios de catálogo son parámetros, no resultados de ejemplo. Entre ellos: mesa de corte S/ 2.500; máquinas de ensamblado S/ 3.500 / 7.500 / 15.000; máquinas de acabados S/ 1.200 / 4.500 / 9.500; moldes S/ 300 / 1.200 / 3.500. Consulte el catálogo para el resto y para posibles actualizaciones.

La compra efectiva usa estas fórmulas internas:

```text
Costo de equipo = precio base × (1 + instalación + capacitación)
Costo de molde  = precio base × (1 + capacitación de molde)
```

Para MYPE: instalación 3 %, capacitación de equipo 2 %, capacitación de molde 1 %. Para NO_MYPE: 5 %, 3 % y 2 %, respectivamente. El régimen se determina por la selección disponible en el estado; sin selección `no_mype`, el código usa MYPE. Son parámetros de SIDE derivados del modelo; no constituyen una interpretación de legislación laboral.

Los equipos y moldes adquiridos se acumulan por ciclo. Se calcula mantenimiento automático como `Σ(cantidad acumulada × precio base × tasa anual / 12)`, con tasa 5 % MYPE u 8 % NO_MYPE. El cierre resta el mantenimiento automático ya registrado como tal en las secciones para evitar duplicarlo; el preventivo opcional es un cargo separado.

### 3.2 Personal

La productividad diaria por trabajador es 6, 8 y 12 unidades para niveles 1, 2 y 3. Los sueldos base están en `business_rules.js`: por ejemplo corte S/ 1.500 / 2.000 / 3.800; ensamblado y acabado S/ 1.500 / 2.800 / 4.500; jefatura S/ 3.000.

El costo laboral mensual que usa el modelo es:

```text
(sueldo × 12 + sueldo × 0,09 + sueldo × gratificaciones
 + CTS del modelo + sueldo × vacaciones) / divisor
```

MYPE: gratificaciones `1`, vacaciones `0,5`, divisor `12,5`, CTS base S/ 750. NO_MYPE: gratificaciones `2`, vacaciones `1`, divisor `13`, CTS base S/ 1.500. Para `corte_exp`, CTS usa medio sueldo en MYPE y un sueldo en NO_MYPE. Estas son fórmulas internas del modelo, no asesoría legal. Si se reduce personal, la revisión de decisiones puede agregar una indemnización usando la tasa de configuración; su valor predeterminado en ese cálculo es 0,5 del costo unitario.

### 3.3 Materiales y descuentos

| Familia | Opción y costo base por unidad física |
|---|---|
| Cuero | Sintético S/ 25/m²; estándar S/ 45/m²; prémium S/ 80/m² |
| Accesorios | Económicos S/ 4/unidad; prémium S/ 9/unidad |
| Hilo | Estándar S/ 2/m; reforzado S/ 4/m; prémium S/ 7/m |

```text
Descuento por cantidad = 8 % si la compra de esa opción alcanza 100 unidades
Descuento de analista  = máx(2 %, 12 % − 2 puntos × (ciclo − 1))
Precio efectivo        = precio base × (1 − descuento cantidad) × (1 − descuento analista)
Importe de compra      = cantidad física × precio efectivo
```

El umbral y la tasa de cantidad son configurables; el descuento de analista solo se aplica si está contratado. Los descuentos son multiplicativos, no se suman. Las cantidades son m², unidades o metros, sin conversión adicional a paquetes. La compra aumenta inventario de materia prima y reduce caja; la materia prima anterior no vuelve a cobrarse.

## 4. Producción: metas, capacidad y consumo

### 4.1 Tiempo y eficiencia física

La referencia principal elegida para capacidad es **`Costos De Producción`**: 30 días, productividad 6 / 8 / 12 y multiplicadores de máquina 1 / 1,2 / 1,5. La hoja `CANTIDAD DE PRODUCCIÓN` contiene parámetros anteriores diferentes y no sustituye estos valores en el modelo físico vigente.

```text
Eficiencia física = redondear a 2 decimales
                    (0,90 + 0,01 × trabajadores nivel 3 + 0,04 × jefatura)
Capacidad diaria de cada proceso = Σ(trabajadores asignados × productividad × multiplicador)
Capacidad del ciclo por proceso   = redondear(capacidad diaria × 30 × eficiencia física)
Capacidad de planta               = mínimo(corte, ensamblado, acabados)
```

En corte el multiplicador es 1 y se necesita al menos una mesa. En ensamblado y acabados, la asignación se resuelve internamente y privilegia la máquina más productiva disponible para trabajadores no asignados. En la implementación revisada, la presencia de un tipo de máquina habilita ese tipo de asignación; no debe interpretarse que se haya probado una relación uno a uno entre cantidad de máquinas y trabajadores. La función no aplica un tope explícito de 100 % a la eficiencia física.

**Puntaje de eficiencia** y **eficiencia física** son diferentes. El primero se obtiene sumando aportes del catálogo y activa CONS-03/08; el segundo es el factor productivo anterior.

### 4.2 Metas y recetas

| Molde | Cuero por unidad | Accesorios por unidad | Hilo por unidad |
|---|---:|---:|---:|
| Básico | 0,3 m² | 1 | 6 m |
| Mejorado | 0,4 m² | 1 | 7 m |
| Prémium | 0,7 m² | 1 | 13 m |

```text
Necesidad de un material para la meta = Σ(meta de molde × receta del molde)
Producción de una línea = piso(mínimo(meta habilitada, capacidad restante,
                                    materiales restantes / receta))
Consumo efectivo = producción efectiva × receta
```

SIDE asigna primero básico, luego mejorado y finalmente prémium; es una **regla de integración SIDE**, no un orden demostrado por Excel. Descuenta capacidad y materiales tras cada línea y conserva 15 cifras significativas en determinadas operaciones de inventario. Si no hay molde, materiales o capacidad suficientes, no se inventa producción. El DOP muestra lo requerido por la meta original, no solo lo adquirido ni lo fabricado.

Ejemplo: 100 unidades prémium requieren 70 m² de cuero, 100 accesorios y 1.300 m de hilo; si solo se fabrican 60, el consumo efectivo es 42 m², 60 accesorios y 780 m.

## 5. Puntajes, calidad y consecuencias

### 5.1 Puntajes del catálogo

`cierre.js` transforma opciones en códigos de `catalogo_excel.js` y suma los aportes de los grupos admitidos para obtener puntaje de eficiencia, reputación del catálogo y salud financiera. En una dotación mixta selecciona el código de mayor aporte de eficiencia una vez por grupo: es una suposición de integración, no una suma por cada trabajador. Las mesas de corte no se incluyen en esa selección. No todos los controles tienen un efecto verificable en cada uno de esos puntajes; se debe consultar la tabla de códigos y el conjunto `scoreGroups` del código.

### 5.2 Calidad real del lote

Para cada molde fabricado, el código registra qué cantidades de cada material se consumieron. Dentro de cada familia consume las opciones en el orden declarado en `materialCodes`; el reparto de moldes sigue básico → mejorado → prémium.

```text
Calidad del lote = puntaje del molde
                 + Σ, para cada familia (Σ(cantidad usada de cada opción × puntaje de esa opción)
                                         / cantidad total usada de esa familia)
```

Los puntajes de molde y material están en `js/engine/catalogo_excel.js`, relacionados con `Lotes_Produccion` y el catálogo del libro. Con mezcla, el aporte de cada familia es un promedio ponderado por la cantidad realmente usada. No se presupone que un molde prémium utilice insumos prémium. El resultado puede superar 10: no debe confundirse con el indicador comercial 0–100.

### 5.3 Consecuencias ejecutadas

| Regla | Condición | Efecto en el cierre |
|---|---|---|
| CONS-01 | Lote disponible del segmento prémium con calidad < 4 | Precio de sus unidades × 0,65; reputación −2 una vez por regla en el ciclo. |
| CONS-02 | Lote disponible del segmento prémium con calidad ≥ 7 | Precio de sus unidades × 1,40; reputación +2 una vez por regla en el ciclo. |
| CONS-03 | Puntaje de eficiencia < 4 | Primero limita la meta total a `piso(meta × 0,70)`, asignada por orden SIDE; luego aplica capacidad y materiales. |
| CONS-04 | Reputación del catálogo ajustada < 3 durante al menos dos ciclos consecutivos | Demanda asignada × 0,80, con piso a unidades enteras; se mantiene el contador entre ciclos. |
| CONS-08 | Sin jefatura y puntaje de eficiencia < 5 | Tras el límite físico y CONS-03, limita a `piso(producción posible × 0,95)`. |

La reputación se ajusta por cada regla activa una vez, no por cada unidad. Si hay lotes que activan ambas reglas, se aplican ambos ajustes. Para saldos históricos sin calidad registrada no se inventa calidad para activar una consecuencia. Las reglas de `Matriz_Consecuencias` son texto del libro; el orden de integración con capacidad, materiales y reparto es una decisión de SIDE. El cierre vigente no atribuye al Excel una nueva tarifa de horas extra ni de almacenaje: los valores predeterminados de esas tarifas son cero. El catálogo de eventos puede describir efectos adicionales; no debe suponerse que un evento no verificado se acepte en el cierre autoritativo del servidor.

## 6. Reputación comercial, demanda y competencia

### 6.1 Reputación operativa

El motor calcula cuatro factores, cada uno normalmente expresado sobre 10:

```text
Producción = 10 × unidades prémium fabricadas / producción total
Personal   = 10 × trabajadores nivel 3 / total de trabajadores de producción
Materiales = 10 × promedio(proporción prémium utilizada en cuero,
                           accesorios e hilo)
Publicidad = 10 × importe de publicidad reconocido / 10.000
Reputación operativa sobre 40 = suma de los cuatro factores
Reputación de mercado sobre 10 = mín(40, suma) / 4, ajustada por CONS-01/02 y acotada 0–10
```

Si el denominador de un factor es cero, ese factor es cero. Para publicidad, `business_rules.js` usa un máximo de S/ 10.000; con opciones heredadas reconoce S/ 1.500 / 6.000 / 10.000 para baja / media / alta. El desembolso de la opción alta del catálogo es S/ 12.000: **importe pagado y valor reconocido para reputación no son necesariamente iguales**. El suavizado con la reputación anterior está desactivado por defecto; si se configura, el código promedia con la anterior.

### 6.2 Mercados y ponderaciones

| Segmento | Precio interno predeterminado | Mercado base × penetración | Ponderaciones precio / reputación / indicador comercial |
|---|---:|---:|---|
| Económico | S/ 42,50 | 7.000 × 50 % = 3.500 | 70 % / 20 % / 10 % |
| Medio | S/ 100 | 5.000 × 70 % = 3.500 | 40 % / 35 % / 25 % |
| Prémium | S/ 250 | 2.000 × 40 % = 800 | 10 % / 50 % / 40 % |

En el cierre autoritativo los precios se obtienen de la configuración interna, no de importes enviados por el navegador. Los precios efectivos cobrados pueden cambiar por las consecuencias de cada lote.

```text
Precio económico = 100 si todos los precios empatan;
                   si no, 100 × (precio máximo − precio propio) / (máximo − mínimo)
Precio medio/prémium = 100 − 100 × |precio propio − precio ideal| / precio ideal
Indicador comercial = redondear(100 × reputación de mercado propia / suma de reputaciones)
Puntaje total = peso precio × puntaje precio
              + peso reputación × (reputación de mercado × 10)
              + peso indicador × indicador comercial
Participación = puntaje propio / suma de puntajes del segmento
```

El puntaje de precio se limita a 0–100; si la suma de reputaciones es cero, el indicador comercial es cero; si la suma de puntajes es cero se reparte por igual entre participantes. El indicador comercial es una **proporción de reputación**, como la fórmula literal documentada de `Costos De Producción!E118`; no es la calidad real de un lote. La calidad real sí activa CONS-01/02. El caso de prueba con precios 40/42/43/45 y reputaciones 7/8/9/6 da indicador 23 y puntaje 86,3 para la primera empresa; 92 corresponde a una variante histórica que usa directamente calidad real.

SIDE asigna cantidades enteras de mercado por **restos mayores**, con desempate por identificador; por ello debe distinguirse del redondeo independiente de algunas fórmulas del libro. La demanda se modifica por el factor de eventos suministrado y por CONS-04. La competencia usa el precio base de la línea; las consecuencias de calidad modifican el precio efectivamente cobrado por lote. No se redistribuye automáticamente la demanda que una empresa no puede atender por falta de inventario.

## 7. Tiendas, ubicación y ventas

Los canales son web y tiendas físicas en Los Olivos, Miraflores y SJL. El catálogo marca costos por ciclo de S/ 500, 1.800, 3.500 y 2.200, respectivamente, con configuraciones internas para algunas opciones. Las tiendas físicas pueden existir en cantidades múltiples y tienen un compromiso de 12 ciclos según el catálogo. La comisión general configurada es 1 % de las ventas.

La demanda de la empresa se distribuye entre puntos activos mediante pesos de afinidad SIDE y restos mayores. Los valores predeterminados por zona alta / media / baja / web son:

| Producto | Alta | Media | Baja | Web |
|---|---:|---:|---:|---:|
| Económico | 0,6 | 1 | 1,4 | 1 |
| Medio | 0,9 | 1,3 | 0,8 | 1 |
| Prémium | 1,5 | 1 | 0,5 | 1 |

Esto es una regla SIDE, no una fórmula atribuida a Excel. Automáticamente se transfieren unidades desde almacén para cubrir faltantes de cada punto; si no alcanza, se distribuye proporcionalmente por restos mayores. En modo manual se valida que cada cantidad sea entera, no negativa y no supere el saldo central disponible. Transferir no genera ingreso.

Los lotes guardan su cantidad, molde, ciclo, calidad, costo y cantidades ubicadas en puntos. Las transferencias usan FIFO del almacén y las ventas usan FIFO de los lotes disponibles **en el punto que vende**. La web es otro punto y no duplica unidades asignadas a tiendas.

```text
Venta del punto = mínimo(demanda del punto, inventario disponible en el punto)
Ingreso del lote vendido = unidades vendidas del lote × precio efectivo de ese lote
Inventario final global = inventario inicial + producción − ventas
```

La suma de almacén y ubicaciones debe coincidir con el inventario global. Si solo existe un saldo histórico agregado, se conserva como tal y se usan las cantidades por punto que sí estaban registradas. Si hay varios lotes históricos y no hay datos para saber cuál está en cada tienda, el cierre se bloquea en lugar de inventar movimientos. Los cierres históricos no se reescriben.

## 8. Contabilidad, caja y financiamiento

### 8.1 Costo de fabricación, costo de ventas e inventario

El costo medio de una opción de material se calcula con el valor y las cantidades disponibles de esa opción. El costo de material del lote usa las cantidades físicas de sus materiales realmente consumidos. La mano de obra y depreciación productiva se asignan por unidades producidas del ciclo.

```text
Costo de producción del ciclo = material consumido + mano de obra + depreciación productiva
Costo unitario de lote = costo asignado al lote / unidades fabricadas
Costo de ventas = Σ(unidades vendidas de cada lote × costo unitario de ese lote)
Inventario final PT = inventario inicial PT + costo fabricado − costo de ventas
```

Si no hay producción, mano de obra y depreciación ociosas se tratan como gasto, no se capitalizan en producto terminado. Los saldos históricos que solo tenían valor agregado mantienen el tratamiento compatible agregado. Los importes financieros se presentan redondeados a centavos.

### 8.2 Crédito de clientes

```text
Proporción a crédito = limitar entre 0 y 70 %
  (porcentaje inicial + 5 puntos × (ciclo − 1) + 5 puntos si hay analista)
Cuentas por cobrar nuevas = ingresos del ciclo × proporción a crédito
Cobros del ciclo = cuentas por cobrar pendientes del ciclo anterior
Ingreso de caja relacionado con ventas = ingresos − crédito nuevo + cobros anteriores
```

El porcentaje inicial predeterminado es 20 % y puede venir de la política financiera. Si el estado contiene un valor heredado `CREDITO_VENTAS.value`, el cierre lo utiliza en lugar de la fórmula predeterminada y lo limita al rango permitido. Cobrar una cuenta modifica caja y reduce cuentas por cobrar; no vuelve a crear ingresos por venta. El préstamo aumenta caja y deuda, no ventas.

### 8.3 Intereses, depreciación y garantías

La tasa efectiva del período se calcula a partir de TEA y meses:

```text
tasa período = (1 + TEA / 100)^(meses / 12) − 1
```

El cierre calcula intereses sobre deuda y préstamos de acuerdo con `financial_model.js` y la política vigente; la tasa predeterminada del servicio es TEA 20 %. La depreciación lineal usa por defecto vidas de 10 años para mesas y ensamblado, 8 para acabados y 5 para moldes, además del valor residual configurado. Se limita al saldo depreciable. En cierres marcados con la versión `md-20261027` se utiliza el tratamiento de la versión vigente del código.

La provisión de garantía se calcula como `unidades vendidas × costo configurado por unidad`. Los valores predeterminados son S/ 5 para 30 días y S/ 10 para 90 o 180 días; pueden cambiarse por política. La selección no debe confundirse con una devolución efectivamente pagada.

### 8.4 Estados financieros e impuesto

```text
Utilidad bruta = ventas netas − costo de ventas
Utilidad operativa = utilidad bruta − gastos administrativos − gastos de ventas
Utilidad antes de impuesto = utilidad operativa + ingresos financieros − gastos financieros
Utilidad neta = utilidad antes de impuesto − impuesto
Activos = efectivo + cuentas por cobrar + activos fijos + inventario MP + inventario PT + otros
Pasivo + patrimonio = deuda + obligaciones + provisiones + capital + resultados acumulados
```

Con una cantidad de ciclos configurada, el modelo acumula resultados antes de impuesto y calcula el impuesto en el ciclo final. Los parámetros predeterminados incluyen UIT S/ 5.500, tramo MYPE de 15 UIT al 10 % y excedente al 29,5 %; el régimen general del modelo usa 29,5 %. Son **parámetros del simulador**, pueden configurarse y no son una conclusión sobre la normativa aplicable a una empresa real.

## 9. Configuración, eventos y límites

El docente puede configurar capital, número y duración de ciclos y parámetros financieros; se respetan los valores aplicables al ciclo. Una sala puede tener eventos con efectos de demanda, costos o caja; su efecto exacto depende de la ruta que lo valide y registre. El ejecutor autoritativo rechaza eventos económicos no verificables, por lo que una descripción del catálogo no basta para asegurar que el evento se aplique.

Las decisiones, estado e inventarios del cierre anterior se usan para el siguiente ciclo: materiales, lotes y sus ubicaciones, efectivo, cuentas por cobrar, activos, deuda, provisiones y contador de reputación. El servidor reconstruye el cierre y no toma como definitivos los importes económicos manipulables enviados por el navegador. La interfaz del estudiante, el panel docente y el PDF presentan el cierre o sus estados financieros; una proyección previa no es el cierre definitivo.

**Estado de verificación:** la última ejecución comunicada aprobó 103 pruebas focales y el comparador local de Edge/servidor. Hay una prueba específica de la fórmula comercial literal y una prueba de tres ciclos con dos tiendas. Las salidas de Excel COM guardadas se reutilizaron en seis escenarios de producción, sin recalcular el libro completo. El oráculo histórico `tests/oracle_v19.cjs` usa una variante diferente y no acredita el cierre vigente; no se ha demostrado un porcentaje global de equivalencia. En la última comprobación de despliegue, la Edge Function estaba en versión 4 y GitHub Pages aún servía el JavaScript anterior; esa observación es temporal y no certifica la versión visible hoy.

## 10. Fuentes y ubicación del código

- **Libro y fórmulas:** `docs/referencias/DECISIONES_SIDE_19_original.xlsx`, en particular `Costos De Producción`, `Lotes_Produccion`, `Motor_Puntajes` y `Matriz_Consecuencias`; `docs/logica_excel/ESPECIFICACION.md` documenta discrepancias e interpretaciones. El original no se modifica.
- **Decisiones y sus costos:** `js/decision_catalog.js`, `js/decision_review_model.js`, `js/business_rules.js` y `js/side_rules.js`.
- **Producción y DOP:** `js/production_model.js`, `js/production_dop.js`.
- **Puntajes, calidad, consecuencias, mercado y ubicaciones:** `js/engine/catalogo_excel.js`, `js/engine/config.js`, `js/engine/cierre.js`.
- **Cierre y contabilidad:** `js/cycle_model.js`, `js/financial_model.js`, `services/partida_service.js`, `services/finance_config.js`.
- **Edge Function:** `supabase/functions/side-business-close/index.ts` y `runtime.mjs` generado a partir de los módulos locales.
- **Pruebas:** `tests/lotes_fifo_integrado.test.cjs`, `tests/consecuencias_cierre_real.test.cjs`, `tests/excel_calidad_comercial.test.cjs`, `tests/excel_cache_replay.test.cjs` y `tests/edge_lotes_equivalencia.test.cjs`.
- **Limitaciones de las comparaciones:** `reports/verificacion_consecuencias_lotes_20261028.md`.
