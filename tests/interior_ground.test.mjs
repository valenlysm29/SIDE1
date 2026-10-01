import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/build/three.module.js';
import {createBusinessInteriors} from '../services/business_interiors.mjs';
import {characterTargetHeight,normalizeCharacterGeometry,anchorCharacterToGround} from '../services/character_geometry.mjs';

globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})})};
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<.001,`${actual} != ${expected}`);

test('interior ground queries use the floor geometry world matrix, including translated parents',()=>{
  const scene=new THREE.Scene(),parent=new THREE.Group();scene.add(parent);
  const interiors=createBusinessInteriors({scene:parent});
  try{
    assert.equal(typeof interiors.groundHeightAt,'function');
    near(interiors.groundHeightAt(131,19),.025);
    parent.position.set(8,-.125,-3);interiors.group.position.y=.06;
    near(interiors.groundHeightAt(139,16),-.04);
    assert.equal(interiors.groundHeightAt(150,0),null,'plaza must use the exterior resolver');
    parent.position.y=.7;
    near(interiors.groundHeightAt(139,16),.785);
  }finally{interiors.dispose()}
});

test('rotated scaled floors match a rendered floor raycast instead of a constant local height',()=>{
  const parent=new THREE.Group(),interiors=createBusinessInteriors({scene:parent});
  try{
    assert.equal(typeof interiors.groundHeightAt,'function');
    parent.position.set(-11,.32,4);parent.rotation.set(.08,.4,-.05);parent.scale.set(1.2,.9,1.1);
    const floor=interiors.group.children.find(object=>object.isInstancedMesh&&object.material.color.getHex()===0xaaa99e);
    assert.ok(floor,'rendered store floor batch');
    parent.updateMatrixWorld(true);
    const center=interiors.group.localToWorld(new THREE.Vector3(-19,.025,19));
    const ray=new THREE.Raycaster(new THREE.Vector3(center.x,100,center.z),new THREE.Vector3(0,-1,0));
    const hit=ray.intersectObject(floor,false)[0];assert.ok(hit);
    near(interiors.groundHeightAt(center.x,center.z),hit.point.y);
  }finally{interiors.dispose()}
});

test('normalized NPC feet stay within one centimetre of all six transformed interior floors for sixty seconds',()=>{
  const parent=new THREE.Group(),interiors=createBusinessInteriors({scene:parent});
  try{
    assert.equal(typeof interiors.groundHeightAt,'function');
    parent.position.set(0,-.125,0);
    for(const room of interiors.rooms)interiors.ensureRoom(room);
    const actors=interiors.rooms.map(room=>{
      const object=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(.5,2,.3));body.position.y=.8;object.add(body);
      normalizeCharacterGeometry(THREE,object,characterTargetHeight('npc'));
      room.detail.add(object);object.position.set(room.layout.x,0,room.layout.z);
      return object;
    });
    for(let frame=0;frame<3600;frame++)for(const actor of actors){
      const position=actor.getWorldPosition(new THREE.Vector3()),floor=interiors.groundHeightAt(position.x,position.z);
      assert.ok(Number.isFinite(floor));
      anchorCharacterToGround(actor,floor,actor.parent.getWorldPosition(new THREE.Vector3()).y);
      parent.updateMatrixWorld(true);
      const feet=new THREE.Box3().setFromObject(actor.userData.characterPivot,true).min.y;
      assert.ok(Math.abs(feet-floor)<=.01,'feet detached from the transformed rendered floor');
    }
  }finally{interiors.dispose()}
});
