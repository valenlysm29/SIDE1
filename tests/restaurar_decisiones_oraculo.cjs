'use strict';
// Compare the unchanged production engine with committed, Excel-recalculated values.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=require('./paridad_base.cjs'),con=require('./paridad_consecuencias.cjs');
const pipeline=require('./oracle/comparar_pipeline.cjs');
const rows=[];
function compare(name,expected,actual){
 const result=base.comparar(expected,actual),differences=result.filter(row=>!row.ok);
 rows.push({name,total:result.length,differences});
}
compare('base',require('./oracle/esperado_base.json').valores,{...base.valoresBase(),...require('./paridad_costos.cjs').calcularValoresCostos()});
for(const name of ['sim2','sim2_premium'])compare(name,require('./oracle/esperado_'+name+'.json').valores,con.valores(require('./oracle/escenario_'+name+'.json')));
for(const name of ['sim1','sim2','sim3']){
 const differences=pipeline.ejecutar(name),expected=JSON.parse(fs.readFileSync(path.join(__dirname,'oracle/esperado_'+name+'_pipeline.json'),'utf8').replace(/^\uFEFF/,''));
 rows.push({name,total:Object.keys(expected.valores).length,differences});
}
for(const name of ['banca','bancamezcla']){
 const results=require('./oracle/banca_recuperacion.cjs').ejecutar(name);
 const expected=JSON.parse(fs.readFileSync(path.join(__dirname,'oracle/esperado_'+name+'_pipeline.json'),'utf8').replace(/^\uFEFF/,''));
 rows.push({name,total:Object.keys(expected.valores).length,differences:pipeline.comparar(pipeline.valoresDesdeResultados(results),expected)});
}
const report={total:rows.reduce((sum,row)=>sum+row.total,0),differences:rows.reduce((sum,row)=>sum+row.differences.length,0),scenarios:rows};
const out=path.join(__dirname,'output/restaurar-decisiones');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'oracle.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
assert.equal(report.total,3104);assert.equal(report.differences,0);
