-- SOLO LECTURA: ejecuta en proyecto plfuwfdpsagzrlveqkvl.
select x.firma, to_regprocedure(x.firma) is not null as existe,
 case when to_regprocedure(x.firma) is null then null else has_function_privilege('anon',to_regprocedure(x.firma),'EXECUTE') end as anon_puede_ejecutar,
 case when to_regprocedure(x.firma) is null then null else has_function_privilege('authenticated',to_regprocedure(x.firma),'EXECUTE') end as authenticated_puede_ejecutar
from (values ('public.side_guardar_cierre_excel(uuid,integer,text,jsonb)'),('public.guardar_reporte(bigint,integer,jsonb)'),('public.guardar_reporte_estudiante(text,text,text,integer,jsonb,bigint)'),('public.side_guardar_cierre_negocio(uuid,integer,text,jsonb)'),('public.side_ingresar_empresa_segura(text,text,text,text)'),('side_private.proteger_estado_economico()')) x(firma);
select to_regclass('side_private.student_claims') is not null as identidad_instalada,
 exists(select 1 from information_schema.columns where table_schema='public' and table_name='participantes' and column_name='expulsada_at') as expulsion_instalada;
