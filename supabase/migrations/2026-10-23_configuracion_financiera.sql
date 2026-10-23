-- Ejecutar después de las migraciones de sala y cierre Excel. No reescribe cierres.
begin;
create or replace function public.side_financial_values(c jsonb)
returns jsonb language sql immutable as $$
 select jsonb_build_object('interest',coalesce(c->'interest','20'),'capitalMode',coalesce(c->'capitalMode','"fixed"'),
 'capital',coalesce(c->'capital','100000'),'capitalMin',coalesce(c->'capitalMin','80000'),'capitalMax',coalesce(c->'capitalMax','120000'))
$$;
revoke all on function public.side_financial_values(jsonb) from public,anon,authenticated;

create or replace function public.side_schedule_financial(c jsonb,requested jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare v jsonb:=public.side_financial_values(requested);oldv jsonb:=public.side_financial_values(c);rows jsonb;effective integer;key text;
begin
 if v=oldv then return '{}'::jsonb;end if;
 foreach key in array array['interest','capital','capitalMin','capitalMax'] loop
  if jsonb_typeof(v->key)<>'number' or (v->>key)::numeric<0 or (v->>key)::numeric>1000000000000 then
   raise exception 'Configuración financiera inválida: %',key;
  end if;
 end loop;
 if v->>'capitalMode' not in ('fixed','random') or (v->>'capitalMax')::numeric<(v->>'capitalMin')::numeric then raise exception 'Rango de caja inválido';end if;
 effective:=coalesce((c#>>'{runtime,round}')::integer,(c->>'round')::integer,1)+1;
 if effective>coalesce((c->>'cycles')::integer,1) then raise exception 'No quedan ciclos para aplicar cambios financieros';end if;
 rows:=coalesce(c->'financialSchedule',jsonb_build_array(oldv||jsonb_build_object('effectiveRound',1)));
 select coalesce(jsonb_agg(row order by (row->>'effectiveRound')::integer),'[]') into rows from jsonb_array_elements(rows) row where (row->>'effectiveRound')::integer<effective;
 return v||jsonb_build_object('financialSchedule',rows||jsonb_build_array(v||jsonb_build_object('effectiveRound',effective)));
end $$;
revoke all on function public.side_schedule_financial(jsonb,jsonb) from public,anon,authenticated;

-- Conserva la firma y todos los controles existentes de dueño, reloj y eventos.
do $migration$
declare definition text;needle text:='c:=c||jsonb_build_object(''eventRules'',coalesce(p_config->''eventRules'',c->''eventRules'',''{}''),''enabledEvents'',p_config->''enabledEvents'',''eventSelectionMode'',p_config->''eventSelectionMode'',''randomEventCount'',p_config->''randomEventCount'');';
begin
 definition:=pg_get_functiondef('public.controlar_partida(uuid,text,jsonb,integer)'::regprocedure);
 if strpos(definition,'public.side_schedule_financial(c,p_config)')=0 then
  if strpos(definition,needle)=0 then raise exception 'Firma de guardar configuración no compatible; aplicar migraciones de sala primero';end if;
  definition:=replace(definition,needle,'c:=c||public.side_schedule_financial(c,p_config);'||chr(10)||needle);
  execute definition;
 end if;
 -- Contexto incluye la programación autoritativa; token ya incluye configuración.
 definition:=pg_get_functiondef('public.side_contexto_cierre_excel(uuid,integer)'::regprocedure);
 if strpos(definition,'''financialConfig''')=0 then
  if strpos(definition,'''overrides'',coalesce(p.configuracion->''excelParametros'',''{}''))')=0 then raise exception 'Contexto Excel incompatible';end if;
  definition:=replace(definition,'''overrides'',coalesce(p.configuracion->''excelParametros'',''{}''))','''financialConfig'',p.configuracion,''overrides'',coalesce(p.configuracion->''excelParametros'',''{}''))');
  execute definition;
 end if;
 -- Las nuevas admisiones conservan la caja inicial del ciclo 1; el aporte
 -- programado se aplica igual que a las empresas que ya estaban presentes.
 definition:=pg_get_functiondef('public.ingresar_empresa(text,text,text)'::regprocedure);
 if strpos(definition,'financialSchedule,0')=0 then
  foreach needle in array array['capitalMode','capitalMin','capitalMax','capital'] loop
   definition:=replace(definition,'v_partida.configuracion->>'''||needle||'''','coalesce(v_partida.configuracion#>''{financialSchedule,0}'',v_partida.configuracion)->>'''||needle||'''');
  end loop;
  execute definition;
 end if;
end $migration$;
commit;
