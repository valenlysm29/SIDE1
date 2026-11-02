begin;
-- Feature probes are pure scalar functions. Pin their lookup path without
-- changing their results, grants, or economic/game state.
alter function public.side_game_features() set search_path=pg_catalog;
alter function public.side_excel_features() set search_path=pg_catalog;
-- Historical bootstrap files can regrant the retired financial writer. Keep
-- both persistence entry points server-only after every installation path.
revoke all on function public.side_guardar_cierre_excel(uuid,integer,text,jsonb) from public,anon,authenticated;
revoke all on function public.side_guardar_cierre_negocio(uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.side_guardar_cierre_excel(uuid,integer,text,jsonb) to service_role;
grant execute on function public.side_guardar_cierre_negocio(uuid,integer,text,jsonb) to service_role;
commit;
