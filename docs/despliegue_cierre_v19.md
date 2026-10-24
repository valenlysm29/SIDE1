# Despliegue manual del cierre Excel v19

No se ejecutó SQL en Supabase alojado. El push de Git tampoco instala funciones SQL.

En una base SIDE existente, pegar **todo** `docs/sql/20261023_despliegue_cierre_v19.sql` en el SQL Editor. El archivo contiene exactamente, en orden:

1. `supabase/migrations/20261023_retirar_motor_anterior.sql`.
2. `supabase/migrations/20261023_cierre_negocio.sql`.
3. `supabase/migrations/20261023_corregir_contexto_cierre_estado.sql`.
4. `supabase/migrations/2026-10-23_cierre_planes_v19.sql`.

Requiere las tablas y funciones SIDE anteriores de admisión/ciclo de vida, `participantes.expulsada_at`, `side_student_state` con revisiones y `reportes_ciclo`. No reconstruye una base vacía. El paquete completo se aplicó dos veces en PostgreSQL local PGlite y pasó las pruebas de cierre e idempotencia.

El nuevo contexto bloquea partida/ciclo, congela snapshots con revisión, recupera confirmaciones remotas sin plan y resuelve **todas** las empresas antes de repartir mercado. Quien nunca confirmó se elimina; quien ya tenía un plan confirmado hereda sus decisiones para el nuevo ciclo. Conserva inventarios actuales e historial de compras de activos. El motor vuelve a calcular producción: no confía en cantidades de producción proporcionadas por el cliente.

En automático se esperan 30 segundos después del vencimiento antes de resolver faltantes. Es un **SUPUESTO** de tolerancia de red, configurable mediante `partidas.configuracion.planSyncGraceSeconds`, entre 0 y 300. El cierre manual explícito del docente resuelve los faltantes inmediatamente. Las confirmaciones que todavía no llegaron al servidor al terminar esa tolerancia no pueden distinguirse de una decisión no enviada.

Los precios nuevos se validan también al escribir snapshots: Económico S/40–45, Medio S/120–200 y Premium S/220–400. Los planes antiguos sin campo de precio siguen siendo legibles y usan los valores predeterminados documentados en la configuración económica. No se reescriben cierres existentes.

## Límite del cierre sin docente

**El cierre económico todavía necesita un navegador docente conectado.** PostgreSQL autoriza y persiste resultados, pero no ejecuta el motor JavaScript. El temporizador usa hora del servidor y puede avanzar aunque el docente cierre su navegador; los ingresos pendientes se calculan al reconectarse. La recuperación e idempotencia están probadas localmente; no equivalen a una prueba de ejecución económica autónoma.

Completar la autonomía requiere desplegar una Edge Function o worker confiable que importe el motor puro completo, programar su ejecución al vencimiento, obtener los planes mediante una RPC exclusiva del servicio y persistir con revisiones/bloqueo. No se habilitó a estudiantes para enviar resultados financieros arbitrarios ni se introdujo una segunda fórmula parcial en SQL.

## Diagnóstico

`node tools/diagnostico_supabase.js` realiza únicamente lecturas: conexión y, con `SIDE_DIAGNOSTIC_JWT` de un docente autenticado, existencia de funciones/columnas, RLS y triggers históricos. No imprime tokens ni ejecuta migraciones. Requiere aplicar el paquete para disponer de `side_diagnostico_v19`. El diagnóstico de catálogo/RLS no sustituye las pruebas de acceso de cada identidad.

`node tools/diagnostico_supabase.js --demo-local SIDE-000` añade la prueba de cierre sobre PostgreSQL desechable local. No cierra una partida real. También puede ejecutarse directamente `node tests/cierre_v19_db.cjs` para esa prueba sin ninguna petición de red.

## Reversión

Para recuperar las funciones anteriores, reaplicar `20261023_cierre_negocio.sql` y `20261023_corregir_contexto_cierre_estado.sql`, y ejecutar `DROP TRIGGER IF EXISTS side_validar_precios_v19 ON public.side_student_state;`. Conservar las tablas y cierres históricos. No reinstalar los triggers del motor económico anterior. Las expulsiones y réplicas ya resueltas son cambios de datos y requieren revisión explícita; no se reactivan automáticamente empresas expulsadas.
