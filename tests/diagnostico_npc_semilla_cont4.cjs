'use strict';
// Atribución dirigida; no modifica NPC/mundo ni assertions de supplied_npcs.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {execFileSync,spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),baseline=path.join(root,'.codex-work/atribucion-9fbe6ec');
const out=path.join(root,'reports/sim/npc-seed-cont4'),git='C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe';
const commitBaseline='9fbe6ec012db7e1440459551f62b40992df261d6',headCommit=execFileSync(git,['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const gitRun=args=>execFileSync(git,['-c','core.packedGitWindowSize=1m','-c','core.packedGitLimit=1m',...args],{cwd:root,maxBuffer:128*1024*1024});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const gitOid=bytes=>crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
fs.mkdirSync(out,{recursive:true});
const preview='tools/npc_preview.html',target=path.join(baseline,preview),expected=gitRun(['show',commitBaseline+':'+preview]);
fs.mkdirSync(path.dirname(target),{recursive:true});if(!fs.existsSync(target)||sha(fs.readFileSync(target))!==sha(expected))fs.writeFileSync(target,expected);
const evidence={baseline:commitBaseline,head:headCommit,previewSha256:sha(expected),files:{}};
// Verifica la copia que realmente sirve HTTP; no basta con comparar git show.
const baselineEntries=gitRun(['ls-tree','-r',commitBaseline]).toString().trim().split('\n');let verified=0;
for(const line of baselineEntries){const match=/^\d+ blob ([0-9a-f]+)\t(.+)$/.exec(line);if(!match)continue;const [,expectedOid,file]=match;
 if(!/^(?:js\/|css\/|services\/|assets\/|vendor\/)/.test(file)&&!(/^[^/]+\.html$/.test(file)||file==='tests/supplied_npcs.cjs'||file===preview))continue;
 const actualPath=path.join(baseline,file);if(!fs.existsSync(actualPath)||gitOid(fs.readFileSync(actualPath))!==expectedOid)throw new Error('Snapshot baseline distinto del commit: '+file);verified++;
}
evidence.actualBaselineVerifiedBlobs=verified;
// HEAD aislado de los cambios de modelos sin commit y de futuras ediciones.
const headSnapshot=path.join(root,'.codex-work','npc-head-'+headCommit.slice(0,7));let verifiedHead=0;
for(const line of gitRun(['ls-tree','-r',headCommit]).toString().trim().split('\n')){const match=/^\d+ blob ([0-9a-f]+)\t(.+)$/.exec(line);if(!match)continue;const [,expectedOid,file]=match;
 if(!/^(?:js\/|css\/|services\/|assets\/|vendor\/)/.test(file)&&!(/^[^/]+\.html$/.test(file)||file==='tests/supplied_npcs.cjs'||file===preview))continue;
 const destination=path.join(headSnapshot,file),candidate=path.join(baseline,file);fs.mkdirSync(path.dirname(destination),{recursive:true});
 const bytes=fs.existsSync(candidate)?fs.readFileSync(candidate):null;
 if(fs.existsSync(destination))fs.unlinkSync(destination);
 if(bytes&&gitOid(bytes)===expectedOid&&/^(?:assets|vendor)\//.test(file))fs.linkSync(candidate,destination);
 else fs.writeFileSync(destination,bytes&&gitOid(bytes)===expectedOid?bytes:gitRun(['show',headCommit+':'+file]));
 if(gitOid(fs.readFileSync(destination))!==expectedOid)throw new Error('Snapshot HEAD inválido '+file);verifiedHead++;
}
evidence.actualHeadVerifiedBlobs=verifiedHead;
for(const file of ['tests/supplied_npcs.cjs','js/simulator3d.js','services/npc_navigation.mjs','services/npc_optional_navigation.mjs','services/interior_navigation.mjs','services/business_interiors.mjs'])evidence.files[file]={baseline:sha(gitRun(['show',commitBaseline+':'+file])),head:sha(gitRun(['show',headCommit+':'+file]))};
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
const results=[];
async function run(label,cwd){
 const server=http.createServer((req,res)=>{let file;try{file=path.resolve(cwd,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}if(file===cwd)file=path.join(cwd,'index.html');if(!file.startsWith(cwd+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let source=fs.readFileSync(path.join(cwd,'tests/supplied_npcs.cjs'),'utf8');
 const previewStart=source.indexOf("  const context=await browser.newContext"),fallbackStart=source.indexOf("  for(const fallback of [false,true]) {");
 if(previewStart<0||fallbackStart<0)throw new Error('No se reconoce el arnés original');
 source=source.slice(0,previewStart)+source.slice(fallbackStart);
 source=source.replace('for(const fallback of [false,true]) {','for(const fallback of [true]) {');
 source=source.replace('assert.deepEqual(errors,[]);','');
 source=source.replace("    assert.equal(await p.evaluate(()=>__npcTest.enterStore()),'store');", "    await p.evaluate(()=>{let state=1;Math.random=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/4294967296);});\n    assert.equal(await p.evaluate(()=>__npcTest.enterStore()),'store');");
 // Únicamente redirige artefactos y añade consola de diagnóstico antes del assert.
 source=source.replace("const output=path.join(__dirname,'output/npcs');",`const output=${JSON.stringify(path.join(out,label))};`);
 source=source.replace("assert.ok(travel.states.includes('LEAVE_STORE')||travel.states.includes('QUEUE'),'customers complete a decision');",`console.log('[TRAVEL] '+JSON.stringify({fallback,states:travel.states,details:await p.evaluate(()=>__npcTest.inspect())}));\n    assert.ok(travel.states.includes('LEAVE_STORE')||travel.states.includes('QUEUE'),'customers complete a decision');`);
 source=source.replace("path.join(__dirname,'../js/simulator3d.js')",JSON.stringify(path.join(cwd,'js/simulator3d.js')));
 const file=path.join(root,'.codex-work','supplied_npcs_atribucion_'+label+'.cjs');fs.writeFileSync(file,source);
 const logfile=path.join(out,label+'.log'),log=fs.createWriteStream(logfile),started=Date.now();let text='';console.log('RUN '+label);
 const child=spawn(process.execPath,[file],{cwd,windowsHide:true,env:{...process.env,NODE_PATH:path.join(root,'tests/node_modules'),SIDE_TEST_URL:`http://127.0.0.1:${server.address().port}/`,SIDE_SKIP_SCREENSHOTS:'1'},stdio:['ignore','pipe','pipe']});
 for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>{log.write(bytes);text+=bytes;});
 let timedOut=false;const timer=setTimeout(()=>{timedOut=true;execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true});},480000);
 const exitCode=await new Promise(resolve=>child.once('exit',resolve));clearTimeout(timer);await new Promise(resolve=>log.end(resolve));server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 results.push({label,commit:label.startsWith('baseline')?commitBaseline:headCommit,exitCode,timedOut,durationMs:Date.now()-started,message:text.slice(-3000),fallback:fs.existsSync(path.join(out,label,'fallback-travel.json'))?JSON.parse(fs.readFileSync(path.join(out,label,'fallback-travel.json'),'utf8')):null,logSha256:sha(fs.readFileSync(logfile))});
 fs.writeFileSync(path.join(out,'summary_compacto.json'),JSON.stringify({evidence,conditions:{headless:true,flags:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'],concurrentBrowsers:1,timeout:480000,seededRandom:false,assertionsChanged:false},results},null,2));console.log('DONE '+label+' '+exitCode);
 // El arnés temporal en HEAD queda local/ignorado por ubicación .codex-work, o se elimina si usa tests/.
 fs.unlinkSync(file);
}
(async()=>{await run('baseline-seed1',baseline);await run('head-seed1',headSnapshot)})().catch(error=>{console.error(error);process.exitCode=1});

