begin;
-- One read contract for students, teachers and the laboratory. Never replay a
-- model or copy mutable reports over a sealed market closure.
create or replace function public.side_historial_oficial(p_partida_id uuid,p_empresa_id bigint default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare game public.partidas; teacher boolean; companies jsonb; rows jsonb;
begin
 if auth.uid() is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
 select * into game from public.partidas where id=p_partida_id;
 teacher:=game.profesor_id=auth.uid();
 if game.id is null or (not coalesce(teacher,false) and (p_empresa_id is null or not exists(
   select 1 from public.participantes t join side_private.student_claims c on c.empresa_id=t.empresa_id
   where t.partida_id=p_partida_id and t.empresa_id=p_empresa_id and c.owner_id=auth.uid() and t.expulsada_at is null
 ))) then raise exception 'Partida o empresa no autorizada' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',t.empresa_id,'nombre',coalesce(e.nombre_comercial,t.empresa)) order by t.empresa_id),'[]') into companies
 from public.participantes t join public.empresas e on e.id=t.empresa_id
 where t.partida_id=p_partida_id and (p_empresa_id is null or t.empresa_id=p_empresa_id);
 select coalesce(jsonb_agg(jsonb_build_object('partida_id',p_partida_id,'empresa_id',t.empresa_id,'ciclo',n,
   'status',case when jsonb_typeof(b.cierre#>array['resultadosPorEmpresa',t.empresa_id::text,'receipt'])='object'
     and jsonb_typeof(b.cierre#>array['resultadosPorEmpresa',t.empresa_id::text,'financial','estadoResultados'])='object'
     and jsonb_typeof(b.cierre#>array['resultadosPorEmpresa',t.empresa_id::text,'financial','balanceCaja'])='object'
     and b.cierre#>>array['resultadosPorEmpresa',t.empresa_id::text,'receipt','round']=n::text then 'confirmed'
     when n=public.side_ciclo_actual(game.configuracion) and game.configuracion#>>'{runtime,phase}' in ('integration','decisions') then 'in_progress'
     when n>public.side_ciclo_actual(game.configuracion) then 'not_started'
     when b.partida_id is not null then 'missing' else 'processing' end,
   'closed_at',b.created_at,'result',b.cierre#>array['resultadosPorEmpresa',t.empresa_id::text]) order by n,t.empresa_id),'[]') into rows
 from public.participantes t cross join generate_series(1,least(6,greatest(1,(game.configuracion->>'cycles')::integer))) n
 left join public.side_business_closures b on b.partida_id=p_partida_id and b.ciclo=n
 where t.partida_id=p_partida_id and t.empresa_id is not null and (p_empresa_id is null or t.empresa_id=p_empresa_id);
 return jsonb_build_object('version','official-history-v1','partida_id',p_partida_id,'companies',companies,'cycles',rows);
end $$;
revoke all on function public.side_historial_oficial(uuid,bigint) from public,anon;
grant execute on function public.side_historial_oficial(uuid,bigint) to authenticated;

-- Merge authoritative history into reads, even after a stale local draft,
-- reconnect or a report projection has lost its older financial snapshots.
create or replace function public.obtener_estado_estudiante(p_codigo text,p_nombre_legal text,p_nombre_comercial text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare response jsonb; company bigint; game uuid; history jsonb; row jsonb; ds jsonb;
begin
 response:=side_private.side_ident_obtener_estado(p_codigo,p_nombre_legal,p_nombre_comercial);
 if response->>'success'='false' or response ? 'error' then return response; end if;
 select i.empresa_id,t.partida_id into company,game from public.side_resolver_identidad_empresa(p_codigo,p_nombre_legal,p_nombre_comercial) i
 join public.participantes t on t.id=i.participante_id;
 if company is null then return response; end if;
 history:=public.side_historial_oficial(game,company);
 ds:=coalesce(response#>'{snapshot,decision_state}','{}');
 for row in select value from jsonb_array_elements(history->'cycles') where value->>'status'='confirmed' loop
  ds:=ds||jsonb_build_object('__financialSnapshots',coalesce(ds->'__financialSnapshots','{}')||jsonb_build_object(row->>'ciclo',(row#>'{result,financial}')-'history'),
    '__cycleSettlements',coalesce(ds->'__cycleSettlements','{}')||jsonb_build_object(row->>'ciclo',row#>'{result,receipt}'));
 end loop;
 response:=jsonb_set(response,'{snapshot}',coalesce(response->'snapshot','{}')||jsonb_build_object('decision_state',ds));
 return response||jsonb_build_object('officialHistory',history);
end $$;
revoke all on function public.obtener_estado_estudiante(text,text,text) from public,anon;
grant execute on function public.obtener_estado_estudiante(text,text,text) to authenticated;
commit;
