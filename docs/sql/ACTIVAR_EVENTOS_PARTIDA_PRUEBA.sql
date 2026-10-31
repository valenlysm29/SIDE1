-- HISTÓRICO: V2 sigue pendiente de aceptación; no activar todavía.
-- Este archivo conserva la activación manual preparada anteriormente.
BEGIN;
DO $activar$
DECLARE
 codigo_prueba constant text := 'REEMPLAZA_CODIGO';
 juego public.partidas;
BEGIN
 IF codigo_prueba = 'REEMPLAZA_CODIGO' THEN RAISE EXCEPTION 'Sustituye REEMPLAZA_CODIGO por el código de la partida de prueba'; END IF;
 IF to_regprocedure('public.side_event_context_v1(uuid,bigint,integer)') IS NULL OR to_regprocedure('public.side_draw_events_v1(uuid,integer)') IS NULL OR to_regprocedure('public.side_student_events_v1(uuid,bigint)') IS NULL THEN RAISE EXCEPTION 'Faltan las funciones autoritativas de eventos'; END IF;
 SELECT * INTO juego FROM public.partidas WHERE codigo=codigo_prueba FOR UPDATE;
 IF juego.id IS NULL THEN RAISE EXCEPTION 'Partida no encontrada'; END IF;
 IF juego.estado <> 'esperando' OR coalesce(public.side_runtime(juego.configuracion)->>'phase','') <> 'integration' THEN RAISE EXCEPTION 'La partida debe estar en integración'; END IF;
 IF EXISTS (SELECT 1 FROM public.side_business_closures WHERE partida_id=juego.id) THEN RAISE EXCEPTION 'La partida ya tiene cierres'; END IF;
 IF EXISTS (SELECT 1 FROM public.participantes p JOIN public.side_student_state s ON s.empresa_id=p.empresa_id WHERE p.partida_id=juego.id AND s.snapshot->>'decisions_submitted'='true') THEN RAISE EXCEPTION 'Ya hay decisiones confirmadas'; END IF;
 IF juego.configuracion ? 'economicEventsVersion' AND juego.configuracion->>'economicEventsVersion' IS DISTINCT FROM 'demand-share-v1' THEN RAISE EXCEPTION 'La partida ya tiene otra versión de eventos'; END IF;
 UPDATE public.partidas SET configuracion=jsonb_set(configuracion,'{economicEventsVersion}',to_jsonb('demand-share-v1'::text),true) WHERE id=juego.id;
 RAISE NOTICE 'Eventos experimentales habilitados para la partida %',codigo_prueba;
END $activar$;
COMMIT;
