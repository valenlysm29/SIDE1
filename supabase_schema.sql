-- ============================================================
-- SIDE — Base de datos inicial para un proyecto Supabase NUEVO
-- Ejecuta TODO este archivo en Supabase > SQL Editor.
-- NO contiene ninguna línea de nombre de archivo antes del SQL.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- PROFESORES
-- ------------------------------------------------------------
create table if not exists public.profesores (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  apellido text not null,
  curso text,
  correo text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- PARTIDAS
-- ------------------------------------------------------------
create table if not exists public.partidas (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references public.profesores(id) on delete cascade,
  nombre text not null,
  codigo text not null unique default ('SIDE-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,4))),
  curso text,
  segmento text not null default 'Estandar' check (segmento in ('Economico','Estandar','Premium')),
  estado text not null default 'esperando'
    check (estado in ('esperando','activa','finalizada')),
  created_at timestamptz not null default now()
);

-- Migración segura si la tabla partidas ya existía
alter table public.partidas add column if not exists segmento text not null default 'Estandar';
alter table public.partidas drop constraint if exists partidas_segmento_check;
alter table public.partidas add constraint partidas_segmento_check check (segmento in ('Economico','Estandar','Premium'));

-- ------------------------------------------------------------
-- PARTICIPANTES / ESTUDIANTES
-- ------------------------------------------------------------
create table if not exists public.participantes (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid not null references public.partidas(id) on delete cascade,
  nombre text not null,
  empresa text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- DECISIONES: base para la futura simulación
-- ------------------------------------------------------------
create table if not exists public.decisiones (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references public.participantes(id) on delete cascade,
  ronda integer not null default 1,
  categoria text not null,
  decision jsonb not null default '{}'::jsonb,
  resultado jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- ÍNDICES
-- ------------------------------------------------------------
create index if not exists idx_partidas_profesor on public.partidas(profesor_id);
create index if not exists idx_partidas_codigo on public.partidas(codigo);
create index if not exists idx_participantes_partida on public.participantes(partida_id);
create index if not exists idx_decisiones_participante on public.decisiones(participante_id);

-- ------------------------------------------------------------
-- TRIGGER: crea el perfil del profesor al registrarse en Auth
-- ------------------------------------------------------------
create or replace function public.crear_perfil_profesor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profesores (id, nombre, apellido, curso, correo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre',''),
    coalesce(new.raw_user_meta_data->>'apellido',''),
    new.raw_user_meta_data->>'curso',
    new.email
  )
  on conflict (id) do update set
    nombre = excluded.nombre,
    apellido = excluded.apellido,
    curso = excluded.curso,
    correo = excluded.correo;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_side on auth.users;
create trigger on_auth_user_created_side
after insert on auth.users
for each row execute procedure public.crear_perfil_profesor();

-- ------------------------------------------------------------
-- FUNCIÓN SEGURA PARA ESTUDIANTES: buscar partida por código
-- Solo devuelve la información mínima necesaria para entrar.
-- ------------------------------------------------------------
create or replace function public.buscar_partida_por_codigo(p_codigo text)
returns table (
  id uuid,
  codigo text,
  nombre text,
  curso text,
  estado text,
  segmento text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.codigo, p.nombre, p.curso, p.estado, p.segmento
  from public.partidas p
  where upper(p.codigo) = upper(trim(p_codigo))
    and p.estado = 'esperando'
  limit 1;
$$;

revoke all on function public.buscar_partida_por_codigo(text) from public;
grant execute on function public.buscar_partida_por_codigo(text) to anon, authenticated;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.profesores enable row level security;
alter table public.partidas enable row level security;
alter table public.participantes enable row level security;
alter table public.decisiones enable row level security;

-- PROFESORES
drop policy if exists "profesor ve su perfil" on public.profesores;
create policy "profesor ve su perfil"
on public.profesores for select
to authenticated
using (id = auth.uid());

drop policy if exists "profesor actualiza su perfil" on public.profesores;
create policy "profesor actualiza su perfil"
on public.profesores for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- PARTIDAS
drop policy if exists "profesor ve sus partidas" on public.partidas;
create policy "profesor ve sus partidas"
on public.partidas for select
to authenticated
using (profesor_id = auth.uid());

drop policy if exists "profesor crea partidas" on public.partidas;
create policy "profesor crea partidas"
on public.partidas for insert
to authenticated
with check (profesor_id = auth.uid());

drop policy if exists "profesor actualiza sus partidas" on public.partidas;
create policy "profesor actualiza sus partidas"
on public.partidas for update
to authenticated
using (profesor_id = auth.uid())
with check (profesor_id = auth.uid());

drop policy if exists "profesor elimina sus partidas" on public.partidas;
create policy "profesor elimina sus partidas"
on public.partidas for delete
to authenticated
using (profesor_id = auth.uid());

-- PARTICIPANTES
-- El estudiante puede entrar usando la función RPC; para insertar usamos
-- una política pública limitada a partidas existentes y en espera.
drop policy if exists "estudiante entra a partida" on public.participantes;
create policy "estudiante entra a partida"
on public.participantes for insert
to anon, authenticated
with check (
  exists (
    select 1 from public.partidas p
    where p.id = partida_id
      and p.estado = 'esperando'
  )
);

-- El profesor puede ver participantes de sus partidas.
drop policy if exists "profesor ve participantes" on public.participantes;
create policy "profesor ve participantes"
on public.participantes for select
to authenticated
using (
  exists (
    select 1 from public.partidas p
    where p.id = participantes.partida_id
      and p.profesor_id = auth.uid()
  )
);

-- DECISIONES: por ahora solo el profesor dueño puede consultarlas.
drop policy if exists "profesor ve decisiones" on public.decisiones;
create policy "profesor ve decisiones"
on public.decisiones for select
to authenticated
using (
  exists (
    select 1
    from public.participantes s
    join public.partidas p on p.id = s.partida_id
    where s.id = decisiones.participante_id
      and p.profesor_id = auth.uid()
  )
);

-- Permiso de uso de tablas para los roles.
grant select, insert, update, delete on public.profesores to authenticated;
grant select, insert, update, delete on public.partidas to authenticated;
grant select on public.participantes to authenticated;
grant insert on public.participantes to anon, authenticated;
grant select on public.decisiones to authenticated;

-- ------------------------------------------------------------
-- DECISIONES: permite que el jugador conectado por código guarde
-- sus elecciones.
-- ------------------------------------------------------------
drop policy if exists "jugador guarda decisiones" on public.decisiones;
create policy "jugador guarda decisiones"
on public.decisiones for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.participantes s
    join public.partidas p on p.id = s.partida_id
    where s.id = decisiones.participante_id
  )
);

grant insert on public.decisiones to anon, authenticated;

-- ============================================================
-- LISTO
-- ============================================================

-- ============================================================
-- ACTUALIZACIÓN 29/08/2026 · PARTIDA ÚNICA, CONFIGURACIÓN Y EVENTOS
-- ============================================================
-- Un profesor no puede mantener más de una partida ACTIVA simultáneamente.
create unique index if not exists ux_side_una_partida_activa_por_profesor
on public.partidas(profesor_id)
where estado = 'activa';

-- Configuración avanzada de la simulación. JSONB permite evolucionar las reglas
-- sin romper partidas ya creadas.
alter table public.partidas add column if not exists configuracion jsonb not null default '{}'::jsonb;
alter table public.partidas add column if not exists eventos_habilitados jsonb not null default '[]'::jsonb;
alter table public.partidas add column if not exists inicio_programado timestamptz;

-- Ejemplo de configuracion:
-- {
--   "capitalMode":"fixed|random",
--   "capital":100000,
--   "capitalMin":80000,
--   "capitalMax":120000,
--   "interest":20,
--   "cycles":6,
--   "cycleCloseMode":"manual|automatic",
--   "durationSeconds":600,
--   "loanMaxPercent":50,
--   "loanInitialPercent":25
-- }
