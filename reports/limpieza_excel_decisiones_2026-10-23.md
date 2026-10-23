# Restauración de Decisiones y cierre de negocio — 23 octubre 2026

## Diagnóstico y alcance

La integración masiva comenzó en `03791af`; su padre `9fbe6ec` conserva el flujo original. No se revirtió el repositorio: se recuperaron selectivamente las tarjetas y las reglas autónomas. Permanecen login, salas SIDE-XXXX, docente, podio, selección de personajes, mundo, NPC, navegación, sincronización y ciclos.

El modo alternativo reemplazaba todas las tarjetas con un editor diferente, ignoraba el ledger del POS al presentar sus estados financieros y rechazaba expresamente la entrada al mundo. `production_model` y `decision_review_model` también habían adquirido dependencias de los módulos de verificación.

## Interfaz restaurada

- Infraestructura, Producción, Logística, Ventas y Finanzas usan nuevamente tarjetas, opciones, obligatoriedad, costo, guardado, envío por sección y ENVIAR TODO; conservan pestañas y saldo final guardado.
- Se eliminaron el montaje del editor alternativo, columnas de fuentes/celdas y paneles de costo de meta, escenarios de calidad/costo, comparación y datos pendientes.
- Se conserva **Insumos para la cantidad deseada**, con dos columnas: insumo y cantidad necesaria. Solo cuero en m², accesorios en unidades e hilo en metros, calculados con constantes internas del juego. No hay filas de personal, equipos, tiempo, planilla o valores indefinidos.
- El DOP utiliza capacidad real y recursos de SIDE. La tabla de insumos deseados no promete producción sin personal, maquinaria, molde o materiales.
- Los scripts del motor de verificación y su CSS ya no se cargan en `index.html` ni `docente.html`. Se retiraron sus RPC del servicio runtime. Se eliminaron las reglas CSS del editor alternativo de `production.css`.

## Logística: unidades y precios

El error consistía en multiplicar **700 compras × 270 metros × S/2/m × 92% = S/347,760**. Ahora los campos expresan cantidades físicas: m², unidades y metros. Admiten decimales de material. No se multiplica por presentaciones comerciales. **700 metros estándar cuestan S/64.40** después del descuento general de 8%, sin analista.

Se conserva el analista: descuento adicional de 12% al inicio, decreciente 2 puntos por ciclo hasta 2%, con su costo existente. No se añadieron insumos ni decisiones. Los precios son parámetros didácticos razonables de microempresa, no cotizaciones garantizadas de un SKU. La calidad premium se modela como un rango superior y no como equivalencia exacta entre productos de distintos proveedores.

| Insumo/opción | Unidad actual | Anterior: costo neto de una compra, sin analista | Nuevo precio bruto | Fuentes contrastadas |
|---|---|---:|---:|---|
| Cuero sintético | m² | S/23 por 1 m² | S/25/m² | [Multitop](https://www.multitop.pe/cuero-motox-negro-192215/p), [estudio de insumos UPN](https://repositorio.upn.edu.pe/bitstream/handle/11537/24102/Ascoy%20Rodr%C3%ADguez%20Katerinne%20Criss%20-%20Blas%20Ramos%20Alexis%20Fernando.pdf?isAllowed=y&sequence=1) |
| Genuino estándar | m² | S/82.80 por piel de 2 m² | S/90/m² | [Napa ovina de curtiembre Exibañez](https://www.mercadolibre.com.pe/70-pies-de-cuero-gris-napa-ovino-de-curtiembre-exibanez/up/MPEU2462562242), [Cueros Salvador: Box/Rondini](https://cuerossalvador.com/tienda/), [Cuero Market: unidades](https://cueromarket.com.pe/) |
| Genuino premium | m² | S/147.20 por piel de 2 m² | S/140/m² | [Cueros Salvador](https://cuerossalvador.com/tienda/), [Romantex cuero CROC](https://www.romantex.com.pe/shop/cuero-croc-176966), [CITE Cuero y Calzado: compras](https://cdn.www.gob.pe/uploads/document/file/5419629/4791999-cmn-2023-41.pdf), [Pieles del Sur](https://www.pielesdelsur.com/catalogo) |
| Accesorio económico | unidad/juego del catálogo | S/3.68 | S/2 | [ÉbanoZ](https://ebanoz.catalog.kyte.site/accesorios-cartera), [Inkper](https://inkper.pe/collections/accesorios-para-cartera) |
| Accesorio premium | unidad/juego del catálogo | S/8.28 | S/5 | [Coto Trapillo](https://cototrapillo.com/categoria-producto/accesorios/broches-cierres-y-ganchos/), [Entre Lanas](https://entrelanas.pe/products/broches) |
| Poliéster estándar | metro | S/496.80 por carrete de 270 m | S/0.10/m | [Gamy: poliéster 100 m](https://gamypasamaneria.com/products/hilo-chino-x-rollo-100-mtrs), [Mundo Miyuki: poliéster](https://www.mundomiyuki.com/categoria-producto/hilos/) |
| Encerado reforzado | metro | S/920 por carrete de 250 m | S/0.15/m | [Angiemeb: 120 m a S/14](https://angiemebisuteria.tiendada.com/product/PR-4B6D7D62), [Scrapbooking Perú: 90 m a S/20](https://scrapbookingperu.com/producto/sbp-hilo-encerado-color-marron) |
| Alta tenacidad | metro | S/1,288 por carrete de 200 m | S/0.22/m | [Scrapbooking Perú](https://scrapbookingperu.com/producto/sbp-hilo-encerado-color-marron), [Mundo Miyuki: hilos especializados](https://www.mundomiyuki.com/categoria-producto/hilos/) |

Consulta web: 23/10/2026. Multitop publica S/13.90 por metro lineal de ancho 1.50 m (S/9.27/m², PVC de tapicería); UPN contiene referencias históricas de S/17–23/metro. Se usa S/25/m² para una calidad de confección superior. Napa ovina aparece a S/6.99/pie² (S/75.24/m²); Cuero Market confirma la unidad comercial pero no publica precio en el resultado consultado. Romantex publica USD6.78/pie², un extremo decorativo muy superior: se excluye como precio representativo de microempresa. CITE muestra presupuestos históricos de S/14–28/pie²: sirven de contraste, no de cotización vigente. Cueros Salvador publica Box y plena flor Rondini a S/9.50/pie² (S/102.26/m²), segunda referencia comercial en soles frente a Exibañez. El estándar S/90/m² queda entre ambos; S/140/m² premium representa una calidad superior dentro de un rango didáctico explícito, sin atribuir esa cifra exacta a un proveedor.

## Ingresos y caja

Había dos causas distinguibles: almacén/personal sin recursos deja producción real en cero; además el modo alternativo excluía el flujo POS/ledger y exigía otro cierre. El flujo restaurado registra caja desde el mismo ledger para POS, resumen y estados financieros.

`js/cycle_model.js` liquida producción real, demanda por canal/distrito, precio, inventario final y ventas al cerrar cada ciclo. Guarda un recibo por ciclo: reintentar no duplica ventas ni consumo. Las ventas POS se descuentan por producto antes de vender el remanente. No se requiere hacer cada venta manual para obtener ingresos. Los planes enviados se capturan por ciclo y se liquidan también al reingresar, durante cambios automáticos y al finalizar el último ciclo.

Los datos anteriores se respaldan localmente antes de su adaptación. El archivo y tablas históricos se conservan. La migración conserva caja, recursos, deuda, activos y resultados acumulados mediante una semilla contable; el historial financiero previo sigue visible. El respaldo íntegro usa la clave local `SIDE_PREVIOUS_MODEL_BACKUP_<sala_empresa>`.

## Mundo 3D

Tras persistir correctamente el último apartado o ENVIAR TODO, se cierra la revisión y se inicia la entrada existente. Si falta confirmar personaje, aparece el selector existente; al confirmar continúa la carga. No se modificaron los avatares elegibles. Se mantienen validaciones de acceso, pausa, hidratación, espera y operación por ciclo. La tablet conserva sus salidas por botón y Escape.

## Herramientas conservadas fuera del bundle

No se borraron el libro ni sus oráculos: `docs/DECISIONES_SIDE_logica_produccion.xlsx`, `docs/logica_excel/`, `docs/LOGICA_PRODUCCION_EXCEL.md`, `js/engine/`, `css/excel.css`, `tests/*excel*`, `tests/escenarios_excel.cjs`, `tests/fixtures/previous_model_partida_service.js` (copia histórica del servicio para los oráculos remotos), `reports/verificacion/`, `reports/auditoria_excel_original_20261023.*` y comparativos anteriores siguen disponibles para desarrollo. Que permanezcan en el repositorio no implica que la aplicación los cargue; la prueba `tests/limpieza_runtime.test.cjs` inspecciona los assets reales de ambas páginas.

## Supabase: requiere aplicación manual

**No se ejecutó ningún comando ni SQL contra Supabase.** Hay dos migraciones listas, en este orden:

1. `supabase/migrations/20261023_retirar_motor_anterior.sql`: retira únicamente los triggers que volvían a imponer el modo anterior; conserva tablas y cierres históricos.
2. `supabase/migrations/20261023_cierre_negocio.sql`: RPC docente con autorización de propietario, contexto y token de revisión, locks, cierre atómico/idempotente y persistencia de snapshot, caja y reporte. El cálculo utiliza el mismo módulo JS autónomo, incluso si el alumno está desconectado.

El cliente informa un cierre pendiente si falta la nueva RPC. La comprobación de SQL se realiza exclusivamente con PostgreSQL embebido local. No se afirma que las migraciones estén instaladas en el servidor real.

## Verificación y auditoría

Validación final:

| Comprobación | Resultado y evidencia |
|---|---|
| Regresión Node del juego | **369/369**, `tests/output/limpieza-regresion-final.log` |
| NPC, separado | **42/42**, `tests/output/limpieza-npc-separado.log`; no se modificó su implementación |
| Cierres, limpieza runtime y oráculos remotos históricos | **25/25**, `tests/output/limpieza-cierres-final.log` |
| Sincronización/admisión UI con backend simulado | **10/10**, `tests/student_sync_ui.test.js`, conservando CAS, offline, reintentos y recuperación |
| SQL nuevo, PostgreSQL embebido local | Verde: despliegue repetido, propietario/anon, token obsoleto, idempotencia, cierre temprano rechazado, alumno offline y ajuste financiero sin doble contabilización; `tests/output/limpieza-db-final.log` |
| Creación docente, espera, admisión, reingreso manual/automático, cancelación, eventos, presencia | `tests/game_lifecycle_ui.cjs`, verde con PGlite local; sin Supabase real |
| Decisiones desktop/móvil | `tests/decisions_cycle_ui.cjs`, verde en 1366, 1024, 768, 390, 320 y 844 px; tabs, teclado, persistencia, envío y DOP |
| Flujo de tarjetas y resumen | `tests/clean_decisions_20261023_browser.cjs`, verde; capturas y JSON en `tests/output/clean-decisions-20261023/` |
| Mundo real WebGL | `tests/world_cycle_restart.cjs`, verde: entrada automática en ciclos 1–3, retorno, reintento y siguiente día |
| Tablet | `tests/tablet_return_browser.cjs`, verde: 60 salidas, foco, WASD y cámara |
| Contaminación runtime | `tests/limpieza_runtime.test.cjs`, verde: ambas páginas y assets reales sin dependencias/celdas/mensajes del modelo retirado. Tampoco hay coincidencias literales en JS runtime fuera de las herramientas preservadas |
| Revisión de whitespace y ubicación | `git diff --check` verde; el directorio contenedor conserva únicamente `SIDE1` |

Las pruebas de navegador son automatizadas y aisladas: el runner nuevo prepara decisiones razonables, edita el campo de hilo mediante el control real y pulsa revisión/envío/selector. Usa un stub de entrada para inspeccionar UI; la prueba de mundo separada ejecuta WebGL real. No se afirma haber realizado una partida contra una cuenta real de Supabase ni una sesión manual humana.

Tres ciclos completos autónomos, con compras, personal, equipos, producción y canal web:

| Ciclo | Producido | Vendido | Ingresos | Caja final |
|---|---:|---:|---:|---:|
| 1 | 100 | 100 | S/7,500 | S/158,295.80 |
| 2 | 100 | 100 | S/7,500 | S/143,891.60 |
| 3 | 100 | 100 | S/7,500 | S/129,487.40 |

Evidencia: `tests/output/business-three-cycles.json`. Tener ingresos no garantiza utilidad: esta configuración compra capacidad y paga personal para más de 100 unidades, por lo que sus gastos superan sus ventas; la disminución de caja está conciliada. La prueba de UI independiente registra S/155,546.60 antes de cerrar y S/163,046.60 después, con ingreso visible de S/7,500.

Auditor independiente: subagente distinto de los autores de UI y motor. Encontró y verificó correcciones para ventas POS por producto, último ciclo automático, cierre SQL anticipado y pérdida del ajuste financiero docente. Sus pruebas son `tests/cycle_independent_audit.test.cjs` y `tests/business_closure_independent_db.cjs`; la prueba local nueva usa el servicio real contra PGlite.

La regresión de 369 selecciona archivos `.test.js/.mjs/.cjs` excluyendo familias históricas `excel`, `auditoria`, `restaurar`, `independent_cycle_costs_20261022`, `dop_confirmation`, `production_dop_target`, `player_ui_contracts`, y los suites separados `npc`, `student_sync_ui`, `supabase_connection`. Esos nombres mezclaban contratos del editor retirado con verificación histórica; no se afirma que `npm test` completo esté verde. Los oráculos y comparativos se preservaron, y dos tests remotos históricos usan la copia de servicio congelada de `b11e537`, fuera del bundle. No se deshabilitó la cobertura de la interfaz actual: se actualizaron sus contratos y se ejecutaron los runners descritos.

Pendiente de despliegue: aplicar manualmente las dos migraciones indicadas y comprobar el flujo con una sala real. Si se vuelve a ejecutar una migración antigua que recrea los triggers retirados, deberá retirarlos de nuevo. El cierre automático remoto se sincroniza desde el panel docente; los alumnos también liquidan pendientes al reconectar. No se instala un cron de cálculo SQL independiente de todos los navegadores.
