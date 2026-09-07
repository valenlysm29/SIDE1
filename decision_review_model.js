/* SIDE V3: pure, read-only decision breakdowns. No storage or DOM side effects. */
(function(root,factory){
  const productionModel=typeof module==='object'&&module.exports?require('./production_model'):root.SIDE_PRODUCTION_MODEL;
  const api=factory(productionModel);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SIDE_REVIEW_MODEL=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(productionModel){
  'use strict';
  const n=value=>Number.isFinite(Number(value))?Number(value):0;
  const sum=values=>values.reduce((a,b)=>a+n(b),0);
  const roundMoney=value=>Math.round((n(value)+Number.EPSILON)*100)/100;
  const KEEP_COSTS=new Set(['LOCAL_PROD','LIMPIEZA','PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO','JEFATURA','ANALISTA_COMPRAS','CANALES']);
  function draft(item,ctx){
    if(ctx.drafts?.[item.id])return ctx.drafts[item.id];
    const e=ctx.state?.[item.id],same=n(e?.round)===ctx.round;
    if(item.asset)return {quantities:{...(e?.purchases?.[ctx.round]||{})}};
    if(item.type==='quantity'||item.type==='quantity-choice')return {quantities:same?{...(e?.quantities||{})}:{}};
    if(item.type==='number')return {value:same?n(e?.value):0};
    if(item.type==='loan')return {amount:same?n(e?.amount):0};
    if(item.type==='sales-staff')return {staff:same?{...(e?.staff||{})}:{}};
    return {optionIds:[...(e?.optionIds||item.defaultOptionIds||[])],quantities:{...(e?.quantities||{})}};
  }
  function owned(item,id,ctx){return sum(Object.entries(ctx.state?.[item.id]?.purchases||{}).filter(([r])=>n(r)<ctx.round).map(([,v])=>v[id]));}
  function previousStaff(item,id,ctx){const e=ctx.state?.[item.id];return n(n(e?.round)===ctx.round?e?.previousQuantities?.[id]:e?.quantities?.[id]);}
  function discount(ctx){return (ctx.drafts?.ANALISTA_COMPRAS?.optionIds||ctx.state?.ANALISTA_COMPRAS?.optionIds||[]).includes('si_analista')?Math.max(2,12-(ctx.round-1)*2):0;}
  function unitCost(item,option,ctx){return n(option.cost)*(item.material?1-discount(ctx)/100:1);}
  function breakdown(item,ctx){
    const d=draft(item,ctx),e=ctx.state?.[item.id];
    const out={id:item.id,name:item.name,type:item.type,rows:[],outflow:0,assetIncome:0,financing:0,recurring:0,note:''};
    const add=(label,quantity,unit,outflow=0,income=0,detail='')=>out.rows.push({label,quantity,unitCost:unit,outflow,income,detail});
    if(item.type==='info'){
      const channels=ctx.drafts?.CANALES||ctx.state?.CANALES,stores=ctx.rules.storeCount(channels);
      if(item.id==='PERSONAL_VENTAS')add('Vendedores b\u00e1sicos',stores,null,0,0,'1 por tienda f\u00edsica. Comisi\u00f3n total: 1% de las ventas; sin sueldo fijo adicional.');
      else if(item.id==='CREDITO_VENTAS'){
        const credit=Math.min(70,n(ctx.config?.creditPercentStart??20)+(ctx.round-1)*5+(discount(ctx)?5:0));
        add(`${credit}% a cr\u00e9dito / ${100-credit}% al contado`,null,null,0,0,'Regla autom\u00e1tica; no es una decisi\u00f3n editable.');
      }else add(item.desc||'Regla autom\u00e1tica del juego',null,null);
    }else if(item.type==='loan'){
      out.financing=n(d.amount);add(out.financing?'Pr\u00e9stamo solicitado':'Sin pr\u00e9stamo',null,null,0,out.financing,`TEA: ${n(ctx.config?.interest??20)}%. El cat\u00e1logo no define plazo, cuotas ni un calendario de amortizaci\u00f3n.`);
    }else if(item.type==='number'){
      add('Meta del ciclo',n(d.value),null,0,0,item.unit||'unidades');
    }else if(item.type==='sales-staff'){
      Object.entries(d.staff||{}).forEach(([id,q])=>{if(n(q))add(id,n(q),n(item.costPerPerson),n(q)*n(item.costPerPerson));});
    }else if(item.asset||item.type==='quantity'||item.type==='quantity-choice'){
      for(const opt of item.options||[]){
        const q=n(d.quantities?.[opt.id]),price=unitCost(item,opt,ctx),have=item.asset?owned(item,opt.id,ctx):0,prev=item.severanceEligible?previousStaff(item,opt.id,ctx):0;
        if(!q&&!have&&!prev)continue;
        let detail=item.material?`Insumos de este ciclo${discount(ctx)?`; descuento de compras: ${discount(ctx)}%`:''}.`:item.recurring?'Cantidad contratada para este ciclo.':'';
        let cost=Math.max(0,q)*price,income=0;
        if(item.asset){
          income=q<0?-q*price*n(opt.liquidationRate??ctx.liquidationRate??0.4):0;
          detail=`Antes: ${have}. ${q<0?'Liquidaci\u00f3n':q>0?'Compra nueva':'Sin compra nueva'}: ${Math.abs(q)}. Total disponible: ${have+q}.`;
        }
        add(opt.label,item.asset?have+q:q,price,cost,income,detail);
        if(item.severanceEligible&&q<prev){
          add('Indemnizaci\u00f3n por reducci\u00f3n de personal',prev-q,price*n(ctx.severanceRate??0.5),(prev-q)*price*n(ctx.severanceRate??0.5),0,`Dotaci\u00f3n anterior: ${prev}. Dotaci\u00f3n elegida: ${q}.`);
        }
      }
    }else{
      const alreadyOwned=item.lockAfterPurchase&&e&&n(e.round)<ctx.round;
      const ids=alreadyOwned?(e.optionIds||[]):d.optionIds||[];
      for(const opt of (item.options||[]).filter(o=>ids.includes(o.id))){
        const q=item.id==='CANALES'&&opt.channel==='store'?ctx.rules.storeQuantity(d,opt.id):1;
        const price=item.noCashEffect||alreadyOwned?0:unitCost(item,opt,ctx);
        const detail=alreadyOwned?`Adquirido en el ciclo ${e.round}. Sin nuevo cobro.`:item.id==='CANALES'&&opt.channel==='store'?`${opt.district}. ${q} tienda(s), ${q} vendedor(es) b\u00e1sico(s). Alquiler por ciclo.`:item.recurring?'Decisi\u00f3n del ciclo.':item.noCashEffect?'Sin desembolso por la selecci\u00f3n.':'';
        add(opt.label,item.type==='choice'?null:q,price,q*price,0,detail);
      }
    }
    if(!out.rows.length)out.note=item.asset?'Sin equipos de este tipo ni movimientos elegidos.':'Sin selecci\u00f3n para este ciclo.';
    out.outflow=sum(out.rows.map(r=>r.outflow));
    out.assetIncome=item.type==='loan'?0:sum(out.rows.map(r=>r.income));
    if(KEEP_COSTS.has(item.id)){
      // Payroll severance is a one-time outflow, not next-cycle recurring payroll.
      out.recurring=sum(out.rows.filter(r=>!r.label.startsWith('Indemnizaci')).map(r=>r.outflow));
    }
    out.net=out.financing+out.assetIncome-out.outflow;
    return out;
  }
  function section(category,ctx){
    const items=category.items.map(i=>breakdown(i,ctx));
    return {cat:category.cat,title:category.short||category.title,round:ctx.round,items,
      outflow:sum(items.map(i=>i.outflow)),assetIncome:sum(items.map(i=>i.assetIncome)),financing:sum(items.map(i=>i.financing)),
      net:sum(items.map(i=>i.net)),recurring:sum(items.map(i=>i.recurring))};
  }
  function future(ctx){
    const channel=ctx.catalog.flatMap(c=>c.items).find(i=>i.id==='CANALES');
    const d=draft(channel,ctx),e=ctx.state?.CANALES,contracts=[];
    for(const opt of (channel.options||[]).filter(o=>o.channel==='store')){
      const quantity=ctx.rules.storeQuantity(d,opt.id);
      let batches=[];
      try{batches=ctx.rules.nextStoreBatches(e,opt.id,quantity,ctx.round);}catch{batches=ctx.rules.storeBatches(e,opt.id,ctx.round);}
      if(!quantity&&!batches.length)continue;
      const term=n(opt.minCommitCycles||12),unit=n(opt.cost);
      const remaining=sum(batches.map(b=>b.quantity*Math.max(0,b.round+term-1-ctx.round)));
      const afterGame=sum(batches.map(b=>b.quantity*Math.max(0,b.round+term-1-Math.max(ctx.round,n(ctx.config?.cycles)))));
      contracts.push({id:opt.id,label:opt.district,quantity,perCycle:quantity*unit,total:remaining*unit,beyondGame:afterGame*unit,
        lastRound:Math.max(0,...batches.map(b=>b.round+term-1)),batches});
    }
    return {contracts,total:sum(contracts.map(c=>c.total)),beyondGame:sum(contracts.map(c=>c.beyondGame))};
  }
  function finances(sections,ctx){
    const currentCash=n(ctx.capital)+sum(Object.values(ctx.ledger||{}));
    const pendingDelta=sum(sections.filter(s=>!s.submitted).map(s=>s.net-n(ctx.ledger?.[`${ctx.round}:${s.cat}`])));
    return {currentCash,pendingDelta,projectedCash:currentCash+pendingDelta,
      outflow:sum(sections.map(s=>s.outflow)),financing:sum(sections.map(s=>s.financing)),assetIncome:sum(sections.map(s=>s.assetIncome)),
      recurring:sum(sections.map(s=>s.recurring)),contracts:future(ctx)};
  }
  function warnings(ctx){
    const warnings=[],plan=productionModel?.calculate(ctx);
    if(!plan||!plan.target)return warnings;
    for(const material of plan.materials)if(material.shortfall>0)warnings.push({cat:'C',text:`${material.label}: compras convertidas en ${material.available.toLocaleString('es-PE')} ${material.unit}; la meta requiere ${material.neededForTarget.toLocaleString('es-PE')}. Faltan ${material.shortfall.toLocaleString('es-PE')} ${material.unit}.`});
    for(const process of plan.processes)if(process.shortfall>0)warnings.push({cat:process.id==='cut'?'B':'C',text:`${process.label}: capacidad de ${process.cycleCapacity.toLocaleString('es-PE')} unidades frente a una meta de ${plan.target.toLocaleString('es-PE')}. Revisa personal y equipos del proceso.`});
    return warnings;
  }
  return Object.freeze({draft,owned,previousStaff,unitCost,breakdown,section,future,finances,warnings,roundMoney});
});
