'use strict';
// Exercise the rendered, skinned models: a mathematical gait alone cannot catch
// ankle slip caused by skeleton transforms while the actor turns.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.SIDE_TEST_URL||'http://127.0.0.1:8772/';
const output=path.join(__dirname,'output/npcs');fs.mkdirSync(output,{recursive:true});

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
    await page.goto(base+'tools/npc_preview.html?manual');
    await page.waitForFunction(()=>window.ready||window.previewError,null,{timeout:60000});
    assert.equal(await page.evaluate(()=>window.previewError),undefined);
    const results=await page.evaluate(()=>preview.actors.map(actor=>{
      const m=actor.userData.motion;
      actor.position.set(0,0,0);actor.rotation.y=0;
      preview.resetMotion(actor);preview.animateNpc(actor,1/60,false);
      let maxSupportSlip=0,maxAnkleJump=0,maxSwingHeight=0;const previous={};
      for(let i=0;i<360;i++){
        // Straight acceleration into a continuous turn, then out again.
        const turnRate=i>90&&i<270?.65:0;
        actor.rotation.y+=turnRate/60;
        actor.position.x+=Math.sin(actor.rotation.y)/60;
        actor.position.z+=Math.cos(actor.rotation.y)/60;
        preview.animateNpc(actor,1/60,true);
        for(const [side,offset] of [['L',0],['R',.5]]){
          const foot=m.bones['Foot'+side],v=foot.getWorldPosition(foot.position.clone()),phase=(m.phase+offset)%1;
          if(i>90&&previous[side]){
            const delta=Math.hypot(v.x-previous[side].x,v.y-previous[side].y,v.z-previous[side].z);
            maxAnkleJump=Math.max(maxAnkleJump,delta);
            if(phase>.04&&phase<.55&&previous[side].phase<phase)maxSupportSlip=Math.max(maxSupportSlip,delta);
          }
          maxSwingHeight=Math.max(maxSwingHeight,v.y-m.profile.ankle*m.profile.height);
          previous[side]={x:v.x,y:v.y,z:v.z,phase};
        }
      }
      // A recycled actor must not retain a planted foot at its old world location.
      const phaseBefore=m.phase,distanceBefore=m.distance;
      actor.position.set(50,0,-20);preview.animateNpc(actor,1/60,false);
      const teleport={phaseStable:m.phase===phaseBefore,distanceStable:m.distance===distanceBefore};
      for(let i=0;i<120;i++)preview.animateNpc(actor,1/60,false);
      const idle={blend:m.blend,knee:Math.abs(m.bones.ShinL.rotation.x),head:m.bones.Head.rotation.y};
      let pivotLift=0;
      for(let i=0;i<120;i++){
        actor.rotation.y+=1.5/60;preview.animateNpc(actor,1/60,false);
        for(const side of ['L','R']){
          const foot=m.bones['Foot'+side],v=foot.getWorldPosition(foot.position.clone());
          pivotLift=Math.max(pivotLift,v.y-m.profile.ankle*m.profile.height);
        }
      }
      const finite=Object.values(m.bones).every(b=>[...b.position.toArray(),...b.quaternion.toArray()].every(Number.isFinite));
      return {kind:actor.userData.modelKind,maxSupportSlip,maxAnkleJump,maxSwingHeight,teleport,idle,pivotLift,finite};
    }));
    for(const result of results){
      assert.ok(result.maxSupportSlip<.003,`${result.kind}: stance foot slides through a turn`);
      assert.ok(result.maxAnkleJump<.075,`${result.kind}: ankle pops between phases`);
      assert.ok(result.maxSwingHeight>.055,`${result.kind}: swinging foot must clear the floor`);
      assert.ok(result.pivotLift>.025,`${result.kind}: turning in place must take steps`);
      assert.ok(result.teleport.phaseStable&&result.teleport.distanceStable,`${result.kind}: teleport advances walking`);
      assert.ok(result.idle.blend<.001&&result.idle.knee<.001,`${result.kind}: stop must settle into rest`);
      assert.ok(result.finite,`${result.kind}: invalid skeleton transform`);
    }
    await page.evaluate(()=>{
      preview.actors.forEach((actor,i)=>{actor.position.set((i-1.5)*1.05,0,0);actor.rotation.y=0;preview.resetMotion(actor)});
      for(let i=0;i<98;i++)preview.step(1/60,.95,false);
      preview.rotate(.36);preview.renderer.render(preview.scene,preview.camera);
    });
    await page.screenshot({path:path.join(output,'walk-three-quarter.png')});
    // A closer profile image reveals leg clearance and arm/leg opposition.
    await page.goto(base+'tools/npc_preview.html?manual&model=chico1');
    await page.waitForFunction(()=>window.ready,null,{timeout:60000});
    await page.evaluate(()=>{for(let i=0;i<105;i++)preview.step(1/60,.95,false);preview.rotate(Math.PI/2);preview.renderer.render(preview.scene,preview.camera)});
    await page.screenshot({path:path.join(output,'walk-side.png')});
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'locomotion.json'),JSON.stringify(results,null,2));
    console.log('PASS NPC planted feet through turns, swing clearance, pivot steps, stop and pool reset');
    console.log(JSON.stringify(results,null,2));
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
