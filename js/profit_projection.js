/* Read-only counterfactuals from the same cycle model as official settlement. */
(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./cycle_model.js'):root.SIDE_CYCLE_MODEL);if(node)module.exports=api;else root.SIDE_PROFIT_PROJECTION=api;})(typeof globalThis!=='undefined'?globalThis:this,function(CYCLE){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 function project(input){
  const value=CYCLE.project({...input,state:clone(input.state),ledger:clone(input.ledger||{}),sectionsByRound:clone(input.sectionsByRound||{})});
  if(!value)return null;
  const receipt=value.receipt,statement=value.financial.estadoResultados,balance=value.financial.balanceGeneral;
  return {produced:receipt.produced,sold:receipt.sold,demand:receipt.sales.reduce((s,r)=>s+Number(r.demand||0),0),income:statement.ventasTotales,cost:statement.costos,productionCost:statement.costosProduccion,unitCost:receipt.produced?statement.costosProduccion/receipt.produced:null,profit:statement.utilidadNeta,cash:balance.efectivo,sales:receipt.sales.filter(r=>r.available||r.produced).map(r=>({id:r.id,price:r.price,sold:r.sold,demand:r.demand})),plan:receipt.production};
 }
 function analyze(input){
  if(input.state?.__materialOrders)return {available:false,reason:'Las recepciones de insumos requieren una proyección autoritativa.'};
  try{
   const base=project(input);if(!base)return {available:false,reason:'El ciclo ya está cerrado.'};
   const mutations=[];
   for(const [kind,ids] of [['Personal',['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO']],['Maquinaria',['MESA_CORTE','ENSAMBLE','ACABADOS']],['Insumos',['CUERO','ACCESORIOS','HILO']]]){
    for(const id of ids){const e=input.state[id],quantities=kind==='Maquinaria'?e?.purchases?.[input.round]:e?.quantities;const option=Object.keys(quantities||{}).find(k=>Number(quantities[k])>0);if(!option)continue;
     const amount=Number(quantities[option]),decrease=kind==='Insumos'?amount*.1:1;if(amount-decrease<0)continue;
     mutations.push({label:`${kind}: reducir ${id} (${option})`,id,option,decrease,kind});break;
    }
   }
   if(!(input.state.CANALES?.optionIds||[]).includes('web'))mutations.push({label:'Canales: añadir web',id:'CANALES',kind:'Canales'});
   const alternatives=[];
   for(const m of mutations){
    try{
     const state=clone(input.state),entry=state[m.id];
     if(m.kind==='Canales')entry.optionIds=[...(entry.optionIds||[]),'web'];
     else if(m.kind==='Maquinaria')entry.purchases[input.round][m.option]-=m.decrease;
     else entry.quantities[m.option]-=m.decrease;
     const category=input.catalog.find(c=>c.items?.some(item=>item.id===m.id))?.cat;if(!category)continue;
     const ledger=clone(input.ledger||{}),sections=clone(input.sectionsByRound||{});delete ledger[`${input.round}:${category}`];if(sections[input.round])delete sections[input.round][category];
     const result=project({...input,state,ledger,sectionsByRound:sections});if(result)alternatives.push({label:m.label,profit:result.profit,cash:result.cash,sold:result.sold,produced:result.produced,difference:Math.round((result.profit-base.profit)*100)/100});
    }catch{}
   }
   // Sample the current single-product plan with unchanged purchases and
   // capacity. This is a scenario threshold, not a general break-even formula.
   let breakEven=null;const targets=input.state.PRODUCCION_META?.moldTargets||{},active=Object.entries(targets).filter(([,q])=>Number(q)>0);
   if(active.length===1){const [mold,raw]=active[0],max=Math.floor(Number(raw));
    for(let i=1;i<=20&&max>0;i++){const target=Math.max(1,Math.ceil(max*i/20)),state=clone(input.state);state.PRODUCCION_META.moldTargets={[mold]:target};state.PRODUCCION_META.value=target;
     const sample=project({...input,state});if(sample&&sample.profit>=0){breakEven={target,produced:sample.produced,sold:sample.sold};break;}
    }
   }
   return {available:true,base,alternatives,breakEven};
  }catch{return {available:false,reason:'No hay datos suficientes para calcular una proyección fiable.'};}
 }
 return {analyze};
});
