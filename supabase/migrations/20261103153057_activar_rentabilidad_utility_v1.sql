-- Activate the validated policy at the database boundary, including direct inserts.
-- Closed receipts/reports and completed games are never updated.
create or replace function public.side_utility_defaults_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if new.configuracion->>'lifecycleVersion' is distinct from '2' then return new; end if;
 if tg_op='INSERT' and nullif(new.configuracion->>'economicRulesVersion','') is null then
  new.configuracion:=new.configuracion||jsonb_build_object('economicRulesVersion','utility-v1','economicRulesEffectiveRound',1);
 elsif tg_op='UPDATE' and old.configuracion->>'economicRulesVersion'='utility-v1' then
  -- Stale clients may save their older copy of configuration. Keep activation.
  new.configuracion:=new.configuracion||jsonb_build_object('economicRulesVersion','utility-v1',
   'economicRulesEffectiveRound',coalesce(old.configuracion->'economicRulesEffectiveRound','1'::jsonb));
 end if;
 return new;
end $$;
revoke all on function public.side_utility_defaults_v1() from public;
drop trigger if exists zz_side_utility_defaults_v1 on public.partidas;
create trigger zz_side_utility_defaults_v1 before insert or update of configuracion on public.partidas
for each row execute function public.side_utility_defaults_v1();

-- Lock games before reading seals; the close writer also locks its game row.
do $$
declare p record; effective integer;
begin
 for p in select id,configuracion from public.partidas
  where estado in ('activa','esperando') and configuracion->>'lifecycleVersion'='2'
   and nullif(configuracion->>'economicRulesVersion','') is null
  order by id for update
 loop
  select coalesce(max(ciclo),0)+1 into effective from (
   select ciclo from public.side_business_closures where partida_id=p.id
   union all select ciclo from public.side_excel_cierres where partida_id=p.id
  ) sealed;
  if effective<=coalesce((p.configuracion->>'cycles')::integer,1) then
   update public.partidas set configuracion=configuracion||jsonb_build_object(
    'economicRulesVersion','utility-v1','economicRulesEffectiveRound',effective)
   where id=p.id;
  end if;
 end loop;
end $$;
