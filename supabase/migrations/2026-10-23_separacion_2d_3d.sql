-- SIDE: separación 2D/3D. Ejecución MANUAL, nunca desde el cliente 3D.
-- Orden: 1) paquete docs/sql/20261023_despliegue_cierre_completo.sql si aún
-- no se instaló el cierre vigente; 2) este archivo completo, al final de
-- cualquier migración histórica. No volver a instalar triggers del motor anterior.
-- No crea tablas recreativas, no recalcula ni borra cierres, no modifica fórmulas.
-- Repetible: funciona también si las tablas o los triggers ya no existen.
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
-- Reversión MANUAL, solo para restaurar deliberadamente el motor histórico:
-- Sus funciones se conservan. Ejecutar únicamente si existen tablas y funciones:
-- begin;
-- drop trigger if exists side_excel_snapshot_protegido on public.side_student_state;
-- create trigger side_excel_snapshot_protegido before update
--   on public.side_student_state for each row execute function public.side_preservar_cierre_excel_snapshot();
-- drop trigger if exists side_excel_reporte_protegido on public.reportes_ciclo;
-- create trigger side_excel_reporte_protegido before insert or update
--   on public.reportes_ciclo for each row execute function public.side_preservar_reporte_excel();
-- commit;
-- ADVERTENCIA: esa reversión vuelve a permitir que resultados históricos
-- sobrescriban decisiones, ingresos y caja del modelo vigente.
