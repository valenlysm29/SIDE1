CREATE OR REPLACE FUNCTION public.side_historial_oficial(p_partida_id uuid, p_empresa_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
 -- Expand each immutable closure once. The previous join repeatedly detoasted
 -- the entire multi-company JSON document for every company/status expression.
 with roster as materialized (
  select t.empresa_id from public.participantes t
  where t.partida_id=p_partida_id and t.empresa_id is not null
   and (p_empresa_id is null or t.empresa_id=p_empresa_id)
 ), sealed as materialized (
  select b.ciclo,b.created_at,b.cierre->'resultadosPorEmpresa' payload
  from public.side_business_closures b where b.partida_id=p_partida_id
   and b.ciclo between 1 and least(6,greatest(1,(game.configuracion->>'cycles')::integer))
 ), results as materialized (
  select b.ciclo,j.key company,j.value result
  from sealed b cross join lateral jsonb_each(case when jsonb_typeof(b.payload)='object' then b.payload else '{}'::jsonb end) j
  where exists(select 1 from roster t where t.empresa_id::text=j.key)
 ), cycle_status as materialized (
  select n,b.created_at,b.ciclo is not null has_closure,
   case when b.ciclo is null then public.side_estado_intento_cierre(p_partida_id,n) end attempt,
   (select jsonb_build_object('code',j.code,'message',j.error,'updated_at',j.updated_at)
    from public.side_closure_processing_status j where j.partida_id=p_partida_id and j.ciclo=n and j.status='error') processing_error
  from generate_series(1,least(6,greatest(1,(game.configuracion->>'cycles')::integer))) n
  left join sealed b on b.ciclo=n
 )
 select coalesce(jsonb_agg(jsonb_build_object('partida_id',p_partida_id,'empresa_id',t.empresa_id,'ciclo',n,
  'status',case when jsonb_typeof(b.result->'receipt')='object'
   and jsonb_typeof(b.result#>'{financial,estadoResultados}')='object'
   and jsonb_typeof(b.result#>'{financial,balanceCaja}')='object'
   and b.result#>>'{receipt,round}'=n::text then 'confirmed'
   when c.has_closure then 'missing' when c.attempt is not null then c.attempt
   when c.processing_error is not null then 'error'
   when n=public.side_ciclo_actual(game.configuracion) and game.configuracion#>>'{runtime,phase}' in ('integration','decisions') then 'in_progress'
   when n>public.side_ciclo_actual(game.configuracion) then 'not_started'
   else 'pending' end,
  'processing_error',c.processing_error,'closed_at',c.created_at,'result',b.result) order by n,t.empresa_id),'[]') into rows
 from roster t cross join cycle_status c
 left join results b on b.ciclo=c.n and b.company=t.empresa_id::text;
 return jsonb_build_object('version','official-history-v1','partida_id',p_partida_id,'companies',companies,'cycles',rows);
end $function$;

revoke all on function public.side_historial_oficial(uuid,bigint) from public,anon;
grant execute on function public.side_historial_oficial(uuid,bigint) to authenticated;
