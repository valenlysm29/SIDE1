# P0.6 — Auditoría de balances históricos

**Estado inicial (superado): BLOQUEADA POR ACCESO DE LECTURA.** La actualización al final contiene los resultados posteriores a la conexión. Fecha de la revisión inicial: 31 de octubre de 2026. Rama `codex/p02-diagnostico-materiales`, código local `df3e42a91fdcdbead50772d2d11ba08dc67b94da`. Este informe conserva la evidencia previa y limita sus conclusiones: no se consultaron los registros originales durante P0.6, ni se ejecutaron cambios remotos.

## Resumen ejecutivo

La auditoría de sincronización anterior informó 134 cierres y 75 resultados con estados financieros; 12/75 tenían `abs(activos − pasivoPatrimonio) > S/ 0,02`, con máximo S/ 13.985,84, en cierres fechados los días UTC 24, 27 y 28 de octubre de 2026, anteriores a la versión remota entonces observada. Es un **resultado histórico comunicado por ese informe**, no una medición independiente repetida aquí. Esa evidencia agregada no identifica los 12 ni permite comprobar si el conjunto actual sería el mismo.

| Indicador | Resultado de P0.6 |
|---|---|
| Resultados del conjunto histórico localizados individualmente | 0 de 75; solo se dispone del agregado documentado |
| Balances descuadrados identificados y comprobados individualmente | 0 de 12 |
| Causas demostradas individualmente | 0 |
| Causas por determinar | 12, según el conteo histórico informado |
| Existencia de defecto en cierres nuevos | No determinada: las pruebas locales cubren escenarios limitados y no se inspeccionaron cierres remotos nuevos |

No se generó una tabla de doce filas con alias ficticios: sin registros originales no puede comprobarse que cada fila represente un balance distinto. Para cada uno quedan pendientes partida y empresa seudonimizadas, fecha, ciclo, versión, activo, pasivo, patrimonio, diferencia firmada y disponibilidad de recibo y snapshot. El valor máximo agregado anterior no puede asignarse a ninguno de ellos.

## Acceso y evidencias disponibles

- No hay conector Supabase/PostgreSQL conectado en las herramientas disponibles para esta sesión. La búsqueda de integraciones encontró Supabase disponible, pero **no instalado ni conectado**.
- Existe la CLI del proyecto, versión 2.122.0. La consulta de listado de proyectos terminó con código 1 e indicó falta de autenticación o autorización; no confirmó acceso al proyecto de la auditoría. No se imprimieron salidas sensibles. Existe `supabase/.temp`, pero no contiene una referencia de proyecto enlazada; no hay variables de entorno de Supabase/PostgreSQL identificadas, archivo `.env` del proyecto ni `pgpass.conf`, y no se encontró `psql` en el PATH. `~/.supabase` contiene solo telemetría, no una sesión de CLI observable. Estos hechos no prueban que el usuario carezca de acceso por otros medios.
- `tests/output/auditoria_remota_6_ciclos.json` contiene seis filas y seis conjuntos de recibo/estados, no el inventario de 75 resultados ni las doce excepciones. Su nombre no demuestra por sí mismo procedencia ni identidad del conjunto anterior; no se atribuyen esos datos a los balances investigados.
- P05 reporta 53 pruebas locales aprobadas de conciliación focal. El informe financiero describe una partida de seis ciclos en PGlite con dos empresas, pero es evidencia de ensayo local y no permite concluir qué ocurrió en los doce balances remotos.
- Fuente del agregado: `reports/auditoria_sincronizacion_github_supabase_SIDE.md`, sección «Comprobaciones financieras remotas de lectura». Fuentes metodológicas: `reports/P02_DIAGNOSTICO_MATERIALES.md`, `reports/P03_AUDITORIA_REGRESIONES_SIDE.md`, `reports/P04_CAPACIDAD_E_INVENTARIOS.md`, `reports/P05_CONTRATO_CAPACIDAD_EFICIENCIA.md`, `reports/P05_MATRIZ_CONCILIACION_ECONOMICA.md` y `reports/diagnostico_financiero_20261030.md`.

## Conciliación y continuidad

No se dispone de las aperturas, movimientos y snapshots correspondientes a los doce registros. Caja, compras y recepciones, materia prima, productos terminados, ventas, costo de ventas, CxC, préstamos, intereses, impuestos, depreciación, utilidad y patrimonio **no son verificables individualmente** en esta fase. Tampoco puede comprobarse el arrastre entre ciclos. La observación anterior de que 75/75 cumplían las identidades agregadas de caja y utilidad dentro de S/ 0,02 no explica los doce descuadres patrimoniales ni prueba el origen de sus cifras.

Hipótesis a investigar, no conclusiones: apertura o snapshot incompleto, inventario inicial sin valoración por SKU, depreciación o deuda mal arrastradas, clasificaciones o reglas de versión distintas, error del motor de cierre o de presentación. No existe evidencia aquí para atribuir una causa o prescribir una corrección de código. Un balance cuadrado tampoco demuestra paridad con Excel.

## Manual, Aleatorio y Equilibrado

Los tres modos pueden usar el cálculo y cierre financiero compartidos, por lo que un defecto confirmado en ese motor **podría** afectarlos; esto no demuestra que los doce casos pertenezcan a los tres modos ni que exista un defecto vigente común. No se dispone del modo de los doce registros ni de sus versiones. Los escenarios y pruebas locales no sustituyen su análisis; tampoco demuestran ausencia de errores exclusivos de programación de eventos o de un modo. La continuidad y el impacto hasta seis ciclos permanecen sin verificar para esos cierres.

## Plan de lectura reproducible al recuperar acceso

1. Conectar el proyecto correcto mediante una integración autorizada o habilitar una conexión PostgreSQL con un rol de **solo lectura** limitado a los cierres, snapshots y movimientos relevantes. No pegar contraseñas en informes, archivos versionados ni mensajes. Verificar identidad del proyecto, rol y privilegios antes de consultar; no ejecutar migraciones, funciones de escritura ni recálculos.
2. Recuperar el criterio y la fecha de corte exactos de la auditoría anterior, junto con una copia verificable del resultado original si existe. Una base viva puede haber cambiado: comparar 134 cierres y 75 resultados y sus fechas/versiones no identifica por sí solo el mismo conjunto. Si no existe lista o huella de los 75, documentar que la coincidencia exacta no puede demostrarse y presentar la nueva medición por separado.
3. Mediante una transacción de lectura y una instantánea consistente, contar cierres y expandir por empresa `side_business_closures.cierre.resultadosPorEmpresa`, verificando el esquema real y presencia/tipo de los campos. Distinguir ausencia de valores de cero. Calcular con decimales `activos − (pasivoPatrimonio)` y también sumar pasivos y patrimonio desde sus componentes, para distinguir un agregado incorrecto. Señalar campos faltantes o no numéricos sin descartarlos silenciosamente.
4. Crear alias estables internos por partida/empresa/ciclo, sin nombres ni identificadores originales en el informe. Para cada resultado excepcional comparar recibo, snapshot, versión, apertura, libro de movimientos, inventarios, costos, venta, crédito, deuda, impuestos y patrimonio. Comprobar las identidades de caja y resultados y el paso del cierre previo a la apertura siguiente, cuando exista evidencia. Registrar el origen de cada cifra y las ausencias.
5. Conservar un registro local restringido y reproducible de consultas, fecha de lectura, versión, criterios, alias y resultados anonimizados dentro de `SIDE1`; no conservar credenciales ni datos personales en el informe. Informar si no se puede garantizar una instantánea histórica equivalente. No modificar datos, versiones, Edge, migraciones ni reglas.
6. Solo después de aislar una causa, contrastarla con el código versionado de ese cierre y con pruebas locales del motor actual y los tres modos. Proponer una corrección con evidencia y revisión independiente, sin alterar snapshots anteriores.

**Próxima acción concreta:** instalar y conectar la integración de Supabase autorizada al proyecto SIDE, o configurar fuera de la conversación una conexión PostgreSQL de solo lectura con acceso a cierres y snapshots; después verificar el conjunto original y ejecutar el plan anterior. Sin esa conexión o una copia íntegra autorizada de los registros no es posible determinar las causas exactas.

## Actualización P0.6 — acceso Supabase de solo lectura

La integración autorizada permitió consultar el proyecto SIDE, sin escribir datos. La lectura actual encontró 147 cierres, 93 resultados con balance y 12 descuadres mayores de S/ 0,02. Antes de `2026-10-30 21:41:57 UTC` hay 75 resultados; los 12 descuadres están en el mismo intervalo de fechas y el máximo coincide con la auditoría previa (S/ 13.985,84). Estas coincidencias apoyan que es la misma cohorte, pero **no demuestran identidad exacta de las 75 filas**: no se conservó su lista o huella original. Los 18 resultados posteriores a ese instante no presentan descuadres superiores a S/ 0,02; ello no certifica todos los futuros cierres.

Se examinaron los doce balances y sus recibos, estados y libros presentes en el JSON oficial. Los alias siguientes son seudónimos derivados de partida y empresa; un mismo alias representa la misma empresa en distintos ciclos. Delta = activo − pasivo y patrimonio; pasivos se obtiene restando patrimonio del agregado.

| Alias | Ciclo | Fecha UTC | Activos S/ | Pasivos S/ | Patrimonio S/ | Delta S/ | Evidencia y estado |
|---|---:|---|---:|---:|---:|---:|---|
| 204fba8514 | 2 | 24/10 | 157674,51 | 0 | 157962,00 | −287,49 | Igual al inventario MP anterior; mecanismo pendiente |
| 204fba8514 | 3 | 24/10 | 140255,51 | 0 | 140543,00 | −287,49 | Arrastra el mismo delta de ciclo 2 |
| 59ebb54bd7 | 2 | 27/10 | 34696,33 | 25583,12 | 9386,08 | −272,87 | No coincide con MP anterior de 28,34; causa pendiente |
| 8b30e76381 | 3 | 27/10 | 117790,19 | 100,00 | 129660,02 | −11969,83 | Igual al inventario MP anterior; mecanismo pendiente |
| 8b30e76381 | 4 | 27/10 | 99675,12 | 100,00 | 111544,95 | −11969,83 | Arrastra el mismo delta de ciclo 3 |
| dfed563c7d | 3 | 28/10 | 263533,72 | 25,00 | 264035,74 | −527,02 | Igual al inventario MP anterior; mecanismo pendiente |
| d21004c783 | 3 | 28/10 | 219796,44 | 150,00 | 232476,41 | −12829,97 | Igual al inventario MP anterior; mecanismo pendiente |
| 32abe4463d | 3 | 28/10 | 237758,60 | 50,00 | 238646,12 | −937,52 | Igual al inventario MP anterior; mecanismo pendiente |
| 413d4b4028 | 3 | 28/10 | 261623,03 | 50,00 | 262626,48 | −1053,45 | MP anterior 1053,46; diferencia de S/ 0,01 |
| 3725385d42 | 3 | 28/10 | 138260,48 | 500,00 | 138289,76 | −529,28 | Igual al inventario MP anterior; mecanismo pendiente |
| 41099d2e6c | 3 | 28/10 | 260533,72 | 25,00 | 261035,74 | −527,02 | Igual al inventario MP anterior; mecanismo pendiente |
| b77f1733e8 | 2 | 28/10 | 74381,06 | 1300,00 | 87066,90 | −13985,84 | Igual al inventario MP anterior; mecanismo pendiente |

**Hallazgo verificado:** nueve descuadres iniciales coinciden con el saldo de materia prima anterior, dentro de S/ 0,01; dos cierres posteriores conservan exactamente el mismo descuadre; uno no sigue ese patrón. En los doce casos existe un snapshot financiero del ciclo anterior y el inventario físico de apertura coincide con el cierre físico anterior; también coincide la caja inicial con la caja final anterior. Esto muestra continuidad de cantidades y caja en los campos comparados, pero no demuestra por sí solo qué operación perdió o duplicó el valor, ni excluye otras causas. Los nueve casos presentan una asociación fuerte con el arrastre de valoración, todavía no una causa de código demostrada. El caso restante incluye deuda y debe investigarse por separado. No se comprobó la continuidad integral de todos los movimientos, intereses, costos, impuestos y versiones.

Los recibos identifican `excel-v19` para el caso con deuda, `md-20261027` para nueve filas, y versión ausente para dos filas; ninguna de las doce filas muestra la etiqueta de capacidad. No consta información suficiente para atribuirlos a Manual, Aleatorio o Equilibrado. Un defecto del cierre compartido podría afectar a los tres, sin demostrarse que esté vigente.

**Estado de causas:** dos arrastres del delta están demostrados aritméticamente; el origen de los doce descuadres y la función o versión responsable permanecen sin determinar. Próxima tarea: reproducir localmente una transición con el snapshot y libro anonimizados de uno de los nueve casos, contrastar valoración inicial, compras y consumo por SKU, y aislar por separado el caso con deuda. Completar la conciliación antes de proponer cualquier modificación; no reescribir cierres.

Método de consulta reproducible: lectura de `public.side_business_closures`, expansión de `cierre.resultadosPorEmpresa` con `jsonb_each`, extracción de `financial.balanceGeneral.activos`, `pasivoPatrimonio`, `patrimonio`, recibo, inventario y snapshot previo; comparación por partida/empresa y ciclo anterior. Se excluyeron las cifras faltantes o no numéricas del cálculo de delta y se usó `numeric`. La lectura anterior indica 93/93 balances presentes; no se guardaron identificadores originales en este informe. No se ejecutaron migraciones ni comandos de modificación.

