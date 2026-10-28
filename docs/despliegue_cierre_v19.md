# Despliegue manual del cierre Excel v19

La referencia vigente del motor 2D es el documento de costos del 27/10/2026 y
el [Excel original recibido](referencias/DECISIONES_SIDE_19_original.xlsx).
`DECISIONES_SIDE_19.xlsx` es un libro adaptado anterior y no debe usarse como
oráculo del motor actual. El contraste por hoja y celda está en
[la auditoría de fuentes originales](../reports/auditoria_excel_documentos_2d_20261027.md).

Para la sala indicada por el usuario, ejecutar primero el diagnóstico de solo
lectura [SIDE-7DFR](sql/20261027_diagnostico_ventas_SIDE_7DFR.sql). Distingue
ventas aún pendientes, reportes sobrescritos y cierres guardados con cero.
La reparación incremental restaura reportes desde cierres existentes; no
recalcula un cierre que ya se guardó con cero ni crea ventas sin recursos.

No se ejecutó SQL en Supabase alojado. El push de Git tampoco instala funciones SQL.

En una base SIDE existente, pegar **todo** `docs/sql/20261023_despliegue_cierre_v19.sql` en el SQL Editor. El archivo contiene exactamente, en orden:

1. `supabase/migrations/20261023_retirar_motor_anterior.sql`.
2. `supabase/migrations/20261023_cierre_negocio.sql`.
3. `supabase/migrations/20261023_corregir_contexto_cierre_estado.sql`.
4. `supabase/migrations/2026-10-23_cierre_planes_v19.sql`.
5. `supabase/migrations/2026-10-23_configuracion_version_v19.sql`.
6. `supabase/migrations/20261027_corregir_ventas_generales.sql`.
7. `supabase/migrations/20261027_resultados_en_vivo.sql`.
8. `supabase/migrations/20261027_preservar_ciclo_snapshot.sql`.
9. `supabase/migrations/20261027_proteger_reportes_cerrados.sql`.

Los bloques 8 y 9 conservan el ciclo de las confirmaciones y protegen ingresos,
unidades y caja de un cierre frente a reportes preliminares atrasados. En una
instalación con los siete primeros bloques aplicados, basta aplicar las dos
migraciones nuevas, en ese orden. No recalculan cierres históricos. El cliente
también identifica snapshots antiguos sin `round` y omite reportes preliminares
cuando ya recibió el cierre; estas defensas no requieren la migración nueva.
La versión incremental en un solo archivo es
`docs/sql/20261027_reparar_ventas_2d.sql`. Restaura reportes previamente
sobrescritos exclusivamente desde cierres guardados que contienen sus estados
financieros y recibos completos. No cambia la caja actual de la empresa, que
puede contener movimientos posteriores, ni inventa ventas de ciclos sin cierre.

El bloque 5 añade `partidas.config_revision` y guardado de configuración con revisión esperada, bloqueo de fila y autorización de propietario. Dos pestañas no pueden guardar sobre la misma revisión: la segunda recibe un conflicto visible y conserva su formulario. El polling y las transiciones de reloj/eventos resueltos no incrementan la revisión. Para revertir sólo este bloque, retirar `side_guardar_configuracion_v19(uuid,jsonb,bigint)` y el trigger `side_config_revision_v19`; conservar la columna para auditoría. El cliente v19 requiere esta RPC para guardar configuración; reinstalar también el cliente anterior si se revierte.

Requiere las tablas y funciones SIDE anteriores de admisión/ciclo de vida, `participantes.expulsada_at`, `side_student_state` con revisiones y `reportes_ciclo`. No reconstruye una base vacía. El paquete completo se aplicó dos veces en PostgreSQL local PGlite y pasó las pruebas de cierre e idempotencia.

El nuevo contexto bloquea partida/ciclo, congela snapshots con revisión, recupera confirmaciones remotas sin plan y resuelve **todas** las empresas antes de repartir mercado. Quien nunca confirmó se elimina; quien ya tenía un plan confirmado hereda sus decisiones para el nuevo ciclo. Conserva inventarios actuales e historial de compras de activos. El motor vuelve a calcular producción: no confía en cantidades de producción proporcionadas por el cliente.

En automático se esperan 30 segundos después del vencimiento antes de resolver faltantes. Es un **SUPUESTO** de tolerancia de red, configurable mediante `partidas.configuracion.planSyncGraceSeconds`, entre 0 y 300. El cierre manual explícito del docente resuelve los faltantes inmediatamente. Las confirmaciones que todavía no llegaron al servidor al terminar esa tolerancia no pueden distinguirse de una decisión no enviada.

La corrección del 27/10 alinea la validación SQL con los precios internos del motor actual: importes numéricos no negativos, con S/42.50, S/100 y S/250 como valores predeterminados. Los rangos de la versión anterior podían rechazar el precio interno de S/100 del segmento medio. La cola de sincronización ya omite valores predeterminados para compatibilidad; el parche elimina también la discrepancia al guardar precios explícitos válidos del motor. No añade campos ni modifica decisiones del catálogo.

Al guardar un cierre, el snapshot financiero definitivo del ciclo prevalece sobre una fotografía preliminar del mismo período. Se conservan los demás snapshots y los cierres existentes. En una base que ya tiene el paquete v19 instalado, aplicar únicamente `supabase/migrations/20261027_corregir_ventas_generales.sql`. Esta migración se validó dos veces en PostgreSQL local; no se ejecutó en Supabase remoto.

## Límite del cierre sin docente

**El cierre económico todavía necesita un navegador docente conectado.** PostgreSQL autoriza y persiste resultados, pero no ejecuta el motor JavaScript. El temporizador usa hora del servidor y puede avanzar aunque el docente cierre su navegador; los ingresos pendientes se calculan al reconectarse. La recuperación e idempotencia están probadas localmente; no equivalen a una prueba de ejecución económica autónoma.

Completar la autonomía requiere desplegar una Edge Function o worker confiable que importe el motor puro completo, programar su ejecución al vencimiento, obtener los planes mediante una RPC exclusiva del servicio y persistir con revisiones/bloqueo. No se habilitó a estudiantes para enviar resultados financieros arbitrarios ni se introdujo una segunda fórmula parcial en SQL.

## Diagnóstico

`node tools/diagnostico_supabase.js` realiza únicamente lecturas: conexión y, con `SIDE_DIAGNOSTIC_JWT` de un docente autenticado, existencia de funciones/columnas, RLS y triggers históricos. No imprime tokens ni ejecuta migraciones. Requiere aplicar el paquete para disponer de `side_diagnostico_v19`. El diagnóstico de catálogo/RLS no sustituye las pruebas de acceso de cada identidad.

`node tools/diagnostico_supabase.js --demo-local SIDE-000` añade la prueba de cierre sobre PostgreSQL desechable local. No cierra una partida real. También puede ejecutarse directamente `node tests/cierre_v19_db.cjs` para esa prueba sin ninguna petición de red.

## Reversión

Para recuperar las funciones anteriores, reaplicar `20261023_cierre_negocio.sql` y `20261023_corregir_contexto_cierre_estado.sql`, y ejecutar `DROP TRIGGER IF EXISTS side_validar_precios_v19 ON public.side_student_state;`. Conservar las tablas y cierres históricos. No reinstalar los triggers del motor económico anterior. Las expulsiones y réplicas ya resueltas son cambios de datos y requieren revisión explícita; no se reactivan automáticamente empresas expulsadas.
