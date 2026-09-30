import test from 'node:test';
import assert from 'node:assert/strict';
import {npcGridTriangles} from '../services/npc_navmesh_grid.mjs';

test('city navmesh grid excludes solid colliders and applies the hub offset',()=>{
  const mesh=npcGridTriangles({bounds:{minX:-6,maxX:6,minZ:-6,maxZ:6},offsetX:150,
    obstacles:[{minX:149,maxX:151,minZ:-1,maxZ:1}],cellSize:1});
  assert.equal(mesh.stats.cells,144);
  assert.equal(mesh.stats.blocked,16);
  assert.equal(mesh.stats.walkable,128);
  assert.equal(mesh.stats.triangles,256);
  assert.equal(mesh.positions[0],144);
  assert.equal(mesh.positions.at(-3),156);
  assert.ok(mesh.indices.every(index=>index<mesh.positions.length/3));
});

test('grid rejects excessive density before allocating geometry',()=>{
  assert.throws(()=>npcGridTriangles({bounds:{minX:-100,maxX:100,minZ:-100,maxZ:100},cellSize:.5}),RangeError);
});
