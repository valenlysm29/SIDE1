'use strict';

// Build only reviewed, licensed NPCs. Run from SIDE1:
// node tools/model-pipeline/build_city_npcs.cjs [--low]
// Input: assets/models/incoming/curated.json (see README.md).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { dedup, prune, textureCompress } = require('@gltf-transform/functions');
const sharp = require('sharp');

const root = path.resolve(__dirname, '../..');
const incoming = path.join(root, 'assets/models/incoming');
const privateMixamo = process.argv.includes('--private-mixamo');
const outputDir = path.join(root, privateMixamo ? 'assets/models/npc/private' : 'assets/models/npc');
const curatedFile = path.join(incoming, privateMixamo ? 'mixamo/curated.json' : 'curated.json');
const low = process.argv.includes('--low');
const textureLimit = low ? 512 : 1024;
const byteLimit = 1_500_000;
const totalLimit = 25_000_000;
const blockedHashes = new Set([
  'chico1', 'chico2', 'chico3', 'mona',
].map(id => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, `assets/models3d/npcs/${id}.glb`))).digest('hex')));

function checkEntry(entry, ids) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw Error('Entrada de curación inválida');
  for (const key of ['id', 'nombre', 'genero', 'rol', 'archivo', 'altura', 'licencia', 'fuente', 'url']) {
    if (entry[key] === undefined || entry[key] === null || entry[key] === '') throw Error(`${entry.id || '<sin id>'}: falta ${key}`);
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(entry.id) || ids.has(entry.id)) throw Error(`id inválido o repetido: ${entry.id}`);
  ids.add(entry.id);
  if (!['cliente', 'tienda', 'almacen', 'produccion'].includes(entry.rol)) throw Error(`${entry.id}: rol inválido`);
  if (!Number.isFinite(entry.altura) || entry.altura < 1 || entry.altura > 2.3) throw Error(`${entry.id}: altura inválida`);
  if (entry.fuente.toLowerCase().includes('en3d')) throw Error(`${entry.id}: En3D bloqueado hasta confirmar licencia de avatares y pesos por escrito`);
  if (privateMixamo) {
    if (entry.fuente !== 'Mixamo' || entry.licencia !== 'Mixamo' || entry.url !== 'https://www.mixamo.com/') throw Error(`${entry.id}: fuente/licencia Mixamo inválida`);
    if (!/\.fbx$/i.test(entry.archivo)) throw Error(`${entry.id}: Mixamo requiere un FBX con skin`);
    if (!entry.animations || typeof entry.animations !== 'object') throw Error(`${entry.id}: faltan FBX de animación`);
    for (const clip of ['idle','walk','run']) if (!entry.animations[clip]) throw Error(`${entry.id}: falta FBX ${clip}`);
    for (const [clip, relative] of Object.entries(entry.animations)) {
      if (!/^[a-z][a-z0-9_]*$/.test(clip) || typeof relative !== 'string' || !/\.fbx$/i.test(relative)) throw Error(`${entry.id}: animación inválida ${clip}`);
      const animationPath=path.resolve(root,relative), mixamoRoot=path.join(incoming,'mixamo');
      if(!animationPath.startsWith(mixamoRoot+path.sep)||!fs.existsSync(animationPath)) throw Error(`${entry.id}: FBX de ${clip} inexistente o fuera de mixamo`);
    }
  } else {
    if (entry.fuente.toLowerCase().includes('mixamo')) throw Error(`${entry.id}: Mixamo requiere --private-mixamo`);
    if (!/^(CC0|CC0-1\.0)$/i.test(entry.licencia)) throw Error(`${entry.id}: licencia no confirmada para publicación (${entry.licencia})`);
  }
  const full = path.resolve(root, entry.archivo);
  const sourceRoot=privateMixamo?path.join(incoming,'mixamo'):incoming;
  if (!full.startsWith(sourceRoot + path.sep) || !fs.existsSync(full)) throw Error(`${entry.id}: archivo inexistente o fuera de incoming: ${entry.archivo}`);
  if (!/\.(glb|gltf|fbx)$/i.test(full)) throw Error(`${entry.id}: formato no admitido`);
  return full;
}

function convertFbx(file, id, entry) {
  const blender = process.env.BLENDER_PATH;
  if (!blender || !fs.existsSync(blender)) throw Error(`${id}: FBX requiere BLENDER_PATH apuntando a Blender`);
  const tmp = path.join(__dirname, '.tmp');
  fs.mkdirSync(tmp, { recursive: true });
  const glb = path.join(tmp, `${id}.glb`);
  const script = path.join(__dirname, privateMixamo?'mixamo_fbx_to_glb.py':'fbx_to_glb.py');
  const args = ['--background', '--python', script, '--', file, glb];
  if(privateMixamo)args.push(JSON.stringify(Object.fromEntries(Object.entries(entry.animations).map(([name,relative])=>[name,path.resolve(root,relative)]))));
  const result = spawnSync(blender, args, { encoding: 'utf8', maxBuffer: 10_000_000 });
  if (result.status !== 0 || !fs.existsSync(glb)) throw Error(`${id}: Blender falló: ${result.stderr || result.stdout}`);
  return glb;
}

function triangleCount(document) {
  let count = 0;
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    if (primitive.getMode() !== 4) continue;
    const indices = primitive.getIndices();
    const positions = primitive.getAttribute('POSITION');
    count += (indices ? indices.getCount() : positions?.getCount() || 0) / 3;
  }
  return Math.floor(count);
}

async function main() {
  if (!fs.existsSync(curatedFile)) throw Error(`Falta ${curatedFile}; no se publican modelos sin curación visual y licencia confirmada`);
  const entries = JSON.parse(fs.readFileSync(curatedFile, 'utf8'));
  if (!Array.isArray(entries) || !entries.length) throw Error('curated.json no contiene modelos aprobados');
  const ids = new Set();
  const sources = entries.map(entry => checkEntry(entry, ids));
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const built = [];
  fs.mkdirSync(outputDir, { recursive: true });
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const original = sources[i];
    const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(original)).digest('hex');
    if (blockedHashes.has(sourceHash)) throw Error(`${entry.id}: idéntico a un avatar elegible`);
    const source = /\.fbx$/i.test(original) ? convertFbx(original, entry.id, entry) : original;
    const document = await io.read(source);
    if(privateMixamo){
      if(!document.getRoot().listSkins().length)throw Error(`${entry.id}: GLB exportado sin skin`);
      const skinned=document.getRoot().listMeshes().some(mesh=>mesh.listPrimitives().some(primitive=>primitive.getAttribute('JOINTS_0')&&primitive.getAttribute('WEIGHTS_0')));
      if(!skinned)throw Error(`${entry.id}: GLB exportado sin pesos de skin`);
    }
    await document.transform(dedup(), prune(), textureCompress({ encoder: sharp, resize: [textureLimit, textureLimit], quality: 85 }));
    const triangles = triangleCount(document);
    const clips = document.getRoot().listAnimations().map(clip => clip.getName()).filter(Boolean);
    if(privateMixamo)for(const required of ['idle','walk','run'])if(!clips.some(name=>name.toLowerCase().includes(required)))throw Error(`${entry.id}: exportación sin clip ${required}`);
    for (const minimum of ['idle', 'walk', 'run']) {
      if (!clips.some(name => name.toLowerCase().includes(minimum))) console.warn(`${entry.id}: falta clip ${minimum}; requiere fase D`);
    }
    const fileName = `${entry.id}${low ? '.low' : ''}.glb`;
    const target = path.join(outputDir, fileName);
    await io.write(target, document);
    const bytes = fs.statSync(target).size;
    built.push({
      id: entry.id, nombre: entry.nombre, genero: entry.genero, rol: entry.rol,
      archivo: `assets/models/npc/${privateMixamo?'private/':''}${fileName}`, clips, altura: entry.altura,
      triangulos: triangles, licencia: entry.licencia, fuente: entry.fuente, url: entry.url,
      ...(privateMixamo?{privado:true}:{}),
      bytes, sha256: crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'),
    });
    console.log(`${entry.id}: ${triangles} triángulos, ${bytes} bytes, clips: ${clips.join(', ') || 'ninguno'}`);
    if (bytes > byteLimit) console.warn(`${entry.id}: excede meta de 1.5 MB`);
  }
  const total = built.reduce((sum, item) => sum + item.bytes, 0);
  if (total > totalLimit) console.warn(`Lote: ${total} bytes, excede meta de 25 MB`);
  if (!low) fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(built, null, 2) + '\n');
  console.log(`${built.length} NPC construidos, ${total} bytes en total`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
