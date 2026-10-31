-- Optional private news: depends on the session-owned claims introduced by
-- 20261028151956_identidad_estudiante and 20261028203832_acceso_estudiante_sin_clave.
-- This migration does not enable economicEventsVersion for any game.
create or replace function public.side_student_events_v1(p_partida_id uuid,p_empresa_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; cfg jsonb; current_round integer; phase text;
begin
 if auth.uid() is null or not exists (
   select 1 from public.participantes p join side_private.student_claims claim on claim.empresa_id=p.empresa_id
   where p.partida_id=p_partida_id and p.empresa_id=p_empresa_id and claim.owner_id=auth.uid() and p.expulsada_at is null
 ) then raise exception 'No autorizado' using errcode='42501'; end if;
 select configuracion into cfg from public.partidas where id=p_partida_id;
 if cfg->>'economicEventsVersion' is distinct from 'demand-share-v1' then return '[]'::jsonb; end if;
 current_round:=coalesce((public.side_runtime(cfg)->>'round')::integer,1);
 phase:=coalesce(public.side_runtime(cfg)->>'phase','integration');
 select coalesce(jsonb_agg(jsonb_build_object(
   'eventId',e.event_id,'round',e.ciclo,'intensity',e.intensity,
   'title',case e.event_id when 'PE23' then 'Inseguridad en zona comercial' when 'PE30' then 'Falla en máquina ensambladora' when 'PE68' then 'Ataque de phishing empresarial' when 'PE69' then 'Producto viral en TikTok' when 'PE71' then 'Recomendación de influencer peruano' when 'PE74' then 'Campaña de marketing altamente efectiva' when 'PE75' then 'Campaña de marketing ineficiente' when 'PE77' then 'Inspección municipal del local' end,
   'description',case when e.event_id='PE23' then 'Si tienes una tienda física activa, afrontarás un gasto extraordinario de S/ 500 por seguridad.' when e.event_id='PE30' then 'La capacidad de ensamblado se reduce durante el ciclo y, si tienes maquinaria de ensamblado, se paga S/ 200 de reparación.' when e.event_id='PE68' then 'El incidente genera un gasto extraordinario de S/ 1.200.' when e.event_id='PE74' then 'Si inviertes en marketing este ciclo, la campaña aumenta el atractivo relativo de tu marca; las ventas dependen de la demanda y del inventario.' when e.event_id='PE75' then 'La campaña reduce el atractivo relativo de tu marca al repartir la demanda; las ventas dependen de la demanda asignada y el inventario.' when e.event_id='PE77' then 'Si tienes una tienda física activa, la inspección genera S/ 300 de gasto administrativo.' else 'La atención hacia tu marca aumenta su atractivo relativo al repartir la demanda; las ventas dependen de la demanda asignada y el inventario.' end,
   'result',case when c.partida_id is null then null else jsonb_build_object('produced',c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'receipt','produced'],'sold',c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'receipt','sold'],'eventCash',c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'financial','flujoCaja','eventos']) end,
   'status',case when c.partida_id is not null then
     case when coalesce(c.cierre#>array['resultadosPorEmpresa',e.empresa_id::text,'receipt','events'],'[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id',e.event_id,'round',e.ciclo,'intensity',e.intensity,'version',case when e.event_id='PE30' then 'assembly-breakdown-v1' when e.event_id in ('PE23','PE68','PE77') then 'operating-expense-v1' else 'demand-share-v1' end)) then 'aplicado' else 'no_aplicado' end
     when e.ciclo=current_round and phase='decisions' then 'activo' else 'programado' end
 ) order by e.ciclo,e.event_id),'[]'::jsonb) into result
 from public.side_event_assignments_v1 e left join public.side_business_closures c on c.partida_id=e.partida_id and c.ciclo=e.ciclo
 where e.partida_id=p_partida_id and e.empresa_id=p_empresa_id;
 return result;
end $$;
revoke all on function public.side_student_events_v1(uuid,bigint) from public,anon,authenticated;
grant execute on function public.side_student_events_v1(uuid,bigint) to authenticated;
