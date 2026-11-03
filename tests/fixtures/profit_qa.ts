// Local integration fixture only. Never deploy this endpoint to production.
import {runOnce,remoteRpc} from './runtime.mjs';
import {runOnce as legacy} from './legacy-runtime.mjs';
import {runTracked} from './route.mjs';
const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
Deno.serve(async request=>{
 if(request.headers.get('Authorization')!=='Bearer '+key)return new Response('Forbidden',{status:403});
 try{
  const {game,cycle,runId}=await request.json();
  if(!/^[a-f0-9-]{36}$/.test(game)||!Number.isInteger(cycle)||cycle<1||cycle>6||!runId)throw Error('Invalid QA scope');
  const rows=await (await fetch(url+'/rest/v1/partidas?id=eq.'+game+'&select=nombre',{headers:{apikey:key,Authorization:'Bearer '+key}})).json();
  if(!rows[0]?.nombre?.startsWith('QA Rentabilidad '))throw Error('Not an owned QA game');
  const real=remoteRpc(url,key),rpc=async(name,args)=>name==='side_cierres_pendientes'?{data:[{id:game,cycles:[cycle]}]}:real(name,args);
  const results=await runTracked(rpc,legacy,runOnce,{runId,deadline:Date.now()+45000});
  return Response.json({results,success:results.every(r=>r.success&&!r.pending)});
 }catch(error){return Response.json({error:String(error)},{status:500});}
});
