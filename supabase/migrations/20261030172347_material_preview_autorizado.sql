-- Read-only preview: ownership is established from the server-side claim or room owner.
-- Requires the identity and receipts-v1 migrations; never grants access to the service RPC.
create or replace function public.side_material_preview_v1(p_partida_id uuid,p_empresa_id bigint,p_ciclo integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare game public.partidas; ev jsonb; cutoff integer;
begin
 if auth.uid() is null then raise exception 'No autorizado' using errcode='42501'; end if;
 select * into game from public.partidas where id=p_partida_id;
 if game.id is null or not exists (
  select 1 from public.participantes t where t.partida_id=game.id and t.empresa_id=p_empresa_id and t.expulsada_at is null
  and (game.profesor_id=auth.uid() or exists(select 1 from side_private.student_claims c where c.empresa_id=t.empresa_id and c.owner_id=auth.uid()))
 ) then raise exception 'No autorizado' using errcode='42501'; end if;
 if game.configuracion->>'materialRulesVersion' is distinct from 'receipts-v1'
  or coalesce(game.configuracion#>>'{runtime,phase}','') not in ('decisions','results','finished')
  or p_ciclo is null or p_ciclo not between 1 and least(6,coalesce((game.configuracion->>'cycles')::integer,0))
  or p_ciclo is distinct from public.side_ciclo_actual(game.configuracion)
 then raise exception 'Contexto temporal no disponible' using errcode='22023'; end if;
 cutoff:=p_ciclo*30-1;
 select coalesce(jsonb_object_agg(x.id,x.payload),'{}'::jsonb) into ev from (
  select 'order:'||o.order_id as id,jsonb_build_object('id','order:'||o.order_id,'type','order','orderId',o.order_id,'companyId',o.empresa_id::text,'sku',o.sku,'quantity',o.quantity,'unit',o.unit,'unitCost',o.unit_cost,'paymentMode',o.payment_mode,'orderedDay',o.ordered_day,'leadTimeDays',o.lead_days) as payload
  from public.side_material_orders_v1 o where o.partida_id=game.id and o.empresa_id=p_empresa_id and o.ordered_day<=cutoff
  union all
  select 'receipt:'||r.receipt_id,jsonb_build_object('id','receipt:'||r.receipt_id,'type','receipt','orderId',o.order_id,'companyId',o.empresa_id::text,'quantity',r.quantity,'day',r.receipt_day)
  from public.side_material_receipts_v1 r join public.side_material_orders_v1 o on o.order_id=r.order_id where o.partida_id=game.id and o.empresa_id=p_empresa_id and r.receipt_day<=cutoff
 ) x;
 return jsonb_build_object('companyId',p_empresa_id::text,'events',ev,'revision',md5(ev::text),'cutoffDay',cutoff,'cycle',p_ciclo,'version','receipts-v1');
end $$;
revoke all on function public.side_material_preview_v1(uuid,bigint,integer) from public,anon,authenticated;
grant execute on function public.side_material_preview_v1(uuid,bigint,integer) to authenticated;
