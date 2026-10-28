'use strict';
// Trusted server process. Never include this module or its credentials in HTML.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function service(rpc){
  const window={SIDE:{SupabaseClient:{get:()=>({rpc})}},
    SIDE_CYCLE_MODEL:require('../js/cycle_model.js'),
    SIDE_FINANCIAL_MODEL:require('../js/financial_model.js'),
    SIDE_FINANCE_CONFIG:require('./finance_config.js'),
    SIDE_DECISION_CATALOG:require('../js/decision_catalog.js')};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'partida_service.js'),'utf8'),{window,console,setTimeout,clearTimeout});
  return window.SIDE.PartidaService;
}
async function runOnce(rpc){
  const {data,error}=await rpc('side_cierres_pendientes',{});
  if(error||data?.error)throw new Error(error?.message||data.error);
  const api=service(rpc),results=[];
  for(const game of data||[]){
    // Always settle older cycles first: inventory, receivables and taxes carry over.
    for(const cycle of game.cycles){
      const result=await api.cerrarNegocio(game.id,cycle);
      results.push({game:game.id,cycle,success:result.success,pending:!!result.pending,code:result.code,error:result.error});
      if(!result.success||result.pending)break;
    }
  }
  return results;
}
function remoteRpc(url,key){
  return async(name,args)=>{
    const response=await fetch(url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(30000)});
    const data=await response.json();return response.ok?{data,error:null}:{data:null,error:{message:data.message||'RPC HTTP '+response.status,code:data.code}};
  };
}
async function main(){
  process.chdir(root);
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error('Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el servidor del ejecutor.');
  const rpc=remoteRpc(url,key),once=process.argv.includes('--once');let stopping=false;
  process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
  do{
    try{const results=await runOnce(rpc);if(results.length)console.log(JSON.stringify({at:new Date().toISOString(),results}));}
    catch(error){console.error('Cierre automático:',error.message);if(once)process.exitCode=1;}
    if(!once&&!stopping)await new Promise(resolve=>setTimeout(resolve,10000));
  }while(!once&&!stopping);
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={runOnce,remoteRpc};
