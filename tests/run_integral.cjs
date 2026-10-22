'use strict';
// QA local: suites secuenciales; nunca compartir SwiftShader entre navegadores.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
if(process.argv.includes('--help')) {
  console.log('SIDE QA secuencial: node tests/run_integral.cjs --phase=phase2|phase3|final [--no-fps] [--only=suite1,suite2] [--extra=runner.cjs] [--list]');
  console.log('before existente está protegido. Cada invocación guarda logs y evidencia en runs/<fecha>, respalda y restaura outputs previos.');
  process.exit(0);
}
const phase = process.argv.find(arg => arg.startsWith('--phase='))?.slice(8) || (process.argv.includes('--after') ? 'after' : 'final');
if (!/^[a-z][a-z0-9-]*$/.test(phase)) throw new Error('Fase inválida: usa --phase=phase2, phase3 o final.');
const out = path.join(__dirname, 'output', 'mejora-integral-2026-10-01', phase);
if (phase === 'before' && fs.existsSync(path.join(out,'summary.json'))) throw new Error('La línea base before ya existe y está protegida.');
fs.mkdirSync(out, { recursive: true });
const tmp = path.join(root,'.codex-work','mejora-side-2026-10-01','tmp');
fs.mkdirSync(tmp,{recursive:true});
const mime = { '.html':'text/html', '.js':'application/javascript', '.mjs':'application/javascript', '.css':'text/css', '.json':'application/json', '.wasm':'application/wasm', '.glb':'model/gltf-binary', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml' };
const server = http.createServer((request, response) => {
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname)); } catch { response.writeHead(400).end(); return; }
  if (file === root) file = path.join(root, 'index.html');
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
  fs.createReadStream(file).pipe(response);
});
const defaults = ['playable_hub.cjs','continuous_world.cjs','gameplay_hud.cjs','world_business_ui.cjs','world_cycle_restart.cjs','world_startup.cjs','world_loading.cjs','world_entry_assets.cjs','supplied_npcs.cjs','mona_npc.cjs','npc_locomotion.cjs','game_lifecycle_ui.cjs','decisions_cycle_ui.cjs','teacher_lifecycle_ui.cjs','tablet_return_browser.cjs','npc_world_fixes_browser.cjs','world_orientation_mobile.cjs'];
const additions = ['teacher_history_ui.cjs','teacher_report_pdf_ui.cjs','character_selection_ui.cjs','decision_interiors_browser.cjs','npc_navmesh_browser.cjs'];
const db = ['decision_options_db.cjs','student_admission_db.cjs','student_admission_matrix_db.cjs','teacher_history_db.cjs','game_lifecycle_db.cjs','game_observations_db.cjs','waiting_room_db.cjs'];
const optional = ['tablet_item_draft_ui.cjs','mobile_integral_ui.cjs','side_full_flow.cjs'];
const extra = process.argv.find(arg => arg.startsWith('--extra='))?.slice(8).split(',').filter(Boolean) || [];
for (const name of extra) if(!/^[a-zA-Z0-9_-]+\.cjs$/.test(name)) throw new Error('Runner adicional inválido: ' + name);
const python = process.env.PYTHON_BIN || (fs.existsSync('C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe') ? 'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' : 'python');
const nodeFiles = fs.readdirSync(__dirname).filter(name => /\.test\.(?:js|mjs|cjs)$/.test(name)).sort();
const browserNames = [...new Set([...defaults,...additions,...optional,...extra])];
const suites = [{name:'local_server_test.py',kind:'server',command:python,args:[path.join(__dirname,'local_server_test.py')],timeout:60000}, { name:'node-completa',kind:'node',args:['--test', '--test-concurrency=1', ...nodeFiles.map(name => path.join(__dirname,name))], timeout:600000 }, ...db.map(name => ({name,kind:'db',args:[path.join(__dirname,name)],timeout:180000})), ...browserNames.map(name => ({name,kind:'browser',args:[path.join(__dirname,name)],timeout:480000,optional:optional.includes(name)})), ...(process.argv.includes('--no-fps')?[]:[{name:'npc_fps_benchmark.cjs',kind:'benchmark',args:[path.join(__dirname,'npc_fps_benchmark.cjs')],timeout:480000}])];
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7).split(',');
if(only) for(const name of only) if(!suites.some(suite=>suite.name===name)) throw new Error('Suite desconocida: ' + name);
if(process.argv.includes('--list')) {console.log(JSON.stringify({phase,suites:suites.filter(suite=>!only||only.includes(suite.name)).map(({name,kind,timeout,optional})=>({name,kind,timeout,optional:Boolean(optional)}))},null,2));process.exit(0);}
const results = [];
const startedAt = new Date().toISOString();
const runId = startedAt.replace(/[:.]/g,'-');
const logDir = path.join(out,'runs',runId);
fs.mkdirSync(logDir,{recursive:true});
const backup = path.join(root,'.codex-work','mejora-side-2026-10-01','backups',phase,runId);
let preservation = {backedUp:false,restored:false};
function save() { const summary={phase,runId,startedAt,selection:only||'all',renderer:'Chromium / SwiftShader (secuencial)',nodeFiles:nodeFiles.length,preservation,results};fs.writeFileSync(path.join(logDir,'summary.json'),JSON.stringify(summary,null,2));fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)); }
function copyTree(source,target,skipEvidence=false) {
  if(!fs.existsSync(source)) return;
  fs.mkdirSync(target,{recursive:true});
  for(const entry of fs.readdirSync(source,{withFileTypes:true})) {
    if(skipEvidence && entry.name==='mejora-integral-2026-10-01') continue;
    const from=path.join(source,entry.name),to=path.join(target,entry.name);
    if(entry.isDirectory()) copyTree(from,to);
    else {fs.copyFileSync(from,to);const stat=fs.statSync(from);fs.utimesSync(to,stat.atime,stat.mtime);}
  }
}
function backupOutputs() {
  copyTree(path.join(__dirname,'output'),path.join(backup,'tests-output'),true);
  copyTree(path.join(root,'output','pdf'),path.join(backup,'output-pdf'));
  preservation.backedUp=true;preservation.backup=path.relative(root,backup);
}
function restoreOutputs() {
  copyTree(path.join(backup,'tests-output'),path.join(__dirname,'output'));
  copyTree(path.join(backup,'output-pdf'),path.join(root,'output','pdf'));
  preservation.restored=true;
}
function preserveEvidence() {
  function walk(source,target,dir=source) {
    if(!fs.existsSync(dir))return;
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
      if(dir===source && entry.name==='mejora-integral-2026-10-01') continue;
      const file=path.join(dir,entry.name);
      if(entry.isDirectory()) {walk(source,target,file);continue;}
      if(!/\.(?:png|jpg|json|pdf)$/.test(entry.name) || fs.statSync(file).mtimeMs < Date.parse(startedAt)) continue;
      const destination=path.join(target,path.relative(source,file));
      fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(file,destination);
    }
  }
  walk(path.join(__dirname,'output'),path.join(logDir,'evidence'));
  walk(path.join(root,'output','pdf'),path.join(logDir,'evidence','output-pdf'));
}
(async () => {
  backupOutputs();save();
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  try {
    for (const suite of suites.filter(suite => !only || only.includes(suite.name))) {
      if(suite.optional && !fs.existsSync(path.join(__dirname,suite.name))) {results.push({suite:suite.name,kind:suite.kind,status:'skipped',passed:false,reason:'Runner opcional aún no creado'});save();continue;}
      console.log('RUN ' + suite.name);
      const logPath=path.join(logDir,suite.name+'.log');
      const log = fs.createWriteStream(logPath);
      const start = Date.now(); let timedOut = false;
      const child = spawn(suite.command||process.execPath,suite.args,{cwd:root,windowsHide:true,env:{...process.env,PYTHON_BIN:python,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1',TEMP:tmp,TMP:tmp,TMPDIR:tmp,SIDE_QA_PHASE:phase,SIDE_QA_OUTPUT:path.join(logDir,'full-flow'),SIDE_TEST_URL:`http://127.0.0.1:${server.address().port}/`},stdio:['ignore','pipe','pipe']});
      for (const stream of [child.stdout,child.stderr]) stream.on('data',chunk => { log.write(chunk); process.stdout.write(chunk); });
      const timer = setTimeout(() => { timedOut=true; if(process.platform==='win32') spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true}); else child.kill('SIGKILL'); },suite.timeout);
      const code = await new Promise(resolve => {child.once('error',error => {log.write(String(error));resolve(-1);});child.once('exit',resolve);});
      clearTimeout(timer); await new Promise(resolve => log.end(resolve));
      results.push({suite:suite.name,kind:suite.kind,status:code===0&&!timedOut?'passed':'failed',passed:code===0&&!timedOut,exitCode:code,timedOut,durationMs:Date.now()-start,log:path.relative(root,logPath)}); preserveEvidence(); save();
      console.log('DONE ' + suite.name + ': ' + (code===0&&!timedOut?'PASS':'FAIL'));
    }
  } finally { preserveEvidence();restoreOutputs();save();server.closeAllConnections();await new Promise(resolve => server.close(resolve)); }
  process.exitCode = results.some(result => result.status==='failed') ? 1 : 0;
  console.log(JSON.stringify(results,null,2));
})().catch(error => {console.error(error);server.close();process.exitCode=1;});
