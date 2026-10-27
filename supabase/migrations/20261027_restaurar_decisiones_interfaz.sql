-- Compatibilidad si se aplicó 20261027_logica_documento_costos.sql.
-- Restaura los controles previos sin borrar opciones ni decisiones históricas.
begin;
update public.decisiones_catalogo set activo=false where decision_id='REGIMEN_LABORAL';
update public.decisiones_opciones set activo=false where decision_id in (select id from public.decisiones_catalogo where decision_id='REGIMEN_LABORAL');

update public.decisiones_catalogo set decision_nombre='Inversion en marketing',tipo='choice',es_recurrente=true,es_obligatoria=false,costo_base=1500,descripcion='Presencia de marca',activo=true where decision_id='INV_MARKETING';
insert into public.decisiones_opciones (decision_id,opcion_id,etiqueta,descripcion,costo,activo)
select d.id,v.codigo,v.etiqueta,v.descripcion,v.costo,true
from public.decisiones_catalogo d cross join (values
 ('mkt_baja','Baja','Presencia basica',1500),
 ('mkt_media','Media','Mayor alcance',6000),
 ('mkt_alta','Alta','Campana intensiva',12000)
) as v(codigo,etiqueta,descripcion,costo) where d.decision_id='INV_MARKETING'
on conflict (decision_id,opcion_id) do update set etiqueta=excluded.etiqueta,descripcion=excluded.descripcion,costo=excluded.costo,activo=true;

update public.decisiones_catalogo set tipo='choice',descripcion='Patrón de producto; se requiere al menos uno disponible' where decision_id='MOLDE';
update public.decisiones_catalogo set decision_nombre='Mantenimiento de maquinaria',tipo='choice',es_obligatoria=false,costo_base=1500,descripcion='Mantenimiento preventivo opcional',activo=true where decision_id='MANTENIMIENTO';
insert into public.decisiones_opciones (decision_id,opcion_id,etiqueta,descripcion,costo,activo)
select id,'correctivo','Mantenimiento preventivo','Intervención opcional para prevenir fallas',1500,true from public.decisiones_catalogo where decision_id='MANTENIMIENTO'
on conflict (decision_id,opcion_id) do update set etiqueta=excluded.etiqueta,descripcion=excluded.descripcion,costo=excluded.costo,activo=true;
commit;
