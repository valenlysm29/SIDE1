-- Validate the order-book revision under the same game lock held by receipt
-- writers, then invoke the existing closure writer in the same transaction.
-- The caller is the trusted worker; the wrapper does not calculate financials.
create or replace function public.side_guardar_cierre_temporal_v1(
 p_partida_id uuid,p_ciclo integer,p_token text,p_revisiones jsonb,p_cierre jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare game public.partidas; ctx jsonb; company jsonb; book jsonb; prior jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server only' using errcode='42501'; end if;
 select * into game from public.partidas where id=p_partida_id for update;
 if game.id is null then return jsonb_build_object('error','Partida no encontrada','code','NO_AUTORIZADO'); end if;
 if game.configuracion->>'materialRulesVersion' is distinct from 'receipts-v1' then return jsonb_build_object('error','Versión de materiales inválida','code','VERSION_MATERIALES_INVALIDA'); end if;
 if p_ciclo is null or p_ciclo<1 or p_ciclo>least(6,coalesce((game.configuracion->>'cycles')::integer,0)) then return jsonb_build_object('error','Ciclo inválido','code','CICLO_INVALIDO'); end if;
 perform pg_advisory_xact_lock(hashtext(game.id::text),p_ciclo);
 select cierre into prior from public.side_business_closures where partida_id=game.id and ciclo=p_ciclo;
 if prior is not null then return jsonb_build_object('cierre',prior,'reused',true); end if;
 if jsonb_typeof(p_revisiones) is distinct from 'object' then return jsonb_build_object('error','Revisiones inválidas','code','ORDENES_NO_VERIFICADAS'); end if;
 ctx:=public.side_contexto_cierre_negocio(game.id,p_ciclo);
 if ctx ? 'error' then return ctx; end if;
 if ctx->>'token' is distinct from p_token then return jsonb_build_object('error','Las decisiones cambiaron','code','ESTADO_DESACTUALIZADO'); end if;
 if jsonb_typeof(ctx->'empresas') is distinct from 'array' then return jsonb_build_object('error','Empresas inválidas','code','ORDENES_NO_VERIFICADAS'); end if;
 if (select count(*) from jsonb_object_keys(p_revisiones))<>jsonb_array_length(ctx->'empresas') then return jsonb_build_object('error','Revisiones incompletas','code','ORDENES_NO_VERIFICADAS'); end if;
 for company in select * from jsonb_array_elements(ctx->'empresas') loop
  book:=public.side_material_context_v1(game.id,(company->>'id')::bigint,p_ciclo*30-1);
  if p_revisiones->>(company->>'id') is distinct from book->>'revision' then return jsonb_build_object('error','Las órdenes o recepciones cambiaron','code','ORDENES_DESACTUALIZADAS'); end if;
 end loop;
 return public.side_guardar_cierre_negocio(game.id,p_ciclo,p_token,p_cierre);
end $$;
revoke all on function public.side_guardar_cierre_temporal_v1(uuid,integer,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.side_guardar_cierre_temporal_v1(uuid,integer,text,jsonb,jsonb) to service_role;
