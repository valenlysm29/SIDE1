-- Extend the experimental rotation without modifying prior assignments.
do $migration$
declare definition text;
 old_rule text:='if cardinality(v_roster) is distinct from 3 then raise exception ''Esta programación experimental requiere exactamente tres empresas activas''; end if;';
 new_rule text:='if coalesce(cardinality(v_roster),0)<2 then raise exception ''Se requieren al menos dos empresas activas''; end if;';
begin
 definition:=pg_get_functiondef('public.side_schedule_balanced_v1(uuid,integer)'::regprocedure);
 if strpos(definition,old_rule)>0 then execute replace(definition,old_rule,new_rule);
 elsif strpos(definition,new_rule)=0 then raise exception 'Programador equilibrado incompatible'; end if;
end $migration$;
