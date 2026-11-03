/* Read-only counterfactuals from the same cycle model as official settlement. */
(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./cycle_model.js'):root.SIDE_CYCLE_MODEL,node?require('./engine/config.js'):root.SIDE_ECONOMIC_CONFIG,node?require('./business_rules.js'):root.SIDE_BUSINESS_RULES);if(node)module.exports=api;else root.SIDE_PROFIT_PROJECTION=api;})(typeof globalThis!=='undefined'?globalThis:this,function(CYCLE,CONFIG,BUS){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const money=x=>Math.round((Number(x||0)+Number.EPSILON)*100)/100;
 function project(input){
  if(input.state?.__cycleSettlements?.[input.round])return null;
  const own={...input,state:clone(input.state),ledger:clone(input.ledger||{}),sectionsByRound:clone(input.sectionsByRound||{})};
  let value;
  if(input.marketContext){
    const market=input.marketContext,company=String(market.companyId||''),competitors=market.competitors;
    if(market.verified!==true||!company||!Array.isArray(competitors)||competitors.some(c=>!c.id||String(c.id)===company||Number(c.round)!==Number(input.round)||!c.state)||new Set(competitors.map(c=>String(c.id))).size!==competitors.length)throw new Error('Contexto competitivo no verificable.');
    const inputs=[{...own,id:company},...competitors.map(c=>clone(c))];
    value=CYCLE.closeMany(inputs)[company];
  }else value=CYCLE.close(own);
  const receipt=value.receipt,statement=value.financial.estadoResultados,balance=value.financial.balanceGeneral;
  // Section movements represent decisions and include purchases, salaries,
  // expenses and any selected financing once. The ledger has no dates within
  // a cycle, so this is a beginning-of-cycle estimate, not a payment calendar.
  const opening=Number(value.financial.flujoCaja?.cajaInicial);
  const sectionMovements=(input.catalog||[]).filter(c=>!c.summaryOnly).reduce((sum,category)=>{
    const amount=Number(value.ledger?.[`${input.round}:${category.cat}`]);
    return sum+(Number.isFinite(amount)?amount:0);
  },0);
  const availableBeforeSales=Number.isFinite(opening)?Math.round((opening+sectionMovements)*100)/100:null;
  const commission=Math.abs(Number(value.ledger?.[`${input.round}:COMISION_VENTAS`]||0)),commissionRate=statement.ventasTotales?commission/statement.ventasTotales:0.01;
  const warranty=Number(statement.gastoGarantias||0),warrantyId=receipt.decisions?.GARANTIA_PT?.optionIds?.[0],days=input.catalog.flatMap(c=>c.items||[]).find(i=>i.id==='GARANTIA_PT')?.options?.find(o=>o.id===warrantyId)?.value;
  const warrantyRates={30:CONFIG.warranty.pt_30,90:CONFIG.warranty.pt_90,180:CONFIG.warranty.pt_180,...input.financialPolicy?.warrantyUnitCosts};
  const warrantyUnit=receipt.sold?warranty/receipt.sold:Number(warrantyRates[days]||0);
  const fixedExpenses=money(statement.gastosOperacion-commission-warranty+statement.gastosFinancieros-statement.ingresosFinancieros);
  const items=new Map(input.catalog.flatMap(c=>c.items||[]).map(i=>[i.id,i]));
  const trace=Object.entries(value.financialSections?.[input.round]||{}).flatMap(([category,s])=>(s.items||[]).filter(i=>i.outflow).map(i=>({category,id:i.id,name:i.name,amount:money(i.outflow),classification:items.get(i.id)?.asset||i.id==='MOLDE'?'asset':items.get(i.id)?.material?'materials':['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO'].includes(i.id)?'labor':['CANALES','INV_MARKETING','GARANTIA_PT'].includes(i.id)?'sales':'administrative'})));
  const sales=receipt.sales.filter(r=>r.available||r.produced).map(r=>{
   const lots=(value.financial.lotMovements||[]).filter(l=>(l.segment||l.product)===r.id),cogs=lots.reduce((s,l)=>s+Number(l.costOfSales||0),0);
   const newLots=lots.filter(l=>Number(l.cycle)===Number(input.round)),newValue=newLots.reduce((s,l)=>s+Number(l.inventoryValue||0)+Number(l.costOfSales||0),0);
   const unitCost=r.sold&&lots.length?cogs/r.sold:r.produced?newValue/r.produced:null;
   const weight=receipt.sold?r.sold/receipt.sold:receipt.produced?r.produced/receipt.produced:0,fixedAllocation=money(fixedExpenses*weight);
   const quantity=r.sold||r.produced,fullUnitCost=unitCost==null||!quantity?null:unitCost+warrantyUnit+fixedAllocation/quantity;
   return {id:r.id,price:r.price,sold:r.sold,produced:r.produced,available:r.available,demand:r.demand,costOfSales:money(cogs),unitCost:unitCost==null?null:money(unitCost),manufacturingUnitCost:r.produced?money(newValue/r.produced):null,grossMargin:r.revenue?money((r.revenue-cogs)/r.revenue*100):null,fixedAllocation,variableSellingUnitCost:money(r.price*commissionRate+warrantyUnit),breakEvenPrice:fullUnitCost==null?null:money(fullUnitCost/(1-commissionRate)),targetPrices:[.10,.15,.20,.25].map(margin=>({margin,price:fullUnitCost==null?null:money(fullUnitCost/(1-commissionRate-margin))}))};
  });
  const contribution=receipt.sold?(statement.ventasTotales-statement.costoVentas-commission-warranty)/receipt.sold:0;
  const minimumSales=contribution>0?Math.max(0,Math.ceil(fixedExpenses/contribution)):null;
  const materialPurchases=money(trace.filter(t=>t.classification==='materials').reduce((s,t)=>s+t.amount,0));
  return {produced:receipt.produced,sold:receipt.sold,demand:receipt.sales.reduce((s,r)=>s+Number(r.demand||0),0),income:statement.ventasTotales,cost:statement.costos,productionCost:statement.costosProduccion,costOfSales:statement.costoVentas,operatingExpenses:statement.gastosOperacion,grossProfit:statement.utilidadBruta,grossMargin:statement.ventasTotales?money(statement.utilidadBruta/statement.ventasTotales*100):null,netMargin:statement.ventasTotales?money(statement.utilidadNeta/statement.ventasTotales*100):null,minimumSales,minimumSalesScope:'Estimación contable antes de impuestos con el precio, costo unitario y mezcla actuales; no garantiza capacidad ni demanda.',fixedExpenses,capacity:receipt.production.processCapacity,materialPurchases,consumedMaterials:Number(statement.desgloseCostos?.materiales||0),analystCost:trace.find(t=>t.id==='ANALISTA_COMPRAS')?.amount||0,unitCost:receipt.produced?statement.costosProduccion/receipt.produced:null,profit:statement.utilidadNeta,cash:balance.efectivo,availableBeforeSales,sales,trace,plan:receipt.production};
 }
 function analyze(input){
  if(input.financialPolicy?.workerVersion!=null&&String(input.financialPolicy.workerVersion)!=='1')return {available:false,reason:'Esta partida conserva un motor anterior. Consulta sus cierres oficiales; no se recalculan proyecciones con reglas nuevas.'};
  const temporal=!!input.state?.__materialOrders;
  if(temporal&&(!input.financialPolicy?.verifiedMaterialContext||!['cash','credit'].includes(input.financialPolicy?.materialPaymentMode)))return {available:false,reason:'Las recepciones de insumos requieren una proyección autoritativa.'};
  if(!Array.isArray(input.catalog)||!input.catalog.length)return {available:false,reason:'No se dispone del catálogo necesario para estimar los pagos.'};
  // A planning quote is deliberately separate from provider facts. It is used
  // only before any current order exists, never exported as a state/receipt,
  // and cannot replace confirmed orders or partial deliveries.
  const start=(Number(input.round)-1)*30,book=input.state?.__materialOrders;
  if(temporal&&input.projectionAssumptions?.plannedDeliveries===true&&!Object.values(book.events||{}).some(e=>e.type==='order'&&Number(e.orderedDay)===start)){
   try{
    const state=clone(input.state),lead=Number(input.projectionAssumptions.leadTimeDays??7),owner=book.companyId;
    if(typeof owner!=='string'||!owner||!Number.isInteger(lead)||lead<0||lead>365)throw Error('Supuesto de entrega inválido');
    const rate=(state.ANALISTA_COMPRAS?.optionIds||[]).includes('si_analista')?Math.max(2,12-(Number(input.round)-1)*2):0;
    for(const item of input.catalog.flatMap(c=>c.items||[]).filter(i=>i.material))for(const option of item.options||[]){
     const q=Number(state[item.id]?.quantities?.[option.id]||0);if(!q||Number(state[item.id]?.round)!==Number(input.round))continue;
     const pack=input.financialPolicy.materialPurchaseVersion==='excel-v2-packs-v1'?BUS.materialPackConversion(option.id,q):null,quantity=pack?.units??q,id=`projection-only-${input.round}-${option.id}`;
     const unitCost=BUS.materialUnitPrice(option,q,rate,{...CONFIG,materials:{...CONFIG.materials,...input.financialPolicy.materials}})/(pack?.unitsPerPack||1);
     state.__materialOrders.events[id]={id,orderId:id,type:'order',companyId:owner,sku:option.id,quantity,unit:item.unit||'unidad',unitCost,orderedDay:start,leadTimeDays:lead,paymentMode:input.financialPolicy.materialPaymentMode};
     state.__materialOrders.events[id+'-receipt']={id:id+'-receipt',orderId:id,type:'receipt',companyId:owner,quantity,day:start+lead};
    }
    const result=analyze({...input,state,projectionAssumptions:undefined});
    if(result.available&&result.analyst){
     const withoutState=clone(input.state),ledger=clone(input.ledger||{}),sections=clone(input.sectionsByRound||{}),cat=input.catalog.find(c=>c.items?.some(i=>i.id==='ANALISTA_COMPRAS'))?.cat;
     withoutState.ANALISTA_COMPRAS={...withoutState.ANALISTA_COMPRAS,optionIds:['no_analista']};if(cat){delete ledger[`${input.round}:${cat}`];if(sections[input.round])delete sections[input.round][cat];}
     const without=analyze({...input,state:withoutState,ledger,sectionsByRound:sections});
     result.analyst={...result.analyst,scope:'Comparación hipotética antes de emitir órdenes, con el mismo plazo de entrega. No cambia contratos confirmados.',...(without.available?{purchaseSavings:money(without.base.materialPurchases-result.base.materialPurchases),profitEffect:money(result.base.profit-without.base.profit)}:{})};
    }
    return {...result,assumptions:[`Hipótesis de planificación: las compras pendientes se entregarían completas el día ${lead+1} del ciclo. No son órdenes ni recepciones registradas; una demora o entrega parcial cambia el resultado.`]};
   }catch{return {available:false,reason:'No se pudo cotizar la entrega hipotética de estas compras; revisa cantidades y plazo.'};}
  }
  try{
   const base=project(input);if(!base)return {available:false,reason:'El ciclo ya está cerrado.'};
   const mutations=[],lossReasons=[];let analyst=null;
   if(base.analystCost){
    if(temporal){const rate=Math.max(2,12-(Number(input.round)-1)*2)/100,book=base.materialPurchases;analyst={cost:base.analystCost,purchaseSavings:money(book/(1-rate)-book),profitEffect:null,scope:'Descuento de órdenes verificadas; las órdenes confirmadas no se reprecian. No equivale necesariamente al ahorro devengado del ciclo.'};}
    else {const state=clone(input.state),ledger=clone(input.ledger||{}),sections=clone(input.sectionsByRound||{});state.ANALISTA_COMPRAS={...state.ANALISTA_COMPRAS,round:input.round,optionIds:['no_analista']};const cat=input.catalog.find(c=>c.items?.some(i=>i.id==='ANALISTA_COMPRAS'))?.cat;
     if(cat){delete ledger[`${input.round}:${cat}`];if(sections[input.round])delete sections[input.round][cat];const without=project({...input,state,ledger,sectionsByRound:sections});analyst={cost:base.analystCost,purchaseSavings:money(without.materialPurchases-base.materialPurchases),consumedSavings:money(without.consumedMaterials-base.consumedMaterials),profitEffect:money(base.profit-without.profit),scope:'Comparación del mismo plan sin analista; respeta inventarios, impuesto y financiación.'};}
    }
    if(analyst.purchaseSavings<analyst.cost)lossReasons.push(`El analista cuesta ${analyst.cost.toFixed(2)} y el ahorro estimado en compras es ${analyst.purchaseSavings.toFixed(2)}; la diferencia es ${money(analyst.cost-analyst.purchaseSavings).toFixed(2)} soles.`);
   }
   if(!base.sold)lossReasons.push('No se proyectan ventas: producir mantiene productos en inventario, pero no genera ingresos.');
   if(base.sold<base.produced)lossReasons.push('Parte de la producción quedaría sin vender; revisa canales, distribución y demanda.');
   if(base.profit<0&&base.grossProfit>=0)lossReasons.push('Los gastos operativos, financieros y el impuesto aplicable superan la utilidad bruta del ciclo.');
   if(base.grossProfit<0)lossReasons.push('El costo de las unidades vendidas supera sus ingresos al precio efectivo de esta versión.');
   if(base.minimumSales!==null&&base.minimumSales>Math.min(base.capacity,base.demand))lossReasons.push('Las ventas de equilibrio estimadas superan la capacidad o la demanda proyectada con estos recursos.');
   if(base.availableBeforeSales<0)lossReasons.push('La caja inicial no cubre los pagos estimados anteriores a las ventas.');
   for(const [kind,ids] of [['Personal',['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO']],['Maquinaria',['MESA_CORTE','ENSAMBLE','ACABADOS']],['Insumos',['CUERO','ACCESORIOS','HILO']]]){
    if(temporal&&kind==='Insumos')continue; // Confirmed orders cannot be edited as a local counterfactual.
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
     const result=project({...input,state,ledger,sectionsByRound:sections});if(result&&result.availableBeforeSales!==null&&result.availableBeforeSales>=0&&result.cash>=0)alternatives.push({label:m.label,profit:result.profit,cash:result.cash,availableBeforeSales:result.availableBeforeSales,sold:result.sold,produced:result.produced,difference:Math.round((result.profit-base.profit)*100)/100});
    }catch{}
   }
   // Sample the current single-product plan with unchanged purchases and
   // capacity. This is a scenario threshold, not a general break-even formula.
   let breakEven=null;const targets=input.state.PRODUCCION_META?.moldTargets||{},active=Object.entries(targets).filter(([,q])=>Number(q)>0);
   if(active.length===1){const [mold,raw]=active[0],max=Math.floor(Number(raw));
    for(let i=1;i<=20&&max>0;i++){const target=Math.max(1,Math.ceil(max*i/20)),state=clone(input.state);state.PRODUCCION_META.moldTargets={[mold]:target};state.PRODUCCION_META.value=target;
     const sample=project({...input,state});if(sample&&sample.profit>=0&&sample.cash>=0&&sample.availableBeforeSales!==null&&sample.availableBeforeSales>=0){breakEven={target,produced:sample.produced,sold:sample.sold};break;}
    }
   }
   return {available:true,base,alternatives,breakEven,analyst,lossReasons,marketScope:input.marketContext?'competitive':'individual'};
  }catch{return {available:false,reason:'No hay datos suficientes para calcular una proyección fiable.'};}
 }
 return {analyze};
});
