const test=require('node:test'),assert=require('node:assert/strict');
const {singleMoldPlan,withImplicitPrices}=require('../services/student_sync');
const model=require('../js/production_model');
test('switches transfer 100 units without accumulating and normalize recovery',()=>{
 let meta={moldTargets:{molde_1:100}};
 for(const id of ['molde_2','molde_3','molde_1','molde_3']){
  meta=singleMoldPlan(meta,id);assert.equal(meta.moldTargets[id],100);assert.equal(meta.value,100);
  assert.equal(Object.values(meta.moldTargets).filter(Boolean).length,1);
  const restored=singleMoldPlan(JSON.parse(JSON.stringify(meta)));assert.deepEqual(restored,meta);
  const wire=withImplicitPrices({decision_state:{PRODUCCION_META:meta}},{});assert.deepEqual(wire.decision_state.PRODUCCION_META,meta);
  const p=model.calculate({round:1,drafts:{PRODUCCION_META:meta}});assert.equal(p.target,100);
  assert.equal(p.materials[0].neededForTarget,{molde_1:30,molde_2:40,molde_3:70}[id]);
  assert.ok(model.planResources(p.target).processes.every(x=>x.machines>=1&&x.workers>=1));
 }
});
test('legacy mixed plans retain only the viewed quantity, never their sum',()=>{
 const m=singleMoldPlan({viewMoldId:'molde_3',moldTargets:{molde_1:100,molde_2:100,molde_3:100}});
 assert.deepEqual(m.moldTargets,{molde_1:0,molde_2:0,molde_3:100});
 assert.equal(singleMoldPlan({moldId:'molde_2',value:100}).moldTargets.molde_2,100);
 const zero=singleMoldPlan({moldId:'molde_3',moldTargets:{molde_3:0}},'molde_2');assert.equal(zero.value,0);assert.equal(zero.moldId,'molde_2');
});
