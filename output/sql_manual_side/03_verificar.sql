-- SOLO LECTURA: esperado false para ambos roles en las tres funciones.
select x.firma, case when to_regprocedure(x.firma) is null then null else has_function_privilege('anon',to_regprocedure(x.firma),'EXECUTE') end as anon,
 case when to_regprocedure(x.firma) is null then null else has_function_privilege('authenticated',to_regprocedure(x.firma),'EXECUTE') end as authenticated
from (values ('public.side_guardar_cierre_excel(uuid,integer,text,jsonb)'),('public.guardar_reporte(bigint,integer,jsonb)'),('public.guardar_reporte_estudiante(text,text,text,integer,jsonb,bigint)')) x(firma);
