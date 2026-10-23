# DOP por cantidad deseada — 22/10/2026

## Estado actualizado — auditoría del 23/10/2026

La revisión posterior solicitada en «haz la auditoria» corrigió CONS-06 por producción efectiva, el proxy y denominador del mercado y los errores de precisión de inventario. Se contrastaron 12 copias del original recalculadas con Excel, sin hojas añadidas: 4.220 comprobaciones válidas sin diferencias; los errores de la fuente se registran aparte. Los oráculos históricos se regeneraron desde fórmulas y SIM-1/2/3 pasan. El informe vigente es [auditoria_integral_2026-10-23.md](auditoria_integral_2026-10-23.md), con criterios aplicados a las contradicciones y reglas ausentes. La petición posterior «haz push» autoriza publicar estos cambios y los commits anteriores. Los apartados siguientes conservan el historial y el estado de la revisión del día 22; su decisión de no hacer push ya fue superada por esa petición. No requiere SQL ni actualización de Supabase.

## Revisión adicional sobre la versión ya publicada

Esta ejecución parte de `159e5fc`, con el árbol limpio y remoto verificado `https://github.com/valenlysm29/SIDE1.git`. Las secciones posteriores conservan la implementación y validación previas; este apartado las complementa y precisa su alcance. Se trabajó con cinco subagentes de alcances separados (Excel, Código, Auditoría, UI y Pruebas), en tandas por el límite de concurrencia, y se integraron sobre el mismo repositorio.

La ruta principal ya calculaba necesidades desde la meta. Persistía un defecto en el editor Excel: `js/engine/ui_excel.js:dopPlan` entregaba el contrato antiguo y el renderer recurría a una representación incompleta de faltantes, sobrantes y costos. Además, la equivalencia de compra imponía `Math.ceil(faltante/conversión)`, que no aparece en el Excel. Se reemplaza por requisitos explícitos desde cantidad × coeficiente y comparación posterior por la calidad elegida. Un sobrante de cuero premium no elimina un faltante de cuero sintético. Se muestra la división del faltante por la presentación sin imponer redondeo de paquetes.

Fuentes: necesidades `CANTIDAD DE PRODUCCIÓN!D37:D39`, coeficientes `D31:L33`, resultados `D42:L44`; precios `Costos De Producción!V76:W83` y conversiones `D32:K33`. La dotación inversa y el costo total no determinado se conservan como **no definidos**, nunca como cero ni como una optimización inventada. La edición de la cantidad no realiza compras ni cargos de caja.

La UI conserva las pestañas y el estilo existente. Se revisan actualización en vivo, guardado, acceso por teclado y avisos de cambios para lectores de pantalla. No se modifican el menú congelado, los avatares ni el mundo 3D. **No hay actualización ni SQL pendiente para Supabase.**

Informes por área: [Excel](dop_excel_por_cantidad_20261022.md), [Código](dop_codigo_20261022.md), [Auditoría](dop_auditoria_20261022.md), [UI](dop_ui_20261022.md) y [Pruebas](dop_pruebas_20261022.md). La auditoría nueva aporta 412 comparaciones con celdas originales, sin diferencias en los adaptadores literales. Incluye cada discrepancia operativa restante con archivo, línea, valor o regla del Excel y comportamiento de SIDE.

**Límite de aceptación:** cero diferencias en los casos comprobados no significa paridad integral de todas las reglas del juego con el libro original. Los oráculos históricos agregan fórmulas financieras y de consecuencias que no están en sus diez hojas originales. Siguen identificadas las diferencias de calidad para mercado, el disparador planeado/producido de CONS-06, la precedencia de CONS-03 y las tarifas históricas sin fórmula fuente. Tampoco existe una inversa única de cantidad a personal, máquinas y tiempo. No se cambian silenciosamente estos criterios ni se modifican los esperados numéricos para declarar una igualdad inexistente. Por estas razones, la auditoría integral solicitada **no puede darse por cerrada** con el Excel actual.

La caché original contiene cuatro cadenas `#DIV/0!` en `CANTIDAD DE PRODUCCIÓN!E75/G75/E123/G123`, almacenadas con tipo texto. La afirmación anterior de ausencia de errores en caché se refería solo al tipo de celda de error y era insuficiente. Tras recalcular, Excel también produce los errores ya documentados de `Lotes_Produccion`. El archivo original no se modifica.

Revalidación independiente de esta ejecución: 14 casos DOP recalculados con Microsoft Excel COM 16.0; ocho escenarios históricos, 3.104 salidas, cero diferencias. Fuente preservada por SHA-256 antes y después. SIM-1 (468 salidas, un ciclo y cuatro empresas), SIM-2 (585 salidas, tres ciclos y dos empresas) y SIM-3 (1.140 salidas, tres ciclos y cinco empresas) pasan con cero diferencias en cada ciclo contra sus oráculos históricos. Línea de base Node: 514/514; batería final ampliada, después de integrar código y UI: **533/533**, cero fallos, cancelados u omitidos, 104,5 segundos. Las 19 pruebas nuevas del editor incluyen los 14 casos del fixture independiente real y conservación de caja al editar la meta. No quedan fallos NPC en esta batería. `decision_options_db.cjs` pasa en PostgreSQL local y el runner de tarjetas de decisiones pasa en móvil y escritorio.

La revisión UI reproduce y corrige pérdida de foco al salir del campo de cantidad y al usar repetidamente los botones ±10. Se asocia la ayuda al campo y se anuncian total/requisitos en vivo. La última corrida del navegador independiente amplía la regresión de teclado dentro del runner versionado y pasa **767 comprobaciones**, sin errores JS, en 1150×666, 1440×900 y 390×844. Verifica metas, requisitos, caja, inventario físico, faltantes, costos, guardado y reingreso; los ciclos automáticos 2 y 3 también coinciden con el ledger. La corrida auxiliar de accesibilidad de 25 comprobaciones también pasó.

Se corrigieron contratos de prueba antiguos que todavía esperaban compra redondeada o tres campos simultáneos de molde, y se inicializó correctamente el modo Excel en el arnés de tarjetas. No se modificaron esperados matemáticos para ocultar diferencias. Los fallos de contrato se describen en Pruebas; no se atribuyen a NPC.

El runner final de navegación pasa en seis resoluciones, con cinco pestañas, guardado, teclado y desplazamiento hasta el final del panel real. Detectó y se corrigió un defecto preexistente de legibilidad de las insignias (10 px): ahora tienen al menos 11 px y 24 px de alto. Los 16 contratos UI/responsive dirigidos posteriores a ese último cambio CSS también pasan. Logs finales: `tests/output/dop-20261022/browser/decisions_cycle_ui-final.log` y `tests/output/dop-20261022/css-targeted-final.log`.

Commits de esta revisión: Código `aa31844`; Excel `13b5a7b` y `df632e7`; Auditoría `3154882` y `7f05011`; UI `3a70289` y `183445f`; Pruebas `35ec184`; más el cierre de integración de este informe. El árbol queda limpio después de restaurar exclusivamente capturas y bytecode generados por las pruebas. Se verificó que el contenedor del proyecto sigue teniendo únicamente SIDE1 y no se crearon archivos de trabajo fuera de él.

**No se realiza un nuevo push en esta ejecución.** La instrucción condiciona el push a que todo pase: las pruebas implementadas pasan, pero la auditoría integral requerida conserva discrepancias sin corregir y la recomendación inversa no está definida por la fuente. Para cerrar ese alcance se necesita resolver en el modelo fuente los criterios señalados en Auditoría: dotación/tiempos desde una meta, hoja de capacidad prevalente, calidad del mercado, precedencia/disparador de consecuencias y tarifas sin fórmula. No se equipara aprobación de pruebas con aceptación de esas reglas. Los commits locales y los informes dejan el resultado concreto disponible para revisión; no hay SQL pendiente.

## Alcance y punto de partida de la implementación previa

Base: `7cb8e98`. Repositorio inicialmente limpio. Se conserva el menú de decisiones y no se modifican avatares ni mundo 3D. No se ejecuta SQL en producción.

Fuente de verdad: copia íntegra del archivo proporcionado, `.codex-work/DECISIONES_SIDE_16.xlsx`, SHA-256 `3b6b42bbbc56a2534ce7e241c607d572dd38dcf02311683609497df36a0c1eb1`. Se leen fórmulas y valores en dos pasadas y el original no se sobrescribe. Los recálculos se realizarán sobre copias dentro de SIDE1.

## Antes

El objetivo ya multiplicaba coeficientes por molde para ciertos insumos, pero los nodos principales del DOP usaban `producibleUnits`, limitado por existencias y capacidad. Las materias primas del diagrama mostraban disponibilidad en lugar de necesidad; la antigua recomendación repartía la capacidad instalada entre moldes. Así, una meta positiva con almacén vacío podía mostrar un proceso de cero unidades.

## Contrato solicitado

1. La cantidad deseada y el molde definen los requisitos, sin leer existencias.
2. El DOP muestra primero esos requisitos de la meta.
3. Después se comparan necesidades y recursos disponibles, con faltantes, sobrantes y costos que el Excel permita determinar.
4. La producción ejecutable del motor puede seguir limitada por recursos; no se confunde con la meta ni se utiliza para construir sus necesidades.
5. Una comparación o estimación no compra recursos ni descuenta caja automáticamente.

## Criterios de Excel detectados

Las hojas de cantidad y costos tienen reglas de capacidad distintas. Cada resultado conservará su hoja y celda de procedencia; no se forzará una igualdad inexistente entre ellas. El libro no define una dotación inversa única de trabajadores y máquinas para cualquier meta, ni un redondeo de contratación mínimo. Esas ausencias se indicarán explícitamente y no se reemplazarán por fórmulas inventadas.

## Fórmulas y casos

La trazabilidad completa está en `reports/dop_excel_fuentes_2026-10-22.md` y los 14 casos en `reports/dop_excel_casos_2026-10-22.json`.

| Molde | Cantidad | Cuero m² | Accesorios | Hilo m | Celdas calculadas |
|---|---|---|---|---|---|
| Básico | D37 | D37 × D31 (0,3) | D37 × G31 (1) | D37 × J31 (6) | D42 / G42 / J42 |
| Mejorado | D38 | D38 × E32 (0,4) | D38 × H32 (1) | D38 × K32 (7) | E43 / H43 / K43 |
| Premium | D39 | D39 × F33 (0,7) | D39 × I33 (1) | D39 × L33 (13) | F44 / I44 / L44 |

Total deseado: D36 = SUM(D37:D39). Se prueban cero, una unidad, mezclas, capacidad del ejemplo, exceso de capacidad y cantidades grandes; el libro no define un máximo global. No se añade redondeo de paquetes ni una contratación mínima. La normalización a unidades enteras del control de producción ya existía; la precisión de 15 cifras coincide con la utilizada por el motor para evitar pérdida de unidades por aritmética binaria.

Los costos teóricos de material usan `Costos De Producción!V76:W83`: requerimiento físico × precio por unidad × (1 − 8%). Cada faltante ofrece esos escenarios por calidad. No se selecciona una calidad por el stock comprado y no se inventa un costo total cuando faltan decisiones de dotación. Las presentaciones de compra se convierten mediante D32:K33 para cobrar compras reales. El analista conserva el descuento parametrizado del juego.

## Cambios integrados

- `js/production_model.js`: contrato puro `requirementsFor()`, necesidades independientes de stock y comparación posterior. La producción posible sigue siendo una comparación operativa, no una recomendación de meta. La disponibilidad suma únicamente `__inventarioMP` físico explícito y compras elegidas del ciclo; las presenta separadas, sin reconvertir stock ni cobrarlo otra vez.
- `js/production_dop.js`, `js/app.js`, `css/production.css`: cantidad como primer control, selector de molde, actualización en vivo, necesidades y costos antes de existencias; faltantes/sobrantes al final. Se conservan las pestañas y el menú.
- `js/engine/costos.js`, `js/decision_review_model.js`: precios de compra, nómina MYPE y adquisición con instalación/capacitación reutilizados entre pantalla y cargo real. HUD conserva centavos; editar una meta no compra recursos ni mueve el ledger.
- Se preservan el aviso de costos iniciales, su confirmación por ciclo y el guardado del estudiante. El costo inicial con local y limpieza es ahora S/ 2712,32 según la fórmula MYPE, no S/ 2600 de los sueldos base.
- `index.html`: claves de caché actualizadas a `20261022-dop-cantidad` para los recursos modificados.

## Auditoría completa y límites encontrados

Ver `reports/auditoria_motor_dop_2026-10-22.md`: diez hojas, 871 celdas de fórmula, costos, unidades, consumo, capacidad, tiempos, consecuencias, ventas y caja. Se corrigieron nómina, conversión de presentaciones de compra, descuento general y costos de instalación/capacitación del editor histórico. Las discrepancias se documentan con función, celdas, valor anterior y valor corregido.

El Excel tiene contradicciones: sus hojas de cantidad y costos usan productividad/días y dotaciones distintas (capacidad de ejemplo 396 frente a 382); precios por unidad productiva frente a algunos ejemplos incrustados incompatibles; sueldos de corte distintos entre catálogo y costos. Para nómina se usa la fórmula completa de Costos, sin reemplazarla por normativa externa. Los ejemplos no se reescriben para obtener una falsa igualdad.

Al recalcular una copia intacta del original aparecen siete errores: cuatro `#DIV/0!` en CANTIDAD E75/G75/E123/G123 y tres `#NAME?` en Lotes J2:J4. Los cuatro primeros ya están en la caché original como cadenas de texto, aunque no estén tipados como error. Las variantes cero además dividen por cero en E37:E39; el juego protege la meta cero, sin atribuir esa protección al Excel. La compatibilidad `_xlfn.IFS` del oráculo histórico se aplica solo a sus copias.

No se afirma paridad de todas las reglas de la UI histórica con el libro: emparejamiento de trabajadores/máquinas, tope histórico de eficiencia, contabilidad simplificada, mantenimiento mensual, depreciación, liquidación, indemnización y crédito tienen diferencias o extensiones explícitas en el informe de auditoría. Las reglas no definidas por el Excel no se sustituyen por valores inventados.

## Pendientes de criterio del modelo

1. Elegir qué hoja manda para capacidad y definir una asignación inversa/criterio de optimización para recomendar dotación, maquinaria y horas desde una meta. El libro recibe esas entradas; no permite deducir una única combinación.
2. Resolver las contradicciones de unidades y ejemplos de materia prima y confirmar los sueldos base de corte. Se aplicó la tabla de unidades y el cálculo completo de Costos de manera explícita.
3. Definir la integración del mantenimiento mensual/depreciación con el flujo histórico y qué activos devengan cargos durante el ciclo, sin duplicar su control preventivo. Los préstamos tampoco tienen cuotas definidas en el libro.
4. Los valores históricos pendientes de consecuencias y costos de tiendas siguen identificados como configuración del juego, no como fórmulas de Excel.

Estas limitaciones no alteran los requerimientos físicos por cantidad, que sí tienen fórmula directa y se verifican contra el libro real.

## Bloqueo preexistente encontrado en SIM

El editor de lotes rechazaba confirmar metas superiores a capacidad o materiales (`ui_excel.js`, guardia de confirmación). Esto impedía SIM-1 con meta 520 y capacidad 396 y contradice la separación entre cantidad deseada y producción ejecutable del libro. Se sustituyó ese rechazo por una advertencia, conservando la meta; el motor sigue limitando ejecución/consumo y aplicando consecuencias. Caja insuficiente, pausa, desconexión y campos inválidos siguen bloqueando.

El arnés SIM también se corrigió para ingresar en modo Excel antes del registro, sin descontar costos del flujo histórico y trasladarlos después a la caja del escenario. No se alteraron los importes esperados.

La prueba nueva `tests/dop_confirmation_capacity.test.cjs` ejecutada contra el archivo del commit base `7cb8e98` falla en los dos casos de capacidad/materiales y pasa la guardia de caja/acceso (1/3). Sobre el código corregido pasa 3/3. Evidencia local: `tests/output/dop-20261022/confirmation_base.log`; no se usó la preexistencia para omitir la corrección.

## Supabase

**No hay SQL pendiente ni se debe actualizar Supabase para este cambio.** Se conservan el esquema y el contrato de snapshot; la cantidad usa el campo existente `PRODUCCION_META.moldTargets`. No se ejecutó SQL en producción.

## Verificación y publicación de la ejecución previa

- Fuente original preservada y hash verificado antes/después del recálculo.
- 14 casos nuevos: recalculados con Microsoft Excel 16.0 en copias; 126 requerimientos físicos sin diferencias.
- Ocho escenarios históricos / 3104 salidas: recálculo independiente completado, cero diferencias frente al motor y los resultados históricos.
- Pruebas dirigidas de modelo/DOP/UI: 20/20; costos/revisión: 27/27; aviso/caja: 8/8.
- Verificación independiente Node: 23/23; repetición con fixture versionado y sin depender de resultados ignorados: 23/23.
- Navegador previo a la ampliación de stock persistido: 635 comprobaciones, cero errores JS, 1150×666 / 1440×900 / 390×844, tres ciclos automáticos por tamaño. Se detectó y corrigió recorte de un párrafo móvil; revalidación visual y acceso a la última columna correctos. Nueva corrida con inventario explícito en curso.
- Primera batería completa Node: 507/508; único fallo: contrato estático que aún exigía textos del DOP anterior. Se actualizó a las etiquetas de meta/comparación; sus 7 pruebas dirigidas pasan. No se atribuyó este fallo a NPC ni a una regresión de cálculo.
- SIM-1 UI: 1 ciclo × 4 empresas, 468 salidas, cero diferencias; resultados y caja docente/estudiante coinciden, móvil sin desborde.
- SIM-2 UI: 3 ciclos × 2 empresas, 585 salidas, cero diferencias; faltantes y sobrecapacidad conservan metas y limitan ejecución.
- SIM-3 UI: 3 ciclos × 5 empresas, 1140 salidas, cero diferencias; guardado, cierre docente, caja e informes del estudiante y móvil correctos.
- Navegador final con inventario físico persistido: 743 comprobaciones, cero errores JavaScript, nueve ciclos automáticos; cantidades, requisitos, faltantes, costos por calidad, guardado, snapshot, reingreso y caja correctos. Revisión visual de capturas realizada en escritorio y móvil.
- Runner de aviso/calculadora anterior: 153 comprobaciones, cero errores, tres ciclos y persistencia de confirmación.
- `decision_options_db.cjs`: contrato de múltiples opciones, importes, reintentos, permisos privados y revisiones correcto en PostgreSQL local; no producción.
- Batería Node final secuencial sobre el código integrado: **514/514**, cero fallos y cero omitidos (126,8 s). No quedó ningún fallo NPC en esta batería; no se modificó lógica 3D ni se presenta la batería como una revisión visual nueva del mundo.
- Todos los cambios de producto y pruebas están en commits por área. No hay SQL pendiente.
- Push normal completado a `origin/main`: `a27d0471f6ad9c83275c07deff6131f8f7fdcec3` (base `7cb8e98`).
- GitHub Pages verificado: respuesta 200 y coincidencia del contenido publicado con el código local para nueve recursos: estudiante/docente, modelo, DOP, revisión, costos, editor, aplicación y CSS. Ambos HTML cargan las claves `20261022-dop-cantidad`. Evidencia local `tests/output/dop-20261022/published.json`; despliegue `https://github.com/valenlysm29/SIDE1/actions/runs/39902258238`.
- Hecho: código, pruebas, informe, commits, push y publicación. Este cierre documental se guarda en un commit posterior sin modificar los recursos ya verificados.
- Pendiente exclusivamente de criterio: resolver las diferencias/ausencias del libro enumeradas arriba para completar una recomendación inversa única y alinear todas las reglas históricas. No hay prueba fallida ni SQL pendiente ocultos.
