'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');process.chdir(root);
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/config.js'),'utf8'),sandbox);
const config=sandbox.window.SIDE_CONFIG;
const catalogContext={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/decision_catalog.js'),'utf8'),catalogContext);
async function probe(name,route){
 const start=Date.now();
 try{
  const response=await fetch(config.SUPABASE_URL+route,{headers:{apikey:config.SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(20000)});
  const body=await response.json();return {name,status:response.status,durationMs:Date.now()-start,body};
 }catch(error){return {name,error:error.message,cause:error.cause?.message};}
}
(async()=>{
 const probes=await Promise.all([
  probe('auth_health','/auth/v1/health'),
  probe('catalog','/rest/v1/decisiones_catalogo?select=id,decision_id,categoria,tipo&activo=eq.true'),
  probe('options','/rest/v1/decisiones_opciones?select=id,decision_id,opcion_id&activo=eq.true'),
  probe('roster_columns','/rest/v1/participantes?select=id,nombre,empresa,empresa_id,puntaje_docente,last_seen_at&limit=0'),
  probe('game_columns','/rest/v1/partidas?select=id,codigo,nombre,curso,estado,configuracion&limit=0'),
  probe('history_anonymous_denied','/rest/v1/rpc/obtener_ultima_partida_docente'),
  probe('features_anonymous_denied','/rest/v1/rpc/side_game_features')
 ]);
 const remote=probes.find(p=>p.name==='catalog').body,options=probes.find(p=>p.name==='options').body;
 let comparison=null;
 if(Array.isArray(remote)&&Array.isArray(options)){
  const items=catalogContext.window.SIDE_DECISION_CATALOG.flatMap(c=>c.items.map(i=>({...i,category:c.cat}))),byId=new Map(remote.map(i=>[i.decision_id,i]));
  comparison={missingDecisions:items.filter(i=>!byId.has(i.id)).map(i=>i.id),missingOptions:items.flatMap(i=>(i.options||[]).filter(o=>!options.some(p=>p.decision_id===byId.get(i.id)?.id&&p.opcion_id===o.id)).map(o=>i.id+':'+o.id)),categoryMismatches:items.filter(i=>byId.has(i.id)&&byId.get(i.id).categoria!==i.category).map(i=>i.id),typeMismatches:items.filter(i=>byId.has(i.id)&&byId.get(i.id).tipo!==i.type).map(i=>i.id)};
 }
 const result={checkedAt:new Date().toISOString(),scope:'GET only, no sign-in or real records, no remote mutations',probes,comparison};
 const out=path.join(root,'tests/output/revision-2026-10-05');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'remote-readonly.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({...result,probes:probes.map(p=>({...p,body:Array.isArray(p.body)?{rows:p.body.length}:p.body}))},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
