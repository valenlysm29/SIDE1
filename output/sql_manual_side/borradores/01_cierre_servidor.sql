-- After 20261026_cierre_sin_expulsion_automatica.sql and 20261027 migrations.
-- The service role is used ONLY by services/business_worker.cjs on a trusted server.
begin;
-- Preserve the installed persistence/recovery contract, changing only its actor.
do $$
declare signature text; definition text;
begin
 foreach signature in array array['public.side_contexto_cierre_negocio(uuid,integer)','public.side_guardar_cierre_negocio(uuid,integer,text,jsonb)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if position('profesor_id=auth.uid()' in definition)=0 and position('auth.role()' in definition)=0 then
   raise exception 'Unexpected closure contract: %',signature;
  end if;
  if position('auth.role()' in definition)>0 then continue; end if;
  definition:=replace(definition,'profesor_id=auth.uid()', '(profesor_id=auth.uid() or auth.role()=''service_role'')');
  execute definition;
 end loop;
end $$;
grant execute on function public.side_contexto_cierre_negocio(uuid,integer) to service_role;
grant execute on function public.side_guardar_cierre_negocio(uuid,integer,text,jsonb) to service_role;
revoke execute on function public.side_contexto_cierre_negocio(uuid,integer) from authenticated;
revoke execute on function public.side_guardar_cierre_negocio(uuid,integer,text,jsonb) from authenticated;

create or replace function public.side_cierres_pendientes()
returns jsonb language plpgsql security definer set search_path=public as $$
declare game record; c jsonb; last_cycle integer; pending jsonb; result jsonb:='[]';
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server only' using errcode='42501'; end if;
 for game in select id from public.partidas
  where configuracion->>'lifecycleVersion'='2'
   and coalesce(configuracion#>>'{runtime,phase}','')<>'cancelled'
   and coalesce(configuracion->>'phase','')<>'cancelled'
  order by id loop
  perform public.side_sync_game(game.id);
  select configuracion into c from public.partidas where id=game.id;
  if coalesce(c#>>'{runtime,phase}','integration') in ('integration','cancelled') then continue; end if;
  last_cycle:=public.side_ciclo_actual(c)-case when c#>>'{runtime,phase}' in ('results','finished') then 0 else 1 end;
  select coalesce(jsonb_agg(r order by r),'[]') into pending from generate_series(1,last_cycle) r
   where not exists(select 1 from public.side_business_closures b where b.partida_id=game.id and b.ciclo=r);
  if jsonb_array_length(pending)>0 then result:=result||jsonb_build_array(jsonb_build_object('id',game.id,'cycles',pending)); end if;
 end loop;
 return result;
end $$;
revoke all on function public.side_cierres_pendientes() from public,anon,authenticated;
grant execute on function public.side_cierres_pendientes() to service_role;

-- Teacher reads results; it no longer computes or submits the shared market.
create or replace function public.side_consultar_cierre_negocio(p_partida_id uuid,p_ciclo integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not exists(select 1 from public.partidas where id=p_partida_id and profesor_id=auth.uid()) then
  return jsonb_build_object('error','Partida no autorizada','code','NO_AUTORIZADO');
 end if;
 select cierre into result from public.side_business_closures where partida_id=p_partida_id and ciclo=p_ciclo;
 return jsonb_build_object('cierre',result,'pending',result is null);
end $$;
revoke all on function public.side_consultar_cierre_negocio(uuid,integer) from public,anon;
grant execute on function public.side_consultar_cierre_negocio(uuid,integer) to authenticated;
commit;
