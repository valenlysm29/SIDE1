-- Ejecutar después de lifecycle, student_admission y 20261009_sala_espera_identidad_exacta.
-- Repetible. No modifica guardar_puntaje_docente ni funciones de Excel.
begin;
do $$ declare features jsonb; probe jsonb; begin
 if to_regprocedure('public.side_sync_game(uuid)') is null
    or to_regprocedure('public.side_admission_features()') is null then
  raise exception 'Primero aplica supabase_game_lifecycle.sql, supabase_student_admission.sql y 20261009_sala_espera_identidad_exacta.sql';
 end if;
 features:=public.side_admission_features();
 if features->>'waitingRoomVersion' is distinct from '3' or features->>'exactIdentityVersion' is distinct from '2' then
  raise exception 'Primero aplica 20261009_sala_espera_identidad_exacta.sql';
 end if;
 -- Detecta reinstalación de lifecycle después de espera, aun con feature probe viejo.
 probe:=public.side_runtime('{"lifecycleVersion":2,"cycleCloseMode":"manual","cycles":3,"roundHours":0,"roundMinutes":5,"gameStartAt":"2000-01-01T00:00:00Z","runtime":{"phase":"integration"}}'::jsonb,'2000-01-01T00:00:01Z'::timestamptz);
 if probe->>'phase' is distinct from 'decisions' then
  raise exception 'Reaplica 20261009_sala_espera_identidad_exacta.sql después de lifecycle; falta inicio manual automático';
 end if;
end $$;
alter table public.partidas add column if not exists creation_request_id uuid;
create unique index if not exists ux_side_creation_request on public.partidas(profesor_id,creation_request_id) where creation_request_id is not null;

create or replace function public.obtener_sala_docente()
returns jsonb language plpgsql security definer set search_path=public as $$
declare owner_id uuid:=auth.uid(); game_id uuid; result jsonb;
begin
 if owner_id is null then return jsonb_build_object('error','Debes iniciar sesión como docente.','code','NO_AUTORIZADO'); end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,731925));
 -- Sincronizar primero evita considerar activa una sala automática ya finalizada.
 for game_id in select id from public.partidas where profesor_id=owner_id and estado in ('esperando','activa') order by (estado='activa') desc,created_at loop
  result:=public.side_sync_game(game_id);
  if result->>'estado' in ('esperando','activa') then return result; end if;
 end loop;
 return null;
end $$;

create or replace function public.crear_sala_docente(
 p_config jsonb,p_nombre text,p_curso text,p_segmento text,p_request_id uuid,p_reemplazar_id uuid default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare owner_id uuid:=auth.uid(); previous jsonb; game public.partidas; attempt integer; failed_constraint text;
begin
 if owner_id is null or not exists(select 1 from public.profesores where id=owner_id) then
  return jsonb_build_object('error','Debes iniciar sesión con un perfil docente válido.','code','NO_AUTORIZADO');
 end if;
 if p_request_id is null or coalesce(trim(p_nombre),'')='' or p_config->>'lifecycleVersion' is distinct from '2' then
  return jsonb_build_object('error','La solicitud de creación es inválida. Revisa la configuración.','code','CONFIG_INVALIDA');
 end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,731925));
 -- Un reintento con respuesta perdida siempre recupera la misma fila.
 select * into game from public.partidas where profesor_id=owner_id and creation_request_id=p_request_id;
 if found then return public.side_sync_game(game.id); end if;
 previous:=public.obtener_sala_docente();
 if previous is not null then
  if p_reemplazar_id is null or (previous->>'id')::uuid<>p_reemplazar_id then
   return jsonb_build_object('error','Ya tienes una sala en espera o en curso. Reanúdala o ciérrala antes de crear otra.','code','SALA_ACTIVA','partida',previous);
  end if;
  -- Solo la sala exacta confirmada; nunca cierra otra sala que apareció entretanto.
  update public.partidas set estado='finalizada',configuracion=configuracion||jsonb_build_object(
   'cancelledAt',clock_timestamp(),'phase','cancelled','runtime',coalesce(configuracion->'runtime','{}')||
   jsonb_build_object('phase','cancelled','status','simulation-finished','running',false,'remaining',0)
  ) where id=p_reemplazar_id and profesor_id=owner_id;
  previous:=public.obtener_sala_docente();
  if previous is not null then
   return jsonb_build_object('error','Hay otra sala anterior pendiente. Reanúdala o ciérrala.','code','SALA_ACTIVA','partida',previous);
  end if;
 elsif p_reemplazar_id is not null and not exists(select 1 from public.partidas where id=p_reemplazar_id and profesor_id=owner_id) then
  return jsonb_build_object('error','La sala anterior no pertenece a tu sesión. Recarga el panel.','code','NO_AUTORIZADO');
 end if;
 for attempt in 1..3 loop
  begin
   insert into public.partidas(profesor_id,nombre,curso,segmento,configuracion,eventos_habilitados,creation_request_id)
   values(owner_id,trim(p_nombre),nullif(trim(p_curso),''),coalesce(nullif(p_segmento,''),'Estandar'),
    p_config-array['cancelledAt','finishedAt','runtime','phase','gameStartAt','gameStartedAt','integrationStartTime','eventSchedule'],
    coalesce(p_config->'enabledEvents','[]'),p_request_id) returning * into game;
   return public.side_sync_game(game.id);
  exception when unique_violation then
   get stacked diagnostics failed_constraint=constraint_name;
   -- Reintenta solamente una colisión de código; otros conflictos se preservan.
   if failed_constraint not in ('partidas_codigo_key','ux_side_codigo_partida') or attempt=3 then raise; end if;
  end;
 end loop;
 return null;
end $$;
revoke all on function public.obtener_sala_docente() from public,anon;
revoke all on function public.crear_sala_docente(jsonb,text,text,text,uuid,uuid) from public,anon;
grant execute on function public.obtener_sala_docente() to authenticated;
grant execute on function public.crear_sala_docente(jsonb,text,text,text,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
