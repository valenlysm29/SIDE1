'use strict';
// Expected values are cached by real Excel COM, never calculated in this test.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'tests/output/dop-20261022/independent');
const fixture=require('./oracle/dop_cantidad_20261022.json');
const read=name=>process.env.SIDE_ORACLE_FIXTURE_ONLY!=='1'&&fs.existsSync(path.join(OUT,name))?JSON.parse(fs.readFileSync(path.join(OUT,name),'utf8').replace(/^\uFEFF/,'')):name==='summary.json'?fixture.summary:fixture.records[name];
const oracle=read('summary.json'),model=require('../js/production_model.js'),dop=require('../js/production_dop.js');
const close=(actual,expected,label)=>assert.ok(typeof actual==='number'&&Math.abs(actual-expected)<=1e-9*Math.max(1,Math.abs(expected)),`${label}: SIDE=${actual} Excel=${expected}`);
for(const row of oracle.direct)test('actual Excel requirements: '+row.name,()=>{
 const moldTargets=Object.fromEntries(row.inputs.map((entry,index)=>['molde_'+(index+1),entry.set_to]));
 const materialDefs=[['CUERO','cuero_sint'],['ACCESORIOS','acc_eco'],['HILO','hilo_std']];
 const context={round:1,drafts:{PRODUCCION_META:{moldTargets}},catalog:[{items:materialDefs.map(([id,option])=>({id,type:'quantity',options:[{id:option}]}))}]};
 const empty=model.calculate(context),before=JSON.stringify(context),req=empty.requirements;
 close(req.target,row.values.D36,'D36 target');
 const cells=[['D42','G42','J42'],['E43','H43','K43'],['F44','I44','L44']];
 req.lots.forEach((lot,index)=>lot.materials.forEach((material,m)=>close(material.needs,row.values[cells[index][m]],cells[index][m])));
 assert.deepEqual(req.dop.map(step=>step.units),[req.target,req.target,req.target,req.target,req.target]);
 assert.equal(req.maximumQuantity,null);
 if(req.target){assert.equal(req.costs.total,null);assert.ok(req.processes.every(process=>process.workersNeeded===null&&process.machinesNeeded===null&&process.laborDays===null));}
 // Deliberately change only available stock, not target or material quality.
 const stockedContext={...context,drafts:{...context.drafts,...Object.fromEntries(materialDefs.map(([id,option])=>[id,{quantities:{[option]:100000}}]))}};
 const stocked=model.calculate(stockedContext);
 assert.ok(stocked.materials.every(material=>material.available>0),'fixture really changes stock');
 assert.ok(empty.materials.every(material=>material.available===0),'empty fixture really has no stock');
 assert.deepEqual(stocked.requirements,req,'stock cannot change target requirements');
 const html=dop.render(empty,{round:1});
 assert.doesNotMatch(html,/NaN|Infinity|undefined/);
 assert.equal(JSON.stringify(context),before,'view calculations cannot mutate inputs');
 if(!req.target){assert.equal(row.values.E37,'#DIV/0!','Excel zero allocation is inherited; do not compare its HRESULT with UI zero guard');}
});

const {cerrarCiclo}=require('../js/engine/ciclo.js'),{adjuntarCaja}=require('../js/engine/caja.js');
test('explicit persisted stock is physical and combines only with current purchases',()=>{
 const materials=[['CUERO','cuero_sint'],['ACCESORIOS','acc_eco'],['HILO','hilo_std']];
 const ctx={round:2,catalog:[{items:materials.map(([id,option])=>({id,type:'quantity',options:[{id:option}]}))}],state:{__inventarioMP:{'INS-01':1.5,'INS-04':7,'INS-06':12},CUERO:{round:1,quantities:{cuero_sint:1000}}},drafts:{PRODUCCION_META:{moldTargets:{molde_1:10}}}};
 const before=JSON.stringify(ctx),plan=model.calculate(ctx);
 for(const [id,available,missing] of [['CUERO',1.5,1.5],['ACCESORIOS',7,3],['HILO',12,48]]){const row=plan.comparison.items.find(row=>row.id===id);close(row.available,available,id+' physical');close(row.missing,missing,id+' missing');}
 const replenished=model.calculate({...ctx,drafts:{...ctx.drafts,CUERO:{quantities:{cuero_sint:1}},ACCESORIOS:{quantities:{acc_eco:2}},HILO:{quantities:{hilo_std:1}}}});
 assert.deepEqual(plan.requirements,replenished.requirements);
 for(const [id,available] of [['CUERO',2.5],['ACCESORIOS',9],['HILO',282]])close(replenished.comparison.items.find(row=>row.id===id).available,available,id+' replenished');
 assert.equal(JSON.stringify(ctx),before);
});
const pipeline=require('./oracle/comparar_pipeline.cjs'),scenarios=require('./escenarios_excel.cjs');
function simulate(scenario){let history={};const results=[];
 for(let i=0;i<scenario.ciclos.length;i++){
  const factory=cerrarCiclo({ciclo:i+1,empresas:scenario.empresas,...scenario.ciclos[i],historialPorEmpresa:history},scenario.overrides);
  const out=adjuntarCaja(factory,{historialAnterior:history,capitalPorEmpresa:Object.fromEntries(scenario.empresas.map(id=>[typeof id==='string'?id:id.id,scenario.capitalInicial??1000000])),overrides:scenario.overrides});
  history=out.historialPorEmpresa;results.push(out);
 }return pipeline.valoresDesdeResultados(results);
}
for(const row of oracle.historical)test('fresh Excel historical parity: '+row.name,()=>{
 let actual;
 if(row.name==='base')actual={...require('./paridad_base.cjs').valoresBase(),...require('./paridad_costos.cjs').calcularValoresCostos()};
 else if(['sim2','sim2_premium'].includes(row.name))actual=require('./paridad_consecuencias.cjs').valores(require('./oracle/escenario_'+row.name+'.json'));
 else if(row.name.startsWith('banca')){const b=require('./oracle/banca_recuperacion.cjs');actual=simulate(row.name.startsWith('bancamezcla')?b.escenarioMezcla():b.escenario());}
 else{const name=row.name.replace('_pipeline','');actual=simulate(scenarios['crear'+name[0].toUpperCase()+name.slice(1)]());}
 const expected=read('historical_'+row.name+'.json');
 const differences=pipeline.comparar(actual,expected);
 assert.deepEqual(differences,[],JSON.stringify(differences.slice(0,8)));
 assert.equal(Object.keys(expected.valores).length,row.count);
});
test('oracle provenance and 3104 historical cells',()=>{
 assert.equal(fixture.provenance.source_sha256,'3b6b42bbbc56a2534ce7e241c607d572dd38dcf02311683609497df36a0c1eb1');
 assert.equal(fixture.provenance.engine,'Microsoft Excel COM');assert.ok(Number.isFinite(Date.parse(fixture.provenance.generated_at)));
 assert.equal(oracle.direct.length,14);assert.equal(oracle.historical.length,8);assert.equal(oracle.historical_total,3104);assert.equal(oracle.historical_differences,0);
 assert.equal(oracle.original_metadata.version,'16.0');assert.equal(oracle.original_metadata.estadoCalculo,0);
 assert.equal(oracle.original_errors.length,7);
});
