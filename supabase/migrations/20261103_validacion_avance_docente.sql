-- Readiness is computed from the roster, explicit submissions and immutable seals.
create or replace function public.side_estado_avance(p_partida_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare p public.partidas; n integer; missing jsonb; total integer; complete boolean; processing jsonb;
begin
 select * into p from public.partidas where id=p_partida_id;
 if not found or auth.uid() is distinct from p.profesor_id or not public.side_docente_autorizado() then
  raise exception 'Acceso docente no autorizado.' using errcode='42501';
 end if;
 n:=coalesce((p.configuracion#>>'{runtime,round}')::integer,1);
 select count(*),coalesce(jsonb_agg(jsonb_build_object('id',t.empresa_id,'nombre',coalesce(t.empresa,t.nombre,t.empresa_id::text))) filter(where
  s.snapshot->>'decisions_submitted' is distinct from 'true'
  or coalesce(s.snapshot->>'round',s.snapshot#>>'{decision_state,__snapshotRound}') is distinct from n::text
  or jsonb_typeof(s.snapshot#>array['decision_state','__cyclePlans',n::text,'state']) is distinct from 'object'
  or s.snapshot#>>array['decision_state','__cyclePlans',n::text,'source']='no-plan'),'[]'::jsonb)
 into total,missing from public.participantes t left join public.side_student_state s on s.empresa_id=t.empresa_id
 where t.partida_id=p.id and t.empresa_id is not null and t.expulsada_at is null;
 complete:=public.side_cierre_completo(p.id,n);
 select jsonb_build_object('status',x.status,'code',x.code,'error',x.error) into processing
 from public.side_closure_processing_status x where x.partida_id=p.id and x.ciclo=n;
 return jsonb_build_object('round',n,'total',total,'missing',missing,'complete',complete,'processing',processing,
 'ready',p.estado='activa' and p.configuracion#>>'{runtime,phase}'='results' and total>0 and jsonb_array_length(missing)=0 and complete);
end $$;
revoke all on function public.side_estado_avance(uuid) from public,anon;
grant execute on function public.side_estado_avance(uuid) to authenticated;

-- Keep the existing row lock and expected-round compare-and-set. Validate again
-- inside that lock: a browser's last readiness response never authorizes a write.
do $migration$
declare definition text:=replace(pg_get_functiondef('public.controlar_partida(uuid,text,jsonb,integer)'::regprocedure),chr(13),'');
 anchor text:=$$    if p_accion='avanzar' then$$;
 replacement text:=$$    if p_accion='avanzar' then
      if not coalesce((public.side_estado_avance(p_partida_id)->>'ready')::boolean,false) then
        return jsonb_build_object('error','El ciclo requiere todas las confirmaciones y el cierre oficial completo.','code','AVANCE_NO_DISPONIBLE','avance',public.side_estado_avance(p_partida_id));
      end if;$$;
begin
 if position('AVANCE_NO_DISPONIBLE' in definition)>0 then return; end if;
 if position(anchor in definition)=0 then raise exception 'Contrato controlar_partida incompatible'; end if;
 execute replace(definition,anchor,replacement);
end $migration$;

-- Confirmed sections are immutable for students. Once every participant has
-- submitted, synchronization starts the official settlement without requiring
-- a second, undocumented teacher action. The existing game row lock is held.
do $migration$
declare definition text:=replace(pg_get_functiondef('public.controlar_partida(uuid,text,jsonb,integer)'::regprocedure),chr(13),'');
 anchor text:=$$  if p_accion='guardar' then$$;
 replacement text:=$$  -- SIDE_ALL_CONFIRMED_SETTLEMENT_V1
  if p_accion='sincronizar' and p.estado='activa' and c->>'cycleCloseMode'='manual' and r->>'phase'='decisions'
    and (public.side_estado_avance(p_partida_id)->>'total')::integer>0
    and jsonb_array_length(public.side_estado_avance(p_partida_id)->'missing')=0 then
    r:=r||jsonb_build_object('phase','results','status','finished','running',false,'remaining',0);
  end if;
  if p_accion='guardar' then$$;
begin
 if position('SIDE_ALL_CONFIRMED_SETTLEMENT_V1' in definition)>0 then return; end if;
 if position(anchor in definition)=0 then raise exception 'Contrato de confirmaciones incompatible'; end if;
 execute replace(definition,anchor,replacement);
end $migration$;
notify pgrst,'reload schema';
