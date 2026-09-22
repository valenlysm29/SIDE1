const test=require('node:test'),assert=require('node:assert/strict'),R=require('../side_rules.js');
const start=Date.parse('2026-09-22T12:00:00Z');
const config={integrationMinutes:60,cycles:3,roundHours:0,roundMinutes:10,cycleCloseMode:'manual',gameStartedAt:new Date(start).toISOString()};
test('integration is cycle 1 and counts toward the configured total',()=>{
  const p=R.cycleSchedule({...config,scheduledStart:config.gameStartedAt});
  assert.equal(p.cycles.length,3);assert.equal(p.total,80*60000);
  assert.equal(R.schedulePosition(p,start+3600000).round,2);
});
test('admission only during the first hour; returning companies may rejoin',()=>{
  const status={active:true,startedAt:config.gameStartedAt},r={round:1,status:'running'};
  assert.equal(R.gameAccess(config,{},r,false,start).canJoin,false);
  assert.equal(R.gameAccess(config,status,r,false,start-1).canJoin,false);
  assert.equal(R.gameAccess(config,status,r,false,start).canJoin,true);
  assert.equal(R.gameAccess(config,status,r,false,start+3599999).canOperate,false);
  assert.equal(R.gameAccess(config,status,{round:2},true,start+3599999).canOperate,false);
  assert.equal(R.gameAccess(config,status,r,false,start+3600000).canJoin,false);
  assert.equal(R.gameAccess(config,status,{round:2},true,start+3600000).canJoin,true);
  assert.equal(R.gameAccess(config,status,{round:2},false,start+3600000).canOperate,true);
  assert.equal(R.gameAccess(config,{active:false,finishedAt:config.gameStartedAt},{round:3},true,start+5000000).canOperate,false);
});
test('automatic schedule cannot start before activation and closes after its last cycle',()=>{
  const c={...config,cycleCloseMode:'automatic',scheduledStart:config.gameStartedAt};
  assert.equal(R.gameAccess(c,{}, {},false,start+3600000).canOperate,false);
  assert.equal(R.gameAccess(c,{active:true},{},false,start-1).canJoin,false);
  assert.equal(R.gameAccess(c,{active:true},{},true,start+3600000).round,2);
  assert.equal(R.gameAccess(c,{active:true},{},true,start+80*60000).canOperate,false);
});
test('podium expires exactly 24 hours after publication and belongs to its game',()=>{
  const p={publishedAt:new Date(start).toISOString(),code:'SIDE-TEST'};
  assert.equal(R.podiumVisible(p,'SIDE-TEST',start+86400000-1),true);
  assert.equal(R.podiumVisible(p,'SIDE-TEST',start+86400000),false);
  assert.equal(R.podiumVisible(p,'SIDE-OTHER',start),false);
  assert.equal(R.podiumVisible({publishedAt:'invalid'},'SIDE-TEST',start),false);
});
