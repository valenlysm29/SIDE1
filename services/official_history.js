/* Read-only adapters for sealed PostgreSQL closures. No economic calculation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SIDE_OFFICIAL_HISTORY=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const labels={confirmed:'Cierre confirmado',in_progress:'Ciclo en curso · provisional',processing:'Cierre en procesamiento',missing:'Comprobante de empresa inexistente',not_started:'Ciclo todavía no iniciado',error:'Error al recuperar o procesar el cierre'};
 function rows(history,company){return (history?.cycles||[]).filter(r=>String(r.empresa_id)===String(company)).map(r=>({round:Number(r.ciclo),closedAt:r.closed_at,partidaId:r.partida_id,empresaId:r.empresa_id,closureError:r.processing_error,...(r.status==='confirmed'?{...r.result.financial,cycleReceipt:r.result.receipt,decisions:r.result.receipt?.decisions||r.result.state?.__cyclePlans?.[r.ciclo]?.state||{},officialResult:r.result}:{}),closureStatus:r.status}));}
 function report(base,cycle){
  const row=base.cycleHistory?.find(r=>Number(r.round)===Number(cycle));
  if(!row||row.closureStatus!=='confirmed'&&row.closureStatus!=='closed')return {...base,ronda:Number(cycle),cycleReceipt:null,provisional:true,closureStatus:row?.closureStatus||'missing',closureError:row?.closureError,estadoResultados:{},balanceCaja:{},flujoCaja:{},balanceGeneral:{}};
  const f=row,er=f.estadoResultados||{},bc=f.balanceCaja||{};
  return {...base,ronda:Number(cycle),provisional:false,closureStatus:'confirmed',cycleReceipt:f.cycleReceipt,estadoResultados:er,balanceCaja:bc,flujoCaja:f.flujoCaja||{},balanceGeneral:f.balanceGeneral||{},ingresos:er.ingresos,costos:er.costos,utilidad:er.utilidadNeta??er.utilidad,caja:bc.cajaFinal,updatedAt:f.closedAt};
 }
 function closure(history,cycle){const selected=(history?.cycles||[]).filter(r=>Number(r.ciclo)===Number(cycle)&&r.status==='confirmed');return selected.length?{ciclo:Number(cycle),resultadosPorEmpresa:Object.fromEntries(selected.map(r=>[String(r.empresa_id),r.result]))}:null;}
 return {rows,report,closure,label:status=>labels[status]||labels.error};
});
