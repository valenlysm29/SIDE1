# Auditoría parcial de SIDE — rama logia_prueba_mejora

Fecha: 31 de octubre de 2026. Base: da26a5a. Esta revisión no certifica que SIDE esté listo para uso docente o estudiantil.

## Interfaces reales

Se abrió `index.html` en Chromium mediante el servidor local y se redirigió únicamente la configuración de Supabase a una instancia local aislada. Por clics reales se seleccionó profesor, se inició sesión con una cuenta local, se creó una partida de tres ciclos y se observó la sala de espera. En una sesión independiente se ingresó como estudiante a otra partida local de tres ciclos, mediante código y nombres de empresa. Capturas locales: `tests/output/auditoria_login_docente.png` y `tests/output/auditoria_ingreso_real.png` (carpeta ignorada por Git).

No se completaron por interfaz las decisiones, pedidos, recepciones, Kardex, cierres, navegación histórica, comparación del Laboratorio ni la partida de seis ciclos. Tampoco se verificó visualmente móvil ni se compararon todas las cifras de pantalla con PostgreSQL. Las validaciones anteriores mediante RPC/Edge no sustituyen esas pruebas. No se modificaron componentes visuales.

## Comparación disponible con el Excel

Se abrió una copia de `docs/referencias/DECISIONES_SIDE_19_original.xlsx` en Excel local, se recalculó con `CalculateFullRebuild` y se cerró sin guardar; el original no se modificó. No se prepararon entradas equivalentes de tres y seis ciclos, por lo que los valores siguientes son comprobaciones puntuales, no pruebas de equivalencia integral.

| Módulo | Fórmula Excel | Regla SIDE | Resultado Excel | Resultado SIDE | Diferencia | Diagnóstico | Corrección |
|---|---|---|---|---|---|---|---|
| Capacidad diaria | Costos De Producción!I8=`SUM(I5:I7)`; I14=`SUM(I11:I13)`; I20=`SUM(I17:I19)`; K5=`MIN(I8,I14,I20)` | `js/production_model.js`: asignación de un trabajador por recurso y mínimo de etapas | 14, 31,4 y 24; cuello 14 | prueba `md_logic`: 8, 31,4 y 24 | corte −6 unidades/día | E: entradas y asignación no equivalentes; la prueba histórica asigna más de un trabajador por mesa | Ninguna; no se cambió la fórmula |
| Duración | CANTIDAD DE PRODUCCIÓN!L5=`K5*24`; Costos De Producción!L5=`K5*30` | `WORKING_DAYS=30` en `js/production_model.js` | 24 o 30 días según hoja | 30 días | 6 días frente a primera hoja | E: hojas con supuestos diferentes | Ninguna |
| Producción | CANTIDAD DE PRODUCCIÓN!N5=`ROUND(L5*M5,0)`; Costos De Producción!N5 misma fórmula | capacidad y eficiencia en `js/production_model.js` | 396 y 382 en las copias recalculadas | 221 en `md_logic`, con otras entradas | No comparable | E: no se han igualado las entradas; pendiente escenario equivalente | Ninguna |
| Compras, inventarios y costos | `Costos De Producción` y `Lotes_Produccion`; celdas no comparadas en esta ejecución | `js/cycle_model.js` y `js/financial_model.js` | No calculado | No calculado en escenario equivalente | No determinada | F: comparación pendiente | Ninguna |
| Ventas, demanda y estados financieros | `Motor_Puntajes` y `Lotes_Produccion`; celdas no comparadas en esta ejecución | `js/engine/cierre.js`, `js/financial_model.js` | No calculado | No calculado en escenario equivalente | No determinada | F: comparación pendiente | Ninguna |

## Concurrencia y recuperación

El comando `node --test tests/side_cierre_concurrente_pg.test.cjs tests/evento_autoritativo_postgres.test.cjs tests/cierre_rollback_local.test.cjs tests/student_sync.test.js tests/laboratorio_model.test.cjs` produjo 21 aprobadas y ninguna fallida. Incluyó dos workers concurrentes sobre PostgreSQL real, serialización de asignaciones, rollback inducido y recuperación de la cola. No demuestra tolerancia de todos los caminos HTTP ni una prueba integral bajo carga prolongada.

`node --test tests/md_logic.test.cjs tests/sales_projection.test.cjs` produjo 10 aprobadas y 6 fallidas: discrepancias históricas de capacidad, consumo/reputación, cierre, mantenimiento y moldes. La última regresión general previa, no repetida en esta revisión sin correcciones, registró 951 aprobadas y 17 fallidas.

## Riesgos y pendientes

Antes de uso real falta completar la prueba por clics de los tres perfiles contra PostgreSQL y Edge local, incluyendo 3 y 6 ciclos, permisos, recepción y resultados; preparar escenarios Excel equivalentes; revisar los fallos históricos y realizar pruebas visuales y de estabilidad adicionales. Los cambios de mantenimiento y compras requieren revisar las migraciones y la versión de Edge del entorno de destino antes de cualquier publicación. Los eventos V2 siguen siendo experimentales. No se desplegó, publicó ni modificó Supabase remoto.
