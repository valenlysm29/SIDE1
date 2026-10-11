'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),cp=require('node:child_process');
const commit='9fbe6ec012db7e1440459551f62b40992df261d6',file='tools/npc_preview.html',git='C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe';
const tree=cp.execFileSync(git,['ls-tree',commit,file],{encoding:'utf8'}),oid=tree.split(/\s+/)[2],bytes=fs.readFileSync(file),actual=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
const original=actual===oid?bytes:cp.execFileSync(git,['-c','core.packedGitWindowSize=1m','-c','core.packedGitLimit=1m','show',commit+':'+file]);
if(crypto.createHash('sha1').update(Buffer.from('blob '+original.length+'\0')).update(original).digest('hex')!==oid)throw Error('Blob inválido');
fs.mkdirSync('.codex-work/atribucion-9fbe6ec/tools',{recursive:true});fs.writeFileSync('.codex-work/atribucion-9fbe6ec/'+file,original);
fs.writeFileSync('reports/sim/atribucion-supplied-npcs/preview-verificado.json',JSON.stringify({commit,file,oid},null,2));console.log('preview exacto',oid);
