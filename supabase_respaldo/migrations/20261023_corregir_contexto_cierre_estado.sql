-- Reparación para instalaciones que ya aplicaron 20261023_cierre_negocio.sql.
-- empresas no posee estado; la expulsión pertenece a participantes.expulsada_at.
-- Ejecutar después de instalar el cierre de negocio. Repetible sin cambiar datos.
begin;
create or replace function public.side_contexto_cierre_negocio(p_partida_id uuid,p_ciclo integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.partidas; empresas jsonb; previo jsonb;
begin
 select * into p from public.partidas where id=p_partida_id and profesor_id=auth.uid();
 if p.id is null then return jsonb_build_object('error','Partida no autorizada','code','NO_AUTORIZADO'); end if;
 if p_ciclo is null or p_ciclo<1 or p_ciclo>public.side_ciclo_actual(p.configuracion) then return jsonb_build_object('error','Ciclo inválido','code','CICLO_DESACTUALIZADO'); end if;
 if p_ciclo=public.side_ciclo_actual(p.configuracion) and coalesce(p.configuracion#>>'{runtime,phase}','decisions') not in ('results','finished') then return jsonb_build_object('error','El ciclo todavía está en decisiones','code','CICLO_ABIERTO'); end if;
 select cierre into previo from public.side_business_closures where partida_id=p.id and ciclo=p_ciclo;
 if previo is not null then return jsonb_build_object('cierre',previo); end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id::text,'capital',e.caja_inicial,'revision',s.revision,'snapshot',s.snapshot) order by e.id),'[]')
 into empresas from public.empresas e join public.participantes t on t.empresa_id=e.id
 join public.side_student_state s on s.empresa_id=e.id
 where t.partida_id=p.id and t.expulsada_at is null
 and s.snapshot#>array['decision_state','__cyclePlans',p_ciclo::text] is not null;
 -- An empty context can mean confirmations have not reached the server yet.
 -- Keep it retryable instead of freezing an empty, irreversible market closure.
 if jsonb_array_length(empresas)=0 and exists(
  select 1 from public.participantes t where t.partida_id=p.id
  and t.empresa_id is not null and t.expulsada_at is null
 ) then return jsonb_build_object('error','No hay planes del ciclo sincronizados todavía. Reintenta cuando se confirmen.','code','SIN_PLANES_CONFIRMADOS'); end if;
 if exists(select 1 from jsonb_array_elements(empresas) x where
  jsonb_typeof(x#>array['snapshot','decision_state','__cyclePlans',p_ciclo::text]) is distinct from 'object'
  or jsonb_typeof(x#>array['snapshot','decision_state','__cyclePlans',p_ciclo::text,'state']) is distinct from 'object'
 ) then return jsonb_build_object('error','Hay planes de ciclo incompletos. Deben sincronizarse antes del cierre.','code','PLANES_PENDIENTES'); end if;
 return jsonb_build_object('empresas',empresas,'financialConfig',p.configuracion,'token',md5(empresas::text||p_ciclo::text||p.configuracion::text));
end $$;

revoke all on function public.side_contexto_cierre_negocio(uuid,integer) from public,anon;
grant execute on function public.side_contexto_cierre_negocio(uuid,integer) to authenticated;
commit;
