import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/build/three.module.js';
import { createHubVehicles } from '../services/hub_vehicles.js';

test('five city cars reuse geometry and batch body panels without losing wheel transforms', () => {
  const group = new THREE.Group();
  const fleet = createHubVehicles({ group, colliders: [] }, 150);
  const geometries = new Set();
  let meshes = 0, instances = 0;
  group.traverse(object => {
    if (!object.isMesh) return;
    meshes++;
    geometries.add(object.geometry);
    if (object.isInstancedMesh) instances += object.count;
    assert.ok(object.geometry.boundingSphere || !object.isInstancedMesh, 'instanced bounds support frustum culling');
  });
  assert.equal(fleet.cars.length, 5);
  assert.equal(geometries.size, 3, 'box, cabin and tires are shared by the entire fleet');
  assert.ok(meshes <= 70, `fleet uses ${meshes} batches`);
  assert.ok(instances > 100, 'panels and rims retain their full geometry');
  for (const car of fleet.cars) {
    assert.equal(car.wheels.length, 4);
    assert.equal(car.wheels.filter(wheel => wheel.front).length, 2);
    assert.ok(car.wheels.every(wheel => wheel.spin.children.length === 2));
  }
  const parked = { x: fleet.cruiser.x, z: fleet.cruiser.z, yaw: fleet.cruiser.yaw };
  fleet.update(.016, { active: null, input: {}, player: { x: 150, z: 0 }, people: [], bounds: { minX: 108, maxX: 192, minZ: -42, maxZ: 42 } });
  assert.deepEqual({ x: fleet.cruiser.x, z: fleet.cruiser.z, yaw: fleet.cruiser.yaw }, parked);
  const emissions = fleet.cars.map(car => car.rear);
  assert.equal(new Set(emissions).size, 5, 'each car keeps independent braking lights');
  let disposed = 0;
  for (const geometry of geometries) geometry.addEventListener('dispose', () => disposed++);
  fleet.dispose();
  assert.equal(group.children.length, 0);
  assert.equal(disposed, 3, 'shared geometries are disposed once');
});
