# Revisión de lógica Excel y ventas SIDE

Trabajo realizado el 24/10/2026; se conserva el nombre de entrega solicitado. Fuente: `.codex-work/DECISIONES_SIDE_16.xlsx`, SHA256 `3b6b42bbbc56a2534ce7e241c607d572dd38dcf02311683609497df36a0c1eb1`. La v18 solicitada no estaba disponible; el usuario autorizó expresamente usar la v16. Original sin sobrescribir. Remoto verificado: `https://github.com/valenlysm29/SIDE1.git`.

## Diagnóstico y evidencia

P2 no era un único error aritmético. Había dos rutas: las páginas activas cargaban `cycle_model`/`revenue_model`, mientras muchos oráculos comprobaban `engine/ciclo`, que no ejecutaba la partida real. La ruta activa usaba precios inventados 75/95/125, reputación operativa y calidad derivada de reputación; no integraba las consecuencias ni los puntajes corregidos del catálogo. La traza previa a los cambios, con líneas de esa revisión, está en `auditoria_ventas_fase0_20261024.md`.

El contexto SQL filtraba empresas sin `__cyclePlans[ciclo]` remoto (`20261023_cierre_negocio.sql:24–32`). Cuando al menos una empresa tenía plan se podía persistir un reparto parcial; después, el cierre inmutable (`:21–22`) excluía permanentemente planes tardíos. Con cero planes, sí se dejaba pendiente. El cálculo requiere recursos físicos: sin materiales, operarios, equipos o molde no hay producción ni ventas. El cierre seguía dependiendo del navegador autenticado del docente (`services/partida_service.js`, función `cerrarNegocio`); SQL autorizaba y persistía resultados, sin calcular su economía. Estos hechos reproducen ceros y pendientes locales. No se atribuye una causa concreta a una partida de producción que no se pudo inspeccionar con credenciales.

P1: el error `e.estado` corresponde a una función antigua que consulta una columna inexistente de `empresas`. La corrección local usa `participantes.expulsada_at`. Ya existían retiro de triggers, reloj servidor, CAS alumno, histéresis de presencia y actualización diferencial de tarjetas. El despliegue remoto de esas migraciones no estaba acreditado. No se afirma que un trigger esté activo en producción sin inspección autenticada. Se corrigieron además polling redundante, estado del canal y reintentos sin backoff.

Auditoría paralela inicial sin cambios de código: A (Excel), B (ventas), C (Supabase), D (validador independiente del coordinador). A inventarió las diez hojas, 3047 celdas y 871 fórmulas. D confirmó 104 búsquedas truncadas, 12 valores monetarios sucios (excluye cabecera), tres fechas de calidad y cuatro errores guardados. La evidencia completa está en los informes `auditoria_*fase0_20261024.*` y `tests/output/validate-DECISIONES_SIDE_16.json`.

## E1–E11

| Hallazgo | Antes | Corrección / alcance |
|---|---|---|
| E1 | 104 búsquedas hasta fila57, catálogo68 | Rangos hasta69, también fórmulas matriciales. Catálogo interno conserva68. |
| E2 | Costos como cadenas monetarias; `=+1`/`=+2` | Costos y aportes numéricos. Aclaración: esos aportes eran fórmulas reales con caché numérica, no texto; se normalizaron sin cambiar valor. |
| E3 | No hay precio elegido, runtime75/95/125 | Precio por segmento en plan de producción, guardado y validado en UI/motor/triggerSQL; rangos40–45/120–200/220–400. |
| E4 | v1/v2 coexistentes | v2 canónica; v1 histórica se identifica obsoleta. Runtime usa módulo puro v19. |
| E5 | Calidad=cuota reputación; referencias cruzadas; DIV0; score negativo; venta ilimitada | Calidad lote×10, sumas por segmento, mercado por fórmula, scores0–100/empate100, MIN stock, solo producción real compite, demanda no servida se pierde. |
| E6 | Dos reputaciones; referencias vacías, valores fuera de escala | Fuente única: aportes del catálogo, limitada0–10; consecuencias modifican esa reputación y se vuelve a limitar. Publicidad no suma segunda reputación. |
| E7 | 24/30d y productividades distintas | CANTIDAD canónica24d; hoja Costos alineada. Bono1pp por todo trabajadorN3, eficiencia máxima100%. |
| E8 | K56:K58 fechas | Calidad calculada desde aportes de materiales/lote. |
| E9 | Puntajes sin tope; hueco Premium4–6.99 | Puntajes0–10; Premium<7 aplicaCONS01; >=7 aplicaCONS02. En UI actual moldePremium con insumos mínimos ya llega7, caso insuficiente se valida con lote genérico del oráculo. |
| E10 | Consecuencias desconectadas del runtime | Precio/reputación, eficiencia, dos ciclos bajos, inventario/almacenaje, crédito y siguiente préstamo conectados. CONS06 no autoriza producir sobre capacidad: se conserva el límite físico; no se inventa entrega extra. Ver límites. |
| E11 | Parámetros dispersos/sin cifra | `js/engine/config.js` centraliza supuestos; no se añaden opciones al menú. Ver tabla y límites de métodos no expuestos. |

Cada modificación del libro tiene celda, antes, después y motivo en `Control_de_cambios`; la hoja `Supuestos` documenta decisiones de diseño. También se protegen planes de cantidad cero y se corrigen referencias de hilo y funciones incompatibles. No se usa el mundo3D como fuente económica.

## Supabase: causa y corrección

| Causa | Síntoma | Corrección |
|---|---|---|
| RPC antigua con `e.estado` | Toast panel docente | Paquete reemplaza contexto con columnas existentes. |
| Triggers históricos capaces de sobrescribir | Estados contradictorios | Retiro idempotente antes del nuevo cierre. No reaplicar migraciones históricas de activación. |
| Plan ausente y cierre parcial | Cero ventas irreversible | Resolver confirmación recuperable/réplica/eliminación antes de formar mercado; lockadvisory+filas+CAS. |
| Desconexión mientras se confirma | Pendiente de sincronización | Outbox durable con acuse, CAS y backoff; reintenta sin multiplicar cierres. |
| Polling3s compitiendo con Realtime | Sobrecarga/parpadeo | Callback de estado, eventos coalescidos y reconciliación lenta30s cuando canal funciona; fallback con backoff. |
| Errores de informes ocultos | Ceros o pantalla aparentemente detenida | Conservar último dato confirmado y mostrar fallo de sincronización. |
| Configuración docente sin revisión esperada | Otra pestaña sobrescribe cambios | `config_revision` y RPC con bloqueo/propietario/CAS; revisión del formulario separada del polling; rebase sólo de guardados propios reconocidos. |
| Ausencia de ejecutor remoto | Docente desconectado, cierre pendiente | Límite no resuelto por SQL de persistencia; requiere ejecutor confiable y scheduler. Se preserva recuperación al reconectar. |

Detalles y líneas previas a cambios: `auditoria_supabase_fase0_20261024.md`. La comprobación remota de solo lectura de `side_admission_features` devolvió HTTP200 y hora servidor el24/10. Sin token docente no se inspeccionaron RLS/triggers/funciones protegidas. No se ejecutaron migraciones ni cierres en producción.

## Supuestos que debo aprobar

Valores iniciales implementados/configurables; no representan aprobación del usuario de su balance económico.

| Supuesto | Valor / criterio |
|---|---|
| Precio y desempate | Rangos del pedido; iniciales42.5/160/250; empate económico100 para todos. |
| Escalas | Tope0–10 en puntajes y calidad; Premium insuficiente<7. |
| Participación | Solo empresas que producen ese segmento; inventario previo acompaña producción, no compite por sí solo. Demanda no atendida perdida. |
| Materiales mezclados | Calidad de receta según insumos consumidos; consumo FIFO determinista. |
| Selección de personal mixto | Mayor nivel presente aporta una vez al grupo del catálogo. |
| Canal/tiendas | Cobertura base neutral; tiendas adicionales+5%, máximo+25%. |
| Marketing | Baja0%, media+12% fuente, alta+20%; no suma publicidad de nuevo a reputación. |
| Capacitación | Baja0%, media+8% fuente, alta+12%; sujeta a materiales y meta. |
| Crédito | Regla UI existente:20% inicial,+5pp/ciclo,+5pp con analista,tope70%; cobra siguiente ciclo. |
| Garantía |30d S/5;90d S/10;180d S/10 provisional configurable, sin cifra fuente. |
| Almacenaje | S/2 por unidad de producto terminado al cierre. |
| Riesgo bancario | Salud<3 aumenta3pp tasa del próximo principal nuevo. |
| Sobreproducción | No se permite producción física sobre capacidad; no se cobran horasextra sin producción autorizada. |
| Mantenimiento/inventarios | Aportes del catálogo; efecto adicional de capacidad neutral0 hasta especificar fórmula. |
| Sincronización automática |30s de gracia antes de resolver faltantes, configurable0–300s; manual por acción explícita docente. |
| Canales físicos heredados | Rentas por zona1800/3500/2200 y analista5000 son extensiones existentes, sin celda equivalente. No se cambian opciones. |
| Depreciación | FIN02B vida100000 unidades; FIN02C doble lineal, ambos supuestos y solo devengo, nunca salida de caja. |

### Correcciones surgidas de revisión cruzada

El revisor independiente A detectó J1: al recalcular en el servicio se usaban las secciones financieras antiguas, perdiendo la clasificación reconstruida de una réplica. `cycle_model.close` ahora devuelve `financialSections`; el servicio las usa y SQL las persiste. La regresión comprueba servicio→SQL→reconexión sin snapshot financiero y conserva costos, inventario y caja. También se conserva el ledger completo con ajustes de capital.

J2 detectó costos desalineados en el catálogo activo. Se corrigieron **las mismas opciones existentes** en `decision_catalog.js`: materiales físicos25/45/80,4/9,2/4/7; mantenimiento preventivo1500; nómina mensual MYPE completa1690.8/2254.4/4191.36 en corte y1690.8/3104.16/4952.4 en ensamble/acabado; jefatura3321.60 y limpieza712.32. La nómina usa las fórmulas de Costos De Producción, que son más precisas que el costo referencial del catálogo (RH02/RH03 diferían también en la fuente). No se multiplican compras físicas por presentaciones; descuento8% y analista se aplican una vez. La regresión independiente `costos_runtime_v19.test.cjs` compara las nueve opciones activas contra cachés COM, además del costo laboral56384.64 de cuatro trabajadores N3 por área. Esto resuelve el ejemplo bloqueante52000≠56384.64 del dictamen inicial; no afirma paridad de toda combinación contable posible.

El segundo revisor detectó que la ruta de confirmación desde Resumen omitía precios. Se añadieron validación y detección de cambios a `company_summary`, conservación del precio en `decision_review_model` y prueba real de precio inválido/corregido en Chromium. También se corrigió depreciación de activos guardados con `purchases` reales y el conteo único de cuentas por cobrar en balances iniciales importados. Las migraciones de decisiones pagadas conservan la adquisición en un ciclo anterior para evitar recompra automática; la renta del ciclo actual sigue siendo recurrente.

## Despliegue manual exacto

Ejecutar **un archivo completo**, `docs/sql/20261023_despliegue_cierre_v19.sql`, que concatena en orden retiro de triggers → cierre base → reparación contexto → planes/precios/estado v19 → configuración docente con CAS. Incluye comentarios de aplicación y reversión. Es idempotente; presupone el esquema existente y las migraciones de admisión/ciclo de vida documentadas. No lo ejecuta Git ni el push. No reconstruye resultados históricos.

Diagnóstico: `node tools/diagnostico_supabase.js` (solo lectura); con `SIDE_DIAGNOSTIC_JWT` revisa contratos protegidos. `--demo-local SIDE-000` prueba PostgreSQL desechable y ventas reales del motor, nunca escribe la partida alojada.

## Verificación y límites

Los logs y capturas están en `tests/output/`; las expectativas del oráculo se exportan del libro recalculado, no del motorJS. No se declara cobertura universal a partir de casos finitos. LibreOffice no está instalado: se empleó **Microsoft Excel COM16.0**, diferencia explícita respecto del método pedido.

El cierre autónomo con docente desconectado sigue pendiente de un ejecutor de servidor que importe este mismo motor y de su programación/deploy. No se amplían permisos del alumno para enviar resultados económicos arbitrarios. El mínimo seguro entregado resuelve todos los planes, mantiene idempotencia y recupera al reconectar; no se presenta como autonomía remota.

### Resultados de verificación del integrador

| Comprobación | Resultado / evidencia |
|---|---|
| Libro completo recalculado |1663fórmulas,0errores; fuente original con SHA256 intacto. ExcelCOM16.0. |
| Validador independiente del libro |68opciones;0rangos truncados;0números sucios;0fechas corruptas.48fórmulas retornan texto vacío legítimo, no faltan resultados numéricos del oráculo. |
| Oráculo fresco |498comparaciones,0diferencias: `reports/excel_v19_parity.json`. |
| Node sin los tres archivos que abren Chromium |626/626PASS, `tests/output/revision-v19-node-pure-final.log`. Incluye servidor embebido, motores anteriores, contratos, costos, contabilidad y separación3D. |
| Tres archivos Node que abren Chromium |22/22PASS, `tests/output/revision-v19-node-browser-final.log`; ambos grupos suman648pruebas del conjunto completo. |
| CAS docente añadido después |3/3unitarias y SQLPASS;25/25regresiones de configuración, cancelación, reloj, presencia y Realtime después del cambio. `tests/output/final-config-lifecycle-v19.log`. |
| Simulaciones |36cierres PASS; SIM1/2/3×3ciclos×4empresas. `tests/output/simulaciones-v19-final.log`. |
| Servicio y SQL |PASS paquete completo dos veces, planes tardíos, CAS, réplica, eliminación, precios, revisión financiera sin snapshot y autorización. DemoSIDE-000 local:3empresas venden100u y generan4250 cada una. `tests/output/cierre-v19-db-final.log`. |
| HTML real en Chromium |3ciclos×100u×S/43, ventas4300/ciclo; precio inválido rechazado en control y confirmación Resumen; recibo inmutable/reintento. `tests/output/ventas-v19-browser.log`. |
| Sintaxis |44JS modificados comprobados en la pasada final y `git diff --check` sin errores. No existe package.json ni comando build/lint declarado en la raíz; no se inventa un build aprobado. |
| Supabase alojado, solo lectura |HTTP200 y reloj servidor; no se inspeccionaron contratos protegidos sin JWT docente. `tests/output/diagnostico-supabase-v19.log`. |

La primera suite amplia de navegador ejecutó servidor local, Node,7runnersSQL y25runners de navegador (uno opcional ausente). Hubo fallos de3D/NPC y un error del arnés al restaurar su propio log abierto (`EBUSY`); no se presenta esa corrida como verde. El error de restauración se evitó guardando los logs de nuevas ejecuciones fuera del árbol que el arnés respalda. No fue un errorSQL ni económico.

La comparación con el código inicial `ce41f6a`, extraído dentro de `.codex-work/`, reprodujo las pruebas sobre las mismas referencias gráficas sin modificar el repositorio: `continuous_world`, `world_cycle_restart`, `world_startup`, `decision_interiors_browser`, `supplied_npcs` y `mona_npc` **pasaron al repetirlas**. Por ello los fallos iniciales se clasifican como inestables/no atribuidos, no como defectos preexistentes confirmados ni como regresiones resueltas. Las primeras dos pruebas de previews en el checkout de contraste dieron404 por faltar `tools/` en esa copia; se corrigió la preparación y se repitieron con sus archivos originales, sin contar esos404 como fallos del producto.

La pasada Node integral intermedia tuvo646pruebas,638PASS/8FAIL: siete expectativas heredadas de precios se actualizaron contra la fuente y pasaron sus regresiones; un timeout de admisión pasó al repetirse por separado10/10. La pasada final se divide por recursos entre Node y los tres archivos de Chromium, con idéntico conjunto de archivos; no se ocultan ni deshabilitan pruebas. Los fallos de expectativas del modelo anterior se conservaron como cobertura con decisiones físicas válidas, sin volver a confiar en producción/ventas inventadas por el cliente.

### Estado final de navegador y publicación

La repetición **del código entregado**, secuencial y sin compartir renderizador entre runners, está en `tests/output/continuous/regression.json` y `.codex-work/revision-v19-browser-retry.log`:8/9PASS. Pasaron `continuous_world`, `world_cycle_restart`, `world_startup`, `supplied_npcs`, `mona_npc`, `ventas_v19_browser`, `integral_cycle_ui_20261023` y `cierre_v19_db`.

**Permanece un fallo: `decision_interiors_browser.cjs:119`, un NPC duplicado.** En la primera corrida fue banco, nivel medio (3identificadores únicos frente a4actores); en la última fue oficina, nivel medio (2identificadores frente a3actores, un `hub-pedestrian` comparte `city_woman_cardigan` con la oficina). La misma prueba pasó contra el código inicial; la causa de esa variación no quedó atribuida. No se cambió `simulator3d.js` ni se mezcló la corrección económica con el sistema de actores. Este resultado no se etiqueta como regresión económica ni como defecto preexistente confirmado. Se conserva como fallo abierto de navegador.

**No se hizo push**, cumpliendo la condición explícita de que todas las pruebas estuvieran verdes. Los commits permanecen en la rama actual `main`; el remoto fue actualizado con fetch y no había commits remotos nuevos que integrar. El paquete SQL no se ejecutó en producción. El padre de SIDE1 sigue conteniendo únicamente SIDE1.
