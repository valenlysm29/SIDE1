# Auditoría del motor SIDE contra el Excel — 23/10/2026

## Resultado

Se completó la auditoría ejecutable del motor y se corrigieron los defectos reproducidos de consecuencias, mercado y precisión de inventario. La auditoría distingue fórmulas originales, anomalías del propio libro y reglas históricas sin fórmula fuente. No se declara igualdad con una celda que no existe ni se inventan recetas de dotación desde la cantidad.

Fuente intacta: `.codex-work/DECISIONES_SIDE_16.xlsx`, SHA-256 `3b6b42bbbc56a2534ce7e241c607d572dd38dcf02311683609497df36a0c1eb1`, verificado antes y después. Se aplicó la skill xlsx, leyendo fórmulas y caché por separado. Todos los archivos y ejecuciones permanecieron en SIDE1.

## Defectos corregidos

| Hallazgo | Fuente original | Antes en SIDE | Corrección |
|---|---|---|---|
| CONS-06 por meta en lugar de producción | `Matriz_Consecuencias!C7`: cantidad **producida** > capacidad instalada | Meta 520 y capacidad 396 generaban horas extra aunque se produjera menos de 396 | `consecuencias.js` compara producción efectiva; `ciclo.js` pasa el dato. No activa con datos omitidos. No se introduce tarifa nueva. |
| Calidad predeterminada para mercado | `Costos De Producción!E118=ROUND(D118/$D$122*100,0)` | Calidad de materiales×10 con tope 100; solo los tests forzaban el modo literal | El valor predeterminado usa el proxy de reputación del libro. Los tests originales llaman sin override que oculte el predeterminado. |
| Denominador medio/premium distinto del original | `E131:E134`, `E144:E147` mantienen `$D$122` económico | Se normalizaba dentro de cada segmento | El cierre reúne las poblaciones y comparte el total económico. Se conserva la referencia absoluta original y se permiten resultados superiores a 100. |
| Falso sobreconsumo y stock residual decimal | `Costos!G54=D54+E54-F54`; precisión ya establecida de 15 cifras | 0,1+0,7 podía rechazar consumo 0,8; otros casos dejaban residuos de 5,55e-17 | Se normaliza la suma antes de validar y restar en costos e inventario. Un sobreconsumo real sigue rechazado. |

Detalles y pruebas por archivo: [consecuencias](auditoria_correcciones_consecuencias_20261023.md), [mercado](auditoria_mercado_20261023.md), [costos/caja](auditoria_costos_caja_20261023.md).

## Auditoría directa del original

`tests/audit_excel_original_20261023.py` inventaría las diez hojas: **3.047 celdas no vacías, 871 fórmulas, 215 familias estructurales**. Las familias son un inventario de fórmulas relativas, no una afirmación de que todas sean correctas. Reportes completos: [Excel original](auditoria_excel_original_20261023.md) y su JSON.

Se ejecutaron **12 escenarios** sobre copias del original mediante Microsoft Excel COM 16.0, sin añadir hojas y sin reescribir el original. Se perturbaron poblaciones y precios de mercado, personal, eficiencia superior a uno, nómina, activos, cantidades por molde y calidad de lotes. Las copias conservan las fórmulas originales; los experimentos de operandos se registran aparte.

Se extrajeron **9.648 valores de celdas**: 9.144 resultados de fórmulas y 504 literales necesarios para contrastar todos los componentes laborales. El comparador ejecutó **4.272 comprobaciones**: **4.220 válidas sin diferencias** y 52 observaciones de errores devueltos por el propio Excel. Estas últimas se identifican como `source_error`, no como igualdad numérica. Los resultados cubren ambas hojas de capacidad, los nueve requerimientos de materiales, componentes de nómina de ambos regímenes, activos, puntajes, lotes y mercados.

Las seis diferencias pequeñas encontradas inicialmente contra cachés salariales de seis decimales desaparecen al recalcular las fórmulas originales con Excel. No se añadió ROUND al motor para copiar una caché truncada.

Cuatro experimentos adicionales verifican la identidad decimal de `G54`. Sustituyen deliberadamente el operando `F54` en copias; están marcados `formula_modified_in_copy=true` y **no se cuentan como escenarios con fórmulas originales intactas**. La fuente real permanece intacta.

Reproducción: generar planes con `tests/audit_excel_original_20261023.py`, recalcular con `tests/auditoria_original_com_20261023.py`, comparar con `node tests/auditoria_original_20261023.cjs`. El modo `--read-existing` solo vuelve a extraer celdas de copias ya recalculadas si coinciden el hash fuente y todos los operandos con el manifiesto de ejecución; no utiliza resultados SIDE como esperados. Fixture versionado: `tests/oracle/auditoria_original_recalculado_20261023.json`; evidencia detallada: `reports/auditoria_recalculo_original_20261023.json`.

## Anomalías del Excel y criterio aplicado

- **24 frente a 30 días y productividades distintas:** ejecución usa CANTIDAD; las comprobaciones de la hoja Costos usan sus propios 30 días y productividades. No se mezclan ambas tablas.
- **Referencia económica en mercados medio/premium:** se conserva literalmente; no se sustituye silenciosamente por el total de cada segmento. Se documenta incluso si puede tratarse de una referencia accidental del autor.
- **Errores de fórmula:** cuatro `#DIV/0!` ya están en la caché original como texto; tras recálculo aparecen también errores IFS y casos de divisiones sin guarda. Se registran sus coordenadas. El juego mantiene guardas finitas para precios empatados, población vacía y meta cero, explícitamente como comportamiento operativo.
- **Compras con constantes incoherentes:** se usan las unidades productivas rotuladas `V76:X83` y conversiones `D32:K33`; no se copian cantidades incrustadas incompatibles de AB77/AB82/AB83. Para consumir y valorar se conserva la cantidad efectivamente fabricada; no se trunca 107,5 a 107 por el ejemplo AB89.
- **CONS-03 y CONS-08:** la matriz contiene texto, sin fórmula que ordene sus efectos respecto a topes físicos. Se conserva la reducción posterior a los límites de material/capacidad para no consumir más stock ni fabricar más de lo disponible. Se identifica como criterio de integración, no como precedencia demostrada por una celda del libro.
- **Fórmulas ausentes:** dotación inversa, tiempo por unidad, tarifa de horas extra, almacenaje, incremento bancario, calendario de caja y combinación de descuentos no tienen una definición numérica completa en el original. Se conservan las extensiones históricas ya existentes y su procedencia, sin inventar nuevos importes ni presentarlas como fórmulas originales. La recomendación inversa sigue marcada como no definida en el DOP.

El alcance de auditoría queda concluido con estas salvedades de fuente. La validación no convierte reglas históricas o contradicciones del libro en fórmulas únicas.

## Regeneración y pruebas

Los oráculos históricos se reconstruyeron desde decisiones y fórmulas; Excel calculó los esperados antes de ejecutar el comparador SIDE. Se respaldaron los archivos previos en `.codex-work/auditoria-20261023/oracle-backup`. **696 de 3.104 salidas cambian** por las correcciones, con cada clave y valor anterior/nuevo en [transición de oráculos](auditoria_transicion_oraculos_20261023.json). No se copiaron obtenidos del motor para fabricar esperados.

- Ocho escenarios históricos: **3.104 salidas, cero diferencias**. Catorce casos DOP del original: cero diferencias.
- SIM-1: un ciclo, cuatro empresas, **468 salidas, cero diferencias**.
- SIM-2: tres ciclos, dos empresas, **585 salidas, cero diferencias**.
- SIM-3: tres ciclos, cinco empresas, **1.140 salidas, cero diferencias**.
- Navegador DOP: **767 comprobaciones**, cero errores; cantidades, guardado, stock, costos y caja.
- Persistencia PostgreSQL local y tarjetas por pestaña: pasan. No se ejecutó SQL remoto.
- Batería Node completa: **568/568**, cero fallos, cancelados u omitidos; duración 571,3 segundos. Registro: `tests/output/auditoria-20261023/node-final.log`. No hubo fallos NPC en esta ejecución.

## Entrega

Cambios por área en commits; no se modifican decisiones, avatares ni mundo 3D. Se actualizan las claves de caché de estudiante/docente. **No hay que actualizar Supabase ni ejecutar SQL.** La petición posterior «haz push» autoriza la publicación de esta revisión de auditoría, incluidos los commits locales anteriores.

El primer push normal a `origin/main` confirmó `159e5fc..7935244`, con código corregido, pruebas, oráculos y evidencias independientes. El cierre documental incorpora el resultado final 568/568 en un commit posterior y se publica mediante un segundo push normal, sin forzar. Antes del cierre se comprobó la ausencia de diferencias de formato, el hash original intacto y que el directorio contenedor únicamente tiene SIDE1. Se restauró únicamente el bytecode generado por las pruebas.


## Adenda: mundo 3D e ingresos del Excel (17) — 23/10/2026

### Versión y alcance

Revisión posterior al commit `5c87bb3`, publicado en `main`, que conecta los ingresos del flujo actual con las tablas de mercado del Excel (17). Esta adenda amplía la auditoría anterior; sus resultados históricos no sustituyen las pruebas de la versión actual. Se revisaron entrada al mundo, navegación, colisiones, interiores, almacén, pausa, retorno, HUD, caja y cierre de ingresos. En esta revisión solo se añadió una prueba de navegador y esta documentación; no se modificó código del juego ni se ejecutó SQL remoto.

Se utilizó Chrome sin interfaz, con WebGL por SwiftShader, servido desde SIDE1. Las peticiones externas se bloquearon para aislar las pruebas de navegador de servicios remotos. La automatización emplea Playwright para Node, ya disponible en el proyecto: el runtime Python no tiene instalado Playwright. Los auxiliares de inspección se inyectan en respuestas HTTP de prueba; no se incorporan al simulador distribuido.

### Resultados ejecutados

| Área | Verificación | Resultado y evidencia |
|---|---|---|
| Lógica e integración | 89 tests: producción, estado visual, interiores, portales, orientación, navegación, precarga, entrada automática, productividad, caja, pausas e ingresos | **89/89 aprobados**, cero fallos, cancelados u omitidos. [Registro](../tests/output/auditoria-mundo3d-20261023-unit.log). |
| Mundo WebGL | Geometría real, peatones animados, cámara, movimiento, colisiones, entrada a tienda, selección de distrito, vehículo, reconstrucción y directorio móvil | **Aprobado** con `tests/playable_hub.cjs`; cero excepciones JavaScript y cero errores de carga de recursos locales en esa ejecución. [Resultados](../tests/output/hub/playable-hub-results.json). |
| HUD y orientación | Objetivos sin modificar inventario/caja, acceso a interiores y disposición de controles en escritorio, móvil vertical y horizontal | **Aprobado** con `tests/gameplay_hud.cjs`. [Registro](../tests/output/auditoria-mundo3d-20261023-hud.log). |
| Almacén | Pedido pagado de S/360, persistencia al recargar, entrega exacta de 12 unidades y ausencia de doble débito o doble entrega | **Aprobado** con `tests/world_business_ui.cjs`. [Registro de ejecución válida](../tests/output/auditoria-mundo3d-20261023-business-reintento.log). |
| Pausa y retorno | Mundo pausado, pantalla oculta y pestaña inactiva dejan de renderizar, vender y avanzar el reloj; reanudación posterior | **Aprobado** con WebGL real, sin excepciones de navegador. Mismo registro de almacén. |
| Ingresos actuales | Envío real de decisiones, plan de 100 unidades, movimiento POS y cierre Excel, doble intento de cierre y recarga | **Aprobado** con la nueva prueba `tests/mundo3d_ingresos_browser.cjs`. [Registro](../tests/output/auditoria-mundo3d-20261023-ingresos.log) y [datos completos](../tests/output/mundo3d-ingresos-20261023/resultados.json). |
| Persistencia SQL local | Autorización del docente, cierre completo, control de revisión, idempotencia, actualización de reporte/caja/snapshot y ajuste de capital de otro ciclo | **Aprobado** con `tests/business_closure_independent_db.cjs`, ejecutado en PGlite local. [Registro](../tests/output/auditoria-mundo3d-20261023-sql.log). |

### Caso de ingresos observado en el navegador

La prueba nueva envía decisiones completas y comprueba que el plan guardado permita producir **100 unidades**. Abre el mundo con WebGL y llama al movimiento POS real del simulador mediante un auxiliar de prueba, a **S/40 por unidad**; no se simula un clic de atención de cliente en esta prueba. El flujo de cobro y su persistencia atómica se verifican adicionalmente en `world_finance.test.cjs`.

| Momento | Ventas del ciclo | Caja |
|---|---:|---:|
| Tras la venta POS de una unidad | S/40,00 | S/151.210,80 |
| Tras el cierre: 100 unidades vendidas en total | **S/4.000,00** | **S/155.170,80** |
| Tras recargar | **S/4.000,00 conservados** | Movimiento y cierre conservados |

El cierre agrega la diferencia de **S/3.960,00**, incorpora la venta POS dentro del total y no vuelve a sumarla. Las existencias finales del producto quedan en cero. Se comparan todos los movimientos anteriores ajenos a ingresos y se confirma que no cambian. El segundo intento de cierre no vuelve a cobrar ni a producir.

Las pruebas del adaptador también reproducen las **12 asignaciones de las tablas del Excel (17)**, verifican la competencia entre cuatro empresas y la referencia absoluta del denominador económico para los segmentos medio y premium. La tabla de calidad de mercado conserva el proxy de reputación literal del libro. Las reglas de producción, costos y préstamos permanecen fuera del cambio de ingresos.

### Revisión visual

Se inspeccionaron las capturas de escritorio, vista aérea, venta y mundo móvil activo. La geometría y el avatar son visibles; el móvil de **390 × 844** no presenta desbordamiento horizontal. La captura móvil del arnés histórico tomada con el render congelado deja el fondo sin dibujar tras redimensionar; se añadió evidencia con el render activo para no confundir una limitación de captura con un fallo del juego.

- [Ciudad en tercera persona](../tests/output/hub/hub-thirdperson.png).
- [Vista aérea](../tests/output/hub/hub-aerial.png).
- [Mundo con venta registrada](../tests/output/mundo3d-ingresos-20261023/venta-3d.png).
- [Mundo móvil activo](../tests/output/mundo3d-ingresos-20261023/mundo-movil-activo.png).

### Incidencias de ejecución y límites

El primer intento del arnés de almacén agotó el tiempo de navegación. El servidor auxiliar mantenía sus logs en tuberías sin consumir; se repitió redirigiendo esos logs a un archivo local. El reintento completó todas sus comprobaciones sin modificar código del producto. Se conserva el [registro inicial](../tests/output/auditoria-mundo3d-20261023-business.log) para trazabilidad.

No se detectaron fallos funcionales en los recorridos ejecutados. Esto no certifica todos los escenarios posibles: no se probó una partida simultánea en varios dispositivos conectados a Supabase real, ni se midió rendimiento en GPU física o en un teléfono real. El reparto multempresa y el cierre remoto se cubrieron mediante tests de integración y PostgreSQL local; los recorridos WebGL se hicieron en sesiones locales aisladas.

No se necesita SQL nuevo para este cambio de ingresos. El cierre compartido utiliza la migración existente `supabase/migrations/20261023_cierre_negocio.sql`; debe estar aplicada para utilizar sus RPC. En esta revisión no se comprobó ni modificó el despliegue de Supabase. Los cierres ya guardados no se recalculan.


## Corrección: actividad continua de toda la ciudad — 23/10/2026

La revisión anterior comprobó recorridos y finanzas, pero no exigía que cada establecimiento funcionara antes de visitarlo. La petición posterior establece ese comportamiento como requisito. Se identificaron bloqueos por `currentInterior` en la creación y el movimiento de clientes y en la atención automática; en interiores, la proximidad construía las salas y entrar activaba sus empleados.

### Comportamiento aplicado

- Tienda, almacén, producción, oficina, banco y proveedores se construyen con sus empleados al preparar la ciudad. Se registran sus muebles, colisiones e interacciones antes de habilitar el movimiento.
- Empleados, peatones, clientes y transportista conservan sus recorridos aunque el personaje permanezca en la plaza u otro establecimiento. Visitar una sala no crea de nuevo sus NPC ni reinicia sus rutas.
- La animación de maquinaria responde al estado productivo existente, sin depender de la sala observada. Los modelos detallados pueden seguir cargándose en segundo plano; el actor ya existe con un modelo de respaldo.
- El cobro automático, la reposición y el apoyo de jefatura se ejecutan en toda la ciudad con sus requisitos existentes de personal/mejoras. No se añaden empleados contratados, stock o ingresos gratuitos. Pausa, pestaña oculta, permisos y cierre mantienen sus bloqueos operativos.
- Se conserva el presupuesto de luces por sala/calidad y el descarte de geometría fuera de cámara de Three.js. No se ocultan actores por entrar o salir de una zona.
- Se desplazó 0,8 m un punto de inspección del transportista, que coincidía con un operador ahora presente desde el inicio; su recorrido logístico vuelve a completarse sin alterar inventario.

### Evidencia de ejecución

La batería de regresión de lógica e integración aprobó **90/90 tests**, sin fallos ni omitidos: [registro](../tests/output/continuous-flow-unit.log). Incluye los contratos actualizados de interiores y las regresiones financieras y de ingresos del Excel.

La nueva prueba `tests/world_population_flow_browser.cjs` ejercita el bucle real `frame` con reloj determinista y WebGL local. Desde la plaza, antes de visitar salas, comprueba **16 NPC de personal y visitantes**: 4 en tienda, 2 en almacén, 3 en producción, 2 en oficina, 3 en banco y 2 en proveedores. Los actores se desplazan durante 12 segundos simulados y los clientes se crean y avanzan fuera de la tienda. Tras visitar las seis salas se conservan las mismas identidades de actores, sin duplicación.

Para verificar el servicio remoto se reserva una unidad real en un cliente existente y se coloca en la cola de caja. Con dos vendedores definidos por las decisiones, el cobro automático desde la plaza pasa de **S/47.670,80 a S/47.745,05**: venta de S/75 menos la comisión existente de 1%. El stock pasa de 100 a 99 al reservar y no se descuenta otra vez al cobrar. La pausa congela el snapshot completo y el fin de turno impide nuevos movimientos operativos, clientes o cambios de caja/stock. [Datos](../tests/output/world-population-flow/results.json), [captura](../tests/output/world-population-flow/world-active.png).

Las suites WebGL de navegación (`playable_hub`), almacén/pausa (`world_business_ui`) y HUD (`gameplay_hud`) también se ejecutaron. La prueba de navegación se repitió tras un intento de entrada fallido; el reintento completó sus controles y no registró excepciones ni recursos locales fallidos. Se añadió diagnóstico de carga al test para conservar la causa si reaparece. [Registro del reintento](../tests/output/continuous-flow-hub-retry.log).

El arnés histórico `continuous_world` avanzaba al jugador pero dejaba clientes y peatones congelados: con la nueva población, un cliente detenido artificialmente en la puerta impedía pasar. Se actualizó el avance de prueba para mover también los participantes de la ciudad, manteniendo las colisiones físicas. El nuevo test de población comprueba por separado el flujo continuo, los cobros, pausa y fin de turno. El reintento final de `continuous_world.cjs` aprobó sus **10/10 escenarios**, incluido el cambio de ciclo sin duplicar escena, NPC, listeners ni bucles RAF: [resultado completo](../tests/output/continuous/functional-results.json). Se aislaron únicamente los pasos de caja manual, se tolera el desplazamiento lateral dentro del ancho físico de la puerta y se espera el asentamiento de la UI antes de medir RAF. También volvió a pasar el caso de ingresos WebGL de 100 unidades a S/40 y el cierre SQL local.

No se requiere SQL nuevo. No se modifican fórmulas de ingresos del Excel, precios, costos ni préstamos. La validación se realiza localmente con SwiftShader; no constituye una medición de FPS en GPU física ni una prueba multijugador en Supabase real.
