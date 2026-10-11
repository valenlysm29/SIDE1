# Revisión independiente final de la integración Excel

Fecha: 2026-10-11. Revisor A9, sin participación previa en la implementación. Base original `9fbe6ec`; revisión adicional de correcciones desde `565a35a` hasta el árbol de trabajo actual posterior a `fcf6c36`. Solo se creó este informe. No se modificaron código, tests, NPC/modelos, repositorios externos ni producción. Remoto verificado: `https://github.com/valenlysm29/SIDE1.git`. El directorio contenedor actualmente solo contiene SIDE1.

**Veredicto de código: sin hallazgos críticos abiertos en el alcance revisado. Veredicto de aceptación y publicación: condicionado; no autoriza push mientras la regresión final y las tres simulaciones finales no estén terminadas y aprobadas.** Los fallos preexistentes demostrados no equivalen a tests aprobados.

## Hallazgos reproducidos y correcciones verificadas

| Hallazgo | Evidencia y reproducción | Estado revisado |
| --- | --- | --- |
| P1: pérdida de cierre después de error de red/CAS al avanzar automáticamente | `js/docente.js:346` antes de corregir: estado ciclo1, servidor ciclo2; cierre1 falla, se aplicaba ciclo2 y el siguiente poll no reintentaba1. VM del cuerpo real produjo llamadas `[1]` tras dos polls. También afectaba la recuperación terminal. | Corregido. Recorre desde1 hasta último ciclo terminado; no aplica runtime ante fallo; reintenta con partida remota inactiva. `init` y `pageshow` recuperan por partidaId; crear otra partida espera reconciliación. Tests de retry, recarga, results y finished pasan. |
| P2: docente remoto perdía balance general al recargar | SQL guardaba balanceCaja sin balanceGeneral; `supabaseReports` buscaba únicamente `balance_caja.balanceGeneral`. | Corregido en `js/docente.js:633`: recupera el balance persistido en `estado_resultados.excel.financial.balanceGeneral`. Test de navegador docente sin caché local pasa. |
| P2: omitir activos evitaba mantenimiento/depreciación | Primer ciclo con activos y segundo `maquinaria:{}` conservaba maquinariaActivos, pero gastos eran cero. | Corregido en `js/engine/ciclo.js:6`: fusiona cantidades declaradas con activos históricos antes de calcular costos. Tests caja comprueban gasto conservado y ausencia de recompra. |
| P2: transición podía cobrar otra vez un activo pagado | Máquina legacy3500, caja96500 y activo INF-02=1 en primer cierre cobraban3675 adicionales sin historial de activos. | Corregido: `captureExcelTransition` importa activos, caja, deuda y stock físico explícito; historial nuevo se siembra una sola vez. Activación se bloquea en un ciclo con operaciones legacy y se permite al comenzar el siguiente. Prueba transición pagada + préstamo previo pasa. |
| P2: captura numérica y confirmación no concordaban con el nuevo modelo | Controles tiendas/%crédito ausentes; HUD/Enviar todo seguían el flujo anterior. | Corregido: inputs numéricos persistidos; progreso/confirmación usan el plan del ciclo; Enviar todo conduce al editor. Costos por zona y calendario de crédito se identifican explícitamente como pendientes porque el Excel no aporta fórmulas. |

Se revisó además el filtro `cicloActivacion` local y SQL para impedir eliminar retroactivamente una empresa que activa lotes en un ciclo posterior. La prueba local correspondiente pasa.

## Evidencia independiente ejecutada

- Primera ejecución propia: 48 tests Node de producción, costos, puntajes, mercado, ciclo, caja, remoto y valorización; cero fallos. Tras correcciones se repitieron 52 tests del mismo alcance con transición; cero fallos.
- Última revisión corta: 13 tests de docente/reintento/recuperación, transición y UI; cero fallos, cero omitidos. Incluye retry tras error, recarga en ciclo3, results y finalizada inactiva.
- `node tests/excel_sql_db.cjs` se ejecutó varias veces, incluida esta última revisión: PASS. Aplica migración dos veces; comprueba CAS, cierre idempotente, aislamiento docente, denegación anon y protección de resultados frente a snapshots/reportes tardíos. Es PostgreSQL PGlite local; no demuestra despliegue en Supabase real.
- Comparación propia sin reescribir artefactos: SIM1 468/0, SIM2 504/0 y SIM3 1008/0 contra esperados independientes financieros disponibles entonces. El oráculo se amplió posteriormente a SIM2 585/0 y SIM3 1140/0; sus JSON de paridad fueron inspeccionados. La repetición final de navegador con estos últimos conteos corresponde al coordinador.
- Se inspeccionaron `extender_finanzas.py` y el comparador: los esperados financieros vienen de fórmulas Excel recalculadas, y SIDE exporta 33 campos financieros. No se confunde igualdad local/remoto contra el mismo motor con un oráculo independiente.
- Catálogo de 68 filas y aportes contra extracción: test pasa. Configuración mantiene flags literales y parámetros no definidos explícitos. Los mensajes originales de lotes conservan incluso la ortografía de la fuente.

## Límites y condiciones de cierre

La evidencia UI previa A8 acredita registro real local, tres simulaciones, caja/HUD/resumen y transición sin red de producción; no sustituye el nuevo pase final después de los últimos cambios de recuperación y HUD. La cobertura remota combinada es servicio con mocks y SQL local con roles; no se afirma ejecución conectada en producción ni migración aplicada allí.

La atribución `reports/atribucion_regresion_excel.md` demuestra fallos de baseline NPC, objetivos táctiles y scroll. El coordinador informó además timeout de `world_startup` en línea67 todavía sin atribución final. No se declara regresión integral verde ni autorización de publicación mientras ese resultado y la corrida final sigan abiertos. La instrucción original exige todos los tests y las tres simulaciones verdes antes del push; el revisor no puede dispensarla.

Pendientes de definición de producto: efectos por tiendas, calendario de cobros a crédito y parámetros marcados PENDIENTE_DEFINIR. La UI explica esa falta de fórmulas; no se presentan como funciones financieras implementadas. No se identificaron nuevos errores reproducibles abiertos en el código Excel revisado al emitir este informe.

## Cierre del coordinador tras la revisión
La única verificación final terminó con tres simulacionesPASS,3104comparaciones sin diferencias, SQLPASS y49archivos sin errores sintácticos. La regresión general conserva dos fallos3D sin atribuir ni resolver (continuous_world y world_cycle_restart); no se declara aceptación global y no se publica. Esta anotación informa resultados posteriores; no sustituye el dictamen independiente anterior.
