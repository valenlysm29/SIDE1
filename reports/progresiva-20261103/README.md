# Validación progresiva de SIDE — 3 de noviembre de 2026

Se verificaron 90 escenarios aislados y 109 resultados oficiales: 108 de dos partidas nuevas, `SIDE-GR2X` (3 ciclos) y `SIDE-6DJZ` (6 ciclos), con 12 empresas independientes en cada una; y una repetición adicional de 2.250 unidades en `SIDE-8ZRJ`. El motor económico se mantuvo en `utility-v1`; no se cambiaron precios, demanda, costos ni utilidades para aprobar estas pruebas.

La matriz completa está en [matriz-local.md](matriz-local.md) y [matriz-oficial.md](matriz-oficial.md). Los JSON del mismo nombre incluyen cada etapa, trabajadores y máquinas, compras, consumo y saldo por insumo, detalle por producto, costo de ventas, depreciación, mantenimiento, impuestos, deuda, caja y balance. `resumen.json` contiene los conteos y las incidencias; `interfaces.json`, la evidencia por empresa y ciclo.

## Alcance y condiciones

- Metas individuales: 100, 200, 300, 500, 750 y 1.000 unidades de cada molde.
- Combinados aislados: cantidades iguales de los tres moldes y proporción 1 : 1/2 : 1/4. Cada configuración se ejecutó con estrategia eficiente, intermedia e ineficiente: 90 casos.
- Partida de 3 ciclos: metas 100, 500 y 1.000 por molde individual; combinados asimétricos. Partida de 6 ciclos: todas las metas progresivas y combinados iguales (hasta 3.000 unidades por empresa).
- Capital por empresa: S/ 1.000.000, seleccionado para probar escala y continuidad con recursos suficientes. Esto no demuestra viabilidad con el capital mínimo de una partida docente. Las estrategias eficientes e intermedias terminaron con caja positiva; las ineficientes pueden agotar incluso este capital.
- Personal y máquinas básicos aumentan juntos, con relación 1:1 y capacidad de todas las etapas suficiente. La estrategia intermedia agrega capacidad, jefe, local, publicidad y un préstamo inicial de S/ 10.000; la ineficiente mantiene cuatro veces la capacidad base, publicidad y locales excesivos. Se compra sólo capacidad incremental y se aprovechan insumos remanentes.
- El término «eficiente» describe la estrategia definida en el fixture, no una optimización matemática global. Los moldes prémium usan materiales de calidad; su precio efectivo incorpora la bonificación calculada por el motor.

## Rentabilidad y demanda

Las 18 estrategias eficientes individuales aisladas produjeron la meta completa y tuvieron utilidad positiva. Sus utilidades netas fueron:

| Meta | Básico | Estándar | Prémium |
| ---: | ---: | ---: | ---: |
| 100 | 1.282,65 | 3.814,90 | 15.619,32 |
| 200 | 5.778,88 | 10.847,13 | 35.361,55 |
| 300 | 10.275,10 | 18.119,35 | 54.655,77 |
| 500 | 24.729,33 | 37.505,58 | 87.213,18 |
| 750 | 38.700,78 | 57.867,03 | 87.153,18 |
| 1.000 | 52.672,23 | 78.228,48 | 87.093,18 |

No se equiparó producción con demanda. En los escenarios aislados prémium de 500, 750 y 1.000 unidades se vendieron 445; el remanente quedó en inventario valorizado. En las partidas oficiales las empresas compiten por mercado compartido, por lo que sus ventas difieren de los escenarios aislados.

Los precios base se mantuvieron en S/ 120, S/ 150 y S/ 280. En la configuración prémium de estos ensayos, el motor reconoció calidad y aplicó su bonificación existente de 40%: precio efectivo S/ 392. A 100 unidades eficientes, su costo unitario de fabricación fue S/ 199,32. La matriz distingue el precio elegido del efectivo; en combinados, el precio de la tabla es el promedio ponderado por unidades vendidas.

Resultados oficiales eficientes del ciclo 6 de `SIDE-6DJZ`:

| Empresa | Producido | Vendido | Utilidad neta del ciclo | Utilidad acumulada | Caja final |
| --- | ---: | ---: | ---: | ---: | ---: |
| Básico | 1.000 | 332 | 8.866,41 | 56.824,06 | 901.257,99 |
| Estándar | 1.000 | 369 | 7.408,46 | 100.600,93 | 944.670,20 |
| Prémium | 1.000 | 89 | 4.749,81 | 75.999,01 | 571.896,23 |
| Combinado | 3.000 | 1.304 | 4.232,07 | 282.031,96 | 495.523,24 |

Los resultados ineficientes del mismo ciclo fueron negativos: básico −54.736,60; estándar −49.915,61; prémium −15.888,11; combinado −78.555,43. Prémium ineficiente y combinado ineficiente cerraron con caja negativa (−95.313,60 y −884.822,94). Son déficits reales del modelo, no empresas financieramente solventes ni estrategias viables. El balance sigue conciliando; la simulación permite reflejar efectivo negativo y no impone automáticamente una quiebra.

## Conciliación y continuidad

Los 109 resultados oficiales se reprodujeron con sus planes y antecedentes reales en Node y en el runtime Edge: coincidieron exactamente producción, ventas, inventarios y los cuatro estados financieros con PostgreSQL. Las 90 configuraciones aisladas también pasaron persistencia con migraciones SQL reales en PostgreSQL local PGlite; esta última prueba no se presenta como otra partida remota.

Se comprobaron ingresos por unidades vendidas y precio, costo de ventas, utilidad bruta/operativa/neta, caja inicial + entradas − salidas, activos = pasivo + patrimonio, consumos e inventarios por SKU, descuentos por volumen y límites trabajador/máquina/etapa. La tolerancia monetaria para identidades agregadas es S/ 0,021 por redondeo; la igualdad de estados entre entornos es exacta.

Las tres interfaces publicadas pasaron **327 comparaciones**: 108 en la partida de 3 ciclos, 216 en la de 6 ciclos y 3 en la repetición. Se comprobaron los cuatro estados financieros, las cifras visibles, los históricos del estudiante y la persistencia tras recargar, usando Auth y Supabase reales. Las ejecuciones finales terminaron sin errores de página ni reintentos de ingreso. Después de navegar, los **109 reportes de PostgreSQL** seguían coincidiendo con sus cierres en resultados, caja, flujo y balance; diferencias y duplicados: **cero**.

Se arrastraron compras de máquinas, inventarios, caja y resultados acumulados sin comprar de nuevo todo el parque. Los préstamos franceses de las estrategias intermedias terminaron amortizados. Se aplicaron eventos reales mediante la función docente: PE69 en 3C/C3, y PE30, PE71, PE75, PE68 en 6C/C3–C6. Los eventos y la demanda compartida se incluyeron en la reproducción, sin sustituirlos por valores de prueba.

## Error encontrado y corrección

La lectura de `side_historial_oficial` volvía a descomprimir, ordenar y copiar grandes cierres JSON para cada empresa y ciclo. Al aumentar el historial agotaba el límite de consulta de PostgreSQL y dejaba las interfaces sin resultados recuperables, aunque el cierre estuviera confirmado.

Se incorporó un índice privado por partida/ciclo/empresa, que conserva exactamente el JSON original. Un trigger indexa los cierres nuevos y la migración indexa los existentes sin modificar sus sellos. La función mantiene su autorización de docente/estudiante y sus estados de cierre. La lectura medida de seis ciclos de una empresa bajó a aproximadamente 227 ms; la versión anterior llegó a exceder 8 segundos y la consulta global produjo operaciones temporales de más de un minuto. Los tiempos no son una garantía de latencia de red.

Docente y laboratorio ahora consultan por empresa con concurrencia limitada a dos y validan respuestas completas y sin duplicados. Comparten consultas simultáneas y conservan en memoria los historiales con todos sus ciclos confirmados, que son inmutables; las consultas pendientes y los errores se vuelven a solicitar y el cambio de sesión invalida la memoria. Esto evita descargas repetidas de aproximadamente 19 MB por historial de 6 ciclos. No se modificaron opciones, decisiones ni diseño visual. Las pruebas de autorización, equivalencia exacta del JSON anterior, cierres futuros y acceso directo denegado al índice privado pasaron.

La transferencia de seis ciclos de una empresa llegó a 1,28 MB y 7,66 segundos en una lectura directa; los combinados son mayores y las solicitudes simultáneas podían superar los 15 segundos del navegador. Se ajustó a 45 segundos el límite de las dos lecturas grandes (`side_historial_oficial` y `obtener_reporte_empresa`), manteniendo cancelación y errores explícitos. Las escrituras conservan sus 15 segundos y no se reenvían automáticamente.

## Incidencias preservadas y límites

En `SIDE-6DJZ`, empresa 234, ciclo 5, el plan QA combinado de 2.250 unidades no llegó a confirmarse antes del vencimiento mientras se investigaban las lecturas lentas. El cierre oficial tuvo meta cero y producción cero. La matriz muestra ese resultado real y no lo cuenta como una producción de 2.250 aprobada. Para continuar se usó la exclusión docente temporal de esa empresa al avanzar y se reactivó antes del ciclo 6. Su plan de 3.000 unidades del ciclo 6 sí se confirmó y cerró normalmente. No se sobrescribió el ciclo 5; la misma meta combinada de 2.250 está cubierta en la matriz aislada con los tres perfiles.

Para no dejar esa cantidad únicamente probada en local, se repitió el plan ineficiente de 750 unidades por molde en otra partida, `SIDE-8ZRJ`, ciclo 1: produjo **2.250**, vendió **2.190**, perdió **S/ 60.221,06** y cerró con **S/ 214.179,05** de caja. El cierre lo ejecutó la Edge Function real y coincidió exactamente con Node y el runtime Edge reproducido. Es una repetición de cantidad/recursos en mercado independiente, no una reconstrucción del mercado compartido del ciclo 5 original. La partida QA de 3 ciclos se finalizó por su control normal después de comprobar sus interfaces; no se reemplazó ni canceló para crear esta nueva sala. Esta repetición adicional prueba sólo su ciclo 1 y no se presenta como otra prueba completa de 3 ciclos.

El cierre del ciclo 6 necesitó reintento después de un timeout. La Edge Function real y su procesamiento programado acabaron confirmando el único cierre oficial. Las dos partidas principales tienen 9 cierres y 108 reportes, sin duplicados; con la repetición suman 10 cierres y 109 reportes. Permanecen cuatro partidas antiguas ajenas a esta QA con solicitudes inválidas que pueden hacer que la invocación global de cierre devuelva error parcial; no se modificaron para ocultarlo.

Los hashes de los 167 cierres y 216 reportes previos se conservaron: `1088a80ea03e7dab9955f784341c0c96` y `7dd937ecc38fe38ec87f92c895686f60`. No se alteró `SIDE-WWZB` ni se forzaron ganancias.

## Reproducción

El código correctivo publicado es `0b12a2c`, posterior a `04382e6` y `0f39361`. Las [216 regresiones de GitHub](https://github.com/valenlysm29/SIDE1/actions/runs/41714947211) pasaron; el [despliegue de Pages](https://github.com/valenlysm29/SIDE1/actions/runs/41714944978) publica ese código. La función `side-business-close` permanece activa en versión 16: sus cuatro archivos coinciden con `main` (hashes en `edge.json`); estas correcciones de lectura no requieren cambiar ni redesplegar su motor. Las cuatro migraciones de lectura sí están aplicadas en Supabase; las versiones remotas y las pruebas de inmutabilidad figuran en `integridad.json`.

Pruebas: `node --test tests/progresiva_integral.test.cjs tests/progresiva_historial_sql.test.cjs tests/progresiva_history_service.test.cjs`; reproducción oficial con evidencia local: `node tests/progresiva_oficial_verify.cjs`. El navegador utiliza el sitio publicado y sesiones QA reales, sin respuestas simuladas. `tests/progresiva_oficial.py` requiere activación explícita para crear datos remotos. Las credenciales y snapshots operativos quedan en archivos locales ignorados. El informe se regenera con `node tests/progresiva_informe.cjs` después de completar ambas verificaciones de interfaces.

La repetición se reproduce con `node tests/progresiva_repeticion_2250.cjs verify` y `python tests/progresiva_browser.py repeat2250`, usando su evidencia/sesión local. La matriz incluye la incidencia de producción cero original y el nuevo resultado de 2.250 por separado.
