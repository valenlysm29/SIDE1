-- Después del paquete docs/sql/20261023_despliegue_cierre_v19.sql.
-- Lectura docente del plan confirmado y del ciclo real de la partida.
-- No recalcula cierres, cobra ventas ni modifica decisiones o inventarios.
begin;
create or replace function public.obtener_reporte_empresa(
  p_empresa_id bigint, p_ciclo integer default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare contexto jsonb;
begin
  -- SECURITY DEFINER exige propietario también para acceder al snapshot.
  select jsonb_build_object(
    'partida_id',p.id,'codigo',p.codigo,
    'ciclo',public.side_ciclo_actual(p.configuracion),
    'phase',coalesce(p.configuracion#>>'{runtime,phase}','integration'),
    'estado',p.estado,'configuracion',p.configuracion,
    'snapshot',coalesce(s.snapshot,'{}'::jsonb),'updated_at',s.updated_at
  ) into contexto
  from public.participantes pt
  join public.partidas p on p.id=pt.partida_id
  left join public.side_student_state s on s.empresa_id=pt.empresa_id
  where pt.empresa_id=p_empresa_id and p.profesor_id=auth.uid()
    and auth.uid() is not null
  order by p.created_at desc limit 1;
  if contexto is null then
    return jsonb_build_object('success',false,'code','ACCESO_DENEGADO',
      'error','No tienes permiso para consultar esta empresa.');
  end if;
  return jsonb_build_object(
    'empresa',(select to_jsonb(e) from public.empresas e where e.id=p_empresa_id),
    'reportes',(select coalesce(jsonb_agg(to_jsonb(r) order by r.ciclo),'[]'::jsonb)
      from public.reportes_ciclo r where r.empresa_id=p_empresa_id
      and (p_ciclo is null or r.ciclo=p_ciclo)),
    'decisiones',(select coalesce(jsonb_agg(to_jsonb(ed) order by ed.ciclo),'[]'::jsonb)
      from public.empresas_decisiones ed where ed.empresa_id=p_empresa_id
      and (p_ciclo is null or ed.ciclo=p_ciclo)),
    'contexto_juego',contexto
  );
end $$;
revoke all on function public.obtener_reporte_empresa(bigint,integer) from public,anon,authenticated;
grant execute on function public.obtener_reporte_empresa(bigint,integer) to authenticated;
commit;
