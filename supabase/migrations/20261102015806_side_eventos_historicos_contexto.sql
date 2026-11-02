-- Read-only input for a future versioned worker. This does not enable events
-- or modify a game. Missing draws remain an error; this function never rerolls.
create function public.side_legacy_event_context_v1(p_partida_id uuid,p_empresa_id bigint,p_ciclo integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare cfg jsonb; enabled jsonb; schedule jsonb; group_rows jsonb:='{}'; individual_rows jsonb:='{}';
  needs_group boolean; needs_individual boolean; n integer; group_events jsonb; individual_events jsonb;
begin
  select p.configuracion into cfg from public.partidas p where p.id=p_partida_id;
  if cfg is null or not exists(select 1 from public.participantes t where t.partida_id=p_partida_id and t.empresa_id=p_empresa_id and t.expulsada_at is null) then
    return jsonb_build_object('error','Contexto no disponible','code','EVENTOS_NO_VERIFICADOS');
  end if;
  if cfg->>'economicRulesVersion' is distinct from 'utility-v1' or p_ciclo is null or p_ciclo<1 or p_ciclo>6
     or coalesce(cfg->>'cycles','') !~ '^[1-6]$' or p_ciclo>(cfg->>'cycles')::integer then
    return jsonb_build_object('error','Versión o ciclo no válido','code','EVENTOS_NO_VERIFICADOS');
  end if;
  enabled:=coalesce(cfg->'enabledEvents','[]'::jsonb);schedule:=coalesce(cfg->'eventSchedule','{}'::jsonb);
  if jsonb_typeof(enabled) is distinct from 'array' or jsonb_typeof(schedule) is distinct from 'object' then
    return jsonb_build_object('error','Programación no verificable','code','EVENTOS_NO_VERIFICADOS');
  end if;
  if exists(select 1 from jsonb_array_elements_text(enabled) e(id) left join public.side_event_catalog c on c.id=e.id where c.id is null) then
    return jsonb_build_object('error','Evento desconocido','code','EVENTOS_NO_VERIFICADOS');
  end if;
  select exists(select 1 from public.side_event_catalog c where c.scope='group' and enabled ? c.id),
         exists(select 1 from public.side_event_catalog c where c.scope='individual' and enabled ? c.id)
    into needs_group,needs_individual;
  for n in 1..p_ciclo loop
    group_events:=schedule->n::text->'group';
    if needs_group and jsonb_typeof(group_events) is distinct from 'array' then
      return jsonb_build_object('error','Sorteo grupal no verificado','code','EVENTOS_NO_VERIFICADOS');
    end if;
    select h.events into individual_events from public.side_individual_event_schedule h where h.empresa_id=p_empresa_id and h.ciclo=n;
    if needs_individual and jsonb_typeof(individual_events) is distinct from 'array' then
      return jsonb_build_object('error','Sorteo individual no verificado','code','EVENTOS_NO_VERIFICADOS');
    end if;
    group_rows:=jsonb_set(group_rows,array[n::text],coalesce(group_events,'[]'::jsonb));
    individual_rows:=jsonb_set(individual_rows,array[n::text],coalesce(individual_events,'[]'::jsonb));
    individual_events:=null;
  end loop;
  return jsonb_build_object('version','legacy-event-context-v1','cycle',p_ciclo,'companyId',p_empresa_id::text,
    'enabledEvents',enabled,'groupByCycle',group_rows,'individualByCycle',individual_rows);
end $$;
revoke all on function public.side_legacy_event_context_v1(uuid,bigint,integer) from public,anon,authenticated;
grant execute on function public.side_legacy_event_context_v1(uuid,bigint,integer) to service_role;
