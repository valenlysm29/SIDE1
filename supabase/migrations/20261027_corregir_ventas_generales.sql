-- Corrección de lógica de ventas, sin cambios de catálogo ni decisiones.
-- Aplicar después del paquete 20261023_despliegue_cierre_v19.sql.
-- Repetible. Conserva cierres previos; corrige validación y futuros cierres.
begin;

-- Mismos precios internos que js/engine/config.js: importes no negativos.
-- El motor usa 42.5 / 100 / 250 si el plan no incluye un precio explícito.
create or replace function public.side_precios_v19_validos(p_state jsonb)
returns boolean language plpgsql immutable set search_path=public as $$
declare prices jsonb:=p_state#>'{PRODUCCION_META,prices}'; k text; v jsonb;
begin
 if prices is null then return true; end if;
 if jsonb_typeof(prices) is distinct from 'object' then return false; end if;
 for k,v in select * from jsonb_each(prices) loop
  if k not in ('esencial','urbano','premium') or jsonb_typeof(v) is distinct from 'number' then return false; end if;
  if (v#>>'{}')::numeric<0 then return false; end if;
 end loop;
 return true;
end $$;

create or replace function public.side_validar_precios_v19()
returns trigger language plpgsql set search_path=public as $$
declare plan jsonb;
begin
 if not public.side_precios_v19_validos(new.snapshot->'decision_state') then
  raise exception using errcode='22023', message='PRECIO_INVALIDO: el precio interno debe ser un importe numérico no negativo.';
 end if;
 for plan in select value from jsonb_each(coalesce(new.snapshot#>'{decision_state,__cyclePlans}','{}')) loop
  if not public.side_precios_v19_validos(plan->'state') then
   raise exception using errcode='22023', message='PRECIO_INVALIDO: precio interno del plan inválido.';
  end if;
 end loop;
 return new;
end $$;

-- El resultado definitivo del ciclo prevalece sobre una fotografía preliminar
-- del mismo ciclo. Los demás períodos mantienen sus snapshots históricos.
create or replace function public.side_guardar_cierre_negocio(p_partida_id uuid,p_ciclo integer,p_token text,p_cierre jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.partidas; ctx jsonb; previo jsonb; emp jsonb; result jsonb; fin jsonb; sid bigint; snapshot_actual jsonb; next_state jsonb;
begin
 select * into p from public.partidas where id=p_partida_id and profesor_id=auth.uid() for update;
 if p.id is null then return jsonb_build_object('error','Partida no autorizada','code','NO_AUTORIZADO'); end if;
 perform pg_advisory_xact_lock(hashtext(p.id::text),p_ciclo);
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
  next_state:=coalesce(snapshot_actual->'decision_state','{}')||jsonb_build_object('__financialSnapshots',coalesce(result#>'{state,__financialSnapshots}','{}'::jsonb)||coalesce(snapshot_actual#>'{decision_state,__financialSnapshots}','{}'::jsonb)||jsonb_build_object(p_ciclo::text,fin-'history'),'__cycleSettlements',result#>'{state,__cycleSettlements}','__finishedGoods',result#>'{state,__finishedGoods}','__inventarioMP',result#>'{state,__inventarioMP}','__economicHistory',coalesce(result#>'{state,__economicHistory}','{}'::jsonb),'__accountsReceivable',coalesce(result#>'{state,__accountsReceivable}','0'::jsonb));
  update public.side_student_state set snapshot=jsonb_set(jsonb_set(jsonb_set(snapshot_actual,'{decision_state}',next_state),'{cash_ledger}',result->'ledger'),'{financial_sections}',coalesce(result->'financialSections',snapshot_actual->'financial_sections','{}'::jsonb)),revision=revision+1,updated_at=clock_timestamp() where empresa_id=sid;
  insert into public.reportes_ciclo(empresa_id,ciclo,capital,ingresos,costos,utilidad,caja_final,balance_caja,flujo_caja,estado_resultados)
  values(sid,p_ciclo,(emp->>'capital')::numeric,(fin#>>'{estadoResultados,ingresos}')::numeric,(fin#>>'{estadoResultados,costos}')::numeric,(fin#>>'{estadoResultados,utilidad}')::numeric,(fin#>>'{balanceCaja,cajaFinal}')::numeric,fin->'balanceCaja',fin->'flujoCaja',(fin->'estadoResultados')||jsonb_build_object('balanceGeneral',fin->'balanceGeneral','cycleReceipt',result->'receipt'))
  on conflict(empresa_id,ciclo) do update set ingresos=excluded.ingresos,costos=excluded.costos,utilidad=excluded.utilidad,caja_final=excluded.caja_final,balance_caja=excluded.balance_caja,flujo_caja=excluded.flujo_caja,estado_resultados=excluded.estado_resultados;
  update public.empresas set caja_actual=(fin#>>'{balanceCaja,cajaFinal}')::numeric where id=sid;
 end loop;
 return jsonb_build_object('cierre',p_cierre,'reused',false);
end $$;
revoke all on function public.side_guardar_cierre_negocio(uuid,integer,text,jsonb) from public,anon;
grant execute on function public.side_guardar_cierre_negocio(uuid,integer,text,jsonb) to authenticated;
commit;
