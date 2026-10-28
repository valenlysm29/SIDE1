do $$
declare teacher uuid:=gen_random_uuid(); pupil uuid:=gen_random_uuid(); game uuid:=gen_random_uuid(); v_code text:='QWER'; joined jsonb; response jsonb; eid bigint;
begin
 insert into auth.users(id) values(teacher),(pupil);
 insert into public.profesores(id,nombre,apellido) values(teacher,'Teacher','Test') on conflict(id) do nothing;
 insert into public.partidas(id,profesor_id,nombre,codigo,configuracion) values(game,teacher,'TEST EXPULSION',v_code,'{}');
 perform set_config('request.jwt.claim.sub',pupil::text,true);
 joined:=public.side_ingresar_empresa_segura(v_code,'Company','Company',null); if not coalesce((joined->>'success')::boolean,false) then raise exception 'JOIN FAILED %',joined;end if;eid:=(joined->>'empresa_id')::bigint;
 response:=public.side_ingresar_empresa_segura(v_code,'Company','Company',null);if not coalesce((response->>'success')::boolean,false) then raise exception 'REENTRY FAILED %',response;end if;
 perform set_config('request.jwt.claim.sub',teacher::text,true);
 response:=public.side_expulsar_empresa(game,eid,true);if not coalesce((response->>'success')::boolean,false) then raise exception 'EXPEL FAILED %',response;end if;
 perform set_config('request.jwt.claim.sub',pupil::text,true);
 response:=public.side_ingresar_empresa_segura(v_code,'Company','Company',null);if response->>'code'<>'EMPRESA_EXPULSADA' then raise exception 'REJECT FAILED %',response;end if;
 perform set_config('request.jwt.claim.sub',teacher::text,true);
 response:=public.side_expulsar_empresa(game,eid,false);if not coalesce((response->>'success')::boolean,false) then raise exception 'REACTIVATE FAILED %',response;end if;
 perform set_config('request.jwt.claim.sub',pupil::text,true);
 response:=public.side_ingresar_empresa_segura(v_code,'Company','Company',null);if not coalesce((response->>'success')::boolean,false) then raise exception 'REENTRY AFTER REACTIVATION FAILED %',response;end if;
 raise notice 'PASS creation reentry expulsion rejection and reactivation';
end $$;

