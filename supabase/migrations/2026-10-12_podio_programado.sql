-- Después de lifecycle, admisión/identidad exacta y guardar_puntaje_docente.
-- Publicación declarativa: disponible al llegar publicar_en, sin cron ni navegador.
begin;
create table if not exists public.podios_publicados (
 partida_id uuid primary key references public.partidas(id) on delete cascade,
 publicar_en timestamptz not null,
 justificacion text not null default '',
 podio jsonb not null,
 actualizado_en timestamptz not null default now()
);
alter table public.podios_publicados enable row level security;
revoke all on public.podios_publicados from public, anon, authenticated;
grant select on public.podios_publicados to authenticated;
drop policy if exists podio_dueno_lectura on public.podios_publicados;
create policy podio_dueno_lectura on public.podios_publicados for select to authenticated
 using (exists(select 1 from public.partidas p where p.id=partida_id and p.profesor_id=auth.uid()));

create or replace function public.side_podio_docente(p_partida_id uuid, p_accion text default 'consultar', p_minutos integer default 0, p_justificacion text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_game public.partidas; v_row public.podios_publicados; v_podio jsonb; v_now timestamptz := now();
begin
 select * into v_game from public.partidas where id=p_partida_id and profesor_id=auth.uid() for update;
 if not found then return jsonb_build_object('error','No tienes permiso para publicar en esta partida.'); end if;
 if p_accion not in ('consultar','publicar','cancelar') or p_accion is null then return jsonb_build_object('error','Acción inválida.'); end if;
 if p_accion='cancelar' then
   delete from public.podios_publicados where partida_id=p_partida_id and publicar_en>v_now;
 elsif p_accion='publicar' then
   if p_minutos is null or p_minutos<0 or p_minutos>4320 then return jsonb_build_object('error','Elige Ahora o entre 1 minuto y 72 horas.'); end if;
   if not exists(select 1 from public.participantes where partida_id=p_partida_id) or exists(select 1 from public.participantes where partida_id=p_partida_id and (puntaje_docente is null or puntaje_docente<0 or puntaje_docente>20)) then
     return jsonb_build_object('error','Califica a todas las empresas antes de publicar.');
   end if;
   select jsonb_agg(x.item order by x.n) into v_podio from (
     select jsonb_build_object('empresa',coalesce(e.nombre_comercial,e.nombre_legal),'empresaId',e.id,'grade',pt.puntaje_docente) item,
       row_number() over(order by pt.puntaje_docente desc, coalesce(e.nombre_comercial,e.nombre_legal) collate "es-x-icu", e.id) n
     from public.participantes pt join public.empresas e on e.id=pt.empresa_id where pt.partida_id=p_partida_id
     order by n limit 3
   ) x;
   insert into public.podios_publicados(partida_id,publicar_en,justificacion,podio,actualizado_en)
   values(p_partida_id,v_now+make_interval(mins=>p_minutos),coalesce(p_justificacion,''),v_podio,v_now)
   on conflict(partida_id) do update set publicar_en=excluded.publicar_en,justificacion=excluded.justificacion,podio=excluded.podio,actualizado_en=excluded.actualizado_en;
 end if;
 select * into v_row from public.podios_publicados where partida_id=p_partida_id;
 return jsonb_build_object('success',true,'serverTime',v_now,'publication',case when v_row.partida_id is null then null else
   jsonb_build_object('code',v_game.codigo,'publishedAt',v_row.publicar_en,'expiresAt',v_row.publicar_en+interval '24 hours','reason',v_row.justificacion,'podium',v_row.podio,'winner',v_row.podio->0->>'empresa','scheduled',v_now<v_row.publicar_en,'visible',v_now>=v_row.publicar_en and v_now<v_row.publicar_en+interval '24 hours') end);
end $$;

create or replace function public.side_podio_estudiante(p_codigo text, p_nombre_legal text, p_nombre_comercial text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_partida uuid; v_row public.podios_publicados;
begin
 select pt.partida_id into v_partida from public.side_resolver_identidad_empresa(p_codigo,p_nombre_legal,p_nombre_comercial) r
 join public.participantes pt on pt.id=r.participante_id;
 if v_partida is null then return jsonb_build_object('error','Credenciales inválidas.'); end if;
 select * into v_row from public.podios_publicados where partida_id=v_partida and now()>=publicar_en and now()<publicar_en+interval '24 hours';
 return jsonb_build_object('success',true,'publication',case when v_row.partida_id is null then null else jsonb_build_object('publishedAt',v_row.publicar_en,'expiresAt',v_row.publicar_en+interval '24 hours','reason',v_row.justificacion,'podium',v_row.podio) end);
end $$;
revoke all on function public.side_podio_docente(uuid,text,integer,text) from public,anon;
grant execute on function public.side_podio_docente(uuid,text,integer,text) to authenticated;
revoke all on function public.side_podio_estudiante(text,text,text) from public;
grant execute on function public.side_podio_estudiante(text,text,text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
