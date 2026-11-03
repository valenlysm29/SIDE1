'use strict';
// Builds a disposable CLI project under tests/output; never changes production
// migration files or an existing local database/volume.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),suffix=process.argv[2]||'local';if(!/^[a-z0-9-]+$/.test(suffix))throw Error('Usa un identificador local con letras minúsculas, números o guiones.');
const workspace=path.join(root,'tests','output','side-lab-'+suffix),supabase=path.join(workspace,'supabase'),source=path.join(root,'supabase','migrations');
if(fs.existsSync(workspace))throw Error('Ya existe '+workspace+'; conserva esa instalación y usa otro identificador.');
fs.mkdirSync(workspace,{recursive:true});
const cli=process.platform==='win32'?'npx.cmd':'npx';
const init=cp.spawnSync(cli,['supabase','init','--workdir',workspace],{cwd:root,stdio:'inherit',shell:process.platform==='win32'});
if(init.status!==0)throw Error('No se pudo inicializar el proyecto local.');
fs.mkdirSync(path.join(supabase,'migrations'),{recursive:true});
const configFile=path.join(supabase,'config.toml');let config=fs.readFileSync(configFile,'utf8');
config=config.replace(/^project_id\s*=.*$/m,`project_id = "side-lab-${suffix}"`).replaceAll('5432','5642');fs.writeFileSync(configFile,config);
const files=[['20260914000000',path.join(root,'supabase','local-baseline','01_tablas_preexistentes.sql')],['20260915000000',path.join(source,'supabase_migration.sql')],['20260916000000',path.join(source,'supabase_teacher_integration.sql')],['20261001000000',path.join(source,'supabase_game_lifecycle.sql')],['20261002000000',path.join(source,'supabase_student_admission.sql')]];
const overrides={'2026-10-11_fix_crear_partida.sql':'20261010000000','2026-10-11_recuperar_salas_compatibles.sql':'20261010000001','2026-10-12_salas_codigo.sql':'20261011595959'};
for(const name of fs.readdirSync(source)){
 if(!/^(?:\d{8,14}|\d{4}-\d{2}-\d{2})_.*\.sql$/.test(name)||name==='20260913000000_esquema_inicial.sql')continue;
 const raw=name.split('_')[0].replaceAll('-',''),version=overrides[name]||(raw.length===8?raw+'000000':raw);files.push([version,path.join(source,name)]);
}
files.sort((a,b)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1]));const used=new Set(),manifest=[];
for(let [version,file] of files){while(used.has(version))version=String(BigInt(version)+1n);used.add(version);const name=path.basename(file).replace(/^\d[\d-]*_/,'').replace(/^supabase_/,'');const dest=version+'_'+name;fs.copyFileSync(file,path.join(supabase,'migrations',dest));manifest.push({source:path.relative(root,file),local:dest});}
fs.writeFileSync(path.join(workspace,'manifest.json'),JSON.stringify(manifest,null,2));
console.log('Preparado:',workspace);console.log(`Inicia con: npx supabase start --workdir tests/output/side-lab-${suffix}`);
