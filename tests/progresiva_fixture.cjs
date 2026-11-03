'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const F=require('./economic_v19_fixture.cjs'),C=require('../js/cycle_model'),P=require('../js/production_model'),B=require('../js/business_rules'),FC=require('../services/finance_config');
const quantities=[100,200,300,500,750,1000],strategies=['eficiente','intermedia','ineficiente'],molds=['molde_1','molde_2','molde_3'];
const money=v=>Math.round(v*100)/100,near=(a,b,label,tol=.021)=>assert.ok(Math.abs(a-b)<=tol,label+': '+a+' != '+b);
const capital=1000000;
function targets(kind,q,round=1){
 if(kind==='combinado')return Object.fromEntries(molds.map(id=>[id,q]));
 if(kind==='asimetrico')return {molde_1:q,molde_2:Math.floor(q/2),molde_3:Math.floor(q/4)};
 return {[kind]:q};
}
function plan(target,strategy='eficiente',round=1,previous={}){
 const total=Object.values(target).reduce((a,v)=>a+v,0),base=Math.max(1,Math.ceil(total/135));
 const count=strategy==='ineficiente'?base*4:strategy==='intermedia'?Math.ceil(base*1.3):base;
 const s={},history=id=>structuredClone(previous[id]?.purchases||{});
 for(const [id,opt] of [['MESA_CORTE','mesa'],['ENSAMBLE','ens_basica'],['ACABADOS','aca_basica']]){
  const purchases=history(id),owned=Object.values(purchases).reduce((sum,row)=>sum+Number(row[opt]||0),0),add=Math.max(0,count-owned);
  purchases[round]={[opt]:add};s[id]={round,purchases,quantities:{[opt]:add}};
 }
 const moldHistory=history('MOLDE'),known=new Set(Object.values(moldHistory).flatMap(row=>Object.keys(row).filter(id=>row[id]>0)));
 const selected=Object.keys(target).filter(id=>target[id]>0);moldHistory[round]=Object.fromEntries(selected.filter(id=>!known.has(id)).map(id=>[id,1]));
 s.MOLDE={round,optionIds:selected,purchases:moldHistory};
 for(const [id,opt] of [['PERS_CORTE','corte_basico'],['PERS_ENSAMBLE','ens_personal_basico'],['PERS_ACABADO','aca_personal_basico']])s[id]={round,quantities:{[opt]:count}};
 s.JEFATURA={round,optionIds:[strategy==='eficiente'?'no_jefatura':'si_jefatura']};
 s.CANALES=strategy==='eficiente'?{round,optionIds:['web']}:{round,optionIds:['web',strategy==='intermedia'?'los_olivos':'miraflores'],quantities:{[strategy==='intermedia'?'los_olivos':'miraflores']:strategy==='intermedia'?1:3}};
 s.INV_MARKETING={round,value:strategy==='eficiente'?0:strategy==='intermedia'?1500:10000};
 s.ANALISTA_COMPRAS={round,optionIds:[strategy==='ineficiente'?'si_analista':'no_analista']};
 s.MANTENIMIENTO={round,optionIds:strategy==='ineficiente'?['correctivo']:[]};
 s.PRESTAMO={round,amount:round===1&&strategy==='intermedia'?10000:0};
 s.PRODUCCION_META={round,moldTargets:target};
 const need={CUERO:{},ACCESORIOS:{},HILO:{}},recipes={molde_1:[.3,6],molde_2:[.4,7],molde_3:[.7,13]};
 for(const [id,q] of Object.entries(target)){
  const premium=id==='molde_3',r=recipes[id];
  for(const [family,sku,v]of [['CUERO',premium?'cuero_prem':'cuero_sint',q*r[0]],['ACCESORIOS',premium?'acc_prem':'acc_eco',q],['HILO',premium?'hilo_prem':'hilo_std',q*r[1]]])need[family][sku]=(need[family][sku]||0)+v;
 }
 const stock=previous.__inventarioMP||{},extra=strategy==='eficiente'?1:strategy==='intermedia'?1.1:1.5;
 for(const [id,rows]of Object.entries(need))s[id]={round,quantities:Object.fromEntries(Object.entries(rows).map(([sku,q])=>[sku,Number(Math.max(0,q*extra-Number(stock[sku]||0)).toPrecision(12))]))};
 return s;
}
function policy(cycles=3){return {...FC.resolve({cycles,economicRulesVersion:'utility-v1',interest:20,loanPolicy:{version:'french-v1'}},1),authoritativePrices:true}}
function validate(r,input,previous){
 const e=r.financial.estadoResultados,b=r.financial.balanceGeneral,c=r.financial.balanceCaja,receipt=r.receipt,p=receipt.production;
 near(e.ingresos,receipt.sales.reduce((s,x)=>s+x.sold*x.price,0),'ventas');
 near(e.utilidadBruta,e.ingresos-e.costoVentas,'bruta');
 near(e.utilidadOperativa,e.utilidadBruta-e.gastosOperacion,'operativa');
 near(e.utilidadNeta,e.utilidadAntesImpuestos-e.impuestoRenta,'neta');
 near(b.activos,b.pasivoPatrimonio,'balance');near(b.patrimonio,b.capital+b.resultadosAcumulados,'patrimonio');
 near(c.cajaFinal,c.cajaInicial+c.entradas-c.salidas,'caja');
 if(previous){near(c.cajaInicial,previous.financial.balanceCaja.cajaFinal,'arrastre caja');near(b.resultadosAcumulados,previous.financial.balanceGeneral.resultadosAcumulados+e.utilidadNeta,'acumulados');}
 for(const stage of p.processes){assert.ok(stage.pairs<=stage.staff&&stage.pairs<=stage.machines,'1:1 '+stage.id);assert.ok(p.producibleUnits<=stage.cycleCapacity,'capacidad '+stage.id)}
 const use={};for(const lot of receipt.materialLots||[])for(const family of Object.values(lot.materials||{}))for(const [sku,q]of Object.entries(family))use[sku]=(use[sku]||0)+q;
 for(const family of ['CUERO','ACCESORIOS','HILO'])for(const [sku,q]of Object.entries(input.state[family]?.quantities||{}))near(Number(receipt.openingInventory?.[sku]||0)+(Number(input.state[family]?.round)===Number(input.round)?q:0),Number(use[sku]||0)+Number(receipt.inventory[sku]||0),'inventario '+sku,1e-6);
 for(const sale of receipt.sales){assert.ok(sale.sold<=sale.available&&sale.sold<=sale.demand,'stock/demanda');near(sale.revenue,sale.sold*sale.price,'precio efectivo');}
 for(const section of Object.values(r.financialSections[input.round]||{}))for(const item of section.items||[])if(['CUERO','ACCESORIOS','HILO'].includes(item.id))for(const row of item.rows||[]){
  const def=F.catalog.flatMap(c=>c.items).find(i=>i.id===item.id),opt=def.options.find(o=>o.label===row.label);
  const analyst=(input.state.ANALISTA_COMPRAS.optionIds||[]).includes('si_analista')?Math.max(2,12-(input.round-1)*2):0;
  near(row.unitCost,B.materialUnitPrice(opt,row.quantity,analyst,{materials:{quantityDiscountRate:.08,quantityDiscountThreshold:100}}),'descuento '+opt.id,1e-6);
 }
 return true;
}
function summarize(id,r,strategy,kind,q,extra={}){
 const e=r.financial.estadoResultados,active=r.receipt.sales.filter(x=>x.produced||x.sold),produced=r.receipt.produced;
 const consumos={};for(const lot of r.receipt.materialLots||[])for(const family of Object.values(lot.materials||{}))for(const [sku,amount]of Object.entries(family))consumos[sku]=(consumos[sku]||0)+amount;
 const detalle=active.map(x=>({producto:x.id,producido:x.produced,disponible:x.available,vendido:x.sold,demanda:x.demand,ingresos:x.revenue,precio:x.price,elegido:x.chosenPrice,calidad:x.quality,lotes:(r.financial.lotMovements||[]).filter(l=>l.segment===x.id).map(l=>({id:l.id,ciclo:l.cycle,costoUnitario:l.unitCost,costoVendido:l.costOfSales,inventario:l.inventoryValue,unidades:l.available}))}));
 return {id,molde:kind,meta:q,metaTotal:r.receipt.production.target,metaPorMolde:r.receipt.production.targets,estrategia:strategy,producido:produced,vendido:r.receipt.sold,costoUnitario:produced?money(e.costosProduccion/produced):null,precioEfectivo:r.receipt.sold?money(r.receipt.revenue/r.receipt.sold):active.length===1?active[0].price:null,precios:active.map(x=>({producto:x.id,precio:x.price,elegido:x.chosenPrice,vendidas:x.sold})),detalle,etapas:r.receipt.production.processes,materiales:{inicial:r.receipt.openingInventory,compras:Object.fromEntries(['CUERO','ACCESORIOS','HILO'].map(f=>[f,Number(r.receipt.decisions[f]?.round)===Number(r.receipt.round)?r.receipt.decisions[f]?.quantities||{}:{}])),consumo:consumos,final:r.receipt.inventory},ingresos:e.ingresos,costoVentas:e.costoVentas,gastos:e.gastosOperacion,depreciacion:e.depreciacion,mantenimiento:e.desgloseCostos.mantenimiento,utilidadBruta:e.utilidadBruta,utilidadOperativa:e.utilidadOperativa,utilidad:e.utilidadNeta,impuesto:e.impuestoRenta,intereses:e.gastosFinancieros,caja:r.financial.balanceCaja.cajaFinal,stockMP:r.financial.balanceGeneral.inventarioMP,stockPT:r.financial.balanceGeneral.inventarioPT,deuda:r.financial.balanceGeneral.deuda,acumulada:r.financial.balanceGeneral.resultadosAcumulados,activos:r.financial.balanceGeneral.activos,pasivoPatrimonio:r.financial.balanceGeneral.pasivoPatrimonio,estado:'CONCILIA',diferencias:[...(produced<r.receipt.production.target?['Capacidad, materiales o evento limitan producción']:[]),...(r.receipt.sold<produced?['Demanda/redistribución limita ventas; queda inventario']:[]),...(e.utilidadNeta<0?['Costos y gastos superan ingresos']:[])],...extra};
}
function scenarios(){
 return quantities.flatMap(q=>['molde_1','molde_2','molde_3','combinado','asimetrico'].flatMap(kind=>strategies.map(strategy=>({id:kind+'-'+q+'-'+strategy,kind,q,strategy,target:targets(kind,q)}))));
}
async function runMatrix(){
 const rows=[],details={};for(const spec of scenarios()){
  const state=plan(spec.target,spec.strategy),input={state,catalog:F.catalog,round:1,capital,financialPolicy:policy()};
  const r=C.close(input);validate(r,input);assert.equal(r.receipt.produced,Object.values(spec.target).reduce((a,v)=>a+v,0),'meta factible '+spec.id);
  rows.push(summarize(spec.id,r,spec.strategy,spec.kind,spec.q,{entorno:'Node aislado'}));details[spec.id]={input,result:r};
 }
 const out=path.resolve(__dirname,'output/progresiva');fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'matriz-local.json'),JSON.stringify(rows,null,2));fs.writeFileSync(path.join(out,'casos-locales.json'),JSON.stringify(details));
 console.log(JSON.stringify({cases:rows.length,positive:rows.filter(x=>x.utilidad>0).length,negative:rows.filter(x=>x.utilidad<0).length,efficientSolo:rows.filter(x=>x.estrategia==='eficiente'&&x.molde.startsWith('molde')).map(x=>({molde:x.molde,meta:x.meta,sold:x.vendido,net:x.utilidad}))},null,2));return rows;
}
module.exports={F,C,P,B,FC,quantities,strategies,molds,capital,targets,plan,policy,validate,summarize,scenarios,runMatrix};
if(require.main===module)runMatrix().catch(e=>{console.error(e);process.exitCode=1});
