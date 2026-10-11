# Especificación Excel SIDE

Fuente: `DECISIONES SIDE (16).xlsx`, copiada exclusivamente a `.codex-work/DECISIONES_SIDE_16.xlsx`. El SHA-256 consta en `metadatos_excel.json`. Las 10 hojas se han volcado completas con coordenadas, fórmula literal, rango matricial y valor original en caché en `volcado_*.txt` y `celdas_excel.json`. El catálogo JSON contiene sus 68 opciones, incluidos los cuatro grupos nuevos.

## Evidencia y verificación independiente

Microsoft Excel 16.0 instalado permite recalcular mediante una instancia COM propia e invisible; no se usa ni modifica una instancia del usuario. `recalcular_fuente.ps1` conserva el original y recalcula una copia local. Estado de cálculo al guardar: 0 (terminado). LibreOffice no está en PATH ni en Program Files o el runtime; se usa Excel real como alternativa explícita. `fixtures_excel.json` identifica la procedencia de cada bloque; los lotes y selección del ejemplo se confirmaron en tests/oracle/esperado_base.json tras inyectar entradas y recalcular en Excel real.

### Discrepancias comprobadas frente a la transcripción

- El Excel original tiene lotes sin segmento, cantidad 0 y selección vacía. Por ello Motor tiene 0, no 6.2/17/8/-3; esos valores corresponden a un escenario que debe inyectarse. El catálogo y sus fórmulas reproducen los esperados del pedido.
- Los valores 2.1196/2.8571/3.2109/11.1876 del pedido están redondeados para presentación. Excel recalculado devuelve G65=11.187635078564613. Para paridad 1e-9 deben usarse los valores recalculados del JSON, no los textos abreviados ni caches de precisión truncada.
- Las fórmulas matriciales INDEX/MATCH de Seleccion_Ciclo0 y Lotes_Produccion apuntan a las filas 2:57, aunque el catálogo llega a 69. Los nuevos grupos requieren ampliar el lookup y extender la suma como manda la decisión 32; esto es una extensión autorizada, no una fórmula original.
- La hoja DECISIONES contiene nombres de cuatro grupos y encabezado Puntaje; los valores concretos están en Catalogo_Decisiones filas 58:69.
- El original contiene errores heredados de división por cero en la hoja CANTIDAD. Se enumeran en metadatos_excel.json. No deben atribuirse al motor ni ocultarse para declarar que todo el libro recalcula sin errores.
- CANTIDAD!K56:K58 son fechas, no calidad. CANTIDAD!C75 devuelve 700 por referencia equivocada. Reputación se toma de Costos!C65:G65.
- La cadena literal no coherente del Excel es `Este lote no alcanza la calidad que su segmento promete. Los clientes se sienten enganados: baja el precio efectivo y la reputacion.` (sin tildes). Los mensajes de Matriz_Consecuencias se han extraído literales a fixtures_excel.json; no usar versiones corregidas al comparar cadenas.
- Costos consume MP para la cantidad deseada (385) aunque produjo 368; por tanto consumos y valorización del fixture no son el consumo real de producción L49:N49. Este comportamiento debe conservarse en modo literal de hoja y diferenciarse del inventario generalizado del juego.

## Contrato de los archivos de evidencia

`catalogo_excel.json`: array con codigo, bloque, grupo, opcion, permanencia, descripcion, costo (número), costo_original, calidad, eficiencia, reputacion, financiero, notas y fila_excel. Los costos texto S/1,500 se normalizan a 1500 y conservan su texto original.

`fixtures_excel.json`: lotes_motor, produccion, costos, mercado_modelo1, mercado_modelo2 y consecuencias. Cada bloque conserva entradas/esperados y procedencia. Los rangos detallados permiten ubicar cada valor en la hoja. `celdas_excel.json` siempre conserva las caches originales; regenerarlo no sobreescribe el archivo fuente.

## Reglas consolidadas del pedido

Las tablas siguientes conservan las decisiones por defecto explícitas del usuario. Cuando el pedido generaliza o completa una regla inexistente, se distingue mediante la constante o PENDIENTE_DEFINIR indicada. No se afirma que esas extensiones sean fórmulas del archivo original.

## 2. Incoherencias y ambigüedades detectadas en el Excel (decisiones por defecto)

Implementa el **valor por defecto** indicado, déjalo configurable y lista TODO esto en el informe final para que el usuario confirme.

| # | Hallazgo | Evidencia | Decisión por defecto |
|---|---|---|---|
| 1 | **Días del ciclo distintos** | `CANTIDAD…!L5 = K5*24`; `Costos…!L5 = K5*30` | `DIAS_CICLO = 24` (hoja CANTIDAD). Los tests de la hoja Costos inyectan 30. |
| 2 | **Productividad por nivel distinta entre hojas** | CANTIDAD: corte 5/7/9, ensamble 6/8/12, acabado 6/7/10. Costos: 6/8/12 en las tres áreas | Tabla en config con default = hoja CANTIDAD; los tests inyectan la tabla de cada hoja. |
| 3 | **Eficiencia literal** `M5 = K7 + (F7+F13+F19)/100 + 4%*F21` cuenta solo la columna F (maquinaria manual) de N3 en ensamble/acabado, ignorando G y H; la nota B23 y `M10` hablan del % de N3 | CANTIDAD M5=0.96, Costos M5=0.91 | Implementar **literal** (para igualar el Excel). Flag `EFICIENCIA_N3_LITERAL=true`. Reportar. |
| 4 | Tope de eficiencia no definido (podría pasar de 1) | — | Sin tope (literal). Reportar. |
| 5 | **Dos "eficiencias" distintas**: factor de producción (~0.9) vs `Puntaje de Eficiencia` (suma de aportes 0–10) | `CANTIDAD!M5` vs `Motor_Puntajes!B9` | Mantener separadas con nombres distintos (`factorEficienciaProduccion`, `puntajeEficiencia`). CONS-03/CONS-08 usan **`puntajeEficiencia`**. |
| 6 | **Tres "reputaciones"**: aportes de catálogo (Motor), "ptos de reputación" operativos (`Costos!G65`), y la columna "Reputación (0-10)" de las tablas de ventas | — | `reputacionMatriz` = Motor (para CONS-04, niveles, ±2 de CONS-01/02). `reputacionMercado` = `Costos!G65` (config `REPUTACION_FUENTE_MERCADO = 'operativa'`; alternativa `'motor'`). **Decisión #1 para el usuario.** |
| 7 | La "Calidad (0-100)" de la tabla de ventas se calcula como `ROUND(rep/ΣRep*100)` (proxy de reputación, no calidad real) | `CANTIDAD!E128`, `Costos!E118` | Modo `excel_literal` solo para fixtures. En el juego: `calidadMercado = ROUND(MIN(100, calidadEmpresaMotor*10), 0)`. **Decisión #2.** |
| 8 | Las tablas de ventas usan reputación hasta 10.2 y `Reputación(0-100)=rep*10` puede dar 102 | `G130 = 102` | Sin tope (literal). Reportar. |
| 9 | **Escala "0–10 referencial" superada**: la calidad de un lote llega a 3+2+3+4 = **12**; Eficiencia del ejemplo = **17** | verificado con LibreOffice | Sin tope ni normalización (literal). Reportar: casi todo sale "Alto". |
| 10 | **CONS-01 (`Calidad < 4` y Premium) es inalcanzable** si el lote tiene los 4 componentes (mínimo = 1+1+1+1 = 4); solo ocurre si falta un componente (IFERROR→0) | `Lotes_Produccion!I` | Implementar literal. Lote Premium con 4 ≤ calidad < 7: resultado `"No alcanza el segmento"` + mensaje de `Lotes_Produccion!L`, **sin** efecto numérico (la Matriz no lo define). Reportar. |
| 11 | CONS-01/02 dicen "Precio de venta −35% / +40%" sin decir si afectan el puntaje de competitividad o solo el ingreso | Matriz | Afectan **solo el precio efectivo cobrado** (ingreso), no el puntaje de reparto de mercado. Se evalúan **por lote**; el efecto de Reputación (±2) se aplica **una vez por ciclo** (no se apila por lote). |
| 12 | CONS-03 (70 %) y CONS-08 ("−5 % adicional"): ¿suma o producto? | Matriz | Producto: `0.70 × 0.95 = 0.665` sobre la producción planeada. Constante `CONS08_MODO='multiplicativo'`. |
| 13 | CONS-06 (producción > capacidad) dice "horas extra" pero el Excel **topa** la producción a la capacidad (`E37 = ROUNDDOWN(D37*N5/D36)`) y no da cifras | Matriz vs CANTIDAD | Producción = tope del Excel. Costo extra de horas extra = `HORAS_EXTRA_PCT(0.25) × costoMOciclo × MIN(1, exceso/capacidad)`; `PENDIENTE_DEFINIR`. |
| 14 | CONS-07 (producción > demanda): "costo de almacenaje" sin cifra | Matriz | `COSTO_ALMACENAJE_UNIDAD = 2.00` S/ por unidad no vendida; `PENDIENTE_DEFINIR`. El inventario pasa al ciclo siguiente. |
| 15 | CONS-05: "el banco sube la tasa" sin cifra | Matriz | `+3` puntos porcentuales de TEA en el próximo préstamo; `PENDIENTE_DEFINIR`. |
| 16 | CONS-04 requiere **historial** (2 ciclos seguidos con Reputación < 3) | Matriz | Contador `ciclosReputacionBaja` por empresa (→ Supabase, §9). Demanda −20 % desde el ciclo en que se cumple. |
| 17 | `Costos…` "Suma anual" de MO suma el **Essalud de un solo mes** (`base×9%`) en vez de 12 meses | `U10 = SUM(U6:U9)+U5*12` | Literal. Flag `ESSALUD_ANUAL_LITERAL=true`. Reportar. |
| 18 | CTS **escrita a mano** (750 / 1500) en filas donde la fórmula pura sería `base/2` / `base`; Pago mensual = `anual/12.5` (MYPE) y `anual/13` (No MYPE) | `Y17`, `U26`, `U36`… | Literal (valores por rol en §5.3). Reportar. |
| 19 | Sueldos distintos entre catálogo y Costos: Cortador N2 **2500** (catálogo) vs **2000** (Costos); Maestro cortador **4000** vs **3800** | `RH-02`, `RH-03` vs `U14`, `U23` | MO usa los sueldos de **Costos** (hay detalle de cargas). El catálogo conserva su "costo referencial" solo como etiqueta. **Decisión #3.** |
| 20 | **Catálogo vs. hoja de producción**: el catálogo elige **una** máquina de ensamble/acabado y **un nivel** de personal por área; la hoja permite **mezclar** máquinas y **contar** trabajadores por nivel | Seleccion vs CANTIDAD | El motor acepta la matriz completa (nº de operarios por nivel × tipo de máquina). Si el juego solo elige nivel, agregar entradas de **cantidad de trabajadores por nivel y área**; la máquina elegida define el multiplicador (1.0 / 1.2 / 1.5) para toda el área. |
| 21 | Accesorios: CANTIDAD tiene **3 niveles** ("Metal Deluxe"); catálogo y Costos solo **2** | `I28` vs `INS-04/05` | Soportar 2 niveles (catálogo). Dejar la columna 3 desactivada por config. |
| 22 | Valor de MP comprada en la tabla "Lo que sea comprado por un equipo" (`AB76:AB84`) usa **unidades de compra** (55, 15, 6, 7) en vez de unidades de producción (110, 30, 1500, 1400) | `AB77 = 45*55` vs `V88 = 45*110` | Usar **unidades de producción × precio por unidad de producción** (tabla `V87:V94`). |
| 23 | Consumo de almacén `F54 = MIN(E54, H49)` ignora el **inventario inicial** (`D54`) | `Costos!F54:F61` | Generalizar a `MIN(inicial + compras, necesidad)`; con inventario inicial 0 equivale al Excel. |
| 24 | Descuento "por cantidad" fijo 8 % en `W76:W83` sin umbral | `V76*8%` | 8 % plano sobre precio de lista (`DESCUENTO_CANTIDAD=0.08`). Se acumula con 2 % (proveedor único, INS-09A) y 3 % (pago de contado, INS-10A) del catálogo de forma **multiplicativa**; `PENDIENTE_DEFINIR`. |
| 25 | Depreciación: el Excel solo define **línea recta** (residual 5 % MYPE / 10 % No MYPE; vida 10 años ensamble/mesa, 8 acabado, 5 moldes). "Unidades producidas" y "Acelerada" (FIN-02B/C) no tienen fórmula | `U49`, `AC49`, `U56` | Línea recta literal. Unidades producidas = `(costo−residual)×unidadesCiclo/unidadesVida` (`UNIDADES_VIDA` en config, `PENDIENTE_DEFINIR`). Acelerada = suma de dígitos de los años. Cuota por ciclo = anual / 12. |
| 26 | "Mantenimiento anual" de la maquinaria (5 %/8 % del costo) **y** política INF-11 (S/ 0/1500/3000 por ciclo) | Costos vs catálogo | Se aplican **ambos** (el primero /12 por ciclo, el segundo tal cual). **Decisión #4.** |
| 27 | `K56:K58` ("Calidad por Materiales") son fechas corruptas (`2026-05-01`…) | CANTIDAD | Ignorar. La calidad sale de `Lotes_Produccion` / `Motor_Puntajes`. |
| 28 | `CANTIDAD!C75 = F51*10` (Factor de producción) apunta a una celda equivocada y `E75 = #DIV/0!`; la versión sana está en `Costos!C65:G65` | CANTIDAD filas 75 y 123 | Usar la versión de **Costos** (§3.3.5). |
| 29 | Tres filas de mercado: modelo 1 (reputación + puntaje de precio, filas 82–119) y modelo 2 (pesos por segmento, filas 124–162) | — | El **modelo 2** es el vigente (el más reciente y parametrizado); el modelo 1 se conserva solo como fixture/legado. **Decisión #5.** |
| 30 | `Unidades vendidas = ROUND(...)` puede no sumar exactamente el mercado (Caros = 799 vs 800) | `J148` | Literal (sin reparto del resto). |
| 31 | Costos "texto" en el catálogo (`"S/1,500"`, `"S/5"`, `1` como entero) | `FIN-02*`, `COM-06*`, `INF-11*`, `INS-12*` | Normalizar a número al cargar; test de paridad de catálogo. |
| 32 | `Motor_Puntajes` suma solo `Seleccion_Ciclo0!G2:G15` (14 grupos); **no** incluye SEG-xx, INF-01 (mesa de corte, +1 Eficiencia), insumos INS-01…08 (aportan Reputación/Financiero), ni los 4 grupos nuevos de `DECISIONES` | Motor B9:B11 | Sumar los 14 grupos del Excel **más los 4 grupos de `DECISIONES`** (Depreciación, Garantía, Mantenimiento, Política de inventarios). SEG/INF-01/INS quedan fuera (literal) y se reportan. **Decisión #6.** |
| 33 | Productividad de **un solo ciclo = un mes**: "AL MES" | — | `CICLO_EQUIVALE_A_MESES = 1` en config (verifica contra el juego). |

---

## 3. Especificación funcional por hoja

> Notación: `Excel!celda`. "N" = nivel 1/2/3. Todas las fórmulas de abajo son las del Excel.

### 3.1 Catálogo y selección (`Catalogo_Decisiones`, `Seleccion_Ciclo0`)
- Cada opción = una fila con: `Código, Bloque, Grupo, Opción/Nivel, Permanencia, Descripción, Costo referencial, Aporte Calidad, Aporte Eficiencia, Aporte Reputación, Aporte Financiero, Notas`.
- `Seleccion_Ciclo0` busca por código: `INDEX(columna, MATCH(código, A2:A57, 0))` con `IFERROR(…,0)`.
- Grupos del Excel (filas 2–15, los que suman en Motor): Máquina de ensamblado, Máquina de acabados, Molde, Personal de corte, Personal de ensamble, Personal de acabados, Jefatura, Canal de venta, Acceso a préstamo bancario, Número de proveedores, Política de pago a proveedores, Lead time, Inversión en RR.HH., Inversión en marketing.
- Hoja `DECISIONES` pide **4 grupos nuevos** con su "Puntaje": Depreciación (FIN-02A/B/C), Garantía del producto (COM-06A/B/C), Mantenimiento de maquinaria (INF-11A/B/C), Política de inventarios (INS-12A/B/C). Súmalos al Motor (hallazgo 32).
- Decisiones numéricas: PRO-01 cantidad a producir, COM-02/03/04 tiendas por zona alta/media/baja, COM-05N % ventas a crédito, FIN-01M monto de préstamo.
- **Test de paridad de catálogo**: `decision_catalog.js` debe coincidir fila por fila con el Excel (código, grupo, costo, 4 aportes). Reporta cualquier diferencia y alinea el catálogo del juego al Excel.
- Reglas que viven en las **descripciones** (impleméntalas, son numéricas): INV-01B "+8 % de capacidad"; INV-02B "+12 % de demanda estimada"; INS-09A "2 % de descuento adicional"; INS-10A "3 % de descuento"; INS-11A lead time rápido "con sobrecosto"; GEN/SEG sin efecto en puntaje salvo lo indicado. Para los niveles "Alta/Baja" cuyo % no está dado → `PENDIENTE_DEFINIR` (reportar, no inventar).

### 3.2 Cantidad de producción (`CANTIDAD DE PRODUCCIÓN`)

**3.2.1 Capacidad de MO por día**
Por área, `capacidadÁrea = Σ niveles (productividad[N] × nº operarios[N] × multiplicadorMáquina)`.
- Corte: `I5 = E5*F5` (sin multiplicador; "Mesa de corte" = 1).
- Ensamble y acabado: `I11 = SUM(F11*E11*$F$10, G11*E11*$G$10, H11*E11*$H$10)` con `F10=1.0` (manual), `G10=1.2` (semi-industrial), `H10=1.5` (industrial). Igual en acabado con `F16:H16`.
- `I8 = SUM(I5:I7)` (corte), `I14 = SUM(I11:I13)` (ensamble), `I20 = SUM(I17:I19)` (acabado). (Ojo: la etiqueta de cada total está desplazada una fila; los valores son los de arriba.)
- **Cuello de botella:** `K5 = MIN(I8, I14, I20)` bolsos/día.
- `L5 = K5 × DIAS_CICLO`.

**3.2.2 Eficiencia y producción real**
- `M5 = K7 + (F7+F13+F19)/100 + 4%*F21` con `K7 = 0.9` (eficiencia base), `F21` = nº de jefes de producción (1 si RH-10A, 0 si RH-10B). Ver hallazgos 3–4.
- `N5 = ROUND(L5*M5, 0)` → **producción real del ciclo**. Nota del Excel (`O5`): *no puede ser superior a lo que permite el material*.
- Auxiliares: `L9 = SUM(F5:F7, F11:H13, F17:H19)` (total de trabajadores), `L10 = SUM(F7, F13:H13, F19:H19)` (N3), `M10 = L10/L9` (proporción de N3; usada en el factor de MO de reputación).

**3.2.3 Reparto de la capacidad por molde/lote** (`D36:E39`)
- `D36 = SUM(D37:D39)` (total que el jugador desea), `E35 = N5`.
- `E37 = ROUNDDOWN(D37*E35/D36, 0)` (y análogo E38, E39). Protege `D36 = 0`.
- Mapeo a SIDE: cada **lote** (hasta 3 por ciclo, `Lotes_Produccion`) es una fila `i`; el consumo unitario depende del **molde** del lote (§3.2.4).

**3.2.4 Materia prima por bolso** (`D31:L33`) — consumo según el nivel del molde:

| Molde | Cuero (m²) | Accesorios (u) | Hilo (m) |
|---|---|---|---|
| N1 Genérico básico | 0.3 | 1 | 6 |
| N2 Genérico mejorado | 0.4 | 1 | 7 |
| N3 Premium | 0.7 | 1 | 13 |

Unidades de compra → producción (`Costos!D32:K32`): rollo=1 m², piel completa=2 m², juego=1 u, carrete = 270 / 250 / 200 m según nivel de hilo (N1/N2/N3). Precios por unidad de producción = costos del catálogo (INS-01…08).

- Requerimiento (`D42:L44`): `=$D37*D31` (lote × consumo unitario).
- **Producción real por lote** (`D56:E58`):
  `D56 = MIN( SUM(cuero asignado al lote)/consumoCuero, SUM(accesorios asignados)/consumoAcc, SUM(hilo asignado)/consumoHilo, E37, D37 )` y `E56 = ROUNDDOWN(D56, 0)`.
  Consumo real: `G56 = E56*consumoCuero`, `H56 = E56*consumoAcc`, `I56 = E56*consumoHilo`.
  (En la hoja los insumos asignados al molde i están en `D49:L51`; en SIDE = insumos del lote tomados del inventario.)

**3.2.5 Inventario** (`D62:G71`): `InventarioFinal = InventarioInicial + Compras − Producido`. Por cada uno de los 9 insumos (cuero ×3, accesorios ×3, hilo ×3). El inventario **se arrastra** al ciclo siguiente.

**3.2.6 Publicidad:** `B73` = gasto del ciclo en publicidad (rango 0–10 000 S/).

### 3.3 Costos de producción (`Costos De Producción`)

**3.3.1 Costo de MO por trabajador** (`T4:AD39`), tabla por rol, columnas MYPE y No MYPE:
```
Essalud       = base × 9%
Grati         = base (MYPE)        |  base × 2 (No MYPE)
CTS           = (valor fijo del Excel, §5.3)
Vacaciones    = base / 2 (MYPE)    |  base (No MYPE)
Suma anual    = SUM(Essalud:Vacaciones) + base × 12
Pago mensual  = Suma anual / 12.5 (MYPE)  |  Suma anual / 13 (No MYPE)
```
Sueldos base: corte N1 1500 · N2 2000 · N3 3800 | ensamble N1 1500 · N2 2800 · N3 4500 | acabado N1 1500 · N2 2800 · N3 4500 | jefatura 3000 | limpieza 600. Local de producción: costo fijo 2000.
**Costo de MO del ciclo** = Σ (nº de trabajadores del rol × pago mensual) + jefatura (si RH-10A) + limpieza + local (× `CICLO_EQUIVALE_A_MESES`).

**3.3.2 Maquinaria y moldes** (`T42:AD71`), por equipo y columna MYPE / No MYPE:
```
Instalación       = adq × 3% | 5%             (la mesa de corte, ensamble y acabado; los moldes NO tienen)
Capacitación      = adq × 2% | 3%             (moldes: 1% | 2%)
Mantenimiento/año = adq × 5% | 8%
Depreciación/año  = −(adq − adq×5%) / vida   (MYPE)  |  −(adq − adq×10%) / vida  (No MYPE)
Suma anual        = adq + instalación + capacitación + mantenimiento + depreciación (negativa)
```
Vida: mesa y ensamblado 10 años · acabado 8 años · moldes 5 años.
Adquisición: mesa 2500 · ensamblado 3500/7500/15000 · acabado 1200/4500/9500 · moldes 300/1200/3500.
En el juego: adquisición + instalación + capacitación = salida de caja en la compra (Ciclo 0 o cuando se cambie de nivel); mantenimiento/12 por ciclo = costo; depreciación/12 por ciclo = gasto **no caja** según método elegido (hallazgo 25).

**3.3.3 Costo de MP** (`T73:AD100`)
- Precio por unidad de producción (cuero 25/45/80 S/m², accesorios 4/9 S/u, hilo 2/4/7 S/m) con **8 % de descuento** por cantidad: `W = V − V*8%` (hallazgo 24).
- Valor comprado = Σ (cantidad comprada en unid. de producción × precio). Valor consumido = Σ (cantidad usada × precio). **Valor del inventario final = comprado − consumido** (`V100 = V95 − AB96`; neto: `W100 = W95 − AC96`).

**3.3.4 Almacén y consumo** (`C52:H61`)
- Compras = comprado × factor de conversión (`D33 = D31*D32`).
- Consumo por jerarquía, **del nivel más bajo al más alto** hasta cubrir la necesidad `H49`:
  `F54 = MIN(E54, H49)`, `F55 = MIN(E55, H49 − F54)`, `F56 = MIN(E56, H49 − F54 − F55)` (igual para accesorios con `I49` y para hilo con `J49`).
  Necesidad total: `H49 = Σ lotes (consumoCuero × cantidad deseada)` (análogo `I49`, `J49`). Uso real: `L49:N49` con la cantidad realmente producida (`E46:E48`).
- Inventario final = inicial + compras − consumo (hallazgo 23).
- **Proporción de uso premium** (alimenta reputación): `H56 = F56/SUM(F54:F56)` (cuero N3), `H58 = F58/SUM(F57:F58)` (accesorios N2, el máximo), `H61 = F61/SUM(F60:F61)` (hilo N3). Protege división por 0.

**3.3.5 Reputación operativa** (`Costos!C65:G65`) — "ptos de reputación":
```
Factor de producción = (unidades producidas con molde N3 / total producido) × 10      (C65 = F48*10, F48 = E48/E49)
Factor de MO         = M10 × 10                                                        (D65)   // proporción de N3
Factor de MP         = AVERAGE(H56, H58, H61) × 10                                     (E65)
Factor de Publicidad = B63 / 10000 × 10                                                (F65)
Reputación operativa = SUM(C65:F65)                                                    (G65)
```
Ejemplo verificado: `2.1196 + 2.8571 + 3.2109 + 3 = 11.1876`.

### 3.4 Calidad por lote y Motor de puntajes (`Lotes_Produccion`, `Motor_Puntajes`)
- Por lote (hasta 3): `Segmento (SEG-01/02/03)`, `Cantidad`, códigos de **cuero, accesorios, hilo, molde**.
- `Costo unitario insumos (H) = Σ costo(cuero, accesorios, hilo)` — **excluye el molde** (es inversión fija de Ciclo 0).
- `Puntaje de Calidad del lote (I) = Σ aporteCalidad(cuero, accesorios, hilo, molde)`.
- `Umbral (J) = IFS(SEG-01→0, SEG-02→4, SEG-03→7, TRUE→0)`.
- `Resultado (K) = IF(seg="","", IF(I>=J,"Coherente","No alcanza el segmento"))`.
- Mensaje (L):
  - Sin segmento: "Elige un segmento y los insumos del lote".
  - Coherente: "Este lote cumple con la calidad esperada para su segmento. Los clientes perciben el valor y el precio se sostiene."
  - No coherente: "Este lote no alcanza la calidad que su segmento promete. Los clientes se sienten engañados: baja el precio efectivo y la reputación."
- Totales: `C5 = SUM(C2:C4)`, `H5 = SUMPRODUCT(C2:C4, H2:H4)` (costo total de insumos del ciclo).
- **Motor** (`Motor_Puntajes`):
  - `Calidad EMPRESA (B6) = IFERROR(SUMPRODUCT(cantidades, calidades)/SUM(cantidades), 0)` → promedio **ponderado por unidades**.
  - `Eficiencia (B9) = Σ aporteEficiencia`; `Reputación (B10) = Σ aporteReputación`; `Salud Financiera (B11) = Σ aporteFinanciero` (grupos de hallazgo 32).
  - **Nivel** (todas): `IF(v>=7,"Alto", IF(v>=4,"Medio","Bajo"))`.

### 3.5 Matriz de consecuencias (`Matriz_Consecuencias`) — 8 reglas

| ID | Puntaje | Condición | Efecto numérico | Mensaje al jugador (texto del Excel) |
|---|---|---|---|---|
| CONS-01 | Calidad | `< 4` y Segmento = Premium | Precio de venta **−35 %**, Reputación **−2** | "Posicionaste tu marca como premium, pero tus materiales e insumos no lo respaldan. Los clientes se sienten engañados y las devoluciones aumentan." |
| CONS-02 | Calidad | `>= 7` y Segmento = Premium | Precio de venta **+40 %**, Reputación **+2** | "Tu producto cumple con los estándares premium. Los clientes perciben el valor y pagan sin problema el precio elevado." |
| CONS-03 | Eficiencia | `< 4` | Producción real = **70 %** de lo planeado | "Tu equipo no dio abasto con el volumen que planeaste. Hubo retrasos y entregaste menos de lo prometido." |
| CONS-04 | Reputación | `< 3` durante **2 ciclos seguidos** | Demanda **−20 %** | "Tu marca empieza a perder terreno. Los clientes prefieren a la competencia." |
| CONS-05 | Salud Financiera | `< 3` | El banco **sube la tasa** del próximo préstamo | "Tu situación financiera es riesgosa. El banco te ofrece condiciones menos favorables la próxima vez." |
| CONS-06 | Producción vs Capacidad | Producida > capacidad instalada | Retraso de entrega, costo extra por horas extra | "Intentaste producir más de lo que tu planta soporta. Hubo cuellos de botella y tuviste que pagar horas extra para cumplir." |
| CONS-07 | Producción vs Demanda | Producida > demanda real del mercado | Inventario sin vender, costo de almacenaje | "Produjiste más de lo que el mercado te pidió. Te quedaste con inventario sin vender." |
| CONS-08 | Eficiencia | Jefatura = No **y** Eficiencia `< 5` | **−5 %** de producción adicional | "Sin jefatura que coordine, tu equipo perdió tiempo resolviendo conflictos de tareas." |

Implementación: `evaluarConsecuencias(estadoEmpresa, historial) → { efectos: {...}, mensajes: [{id, texto}] }`. Los mensajes se muestran al estudiante en el resumen del ciclo y quedan guardados en el resultado. Hallazgos 10–16 definen los detalles no explícitos.

### 3.6 Distribución de ventas (mercado) — **modelo 2 (vigente)**
Segmentos: SEG-01 Económico (tabla "Económicos"), SEG-02 Estándar ("Medio"), SEG-03 Premium ("Caros"). **Cada segmento reparte su propio mercado entre todas las empresas que venden en él.**

```
Mercado real del segmento  = unidades de mercado × penetración     // ej.: 7000×0.5=3500 · 5000×0.7=3500 · 2000×0.4=800
Reputación (0-100)         = reputaciónMercado × 10
Calidad (0-100)            = calidadMercado (hallazgo 7)
Pesos (precio / reputación / calidad):  Económico 0.7/0.2/0.1 · Estándar 0.4/0.35/0.25 · Premium 0.1/0.5/0.4
Puntaje de precio:
   Económico :  100 × (MAX(precios) − precio) / (MAX(precios) − MIN(precios))      // protege MAX=MIN
   Estándar  :  100 − ABS(precio − 100)/100 × 100      (precio ideal = 100)
   Premium   :  100 − ABS(precio − 250)/250 × 100      (precio ideal = 250)
Puntaje total   = wP×puntajePrecio + wR×Reputación(0-100) + wC×Calidad
Porcentaje      = puntajeTotal / Σ puntajesTotales
Unidades vendidas (asignadas) = ROUND(porcentaje × mercadoReal, 0)
```
Luego, por empresa: `ventas = MIN(asignado × (1 − 0.20 si CONS-04) × (1 + 0.12 si INV-02B), inventario disponible)`; el excedente de producción (CONS-07) queda en inventario; ingreso = ventas × precio efectivo (hallazgo 11).
Parámetros (mercado, penetración, pesos, precios ideales) **en config y editables por el profesor** si el panel ya tiene ajustes; si no, en config.
El **modelo 1** (`E83 = (MAX(precios)*2 − precio)/10`, `F = reputación + puntaje precio`, `G = F/ΣF`, `H = ROUND(G*mercado)`) se implementa como función auxiliar `repartoModelo1` **solo para pruebas de paridad**.

### 3.7 Orden de cálculo del cierre de ciclo (pipeline)
1. Cargar decisiones (si el jugador no decidió: eliminar si es el 1.er ciclo; replicar el ciclo anterior si no — ver §3.8).
2. Puntajes de decisiones (Motor): Eficiencia, Reputación, Salud; Calidad por lote y de empresa.
3. Capacidad de MO → `N5` → reparto por lote (`E37…`).
4. Producción real por lote con límite de MP (`D56…`).
5. Consecuencias que modifican producción: CONS-03, CONS-08 (y CONS-06).
6. Consumo de almacén, inventarios, valorización de MP.
7. Costos: MO, maquinaria (mantenimiento y depreciación), fijos, insumos, almacenaje (CONS-07), horas extra (CONS-06).
8. Reputación operativa (§3.3.5) + efectos CONS-01/02 → reputación final del ciclo; contador de CONS-04.
9. Reparto de mercado por segmento (§3.6) → ventas, ingresos, inventario final.
10. CONS-05 (tasa del próximo préstamo) y mensajes → estados financieros del ciclo.

### 3.8 Contexto del flujo (`FlujoWeb`) — respetar, no rehacer
Si ya está implementado, solo asegúrate de que las decisiones **replicadas** (jugador que no decide) pasen por el mismo motor; el docente puede eliminar jugadores; el resumen del ciclo muestra mensajes de consecuencias.

---



## Hallazgos adicionales comprobados

| # | Evidencia | Aplicación |
|---|---|---|
| 34 | Costos!F55 consume 107.5 m² INS-02, pero AB89 usa fórmula fija `=45*107`. El total 24580 de AB96 es por tanto distinto de valorar el consumo físico, que da 24602.5. | Paridad de tabla conserva 107 como entrada del ejemplo; inventario generalizado del juego usa consumo real. No sustituir silenciosamente la tabla del archivo. |
| 35 | Costos!H61 = F61/SUM(F60:F61) excluye hilo N1 (F59) del denominador. | `REPUTACION_HILO_DENOMINADOR_LITERAL=true`. El fixture original no detecta diferencia porque F59=0. |

## Oráculo independiente disponible

`tests/oracle/run_oracle.py base --construir --comparacion` copia las diez hojas del archivo original, conserva fórmulas matriciales e inyecta los tres lotes y las catorce selecciones. Microsoft Excel 16.0 recalcula y exporta 351 salidas con precisión completa a `esperado_base.json`: 96/51/31; calidad12/5/4; costo28000; CalidadEmpresa6.2; Eficiencia17; Reputación8; SaludFinanciera-3 confirmados.

`ORACULO_SIDE_paridad.xlsx` contiene hoja SIDE vs Excel. Hasta cargar `obtenido_base.json`, las filas de SIDE están explícitamente pendientes. Las hojas adicionales `Consecuencias_Oracle` y `Mercado_Oracle` contienen fórmulas generalizadas separadas de las diez originales. Las extensiones no prueban por sí solas un cierre de ciclo completo ni las tres simulaciones de interfaz.


## Paridad multiciclo completada

El oráculo independiente de SIM-2 usa seis filas empresa-ciclo y diez filas de lotes: dos lotes de B en ciclos 1/2 (calidad2 y4), cambio de identidad en ciclo3, materiales consumidos secuencialmente y venta FIFO del inventario Premium anterior mientras el lote Estándar no tiene MP. Tras recálculo en Excel real, las 282 salidas coinciden con SIDE.

SIM-3 usa doce filas empresa-ciclo: cinco empresas iniciales, E eliminada al no decidir, cuatro activas durante tres ciclos y réplica de B en ciclo2. Excel recalcula y compara 564 salidas, incluidas capacidad, puntajes, MP individual, MO MYPE/No MYPE, descuentos, los tres métodos de depreciación, decisiones recurrentes, mercado, ventas, ingresos, inventarios, costos y utilidad. Resultado: cero diferencias.

Una discrepancia detectada por la prueba de enteros exactos fue consumoCuero=21.000000000000004 frente a21 del Excel; se normalizó el consumo agregado del pipeline a quince cifras significativas, precisión de Excel. No se relajó la tolerancia para ocultarla.

Las comprobaciones de navegador se documentan por el agente principal; estas pruebas de oráculo y Node no se presentan por sí mismas como evidencia de UI.


## Ampliación verificada de SIM-1 y banca

SIM-1 ahora se cierra también como pipeline: cuatro empresas, tres lotes por empresa, tres mercados y perfiles personales de producción. Se conservan las 351 comprobaciones originales por componentes porque los perfiles de costos y lotes del ejemplo son independientes. El pipeline de SIM-1 añade 336 comparaciones independientes, incluidos siete resultados de mercado por empresa y segmento, detalle de cada lote y cuatro campos de financiamiento; cero diferencias.

Banca se comprueba también en SIM-2 (306 comparaciones) y SIM-3 (612 comparaciones). El escenario adicional BANCA tiene 153 comparaciones: salud -1 sin préstamo guarda +3pp; salud recuperada10 y ausencia de préstamo conserva +3pp; salud8 con préstamo5000 aplica TEA23 (base20+3), deuda5000 y limpia la penalización para el préstamo siguiente. Estos criterios son extensiones autorizadas, no fórmulas del Excel original.

La hoja SIDE vs Excel reúne 1814 comparaciones y cero diferencias:351base+336SIM1+306SIM2+612SIM3+153banca+56consecuencias. Los escenarios y sus parámetros se exportan antes del cálculo; las columnas esperadas vienen exclusivamente del recálculo Excel COM.

`tests/fixtures_excel.cjs` centraliza entradas de producción, personal, precios y reputaciones de mercados dorados, lotes y selección. Rechaza fórmulas como entradas literales. Las pruebas de base/costos y la UI pueden usar el mismo cargador sin consultar resultados esperados.
