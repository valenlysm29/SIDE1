'use strict';
// Runner secuencial sin copiar archivos históricos de OneDrive. Cada suite
// conserva su log; no se oculta un fallo aunque una suite posterior pase.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {spawn,spawnSync}=require('node:child_process');
const label=process.argv.find(x=>x.startsWith('--label='))?.slice(8)||'integral';
if(!/^[a-z0-9-]+$/.test(label))throw new Error('Etiqueta de ejecución inválida');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output/correcciones-2026-10-20',label);
const baseline=process.argv.includes('--baseline')?path.join(root,'.codex-work/correcciones-base-d1c83f3'):null;
fs.mkdirSync(out,{recursive:true});
const inventory=JSON.parse(spawnSync(process.execPath,['tests/run_integral.cjs','--list','--no-fps'],{cwd:root,encoding:'utf8'}).stdout);
const jobs=inventory.suites.filter(s=>s.kind!=='node'&&!s.optional).map(s=>({name:s.name,args:['tests/'+s.name],timeout:s.timeout}));
for(const name of ['access_corrections_20261020_db','access_corrections_20261020_browser','podio_programado_db','podio_programado_ui','excel_sql_db','excel_sql_activacion_db','sim_1','sim_2','sim_3','transicion_excel_browser','engine_corrections_20261020_browser'])jobs.push({name:name+'.cjs',args:['tests/'+name+'.cjs'],timeout:480000});
const only=process.argv.find(x=>x.startsWith('--only='))?.slice(7).split(',');
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.glb':'model/gltf-binary','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));}catch{res.writeHead(400).end();return;}
 if(file===root)file=path.join(root,'index.html');
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 if(baseline){const previous=path.join(baseline,path.relative(root,file));if(fs.existsSync(previous)&&fs.statSync(previous).isFile())file=previous;}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
 const stream=fs.createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);
});
const state={startedAt:new Date().toISOString(),baseline:baseline?'d1c83f3':null,results:[]};
const save=()=>fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(state,null,2));
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 for(const job of jobs.filter(j=>!only||only.includes(j.name))){
  const start=Date.now(),log=fs.createWriteStream(path.join(out,job.name+'.log'));console.log('RUN '+job.name);
  const python='C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
  const command=job.name.endsWith('.py')?python:process.execPath;
  const args=baseline?job.args.map(arg=>fs.existsSync(path.join(baseline,arg))?path.join(baseline,arg):arg):job.args;
  const child=spawn(command,args,{cwd:root,windowsHide:true,env:{...process.env,NODE_PATH:path.join(__dirname,'node_modules'),PYTHON_BIN:python,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1',SIDE_TEST_URL:`http://127.0.0.1:${server.address().port}/`},stdio:['ignore','pipe','pipe']});
  child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true});},job.timeout||180000);
  const code=await new Promise(r=>{child.once('error',e=>{log.write(String(e));r(-1);});child.once('close',r);});clearTimeout(timer);await new Promise(r=>log.end(r));
  state.results.push({name:job.name,exitCode:code,timedOut,durationMs:Date.now()-start});save();console.log('DONE '+job.name+' '+code);
 }
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));state.finishedAt=new Date().toISOString();save();}
process.exitCode=state.results.some(r=>r.exitCode!==0||r.timedOut)?1:0;
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
