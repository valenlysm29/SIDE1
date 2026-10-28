-- Acceso por sesión Auth: una empresa existente solo puede cambiar de dueño
-- tras liberación explícita del docente. La firma antigua se conserva, pero
-- p_clave se ignora para impedir recuperación con una clave conocida.
begin;
create table if not exists side_private.student_releases (empresa_id bigint primary key references public.empresas(id),released_at timestamptz not null default clock_timestamp());
revoke all on side_private.student_releases from public,anon,authenticated;
alter table side_private.student_releases enable row level security;
create or replace function public.side_ingresar_empresa_segura(p_codigo text,p_nombre_legal text,p_nombre_comercial text,p_clave text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare game public.partidas; person public.participantes; claim side_private.student_claims; response jsonb; company_id bigint; raw_key text; matching integer;
begin
 if auth.uid() is null then return jsonb_build_object('success',false,'code','SESION_REQUERIDA','error','Inicia una sesión para entrar.'); end if;
 if coalesce(trim(p_codigo),'')='' or coalesce(trim(p_nombre_legal),'')='' or coalesce(trim(p_nombre_comercial),'')='' then return jsonb_build_object('success',false,'code','CREDENCIALES_INVALIDAS','error','No se pudo validar el ingreso.'); end if;
 select count(*) into matching from public.partidas p where public.side_normalizar_ingreso(public.side_normalizar_codigo_sala(p.codigo))=public.side_normalizar_ingreso(public.side_normalizar_codigo_sala(p_codigo));
 if matching<>1 then return jsonb_build_object('success',false,'code','CREDENCIALES_INVALIDAS','error','No se pudo validar el ingreso.'); end if;
 select * into game from public.partidas p where public.side_normalizar_ingreso(public.side_normalizar_codigo_sala(p.codigo))=public.side_normalizar_ingreso(public.side_normalizar_codigo_sala(p_codigo)) for update;
 if not found then return jsonb_build_object('success',false,'code','CREDENCIALES_INVALIDAS','error','No se pudo validar el ingreso.'); end if;
 select count(*) into matching from public.participantes t where t.partida_id=game.id and t.empresa_id is not null
 and public.side_limpiar_whitespace_ingreso(t.nombre_legal_ingreso)=public.side_limpiar_whitespace_ingreso(p_nombre_legal)
 and public.side_limpiar_whitespace_ingreso(t.nombre_comercial_ingreso)=public.side_limpiar_whitespace_ingreso(p_nombre_comercial);
 if matching>1 then return jsonb_build_object('success',false,'code','CREDENCIALES_INVALIDAS','error','No se pudo validar el ingreso.'); end if;
 if matching=1 then
  select * into person from public.participantes t where t.partida_id=game.id and t.empresa_id is not null
   and public.side_limpiar_whitespace_ingreso(t.nombre_legal_ingreso)=public.side_limpiar_whitespace_ingreso(p_nombre_legal)
   and public.side_limpiar_whitespace_ingreso(t.nombre_comercial_ingreso)=public.side_limpiar_whitespace_ingreso(p_nombre_comercial) for update;
  if person.expulsada_at is not null then return jsonb_build_object('success',false,'code','EMPRESA_EXPULSADA','error','Consulta al docente.'); end if;
  select * into claim from side_private.student_claims c where c.empresa_id=person.empresa_id for update;
  if found and claim.owner_id=auth.uid() then
   null;
  else
   if not exists(select 1 from side_private.student_releases r where r.empresa_id=person.empresa_id) then
    return jsonb_build_object('success',false,'code','ACCESO_RESERVADO','error','Esta empresa pertenece a otra sesión. Solicita al docente que libere el acceso.');
   end if;
   delete from side_private.student_releases where empresa_id=person.empresa_id;
   raw_key:=upper(encode(extensions.gen_random_bytes(16),'hex'));
   insert into side_private.student_claims(empresa_id,owner_id,key_hash) values(person.empresa_id,auth.uid(),extensions.crypt(raw_key,extensions.gen_salt('bf',10)))
   on conflict(empresa_id) do update set owner_id=excluded.owner_id,key_hash=excluded.key_hash,failed_attempts=0,blocked_until=null,updated_at=clock_timestamp();
  end if;
  response:=public.side_respuesta_ingreso(person.id,true);
 else
  response:=public.ingresar_empresa(p_codigo,p_nombre_legal,p_nombre_comercial);
  if coalesce((response->>'success')::boolean,false) is not true then return response; end if;
  company_id:=(response->>'empresa_id')::bigint;
  raw_key:=upper(encode(extensions.gen_random_bytes(4),'hex'));
  insert into side_private.student_claims(empresa_id,owner_id,key_hash) values(company_id,auth.uid(),extensions.crypt(raw_key,extensions.gen_salt('bf',10)));
 end if;
 return response;
end $$;
revoke all on function public.side_ingresar_empresa_segura(text,text,text,text) from public,anon;
grant execute on function public.side_ingresar_empresa_segura(text,text,text,text) to authenticated;

create or replace function public.side_liberar_empresa(p_partida_id uuid,p_empresa_id bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.partidas p join public.participantes t on t.partida_id=p.id where p.id=p_partida_id and p.profesor_id=auth.uid() and t.empresa_id=p_empresa_id) then
  return jsonb_build_object('success',false,'code','NO_AUTORIZADO','error','No tienes permiso para liberar esta empresa.');
 end if;
 update side_private.student_claims set owner_id=null,updated_at=clock_timestamp() where empresa_id=p_empresa_id;
 insert into side_private.student_releases(empresa_id) values(p_empresa_id) on conflict(empresa_id) do update set released_at=clock_timestamp();
 return jsonb_build_object('success',true);
end $$;
revoke all on function public.side_liberar_empresa(uuid,bigint) from public,anon;
grant execute on function public.side_liberar_empresa(uuid,bigint) to authenticated;

commit;
