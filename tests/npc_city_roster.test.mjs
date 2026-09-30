import test from 'node:test';
import assert from 'node:assert/strict';
import {createCityRoster,validCityManifest} from '../services/npc_city_roster.mjs';

const model=id=>({id,nombre:id,genero:'mujer',rol:'cliente',archivo:`assets/models/npc/${id}.glb`,altura:1.7,licencia:'CC0'});

test('city roster draws without replacement until its role pool is exhausted',()=>{
  const roster=createCityRoster([model('a'),model('b'),model('c')],{random:()=>.3});
  const first=[roster.draw('hub','cliente'),roster.draw('hub','cliente'),roster.draw('hub','cliente')];
  assert.equal(new Set(first.map(draw=>draw.model.id)).size,3);
  assert.ok(first.every(draw=>!draw.repeated));
  const fourth=roster.draw('hub','cliente');
  assert.equal(fourth.repeated,true);
  assert.ok(fourth.heightScale>=.96&&fourth.heightScale<=1.04);
});

test('scene pools are independent and player avatars are rejected',()=>{
  const rows=[model('a'),model('b'),model('chico1')];
  assert.deepEqual(validCityManifest(rows).map(row=>row.id),['a','b']);
  const roster=createCityRoster(rows,{random:()=>.5});
  assert.equal(roster.draw('hub','cliente').model.id,roster.draw('store','cliente').model.id);
});

test('unlicensed entries and unsupported roles cannot enter the roster',()=>{
  assert.equal(validCityManifest([{...model('a'),licencia:'unknown'},{...model('b'),rol:'fantasy'}]).length,0);
  assert.equal(validCityManifest([{...model('local'),licencia:'Mixamo',privado:true,archivo:'assets/models/npc/private/local.glb'}]).length,1);
});
