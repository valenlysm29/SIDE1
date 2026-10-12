# Códigos de sala permanentes — 2026-10-11

## Evidencia y alcance

`supabase/migrations/supabase_game_codes.sql:7` define `side_next_game_code`; su consulta excluye únicamente códigos que siguen presentes en `public.partidas`. Cancelar/finalizar conserva normalmente la fila y el código no se repite, pero eliminar una fila vuelve a liberar ese código. Reproducción anterior: crear fila con un código, eliminarla y volver a insertar ese código no tiene una restricción histórica que lo impida.

El nuevo registro `side_private.codigos_sala_reservados` conserva el código normalizado como la admisión del alumno y el UUID original, sin FK ni borrado en cascada. El generador y el trigger usan el mismo bloqueo transaccional. La PK es una segunda barrera. Cambiar el código de una sala existente queda rechazado; tampoco se puede reabrir una partida finalizada/cancelada con su código antiguo. Cada creación confirmada asigna un código distinto; los reintentos idempotentes conservan la misma sala/código.

Se conserva el formato de tres caracteres y se amplía a cuatro cuando se agota. No hay códigos de ejemplo ni una sala fija. No se cancelan partidas existentes ni se altera el cálculo del simulador. El registro no es visible ni modificable para `anon` o `authenticated`; solo el dueño de la migración puede mantenerlo.

**Límite verificable:** los códigos de salas borradas antes de instalar este registro ya no están en la base y no pueden reconstruirse sin una copia de seguridad. Para garantizar también esa historia hay que recuperarla antes del despliegue. La garantía permanente cubre todas las filas existentes en el momento de aplicar la migración y todas las nuevas asignaciones desde entonces. Un administrador propietario sigue pudiendo alterar/borrar cualquier objeto SQL; los permisos de usuario de la aplicación no lo permiten.

## Pruebas locales

`node tests/codigos_sala_db.cjs`: PASS. Aplicación doble y otra repetición tras borrar salas, 12 códigos variables, cancelación/finalización/borrado no liberan códigos, inserción histórica (incluso UUID idéntico) rechazada, cambios de código rechazados, mayúsculas/tildes/espacios normalizados como admisión, seis solicitudes simultáneas en PGlite sin duplicados, denegación de SELECT/DELETE/TRUNCATE al rol autenticado y generador a anónimo, agotamiento del espacio corto con formato de cuatro caracteres. PGlite serializa consultas; el bloqueo PostgreSQL y la PK cubren la exclusión en una instalación real, sin afirmar una prueba multinodo de producción.

## Diagnóstico de solo lectura en Supabase

```sql
-- Firma existente: debe devolver side_next_game_code().
select to_regprocedure('public.side_next_game_code()');
-- Definición: antes excluye public.partidas; después el registro permanente.
select pg_get_functiondef('public.side_next_game_code()'::regprocedure);
-- Antes de instalar: ningún resultado es lo esperado (si hay filas, resolver
-- la duplicación con revisión de datos; la migración no borra información).
select public.side_normalizar_ingreso(codigo) codigo_normalizado,
       count(*), array_agg(id) partidas
from public.partidas group by 1 having count(*) > 1;
-- Columna y default: codigo con default public.side_next_game_code().
select column_name, data_type, column_default
from information_schema.columns
where table_schema='public' and table_name='partidas' and column_name='codigo';
-- Restricciones existentes y trigger nuevo.
select conname, pg_get_constraintdef(oid)
from pg_constraint where conrelid='public.partidas'::regclass;
select tgname, pg_get_triggerdef(oid)
from pg_trigger where tgrelid='public.partidas'::regclass and not tgisinternal;
```

## Orden y SQL exacto

En una instalación actualizada con lifecycle → student_admission → `20261009_sala_espera_identidad_exacta.sql` → `2026-10-11_fix_crear_partida.sql` → `2026-10-11_recuperar_salas_compatibles.sql`, ejecutar el SQL siguiente en el editor SQL de Supabase. No volver a ejecutar los generadores anteriores después, pues reemplazarían esta versión. `2026-10-11_logica_excel.sql` no es requisito del registro de códigos y no soluciona la reutilización histórica. No se ejecutó nada en producción.

```sql
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

```

## Comprobación de aplicación (solo lectura, editor administrador)

```sql
select to_regclass('side_private.codigos_sala_reservados');
-- Debe devolver la tabla; el conteo puede superar partidas por historia borrada.
select count(*) codigos_reservados from side_private.codigos_sala_reservados;
-- Debe devolver cero.
select count(*) partidas_sin_reserva
from public.partidas p left join side_private.codigos_sala_reservados r
 on r.codigo=upper(public.side_normalizar_ingreso(p.codigo)) and r.partida_id=p.id
where r.codigo is null;
-- Ambas deben ser false.
select has_table_privilege('authenticated','side_private.codigos_sala_reservados','DELETE') puede_borrar,
       has_table_privilege('authenticated','side_private.codigos_sala_reservados','TRUNCATE') puede_truncar;
-- Debe devolver el trigger side_reservar_codigo_sala.
select tgname from pg_trigger where tgrelid='public.partidas'::regclass
 and tgname='side_reservar_codigo_sala' and not tgisinternal;
```