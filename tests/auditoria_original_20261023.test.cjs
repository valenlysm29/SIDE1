'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fixture=require('./oracle/auditoria_original_recalculado_20261023.json');
const manifest=require('./oracle/auditoria_original_20261023_planes.json');
const result=require('./auditoria_original_20261023.cjs').compare(fixture);
test('audit expectations come from original Excel recalculation, without added sheets',()=>{
 assert.equal(fixture.source_sha256,manifest.sha256);
 assert.equal(fixture.engine,'Microsoft Excel COM');
 assert.equal(fixture.added_sheets,0);
 assert.equal(fixture.cases.length,manifest.planes.length);
 assert.ok(result.numeric_comparisons>1000);
 for(const row of fixture.cases){assert.equal(row.metadata.calculation_state,0);assert.equal(row.metadata.version,'16.0');}
});
for(const plan of manifest.planes)test('original Excel perturbation: '+plan.nombre,()=>{
 const differences=result.differences.filter(row=>row.case===plan.nombre);
 assert.deepEqual(differences,[],JSON.stringify(differences.slice(0,5)));
});
for(const plan of manifest.planes_operando_inyectado||[])test('separate Excel arithmetic experiment: '+plan.nombre,()=>{
 const row=fixture.operand_experiments.find(item=>item.name===plan.nombre);
 assert.equal(row.formula_modified_in_copy,true,'operand injection is separate from original-input coverage');
 const input=Object.values(plan.entradas)[0];
 const stock=require('../js/engine/inventario.js').actualizarInventario({test:input.D54},{test:input.E54},{test:input.F54});
 assert.ok(Math.abs(stock.test-row.values.costs__G54)<1e-12);
 assert.equal(stock.test,0);
});
