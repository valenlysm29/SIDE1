begin;
create table public.side_closure_execution_requests (
 run_id uuid primary key, request_id bigint not null unique, started_at timestamptz not null default clock_timestamp()
);
create table public.side_closure_execution_attempts (
 partida_id uuid not null references public.partidas(id), ciclo integer not null check(ciclo between 1 and 6),
 run_id uuid not null references public.side_closure_execution_requests(run_id),
 started_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 finished_at timestamptz, outcome text, primary key(partida_id,ciclo)
);
alter table public.side_closure_execution_requests enable row level security;
alter table public.side_closure_execution_attempts enable row level security;
revoke all on public.side_closure_execution_requests,public.side_closure_execution_attempts from public,anon,authenticated;
create or replace function public.side_invocar_cierre_programado() returns bigint language plpgsql security definer set search_path=pg_catalog as $$
declare token text; req bigint; run uuid:=gen_random_uuid();
begin
 select decrypted_secret into token from vault.decrypted_secrets where name='side_business_cron_token';
 if token is null then raise exception 'Missing SIDE scheduler credential'; end if;
 select net.http_post(url:='https://plfuwfdpsagzrlveqkvl.supabase.co/functions/v1/side-business-close',headers:=jsonb_build_object('Content-Type','application/json','x-side-cron-token',token),body:=jsonb_build_object('run_id',run),timeout_milliseconds:=60000) into req;
 insert into public.side_closure_execution_requests(run_id,request_id) values(run,req);
 return req;
end $$;
create function public.side_iniciar_intento_cierre(p_run uuid,p_partida uuid,p_ciclo integer) returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare a public.side_closure_execution_attempts; previous_request bigint;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server only' using errcode='42501'; end if;
 if not exists(select 1 from public.side_closure_execution_requests where run_id=p_run) then raise exception 'Ejecución no registrada'; end if;
 perform pg_advisory_xact_lock(hashtext(p_partida::text),p_ciclo);
 if exists(select 1 from public.side_business_closures where partida_id=p_partida and ciclo=p_ciclo) then return false; end if;
 select * into a from public.side_closure_execution_attempts where partida_id=p_partida and ciclo=p_ciclo for update;
 if a.run_id is not null and a.finished_at is null then
  select request_id into previous_request from public.side_closure_execution_requests where run_id=a.run_id;
  if not exists(select 1 from net._http_response where id=previous_request) then return false; end if;
 end if;
 insert into public.side_closure_execution_attempts(partida_id,ciclo,run_id) values(p_partida,p_ciclo,p_run)
 on conflict(partida_id,ciclo) do update set run_id=excluded.run_id,started_at=clock_timestamp(),updated_at=clock_timestamp(),finished_at=null,outcome=null;
 return true;
end $$;
create function public.side_finalizar_intento_cierre(p_run uuid,p_partida uuid,p_ciclo integer,p_success boolean,p_pending boolean,p_code text,p_error text) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server only' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext(p_partida::text),p_ciclo);
 update public.side_closure_execution_attempts set updated_at=clock_timestamp(),finished_at=clock_timestamp(),outcome=case when exists(select 1 from public.side_business_closures where partida_id=p_partida and ciclo=p_ciclo) then 'confirmed' when p_pending then 'pending' else 'error' end where partida_id=p_partida and ciclo=p_ciclo and run_id=p_run and finished_at is null;
 if found then perform public.side_registrar_estado_cierre(p_partida,p_ciclo,p_success,p_pending,p_code,p_error); end if;
end $$;
revoke all on function public.side_iniciar_intento_cierre(uuid,uuid,integer),public.side_finalizar_intento_cierre(uuid,uuid,integer,boolean,boolean,text,text) from public,anon,authenticated;
grant execute on function public.side_iniciar_intento_cierre(uuid,uuid,integer),public.side_finalizar_intento_cierre(uuid,uuid,integer,boolean,boolean,text,text) to service_role;
commit;
