-- Opt-in version: orders and receipts use physical units; purchase decisions use whole presentations.
create or replace function public.side_confirm_material_order_v1(p_partida_id uuid,p_empresa_id bigint,p_ciclo integer,p_sku text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.partidas; snap jsonb; st jsonb; fam text; unit_name text; q numeric; base numeric; rate numeric; threshold numeric; analyst numeric; price numeric; lead integer; mode text; oid text; existing public.side_material_orders_v1; pack_factor numeric := 1; purchase_count numeric;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server only' using errcode='42501'; end if;
 select * into p from public.partidas where id=p_partida_id for update;
 if p.id is null or not exists(select 1 from public.participantes where partida_id=p.id and empresa_id=p_empresa_id) then raise exception 'Empresa o partida inválida'; end if;
 if p.configuracion->>'materialRulesVersion' is distinct from 'receipts-v1' or p_ciclo not between 1 and least(6,coalesce((p.configuracion->>'cycles')::int,0)) then raise exception 'Versión o ciclo inválido'; end if;
 if coalesce(p.configuracion->>'materialLeadTimeDays','') !~ '^[0-9]{1,4}$' or coalesce(p.configuracion->>'materialPaymentMode','') not in ('cash','credit') then raise exception 'Parámetros de recepción o pago no definidos'; end if;
 lead:=(p.configuracion->>'materialLeadTimeDays')::integer;mode:=p.configuracion->>'materialPaymentMode';
 select snapshot into snap from public.side_student_state where empresa_id=p_empresa_id for update;
 st:=snap#>array['decision_state','__cyclePlans',p_ciclo::text,'state'];
 if jsonb_typeof(st) is distinct from 'object' or snap->>'decisions_submitted' is distinct from 'true' then raise exception 'Decisión confirmada no disponible'; end if;
 select c.decision_id,o.costo into fam,base from public.decisiones_catalogo c join public.decisiones_opciones o on o.decision_id=c.id
 where c.decision_id in ('CUERO','ACCESORIOS','HILO') and o.opcion_id=p_sku and c.activo and o.activo;
 if fam is null then raise exception 'SKU inválido'; end if;
 if st#>>array[fam,'round'] is distinct from p_ciclo::text or coalesce(st#>>array[fam,'quantities',p_sku],'') !~ '^[0-9]+(\.[0-9]+)?$' then raise exception 'Compra no confirmada'; end if;
 q:=(st#>>array[fam,'quantities',p_sku])::numeric;if q<=0 then raise exception 'Cantidad inválida'; end if; purchase_count:=q;
 if p.configuracion->>'materialPurchaseVersion'='excel-v2-packs-v1' then
  if q<>trunc(q) then raise exception 'Las presentaciones deben ser enteras'; end if;
  pack_factor:=case p_sku when 'cuero_sint' then 1 when 'cuero_std' then 2 when 'cuero_prem' then 2 when 'acc_eco' then 1 when 'acc_prem' then 1 when 'hilo_std' then 270 when 'hilo_ref' then 250 when 'hilo_prem' then 200 else null end;
  if pack_factor is null then raise exception 'Presentación desconocida'; end if;
 elsif p.configuracion ? 'materialPurchaseVersion' then raise exception 'Versión de compra desconocida'; end if;
 threshold:=coalesce((p.configuracion#>>'{materials,quantityDiscountThreshold}')::numeric,100);
 rate:=coalesce((p.configuracion#>>'{materials,quantityDiscountRate}')::numeric,0.08);
 if threshold<0 or rate<0 or rate>1 then raise exception 'Descuento inválido'; end if;
 analyst:=case when st#>'{ANALISTA_COMPRAS,optionIds}' @> '["si_analista"]'::jsonb then greatest(2,12-(p_ciclo-1)*2) else 0 end;
 price:=base*(1-case when purchase_count>=threshold then rate else 0 end)*(1-analyst/100)/pack_factor; q:=purchase_count*pack_factor;
 unit_name:=case fam when 'CUERO' then 'm²' when 'HILO' then 'metros' else 'unidades' end;
 oid:=p_partida_id::text||':'||p_empresa_id::text||':'||p_ciclo::text||':'||p_sku;
 insert into public.side_material_orders_v1(order_id,partida_id,empresa_id,ciclo,family,sku,quantity,unit,base_unit_cost,quantity_discount,analyst_discount,unit_cost,payment_mode,ordered_day,lead_days)
 values(oid,p.id,p_empresa_id,p_ciclo,fam,p_sku,q,unit_name,base,case when purchase_count>=threshold then rate else 0 end,analyst/100,price,mode,(p_ciclo-1)*30,lead) on conflict(order_id) do nothing;
 select * into existing from public.side_material_orders_v1 where order_id=oid;
 if existing.quantity<>q or existing.unit_cost<>price or existing.payment_mode<>mode or existing.lead_days<>lead then raise exception 'Orden ya confirmada con otros datos'; end if;
 return jsonb_build_object('orderId',oid,'quantity',q,'unitCost',price,'expectedDay',existing.ordered_day+lead);
end $$;

revoke all on function public.side_confirm_material_order_v1(uuid,bigint,integer,text) from public,anon,authenticated;
grant execute on function public.side_confirm_material_order_v1(uuid,bigint,integer,text) to service_role;

-- The meaning of a saved quantity cannot change after room creation.
create or replace function public.side_material_purchase_version_immutable_v1()
returns trigger language plpgsql set search_path='' as $$
begin
 if old.configuracion->>'materialPurchaseVersion' is distinct from new.configuracion->>'materialPurchaseVersion' then
  raise exception 'La versión de compra de materiales es inmutable para una partida existente';
 end if;
 return new;
end $$;
drop trigger if exists side_material_purchase_version_immutable_v1 on public.partidas;
create trigger side_material_purchase_version_immutable_v1 before update of configuracion on public.partidas for each row execute function public.side_material_purchase_version_immutable_v1();
