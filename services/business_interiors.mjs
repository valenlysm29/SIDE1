import * as THREE from '../vendor/three/build/three.module.js';

// Metres, on the same street grid as the city. No interior scene or spawn map.
export const BUSINESS_LAYOUTS = Object.freeze([
  { id: 'store', name: 'Tienda SIDE', x: -19, z: 19, width: 16, depth: 10, height: 4.6, doorX: -19, doorZ: 24, doorWidth: 2.8 },
  { id: 'warehouse', name: 'Almacén SIDE', x: -20.5, z: -19, width: 15, depth: 14, height: 6.6, doorX: -20, doorZ: -12, doorWidth: 3.6 },
  { id: 'production', name: 'Producción SIDE', x: 20, z: -19, width: 16, depth: 14, height: 6.4, doorX: 20, doorZ: -12, doorWidth: 2.8 }
].map(Object.freeze));

export function getBusinessZones(offsetX = 150) {
  return BUSINESS_LAYOUTS.map(b => ({ id: b.id, name: b.name,
    minX: b.x + offsetX - b.width / 2, maxX: b.x + offsetX + b.width / 2,
    minZ: b.z - b.depth / 2, maxZ: b.z + b.depth / 2, ceilingY: b.height }));
}

export function stockVisualLevel(ratio) {
  const value = Number(ratio);
  return Number.isFinite(value) ? Math.min(4, Math.max(0, Math.ceil(value * 4))) : 0;
}

/** Presentation only: snapshot comes from the existing SIDE business model. */
export function createBusinessInteriors({ scene, offsetX = 150, createNpc, animateNpc } = {}) {
  const group = new THREE.Group(); group.name = 'SIDE connected businesses'; group.position.x = offsetX;
  scene?.add(group);
  const resources = new Set(), colliders = [], hotspots = [], rooms = [], animated = [];
  const zones = getBusinessZones(offsetX);
  const geometry = new THREE.BoxGeometry(1, 1, 1); resources.add(geometry);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12); resources.add(cylinder);
  const scratch = new THREE.Object3D();
  const material = (color, extra = {}) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness: .78, ...extra }); resources.add(value); return value;
  };
  const m = {
    plaster: material(0xd4d2c7), concrete: material(0x939890, { roughness: .96 }), floor: material(0xaaa99e, { roughness: .89 }),
    grout: material(0x8e928b, { roughness: .98 }),
    steel: material(0x687b82, { metalness: .72, roughness: .39 }), dark: material(0x203139, { metalness: .35, roughness: .58 }),
    mint: material(0x739f96), orange: material(0xbf823e), white: material(0xeae6da), wood: material(0x9a7450, { roughness: .92 }),
    leather: material(0x755246, { roughness: .64 }), tan: material(0xaf8b60, { roughness: .71 }), black: material(0x22282a),
    carton: material(0xae8e65, { roughness: .98 }), tape: material(0xd4b181), yellow: material(0xd2b148),
    glass: material(0x94b2b4, { transparent: true, opacity: .19, roughness: .14, metalness: .1, depthWrite: false }),
    light: material(0xf1f2e4, { emissive: 0xf1efce, emissiveIntensity: 1.1 }),
    screen: material(0x254c55, { emissive: 0x447b84, emissiveIntensity: .55 }),
    green: material(0x6fb388, { emissive: 0x45955e, emissiveIntensity: .6 })
  };

  function collider(x, z, w, d, kind, zone) {
    const value = { minX: offsetX + x - w / 2, maxX: offsetX + x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, kind, zone };
    colliders.push(value); return value;
  }
  function batchBuilder(parent) {
    const batches = new Map();
    function shape(geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
      scratch.position.set(x, y, z); scratch.rotation.set(rx, ry, rz); scratch.scale.set(sx, sy, sz); scratch.updateMatrix();
      const key = `${geo.uuid}:${mat.uuid}`;
      if (!batches.has(key)) batches.set(key, { geo, mat, matrices: [] });
      batches.get(key).matrices.push(scratch.matrix.clone());
    }
    return {
      box: (x, y, z, w, h, d, mat, yaw = 0) => shape(geometry, mat, x, y, z, w, h, d, 0, yaw),
      cyl: (x, y, z, r, h, mat, rx = 0, rz = 0) => shape(cylinder, mat, x, y, z, r, h, r, rx, 0, rz),
      finish() {
        let instances = 0;
        for (const { geo, mat, matrices } of batches.values()) {
          const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
          matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix)); mesh.instanceMatrix.needsUpdate = true;
          mesh.castShadow = mat !== m.glass && mat !== m.light; mesh.receiveShadow = true; mesh.computeBoundingSphere();
          mesh.name = 'Business shared geometry'; parent.add(mesh); instances += matrices.length;
        }
        parent.userData.geometryInstances = instances; parent.userData.drawCalls = batches.size;
      }
    };
  }
  function sign(parent, text, subtitle, x, y, z, w, h, yaw = 0) {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = Math.round(768 * h / w);
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#23393e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f1edde';
    ctx.font = `600 ${canvas.height * (subtitle ? .36 : .48)}px Arial`;
    ctx.fillText(text, canvas.width / 2, canvas.height * (subtitle ? .37 : .51), canvas.width * .94);
    if (subtitle) { ctx.fillStyle = '#a3c5b6'; ctx.font = `500 ${canvas.height * .16}px Arial`; ctx.fillText(subtitle, canvas.width / 2, canvas.height * .77, canvas.width * .94); }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; resources.add(map);
    const mat = material(0xffffff, { map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: .22 });
    const geo = new THREE.PlaneGeometry(w, h); resources.add(geo);
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.rotation.y = yaw; parent.add(mesh); return mesh;
  }
  const entrances = BUSINESS_LAYOUTS.map(b => ({ id: b.id, name: b.name, x: offsetX + b.doorX, z: b.doorZ + 1.6, rotation: Math.PI,
    portal: { x: offsetX + b.doorX, z: b.doorZ, halfWidth: b.doorWidth / 2 - .15, direction: -1 } }));

  const shell = batchBuilder(group);
  function buildShell(b) {
    const { x, z, width: w, depth: d, height: h, doorX: dx, doorZ: dz, doorWidth: dw } = b;
    // Floor finishes are flush with sidewalk; no artificial raised loading step.
    shell.box(x, .0075, z, w, .035, d, b.id === 'store' ? m.floor : m.concrete);
    for (const side of [-1, 1]) {
      shell.box(x + side * w / 2, h / 2, z, .24, h, d, m.plaster);
      collider(x + side * w / 2, z, .24, d, 'wall', b.id);
    }
    shell.box(x, h / 2, z - d / 2, w, h, .24, m.plaster); collider(x, z - d / 2, w, .24, 'wall', b.id);
    for (const [left, right] of [[x - w / 2, dx - dw / 2], [dx + dw / 2, x + w / 2]]) {
      shell.box((left + right) / 2, 1.55, dz, right - left, 3.1, .2, b.id === 'store' ? m.glass : m.plaster);
      collider((left + right) / 2, dz, right - left, .2, 'wall', b.id);
    }
    shell.box(x, (h + 3.1) / 2, dz, w + .1, h - 3.1, .24, m.mint);
    // Clear opening: door panels retract completely outside the walking path.
    for (const side of [-1, 1]) {
      shell.box(dx + side * (dw / 2 + .1), 1.55, dz + .06, .14, 3.1, .25, m.dark);
      shell.box(dx + side * (dw / 2 + .31), 1.48, dz - .08, .23, 2.92, .14, b.id === 'store' ? m.glass : m.steel);
    }
    shell.box(dx, 3.14, dz, dw + .45, .14, .35, m.dark);
    shell.box(dx, .032, dz, dw, .025, .4, m.steel);
    shell.box(x, h + .04, z, w + .45, .16, d + .4, m.dark);
    for (let rz = z - d / 2 + .5; rz < z + d / 2; rz += 1.4) shell.box(x, h + .15, rz, w + .25, .05, .055, m.steel);
    shell.box(x, 3.3, dz + .45, w + .45, .15, 1.1, m.dark);
    sign(group, b.name.toUpperCase(), b.id === 'store' ? 'BOLSOS · DISEÑO · ATENCIÓN' : b.id === 'warehouse' ? 'RECEPCIÓN · RESERVA · DESPACHO' : 'CUERO · CORTE · COSTURA · ACABADO', x, h - .67, dz + .15, w * .8, .84);
    sign(group, 'ABIERTO', 'ACCESO PEATONAL', dx, 2.83, dz + .15, Math.min(dw - .2, 2.2), .35);
    sign(group, 'SALIDA', '', dx, 2.84, dz - .18, 1.2, .3, Math.PI);
    // Air-handling plant is sized as rooftop equipment, not a second floor.
    shell.box(x + w * .25, h + .48, z - 1.3, 2.1, .7, 1.3, m.steel);
    for (let a = -.8; a <= .8; a += .25) shell.box(x + w * .25 + a, h + .48, z - .63, .08, .49, .04, m.dark);
  }
  BUSINESS_LAYOUTS.forEach(buildShell);

  // Loading/parking bays leave the pedestrian doors and central roads clear.
  for (const [x, z, w, d] of [[-25, -8.8, 4.6, 4.1], [25.5, -8.8, 4.4, 4.1], [-25, 31, 4.6, 4.4]]) {
    for (const side of [-1, 1]) shell.box(x + side * w / 2, .047, z, .08, .025, d, m.white);
    shell.box(x, .047, z - d / 2, w, .025, .08, m.yellow);
  }
  // The admin annex belongs to this warehouse; it is not another scene.
  shell.box(-9.5, 2.9, -19, 6.4, 5.8, 14, m.mint); collider(-9.5, -19, 6.4, 14, 'building', 'annex');
  shell.box(-9.5, 5.87, -19, 6.7, .2, 14.3, m.dark);
  for (const x of [-11.1, -7.9]) for (const y of [1.8, 4.35]) shell.box(x, y, -11.93, 2.2, 1.4, .06, m.screen);
  sign(group, 'SIDE · ADMINISTRACIÓN', 'GESTIÓN EN EL PUNTO DE ATENCIÓN', -9.5, 3.05, -11.86, 5.7, .58);
  shell.finish();

  // Business customers use the same physical checkout and clear aisles as
  // the player. These positions are world coordinates, like the colliders.
  const queueSlots = [-14, -15.2, -16.4].map(x => ({ x: offsetX + x, z: 22.7 }));
  const salesAssistantPoint = { x: offsetX - 17, z: 16.2 };
  // Keep financial customers on the front circulation aisle: the runtime
  // connects these points directly, so diagonal approaches must also avoid
  // cutting through the checkout counter. Interior ambience NPCs browse the
  // deeper shelf aisles using their separate validated loops below.
  const browsePoints = [{ x: offsetX - 21.5, z: 22.7 }, { x: offsetX - 17.5, z: 22.7 }];

  function hotspot(room, id, type, label, x, z, cat, extra = {}) { hotspots.push({ id, type, label, x: x + offsetX, z, cat, zone: room.id, ...extra }); }
  function solid(room, b, x, y, z, w, h, d, mat, kind = 'furniture') {
    b.box(x, y, z, w, h, d, mat); collider(x, z, w, d, kind, room.id);
  }
  function pallet(b, x, z, w = 1.2, d = .95) {
    for (const a of [-.38, 0, .38]) b.box(x + a * w, .10, z, .13, .17, d, m.wood);
    for (let a = -.42; a <= .43; a += .21) b.box(x, .21, z + a * d, w, .055, .15, m.wood);
  }
  function carton(b, x, y, z, size = .55) {
    b.box(x, y, z, size, size * .7, size * .74, m.carton); b.box(x, y + size * .355, z, .09, .012, size * .76, m.tape);
  }
  function handbag(b, x, y, z, color, scale = 1) {
    b.box(x, y + .14 * scale, z, .35 * scale, .27 * scale, .16 * scale, color);
    for (const side of [-1, 1]) b.box(x + side * .093 * scale, y + .33 * scale, z, .025 * scale, .16 * scale, .025 * scale, m.leather);
    b.box(x, y + .40 * scale, z, .20 * scale, .025 * scale, .025 * scale, m.leather);
    b.box(x, y + .20 * scale, z + .087 * scale, .05 * scale, .035 * scale, .012 * scale, m.orange);
  }
  function stockBatch(room, tier) {
    let stock = room.stock.find(entry => entry.tier === tier);
    if (!stock) {
      const group = new THREE.Group(); group.name = `${room.id} stock tier ${tier}`;
      room.detail.add(group); stock = { group, tier, batch: batchBuilder(group) }; room.stock.push(stock);
    }
    return stock.batch;
  }
  function shelf(room, b, x, z, w = 2.6, industrial = false) {
    const depth = industrial ? 1.3 : .7, height = industrial ? 3.6 : 2.1;
    collider(x, z, w + .1, depth, 'shelf', room.id);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(x + sx * w / 2, height / 2, z + sz * (depth / 2 - .05), .08, height, .08, industrial ? m.steel : m.dark);
    for (let level = 0; level < 4; level++) {
      const y = .23 + level * (industrial ? .87 : .49);
      b.box(x, y, z, w, .07, depth, industrial ? m.orange : m.wood);
      const sb = stockBatch(room, level + 1);
      for (let i = 0; i < (industrial ? 4 : 5); i++) {
        const px = x - w * .37 + i * w * .74 / (industrial ? 3 : 4);
        if (industrial) carton(sb, px, y + .28, z, .62); else handbag(sb, px, y + .04, z, [m.leather, m.tan, m.black][i % 3]);
      }
    }
  }
  function table(room, b, x, z, w, d, kind = 'worktable') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(x + sx * (w / 2 - .1), .47, z + sz * (d / 2 - .1), .09, .90, .09, m.steel);
    b.box(x, .96, z, w, .09, d, m.white); collider(x, z, w, d, kind, room.id);
  }
  function route(room, role, points, stationary = false) {
    room.routes.push({ zone: room.id, role, stationary, points: points.map(([x, z]) => ({ x: offsetX + x, z })) });
  }

  for (const layout of BUSINESS_LAYOUTS) {
    const detail = new THREE.Group(); detail.name = `${layout.id} nearby detail`; group.add(detail);
    const room = { id: layout.id, layout, detail, stock: [], actors: [], routes: [], lights: [], stockLevel: 0 }; rooms.push(room);
    const b = batchBuilder(detail);
    // Floor joints, skirting and ceiling beams keep metre-scale surfaces legible.
    for(const side of [-1,1])b.box(layout.x+side*(layout.width/2-.16),.1,layout.z,.045,.17,layout.depth-.3,m.dark);
    b.box(layout.x,.1,layout.z-layout.depth/2+.16,layout.width-.3,.17,.045,m.dark);
    const joint=room.id==='store'?1:3;
    for(let x=layout.x-layout.width/2+joint;x<layout.x+layout.width/2;x+=joint)b.box(x,.026,layout.z,.009,.002,layout.depth-.25,m.grout);
    for(let z=layout.z-layout.depth/2+joint;z<layout.z+layout.depth/2;z+=joint)b.box(layout.x,.026,z,layout.width-.25,.002,.009,m.grout);
    if(room.id!=='store')for(let z=layout.z-5;z<layout.z+6;z+=3)b.box(layout.x,layout.height-.23,z,layout.width-.3,.24,.14,m.steel);
    // Ceiling lights share emissive batches; only this room's two fill lights activate.
    for (const x of [layout.x - 4, layout.x + 4]) for (const z of [layout.z - 3, layout.z + 2]) {
      b.box(x, layout.height - .21, z, 2, .1, .35, m.white); b.box(x, layout.height - .27, z, 1.8, .025, .26, m.light);
    }
    for (const z of [layout.z - 2.7, layout.z + 2.7]) {
      const light = new THREE.PointLight(0xfff0d6, 28, 15, 1.1); light.position.set(layout.x, Math.min(4, layout.height - .7), z);
      light.castShadow = false; light.visible = false; detail.add(light); room.lights.push(light);
    }
    if (room.id === 'store') {
      for (const x of [-24, -14]) { shelf(room, b, x, 15.0); shelf(room, b, x, 18.1); }
      // Central aisle (x=-19) stays clear from door to rear. Cash register is to the east.
      solid(room, b, -13.9, .52, 21.4, 3.25, 1.03, .85, m.wood, 'counter');
      b.box(-13.9, 1.075, 21.4, 3.4, .09, 1, m.white);
      b.box(-14.4, 1.18, 21.36, .52, .16, .42, m.dark); b.box(-14.4, 1.39, 21.37, .055, .32, .055, m.steel);
      b.box(-14.4, 1.57, 21.4, .49, .32, .055, m.screen); b.box(-13.65, 1.2, 21.37, .23, .14, .33, m.dark);
      b.box(-14.4, 1.27, 21.58, .5, .018, .06, m.black);
      solid(room, b, -24.6, .37, 21.7, 2.1, .72, 1.05, m.wood, 'display');
      const db = stockBatch(room, 1);
      for (const x of [-25.15, -24.55, -23.95]) handbag(db, x, .75, 21.7, m.tan, 1.12);
      sign(detail, 'COLECCIÓN SIDE', 'ESENCIAL · URBANO · PREMIUM', -19, 2.7, 14.15, 5.6, .65);
      sign(detail, 'CAJA / ATENCIÓN', '', -13.95, 2.5, 23.79, 2.9, .38, Math.PI);
      // A small stock preparation alcove, with a walkable side opening.
      solid(room, b, -26.5, .7, 16.7, .7, 1.4, 1.15, m.dark, 'reserve');
      carton(b, -26.5, 1.59, 16.7, .45);
      hotspot(room, 'store-sales', 'finance', 'Caja y ventas', -14, 22.7, 'comercial');
      hotspot(room, 'store-inventory', 'inventory', 'Exhibición e inventario', -21.5, 18.8, 'inventario');
      for (const [productId,label,x,z] of [['esencial','Bolso Básico',-24,19.15],['urbano','Bolso Mejorado',-14,19.15],['premium','Bolso Premium',-24,16.1]]) {
        hotspot(room, `product-${productId}`, 'product', label, x, z, 'comercial', {productId});
      }
      hotspot(room, 'store-office', 'decisions', 'Gestión de la empresa', -19, 15.6, 'empresa');
      solid(room,b,-20, .49,15.6,.48,.93,.43,m.dark,'terminal');
      b.box(-20,1.18,15.6,.5,.37,.06,m.screen);
      sign(detail,'GESTIÓN','DECISIONES DEL CICLO',-20,1.62,15.63,1.1,.3);
      route(room, 'cashier', [[-14, 20.2]], true);
      route(room, 'salesperson', [[-17, 15.2]], true);
      route(room, 'customer', [[-21.5, 20], [-21.5, 16.6], [-19, 16.6], [-19, 20]]);
      route(room, 'customer', [[-16.5, 16.7], [-16.5, 19.9], [-18, 19.9], [-18, 16.7]]);
    } else if (room.id === 'warehouse') {
      for (const x of [-25.2, -15.8]) for (const z of [-23.7, -19.5]) shelf(room, b, x, z, 3.1, true);
      // Receiving and packing stations flank the 3.6m doorway and wide main aisle.
      table(room, b, -25.2, -15.1, 3.2, 1.2); carton(b, -25.8, 1.22, -15.1, .6);
      b.box(-24.5, 1.1, -15.1, .52, .16, .39, m.dark); b.box(-24.5, 1.44, -15.25, .5, .34, .06, m.screen);
      pallet(b, -15.7, -15.4); collider(-15.7, -15.4, 1.25, 1, 'pallet', room.id);
      // Pending goods have not arrived: show a receiving marker rather than
      // drawing physical cartons that imply immediately available inventory.
      const pending = new THREE.Group(); pending.name = 'Pending delivery marker'; detail.add(pending); room.pending = pending;
      sign(pending, 'PEDIDO EN CAMINO', 'RECEPCIÓN PENDIENTE', -15.7, 1.25, -15.4, 2.1, .55);
      pending.visible = false;
      // Pallet jack parked outside the walking route.
      b.box(-27, .18, -16.5, .45, .18, .65, m.yellow);
      for (const x of [-27.23, -26.77]) { b.box(x, .12, -17.05, .12, .12, 1.2, m.yellow); b.cyl(x, .11, -17.5, .1, .12, m.black, 0, Math.PI / 2); }
      b.box(-27, .68, -16.24, .05, .9, .06, m.steel); b.box(-27, 1.14, -16.24, .42, .045, .06, m.dark);
      collider(-27, -16.9, .75, 1.6, 'equipment', room.id);
      for (const x of [-22.2, -18.2]) b.box(x, .038, -19, .075, .018, 11.8, m.yellow);
      sign(detail, 'RESERVA DE PRODUCTO TERMINADO', 'BOLSOS · INVENTARIO DE LA EMPRESA', -20.5, 4.4, -25.84, 10, .75);
      sign(detail, 'RECEPCIÓN', 'PEDIDOS A PROVEEDORES', -25, 2.3, -14.45, 3.5, .6);
      hotspot(room, 'warehouse-order', 'supplier', 'Recepción y pedidos', -24.6, -13.9, 'inventario');
      hotspot(room, 'warehouse-stock', 'inventory', 'Reserva de inventario', -20, -21.8, 'inventario');
      route(room, 'warehouse-worker', [[-23, -17.2], [-20.6, -17.2], [-20.6, -23], [-23, -23]]);
      route(room, 'warehouse-worker', [[-25.2, -16.35]], true);
    } else {
      // SIDE produces bags: leather cutting -> sewing/accessories -> finish/pack.
      table(room, b, 14.8, -15.5, 3.2, 1.5, 'machine');
      b.box(14.5, 1.025, -15.5, 1.95, .035, 1.1, m.leather); b.box(15.35, 1.07, -15.65, .42, .05, .72, m.tan);
      b.box(13.65, 1.1, -15.5, .12, .09, .6, m.steel);
      for (let i = 0; i < 4; i++) b.cyl(13.5 + i * .47, .55, -18.2, .2, 1.4, i % 2 ? m.tan : m.leather, Math.PI / 2);
      pallet(b, 14.2, -18.2, 2.1, 1.6); collider(14.2, -18.2, 2.2, 1.65, 'raw-material', room.id);
      for (const z of [-20.4, -23.4]) {
        table(room, b, 15.1, z, 3.1, 1.2, 'machine');
        for (const x of [14.25, 15.9]) {
          b.box(x, 1.01, z, .64, .055, .49, m.dark); b.box(x + .17, 1.26, z, .19, .46, .28, m.white);
          b.box(x - .04, 1.48, z, .52, .15, .26, m.white); b.box(x - .23, 1.27, z, .07, .29, .09, m.steel);
          b.cyl(x + .31, 1.35, z, .15, .07, m.dark, 0, Math.PI / 2); b.cyl(x + .10, 1.68, z, .046, .18, m.tan);
          const needle = new THREE.Mesh(geometry, m.steel); needle.position.set(x - .23, 1.15, z); needle.scale.set(.016, .1, .016); detail.add(needle);
          animated.push({ object: needle, y: 1.15, zone: room.id, phase: x });
        }
      }
      table(room, b, 24.7, -23.3, 3.5, 1.45, 'machine');
      for (const x of [23.8, 24.6, 25.4]) handbag(stockBatch(room, 1), x, 1.02, -23.3, m.leather);
      b.box(26, 1.42, -23.55, .055, .86, .055, m.steel); b.box(25.8, 1.87, -23.55, .5, .07, .3, m.light);
      table(room, b, 24.7, -19.6, 3.5, 1.2, 'worktable'); carton(b, 25.4, 1.28, -19.6, .68);
      b.box(23.7, 1.14, -19.6, .66, .25, .45, m.steel); b.box(23.7, 1.3, -19.6, .57, .035, .38, m.dark);
      shelf(room, b, 25.1, -15.2, 2.7, false);
      sign(detail, '01 · CORTE', 'CUERO Y PATRONES', 14.8, 2.7, -16.4, 3.5, .55);
      sign(detail, '02 · COSTURA Y ENSAMBLADO', 'CUERO + HILO + ACCESORIOS', 16, 3.05, -25.82, 6.5, .65);
      sign(detail, '03 · ACABADO Y CONTROL', 'INSPECCIÓN · EMPAQUE', 24, 3.05, -25.82, 6.2, .65);
      for (const x of [18.2, 21.8]) b.box(x, .038, -19, .075, .018, 11.8, m.yellow);
      b.box(20, .045, -18.5, 1.3, .018, .1, m.yellow);
      hotspot(room, 'production-plan', 'production', 'Plan de producción', 20, -18, 'produccion');
      solid(room,b,19,.51,-18.7,.55,1.02,.45,m.dark,'terminal');
      b.box(19,1.31,-18.7,.55,.4,.065,m.screen);
      sign(detail,'CONTROL DE PRODUCCIÓN','CAPACIDAD · PRODUCTIVIDAD',19,1.9,-18.65,2.25,.4);
      hotspot(room, 'production-quality', 'production', 'Acabado y capacidad', 24, -21.4, 'produccion');
      route(room, 'sewing-operator', [[15.2, -21.55]], true);
      route(room, 'production-supervisor', [[21.1, -15.5], [21.1, -21.5], [22.1, -21.5], [22.1, -15.5]]);
      route(room, 'cutting-operator', [[14.8, -14.2]], true);
    }
    b.finish();
    room.stock.forEach(stock => stock.batch.finish());
  }

  const npcRoutes = rooms.flatMap(room => room.routes);
  const zoneAt = position => zones.find(zone => position && position.x > zone.minX + .12 && position.x < zone.maxX - .12 && position.z > zone.minZ + .12 && position.z < zone.maxZ)?.id || null;
  let snapshot = {}, disposed = false;
  function sync(value = {}) {
    // `simulator3d.js` owns the financial model and sends a read-only
    // projection. Keep the older ratio aliases for callers from earlier
    // builds, but prefer the current snapshot contract (`storeFill`,
    // `warehouseFill`, `pendingUnits`, `producedUnits`, `plannedUnits`).
    const next = value && typeof value === 'object' ? value : {};
    snapshot = next;
    const productionRatio = next.productionFill ?? next.productionStockRatio ?? (
      Number.isFinite(Number(next.producedUnits)) && Number(next.plannedUnits) > 0
        ? Number(next.producedUnits) / Number(next.plannedUnits)
        : 0
    );
    const ratios = {
      store: next.storeFill ?? next.storeStockRatio ?? next.inventoryRatio ?? 0,
      warehouse: next.warehouseFill ?? next.warehouseStockRatio ?? next.inventoryRatio ?? 0,
      production: productionRatio
    };
    const pendingUnits = Math.max(0, Number(next.pendingUnits ?? next.warehousePendingUnits ?? 0) || 0);
    for (const room of rooms) {
      const level = stockVisualLevel(ratios[room.id]); room.stockLevel = level;
      for (const tier of room.stock) tier.group.visible = tier.tier <= level;
      // A pending order is shown in the receiving area only. It never adds
      // units to stock; delivery changes the authoritative reserve/fill data.
      if (room.pending) {
        room.pending.visible = pendingUnits > 0;
        room.pending.userData.pendingUnits = pendingUnits;
      }
    }
  }
  function ensureActors(room) {
    if (room.actors.length || !createNpc) return;
    for (const route of room.routes) {
      const object = createNpc(route.role); if (!object) continue;
      const start = route.points[0]; object.position.set(start.x - offsetX, .025, start.z);
      object.name = `SIDE ${route.zone} ${route.role}`; room.detail.add(object);
      room.actors.push({ object, route, target: route.stationary ? 0 : 1, wait: 0 });
    }
  }
  function tick(dt, position, time = 0) {
    if (disposed) return;
    dt = Math.max(0, Math.min(.05, Number(dt) || 0)); const active = zoneAt(position);
    for (const room of rooms) {
      const b = room.layout, distance = position ? Math.hypot(position.x - offsetX - b.x, position.z - b.z) : Infinity;
      room.detail.visible = distance < 24; // preload geometry is allocated once, render only near its parcel
      const inside = active === room.id; room.lights.forEach(light => { light.visible = inside; });
      for (const actor of room.actors) actor.object.visible = inside;
      if (!inside) continue;
      ensureActors(room);
      for (const actor of room.actors) {
        const { object, route } = actor;
        const target = route.points[actor.target], dx = target.x - offsetX - object.position.x, dz = target.z - object.position.z, length = Math.hypot(dx, dz);
        const playerDistance = Math.hypot(position.x - offsetX - object.position.x, position.z - object.position.z);
        let moving = false;
        if (!route.stationary && length > .08 && playerDistance > 1.05) {
          const step = Math.min(length, dt * .65); object.position.x += dx / length * step; object.position.z += dz / length * step;
          object.rotation.y = Math.atan2(dx, dz); moving = true;
        } else if (!route.stationary && length <= .08) actor.target = (actor.target + 1) % route.points.length;
        animateNpc?.(object, dt, moving);
      }
    }
    for (const animation of animated) if (active === animation.zone) animation.object.position.y = animation.y + (snapshot.productionActive ? Math.sin(time * 20 + animation.phase) * .045 : 0);
    group.userData.activeZone = active;
  }
  sync();
  group.userData.connectedWorld = true;
  return {
    group, colliders, entrances, zones, hotspots, interactionPoints: hotspots, npcRoutes, rooms,
    queueSlots, checkoutQueueSlots: queueSlots, browsePoints, salesAssistantPoint,
    zoneAt, sync, update: sync, tick,
    stats() {
      let instancedBatches = 0, geometryInstances = 0, visibleBatches = 0;
      group.traverse(object => {
        if (object.isInstancedMesh) { instancedBatches++; geometryInstances += object.count; }
      });
      group.traverseVisible(object => { if (object.isMesh) visibleBatches++; });
      return { rooms: rooms.length, colliders: colliders.length,
        stockLevels: Object.fromEntries(rooms.map(room => [room.id, room.stockLevel])),
        activeNpcs: rooms.filter(r => r.id === group.userData.activeZone).reduce((n, r) => n + r.actors.length, 0),
        activeLights: rooms.reduce((n, r) => n + r.lights.filter(l => l.visible && r.detail.visible).length, 0),
        instancedBatches, geometryInstances, visibleBatches,
        sharedGeometries: 2, stockBatches: rooms.reduce((n, room) => n + room.stock.reduce((s, stock) => s + stock.group.children.length, 0), 0)
      };
    },
    dispose() {
      if (disposed) return; disposed = true; group.removeFromParent();
      group.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
      resources.forEach(resource => resource.dispose()); rooms.forEach(room => { room.actors.length = 0; }); group.clear();
    }
  };
}
