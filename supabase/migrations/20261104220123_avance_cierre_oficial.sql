-- An explicit submission is required to close early by consensus.
-- Once cut/time expiry has produced an immutable official seal, that seal
-- is authoritative; students cannot submit again in the results phase.
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
 'ready',p.estado='activa' and p.configuracion#>>'{runtime,phase}'='results' and total>0 and complete);
end $$;
revoke all on function public.side_estado_avance(uuid) from public,anon;
grant execute on function public.side_estado_avance(uuid) to authenticated;


-- No-plan recovery must not promote unconfirmed material drafts into purchases.
-- Verified orders and sealed cycles remain untouched; the model stays unchanged.
do $migration$
declare
 definition text:=replace(pg_get_functiondef('public.side_contexto_cierre_negocio(uuid,integer)'::regprocedure),chr(13),'');
 anchor text:=$$   saved:=jsonb_build_object('state',rebuilt,'source','no-plan');$$;
 replacement text:=$$   -- SIDE_UNCONFIRMED_MATERIAL_DRAFT_V1
   if p.configuracion->>'materialRulesVersion'='receipts-v1'
     and not exists(select 1 from public.side_material_orders_v1 o where o.partida_id=p.id and o.empresa_id=row.empresa_id and o.ciclo=p_ciclo) then
     for field in select key from jsonb_each(rebuilt) where key in ('CUERO','ACCESORIOS','HILO') and value->>'round'=p_ciclo::text loop
       rebuilt:=jsonb_set(rebuilt,array[field.key,'quantities'],'{}'::jsonb);
     end loop;
   end if;
   saved:=jsonb_build_object('state',rebuilt,'source','no-plan');$$;
begin
 if position('SIDE_UNCONFIRMED_MATERIAL_DRAFT_V1' in definition)>0 then return; end if;
 if position(anchor in definition)=0 then raise exception 'Contrato de recuperación de planes incompatible'; end if;
 execute replace(definition,anchor,replacement);
end $migration$;
notify pgrst,'reload schema';

-- Retry recovered no-plan drafts only while the cycle is still unsealed.
-- The context function returns stored closures before reaching this branch.
do $migration$
declare
 definition text:=replace(pg_get_functiondef('public.side_contexto_cierre_negocio(uuid,integer)'::regprocedure),chr(13),'');
 anchor text:=$$  saved:=plans->p_ciclo::text;$$;
 replacement text:=$$  saved:=plans->p_ciclo::text;
  -- SIDE_RETRY_UNSEALED_NO_PLAN_V1
  if saved->>'source'='no-plan' and p.configuracion->>'materialRulesVersion'='receipts-v1'
    and not exists(select 1 from public.side_material_orders_v1 o where o.partida_id=p.id and o.empresa_id=row.empresa_id and o.ciclo=p_ciclo)
    and exists(select 1 from jsonb_each(saved->'state') d cross join lateral jsonb_each_text(coalesce(d.value->'quantities','{}')) q
      where d.key in ('CUERO','ACCESORIOS','HILO') and d.value->>'round'=p_ciclo::text and q.value::numeric>0) then saved:=null; end if;$$;
begin
 if position('SIDE_RETRY_UNSEALED_NO_PLAN_V1' in definition)>0 then return; end if;
 if position(anchor in definition)=0 then raise exception 'Contrato de reintento de planes incompatible'; end if;
 execute replace(definition,anchor,replacement);
end $migration$;
notify pgrst,'reload schema';
