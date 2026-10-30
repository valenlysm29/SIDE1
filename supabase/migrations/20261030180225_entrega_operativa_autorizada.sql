-- Local incremental migration. The clock is server-derived. Day 0 begins at
-- cycle start; day 7 begins after 7/30 of the configured cycle duration.
create or replace function public.side_delivery_current_day_v1(c jsonb)
returns integer language plpgsql stable set search_path='' as $$
declare r jsonb:=public.side_runtime(c); duration numeric; remaining numeric; elapsed numeric; cycle integer;
begin
 cycle:=coalesce((r->>'round')::integer,0);
 if cycle<1 or cycle>6 then raise exception 'Ciclo no disponible'; end if;
 if r->>'phase' in ('results','finished') then return cycle*30-1; end if;
 if r->>'phase' is distinct from 'decisions' then raise exception 'Fase no disponible'; end if;
 duration:=greatest(60,coalesce((c->>'roundHours')::numeric,0)*3600+coalesce((c->>'roundMinutes')::numeric,10)*60);
 if r->>'status'='paused' then remaining:=(r->>'remaining')::numeric;
 elsif r->>'running'='true' and r->>'startedAt' is not null and r->>'duration' is not null then
  remaining:=greatest(0,(r->>'duration')::numeric-extract(epoch from (now()-(r->>'startedAt')::timestamptz)));
 else raise exception 'Reloj del servidor no disponible'; end if;
 if remaining is null or remaining<0 or remaining>duration then raise exception 'Reloj del servidor inválido'; end if;
 elapsed:=greatest(0,least(duration,duration-remaining));
 return (cycle-1)*30+least(29,floor(elapsed*30/duration)::integer);
end $$;
revoke all on function public.side_delivery_current_day_v1(jsonb) from public,anon,authenticated;

create or replace function side_private.side_record_material_receipt_internal(p_order_id text,p_receipt_id text,p_quantity numeric,p_day integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.side_material_orders_v1; old public.side_material_receipts_v1; received numeric; game public.partidas; last_day integer;
begin
 select * into o from public.side_material_orders_v1 where order_id=p_order_id;
 if o.order_id is null or p_receipt_id is null or length(p_receipt_id)=0 or p_quantity is null or p_quantity<=0 or p_day is null or p_day<o.ordered_day then raise exception 'Recepción inválida'; end if;
 -- Lock the game before the order, matching order confirmation and close.
 select * into game from public.partidas where id=o.partida_id for update;
 select * into o from public.side_material_orders_v1 where order_id=p_order_id for update;
 if o.order_id is null then raise exception 'Orden inexistente'; end if;
 last_day:=public.side_ciclo_actual(game.configuracion)*30-1;
 if coalesce(game.configuracion#>>'{runtime,phase}','') not in ('results','finished') then last_day:=last_day-30; end if;
 if game.configuracion->>'deliveryPolicy'='explicit_provider_event_v1' then last_day:=public.side_delivery_current_day_v1(game.configuracion); end if;
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


revoke all on function side_private.side_record_material_receipt_internal(text,text,numeric,integer) from public,anon,authenticated,service_role;
create or replace function public.side_record_material_receipt_v1(p_order_id text,p_receipt_id text,p_quantity numeric,p_day integer)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server only' using errcode='42501'; end if;
 return side_private.side_record_material_receipt_internal(p_order_id,p_receipt_id,p_quantity,p_day);
end $$;
revoke all on function public.side_record_material_receipt_v1(text,text,numeric,integer) from public,anon,authenticated;
grant execute on function public.side_record_material_receipt_v1(text,text,numeric,integer) to service_role;

-- The teacher can attest an actual provider event only for their own game.
-- The caller cannot choose the day, price, SKU or company.
create or replace function public.side_registrar_entrega_proveedor_v1(p_partida_id uuid,p_order_id text,p_receipt_id text,p_quantity numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare game public.partidas; o public.side_material_orders_v1; old public.side_material_receipts_v1; day_now integer; result jsonb; r jsonb;
begin
 if auth.uid() is null then raise exception 'No autorizado' using errcode='42501'; end if;
 select * into game from public.partidas where id=p_partida_id for update;
 if game.id is null or game.profesor_id is distinct from auth.uid() then raise exception 'No autorizado' using errcode='42501'; end if;
 if game.configuracion->>'materialRulesVersion' is distinct from 'receipts-v1' or game.configuracion->>'deliveryPolicy' is distinct from 'explicit_provider_event_v1' then raise exception 'Política de entrega no habilitada'; end if;
 select * into o from public.side_material_orders_v1 where order_id=p_order_id and partida_id=game.id for update;
 if o.order_id is null or not exists(select 1 from public.participantes t where t.partida_id=game.id and t.empresa_id=o.empresa_id and t.expulsada_at is null) then raise exception 'Pedido no disponible'; end if;
 if p_receipt_id is null or length(p_receipt_id) not between 1 and 150 or p_quantity is null or p_quantity::text in ('NaN','Infinity','-Infinity') or p_quantity<=0 then raise exception 'Entrega inválida'; end if;
 select * into old from public.side_material_receipts_v1 where receipt_id=p_receipt_id;
 if old.receipt_id is not null then
  if old.order_id<>p_order_id or old.quantity<>p_quantity then raise exception 'Identificador de recepción reutilizado'; end if;
  return jsonb_build_object('receiptId',old.receipt_id,'day',old.receipt_day,'reused',true);
 end if;
 if game.estado is distinct from 'activa' or game.configuracion->>'cancelledAt' is not null then raise exception 'Partida no activa'; end if;
 r:=public.side_runtime(game.configuracion);
 if r->>'phase' is distinct from 'decisions' or (r->>'round')::integer<o.ciclo then raise exception 'Fase o ciclo inválido'; end if;
 day_now:=public.side_delivery_current_day_v1(game.configuracion);
 if day_now<o.ordered_day+o.lead_days then raise exception 'Entrega todavía no elegible'; end if;
 if exists(select 1 from public.side_business_closures where partida_id=game.id and ciclo=(r->>'round')::integer) then raise exception 'Ciclo ya cerrado'; end if;
 result:=side_private.side_record_material_receipt_internal(p_order_id,p_receipt_id,p_quantity,day_now);
 return result||jsonb_build_object('day',day_now);
end $$;
revoke all on function public.side_registrar_entrega_proveedor_v1(uuid,text,text,numeric) from public,anon,authenticated;
grant execute on function public.side_registrar_entrega_proveedor_v1(uuid,text,text,numeric) to authenticated;

-- Acquire the game lock before the snapshot write and its order trigger.
create or replace function public.guardar_estado_estudiante(p_codigo text,p_nombre_legal text,p_nombre_comercial text,p_snapshot jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_empresa_id bigint; game_id uuid;
begin
 select r.empresa_id into v_empresa_id from public.side_resolver_identidad_empresa(p_codigo,p_nombre_legal,p_nombre_comercial) r;
 if v_empresa_id is null then return jsonb_build_object('success',false,'code','CREDENCIALES_INVALIDAS','error','No tienes acceso a esta empresa.'); end if;
 select t.partida_id into game_id from public.participantes t where t.empresa_id=v_empresa_id and t.expulsada_at is null;
 if game_id is null then return jsonb_build_object('success',false,'code','CREDENCIALES_INVALIDAS','error','No tienes acceso a esta empresa.'); end if;
 perform 1 from public.partidas p where p.id=game_id for update;
 return side_private.side_ident_guardar_estado(p_codigo,p_nombre_legal,p_nombre_comercial,p_snapshot,p_expected_revision);
end $$;
revoke all on function public.guardar_estado_estudiante(text,text,text,jsonb,bigint) from public,anon;
grant execute on function public.guardar_estado_estudiante(text,text,text,jsonb,bigint) to authenticated;
