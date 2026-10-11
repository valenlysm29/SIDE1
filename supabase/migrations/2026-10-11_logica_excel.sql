-- Aplicar después de supabase_student_admission.sql y las migraciones de ciclo.
-- No ejecutado por Codex. Reutiliza JSON y RLS; no modifica notas docentes.
begin;
create table if not exists public.side_excel_cierres (
  partida_id uuid not null references public.partidas(id) on delete cascade,
  ciclo integer not null check(ciclo>0), cierre jsonb not null,
  created_at timestamptz not null default now(), primary key(partida_id,ciclo)
);
alter table public.side_excel_cierres enable row level security;
revoke all on public.side_excel_cierres from public,anon,authenticated;

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
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id::text,'capital',e.caja_inicial,'revision',s.revision,'envelope',s.snapshot#>'{decision_state,__excel}') order by e.id),'[]')
 into empresas from public.empresas e join public.participantes t on t.empresa_id=e.id
 join public.side_student_state s on s.empresa_id=e.id
 where t.partida_id=p.id and s.snapshot#>>'{decision_state,__excel,habilitado}'='true';
 select coalesce(cierre->'historialPorEmpresa','{}') into historia from public.side_excel_cierres where partida_id=p.id and ciclo<p_ciclo order by ciclo desc limit 1;
 historia:=coalesce(historia,'{}');token:=md5(empresas::text||historia::text||p_ciclo::text||p.configuracion::text);
 return jsonb_build_object('empresas',empresas,'historialPorEmpresa',historia,'token',token,'overrides',coalesce(p.configuracion->'excelParametros','{}'));
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
 insert into public.side_excel_cierres(partida_id,ciclo,cierre) values(p.id,p_ciclo,p_cierre);
 for emp in select * from jsonb_array_elements(ctx->'empresas') loop
  id_empresa:=(emp->>'id')::bigint;resultado:=p_cierre->'resultadosPorEmpresa'->(id_empresa::text);
  if resultado is not null then
   fin:=resultado->'financial';
   insert into public.reportes_ciclo(empresa_id,ciclo,capital,ingresos,costos,utilidad,caja_final,balance_caja,flujo_caja,estado_resultados)
   values(id_empresa,p_ciclo,(emp->>'capital')::numeric,(fin#>>'{estadoResultados,ingresos}')::numeric,(fin#>>'{estadoResultados,costos}')::numeric,(fin#>>'{estadoResultados,utilidad}')::numeric,(fin#>>'{balanceCaja,cajaFinal}')::numeric,fin->'balanceCaja',fin->'flujoCaja',(fin->'estadoResultados')||jsonb_build_object('excel',resultado))
   on conflict(empresa_id,ciclo) do update set ingresos=excluded.ingresos,costos=excluded.costos,utilidad=excluded.utilidad,caja_final=excluded.caja_final,balance_caja=excluded.balance_caja,flujo_caja=excluded.flujo_caja,estado_resultados=excluded.estado_resultados;
   update public.empresas set caja_actual=(fin#>>'{balanceCaja,cajaFinal}')::numeric where id=id_empresa;
  end if;
  -- Se conserva dentro de decision_state para la lista blanca existente del snapshot.
  update public.side_student_state set snapshot=jsonb_set(snapshot,'{decision_state,__excel}',coalesce(snapshot#>'{decision_state,__excel}','{}')||jsonb_build_object('resultado',resultado,'historial',p_cierre->'historialPorEmpresa'->id_empresa::text,'eliminada',p_cierre->'eliminadas' ? id_empresa::text)),revision=revision+1,updated_at=clock_timestamp() where empresa_id=id_empresa;
 end loop;
 return jsonb_build_object('cierre',p_cierre,'reused',false);
end $$;
revoke all on function public.side_contexto_cierre_excel(uuid,integer) from public,anon;
revoke all on function public.side_guardar_cierre_excel(uuid,integer,text,jsonb) from public,anon;
grant execute on function public.side_contexto_cierre_excel(uuid,integer) to authenticated;
grant execute on function public.side_guardar_cierre_excel(uuid,integer,text,jsonb) to authenticated;

-- Un snapshot atrasado o un reporte de alumno no puede sustituir resultados
-- aprobados por el docente ni reabrir decisiones de ciclos ya cerrados.
create or replace function public.side_preservar_cierre_excel_snapshot()
returns trigger language plpgsql security definer set search_path=public as $$
declare c jsonb; s jsonb; planes jsonb; fila record;
begin
 select x.cierre into c from public.side_excel_cierres x join public.participantes t on t.partida_id=x.partida_id where t.empresa_id=new.empresa_id and (x.cierre->'resultadosPorEmpresa' ? new.empresa_id::text or x.cierre->'eliminadas' ? new.empresa_id::text) order by x.ciclo desc limit 1;
 if c is null then return new; end if;
 s:=coalesce(new.snapshot#>'{decision_state,__excel}','{}');planes:=coalesce(s->'planesPorCiclo','{}');
 for fila in select x.ciclo,x.cierre->'resultadosPorEmpresa'->new.empresa_id::text as r from public.side_excel_cierres x join public.participantes t on t.partida_id=x.partida_id where t.empresa_id=new.empresa_id order by x.ciclo loop
  if fila.r is not null then planes:=jsonb_set(planes,array[fila.ciclo::text],fila.r->'decisiones');end if;
 end loop;
 s:=s||jsonb_build_object('habilitado',true,'resultado',c->'resultadosPorEmpresa'->new.empresa_id::text,'historial',c->'historialPorEmpresa'->new.empresa_id::text,'planesPorCiclo',planes,'eliminada',c->'eliminadas' ? new.empresa_id::text);
 new.snapshot:=jsonb_set(new.snapshot,'{decision_state}',coalesce(new.snapshot->'decision_state','{}')||jsonb_build_object('__excel',s));return new;
end $$;
drop trigger if exists side_excel_snapshot_protegido on public.side_student_state;
create trigger side_excel_snapshot_protegido before update on public.side_student_state for each row execute function public.side_preservar_cierre_excel_snapshot();

create or replace function public.side_preservar_reporte_excel()
returns trigger language plpgsql security definer set search_path=public as $$
declare r jsonb;f jsonb;
begin
 select x.cierre->'resultadosPorEmpresa'->new.empresa_id::text into r from public.side_excel_cierres x join public.participantes t on t.partida_id=x.partida_id where t.empresa_id=new.empresa_id and x.ciclo=new.ciclo limit 1;
 if r is null then return new;end if;f:=r->'financial';
 new.ingresos:=(f#>>'{estadoResultados,ingresos}')::numeric;new.costos:=(f#>>'{estadoResultados,costos}')::numeric;new.utilidad:=(f#>>'{estadoResultados,utilidad}')::numeric;new.caja_final:=(f#>>'{balanceCaja,cajaFinal}')::numeric;new.balance_caja:=f->'balanceCaja';new.flujo_caja:=f->'flujoCaja';new.estado_resultados:=(f->'estadoResultados')||jsonb_build_object('excel',r);return new;
end $$;
drop trigger if exists side_excel_reporte_protegido on public.reportes_ciclo;
create trigger side_excel_reporte_protegido before insert or update on public.reportes_ciclo for each row execute function public.side_preservar_reporte_excel();
commit;
