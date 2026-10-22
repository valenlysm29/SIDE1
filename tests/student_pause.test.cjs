const test=require('node:test'),assert=require('node:assert/strict'),R=require('../js/side_rules.js');
for(const config of [{lifecycleVersion:2},{integrationMinutes:0},{integrationMinutes:60}])test('pause blocks persistence, preserves review and remaining: '+JSON.stringify(config),()=>{
 const runtime={round:2,phase:'decisions',status:'paused',running:false,remaining:137};
 const access=R.gameAccess(config,{active:true},runtime,true,Date.now());
 assert.equal(access.canOperate,false);assert.equal(access.canReview,true);assert.equal(access.remaining,137);assert.equal(access.paused,true);
 runtime.status='running';runtime.running=true;
 if(config.lifecycleVersion===2)assert.equal(R.gameAccess(config,{active:true},runtime,true).canOperate,true);
});
test('cancellation has priority over paused review',()=>{assert.equal(R.gameAccess({lifecycleVersion:2,cancelledAt:'2026-10-21'},{},{status:'paused'},true).canReview,undefined);});

test('authoritative decisions stop accepting edits at their deadline before the next server refresh',()=>{
 const start=Date.parse('2026-10-22T12:00:00Z'),runtime={round:1,phase:'decisions',status:'running',running:true,startedAt:new Date(start).toISOString(),duration:60,remaining:60};
 assert.equal(R.gameAccess({lifecycleVersion:2},{},runtime,true,start+59999).canOperate,true);
 const expired=R.gameAccess({lifecycleVersion:2},{},runtime,true,start+60000);
 assert.equal(expired.canOperate,false);assert.equal(expired.canReview,true);assert.match(expired.reason,/tiempo del ciclo terminó/);
 runtime.status='paused';runtime.running=false;assert.equal(R.gameAccess({lifecycleVersion:2},{},runtime,true,start+120000).paused,true);
 runtime.status='running';runtime.running=true;runtime.startedAt=new Date(start+120000).toISOString();assert.equal(R.gameAccess({lifecycleVersion:2},{},runtime,true,start+121000).canOperate,true);
});
