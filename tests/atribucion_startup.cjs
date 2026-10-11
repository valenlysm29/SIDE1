'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http'),{execFileSync,spawn}=require('node:child_process');
const suite=process.argv.includes('--continuous')?'continuous_world.cjs':process.argv.includes('--npc')?'supplied_npcs.cjs':'world_startup.cjs';
const root=path.resolve(__dirname,'..'),base=path.join(root,'.codex-work/atribucion-9fbe6ec'),out=path.join(root,'reports/sim',process.argv.includes('--continuous')?'atribucion-continuous-world':process.argv.includes('--npc')?'atribucion-supplied-npcs':'atribucion-startup');
const git='C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe',commit='9fbe6ec012db7e1440459551f62b40992df261d6';
fs.mkdirSync(out,{recursive:true});
// Reutiliza únicamente binarios cuyo SHA-1 Git coincide con el blob del commit.
const arbol=process.argv.includes('--assets-ready')?[]:execFileSync(git,['ls-tree','-r',commit,'assets','vendor'],{cwd:root,encoding:'utf8',maxBuffer:10*1024*1024}).trim().split('\n'),evidencia=[];
for(const linea of arbol){const match=/^\d+ blob ([0-9a-f]+)\t(.+)$/.exec(linea);if(!match)continue;const [,oid,file]=match,source=path.join(root,file),dest=path.join(base,file);if(!fs.existsSync(source))throw new Error('Falta asset tracked '+file);
  const bytes=fs.readFileSync(source),actual=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  if(actual!==oid){const original=execFileSync(git,['-c','core.packedGitWindowSize=1m','-c','core.packedGitLimit=1m','show',commit+':'+file],{cwd:root,maxBuffer:128*1024*1024});const verified=crypto.createHash('sha1').update(Buffer.from('blob '+original.length+'\0')).update(original).digest('hex');if(verified!==oid)throw new Error('Blob baseline inválido '+file);if(fs.existsSync(dest))fs.unlinkSync(dest);fs.writeFileSync(dest,original);}
  else if(!fs.existsSync(dest))fs.linkSync(source,dest);
  evidencia.push({file,oid,bytes:bytes.length,metodo:actual===oid?'enlace de blob idéntico':'blob exacto git show'});
}
if(arbol.length)fs.writeFileSync(path.join(out,'assets-verificados.json'),JSON.stringify({commit,metodo:'SHA-1 Git completo + enlaces duros solo blobs idénticos',archivos:evidencia},null,2));
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
const resultados=[];
async function run(etiqueta,cwd){
  const server=http.createServer((req,res)=>{let file;try{file=path.resolve(cwd,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}if(file===cwd)file=path.join(cwd,'index.html');if(!file.startsWith(cwd+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const log=fs.createWriteStream(path.join(out,etiqueta+'.log')),start=Date.now();
  const child=spawn(process.execPath,[path.join(cwd,'tests',suite)],{cwd,windowsHide:true,env:{...process.env,NODE_PATH:path.join(root,'tests/node_modules'),SIDE_TEST_URL:`http://127.0.0.1:${server.address().port}/`},stdio:['ignore','pipe','pipe']});
  for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>log.write(chunk));
  const timer=setTimeout(()=>child.kill(),240000),exitCode=await new Promise(resolve=>child.once('exit',resolve));clearTimeout(timer);await new Promise(resolve=>log.end(resolve));server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  resultados.push({etiqueta,commitBaseline:commit,suite,exitCode,duracionMs:Date.now()-start,log:path.relative(root,path.join(out,etiqueta+'.log'))});fs.writeFileSync(path.join(out,'resultados.json'),JSON.stringify(resultados,null,2));console.log(etiqueta+' exit '+exitCode);
}
(async()=>{await run('antes',base);if(!process.argv.includes('--before-only'))await run('actual',root)})().catch(error=>{fs.writeFileSync(path.join(out,'error.txt'),String(error.stack));console.error(error);process.exitCode=1});
