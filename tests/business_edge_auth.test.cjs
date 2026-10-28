const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Exercise the HTTP handler, stripping only its TypeScript annotations.
function handler({authorized=true,authError=false,key='private-server-key'}={}){
 let serve;const calls=[];
 let source=fs.readFileSync('supabase/functions/side-business-close/index.ts','utf8').replace(/^import .*\n/,'').replace('request: Request','request').replace('r: { success: boolean }','r');
 vm.runInNewContext(source,{Deno:{env:{get:name=>name==='SUPABASE_URL'?'https://example.invalid':key},serve:fn=>serve=fn},Response,Date,console:{log(){},error(){}},remoteRpc:()=>async(name,args)=>{calls.push({name,args});return {data:authorized,error:authError?{}:null};},runOnce:async()=>{calls.push({name:'runOnce'});return [{success:true}];}});
 return {serve,calls};
}
test('edge rejects missing and invalid scheduler token without running closures',async()=>{
 for(const token of [null,'invalid']){
  const h=handler({authorized:false});const result=await h.serve(new Request('https://example.invalid',{method:'POST',headers:token?{'x-side-cron-token':token}:{}}));
  assert.equal(result.status,401);assert.ok(!h.calls.some(c=>c.name==='runOnce'));
 }
});
test('edge authorizes scheduler through service-only RPC and then closes cycles',async()=>{
 const h=handler();const result=await h.serve(new Request('https://example.invalid',{method:'POST',headers:{'x-side-cron-token':'dedicated-token'}}));
 assert.equal(result.status,200);assert.deepEqual(h.calls.map(c=>c.name),['side_validar_token_cierre','runOnce']);
 assert.equal((await result.json()).success,true);
});
test('edge fails closed on auth outage and disallows non-POST calls',async()=>{
 const h=handler({authError:true});assert.equal((await h.serve(new Request('https://example.invalid',{method:'POST',headers:{'x-side-cron-token':'token'}}))).status,503);
 assert.equal((await h.serve(new Request('https://example.invalid'))).status,405);assert.ok(!h.calls.some(c=>c.name==='runOnce'));
});
