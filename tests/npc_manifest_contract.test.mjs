import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifestPath=path.join(root,'assets/models/npc/manifest.json');
const present=fs.existsSync(manifestPath);
const rows=present?JSON.parse(fs.readFileSync(manifestPath,'utf8')):[];
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const playable=['chico1','chico2','chico3','mona'];

test('the city manifest can be absent or contain no released models',()=>{
  if(!present)assert.equal(rows.length,0);
  else assert.ok(Array.isArray(rows));
});

test('released NPC manifest contains only unique IDs and existing files',{skip:!present},()=>{
  assert.ok(Array.isArray(rows));
  assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);
  for(const row of rows){
    assert.match(row.id,/^[a-z0-9_-]+$/);
    assert.ok(!playable.includes(row.id));
    assert.match(row.archivo,/^assets\/models\/npc\/[a-z0-9_-]+\.glb$/);
    assert.ok(fs.existsSync(path.join(root,row.archivo)),`${row.id}: missing ${row.archivo}`);
  }
});

test('released NPCs contain idle, walk and run clips',{skip:!present},()=>{
  for(const row of rows){
    const names=(row.clips||[]).map(name=>String(name).toLowerCase());
    for(const clip of ['idle','walk','run'])assert.ok(names.some(name=>name.includes(clip)),`${row.id}: missing ${clip}`);
    const file=fs.readFileSync(path.join(root,row.archivo));
    assert.equal(file.toString('ascii',0,4),'glTF',`${row.id}: not a GLB`);
    const jsonLength=file.readUInt32LE(12);
    const gltf=JSON.parse(file.toString('utf8',20,20+jsonLength));
    const actual=(gltf.animations||[]).map(item=>String(item.name||'').toLowerCase());
    for(const clip of ['idle','walk','run'])assert.ok(actual.some(name=>name.includes(clip)),`${row.id}: ${clip} only declared in manifest`);
  }
});

test('released NPC GLBs differ from playable avatars and each other',{skip:!present},()=>{
  const playerHashes=new Set();
  for(const id of playable){
    const source=JSON.parse(fs.readFileSync(path.join(root,`tools/model-sources/${id}/manifest.json`),'utf8'));
    playerHashes.add(source.outputSha256);
  }
  const npcHashes=rows.map(row=>hash(path.join(root,row.archivo)));
  assert.equal(new Set(npcHashes).size,npcHashes.length,'duplicate NPC GLBs');
  for(let i=0;i<rows.length;i++){
    assert.ok(!playerHashes.has(npcHashes[i]),`${rows[i].id}: identical to selectable avatar`);
    if(rows[i].sha256)assert.equal(rows[i].sha256,npcHashes[i],`${rows[i].id}: stale manifest hash`);
  }
});
