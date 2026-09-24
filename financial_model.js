/* Statements reconcile to recorded cash movements, never to unsaved choices.
   Simplified game policy: supplies are cycle expenses; equipment and molds are
   held at acquisition cost. No invented depreciation, tax or loan instalments. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SIDE_FINANCIAL_MODEL=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const n=v=>Number.isFinite(Number(v))?Number(v):0;
  const money=v=>Math.round((n(v)+Number.EPSILON)*100)/100;
  function calculate({capital=0,ledger={},sectionsByRound={},catalog=[],round=1}={}){
    const items=new Map(catalog.flatMap(c=>c.items||[]).map(i=>[i.id,i]));
    const periods=new Map();
    function period(r){if(!periods.has(r))periods.set(r,{r,ventas:0,devoluciones:0,gastos:0,eventos:0,comprasActivos:0,ventaActivos:0,bajaActivos:0,prestamos:0,otros:0,neto:0,detalle:[]});return periods.get(r);}
    for(const [key,value] of Object.entries(ledger)){
      const [cycle,kind]=key.split(':'),r=Number(cycle);if(!Number.isInteger(r)||r<1||r>round)continue;
      const p=period(r),amount=n(value);p.neto+=amount;
      if(kind==='SIM_VENTAS')p.ventas+=amount;
      else if(kind==='SIM_DEVOLUCIONES')p.devoluciones-=amount;
      else if(kind==='EVENT')p.eventos+=amount;
      else if(kind==='SIM_INVERSION')p.comprasActivos-=amount;
      else if(kind==='SIM_GASTOS'||kind==='COMISION_VENTAS'){
        p.gastos-=amount;p.detalle.push({concepto:kind==='COMISION_VENTAS'?'Comisiones de ventas':'Operación del mundo 3D',importe:-amount});
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
            }else{p.gastos+=out;if(out)p.detalle.push({concepto:entry.name||entry.id,importe:out});}
            p.prestamos+=loan;classified+=loan+income-out;
          }
          p.otros+=amount-classified;
        }else p.otros+=amount;
      }
    }
    period(round);
    let cash=n(capital),assets=0,debt=0,earnings=0;const history=[];
    for(const p of [...periods.values()].sort((a,b)=>a.r-b.r)){
      const initial=cash,operating=p.ventas-p.devoluciones-p.gastos+p.eventos+p.otros;
      const investing=p.ventaActivos-p.comprasActivos,financing=p.prestamos;
      const disposal=p.ventaActivos-p.bajaActivos;
      const profit=p.ventas-p.devoluciones-p.gastos+p.eventos+p.otros+disposal;
      cash+=p.neto;assets+=p.comprasActivos-p.bajaActivos;debt+=p.prestamos;earnings+=profit;
      const er={ingresos:money(p.ventas),devoluciones:money(p.devoluciones),ventasNetas:money(p.ventas-p.devoluciones),costos:money(p.gastos),impactoEventos:money(p.eventos),otros:money(p.otros),resultadoVentaActivos:money(disposal),utilidad:money(profit)};
      const fc={cobrosVentas:money(p.ventas),reembolsos:money(-p.devoluciones),pagosOperacion:money(-p.gastos),eventos:money(p.eventos),otros:money(p.otros),operacion:money(operating),compraActivos:money(-p.comprasActivos),ventaActivos:money(p.ventaActivos),inversion:money(investing),financiamiento:money(financing),flujoNeto:money(p.neto),cajaInicial:money(initial),cajaFinal:money(cash)};
      const bc={cajaInicial:money(initial),entradas:money(p.ventas+Math.max(0,p.eventos)+Math.max(0,p.otros)+p.ventaActivos+p.prestamos),salidas:money(p.devoluciones+p.gastos+Math.max(0,-p.eventos)+Math.max(0,-p.otros)+p.comprasActivos),prestamos:money(p.prestamos),cajaFinal:money(cash)};
      const bg={efectivo:money(cash),activosFijos:money(assets),activos:money(cash+assets),deuda:money(debt),capital:money(capital),resultadosAcumulados:money(earnings),patrimonio:money(n(capital)+earnings),pasivoPatrimonio:money(debt+n(capital)+earnings)};
      history.push({round:p.r,estadoResultados:er,balanceCaja:bc,flujoCaja:fc,balanceGeneral:bg,detalleGastos:p.detalle});
    }
    return {...history.at(-1),history};
  }
  return Object.freeze({calculate});
});
