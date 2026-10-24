-- Manual, después de cierre_planes_v19. No ejecutado en producción.
-- Reversión: DROP FUNCTION IF EXISTS public.side_guardar_configuracion_v19(uuid,jsonb,bigint);
-- DROP TRIGGER IF EXISTS side_config_revision_v19 ON public.partidas;
-- Conservar config_revision para auditoría; no revierte configuraciones guardadas.
begin;
alter table public.partidas add column if not exists config_revision bigint not null default 0;
create or replace function public.side_config_revision_v19()
returns trigger language plpgsql set search_path=public as $$
declare ignored text[]:=array['runtime','phase','round','eventSchedule','gameStartedAt','gameStartAt','integrationStartTime','integrationMinutes','cancelledAt'];
begin
 -- Polling y lifecycle cambian relojes/eventos resueltos, no la configuración
 -- editable. Comparación JSONB: el orden de claves no genera falsas revisiones.
 if (coalesce(new.configuracion,'{}')-ignored) is distinct from (coalesce(old.configuracion,'{}')-ignored) then
  new.config_revision:=old.config_revision+1;
 else new.config_revision:=old.config_revision;
 end if;
 return new;
end $$;
drop trigger if exists side_config_revision_v19 on public.partidas;
create trigger side_config_revision_v19 before update on public.partidas
 for each row execute function public.side_config_revision_v19();

create or replace function public.side_guardar_configuracion_v19(p_partida_id uuid,p_config jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare game public.partidas; result jsonb;
begin
 select * into game from public.partidas where id=p_partida_id and profesor_id=auth.uid() for update;
 if game.id is null then return jsonb_build_object('error','No tienes permiso para modificar esta partida','code','NO_AUTORIZADO'); end if;
 if p_expected_revision is null or p_expected_revision<0 or p_expected_revision<>game.config_revision then
  return jsonb_build_object('error','La configuración cambió en otra sesión. Recarga la configuración antes de volver a guardar. Tus cambios no se enviaron.','code','CONFIG_DESACTUALIZADA','config_revision',game.config_revision);
 end if;
 if jsonb_typeof(p_config) is distinct from 'object' or octet_length(p_config::text)>1048576 then
  return jsonb_build_object('error','Configuración inválida','code','CONFIG_INVALIDA');
 end if;
 -- Reutiliza autorización, whitelist y validación de eventos/finanzas vigentes;
 -- nunca acepta runtime arbitrario del navegador ni amplía permisos alumno.
 result:=public.controlar_partida(p_partida_id,'guardar',p_config,null);
 if result ? 'error' then return result; end if;
 select * into game from public.partidas where id=p_partida_id;
 return to_jsonb(game)||jsonb_build_object('serverTime',clock_timestamp());
end $$;
revoke all on function public.side_guardar_configuracion_v19(uuid,jsonb,bigint) from public,anon;
grant execute on function public.side_guardar_configuracion_v19(uuid,jsonb,bigint) to authenticated;
commit;
