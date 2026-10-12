const test=require('node:test'),assert=require('node:assert/strict'),RULES=require('../js/side_rules.js');
const config={lifecycleVersion:2,cycleCloseMode:'manual',cycles:3,roundHours:0,roundMinutes:5,gameStartAt:'2026-10-11T12:00:00Z',runtime:{round:1,phase:'integration'}};
test('la clave cancelledAt nula o falsa no cancela ni congela el inicio',()=>{
 for(const value of [null,false,0,'','false','0','null','   ']){
  const c={...config,cancelledAt:value};const r=RULES.resolveRuntime(c,Date.parse(config.gameStartAt)+1000);
  assert.equal(r.phase,'decisions',String(value));assert.equal(RULES.gameAccess(c,{cancelledAt:value},r).cancelled,undefined);
 }
});
test('una marca real y cualquiera de las fases canceladas siguen bloqueando acceso',()=>{
 for(const c of [{...config,cancelledAt:'2026-10-11T12:00:00Z'},{...config,phase:'cancelled'},{...config,runtime:{phase:'cancelled'}}]){
  assert.equal(RULES.gameAccess(c,{},c.runtime).cancelled,true);
  assert.equal(RULES.gameAccess(c,{},c.runtime).canJoin,false);
 }
});
