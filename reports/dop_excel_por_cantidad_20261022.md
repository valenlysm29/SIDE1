# DOP por cantidad: lectura independiente del libro original

Fecha: 22/10/2026. Subagente Excel. Se aplicó `.agents/skills/xlsx/SKILL.md` y se leyó `.codex-work/DECISIONES_SIDE_16.xlsx` con dos cargas de openpyxl, fórmulas y caché por separado. SHA-256 confirmado: `3b6b42bbbc56a2534ce7e241c607d572dd38dcf02311683609497df36a0c1eb1`. No se modificó el original. La caché original no contiene celdas de error.

## Dependencias de la cantidad deseada

Las entradas son `CANTIDAD DE PRODUCCIÓN!D37:D39` (básico, mejorado, premium). `D36=SUM(D37:D39)`. Sus requisitos físicos dependen directamente de estas cantidades, sin consultar stock ni capacidad:

| Molde | Cuero m² | Accesorios unidad | Hilo m |
|---|---|---|---|
| Básico | D42 `=$D37*D31`; D31=0,3 | G42 `=$D37*G31`; G31=1 | J42 `=$D37*J31`; J31=6 |
| Mejorado | E43 `=$D38*E32`; E32=0,4 | H43 `=$D38*H32`; H32=1 | K43 `=$D38*K32`; K32=7 |
| Premium | F44 `=$D39*F33`; F33=0,7 | I44 `=$D39*I33`; I33=1 | L44 `=$D39*L33`; L33=13 |

No aparece redondeo en estos nueve requisitos. Las existencias entran después en D56 y análogas: `=MIN(SUM(D49:F49)/D31,SUM(G49:I49)/G31,SUM(J49:L49)/J31,E37,D37)`. D56 es ejecución restringida, no la necesidad bruta del plan.

`Costos De Producción!D46:D48` también son cantidades deseadas. Los coeficientes D38:F40 coinciden con los anteriores y H46:J48 multiplican cantidad por coeficiente. E46:E48, la producción efectuada, son entradas numéricas; no son fórmulas de limitación automática.

## Capacidad, personal, maquinaria y tiempo

La dotación es entrada del Excel. Corte: E5:E7=5/7/9 y F5:F7 son trabajadores; I8 suma E×F. Ensamble: E11:E13=6/8/12; F11:H13 distribuyen trabajadores por máquina; F10:H10=1/1,2/1,5. Acabado usa E17:E19=6/7/10 y el mismo esquema de multiplicadores. `K5=MIN(I8,I14,I20)`, `L5=K5*24`, `M5=K7+(F7+F13+F19)/100+4%*F21`, `N5=ROUND(L5*M5,0)`. La caché original da 17,2 por día, 412,8 antes de eficiencia, 0,96 de eficiencia y 396 de capacidad mensual.

El libro no contiene inversa única desde cantidad hacia contratación, compra de maquinaria ni duración; tampoco optimización del mix ni redondeo de trabajadores o paquetes. No se puede etiquetar una combinación inventada como recomendación exacta del Excel. Para mostrar costos de personal/máquinas se necesita una dotación explícita y se deben identificar como costo de ese escenario.

No hay máximo global de cantidad validado en el libro. Se usa 396 como borde de capacidad del ejemplo, no como máximo permitido. Cantidades mayores conservan sus necesidades completas.

## Costos y límites de la fuente

`Costos De Producción!V76:V83` contiene precios por m², accesorio y metro: cuero 25/45/80, accesorios 4/9, hilo 2/4/7. W76 y siguientes aplican descuento del 8 %. D32:K32 convierte compras a material útil (cuero 1/2/2 m², accesorios 1/1, hilo 270/250/200 m). No hay una fórmula que obligue a redondear a paquetes enteros.

Costos mensuales MYPE por persona: corte U11/U20/U29=1690,8/2254,4/4191,36; ensamble Y11/Y20/Y29=1690,8/3104,16/4952,4; acabado AC11/AC20/AC29=1690,8/3104,16/4952,4. Ejemplo de fórmula: U10 `=SUM(U6:U9)+U5*12`, U11 `=U10/12.5`. Las tarifas por persona no determinan cuántas personas contratar.

`Motor_Puntajes!B6=IFERROR(SUMPRODUCT(Lotes_Produccion!C2:C4,Lotes_Produccion!I2:I4)/SUM(Lotes_Produccion!C2:C4),0)` pondera puntaje por cantidad, sin calcular dotación. `Matriz_Consecuencias!D7` anuncia horas extra por sobrecapacidad, pero no fija tarifa ni porcentaje. D8 anuncia costo de almacenaje sin tarifa. No se inventaron importes.

## Discrepancias y errores del propio Excel

| Tema | CANTIDAD DE PRODUCCIÓN | Costos De Producción | Criterio |
|---|---|---|---|
| Días mensuales L5 | K5×24 | K5×30 | Conservar por hoja; no unificar silenciosamente |
| Corte E5:E7 | 5/7/9 | 6/8/12 | No afirmar que ambas capacidades son equivalentes |
| Acabado E17:E19 | 6/7/10 | 6/8/12 | Igual criterio |
| Cantidad cero | E37:E39 dividen por D36=0 | No define protección equivalente | UI puede tratar plan vacío como vacío; reportar divergencia de protección |
| Asignación por mezcla | 520 pedidos → 190/137/68=395, capacidad 396 | Otra muestra independiente | No redistribuir unidad restante mediante un algoritmo inventado |

M5 cuenta solo F7/F13/F19 para el bono N3; no todos los trabajadores N3 de otras máquinas. L10 sí suma F7,F13:H13,F19:H19 pero M5 no lo referencia. La fórmula no limita eficiencia a 100 %. El accesorio premium se llama Metal Deluxe en `CANTIDAD DE PRODUCCIÓN!I28`, mientras Costos tiene dos accesorios. AB82=4×6 valora 6 metros de hilo; J31=6 y J32=250 representan seis carretes, 1500 metros en J33: no tratar ambos importes como la misma compra.

## Casos de prueba independientes

Resultados aritméticos de las fórmulas anteriores. Las tres últimas columnas suman requisitos de cada molde para facilitar lectura; los nueve resultados por celda siguen siendo las multiplicaciones descritas. Sin stock, sin descuento de capacidad, sin redondeos adicionales.

| Caso | Básico | Mejorado | Premium | Cuero m² | Accesorios | Hilo m |
|---|---:|---:|---:|---:|---:|---:|
| Cero | 0 | 0 | 0 | 0 | 0 | 0 |
| Mínimo básico | 1 | 0 | 0 | 0,3 | 1 | 6 |
| Mínimo mejorado | 0 | 1 | 0 | 0,4 | 1 | 7 |
| Mínimo premium | 0 | 0 | 1 | 0,7 | 1 | 13 |
| Diez básicos | 10 | 0 | 0 | 3 | 10 | 60 |
| Diez mejorados | 0 | 10 | 0 | 4 | 10 | 70 |
| Diez premium | 0 | 0 | 10 | 7 | 10 | 130 |
| Capacidad del ejemplo | 396 | 0 | 0 | 118,8 | 396 | 2376 |
| Superior a capacidad | 397 | 0 | 0 | 119,1 | 397 | 2382 |
| Mezcla mínima | 1 | 1 | 1 | 1,4 | 3 | 26 |
| Mezcla original | 250 | 180 | 90 | 210 | 520 | 3930 |
| Mezcla a capacidad | 200 | 100 | 96 | 167,2 | 396 | 3148 |
| Premium sobre capacidad | 0 | 0 | 397 | 277,9 | 397 | 5161 |
| Muy superior a capacidad | 1000 | 0 | 0 | 300 | 1000 | 6000 |

Este informe no afirma que las 14 filas hayan sido recalculadas ahora con COM. El agente integrador gestiona ese recálculo real y el oráculo. Se dejó `.codex-work/dop_quantity_excel_review.py` como auxiliar local capaz de generar un fixture desde nombres de hoja originales. Su ejecución se detuvo tras el primer caso para evitar dos procesos de recálculo simultáneos. Los JSON deben leerse con `encoding='utf-8'` explícito en Windows: usar la codificación local predeterminada puede producir mojibake aparente aunque los archivos sean correctos.
