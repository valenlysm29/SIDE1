-- Aplicar después de la migración de identidad y del cierre servidor.
-- Conserva los cierres históricos; solo añade el inventario por punto a futuros cierres.
begin;
do $$
declare definition text; old_piece text; new_piece text;
begin
 definition:=pg_get_functiondef('public.side_guardar_cierre_negocio(uuid,integer,text,jsonb)'::regprocedure);
 old_piece:='''__finishedGoods'',result#>''{state,__finishedGoods}'',''__inventarioMP''';
 new_piece:='''__finishedGoods'',result#>''{state,__finishedGoods}'',''__storeInventory'',coalesce(result#>''{state,__storeInventory}'',''{}''::jsonb),''__inventarioMP''';
 if position(old_piece in definition)=0 then raise exception 'Contrato inesperado de cierre; no se modificó'; end if;
 execute replace(definition,old_piece,new_piece);
 definition:=pg_get_functiondef('side_private.proteger_estado_economico()'::regprocedure);
 old_piece:='array[''__finishedGoods'',''__inventarioMP''';
 new_piece:='array[''__finishedGoods'',''__storeInventory'',''__inventarioMP''';
 if position(old_piece in definition)=0 then raise exception 'Contrato inesperado de protección; no se modificó'; end if;
 execute replace(definition,old_piece,new_piece);
end $$;
commit;
