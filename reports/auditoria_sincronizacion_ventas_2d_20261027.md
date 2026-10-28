# Auditoría de sincronización y cierre de ventas 2D — 27/10/2026

## Fallos reproducidos y corregidos

1. La RPC `guardar_estado_estudiante` descartaba `snapshot.round` pero conservaba los indicadores de envío. Al avanzar la sala al ciclo 2, la hidratación aplicaba la confirmación del ciclo 1 al ciclo 2: bloqueaba decisiones y podía crear un plan 2 con todas las decisiones fechadas en el ciclo 1. El motor recibía entonces insumos/personal de otro período y podía producir/vender cero.
2. Una escritura tardía por `guardar_reporte_estudiante`, incluso con una revisión CAS actual válida, podía reemplazar un reporte definitivo de 90 unidades/S/3825 con un reporte preliminar de ingresos cero y sin recibo. Se reprodujo con las RPC reales en PostgreSQL local.

El cliente atribuye las confirmaciones a su ciclo original. El marcador interno `__snapshotRound` conserva esta asociación también en servidores que todavía usan la whitelist anterior. La migración `20261027_preservar_ciclo_snapshot.sql` conserva además `round` en el contrato SQL.

Los planes actuales ya contaminados se reconocen cuando todas sus decisiones pertenecen a un ciclo anterior y no existe un cierre del ciclo actual. Se conserva una copia local completa bajo `SIDE_STALE_CYCLE_PLAN_BACKUP_<sala_empresa>_<ciclo>`, se retira exclusivamente ese plan abierto inválido y se desbloquea el ciclo actual. Las decisiones, recursos, caja y cierres anteriores se conservan. El estudiante puede confirmar su plan actual; sin una nueva confirmación, la réplica del plan previo sigue las reglas SQL existentes.

El cliente deja de enviar reportes preliminares de ciclos con cierre confirmado, sin omitir sus operaciones de decisiones. La migración `20261027_proteger_reportes_cerrados.sql` valida identidad y revisión antes de reconocer un cierre. El bloqueo de la fila de estado de la empresa serializa esta comprobación con el cierre económico: un reporte previo termina antes del cierre; un reporte posterior no reemplaza el definitivo.

La misma migración recupera reportes anteriormente sobrescritos usando únicamente el resultado financiero y el recibo del cierre ya guardado de esa empresa, partida y ciclo. No vuelve a ejecutar el motor ni modifica los cierres originales. No reemplaza `empresas.caja_actual`, porque puede contener movimientos posteriores al cierre histórico; sí restaura la caja final histórica del reporte. Los períodos sin cierre autoritativo completo permanecen intactos.

## Pruebas

`node --test tests/cycle_snapshot_round.test.cjs`: **8 aprobadas, 0 fallidas**. Cubre snapshots anteriores sin ciclo, estados ya contaminados, confirmaciones parciales, planes legítimos, cierres históricos, cola durable, identidad incorrecta, revisión antigua, reporte preliminar tardío, migraciones repetibles y recuperación de reportes sobrescritos.

Tres ciclos mediante las RPC reales sobre PostgreSQL desechable conservaron **90 unidades vendidas y S/3825 por ciclo**, con recibos, reportes y caja histórica coherentes. Una prueba adicional recuperó un reporte de cero a esos valores desde su cierre guardado y conservó un movimiento de caja empresarial posterior y un reporte de otro período.

La regresión de sincronización, cola y navegador anterior a la última ampliación: **38 aprobadas, 0 fallidas**. Evidencias en `tests/output/cycle-snapshot-sync-regression.log` y `tests/output/cycle-snapshot-round-regression.log`.

## Verificación remota y límites

La lectura pública de `SIDE-7DFR` confirmó una sala activa (HTTP 200). El validador remoto de precios acepta 42.5/100/250 (HTTP 200, `true`), por lo que el rechazo del precio medio descrito por un informe anterior ya no reproduce en esa base. Sin una identidad docente autenticada no se pudieron consultar los snapshots, empresas, cierres ni el despliegue del contexto docente en vivo. No se ejecutaron migraciones ni escrituras en Supabase remoto.

El cálculo económico remoto sigue ejecutándose desde el navegador docente; el servidor persiste los resultados. Cerrar todos los navegadores docentes deja cierres pendientes hasta su reconexión. La corrección no introduce un trabajador remoto autónomo.
