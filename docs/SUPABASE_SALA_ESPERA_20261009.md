# Aplicar la sala de espera y el reingreso exacto en Supabase

**Cambios pendientes en Supabase: SÍ.** El código necesita la migración `20261009_sala_espera_identidad_exacta.sql`. No se ha ejecutado SQL remoto. Hasta aplicarla, crear una partida nueva o ingresar/reanudar una sesión muestra «Falta aplicar la migración ... en Supabase». Por ello un push previo bloquea temporalmente estos accesos en producción.

1. Abre Supabase en tu navegador, entra al proyecto SIDE y selecciona **SQL Editor** en el menú izquierdo.
2. Pulsa **New query**. Antes de cambiar nada puedes comprobar las funciones instaladas:

```sql
select to_regprocedure('public.side_runtime(jsonb,timestamp with time zone)') as reloj,
       to_regprocedure('public.ingresar_empresa(text,text,text)') as ingreso,
       to_regprocedure('public.side_admission_features()') as version;
```

3. Si `reloj` o `ingreso` aparece vacío (`NULL`), aplica primero, cada archivo completo en una consulta distinta y en este orden: `supabase/migrations/supabase_game_lifecycle.sql`, luego `supabase/migrations/supabase_student_admission.sql`. Estos scripts presuponen las tablas existentes de SIDE y la migración base `supabase/migrations/supabase_migration.sql`. En un proyecto SIDE existente no pegues `schema.sql` como reparación ni ejecutes otra vez la base sin revisar qué migraciones faltan. Si Supabase señala una tabla/columna inexistente, conserva el error para diagnosticar el requisito pendiente.
4. Abre `supabase/migrations/20261009_sala_espera_identidad_exacta.sql`, copia **todo** su contenido en una nueva consulta y pulsa **Run**. Se ejecuta en una transacción, no elimina datos ni cambia la marca de partidas ya iniciadas. Puedes repetirlo.
5. Comprueba el resultado de la primera consulta final: `waitingRoomVersion` debe ser `3`, `exactIdentityVersion` debe ser `2` y `serverTime` una fecha del servidor. La segunda consulta informa el estado real de `SIDE-SD7`.
6. Si `SIDE-SD7` tiene `started_at` y estado activo, sigue iniciada: la migración no la reabre ni altera su historial. Crea una partida nueva para probar la sala de espera. Informa el resultado diagnóstico antes de intentar cualquier reparación histórica.
7. En SIDE, crea una partida con 2 minutos de sala de espera y ciclos manuales. Después del primer clic debe aparecer sala de espera, con ingreso habilitado. Ingresa desde dos navegadores; ambos cuentan hacia la misma fecha. Al llegar a cero empieza el ciclo 1 sin otro clic docente. Una empresa nueva se bloquea; `demo1`/`demo1` reingresa desde otro dispositivo si fue registrada. `Demo1` o nombres con tildes distintas se rechazan. Los espacios externos/repetidos se limpian antes de registrar; mayúsculas y tildes se respetan.
8. Confirma que ejecutaste el SQL y que ambas versiones aparecen correctas. Solo entonces puede considerarse lista la integración con producción.

## Causa y límites del diagnóstico

`startGame()` creaba una sala de espera y enseguida enviaba `iniciar` en modo manual. La RPC reemplazaba su plazo por `now()` y marcaba la partida activa; `ingresar_empresa` correctamente bloqueaba altas. Además el contador y el vencimiento estaban condicionados al modo automático de ciclos. Ahora la espera termina en su plazo de servidor para ambos modos; el modo manual controla el cierre y avance posteriores. `iniciar` durante espera no adelanta el plazo.

Se reprodujo la RPC real de `SIDE-SD7`, `demo1`/`demo1`: devuelve `PARTIDA_INICIADA`. La búsqueda muestra `activa`. Las políticas impiden leer configuración privada con el cliente anónimo; por tanto no se atribuye el estado histórico concreto a UTC/Lima sin la consulta final del SQL. Se probaron fronteras temporales del servidor en UTC y America/Lima, sin diferencia.

La seguridad de admisión permanece en la RPC transaccional y permisos: alta y transición se serializan sobre la partida; las escrituras directas de empresas/participantes y RPC antiguas siguen revocadas. Los nombres de identidad se comparan como fueron registrados, sin quitar tildes o convertir caja; las RPC de recuperación usan la misma comparación.
