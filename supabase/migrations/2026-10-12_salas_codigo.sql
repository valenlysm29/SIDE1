-- SIDE: aplicar después de lifecycle, student_admission,
-- 20261009_sala_espera_identidad_exacta y 2026-10-11_fix_crear_partida.
-- Repetible; conserva códigos, identidades e historial existentes, incluido SIDE-000.
begin;
do $$ begin
 if to_regprocedure('public.crear_sala_docente(jsonb,text,text,text,uuid,uuid)') is null
 or to_regprocedure('public.side_admission_features()') is null then
  raise exception 'Aplica primero supabase_game_lifecycle.sql, supabase_student_admission.sql, 20261009_sala_espera_identidad_exacta.sql y 2026-10-11_fix_crear_partida.sql, en ese orden.';
 end if;
 if public.side_admission_features()->>'exactIdentityVersion' is distinct from '2'
 or public.side_admission_features()->>'waitingRoomVersion' is distinct from '3' then
  raise exception 'Reaplica 20261009_sala_espera_identidad_exacta.sql antes de esta migración.';
 end if;
end $$;

create or replace function public.side_normalizar_codigo_sala(p_codigo text)
returns text language sql immutable parallel safe set search_path=pg_catalog as $$
 select regexp_replace(upper(regexp_replace(coalesce(p_codigo,''),'[[:space:]]','','g')),
 '^SIDE-?([A-Z0-9]+)$','SIDE-\1');
$$;
revoke all on function public.side_normalizar_codigo_sala(text) from public;
grant execute on function public.side_normalizar_codigo_sala(text) to anon,authenticated;

create or replace function public.side_config_cancelada(p_config jsonb)
returns boolean language sql immutable parallel safe set search_path=pg_catalog as $$
 select coalesce(p_config->>'phase'='cancelled',false)
 or coalesce(p_config#>>'{runtime,phase}'='cancelled',false)
 or coalesce(lower(btrim(p_config->>'cancelledAt')) not in ('','false','0','null'),false);
$$;
revoke all on function public.side_config_cancelada(jsonb) from public;
grant execute on function public.side_config_cancelada(jsonb) to anon,authenticated;

create schema if not exists side_private;
revoke all on schema side_private from public,anon,authenticated;
create table if not exists side_private.codigos_sala_reservados (
 codigo text primary key, partida_id uuid not null,
 reservado_at timestamptz not null default clock_timestamp()
);
alter table side_private.codigos_sala_reservados enable row level security;
revoke all on side_private.codigos_sala_reservados from public,anon,authenticated;
lock table public.partidas in share row exclusive mode;
do $$ begin
 if exists(select 1 from public.partidas group by public.side_normalizar_codigo_sala(codigo) having count(*)>1) then
  raise exception 'Hay códigos duplicados al normalizar. Resuélvelos antes de migrar; no se cambian códigos existentes automáticamente.';
 end if;
 if exists(select 1 from public.partidas p join side_private.codigos_sala_reservados r
 on r.codigo=public.side_normalizar_codigo_sala(p.codigo) where r.partida_id<>p.id) then
  raise exception 'Un código histórico pertenece a otra partida; no se reutilizan códigos.';
 end if;
end $$;
insert into side_private.codigos_sala_reservados(codigo,partida_id)
 select public.side_normalizar_codigo_sala(codigo),id from public.partidas on conflict do nothing;
create unique index if not exists ux_side_codigo_sala_normalizado
 on public.partidas(public.side_normalizar_codigo_sala(codigo));

create or replace function public.generar_codigo_sala()
returns text language plpgsql volatile security definer set search_path=pg_catalog as $$
declare alphabet constant text:='ABCDEFGHJKMNPQRSTUVWXYZ23456789'; code text; attempt integer; n integer;
begin
 perform pg_advisory_xact_lock(731924);
 for attempt in 1..100 loop
  code:='SIDE-';
  for n in 1..6 loop
   code:=code||substr(alphabet,1+floor(random()*length(alphabet))::integer,1);
  end loop;
  if not exists(select 1 from side_private.codigos_sala_reservados r where r.codigo=code)
  and not exists(select 1 from public.partidas p where public.side_normalizar_codigo_sala(p.codigo)=code) then
   return code;
  end if;
 end loop;
 raise exception 'No se pudo asignar un código único. Reintenta crear la sala.';
end $$;
revoke all on function public.generar_codigo_sala() from public,anon;
grant execute on function public.generar_codigo_sala() to authenticated;
-- Conserva el nombre usado por clientes/migraciones anteriores.
create or replace function public.side_next_game_code()
returns text language sql volatile security definer set search_path=pg_catalog as $$
 select public.generar_codigo_sala();
$$;
revoke all on function public.side_next_game_code() from public,anon;
grant execute on function public.side_next_game_code() to authenticated;
alter table public.partidas alter column codigo set default public.generar_codigo_sala();

alter table public.partidas add column if not exists cancelled_at timestamptz;
-- Reutiliza cualquier CHECK de estado, incluso si su nombre no es el estándar.
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.partidas'::regclass
 and contype='c' and pg_get_constraintdef(oid) ~ '\mestado\M' loop
  execute format('alter table public.partidas drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.partidas add constraint partidas_estado_check
 check(estado in ('esperando','activa','finalizada','cancelada'));

create or replace function side_private.reservar_codigo_sala()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare normalized text; begin
 normalized:=public.side_normalizar_codigo_sala(new.codigo);
 if tg_op='UPDATE' then
  if old.estado in ('finalizada','cancelada') and new.estado is distinct from old.estado then
   raise exception using errcode='23514',message='Una sala terminada no puede reabrirse. Crea otra sala.';
  end if;
  if normalized is distinct from public.side_normalizar_codigo_sala(old.codigo) then
   raise exception using errcode='23505',message='El código de una sala es permanente.';
  end if;
  return new;
 end if;
 if normalized='' then normalized:=public.generar_codigo_sala(); end if;
 perform pg_advisory_xact_lock(731924);
 if exists(select 1 from side_private.codigos_sala_reservados where codigo=normalized) then
  raise exception using errcode='23505',constraint='ux_side_codigo_sala_normalizado',
   message='Este código ya fue utilizado. Crea una sala con código nuevo.';
 end if;
 new.codigo:=normalized;
 insert into side_private.codigos_sala_reservados(codigo,partida_id) values(normalized,new.id);
 return new;
end $$;
revoke all on function side_private.reservar_codigo_sala() from public,anon,authenticated;
drop trigger if exists side_reservar_codigo_sala on public.partidas;
create trigger side_reservar_codigo_sala before insert or update of codigo,estado on public.partidas
 for each row execute function side_private.reservar_codigo_sala();

-- Conserva toda la lógica de reloj/eventos instalada; añade un estado terminal.
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.crear_sala_docente(jsonb,text,text,text,uuid,uuid)'::regprocedure);
 if strpos(definition,'''ux_side_codigo_sala_normalizado''')>0 then
  null;
 elsif strpos(definition,'''partidas_codigo_key'',''ux_side_codigo_partida''')>0 then
  definition:=replace(definition,'''partidas_codigo_key'',''ux_side_codigo_partida''',
   '''partidas_codigo_key'',''ux_side_codigo_partida'',''ux_side_codigo_sala_normalizado''');
  execute definition;
 else
  raise exception 'crear_sala_docente no tiene el reintento de códigos esperado. Reaplica 2026-10-11_fix_crear_partida.sql.';
 end if;
 definition:=pg_get_functiondef('public.side_sync_game(uuid)'::regprocedure);
 if strpos(definition,'p.estado<>''finalizada''')>0 then
  definition:=replace(definition,'p.estado<>''finalizada''','p.estado not in (''finalizada'',''cancelada'')');
  execute definition;
 elsif strpos(definition,'p.estado not in (''finalizada'',''cancelada'')')=0 then
  raise exception 'side_sync_game no tiene el guard esperado. Revisa la función instalada.';
 end if;
 -- El endpoint anterior sigue disponible, pero tampoco admite salas terminales.
 definition:=pg_get_functiondef('public.ingresar_empresa(text,text,text)'::regprocedure);
 if strpos(definition,'-- SIDE terminal admission guard')=0 then
  if strpos(definition,'  select count(*) into v_exactos')=0 then
   raise exception 'ingresar_empresa no corresponde a identidad exacta v2.';
  end if;
  definition:=replace(definition,'public.side_normalizar_ingreso(p_codigo)',
   'public.side_normalizar_ingreso(public.side_normalizar_codigo_sala(p_codigo))');
  definition:=replace(definition,'public.side_normalizar_ingreso(p.codigo)',
   'public.side_normalizar_ingreso(public.side_normalizar_codigo_sala(p.codigo))');
  definition:=replace(definition,'  select count(*) into v_exactos',$guard$
  -- SIDE terminal admission guard
  if v_partida.estado='cancelada' or public.side_config_cancelada(v_partida.configuracion) then
   return jsonb_build_object('success',false,'code','PARTIDA_CANCELADA','error','La sala fue cancelada por el docente. Solicita un código nuevo.');
  end if;
  if v_partida.estado='finalizada' then
   return jsonb_build_object('success',false,'code','PARTIDA_FINALIZADA','error','La sala ya finalizó. Solicita un código nuevo.');
  end if;
  select count(*) into v_exactos$guard$);
  execute definition;
 end if;
 -- Polling/guardado deben resolver exactamente el mismo código canónico.
 definition:=pg_get_functiondef('public.side_resolver_identidad_empresa(text,text,text)'::regprocedure);
 if strpos(definition,'side_normalizar_codigo_sala(p_codigo)')=0 then
  definition:=replace(definition,'public.side_normalizar_ingreso(p_codigo)',
   'public.side_normalizar_ingreso(public.side_normalizar_codigo_sala(p_codigo))');
  definition:=replace(definition,'public.side_normalizar_ingreso(p.codigo)',
   'public.side_normalizar_ingreso(public.side_normalizar_codigo_sala(p.codigo))');
  execute definition;
 end if;
end $$;

create or replace function public.unirse_partida_por_codigo(p_codigo text,p_nombre_legal text,p_nombre_comercial text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare code text:=public.side_normalizar_codigo_sala(p_codigo); game public.partidas;
begin
 if code !~ '^SIDE-([A-Z0-9]{3,4}|[A-Z0-9]{6})$' then
  return jsonb_build_object('success',false,'code','CODIGO_INVALIDO','error','El código debe tener el formato SIDE-XXXXXX.');
 end if;
 select * into game from public.partidas where public.side_normalizar_codigo_sala(codigo)=code for update;
 if not found then
  return jsonb_build_object('success',false,'code','PARTIDA_NO_ENCONTRADA','error','No existe una sala con ese código. Comprueba el código del docente.');
 end if;
 perform public.side_sync_game(game.id);
 select * into game from public.partidas where id=game.id;
 if game.estado='cancelada' or public.side_config_cancelada(game.configuracion) then
  return jsonb_build_object('success',false,'code','PARTIDA_CANCELADA','error','La sala fue cancelada por el docente. Solicita un código nuevo.');
 end if;
 if game.estado='finalizada' then
  return jsonb_build_object('success',false,'code','PARTIDA_FINALIZADA','error','La sala ya finalizó. Solicita un código nuevo.');
 end if;
 -- La función existente serializa el alta y exige la terna exacta al reingresar.
 return public.ingresar_empresa(game.codigo,p_nombre_legal,p_nombre_comercial);
end $$;
revoke all on function public.unirse_partida_por_codigo(text,text,text) from public;
grant execute on function public.unirse_partida_por_codigo(text,text,text) to anon,authenticated;

create or replace function public.cancelar_partida(p_partida_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare game public.partidas; cancelled timestamptz:=clock_timestamp(); begin
 select * into game from public.partidas where id=p_partida_id for update;
 if not found or auth.uid() is null or game.profesor_id is distinct from auth.uid() then
  return jsonb_build_object('success',false,'code','NO_AUTORIZADO','error','Solo el docente dueño puede cancelar esta partida.');
 end if;
 if game.estado='cancelada' then return to_jsonb(game)||jsonb_build_object('serverTime',clock_timestamp()); end if;
 if game.estado not in ('esperando','activa') then
  return jsonb_build_object('success',false,'code','PARTIDA_FINALIZADA','error','La partida ya finalizó.');
 end if;
 update public.partidas set estado='cancelada',cancelled_at=cancelled,
 configuracion=configuracion||jsonb_build_object('cancelledAt',cancelled,'phase','cancelled',
 'runtime',coalesce(configuracion->'runtime','{}')||jsonb_build_object(
 'phase','cancelled','status','simulation-finished','running',false,'remaining',0))
 where id=game.id returning * into game;
 return to_jsonb(game)||jsonb_build_object('serverTime',clock_timestamp());
end $$;
revoke all on function public.cancelar_partida(uuid) from public,anon;
grant execute on function public.cancelar_partida(uuid) to authenticated;

-- No acceso directo de estudiantes a partidas ni participantes. Las RPC definer
-- resuelven únicamente la sala/identidad presentada; el docente mantiene su RLS.
alter table public.partidas enable row level security;
alter table public.participantes enable row level security;
revoke all on public.partidas from anon;
revoke all on public.participantes from anon;
revoke insert,update,delete on public.participantes from authenticated;
grant select,insert,update,delete on public.partidas to authenticated;
grant select on public.participantes to authenticated;
drop policy if exists "estudiante entra a partida" on public.participantes;
drop policy if exists "profesor ve sus partidas" on public.partidas;
create policy "profesor ve sus partidas" on public.partidas for select to authenticated using(profesor_id=auth.uid());
drop policy if exists "profesor crea partidas" on public.partidas;
create policy "profesor crea partidas" on public.partidas for insert to authenticated with check(profesor_id=auth.uid());
drop policy if exists "profesor actualiza sus partidas" on public.partidas;
create policy "profesor actualiza sus partidas" on public.partidas for update to authenticated using(profesor_id=auth.uid()) with check(profesor_id=auth.uid());
drop policy if exists "profesor elimina sus partidas" on public.partidas;
create policy "profesor elimina sus partidas" on public.partidas for delete to authenticated using(profesor_id=auth.uid());
drop policy if exists "profesor ve participantes" on public.participantes;
create policy "profesor ve participantes" on public.participantes for select to authenticated using(
 exists(select 1 from public.partidas p where p.id=participantes.partida_id and p.profesor_id=auth.uid()));
notify pgrst,'reload schema';
commit;
