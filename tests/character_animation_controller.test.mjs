import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CharacterAnimationController,
  CHARACTER_ANIMATION_STATES,
  CHARACTER_ANIMATION_PROVIDERS,
  createNpcMotionAdapter
} from '../services/character_animation_controller.mjs';

class MockAction{
  constructor(clip){this.clip=clip;this.calls=[];this.timeScale=1}
  getClip(){return this.clip}
  reset(){this.calls.push(['reset']);return this}
  play(){this.calls.push(['play']);return this}
  stop(){this.calls.push(['stop']);return this}
  fadeIn(duration){this.calls.push(['fadeIn',duration]);return this}
  fadeOut(duration){this.calls.push(['fadeOut',duration]);return this}
  crossFadeFrom(action,duration,warp){this.calls.push(['crossFadeFrom',action.clip.name,duration,warp]);return this}
  setEffectiveWeight(value){this.calls.push(['weight',value]);return this}
  setEffectiveTimeScale(value){this.timeScale=value;this.calls.push(['timeScale',value]);return this}
}
class MockMixer{
  constructor(){this.actions=new Map();this.updates=[];this.root={name:'avatar'};this.uncached=[]}
  clipAction(clip){if(!this.actions.has(clip))this.actions.set(clip,new MockAction(clip));return this.actions.get(clip)}
  update(dt){this.updates.push(dt)}
  getRoot(){return this.root}
  uncacheAction(clip,root){this.uncached.push([clip.name,root.name])}
  uncacheRoot(root){this.uncachedRoot=root}
  stopAllAction(){this.stopped=true}
}
const clips=()=>[
  {name:'Standing Idle'},
  {name:'Walking'},
  {name:'Running'},
  {name:'Talking'},
  {name:'Jump'}
];

test('central states use smooth mixer crossfades without restarting the active state',()=>{
  const mixer=new MockMixer(),controller=new CharacterAnimationController({mixer,clips:clips(),fadeDuration:.3});
  assert.equal(controller.playIdle(),true);
  const idle=controller.activeAction,idleResetCount=idle.calls.filter(([name])=>name==='reset').length;
  assert.equal(controller.playIdle(),true);
  assert.equal(idle.calls.filter(([name])=>name==='reset').length,idleResetCount);
  assert.equal(controller.playWalk(1.45),true);
  assert.deepEqual(controller.activeAction.calls.find(([name])=>name==='crossFadeFrom'),['crossFadeFrom','Standing Idle',.3,true]);
  assert.equal(controller.getSnapshot().state,CHARACTER_ANIMATION_STATES.WALK);
});

test('walk and run playback rates follow real speed within safe bounds',()=>{
  const controller=new CharacterAnimationController({mixer:new MockMixer(),clips:clips()});
  controller.playWalk(1.325);assert.equal(controller.activeAction.timeScale,.65);
  controller.update(1/60,{speed:4,grounded:true});
  assert.equal(controller.state,CHARACTER_ANIMATION_STATES.RUN);
  assert.ok(Math.abs(controller.activeAction.timeScale-4/5.2)<1e-12);
  controller.update(1/60,{speed:20,grounded:true});assert.equal(controller.activeAction.timeScale,1.45);
});

test('update owns locomotion, talk, interaction and airborne decisions and advances one mixer',()=>{
  const mixer=new MockMixer();
  const wave={name:'Wave'};
  const controller=new CharacterAnimationController({mixer,clips:clips(),interactions:{wave}});
  controller.update(1/60,{speed:0});assert.equal(controller.state,'IDLE');
  controller.update(1/60,{speed:1});assert.equal(controller.state,'WALK');
  controller.update(1/60,{speed:3.3});assert.equal(controller.state,'RUN');
  controller.update(1/60,{speed:0,talking:true});assert.equal(controller.state,'TALK');
  controller.update(1/60,{interaction:'wave'});assert.equal(controller.state,'INTERACTION');
  controller.update(1/60,{grounded:false});assert.equal(controller.state,'AIRBORNE');
  assert.equal(mixer.updates.length,6);
});

test('an explicit player locomotion state keeps WALK and RUN synchronized with movement physics',()=>{
  const controller=new CharacterAnimationController({mixer:new MockMixer(),clips:clips()});
  controller.update(1/60,{speed:2.65,state:'WALK',grounded:true});
  assert.equal(controller.state,'WALK');
  assert.equal(controller.activeAction.timeScale,1);
  controller.update(1/60,{speed:5.2,state:'RUN',grounded:true});
  assert.equal(controller.state,'RUN');
  assert.equal(controller.activeAction.timeScale,1);
});

test('npc_motion adapter is a non-blocking procedural fallback and creates no loop',()=>{
  const frames=[],group={name:'Miguel'},resets=[];
  const adapter=createNpcMotionAdapter({
    group,
    animateNpc:(target,dt,moving)=>frames.push([target,dt,moving]),
    resetMotion:target=>resets.push(target)
  });
  const fallbacks=[];
  const controller=new CharacterAnimationController({fallback:adapter,hooks:{onFallback:event=>fallbacks.push(event)}});
  controller.update(1/60,{speed:1});
  controller.update(1/60,{speed:0,talking:true});
  assert.deepEqual(frames.map(([,dt,moving])=>[dt,moving]),[[1/60,true],[1/60,false]]);
  assert.equal(controller.getSnapshot().fallback,true);
  assert.equal(fallbacks[0].reason,'missing-clip');
  assert.equal(controller.metadata.fallback.name,'SIDE npc_motion');
  controller.dispose();assert.deepEqual(resets,[group]);
});

test('a missing animation keeps the prior valid action when there is no fallback',()=>{
  const events=[],controller=new CharacterAnimationController({
    mixer:new MockMixer(),clips:{IDLE:{name:'Idle'}},hooks:{onFallback:event=>events.push(event)}
  });
  controller.playIdle();const action=controller.activeAction;
  assert.equal(controller.playRun(4),false);
  assert.equal(controller.state,'IDLE');assert.equal(controller.activeAction,action);
  assert.equal(events.at(-1).reason,'missing-clip-no-adapter');
});

test('dispose releases mixer bindings once and exposes asset provenance metadata',()=>{
  const mixer=new MockMixer(),disposed=[];
  const controller=new CharacterAnimationController({mixer,clips:clips(),hooks:{onDispose:event=>disposed.push(event)}});
  controller.playIdle();controller.dispose();controller.dispose();
  assert.equal(mixer.stopped,true);assert.equal(mixer.uncachedRoot,mixer.root);
  assert.equal(disposed.length,1);
  assert.equal(controller.metadata.provider.repository,CHARACTER_ANIMATION_PROVIDERS.motionCapture.repository);
  assert.equal(controller.metadata.provider.bundledAssets,false);
});
