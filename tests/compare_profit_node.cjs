'use strict';
// Reads real local API facts, captures the candidate without saving a closure.
const {runOnce,remoteRpc}=require('../services/business_runtime.cjs');
let data='';process.stdin.setEncoding('utf8');process.stdin.on('data',x=>data+=x);process.stdin.on('end',async()=>{
 try{const {url,key,game,cycle}=JSON.parse(data);if(!url.startsWith('http://127.0.0.1:'))throw Error('Local API only');const real=remoteRpc(url,key);let closure;
  const results=await runOnce(async(name,args)=>{
   if(name==='side_cierres_pendientes')return {data:[{id:game,cycles:[cycle]}]};
   if(['side_guardar_cierre_negocio','side_guardar_cierre_temporal_v1'].includes(name)){closure=args.p_cierre;return {data:{cierre:closure}};}
   return real(name,args);
  });if(results.some(r=>!r.success)||!closure)throw Error(JSON.stringify(results));process.stdout.write(JSON.stringify(closure));
 }catch(error){process.stderr.write(String(error));process.exitCode=1;}
});
