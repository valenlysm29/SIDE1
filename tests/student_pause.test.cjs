const test=require('node:test'),assert=require('node:assert/strict'),R=require('../js/side_rules.js');
for(const config of [{lifecycleVersion:2},{integrationMinutes:0},{integrationMinutes:60}])test('pause blocks persistence, preserves review and remaining: '+JSON.stringify(config),()=>{
 const runtime={round:2,phase:'decisions',status:'paused',running:false,remaining:137};
 const access=R.gameAccess(config,{active:true},runtime,true,Date.now());
 assert.equal(access.canOperate,false);assert.equal(access.canReview,true);assert.equal(access.remaining,137);assert.equal(access.paused,true);
 runtime.status='running';runtime.running=true;
 if(config.lifecycleVersion===2)assert.equal(R.gameAccess(config,{active:true},runtime,true).canOperate,true);
});
test('cancellation has priority over paused review',()=>{assert.equal(R.gameAccess({lifecycleVersion:2,cancelledAt:'2026-10-21'},{},{status:'paused'},true).canReview,undefined);});
