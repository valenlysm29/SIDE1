-- Propuesta local: identidad de empresa vinculada a Supabase Auth.
-- No modifica datos históricos ni debe desplegarse hasta pasar pruebas en Postgres real.
begin;
create schema if not exists side_private;
revoke all on schema side_private from public, anon, authenticated;
create table if not exists side_private.student_claims (
 empresa_id bigint primary key references public.empresas(id),
 owner_id uuid references auth.users(id),
 key_hash text not null,
 failed_attempts integer not null default 0,
 blocked_until timestamptz,
 updated_at timestamptz not null default clock_timestamp()
);
revoke all on side_private.student_claims from public, anon, authenticated;
alter table side_private.student_claims enable row level security;

-- Todas las RPC de estado/decisiones/podio existentes consultan este resolver.
-- No se usa metadata modificable del usuario ni se confía solo en nombres.
create or replace function public.side_resolver_identidad_empresa(p_codigo text,p_nombre_legal text,p_nombre_comercial text)
returns table(participante_id uuid,empresa_id bigint)
language sql stable security definer set search_path = '' as $$
 select t.id,t.empresa_id from public.participantes t
 join public.partidas p on p.id=t.partida_id
 join side_private.student_claims c on c.empresa_id=t.empresa_id
 where auth.uid() is not null and c.owner_id=auth.uid()
 and public.side_normalizar_ingreso(public.side_normalizar_codigo_sala(p.codigo))=public.side_normalizar_ingreso(public.side_normalizar_codigo_sala(p_codigo))
 and public.side_limpiar_whitespace_ingreso(t.nombre_legal_ingreso)=public.side_limpiar_whitespace_ingreso(p_nombre_legal)
 and public.side_limpiar_whitespace_ingreso(t.nombre_comercial_ingreso)=public.side_limpiar_whitespace_ingreso(p_nombre_comercial)
 and 1=(select count(*) from public.participantes t2 join public.partidas p2 on p2.id=t2.partida_id
   where public.side_normalizar_ingreso(public.side_normalizar_codigo_sala(p2.codigo))=public.side_normalizar_ingreso(public.side_normalizar_codigo_sala(p_codigo))
   and public.side_limpiar_whitespace_ingreso(t2.nombre_legal_ingreso)=public.side_limpiar_whitespace_ingreso(p_nombre_legal)
   and public.side_limpiar_whitespace_ingreso(t2.nombre_comercial_ingreso)=public.side_limpiar_whitespace_ingreso(p_nombre_comercial));
$$;
revoke all on function public.side_resolver_identidad_empresa(text,text,text) from public,anon,authenticated;

-- Serializa en la partida tanto el primer reclamo como la creación. Los errores
-- de clave se registran por empresa (no solo por identidad anónima evitable).
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
  if found and claim.owner_id is not null and claim.owner_id<>auth.uid() then
   if claim.blocked_until>clock_timestamp() then return jsonb_build_object('success',false,'code','INTENTOS_AGOTADOS','error','Demasiados intentos; inténtalo más tarde.'); end if;
   if nullif(trim(p_clave),'') is null then return jsonb_build_object('success',false,'code','CLAVE_REQUERIDA','error','Introduce la clave de empresa para recuperar el acceso.'); end if;
   if extensions.crypt(upper(trim(p_clave)),claim.key_hash)<>claim.key_hash then
    update side_private.student_claims set failed_attempts=case when blocked_until is not null and blocked_until<=clock_timestamp() then 1 else failed_attempts+1 end,
    blocked_until=case when (case when blocked_until is not null and blocked_until<=clock_timestamp() then 1 else failed_attempts+1 end)>=5 then clock_timestamp()+interval '15 minutes' else null end where empresa_id=person.empresa_id;
    return jsonb_build_object('success',false,'code','CLAVE_INVALIDA','error','La clave de empresa no es correcta.');
   end if;
   update side_private.student_claims set owner_id=auth.uid(),failed_attempts=0,blocked_until=null,updated_at=clock_timestamp() where empresa_id=person.empresa_id;
  elsif not found or claim.owner_id is null then
   raw_key:=upper(encode(extensions.gen_random_bytes(4),'hex'));
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
 if raw_key is not null then response:=response||jsonb_build_object('clave_empresa',raw_key); end if;
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
 return jsonb_build_object('success',true);
end $$;
revoke all on function public.side_liberar_empresa(uuid,bigint) from public,anon;
grant execute on function public.side_liberar_empresa(uuid,bigint) to authenticated;

-- Asegura que incluso las capas históricas de pausa/expulsión y sus copias
-- privadas reciben el llamante validado ANTES de consultar datos de empresa.
do $$
declare spec record; definition text;
begin
 for spec in select * from (values
 ('obtener_estado_estudiante','text,text,text','side_ident_obtener_estado'),
 ('guardar_estado_estudiante','text,text,text,jsonb,bigint','side_ident_guardar_estado'),
 ('guardar_decisiones_estudiante','text,text,text,integer,jsonb,bigint','side_ident_guardar_decisiones'),
 ('side_podio_estudiante','text,text,text','side_ident_podio')
 ) v(name,args,private_name) loop
  if to_regprocedure(format('side_private.%s(%s)',spec.private_name,spec.args)) is null then
   select pg_get_functiondef(to_regprocedure(format('public.%s(%s)',spec.name,spec.args))) into definition;
   if definition is null then raise exception 'Falta RPC requerida: %',spec.name; end if;
   definition:=replace(definition,format('FUNCTION public.%s(',spec.name),format('FUNCTION side_private.%s(',spec.private_name));
   execute definition;
   execute format('revoke all on function side_private.%s(%s) from public,anon,authenticated',spec.private_name,spec.args);
  end if;
 end loop;
end $$;
create or replace function public.obtener_estado_estudiante(p_codigo text,p_nombre_legal text,p_nombre_comercial text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.side_resolver_identidad_empresa(p_codigo,p_nombre_legal,p_nombre_comercial)) then return jsonb_build_object('success',false,'code','CREDENCIALES_INVALIDAS','error','No tienes acceso a esta empresa.'); end if;
 return side_private.side_ident_obtener_estado(p_codigo,p_nombre_legal,p_nombre_comercial);
end $$;
create or replace function public.guardar_estado_estudiante(p_codigo text,p_nombre_legal text,p_nombre_comercial text,p_snapshot jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.side_resolver_identidad_empresa(p_codigo,p_nombre_legal,p_nombre_comercial)) then return jsonb_build_object('success',false,'code','CREDENCIALES_INVALIDAS','error','No tienes acceso a esta empresa.'); end if;
 return side_private.side_ident_guardar_estado(p_codigo,p_nombre_legal,p_nombre_comercial,p_snapshot,p_expected_revision);
end $$;
create or replace function public.guardar_decisiones_estudiante(p_codigo text,p_nombre_legal text,p_nombre_comercial text,p_ciclo integer,p_decisiones jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.side_resolver_identidad_empresa(p_codigo,p_nombre_legal,p_nombre_comercial)) then return jsonb_build_object('success',false,'code','CREDENCIALES_INVALIDAS','error','No tienes acceso a esta empresa.'); end if;
 return side_private.side_ident_guardar_decisiones(p_codigo,p_nombre_legal,p_nombre_comercial,p_ciclo,p_decisiones,p_expected_revision);
end $$;
create or replace function public.side_podio_estudiante(p_codigo text,p_nombre_legal text,p_nombre_comercial text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.side_resolver_identidad_empresa(p_codigo,p_nombre_legal,p_nombre_comercial)) then return jsonb_build_object('success',false,'code','CREDENCIALES_INVALIDAS','error','No tienes acceso a esta empresa.'); end if;
 return side_private.side_ident_podio(p_codigo,p_nombre_legal,p_nombre_comercial);
end $$;

-- El estudiante envía decisiones y planes, pero el servidor es dueño de los
-- inventarios, resultados y saldos derivados de cierres anteriores.
create or replace function side_private.proteger_estado_economico()
returns trigger language plpgsql security definer set search_path='' as $$
declare protected text[]:=array['__finishedGoods','__inventarioMP','__cycleSettlements','__financialSnapshots','__economicHistory','__accountsReceivable','__openingBalance','__previousFinancialHistory','__cycleCosts'];
 incoming jsonb; previous jsonb; k text; plans jsonb; item record; planstate jsonb;
begin
 if auth.role()='service_role' or auth.uid() is null then return new; end if;
 incoming:=coalesce(new.snapshot->'decision_state','{}'::jsonb);
 if jsonb_typeof(incoming)<>'object' then raise exception 'decision_state inválido' using errcode='22023'; end if;
 previous:=case when tg_op='UPDATE' then coalesce(old.snapshot->'decision_state','{}'::jsonb) else '{}'::jsonb end;
 foreach k in array protected loop
  incoming:=incoming-k;
  if previous ? k then incoming:=incoming||jsonb_build_object(k,previous->k); end if;
 end loop;
 -- Un plan no puede inyectar un inventario alternativo cuando el servidor
 -- restaura la decisión histórica (restoreState combina estas dos fuentes).
 plans:=incoming->'__cyclePlans';
 if jsonb_typeof(plans)='object' then
  for item in select key,value from jsonb_each(plans) loop
   if jsonb_typeof(item.value->'state')='object' then
    planstate:=(item.value->'state')-protected;
    plans:=jsonb_set(plans,array[item.key,'state'],planstate);
   end if;
  end loop;
  incoming:=jsonb_set(incoming,'{__cyclePlans}',plans);
 end if;
 new.snapshot:=jsonb_set(new.snapshot,'{decision_state}',incoming,true);
 return new;
end $$;
revoke all on function side_private.proteger_estado_economico() from public,anon,authenticated;
create trigger side_proteger_estado_economico before insert or update on public.side_student_state
for each row execute function side_private.proteger_estado_economico();

-- Evitar el ingreso anterior que entrega snapshots sin validar el dueño.
revoke all on function public.ingresar_empresa(text,text,text) from public,anon,authenticated;
revoke all on function public.unirse_partida_por_codigo(text,text,text) from public,anon,authenticated;
revoke execute on function public.obtener_estado_estudiante(text,text,text) from public,anon;
revoke execute on function public.guardar_estado_estudiante(text,text,text,jsonb,bigint) from public,anon;
revoke execute on function public.guardar_decisiones_estudiante(text,text,text,integer,jsonb,bigint) from public,anon;
-- Los reportes definitivos son exclusivos del worker de cierre; clientes viejos fallan cerrados.
revoke all on function public.guardar_reporte_estudiante(text,text,text,integer,jsonb,bigint) from public,anon,authenticated;
revoke execute on function public.side_podio_estudiante(text,text,text) from public,anon;
commit;
