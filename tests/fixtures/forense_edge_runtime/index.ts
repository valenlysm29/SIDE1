// Test-only service: replays supplied RPC reads; has no database credentials.
// The test copies the freshly generated bundle beside this entrypoint.
import {runOnce} from './runtime.mjs';
import {runVersioned} from './route.mjs';
Deno.serve(async request => {
 if(request.method==='GET')return new Response('forense-ready');
 try{
  const {reads}=await request.json();let closure=null;
  const rpc=async(name,args)=>{
   if(name==='side_guardar_cierre_negocio'){closure=args.p_cierre;return {data:{cierre:closure}};}
   const found=reads.find(row=>row.name===name&&JSON.stringify(row.args)===JSON.stringify(args));
   if(!found)throw Error('Unexpected RPC '+name+' '+JSON.stringify(args));
   return found.response;
  };
  const legacy=async call=>{if((await call('side_cierres_pendientes',{})).data.length)throw Error('Legacy game unexpectedly routed to candidate');return [];};
  const results=await runVersioned(rpc,legacy,runOnce);
  return Response.json({results,closure});
 }catch(error){return Response.json({error:String(error)},{status:500});}
});
