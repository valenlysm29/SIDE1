# Validación final de rentabilidad de SIDE

Fecha de trabajo: 2–3 de noviembre de 2026. Repositorio `valenlysm29/SIDE1`. Rama de implementación: `codex/finalizacion-rentabilidad`. Base auditada: `84ae5a5`; integración posterior del main `3ebcdfe` mediante `9cfcf54`. Este informe complementa `AUDITORIA_FORENSE_UTILIDAD_NEGATIVA.md`: no sustituye los cierres reales por escenarios QA.

## Resultado demostrado

La pérdida histórica de SIDE-H57S permanece registrada: ventas S/11,400, costo vendido S/7,036.34, administración S/9,243.57 y pérdida S/8,768.91. Su conciliación y desglose individual están en el informe forense. No se eliminaron cargos para convertirla en ganancia.

Las reglas vigentes permiten estrategias rentables con competencia, inversión, salarios, insumos, comisiones, garantías e impuesto. Se probaron tres empresas competidoras por partida, con capital inicial S/100,000 cada una, sin préstamos ni ajustes de caja, con transiciones básico → estándar → prémium. Los resultados siguientes son escenarios reproducibles de prueba, no resultados de la partida histórica:

| Partida | Producción total | Ventas totales | Utilidad neta acumulada | Caja final |
|---|---:|---:|---:|---:|
| 3 ciclos | 1,000 | 1,000 | 57,501.65 | 118,842.04 |
| 6 ciclos | 974 | 974 | 46,916.59 | 106,013.39 |

Cada decisión se financia con la caja disponible anterior a sus ventas; se verifica que la inversión no dependa de ingresos futuros. Las tres empresas terminan con utilidad acumulada y caja superiores a su capital inicial en estas dos estrategias. El resultado no se generaliza a cualquier decisión, competencia o configuración.

## Correcciones financieras y reglas preservadas

1. **Molde no depreciable:** `financial_model.js` respeta `noDepreciation === true`. La compra sigue siendo inversión y activo. No se deprecia ni se incorpora ese cargo al costo de fabricación, costo vendido o inventario. Las máquinas depreciables conservan sus cargos. No se revierte depreciación histórica. La prueba de contraste del paquete archivado reproduce 64.13 de depreciación frente a 59.38 corregidos; costo vendido 7,091.89 frente a 7,087.14, con igual flujo de caja en ese caso sin efecto tributario.
2. **Conservación de céntimos:** consumo contable de MP = saldo inicial + compras recibidas − saldo final. El costo producido se distribuye en céntimos mediante restos mayores deterministas. En cada lote, costo vendido + valor remanente = costo del lote. No se usa caja ni patrimonio como ajuste para cuadrar.
3. **Mantenimiento:** se mantienen la intervención preventiva opcional S/1,500 y la cuota automática S/31.25: son conceptos independientes según la política escrita anterior al hallazgo. Se prueba total 1,531.25 con intervención, 31.25 sin ella y ausencia de un segundo cargo automático cuando ya consta en la sección. Se cobra una cuota por ciclo, sin borrar gastos legítimos.
4. Se conservaron y probaron las mejoras recientes de `main`: recepción de materiales, valoración de activos heredados, costo unitario mostrado, estados oficiales y ejecución de cierres con seguimiento y aislamiento. `legacy-runtime.mjs` permanece sin cambios. No se añade migración SQL para esta entrega.

La depreciación es no monetaria. Un cambio de depreciación puede cambiar legítimamente el impuesto final de una empresa rentable; por eso se contrastan resultados, flujo y balance, no solo la caja.

No se modificaron tarifas, demanda, precios autorizados, recetas ni impuestos para aprobar escenarios. Los precios efectivos salen de `utility-v1` y del ciclo correspondiente, incluido su comportamiento de último ciclo. Los campos heredados de precio no se sobrescriben. El personal se empareja internamente con recursos; no se añaden controles para editar precios por segmento ni asignaciones por máquina.

## Los tres fallos anteriores de producción

Los tres fallos de `md_logic.test.cjs` usaban un ejemplo con dos cortadores y **una** mesa, suponiendo capacidad conjunta 14/día. La regla vigente `one-worker-per-resource-20261029`, descrita en el contrato de cierre, permite un trabajador por recurso. La única mesa se empareja con el cortador experimentado: 8/día; capacidad redondeada `8 × 30 × 0.92 = 221` unidades. Asignación secuencial: 150 básicas, 71 estándar y 0 prémium.

Se corrigieron las expectativas derivadas de capacidad, consumo, reputación e inventarios: consumo 73.4 de cuero, 221 accesorios y 1,397 de hilo; materiales consumidos S/8,105.60 y mano de obra S/21,749.12. **No se cambió el motor para recuperar un resultado obsoleto.** Un control adicional compra la segunda mesa y recupera las 368 unidades originales (150/140/78), con capacidad 386. Las 14 pruebas actuales del archivo pasan. El reproductor histórico `forense_baseline_md.cjs` fija también el código de prueba antiguo, para no alterar su evidencia retrospectiva.

## Diagnóstico antes de confirmar

Planificación, Infraestructura, Producción, Finanzas y la revisión final incorporan una proyección de solo lectura. Muestra costo producido y vendido, gastos, márgenes, caja, capacidad, ventas de equilibrio, motivos de pérdida y comparación del analista. Una pérdida estimada no bloquea la confirmación si las decisiones cumplen las reglas existentes. No guarda decisiones, órdenes, recepciones, cierres ni movimientos.

Para materiales con recepción temporal, la cotización anterior a emitir órdenes indica explícitamente el supuesto de entrega completa y su plazo. Un retraso fuera del ciclo puede impedir producir. Una orden confirmada sin recepción no se reemplaza por una entrega hipotética. Las partidas de motor anterior no reciben una proyección con reglas nuevas: conservan sus cierres oficiales. La sala de espera evita consultar un contexto material aún no disponible.

Por producto:

- Costo vendido unitario = costo FIFO de lotes vendidos / unidades vendidas. Si aún no hay ventas, se presenta el costo producido aplicable.
- Margen bruto = `(ingreso − costo vendido) / ingreso`.
- Se distinguen comisión proporcional, garantía por unidad y gastos fijos distribuidos por unidades de la mezcla actual.
- Con costo unitario completo `c`, comisión proporcional `r` y margen objetivo `m`, umbral informativo de precio = `c / (1 − r − m)`; se muestran 10%, 15%, 20% y 25%, antes de impuestos.
- Ventas de equilibrio aproximadas = techo de `fijos / contribución unitaria media`; sin contribución positiva no hay umbral finito. Se avisa cuando supera capacidad o demanda.

Estos son análisis condicionados al costo, volumen y mezcla actuales, no precios impuestos ni una promesa de demanda a esos precios. El mercado compartido del cierre prevalece sobre una referencia individual. Las tablas de costo y precio se generan con el mismo modelo que el cierre y las alternativas preservan los datos de entrada.

## Resultados por ciclo

Importes en soles; utilidad después del impuesto aplicable. El impuesto acumulado se liquida en el ciclo final conforme a la configuración.

| Partida | Ciclo | Producido/vendido | Ventas | Costo vendido | Gastos operación | Impuesto | Utilidad neta | Caja |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 3 | 1 | 430/430 | 51,600 | 24,691.93 | 5,969.57 | 0 | 20,938.50 | 89,963.63 |
| 3 | 2 | 430/430 | 64,500 | 29,636.93 | 6,103.57 | 0 | 28,759.50 | 114,034.26 |
| 3 | 3 | 140/140 | 54,880 | 36,115.33 | 4,571.95 | 6,389.07 | 7,803.65 | 118,842.04 |
| 6 | 1 | 150/150 | 18,000 | 8,464.78 | 4,173.57 | 0 | 5,361.65 | 94,708.03 |
| 6 | 2 | 142/142 | 17,040 | 8,287.02 | 4,123.97 | 0 | 4,629.01 | 99,268.66 |
| 6 | 3 | 200/200 | 30,000 | 17,127.55 | 4,578.57 | 0 | 8,293.88 | 95,239.05 |
| 6 | 4 | 190/190 | 28,500 | 16,829.95 | 4,513.57 | 0 | 7,156.48 | 102,251.68 |
| 6 | 5 | 150/150 | 42,000 | 31,309.15 | 4,463.15 | 0 | 6,227.70 | 98,505.73 |
| 6 | 6 | 142/142 | 55,664 | 30,643.39 | 4,559.79 | 5,212.95 | 15,247.87 | 106,013.39 |

`tests/output/rentabilidad_final/resumen.json` conserva decisiones, política, ventas por producto y los estados financieros completos de estos nueve ciclos. El plan reproducible compra solo faltantes, conserva activos, ajusta personal y arrastra inventarios; no modifica cifras luego del cálculo.

### Escala, pérdidas y analista

Con capital S/200,000, siete pares de recursos por proceso y meta de 1,000 unidades por ciclo, la capacidad física es 1,134. Las ventas reales son 902, 1,098 y 148: C2 vende también 98 del inventario anterior. En prémium C3 quedan S/152,884.95 de PT, utilidad **−1,631.96** y caja S/105,958.18. Producir 1,000 no crea demanda para vender 1,000. Evidencia: `escala1000.json`.

El mismo plan con y sin analista produce ahorro de compras S/9,936 frente a honorarios S/5,000 y mejora neta S/4,936 en el caso de volumen elevado. En el caso pequeño ahorra S/266.64 y reduce la utilidad S/4,733.36. No se imputa como ahorro el valor completo de compras ni se contrata automáticamente. Evidencia: `analista.json`.

Un caso de recuperación registra pérdida inicial **−14,274.26**, seguida de 28,759.50 y 11,324.92: acumulado **25,810.16**, caja final **85,500.55**. Aunque la utilidad acumulada es positiva, su caja no recupera todo el capital inicial: se conserva esa distinción. Evidencia: `recuperacion.json`. Otro caso mantiene pérdidas por sobreinversión, marketing y analista desproporcionados.

## Validaciones y reproducción

Todos los comandos se ejecutan desde la raíz de esta copia de SIDE1. `tests/rentabilidad_plan.cjs` fija decisiones y `economic_v19_fixture.cjs` el catálogo. No son sustitutos de los datos históricos.

- `node tools/check_release.cjs`: **177 pruebas aprobadas, 0 fallos** tras integrar main; comprueba además que el paquete Edge se genere exactamente desde las fuentes. Incluye producción, ventas, valoración, conservación de céntimos, autorización, aislamiento histórico, reintentos, seguimiento y los nuevos escenarios económicos.
- `node --test tests/rentabilidad_integral.test.cjs tests/profit_projection_ui.test.cjs`: **7 aprobadas, 0 fallos**; Chromium a 1365 y 390 px, revisión final habilitada ante pérdida, decisiones intactas y ausencia de desbordamiento de página. Capturas `proyeccion-1365.png` y `proyeccion-390.png`.
- `node --test tests/forense_postgres.test.cjs`: **1 prueba integrada aprobada, 0 fallos; 14 escenarios y 63 cierres** en PostgreSQL 17 + Deno. Siete configuraciones por tres y seis ciclos: sin producción, producción sin ventas, ventas parciales, completas, fijos altos, recursos alternativos y rentable. Exige ecuaciones monetarias sin tolerar un céntimo, continuidad, inventario y reintentos. `postgres_final.log` y `matriz_postgres.json` contienen el resultado final. El aviso de journal no disponible corresponde al esquema mínimo de esa matriz; el seguimiento real se comprueba separadamente en la aceptación conectada con esquema completo.
- `python tests/rentabilidad_connected.py`: Auth, REST, SQL y Edge Runtime de Supabase local reales. Crea tres estudiantes y partidas QA nuevas de 3 ciclos manuales y 6 automáticos, registra órdenes y recepciones, ejecuta dos solicitudes concurrentes por cierre y contrasta Node antes de guardar, Deno y la relectura de PostgreSQL. Compara íntegros resultados, flujo de caja y balance. Solo `factorPrecioAbsoluto`, un diagnóstico no monetario de `Math.pow`, se normaliza a 14 cifras significativas entre Node y Deno; ningún importe se normaliza ni aproxima.

La prueba conectada valida estudiante, docente y laboratorio contra los mismos registros oficiales, los ciclos anteriores tras recarga, caché sin conexión, aislamiento entre empresas (403 esperado), ausencia de errores JavaScript y recursos locales faltantes. Los 403 registrados corresponden a intentos deliberados de leer otra empresa. No hay mocks de los endpoints financieros. `connected/integration.json` identifica las partidas y las comprobaciones por ciclo. Las ejecuciones fallidas intermedias se conservan localmente; no se presentan como aceptación.

## Respaldo e integridad

Respaldo privado local en `SIDE1/output/respaldo_rentabilidad_20261102/`; no se publica contenido de la base ni credenciales. Incluye esquema `public,side_private`, datos de ambos esquemas y las cuatro fuentes del worker desplegado. El respaldo inicial de 158 cierres se restauró y verificó por `md5(cierre::text)` en Supabase de prueba. `backup_restored.json` contiene tamaños y SHA-256 de los archivos, no datos privados.

La copia aislada no contiene secretos de Vault. Se deshabilitó únicamente en esa copia el transporte del programador hacia la URL de producción; las ejecuciones QA se invocan explícitamente con solicitudes locales registradas. Esto evita que restaurar un respaldo ejecute cierres remotos. Ninguna de esas adaptaciones se despliega.

El control previo a publicar encontró 159 cierres en producción: los 158 iniciales más uno nuevo durante el trabajo. Se actualizaron respaldo y huellas antes del despliegue. Se contrastan por identidad partida/ciclo y hash, permitiendo nuevos cierres legítimos y exigiendo que ninguno anterior desaparezca o cambie. SIDE-H57S conserva C1 `0702184c38c36b78e16deb0b21b978f1` y C2 `265260f6bfd6fcd86fa3685e3fc8176e`.

## Publicación y límites

La matriz integrada final terminó correctamente. La aceptación conectada final se conserva en `connected/aceptacion_final.json`: partidas QA `515b5905-7508-455c-8ff9-3eea0baa3cd3` (3 ciclos) y `877d79a1-cd11-492b-a8ea-f92e32f10198` (6 ciclos), con 27 snapshots empresa/ciclo en conjunto. Los estados financieros coinciden exactamente entre Node, Deno y PostgreSQL y entre las tres interfaces; las dos ejecuciones concluyen sin errores de página ni recursos faltantes.

La inspección remota anterior a publicar encontró **Edge v13**, ya actualizada durante el trabajo por otra publicación. Sus cuatro archivos coinciden con los del candidato validado al normalizar únicamente finales de línea. SHA-256 del paquete remoto: `5cb071ebde9563a133d19b1487c70f0014bd0274fab05ada4562ddff8d2374a5`. No se vuelve a desplegar un backend idéntico ni se modifica `legacy-runtime.mjs`. No hace falta migración: se mantienen las funciones SQL y sus contratos existentes. GET al endpoint devuelve 405 y POST sin token devuelve 401, sin ejecutar cierres reales. El frontend actualiza las claves de caché de los módulos modificados.

La publicación del frontend y de las evidencias se realiza mediante avance de `main` y la publicación Pages ya existente del repositorio. No se cambia su configuración de hospedaje. La rama de trabajo permanece `codex/finalizacion-rentabilidad`; el commit de publicación y la verificación de Pages se añaden al registro posterior.

La aceptación demuestra coherencia para las configuraciones y versiones probadas. No garantiza beneficios universales ni valida todas las combinaciones posibles. La procedencia binaria exacta de cierres antiguos sigue limitada por sus metadatos originales. Los snapshots sellados conservan siempre sus cifras; los cambios de cálculo se aplican prospectivamente al motor correspondiente.
