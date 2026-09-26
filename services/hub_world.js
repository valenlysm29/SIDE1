import * as THREE from '../vendor/three/build/three.module.js';

// Every visible surface is world geometry. No screenshot, backdrop render, or
// generated image is used; the hub works from ground level and from orbit.
const DISTRICTS = [
  { id: 'miraflores', label: 'MIRAFLORES' },
  { id: 'olivos', label: 'LOS OLIVOS' },
  { id: 'sjl', label: 'SAN JUAN DE LURIGANCHO' }
];

function seededRandom(seed = 4107) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

function texture(kind) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d'); const random = seededRandom(kind.length * 1307);
  const palette = { asphalt: '#43484b', paving: '#b6b3a8', concrete: '#c7c3b6', plaster: '#e0ddd2', wood: '#a4794d', metal: '#b7bcc0', grass: '#637c4d' };
  ctx.fillStyle = palette[kind] || palette.concrete; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 16000; i++) {
    const n = Math.floor(random() * 255); ctx.fillStyle = `rgba(${n},${n},${n},${kind === 'asphalt' ? .19 : .07})`;
    ctx.fillRect(random() * 512, random() * 512, 1 + random() * 2, 1 + random() * 2);
  }
  if (kind === 'paving' || kind === 'concrete') {
    const step = kind === 'paving' ? 64 : 256;
    ctx.strokeStyle = kind === 'paving' ? '#8e8c84' : '#a6a399'; ctx.lineWidth = 2;
    for (let y = 0; y <= 512; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
      for (let x = (y / step % 2) * step / 2; x <= 512; x += step) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + step); ctx.stroke();
      }
    }
  }
  if (kind === 'wood' || kind === 'metal') {
    for (let y = 0; y <= 512; y += kind === 'wood' ? 18 : 48) {
      ctx.fillStyle = kind === 'wood' ? 'rgba(55,35,22,.16)' : 'rgba(40,50,60,.16)';
      ctx.fillRect(0, y, 512, 2);
    }
  }
  if (kind === 'asphalt') {
    ctx.strokeStyle = 'rgba(22,27,31,.22)'; ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      let x = random() * 512, y = random() * 512; ctx.beginPath(); ctx.moveTo(x, y);
      for (let j = 0; j < 6; j++) { x += random() * 30 - 15; y += random() * 19; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4; return map;
}

/** World-space collider boxes and door targets are returned for the controller. */
export function createHubWorld({ scene, offsetX = 150 } = {}) {
  const group = new THREE.Group(); group.name = 'SIDE explorable urban hub'; group.position.set(offsetX, -.125, 0);
  scene?.add(group);
  const colliders = [], resources = new Set(), batches = new Map();
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 12);
  const sphereGeometry = new THREE.SphereGeometry(1, 9, 7);
  const leafGeometry = new THREE.PlaneGeometry(1, 1, 1, 4);
  resources.add(boxGeometry); resources.add(cylinderGeometry); resources.add(sphereGeometry); resources.add(leafGeometry);
  const temp = new THREE.Object3D(); let frame = new THREE.Matrix4();
  const mat = (color, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: .78, ...extra }); resources.add(m); return m;
  };
  const textured = (kind, color = 0xffffff, extra = {}) => {
    const map = texture(kind); resources.add(map);
    return mat(color, { map, bumpMap: map, bumpScale: kind === 'asphalt' ? .025 : .015, ...extra });
  };
  const m = {
    asphalt: textured('asphalt'), paving: textured('paving'), concrete: textured('concrete'),
    plaster: textured('plaster'), wood: textured('wood'), roof: textured('metal', 0x66737b, { metalness: .46, roughness: .64 }),
    grass: textured('grass'), white: mat(0xe9e4d8), black: mat(0x19252c, { roughness: .47 }),
    steel: mat(0x73838c, { metalness: .75, roughness: .4 }), darkSteel: mat(0x263a45, { metalness: .62, roughness: .46 }),
    glass: mat(0x93bac3, { metalness: .25, roughness: .12, transparent: true, opacity: .33, depthWrite: false }),
    opaqueGlass: mat(0x41616c, { metalness: .62, roughness: .13 }), mint: mat(0x779c94), coral: mat(0xbc8065),
    yellow: mat(0xdcb854), paint: mat(0xe6e1cd, { roughness: .96 }), bark: textured('wood', 0x89877a),
    foliage: mat(0x52764c, { side: THREE.DoubleSide }), foliageLight: mat(0x728f5c, { side: THREE.DoubleSide }),
    light: mat(0xfff3d7, { emissive: 0xffe5af, emissiveIntensity: 1.5 }),
    blueLight: mat(0xc8ecff, { emissive: 0x95ccff, emissiveIntensity: 1.2 }),
    redLight: mat(0xb72626, { emissive: 0x7c0909, emissiveIntensity: .6 }),
    rubber: mat(0x14191d, { roughness: .94 }), soil: mat(0x4d4634), water: mat(0x55908b, { roughness: .16, metalness: .35 })
  };
  function instance(geo, material, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    temp.position.set(x, y, z); temp.rotation.set(rx, ry, rz); temp.scale.set(sx, sy, sz); temp.updateMatrix();
    const matrix = new THREE.Matrix4().multiplyMatrices(frame, temp.matrix);
    const key = `${geo.uuid}:${material.uuid}`;
    if (!batches.has(key)) batches.set(key, { geo, material, matrices: [] });
    batches.get(key).matrices.push(matrix);
  }
  const box = (x, y, z, w, h, d, material, ry = 0, rx = 0, rz = 0) => instance(boxGeometry, material, x, y, z, w, h, d, rx, ry, rz);
  const cyl = (x, y, z, r, h, material, rx = 0, rz = 0) => instance(cylinderGeometry, material, x, y, z, r, h, r, rx, 0, rz);
  function framed(x, z, yaw, build) {
    const previous = frame;
    frame = new THREE.Matrix4().makeRotationY(yaw); frame.setPosition(x, 0, z);
    build(); frame = previous;
  }
  function add(object, x = 0, y = 0, z = 0, ry = 0, rx = 0) {
    object.position.set(x, y, z); object.rotation.set(rx, ry, 0); object.updateMatrix();
    object.applyMatrix4(frame); object.receiveShadow = true; group.add(object); return object;
  }
  function collider(x, z, w, d, kind = 'obstacle') {
    colliders.push({ minX: offsetX + x - w / 2, maxX: offsetX + x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, kind });
  }
  function ground(x, z, w, d, material, y = .01, tile = 8) {
    const geo = new THREE.PlaneGeometry(w, d);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile);
    resources.add(geo); return add(new THREE.Mesh(geo, material), x, y, z, 0, -Math.PI / 2);
  }
  function canvasSign(w, h, draw) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = Math.round(1024 * h / w);
    const ctx = canvas.getContext('2d'); draw(ctx, canvas.width, canvas.height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    const material = new THREE.MeshStandardMaterial({ map, roughness: .58, metalness: .04, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: .18 });
    const geo = new THREE.PlaneGeometry(w, h); [map, material, geo].forEach(r => resources.add(r));
    return { mesh: new THREE.Mesh(geo, material), ctx, map, canvas };
  }
  function label(text, subtitle, x, y, z, w, h, background = '#203a42', ry = 0) {
    const sign = canvasSign(w, h, (ctx, cw, ch) => {
      ctx.fillStyle = background; ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = '#f4f1e6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(ch * (subtitle ? .40 : .51))}px Arial`; ctx.fillText(text, cw / 2, ch * (subtitle ? .39 : .52), cw * .92);
      if (subtitle) { ctx.fillStyle = '#b5c9bd'; ctx.font = `500 ${Math.round(ch * .16)}px Arial`; ctx.fillText(subtitle, cw / 2, ch * .76, cw * .88); }
    });
    add(sign.mesh, x, y, z, ry); return sign;
  }

  // The central crossing and four parcels preserve the source map's layout.
  ground(0, 0, 114, 114, m.grass, -.08, 12);
  ground(0, 0, 102, 10, m.asphalt, .15); ground(0, 0, 10, 102, m.asphalt, .155);
  for (const axis of [-1, 1]) {
    ground(0, axis * 39, 84, 10, m.asphalt, .145); ground(axis * 39, 0, 10, 68, m.asphalt, .146);
  }
  for (const x of [-20, 20]) for (const z of [-20, 20]) {
    box(x, -.015, z, 29, .25, 29, m.concrete); ground(x, z, 28.8, 28.8, m.paving, .12, 12);
    for (const side of [-1, 1]) {
      box(x + side * 14.55, .09, z, .25, .3, 29.4, m.white);
      box(x, .09, z + side * 14.55, 29.4, .3, .25, m.white);
    }
  }
  // Stop bars, pedestrian crossings and lane markers are shallow geometry.
  for (let a = -49; a <= 49; a += 6) if (Math.abs(a) > 9) {
    box(a, .173, 0, 3, .013, .11, m.yellow); box(0, .173, a, .11, .013, 3, m.yellow);
  }
  for (const side of [-1, 1]) for (let s = -3.9; s <= 4; s += 1.15) {
    box(s, .177, side * 7.6, .55, .014, 2.6, m.paint);
    box(side * 7.6, .177, s, 2.6, .014, .55, m.paint);
  }
  for (const side of [-1, 1]) {
    box(side * 10.2, .173, side * 2.3, .3, .014, 4.3, m.paint);
    box(-side * 2.3, .173, side * 10.2, 4.3, .014, .3, m.paint);
  }
  for (let a = -29; a <= 29; a += 6) for (const side of [-1, 1]) {
    box(a, .173, side * 39, 3, .012, .1, m.paint);
    box(side * 39, .173, a, .1, .012, 3, m.paint);
  }
  for (const [x, z] of [[-5.9, -5.9], [5.9, -5.9], [-5.9, 5.9], [5.9, 5.9]]) {
    ground(x, z, 1.25, 1.25, m.yellow, .131, 5);
    cyl(x, .17, z, .44, .07, m.steel);
  }

  // Retail: a real interior behind the glazed frontage, with a roof and side walls.
  box(-19, .18, 19, 16.5, .3, 10.5, m.concrete);
  box(-27, 2.9, 19, .28, 5.5, 10, m.plaster); box(-11, 2.9, 19, .28, 5.5, 10, m.plaster);
  box(-19, 2.9, 14, 16, 5.5, .3, m.plaster);
  box(-19, 5.58, 19, 16.8, .3, 10.8, m.roof);
  box(-19, 4.83, 24.22, 16.8, 1.35, .58, m.darkSteel);
  label('SIDE', 'DISEÑO PARA TU DÍA A DÍA', -19, 4.85, 24.53, 6.5, 1.03);
  box(-19, 4.1, 25.06, 16.6, .17, 2.1, m.mint);
  for (const x of [-26.65, -23, -20.4, -17.6, -15, -11.35]) box(x, 2.1, 24.02, .09, 3.85, .12, m.darkSteel);
  for (const x of [-24.83, -21.7, -16.3, -13.18]) box(x, 2.1, 24, 2.45, 3.65, .07, m.glass);
  box(-19, .38, 24, 2.5, .1, .42, m.steel);
  box(-19, 2.1, 24.07, 2.52, 3.65, .06, m.glass);
  for (const x of [-19.15, -18.85]) box(x, 1.5, 24.2, .035, .48, .045, m.steel);
  box(-19, 3.98, 24.12, 16.1, .09, .1, m.darkSteel);
  ground(-19, 19, 15.7, 9.7, m.concrete, .35, 9);
  for (const x of [-24.4, -14]) {
    box(x, 1.3, 16, 3.1, 2, .35, m.wood);
    for (let y = .65; y < 2.7; y += .62) {
      box(x, y, 16.45, 3.15, .06, 1, m.darkSteel);
      for (let a = -1; a <= 1; a++) {
        box(x + a * .88, y + .24, 16.46, .53, .4, .32, a === 0 ? m.coral : m.mint);
        box(x + a * .88, y + .47, 16.46, .26, .07, .13, m.darkSteel);
      }
    }
  }
  box(-19, .97, 19, 4.4, 1.1, 1.4, m.wood); box(-19, 1.55, 19, 4.55, .1, 1.55, m.white);
  for (const x of [-21.8, -16.2]) box(x, 5.35, 19, .08, .03, 6.5, m.light);
  box(-24, 6.12, 18, 2.3, .8, 1.6, m.steel); box(-14, 6.05, 18, 1.7, .65, 1.6, m.steel);
  for (let x = -27; x <= -11; x += 1.5) box(x, 5.77, 19, .045, .05, 10.3, m.steel);
  collider(-19, 18.95, 16.3, 10.3, 'building');

  // Warehouse and attached two-storey office retain their original footprints.
  box(-20.5, 3.45, -19, 15, 6.65, 14, m.plaster);
  box(-20.5, .62, -11.82, 15.4, 1, 1.35, m.concrete);
  box(-20.5, 6.85, -19, 15.5, .25, 14.5, m.roof);
  box(-20.5, 5.93, -11.94, 15.5, .8, .28, m.mint);
  label('ALMACÉN SIDE', 'LOGÍSTICA · RECEPCIÓN · DISTRIBUCIÓN', -20.5, 5.97, -11.77, 9, .66);
  for (const x of [-24.7, -19.7]) {
    box(x, 2.61, -11.84, 4.12, 4.4, .23, m.darkSteel);
    box(x, 2.62, -11.65, 3.7, 4, .08, m.steel);
    for (let y = .82; y < 4.6; y += .35) box(x, y, -11.58, 3.72, .045, .04, m.darkSteel);
    for (const dx of [-2.2, 2.2]) { cyl(x + dx, .84, -10.83, .095, 1.4, m.yellow); box(x + dx, .87, -10.83, .21, .12, .21, m.black); }
  }
  box(-9.5, 3.1, -19, 7, 5.95, 14, m.mint); box(-9.5, 6.2, -19, 7.3, .22, 14.3, m.white);
  for (const x of [-11.6, -8.1]) for (const y of [1.7, 4.5]) {
    box(x, y, -11.94, 2.25, 1.65, .12, m.darkSteel); box(x, y, -11.83, 2.02, 1.4, .07, m.opaqueGlass);
    box(x, y, -11.75, .065, 1.45, .07, m.white);
  }
  for (const z of [-23, -18, -14]) {
    box(-5.95, 4.4, z, .1, 1.8, 2.9, m.darkSteel); box(-5.86, 4.4, z, .06, 1.55, 2.65, m.opaqueGlass);
  }
  for (let z = -25; z <= -13; z += 1.5) box(-20.5, 7.02, z, 15.2, .045, .04, m.steel);
  collider(-17, -19, 22, 14.3, 'building');
  // Pallets occupy the service strip while leaving the south-side approach open.
  for (const [x, z] of [[-31, -22], [-31, -18]]) {
    box(x, .33, z, 1.5, .23, 1.2, m.wood);
    for (const a of [-.42, .42]) box(x + a, .91, z, .73, .94, 1.02, m.coral);
    collider(x, z, 1.6, 1.3);
  }

  // Production: service doors, rooftop plant, vent stacks, downpipes and a yard.
  box(20, 4.16, -19, 16, 8, 14, m.plaster); box(20, .62, -19, 16.2, .9, 14.2, m.darkSteel);
  box(20, 8.31, -19, 16.65, .27, 14.6, m.roof);
  box(20, 6.88, -11.94, 16.4, 1.12, .28, m.darkSteel);
  label('PRODUCCIÓN SIDE', 'TALLER · CALIDAD · INNOVACIÓN', 20, 6.9, -11.77, 10.5, .92);
  for (const x of [15.2, 24.8]) {
    box(x, 3.18, -11.89, 5.25, 4.55, .23, m.darkSteel); box(x, 3.18, -11.72, 4.85, 4.16, .08, m.steel);
    for (let y = 1.3; y < 5.1; y += .4) box(x, y, -11.64, 4.85, .045, .04, m.darkSteel);
  }
  box(20, 1.8, -11.78, 1.44, 3.2, .18, m.darkSteel); box(20, 2.16, -11.65, 1.18, 2.1, .08, m.opaqueGlass);
  for (const x of [13, 27]) cyl(x, 4.2, -11.54, .075, 8.1, m.steel);
  for (const z of [-24, -20, -16]) for (const side of [-1, 1]) {
    box(20 + side * 8.06, 6.5, z, .12, 1.15, 2.7, m.darkSteel);
    box(20 + side * 8.14, 6.5, z, .06, .94, 2.48, m.opaqueGlass);
  }
  for (const [x, z] of [[16, -21], [23.5, -18]]) {
    box(x, 9.15, z, 3.4, 1.38, 2.6, m.steel);
    for (let a = -.9; a <= 1; a += .3) box(x + a, 9.16, z + 1.32, .09, 1.12, .03, m.darkSteel);
    cyl(x, 9.94, z, .71, .17, m.darkSteel);
    for (let a = 0; a < 4; a++) box(x, 10.04, z, 1.1, .05, .13, m.steel, a * Math.PI / 4);
  }
  for (const x of [15, 18]) {
    cyl(x, 10.35, -24, .42, 4.1, m.steel); cyl(x, 12.45, -24, .62, .18, m.darkSteel);
    cyl(x, 12.68, -24, .53, .14, m.steel);
  }
  box(21, 9.15, -23, 7, .6, .8, m.steel);
  for (let x = 12.5; x <= 28; x += 1.7) box(x, 8.5, -19, .04, .04, 14.3, m.steel);
  collider(20, -19, 16.35, 14.3, 'building');
  ground(20, -30, 21, 6, m.concrete, .14, 7);
  for (const x of [11, 16, 21, 26, 30]) {
    cyl(x, 1.02, -33, .06, 1.7, m.steel);
    box(x, .55, -33, 4.8, .045, .045, m.steel); box(x, 1.53, -33, 4.8, .045, .045, m.steel);
  }
  for (const x of [28.6, 30.3]) { cyl(x, .81, -27.7, .57, 1.3, m.mint); cyl(x, 1.48, -27.7, .6, .09, m.steel); collider(x, -27.7, 1.2, 1.2); }

  // Plaza: the open pedestrian routes cross between planted corners and the kiosk.
  ground(19, 19, 27, 27, m.paving, .147, 11);
  for (const x of [8.8, 29.2]) for (const z of [8.8, 29.2]) {
    box(x, .46, z, 4.3, .65, 4.3, m.concrete); box(x, .81, z, 3.92, .07, 3.92, m.soil);
    collider(x, z, 4.3, 4.3, 'planter');
  }
  for (const x of [12, 26]) {
    box(x, .169, 19, .16, .035, 22, m.darkSteel);
    for (let z = 11; z < 28; z += 4) box(x, .18, z, .2, .015, 1.4, m.light);
  }
  box(19, .18, 19, 5.4, .09, 5.4, m.white);
  box(19, .237, 19, 4.95, .025, 4.95, m.darkSteel);

  function bench(x, z, yaw = 0) {
    framed(x, z, yaw, () => {
      for (const a of [-.85, .85]) {
        box(a, .48, 0, .09, .62, .54, m.darkSteel); box(a, .9, -.25, .075, .78, .075, m.darkSteel, 0, -.12);
        box(a, .83, .05, .075, .06, .68, m.darkSteel);
      }
      for (let a = -.2; a <= .22; a += .14) box(0, .74, a, 2.12, .08, .105, m.wood);
      for (let y = .97; y < 1.35; y += .16) box(0, y, -.27, 2.12, .12, .06, m.wood, 0, -.12);
    });
    const swap = Math.abs(Math.sin(yaw)) > .5; collider(x, z, swap ? .8 : 2.3, swap ? 2.3 : .8, 'bench');
  }
  bench(19, 9.4); bench(19, 28.6, Math.PI); bench(9.4, 19, Math.PI / 2); bench(28.6, 19, -Math.PI / 2);
  bench(-25, 29); bench(-13, 29);

  function palm(x, z, height = 7.5, rotation = 0) {
    const trunk = new THREE.CylinderGeometry(.16, .28, height, 9, 6); resources.add(trunk);
    const obj = add(new THREE.Mesh(trunk, m.bark), x, height / 2 + .72, z); obj.castShadow = true;
    for (let a = 0; a < 9; a++) {
      const angle = rotation + a * Math.PI * 2 / 9, length = 3.1 + Math.sin(a * 7) * .45;
      // Feather-shaped fronds curve down at their tips; alpha-free silhouettes.
      const vertices = [], indices = []; const segments = 7;
      for (let n = 0; n <= segments; n++) {
        const t = n / segments, radius = t * length;
        const width = Math.sin(Math.PI * t) * .49;
        const py = height + .75 + Math.sin(t * Math.PI) * .64 - t * t * 1.3;
        const px = x + Math.cos(angle) * radius, pz = z + Math.sin(angle) * radius;
        vertices.push(px - Math.sin(angle) * width, py, pz + Math.cos(angle) * width, px, py + .065, pz, px + Math.sin(angle) * width, py, pz - Math.cos(angle) * width);
        if (n < segments) {
          const k = n * 3; indices.push(k, k + 3, k + 1, k + 1, k + 3, k + 4, k + 1, k + 4, k + 2, k + 2, k + 4, k + 5);
        }
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.setIndex(indices); geo.computeVertexNormals(); resources.add(geo);
      const leaf = new THREE.Mesh(geo, a % 3 === 0 ? m.foliageLight : m.foliage); leaf.castShadow = true; leaf.receiveShadow = true; group.add(leaf);
    }
    collider(x, z, .66, .66, 'tree');
  }
  [[8.8, 8.8, 6.7], [29.2, 8.8, 8], [8.8, 29.2, 7.3], [29.2, 29.2, 7.8], [-30.5, 8.7, 7.2], [-8.5, 30.5, 8.2], [-30.5, 30.5, 6.8], [31.4, -8, 8.5], [-30.5, -8, 7.1]].forEach(([x, z, h], i) => palm(x, z, h, i * .41));
  for (const [x, z] of [[8.8, 8.8], [29.2, 8.8], [8.8, 29.2], [29.2, 29.2]]) for (let a = 0; a < 7; a++) {
    const angle = a * Math.PI * 2 / 7;
    instance(sphereGeometry, a % 2 ? m.foliage : m.foliageLight, x + Math.cos(angle) * 1.25, 1.03, z + Math.sin(angle) * 1.25, .54, .31, .56);
  }

  function lamp(x, z, yaw = 0) {
    framed(x, z, yaw, () => {
      cyl(0, .29, 0, .2, .38, m.darkSteel); cyl(0, 3.2, 0, .067, 6, m.darkSteel);
      box(.57, 6.18, 0, 1.23, .085, .095, m.darkSteel, 0, 0, -.06);
      box(1.14, 6.13, 0, .82, .13, .3, m.darkSteel); box(1.14, 6.06, 0, .64, .025, .22, m.light);
    }); collider(x, z, .4, .4, 'lamp');
  }
  [[-7, -29, Math.PI], [-7, 12, Math.PI], [-29, -7, -Math.PI / 2], [12, -7, -Math.PI / 2], [7, -29, 0], [7, 30, 0], [-29, 7, Math.PI / 2], [30, 7, Math.PI / 2], [33, 23, Math.PI], [-33, 23, 0]].forEach(([x, z, a]) => lamp(x, z, a));
  for (const [x, z] of [[13, 28.8], [25, 9.2], [-10, 26.5]]) {
    cyl(x, .68, z, .32, 1.05, m.darkSteel); cyl(x, 1.21, z, .34, .075, m.steel); collider(x, z, .7, .7, 'bin');
  }

  // Physical directory. The HTML selector can call updateDistrict to keep this
  // readable screen in sync with the active simulation store.
  const kioskX = 19, kioskZ = 19;
  box(kioskX, .46, kioskZ, 2.18, .39, 1.1, m.darkSteel);
  box(kioskX, 1.27, kioskZ, 1.83, 1.4, .48, m.darkSteel);
  box(kioskX, 2.02, kioskZ, 2.1, .18, .82, m.black);
  const screen = canvasSign(1.65, 1.17, () => {});
  screen.mesh.material.emissiveIntensity = .55;
  add(screen.mesh, kioskX, 1.32, kioskZ + .248);
  function updateDistrict(value = 'miraflores') {
    const normalized = String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s_]+/g, '-');
    const canonical = ({ 'los-olivos': 'olivos', 'san-juan-de-lurigancho': 'sjl' })[normalized] || normalized;
    const id = DISTRICTS.some(d => d.id === canonical) ? canonical : 'miraflores';
    const { ctx, canvas } = screen; const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#10242b'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '700 41px Arial';
    ctx.fillText('SIDE / DIRECTORIO', 50, 62); ctx.fillStyle = '#9cb6bc'; ctx.font = '25px Arial'; ctx.fillText('SELECCIONA TU TIENDA', 50, 112);
    DISTRICTS.forEach((district, index) => {
      const y = 164 + index * 153, active = district.id === id;
      ctx.fillStyle = active ? '#c4e2c1' : '#263d45'; ctx.fillRect(42, y, w - 84, 118);
      ctx.strokeStyle = active ? '#e5ffda' : '#405761'; ctx.lineWidth = active ? 5 : 2; ctx.strokeRect(42, y, w - 84, 118);
      ctx.fillStyle = active ? '#143328' : '#d4dee0'; ctx.font = '700 34px Arial'; ctx.fillText(district.label, 73, y + 46, w - 155);
      ctx.font = '23px Arial'; ctx.fillStyle = active ? '#36563e' : '#829da4'; ctx.fillText(active ? '●  TIENDA ACTIVA' : '○  CAMBIAR SEDE', 73, y + 85);
    });
    ctx.fillStyle = '#9db9c0'; ctx.font = '22px Arial'; ctx.fillText('ACÉRCATE PARA INTERACTUAR', 50, h - 33); screen.map.needsUpdate = true;
    group.userData.district = id; return id;
  }
  updateDistrict(); collider(kioskX, kioskZ, 2.2, 1.15, 'kiosk');
  label('SIDE', 'TU CIUDAD · TU NEGOCIO', 19, 1.38, 18.749, 1.65, .94, '#263e45', Math.PI);

  function entranceMarker(x, z, title, number, rotation = 0) {
    framed(x, z, rotation, () => {
      box(0, .19, 0, .78, .12, .5, m.darkSteel); box(0, 1.3, 0, .65, 2.14, .14, m.darkSteel);
      label(number, title, 0, 1.45, .081, .56, 1.13);
    }); collider(x, z, .8, .55, 'sign');
  }
  entranceMarker(-16.3, 26, 'TIENDA', '01'); entranceMarker(-16.2, -9.1, 'ALMACÉN', '02'); entranceMarker(22, -9.1, 'PRODUCCIÓN', '03');

  // Three unbranded road vehicles use shared geometry and the same light/wheel language.
  function vehicle(x, z, yaw, color, crossover = false) {
    const body = mat(color, { metalness: .66, roughness: .28 });
    framed(x, z, yaw, () => {
      const rise = crossover ? .15 : 0;
      box(0, .6 + rise, 0, 1.82, .46, 4.2, body);
      box(0, .48 + rise, 0, 1.86, .2, 4.1, m.black);
      box(0, .89 + rise, -1.34, 1.75, .16, 1.43, body, 0, -.04);
      box(0, .86 + rise, 1.55, 1.76, .18, .99, body);
      // Trapezoidal cabin has sloped glass, roof and pillars, not a box silhouette.
      const verts = [-.82,.89+rise,-.85, .82,.89+rise,-.85, -.66,1.51+rise,-.38, .66,1.51+rise,-.38,
        -.82,.89+rise,1.12, .82,.89+rise,1.12, -.68,1.51+rise,.67, .68,1.51+rise,.67];
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex([0,1,2,1,3,2,4,6,5,5,6,7,0,2,4,4,2,6,1,5,3,5,7,3,2,3,6,3,7,6]); geo.computeVertexNormals(); resources.add(geo);
      const cabin = add(new THREE.Mesh(geo, m.opaqueGlass)); cabin.castShadow = true;
      box(0, 1.54 + rise, .15, 1.38, .065, 1.13, body);
      for (const side of [-1, 1]) {
        box(side * .85, 1.2 + rise, .32, .055, .64, .095, m.black);
        box(side * .74, 1.2 + rise, -.62, .06, .78, .075, body, 0, -.64);
        box(side * .76, 1.2 + rise, .92, .06, .76, .08, body, 0, .62);
        box(side * .92, 1.05 + rise, -.6, .25, .14, .3, body);
        box(side * .92, .88 + rise, .55, .02, .042, .23, m.steel);
        for (const wz of [-1.28, 1.32]) {
          cyl(side * .94, .43 + rise * .4, wz, .395, .19, m.rubber, 0, Math.PI / 2);
          cyl(side * 1.042, .43 + rise * .4, wz, .285, .024, m.darkSteel, 0, Math.PI / 2);
          for (let spoke = 0; spoke < 5; spoke++) {
            const angle = spoke * Math.PI * 2 / 5;
            box(side * 1.057, .43 + rise * .4 + Math.cos(angle) * .14, wz + Math.sin(angle) * .14, .03, .29, .09, m.steel, 0, angle);
          }
          cyl(side * 1.08, .43 + rise * .4, wz, .078, .04, m.steel, 0, Math.PI / 2);
        }
        box(side * .65, .8 + rise, -2.11, .48, .055, .045, m.blueLight, 0, 0, side * -.1);
        box(side * .68, .69 + rise, -2.115, .23, .09, .04, m.opaqueGlass);
        for (let a = 0; a < 3; a++) box(side * .67, .75 + rise - a * .074, 2.11, .43, .035, .035, m.redLight, 0, 0, side * .06);
      }
      for (let y = .45 + rise; y < .69 + rise; y += .06) box(0, y, -2.114, .94, .018, .03, m.black);
      box(0, .77 + rise, -2.124, .16, .08, .028, m.steel);
      box(0, .53 + rise, 2.123, .4, .18, .025, m.white);
      box(0, .42 + rise, -2.133, .4, .15, .025, m.white);
    });
    const swap = Math.abs(Math.sin(yaw)) > .5; collider(x, z, swap ? 4.6 : 2.16, swap ? 2.16 : 4.6, 'car');
  }
  vehicle(-21, 32.25, Math.PI / 2, 0xa8afb3); vehicle(31.7, 17, 0, 0xeaebe4); vehicle(13, -30.4, Math.PI / 2, 0x24394f, true);
  for (const z of [13.5, 20.5, 26.5]) box(31.8, .163, z, 4.1, .017, .1, m.white);

  // Low-cost surrounding blocks give the playable streets a coherent skyline.
  // Windows share one batched material and all geometry remains in true 3D.
  const skylineColors = [m.plaster, m.mint, m.coral, m.concrete];
  const skyline = [[-47,-25,10,19,12],[-47,-5,10,13,14],[-47,19,10,23,15],[-26,-48,14,15,11],[-7,-48,15,24,11],[15,-48,15,18,11],[34,-48,12,12,11],[48,-22,11,21,17],[48,3,11,13,18],[48,28,11,19,14],[-23,48,17,18,10],[0,48,15,24,10],[25,48,18,14,10]];
  skyline.forEach(([x,z,w,h,d], i) => {
    const material = skylineColors[i % skylineColors.length]; box(x, h / 2, z, w, h, d, material);
    box(x, h + .2, z, w + .6, .4, d + .6, m.white); box(x, .65, z, w + .15, 1.3, d + .15, m.darkSteel);
    const front = z < -35 ? z + d / 2 + .03 : z > 35 ? z - d / 2 - .03 : z;
    if (Math.abs(z) > 35) {
      for (let wx = x - w / 2 + 1.4; wx < x + w / 2 - .7; wx += 2.7) for (let wy = 2.8; wy < h - .5; wy += 3.1) box(wx, wy, front, 1.32, 1.6, .06, m.opaqueGlass);
    } else {
      const side = x < 0 ? x + w / 2 + .03 : x - w / 2 - .03;
      for (let wz = z - d / 2 + 1.4; wz < z + d / 2 - .7; wz += 2.7) for (let wy = 2.8; wy < h - .5; wy += 3.1) box(side, wy, wz, .06, 1.6, 1.32, m.opaqueGlass);
    }
    collider(x, z, w, d, 'building');
  });

  let instanceCount = 0;
  batches.forEach(({ geo, material, matrices }) => {
    const mesh = new THREE.InstancedMesh(geo, material, matrices.length);
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = material !== m.glass && material !== m.paint && material !== m.light;
    mesh.receiveShadow = true; mesh.computeBoundingSphere(); mesh.name = 'Hub shared geometry';
    group.add(mesh); instanceCount += matrices.length;
  });
  group.userData.geometryInstances = instanceCount;
  group.userData.drawCalls = group.children.filter(child => child.isMesh).length;
  const entrances = [
    { id: 'store', name: 'Tienda SIDE', x: offsetX - 19, z: 26, rotation: Math.PI },
    { id: 'warehouse', name: 'Almacén SIDE', x: offsetX - 20, z: -9, rotation: Math.PI },
    { id: 'production', name: 'Lugar de Producción', x: offsetX + 20, z: -9, rotation: Math.PI }
  ];
  return {
    group, colliders, entrances, kiosk: { x: offsetX + kioskX, z: kioskZ + 1.45 },
    spawn: { x: offsetX + 16, z: 27 }, groundY: .025,
    patrolRoutes: [
      [[13.5, 13.5], [24.5, 13.5], [24.5, 24.5], [13.5, 24.5]],
      [[7, 12.5], [7, 25], [12.5, 25], [12.5, 12.5]],
      [[11, -9.9], [28.7, -9.9], [28.7, -6.1], [11, -6.1]]
    ].map(route => route.map(([x, z]) => ({ x: x + offsetX, z }))),
    updateDistrict,
    dispose() {
      group.removeFromParent(); group.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
      resources.forEach(resource => resource.dispose()); group.clear();
    }
  };
}
