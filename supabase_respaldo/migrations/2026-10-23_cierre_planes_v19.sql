-- Aplicación MANUAL: después de 20261023_cierre_negocio.sql y su reparación.
-- No ejecutado en producción. No recalcula ni modifica cierres históricos.
-- SUPUESTO: 30s de gracia de sincronización en automático, configurable en
-- partidas.configuracion.planSyncGraceSeconds (0..300). Manual: cierre explícito.
-- Reversión de funciones: reaplicar 20261023_cierre_negocio.sql y
-- 20261023_corregir_contexto_cierre_estado.sql; DROP TRIGGER IF EXISTS
-- side_validar_precios_v19 ON public.side_student_state; conservar datos.
-- Las expulsiones/réplicas ya resueltas requieren revisión humana para revertir.
begin;

create or replace function public.side_precios_v19_validos(p_state jsonb)
returns boolean language plpgsql immutable set search_path=public as $$
declare prices jsonb:=p_state#>'{PRODUCCION_META,prices}'; k text; v jsonb; price numeric;
begin
 if prices is null then return true; end if; -- Legacy: defaults del motor v19.
 if jsonb_typeof(prices) is distinct from 'object' then return false; end if;
 for k,v in select * from jsonb_each(prices) loop
  if k not in ('esencial','urbano','premium') or jsonb_typeof(v) is distinct from 'number' then return false; end if;
  price:=(v#>>'{}')::numeric;
  if (k='esencial' and (price<40 or price>45))
   or (k='urbano' and (price<120 or price>200))
   or (k='premium' and (price<220 or price>400)) then return false; end if;
 end loop;
 return true;
end $$;

create or replace function public.side_validar_precios_v19()
returns trigger language plpgsql set search_path=public as $$
declare plan jsonb;
begin
 if not public.side_precios_v19_validos(new.snapshot->'decision_state') then
  raise exception using errcode='22023', message='PRECIO_INVALIDO: Económico 40–45; Medio 120–200; Premium 220–400.';
 end if;
 for plan in select value from jsonb_each(coalesce(new.snapshot#>'{decision_state,__cyclePlans}','{}')) loop
  if not public.side_precios_v19_validos(plan->'state') then
   raise exception using errcode='22023', message='PRECIO_INVALIDO: precio del plan fuera del rango del segmento.';
  end if;
 end loop;
 return new;
end $$;
drop trigger if exists side_validar_precios_v19 on public.side_student_state;
create trigger side_validar_precios_v19 before insert or update of snapshot
 on public.side_student_state for each row execute function public.side_validar_precios_v19();

create or replace function public.side_contexto_cierre_negocio(p_partida_id uuid,p_ciclo integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.partidas; empresas jsonb; previo jsonb; row record;
 snap jsonb; ds jsonb; plans jsonb; saved jsonb; previous_plan jsonb;
 previous_round integer; rebuilt jsonb; field record; grace integer; deadline timestamptz;
begin
 select * into p from public.partidas where id=p_partida_id and profesor_id=auth.uid() for update;
 if p.id is null then return jsonb_build_object('error','Partida no autorizada','code','NO_AUTORIZADO'); end if;
 perform pg_advisory_xact_lock(hashtext(p.id::text),p_ciclo);
 if p_ciclo is null or p_ciclo<1 or p_ciclo>public.side_ciclo_actual(p.configuracion) then return jsonb_build_object('error','Ciclo inválido','code','CICLO_DESACTUALIZADO'); end if;
 if p_ciclo=public.side_ciclo_actual(p.configuracion) and coalesce(p.configuracion#>>'{runtime,phase}','decisions') not in ('results','finished') then return jsonb_build_object('error','El ciclo todavía está en decisiones','code','CICLO_ABIERTO'); end if;
 select cierre into previo from public.side_business_closures where partida_id=p.id and ciclo=p_ciclo;
 if previo is not null then return jsonb_build_object('cierre',previo); end if;
 if p.configuracion->>'cycleCloseMode'='automatic' then
  grace:=30;
  if coalesce(p.configuracion->>'planSyncGraceSeconds','') ~ '^[0-9]{1,3}$' then grace:=least(300,(p.configuracion->>'planSyncGraceSeconds')::integer); end if;
  deadline:=nullif(p.configuracion->>'gameStartAt','')::timestamptz
   +make_interval(secs=>p_ciclo*greatest(60,coalesce((p.configuracion->>'roundHours')::integer,0)*3600+coalesce((p.configuracion->>'roundMinutes')::integer,10)*60));
  if deadline is null then return jsonb_build_object('error','Falta referencia de tiempo del servidor','code','RELOJ_INVALIDO'); end if;
  if clock_timestamp()<deadline+make_interval(secs=>grace) then return jsonb_build_object('error','Esperando confirmaciones en tránsito','code','PLANES_EN_GRACIA'); end if;
 end if;
 -- Resolver TODAS las empresas antes del reparto: nunca congelar un subconjunto.
 for row in select t.id as participante_id,t.empresa_id,s.snapshot from public.participantes t
  left join public.side_student_state s on s.empresa_id=t.empresa_id
  where t.partida_id=p.id and t.empresa_id is not null and t.expulsada_at is null
  order by t.empresa_id for update of t loop
  -- Freeze the latest snapshot before rebuilding it; do not overwrite a
  -- confirmation acknowledged while the roster query was in flight.
  select s.snapshot into snap from public.side_student_state s where s.empresa_id=row.empresa_id for update;
  snap:=coalesce(snap,'{}');ds:=coalesce(snap->'decision_state','{}');plans:=coalesce(ds->'__cyclePlans','{}');
  saved:=plans->p_ciclo::text;
  if saved is not null then
   if jsonb_typeof(saved) is distinct from 'object' or jsonb_typeof(saved->'state') is distinct from 'object' then
    return jsonb_build_object('error','Hay planes de ciclo incompletos','code','PLANES_PENDIENTES');
   end if;
   if not public.side_precios_v19_validos(saved->'state') then return jsonb_build_object('error','Precio fuera del rango del segmento','code','PRECIO_INVALIDO'); end if;
   continue;
  end if;
  -- Whitelist antigua no conserva snapshot.round. Se acredita el ciclo con
  -- las decisiones confirmadas de ese ciclo; un flag viejo no acredita envío.
  if snap->>'decisions_submitted'='true' and exists(
   select 1 from jsonb_each(ds) d where left(d.key,2)<>'__' and d.value->>'round'=p_ciclo::text
  ) then
   rebuilt:=ds-'__cyclePlans';saved:=jsonb_build_object('state',rebuilt,'source','recovered-confirmation');
  else
   select max(key::integer) into previous_round from jsonb_each(plans)
    where key ~ '^[0-9]{1,5}$' and key::integer<p_ciclo and jsonb_typeof(value->'state')='object';
   if previous_round is null then
    update public.participantes set expulsada_at=clock_timestamp() where id=row.participante_id and expulsada_at is null;
    continue;
   end if;
   previous_plan:=plans->previous_round::text;rebuilt:=previous_plan->'state';
   for field in select key,value from jsonb_each(rebuilt) loop
    if left(field.key,2)<>'__' and jsonb_typeof(field.value)='object' and field.value->>'round'=previous_round::text then
     rebuilt:=jsonb_set(rebuilt,array[field.key,'round'],to_jsonb(p_ciclo));
    end if;
   end loop;
   -- Inventarios y contabilidad actuales prevalecen sobre el plan anterior.
   for field in select key,value from jsonb_each(ds) where left(key,2)='__' and key<>'__cyclePlans' loop
    rebuilt:=jsonb_set(rebuilt,array[field.key],field.value);
   end loop;
   saved:=jsonb_build_object('state',rebuilt,'source','replicated','fromRound',previous_round);
  end if;
  if not public.side_precios_v19_validos(saved->'state') then return jsonb_build_object('error','Precio fuera del rango del segmento','code','PRECIO_INVALIDO'); end if;
  plans:=jsonb_set(plans,array[p_ciclo::text],saved);ds:=jsonb_set(ds,'{__cyclePlans}',plans);
  snap:=jsonb_set(snap,'{decision_state}',ds);
  insert into public.side_student_state(empresa_id,snapshot,revision) values(row.empresa_id,snap,1)
   on conflict(empresa_id) do update set snapshot=excluded.snapshot,revision=public.side_student_state.revision+1,updated_at=clock_timestamp();
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id::text,'capital',e.caja_inicial,'revision',s.revision,'snapshot',s.snapshot) order by e.id),'[]')
 into empresas from public.empresas e join public.participantes t on t.empresa_id=e.id
 join public.side_student_state s on s.empresa_id=e.id
 where t.partida_id=p.id and t.expulsada_at is null;
 return jsonb_build_object('empresas',empresas,'financialConfig',p.configuracion,'token',md5(empresas::text||p_ciclo::text||p.configuracion::text),'modelVersion','excel-v19');
end $$;

-- Persistencia v19: misma transacción CAS y snapshots, más estado económico.
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
  next_state:=coalesce(snapshot_actual->'decision_state','{}')||jsonb_build_object('__financialSnapshots',coalesce(result#>'{state,__financialSnapshots}','{}'::jsonb)||jsonb_build_object(p_ciclo::text,fin-'history')||coalesce(snapshot_actual#>'{decision_state,__financialSnapshots}','{}'::jsonb),'__cycleSettlements',result#>'{state,__cycleSettlements}','__finishedGoods',result#>'{state,__finishedGoods}','__inventarioMP',result#>'{state,__inventarioMP}','__economicHistory',coalesce(result#>'{state,__economicHistory}','{}'::jsonb),'__accountsReceivable',coalesce(result#>'{state,__accountsReceivable}','0'::jsonb));
  update public.side_student_state set snapshot=jsonb_set(jsonb_set(jsonb_set(snapshot_actual,'{decision_state}',next_state),'{cash_ledger}',result->'ledger'),'{financial_sections}',coalesce(result->'financialSections',snapshot_actual->'financial_sections','{}'::jsonb)),revision=revision+1,updated_at=clock_timestamp() where empresa_id=sid;
  insert into public.reportes_ciclo(empresa_id,ciclo,capital,ingresos,costos,utilidad,caja_final,balance_caja,flujo_caja,estado_resultados)
  values(sid,p_ciclo,(emp->>'capital')::numeric,(fin#>>'{estadoResultados,ingresos}')::numeric,(fin#>>'{estadoResultados,costos}')::numeric,(fin#>>'{estadoResultados,utilidad}')::numeric,(fin#>>'{balanceCaja,cajaFinal}')::numeric,fin->'balanceCaja',fin->'flujoCaja',(fin->'estadoResultados')||jsonb_build_object('balanceGeneral',fin->'balanceGeneral','cycleReceipt',result->'receipt'))
  on conflict(empresa_id,ciclo) do update set ingresos=excluded.ingresos,costos=excluded.costos,utilidad=excluded.utilidad,caja_final=excluded.caja_final,balance_caja=excluded.balance_caja,flujo_caja=excluded.flujo_caja,estado_resultados=excluded.estado_resultados;
  update public.empresas set caja_actual=(fin#>>'{balanceCaja,cajaFinal}')::numeric where id=sid;
 end loop;
 return jsonb_build_object('cierre',p_cierre,'reused',false);
end $$;
revoke all on function public.side_contexto_cierre_negocio(uuid,integer) from public,anon;
revoke all on function public.side_guardar_cierre_negocio(uuid,integer,text,jsonb) from public,anon;
grant execute on function public.side_contexto_cierre_negocio(uuid,integer) to authenticated;
grant execute on function public.side_guardar_cierre_negocio(uuid,integer,text,jsonb) to authenticated;

-- Diagnóstico sin datos empresariales ni mutaciones. Sólo usuarios autenticados.
create or replace function public.side_diagnostico_v19()
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('version','excel-v19','serverTime',clock_timestamp(),
  'authenticated',auth.uid() is not null,
  'functions',jsonb_build_object(
   'context',to_regprocedure('public.side_contexto_cierre_negocio(uuid,integer)') is not null,
   'save',to_regprocedure('public.side_guardar_cierre_negocio(uuid,integer,text,jsonb)') is not null,
   'prices',to_regprocedure('public.side_precios_v19_validos(jsonb)') is not null,
   'configurationCAS',to_regprocedure('public.side_guardar_configuracion_v19(uuid,jsonb,bigint)') is not null),
  'columns',jsonb_build_object(
   'expulsada_at',exists(select 1 from information_schema.columns where table_schema='public' and table_name='participantes' and column_name='expulsada_at'),
   'revision',exists(select 1 from information_schema.columns where table_schema='public' and table_name='side_student_state' and column_name='revision'),
   'updated_at',exists(select 1 from information_schema.columns where table_schema='public' and table_name='side_student_state' and column_name='updated_at'),
   'config_revision',exists(select 1 from information_schema.columns where table_schema='public' and table_name='partidas' and column_name='config_revision')),
  'legacyTriggers',coalesce((select jsonb_agg(tgname) from pg_trigger where not tgisinternal and tgname in ('side_excel_snapshot_protegido','side_excel_reporte_protegido')),'[]'::jsonb),
  'rls',coalesce((select jsonb_agg(jsonb_build_object('table',c.relname,'enabled',c.relrowsecurity,'policies',(select count(*) from pg_policy p where p.polrelid=c.oid))) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('side_student_state','side_business_closures','participantes','empresas')),'[]'::jsonb))
 where auth.uid() is not null
$$;
revoke all on function public.side_diagnostico_v19() from public,anon;
grant execute on function public.side_diagnostico_v19() to authenticated;
commit;
