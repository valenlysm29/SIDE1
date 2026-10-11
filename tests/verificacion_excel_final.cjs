'use strict';
// Una única corrida final secuencial; conserva cada resultado aunque una suite falle.
const fs=require('node:fs'),path=require('node:path'),{spawn,spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'reports/sim/final-continuacion-2');
fs.mkdirSync(out,{recursive:true});
const nodeFiles=fs.readdirSync(__dirname).filter(n=>/\.test\.(js|mjs|cjs)$/.test(n)).sort();
const inventory=JSON.parse(spawnSync(process.execPath,['tests/run_integral.cjs','--list','--no-fps'],{cwd:root,encoding:'utf8'}).stdout);
const only=inventory.suites.filter(s=>s.kind!=='node').map(s=>s.name).join(',');
const jobs=[{name:'node-todos',args:['--test','--test-concurrency=1',...nodeFiles.map(n=>'tests/'+n)]},
 {name:'excel-sql',args:['tests/excel_sql_db.cjs']},
 {name:'excel-sql-activacion',args:['tests/excel_sql_activacion_db.cjs']},
 {name:'regresion-db-navegador',args:['tests/run_integral.cjs','--phase=excel-cont2-final','--no-fps','--only='+only]},
 ...[1,2,3].map(n=>({name:'sim-'+n,args:['tests/sim_'+n+'.cjs']})),
 {name:'transicion',args:['tests/transicion_excel_browser.cjs']},
 {name:'base',args:['tests/paridad_base.cjs']},{name:'consecuencias',args:['tests/paridad_consecuencias.cjs']},
 ...['sim1','sim2','sim3'].map(n=>({name:'oracle-'+n,args:['tests/oracle/comparar_pipeline.cjs',n]})),
 {name:'banca',args:['tests/oracle/banca_recuperacion.cjs']},{name:'banca-mezcla',args:['tests/oracle/banca_recuperacion.cjs','--mezcla']}];
const state={startedAt:new Date().toISOString(),nodeFiles:nodeFiles.length,results:[]};
function save(){fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(state,null,2));}
async function run(job){
 const log=fs.createWriteStream(path.join(out,job.name+'.log')),start=Date.now();
 console.log('RUN '+job.name);const child=spawn(process.execPath,job.args,{cwd:root,windowsHide:true,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe']});
 child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
 const code=await new Promise(resolve=>{child.once('error',e=>{log.write(String(e));resolve(-1)});child.once('close',resolve)});
 await new Promise(resolve=>log.end(resolve));state.results.push({name:job.name,exitCode:code,durationMs:Date.now()-start});save();console.log('DONE '+job.name+': '+code);
}
(async()=>{save();for(const j of jobs)await run(j);
 const changed=spawnSync('git',['diff','9fbe6ec','--name-only'],{cwd:root,encoding:'utf8'}).stdout.split(/\r?\n/).filter(p=>/\.(js|cjs|mjs)$/.test(p)&&!p.startsWith('tools/model-pipeline/'));
 let failures=[];for(const p of changed){const r=spawnSync(process.execPath,['--check',p],{cwd:root,encoding:'utf8'});if(r.status)failures.push({path:p,error:r.stderr});}
 state.syntax={files:changed.length,failures};state.finishedAt=new Date().toISOString();save();console.log(JSON.stringify(state,null,2));process.exitCode=state.results.some(r=>r.exitCode)||failures.length?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
