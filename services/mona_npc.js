/* Local model adapter: Mona is an unrigged character, not a walking avatar. */
export async function loadMonaTemplate(THREE, GLTFLoader, config) {
  const gltf = await new GLTFLoader().loadAsync(config.model);
  if (!gltf.scene) throw new Error('El archivo de Mona no contiene una escena.');
  const avatar = gltf.scene;
  avatar.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(avatar);
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0) throw new Error('El modelo de Mona no tiene altura válida.');
  const scale = config.height / size.y;
  const center = bounds.getCenter(new THREE.Vector3());
  avatar.scale.multiplyScalar(scale);
  avatar.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  avatar.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    // Rebuilds remove instances, but must keep the cached template's resources.
    node.userData.sharedCharacterResource = true;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      for (const key of ['map', 'normalMap', 'metalnessMap', 'roughnessMap']) {
        if (material?.[key]) material[key].anisotropy = 4;
      }
    }
  });
  return { scene: avatar, height: config.height, animations: gltf.animations.length };
}

export function createMonaNpc(THREE, template, config) {
  const group = new THREE.Group();
  group.name = 'Mona';
  group.add(template.scene.clone(true));
  group.position.set(config.position.x, 0, config.position.z);
  group.rotation.y = config.rotationY || 0;
  group.userData = {modelKind:'mona', npcId:'mona', role:'guide', height:template.height};
  return group;
}
