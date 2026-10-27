-- Solo lectura: ciclo 1 de la partida SIDE-5BM9.
-- Ejecutar en Supabase SQL Editor después de que el docente cierre el ciclo.
with partida_objetivo as (
  select id, codigo from public.partidas where codigo = 'SIDE-5BM9'
)
select
  p.codigo as partida,
  t.empresa as empresa,
  e.id as empresa_id,
  t.expulsada_at as fecha_eliminacion,
  s.snapshot#>'{decision_state,__cyclePlans,1}' is not null as plan_ciclo_1_guardado,
  s.snapshot#>>'{decision_state,__cyclePlans,1,source}' as origen_del_plan,
  s.updated_at as ultima_sincronizacion,
  c.partida_id is not null as cierre_ciclo_1_guardado,
  coalesce(c.cierre->'resultadosPorEmpresa' ? e.id::text, false) as empresa_incluida_en_cierre,
  c.cierre#>>array['resultadosPorEmpresa',e.id::text,'receipt','produced'] as unidades_producidas,
  c.cierre#>>array['resultadosPorEmpresa',e.id::text,'receipt','sold'] as unidades_vendidas,
  c.cierre#>>array['resultadosPorEmpresa',e.id::text,'receipt','revenue'] as ventas_calculadas,
  r.ingresos as ingresos_en_reporte,
  s.snapshot#>>'{decision_state,__cycleSettlements,1,revenue}' as ventas_en_estado_estudiante,
  case
    when c.partida_id is null then 'CIERRE PENDIENTE'
    when not coalesce(c.cierre->'resultadosPorEmpresa' ? e.id::text, false) then 'EMPRESA FUERA DEL CIERRE'
    when coalesce((c.cierre#>>array['resultadosPorEmpresa',e.id::text,'receipt','revenue'])::numeric,0)=0 then 'CIERRE CON VENTAS CERO'
    else 'VENTAS CALCULADAS'
  end as diagnostico
from partida_objetivo p
join public.participantes t on t.partida_id=p.id and t.empresa_id is not null
join public.empresas e on e.id=t.empresa_id
left join public.side_student_state s on s.empresa_id=e.id
left join public.side_business_closures c on c.partida_id=p.id and c.ciclo=1
left join public.reportes_ciclo r on r.empresa_id=e.id and r.ciclo=1
order by e.id;
