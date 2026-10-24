# Auditoría A: Excel, fase 0 (solo lectura)

Fuente disponible: `.codex-work/DECISIONES_SIDE_16.xlsx`, SHA256 `3b6b42bbbc56a2534ce7e241c607d572dd38dcf02311683609497df36a0c1eb1`. No se encontró v18 en docs ni en el inventario del proyecto. El usuario autorizó al integrador usar v16. No se modificó ningún libro ni código. Se leyeron informes previos, especificación y git log. Skill aplicada: `.agents/skills/xlsx/SKILL.md`.

Dos cargas nuevas openpyxl, una con fórmulas y otra con valores almacenados. Evidencia exhaustiva: `reports/auditoria_A_excel_fase0_20261024.json`, con todas las celdas no vacías de las diez hojas, fórmula/literal, caché y tipo. Son 3047 celdas, 871 fórmulas. Esta auditoría no presenta cachés como un recálculo fresco. LibreOffice no está en PATH ni en las dos ubicaciones estándar de Windows. Python del sistema no tiene openpyxl; el Python del runtime Codex sí tiene openpyxl 3.1.5. Hay scripts de Excel COM y evidencia histórica de recálculo, que no sustituyen una nueva ejecución.

## Diccionario de lógica

| Hoja/bloque | Entradas | Fórmulas y constantes | Salidas |
|---|---|---|---|
| Instrucciones | Ninguna | Nueve celdas de texto | Instrucciones de selección y simulación |
| DECISIONES | Ninguna | Seis celdas de texto | Organización de decisiones |
| Seleccion_Ciclo0 | B2:B15: códigos elegidos | INDEX/MATCH al catálogo; C:D descripción, E costo, F:I aportes | 98 fórmulas; costos y aportes elegidos |
| Catalogo_Decisiones | A2:L69, 68 opciones | G costo, H calidad, I eficiencia, J reputación, K financiero; L notas. Once fórmulas simples `=+1`/`=+2` | Parámetros maestros por código |
| FlujoWeb | Modo docente automático/manual y decisiones | Texto B37 primera omisión elimina; B38 docente elimina en cualquier momento; B39 siguientes omisiones replican | Estados por ciclo, financieros, podio y aviso 24h E28 |
| CANTIDAD, capacidad | Personal por área/nivel y jefatura | 24 días L5=K5*24; N5=ROUND(L5*M5,0), eficiencia base 90% con mejoras; cuello de botella de áreas | Capacidad de planta |
| CANTIDAD, asignación | Cantidades deseadas por lote D37:D39 | E37=ROUNDDOWN(D37*E35/D36,0), análogas | Capacidad asignada; riesgo división por cero si total deseado es cero |
| CANTIDAD, producción | MP física disponible y consumo unitario por lote, capacidad asignada y deseado | D56=MIN(SUM(D49:F49)/D31,SUM(G49:I49)/G31,SUM(J49:L49)/J31,E37,D37); E56=ROUNDDOWN(D56,0) | Producción limitada por insumos/capacidad/plan |
| CANTIDAD, reputación histórica | F51, M10, H65/H68/H71 y B73 publicidad | C75=F51*10; D75=M10*10; E75=AVERAGE(H65,H68,H71)*10; F75=B73/10000*10; G75=SUM(C75:F75) | Reputación sin escala coherente; C75 da 700 con F51=70; E75/G75 tienen error |
| CANTIDAD, mercado v1 | Precios y reputaciones de 4 empresas | PrecioScore=(2*MAX(precios)-precio)/10, puntaje=suma reputación+precio, participación relativa | Demanda; obsoleto por decisión del usuario |
| CANTIDAD, mercado v2 | Precios C128:C131, reputaciones D128:D131, calidad E128:E131; bloques siguientes filas141:144,154:157 | Económico pesos .7/.2/.1, mercado7000*.5; Medio .4/.35/.25,5000*.7 ideal100; Premium .1/.5/.4,2000*.4 ideal250 | PrecioScore, puntaje H, participación I, unidades J; calidad actualmente deriva erróneamente de reputación |
| Costos De Producción | Personal, régimen laboral, maquinaria, materiales, activos | 503 fórmulas. Nómina con beneficios/cargas según régimen; valoración de MP, activos/depreciación. Capacidad usa 30 días y productividades divergentes. Duplica mercado/reputación | Costos laborales, maquinaria, MP, activos y ejemplos de mercado |
| Lotes_Produccion | B segmento,C unidades,D cuero,E accesorio,F hilo,G molde, filas2:4 | H suma costo cuero+accesorio+hilo (excluye molde); I suma cuatro aportes calidad; J umbral0/4/7; K coherencia; C5 SUM(C2:C4), H5 SUMPRODUCT(C2:C4,H2:H4) | Calidad/costo por lote y mensajes; sin precio |
| Motor_Puntajes | Lotes y aportes selección | B6=SUMPRODUCT(cantidades,calidades)/SUM(cantidades), protegido IFERROR; B9/B10/B11 suman eficiencia/reputación/financiero. Alto>=7, Medio>=4 | Calidad ponderada y tres puntajes sin tope |
| Matriz_Consecuencias | Puntajes, segmento, historia, capacidad, demanda | Ocho reglas exclusivamente textuales, ninguna fórmula | CONS01 precio*.65/reputación-2;02 precio*1.4/reputación+2;03 producción*.7;04 demanda*.8 dos ciclos reputación<3;05 tasa sube;06 retraso/extra;07 inventario/almacenaje;08 producción*.95 sin jefe y eficiencia<5 |

## E1–E11 y hallazgos adicionales

| ID | Dictamen y evidencia |
|---|---|
| E1 | Confirmado: 68 opciones hasta fila69; 97 fórmulas de búsqueda truncadas en Seleccion y seis en Lotes. Extender todos los rangos coordinadamente. |
| E2 | Parcial precisión: `=+1` y `=+2` SON fórmulas reales tipo f y tienen cachés numéricas 1/2; no texto literal en esta fuente. Doce costos G58:G69 sí son cadenas monetarias. Normalizar fórmulas constantes a números es válido, pero no afirmar que Excel actualmente las interpreta como texto. |
| E3 | Confirmado: no hay precio en Lotes ni selección. Sí hay precios de ejemplo en mercado, sin vínculo a decisiones de lote. |
| E4 | Confirmado: dos generaciones duplicadas. v2 permite integrar calidad y pesos; no se encontró motivo para preferir v1. |
| E5 | Confirmado: E128 deriva de D128/D132, E141 usa D132 ajeno, E154 igual; mercados reales B136/B149/B162 literales; score económico sin empate, otros sin límites; falta MIN con stock y filtro de producción. |
| E6 | Confirmado y más grave: C75=700 con ejemplo de producción70, fuera de escala. E75 y G75 ya tienen caché #DIV/0!, repetidos E123/G123. Usar única reputación del catálogo acotada elimina mezcla unidades/porcentajes. |
| E7 | Confirmado: 24 vs30 días y productividades distintas por área/nivel. Canonizar CANTIDAD según instrucción. |
| E8 | Confirmado: K56:K58 son datetime 2026-05-01,2026-03-01,2026-02-01. No reinterpretar fechas como cocientes sin evidencia; vincular calidad a Lotes. |
| E9 | Confirmado: B9:B11 sumas sin límite y calidad puede exceder10. Premium umbral7 pero CONS01 solo<4. Aplicar penalización a todo Premium<7 requiere supuesto explícito. |
| E10 | Confirmado: ninguna consecuencia contiene fórmula. Tarifas horas extra, almacenaje y aumento bancario no están cuantificadas. |
| E11 | Confirmado: hay texto parcial y aportes, pero no sistema completo de demanda/crédito/caja. Supuestos deben estar separados de fórmulas originales. |

Adicionales: (1) división por cero al dejar cantidades planeadas todas en cero E37:E39; (2) IFS sin prefijo en J2:J4 ocasionó #NAME? en recálculos anteriores, cambiar a IF anidados por compatibilidad; (3) v1 Medio usa mercado económico en H97:H100; ambos ejemplos valen3500 y ocultan el error; (4) Costos H61 excluye hilo N1 del denominador de reputación; (5) valoración de hilo por carrete vs metro y cuero AB89=45*107 frente a consumo107.5 divergen de consumo físico; (6) no hay ledger completo de caja ni calendario de cobro en el libro original, las extensiones deben declararse.
