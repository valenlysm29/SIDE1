-- Actualiza únicamente metadatos del catálogo; conserva decisiones e históricos.
begin;
insert into public.decisiones_catalogo
  (categoria,categoria_nombre,decision_id,decision_nombre,tipo,es_recurrente,es_obligatoria,costo_base,descripcion,activo)
values ('B','Infraestructura','REGIMEN_LABORAL','Régimen laboral','choice',false,true,0,'MYPE o No MYPE según Costos De Producción',true)
on conflict (decision_id) do update set decision_nombre=excluded.decision_nombre,descripcion=excluded.descripcion,activo=true;

insert into public.decisiones_opciones (decision_id,opcion_id,etiqueta,descripcion,costo,activo)
select id,'mype','MYPE','Régimen MYPE',0,true from public.decisiones_catalogo where decision_id='REGIMEN_LABORAL'
on conflict (decision_id,opcion_id) do update set etiqueta=excluded.etiqueta,activo=true;
insert into public.decisiones_opciones (decision_id,opcion_id,etiqueta,descripcion,costo,activo)
select id,'no_mype','No MYPE','Régimen No MYPE',0,true from public.decisiones_catalogo where decision_id='REGIMEN_LABORAL'
on conflict (decision_id,opcion_id) do update set etiqueta=excluded.etiqueta,activo=true;

update public.decisiones_catalogo set decision_nombre='Publicidad del ciclo',tipo='number',es_recurrente=true,es_obligatoria=false,costo_base=0,descripcion='Importe entre S/0 y S/10000; factor de reputación',activo=true where decision_id='INV_MARKETING';
update public.decisiones_catalogo set tipo='multi-choice',descripcion='Uno o varios tipos de molde por ciclo; se requiere al menos uno disponible' where decision_id='MOLDE';
update public.decisiones_opciones set activo=false where decision_id in (select id from public.decisiones_catalogo where decision_id in ('INV_MARKETING','MANTENIMIENTO'));
update public.decisiones_catalogo set tipo='info',es_obligatoria=false,costo_base=0,descripcion='Mantenimiento automático anual/12 según activos y régimen' where decision_id='MANTENIMIENTO';
commit;
