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

test('office, bank, cashier, supplier and guard roles select only assigned outfits',()=>{
  const rows=[
    {...model('suit'),rol:'tienda',roles:['oficina','banco','guardia']},
    {...model('formal'),rol:'tienda',roles:['banco','cajero']},
    {...model('worker'),rol:'almacen',roles:['proveedor']}
  ];
  const roster=createCityRoster(rows,{random:()=>.2});
  assert.equal(roster.draw('bank','guardia').model.id,'suit');
  assert.equal(roster.draw('bank','cajero').model.id,'formal');
  assert.equal(roster.draw('depot','proveedor').model.id,'worker');
  assert.equal(roster.draw('office','oficina').model.id,'suit');
  assert.equal(validCityManifest([{...model('bad'),roles:['fantasy']}]).length,0);
});
