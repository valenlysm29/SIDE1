/* Escenarios aislados: solo recibos de la versión reproducible, sin red ni escrituras. */
(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./engine/cierre.js'):root.SIDE_ECONOMIC_CLOSURE,node?require('./cycle_model.js'):root.SIDE_CYCLE_MODEL);if(node)module.exports=api;else root.SIDE_LAB_SCENARIO=api;})(typeof globalThis!=='undefined'?globalThis:this,function(engine,cycle){'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
const unavailable=reason=>({available:false,reason});
const groups={materials:['CUERO','ACCESORIOS','HILO'],workers:['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO']};
function fingerprint(plan){if(!plan||!Array.isArray(plan.processes)||!Array.isArray(plan.materials)||!Array.isArray(plan.productLines))return null;return JSON.stringify({target:plan.target,producibleUnits:plan.producibleUnits,processCapacity:plan.processCapacity,materialCapacity:plan.materialCapacity,efficiency:plan.efficiency,processes:plan.processes.map(p=>[p.id,p.dailyCapacity,p.cycleCapacity,p.pairs,p.staff,p.machines]),materials:plan.materials.map(m=>[m.id,m.available,m.inventoryAvailable,m.purchasesAvailable,m.consumption]),lines:plan.productLines.map(l=>[l.id,l.target,l.available,l.plannedUnits])});}
function run({row,catalog,kind,group,option,amount,expectedCycle}){
 try{
  const r=row?.receipt,round=Number(r?.round),version=engine?.config?.version;
  if(!r)return unavailable('El resultado seleccionado no contiene un recibo de cierre.');
  if(r.modelVersion!=='md-20261027'||version!==r.modelVersion)return unavailable(`Versión del motor incompatible: cierre ${r.modelVersion||'sin versión'}; motor actual ${version||'sin versión'}.`);
  if(r.capacityRulesVersion!=='one-worker-per-resource-20261029')return unavailable(`Versión de capacidad no compatible: ${r.capacityRulesVersion||'no registrada'}.`);
  if(!Number.isInteger(round)||round<1||round>6||(expectedCycle!=null&&round!==Number(expectedCycle)))return unavailable('El ciclo del recibo no coincide con el ciclo seleccionado o está fuera del rango admitido.');
  const missing=[['decisiones',r.decisions],['inventario inicial',r.openingInventory],['política financiera',r.financialPolicy],['selección del catálogo',Array.isArray(r.catalogSelection)?r.catalogSelection:null],['estado de la empresa',row.state]].filter(([,v])=>v==null).map(([name])=>name);
  if(missing.length)return unavailable('Faltan datos del cierre: '+missing.join(', ')+'.');
  if(row.state.__materialOrders||r.materialReceiptFacts||(row.state.__materialRulesVersion&&row.state.__materialRulesVersion!=='legacy-instant')||(r.financialPolicy.materialRulesVersion&&r.financialPolicy.materialRulesVersion!=='legacy-instant'))return unavailable('El cierre usa pedidos o recepciones temporales de materiales que esta simulación todavía no puede reconstruir.');
  if(!Array.isArray(catalog)||!catalog.length||!groups[kind]?.includes(group))return unavailable('La alternativa o el catálogo no están disponibles.');
  const definition=catalog.flatMap(c=>c.items||[]).find(i=>i.id===group);if(!definition?.options?.some(o=>o.id===option))return unavailable('Selecciona un recurso válido.');
  const q=Number(amount);if(!Number.isFinite(q)||q<=0||q>1000000||(kind==='workers'&&!Number.isInteger(q)))return unavailable('Introduce una cantidad adicional positiva y válida.');
  const state=copy(r.decisions);state.__inventarioMP=copy(r.openingInventory);state.__catalogSelection=copy(r.catalogSelection);
  const absent=['PRODUCCION_META','MOLDE','JEFATURA'].filter(id=>!state[id]).concat(['MESA_CORTE','ENSAMBLE','ACABADOS'].filter(id=>!state[id]||(!state[id].quantities&&!state[id].purchases)||!Number.isInteger(Number(state[id].round)))).concat(['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO','CUERO','ACCESORIOS','HILO'].filter(id=>!state[id]||!state[id].quantities||!Number.isInteger(Number(state[id].round))));
  if(absent.length)return unavailable('Faltan decisiones o cantidades verificables: '+absent.join(', ')+'.');
  const input={state,catalog,round,financialPolicy:copy(r.financialPolicy)};
  const original=engine.prepare(input).plan,expected=fingerprint(r.production);
  if(!expected||fingerprint(original)!==expected||original.producibleUnits!==r.produced)return unavailable('El motor actual no reproduce exactamente la producción oficial del ciclo.');
  const alternative=copy(state),entry=alternative[group];
  if(Number(entry.round)!==round)return unavailable('La decisión elegida no pertenece al ciclo seleccionado.');
  const current=Number(entry.quantities[option]??0);if(!Number.isFinite(current)||current<0)return unavailable('La cantidad original no es verificable.');
  entry.quantities[option]=current+q;
  if(Array.isArray(entry.optionIds)&&!entry.optionIds.includes(option))entry.optionIds.push(option);
  const projected=engine.prepare({...input,state:alternative}).plan;
  const difference=projected.producibleUnits-original.producibleUnits;
  return {available:true,original:original.producibleUnits,alternative:projected.producibleUnits,difference,percent:original.producibleUnits>0?difference/original.producibleUnits*100:null,limits:{material:projected.materialCapacity,process:projected.processCapacity},note:'La estimación se limita a producción; ventas, costos y utilidad no se recalculan.'};
 }catch(e){return unavailable('El motor no pudo reproducir el escenario: '+(e instanceof Error?e.message:String(e)));}
}
function economic({closure,previous,catalog,companyId,kind,group,option,amount,expectedCycle}){
 try{
  const rows=closure?.resultadosPorEmpresa,prior=previous?.resultadosPorEmpresa,id=String(companyId),round=Number(expectedCycle);
  if(!rows?.[id]?.receipt)return unavailable('Falta el recibo oficial de la empresa y ciclo seleccionados.');
  if(round>1&&!prior)return unavailable('Falta el cierre oficial del ciclo anterior para reconstruir los saldos iniciales.');
  if(!Number.isInteger(round)||round<1||round>6||!Array.isArray(catalog)||!catalog.length)return unavailable('El ciclo o el catálogo no son válidos.');
  const entries=Object.entries(rows),inputs=[];
  for(const [key,row] of entries){
   const r=row?.receipt,p=prior?.[key],policy=r?.financialPolicy;
   if(!r||Number(r.round)!==round||r.modelVersion!==engine.config.version||r.capacityRulesVersion!=='one-worker-per-resource-20261029')return unavailable('La empresa '+key+' no tiene una versión de cierre compatible y verificable.');
   if(round>1&&!p?.state)return unavailable('Falta el estado inicial de la empresa '+key+' en el cierre anterior.');
   if(!r.decisions||!policy||!Array.isArray(r.catalogSelection)||!Array.isArray(r.events)||!Number.isFinite(Number(policy.capital)))return unavailable('Faltan decisiones, eventos, catálogo o capital verificables de la empresa '+key+'.');
   if(r.materialReceiptFacts||p?.state?.__materialOrders)return unavailable('Las recepciones temporales de materiales de la empresa '+key+' no se pueden reconstruir con este cierre.');
   const state={...copy(r.decisions),...Object.fromEntries(Object.entries(p?.state||{}).filter(([k])=>k.startsWith('__')).map(([k,v])=>[k,copy(v)])),__catalogSelection:copy(r.catalogSelection)};
   inputs.push({id:key,state,ledger:copy(p?.ledger||{}),catalog,round,capital:Number(policy.capital),sectionsByRound:copy(p?.financialSections||{}),financialPolicy:copy(policy),events:copy(r.events)});
  }
  const baseline=cycle.closeMany(copy(inputs));
  const values=row=>({planned:row.receipt?.production?.target,produced:row.receipt?.produced,sold:row.receipt?.sold,revenue:row.financial?.estadoResultados?.ingresos,costs:row.financial?.estadoResultados?.costos,profit:row.financial?.estadoResultados?.utilidadNeta,cash:row.financial?.balanceCaja?.cajaFinal});
  for(const [key,row] of entries){const a=values(row),b=values(baseline[key]);for(const field of Object.keys(a)){if(a[field]==null||b[field]==null||!Number.isFinite(Number(a[field]))||Math.abs(Number(a[field])-Number(b[field]))>(['planned','produced','sold'].includes(field)?0:0.02))return unavailable('El motor actual no reproduce '+field+' del cierre oficial de la empresa '+key+'.');}}
  const input=inputs.find(x=>x.id===id),state=input.state,q=Number(amount);
  if(amount===''||amount==null||!Number.isFinite(q)||q<0||q>1000000||!Number.isInteger(q))return unavailable('Introduce una cantidad entera entre 0 y 1 000 000.');
  if(kind==='target'){
   if(!['molde_1','molde_2','molde_3'].includes(option)||!state.PRODUCCION_META?.moldTargets)return unavailable('Falta una meta verificable para el molde seleccionado.');
   state.PRODUCCION_META.moldTargets[option]=q;state.PRODUCCION_META.value=Object.values(state.PRODUCCION_META.moldTargets).reduce((s,v)=>s+Number(v||0),0);
  }else{
   const allowed={workers:['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO'],materials:['CUERO','ACCESORIOS','HILO'],machines:['MESA_CORTE','ENSAMBLE','ACABADOS']};
   const definition=catalog.flatMap(c=>c.items||[]).find(x=>x.id===group);
   if(!allowed[kind]?.includes(group)||!definition?.options?.some(x=>x.id===option)||!state[group]||Number(state[group].round)!==round)return unavailable('El recurso o su decisión no están disponibles para este ciclo.');
   if(kind==='machines'&&group==='ENSAMBLE'&&q>0&&!baseline[id].receipt.production?.processes?.find(p=>p.id==='assembly')?.machines)return unavailable('No se puede verificar si había un evento de avería de ensamblado omitido por falta de maquinaria en el cierre original.');
   const entry=state[group];if(kind==='machines'){entry.purchases=entry.purchases||{};entry.purchases[round]=entry.purchases[round]||{};entry.purchases[round][option]=Number(entry.purchases[round][option]||0)+q;}
   else{entry.quantities=entry.quantities||{};entry.quantities[option]=Number(entry.quantities[option]||0)+q;}
   if(q>0){entry.optionIds=entry.optionIds||[];if(!entry.optionIds.includes(option))entry.optionIds.push(option);}
  }
  const projected=cycle.closeMany(inputs)[id],actual=values(rows[id]),alternative=values(projected),plan=projected.receipt.production;
  return {available:true,actual,alternative,plan,consumption:plan.materials?.map(m=>({id:m.id,consumption:m.consumption})),limits:{process:plan.limitingProcesses||[],materials:plan.limitingMaterials||[]}};
 }catch(e){return unavailable('No se pudo reconstruir el cierre económico: '+(e instanceof Error?e.message:String(e)));}
}
return {run,economic};});
