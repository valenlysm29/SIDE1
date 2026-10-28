-- Cierre sin plan: no expulsar, guardar producción cero. Aplicar después de 20261028_cierre_servidor.sql.
-- SIDE v19: si falta el plan, mantener la empresa activa y cerrar con producción cero.
-- Aplicar después de 20261028_cierre_servidor.sql.
-- No altera cierres guardados ni reincorpora empresas expulsadas previamente.
begin;

create or replace function public.side_contexto_cierre_negocio(p_partida_id uuid,p_ciclo integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.partidas; empresas jsonb; previo jsonb; row record;
 snap jsonb; ds jsonb; plans jsonb; saved jsonb; previous_plan jsonb;
 previous_round integer; rebuilt jsonb; field record; grace integer; deadline timestamptz;
begin
 select * into p from public.partidas where id=p_partida_id and (profesor_id=auth.uid() or auth.role()='service_role') for update;
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
 -- Resolver todas las empresas antes de congelar el mercado.
 for row in select t.id as participante_id,t.empresa_id,t.empresa as empresa_nombre,s.snapshot from public.participantes t
  left join public.side_student_state s on s.empresa_id=t.empresa_id
  where t.partida_id=p.id and t.empresa_id is not null and t.expulsada_at is null
  order by t.empresa_id for update of t loop
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
  if snap->>'decisions_submitted'='true' and exists(
   select 1 from jsonb_each(ds) d where left(d.key,2)<>'__' and d.value->>'round'=p_ciclo::text
  ) then
   rebuilt:=ds-'__cyclePlans';saved:=jsonb_build_object('state',rebuilt,'source','recovered-confirmation');
  else
   -- Un plan ausente no expulsa ni bloquea el cierre. Se conservan las
   -- decisiones e inventarios, pero no se inventa producción para este ciclo.
   rebuilt:=ds-'__cyclePlans';
   rebuilt:=jsonb_set(rebuilt,'{PRODUCCION_META}',jsonb_build_object('round',p_ciclo,'moldTargets',jsonb_build_object('molde_1',0,'molde_2',0,'molde_3',0)));
   saved:=jsonb_build_object('state',rebuilt,'source','no-plan');
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

revoke all on function public.side_contexto_cierre_negocio(uuid,integer) from public,anon,authenticated;
grant execute on function public.side_contexto_cierre_negocio(uuid,integer) to service_role;
commit;
