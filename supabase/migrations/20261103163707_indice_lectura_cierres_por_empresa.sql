-- Exact per-company read index; the original sealed closure remains untouched.
create table if not exists side_private.official_company_closures (
 partida_id uuid not null, ciclo integer not null, empresa_id bigint not null,
 result jsonb not null, primary key(partida_id,ciclo,empresa_id)
);
alter table side_private.official_company_closures enable row level security;
revoke all on side_private.official_company_closures from public,anon,authenticated;
create or replace function side_private.index_official_company_closures()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 insert into side_private.official_company_closures(partida_id,ciclo,empresa_id,result)
 select new.partida_id,new.ciclo,j.key::bigint,j.value
 from jsonb_each(case when jsonb_typeof(new.cierre->'resultadosPorEmpresa')='object' then new.cierre->'resultadosPorEmpresa' else '{}'::jsonb end)j
 where j.key ~ '^[0-9]+$'
 on conflict(partida_id,ciclo,empresa_id) do nothing;
 return new;
end $$;
revoke all on function side_private.index_official_company_closures() from public,anon,authenticated;
drop trigger if exists side_index_official_company_closures on public.side_business_closures;
create trigger side_index_official_company_closures after insert on public.side_business_closures
for each row execute function side_private.index_official_company_closures();
insert into side_private.official_company_closures(partida_id,ciclo,empresa_id,result)
select b.partida_id,b.ciclo,j.key::bigint,j.value from public.side_business_closures b
cross join lateral jsonb_each(case when jsonb_typeof(b.cierre->'resultadosPorEmpresa')='object' then b.cierre->'resultadosPorEmpresa' else '{}'::jsonb end)j
where j.key ~ '^[0-9]+$'
on conflict(partida_id,ciclo,empresa_id) do nothing;
CREATE OR REPLACE FUNCTION public.side_historial_oficial(p_partida_id uuid, p_empresa_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare game public.partidas; teacher boolean; companies jsonb; parts text[]:=array[]::text[]; n integer; member record; sealed jsonb; market jsonb; item jsonb; closed_at timestamptz; has_closure boolean; attempt text; processing_error jsonb; status text;
begin
 if auth.uid() is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
 select * into game from public.partidas where id=p_partida_id;
 teacher:=game.profesor_id=auth.uid();
 if game.id is null or (not coalesce(teacher,false) and (p_empresa_id is null or not exists(
   select 1 from public.participantes t join side_private.student_claims c on c.empresa_id=t.empresa_id
   where t.partida_id=p_partida_id and t.empresa_id=p_empresa_id and c.owner_id=auth.uid() and t.expulsada_at is null
 ))) then raise exception 'Partida o empresa no autorizada' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',t.empresa_id,'nombre',coalesce(e.nombre_comercial,t.empresa)) order by t.empresa_id),'[]') into companies
 from public.participantes t join public.empresas e on e.id=t.empresa_id
 where t.partida_id=p_partida_id and (p_empresa_id is null or t.empresa_id=p_empresa_id);
 -- Traverse each cycle once and keep only its market document in memory.
 -- Hash/sort plans on multi-megabyte result rows spilled repeatedly to disk.
 for n in select generate_series(1,least(6,greatest(1,(game.configuracion->>'cycles')::integer))) loop
  select b.created_at into closed_at
   from public.side_business_closures b where b.partida_id=p_partida_id and b.ciclo=n;
  has_closure:=found;
  attempt:=case when not has_closure then public.side_estado_intento_cierre(p_partida_id,n) end;
  select jsonb_build_object('code',j.code,'message',j.error,'updated_at',j.updated_at) into processing_error
   from public.side_closure_processing_status j where j.partida_id=p_partida_id and j.ciclo=n and j.status='error';
  for member in select t.empresa_id from public.participantes t
   where t.partida_id=p_partida_id and t.empresa_id is not null and (p_empresa_id is null or t.empresa_id=p_empresa_id)
   order by t.empresa_id
  loop
   select r.result into item from side_private.official_company_closures r
    where r.partida_id=p_partida_id and r.ciclo=n and r.empresa_id=member.empresa_id;
   status:=case when jsonb_typeof(item->'receipt')='object'
    and jsonb_typeof(item#>'{financial,estadoResultados}')='object'
    and jsonb_typeof(item#>'{financial,balanceCaja}')='object'
    and item#>>'{receipt,round}'=n::text then 'confirmed'
    when has_closure then 'missing' when attempt is not null then attempt
    when processing_error is not null then 'error'
    when n=public.side_ciclo_actual(game.configuracion) and game.configuracion#>>'{runtime,phase}' in ('integration','decisions') then 'in_progress'
    when n>public.side_ciclo_actual(game.configuracion) then 'not_started'
    else 'pending' end;
   parts:=array_append(parts,json_build_object('partida_id',p_partida_id,'empresa_id',member.empresa_id,'ciclo',n,
    'status',status,'processing_error',processing_error,'closed_at',closed_at,'result',item)::text);
  end loop;
 end loop;
 return json_build_object('version','official-history-v1','partida_id',p_partida_id,'companies',companies,
  'cycles',('['||array_to_string(parts,',')||']')::json)::jsonb;
end $function$;
revoke all on function public.side_historial_oficial(uuid,bigint) from public,anon;
grant execute on function public.side_historial_oficial(uuid,bigint) to authenticated;
