'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function load(){
  const c={};vm.createContext(c);
  for(const file of ['config_excel','catalogo_excel','puntajes','produccion','costos','consecuencias','mercado','ciclo','caja','ui_excel'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/engine',file+'.js'),'utf8'),c);
  return c;
}
function decisions(c,quantity=1){
  const d=c.SIDE_EXCEL_UI.nuevasDecisiones();
  d.lotes=[{cantidad:quantity,molde:'INF-08',cuero:'INS-01',accesorios:'INS-04',hilo:'INS-06',segmento:'SEG-01',precio:40}];
  return d;
}
const json=value=>JSON.parse(JSON.stringify(value));
test('Excel editor requirements depend on desired quantities even when inventory and capacity change',()=>{
  const c=load(),d=decisions(c,397),first=c.SIDE_EXCEL_UI.proyectarPlan(d,{cash:1e6});
  const stocked=json(d);stocked.comprasUnidades={'INS-01':1000,'INS-04':1000,'INS-06':100};
  stocked.personal={corte:[10,0,0],ensamble:[10,0,0],acabado:[10,0,0]};
  const second=c.SIDE_EXCEL_UI.proyectarPlan(stocked,{cash:1e6});
  assert.deepEqual(json(first.plan.requirements),json(second.plan.requirements));
  assert.deepEqual(json(first.plan.requirements.materials.map(row=>row.needs)),[119.1,397,2382]);
  assert.equal(first.plan.requirements.processes[0].workersNeeded,null);
  assert.equal(first.plan.requirements.costs.total,null);
  assert.equal(first.plan.comparison.items.find(row=>row.id==='CUERO').missing,119.1);
  assert.equal(second.plan.comparison.items.find(row=>row.id==='CUERO').missing,0);
});
test('Excel editor compares each chosen quality without treating another quality as a substitute',()=>{
  const c=load(),d=decisions(c,10);d.comprasUnidades={'INS-03':10};
  const projection=c.SIDE_EXCEL_UI.proyectarPlan(d,{cash:1e6});
  const row=projection.plan.comparison.items.find(row=>row.id==='CUERO');
  assert.equal(row.needs,3);assert.equal(row.available,20);assert.equal(row.missing,3);assert.equal(row.surplus,20);
  assert.equal(row.costToCover,69); // 3 m² * Costos!V76 (25) * (1 - 8%).
  assert.equal(projection.plan.requirements.costs.items.find(row=>row.id==='CUERO').amount,69);
});
test('Excel editor zero target is finite and reports zero needs and costs',()=>{
  const c=load(),projection=c.SIDE_EXCEL_UI.proyectarPlan(decisions(c,0),{cash:1e6});
  assert.equal(projection.plan.requirements.target,0);
  assert.equal(projection.plan.requirements.costs.total,0);
  assert.ok(projection.plan.requirements.materials.every(row=>row.needs===0));
  assert.ok(projection.plan.comparison.items.every(row=>Number.isFinite(row.missing)));
});
test('Excel editor purchase equivalence exposes the literal division and adds no package rounding',()=>{
  const c=load(),d=decisions(c),prepared=c.SIDE_EXCEL_CICLO.prepararEmpresa(d);
  const html=c.SIDE_EXCEL_UI.materialRecommendationHtml(d,prepared);
  assert.match(html,/6 \/ 270 = 0[.,]0222 presentaciones/);
  assert.match(html,/Excel no define cómo redondear compras/);
  assert.doesNotMatch(html,/1 × 270/);
});
