import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const rows=JSON.parse(fs.readFileSync(path.join(root,'assets/models/npc/manifest.pending.json'),'utf8'));
const productionPath=path.join(root,'assets/models/npc/manifest.json');
const approved=fs.existsSync(productionPath)?JSON.parse(fs.readFileSync(productionPath,'utf8')):[];
const pack=path.join(root,'output/npc_pack');
if(rows.length!==20||rows.filter(row=>row.genero==='mujer').length!==10||rows.filter(row=>row.genero==='hombre').length!==10)throw Error('Se requieren 20 plazas: 10 mujeres y 10 hombres');
if(new Set(rows.map(row=>row.slug)).size!==20||rows.some((row,i)=>row.slot!==i+1))throw Error('Plazas o slugs duplicados');
if(!Array.isArray(approved)||approved.some(row=>!row.id||!row.archivo||!row.clips?.length))throw Error('Manifest de producción inválido');
const approvedSlugs=new Set(approved.map(row=>row.slug||row.id.replace(/^npc_/,'')));
if(approvedSlugs.size!==approved.length||approved.some(row=>!rows.some(slot=>slot.slug===(row.slug||row.id.replace(/^npc_/,'')))))throw Error('NPC aprobado fuera de las 20 plazas');
fs.mkdirSync(path.join(pack,'models'),{recursive:true});
fs.mkdirSync(path.join(pack,'pending'),{recursive:true});
if(!approved.length)fs.writeFileSync(path.join(pack,'models/README.md'),'No hay GLB aprobados. Esta carpeta recibirá únicamente npc_<slug>.glb después de validar rig, los tres clips In Place y la deformación.\n');
const packaged=approved.map(row=>{
  const slug=row.slug||row.id.replace(/^npc_/,'');
  const source=path.resolve(root,row.archivo);
  if(!source.startsWith(path.join(root,'assets/models/npc')+path.sep)||!fs.existsSync(source))throw Error(`GLB aprobado ausente o fuera de NPC: ${row.archivo}`);
  const name=`npc_${slug}.glb`;
  fs.copyFileSync(source,path.join(pack,'models',name));
  return {...row,archivo:`models/${name}`};
});
fs.writeFileSync(path.join(pack,'manifest.json'),JSON.stringify(packaged,null,2)+'\n');
const pending=rows.filter(row=>!approvedSlugs.has(row.slug));

const todo=[
  '# Archivos Mixamo pendientes',
  '',
  'Cada fila requiere un único personaje y sus tres animaciones exportadas desde ese mismo personaje en Mixamo. Los FBX ya recibidos de la columna Origen están en `assets/models/incoming/mixamo/` dentro de SIDE1; para las plazas 15–20 hay que conseguir primero un modelo urbano distinto. Subir ese personaje a Mixamo y descargar Idle, Walking y Running en FBX, con **In Place activado** para las tres. Guardar los archivos con estos nombres exactos en `pending/`. No mezclar clips de otro personaje aunque coincidan los nombres de huesos.',
  '',
  'Ningún archivo se cuenta como aprobado sin malla original compatible, jerarquía y rest pose idénticas, Hips In Place, exportación GLB y revisión visual de Idle/Walk/Run.',
  '',
  '| Slot | Personaje | Origen para subir | Idle | Walking | Running |',
  '| --- | --- | --- | --- | --- | --- |'
];
for(const row of pending){
  const original=row.fuente?.startsWith('Mixamo: ')?row.fuente.slice(8):`pending/${row.slug}_skin.fbx (por conseguir)`;
  const walk=row.slug==='traje_azul'?'personaje3Walking.fbx (recibido; rig exacto)':`${row.slug}_walk.fbx`;
  todo.push(`| ${row.slot} | ${row.slug} | ${original} | ${row.slug}_idle.fbx | ${walk} | ${row.slug}_run.fbx |`);
}
todo.push('','Para las plazas 15–20, guardar además el modelo original como `<slug>_skin.fbx` en `pending/` y verificar vestuario, procedencia y licencia antes de procesarlo.');
todo.push('','## FBX recibidos y reasignaciones comprobadas','','Los FBX están en `assets/models/incoming/mixamo/pending/`. Los grupos 1, 2, 4 y 5 son tríos de clips sin malla, internamente compatibles, pero carecen de FBX With Skin con su rig. El grupo 3 tiene Idle y Run sin malla; le faltan Walk y Skin del mismo rig.','','| Grupo | Idle recibido | Walk recibido | Run recibido | Falta |','| --- | --- | --- | --- | --- |','| 1 | personaje1_Idle.fbx | personaje1_Walking.fbx | personaje1_Running.fbx | personaje1_skin.fbx compatible |','| 2 | personaje2_Idle.fbx | perosnaje2_Walking.fbx | perosnaje2Running.fbx | personaje2_skin.fbx compatible |','| 3 | personaj3Idle.fbx | — | personaje3Running.fbx | personaje3_skin.fbx y personaje3_walk.fbx compatibles |','| 4 | perosnaje4Idle.fbx | perosnaje4Walking.fbx | personaje4Running.fbx | personaje4_skin.fbx compatible |','| 5 | perosnaje5Idle (1).fbx | peronsaje5Walking (1).fbx | personaje5Running (1).fbx | personaje5_skin.fbx compatible |','','`personaje3Walking.fbx` es un FBX With Skin y Walk In Place; su rig coincide exactamente con el candidato `traje_azul` del slot 11 (`Walk (6).fbx`), pero difiere del Idle/Run del grupo 3. Se asocia solo como Walk del slot 11: faltan `traje_azul_idle.fbx` y `traje_azul_run.fbx` del mismo rig. El inventario y las medidas están en `reports/mixamo_pending_2026-09-29.md` dentro de SIDE1.');
fs.writeFileSync(path.join(pack,'MIXAMO_TODO.md'),todo.join('\n')+'\n');
fs.writeFileSync(path.join(pack,'pending/README.md'),'Los FBX recibidos están en assets/models/incoming/mixamo/pending/. Solo personaje3Walking.fbx tiene malla y se asocia al Walk del slot 11 por coincidencia exacta de rig; aún falta Idle/Run. Los archivos exactos pendientes están en ../MIXAMO_TODO.md.\n');

const credits=[
  '# Procedencia y licencias',
  '',
  `${approved.length} modelos aprobados en este paquete. Las primeras 14 filas pendientes son candidatos visuales aportados como FBX de Mixamo; el autor original y el permiso de redistribución independiente no están verificados. Las últimas seis plazas aún no tienen modelo. Ningún FBX original de Mixamo se incluye en el ZIP.`,
  '',
  '| Slot | Personaje | Autor | Fuente | Licencia / permiso |',
  '| --- | --- | --- | --- | --- |'
];
for(const row of rows)credits.push(`| ${row.slot} | ${row.slug} | ${row.autor||'por verificar'} | ${row.fuente||'por verificar'} | ${row.licencia||'por verificar'} |`);
credits.push('','`personaje3Walking.fbx` coincide por rig exacto con el candidato del slot 11 (`traje_azul`) y aporta un Walk In Place; no aporta Idle/Run compatibles, por lo que el personaje sigue pendiente.','','Adobe permite usar personajes y animaciones Mixamo en videojuegos según [su FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html); eso no identifica al autor original de cada FBX aportado ni acredita redistribución independiente. Se mantienen como `por verificar` donde corresponda.','','Fuentes investigadas pero no incorporadas: Quaternius Ultimate Modular Men/Women (CC0 1.0; descargas oficiales bloqueadas por cuota), Quaternius Universal Base Characters y Universal Animation Library 2 (CC0 1.0; vestuario/acciones insuficientes), Kenney (CC0 1.0; estilo descartado). Véase `LICENSES/` para la evidencia guardada.');
fs.writeFileSync(path.join(pack,'CREDITS.md'),credits.join('\n')+'\n');
console.log(`Preparadas ${rows.length} plazas, ${approved.length} publicadas, en ${pack}`);
