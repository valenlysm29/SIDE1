-- Guard the existing manual transition without changing already sealed records.
-- The current cycle must first enter results so the server worker can settle it.
do $migration$
declare
  definition text := replace(pg_get_functiondef('public.controlar_partida(uuid,text,jsonb,integer)'::regprocedure),chr(13),'');
  anchor text := $$    if p_accion='avanzar' then
      if cycle>=(c->>'cycles')::integer then$$;
  guarded text := $$    if p_accion='avanzar' then
      if r->>'phase' <> 'results' then
        return jsonb_build_object('error','Finaliza el ciclo antes de avanzar y espera su cierre oficial.','code','CIERRE_REQUERIDO');
      end if;
      if not exists(select 1 from public.side_business_closures b where b.partida_id=p_partida_id and b.ciclo=cycle) then
        return jsonb_build_object('error','El cierre oficial todavía no está confirmado. Reintenta cuando termine el procesamiento.','code','CIERRE_PENDIENTE');
      end if;
      if cycle>=(c->>'cycles')::integer then$$;
begin
  if position(guarded in definition)>0 then return; end if;
  if position(anchor in definition)=0 then raise exception 'Contrato de controlar_partida incompatible'; end if;
  execute replace(definition,anchor,guarded);
end
$migration$;
