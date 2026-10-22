-- Ejecutar después de 2026-10-21_expulsion_empresa.sql. No modifica el motor.
-- Congela escrituras del estudiante durante una pausa; lecturas/heartbeat siguen activos.
begin;
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
 if side_private.ingreso_bloqueado(side_private.clave_ingreso(p_codigo)) then return null; end if;
 select * into identidad from side_private.resolver_original_20261020(public.side_normalizar_codigo_sala(p_codigo),p_nombre_legal,p_nombre_comercial);
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
commit;
