-- REVERSIÓN MANUAL de la entrega del 20/10; NO ejecutada por Codex en producción.
-- Ejecutar con respaldo y partidas detenidas, justo ANTES del push de la web revertida.
-- Conserva cuentas, partidas, resultados y las mejoras de expulsión/pausa del 21/10.
-- Las columnas/tablas históricas se conservan; se desactivan sus reglas del 20/10.
begin;
drop trigger if exists side_validar_correo_docente on auth.users;
drop trigger if exists side_validar_correo_perfil on public.profesores;
drop trigger if exists side_fijar_motor_partida on public.partidas;
do $$
declare par text[]; definicion text;
begin
 foreach par slice 1 in array array[
 ['ingresar_empresa_original_20261020','ingresar_empresa'],
 ['resolver_original_20261020','side_resolver_identidad_empresa'],
 ['podio_original_20261020','side_podio_estudiante']
 ] loop
  if to_regprocedure('side_private.'||par[1]||'(text,text,text)') is not null then
   definicion:=pg_get_functiondef(('side_private.'||par[1]||'(text,text,text)')::regprocedure);
   execute replace(definicion,'FUNCTION side_private.'||par[1]||'(','FUNCTION public.'||par[2]||'(');
  end if;
 end loop;
end $$;
grant execute on function public.ingresar_empresa(text,text,text) to anon,authenticated;
-- Aplicar después de supabase_student_admission.sql y las migraciones de ciclo.
-- No ejecutado por Codex. Reutiliza JSON y RLS; no modifica notas docentes.

create table if not exists public.side_excel_cierres (
  partida_id uuid not null references public.partidas(id) on delete cascade,
  ciclo integer not null check(ciclo>0), cierre jsonb not null,
  created_at timestamptz not null default now(), primary key(partida_id,ciclo)
);
alter table public.side_excel_cierres enable row level security;
revoke all on public.side_excel_cierres from public,anon,authenticated;
create or replace function public.side_excel_features() returns jsonb language sql stable as $$select jsonb_build_object('cierreVersion',1)$$;
grant execute on function public.side_excel_features() to anon,authenticated;

create or replace function public.side_contexto_cierre_excel(p_partida_id uuid,p_ciclo integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.partidas; empresas jsonb; historia jsonb; previo jsonb; token text;
begin
 select * into p from public.partidas where id=p_partida_id and profesor_id=auth.uid();
 if p.id is null then return jsonb_build_object('error','Partida no autorizada','code','NO_AUTORIZADO'); end if;
 if p_ciclo is null or p_ciclo<1 then return jsonb_build_object('error','Ciclo inválido'); end if;
 select cierre into previo from public.side_excel_cierres where partida_id=p.id and ciclo=p_ciclo;
 if previo is not null then return jsonb_build_object('cierre',previo); end if;
 if p_ciclo>public.side_ciclo_actual(p.configuracion) then return jsonb_build_object('error','El ciclo cambió','code','CICLO_DESACTUALIZADO'); end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id::text,'capital',e.caja_inicial,'revision',s.revision,'envelope',s.snapshot#>'{decision_state,__excel}') order by e.id),'[]')
 into empresas from public.empresas e join public.participantes t on t.empresa_id=e.id
 join public.side_student_state s on s.empresa_id=e.id
 where t.partida_id=p.id and s.snapshot#>>'{decision_state,__excel,habilitado}'='true'
 and (case when s.snapshot#>>'{decision_state,__excel,cicloActivacion}' ~ '^[0-9]{1,8}$' then (s.snapshot#>>'{decision_state,__excel,cicloActivacion}')::integer else 1 end)<=p_ciclo;
 select coalesce(cierre->'historialPorEmpresa','{}') into historia from public.side_excel_cierres where partida_id=p.id and ciclo<p_ciclo order by ciclo desc limit 1;
 historia:=coalesce(historia,'{}');token:=md5(empresas::text||historia::text||p_ciclo::text||p.configuracion::text);
 return jsonb_build_object('empresas',empresas,'historialPorEmpresa',historia,'token',token,'overrides',coalesce(p.configuracion->'excelParametros','{}'));
end $$;

create or replace function public.side_guardar_cierre_excel(p_partida_id uuid,p_ciclo integer,p_token text,p_cierre jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.partidas; ctx jsonb; previo jsonb; emp jsonb; resultado jsonb; id_empresa bigint; fin jsonb;
begin
 select * into p from public.partidas where id=p_partida_id and profesor_id=auth.uid() for update;
 if p.id is null then return jsonb_build_object('error','Partida no autorizada','code','NO_AUTORIZADO'); end if;
 select cierre into previo from public.side_excel_cierres where partida_id=p.id and ciclo=p_ciclo;
 if previo is not null then return jsonb_build_object('cierre',previo,'reused',true); end if;
 -- Lock también snapshots de nuevas empresas: no solo las incluidas en el token.
 perform s.empresa_id from public.side_student_state s join public.participantes t on t.empresa_id=s.empresa_id where t.partida_id=p.id order by s.empresa_id for update of s;
 ctx:=public.side_contexto_cierre_excel(p.id,p_ciclo);
 if ctx ? 'error' then return ctx; end if;
 if ctx->>'token' is distinct from p_token then return jsonb_build_object('error','Las decisiones cambiaron. Vuelve a cerrar el ciclo.','code','ESTADO_DESACTUALIZADO'); end if;
 if jsonb_typeof(p_cierre->'resultadosPorEmpresa') is distinct from 'object' or (p_cierre->>'ciclo')::integer<>p_ciclo or octet_length(p_cierre::text)>10485760 then return jsonb_build_object('error','Cierre inválido'); end if;
 if exists(select 1 from jsonb_object_keys(p_cierre->'resultadosPorEmpresa') x(id) where not exists(select 1 from jsonb_array_elements(ctx->'empresas') y where y->>'id'=x.id)) then return jsonb_build_object('error','Empresa ajena al cierre'); end if;
 insert into public.side_excel_cierres(partida_id,ciclo,cierre) values(p.id,p_ciclo,p_cierre);
 for emp in select * from jsonb_array_elements(ctx->'empresas') loop
  id_empresa:=(emp->>'id')::bigint;resultado:=p_cierre->'resultadosPorEmpresa'->(id_empresa::text);
  if resultado is not null then
   fin:=resultado->'financial';
   insert into public.reportes_ciclo(empresa_id,ciclo,capital,ingresos,costos,utilidad,caja_final,balance_caja,flujo_caja,estado_resultados)
   values(id_empresa,p_ciclo,(emp->>'capital')::numeric,(fin#>>'{estadoResultados,ingresos}')::numeric,(fin#>>'{estadoResultados,costos}')::numeric,(fin#>>'{estadoResultados,utilidad}')::numeric,(fin#>>'{balanceCaja,cajaFinal}')::numeric,fin->'balanceCaja',fin->'flujoCaja',(fin->'estadoResultados')||jsonb_build_object('excel',resultado))
   on conflict(empresa_id,ciclo) do update set ingresos=excluded.ingresos,costos=excluded.costos,utilidad=excluded.utilidad,caja_final=excluded.caja_final,balance_caja=excluded.balance_caja,flujo_caja=excluded.flujo_caja,estado_resultados=excluded.estado_resultados;
   update public.empresas set caja_actual=(fin#>>'{balanceCaja,cajaFinal}')::numeric where id=id_empresa;
  end if;
  -- Se conserva dentro de decision_state para la lista blanca existente del snapshot.
  update public.side_student_state set snapshot=jsonb_set(snapshot,'{decision_state,__excel}',coalesce(snapshot#>'{decision_state,__excel}','{}')||jsonb_build_object('resultado',resultado,'historial',p_cierre->'historialPorEmpresa'->id_empresa::text,'eliminada',p_cierre->'eliminadas' ? id_empresa::text)),revision=revision+1,updated_at=clock_timestamp() where empresa_id=id_empresa;
 end loop;
 return jsonb_build_object('cierre',p_cierre,'reused',false);
end $$;
revoke all on function public.side_contexto_cierre_excel(uuid,integer) from public,anon;
revoke all on function public.side_guardar_cierre_excel(uuid,integer,text,jsonb) from public,anon;
grant execute on function public.side_contexto_cierre_excel(uuid,integer) to authenticated;
grant execute on function public.side_guardar_cierre_excel(uuid,integer,text,jsonb) to authenticated;

-- Un snapshot atrasado o un reporte de alumno no puede sustituir resultados
-- aprobados por el docente ni reabrir decisiones de ciclos ya cerrados.
create or replace function public.side_preservar_cierre_excel_snapshot()
returns trigger language plpgsql security definer set search_path=public as $$
declare c jsonb; s jsonb; planes jsonb; fila record;
begin
 select x.cierre into c from public.side_excel_cierres x join public.participantes t on t.partida_id=x.partida_id where t.empresa_id=new.empresa_id and (x.cierre->'resultadosPorEmpresa' ? new.empresa_id::text or x.cierre->'eliminadas' ? new.empresa_id::text) order by x.ciclo desc limit 1;
 if c is null then return new; end if;
 s:=coalesce(new.snapshot#>'{decision_state,__excel}','{}');planes:=coalesce(s->'planesPorCiclo','{}');
 for fila in select x.ciclo,x.cierre->'resultadosPorEmpresa'->new.empresa_id::text as r from public.side_excel_cierres x join public.participantes t on t.partida_id=x.partida_id where t.empresa_id=new.empresa_id order by x.ciclo loop
  if fila.r is not null then planes:=jsonb_set(planes,array[fila.ciclo::text],fila.r->'decisiones');end if;
 end loop;
 s:=s||jsonb_build_object('habilitado',true,'resultado',c->'resultadosPorEmpresa'->new.empresa_id::text,'historial',c->'historialPorEmpresa'->new.empresa_id::text,'planesPorCiclo',planes,'eliminada',c->'eliminadas' ? new.empresa_id::text);
 new.snapshot:=jsonb_set(new.snapshot,'{decision_state}',coalesce(new.snapshot->'decision_state','{}')||jsonb_build_object('__excel',s));return new;
end $$;
drop trigger if exists side_excel_snapshot_protegido on public.side_student_state;
create trigger side_excel_snapshot_protegido before update on public.side_student_state for each row execute function public.side_preservar_cierre_excel_snapshot();

create or replace function public.side_preservar_reporte_excel()
returns trigger language plpgsql security definer set search_path=public as $$
declare r jsonb;f jsonb;
begin
 select x.cierre->'resultadosPorEmpresa'->new.empresa_id::text into r from public.side_excel_cierres x join public.participantes t on t.partida_id=x.partida_id where t.empresa_id=new.empresa_id and x.ciclo=new.ciclo limit 1;
 if r is null then return new;end if;f:=r->'financial';
 new.ingresos:=(f#>>'{estadoResultados,ingresos}')::numeric;new.costos:=(f#>>'{estadoResultados,costos}')::numeric;new.utilidad:=(f#>>'{estadoResultados,utilidad}')::numeric;new.caja_final:=(f#>>'{balanceCaja,cajaFinal}')::numeric;new.balance_caja:=f->'balanceCaja';new.flujo_caja:=f->'flujoCaja';new.estado_resultados:=(f->'estadoResultados')||jsonb_build_object('excel',r);return new;
end $$;
drop trigger if exists side_excel_reporte_protegido on public.reportes_ciclo;
create trigger side_excel_reporte_protegido before insert or update on public.reportes_ciclo for each row execute function public.side_preservar_reporte_excel();

-- Actualiza únicamente los respaldos de funciones modificadas por el 20/10.
-- Los wrappers posteriores ya instalados conservan su cadena sin recursión.
do $$
declare par text[]; definicion text;
begin
 foreach par slice 1 in array array[
 ['side_podio_estudiante','side_podio_estudiante_antes_expulsion_20261021','text,text,text'],
 ['side_contexto_cierre_excel','contexto_antes_expulsion_20261021','uuid,integer'],
 ['side_resolver_identidad_empresa','resolver_antes_expulsion_20261021','text,text,text']
 ] loop
  definicion:=pg_get_functiondef(('public.'||par[1]||'('||par[3]||')')::regprocedure);
  execute replace(definicion,'FUNCTION public.'||par[1]||'(','FUNCTION side_private.'||par[2]||'(');
 end loop;
end $$;
-- Aplicar sobre las migraciones de identidad, códigos, cierre Excel y podio
-- publicadas hasta 2026-10-12. No requiere las correcciones revertidas del 20/10.
-- Expulsión persistente por partida. Conserva empresa, decisiones y resultados.

create schema if not exists side_private;
revoke all on schema side_private from public,anon,authenticated;
do $$
declare definicion text;
begin
 if to_regprocedure('public.side_resolver_identidad_empresa(text,text,text)') is null
  or to_regprocedure('public.side_normalizar_codigo_sala(text)') is null
  or to_regprocedure('public.side_contexto_cierre_excel(uuid,integer)') is null
  or to_regprocedure('public.side_podio_estudiante(text,text,text)') is null then
  raise exception 'Aplica primero las migraciones de identidad exacta, códigos de sala, cierre Excel y podio hasta 2026-10-12';
 end if;
 -- Copia la resolución exacta de la base sin reintroducir el limitador retirado.
 if to_regprocedure('side_private.resolver_antes_expulsion_20261021(text,text,text)') is null then
  definicion:=pg_get_functiondef('public.side_resolver_identidad_empresa(text,text,text)'::regprocedure);
  execute replace(definicion,'FUNCTION public.side_resolver_identidad_empresa(','FUNCTION side_private.resolver_antes_expulsion_20261021(');
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
 select * into identidad from side_private.resolver_antes_expulsion_20261021(public.side_normalizar_codigo_sala(p_codigo),p_nombre_legal,p_nombre_comercial);
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
-- Ejecutar después de 2026-10-21_expulsion_empresa.sql. No modifica el motor.
-- Compatible con la base anterior al 20/10 y la expulsión adaptada del 21/10.
-- Congela escrituras del estudiante durante una pausa; lecturas/heartbeat siguen activos.

do $$ begin
 if to_regprocedure('side_private.comprobar_expulsion(text,text,text)') is null then
  raise exception 'Aplica primero 2026-10-21_expulsion_empresa.sql';
 end if;
end $$;
create or replace function side_private.comprobar_pausa(p_codigo text,p_nombre_legal text,p_nombre_comercial text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare identidad record; configuracion jsonb; partida_id uuid; rechazo jsonb;
begin
 rechazo:=side_private.comprobar_expulsion(p_codigo,p_nombre_legal,p_nombre_comercial);
 if rechazo is not null then return rechazo; end if;
 select * into identidad from side_private.resolver_antes_expulsion_20261021(public.side_normalizar_codigo_sala(p_codigo),p_nombre_legal,p_nombre_comercial);
 if identidad.participante_id is null then return null; end if;
 select t.partida_id into partida_id from public.participantes t where t.id=identidad.participante_id;
 select p.configuracion into configuracion from public.partidas p where p.id=partida_id for update;
 if configuracion#>>'{runtime,status}'='paused' then
  return jsonb_build_object('success',false,'code','CICLO_PAUSADO','error','Ciclo en pausa. Puedes preparar tus decisiones; guarda y envía cuando el docente reanude.');
 end if;
 return null;
end $$;
do $$
declare firma text; funcion regprocedure; nombre text; respaldo text; definicion text; argumentos text; llamada text;
begin
 foreach firma in array array[
  'guardar_estado_estudiante(text,text,text,jsonb,bigint)',
  'guardar_decisiones_estudiante(text,text,text,integer,jsonb,bigint)',
  'guardar_reporte_estudiante(text,text,text,integer,jsonb,bigint)'
 ] loop
  funcion:=('public.'||firma)::regprocedure;
  select proname,pg_get_function_arguments(oid),array_to_string(proargnames,',') into nombre,argumentos,llamada from pg_proc where oid=funcion;
  respaldo:=nombre||'_antes_pausa_20261021';
  if to_regprocedure('side_private.'||replace(firma,nombre,respaldo)) is null then
   definicion:=pg_get_functiondef(funcion);
   execute replace(definicion,'FUNCTION public.'||nombre||'(','FUNCTION side_private.'||respaldo||'(');
  end if;
  execute format('CREATE OR REPLACE FUNCTION public.%I(%s) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $guard$ DECLARE rechazo jsonb; BEGIN rechazo:=side_private.comprobar_pausa(p_codigo,p_nombre_legal,p_nombre_comercial); IF rechazo IS NOT NULL THEN RETURN rechazo; END IF; RETURN side_private.%I(%s); END; $guard$',nombre,argumentos,respaldo,llamada);
  execute 'REVOKE ALL ON FUNCTION public.'||firma||' FROM public';
  execute 'GRANT EXECUTE ON FUNCTION public.'||firma||' TO anon,authenticated';
 end loop;
end $$;
revoke all on function side_private.comprobar_pausa(text,text,text) from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
