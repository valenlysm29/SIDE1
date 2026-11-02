-- Enable the sequential clock only for newly created games. Existing games are
-- not rewritten or switched to a different clock during this deployment.
create or replace function public.side_nueva_partida_cierre_secuencial()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if new.configuracion->>'lifecycleVersion'='2' then
  new.configuracion:=new.configuracion||jsonb_build_object('sequentialCloseVersion','1');
 end if;
 return new;
end $$;
drop trigger if exists zz_side_nueva_partida_cierre_secuencial on public.partidas;
create trigger zz_side_nueva_partida_cierre_secuencial before insert on public.partidas
for each row execute function public.side_nueva_partida_cierre_secuencial();

-- side_sync_game owns the game row lock. It moves at most one cycle and only
-- after its immutable closure exists. A late worker never consumes future time.
do $migration$
declare
 definition text:=replace(pg_get_functiondef('public.side_sync_game(uuid)'::regprocedure),chr(13),'');
 anchor text:=$$    r:=public.side_runtime(c); schedule:=coalesce(c->'eventSchedule','{}');$$;
 replacement text:=$$    r:=public.side_runtime(c);
    if c->>'sequentialCloseVersion'='1' and c->>'cycleCloseMode'='automatic' then
      r:=coalesce(c->'runtime','{}'::jsonb);
      if r->>'phase'='integration' and clock_timestamp()>=nullif(c->>'gameStartAt','')::timestamptz then
        r:=r||jsonb_build_object('round',1,'phase','decisions','status','running','running',true,'startedAt',c->>'gameStartAt');
      end if;
      if r->>'phase'='decisions' and coalesce((r->>'running')::boolean,false)
        and clock_timestamp()>=(r->>'startedAt')::timestamptz+make_interval(secs=>(r->>'duration')::integer) then
        r:=r||jsonb_build_object('phase','results','status','finished','running',false,'remaining',0);
      elsif r->>'phase'='results' and public.side_cierre_completo(p_id,(r->>'round')::integer) then
        if (r->>'round')::integer >= (c->>'cycles')::integer then
          r:=r||jsonb_build_object('phase','finished','status','simulation-finished','running',false,'remaining',0);
        else
          r:=r||jsonb_build_object('round',(r->>'round')::integer+1,'phase','decisions','status','running','running',true,'startedAt',clock_timestamp(),'remaining',(r->>'duration')::integer);
        end if;
      end if;
    end if;
    schedule:=coalesce(c->'eventSchedule','{}');$$;
begin
 anchor:=replace(anchor,chr(13),''); replacement:=replace(replacement,chr(13),'');
 if position(replacement in definition)>0 then return; end if;
 if position(anchor in definition)=0 then raise exception 'Contrato de side_sync_game incompatible'; end if;
 execute replace(definition,anchor,replacement);
end $migration$;
