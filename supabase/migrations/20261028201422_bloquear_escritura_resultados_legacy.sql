-- SECURITY: retire legacy public writers that trust client-provided financials.
-- Existing historical reports remain readable; server closure uses
-- side_guardar_cierre_negocio and does not call these functions.
-- Legacy rooms must use the trusted worker or remain pending review.
begin;
revoke execute on function public.side_guardar_cierre_excel(uuid,integer,text,jsonb) from public, anon, authenticated;
revoke execute on function public.guardar_reporte(bigint,integer,jsonb) from public, anon, authenticated;
-- The older student wrapper is SECURITY DEFINER and can otherwise call the
-- revoked helper as owner; modern clients do not persist definitive reports.
revoke execute on function public.guardar_reporte_estudiante(text,text,text,integer,jsonb,bigint) from public, anon, authenticated;
commit;
