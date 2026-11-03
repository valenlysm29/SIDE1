/* Accrual statements; recorded payments remain the source of cash movements. */
(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(()=>node?require('./engine/config.js'):root.SIDE_ECONOMIC_CONFIG,()=>node?require('./loan_schedule.js'):root.SIDE_LOAN_SCHEDULE,()=>node?require('./event_cost_bases.js'):root.SIDE_EVENT_COST_BASES);if(node)module.exports=api;else root.SIDE_FINANCIAL_MODEL=api;})(typeof globalThis!=='undefined'?globalThis:this,function(getEconomicConfig,getLoanSchedule,getEventCostBases){
  const n=v=>Number.isFinite(Number(v))?Number(v):0;
  const money=v=>Math.round((n(v)+Number.EPSILON)*100)/100||0;
  // Allocate a carrying value in whole cents, preserving its exact total.
  function allocateMoney(total,weights){
    const positive=weights.map(v=>Math.max(0,n(v))),sum=positive.reduce((a,b)=>a+b,0);
    if(!sum)return weights.map(()=>0);
    const cents=Math.round(Math.abs(money(total))*100),shares=positive.map(w=>cents*w/sum),parts=shares.map(Math.floor);
    const order=shares.map((v,i)=>({i,remainder:v-parts[i]})).sort((a,b)=>b.remainder-a.remainder||a.i-b.i);
    for(let left=cents-parts.reduce((a,b)=>a+b,0),i=0;left>0;left--,i++)parts[order[i%order.length].i]++;
    return parts.map(v=>v/100*Math.sign(total));
  }
  function buildStatement(input={}){
    const ventasTotales=money(input.ventasTotales),costoVentas=money(input.costoVentas),gastosAdministrativos=money(input.gastosAdministrativos),gastosVentas=money(input.gastosVentas),ingresosFinancieros=money(input.ingresosFinancieros),gastosFinancieros=money(input.gastosFinancieros);
    const utilidadBruta=money(ventasTotales-costoVentas),gastosOperacion=money(gastosAdministrativos+gastosVentas),utilidadOperativa=money(utilidadBruta-gastosOperacion),utilidadAntesImpuestos=money(utilidadOperativa+ingresosFinancieros-gastosFinancieros),impuestoRenta=money(input.impuestoRenta??Math.max(0,utilidadAntesImpuestos*n(getEconomicConfig().tax.generalRate))),utilidadNeta=money(utilidadAntesImpuestos-impuestoRenta);
    return {...input,ventasTotales,costoVentas,utilidadBruta,gastosAdministrativos,gastosVentas,gastosOperacion,utilidadOperativa,ingresosFinancieros,gastosFinancieros,utilidadAntesImpuestos,impuestoRenta,utilidadNeta,ingresos:ventasTotales,ventasNetas:ventasTotales,costos:money(costoVentas+gastosOperacion+gastosFinancieros),utilidad:utilidadNeta};
  }
  function periodRate(tea,months=1){return Math.pow(1+n(tea)/100,n(months)/12)-1;}
  function incomeTax(base,regimen,overrides={}){
    const config={...getEconomicConfig().tax,...overrides},positive=Math.max(0,n(base));
    const general=n(config.generalRate),limit=n(config.uit)*n(config.mypeLimitUit);
    return money(regimen==='MYPE' ? Math.min(positive,limit)*n(config.mypeRate)+Math.max(0,positive-limit)*general : positive*general);
  }
  function calculate({capital=0,ledger={},sectionsByRound={},catalog=[],round=1,openingBalance=null,state={},financialPolicy={}}={}){
    const seed=openingBalance||{},seedRound=Math.max(0,n(seed.round)),seedBG=seed.balanceGeneral||{};
    const items=new Map(catalog.flatMap(c=>c.items||[]).map(i=>[i.id,i]));
    const periods=new Map();
    function period(r){if(!periods.has(r))periods.set(r,{r,ventas:0,devoluciones:0,gastos:0,mp:0,mod:0,comercial:0,eventos:0,comprasActivos:0,ventaActivos:0,bajaActivos:0,prestamos:0,aportes:0,otros:0,neto:0,detalle:[],fijos:0,publicidad:0,mantenimiento:0,almacenaje:0});return periods.get(r);}
    for(const [key,value] of Object.entries(ledger)){
      const [cycle,kind]=key.split(':'),r=Number(cycle);if(!Number.isInteger(r)||r<1||r>round||r<=seedRound)continue;
      const p=period(r),amount=n(value);
      // The receipt already deterministically derives this payment; retain its
      // ledger entry for cash reconciliation without applying it a second time.
      if(kind==='PROVEEDOR_PAGO'||kind==='BANCO_PAGO')continue;
      p.neto+=amount;
      if(kind==='CAPITAL_ADJUSTMENT')p.aportes+=amount;
      else if(kind==='SIM_VENTAS')p.ventas+=amount;
      else if(kind==='PROVEEDOR_CREDITO')p.supplierCredit=n(p.supplierCredit)+amount;
      else if(kind==='VENTAS_CREDITO')p.credito=n(p.credito)-amount;
      else if(kind==='COBRO_CREDITO')p.cobros=n(p.cobros)+amount;
      else if(kind==='ALMACENAJE'||kind==='MANTENIMIENTO_AUTO'){p.gastos-=amount;if(kind==='MANTENIMIENTO_AUTO')p.mantenimiento-=amount;else p.almacenaje-=amount;p.detalle.push({concepto:kind==='MANTENIMIENTO_AUTO'?'Mantenimiento anual / 12':'Almacenaje',importe:-amount});}
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
            }else{p.gastos+=out;if(['LOCAL_PROD','JEFATURA','LIMPIEZA'].includes(entry.id))p.fijos+=out;if(entry.id==='INV_MARKETING')p.publicidad+=out;if(entry.id==='MANTENIMIENTO')p.mantenimiento+=out;if(item.material)p.mp+=out;else if(['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO'].includes(entry.id))p.mod+=out;else if(['CANALES','INV_MARKETING','GARANTIA_PT'].includes(entry.id))p.comercial+=out;if(out)p.detalle.push({concepto:entry.name||entry.id,importe:out});}
            p.prestamos+=loan;classified+=loan+income-out;
          }
          p.otros+=amount-classified;
        }else p.otros+=amount;
      }
    }
    // Include quiet cycles so the student can review every played period.
    for(let r=Math.max(1,seedRound+1);r<=round;r++)period(r);
    let cash=openingBalance?n(seed.cash??seedBG.efectivo):n(capital),assets=n(seedBG.activosFijos),debt=n(seedBG.deuda),earnings=n(seedBG.resultadosAcumulados),equity=openingBalance?n(seedBG.capital??capital):n(capital);const otherAssets=Math.max(0,n(seedBG.activos)-n(seedBG.efectivo)-assets-n(seedBG.inventarioMP)-n(seedBG.inventarioPT)-n(seedBG.cuentasPorCobrar)),history=JSON.parse(JSON.stringify(seed.history||[])).filter(row=>Number(row.round)<=Math.min(round,seedRound));
    let supplierPayable=n(seedBG.cuentasPorPagarProveedores),materialPrepayment=n(seedBG.anticiposMateriales),accountsReceivable=n(seedBG.cuentasPorCobrar),materialValue=n(seedBG.inventarioMP),goodsValues={...(seed.inventoryValues?.goods||{})},materialQuantities={...(seed.inventoryQuantities||{})},materialValues={...(seed.inventoryValues?.materials||{})},taxPayable=n(seedBG.impuestosPorPagar),interestPayable=n(seedBG.interesesPorPagar),warrantyPayable=n(seedBG.provisionGarantias);
    let supplierPayableDetails=JSON.parse(JSON.stringify(seed.supplierPayables||[]));
    let loanBook=JSON.parse(JSON.stringify(seed.loanBook||[]));
    let depreciationValues={...seed.depreciationValues},unallocatedSeed=Object.keys(materialValues).length?0:n(seedBG.inventarioMP);
    for(const p of [...periods.values()].sort((a,b)=>a.r-b.r)){
      const frozen=state.__financialSnapshots?.[p.r];
      if(frozen?.balanceGeneral){const bg=frozen.balanceGeneral;loanBook=JSON.parse(JSON.stringify(frozen.loanBook||[]));cash=n(bg.efectivo);supplierPayable=n(bg.cuentasPorPagarProveedores);supplierPayableDetails=JSON.parse(JSON.stringify(frozen.cuentasPorPagarDetalle||[]));materialPrepayment=n(bg.anticiposMateriales);accountsReceivable=n(bg.cuentasPorCobrar);assets=n(bg.activosFijos);debt=n(bg.deuda);earnings=n(bg.resultadosAcumulados);equity=n(bg.capital);materialValue=n(bg.inventarioMP);goodsValues={...frozen.inventoryValues?.goods};materialValues={...frozen.inventoryValues?.materials};materialQuantities={...frozen.inventoryQuantities};depreciationValues={...frozen.depreciationValues};unallocatedSeed=Math.max(0,materialValue-Object.values(materialValues).reduce((s,v)=>s+n(v),0));taxPayable=n(bg.impuestosPorPagar);interestPayable=n(bg.interesesPorPagar);warrantyPayable=n(bg.provisionGarantias);history.push(JSON.parse(JSON.stringify(frozen)));continue;}
      const initial=cash;let operating=p.ventas-n(p.credito)+n(p.cobros)-p.devoluciones-p.gastos+n(p.supplierCredit)+p.eventos+p.otros;
      accountsReceivable+=n(p.credito)-n(p.cobros);
      const investing=p.ventaActivos-p.comprasActivos;let financing=p.prestamos+p.aportes;
      const disposal=p.ventaActivos-p.bajaActivos;
      const receipt=state.__cycleSettlements?.[p.r],decisions=receipt?.decisions||state.__cyclePlans?.[p.r]?.state||{},inventory=receipt?.inventory||materialQuantities;
      if(unallocatedSeed&&receipt?.openingInventory){
        const opening=receipt.openingInventory,options=[...items.values()].filter(i=>i.material).flatMap(i=>i.options||[]),weight=options.reduce((s,o)=>s+n(opening[o.id])*n(o.cost),0);
        if(weight){for(const o of options){materialValues[o.id]=n(materialValues[o.id])+unallocatedSeed*n(opening[o.id])*n(o.cost)/weight;materialQuantities[o.id]=n(opening[o.id]);}unallocatedSeed=0;}
      }
      const purchases=Object.entries(sectionsByRound[p.r]||{}).filter(([kind,s])=>Object.hasOwn(ledger,`${p.r}:${kind}`)&&Math.abs(n(s.recordedNet??s.net)-n(ledger[`${p.r}:${kind}`]))<.02).flatMap(([,s])=>s.items||[]).filter(e=>items.get(e.id)?.material);
      const openingMaterialValue=materialValue;
      let consumedMaterial=0,closingMaterial=0,receivedMaterialCost=0;const consumedByFamily={},materialUnitCosts={};
      for(const item of items.values())if(item.material)for(const option of item.options||[]){
        const rows=purchases.filter(e=>e.id===item.id).flatMap(e=>e.rows||[]).filter(row=>row.label===option.label),qty=receipt?.materialReceiptFacts?n(receipt.materialReceiptFacts.receivedBySku?.[option.id]):rows.reduce((s,row)=>s+n(row.quantity),0),cost=receipt?.materialReceiptFacts?n(receipt.materialReceiptFacts.receivedValueBySku?.[option.id]):rows.reduce((s,row)=>s+n(row.outflow),0),opening=n(materialQuantities[option.id]);
        receivedMaterialCost+=cost;
        const available=opening+qty,value=n(materialValues[option.id])+cost,remaining=receipt?n(inventory[option.id]):available;
        const closing=available?value*Math.min(1,remaining/available):value;materialUnitCosts[option.id]=available?value/available:0;consumedMaterial+=value-closing;consumedByFamily[item.id]=n(consumedByFamily[item.id])+value-closing;closingMaterial+=closing;materialValues[option.id]=closing;materialQuantities[option.id]=remaining;
      }
      // Preserve explicitly valued migrated stock until its valuation is available.
      materialValue=money(closingMaterial+unallocatedSeed);
      consumedMaterial=money(openingMaterialValue+receivedMaterialCost-materialValue);
      if(receipt?.materialReceiptFacts){const facts=receipt.materialReceiptFacts,ordered=Object.values(facts.ordersBySku).reduce((sum,v)=>sum+n(v.quantity)*n(v.unitCost),0),received=Object.values(facts.receivedValueBySku).reduce((sum,v)=>sum+n(v),0);if(Math.abs(money(ordered)-money(p.mp))>0.02)throw new Error('Pago de materiales no coincide con las órdenes verificadas.');if(facts.paymentMode==='credit'){if(Math.abs(money(ordered)-money(p.supplierCredit))>0.02)throw new Error('Crédito de proveedor inconsistente.');supplierPayable=money(supplierPayable+received);for(const item of facts.receipts){if(supplierPayableDetails.some(row=>row.receiptId===item.receiptId))throw new Error('Obligación de proveedor duplicada.');supplierPayableDetails.push({...item,paid:0,outstanding:item.value});}}else{materialPrepayment=money(materialPrepayment+p.mp-received);if(materialPrepayment < -0.01)throw new Error('Anticipo de materiales inconsistente.');}}
      const economicConfig=getEconomicConfig(),policy={...financialPolicy,...receipt?.financialPolicy},life={MESA_CORTE:10,ENSAMBLE:10,ACABADOS:8,MOLDE:5},months=n(policy.cycleMonths)||1;
      const md=receipt?.modelVersion==='md-20261027',residualRate=policy.residualRate??(receipt?.regimen==='NO_MYPE' ? .10 : .05);
      let depreciation=0;
      for(const [id,years] of Object.entries(life)){const item=items.get(id);if(item?.noDepreciation===true)continue;for(const option of item?.options||[]){const purchases=decisions[id]?.purchases,qty=purchases?Math.max(0,Object.entries(purchases).filter(([r])=>Number(r)<=p.r).reduce((sum,[,row])=>sum+n(row?.[option.id]),0)):(n(decisions[id]?.quantities?.[option.id])||Number(decisions[id]?.optionIds?.includes(option.id)||false)),base=qty*n(option.cost)*(1-n(residualRate)),linear=base/(n(policy.usefulLives?.[id])||years)/12*months,method=md?[]:decisions.__catalogSelection||receipt?.catalogSelection||[],annualized=method.includes('FIN-02B')?base*n(receipt?.produced)/(economicConfig?.depreciation?.productiveLife||100000):linear*(method.includes('FIN-02C')?(economicConfig?.depreciation?.acceleratedFactor||2):1),charge=Math.max(0,Math.min(base-n(depreciationValues[option.id]),annualized));depreciation+=charge;depreciationValues[option.id]=n(depreciationValues[option.id])+charge;}}
      depreciation=money(Math.min(Math.max(0,assets+p.comprasActivos-p.bajaActivos),depreciation));
      const produced=(receipt?.sales||[]).reduce((s,row)=>s+n(row.produced),0),productionCost=money(consumedMaterial+(produced?p.mod+depreciation:0));
      const lines=receipt?.production?.productLines||[];
      const sales=receipt?.sales||[],openingIds=Object.keys(goodsValues),openingValues=allocateMoney(Object.values(goodsValues).reduce((s,v)=>s+n(v),0),Object.values(goodsValues));
      openingIds.forEach((id,i)=>goodsValues[id]=openingValues[i]);
      const productionWeights=sales.map((row,index)=>{
        if(!n(row.produced))return 0;
        const lot=row.lots?.find(l=>Number(l.cycle)===p.r&&!l.legacy);
        let materials=0;
        if(lot){for(const family of Object.values(lot.materials||{}))for(const [id,qty] of Object.entries(family))materials+=n(qty)*n(materialUnitCosts[id]);}
        else for(const [family,value] of Object.entries(consumedByFamily)){const weights=lines.map(line=>n(line.target)?n(line.requirements?.[family])/n(line.target)*n(line.plannedUnits):0),total=weights.reduce((s,v)=>s+v,0);materials+=value*(total?n(weights[index])/total:n(row.produced)/produced);}
        return materials+(p.mod+depreciation)*n(row.produced)/produced;
      });
      const assignedProduction=allocateMoney(productionCost,productionWeights);
      let cogs=0,goodsLots=[],lotMovements=[];
      for(const [index,row] of sales.entries()){
        if(Array.isArray(row.lots)&&Array.isArray(row.lotSales)){
          const lots=row.lots.map(l=>({...l})),newLot=lots.find(l=>Number(l.cycle)===p.r&&!l.legacy);
          const legacy=lots.find(l=>l.legacy),openingKnown=lots.filter(l=>l!==newLot&&!l.legacy).reduce((sum,l)=>sum+n(l.available)*n(l.unitCost),0);
          // El valor agregado heredado se mantiene como una sola partida, sin
          // suponer composición o ciclos de fabricación inexistentes.
          if(legacy){const value=Math.max(0,n(goodsValues[row.id])-openingKnown);legacy.unitCost=n(legacy.available)?value/n(legacy.available):0;}
          const openingLots=lots.filter(l=>l!==newLot);
          const carrying=allocateMoney(n(goodsValues[row.id]),openingLots.map(l=>l.inventoryValue??n(l.available)*n(l.unitCost)));
          const lotValues=new Map(openingLots.map((l,i)=>[l,carrying[i]]));
          if(newLot)lotValues.set(newLot,assignedProduction[index]);
          let value=0;
          for(const lot of lots){const sale=row.lotSales.find(x=>x.id===lot.id),available=n(lot.available),sold=Math.min(available,n(sale?.units)),bookValue=n(lotValues.get(lot)),soldCost=available?money(bookValue*sold/available):0;lot.unitCost=available?bookValue/available:0;cogs+=soldCost;lot.available-=sold;if(lot.closingLocations){lot.locations=lot.closingLocations;delete lot.closingLocations;}lot.inventoryValue=money(bookValue-soldCost);value+=lot.inventoryValue;lotMovements.push({...lot,sold,costOfSales:soldCost});if(lot.available>0)goodsLots.push(lot);}
          goodsValues[row.id]=money(value);
        }else{
          // Aggregate receipts also relieve the same cents recognized as COGS.
          const availableValue=money(n(goodsValues[row.id])+assignedProduction[index]),soldCost=n(row.available)?money(availableValue*n(row.sold)/n(row.available)):0;cogs+=soldCost;goodsValues[row.id]=money(availableValue-soldCost);
        }
      }
      // Finished goods remain an asset until sold; idle labor and depreciation
      // cannot be capitalized when no units were manufactured.
      const idle=produced?0:p.mod+depreciation;
      const baseTEA=policy.tea??policy.interest??20,baseRate=periodRate(baseTEA,months);
      let preparedLoan=null;
      if(policy.loanPolicy){
        if(months!==1)throw new Error('french-v1 requiere ciclos de 30 días.');
        if(Math.abs(money(loanBook.reduce((sum,l)=>sum+n(l.balance),0))-money(debt))>.001||Math.abs(money(loanBook.reduce((sum,l)=>sum+n(l.interestArrears),0))-money(interestPayable))>.001)throw new Error('Deuda histórica sin calendario verificable; no se convierte automáticamente.');
        preparedLoan=getLoanSchedule().prepare({book:loanBook,round:p.r,amount:p.prestamos,tea:Number(baseTEA),penaltyPP:n(policy.nextLoanPenaltyPP),policy:policy.loanPolicy,cycles:n(policy.cycles)});
      }
      let interest=preparedLoan?preparedLoan.interest:money((debt+p.prestamos)*baseRate+p.prestamos*(periodRate(Number(baseTEA)+n(policy.nextLoanPenaltyPP),months)-baseRate));
      let costEventApplications=[];
      if(policy.eventCostPolicy){
        if(preparedLoan)throw new Error('Combinación de amortización y costos financieros pendiente de aprobación.');
        const effect=getEventCostBases().interest({events:receipt?.events||[],round:p.r,base:interest,policy:policy.eventCostPolicy});
        interest=effect.amount;costEventApplications=effect.applications;
      }
      const warrantyId=decisions.GARANTIA_PT?.optionIds?.[0],warrantyDays=items.get('GARANTIA_PT')?.options?.find(o=>o.id===warrantyId)?.value,warrantyRates={30:economicConfig?.warranty.pt_30??5,90:economicConfig?.warranty.pt_90??10,180:economicConfig?.warranty.pt_180??10,...policy.warrantyUnitCosts},warrantyRate=warrantyRates[warrantyDays],warranty=money(n(warrantyRate)*(receipt?.sales||[]).reduce((s,row)=>s+n(row.sold),0));warrantyPayable+=warranty;
      const policyWarnings=warrantyDays&&warrantyRate==null?[`Garantía ${warrantyDays} días sin costo unitario configurado; requiere definir financialPolicy.warrantyUnitCosts.${warrantyDays}.`]:[];
      let er=buildStatement({criterioCostos:'ventas',ventasTotales:p.ventas-p.devoluciones,costoVentas:cogs,gastosAdministrativos:p.gastos-p.mp-p.mod-p.comercial+idle-p.eventos-p.otros-disposal,gastosVentas:p.comercial+warranty,gastosFinancieros:interest,gastoGarantias:warranty,policyWarnings,depreciacion:depreciation,costosProduccion:money(productionCost),devoluciones:money(p.devoluciones),impactoEventos:money(p.eventos),otros:money(p.otros),resultadoVentaActivos:money(disposal)});
      if(n(policy.cycles)>0){
        const base=money(history.reduce((sum,row)=>sum+n(row.estadoResultados?.utilidadAntesImpuestos),0)+er.utilidadAntesImpuestos);
        const priorTax=history.reduce((sum,row)=>sum+n(row.estadoResultados?.impuestoRenta),0);
        const final=p.r===n(policy.cycles)&&!!receipt;
        const regime=['MYPE','NO_MYPE'].includes(policy.taxRegime)?policy.taxRegime:(receipt?.regimen||'NO_MYPE');
        const tax=final?Math.max(0,money(incomeTax(base,regime,policy.tax)-priorTax)):0;
        er=buildStatement({...er,impuestoRenta:tax,baseImponibleAcumulada:Math.max(0,base),utilidadAntesImpuestosAcumulada:base,utilidadNetaFinal:final?money(base-priorTax-tax):null,regimenTributario:regime,cicloImpuesto:n(policy.cycles),impuestoDiferido:!final});
      }
      // El desglose se conserva en el snapshot y distingue compras de activos de su depreciación.
      const identifiable=cogs+idle+p.mantenimiento+p.almacenaje+p.fijos+p.publicidad+interest;
      er.desgloseCostos={costoVentas:money(cogs),costoProduccionCiclo:money(productionCost),capacidadOciosa:money(idle),materiales:money(consumedMaterial),manoObra:money(p.mod),fijos:money(p.fijos),maquinaria:money(depreciation+p.mantenimiento),depreciacion:money(depreciation),mantenimiento:money(p.mantenimiento),publicidad:money(p.publicidad),intereses:money(interest),almacenaje:money(p.almacenaje),otros:money(er.costos-identifiable),total:money(er.costos)};
      const profit=er.utilidadNeta,paidTax=n(policy.cycles)>0?er.impuestoRenta:0;taxPayable+=er.impuestoRenta-paidTax;interestPayable+=interest;
      let loanPayment=null;
      if(preparedLoan){
        loanPayment=getLoanSchedule().pay(preparedLoan,Math.max(0,money(cash+p.neto-paidTax)));
        loanBook=loanPayment.book;interestPayable=loanPayment.interestPayable;
        p.neto=money(p.neto-loanPayment.totalPaid);operating=money(operating-loanPayment.interestPaid);financing=money(financing-loanPayment.principalPaid);
      }
      let supplierPaid=0;const supplierPayments=[];
      if(receipt?.materialReceiptFacts){
        if(Math.abs(money(supplierPayableDetails.reduce((sum,row)=>sum+n(row.outstanding),0))-money(supplierPayable))>0.01)throw new Error('Detalle de cuentas por pagar no verificable.');
        let available=money(cash+p.neto-paidTax);if(available<0)throw new Error('Caja insuficiente para el cierre temporal.');
        // Nuevo supuesto receipts-v1: al cierre se paga por orden de vencimiento
        // hasta donde alcance la caja; cualquier saldo queda pendiente.
        for(const debtRow of [...supplierPayableDetails].sort((a,b)=>n(a.dueCycle)-n(b.dueCycle)||String(a.receiptId).localeCompare(String(b.receiptId),'en'))){
          if(n(debtRow.dueCycle)>p.r||available<=0)continue;
          const paid=money(Math.min(available,n(debtRow.outstanding)));if(paid<=0)continue;
          debtRow.paid=money(n(debtRow.paid)+paid);debtRow.outstanding=money(n(debtRow.outstanding)-paid);available=money(available-paid);supplierPaid=money(supplierPaid+paid);
          supplierPayments.push({paymentId:`${debtRow.receiptId}:cycle:${p.r}`,receiptId:debtRow.receiptId,orderId:debtRow.orderId,cycle:p.r,amount:paid});
        }
        supplierPayable=money(supplierPayable-supplierPaid);p.neto-=supplierPaid;operating-=supplierPaid;
      }
      cash+=p.neto-paidTax;assets+=p.comprasActivos-p.bajaActivos;debt=loanPayment?loanPayment.debt:debt+p.prestamos;earnings+=profit;equity+=p.aportes;
      assets-=depreciation;
      const fc={...(loanPayment?{amortizacionPrestamos:-loanPayment.principalPaid,interesesBancariosPagados:-loanPayment.interestPaid}:{}),cobrosVentas:money(p.ventas-n(p.credito)+n(p.cobros)),reembolsos:money(-p.devoluciones),pagosOperacion:money(-p.gastos+n(p.supplierCredit)-supplierPaid-n(loanPayment?.interestPaid)),...(receipt?.materialReceiptFacts?{pagosProveedores:money(supplierPaid)}:{}),eventos:money(p.eventos),otros:money(p.otros),operacion:money(operating-paidTax),impuestoRenta:money(-paidTax),compraActivos:money(-p.comprasActivos),ventaActivos:money(p.ventaActivos),inversion:money(investing),financiamiento:money(financing),flujoNeto:money(p.neto-paidTax),cajaInicial:money(initial),cajaFinal:money(cash)};
      const bc={cajaInicial:money(initial),entradas:money(p.ventas-n(p.credito)+n(p.cobros)+Math.max(0,p.eventos)+Math.max(0,p.otros)+p.ventaActivos+p.prestamos+Math.max(0,p.aportes)),salidas:money(n(loanPayment?.totalPaid)+paidTax+p.devoluciones+p.gastos-n(p.supplierCredit)+supplierPaid+Math.max(0,-p.eventos)+Math.max(0,-p.otros)+p.comprasActivos+Math.max(0,-p.aportes)),prestamos:money(p.prestamos),aportesCapital:money(p.aportes),cajaFinal:money(cash)};
      const fg=Object.values(goodsValues).reduce((s,v)=>s+n(v),0),totalAssets=money(cash+accountsReceivable+assets+materialValue+fg+otherAssets+materialPrepayment);
      const bg={...(receipt?.materialReceiptFacts||materialPrepayment||supplierPayable?{anticiposMateriales:money(materialPrepayment),cuentasPorPagarProveedores:money(supplierPayable)}:{}),cuentasPorCobrar:money(accountsReceivable),efectivo:money(cash),activosFijos:money(assets),inventarioMP:money(materialValue),inventarioPT:money(fg),inventarios:money(materialValue+fg),activos:totalAssets,deuda:money(debt),impuestosPorPagar:money(taxPayable),interesesPorPagar:money(interestPayable),provisionGarantias:money(warrantyPayable),capital:money(equity),resultadosAcumulados:money(earnings),patrimonio:money(equity+earnings),pasivoPatrimonio:money(debt+supplierPayable+taxPayable+interestPayable+warrantyPayable+equity+earnings)};
      history.push({...(costEventApplications.length?{costEventApplications}:{}),...(loanPayment?{loanBook:JSON.parse(JSON.stringify(loanBook)),loanPayments:loanPayment.payments,loanPolicyVersion:loanPayment.version}:{}),round:p.r,closureStatus:receipt?'closed':'pending',sold:receipt? n(receipt.sold):null,cycleReceipt:receipt||null,...(receipt?.materialReceiptFacts?{cuentasPorPagarDetalle:JSON.parse(JSON.stringify(supplierPayableDetails)),pagosProveedores:supplierPayments}:{}),estadoResultados:er,balanceCaja:bc,flujoCaja:fc,balanceGeneral:bg,detalleGastos:p.detalle,depreciationValues:{...depreciationValues},inventoryValues:{materials:{...materialValues},goods:{...goodsValues}},inventoryQuantities:{...materialQuantities},goodsLots,lotMovements});
    }
    return {...history.at(-1),history};
  }
  return Object.freeze({calculate,buildStatement,periodRate,incomeTax});
});
