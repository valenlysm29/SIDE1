'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.codex-work/atribucion-9fbe6ec'),commit='9fbe6ec012db7e1440459551f62b40992df261d6';
const git='C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe';
const files=execFileSync(git,['ls-tree','-r','--name-only',commit],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(file=>/^(?:js\/|css\/|services\/|assets\/icons\/)/.test(file)||/^tests\/(?!output\/|node_modules\/|__pycache__\/)[^/]+$/.test(file)||/^[^/]+\.(?:html|py)$/.test(file)||file==='assets/models/npc/manifest.json'||file==='assets/side_logo.png').sort((a,b)=>Number(b.startsWith('tests/'))-Number(a.startsWith('tests/')));
fs.mkdirSync(out,{recursive:true});
for(const file of files){const target=path.join(out,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,execFileSync(git,['-c','core.packedGitWindowSize=1m','-c','core.packedGitLimit=1m','show',commit+':'+file],{cwd:root,maxBuffer:64*1024*1024}));}
fs.writeFileSync(path.join(out,'BASELINE.json'),JSON.stringify({commit,metodo:'git show de cada blob tracked; git archive completo falló mmap',archivos:files},null,2));
console.log('Extracción exacta de '+files.length+' archivos tracked');
