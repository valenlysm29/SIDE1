-- Preserve existing selections and schedules. Prevent new legacy cost events
-- until a versioned, independently verifiable cost base is available.
create or replace function public.side_restringir_costos_historicos()
returns trigger language plpgsql set search_path=pg_catalog as $$
declare old_enabled jsonb:='[]'::jsonb; forbidden text[]:=array['PE15','PE16','PE20','PE21','PE25','PE27','PE29','PE32','PE34','PE36','PE40','PE41','PE43','PE45','PE46','PE47','PE48','PE49','PE50','PE51','PE52','PE53','PE54','PE55','PE56','PE57','PE58','PE59','PE60','PE62','PE63','PE72','PE73','PE78','PE87'];
begin
 if tg_op='UPDATE' then old_enabled:=coalesce(old.configuracion->'enabledEvents','[]'::jsonb); end if;
 if new.configuracion->>'lifecycleVersion'='2' and coalesce(new.configuracion->>'economicEventsVersion','')='' and exists(
   select 1 from jsonb_array_elements_text(coalesce(new.configuracion->'enabledEvents','[]'::jsonb)) e(id)
   where e.id=any(forbidden) and not old_enabled ? e.id
 ) then raise exception 'Este evento de costos aún no está disponible para nuevas programaciones.' using errcode='23514'; end if;
 return new;
end $$;
drop trigger if exists zz_side_restringir_costos_historicos on public.partidas;
create trigger zz_side_restringir_costos_historicos before insert or update of configuracion on public.partidas
for each row execute function public.side_restringir_costos_historicos();
