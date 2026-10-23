'use strict';
const path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..');
const manifest=require('./oracle/auditoria_original_20261023_planes.json');
const excelErrors=new Set(['#DIV/0!','#N/A','#NAME?','#NULL!','#NUM!','#REF!','#VALUE!','#SPILL!','#CALC!']);
function compare(fixture){
 const rows=[];
 for(const plan of manifest.planes){
  const expected=fixture.cases.find(row=>row.name===plan.nombre);
  if(!expected)throw new Error('Falta caso Excel: '+plan.nombre);
  for(const check of plan.side_checks){
   let actual,error;
   try{
    const api=require(path.join(root,'js/engine',check.module+'.js'));
    const args=check.arguments?structuredClone(check.arguments):[structuredClone(check.input)];
    if(check.overrides)args.push(structuredClone(check.overrides));
    actual=api[check.function](...args);
    for(const key of check.output_path.split('.'))actual=actual?.[key];
   }catch(caught){error=caught.message;}
   const wanted=expected.values[check.key];
   const sourceError=excelErrors.has(wanted);
   const equal=!error&&(typeof wanted==='number'?typeof actual==='number'&&Number.isFinite(actual)&&Math.abs(wanted-actual)<=Math.max(1e-9,Math.abs(wanted)*1e-10):wanted===actual||check.blank_string_is_null&&wanted===null&&actual==='');
   rows.push({case:plan.nombre,key:check.key,source:plan.salidas[check.key],scope:check.scope,excel:wanted,side:actual??null,error:error??null,status:sourceError?'source_error':equal?'equal':'difference'});
  }
 }
 return {source_sha256:manifest.sha256,engine:fixture.engine,cases:fixture.cases.length,exported_source_values:fixture.cases.reduce((sum,row)=>sum+Object.keys(row.values).length,0),comparisons:rows.length,comparable_checks:rows.filter(row=>row.status!=='source_error').length,numeric_comparisons:rows.filter(row=>typeof row.excel==='number').length,differences:rows.filter(row=>row.status==='difference'),source_errors:rows.filter(row=>row.status==='source_error'),rows};
}
module.exports={compare};
if(require.main===module){
 const fixture=require('./oracle/auditoria_original_recalculado_20261023.json');
 const result=compare(fixture);
 fs.writeFileSync(path.join(root,'reports/auditoria_recalculo_original_20261023.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({...result,rows:undefined,source_errors:result.source_errors.length},null,2));
 if(result.differences.length)process.exitCode=1;
}
