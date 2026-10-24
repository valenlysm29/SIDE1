# Revisión independiente G — separación 2D / 3D

Revisión realizada sin autoría previa del bridge ni del código de producto. Se inspeccionaron `js/shared/world_bridge.js`, proveedor en `js/app.js`, accesos del simulador, etiquetas e integración de navegación, migración SQL y runners existentes. No se ejecutó SQL ni se cambiaron fórmulas. La ejecución de navegadores está centralizada en el agente principal para evitar competencia GPU.

## Hallazgos comunicados antes de cerrar

1. **Escritura indirecta desde snapshot:** el proveedor original llamaba `activeStudentEvents()`, que guarda `SIDE_STUDENT_EVENTS_*` en localStorage. Aunque no altera directamente caja, leer desde 3D no debe generar estado del motor. Se pidió al agente principal convertir la lectura de eventos a pura.
2. **Costo del proveedor:** cada consulta `saved/qty/owned/HUD` puede recalcular `productionPlan()` y eventos. Se recomendó cache/publicación coherente para no calcular el motor repetidamente por fotograma.
3. **Etiqueta residual:** tutorial del simulador indicaba “meta de ingresos”; se comunicó para sustituir por puntos.

## Verificación de frontera y SQL

- El bridge proyecta claves permitidas; usa serialización para eliminar referencias vivas, congela recursivamente y entrega nueva copia congelada. Ante excepción del proveedor conserva el último snapshot válido.
- `emitFunSale` solo escribe `side3d_fun_receipts_*`; inventario, día, audio, contador, operación y controles del simulador usan `side3d_fun_*`.
- Búsqueda estática del simulador sin acceso a Supabase, motor, `SIDE_RULES` ni `SIDE_GAME_BRIDGE`; recibe `SIDE_WORLD_BRIDGE` y navegación separada. POS conserva inventario y puntos recreativos locales.
- La navegación hacia Tablet sigue explícita y con retorno cuando no hay API o esta rechaza apertura. La revisión de admisión/retorno completa y pruebas WebGL corresponden al agente principal.
- `2026-10-23_separacion_2d_3d.sql` elimina solamente los dos triggers históricos; guarda existencia de tablas, es transaccional, repetible y documenta orden/reversión. No crea tabla recreativa ni modifica funciones o fórmulas del motor vigente.

## Runners revisados y cambios de contrato

Se actualizaron `continuous_world.cjs`, `world_business_ui.cjs` y `world_population_flow_browser.cjs`: sus fixtures usaban funciones retiradas `decisionCash()` y `bridge().ledger`. Ahora observan puntos locales con `operationalCash()` y capturan **por separado** caja, ledger y decisiones económicas. Pedidos, entregas y checkout deben conservar exactamente el snapshot económico, mientras conservan sus aserciones de puntos, stock recreativo y entrega única. No se sustituyen cálculos económicos esperados para esconder diferencias.

`playable_hub.cjs` exigía exactamente tres peatones aunque `hubNpcLimit()` entrega cuatro en modo auto/medium, dos en low y cinco en high. En su configuración predeterminada se verifica mínimo tres y se conservan las comprobaciones de identidad no duplicada, animación y movimiento. La base congelada 18d88e7 confirmó fallo anterior: actual 4, esperado 3.

La misma base congelada confirmó `continuous_world` fallando al exigir débito económico por pedido recreativo: actual 53312.508, esperado 52952.508 (diferencia 360). Los fallos completos anteriores y posteriores se deben registrar en el informe principal, sin declararlos regresiones corregidas sin prueba.

Validación local de sintaxis: `node --check` pasó para los cuatro runners editados. No se lanzaron navegadores desde G. Resultados completos: consultar informe principal y logs en `tests/output/separacion-20261023/`.

## Revisión del parche posterior

El bridge final usa publicación push desde el ciclo de vida 2D: `getWorldSnapshot()` ya no ejecuta proveedores ni funciones económicas. Quedan resueltos los hallazgos 1 y 2 anteriores. La publicación visual captura errores de producción y mantiene el snapshot anterior. La navegación guarda admisión por empresa/sala y conserva cancelación/expulsión.

Se señaló adicionalmente que `canVisitFunWorld()` consulta `studentAccess()` antes de reutilizar admisión; si esa función falla por dependencias económicas averiadas puede impedir retorno. Se solicitó aislamiento del fallo para sesiones admitidas manteniendo los bloqueos explícitos de expulsión/cancelación. El agente principal verifica esa última corrección y el texto tutorial pendiente.

Ejecución independiente de `node --test tests/world_bridge_separation.test.cjs`: **6/6**. Incluye snapshot inmutable, falta de storage/publicación, SIM-1/2/3 con 120 operaciones POS reales frente a ausencia de mundo/proveedor fallido, y prohibición estática de servicios económicos.

## Segunda pasada de runners y publicación por ciclo

Se migraron también `world_startup.cjs` y `game_lifecycle_ui.cjs` a funciones de permisos 2D existentes, conservando las aserciones de sala de espera, acceso y envío completo. `world_cycle_restart.cjs` conserva escenarios de retorno, reinicio, historial local y tres ciclos; ahora espera publicación del ciclo sin exigir cierre del mundo ni Tablet forzada, y prueba ausencia de mutadores económicos. `decisions_cycle_ui.cjs` comprueba que un stock recreativo de 75 no aporta producción al 2D; conserva casos objetivo cero/sobreproducción con registro económico de prueba explícito y separado. Los cuatro pasan `node --check`.

Se detectó que cambiar ciclo desde `tickStudentGame` con Tablet oculta no publicaba la nueva proyección: el getter puro no puede descubrirlo por sí mismo. Se comunicó al agente principal añadir publicación al hook de cambio de ciclo; el runner de reinicio exige ahora `getWorldSnapshot().cycle === round` para cubrir este caso.

El aislamiento `canVisitFunWorld` quedó revisado con `try/catch` para mantener admisión válida ante error del motor, preservando expulsión y cancelación cuando el estado las confirma.

## Cierre de hallazgos

Revisión final: `loadDecisionState()` publica identidad y ciclo mediante `publishWorldIdentity()`; por tanto la actualización de ciclo con Tablet oculta quedó resuelta. La publicación de ambiente incorpora identificación y nombre de productos. `canVisitFunWorld()` preserva admisión ante excepciones de dependencias económicas y mantiene expulsión/cancelación conocidas.

La base congelada reveló también `world_cycle_restart` llamando al antiguo mutador inexistente y `world_startup` esperando `companyStartWorld` tras un envío global que ya abre el selector de personaje. El runner startup ahora exige el selector en envío global y conserva el botón de resumen tras recargar los envíos independientes. Se mantiene la prueba de fallo controlado de carga, economía intacta, reintento y arranque sin doble ejecución. Esta corrección afecta únicamente al test, y debe verificarse en la batería WebGL del principal.

## Últimas inyecciones de runners

Se retiraron referencias al getter eliminado `bridge()` en `gameplay_hud.cjs` y `world_entry_assets.cjs`; los fixtures leen directamente el ledger 2D para comprobar que sigue intacto. `decision_interiors_browser.cjs` sustituye temporalmente el objeto de navegación completo por un spy y lo restaura; no intenta mutar una API congelada.

La base congelada también mostró un supuesto temporal incorrecto en assets: esperaba cuatro personajes nuevos tras esperar detalles, aunque podían estar cargados antes de la muestra inicial (delta observado cero). El runner conserva identidad de escena, número estable de actores interiores, posiciones, ledger y modelos definitivos; permite personajes previamente cargados y verifica que el crecimiento de hijos de escena coincide exactamente con los personajes realmente añadidos, con límites de población de la configuración gráfica.

`npc_world_fixes_browser.cjs` tenía igualmente el conteo histórico “tres peatones y guía” (esperado cuatro; baseline observó cinco). Ahora exige exactamente `hubNpcLimit()+1`, sin alterar verificaciones de movimiento, altura, suelo, colisiones, vehículo y HUD. Sintaxis verificada. El principal también separó el efecto visual recreativo al nodo `simFunFx`, retirando la escritura del mundo en el nodo de caja económica compartido.

`supplied_npcs.cjs` también exigía cuatro actores de ciudad y tres peatones, aunque el modo automático configura cuatro peatones más guía. Se migró al conteo exacto `hubNpcLimit()` y `+1` para guía, incluyendo los tres rebuilds. La prueba de preview independiente de cuatro modelos y 17 huesos permanece idéntica. `mona_npc.cjs` y `npc_locomotion.cjs` no contienen el contrato incorrecto de cantidad de peatones. Sintaxis del runner actualizado verificada.

La repetición base de `mona_npc.cjs` confirmó además guía aparentemente ausente en `diagnostics.characters`. Causa estática: diagnostics enumera solo nodos con `userData.modelKind`, mientras la guía procedural creada antes del catálogo carece de esa marca; sí existe en `animatedActors` con rol y nombre. No es una carrera corregible esperando más tiempo. Con autorización del principal, el fixture inspecciona directamente ese actor real mediante inyección local y conserva nombre, posición, conversación mediante caminar/interactuar, modelos/fallback y render. No se modificaron diagnostics ni código de producto por este defecto previo de observabilidad. Sintaxis verificada.

## Seguimiento de batería integral final

La primera corrida integral posterior encontró nuevos contratos obsoletos: `continuous_world` aún descontaba comisión económica del 1% del cobro recreativo; ahora exige puntos completos y economía idéntica. El fixture `supplied_npcs` esperaba un solo cliente total pese a clientes ya presentes: se limpia el flujo únicamente antes de su escenario determinista, manteniendo el spawn real y checks de navegación.

Se corrigió un problema visual real: las nuevas etiquetas/aviso pueden aumentar la altura del HUD, superando el top fijo de misiones móvil. `resize()` publica el borde inferior medido del HUD y CSS coloca las misiones debajo, conservando aserciones de ausencia de solapamiento.

Se eliminó una dependencia DOM del namespace: el código de sala en `lobbyCode` puede cambiar al hidratar la vista tras recarga, aunque empresa y sala sean las mismas. La proyección 2D incluye ahora `company.gameCode` y las claves recreativas usan ese snapshot. El runner de pedido conserva su aserción estricta de persistencia y registra claves/valor para confirmar la resolución, sin asumir éxito antes de ejecutarlo.

Permanece en investigación del equipo la interacción del modal de costos: en la corrida integral el backdrop interceptó el botón Entendido al pasar de ciclo. No se usó force-click para ocultar el fallo. Los resultados posteriores deben prevalecer y constar en el informe principal.

## Cierre independiente posterior a correcciones reales

Se verificó la causa real de la pérdida de recursos tras recarga: **no era la clave**; `resetGameSession()` reiniciaba incondicionalmente `businessState.expenses` a cero. La corrección conserva el gasto recreativo normalizado, junto con pedidos/mejoras persistentes. El cambio a `company.gameCode` sigue eliminando la dependencia DOM de la clave, pero no debe atribuirse a él la resolución de aquel fallo de persistencia.

`cycle_cost_notice.js` ahora retorna antes de leer/cobrar/sincronizar estado económico cuando mundo 3D o carga están visibles. El recibo económico sigue disponible al regresar a 2D; esta corrección evita interrumpir diversión y mantiene la contabilización exclusiva del motor.

Verificación independiente ejecutada tras los últimos cambios: `node --test tests/world_bridge_separation.test.cjs tests/world_cost_notice_separation.test.cjs`, **10/10**, incluidos conservación de gastos tras reinicio/recarga y cero lecturas/escrituras del aviso con mundo/carga visibles. Se inspeccionaron también `company.gameCode` en ambas publicaciones y su uso por el namespace, y la medición real del HUD para separar misiones.

El rerun WebGL central confirmó HUD y ambos modos de supplied NPC en verde. Al redactar esta actualización aún faltaba repetir `continuous_world` tras corregir su expectativa histórica de sesión nula, y repetir `world_business_ui`/`world_cycle_restart` tras los arreglos de gasto y aviso. **No se declara verde total hasta esas repeticiones**. El informe principal debe recoger sus resultados definitivos.

## Corrección adicional de asignación visual NPC

La corrida de interiores mantuvo todas las comprobaciones y detectó modelos visibles duplicados al alternar calidades. Se encontró un defecto determinista en `npc_city_roster.draw`: para peatones exteriores, si la bolsa parcial solo contenía modelos presentes cerca, elegía uno duplicado aun habiendo otros modelos libres en el conjunto completo. Se extendió a exteriores la búsqueda de alternativas libres que ya se hacía para interiores; solo se permite duplicado cuando todo el conjunto válido está ocupado. No toca economía, roles aprobados ni límites de población.

Prueba nueva reproduce la bolsa parcial agotada con un trabajador interior y alternativas exteriores libres; `node --test tests/npc_city_roster.test.mjs`: **6/6**. La atribución del fallo concreto de interiores queda pendiente de repetición WebGL: el test conserva unicidad estricta y registra ahora IDs, roles y posiciones de todos los actores visibles para distinguir cualquier otra causa.

## Evidencia definitiva de los casos pendientes

Revisados los resultados posteriores guardados por el principal:

- `tests/output/separacion-20261023/browser-final.log`: **cinco runners principales PASS**, incluidos continuous_world (10 escenarios), persistencia real del pedido tras recarga, reinicios durante tres ciclos, retorno Tablet (60 pasos) y equivalencia económica tras 30 POS.
- `tests/output/separacion-20261023/interiors-final-summary.json`: **decision_interiors PASS**, con las doce combinaciones de calidad/sala y unicidad estricta. Esto confirma el caso concreto que fallaba tras alternar calidades; la corrección del reparto NPC quedó verificada en WebGL, ya no pendiente.
- `tests/output/separacion-20261023/mobile-layout-final-summary.json`: **mobile_integral_ui y gameplay_hud PASS**, seis viewports y 126 capturas; la corrección final usa altura medida y espacio disponible en horizontal.

Los defectos de persistencia, aviso durante diversión, unicidad y solapamiento descritos arriba quedan resueltos según esas repeticiones reales. La revisión independiente no conserva bloqueos estáticos. El principal está cerrando la repetición total Node; su informe principal debe registrar el conteo y resultado final antes del push condicionado a todo verde.
