-- Solo lectura. Ejecutar en SQL Editor para comparar instalación con contrato esperado.
-- No invoca RPCs de negocio ni modifica datos.
select n.nspname as esquema,p.proname as funcion,
       pg_get_function_identity_arguments(p.oid) as firma,
       pg_get_function_result(p.oid) as retorno,
       p.prosecdef as security_definer,p.proconfig as opciones,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('crear_sala_docente','obtener_sala_docente','controlar_partida','side_admission_features',
  'side_game_features','side_excel_features','side_sync_game','side_initialize_game','side_next_game_code')
order by p.proname,firma;

select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name in ('partidas','participantes')
  and column_name in ('id','profesor_id','codigo','estado','configuracion','eventos_habilitados',
                      'creation_request_id','last_seen_at')
order by table_name,ordinal_position;

select tab.relname as tabla,con.conname as restriccion,con.contype as tipo,
       pg_get_constraintdef(con.oid) as definicion
from pg_constraint con join pg_class tab on tab.oid=con.conrelid
join pg_namespace ns on ns.oid=tab.relnamespace
where ns.nspname='public' and tab.relname='partidas'
order by con.conname;

select tablename,indexname,indexdef from pg_indexes
where schemaname='public' and tablename='partidas' order by indexname;

select tab.relname as tabla,t.tgname as trigger,t.tgenabled as habilitado,
       pg_get_triggerdef(t.oid) as definicion
from pg_trigger t join pg_class tab on tab.oid=t.tgrelid
join pg_namespace ns on ns.oid=tab.relnamespace
where ns.nspname='public' and tab.relname in ('partidas','side_student_state','reportes_ciclo')
  and not t.tgisinternal order by tabla,trigger;

select tab.relname as tabla,tab.relrowsecurity as rls_activado,
       tab.relforcerowsecurity as rls_forzado
from pg_class tab join pg_namespace ns on ns.oid=tab.relnamespace
where ns.nspname='public' and tab.relname='partidas';
select tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname='public' and tablename='partidas'
order by policyname;

-- Verificación final de firmas exactas (resultado esperado: todos true salvo Excel opcional).
select
 to_regprocedure('public.crear_sala_docente(jsonb,text,text,text,uuid,uuid)') is not null as crear_sala_instalada,
 to_regprocedure('public.obtener_sala_docente()') is not null as recuperar_sala_instalada,
 to_regprocedure('public.controlar_partida(uuid,text,jsonb,integer)') is not null as lifecycle_instalado,
 to_regprocedure('public.side_admission_features()') is not null as admision_instalada,
 to_regprocedure('public.side_excel_features()') is not null as excel_opcional_instalado;
