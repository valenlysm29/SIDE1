-- Local, additive order facts. No historical closure or student snapshot is rewritten.
-- Temporal rules require explicit materialLeadTimeDays and materialPaymentMode.
create table if not exists public.side_material_orders_v1 (
 order_id text primary key,
 partida_id uuid not null references public.partidas(id),
 empresa_id bigint not null references public.empresas(id),
 ciclo integer not null check(ciclo between 1 and 6),
 family text not null check(family in ('CUERO','ACCESORIOS','HILO')),
 sku text not null,
 quantity numeric not null check(quantity>0),
 unit text not null check(unit in ('m²','unidades','metros')),
 base_unit_cost numeric not null check(base_unit_cost>=0),
 quantity_discount numeric not null check(quantity_discount between 0 and 1),
 analyst_discount numeric not null check(analyst_discount between 0 and 1),
 unit_cost numeric not null check(unit_cost>=0),
 payment_mode text not null check(payment_mode in ('cash','credit')),
 ordered_day integer not null check(ordered_day>=0),
 lead_days integer not null check(lead_days>=0),
 version text not null default 'receipts-v1',
 unique(partida_id,empresa_id,ciclo,sku)
);
create table if not exists public.side_material_receipts_v1 (
 receipt_id text primary key,
 order_id text not null references public.side_material_orders_v1(order_id),
 quantity numeric not null check(quantity>0),
 receipt_day integer not null check(receipt_day>=0),
 source text not null check(source='service')
);
alter table public.side_material_orders_v1 enable row level security;
alter table public.side_material_receipts_v1 enable row level security;
revoke all on public.side_material_orders_v1, public.side_material_receipts_v1 from public,anon,authenticated,service_role;

-- Only the trusted server may derive an order from a persisted confirmed plan.
-- Quantity and price come from the plan and catalog, never from the RPC caller.
create or replace function public.side_confirm_material_order_v1(p_partida_id uuid,p_empresa_id bigint,p_ciclo integer,p_sku text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.partidas; snap jsonb; st jsonb; fam text; unit_name text; q numeric; base numeric; rate numeric; threshold numeric; analyst numeric; price numeric; lead integer; mode text; oid text; existing public.side_material_orders_v1;
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

-- A trusted server records a real receipt; locks serialize partial deliveries.
create or replace function public.side_record_material_receipt_v1(p_order_id text,p_receipt_id text,p_quantity numeric,p_day integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.side_material_orders_v1; old public.side_material_receipts_v1; received numeric; game public.partidas; last_day integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server only' using errcode='42501'; end if;
 select * into o from public.side_material_orders_v1 where order_id=p_order_id;
 if o.order_id is null or p_receipt_id is null or length(p_receipt_id)=0 or p_quantity is null or p_quantity<=0 or p_day is null or p_day<o.ordered_day then raise exception 'Recepción inválida'; end if;
 -- Lock the game before the order, matching order confirmation and close.
 select * into game from public.partidas where id=o.partida_id for update;
 select * into o from public.side_material_orders_v1 where order_id=p_order_id for update;
 if o.order_id is null then raise exception 'Orden inexistente'; end if;
 last_day:=public.side_ciclo_actual(game.configuracion)*30-1;
 if coalesce(game.configuracion#>>'{runtime,phase}','') not in ('results','finished') then last_day:=last_day-30; end if;
 if p_day>last_day then raise exception 'Día de recepción aún no alcanzado'; end if;
 select * into old from public.side_material_receipts_v1 where receipt_id=p_receipt_id;
 if old.receipt_id is not null then
  if old.order_id<>p_order_id or old.quantity<>p_quantity or old.receipt_day<>p_day then raise exception 'Identificador de recepción reutilizado'; end if;
  return jsonb_build_object('receiptId',old.receipt_id,'reused',true);
 end if;
 select coalesce(sum(quantity),0) into received from public.side_material_receipts_v1 where order_id=o.order_id;
 if received+p_quantity>o.quantity then raise exception 'Recepción superior al pedido'; end if;
 insert into public.side_material_receipts_v1 values(p_receipt_id,p_order_id,p_quantity,p_day,'service');
 return jsonb_build_object('receiptId',p_receipt_id,'reused',false);
end $$;

-- Scope the immutable facts to one game/company and an explicit cutoff day.
create or replace function public.side_material_context_v1(p_partida_id uuid,p_empresa_id bigint,p_cutoff_day integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare ev jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server only' using errcode='42501'; end if;
 if p_cutoff_day is null or p_cutoff_day<0 or not exists(select 1 from public.participantes where partida_id=p_partida_id and empresa_id=p_empresa_id) then raise exception 'Empresa o fecha inválida'; end if;
 select coalesce(jsonb_object_agg(x.id,x.payload),'{}'::jsonb) into ev from (
  select 'order:'||o.order_id as id,jsonb_build_object('id','order:'||o.order_id,'type','order','orderId',o.order_id,'companyId',o.empresa_id::text,'sku',o.sku,'quantity',o.quantity,'unit',o.unit,'unitCost',o.unit_cost,'paymentMode',o.payment_mode,'orderedDay',o.ordered_day,'leadTimeDays',o.lead_days) as payload
  from public.side_material_orders_v1 o where o.partida_id=p_partida_id and o.empresa_id=p_empresa_id and o.ordered_day<=p_cutoff_day
  union all
  select 'receipt:'||r.receipt_id,jsonb_build_object('id','receipt:'||r.receipt_id,'type','receipt','orderId',o.order_id,'companyId',o.empresa_id::text,'quantity',r.quantity,'day',r.receipt_day)
  from public.side_material_receipts_v1 r join public.side_material_orders_v1 o on o.order_id=r.order_id where o.partida_id=p_partida_id and o.empresa_id=p_empresa_id and r.receipt_day<=p_cutoff_day
 ) x;
 return jsonb_build_object('companyId',p_empresa_id::text,'events',ev,'revision',md5(ev::text));
end $$;
revoke all on function public.side_confirm_material_order_v1(uuid,bigint,integer,text),public.side_record_material_receipt_v1(text,text,numeric,integer),public.side_material_context_v1(uuid,bigint,integer) from public,anon,authenticated;
grant execute on function public.side_confirm_material_order_v1(uuid,bigint,integer,text),public.side_record_material_receipt_v1(text,text,numeric,integer),public.side_material_context_v1(uuid,bigint,integer) to service_role;
