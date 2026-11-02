// Local-only harness: execute the actual versioned Edge engines against one
// explicitly selected QA game, without scheduling unrelated local games.
import {runOnce,remoteRpc} from '../side-business-close/runtime.mjs';
import {runOnce as legacyRunOnce} from '../side-business-close/legacy-runtime.mjs';
import {runVersioned} from '../side-business-close/route.mjs';
Deno.serve(async request=>{
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!key||request.headers.get('Authorization')!==`Bearer ${key}`)return new Response('Unauthorized',{status:401});
 const {game,cycle}=await request.json(),url=Deno.env.get('SUPABASE_URL');
 const row=await fetch(`${url}/rest/v1/partidas?id=eq.${encodeURIComponent(game)}&select=nombre`,{headers:{apikey:key,Authorization:`Bearer ${key}`}}).then(r=>r.json());
 if(!row?.[0]?.nombre?.startsWith('QA Historia '))return new Response('Not a QA game',{status:403});
 const rpc=remoteRpc(url,key);
 const scoped=(name,args)=>name==='side_cierres_pendientes'?Promise.resolve({data:[{id:game,cycles:[cycle]}],error:null}):rpc(name,args);
 const results=await runVersioned(scoped,legacyRunOnce,runOnce,{deadline:Date.now()+45000});
 return Response.json(results);
});
