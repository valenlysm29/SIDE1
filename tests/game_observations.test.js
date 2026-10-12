const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const rules=require('../js/side_rules.js');
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
 assert.match(result.error,/Falta aplicar la migración/);assert.equal(inserted,false);
 failure={code:'',message:'Failed to fetch'};
 result=await window.SIDE.PartidaService.crear({nombre:'Prueba',configuracion:{lifecycleVersion:2}});
 assert.match(result.error,/conexión con Supabase/);assert.equal(inserted,false);
});
test('game creation requires the alphanumeric migration before inserting a remote lobby',async()=>{
 let features={observationsVersion:1},inserted=false;
 const client={
  auth:{getUser:async()=>({data:{user:{id:'teacher'}}})},
  rpc:async name=>({data:name==='side_admission_features'?{waitingRoomVersion:3,exactIdentityVersion:2}:name==='side_game_features'?features:{id:'game',codigo:'SIDE-WG2',estado:'esperando',configuracion:{lifecycleVersion:2,gameStartAt:'2026-10-09T00:02:00Z',runtime:{phase:'integration'}},serverTime:'2026-10-09T00:00:00Z'}}),
  from(){inserted=true;return {insert:()=>({select:()=>({single:async()=>({data:{codigo:'SIDE-WG2'}})})})};}
 };
 const window={crypto:{randomUUID:()=> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},SIDE:{SupabaseClient:{get:()=>client}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../services/partida_service.js'),'utf8'),{window});
 const input={nombre:'Prueba',configuracion:{lifecycleVersion:2}};
 let result=await window.SIDE.PartidaService.crear(input);
 assert.equal(result.success,false);assert.match(result.error,/supabase_game_codes\.sql/);assert.equal(inserted,false);
 features={observationsVersion:1,gameCodeVersion:2};
 result=await window.SIDE.PartidaService.crear(input);
 assert.equal(result.success,true);assert.equal(result.data.codigo,'SIDE-WG2');assert.equal(inserted,false,'RPC atómico reemplaza INSERT REST');
});


test('game creation returns the RPC server clock instead of a plain inserted row',async()=>{
 const created={id:'game',codigo:'SIDE-WG2',estado:'esperando',configuracion:{lifecycleVersion:2,gameStartAt:'2026-10-09T05:02:00Z',runtime:{phase:'integration'}}};
 const calls=[];
 const client={auth:{getUser:async()=>({data:{user:{id:'teacher'}}})},
 rpc:async(name,args)=>{calls.push({name,args});return {data:name==='side_admission_features'?{waitingRoomVersion:3,exactIdentityVersion:2}:name==='side_game_features'?{observationsVersion:1,gameCodeVersion:2}:name==='crear_sala_docente'?{...created,serverTime:'2026-10-09T05:00:00Z'}:{error:'No tienes permiso'}};},
 from:()=>({insert:()=>({select:()=>({single:async()=>({data:created})})})})};
 const window={crypto:{randomUUID:()=> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},SIDE:{SupabaseClient:{get:()=>client}}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../services/partida_service.js'),'utf8'),{window});
 const result=await window.SIDE.PartidaService.crear({nombre:'Prueba',configuracion:{lifecycleVersion:2}});
 assert.equal(result.success,true);assert.equal(result.data.serverTime,'2026-10-09T05:00:00Z');
 assert.equal(calls.at(-1).name,'crear_sala_docente');assert.equal(calls.at(-1).args.p_nombre,'Prueba');
});
