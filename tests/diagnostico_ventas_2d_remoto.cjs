'use strict';
// Read-only checks. Does not join, close or change the hosted game.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');process.chdir(root);
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync('js/config.js','utf8'),sandbox);
const config=sandbox.window.SIDE_CONFIG,base='https://valenlysm29.github.io/SIDE1/';
const sha=data=>crypto.createHash('sha256').update(data.replace(/\r\n/g,'\n')).digest('hex');
async function main(){
 const files=['index.html','js/app.js','js/production_model.js','js/cycle_model.js','js/docente.js'];
 const deployed=await Promise.all(files.map(async file=>{
  const response=await fetch(base+file,{signal:AbortSignal.timeout(15000)}),body=await response.text();
  return {file,status:response.status,sameAsWorkspace:sha(body)===sha(fs.readFileSync(file,'utf8')),sha256:sha(body),
   ...(file==='js/app.js'?{snapshotCycleMarker:body.includes('__snapshotRound'),legacyTargetsResolved:body.includes('resolveProductionTargets')}:{}),
   ...(file==='index.html'?{scripts:[...body.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1])}:{})};
 }));
 const rpc=async(name,args)=>{
  const response=await fetch(config.SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:config.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});
  return {name,status:response.status,data:await response.json()};
 };
 const checks=await Promise.all([
  rpc('side_estado_codigo_sala',{p_codigo:'SIDE-7DFR'}),rpc('side_admission_features',{}),
  rpc('side_precios_v19_validos',{p_state:{PRODUCCION_META:{prices:{esencial:42.5,urbano:100,premium:250}}}})
 ]);
 const result={checkedAt:new Date().toISOString(),room:'SIDE-7DFR',mode:'read-only unauthenticated',deployed,checks,
  limitations:['No teacher session or database administration credentials available. Company snapshots, final closures and protected migration status cannot be verified with a room link alone.']};
 fs.mkdirSync('tests/output',{recursive:true});fs.writeFileSync('tests/output/diagnostico_ventas_2d_remoto.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
