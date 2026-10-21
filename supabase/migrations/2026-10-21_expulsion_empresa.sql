-- Aplicar DESPUÉS de 2026-10-20_correcciones_docente_estudiante.sql.
-- Expulsión persistente por partida. Conserva empresa, decisiones y resultados.
begin;
do $$ begin
 if to_regprocedure('side_private.resolver_original_20261020(text,text,text)') is null then
  raise exception 'Aplica primero 2026-10-20_correcciones_docente_estudiante.sql';
 end if;
end $$;

alter table public.participantes add column if not exists expulsada_at timestamptz;
create index if not exists idx_side_participantes_activos on public.participantes(partida_id) where expulsada_at is null;

create or replace function public.side_expulsar_empresa(p_partida_id uuid,p_empresa_id bigint,p_expulsar boolean default true)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare partida public.partidas; participante public.participantes;
begin
 select * into partida from public.partidas where id=p_partida_id and profesor_id=auth.uid() for update;
 if partida.id is null then return jsonb_build_object('success',false,'code','NO_AUTORIZADO','error','Solo el profesor de la partida puede eliminar o reactivar empresas.'); end if;
 if partida.estado in ('finalizada','cancelada') or public.side_config_cancelada(partida.configuracion) then
  return jsonb_build_object('success',false,'code','PARTIDA_TERMINADA','error','La partida ya terminó. No se puede cambiar la participación.');
 end if;
 if p_expulsar is null then return jsonb_build_object('success',false,'error','Indica si deseas eliminar o reactivar la empresa.'); end if;
 update public.participantes set expulsada_at=case when p_expulsar then coalesce(expulsada_at,clock_timestamp()) else null end
 where partida_id=p_partida_id and empresa_id=p_empresa_id returning * into participante;
 if participante.id is null then return jsonb_build_object('success',false,'code','EMPRESA_AJENA','error','La empresa no pertenece a esta partida.'); end if;
 return jsonb_build_object('success',true,'empresa_id',participante.empresa_id,'expulsada_at',participante.expulsada_at);
end $$;
revoke all on function public.side_expulsar_empresa(uuid,bigint,boolean) from public,anon;
grant execute on function public.side_expulsar_empresa(uuid,bigint,boolean) to authenticated;

-- Un mismo orden de bloqueo (partida antes de participante y snapshots) evita
-- que una escritura o un reingreso atrasado deshagan la expulsión confirmada.
create or replace function side_private.comprobar_expulsion(p_codigo text,p_nombre_legal text,p_nombre_comercial text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare identidad record; partida_id uuid; expulsada timestamptz;
begin
 -- El limitador de intentos existente sigue resolviendo los rechazos genéricos.
 if side_private.ingreso_bloqueado(side_private.clave_ingreso(p_codigo)) then return null; end if;
 select * into identidad from side_private.resolver_original_20261020(public.side_normalizar_codigo_sala(p_codigo),p_nombre_legal,p_nombre_comercial);
 if identidad.participante_id is null then return null; end if;
 select t.partida_id into partida_id from public.participantes t where t.id=identidad.participante_id;
 perform 1 from public.partidas p where p.id=partida_id for update;
 select t.expulsada_at into expulsada from public.participantes t where t.id=identidad.participante_id for update;
 if expulsada is not null then
  return jsonb_build_object('success',false,'code','EMPRESA_EXPULSADA','error','Tu empresa fue eliminada de la partida por inactividad. Contacta a tu profesor si necesitas volver a participar.');
 end if;
 return null;
end $$;

-- Copia privada una sola vez y guarda las firmas existentes, incluidas las
-- revisiones CAS. Reejecutar esta migración no crea wrappers recursivos.
do $$
declare firma text; funcion regprocedure; nombre text; respaldo text; definicion text; argumentos text; llamada text;
begin
 foreach firma in array array[
  'unirse_partida_por_codigo(text,text,text)',
  'obtener_estado_estudiante(text,text,text)',
  'guardar_estado_estudiante(text,text,text,jsonb,bigint)',
  'guardar_decisiones_estudiante(text,text,text,integer,jsonb,bigint)',
  'guardar_reporte_estudiante(text,text,text,integer,jsonb,bigint)',
  'side_podio_estudiante(text,text,text)'
 ] loop
  funcion:=('public.'||firma)::regprocedure;
  select proname,pg_get_function_arguments(oid),array_to_string(proargnames,',') into nombre,argumentos,llamada from pg_proc where oid=funcion;
  respaldo:=nombre||'_antes_expulsion_20261021';
  if to_regprocedure('side_private.'||replace(firma,nombre,respaldo)) is null then
   definicion:=pg_get_functiondef(funcion);
   execute replace(definicion,'FUNCTION public.'||nombre||'(','FUNCTION side_private.'||respaldo||'(');
  end if;
  execute format('CREATE OR REPLACE FUNCTION public.%I(%s) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $guard$ DECLARE rechazo jsonb; BEGIN rechazo:=side_private.comprobar_expulsion(p_codigo,p_nombre_legal,p_nombre_comercial); IF rechazo IS NOT NULL THEN RETURN rechazo; END IF; RETURN side_private.%I(%s); END; $guard$',nombre,argumentos,respaldo,llamada);
  execute 'REVOKE ALL ON FUNCTION public.'||firma||' FROM public';
  execute 'GRANT EXECUTE ON FUNCTION public.'||firma||' TO anon,authenticated';
 end loop;
end $$;

-- El contador de la sala sólo incluye las empresas que siguen participando.
do $$ declare definicion text; begin
 if to_regprocedure('side_private.respuesta_antes_expulsion_20261021(uuid,boolean)') is null then
  definicion:=pg_get_functiondef('public.side_respuesta_ingreso(uuid,boolean)'::regprocedure);
  execute replace(definicion,'FUNCTION public.side_respuesta_ingreso(','FUNCTION side_private.respuesta_antes_expulsion_20261021(');
 end if;
 if to_regprocedure('side_private.contexto_antes_expulsion_20261021(uuid,integer)') is null then
  definicion:=pg_get_functiondef('public.side_contexto_cierre_excel(uuid,integer)'::regprocedure);
  execute replace(definicion,'FUNCTION public.side_contexto_cierre_excel(','FUNCTION side_private.contexto_antes_expulsion_20261021(');
 end if;
end $$;
create or replace function public.side_respuesta_ingreso(p_participante_id uuid,p_reingreso boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare respuesta jsonb; total bigint;
begin
 respuesta:=side_private.respuesta_antes_expulsion_20261021(p_participante_id,p_reingreso);
 select count(distinct t.empresa_id) into total from public.participantes t
 where t.partida_id=(respuesta#>>'{partida,id}')::uuid and t.empresa_id is not null and t.expulsada_at is null;
 return respuesta||jsonb_build_object('empresas_unidas',total);
end $$;
revoke all on function public.side_respuesta_ingreso(uuid,boolean) from public,anon,authenticated;

create or replace function public.side_contexto_cierre_excel(p_partida_id uuid,p_ciclo integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare contexto jsonb; empresas jsonb;
begin
 contexto:=side_private.contexto_antes_expulsion_20261021(p_partida_id,p_ciclo);
 if contexto ? 'error' or contexto ? 'cierre' then return contexto; end if;
 select coalesce(jsonb_agg(e.item order by e.orden),'[]') into empresas
 from jsonb_array_elements(contexto->'empresas') with ordinality e(item,orden)
 where exists(select 1 from public.participantes t where t.partida_id=p_partida_id and t.empresa_id::text=e.item->>'id' and t.expulsada_at is null);
 -- Invalida un cierre preparado antes de eliminar/reactivar una empresa.
 return contexto||jsonb_build_object('empresas',empresas,'token',md5((contexto->>'token')||empresas::text));
end $$;
revoke all on function public.side_contexto_cierre_excel(uuid,integer) from public,anon;
grant execute on function public.side_contexto_cierre_excel(uuid,integer) to authenticated;

-- Las expulsadas conservan sus notas en el historial, pero no compiten en
-- nuevas publicaciones del podio. Se conserva la programación y vencimiento.
create or replace function public.side_podio_docente(p_partida_id uuid,p_accion text default 'consultar',p_minutos integer default 0,p_justificacion text default '')
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare partida public.partidas; publicacion public.podios_publicados; podio jsonb; ahora timestamptz:=now();
begin
 select * into partida from public.partidas where id=p_partida_id and profesor_id=auth.uid() for update;
 if not found then return jsonb_build_object('error','No tienes permiso para publicar en esta partida.'); end if;
 if p_accion is null or p_accion not in ('consultar','publicar','cancelar') then return jsonb_build_object('error','Acción inválida.'); end if;
 if p_accion='cancelar' then
  delete from public.podios_publicados where partida_id=p_partida_id and publicar_en>ahora;
 elsif p_accion='publicar' then
  if p_minutos is null or p_minutos<0 or p_minutos>4320 then return jsonb_build_object('error','Elige Ahora o entre 1 minuto y 72 horas.'); end if;
  if not exists(select 1 from public.participantes where partida_id=p_partida_id and expulsada_at is null)
   or exists(select 1 from public.participantes where partida_id=p_partida_id and expulsada_at is null and (puntaje_docente is null or puntaje_docente<0 or puntaje_docente>20)) then
   return jsonb_build_object('error','Califica a todas las empresas participantes antes de publicar.');
  end if;
  select jsonb_agg(x.item order by x.n) into podio from (
   select jsonb_build_object('empresa',coalesce(e.nombre_comercial,e.nombre_legal),'empresaId',e.id,'grade',t.puntaje_docente) item,
    row_number() over(order by t.puntaje_docente desc,coalesce(e.nombre_comercial,e.nombre_legal) collate "es-x-icu",e.id) n
   from public.participantes t join public.empresas e on e.id=t.empresa_id
   where t.partida_id=p_partida_id and t.expulsada_at is null order by n limit 3
  ) x;
  insert into public.podios_publicados(partida_id,publicar_en,justificacion,podio,actualizado_en)
  values(p_partida_id,ahora+make_interval(mins=>p_minutos),coalesce(p_justificacion,''),podio,ahora)
  on conflict(partida_id) do update set publicar_en=excluded.publicar_en,justificacion=excluded.justificacion,podio=excluded.podio,actualizado_en=excluded.actualizado_en;
 end if;
 select * into publicacion from public.podios_publicados where partida_id=p_partida_id;
 return jsonb_build_object('success',true,'serverTime',ahora,'publication',case when publicacion.partida_id is null then null else
  jsonb_build_object('code',partida.codigo,'publishedAt',publicacion.publicar_en,'expiresAt',publicacion.publicar_en+interval '24 hours','reason',publicacion.justificacion,'podium',publicacion.podio,'winner',publicacion.podio->0->>'empresa','scheduled',ahora<publicacion.publicar_en,'visible',ahora>=publicacion.publicar_en and ahora<publicacion.publicar_en+interval '24 hours') end);
end $$;
revoke all on function public.side_podio_docente(uuid,text,integer,text) from public,anon;
grant execute on function public.side_podio_docente(uuid,text,integer,text) to authenticated;

revoke all on all functions in schema side_private from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
