-- Solo lectura. Ejecutar con la sesión docente/SQL Editor de este proyecto.
-- Distingue cierre pendiente, cierre realmente en cero y reporte sobrescrito.
-- No confirma planes, no recalcula cierres y no cambia caja ni decisiones.
with sala as (
  select id,codigo,configuracion from public.partidas where codigo='SIDE-7DFR'
), periodos as (
  select p.id,p.codigo,t.empresa_id,t.empresa,g.ciclo
  from sala p
  join public.participantes t on t.partida_id=p.id and t.empresa_id is not null
  cross join lateral generate_series(1,greatest(1,
    coalesce(nullif(p.configuracion#>>'{runtime,round}','')::integer,1),
    coalesce((select max(c.ciclo) from public.side_business_closures c where c.partida_id=p.id),1)
  )) g(ciclo)
), datos as (
  select p.*,s.updated_at as ultima_sincronizacion,s.snapshot->'round' as ciclo_snapshot,
    s.snapshot#>array['decision_state','__cyclePlans',p.ciclo::text,'state'] as plan,
    s.snapshot#>array['decision_state','__cycleSettlements',p.ciclo::text] as recibo_estudiante,
    c.cierre#>array['resultadosPorEmpresa',p.empresa_id::text,'receipt'] as recibo_cierre,
    c.cierre is not null as cierre_guardado,r.ingresos as ingresos_reporte,
    r.estado_resultados->'cycleReceipt' as recibo_reporte
  from periodos p
  left join public.side_student_state s on s.empresa_id=p.empresa_id
  left join public.side_business_closures c on c.partida_id=p.id and c.ciclo=p.ciclo
  left join public.reportes_ciclo r on r.empresa_id=p.empresa_id and r.ciclo=p.ciclo
)
select codigo,empresa_id,empresa,ciclo,ciclo_snapshot,ultima_sincronizacion,
  plan is not null as plan_guardado,plan->'PRODUCCION_META' as meta_confirmada,
  plan->'CANALES' as canales_confirmados,
  cierre_guardado,
  recibo_cierre->'produced' as producidas,recibo_cierre->'sold' as vendidas,
  recibo_cierre->'revenue' as ingresos_cierre,ingresos_reporte,
  recibo_estudiante->'sold' as vendidas_estudiante,
  recibo_reporte->'sold' as vendidas_reporte,
  recibo_cierre#>'{production,processes}' as etapas_productivas,
  recibo_cierre#>'{production,materials}' as materiales,
  recibo_cierre->'sales' as ventas_y_motivos_por_segmento,
  case
    when not cierre_guardado then 'CIERRE PENDIENTE'
    when recibo_cierre is null then 'EMPRESA SIN RESULTADO EN EL CIERRE'
    when coalesce((recibo_cierre->>'sold')::numeric,0)=0 then 'CIERRE GUARDADO CON CERO: REVISAR PLAN Y MOTIVOS'
    when ingresos_reporte is distinct from (recibo_cierre->>'revenue')::numeric
      or recibo_reporte is distinct from recibo_cierre then 'REPORTE DISTINTO DEL CIERRE: APLICAR REPARACION'
    when recibo_estudiante is null then 'VENTAS GUARDADAS: ESTUDIANTE PENDIENTE DE SINCRONIZAR'
    else 'VENTAS Y REPORTE COINCIDEN'
  end as diagnostico
from datos order by empresa_id,ciclo;
