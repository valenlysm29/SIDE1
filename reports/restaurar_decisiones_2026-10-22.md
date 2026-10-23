# Restaurar Decisiones del estudiante — 22 de octubre de 2026

## Estado de continuación

Restauración y QA final completados; todos los criterios comprobables quedan aprobados. Véase el cierre de entrega y publicación al final. HEAD inicial `65d195b`, remoto verificado `https://github.com/valenlysm29/SIDE1.git`. Todo el trabajo se mantiene dentro de SIDE1. No se ha ejecutado SQL ni se afirma todavía que las nuevas verificaciones estén aprobadas. La captura mencionada por el usuario no llegó adjunta en este turno: se toma como contrato su descripción escrita y el diseño localizado en Git.

Leídos AGENTS.md, informes de integración/paridad Excel, auditoría de decisiones del 11/10, mejora integral 01/10, correcciones docente/estudiante 20/10 y documentación del sistema de diseño. Las skills frontend-design/webapp-testing están en `.agents/skills/`; los implementadores y QA aplican sus instrucciones antes de editar/probar.

## Qué se perdió y causa comprobada

Referencia buena: **9fbe6ec** (11/10/2026 09:50 Lima), último commit antes de la integración Excel `03791af`. `git show 9fbe6ec:js/app.js` confirma `renderDecisionRow`: tarjetas por decisión, estados opcional/obligatoria, radios HTML reales, precios/descripciones, stepper de cantidades y leyenda «Botón de opción: solo puedes seleccionar una alternativa». `index.html` conserva barra superior, pestañas, encabezado SECCIÓN DE DECISIÓN y SALDO FINAL GUARDADO. No se debe restaurar el motor antiguo: solo recuperar la interacción y jerarquía sobre los contratos canónicos actuales.

En `03791af` se añadió el editor de lotes, `css/excel.css` y `js/engine/ui_excel.js`. Las continuaciones posteriores ocultaron las tarjetas originales al habilitar lotes para evitar doble cargo: otras pestañas remitían a Producción. `d2c0396` distribuyó el editor Excel entre secciones para partidas canónicas, pero mantuvo selects, detalles y tablas. `b4ab7b2`/`65d195b` repararon accesibilidad/edición y la disponibilidad al comprobar conexión; no restauraron la presentación anterior. En HEAD inicial, `renderDecisionCategory()` construye las tarjetas originales y enseguida vacía `decisionCards.innerHTML` cuando `__excel.habilitado`; monta el editor Excel en su lugar. Ésa es la causa inmediata del aspecto distinto: el catálogo legado sigue intacto, pero su render no llega al estudiante de esas partidas.

Se ejecutaron búsquedas solicitadas `git log -S 'Botón de opción: solo puedes seleccionar'`, `-S 'Inversiones y finanzas'` y `--follow` para app, catálogo y CSS. Los recorridos completos de historia siguen lentos en esta copia OneDrive; no se atribuye un resultado vacío a inexistencia. La inspección por `git show` y los últimos 25 cambios de app prueban la referencia y la cadena causal. Seguimiento reciente del catálogo: 34b9b7e, 988e926, f34861f, 03791af, 7b06e34; CSS estudiante: cebba72, f34ea77, 5a2da67. `css/styles.css`: 80aff74, e9b6b92, d07639a, f05350c, 7b06e34.

## Catálogo congelado y matriz de restauración

Hay **68 filas internas Excel**, no 68 nuevas decisiones del estudiante. `js/decision_catalog.js` define 25 entradas, tres informativas, cinco categorías editables más Resumen. La nueva distribución solicitada tiene Empresa, Infraestructura, Producción, Ventas y Finanzas; Logística se integra en Producción sin perder compras/analista/garantía de proveedores. La auditoría del 11/10 fija opciones autorizadas: no añadir depreciación, inventarios, proveedor único, condiciones de pago ni lead time como decisiones nuevas.

La columna «cómo está» describe exclusivamente HEAD inicial 65d195b, antes de esta restauración.

| Segmento objetivo | Decisión | Cómo era | Cómo está | Causa | Restauración realizada |
|---|---|---|---|---|---|
| Empresa | Capacitación INV_RRHH | Tarjetas no/baja/media/alta S/0/1000/6000/12000 | Select en Producción (grupo RR.HH.) | Editor Excel sustituyó radios | Radios en Empresa, mismo código INV-01A/B/C y ausencia=0 |
| Ventas | Marketing INV_MARKETING | Tarjetas baja/media/alta S/1500/6000/12000, opcional | Select en Ventas | Redistribución técnica | Un solo control con tarjetas, sin publicidad libre duplicada |
| Infraestructura | MESA_CORTE | Cantidad mesa S/2500 | Número entre activos | Formulario genérico | Cantidad visible; conservar única mesa obligatoria del modelo actual |
| Infraestructura | ENSAMBLE | Cantidades básica/semi/industrial S/3500/7500/15000 | Selector de aporte + números de activos | Separación Motor/capacidad | Tarjetas y cantidad sin compras duplicadas |
| Infraestructura | ACABADOS | Cantidades básica/semi/industrial S/1200/4500/9500 | Selector de aporte + números de activos | Separación Motor/capacidad | Tarjetas y cantidad preservando aportes |
| Infraestructura | MOLDE | Radios básico/mejorado/premium S/300/1200/3500 | Selector y número de activos/lotes | Integración lotes | Elección explicada y cantidades existentes; no cobrar dos veces |
| Infraestructura | LOCAL_PROD | Tarjeta obligatoria S/2000 | Costo obligatorio calculado | Motor de costos | Tarjeta informativa obligatoria, sin nueva decisión |
| Infraestructura | MANTENIMIENTO | Preventivo opcional S/200 | Checkbox | Sustitución presentación | Tarjeta con elección opcional, mismo costo |
| Producción | PRODUCCION_META | Cantidad directa por molde con stepper | Cantidad por lote, hasta 3 lotes | Contrato Excel | Control directo claro, conservando lotes, segmentos, precio y materiales autorizados |
| Producción | PERS_CORTE | Cantidades por nivel | Matriz nivel/máquina y selector de aporte | Contrato capacidad/Motor | Controles claros conservando matriz; corte solo manual |
| Producción | PERS_ENSAMBLE | Cantidades por nivel | Matriz y selector | Contrato capacidad/Motor | Controles claros sin perder matriz |
| Producción | PERS_ACABADO | Cantidades por nivel | Matriz y selector | Contrato capacidad/Motor | Controles claros sin perder matriz |
| Producción | JEFATURA | No/contratar S/3000 | Select | Editor genérico | Radio no/contratar, costos laborales del motor actual |
| Producción | LIMPIEZA | Costo obligatorio S/600 base | Texto y costo laboral calculado | Motor Costos | Tarjeta obligatoria; mantener beneficios y régimen MYPE/No MYPE |
| Producción | GARANTIA_PT | Radios 30/90/180 días sin caja | Select 30/90/180 | Editor genérico | Radios, sin crear opción sin garantía ni cargo |
| Producción | ANALISTA_COMPRAS | No/contratar S/5000 por ciclo | Checkbox en Logística | Separación técnica | Radio explícito; descuento 12%,10%,… mínimo2% |
| Producción | CUERO | Cantidades sintético/estándar/premium 25/45/80 | Números de compras, selección por lote | Conversión unidades Excel | Cantidades visibles con presentación/rendimiento y costo real |
| Producción | ACCESORIOS | Cantidades económico/premium 4/9 | Números compras y selección por lote | Conversión unidades Excel | Cantidad visible, solo dos calidades |
| Producción | HILO | Cantidades estándar/reforzado/tenacidad 2/4/7 | Números compras y selección por lote | Conversión unidades Excel | Cantidad visible, conversión carretes conservada |
| Producción | GARANTIA_PROV | Radios sin/80%/100% devolución | Select | Editor genérico | Radios conservando elección, sin inventar evento de falla |
| Ventas | CANALES | Web S/500 y tiendas por distrito S/1800/3500/2200 | Select canal + tres cantidades | Motor y contrato distrito | Canal con distrito/cantidades claros; contratos 12 ciclos actuales |
| Ventas | PERSONAL_VENTAS | Información vendedor automático, comisión1% | Regla calculada | No es elección | Mostrar regla; no inventar control |
| Ventas | CREDITO_VENTAS | Porcentaje automático, sin control | Regla automática | No es elección | Mantener información y cálculo, sin selector |
| Ventas | DEVOLUCIONES | Nota automática sobre producto fallado | Regla/evento | No es elección | Mantener nota |
| Finanzas | PRESTAMO | Importe con slider/número, TEA docente | Importe + select acceso bancario | Unificación parcial anterior | Un control coherente, TEA fija, línea disponible e importe claros |

Los sueldos de corte del motor literal son 1500/2000/3800; el catálogo legado conserva 1500/2500/4000 como referencia. No cambiar las fórmulas del oráculo para igualar etiquetas antiguas. La capacitación pertenece a INV_RRHH; la capacitación de instalación de activos es otro componente del costo Excel y no una decisión nueva. Garantía proveedor no tiene evento de devolución definido por el libro; restaurar el selector no autoriza inventarlo.

## Estado intermedio conservado — consultar cierre de entrega

- UI: pendiente de cierre y capturas escritorio/móvil.
- Motor/guardado por ítem/conexión: pendiente de cierre.
- Flujo sala/Tablet/ciclos automáticos/enviar: pendiente de revisión.
- QA independiente: pendiente Node, 3104 comparaciones del oráculo, SIM-1/2/3 y SIM-A/B/C, recorrido completo 3 ciclos y pruebas de cobertura de catálogo.
- No considerar los 490 tests informados en el turno anterior como validación de esta nueva restauración.
- Excepción histórica documentada: supplied_npcs.cjs «customers complete a decision» fue reproducida en d1c83f3 según reports/correcciones_docente_estudiante_2026-10-20.md. Si reaparece, comprobar evidencia actual antes de atribuirla como preexistente.

## Criterio de SQL y publicación

Restauración prevista en presentación y persistencia existente; no hay necesidad de SQL nueva identificada en arqueología. La migración 2026-10-20_correcciones_docente_estudiante.sql es antecedente independiente, no SQL de esta restauración. Confirmar al cierre del diff. No ejecutar SQL en producción. Push a main autorizado por el usuario condicionado a verificación; registrar hashes, resultados exactos y cualquier excepción pendiente aquí.

## Punto de continuación de implementación

Commits locales: `0a4562a` (arqueología y runner reproducible del oráculo), `58218cf` (tarjetas/restauración/guardado por ítem). Implementación de producción cerrada, QA independiente en curso. No hay push de esta misión todavía.

- Cinco pestañas: A Empresa/capacitación; B Infraestructura; C Producción/personal/materiales; D Ventas/marketing/distritos; E Finanzas/préstamo. A conserva debajo los resultados/resumen, historial y detalle financiero.
- Radios visibles con precio/descripcion y leyenda, cantidades existentes, distintivos e impacto en caja; selects internos ocultos conservan compatibilidad de los drivers. Producción agrupa 44 controles en 15 tarjetas, con personal por área, materiales por familia y plan por lote. No se amplían catálogos ni opciones congeladas.
- `__excel.decisiones` sigue siendo el borrador recuperable; `decisionesGuardadas` y `saldoFinalGuardado` son el presupuesto confirmado por guardar. Guardar una tarjeta copia sólo sus campos; otras elecciones siguen pendientes. Enviar confirma el plan completo con las validaciones existentes. Ninguna de estas proyecciones cobra dinero: el adaptador único de caja sigue registrando el cierre.
- El saldo del encabezado no cambia por editar; muestra «SALDO FINAL GUARDADO / No cambia hasta guardar». Estado «Cambios pendientes de guardar» vuelve al editar una tarjeta guardada. Al cierre se muestra la caja real del resultado.
- Motor matemático, SQL, 3D y avatares no se modifican. Campos adicionales viajan en el envelope JSON existente. No se identifica migración Supabase nueva necesaria.
- QA D: 89 comprobaciones Chrome 1440/390 (sala, 3 ciclos × 5 pestañas, guardar, pausa/reanudación y bloqueo enviado/cierre/final), 34 pruebas Node de admisión/reingreso/pausa/Tablet y tutorial de espera aprobados. La prueba D siembra el estado enviado: no sustituye la prueba de envío real de QA E.
- Oráculo de esta misión: `node tests/restaurar_decisiones_oraculo.cjs`, **3104/3104, cero diferencias**, valores Excel recalculados previamente y versionados; no se regeneró ni modificó el libro fuente. Evidencia `tests/output/restaurar-decisiones/oracle.json`.
- SQL local PGlite: `decision_options_db.cjs`, `excel_sql_db.cjs` y `game_lifecycle_db.cjs` aprobados. No hubo conexión de escritura a Supabase de producción.
- Línea base NPC: `supplied_npcs.cjs` pasó casos assets suministrados y fallback (68.595 s), resumen `tests/output/mejora-integral-2026-10-01/decisiones-baseline/summary.json`. El empaquetador posterior falló EBUSY intentando restaurar su propio log redirigido dentro de tests/output; es un error de empaquetado, no de NPC. Se verificará el runner directo al final.
- D detectó etiqueta «Volver al mundo» oculta por especificidad del encabezado de producción; se añadió regla específica en tablet-return.css y cache-bust. Revalidación Tablet pendiente.
- QA E está ejecutando SIM-1/2/3, SIM-A/B/C, cobertura exhaustiva de catálogo y Node completa. La primera Node encontró dos drivers antiguos que aún pulsaban F; se adapta distribución a C sin alterar cálculos/validaciones. No contabilizar esa corrida inicial como verde.


### Segundo punto de continuación — QA independiente

- SIM-1 aprobada: 4 empresas, 1 ciclo, cierre docente, 468 salidas pipeline y 351 componentes, sin diferencias. SIM-2 aprobada: 2 empresas, 3 ciclos, 585 salidas. SIM-3 aprobada: 5 empresas, 3 ciclos, 1140 salidas; sin errores JS y sin desborde móvil. Logs `tests/output/restaurar-decisiones/sim{1,2,3}-final.log`.
- Cobertura independiente del catálogo aprobada: 25 entradas, 82 interacciones visibles con guardado por tarjeta, todas las alternativas y cantidades autorizadas, incluido 2000/90 de hilo sin redondeo. `tests/restaurar_decisiones_catalogo.cjs` + wrapper `.test.cjs` incorporan esta protección a la batería por defecto. JSON y capturas `tests/output/restaurar-decisiones/catalogo.json`, `portal-*.png`.
- El primer intento SIM-1 detectó `step=1` en compras, que truncaba 22.222… carretes a 22. Se corrigió exclusivamente la captura de materiales a `step=any`; activos/personal siguen enteros. Nueva regresión en `decisions_interactivity.test.cjs` exige conversión exacta y rechazo de negativos. No se tocaron cantidades de escenario ni fórmulas para hacer pasar la simulación.
- Se restauraron directamente desde el catálogo las notas automáticas de Ventas (personal, crédito y producto fallado), sin añadir controles. Se añadió TEA vigente de lectura al préstamo, derivada del mismo contexto del motor.
- Revisión de capturas detectó que CSS legado seguía recortando SALDO FINAL GUARDADO y SECCIÓN DE DECISIÓN. Se restituyeron ambos con encabezado adaptativo y se compactó el panel obligatorio en un desplegable con total siempre visible; se elimina el encabezado técnico redundante del editor dentro del portal.
- Ajuste semántico UI en curso al escribir este punto: un radio de nivel máquina/molde/personal modifica evaluación, pero comprar/contratar corresponde a sus cantidades. Se agrupan como una decisión para guardar juntos y se diferencia precio referencial de salida real. Evidencia VM: elegir INF-08 sin cantidad no cambia caja; añadir una unidad sí. No asignar cantidades automáticamente ni inventar compras.
- Commit adicional `e540813` conserva notas/precisión/retorno Tablet y prueba de flujo. Falta cerrar SIM-A/B/C, repetir Node completa y pruebas UI/Tablet/NPC sobre estado final antes del push.


### Cierre de implementación visual y semántica

El pase final agrupa Infraestructura en cinco tarjetas (mesa, ensamble, acabado, moldes y mantenimiento) y Producción en doce. Cada selector de nivel queda junto a las cantidades del mismo equipo o personal y se guarda con ellas. Los niveles son referencia para evaluación, no una compra automática; los importes reflejan adquisición, mantenimiento y remuneración calculados por el motor. Los controles de radio de Infraestructura/personal se abren por defecto para que la elección sea visible. Las asignaciones de material/molde del lote indican que usan lo comprado y no anuncian cargos inexistentes.

La comparación del motor, catálogos, SQL y assets contra `65d195b` no encuentra cambios. Solo se modifica `ui_excel.js` dentro de js/engine; los módulos matemáticos permanecen idénticos. Los tests adicionales corrigen la ruta de los artefactos SIM a `tests/output/restaurar-decisiones/sim/`; las capturas históricas versionadas de reports/sim se preservan.

Resultados ya cerrados: SIM-A/B/C **442 comprobaciones aprobadas**, cinco empresas y tres ciclos en cada simulación, cero errores JS. Batería Node final **496/496**, cero fallos/omitidas/canceladas, incluyendo cobertura exhaustiva del catálogo por defecto. Editor de navegador a 360/414/1150/1440 px aprobado. Queda en ejecución la secuencia final de Python/Tablet/NPC y documentación de publicación; no se debe interpretar este checkpoint como push realizado.


## Cierre de entrega

La versión final conserva cinco pestañas con radios y cantidades editables, las opciones del catálogo congelado, guardado independiente por decisión, borradores recuperables y envío del plan completo. Se recuperó la jerarquía de la referencia histórica 9fbe6ec sin restaurar sus fórmulas antiguas. La captura mencionada no llegó adjunta; la verificación visual usa la descripción solicitada y la versión de Git, no una comparación píxel a píxel con un archivo inexistente.

### Pruebas finales verificadas

| Verificación | Resultado | Evidencia local |
|---|---|---|
| Node sobre el código final | **496/496**, cero fallos/omitidas/canceladas; segunda corrida completa 123.8 s | `tests/output/restaurar-decisiones/node-exact-head.log` |
| Catálogo autorizado, prueba incluida en la batería Node | **25 entradas, 82 interacciones visibles**; radios, cantidades, guardado y valor del motor; escritorio/móvil | `catalogo.json`, `portal-{A,C,D}-{1440,390}.png` en la carpeta de evidencia |
| Oráculo Excel | **3104/3104, cero diferencias** contra valores versionados recalculados en Excel | `oracle.json`, `oracle-final.log` |
| SIM-1 / SIM-2 / SIM-3 | **Aprobadas**, cierre docente, caja, resultados y paridad; 468/585/1140 salidas pipeline + 351 componentes | `sim{1,2,3}-final.log`, carpeta `sim/` |
| SIM-A / SIM-B / SIM-C independientes | **442 comprobaciones aprobadas**, cinco empresas × tres ciclos en cada una, sin errores JS | `simABC-final.log` |
| Flujo con acceso autoritativo | **89 comprobaciones aprobadas**, 1440/390, sala, ciclos 1–3, cinco pestañas, guardado, pausa/reanudación, enviado/cierre/final | `flujo-final.log`, `flow-results.json` |
| Edición/sincronización y envío real | **32 comprobaciones aprobadas**, recuperación tras recarga, límites, plazo, caja/capacidad, siete tamaños, confirmación y cero errores JS | `editable-browser-final.log` y `tests/output/decisions-editable/checks.json` |
| Editor adaptativo | Aprobado a **360/414/1150/1440 px**, sin desborde, cinco pestañas | `engine-browser-final.log` |
| Tablet y mundo 3D | **60 retornos consecutivos aprobados**, desde botón/noticias/oficina; cámara, foco, WASD, caja y decisiones conservados | `tablet-final.log` |
| Persistencia SQL local | Aprobadas opciones múltiples, CAS, idempotencia, cierre Excel y ciclos/pausa/permisos en PGlite | `decision-db-final.log`, `decision-options-db.log`, `excel-sql-db.log`, `lifecycle-db.log` |

Las pruebas de servidor remoto se realizan con dobles aislados y PostgreSQL local; no se probaron escrituras sobre cuentas ni partidas reales de Supabase. Las pruebas de mundo/Tablet sí cargan Three.js y assets reales en Chromium. El flujo autoritativo aislado siembra el estado enviado para comprobar acceso; el envío real se comprueba por separado en la prueba de edición y en las seis simulaciones.

### Supabase

**No hace falta actualizar Supabase para esta restauración. No hay SQL nuevo que ejecutar.** Los campos `decisionesGuardadas` y `saldoFinalGuardado` se conservan dentro de `decision_state.__excel` en el snapshot JSON existente; las decisiones y los planes confirmados siguen usando el mismo contrato de cierre. Las migraciones anteriores del proyecto conservan sus requisitos originales, pero no se propone ni ejecuta una migración adicional aquí.

### Qué puede decidir el estudiante

- **Empresa:** no capacitar o elegir capacitación baja/media/alta; consultar resumen y resultados.
- **Infraestructura:** mesa, niveles y cantidades de máquinas, moldes y mantenimiento preventivo.
- **Producción:** personal por área/nivel/máquina, régimen laboral, jefatura, cantidades y precio por lote, asignación de molde/materiales, compras, analista y garantías autorizadas.
- **Ventas:** marketing mediante un único control, canal web/físico y tiendas por distrito; las reglas automáticas permanecen informativas.
- **Finanzas:** monto del préstamo dentro de la línea disponible, con la TEA vigente visible sin un selector nuevo de tasa.

Cada tarjeta conserva las etiquetas, precios/descripciones y controles de su decisión. Guardar actualiza solo su presupuesto; editar otras tarjetas no altera el saldo final guardado. Enviar valida y confirma el ciclo; el cierre calcula y registra los movimientos una sola vez.

### Publicación y pendientes

Commits pequeños locales: `0a4562a`, `58218cf`, `e540813`, `7a4bd79`, `a6605fc`. Runner NPC final directo aprobado en ambos casos: assets suministrados y fallback; salida 0 (`tests/output/restaurar-decisiones/npc-final.log`). No se reprodujo el fallo histórico y no bloquea esta entrega. No quedan pendientes de implementación ni pruebas. Publicación a main autorizada y en ejecución al guardar este informe. El contenedor padre solo contiene SIDE1 y no se alteraron repositorios externos.

La ejecución final de NPC evita el empaquetador que había producido EBUSY en la línea base. Ambos casos pasan sin cambiar avatares ni código de NPC; por tanto no hay excepción de pruebas necesaria para publicar.
