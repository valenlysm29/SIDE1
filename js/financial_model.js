/* Accrual statements; recorded payments remain the source of cash movements. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SIDE_FINANCIAL_MODEL=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const n=v=>Number.isFinite(Number(v))?Number(v):0;
  const money=v=>Math.round((n(v)+Number.EPSILON)*100)/100;
  function buildStatement(input={}){
    const ventasTotales=money(input.ventasTotales),costoVentas=money(input.costoVentas),gastosAdministrativos=money(input.gastosAdministrativos),gastosVentas=money(input.gastosVentas),ingresosFinancieros=money(input.ingresosFinancieros),gastosFinancieros=money(input.gastosFinancieros);
    const utilidadBruta=money(ventasTotales-costoVentas),gastosOperacion=money(gastosAdministrativos+gastosVentas),utilidadOperativa=money(utilidadBruta-gastosOperacion),utilidadAntesImpuestos=money(utilidadOperativa+ingresosFinancieros-gastosFinancieros),impuestoRenta=money(Math.max(0,utilidadAntesImpuestos*.295)),utilidadNeta=money(utilidadAntesImpuestos-impuestoRenta);
    return {...input,ventasTotales,costoVentas,utilidadBruta,gastosAdministrativos,gastosVentas,gastosOperacion,utilidadOperativa,ingresosFinancieros,gastosFinancieros,utilidadAntesImpuestos,impuestoRenta,utilidadNeta,ingresos:ventasTotales,ventasNetas:ventasTotales,costos:money(costoVentas+gastosOperacion+gastosFinancieros+impuestoRenta),utilidad:utilidadNeta};
  }
  function periodRate(tea,months=1){return Math.pow(1+n(tea)/100,n(months)/12)-1;}
  function calculate({capital=0,ledger={},sectionsByRound={},catalog=[],round=1,openingBalance=null,state={},financialPolicy={}}={}){
    const seed=openingBalance||{},seedRound=Math.max(0,n(seed.round)),seedBG=seed.balanceGeneral||{};
    const items=new Map(catalog.flatMap(c=>c.items||[]).map(i=>[i.id,i]));
    const periods=new Map();
    function period(r){if(!periods.has(r))periods.set(r,{r,ventas:0,devoluciones:0,gastos:0,mp:0,mod:0,comercial:0,eventos:0,comprasActivos:0,ventaActivos:0,bajaActivos:0,prestamos:0,aportes:0,otros:0,neto:0,detalle:[]});return periods.get(r);}
    for(const [key,value] of Object.entries(ledger)){
      const [cycle,kind]=key.split(':'),r=Number(cycle);if(!Number.isInteger(r)||r<1||r>round||r<=seedRound)continue;
      const p=period(r),amount=n(value);p.neto+=amount;
      if(kind==='CAPITAL_ADJUSTMENT')p.aportes+=amount;
      else if(kind==='SIM_VENTAS')p.ventas+=amount;
      else if(kind==='SIM_DEVOLUCIONES')p.devoluciones-=amount;
      else if(kind==='EVENT')p.eventos+=amount;
      else if(kind==='SIM_INVERSION')p.comprasActivos-=amount;
      else if(kind==='SIM_GASTOS'||kind==='COMISION_VENTAS'){
        p.gastos-=amount;if(kind==='COMISION_VENTAS')p.comercial-=amount;p.detalle.push({concepto:kind==='COMISION_VENTAS'?'Comisiones de ventas':'Operación del mundo 3D',importe:-amount});
      }else{
        const section=sectionsByRound[r]?.[kind];
        // Only use a breakdown if it describes the movement that was actually applied.
        if(section?.items&&Math.abs(n(section.recordedNet??section.net)-amount)<0.02){
          let classified=0;
          for(const entry of section.items){
            const item=items.get(entry.id)||{},out=n(entry.outflow),income=n(entry.assetIncome),loan=n(entry.financing);
            if(item.asset||entry.id==='MOLDE'){
              p.comprasActivos+=out;p.ventaActivos+=income;
              p.bajaActivos+=entry.bookValueDisposed!=null?n(entry.bookValueDisposed):(entry.rows||[]).reduce((s,row)=>s+n(row.income)/n(item.options?.find(o=>o.label===row.label)?.liquidationRate||0.4),0);
            }else{p.gastos+=out;if(item.material)p.mp+=out;else if(['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO'].includes(entry.id))p.mod+=out;else if(['CANALES','INV_MARKETING','GARANTIA_PT'].includes(entry.id))p.comercial+=out;if(out)p.detalle.push({concepto:entry.name||entry.id,importe:out});}
            p.prestamos+=loan;classified+=loan+income-out;
          }
          p.otros+=amount-classified;
        }else p.otros+=amount;
      }
    }
    // Include quiet cycles so the student can review every played period.
    for(let r=Math.max(1,seedRound+1);r<=round;r++)period(r);
    let cash=openingBalance?n(seed.cash??seedBG.efectivo):n(capital),assets=n(seedBG.activosFijos),debt=n(seedBG.deuda),earnings=n(seedBG.resultadosAcumulados),equity=openingBalance?n(seedBG.capital??capital):n(capital);const otherAssets=Math.max(0,n(seedBG.activos)-n(seedBG.efectivo)-assets),history=JSON.parse(JSON.stringify(seed.history||[])).filter(row=>Number(row.round)<=Math.min(round,seedRound));
    let materialValue=n(seedBG.inventarioMP),goodsValues={...(seed.inventoryValues?.goods||{})},materialQuantities={...(seed.inventoryQuantities||{})},materialValues={...(seed.inventoryValues?.materials||{})},taxPayable=n(seedBG.impuestosPorPagar),interestPayable=n(seedBG.interesesPorPagar),warrantyPayable=n(seedBG.provisionGarantias);
    let depreciationValues={...seed.depreciationValues},unallocatedSeed=Object.keys(materialValues).length?0:n(seedBG.inventarioMP);
    for(const p of [...periods.values()].sort((a,b)=>a.r-b.r)){
      const frozen=state.__financialSnapshots?.[p.r];
      if(frozen?.balanceGeneral){const bg=frozen.balanceGeneral;cash=n(bg.efectivo);assets=n(bg.activosFijos);debt=n(bg.deuda);earnings=n(bg.resultadosAcumulados);equity=n(bg.capital);materialValue=n(bg.inventarioMP);goodsValues={...frozen.inventoryValues?.goods};materialValues={...frozen.inventoryValues?.materials};materialQuantities={...frozen.inventoryQuantities};depreciationValues={...frozen.depreciationValues};unallocatedSeed=Math.max(0,materialValue-Object.values(materialValues).reduce((s,v)=>s+n(v),0));taxPayable=n(bg.impuestosPorPagar);interestPayable=n(bg.interesesPorPagar);warrantyPayable=n(bg.provisionGarantias);history.push(JSON.parse(JSON.stringify(frozen)));continue;}
      const initial=cash,operating=p.ventas-p.devoluciones-p.gastos+p.eventos+p.otros;
      const investing=p.ventaActivos-p.comprasActivos,financing=p.prestamos+p.aportes;
      const disposal=p.ventaActivos-p.bajaActivos;
      const receipt=state.__cycleSettlements?.[p.r],decisions=receipt?.decisions||state.__cyclePlans?.[p.r]?.state||{},inventory=receipt?.inventory||materialQuantities;
      if(unallocatedSeed&&receipt?.openingInventory){
        const opening=receipt.openingInventory,options=[...items.values()].filter(i=>i.material).flatMap(i=>i.options||[]),weight=options.reduce((s,o)=>s+n(opening[o.id])*n(o.cost),0);
        if(weight){for(const o of options){materialValues[o.id]=unallocatedSeed*n(opening[o.id])*n(o.cost)/weight;materialQuantities[o.id]=n(opening[o.id]);}unallocatedSeed=0;}
      }
      const purchases=Object.entries(sectionsByRound[p.r]||{}).filter(([kind,s])=>Object.hasOwn(ledger,`${p.r}:${kind}`)&&Math.abs(n(s.recordedNet??s.net)-n(ledger[`${p.r}:${kind}`]))<.02).flatMap(([,s])=>s.items||[]).filter(e=>items.get(e.id)?.material);
      let consumedMaterial=0,closingMaterial=0;const consumedByFamily={};
      for(const item of items.values())if(item.material)for(const option of item.options||[]){
        const rows=purchases.filter(e=>e.id===item.id).flatMap(e=>e.rows||[]).filter(row=>row.label===option.label),qty=rows.reduce((s,row)=>s+n(row.quantity),0),cost=rows.reduce((s,row)=>s+n(row.outflow),0),opening=n(materialQuantities[option.id]);
        const available=opening+qty,value=n(materialValues[option.id])+cost,remaining=receipt?n(inventory[option.id]):available;
        const closing=available?value*Math.min(1,remaining/available):value;consumedMaterial+=value-closing;consumedByFamily[item.id]=n(consumedByFamily[item.id])+value-closing;closingMaterial+=closing;materialValues[option.id]=closing;materialQuantities[option.id]=remaining;
      }
      // Preserve explicitly valued migrated stock until its valuation is available.
      materialValue=money(closingMaterial+unallocatedSeed);
      const policy={...financialPolicy,...receipt?.financialPolicy},life={MESA_CORTE:10,ENSAMBLE:10,ACABADOS:8,MOLDE:5},months=n(policy.cycleMonths)||1;
      let depreciation=0;
      for(const [id,years] of Object.entries(life)){const item=items.get(id);for(const option of item?.options||[]){const qty=n(decisions[id]?.quantities?.[option.id])||Number(decisions[id]?.optionIds?.includes(option.id)||false),base=qty*n(option.cost)*(1-n(policy.residualRate??.05)),charge=Math.max(0,Math.min(base-n(depreciationValues[option.id]),base/(n(policy.usefulLives?.[id])||years)/12*months));depreciation+=charge;depreciationValues[option.id]=n(depreciationValues[option.id])+charge;}}
      depreciation=money(Math.min(Math.max(0,assets+p.comprasActivos-p.bajaActivos),depreciation));
      const produced=(receipt?.sales||[]).reduce((s,row)=>s+n(row.produced),0),productionCost=consumedMaterial+p.mod+depreciation;
      const lines=receipt?.production?.productLines||[];
      let cogs=0;for(const [index,row] of (receipt?.sales||[]).entries()){
        let lineMaterial=0;for(const [family,value] of Object.entries(consumedByFamily)){const weights=lines.map(line=>n(line.target)?n(line.requirements?.[family])/n(line.target)*n(line.plannedUnits):0),total=weights.reduce((s,v)=>s+v,0);lineMaterial+=value*(total?n(weights[index])/total:produced?n(row.produced)/produced:0);}
        const assignedCost=lineMaterial+(produced?(p.mod+depreciation)*n(row.produced)/produced:0),availableValue=n(goodsValues[row.id])+assignedCost,soldCost=n(row.available)?availableValue*n(row.sold)/n(row.available):0;cogs+=soldCost;goodsValues[row.id]=availableValue-soldCost;
      }
      const idle=produced?0:p.mod+depreciation;
      const interest=money((debt+p.prestamos)*periodRate(policy.tea??policy.interest??20,months));
      const warrantyId=decisions.GARANTIA_PT?.optionIds?.[0],warrantyDays=items.get('GARANTIA_PT')?.options?.find(o=>o.id===warrantyId)?.value,warrantyRates={30:5,90:10,...policy.warrantyUnitCosts},warrantyRate=warrantyRates[warrantyDays],warranty=money(n(warrantyRate)*(receipt?.sales||[]).reduce((s,row)=>s+n(row.sold),0));warrantyPayable+=warranty;
      const policyWarnings=warrantyDays&&warrantyRate==null?[`Garantía ${warrantyDays} días sin costo unitario configurado; requiere definir financialPolicy.warrantyUnitCosts.${warrantyDays}.`]:[];
      const er=buildStatement({ventasTotales:p.ventas-p.devoluciones,costoVentas:cogs,gastosAdministrativos:p.gastos-p.mp-p.mod-p.comercial+idle-p.eventos-p.otros-disposal,gastosVentas:p.comercial+warranty,gastosFinancieros:interest,gastoGarantias:warranty,policyWarnings,depreciacion:depreciation,costosProduccion:money(productionCost),devoluciones:money(p.devoluciones),impactoEventos:money(p.eventos),otros:money(p.otros),resultadoVentaActivos:money(disposal)});
      const profit=er.utilidadNeta;taxPayable+=er.impuestoRenta;interestPayable+=interest;
      cash+=p.neto;assets+=p.comprasActivos-p.bajaActivos;debt+=p.prestamos;earnings+=profit;equity+=p.aportes;
      assets-=depreciation;
      const fc={cobrosVentas:money(p.ventas),reembolsos:money(-p.devoluciones),pagosOperacion:money(-p.gastos),eventos:money(p.eventos),otros:money(p.otros),operacion:money(operating),compraActivos:money(-p.comprasActivos),ventaActivos:money(p.ventaActivos),inversion:money(investing),financiamiento:money(financing),flujoNeto:money(p.neto),cajaInicial:money(initial),cajaFinal:money(cash)};
      const bc={cajaInicial:money(initial),entradas:money(p.ventas+Math.max(0,p.eventos)+Math.max(0,p.otros)+p.ventaActivos+p.prestamos+Math.max(0,p.aportes)),salidas:money(p.devoluciones+p.gastos+Math.max(0,-p.eventos)+Math.max(0,-p.otros)+p.comprasActivos+Math.max(0,-p.aportes)),prestamos:money(p.prestamos),aportesCapital:money(p.aportes),cajaFinal:money(cash)};
      const fg=Object.values(goodsValues).reduce((s,v)=>s+n(v),0),totalAssets=money(cash+assets+materialValue+fg+Math.max(0,otherAssets-n(seedBG.inventarioMP)));
      const bg={efectivo:money(cash),activosFijos:money(assets),inventarioMP:money(materialValue),inventarioPT:money(fg),inventarios:money(materialValue+fg),activos:totalAssets,deuda:money(debt),impuestosPorPagar:money(taxPayable),interesesPorPagar:money(interestPayable),provisionGarantias:money(warrantyPayable),capital:money(equity),resultadosAcumulados:money(earnings),patrimonio:money(equity+earnings),pasivoPatrimonio:money(debt+taxPayable+interestPayable+warrantyPayable+equity+earnings)};
      history.push({round:p.r,estadoResultados:er,balanceCaja:bc,flujoCaja:fc,balanceGeneral:bg,detalleGastos:p.detalle,depreciationValues:{...depreciationValues},inventoryValues:{materials:{...materialValues},goods:{...goodsValues}},inventoryQuantities:{...materialQuantities}});
    }
    return {...history.at(-1),history};
  }
  return Object.freeze({calculate,buildStatement,periodRate});
});
