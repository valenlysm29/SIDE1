# Auditoría y verificación SQL de la separación 2D/3D

Fecha: 23 de octubre de 2026. Solo PostgreSQL embebido local (PGlite); no se ejecutó SQL ni se consultó el estado de producción.

## Hallazgos

| Archivo:línea | Dependencia | Lectura/escritura | Riesgo y acción |
|---|---|---|---|
| `supabase/migrations/supabase_student_admission.sql:807` | El snapshot compartido conserva `decision_state` y `cash_ledger` | Escritura | La prevención de contaminación 3D corresponde a la frontera del cliente; no se alteran fórmulas ni el contrato SQL. |
| `supabase/migrations/20261023_cierre_negocio.sql:23` | Contexto de cierre con planes confirmados `__cyclePlans` | Lectura | Sin dependencia de tablas recreativas. |
| `supabase/migrations/20261023_cierre_negocio.sql:70` | Persistencia de snapshots, inventario, ledger, reporte y caja desde el resultado docente | Escritura | Económica, necesaria; conservar. |
| `supabase/migrations/2026-10-11_logica_excel.sql:72` y `:88` | Funciones de triggers del motor anterior | Escritura | Reinyectan `__excel` y sustituyen ingresos/caja desde cierres históricos. |
| `supabase/migrations/2026-10-22_revertir_correcciones_conversacion.sql:107` y `:118` | Reinstalación de ambos triggers históricos | DDL | No aplicar esas migraciones después de la limpieza. |
| `supabase/migrations/supabase_game_lifecycle.sql:675` | `side_validate_events` filtra eventos habilitados | Escritura | No sustituye fórmulas; conservar. |

La búsqueda de todos los SQL del proyecto no encontró tablas, columnas ni triggers propios de `simulator3d`, checkout o ventas recreativas. No se crea `diversion_3d`: la persistencia recreativa permanece local. La ausencia de referencias explícitas no impide contaminación indirecta mediante objetos compartidos; el desacople JavaScript debe prevenirla.

## Migración revisada

`supabase/migrations/2026-10-23_separacion_2d_3d.sql` retira únicamente `side_excel_snapshot_protegido` y `side_excel_reporte_protegido`, con transacción y guardas para tablas ausentes. No elimina tablas, funciones, datos ni cierres. Ejecutar manualmente al final de las migraciones; si el cierre vigente no está instalado, aplicar primero `docs/sql/20261023_despliegue_cierre_completo.sql`.

La reversión comentada utiliza los nombres reales `side_preservar_cierre_excel_snapshot()` y `side_preservar_reporte_excel()`, verificados contra la migración histórica. Restaura deliberadamente el motor anterior y, por ello, vuelve a permitir la sobrescritura de resultados actuales. No es una recomendación de despliegue.

## Prueba automatizada

Nuevo runner: `tests/separacion_2d_3d_sql_db.cjs`, basado en `tests/lifecycle_db_fixture.cjs` y en las funciones históricas reales, no sustitutos vacíos.

```powershell
$env:NODE_PATH = (Resolve-Path '.cache/test-runtime/node_modules').Path
node tests/separacion_2d_3d_sql_db.cjs
```

Resultado: **PASS**, ejecutado dos veces. Verifica tablas ausentes; retiro repetido de ambos triggers; conservación exacta de sus funciones; ejecución del SQL de reversión extraído literalmente de los comentarios; y reaplicación de la limpieza. Evidencia: `tests/output/separacion_2d_3d_sql_2026-10-23.log`.

La prueba confirma el comportamiento local del SQL entregado; no acredita que los triggers estén presentes o retirados en Supabase real.
