-- Persist the experimental teacher selection without changing event assignment rules.
do $migration$
declare definition text; needle text:='c:=c||jsonb_build_object(''eventRules'',coalesce(p_config->''eventRules'',c->''eventRules'',''{}''),''enabledEvents'',p_config->''enabledEvents'',''eventSelectionMode'',p_config->''eventSelectionMode'',''randomEventCount'',p_config->''randomEventCount'');'; replacement text;
begin
 definition:=pg_get_functiondef('public.controlar_partida(uuid,text,jsonb,integer)'::regprocedure);
 if strpos(definition,'''challengeModeV1''')=0 then
  if strpos(definition,needle)=0 then raise exception 'Configuración de eventos incompatible'; end if;
  replacement:='if p_config ? ''challengeModeV1'' and (p_config->>''challengeModeV1'') not in (''manual'',''random'',''balanced'') then return jsonb_build_object(''error'',''Modo de desafíos inválido''); end if;'||chr(10)||'c:=c||jsonb_build_object(''challengeModeV1'',coalesce(p_config->>''challengeModeV1'',c->>''challengeModeV1'',''manual''));'||chr(10)||needle;
  execute replace(definition,needle,replacement);
 end if;
end $migration$;
