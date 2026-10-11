# Integración de lógica Excel SIDE — 11 de octubre de 2026

## Estado de entrega

Motor puro Node/navegador, editor con las68 opciones Excel, cierre local/remoto e historial, y adaptador de caja común ya implementados. El cierre remoto usa contexto autoritativo, token de estado, permisos del docente e idempotencia; se prueba mediante mocks y PostgreSQL PGlite local, sin operaciones de prueba en producción. Regresión y revisiónfinal están en curso: todavía no se declara aceptación ni publicación.

**Push: no realizado hasta completar todos los controles.** WIP locales preservan exclusivamente la tarea; cambios ajenos NPC/modelos/reportes quedan sin incorporar. El commit inicial del usuario es 9fbe6ec.

## Implementación por hoja

| Fuente | Implementación y alcance real |
|---|---|
| Catalogo_Decisiones / Seleccion_Ciclo0 | `js/engine/catalogo_excel.js` conserva las 68 filas y normaliza costos; `puntajes.js` valida una opción por grupo. En modo por lotes las 68 filas Excel son la fuente activa del editor, incluidos cuatro grupos nuevos. La interfaz anterior mantieneIDs para las empresas que continúan en ese modo; al activar lotes se impide seguir generando cargos desde sus categorías. |
| CANTIDAD DE PRODUCCIÓN | `produccion.js`: matrices de personal, 24 días, cuello de botella, eficiencia literal, reparto truncado, restricciones por insumo/lote, conversiones de compra e inventario. Al activar lotes se deshabilita el cálculo productivo anterior para esa empresa. |
| Costos De Producción | `costos.js`: cargas laborales literales MYPE/No MYPE, CTS manual, mantenimiento y depreciación, valorización MP, jerarquía de almacén y reputación operativa. El adaptador de caja paga compras netas y adquisiciones/instalación/capacitación una vez; depreciación afecta resultados, no caja. |
| Lotes_Produccion / Motor_Puntajes | Calidad por lote, umbrales y mensajes; calidad ponderada de empresa; eficiencia, reputación y salud; niveles Alto/Medio/Bajo sin normalizar puntajes. Se incluyen cuatro grupos adicionales conforme al pedido. |
| Matriz_Consecuencias | Ocho reglas en `consecuencias.js`; efectos por lote, reputación una vez por regla/ciclo, penalización productiva multiplicativa, historial y tasa futura. La conservación literal de textos incluye errores ortográficos del archivo. |
| Ventas | `mercado.js`: modelo 2 por segmento y modelo 1 solo de contraste. `ciclo.js` reúne empresas, replica decisiones, elimina al no decidir inicialmente, vende stock anterior y conserva inventarios. |
| Instrucciones / DECISIONES / FlujoWeb | Editor en ui_excel.js, planes confirmados por ciclo, cierre remoto con el mismo motor y estados financieros comunes. |

Los archivos del proyecto y temporales permanecen en SIDE1. La fuente se copió a `.codex-work/DECISIONES_SIDE_16.xlsx`, sin modificar el archivo de Descargas. No se debe añadir esa copia a Git; queda por confirmar si el usuario desea versionar el Excel original. Los oráculos derivados son entregables solicitados.

## Evidencia y paridad

El original se leyó con dos cargas de openpyxl para distinguir fórmulas y valores en caché. Las diez hojas completas, rangos matriciales, catálogo y fixtures están en `docs/logica_excel/`. La copia recalculada usa **Microsoft Excel COM 16.0**, en una instancia propia invisible. LibreOffice no se encontró instalado; se documentó esta alternativa en vez de afirmar que se utilizó.

`ORACULO_SIDE.xlsx` parte de las diez hojas originales. `ORACULO_SIDE_paridad.xlsx` añade la comparación. Las fórmulas generalizadas de consecuencias y mercado se identifican como extensiones; sus resultados no demuestran por sí solos todos los componentes de un cierre multiciclo.

Los caches abreviados del original y los números de presentación del pedido no se consideran verdad de precisión completa. Ejemplo: reputación operativa se presenta como 11.1876, mientras Excel recalculado entrega aproximadamente 11.187635078564613. La comparación usa enteros exactos y tolerancia relativa `1e-9` para decimales.

| Verificación | Excel real | SIDE | Resultado conocido |
|---|---|---|---|
| Base completo | esperado_base.json | obtenido_base.json |351 salidas;0 diferencias |
| Consecuencias escalares | sim2 y sim2_premium | paridad_consecuencias |56 salidas;0 diferencias |
| SIM1,4empresas,3segmentos,1ciclo | ORACULO_sim1.xlsx | cierre docente UI |468 salidas (incluye caja);0 diferencias;351 componentes base adicionales |
| SIM2,2empresas,3ciclos | ORACULO_sim2.xlsx multilote | cierre docente UI |585 salidas (incluye caja y detalle de lotes/mercado);0 diferencias |
| SIM3,5empresas,3ciclos | ORACULO_sim3.xlsx | cierre docente UI |1140 salidas (incluye caja y detalle de lotes/mercado);0 diferencias;recorte móvil corregido; repetición final pendiente tras ajuste del HUD |
| Recuperación antes del préstamo | ORACULO_banca.xlsx | banca_recuperacion.cjs |252 salidas;0 diferencias |
| Caja completa/intereses | Fórmulas independientes de extender_finanzas.py | adjuntarCaja y UI |33 campos por empresa/ciclo; cero diferencias en Node; repetición UI final en curso |
| Regresión anterior | baseline 9fbe6ec exacto |8 ejecuciones comparadas |NPC 17/16, móvil de 40 px y scrollY preexistentes demostrados; doble DOM previo corregido (9/9) |

Total final del oráculo: **3104 comparaciones correctas, cero diferencias y cero pendientes**. Incluye dos casos bancarios de 252 salidas cada uno y 56 verificaciones escalares de consecuencias. Los perfiles§5.1,§5.2 y§5.3 usan cantidades/personal diferentes; son ejemplos independientes. Por eso SIM1 comprueba los 351 componentes canónicos y, además, un cierre coherente de tres lotes por empresa con entradas explícitas y oráculo independiente; no se afirma que un cierre único reproduzca tres perfiles contradictorios al mismo tiempo.

## Errores identificados y correcciones

- El modelo anterior sumaba todos los operarios N3 para eficiencia, imponía tope 1 y redistribuía sobrantes al último molde. El motor Excel aplica columna F literal, sin tope, y trunca cada lote.
- Las penalizaciones de producción ahora restituyen el MP no utilizado antes de valorar costos/inventario. El caso `200×0.70×0.95` se normaliza a precisión Excel antes de truncar para obtener 133, sin perder una unidad por ruido binario.
- El cierre pasó a reconocer la eliminación del historial y conservarla en ciclos posteriores.
- La depreciación acelerada recibe el ciclo real, sin agregar campos internos a las decisiones replicadas.
- Se agregaron los costos recurrentes de RR.HH., marketing, canal e inventarios desde el catálogo, sin duplicar personal, MP ni mantenimiento ya calculados.
- La garantía se provisiona por unidad vendida; esta interpretación operativa no constituye una fórmula original de cierre en el Excel.
- Los préstamos se informan como financiamiento, separados del ingreso por ventas. No se inventó un calendario de amortización ausente en la fuente; caja e intereses se calculan en el adaptador único. La tasa mensual equivalente es una extensión configurable y PENDIENTE_DEFINIR, no una fórmula bancaria del archivo fuente.
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
| 34 | Valorización de ejemplo usa 107; almacén usa 107.5 | `VALORIZACION_MP_MODO:"consumo_real"`; alternativa `"excel_literal"` exige mapa explícito consumoValorizado; fixtures AB89=107 y consumo107.5 se conservan por separado |
| 35 | H61 excluye hilo N1 del denominador | `REPUTACION_HILO_DENOMINADOR_LITERAL:true` (false incluye todos) |

Las seis decisiones destacadas requieren confirmar: fuente de reputación de mercado; calidad de mercado real; salarios Costos frente a catálogo; mantenimiento doble; modelo 2 de mercado; cuatro grupos adicionales en Motor.

## Parámetros no definidos en el Excel

Marcados `PENDIENTE_DEFINIR`: horas extra 25%, almacenaje S/2, aumento TEA 3 pp, vida productiva 100000 unidades para depreciación por uso, acumulación multiplicativa de descuentos, sobrecosto lead time rápido y porcentajes de inversiones alta/baja. Los dos últimos tienen valor 0 y no se presentan como beneficios económicos demostrados.

Extensiones explícitas: interés equivalente mensual sobre deuda, sin amortización porque no existe calendario; adquisición de activos solo por incremento, sin liquidación; garantía por unidad vendida; REP baja se aplica desde el segundo ciclo. Tiendas por zona y porcentaje de ventas a crédito se capturan y conservan, pero el Excel no define su costo/demanda ni calendario de cobros; están marcados PENDIENTE_DEFINIR y no generan efectos inventados. El balance conserva caja, activos fijos e inventario MP; los productos terminados se registran en unidades, sin un método nuevo de capitalización contable. Confirmar esos criterios antes de ampliar reglas.

## Supabase

SQL preparado: supabase/migrations/2026-10-11_logica_excel.sql. **No se ejecutó en producción.** Se aplica dos veces y se prueban funciones/triggers con PostgreSQL PGlite en memoria. No modifica public.guardar_puntaje_docente. Resultados, inventarios, personal, decisiones e historial se preservan en el JSON del cierre y del snapshot.

Orden para una instalación SIDE ya migrada: ejecutar únicamente el archivo 2026-10-11_logica_excel.sql completo en el editor SQL de Supabase. Depende del esquema existente y de supabase_game_lifecycle.sql y supabase_student_admission.sql. No repetir migraciones antiguas de una base en uso sin revisar su estado. Para una base local nueva las pruebas cargan supabase_migration.sql → supabase_game_lifecycle.sql → supabase_student_admission.sql → 20260930_preservar_opciones_decisiones.sql → 20261009_sala_espera_identidad_exacta.sql → 2026-10-11_logica_excel.sql.

Sin la migración nueva el flujo anterior funciona y la activación remota de lotes queda deshabilitada; modo local funciona completo. No se simula que un cierre conectado se guardó cuando falta la RPC. Cierres/historial son accesibles por las RPC autorizadas; anon no puede cerrar. CAS rechaza decisiones cambiadas y triggers preservan cierres frente a escrituras tardías.

El SQL exacto copiable está en el archivo enlazado al final, y se agregará también a este informe una vez finalizadas sus correcciones.

## Skills, ejecución y próximos controles

Skills `xlsx`, `frontend-design` y `webapp-testing` disponibles en `.agents/skills/`. Se usaron instrucciones de xlsx para doble lectura, fórmulas y separación de caches; recálculo Excel COM como alternativa a LibreOffice. Frontend mantiene tokens SIDE y pruebas Chrome/Playwright; evidencia en reports/sim/. Informe en Markdown; docx/doc-coauthoring no necesarios.

Comandos desde SIDE1:

```powershell
node --test tests/costos_excel.test.cjs tests/produccion_excel.test.cjs tests/puntajes_excel.test.cjs tests/mercado_excel.test.cjs tests/ciclo_excel.test.cjs tests/ui_excel.test.cjs
node tests/paridad_costos.cjs
node tests/paridad_base.cjs
node tests/oracle/comparar_pipeline.cjs
node tests/run_integral.cjs --phase=final --no-fps
```

Verificación final por completar: pruebas en navegador con empresas ingresadas por el flujo normal; capturas/logs dentro SIDE1; regresión completa; `node --check`; revisión independiente; revisión de remoto y commits locales ajenos; comprobación de ausencia de artefactos nuevos en el contenedor de SIDE1. Ningún push hasta satisfacer las condiciones del pedido.

## Transición entre modelos

No se permite activar lotes después de pagos/compras del mismo ciclo, porque se duplicarían gastos ya registrados. El mensaje indica hacerlo al comenzar el siguiente ciclo. En el ciclo limpio se conservan caja, activos y deuda; solo se importa MP cuando existe inventario físico explícito. Los activos conservados siguen generando mantenimiento/depreciación aunque se omitan en la nueva decisión.

## Decisión sobre la fuente Excel

¿Deseas que DECISIONES SIDE (16).xlsx original quede en el repositorio? Por defecto no se añadió: permanece en .codex-work/, ignorado. Los oráculos derivados son los entregables solicitados y sí se guardan.
