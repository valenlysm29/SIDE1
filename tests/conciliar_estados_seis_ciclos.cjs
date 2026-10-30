'use strict';
// Reconciles the server-generated evidence; it does not calculate a closure.
const fs=require('node:fs'),assert=require('node:assert/strict');
const evidence=JSON.parse(fs.readFileSync('tests/output/continuidad_estados_20261030.json','utf8'));
const close=(a,b,label)=>assert.ok(Math.abs(Number(a)-Number(b))<=0.021,`${label}: ${a} != ${b}`);
const sum=values=>values.reduce((a,v)=>a+Number(v||0),0);
let previous=null;
for(const {receipt:r,financial:f} of evidence.cycles){
 const e=f.estadoResultados,b=f.balanceGeneral,c=f.flujoCaja,q=r.round;
 close(e.ventasTotales-e.costoVentas,e.utilidadBruta,`${q} utilidad bruta`);
 close(e.gastosAdministrativos+e.gastosVentas,e.gastosOperacion,`${q} gastos`);
 close(e.utilidadBruta-e.gastosOperacion+e.ingresosFinancieros-e.gastosFinancieros-e.impuestoRenta,e.utilidadNeta,`${q} resultado`);
 close(sum([b.efectivo,b.cuentasPorCobrar,b.anticiposMateriales,b.inventarios,b.activosFijos]),b.activos,`${q} activos`);
 close(sum([b.deuda,b.cuentasPorPagarProveedores,b.impuestosPorPagar,b.interesesPorPagar,b.provisionGarantias,b.patrimonio]),b.pasivoPatrimonio,`${q} pasivos y patrimonio`);
 close(b.activos,b.pasivoPatrimonio,`${q} balance`);
 close(sum([c.cobrosVentas,c.reembolsos,c.pagosOperacion,c.impuestoRenta,c.eventos,c.otros]),c.operacion,`${q} operación`);
 close(c.compraActivos+c.ventaActivos,c.inversion,`${q} inversión`);
 close(c.operacion+c.inversion+c.financiamiento,c.flujoNeto,`${q} flujo neto`);
 close(c.cajaInicial+c.flujoNeto,c.cajaFinal,`${q} caja`);
 close(c.cajaFinal,b.efectivo,`${q} efectivo`);
 close(sum(r.sales.map(x=>x.revenue)),e.ventasTotales,`${q} ventas`);
 for(const sale of r.sales){
  if(sale.sold)close(sale.effectivePrice,sale.revenue/sale.sold,`${q} precio efectivo`);
  close(sum(sale.points.map(x=>x.sold)),sale.sold,`${q} unidades canal`);
  close(sum(sale.points.map(x=>x.revenue)),sale.revenue,`${q} ingreso canal`);
  for(const point of sale.points){assert.ok(point.sold<=point.demand&&point.sold<=point.available,`${q} límites canal`);close(sum(point.lotSales.map(x=>x.revenue)),point.revenue,`${q} lotes`);}
 }
 for(const [sku,received] of Object.entries(r.materialReceiptFacts.receivedBySku)){close(Number(r.openingInventory[sku]||0)+received-Number(r.production.temporal.consumedBySku[sku]||0),Number(r.inventory[sku]||0),`${q} material ${sku}`);}
 if(previous){close(previous.balanceGeneral.efectivo,c.cajaInicial,`${q} arrastre caja`);close(previous.balanceGeneral.resultadosAcumulados+e.utilidadNeta,b.resultadosAcumulados,`${q} arrastre resultados`);close(previous.balanceGeneral.cuentasPorPagarProveedores+sum(Object.values(r.materialReceiptFacts.receivedValueBySku))-c.pagosProveedores,b.cuentasPorPagarProveedores,`${q} cuentas proveedor`);}
 previous=f;
}
const fields=[['Estado de resultados','estadoResultados',['ventasTotales','costoVentas','utilidadBruta','gastosAdministrativos','gastosVentas','gastosOperacion','utilidadOperativa','ingresosFinancieros','gastosFinancieros','utilidadAntesImpuestos','impuestoRenta','utilidadNeta']],['Balance general','balanceGeneral',['efectivo','cuentasPorCobrar','anticiposMateriales','inventarioMP','inventarioPT','activosFijos','activos','deuda','cuentasPorPagarProveedores','impuestosPorPagar','interesesPorPagar','provisionGarantias','capital','resultadosAcumulados','patrimonio','pasivoPatrimonio']],['Estado de flujo de efectivo','flujoCaja',['cajaInicial','cobrosVentas','reembolsos','pagosOperacion','impuestoRenta','eventos','otros','operacion','compraActivos','ventaActivos','inversion','financiamiento','flujoNeto','cajaFinal']]];
const fmt=v=>Number(v||0).toFixed(2);
let md='# Estados financieros conciliados — escenario local de seis ciclos\n\nCifras en soles; fuente: cierres persistidos por el worker en PGlite, empresa principal del test `continuidad_seis_ciclos_activos.test.cjs`. Las cifras son un escenario de prueba, no una partida real ni evidencia de todas las decisiones. `pagosOperacion` incluye pagos a proveedores; no debe sumarse de nuevo el detalle de esos pagos. Los valores de depreciación están incluidos en el costo de ventas de este escenario.\n\n';
for(const [title,key,names] of fields){md+=`## ${title}\n\n| Concepto | C1 | C2 | C3 | C4 | C5 | C6 |\n|---|---:|---:|---:|---:|---:|---:|\n`;for(const name of names)md+=`| ${name} | ${evidence.cycles.map(x=>fmt(x.financial[key][name])).join(' | ')} |\n`;md+='\n';}
md+='Las ecuaciones de resultado, balance, flujo, caja, ventas por canal y movimiento de materiales fueron verificadas automáticamente a dos centavos de tolerancia. La prueba no cubre amortización ni pago de intereses bancarios: no existe un calendario definido en el modelo actual. La conciliación no prueba por sí sola la corrección de cada importe ni la equivalencia con Excel.\n';
fs.writeFileSync('reports/estados_financieros_seis_ciclos_20261030.md',md);
console.log('Seis ciclos conciliados; informe generado desde los cierres locales.');
