-- Ejecutar después de lifecycle y las correcciones de creación/recuperación.
-- Los códigos históricos eliminados antes de instalar este registro solo
-- pueden recuperarse desde una copia de seguridad. No se cancela ninguna sala.
begin;
do $$ begin
 if to_regclass('public.partidas') is null
  or to_regprocedure('public.side_normalizar_ingreso(text)') is null then
  raise exception 'Aplica primero supabase_game_lifecycle.sql y supabase_student_admission.sql antes del registro permanente de códigos.';
 end if;
end $$;
create schema if not exists side_private;
revoke all on schema side_private from public, anon, authenticated;
create table if not exists side_private.codigos_sala_reservados (
 codigo text primary key,
 partida_id uuid not null,
 reservado_at timestamptz not null default clock_timestamp()
);
-- Sin FK: borrar una partida nunca libera su código.
alter table side_private.codigos_sala_reservados enable row level security;
revoke all on side_private.codigos_sala_reservados from public, anon, authenticated;
lock table public.partidas in share row exclusive mode;
do $$ begin
 if exists(select 1 from public.partidas group by upper(public.side_normalizar_ingreso(codigo)) having count(*)>1) then
  raise exception 'Hay códigos de sala duplicados al normalizar mayúsculas y espacios. Revisa las partidas antes de aplicar esta migración.';
 end if;
 if exists(select 1 from public.partidas p join side_private.codigos_sala_reservados r
  on r.codigo=upper(public.side_normalizar_ingreso(p.codigo)) where r.partida_id<>p.id) then
  raise exception 'Un código histórico reservado pertenece a otra partida. No se reutilizan códigos.';
 end if;
end $$;
insert into side_private.codigos_sala_reservados(codigo,partida_id)
 select upper(public.side_normalizar_ingreso(codigo)),id from public.partidas on conflict(codigo) do nothing;

create or replace function public.side_next_game_code()
returns text language plpgsql volatile security definer set search_path=pg_catalog as $$
declare
 code text; letters constant text:='ABCDEFGHJKLMNPQRSTUVWXYZ';
 digits constant text:='23456789'; alphabet constant text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
 perform pg_advisory_xact_lock(731924);
 select candidate into code from (
  select 'SIDE-'||substr(letters,a,1)||substr(letters,b,1)||substr(digits,d,1) candidate
  from generate_series(1,length(letters)) a cross join generate_series(1,length(letters)) b
  cross join generate_series(1,length(digits)) d
 ) codes where not exists(select 1 from side_private.codigos_sala_reservados r where r.codigo=codes.candidate)
 order by random() limit 1;
 if code is null then
  select candidate into code from (
   select 'SIDE-'||substr(alphabet,a,1)||substr(alphabet,b,1)||substr(alphabet,c,1)||substr(alphabet,d,1) candidate
   from generate_series(1,length(alphabet)) a cross join generate_series(1,length(alphabet)) b
   cross join generate_series(1,length(alphabet)) c cross join generate_series(1,length(alphabet)) d
  ) codes where not exists(select 1 from side_private.codigos_sala_reservados r where r.codigo=codes.candidate)
  order by random() limit 1;
 end if;
 if code is null then
  raise exception 'Se agotaron los códigos de sala disponibles. Contacta al administrador; no se reutilizarán códigos históricos.';
 end if;
 return code;
end $$;
revoke all on function public.side_next_game_code() from public,anon;
grant execute on function public.side_next_game_code() to authenticated;
alter table public.partidas alter column codigo set default public.side_next_game_code();

create or replace function side_private.reservar_codigo_sala()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare normalized text; registered uuid;
begin
 normalized:=upper(public.side_normalizar_ingreso(new.codigo));
 if tg_op='UPDATE' then
  if old.estado='finalizada' and new.estado is distinct from 'finalizada' then
   raise exception using errcode='23514',message='Una sala finalizada o cancelada no puede reabrirse. Crea otra sala para obtener un código nuevo.';
  end if;
  if normalized is distinct from upper(public.side_normalizar_ingreso(old.codigo)) then
   raise exception using errcode='23505',message='El código de una sala es permanente. Crea otra sala para obtener un código nuevo.';
  end if;
  return new;
 end if;
 if normalized is null or normalized='' then
  new.codigo:=public.side_next_game_code(); normalized:=new.codigo;
 end if;
 perform pg_advisory_xact_lock(731924);
 select partida_id into registered from side_private.codigos_sala_reservados where codigo=normalized;
 if found then
  raise exception using errcode='23505',message='Este código de sala ya fue utilizado y no puede volver a asignarse.';
 end if;
 new.codigo:=normalized;
 insert into side_private.codigos_sala_reservados(codigo,partida_id) values(normalized,new.id);
 return new;
end $$;
revoke all on function side_private.reservar_codigo_sala() from public,anon,authenticated;
drop trigger if exists side_reservar_codigo_sala on public.partidas;
create trigger side_reservar_codigo_sala before insert or update of codigo,estado on public.partidas
 for each row execute function side_private.reservar_codigo_sala();
commit;
