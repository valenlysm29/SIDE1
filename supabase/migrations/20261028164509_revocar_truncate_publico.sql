-- RLS does not apply to TRUNCATE. Limit these operations to the trusted database owner/service role.
-- Existing rows and policies are preserved; this migration does not modify data.
begin;
revoke truncate on table public.empresas, public.empresas_decisiones, public.decisiones_catalogo, public.decisiones_opciones from public, anon, authenticated;
commit;
