'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');

function runtime(){
  let allowed=true,hidden=false,scheduled=0,renders=0,transactions=0;
  const context={window:{SIDE_GAME_BRIDGE:{canOperate:()=>allowed}},performance:{now:()=>1000},
    document:{hidden:false,getElementById:id=>id==='simulator3d'?{classList:{contains:()=>hidden}}:null,exitPointerLock(){}},
    localStorage:{getItem:()=>null},clearTimeout(){},clearInterval(){},requestAnimationFrame(){scheduled++;return scheduled}};
  const source=fs.readFileSync(path.join(__dirname,'../js/simulator3d.js'),'utf8').replace('  window.SIDE3D = {',`  window.runtimeQA={
    start(){initialized=true;running=true;sessionContext=storageContext();gameSession={shiftEnded:false};clock={getDelta:()=>.016};renderer={render:()=>window.rendered()};},
    context:syncSessionContext, frame, suspend,
    pauseVisible(){running=false;updateHUD=()=>{};},
    engine(ctx,enabled=true){audioCtx=ctx;audioEnabled=enabled;driving={speed:8};running=true;updateVehicleAudio();},
    automation(active,ended){running=active;gameSession={shiftEnded:ended};animatedActors=[];updateTraffic=()=>{};salesStaff=()=>2;restockDisplays=()=>window.transacted();hasManager=()=>false;animateActors(100, .016);},
    state:()=>({running,session:gameSession,keys,jumpQueued,speed:player.speed}),
    input(){keys={KeyW:true};jumpQueued=true;player.vx=2;player.speed=2;}
  };\n  window.SIDE3D = {`);
  context.window.rendered=()=>renders++;context.window.transacted=()=>transactions++;
  vm.runInNewContext(source,context);
  return {qa:context.window.runtimeQA,allow:v=>allowed=v,hide:v=>hidden=v,stats:()=>({scheduled,renders,transactions})};
}

test('same-round closure suspends the world before a transaction can run',()=>{
  const r=runtime();r.hide(true);r.qa.start();r.allow(false);r.qa.context();
  assert.equal(r.qa.state().running,false);assert.equal(r.qa.state().session,null);
});
test('a hidden world schedules a wakeup without rendering or operating',()=>{
  const r=runtime();r.hide(true);r.qa.start();r.qa.frame();
  assert.deepEqual(r.stats(),{scheduled:1,renders:0,transactions:0});
});
test('idle animation does not replenish stock during pause or after shift end',()=>{
  const r=runtime();r.qa.automation(false,false);r.qa.automation(true,true);
  assert.equal(r.stats().transactions,0);r.qa.automation(true,false);assert.equal(r.stats().transactions,1);
});
test('suspension clears held keys, queued jump and velocity',()=>{
  const r=runtime();r.qa.start();r.qa.input();r.qa.suspend();
  const s=r.qa.state();assert.equal(s.running,false);assert.equal(s.speed,0);assert.equal(s.jumpQueued,false);assert.equal(Object.keys(s.keys).length,0);
});
test('visible pause draws once and then leaves physics, NPCs and GPU idle',()=>{
  const r=runtime();r.qa.start();r.qa.pauseVisible();r.qa.frame();r.qa.frame();r.qa.frame();
  assert.deepEqual(r.stats(),{scheduled:3,renders:1,transactions:0});
});
test('vehicle audio reuses one voice and disconnects it when muted',()=>{
  let created=0,stopped=0,disconnected=0;
  const node=()=>({connect(){return this;},disconnect(){disconnected++;},frequency:{value:0,setTargetAtTime(){}},gain:{value:0,setTargetAtTime(){}}});
  const ctx={state:'running',currentTime:0,createOscillator(){created++;return {...node(),start(){},stop(){stopped++;}};},createBiquadFilter:node,createGain:node};
  const r=runtime();r.qa.engine(ctx);r.qa.engine(ctx);
  assert.equal(created,1);r.qa.engine(ctx,false);assert.equal(stopped,1);assert.equal(disconnected,3);
});
