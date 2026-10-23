/* SIDE cycle settlement: production, unsold goods and cash share one receipt. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./production_model.js'):root.SIDE_PRODUCTION_MODEL,typeof module==='object'&&module.exports?require('./financial_model.js'):root.SIDE_FINANCIAL_MODEL);if(typeof module==='object'&&module.exports)module.exports=api;else root.SIDE_CYCLE_MODEL=api;})(typeof globalThis!=='undefined'?globalThis:this,function(PRO,FIN){
  'use strict';
  const clone=v=>JSON.parse(JSON.stringify(v)),n=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0,money=v=>Math.round(v*100)/100;
  const productIds=['esencial','urbano','premium'],defaultPrices=[75,95,125];
  function close({state={},ledger={},catalog=[],round=1,capital=0,sectionsByRound={},production,prices={},soldUnits=0,soldByProduct={}}={}){
    state=clone(state);ledger={...ledger};
    const previous=state.__cycleSettlements?.[round];
    if(previous)return {state,ledger,receipt:previous,reused:true,financial:FIN.calculate({capital,ledger,sectionsByRound,catalog,round,openingBalance:state.__openingBalance})};
    const plan=production||PRO.calculate({state,drafts:{},catalog,round});
    const channels=state.CANALES||{},ids=channels.optionIds||[],stores=ids.filter(id=>['los_olivos','miraflores','sjl'].includes(id)).reduce((sum,id)=>sum+n(channels.quantities?.[id]||1),0);
    const market=(ids.includes('web')?300:0)+ids.filter(id=>['los_olivos','miraflores','sjl'].includes(id)).reduce((sum,id)=>sum+n(channels.quantities?.[id]||1)*({los_olivos:200,miraflores:250,sjl:220}[id]),0);
    const oldGoods=state.__finishedGoods||{},goods={},sales=[];let remainingMarket=Math.max(0,market-n(soldUnits)),remainingPriorSales=n(soldUnits);
    for(const [i,id] of productIds.entries()){
      const produced=n(plan.productLines?.[i]?.plannedUnits),available=produced+n(oldGoods[id]),alreadySold=Math.min(available,Object.keys(soldByProduct).length?n(soldByProduct[id]):remainingPriorSales);remainingPriorSales-=alreadySold;
      const price=n(prices[id])||defaultPrices[i],demand=Math.floor(remainingMarket*Math.min(1,defaultPrices[i]/price)),sold=Math.min(Math.max(0,available-alreadySold),demand);
      remainingMarket=Math.max(0,remainingMarket-sold);goods[id]=available-alreadySold-sold;sales.push({id,produced,available,alreadySold,sold,price,revenue:money(sold*price)});
    }
    const revenue=money(sales.reduce((sum,row)=>sum+row.revenue,0));
    ledger[`${round}:SIM_VENTAS`]=money(n(ledger[`${round}:SIM_VENTAS`])+revenue);
    if(stores)ledger[`${round}:COMISION_VENTAS`]=-money(ledger[`${round}:SIM_VENTAS`]*.01);
    const inventory={};
    for(const material of plan.materials||[]){
      const definition=catalog.flatMap(c=>c.items||[]).find(item=>item.id===material.id),entries=definition?.options||[];
      let consumption=n(material.consumption);
      for(const option of entries){const available=n(state.__inventarioMP?.[option.id])+n(state[material.id]?.round===round?state[material.id]?.quantities?.[option.id]:0),used=Math.min(available,consumption);inventory[option.id]=money(available-used);consumption-=used;}
    }
    state.__inventarioMP=inventory;state.__finishedGoods=goods;
    const receipt={round,produced:n(plan.producibleUnits),sold:sales.reduce((sum,row)=>sum+row.sold,0),revenue,sales,market,inventory,goods};
    state.__cycleSettlements={...state.__cycleSettlements,[round]:receipt};
    return {state,ledger,receipt,reused:false,financial:FIN.calculate({capital,ledger,sectionsByRound,catalog,round,openingBalance:state.__openingBalance})};
  }
  function closeReports({reports=[],game,round,catalog=[]}={}){
    for(const report of reports){if(report.partida!==game||report.estado==='eliminada'||!report.enviado||!report.gameState)continue;
      const result=close({state:report.gameState,ledger:report.cashLedger,catalog,round,capital:report.capital,sectionsByRound:report.financialSections,production:report.produccion,prices:report.productPrices,soldUnits:report.soldUnits,soldByProduct:report.soldByProduct});
      const f=result.financial;Object.assign(report,{gameState:result.state,cashLedger:result.ledger,cycleReceipt:result.receipt,ingresos:f.estadoResultados.ingresos,costos:f.estadoResultados.costos,utilidad:f.estadoResultados.utilidad,caja:f.balanceCaja.cajaFinal,estadoResultados:f.estadoResultados,balanceCaja:f.balanceCaja,flujoCaja:f.flujoCaja,balanceGeneral:f.balanceGeneral});
    }return reports;
  }
  function migrate({state={},ledger={},catalog=[],capital=0,round=1}={}){
    const previous=Object.entries(state).find(([key,value])=>key.startsWith('__')&&value?.habilitado&&value?.decisiones&&typeof value.decisiones==='object');
    if(!previous)return {state,ledger,migrated:false};
    const [key,old]=previous;
    state=clone(state);ledger={...ledger};const d=old.decisiones||{},r=Number(old.round)||round;
    const map={MESA_CORTE:['INF-01'],ENSAMBLE:['INF-02','INF-03','INF-04'],ACABADOS:['INF-05','INF-06','INF-07'],MOLDE:['INF-08','INF-09','INF-10'],PERS_CORTE:['RH-01','RH-02','RH-03'],PERS_ENSAMBLE:['RH-04','RH-05','RH-06'],PERS_ACABADO:['RH-07','RH-08','RH-09'],CUERO:['INS-01','INS-02','INS-03'],ACCESORIOS:['INS-04','INS-05'],HILO:['INS-06','INS-07','INS-08']};
    const conversion={'INS-01':1,'INS-02':2,'INS-03':2,'INS-04':1,'INS-05':1,'INS-06':270,'INS-07':250,'INS-08':200};
    const history=old.historial||old.transicion||{},holdings={...history.maquinariaActivos,...d.maquinaria},inventory=history.inventarioMP||old.resultado?.produccion?.inventarioFinal||{},selected=d.seleccion||[];
    state.__inventarioMP={...state.__inventarioMP};
    for(const item of catalog.flatMap(c=>c.items||[])){
      const codes=map[item.id];if(!codes)continue;const quantities={},optionIds=[];
      for(const [index,option] of (item.options||[]).entries()){
        const code=codes[index];let qty=0;
        if(item.material){qty=n(d.compras?.[code])+n(d.comprasUnidades?.[code])*conversion[code];state.__inventarioMP[option.id]=n(inventory[code]);}
        else if(item.asset)qty=n(holdings[item.id==='MESA_CORTE'?'mesa':code]);
        else if(item.id==='MOLDE')qty=n(holdings[code])||Number(selected.includes(code));
        else {const area={PERS_CORTE:'corte',PERS_ENSAMBLE:'ensamble',PERS_ACABADO:'acabado'}[item.id];qty=(d.personal?.[area]?.[index]||[]);qty=Array.isArray(qty)?qty.reduce((s,v)=>s+n(v),0):n(qty);}
        if(qty){quantities[option.id]=qty;optionIds.push(option.id);}
      }
      if(optionIds.length)state[item.id]={round:r,optionIds,quantities,...(item.asset?{purchases:{[r]:quantities}}:{})};
    }
    const targets={molde_1:0,molde_2:0,molde_3:0};for(const lot of d.lotes||[]){const id={'INF-08':'molde_1','INF-09':'molde_2','INF-10':'molde_3'}[lot.molde];if(id)targets[id]+=n(lot.cantidad);}
    if(Object.values(targets).some(Boolean))state.PRODUCCION_META={round:r,moldTargets:targets,value:Object.values(targets).reduce((s,v)=>s+v,0)};
    const channelIds=selected.includes('COM-01B')?['web']:[],channelQuantities={};for(const [id,qty] of Object.entries(d.tiendasPorDistrito||{}))if(n(qty)){channelIds.push(id);channelQuantities[id]=n(qty);}if(channelIds.length)state.CANALES={round:r,optionIds:channelIds,quantities:channelQuantities};
    const latest=old.resultado?.financial,closedHistory=clone(history.financialHistory||[]);if(latest&&!closedHistory.some(h=>Number(h.round)===Number(old.resultado.ciclo||r)))closedHistory.push({...clone(latest),round:Number(old.resultado.ciclo||r)});
    const last=closedHistory.sort((a,b)=>Number(a.round)-Number(b.round)).at(-1);
    const actual=latest?.balanceCaja?.cajaFinal??history.cajaFinal??old.cajaTransicion;
    const seedRound=latest?Number(old.resultado.ciclo||r):Math.max(0,r-1);
    if(Number.isFinite(Number(actual))){const bg=last?.balanceGeneral||{efectivo:Number(actual),activosFijos:n(history.activosCosto)-n(history.depreciacionAcumulada),deuda:n(history.deudaPrincipal),capital:Number(capital)};if(bg.activos==null)bg.activos=Number(actual)+n(bg.activosFijos);if(bg.resultadosAcumulados==null)bg.resultadosAcumulados=bg.activos-n(bg.deuda)-n(bg.capital);if(bg.patrimonio==null)bg.patrimonio=n(bg.capital)+n(bg.resultadosAcumulados);if(bg.pasivoPatrimonio==null)bg.pasivoPatrimonio=n(bg.deuda)+n(bg.patrimonio);state.__openingBalance={round:seedRound,cash:Number(actual),balanceGeneral:bg,history:closedHistory};}
    if(Number.isFinite(Number(actual))){const prior=Object.values(ledger).reduce((s,v)=>s+Number(v||0),0);ledger[`${seedRound}:CAPITAL_ADJUSTMENT`]=Number(ledger[`${seedRound}:CAPITAL_ADJUSTMENT`]||0)+Number(actual)-Number(capital)-prior;}
    state.__previousFinancialHistory=clone(history.financialHistory||[]);
    state.JEFATURA=state.JEFATURA||{round:r,optionIds:[n(d.jefes)||selected.includes('RH-10A')?'si_jefatura':'no_jefatura']};
    const result=old.resultado,closedRound=result?.financial?Number(result.ciclo||r):0;
    if(closedRound){state.__cycleSettlements={...state.__cycleSettlements,[closedRound]:{round:closedRound,produced:n(result.produccion?.totalProducido),revenue:n(result.ingresos),migrated:true}};state.__cycleCosts={...state.__cycleCosts,[closedRound]:{round:closedRound,total:0,acknowledged:true}};}
    delete state[key];state.__migrationVersion=1;return {state,ledger,migrated:true,archive:old,closedRound};
  }
  return {close,closeReports,migrate};
});
