# Recuperar, compartir e ingresar a la partida

## Causas confirmadas

La captura del panel confirma que el cliente detectó una fila del servidor con una versión anterior o con `lifecycleVersion` de tipo texto. En `2260407`, `services/partida_service.js` rechazaba ese registro y `js/docente.js` no lo vinculaba como partida utilizable. Los botones Copiar dependían del indicador local `active`; por eso quedaban deshabilitados aunque la fila y su código existieran. La corrección anterior permitía cancelar esa fila, pero no recuperarla para jugar. Ese flujo queda sustituido por recuperación conservando la misma sala.

La captura del alumno contiene `SIDE-WG2SIDE`, que no es un código válido. `index.html` tenía placeholder, no un valor inicial concatenado; no se encontró código que añadiera ese sufijo automáticamente. Antes, `js/app.js` enviaba la cadena completa al RPC y la respuesta `CREDENCIALES_INVALIDAS` se mostraba como error de identidad, aunque el código no correspondiera a una sala. Las cuatro pruebas nuevas de ingreso fallaron con las fuentes anteriores y pasan con la validación actual.

## Cambio

- Se retiró el bloque de formato antiguo, su botón de cancelación adicional y «Ver detalle». El control normal de cancelación del panel permanece disponible.
- Se recupera la fila existente, con su ID y código. Una versión `"2"` de tipo texto se interpreta con la misma semántica que SQL (`->>'lifecycleVersion'='2'`), sin exigir cancelar.
- Los botones comparten el código confirmado por el servidor, independientemente de un borrador local o del texto del campo. El enlace contiene un solo código en `?partida=`. Si el portapapeles moderno falla, se intenta la copia compatible; si ambos fallan, se selecciona el código real para copiarlo manualmente.
- Al terminar la partida se invalida el registro compartible. Las respuestas pendientes no restauran vínculos anteriores después de una cancelación.
- El alumno recibe un error junto al código si contiene texto adicional o un formato inválido, antes de hacer peticiones. No se trunca ni convierte un código inválido en otro válido. Los nombres registrados siguen siendo exactos y se mantienen las restricciones de reingreso tras comenzar.

## Sí: SQL para recuperar registros antiguos

La nueva migración es `supabase/migrations/2026-10-11_recuperar_salas_compatibles.sql`. No se ejecutó en producción. Se aplica en SQL Editor; no se debe invocar el RPC de negocio desde SQL Editor sin una sesión docente, porque comprueba `auth.uid()`.

Si ya están aplicados los scripts entregados anteriormente, **ejecutar únicamente el nuevo archivo completo**. Orden completo para una instalación pendiente:

1. `supabase_game_lifecycle.sql`.
2. `supabase_student_admission.sql`.
3. `20261009_sala_espera_identidad_exacta.sql`.
4. `2026-10-11_fix_crear_partida.sql`.
5. **`2026-10-11_recuperar_salas_compatibles.sql`**, cuyo SQL exacto se incluye abajo.

La integración Excel no es requisito de recuperación/admisión. No se modifica `guardar_puntaje_docente`, RLS de tablas existentes, cálculos Excel, mundo ni NPC.

El script instala `recuperar_sala_docente(uuid,jsonb)` y sus permisos; no recorre ni modifica salas al ejecutarse. El panel solicita la recuperación de la sala del docente autenticado. Una espera sin actividad obtiene un reloj moderno una sola vez, sin cambiar código ni participantes. Una partida iniciada conserva ciclo, decisiones, resultados y sorteos; si su reloj no puede reconstruirse con seguridad, queda pausado para usar el control normal Reanudar. Los registros terminales se marcan finalizados sin reabrirlos. El bloqueo por docente y de fila protege reintentos y pestañas adicionales.

## Diagnóstico y comprobación de solo lectura

```sql
select to_regprocedure('public.recuperar_sala_docente(uuid,jsonb)') as recuperacion;
select has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as docente_execute
from pg_proc p
where p.oid=to_regprocedure('public.recuperar_sala_docente(uuid,jsonb)');
select id, codigo, estado,
       configuracion->>'lifecycleVersion' as version,
       jsonb_typeof(configuracion->'lifecycleVersion') as tipo_version,
       configuracion#>>'{runtime,phase}' as fase,
       configuracion->>'gameStartAt' as inicio_ciclo_1
from public.partidas
where estado in ('esperando','activa')
order by created_at;
```

La primera consulta debe devolver la firma, no NULL; los permisos deben dar false/true. Tras recargar el panel, la espera recuperada conserva su código y tiene versión 2, fase integration y fecha válida; una iniciada conserva su ciclo. Las consultas de firmas, columnas, índices, triggers y RLS más amplias están en `sim/crear_partida/diagnostico_supabase_solo_lectura.sql`.

Después del SQL: recargar el panel, copiar código y enlace, abrir el enlace en otra ventana e ingresar nombres de una empresa durante la espera. El formulario debe mostrar exactamente el código compartido; al recargar el docente debe conservar el mismo ID y plazo. Una empresa ya registrada reingresa con los nombres exactos; una nueva no se registra después del inicio.

## Pruebas y revisión

La prueba nueva `compartir_sala_ui.cjs` usa HTML, PartidaService, EmpresaService y PostgreSQL PGlite reales con sesión docente simulada: recuperación de fila antigua → copia → enlace → ingreso de `demo1` → participante de la misma sala → recarga y segunda pestaña. También prueba ausencia del RPC nuevo: mensaje específico con el SQL y copia del código real habilitada. La migración se aplica dos veces.

La revisión independiente encontró y corrigió dos riesgos SQL: reiniciar ciclos/sorteos de una sala con señales de actividad y reabrir una fase terminal contradictoria. Las regresiones están en `recuperar_sala_db.cjs`. También se comprobó que compartir se deshabilita al finalizar. Revisión final aprobada, sin bloqueantes.

El lote final pasó completo: **74 unitarias, ocho suites SQL y ocho suites de navegador**, sin fallos ni omisiones, más `node --check` y `git diff --check`. La suite mixta `student_admission.test.js` también pasó sus diez pruebas. Pruebas nuevas y actualizadas: `compartir_sala.test.cjs`, `compartir_sala_ui.cjs`, `recuperar_sala_db.cjs`, `student_admission_code.test.js` y casos nuevos de servicio/ingreso/creación.

Capturas: `sim/crear_partida/recuperar_compartir_docente.png`, `recuperar_compartir_estudiante.png`, `recuperar_compartir_sql_pendiente.png` e `ingreso_codigo_invalido_despues.png`. Evidencia de red y logs locales: `tests/output/compartir_partida_verificacion/` y `sim/crear_partida/recuperar_compartir_evidencia.json`. No se publican capturas ni logs pesados. La autenticación es fixture; la instalación de producción no se consultó ni modificó.

## SQL exacto del último paso

```sql
-- Recuperación explícita por el docente; no elimina ni cancela partidas.
-- Orden: lifecycle -> student_admission -> 20261009_sala_espera_identidad_exacta
-- -> 2026-10-11_fix_crear_partida -> este archivo. No requiere logica_excel.
begin;
do $$ begin
 if to_regprocedure('public.obtener_sala_docente()') is null
    or to_regprocedure('public.side_sync_game(uuid)') is null
    or to_regprocedure('public.side_valid_event_rules(jsonb)') is null then
  raise exception 'Aplica primero 2026-10-11_fix_crear_partida.sql y sus requisitos';
 end if;
end $$;

create or replace function public.recuperar_sala_docente(p_partida_id uuid,p_config jsonb default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 owner_id uuid:=auth.uid(); p public.partidas; c jsonb; r jsonb;
 untouched boolean; duration integer; minutes integer; deadline timestamptz;
 cycle integer; phase text;
begin
 if owner_id is null or not exists(select 1 from public.profesores where id=owner_id) then
  return jsonb_build_object('error','Debes iniciar sesión como docente.','code','NO_AUTORIZADO');
 end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,731925));
 select * into p from public.partidas where id=p_partida_id and profesor_id=owner_id for update;
 if not found then return jsonb_build_object('error','Esta sala no pertenece a tu sesión.','code','NO_AUTORIZADO'); end if;
 -- Un reintento y las pestañas adicionales recuperan el reloj establecido.
 if p.estado='finalizada' or nullif(p.configuracion->>'cancelledAt','') is not null
    or nullif(p.configuracion->>'finishedAt','') is not null
    or p.configuracion#>>'{runtime,phase}' in ('finished','cancelled')
    or p.configuracion->>'phase' in ('finished','cancelled') then
  -- La configuración terminal es autoridad; corrige solamente el estado
  -- antiguo para que no bloquee la creación voluntaria de otra sala.
  if p.estado<>'finalizada' then
   update public.partidas set estado='finalizada' where id=p.id returning * into p;
  end if;
  return to_jsonb(p)||jsonb_build_object('serverTime',clock_timestamp());
 end if;
 untouched:=p.estado='esperando' and p.started_at is null
  and nullif(p.configuracion->>'gameStartedAt','') is null
  and nullif(p.configuracion#>>'{runtime,startedAt}','') is null
  and coalesce(p.configuracion#>>'{runtime,phase}','') not in ('decisions','results')
  and coalesce(p.configuracion->>'phase','') not in ('decisions','results')
  and coalesce(p.configuracion->>'round','1')='1'
  and coalesce(p.configuracion#>>'{runtime,round}','1')='1'
  and (p.configuracion->'eventSchedule' is null or p.configuracion->'eventSchedule' in ('null'::jsonb,'{}'::jsonb))
  and not exists(select 1 from public.participantes pt join public.empresas e on e.id=pt.empresa_id where pt.partida_id=p.id and e.ciclo_actual>1)
  and not exists(select 1 from public.participantes pt join public.empresas_decisiones d on d.empresa_id=pt.empresa_id where pt.partida_id=p.id)
  and not exists(select 1 from public.participantes pt join public.reportes_ciclo d on d.empresa_id=pt.empresa_id where pt.partida_id=p.id);
 if (p.configuracion->>'lifecycleVersion'='2'
    and p.configuracion->>'gameStartAt' is not null
    and p.configuracion#>>'{runtime,phase}' in ('integration','decisions','results')
    and p.configuracion#>>'{runtime,round}' ~ '^[1-9][0-9]*$') then
  cycle:=(p.configuracion#>>'{runtime,round}')::integer;
  -- Un runtime aparentemente moderno tampoco puede retroceder evidencias
  -- históricas más avanzadas ni reabrir integración con actividad existente.
  if (p.configuracion#>>'{runtime,phase}'<>'integration' or untouched)
   and (case when coalesce(p.configuracion->>'round','') ~ '^[1-9][0-9]*$'
    then (p.configuracion->>'round')::integer else cycle end)<=cycle
   and not exists(select 1 from jsonb_each(case when jsonb_typeof(p.configuracion->'eventSchedule')='object' then p.configuracion->'eventSchedule' else '{}'::jsonb end)
    where case when key ~ '^[1-9][0-9]*$' then key::integer>cycle else false end)
   and not exists(select 1 from public.participantes pt join public.empresas e on e.id=pt.empresa_id where pt.partida_id=p.id and e.ciclo_actual>cycle)
   and not exists(select 1 from public.participantes pt join public.empresas_decisiones d on d.empresa_id=pt.empresa_id where pt.partida_id=p.id and d.ciclo>cycle)
   and not exists(select 1 from public.participantes pt join public.reportes_ciclo rc on rc.empresa_id=pt.empresa_id where pt.partida_id=p.id and rc.ciclo>cycle) then
   return public.side_sync_game(p.id);
  end if;
 end if;
 c:=jsonb_build_object('lifecycleVersion',2,'cycleCloseMode','manual','cycles',3,
  'roundHours',0,'roundMinutes',5,'integrationDurationMinutes',2,'enabledEvents',p.eventos_habilitados)
  ||p.configuracion;
 -- Configuración nueva solo si nunca hubo actividad operativa.
 if untouched and p_config is not null then c:=c||p_config; end if;
 if coalesce(c->>'cycleCloseMode','') not in ('manual','automatic')
  or coalesce(c->>'cycles','') !~ '^([1-9]|1[0-9]|20)$'
  or coalesce(c->>'roundHours','') !~ '^[0-9]{1,4}$'
  or coalesce(c->>'roundMinutes','') !~ '^([0-9]|[1-5][0-9])$'
  or coalesce(c->>'integrationDurationMinutes','') !~ '^([1-9]|[1-5][0-9]|60)$' then
  return jsonb_build_object('error','Revisa los ciclos, su duración y el tiempo de espera.','code','CONFIG_INVALIDA');
 end if;
 duration:=(c->>'roundHours')::integer*3600+(c->>'roundMinutes')::integer*60;
 if duration<60 or jsonb_typeof(c->'enabledEvents') is distinct from 'array' then
  return jsonb_build_object('error','Revisa la duración y los eventos de la sala.','code','CONFIG_INVALIDA');
 end if;
 if exists(select 1 from jsonb_array_elements_text(c->'enabledEvents') selected(id)
  where not exists(select 1 from public.side_event_catalog e where e.id=selected.id))
  or not public.side_valid_event_rules(coalesce(c->'eventRules','{}')) then
  return jsonb_build_object('error','Revisa los eventos de la sala.','code','CONFIG_INVALIDA');
 end if;
 c:=c-array['cancelledAt','finishedAt'];
 if untouched then
  minutes:=(c->>'integrationDurationMinutes')::integer;
  deadline:=greatest(clock_timestamp(),case when c->>'cycleCloseMode'='automatic'
    then coalesce(nullif(c->>'scheduledStart','')::timestamptz,clock_timestamp()) else clock_timestamp() end)+make_interval(mins=>minutes);
  r:=jsonb_build_object('round',1,'phase','integration','status','waiting','running',false,
   'mode',c->>'cycleCloseMode','duration',duration,'remaining',duration);
  c:=c||jsonb_build_object('integrationStartTime',deadline-make_interval(mins=>minutes),
   'gameStartAt',deadline,'gameStartedAt',null,'integrationMinutes',0,
   'eventSchedule',case when jsonb_typeof(c->'eventSchedule')='object' then c->'eventSchedule' else '{}'::jsonb end);
 else
  -- No reconstruir un reloj automático a partir de información incompleta:
  -- conserva el ciclo y los resultados; el docente puede reanudar el reloj.
  r:=coalesce(c->'runtime','{}');
  select greatest(coalesce(max(e.ciclo_actual),1),
   coalesce((select max(rc.ciclo) from public.participantes pt join public.reportes_ciclo rc on rc.empresa_id=pt.empresa_id where pt.partida_id=p.id),1),
   coalesce((select max(d.ciclo) from public.participantes pt join public.empresas_decisiones d on d.empresa_id=pt.empresa_id where pt.partida_id=p.id),1),
   case when coalesce(r->>'round','') ~ '^[1-9][0-9]*$' then (r->>'round')::integer else 1 end,
   case when coalesce(c->>'round','') ~ '^[1-9][0-9]*$' then (c->>'round')::integer else 1 end,
   coalesce((select max(key::integer) from jsonb_each(case when jsonb_typeof(c->'eventSchedule')='object' then c->'eventSchedule' else '{}'::jsonb end)
    where key ~ '^[1-9][0-9]*$'),1))
   into cycle from public.participantes pt join public.empresas e on e.id=pt.empresa_id where pt.partida_id=p.id;
  phase:=case when coalesce(r->>'phase',c->>'phase')='results'
   or (exists(select 1 from public.participantes pt where pt.partida_id=p.id and pt.empresa_id is not null)
    and not exists(select 1 from public.participantes pt where pt.partida_id=p.id and pt.empresa_id is not null
     and not exists(select 1 from public.reportes_ciclo rc where rc.empresa_id=pt.empresa_id and rc.ciclo=cycle)))
   then 'results' else 'decisions' end;
  r:=r||jsonb_build_object('round',cycle,'phase',phase,'status',case when phase='results' then 'finished' else 'paused' end,
   'running',false,'mode','manual','duration',duration,'remaining',case when phase='results' then 0 else duration end);
  c:=c||jsonb_build_object('cycleCloseMode','manual','cycles',greatest(cycle,(c->>'cycles')::integer),
   'gameStartAt',coalesce(p.started_at,p.created_at),'gameStartedAt',coalesce(p.started_at,p.created_at));
 end if;
 c:=c||jsonb_build_object('lifecycleVersion',2,'codigo',p.codigo,'phase',r->>'phase','round',r->'round','runtime',r);
 update public.partidas set configuracion=c,eventos_habilitados=c->'enabledEvents',
  estado=case when untouched then 'esperando' else 'activa' end,
  inicio_programado=case when untouched then deadline else inicio_programado end where id=p.id;
 return public.side_sync_game(p.id);
end $$;
revoke all on function public.recuperar_sala_docente(uuid,jsonb) from public,anon;
grant execute on function public.recuperar_sala_docente(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;

```
