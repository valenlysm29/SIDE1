-- Ejecutar manualmente en Supabase, después de desplegar el cliente restaurado.
-- Conserva tablas, cierres, decisiones y funciones históricas para auditoría.
-- Retira exclusivamente los triggers que reinyectan el motor anterior en
-- snapshots/reportes, sobrescribiendo caja y decisiones del cliente restaurado.
begin;
do $migration$
begin
  if to_regclass('public.side_student_state') is not null then
    execute 'drop trigger if exists side_excel_snapshot_protegido on public.side_student_state';
  end if;
  if to_regclass('public.reportes_ciclo') is not null then
    execute 'drop trigger if exists side_excel_reporte_protegido on public.reportes_ciclo';
  end if;
end
$migration$;
commit;
-- No instala un motor nuevo en el servidor: el cliente liquida los ciclos
-- pendientes al reconectarse. Con todos los clientes desconectados, los ingresos
-- permanecen pendientes hasta esa reconexión. No ejecutar migraciones antiguas
-- de integración después de esta, porque volverían a crear estos triggers.
