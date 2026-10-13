'use strict';
// Ejecuta sólo la preparación y el caso online originales, un Chrome a la vez.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
// Cada nueva muestra conserva las anteriores; el proceso hijo no crea artefactos.
const out = process.argv.includes('--child') ? null : fs.mkdtempSync(path.join(root, 'reports/sim/student-sync-'));
if (process.argv.includes('--child')) {
  const filename = path.join(__dirname, 'student_sync_ui.test.js');
  let source = fs.readFileSync(filename, 'utf8');
  function replace(from, to) {
    if (!source.includes(from)) throw new Error('Cambió el punto de instrumentación: ' + from);
    source = source.replace(from, to);
  }
  replace('const errors=[];', `const errors=[];
    console.log('DIAGNOSTIC', JSON.stringify({browser:browser.version(),fixtureBytes:Buffer.byteLength(baseHTML),sourceHash:require('node:crypto').createHash('sha256').update(fs.readFileSync(__filename)).digest('hex')}));
    const originalTest=t.test.bind(t);
    t.test=(name,fn)=>/^(saving a draft|online retries)/.test(name)?originalTest(name,fn):Promise.resolve();`);
  replace("p.on('pageerror',error=>errors.push(error.message));", `p.on('pageerror',error=>errors.push(error.message));
    await p.addInitScript(()=>{
      window.__syncProbe={frames:0,samples:[],longTasks:[]};
      new PerformanceObserver(list=>{for(const e of list.getEntries())__syncProbe.longTasks.push({start:e.startTime,duration:e.duration});}).observe({entryTypes:['longtask']});
      function sample(at){
        const el=document.querySelector('[data-choice="CANALES"][data-option="web"]');
        __syncProbe.frames++;
        if(el){const r=el.getBoundingClientRect();__syncProbe.samples.push({at,x:r.x,y:r.y,w:r.width,h:r.height,disabled:el.disabled,hidden:document.hidden,menuHidden:document.getElementById('decisionMenu').classList.contains('hidden')});if(__syncProbe.samples.length>120)__syncProbe.samples.shift();}
        requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });`);
  replace(`await p.locator('[data-choice="CANALES"][data-option="web"]').check();`, `try{
      await p.locator('[data-choice="CANALES"][data-option="web"]').check();
    }finally{
      console.log('PROBE',JSON.stringify(await p.evaluate(()=>({probe:__syncProbe,access:studentAccess(),category:currentCategory,connected:studentConnected,hydrated:studentProgressHydrated,revision:server.revision}))));
    }`);
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(__dirname);
  compiled._compile(source, filename);
} else {
  const count = Number(process.argv.find(x=>x.startsWith('--runs='))?.split('=')[1] || 5);
  if (!Number.isSafeInteger(count) || count < 1 || count > 20) throw new Error('runs debe ser 1..20');
  const results = [];
  console.log('Evidencia: '+path.relative(root,out));
  for (let i=1; i<=count; i++) {
    const start=Date.now();
    const result=spawnSync(process.execPath,[__filename,'--child'],{cwd:root,windowsHide:true,encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},maxBuffer:8*1024*1024});
    const log=`run-${i}.log`;
    fs.writeFileSync(path.join(out,log),result.stdout+result.stderr);
    results.push({run:i,exitCode:result.status,durationMs:Date.now()-start,log});
    fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({conditions:{concurrentTestBrowsers:1,headless:true,timeoutChanged:false,forcedActions:false,source:'tests/student_sync_ui.test.js'},results},null,2));
    console.log(JSON.stringify(results.at(-1)));
    if(result.status!==0){process.exitCode=1;break;}
  }
}
