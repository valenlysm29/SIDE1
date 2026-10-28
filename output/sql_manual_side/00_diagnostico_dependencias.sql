-- SOLO LECTURA: dependencias del paquete; no muestra datos de usuarios.
select x.firma, to_regprocedure(x.firma) is not null as existe
from (values ('public.side_contexto_cierre_negocio(uuid,integer)'),('public.side_guardar_cierre_negocio(uuid,integer,text,jsonb)'),('public.ingresar_empresa(text,text,text)'),('public.unirse_partida_por_codigo(text,text,text)'),('public.obtener_estado_estudiante(text,text,text)'),('public.guardar_estado_estudiante(text,text,text,jsonb,bigint)'),('public.guardar_decisiones_estudiante(text,text,text,integer,jsonb,bigint)'),('public.side_podio_estudiante(text,text,text)'),('public.guardar_reporte_estudiante(text,text,text,integer,jsonb,bigint)')) x(firma);
select e.extname,n.nspname as esquema from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
select tgname,pg_get_triggerdef(oid) as definicion from pg_trigger where tgrelid=to_regclass('public.side_student_state') and not tgisinternal;
select to_regclass('side_private.student_claims') as claims, to_regprocedure('side_private.proteger_estado_economico()') as protector;
select p.proname,pg_get_functiondef(p.oid) as definicion from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('side_guardar_cierre_negocio','side_contexto_cierre_negocio');
