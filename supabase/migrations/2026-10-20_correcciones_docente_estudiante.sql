-- SIDE / 20-10-2026. Solo preparar: Codex NO ejecuta este archivo en producción.
-- Prerrequisitos, en orden: esquema/migraciones instaladas de lifecycle y admission;
-- 20261009_sala_espera_identidad_exacta; 2026-10-11_fix_crear_partida;
-- 2026-10-12_salas_codigo; 2026-10-12_codigo_corto;
-- 2026-10-11_logica_excel; 2026-10-12_podio_programado.
-- Repetible. Preserva motor, identidades, capital e historial de partidas existentes.
begin;
create or replace function public.side_excel_features() returns jsonb language sql stable as $$
 select jsonb_build_object('cierreVersion',1,'motorVersion','side-lotes-2026-10-20','correccionesVersion',20261020);
$$;
grant execute on function public.side_excel_features() to anon,authenticated;
do $$ begin
 if to_regprocedure('public.unirse_partida_por_codigo(text,text,text)') is null
 or to_regprocedure('public.side_contexto_cierre_excel(uuid,integer)') is null
 or to_regprocedure('public.side_podio_estudiante(text,text,text)') is null then
  raise exception 'Faltan migraciones previas de salas, cierre Excel o podio. Consulta el orden al inicio del archivo.';
 end if;
end $$;

create schema if not exists side_private;
revoke all on schema side_private from public,anon,authenticated;
create table if not exists side_private.docentes_excepciones (
 correo text primary key check(correo=lower(btrim(correo))), motivo text not null
);
insert into side_private.docentes_excepciones(correo,motivo)
 values('profesor@upch.pe','Cuenta demo autorizada') on conflict do nothing;
alter table side_private.docentes_excepciones enable row level security;
revoke all on side_private.docentes_excepciones from public,anon,authenticated;
create or replace function public.side_correo_docente_permitido(p_correo text)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select lower(btrim(coalesce(p_correo,''))) ~ '^[^[:space:]@]+@upch\.pe$'
 or exists(select 1 from side_private.docentes_excepciones e where e.correo=lower(btrim(p_correo)));
$$;
revoke all on function public.side_correo_docente_permitido(text) from public,anon,authenticated;
create or replace function side_private.validar_correo_docente()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not public.side_correo_docente_permitido(new.email) then
  raise exception using errcode='23514',message='Usa tu correo institucional @upch.pe o una excepción autorizada.';
 end if;
 return new;
end $$;
drop trigger if exists side_validar_correo_docente on auth.users;
create trigger side_validar_correo_docente before insert or update of email on auth.users
 for each row execute function side_private.validar_correo_docente();
-- Impide crear perfiles por una ruta distinta a Auth con otro correo.
drop trigger if exists side_validar_correo_perfil on public.profesores;
-- profesores usa «correo», por eso el segundo trigger tiene su propia función.
create or replace function side_private.validar_correo_perfil()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare correo_auth text;
begin
 select email into correo_auth from auth.users where id=new.id;
 if not public.side_correo_docente_permitido(correo_auth) then
  raise exception using errcode='23514',message='Usa tu correo institucional @upch.pe o una excepción autorizada.';
 end if;
 return new;
end $$;
create trigger side_validar_correo_perfil before insert or update of correo on public.profesores
 for each row execute function side_private.validar_correo_perfil();

-- Solo se conservan hashes, nunca nombres ni direcciones IP en esta tabla.
-- Diez fallos en cinco minutos bloquean quince minutos. El gateway debe entregar
-- una IP de origen fiable; sin cabecera, el límite se comparte por código de sala.
create table if not exists side_private.intentos_ingreso (
 clave text primary key, fallos integer not null default 0,
 ventana timestamptz not null default clock_timestamp(), bloqueado_hasta timestamptz,
 actualizado_en timestamptz not null default clock_timestamp()
);
alter table side_private.intentos_ingreso enable row level security;
revoke all on side_private.intentos_ingreso from public,anon,authenticated;
create or replace function side_private.clave_ingreso(p_codigo text)
returns text language sql stable set search_path=pg_catalog as $$
 select md5(public.side_normalizar_codigo_sala(p_codigo)||'|'||coalesce(
 nullif(coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}')->>'x-real-ip',''),
 nullif(split_part(coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}')->>'x-forwarded-for',',',1),''),
 'sin-ip'));
$$;
create or replace function side_private.ingreso_bloqueado(p_clave text)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare hasta timestamptz;
begin
 -- Serializa todos los fallos concurrentes del mismo origen/sala.
 perform pg_advisory_xact_lock(hashtextextended(p_clave,731925));
 select bloqueado_hasta into hasta from side_private.intentos_ingreso where clave=p_clave;
 return coalesce(hasta>clock_timestamp(),false);
end $$;
create or replace function side_private.registrar_fallo_ingreso(p_clave text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 insert into side_private.intentos_ingreso(clave,fallos) values(p_clave,1)
 on conflict(clave) do update set
 fallos=case when intentos_ingreso.ventana<clock_timestamp()-interval '5 minutes' then 1 else intentos_ingreso.fallos+1 end,
 ventana=case when intentos_ingreso.ventana<clock_timestamp()-interval '5 minutes' then clock_timestamp() else intentos_ingreso.ventana end,
 actualizado_en=clock_timestamp();
 update side_private.intentos_ingreso set bloqueado_hasta=clock_timestamp()+interval '15 minutes'
 where clave=p_clave and fallos>=10;
 delete from side_private.intentos_ingreso where actualizado_en<clock_timestamp()-interval '1 day';
end $$;

-- Copia privada una sola vez: reejecutar no envuelve wrappers recursivamente.
do $$ declare definition text; begin
 if to_regprocedure('side_private.ingresar_empresa_original_20261020(text,text,text)') is null then
  definition:=pg_get_functiondef('public.ingresar_empresa(text,text,text)'::regprocedure);
  execute replace(definition,'FUNCTION public.ingresar_empresa(','FUNCTION side_private.ingresar_empresa_original_20261020(');
 end if;
 if to_regprocedure('side_private.resolver_original_20261020(text,text,text)') is null then
  definition:=pg_get_functiondef('public.side_resolver_identidad_empresa(text,text,text)'::regprocedure);
  execute replace(definition,'FUNCTION public.side_resolver_identidad_empresa(','FUNCTION side_private.resolver_original_20261020(');
 end if;
 if to_regprocedure('side_private.podio_original_20261020(text,text,text)') is null then
  definition:=pg_get_functiondef('public.side_podio_estudiante(text,text,text)'::regprocedure);
  execute replace(definition,'FUNCTION public.side_podio_estudiante(','FUNCTION side_private.podio_original_20261020(');
 end if;
end $$;
create or replace function public.ingresar_empresa(p_codigo text,p_nombre_legal text,p_nombre_comercial text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare clave text:=side_private.clave_ingreso(p_codigo); respuesta jsonb;
begin
 if side_private.ingreso_bloqueado(clave) then
  return jsonb_build_object('success',false,'code','INGRESO_BLOQUEADO','error','No se pudo validar el ingreso. Espera quince minutos antes de volver a intentar.');
 end if;
 respuesta:=side_private.ingresar_empresa_original_20261020(p_codigo,p_nombre_legal,p_nombre_comercial);
 if coalesce((respuesta->>'success')::boolean,false)=false then
  perform side_private.registrar_fallo_ingreso(clave);
  if respuesta->>'code' in ('CREDENCIALES_INVALIDAS','PARTIDA_INICIADA') then
   return jsonb_build_object('success',false,'code','CREDENCIALES_INVALIDAS','error','No se pudo validar el ingreso. Comprueba el código y los nombres registrados con tu docente.');
  end if;
 end if;
 return respuesta;
end $$;
-- La única entrada pública es unirse_partida_por_codigo; no queda bypass legacy.
revoke all on function public.ingresar_empresa(text,text,text) from public,anon,authenticated;

create or replace function public.side_resolver_identidad_empresa(p_codigo text,p_nombre_legal text,p_nombre_comercial text)
returns table(participante_id uuid,empresa_id bigint) language plpgsql security definer set search_path=pg_catalog as $$
declare clave text:=side_private.clave_ingreso(p_codigo); encontrado record;
begin
 if side_private.ingreso_bloqueado(clave) then return; end if;
 select * into encontrado from side_private.resolver_original_20261020(p_codigo,p_nombre_legal,p_nombre_comercial);
 if encontrado.participante_id is null then perform side_private.registrar_fallo_ingreso(clave);return;end if;
 participante_id:=encontrado.participante_id;empresa_id:=encontrado.empresa_id;return next;
end $$;
revoke all on function public.side_resolver_identidad_empresa(text,text,text) from public,anon,authenticated;

create or replace function public.side_podio_estudiante(p_codigo text,p_nombre_legal text,p_nombre_comercial text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare respuesta jsonb; podio jsonb;
begin
 respuesta:=side_private.podio_original_20261020(p_codigo,p_nombre_legal,p_nombre_comercial);
 if respuesta#>'{publication,podium}' is not null then
  select coalesce(jsonb_agg(jsonb_build_object('empresa',x.item->>'empresa','grade',x.item->'grade') order by x.orden),'[]')
  into podio from jsonb_array_elements(respuesta#>'{publication,podium}') with ordinality x(item,orden);
  respuesta:=jsonb_set(respuesta,'{publication,podium}',podio);
 end if;
 return respuesta;
end $$;
revoke all on function public.side_podio_estudiante(text,text,text) from public;
grant execute on function public.side_podio_estudiante(text,text,text) to anon,authenticated;

alter table public.partidas add column if not exists motor_version text not null default 'excel-16';
create or replace function side_private.fijar_motor_partida()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if tg_op='INSERT' then
  new.motor_version:='side-lotes-2026-10-20';
 elsif new.motor_version is distinct from old.motor_version then
  raise exception using errcode='23514',message='La versión del motor de una partida es permanente. Crea una partida nueva.';
 end if;
 new.configuracion:=coalesce(new.configuracion,'{}')||jsonb_build_object('motor_version',new.motor_version);
 return new;
end $$;
drop trigger if exists side_fijar_motor_partida on public.partidas;
create trigger side_fijar_motor_partida before insert or update on public.partidas
 for each row execute function side_private.fijar_motor_partida();
-- No modifica partidas existentes: la versión se devuelve explícita en contexto.

-- CIERRE_EXCEL_VERSIONADO (se completa con las definiciones validadas abajo).

create or replace function public.side_contexto_cierre_excel(p_partida_id uuid,p_ciclo integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.partidas; empresas jsonb; historia jsonb; previo jsonb; token text;
begin
 select * into p from public.partidas where id=p_partida_id and profesor_id=auth.uid();
 if p.id is null then return jsonb_build_object('error','Partida no autorizada','code','NO_AUTORIZADO'); end if;
 if p_ciclo is null or p_ciclo<1 then return jsonb_build_object('error','Ciclo inválido'); end if;
 select cierre into previo from public.side_excel_cierres where partida_id=p.id and ciclo=p_ciclo;
 if previo is not null then return jsonb_build_object('cierre',previo); end if;
 if p_ciclo>public.side_ciclo_actual(p.configuracion) then return jsonb_build_object('error','El ciclo cambió','code','CICLO_DESACTUALIZADO'); end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id::text,'capital',e.caja_inicial,'revision',s.revision,'envelope',coalesce(s.snapshot#>'{decision_state,__excel}','{}')) order by e.id),'[]')
 into empresas from public.empresas e join public.participantes t on t.empresa_id=e.id
 left join public.side_student_state s on s.empresa_id=e.id
 where t.partida_id=p.id and (p.motor_version='side-lotes-2026-10-20' or s.snapshot#>>'{decision_state,__excel,habilitado}'='true')
 and (case when s.snapshot#>>'{decision_state,__excel,cicloActivacion}' ~ '^[0-9]{1,8}$' then (s.snapshot#>>'{decision_state,__excel,cicloActivacion}')::integer else 1 end)<=p_ciclo;
 select coalesce(cierre->'historialPorEmpresa','{}') into historia from public.side_excel_cierres where partida_id=p.id and ciclo<p_ciclo order by ciclo desc limit 1;
 historia:=coalesce(historia,'{}');token:=md5(empresas::text||historia::text||p_ciclo::text||p.configuracion::text);
 return jsonb_build_object('empresas',empresas,'historialPorEmpresa',historia,'token',token,'motor_version',p.motor_version,'overrides',coalesce(p.configuracion->'excelParametros','{}')||jsonb_build_object('VERSION',p.motor_version));
end $$;

create or replace function public.side_guardar_cierre_excel(p_partida_id uuid,p_ciclo integer,p_token text,p_cierre jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.partidas; ctx jsonb; previo jsonb; emp jsonb; resultado jsonb; id_empresa bigint; fin jsonb;
begin
 select * into p from public.partidas where id=p_partida_id and profesor_id=auth.uid() for update;
 if p.id is null then return jsonb_build_object('error','Partida no autorizada','code','NO_AUTORIZADO'); end if;
 select cierre into previo from public.side_excel_cierres where partida_id=p.id and ciclo=p_ciclo;
 if previo is not null then return jsonb_build_object('cierre',previo,'reused',true); end if;
 -- Lock también snapshots de nuevas empresas: no solo las incluidas en el token.
 perform s.empresa_id from public.side_student_state s join public.participantes t on t.empresa_id=s.empresa_id where t.partida_id=p.id order by s.empresa_id for update of s;
 ctx:=public.side_contexto_cierre_excel(p.id,p_ciclo);
 if ctx ? 'error' then return ctx; end if;
 if ctx->>'token' is distinct from p_token then return jsonb_build_object('error','Las decisiones cambiaron. Vuelve a cerrar el ciclo.','code','ESTADO_DESACTUALIZADO'); end if;
 if jsonb_typeof(p_cierre->'resultadosPorEmpresa') is distinct from 'object' or (p_cierre->>'ciclo')::integer<>p_ciclo or octet_length(p_cierre::text)>10485760 then return jsonb_build_object('error','Cierre inválido'); end if;
 if exists(select 1 from jsonb_object_keys(p_cierre->'resultadosPorEmpresa') x(id) where not exists(select 1 from jsonb_array_elements(ctx->'empresas') y where y->>'id'=x.id)) then return jsonb_build_object('error','Empresa ajena al cierre'); end if;
 if p.motor_version='side-lotes-2026-10-20' then
  if jsonb_array_length(ctx->'empresas')<>(select count(*) from jsonb_object_keys(p_cierre->'resultadosPorEmpresa')) then
   return jsonb_build_object('error','Faltan empresas en el cierre. Se deben cobrar los costos obligatorios a todas.','code','CIERRE_INCOMPLETO');
  end if;
  for emp in select * from jsonb_array_elements(ctx->'empresas') loop
   resultado:=p_cierre->'resultadosPorEmpresa'->(emp->>'id');fin:=resultado->'financial';
   if jsonb_typeof(resultado#>'{libroMovimientos,movimientos}') is distinct from 'array'
   or fin#>>'{balanceCaja,cajaFinal}' is null
   or abs((fin#>>'{balanceCaja,cajaInicial}')::numeric+(fin#>>'{balanceCaja,entradas}')::numeric-(fin#>>'{balanceCaja,salidas}')::numeric-(fin#>>'{balanceCaja,cajaFinal}')::numeric)>0.001
   or abs((fin#>>'{balanceGeneral,activos}')::numeric-(fin#>>'{balanceGeneral,deuda}')::numeric-(fin#>>'{balanceGeneral,patrimonio}')::numeric)>0.001
   or abs((fin#>>'{flujoCaja,operacion}')::numeric+(fin#>>'{flujoCaja,inversion}')::numeric+(fin#>>'{flujoCaja,financiamiento}')::numeric-(fin#>>'{flujoCaja,flujoNeto}')::numeric)>0.001 then
    return jsonb_build_object('error','El libro de movimientos y los estados financieros no cuadran.','code','CIERRE_NO_RECONCILIADO');
   end if;
  end loop;
 end if;
 insert into public.side_excel_cierres(partida_id,ciclo,cierre) values(p.id,p_ciclo,p_cierre);
 for emp in select * from jsonb_array_elements(ctx->'empresas') loop
  id_empresa:=(emp->>'id')::bigint;resultado:=p_cierre->'resultadosPorEmpresa'->(id_empresa::text);
  if resultado is not null then
   fin:=resultado->'financial';
   insert into public.reportes_ciclo(empresa_id,ciclo,capital,ingresos,costos,utilidad,caja_final,balance_caja,flujo_caja,estado_resultados)
   values(id_empresa,p_ciclo,(fin#>>'{balanceCaja,cajaInicial}')::numeric,(fin#>>'{estadoResultados,ingresos}')::numeric,(fin#>>'{estadoResultados,costos}')::numeric,(fin#>>'{estadoResultados,utilidad}')::numeric,(fin#>>'{balanceCaja,cajaFinal}')::numeric,fin->'balanceCaja',fin->'flujoCaja',(fin->'estadoResultados')||jsonb_build_object('excel',resultado))
   on conflict(empresa_id,ciclo) do update set capital=excluded.capital,ingresos=excluded.ingresos,costos=excluded.costos,utilidad=excluded.utilidad,caja_final=excluded.caja_final,balance_caja=excluded.balance_caja,flujo_caja=excluded.flujo_caja,estado_resultados=excluded.estado_resultados;
   update public.empresas set caja_actual=(fin#>>'{balanceCaja,cajaFinal}')::numeric where id=id_empresa;
  end if;
  -- Se conserva dentro de decision_state para la lista blanca existente del snapshot.
  insert into public.side_student_state(empresa_id,snapshot)
  values(id_empresa,jsonb_build_object('decision_state',jsonb_build_object('__excel',jsonb_build_object('habilitado',true,'resultado',resultado,'historial',p_cierre->'historialPorEmpresa'->id_empresa::text,'eliminada',p_cierre->'eliminadas' ? id_empresa::text))))
  on conflict(empresa_id) do update set snapshot=jsonb_set(side_student_state.snapshot,'{decision_state}',coalesce(side_student_state.snapshot->'decision_state','{}')||jsonb_build_object('__excel',coalesce(side_student_state.snapshot#>'{decision_state,__excel}','{}')||(excluded.snapshot#>'{decision_state,__excel}'))),revision=side_student_state.revision+1,updated_at=clock_timestamp();
 end loop;
 return jsonb_build_object('cierre',p_cierre,'reused',false);
end $$;
revoke all on function public.side_contexto_cierre_excel(uuid,integer) from public,anon;
revoke all on function public.side_guardar_cierre_excel(uuid,integer,text,jsonb) from public,anon;
grant execute on function public.side_contexto_cierre_excel(uuid,integer) to authenticated;
grant execute on function public.side_guardar_cierre_excel(uuid,integer,text,jsonb) to authenticated;


create or replace function public.side_preservar_reporte_excel()
returns trigger language plpgsql security definer set search_path=public as $$
declare r jsonb;f jsonb;
begin
 select x.cierre->'resultadosPorEmpresa'->new.empresa_id::text into r from public.side_excel_cierres x join public.participantes t on t.partida_id=x.partida_id where t.empresa_id=new.empresa_id and x.ciclo=new.ciclo limit 1;
 if r is null then return new;end if;f:=r->'financial';
 new.capital:=(f#>>'{balanceCaja,cajaInicial}')::numeric;new.ingresos:=(f#>>'{estadoResultados,ingresos}')::numeric;new.costos:=(f#>>'{estadoResultados,costos}')::numeric;new.utilidad:=(f#>>'{estadoResultados,utilidad}')::numeric;new.caja_final:=(f#>>'{balanceCaja,cajaFinal}')::numeric;new.balance_caja:=f->'balanceCaja';new.flujo_caja:=f->'flujoCaja';new.estado_resultados:=(f->'estadoResultados')||jsonb_build_object('excel',r);return new;
end $$;
drop trigger if exists side_excel_reporte_protegido on public.reportes_ciclo;
create trigger side_excel_reporte_protegido before insert or update on public.reportes_ciclo for each row execute function public.side_preservar_reporte_excel();

notify pgrst,'reload schema';
commit;
