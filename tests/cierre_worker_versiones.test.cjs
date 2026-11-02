'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('cada partida usa su motor y un reintento no mezcla versiones',async()=>{
 const {runVersioned}=await import('../supabase/functions/side-business-close/route.mjs');
 const calls=[],rpc=async(name,args)=>name==='side_cierres_pendientes'?{data:[{id:'old',cycles:[2]},{id:'new',cycles:[1]}]}:{data:args.p_partida_id==='old'?'0':'1'};
 const engine=version=>async call=>{const rows=(await call('side_cierres_pendientes',{})).data;calls.push([version,rows.map(x=>x.id)]);return rows.map(x=>({game:x.id,success:true}));};
 await runVersioned(rpc,engine('old'),engine('new'));await runVersioned(rpc,engine('old'),engine('new'));
 assert.deepEqual(calls,[['old',['old']],['new',['new']],['old',['old']],['new',['new']]]);
});
test('rechaza versiones desconocidas sin ejecutar motores',async()=>{
 const {runVersioned}=await import('../supabase/functions/side-business-close/route.mjs');let called=false;
 await assert.rejects(runVersioned(async name=>name==='side_cierres_pendientes'?{data:[{id:'x',cycles:[1]}]}:{data:'2'},async()=>{called=true},async()=>{called=true}),/no verificable/);assert.equal(called,false);
});
