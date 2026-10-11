# Integración de lógica Excel SIDE — 11 de octubre de 2026

## Estado de entrega

Se implementó un motor puro compatible con Node y navegador y un **piloto local de activación opcional** para editar lotes, previsualizar producción y consultar resultados. Esta entrega todavía **no cumple la aceptación integral** del pedido: el cierre conectado de Supabase no utiliza el motor nuevo y las finanzas de caja/balance del juego anterior permanecen separadas de los resultados económicos Excel. La evidencia de fórmulas individuales no sustituye la prueba del flujo completo conectado.

**Push: no realizado.** No debe publicarse mientras persistan los incumplimientos, las verificaciones pendientes o hallazgos críticos de revisión. Los cambios ajenos que ya existían en modelos, capturas y reportes deben conservarse fuera de los commits de esta tarea.

## Implementación por hoja

| Fuente | Implementación y alcance real |
|---|---|
| Catalogo_Decisiones / Seleccion_Ciclo0 | `js/engine/catalogo_excel.js` conserva las 68 filas y normaliza costos; `puntajes.js` valida una opción por grupo. El catálogo anterior de `js/decision_catalog.js` conserva IDs y costos de su jugabilidad, con metadatos Excel añadidos. Por tanto **el catálogo de jugabilidad anterior no quedó alineado fila por fila**. |
| CANTIDAD DE PRODUCCIÓN | `produccion.js`: matrices de personal, 24 días, cuello de botella, eficiencia literal, reparto truncado, restricciones por insumo/lote, conversiones de compra e inventario. El adaptador piloto no sustituye toda la producción anterior. |
| Costos De Producción | `costos.js`: cargas laborales literales MYPE/No MYPE, CTS manual, mantenimiento y depreciación, valorización MP, jerarquía de almacén y reputación operativa. Adquisición/instalación/capacitación se detallan por separado; falta conciliarlas con la caja y activos del flujo conectado. |
| Lotes_Produccion / Motor_Puntajes | Calidad por lote, umbrales y mensajes; calidad ponderada de empresa; eficiencia, reputación y salud; niveles Alto/Medio/Bajo sin normalizar puntajes. Se incluyen cuatro grupos adicionales conforme al pedido. |
| Matriz_Consecuencias | Ocho reglas en `consecuencias.js`; efectos por lote, reputación una vez por regla/ciclo, penalización productiva multiplicativa, historial y tasa futura. La conservación literal de textos incluye errores ortográficos del archivo. |
| Ventas | `mercado.js`: modelo 2 por segmento y modelo 1 solo de contraste. `ciclo.js` reúne empresas, replica decisiones, elimina al no decidir inicialmente, vende stock anterior y conserva inventarios. |
| Instrucciones / DECISIONES / FlujoWeb | Contexto conservado; editor local optativo en `ui_excel.js`. El cierre remoto y la contabilidad general requieren trabajo adicional. |

Los archivos del proyecto y temporales permanecen en SIDE1. La fuente se copió a `.codex-work/DECISIONES_SIDE_16.xlsx`, sin modificar el archivo de Descargas. No se debe añadir esa copia a Git; queda por confirmar si el usuario desea versionar el Excel original. Los oráculos derivados son entregables solicitados.

## Evidencia y paridad

El original se leyó con dos cargas de openpyxl para distinguir fórmulas y valores en caché. Las diez hojas completas, rangos matriciales, catálogo y fixtures están en `docs/logica_excel/`. La copia recalculada usa **Microsoft Excel COM 16.0**, en una instancia propia invisible. LibreOffice no se encontró instalado; se documentó esta alternativa en vez de afirmar que se utilizó.

`ORACULO_SIDE.xlsx` parte de las diez hojas originales. `ORACULO_SIDE_paridad.xlsx` añade la comparación. Las fórmulas generalizadas de consecuencias y mercado se identifican como extensiones; sus resultados no demuestran por sí solos todos los componentes de un cierre multiciclo.

Los caches abreviados del original y los números de presentación del pedido no se consideran verdad de precisión completa. Ejemplo: reputación operativa se presenta como 11.1876, mientras Excel recalculado entrega aproximadamente 11.187635078564613. La comparación usa enteros exactos y tolerancia relativa `1e-9` para decimales.

| Verificación | Excel | SIDE | Estado al redactar |
|---|---|---|---|
| Costos base, 139 celdas | `tests/oracle/esperado_base.json` | `obtenido_costos.json`, calculado con motor y entradas literales | **139 comparadas; 0 diferencias** |
| Base completo, 351 celdas | `esperado_base.json` | `obtenido_base.json` | PENDIENTE: consignar ejecución final de `tests/paridad_base.cjs` |
| SIM-1: base UI con cuatro empresas | Oráculo base y mercado por segmento | Runner navegador | PENDIENTE: resultado final y ruta de evidencia |
| SIM-2: dos empresas y tres ciclos | Fórmulas independientes de consecuencias y premium; no oráculo integral de dos lotes cambiantes | `tests/escenarios_excel.cjs`, motor y runner navegador | Las ocho reglas pasan tests; **paridad integral de simulación pendiente/no demostrada** |
| SIM-3: cinco empresas y tres ciclos | `ORACULO_sim3.xlsx`, fórmulas generalizadas de un lote por empresa | `comparar_pipeline.cjs` y runner navegador | PENDIENTE: consignar comparación final, cobertura y diferencias |
| Unitarios de costos | Fixtures originales | `tests/costos_excel.test.cjs` | **8/8 pasan** |
| Invariantes del ciclo | Reglas y conservación de existencias | `tests/ciclo_excel.test.cjs` | **6/6 pasan** |
| Resto de tests del motor y UI | Fixtures y contratos | `tests/*_excel.test.cjs` | PENDIENTE: número final consolidado |
| Regresión existente y revisión independiente | Flujo anterior | Runner y revisor final | PENDIENTE: resultado final |

No hay autorización para declarar «tres simulaciones con cero diferencias» hasta que la evidencia cubra todas las cifras del motor, la interfaz y cada ciclo requerido. SIM-2 usa un lote incompleto, otro de calidad 4 y cambio de insumos posterior; el oráculo simplificado de un lote e identidad constante no cubre ese caso completo.

## Errores identificados y correcciones

- El modelo anterior sumaba todos los operarios N3 para eficiencia, imponía tope 1 y redistribuía sobrantes al último molde. El motor Excel aplica columna F literal, sin tope, y trunca cada lote.
- Las penalizaciones de producción ahora restituyen el MP no utilizado antes de valorar costos/inventario. El caso `200×0.70×0.95` se normaliza a precisión Excel antes de truncar para obtener 133, sin perder una unidad por ruido binario.
- El cierre pasó a reconocer la eliminación del historial y conservarla en ciclos posteriores.
- La depreciación acelerada recibe el ciclo real, sin agregar campos internos a las decisiones replicadas.
- Se agregaron los costos recurrentes de RR.HH., marketing, canal e inventarios desde el catálogo, sin duplicar personal, MP ni mantenimiento ya calculados.
- La garantía se provisiona por unidad vendida; esta interpretación operativa no constituye una fórmula original de cierre en el Excel.
- Los préstamos se informan como financiamiento, separados del ingreso por ventas. No se inventó un calendario de amortización ausente en la fuente; la conciliación con deuda/caja del juego anterior permanece pendiente.
- Se detectaron los hallazgos adicionales 34–35 de valorización y denominador de hilo, explicados abajo.

## Tabla de decisiones y ajustes

Todos los nombres de configuración se refieren a `js/engine/config_excel.js`. Una fila «interpretación» requiere revisar el módulo indicado: no se ofrece un cambio ficticio de configuración inexistente. Los cambios de regla deben repetirse en el oráculo y sus pruebas.

| # | Valor/interpretación aplicada | Cambio de una línea o ubicación |
|---|---|---|
| 1 | Ciclo de 24 días; Costos fixture inyecta 30 | `DIAS_CICLO:24` |
| 2 | Corte 5/7/9; ensamble 6/8/12; acabado 6/7/10 | `PRODUCTIVIDAD:{corte:[5,7,9],ensamble:[6,8,12],acabado:[6,7,10]}` |
| 3 | N3 de columna F para factor productivo | `EFICIENCIA_N3_LITERAL:true` (false suma todos N3) |
| 4 | Factor productivo sin tope | Interpretación literal en `produccion.js`; no flag de tope |
| 5 | Factor productivo y puntaje de eficiencia separados | Contrato `factorEficienciaProduccion` / `puntajeEficiencia`; sin cambio numérico |
| 6 | Mercado usa reputación operativa; Matriz usa Motor | `REPUTACION_FUENTE_MERCADO:'operativa'` o `'motor'` (**decisión 1**) |
| 7 | Calidad mercado derivada de calidad real, acotada a 100 | `CALIDAD_MERCADO_MODO:'motor'`; `'excel_literal'` solo contraste (**decisión 2**) |
| 8 | Reputación mercado ×10, sin tope | `ESCALA_REPUTACION:10`; tope requiere cambio de regla en `mercado.js` |
| 9 | Calidad y eficiencia sin normalización ni tope | Interpretación literal en `puntajes.js` |
| 10 | Calidad premium 4–6: mensaje sin penalización numérica | `CONSECUENCIAS.CALIDAD_BAJA:4`, `CALIDAD_PREMIUM:7`; criterio en `consecuencias.js` |
| 11 | Precio efectivo por lote; reputación ±2 una vez por regla/ciclo | `CONSECUENCIAS.PRECIO_BAJO:0.65`, `PRECIO_PREMIUM:1.4`, `REPUTACION_CAMBIO:2` |
| 12 | Reducción productiva 0.70×0.95 | `CONS08_MODO:'multiplicativo'` |
| 13 | Capacidad topada; horas extra 25% proporcional al exceso | `HORAS_EXTRA_PCT:0.25` — PENDIENTE_DEFINIR |
| 14 | Almacenaje S/2 por unidad sin vender; stock arrastrado | `COSTO_ALMACENAJE_UNIDAD:2` — PENDIENTE_DEFINIR |
| 15 | Próximo préstamo: +3 pp TEA | `TEA_ADICIONAL_PP:3` — PENDIENTE_DEFINIR |
| 16 | Demanda ×0.8 desde segundo ciclo consecutivo de baja reputación | `CONSECUENCIAS.CICLOS_REPUTACION:2`, `DEMANDA_BAJA:0.8`; pedido SIM-2 dice «siguiente», interpretación por confirmar |
| 17 | Essalud anual suma un solo mes | `ESSALUD_ANUAL_LITERAL:true` (false contabiliza 12) |
| 18 | CTS 750/1500 manual; corte N2 sí usa base/2 o base | `CTS_LITERAL:{MYPE:750,NO_MYPE:1500}`, `DIVISOR_MO:{MYPE:12.5,NO_MYPE:13}` |
| 19 | Motor MO usa Costos 2000/3800; catálogo referencia 2500/4000 | `SUELDOS.corte:[1500,2000,3800]` (**decisión 3**); catálogo anterior conserva sus cobros |
| 20 | Matriz personal nivel×máquina; cantidades explícitas | Contrato de `produccion.js`; editor piloto incluye matrices y activos separados |
| 21 | Dos calidades de accesorios | `ACCESORIOS_N3_HABILITADO:false`; habilitar requiere ampliar catálogo y familias |
| 22 | Compras se valoran en unidades productivas | `CONVERSION_COMPRA` y `PRECIO_MP`; interpretación de `costos.js` |
| 23 | Inventario inicial + compras − consumo | Regla generalizada de `consumirAlmacen()` y `produccion.js` |
| 24 | Descuentos 8%, 2% y 3% multiplicativos | `DESCUENTO_CANTIDAD:0.08`, `DESCUENTO_PROVEEDOR_UNICO:0.02`, `DESCUENTO_CONTADO:0.03` — PENDIENTE_DEFINIR |
| 25 | Línea recta literal; unidades y suma de dígitos como extensiones | `UNIDADES_VIDA:100000` — PENDIENTE_DEFINIR; método por `FIN-02A/B/C` |
| 26 | Mantenimiento anual/12 más política del ciclo | `TASAS_ACTIVOS`, `COSTO_POLITICA_MANTENIMIENTO` (**decisión 4**) |
| 27 | Fechas K56:K58 ignoradas para calidad | Calidad sale de `evaluarLote()`; sin constante |
| 28 | Reputación operativa tomada de Costos C65:G65 | `reputacionOperativa()`; no usar CANTIDAD C75 |
| 29 | Modelo 2 vigente; modelo 1 auxiliar | Llamada `repartoMercado()` en `ciclo.js` (**decisión 5**) |
| 30 | Redondeo por empresa sin redistribuir sobrantes | `excelRound()` en `mercado.js`; no flag para restos |
| 31 | Costos texto normalizados; original conservado | `catalogo_excel.json` / `catalogo_excel.js`; regenerar desde fuente |
| 32 | Catorce grupos más cuatro nuevos; fuera SEG/mesa/materiales | Filtro de grupos en `puntajes.js` (**decisión 6**); cambiar requiere actualizar pruebas |
| 33 | Un ciclo equivale a un mes económico | `CICLO_EQUIVALE_A_MESES:1`; cronómetro real sigue independiente |
| 34 | Valorización de ejemplo usa 107; almacén usa 107.5 | `paridad_costos.cjs` usa entrada propia AB89; juego usa consumo real. No flag que copie el ejemplo al juego |
| 35 | H61 excluye hilo N1 del denominador | `REPUTACION_HILO_DENOMINADOR_LITERAL:true` (false incluye todos) |

Las seis decisiones destacadas requieren confirmar: fuente de reputación de mercado; calidad de mercado real; salarios Costos frente a catálogo; mantenimiento doble; modelo 2 de mercado; cuatro grupos adicionales en Motor.

## Parámetros no definidos en el Excel

Marcados `PENDIENTE_DEFINIR`: horas extra 25%, almacenaje S/2, aumento TEA 3 pp, vida productiva 100000 unidades para depreciación por uso, acumulación multiplicativa de descuentos, sobrecosto lead time rápido y porcentajes de inversiones alta/baja. Los dos últimos tienen valor 0 y no se presentan como beneficios económicos demostrados.

También requieren definición de producto antes del despliegue: conciliación de adquisiciones con caja y balance; calendario financiero de préstamos; aplicación de ventas a crédito; relación entre publicidad numérica y marketing del catálogo; garantía por unidad vendida; comienzo exacto de CONS-04 cuando se cumple la segunda reputación baja; ejecución autoritativa del cierre y recuperación al perder conexión. Ninguna de estas ausencias queda subsanada por tener pruebas del motor en verde.

## Supabase

**No se requiere cambio en Supabase PARA EL PILOTO LOCAL. No hay SQL nuevo que ejecutar ni orden de migraciones adicional.** No se ejecutó ninguna operación de prueba en producción y no se modificó `public.guardar_puntaje_docente`.

Los JSON actuales permiten conservar decisiones y estado bajo `decision_state.__excel` y el resultado bajo `estado_resultados.excel`. Esto evita depender de columnas nuevas: el RPC de snapshots admite `decision_state` y el de reportes admite `estado_resultados`. Agregar propiedades nuevas a la raíz del snapshot/reporte sería insuficiente porque los RPC reconstruyen una lista cerrada de claves.

El cierre conectado está **pendiente de integrar y validar**. No se afirma que el almacenamiento JSON disponible ya resuelva coordinación multiempresa, historial conectado, permisos autoritativos, idempotencia entre clientes ni todos los estados financieros. Si la integración definitiva necesita tablas/RPC adicionales, deberán prepararse y probarse en una migración posterior idempotente, indicando entonces el SQL exacto al usuario.

## Skills, ejecución y próximos controles

Skills `xlsx`, `frontend-design` y `webapp-testing` disponibles en `.agents/skills/`. Se usaron instrucciones de xlsx para doble lectura, fórmulas y separación de caches; recálculo Excel COM como alternativa a LibreOffice. Frontend y navegador: PENDIENTE consignar evidencia final del agente principal. Informe en Markdown; docx/doc-coauthoring no necesarios.

Comandos desde SIDE1:

```powershell
node --test tests/costos_excel.test.cjs tests/produccion_excel.test.cjs tests/puntajes_excel.test.cjs tests/mercado_excel.test.cjs tests/ciclo_excel.test.cjs tests/ui_excel.test.cjs
node tests/paridad_costos.cjs
node tests/paridad_base.cjs
node tests/oracle/comparar_pipeline.cjs
node tests/run_integral.cjs --phase=final --no-fps
```

Verificación final por completar: pruebas en navegador con empresas ingresadas por el flujo normal; capturas/logs dentro SIDE1; regresión completa; `node --check`; revisión independiente; revisión de remoto y commits locales ajenos; comprobación de ausencia de artefactos nuevos en el contenedor de SIDE1. Ningún push hasta satisfacer las condiciones del pedido.
