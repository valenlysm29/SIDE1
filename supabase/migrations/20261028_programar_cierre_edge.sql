-- Apply after deploying side-business-close and 20261028_cierre_servidor.sql.
-- Project URL must match js/config.js. No service-role key is placed in SQL.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

do $$
begin
 if not exists(select 1 from vault.secrets where name='side_business_cron_token') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'side_business_cron_token','Dedicated SIDE closure scheduler token');
 end if;
end $$;

create or replace function public.side_validar_token_cierre(p_token text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if auth.role() is distinct from 'service_role' then return false; end if;
 return exists(select 1 from vault.decrypted_secrets where name='side_business_cron_token' and decrypted_secret=p_token);
end $$;
revoke all on function public.side_validar_token_cierre(text) from public,anon,authenticated;
grant execute on function public.side_validar_token_cierre(text) to service_role;

create or replace function public.side_invocar_cierre_programado()
returns bigint language plpgsql security definer set search_path=public as $$
declare token text; request_id bigint;
begin
 select decrypted_secret into token from vault.decrypted_secrets where name='side_business_cron_token';
 if token is null then raise exception 'Missing SIDE scheduler credential'; end if;
 select net.http_post(
  url:='https://plfuwfdpsagzrlveqkvl.supabase.co/functions/v1/side-business-close',
  headers:=jsonb_build_object('Content-Type','application/json','x-side-cron-token',token),
  body:='{}'::jsonb,timeout_milliseconds:=60000
 ) into request_id;
 return request_id;
end $$;
revoke all on function public.side_invocar_cierre_programado() from public,anon,authenticated,service_role;

select cron.schedule('side-business-close','* * * * *','select public.side_invocar_cierre_programado();');
commit;
