begin;
-- The snapshot trigger must use the same versioned presentation conversion as
-- the trusted worker entry point. No existing order or receipt is rewritten.
do $migration$
declare definition text; guard text:=$guard$ if auth.role() is distinct from 'service_role' then raise exception 'Server only' using errcode='42501'; end if;$guard$;
begin
 definition:=replace(pg_get_functiondef('public.side_confirm_material_order_v1(uuid,bigint,integer,text)'::regprocedure),chr(13),'');
 if position('pack_factor' in definition)=0 then
  if position('side_private.side_confirm_material_order_from_snapshot' in definition)>0 then return; end if;
  raise exception 'Versioned material presentation contract not installed';
 end if;
 if position(guard in definition)=0 then raise exception 'Material authorization contract incompatible'; end if;
 definition:=replace(definition,'public.side_confirm_material_order_v1(', 'side_private.side_confirm_material_order_from_snapshot(');
 definition:=replace(definition,guard,'');
 execute definition;
end $migration$;
revoke all on function side_private.side_confirm_material_order_from_snapshot(uuid,bigint,integer,text) from public,anon,authenticated,service_role;
create or replace function public.side_confirm_material_order_v1(p_partida_id uuid,p_empresa_id bigint,p_ciclo integer,p_sku text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server only' using errcode='42501'; end if;
 return side_private.side_confirm_material_order_from_snapshot(p_partida_id,p_empresa_id,p_ciclo,p_sku);
end $$;
revoke all on function public.side_confirm_material_order_v1(uuid,bigint,integer,text) from public,anon,authenticated;
grant execute on function public.side_confirm_material_order_v1(uuid,bigint,integer,text) to service_role;
commit;
