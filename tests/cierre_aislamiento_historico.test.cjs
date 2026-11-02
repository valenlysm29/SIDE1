'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const load=()=>import('../supabase/functions/side-business-close/route.mjs');
function fixture({unknown=false,versionOutage=false}={}){
 const journal=[],calls=[],games=[{id:'old',cycles:[2,3]},{id:'new',cycles:[1]},{id:'other',cycles:[1]}];
 const rpc=async(name,args)=>{
  calls.push(name);
  if(name==='side_cierres_pendientes')return {data:games};
  if(name==='side_version_worker_cierre'){
   if(args.p_partida_id==='old'&&versionOutage)throw Error('network');
   return {data:args.p_partida_id==='old'?(unknown?'invalid':'0'):'1'};
  }
  if(name==='side_registrar_estado_cierre'){journal.push(args);return {data:null};}
  throw Error('Unexpected RPC '+name);
 };
 return {rpc,journal,calls};
}
test('un error o excepción legado no afecta al cierre nuevo ni habilita ciclos siguientes',async()=>{
 const {runVersioned}=await load();
 for(const throws of [false,true]){
  const f=fixture(),order=[];
  const engine=async rpc=>{const [g]=(await rpc('side_cierres_pendientes',{})).data;order.push(g.id);return [{game:g.id,cycle:1,success:true,pending:false}];};
  const legacy=async rpc=>{const [g]=(await rpc('side_cierres_pendientes',{})).data;order.push(g.id);if(throws)throw Error('network outage');return [{game:g.id,cycle:2,success:false,code:'DATOS_ECONOMICOS_NO_VERIFICADOS'}];};
  const result=await runVersioned(f.rpc,legacy,engine);
  assert.deepEqual(order,['new','other','old']);
  assert.equal(result.filter(r=>r.success).length,2);assert.equal(result.find(r=>r.game==='old').success,false);
  assert.ok(!result.some(r=>r.game==='old'&&r.cycle===3));
  assert.ok(f.calls.every(n=>!['side_guardar_cierre_negocio','controlar_partida'].includes(n)));
  assert.equal(f.journal.length,3);
 }
});
test('versión histórica desconocida o RPC fallida solo bloquea esa partida',async()=>{
 const {runVersioned}=await load();
 for(const options of [{unknown:true},{versionOutage:true}]){
  const f=fixture(options);let legacyCalled=false;
  const result=await runVersioned(f.rpc,async()=>{legacyCalled=true},async rpc=>{
   const [g]=(await rpc('side_cierres_pendientes',{})).data;return [{game:g.id,cycle:1,success:true}];
  });
  assert.equal(legacyCalled,false);assert.equal(result.filter(r=>r.success).length,2);assert.equal(result.find(r=>r.game==='old').code,'VERSION_CIERRE_NO_VERIFICABLE');
 }
});
test('un fallo nuevo se aísla y un plazo agotado se declara pendiente, nunca éxito vacío',async()=>{
 const {runVersioned}=await load(),f=fixture();
 const result=await runVersioned(f.rpc,async rpc=>[{game:(await rpc('side_cierres_pendientes',{})).data[0].id,cycle:2,success:false}],async rpc=>{
  const [g]=(await rpc('side_cierres_pendientes',{})).data;if(g.id==='new')throw Error('network');return [{game:g.id,cycle:1,success:true}];
 });
 assert.equal(result.find(r=>r.game==='other').success,true);assert.equal(result.find(r=>r.game==='new').success,false);
 const expired=await runVersioned(f.rpc,()=>assert.fail(),()=>assert.fail(),{deadline:Date.now()-1});
 assert.equal(expired.length,3);assert.ok(expired.every(r=>r.pending&&r.code==='PLAZO_TRABAJADOR_AGOTADO'));
});
