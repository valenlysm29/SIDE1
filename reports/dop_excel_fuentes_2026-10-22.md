# DOP por cantidad deseada: fuentes del Excel original

Fecha: 22/10/2026. Fuente leída sin sobrescribir: `.codex-work/DECISIONES_SIDE_16.xlsx`. SHA-256 antes y después: `3b6b42bbbc56a2534ce7e241c607d572dd38dcf02311683609497df36a0c1eb1`.

Se aplicó la skill `.agents/skills/xlsx/SKILL.md`: dos cargas independientes de openpyxl, una para fórmulas y otra para valores guardados (`data_only=True`). No se guardó un libro, no se ejecutó Excel COM y no se recalculó el original. Este informe distingue un valor guardado del original, una fórmula literal y una extensión algebraica propuesta; no convierte una extensión en una regla que el libro no contiene.

Entregables: `reports/dop_excel_casos_2026-10-22.json` contiene **14 casos**, los cambios de entrada, las salidas esperadas por fórmula, el valor originalmente guardado y la coordenada/fórmula de cada salida. Helpers y volcado de celdas: `.codex-work/dop-20261022/`. No se modificó código de producto.

## Resultado para implementar

**Sí hay una derivación directa de cantidad deseada a insumos brutos. No hay una derivación única de cantidad deseada a dotación, máquinas ni duración.** El DOP puede mostrar primero la cantidad solicitada y sus necesidades, sin consultar inventario. La cantidad que se puede fabricar con una dotación concreta constituye otra comprobación; no debe sustituir la cantidad deseada ni reducir sus necesidades materiales.

La hoja principal de requisitos es **`CANTIDAD DE PRODUCCIÓN`**. También existen exactamente `Costos De Producción`, `Lotes_Produccion`, `Motor_Puntajes` y `Matriz_Consecuencias`. Las dos primeras hojas tienen reglas de capacidad distintas; deben permanecer diferenciadas. No se fuerza una capacidad común para aparentar igualdad del oráculo histórico.

## 1. Cantidad deseada → materias primas

En `CANTIDAD DE PRODUCCIÓN`, D37/D38/D39 son entradas libres de cantidad por molde. D36 es `=SUM(D37:D39)`; el ejemplo guardado es 250 + 180 + 90 = **520** unidades. Las celdas de necesidad multiplican esas entradas directamente, sin leer existencias, compras, máquinas ni capacidad.

| Molde | Insumo por unidad y celda | Fórmula original de necesidad | Caché del ejemplo original |
|---|---|---|---|
| Básico | Cuero 0,3 m², D31 | D42 `=$D37*D31` | 75 m² |
| Básico | Accesorios 1, G31 | G42 `=$D37*G31` | 250 unidades |
| Básico | Hilo 6 m, J31 | J42 `=$D37*J31` | 1500 m |
| Mejorado | Cuero 0,4 m², E32 | E43 `=$D38*E32` | 72 m² |
| Mejorado | Accesorios 1, H32 | H43 `=$D38*H32` | 180 unidades |
| Mejorado | Hilo 7 m, K32 | K43 `=$D38*K32` | 1260 m |
| Premium | Cuero 0,7 m², F33 | F44 `=$D39*F33` | 63 m² |
| Premium | Accesorios 1, I33 | I44 `=$D39*I33` | 90 unidades |
| Premium | Hilo 13 m, L33 | L44 `=$D39*L33` | 1170 m |

La matriz D42:L44 también contiene productos con coeficientes vacíos que dan cero; no implica que cada molde consuma todos los niveles de material. En la misma hoja, la denominación del accesorio premium es “Metal Deluxe” (I28), mientras `Costos De Producción` solo presenta dos accesorios. La necesidad física de una unidad por bolso sí es inequívoca; asignarle automáticamente un precio o una calidad no lo es.

`Costos De Producción` reproduce los coeficientes en D38:F40, y usa cantidad deseada D46/D47/D48. H46 `=D38*D46`, I46 `=D46*E38`, J46 `=F38*D46`; las filas 47/48 hacen lo mismo para mejorado/premium. Su ejemplo solicita 150/140/95: H49 `=SUM(H46:H48)` = 167,5 m²; I49 = 385 accesorios; J49 = 3115 m. Estas necesidades tampoco parten de stock.

Las columnas L:N de esa hoja usan la producción efectuada E46:E48 y constituyen consumo posterior. **E46=150, E47=140 y E48=78 son entradas numéricas, no fórmulas que calculen la producción real.** No deben presentarse como una salida derivada automáticamente de la capacidad N5.

## 2. Dotación y maquinaria: cálculo directo, no inversa

En `CANTIDAD DE PRODUCCIÓN` la dotación ya es una entrada:

- Corte: F5:F7; productividad E5:E7 = **5/7/9** bolsos diarios por nivel. I5 `=E5*F5`; I8 `=SUM(I5:I7)`.
- Ensamble: trabajadores distribuidos por nivel y máquina en F11:H13. Productividad E11:E13 = **6/8/12**; multiplicadores F10:H10 = **1/1,2/1,5**. I11 `=SUM(F11*E11*$F$10,G11*E11*$G$10,H11*E11*$H$10)` y análogas; I14 `=SUM(I11:I13)`.
- Acabado: trabajadores distribuidos en F17:H19. Productividad E17:E19 = **6/7/10**; multiplicadores F16:H16 = **1/1,2/1,5**. I17 sigue la misma suma de productos; I20 `=SUM(I17:I19)`.
- K5 `=MIN(I8,I14,I20)` selecciona el cuello de botella diario. El ejemplo tiene 21 / 31,4 / 17,2: capacidad diaria **17,2**.
- L5 `=K5*24`: **412,8** unidades mensuales antes de eficiencia.
- M5 `=K7+(F7+F13+F19)/100+4%*F21`: eficiencia **0,96** en el ejemplo.
- N5 `=ROUND(L5*M5,0)`: **396** unidades en ese ejemplo.

Atención literal: M5 cuenta F7, F13 y F19, **no todas las celdas de operarios N3 en cualquier máquina**. L10 sí cuenta `=SUM(F7,F13:H13,F19:H19)`, pero M5 no usa L10. No se debe sustituir una fórmula por la otra silenciosamente. M5 tampoco impone un tope superior a la eficiencia.

El libro no contiene un objetivo de optimización, un desempate entre combinaciones, una fórmula de compra de máquinas desde cantidad, una asignación automática del nivel de operarios, un `CEILING` de trabajadores ni una restricción explícita de un operario por máquina adquirida. Elegir el mix más barato o el máximo nivel sería una regla nueva. Sí puede compararse una dotación **elegida explícitamente** usando las ecuaciones directas anteriores; un coste de personal de esa dotación sería un escenario condicionado, no el único requisito determinado por la cantidad.

## 3. Tiempo y límites

24 días es el factor explícito de `CANTIDAD DE PRODUCCIÓN!L5`. No hay horas por jornada, tiempo por operación del bolso ni duración inversa `cantidad / productividad` en estas hojas. Una división para estimar días sería una derivación adicional, condicionada por el mix y la eficiencia; no se documenta como fórmula original ni como un plazo único.

**No hay máximo de entrada de cantidad definido por validación Excel.** Las hojas `CANTIDAD DE PRODUCCIÓN` y `Costos De Producción` no tienen validaciones de datos. En `Lotes_Produccion` hay listas para segmento/materiales/molde, pero ninguna validación numérica de C2:C4. Por tanto 396 es la capacidad del ejemplo guardado, no el máximo global; 397 y 1000 siguen siendo cantidades deseadas con sus necesidades completas.

La asignación literal por capacidad es distinta de necesidades: E35 `=N5`; E37 `=ROUNDDOWN(D37*E35/D36,0)`, igual en E38/E39. En el ejemplo 520 reparte **190/137/68**, suma **395**, aunque N5 sea 396. Si se solicita solo una unidad básica con la dotación original, E37 da 396; la producción posterior D56 sí limita con D37. Si todas las cantidades son cero, estas tres divisiones dan `#DIV/0!`. Es legítimo que una interfaz maneje explícitamente el caso cero, pero no debe atribuir esa protección a la fórmula original.

D56 `=MIN(SUM(D49:F49)/D31,SUM(G49:I49)/G31,SUM(J49:L49)/J31,E37,D37)` y E56 `=ROUNDDOWN(D56,0)` ya son ejecución limitada por materiales disponibles. No se usan para arrancar el DOP de necesidades.

## 4. Contradicción entre las hojas de capacidad

| Regla | `CANTIDAD DE PRODUCCIÓN` | `Costos De Producción` |
|---|---|---|
| Corte E5:E7 | 5 / 7 / 9 | 6 / 8 / 12 |
| Acabado E17:E19 | 6 / 7 / 10 | 6 / 8 / 12 |
| Factor mensual L5 | `=K5*24` | `=K5*30` |
| Dotación guardada | 8 trabajadores, jefe F21=1 | 7 trabajadores, jefe F21=0 |
| Capacidad guardada N5 | 396 | 382 |

También difieren las dotaciones del ejemplo, por lo que no puede atribuirse la diferencia de 396/382 únicamente a los días. Se conservan ambas evaluaciones literales. Para necesidades por cantidad los coeficientes de molde coinciden; para capacidad inversa no existe una única regla que escoger en silencio.

## 5. Costos: qué define el libro y qué no

En `Costos De Producción`, V76:V83 son precios **por unidad productiva**: cuero 25/45/80 por m², accesorios 4/9 por unidad, hilo 2/4/7 por metro (unidades rotuladas en X76:X83). W76 `=V76-V76*8%` y siguientes aplican un 8 % de descuento. Un importe teórico de materia prima puede expresarse como necesidad bruta × precio de la calidad **que se seleccione explícitamente**; la selección de calidad no queda determinada por la cantidad ni solamente por el molde.

La conversión de compra a materia útil se define separadamente en D32:K32: **1/2/2 m²**, **1/1 accesorio**, **270/250/200 metros**; D33 `=D31*D32` y análogas. Invertir esta relación da una equivalencia fraccionaria, pero el libro no prescribe redondearla a rollos/carretes enteros.

Hay una contradicción adicional: AB82 `=4*6` y AC82 `=AB82-AB82*8%` dan 24 y 22,08 por 6 metros rotulados en AD82, mientras J31=6 compras y J33 `=J31*J32` da **1500 metros** al convertir 6 carretes de 250 m. Varias tablas de costos usan constantes incrustadas en vez de referencias a las cantidades del plan. No hay una fórmula enlazada y única de “cantidad deseada → compra redondeada → costo total”. Tampoco se puede cambiar el precio a “por carrete” sin una decisión expresa.

La nómina mensual sí tiene fórmulas por trabajador y régimen. Fuentes MYPE:

| Proceso | Nivel 1 | Nivel 2 | Nivel 3 |
|---|---|---|---|
| Corte | U11 = 1690,80 | U20 = 2254,40 | U29 = 4191,36 |
| Ensamble | Y11 = 1690,80 | Y20 = 3104,16 | Y29 = 4952,40 |
| Acabado | AC11 = 1690,80 | AC20 = 3104,16 | AC29 = 4952,40 |

Ejemplo literal: U6 `=U5*0.09`, U7 `=U5`, U8=750, U9 `=U5/2`, U10 `=SUM(U6:U9)+U5*12`, U11 `=U10/12.5`. Se respeta la fórmula del libro; no se sustituye por un cálculo normativo externo. Multiplicar el costo de cada trabajador por una dotación elegida es una agregación condicionada; no resuelve cuántos contratar para una cantidad.

Precios de adquisición: mesa U45=2500; ensamblado Y45/Y53/Y61 = 3500/7500/15000; acabado AC45/AC53/AC61 = 1200/4500/9500; moldes U53/U60/U67 = 300/1200/3500. Existen fórmulas de instalación, capacitación, mantenimiento y depreciación, pero no un selector único de cuántos equipos exige un pedido. Por ello los casos dejan el costo global en `null` en vez de inventar una compra mínima o partir del stock.

## 6. Lotes, puntajes y consecuencias

`Lotes_Produccion!C2:C4` son cantidades de entrada; C5 `=SUM(C2:C4)`. H2 suma los precios de catálogo de cuero, accesorios e hilo, sin multiplicar consumos de molde; H5 `=SUMPRODUCT(C2:C4,H2:H4)`. Esta cuenta no es la misma que valorar los metros/m² de las necesidades anteriores. No se fuerza igualdad entre ellas ni se presenta H5 como costo completo de manufactura.

`Motor_Puntajes!B6` es `=IFERROR(SUMPRODUCT(Lotes_Produccion!C2:C4,Lotes_Produccion!I2:I4)/SUM(Lotes_Produccion!C2:C4),0)`. B9/B10/B11 suman aportes de Seleccion_Ciclo0. Ninguno calcula operarios o máquinas a partir de cantidad.

`Matriz_Consecuencias!D4` describe 70 % de producción si eficiencia <4; D7 describe retraso/horas extra por producir sobre capacidad, **sin importe ni porcentaje de costo**; D8 describe inventario/almacenaje sin tarifa; D9 describe -5 % adicional sin jefatura y eficiencia <5. Son reglas textuales, no una inversa de planificación ni una tarifa para completar una cotización.

## 7. Casos y alcance de validación

Los 14 casos JSON cubren cero; una y diez unidades de cada molde; 396 y 397 con dotación original; mezcla de tres moldes; mezcla original de 520; mezcla que suma 396; premium 397; y 1000 unidades por encima del ejemplo. Para cada cambio de D37:D39 se listan nueve salidas de necesidad con su fórmula/celda y coeficiente fuente, D36 y las asignaciones E37:E39. `original_cached` es la caché auténtica del libro sin editar; `expected_after_input_change` es una evaluación aritmética de la fórmula indicada, **no una nueva caché recalculada por Excel**.

El caso de cero conserva `#DIV/0!` para las asignaciones literales, mientras sus necesidades brutas son cero. Todos los casos dejan en `null` mix requerido de personal, mix de máquinas, duración, máximo global, paquetes redondeados y costo total, porque el libro no los determina de forma única. Los insumos jamás se reducen por faltantes de almacén.

Pendiente exclusivamente para auditoría: recalcular copias de esos escenarios en Excel COM y contrastar las salidas con este JSON. El original permanece intacto. La auditoría puede usar el listado `inputs` para aplicar cambios y las coordenadas de salidas para leer el resultado, sin reinterpretar los casos ni añadir inversas.
