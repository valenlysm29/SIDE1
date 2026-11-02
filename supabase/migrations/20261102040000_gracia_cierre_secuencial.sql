-- The legacy automatic projection can skip ahead by elapsed time. Versioned
-- games instead expose only their persisted cycle and its actual deadline.
do $migration$
declare
 definition text:=replace(pg_get_functiondef('public.side_runtime(jsonb,timestamp with time zone)'::regprocedure),chr(13),'');
 anchor text:=$$  if p_config->>'cycleCloseMode'='automatic' then$$;
 replacement text:=$$  if p_config->>'sequentialCloseVersion'='1' and p_config->>'cycleCloseMode'='automatic' then
    if r->>'phase'='integration' and deadline is not null and p_now>=deadline then
      r:=r||jsonb_build_object('round',1,'phase','decisions','status','running','running',true,'startedAt',deadline,'duration',duration,'remaining',duration);
    end if;
    if r->>'phase'='decisions' and coalesce((r->>'running')::boolean,false) and nullif(r->>'startedAt','') is not null
       and p_now >= (r->>'startedAt')::timestamptz + make_interval(secs=>coalesce((r->>'duration')::integer,duration)) then
      r:=r||jsonb_build_object('phase','results','status','finished','running',false,'remaining',0);
    end if;
    return r;
  end if;
  if p_config->>'cycleCloseMode'='automatic' then$$;
begin
 anchor:=replace(anchor,chr(13),''); replacement:=replace(replacement,chr(13),'');
 if position(replacement in definition)>0 then return; end if;
 if position(anchor in definition)=0 then raise exception 'Contrato de reloj incompatible'; end if;
 execute replace(definition,anchor,replacement);
end $migration$;

-- A delayed previous close shifts the next cycle's actual start. Apply the
-- existing sync grace to that real deadline, not the original schedule.
do $migration$
declare
 definition text:=replace(pg_get_functiondef('public.side_contexto_cierre_negocio(uuid,integer)'::regprocedure),chr(13),'');
 anchor text:=$$  if deadline is null then return jsonb_build_object('error','Falta referencia de tiempo del servidor','code','RELOJ_INVALIDO'); end if;$$;
 replacement text:=$$  if p.configuracion->>'sequentialCloseVersion'='1' and p_ciclo=public.side_ciclo_actual(p.configuracion) then
   deadline:=nullif(p.configuracion#>>'{runtime,startedAt}','')::timestamptz
    +make_interval(secs=>nullif(p.configuracion#>>'{runtime,duration}','')::integer);
  end if;
  if deadline is null then return jsonb_build_object('error','Falta referencia de tiempo del servidor','code','RELOJ_INVALIDO'); end if;$$;
begin
 anchor:=replace(anchor,chr(13),''); replacement:=replace(replacement,chr(13),'');
 if position(replacement in definition)>0 then return; end if;
 if position(anchor in definition)=0 then raise exception 'Contrato de cierre incompatible'; end if;
 execute replace(definition,anchor,replacement);
end $migration$;
