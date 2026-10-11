# Estado de continuación — 2026-10-11

## Recuperación y seguridad
Raíz y remoto verificados: SIDE1, valenlysm29/SIDE1. HEAD inicial 9fbe6ec; sin commits exclusivos frente a origin/main. Stash previo del mundo 3D conservado. Se preservan todos los archivos Excel de la tarea en un WIP local; cambios NPC, modelos, capturas y documentación ajenos quedan sin incorporar.

## Hecho
Motor UMD, configuración, catálogo Excel de 68 filas, editor local, cierre local e historial. 48 pruebas dirigidas aprobadas en última ejecución previa. Oráculos recalculados mediante Excel COM independiente: base351, SIM2 282, SIM3 564 y consecuencias56 sin diferencias Node. SIM3 navegador aprobó tres ciclos. Revisión corrigió identidad por precio, penalización bancaria persistente y resumen del estudiante. Entradas préstamo y reputación se acaban de agregar al driver; pendiente repetir. SIM1 ahora define tres lotes por empresa, pendiente recalcular y probar cierre real.

## Pendiente
Camino remoto y caja unificada; catálogo activo legado; cobertura bancaria de oráculo; SIM1/2/3 finales; atribución demostrada de regresiones (manifiesto, DOM y móvil); revisión independiente final y decisión SQL. Regresión integral previa terminó con fallos y EBUSY al restaurar su propio log: no se declara verde.

## Siguiente paso
A7 oráculos/fixtures; A6 integración y caja; A8 navegador después de A7; agente de regresión compara HEAD aislado dentro SIDE1. Actualizar este informe y WIP por hito. Sin push hasta aceptación completa. Excel fuente permanece local; falta decisión del usuario sobre versionarlo.

## Hito A7 / SIM1 inicial
SIM1 Node: 320 salidas del cierre multilote contra Excel COM, 0 diferencias. SIM1 navegador inicial: flujo normal4empresas, 3segmentos/3lotes, cierre docente1ciclo, 320 salidas0diferencias y351 verificaciones de componentes0diferencias. El doble assert ahora implementa equal con Object.is y ok fatal; no sustituye temporizador: se invoca tickStudentGame real. Falta repetir tras integración A6 y ampliación banca. Log reports/sim/sim_excel_1.log.

## Hito A7 banca y carga común
Oráculos ampliados: SIM1 336, SIM2 306, SIM3 612 salidas0diferencias Node (importe préstamo, TEA, deuda y penalización pendiente incluidas). Loader tests/fixtures_excel.cjs común lee entradas literales/celdas, no caches esperadas; base, costos y SIM1 lo usan. Todas las opciones del driver deben existir o falla, y confirma préstamo/reputación/lotes del reporte contra la entrada. SIM2 UI3ciclos0diferencias306; SIM3 UI3ciclos0diferencias612 en ejecución inicial. A6 está implementando remoto, caja y SQL idempotente. Pendiente repetición final tras sus cambios.

## Hito A7 final
A7 terminó: base351 + consecuencias56 + SIM1 336 + SIM2 306 + SIM3 612 + banco153 =1814 comparaciones0diferencias, libro consolidado0pendientes. Banco conserva3pp durante recuperación sinpréstamo y losconsume cuando llega préstamo5000 (deuda5000). A8final delegado; espera A6 para repetir UI y verificar caja. Archivos oracle y entregables derivados guardados en WIP; fuente original no versionada.

## Hito A6 integración inicial / SQL local
A6 implementó adaptador de caja, cierre remoto CAS y migración idempotente 2026-10-11_logica_excel.sql. Root validó PostgreSQL local PGlite: aplicar2veces, acceso profesor/denegaciónanon, idempotencia, contexto stale rechazado, reporte y snapshot tardíos protegidos; PASS tests/excel_sql_db.cjs. No se ejecutó SQL en producción. Pendiente ajuste tasa de préstamos existentes, activación sin SQL, oráculo de caja y revisión independiente. A8 inició pruebas de interfaz con igualdad caja/HUD/resumen/reporte y ledger sin doblecargo.

## Hito A0 atribución final
Comparación exacta HEAD9fbe6ec: NPC17/16, dos botones40px en tabletB800 y assertion scrollY>0 fallan antes y ahora. Cinco errores del dobleDOM eran previos; hoy9/9 pasa. Evidencia de8 ejecuciones y hashes en reports/sim/atribucion-regresion; informe reports/atribucion_regresion_excel.md. No se modificaron NPC/CSS/testsfallidos ajenos. A9nuevoindependiente activo sin historial del desarrollo. Pendiente regresión final de todas las suites y oráculo caja.
