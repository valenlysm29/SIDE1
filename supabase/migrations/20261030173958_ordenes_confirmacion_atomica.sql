-- Local incremental migration; requires receipts-v1 and student identity.
create or replace function side_private.side_confirm_material_order_from_snapshot(p_partida_id uuid,p_empresa_id bigint,p_ciclo integer,p_sku text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.partidas; snap jsonb; st jsonb; fam text; unit_name text; q numeric; base numeric; rate numeric; threshold numeric; analyst numeric; price numeric; lead integer; mode text; oid text; existing public.side_material_orders_v1;
begin
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
 q:=(st#>>array[fam,'quantities',p_sku])::numeric;if q<=0 then raise exception 'Cantidad inválida'; end if;
 threshold:=coalesce((p.configuracion#>>'{materials,quantityDiscountThreshold}')::numeric,100);
 rate:=coalesce((p.configuracion#>>'{materials,quantityDiscountRate}')::numeric,0.08);
 if threshold<0 or rate<0 or rate>1 then raise exception 'Descuento inválido'; end if;
 analyst:=case when st#>'{ANALISTA_COMPRAS,optionIds}' @> '["si_analista"]'::jsonb then greatest(2,12-(p_ciclo-1)*2) else 0 end;
 price:=base*(1-case when q>=threshold then rate else 0 end)*(1-analyst/100);
 unit_name:=case fam when 'CUERO' then 'm²' when 'HILO' then 'metros' else 'unidades' end;
 oid:=p_partida_id::text||':'||p_empresa_id::text||':'||p_ciclo::text||':'||p_sku;
 insert into public.side_material_orders_v1(order_id,partida_id,empresa_id,ciclo,family,sku,quantity,unit,base_unit_cost,quantity_discount,analyst_discount,unit_cost,payment_mode,ordered_day,lead_days)
 values(oid,p.id,p_empresa_id,p_ciclo,fam,p_sku,q,unit_name,base,case when q>=threshold then rate else 0 end,analyst/100,price,mode,(p_ciclo-1)*30,lead) on conflict(order_id) do nothing;
 select * into existing from public.side_material_orders_v1 where order_id=oid;
 if existing.quantity<>q or existing.unit_cost<>price or existing.payment_mode<>mode or existing.lead_days<>lead then raise exception 'Orden ya confirmada con otros datos'; end if;
 return jsonb_build_object('orderId',oid,'quantity',q,'unitCost',price,'expectedDay',existing.ordered_day+lead);
end $$;


revoke all on function side_private.side_confirm_material_order_from_snapshot(uuid,bigint,integer,text) from public,anon,authenticated,service_role;
create or replace function public.side_confirm_material_order_v1(p_partida_id uuid,p_empresa_id bigint,p_ciclo integer,p_sku text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server only' using errcode='42501'; end if;
 return side_private.side_confirm_material_order_from_snapshot(p_partida_id,p_empresa_id,p_ciclo,p_sku);
end $$;
revoke all on function public.side_confirm_material_order_v1(uuid,bigint,integer,text) from public,anon,authenticated;
grant execute on function public.side_confirm_material_order_v1(uuid,bigint,integer,text) to service_role;

-- The confirmed snapshot and its orders commit or roll back together. No order
-- is created for a draft; catalog and room configuration determine all prices.
create or replace function side_private.side_orders_after_confirmation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare game public.partidas; round_no integer; plan jsonb; family text; entry record; expected integer:=0; actual integer;
begin
 if auth.uid() is null or auth.role()='service_role' then return new; end if;
 select p.* into game from public.partidas p join public.participantes t on t.partida_id=p.id
 where t.empresa_id=new.empresa_id and t.expulsada_at is null;
 if game.id is null or game.configuracion->>'materialRulesVersion' is distinct from 'receipts-v1' then return new; end if;
 if new.snapshot->>'decisions_submitted' is distinct from 'true' then return new; end if;
 round_no:=public.side_ciclo_actual(game.configuracion);
 if game.configuracion#>>'{runtime,phase}' is distinct from 'decisions' then return new; end if;
 plan:=new.snapshot#>array['decision_state','__cyclePlans',round_no::text,'state'];
 if jsonb_typeof(plan) is distinct from 'object' then raise exception 'Plan confirmado no disponible'; end if;
 foreach family in array array['CUERO','ACCESORIOS','HILO'] loop
  if plan#>>array[family,'round'] is distinct from round_no::text or jsonb_typeof(plan#>array[family,'quantities']) is distinct from 'object' then raise exception 'Compra confirmada incompleta'; end if;
  for entry in select key,value from jsonb_each_text(plan#>array[family,'quantities']) loop
   if entry.value !~ '^[0-9]+(\.[0-9]+)?$' then raise exception 'Cantidad de compra inválida'; end if;
   if entry.value::numeric>0 then
    if not exists(select 1 from public.decisiones_catalogo c join public.decisiones_opciones o on o.decision_id=c.id where c.decision_id=family and o.opcion_id=entry.key and c.activo and o.activo) then raise exception 'SKU inválido para la decisión'; end if;
    perform side_private.side_confirm_material_order_from_snapshot(game.id,new.empresa_id,round_no,entry.key);
    expected:=expected+1;
   end if;
  end loop;
 end loop;
 select count(*) into actual from public.side_material_orders_v1 where partida_id=game.id and empresa_id=new.empresa_id and ciclo=round_no;
 if actual<>expected then raise exception 'El plan confirmado no coincide con sus órdenes'; end if;
 return new;
end $$;
revoke all on function side_private.side_orders_after_confirmation() from public,anon,authenticated,service_role;
drop trigger if exists side_orders_after_confirmation on public.side_student_state;
create trigger side_orders_after_confirmation after insert or update of snapshot on public.side_student_state
for each row execute function side_private.side_orders_after_confirmation();
