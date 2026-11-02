-- A game-level seal is valid only when every currently participating company
-- has its own receipt, financial statement and state in that seal.
create or replace function public.side_cierre_completo(p_partida_id uuid,p_ciclo integer)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.participantes t where t.partida_id=p_partida_id and t.empresa_id is not null and t.expulsada_at is null)
 and exists(select 1 from public.side_business_closures b where b.partida_id=p_partida_id and b.ciclo=p_ciclo
   and jsonb_typeof(b.cierre->'resultadosPorEmpresa')='object'
   and not exists(select 1 from public.participantes t where t.partida_id=p_partida_id and t.empresa_id is not null and t.expulsada_at is null
     and (jsonb_typeof(b.cierre#>array['resultadosPorEmpresa',t.empresa_id::text,'receipt']) is distinct from 'object'
       or jsonb_typeof(b.cierre#>array['resultadosPorEmpresa',t.empresa_id::text,'financial']) is distinct from 'object'
       or jsonb_typeof(b.cierre#>array['resultadosPorEmpresa',t.empresa_id::text,'state']) is distinct from 'object')));
$$;
revoke all on function public.side_cierre_completo(uuid,integer) from public,anon,authenticated;

-- Guard the existing manual transition without changing already sealed records.
-- The current cycle must first enter results so the server worker can settle it.
do $migration$
declare
  definition text := replace(pg_get_functiondef('public.controlar_partida(uuid,text,jsonb,integer)'::regprocedure),chr(13),'');
  anchor text := $$    if p_accion='avanzar' then
      if cycle>=(c->>'cycles')::integer then$$;
  guarded text := $$    if p_accion='avanzar' then
      if c->>'sequentialCloseVersion'='1' and r->>'phase' <> 'results' then
        return jsonb_build_object('error','Finaliza el ciclo antes de avanzar y espera su cierre oficial.','code','CIERRE_REQUERIDO');
      end if;
      if c->>'sequentialCloseVersion'='1' and not public.side_cierre_completo(p_partida_id,cycle) then
        return jsonb_build_object('error','El cierre oficial todavía no está confirmado. Reintenta cuando termine el procesamiento.','code','CIERRE_PENDIENTE');
      end if;
      if cycle>=(c->>'cycles')::integer then$$;
begin
  anchor:=replace(anchor,chr(13),''); guarded:=replace(guarded,chr(13),'');
  if position(guarded in definition)>0 then return; end if;
  if position(anchor in definition)=0 then raise exception 'Contrato de controlar_partida incompatible'; end if;
  execute replace(definition,anchor,guarded);
end
$migration$;
