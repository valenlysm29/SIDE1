'use strict';
// Copias aisladas y verificadas; instrumentación exclusiva del arnés.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http');
const {execFileSync,spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),base=path.join(root,'.codex-work/atribucion-9fbe6ec');
const head=path.join(root,'.codex-work/carga-head-459c062'),out=path.join(root,'reports/sim',process.argv.includes('--lock')?'carga-legacy-cont3-pointer-lock':'carga-legacy-cont3');
const commits={baseline:'9fbe6ec012db7e1440459551f62b40992df261d6',head:'459c062d87dc6615e9a0cb8a5111624572608286'};
const git='C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe';
const gitRun=args=>execFileSync(git,['-c','core.packedGitWindowSize=1m','-c','core.packedGitLimit=1m',...args],{cwd:root,maxBuffer:150*1024*1024});
const oid=bytes=>crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
fs.mkdirSync(out,{recursive:true});
function snapshot(label,dir){
  const entries=gitRun(['ls-tree','-r',commits[label]]).toString().trim().split('\n');const evidence=[];
  for(const line of entries){const match=/^\d+ blob ([0-9a-f]+)\t(.+)$/.exec(line);if(!match)continue;
    const [,expected,file]=match;if(!/^(?:js\/|css\/|services\/|assets\/|vendor\/)/.test(file)&&!(/^[^/]+\.html$/.test(file)||/^tests\/[^/]+\.cjs$/.test(file)))continue;
    const dest=path.join(dir,file);fs.mkdirSync(path.dirname(dest),{recursive:true});
    let bytes=fs.existsSync(dest)?fs.readFileSync(dest):null;
    if(!bytes||oid(bytes)!==expected){const candidate=path.join(label==='head'?base:root,file);const source=fs.existsSync(candidate)?fs.readFileSync(candidate):null;
      if(fs.existsSync(dest))fs.unlinkSync(dest);
      if(source&&oid(source)===expected&&/^(?:assets|vendor)\//.test(file))fs.linkSync(candidate,dest);
      else fs.writeFileSync(dest,source&&oid(source)===expected?source:gitRun(['show',commits[label]+':'+file]));
      bytes=fs.readFileSync(dest);
    }
    if(oid(bytes)!==expected)throw new Error('Blob incorrecto '+label+' '+file);
    evidence.push({file,oid:expected,bytes:bytes.length});
  }
  fs.writeFileSync(path.join(out,label+'-blobs.json'),JSON.stringify({commit:commits[label],files:evidence},null,2));
  console.log('SNAPSHOT '+label+' '+evidence.length+' blobs verificados');
}
function instrument(dir,suite,lock){
  let s=fs.readFileSync(path.join(dir,'tests',suite),'utf8');
  const inject=`
    page.on('pageerror',e=>console.log('[PAGEERROR] '+e.message));
    const originalWait=page.waitForFunction.bind(page);let waitId=0;
    page.waitForFunction=async(...args)=>{const id=++waitId,start=Date.now();
      const state=async()=>{try{return await page.evaluate(()=>({t:performance.now(),loading:typeof simulationLoadingActive==='undefined'?null:simulationLoadingActive,diagnostics:window.SIDE3D?.diagnostics?.()}));}catch(e){return {error:e.message};}};
      console.log('[WAIT_START] '+JSON.stringify({id,state:await state()}));
      try{const value=await originalWait(...args);console.log('[WAIT_END] '+JSON.stringify({id,ms:Date.now()-start,ok:true,state:await state()}));return value;}
      catch(e){console.log('[WAIT_END] '+JSON.stringify({id,ms:Date.now()-start,ok:false,state:await state()}));throw e;}
    };
    ${lock?"await page.addInitScript(()=>{Element.prototype.requestPointerLock=function(){return Promise.resolve();};});":''}
    await page.addInitScript(()=>{addEventListener('load',()=>{if(typeof startSimulationLoading==='function'){const original=startSimulationLoading;startSimulationLoading=async function(...args){const t=performance.now();try{const value=await original.apply(this,args);console.log('[PREPARE] '+JSON.stringify({ms:performance.now()-t,value}));return value;}catch(e){console.log('[PREPARE] '+JSON.stringify({ms:performance.now()-t,error:e.message}));throw e;}};}});});
    page.on('console',m=>{if(m.text().startsWith('[PREPARE]'))console.log(m.text());});
`;
  const anchor='await page.goto(url,';if(!s.includes(anchor))throw new Error('Anchor inexistente');s=s.replace(anchor,inject+'\n    '+anchor);
  const target=path.join(dir,'tests',suite.replace('.cjs',lock?'_lock_diagnostic.cjs':'_diagnostic.cjs'));fs.writeFileSync(target,s);return target;
}
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
const results=[];
async function run(label,dir,suite,iteration,lock=false){
  const server=http.createServer((req,res)=>{let file;try{file=path.resolve(dir,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}if(file===dir)file=path.join(dir,'index.html');if(!file.startsWith(dir+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const name=`${suite}-${label}-${iteration}${lock?'-lock':''}`,logfile=path.join(out,name+'.log'),log=fs.createWriteStream(logfile),start=Date.now();let text='';
  console.log('RUN '+name);
  const child=spawn(process.execPath,[instrument(dir,suite,lock)],{cwd:dir,windowsHide:true,env:{...process.env,NODE_PATH:path.join(root,'tests/node_modules'),SIDE_TEST_URL:`http://127.0.0.1:${server.address().port}/`},stdio:['ignore','pipe','pipe']});
  for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log.write(chunk);text+=chunk;});
  const timer=setTimeout(()=>child.kill(),240000),code=await new Promise(resolve=>child.once('exit',resolve));clearTimeout(timer);await new Promise(resolve=>log.end(resolve));server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  const waits=text.split(/\r?\n/).filter(x=>x.startsWith('[WAIT_END] ')).map(x=>JSON.parse(x.slice(11)));
  const prepare=text.split(/\r?\n/).filter(x=>x.startsWith('[PREPARE] ')).map(x=>JSON.parse(x.slice(10)));
  results.push({suite,label,commit:commits[label],iteration,lock,code,passed:code===0,durationMs:Date.now()-start,waits,prepare,log:path.relative(root,logfile),message:text.slice(-2500)});
  fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({conditions:{chrome:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'],concurrentBrowsers:1,commits},results},null,2));console.log('DONE '+name+' '+code+' '+(Date.now()-start)+'ms');
}
(async()=>{
  snapshot('baseline',base);snapshot('head',head);
  const lock=process.argv.includes('--lock');
  for(const suite of lock?['continuous_world.cjs']:['continuous_world.cjs','world_cycle_restart.cjs'])for(let i=1;i<=5;i++)for(const [label,dir] of [['baseline',base],['head',head]])await run(label,dir,suite,i,lock);
})().catch(error=>{console.error(error);process.exitCode=1});

