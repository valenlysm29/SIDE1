-- Aplicar después de 20261023_cierre_negocio.sql. Conserva snapshots financieros al reconectar.
begin;
create or replace function public.side_guardar_cierre_negocio(p_partida_id uuid,p_ciclo integer,p_token text,p_cierre jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.partidas; ctx jsonb; previo jsonb; emp jsonb; result jsonb; fin jsonb; sid bigint; snapshot_actual jsonb; next_state jsonb;
begin
 select * into p from public.partidas where id=p_partida_id and profesor_id=auth.uid() for update;
 if p.id is null then return jsonb_build_object('error','Partida no autorizada','code','NO_AUTORIZADO'); end if;
 select cierre into previo from public.side_business_closures where partida_id=p.id and ciclo=p_ciclo;
 if previo is not null then return jsonb_build_object('cierre',previo,'reused',true); end if;
 perform s.empresa_id from public.side_student_state s join public.participantes t on t.empresa_id=s.empresa_id where t.partida_id=p.id order by s.empresa_id for update of s;
 ctx:=public.side_contexto_cierre_negocio(p.id,p_ciclo);
 if ctx ? 'error' then return ctx; end if;
 if ctx->>'token' is distinct from p_token then return jsonb_build_object('error','Las decisiones cambiaron. Reintenta el cierre.','code','ESTADO_DESACTUALIZADO'); end if;
 if jsonb_typeof(p_cierre->'resultadosPorEmpresa') is distinct from 'object' or p_cierre->>'ciclo' is distinct from p_ciclo::text or octet_length(p_cierre::text)>10485760 then return jsonb_build_object('error','Cierre inválido'); end if;
 if exists(select 1 from jsonb_object_keys(p_cierre->'resultadosPorEmpresa') x(id) where not exists(select 1 from jsonb_array_elements(ctx->'empresas') y where y->>'id'=x.id))
 or exists(select 1 from jsonb_array_elements(ctx->'empresas') y where not (p_cierre->'resultadosPorEmpresa' ? (y->>'id'))) then return jsonb_build_object('error','Empresas del cierre incompletas o ajenas'); end if;
 -- Validar todo antes de escribir: ninguna empresa queda cerrada parcialmente.
 for emp in select * from jsonb_array_elements(ctx->'empresas') loop
  result:=p_cierre->'resultadosPorEmpresa'->(emp->>'id');fin:=result->'financial';
  if jsonb_typeof(result->'state') is distinct from 'object' or jsonb_typeof(result->'ledger') is distinct from 'object'
  or result#>>'{receipt,round}' is distinct from p_ciclo::text
  or jsonb_typeof(fin#>'{balanceCaja,cajaFinal}') is distinct from 'number'
  or jsonb_typeof(fin#>'{estadoResultados,ingresos}') is distinct from 'number'
  or jsonb_typeof(fin#>'{estadoResultados,costos}') is distinct from 'number'
  or jsonb_typeof(fin#>'{estadoResultados,utilidad}') is distinct from 'number' then return jsonb_build_object('error','Resultado financiero inválido'); end if;
 end loop;
 insert into public.side_business_closures(partida_id,ciclo,cierre) values(p.id,p_ciclo,p_cierre);
 for emp in select * from jsonb_array_elements(ctx->'empresas') loop
  sid:=(emp->>'id')::bigint; result:=p_cierre->'resultadosPorEmpresa'->sid::text;fin:=result->'financial';
  select snapshot into snapshot_actual from public.side_student_state where empresa_id=sid;
  next_state:=coalesce(snapshot_actual->'decision_state','{}')||jsonb_build_object('__financialSnapshots',coalesce(result#>'{state,__financialSnapshots}','{}'::jsonb)||jsonb_build_object(p_ciclo::text,fin-'history')||coalesce(snapshot_actual#>'{decision_state,__financialSnapshots}','{}'::jsonb),'__cycleSettlements',result#>'{state,__cycleSettlements}','__finishedGoods',result#>'{state,__finishedGoods}','__inventarioMP',result#>'{state,__inventarioMP}');
  update public.side_student_state set snapshot=jsonb_set(jsonb_set(snapshot_actual,'{decision_state}',next_state),'{cash_ledger}',result->'ledger'),revision=revision+1,updated_at=clock_timestamp() where empresa_id=sid;
  insert into public.reportes_ciclo(empresa_id,ciclo,capital,ingresos,costos,utilidad,caja_final,balance_caja,flujo_caja,estado_resultados)
  values(sid,p_ciclo,(emp->>'capital')::numeric,(fin#>>'{estadoResultados,ingresos}')::numeric,(fin#>>'{estadoResultados,costos}')::numeric,(fin#>>'{estadoResultados,utilidad}')::numeric,(fin#>>'{balanceCaja,cajaFinal}')::numeric,fin->'balanceCaja',fin->'flujoCaja',(fin->'estadoResultados')||jsonb_build_object('balanceGeneral',fin->'balanceGeneral','cycleReceipt',result->'receipt'))
  on conflict(empresa_id,ciclo) do update set ingresos=excluded.ingresos,costos=excluded.costos,utilidad=excluded.utilidad,caja_final=excluded.caja_final,balance_caja=excluded.balance_caja,flujo_caja=excluded.flujo_caja,estado_resultados=excluded.estado_resultados;
  update public.empresas set caja_actual=(fin#>>'{balanceCaja,cajaFinal}')::numeric where id=sid;
 end loop;
 return jsonb_build_object('cierre',p_cierre,'reused',false);
end $$;
-- Recuperar cierres ya persistidos por la versión que omitía snapshots en student_state.
-- Los snapshots existentes tienen prioridad y nunca son reescritos por este backfill.
do $$
declare row record; previous_state jsonb; existing jsonb; recovered jsonb;
begin
 for row in select c.ciclo,e.key::bigint as empresa_id,e.value->'financial' as financial
 from public.side_business_closures c cross join lateral jsonb_each(c.cierre->'resultadosPorEmpresa') e
 where jsonb_typeof(e.value->'financial')='object' loop
  select coalesce(snapshot->'decision_state','{}') into previous_state from public.side_student_state where empresa_id=row.empresa_id;
  if previous_state is null then continue; end if;
  existing:=coalesce(previous_state->'__financialSnapshots','{}');
  if existing ? row.ciclo::text then continue; end if;
  recovered:=jsonb_build_object(row.ciclo::text,row.financial-'history');
  update public.side_student_state set snapshot=jsonb_set(snapshot,'{decision_state}',previous_state||jsonb_build_object('__financialSnapshots',recovered||existing)),revision=revision+1,updated_at=clock_timestamp() where empresa_id=row.empresa_id;
 end loop;
end $$;
revoke all on function public.side_guardar_cierre_negocio(uuid,integer,text,jsonb) from public,anon;
grant execute on function public.side_guardar_cierre_negocio(uuid,integer,text,jsonb) to authenticated;
commit;