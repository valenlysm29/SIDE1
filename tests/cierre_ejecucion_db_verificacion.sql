select set_config('test.role','service_role',false);
insert into public.partidas values('00000000-0000-0000-0000-000000000001');
insert into public.side_closure_execution_requests(run_id,request_id) values('00000000-0000-0000-0000-000000000011',11),('00000000-0000-0000-0000-000000000012',12);
do $$ begin
 if not public.side_iniciar_intento_cierre('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001',1) then raise exception 'claim failed'; end if;
 if public.side_estado_intento_cierre('00000000-0000-0000-0000-000000000001',1)<>'processing' then raise exception 'active'; end if;
 if public.side_iniciar_intento_cierre('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001',1) then raise exception 'concurrent claim'; end if;
 insert into net._http_response(id,status_code) values(11,503);
 if public.side_estado_intento_cierre('00000000-0000-0000-0000-000000000001',1)<>'interrupted' then raise exception 'interruption'; end if;
 if not public.side_iniciar_intento_cierre('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001',1) then raise exception 'recovery'; end if;
 perform public.side_finalizar_intento_cierre('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001',1,false,false,null,'old');
 if (select finished_at is not null from public.side_closure_execution_attempts where ciclo=1) then raise exception 'stale finish'; end if;
 insert into public.side_business_closures values('00000000-0000-0000-0000-000000000001',1);
 perform public.side_finalizar_intento_cierre('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001',1,true,false,null,null);
 if (select outcome from public.side_closure_execution_attempts where ciclo=1)<>'confirmed' then raise exception 'confirmation'; end if;
 if public.side_iniciar_intento_cierre('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001',1) then raise exception 'duplicate'; end if;
end $$;
do $$ begin
 if not public.side_iniciar_intento_cierre('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001',2) then raise exception 'second cycle'; end if;
 update public.side_closure_execution_attempts set updated_at=clock_timestamp()-interval '2 minutes' where ciclo=2;
 if public.side_estado_intento_cierre('00000000-0000-0000-0000-000000000001',2)<>'unknown' then raise exception 'expired attempt without response must remain unknown'; end if;
 perform public.side_finalizar_intento_cierre('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001',2,false,false,'TEST_ERROR','failure');
 if (select outcome from public.side_closure_execution_attempts where ciclo=2)<>'error' then raise exception 'failure outcome'; end if;
end $$;
do $$ declare result jsonb; begin
 result:=public.side_guardar_cierre_con_intento('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001',2,'token','{}');
 if result->>'code'<>'INTENTO_REEMPLAZADO' then raise exception 'stale worker was not fenced'; end if;
end $$;
