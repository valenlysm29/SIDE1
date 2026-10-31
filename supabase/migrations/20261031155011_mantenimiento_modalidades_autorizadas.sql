begin;
update public.decisiones_catalogo
set tipo='choice', es_obligatoria=false, costo_base=1000,
    descripcion='Una modalidad por ciclo; mantenimiento preventivo desde el ciclo 2', activo=true
where decision_id='MANTENIMIENTO';
insert into public.decisiones_opciones (decision_id,opcion_id,etiqueta,descripcion,costo,activo)
select d.id,v.codigo,v.etiqueta,v.descripcion,v.costo,true
from public.decisiones_catalogo d cross join (values
 ('correctivo','Mantenimiento Correctivo','Correctivo y reparaciones extraordinarias',1000),
 ('preventivo_basico','Mantenimiento Preventivo Básico','Disponible desde el ciclo 2',1500),
 ('preventivo_integral','Mantenimiento Preventivo Integral','Disponible desde el ciclo 2',3000)
) as v(codigo,etiqueta,descripcion,costo)
where d.decision_id='MANTENIMIENTO'
on conflict (decision_id,opcion_id) do update
set etiqueta=excluded.etiqueta,descripcion=excluded.descripcion,costo=excluded.costo,activo=true;
commit;
