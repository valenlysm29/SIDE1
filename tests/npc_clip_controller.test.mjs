import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyNpcClip,indexNpcClips,rootMotionSpeed,createNpcClipController} from '../services/npc_clip_controller.mjs';

function fakeMixer(){
  const actions=new Map(),updates=[];
  return {actions,updates,clipAction(clip){
    const action={clip,played:0,fade:null,scale:1,play(){this.played++},reset(){},setEffectiveWeight(){},fadeIn(seconds){this.fade=seconds},crossFadeFrom(previous,seconds){this.fade=seconds;this.previous=previous},setEffectiveTimeScale(value){this.scale=value},stop(){}};
    actions.set(clip.name,action);return action;
  },update(dt){updates.push(dt)}};
}

test('clip catalogue distinguishes the second idle and optional work actions',()=>{
  assert.equal(classifyNpcClip('Idle_02'),'idle2');
  assert.equal(classifyNpcClip('Picking Up Box'),'pickup');
  assert.equal(classifyNpcClip('HumanArmature|Female_Idle'),'idle');
  assert.equal(classifyNpcClip('HumanArmature|Man_Walk'),'walk');
  assert.equal(classifyNpcClip('HumanArmature|Man_Run'),'run');
  const catalog=indexNpcClips([{name:'Idle'},{name:'Idle_02'},{name:'Walking'},{name:'Carry Box'}]);
  assert.deepEqual(Object.keys(catalog),['idle','idle2','walk','carry']);
});

test('actual post-collision distance controls walk clip timing with a 0.2-second fade',()=>{
  const mixer=fakeMixer();
  const controller=createNpcClipController({mixer,clips:[{name:'Idle'},{name:'Walk'},{name:'Run'}],clipSpeeds:{walk:1,run:3}});
  controller.update(.1,{distance:0});
  controller.update(.1,{distance:.1});
  assert.equal(controller.state,'walk');
  assert.equal(mixer.actions.get('Walk').fade,.2);
  assert.equal(mixer.actions.get('Walk').scale,1);
  controller.update(.1,{distance:.15});
  assert.ok(Math.abs(mixer.actions.get('Walk').scale-1.5)<1e-9);
  controller.update(.1,{distance:0});
  assert.equal(controller.state,'idle');
  assert.deepEqual(controller.retargeted,[]);
});

test('root translation yields reference speed; in-place clip remains unknown',()=>{
  assert.equal(rootMotionSpeed({duration:2,tracks:[{name:'Hips.position',values:[0,0,0,0,0,3]}]}),1.5);
  assert.equal(rootMotionSpeed({duration:2,tracks:[{name:'Hips.position',values:[0,0,0,0,0,0]}]}),null);
});
