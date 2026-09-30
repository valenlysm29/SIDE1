import test from 'node:test';
import assert from 'node:assert/strict';
import {planNpcStreaming} from '../services/npc_streaming.mjs';

const row=(id,rol,roles=[])=>({id,nombre:id,rol,roles,altura:1.7,licencia:'CC0',archivo:`assets/models/npc/${id}.glb`,bytes:500_000});

test('low tier loads four nearby-role models and protects active clones from eviction',()=>{
  const rows=[row('customer1','cliente'),row('customer2','cliente'),row('cashier','tienda',['cajero']),row('banker','tienda',['banco']),row('guard','tienda',['guardia']),row('supplier','almacen',['proveedor'])];
  const plan=planNpcStreaming(rows,{tier:'low',zone:'banco',loadedIds:['customer1','customer2','supplier'],busyIds:['customer2']});
  assert.equal(plan.cap,4);
  assert.deepEqual(new Set(plan.desired.map(item=>item.id)),new Set(['banker','cashier','guard','customer1']));
  assert.deepEqual(new Set(plan.load.map(item=>item.id)),new Set(['banker','cashier','guard']));
  assert.deepEqual(plan.evictCandidates,['supplier']);
});

test('high tier retains all approved models; invalid licenses never enter a load plan',()=>{
  const rows=[row('a','cliente'),row('b','tienda'),{...row('bad','cliente'),licencia:'unknown'}];
  const plan=planNpcStreaming(rows,{tier:'high',zone:'tienda'});
  assert.equal(plan.desired.length,2);
  assert.ok(plan.desired.every(item=>item.id!=='bad'));
});
