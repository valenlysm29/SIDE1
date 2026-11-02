begin;
create table if not exists public.side_closure_processing_status(
 partida_id uuid not null references public.partidas(id) on delete cascade,
 ciclo integer not null check(ciclo between 1 and 6),
 status text not null check(status in ('processing','error','confirmed')),
 code text,error text,attempts integer not null default 1,
 updated_at timestamptz not null default clock_timestamp(),primary key(partida_id,ciclo)
);
alter table public.side_closure_processing_status enable row level security;
revoke all on public.side_closure_processing_status from public,anon,authenticated;
create or replace function public.side_registrar_estado_cierre(p_partida_id uuid,p_ciclo integer,p_success boolean,p_pending boolean,p_code text default null,p_error text default null)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare next_status text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server only' using errcode='42501'; end if;
 if not exists(select 1 from public.partidas p where p.id=p_partida_id and p_ciclo between 1 and least(6,(p.configuracion->>'cycles')::integer)) then raise exception 'Ciclo no autorizado' using errcode='22023'; end if;
 next_status:=case when exists(select 1 from public.side_business_closures b where b.partida_id=p_partida_id and b.ciclo=p_ciclo) then 'confirmed' when p_success and p_pending then 'processing' else 'error' end;
 insert into public.side_closure_processing_status(partida_id,ciclo,status,code,error)
 values(p_partida_id,p_ciclo,next_status,left(p_code,100),left(p_error,1000))
 on conflict(partida_id,ciclo) do update set status=excluded.status,code=excluded.code,error=excluded.error,attempts=public.side_closure_processing_status.attempts+1,updated_at=clock_timestamp();
end $$;
revoke all on function public.side_registrar_estado_cierre(uuid,integer,boolean,boolean,text,text) from public,anon,authenticated;
grant execute on function public.side_registrar_estado_cierre(uuid,integer,boolean,boolean,text,text) to service_role;
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('public.side_historial_oficial(uuid,bigint)'::regprocedure);
 if position('processing_error' in definition)>0 then return; end if;
 if position('when b.partida_id is not null' in definition)=0 then raise exception 'History contract incompatible'; end if;
 definition:=replace(definition,'when b.partida_id is not null',
  'when exists(select 1 from public.side_closure_processing_status j where j.partida_id=p_partida_id and j.ciclo=n and j.status=''error'') then ''error'' when b.partida_id is not null');
 definition:=replace(definition,'''closed_at'',b.created_at,',
  '''processing_error'',(select jsonb_build_object(''code'',j.code,''message'',j.error,''updated_at'',j.updated_at) from public.side_closure_processing_status j where j.partida_id=p_partida_id and j.ciclo=n and j.status=''error''),''closed_at'',b.created_at,');
 execute definition;
end $migration$;
commit;
