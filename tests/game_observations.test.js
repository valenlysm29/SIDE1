const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const rules=require('../side_rules.js');
test('cancellation overrides operating and automatic schedule states, including legacy games',()=>{
 for(const lifecycleVersion of [1,2]){
  const config={lifecycleVersion,cancelledAt:new Date().toISOString(),cycleCloseMode:'automatic',runtime:{phase:'cancelled',round:2},gameStartAt:'2020-01-01T00:00:00Z'};
  const access=rules.gameAccess(config,{active:true},{phase:'decisions',round:2},true);
  assert.equal(access.canOperate,false);assert.equal(access.canJoin,false);assert.equal(access.cancelled,true);
  assert.equal(rules.resolveRuntime(config).phase,'cancelled');
 }
});
test('Supabase client retries a delayed SDK and all services share one instance',()=>{
 let count=0;const singleton={};
 const window={SIDE_CONFIG:{SUPABASE_URL:'https://example.invalid',SUPABASE_PUBLISHABLE_KEY:'public-test'}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../services/supabase_client.js'),'utf8'),{window,console:{warn(){},error(){}}});
 assert.equal(window.SIDE.SupabaseClient.get(),null);
 window.supabase={createClient(){count++;return singleton;}};
 assert.equal(window.SIDE.SupabaseClient.get(),singleton);assert.equal(window.SIDE.SupabaseClient.init(),singleton);assert.equal(count,1);
});
test('game creation distinguishes missing migration from transient network failures without inserting',async()=>{
 let failure={code:'PGRST202',message:'Missing function'},inserted=false;
 const client={auth:{getUser:async()=>({data:{user:{id:'teacher'}}})},rpc:async()=>({error:failure}),from(){inserted=true;throw new Error('Unexpected insert');}};
 const window={SIDE:{SupabaseClient:{get:()=>client}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../services/partida_service.js'),'utf8'),{window});
 let result=await window.SIDE.PartidaService.crear({nombre:'Prueba',configuracion:{lifecycleVersion:2}});
 assert.match(result.error,/Actualiza Supabase/);assert.equal(inserted,false);
 failure={code:'',message:'Failed to fetch'};
 result=await window.SIDE.PartidaService.crear({nombre:'Prueba',configuracion:{lifecycleVersion:2}});
 assert.equal(result.error,'Failed to fetch');assert.equal(inserted,false);
});
