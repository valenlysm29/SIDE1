'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),baseline=path.join(root,'.codex-work/atribucion-9fbe6ec');
const out=path.join(root,'reports/sim/atribucion-regresion'),python='C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
fs.mkdirSync(out,{recursive:true});
const tests=[['decision_roster.test.mjs','unit'],['decisions_corrections.test.js','unit'],['mobile_integral_ui.cjs','browser'],['decisions_cycle_ui.cjs','browser']];
const resultados=[];
async function ejecutar(cwd,nombre,tipo,etiqueta){
  const log=fs.createWriteStream(path.join(out,etiqueta+'-'+nombre+'.log')),inicio=Date.now();
  const args=tipo==='unit'?['--test',path.join(cwd,'tests',nombre)]:[path.join(cwd,'tests',nombre)];
  const temp=path.join(root,'.codex-work/atribucion-temp');fs.mkdirSync(temp,{recursive:true});
  const proc=spawn(process.execPath,args,{cwd,windowsHide:true,env:{...process.env,NODE_PATH:path.join(root,'tests/node_modules'),PYTHON_BIN:python,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1',TEMP:temp,TMP:temp,TMPDIR:temp},stdio:['ignore','pipe','pipe']});
  for(const stream of [proc.stdout,proc.stderr])stream.on('data',chunk=>log.write(chunk));
  const codigo=await new Promise(resolve=>{proc.on('error',error=>{log.write(String(error));resolve(-1)});proc.on('exit',resolve)});await new Promise(resolve=>log.end(resolve));
  resultados.push({etiqueta,baseline:'9fbe6ec012db7e1440459551f62b40992df261d6',suite:nombre,codigo,duracionMs:Date.now()-inicio,log:path.relative(root,path.join(out,etiqueta+'-'+nombre+'.log'))});
  fs.writeFileSync(path.join(out,'resultados.json'),JSON.stringify(resultados,null,2));console.log(etiqueta+' '+nombre+' exit '+codigo);
}
(async()=>{for(const [nombre,tipo] of tests)for(const [etiqueta,cwd] of [['antes',baseline],['actual',root]])await ejecutar(cwd,nombre,tipo,etiqueta)})().catch(error=>{console.error(error);process.exitCode=1});
