'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {crearSim1,crearSim2,crearSim3,decision}=require('./escenarios_excel.cjs');
const {CONFIG}=require('../js/engine/config_excel.js');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output/logica_excel');fs.mkdirSync(out,{recursive:true});
const python=process.env.PYTHON_BIN||'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
function html(name){return execFileSync(python,['-c',`import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('${name}'))`],{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1'}}).replace('const cfg = window.SIDE_CONFIG || {};','window.SIDE_CONFIG={};const cfg = window.SIDE_CONFIG || {};').replace('const cfg=window.SIDE_CONFIG||{};','window.SIDE_CONFIG={};const cfg=window.SIDE_CONFIG||{};');}
async function comprobarBaseEnBrowser(p){
  await p.addScriptTag({content:fs.readFileSync(path.join(root,'js/engine/inventario.js'),'utf8')});
  const valores=await p.evaluate(({base,costos,fixtures,celdas})=>{
    const modules={'../js/engine/produccion.js':SIDE_EXCEL_PRODUCCION,'../js/engine/puntajes.js':SIDE_EXCEL_PUNTAJES,'../js/engine/mercado.js':SIDE_EXCEL_MERCADO,'../js/engine/inventario.js':SIDE_EXCEL_INVENTARIO,'../js/engine/costos.js':SIDE_EXCEL_COSTOS,'../js/engine/config_excel.js':SIDE_EXCEL_CONFIG,'../docs/logica_excel/fixtures_excel.json':fixtures,'../docs/logica_excel/celdas_excel.json':celdas,'node:fs':{},'node:path':{},'node:assert/strict':{equal(a,b,msg){if(a!==b)throw new Error(msg)}}};
    const req=k=>{if(!(k in modules))throw new Error('Módulo de prueba no disponible: '+k);return modules[k];};
    const mb={exports:{}},mc={exports:{}};new Function('require','module','__dirname',base)(req,mb,'tests');new Function('require','module','__dirname',costos)(req,mc,'tests');return {...mb.exports.valoresBase(),...mc.exports.calcularValoresCostos()};
  },{base:fs.readFileSync(path.join(__dirname,'paridad_base.cjs'),'utf8'),costos:fs.readFileSync(path.join(__dirname,'paridad_costos.cjs'),'utf8'),fixtures:require('../docs/logica_excel/fixtures_excel.json'),celdas:require('../docs/logica_excel/celdas_excel.json')});
  const filas=require('./paridad_base.cjs').comparar(require('./oracle/esperado_base.json').valores,valores);fs.writeFileSync(path.join(out,'sim-1-paridad.json'),JSON.stringify({total:filas.length,diferencias:filas.filter(f=>!f.ok)},null,2));assert.equal(filas.filter(f=>!f.ok).length,0);
}
async function ejecutar(numero=3){
  const escenario=numero===1?crearSim1():numero===2?crearSim2():crearSim3();
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),errors=[],pages={},ids={},history=[],studentHTML=html('index.html'),teacherHTML=html('docente.html');
  let reports=[];const game='SIDE-000';
  async function nueva(source){const p=await browser.newPage({viewport:{width:1366,height:900}});p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.abort());await p.setContent(source,{waitUntil:'networkidle'});return p;}
  async function sync(p,ciclo){await p.evaluate(({reports,ciclo,overrides})=>{Object.assign(SIDE_EXCEL_CONFIG.CONFIG,overrides);localStorage.setItem('SIDE_STUDENT_REPORTS',JSON.stringify(reports));localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({codigo:'SIDE-000',integrationMinutes:0,cycles:3,round:ciclo,cycleCloseMode:'manual',capital:1000000}));localStorage.setItem('SIDE_ACTIVE_ROUND',String(ciclo));localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:true,startedAt:new Date(Date.now()-10000).toISOString()}));localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({round:ciclo,phase:'decisions',status:'running',running:true,remaining:3600}));if(typeof tickStudentGame==='function')tickStudentGame();}, {reports,ciclo,overrides:escenario.overrides});}
  async function llenar(p,d,ciclo){
    await p.evaluate(({d,ciclo})=>{
      // Solo entradas de escenario: la confirmación, preview y cierre usan la UI entregada.
      decisionState.__excel={habilitado:true,version:1,round:ciclo,decisiones:SIDE_EXCEL_UI.nuevasDecisiones(),enviado:false};
      if(d.reputacionLiteral!==undefined)decisionState.__excel.decisiones.reputacionLiteral=d.reputacionLiteral;persistGameState();currentCategory='C';openDecisionMenu();currentCategory='C';renderDecisionCategory();
    },{d,ciclo});
    for(let i=1;i<d.lotes.length;i++)await p.locator('[data-agregar-lote]').click();
    if(!await p.locator('[data-excel-regimen]').count())console.log('DIAGNOSTICO',await p.evaluate(()=>({round:currentRound(),cat:currentCategory,excel:decisionState.__excel,dom:document.querySelector('#excelProductionMount')?.innerHTML,access:studentAccess()})));
    await p.evaluate(d=>{
      const dispatch=(selector,value)=>{const el=document.querySelector(selector);if(!el)throw new Error('Falta control '+selector);el.value=String(value??'');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
      dispatch('[data-excel-regimen]',d.regimen||'MYPE');dispatch('[data-excel-publicidad]',d.publicidad||0);dispatch('[data-excel-prestamo]',d.montoPrestamo||0);
      const normal=SIDE_EXCEL_PRODUCCION.normalizarPersonal(d.personal||{});for(const [area,filas] of Object.entries(normal))filas.forEach((fila,n)=>fila.forEach((v,m)=>dispatch(`[data-personal="${area},${n},${m}"]`,v)));
      for(const [k,v] of Object.entries(d.maquinaria||{}))dispatch(`[data-activo="${k}"]`,v);
      for(const [k,v] of Object.entries(d.comprasUnidades||{}))dispatch(`[data-compra="${k}"]`,v);
      for(const [k,v] of Object.entries(d.compras||{}))dispatch(`[data-compra="${k}"]`,v/SIDE_EXCEL_CONFIG.CONFIG.CONVERSION_COMPRA[k]);
      for(const code of d.seleccion||[]){const option=[...document.querySelectorAll('[data-excel-grupo] option')].find(o=>o.value===code);if(option)dispatch(`[data-excel-grupo="${option.parentElement.dataset.excelGrupo}"]`,code);}
      d.lotes.forEach((l,i)=>{for(const campo of ['segmento','cantidad','cuero','accesorios','hilo','molde','precio'])dispatch(`[data-lote="${i}"][data-campo="${campo}"]`,l[campo]??'');});
    },d);
    await p.locator('[data-excel-enviar]').click();assert.match(await p.locator('[data-excel-status]').innerText(),/confirmado/);
    const report=await p.evaluate(()=>syncStudentReportPreview());return report;
  }
  try{
    for(const id of escenario.empresas){console.log('Registro',id);const p=await nueva(studentHTML);pages[id]=p;await sync(p,1);await p.evaluate(()=>showModal('studentModal'));await p.locator('#gameCode').fill(game);await p.locator('#companyLegalName').fill('Empresa '+id);await p.locator('#companyBrandName').fill(id);await p.locator('#studentForm button[type=submit]').click();await p.waitForFunction(id=>currentStudent.company===id&&studentConnected,id);const r=await p.evaluate(()=>syncStudentReportPreview());ids[id]=r.id;reports.push(r);}
    const teacher=await nueva(teacherHTML);
    for(let i=0;i<escenario.ciclos.length;i++){
      console.log('Ciclo',i+1);const ciclo=i+1,decisiones=escenario.ciclos[i].decisionesPorEmpresa;
      for(const id of escenario.empresas){const p=pages[id];await sync(p,ciclo);if(!decisiones[id]){if(ciclo===1){await p.evaluate(()=>{decisionState.__excel={habilitado:true,round:1,enviado:false,decisiones:SIDE_EXCEL_UI.nuevasDecisiones()};persistGameState();});const report=await p.evaluate(()=>syncStudentReportPreview());reports=reports.map(r=>r.id===report.id?report:r);}continue;}console.log('Decision',ciclo,id);const report=await llenar(p,decisiones[id],ciclo);reports=reports.map(r=>r.id===report.id?report:r);}
      await sync(teacher,ciclo);const closure=await teacher.evaluate(({ciclo,reports})=>{state.partidaId=null;state.round=ciclo;state.reports=reports;$('gameCode').value='SIDE-000';return closeExcelLocalRound();},{ciclo,reports});
      assert.ok(closure,'Cierre docente local');history.push(closure);reports=await teacher.evaluate(()=>JSON.parse(localStorage.getItem('SIDE_STUDENT_REPORTS')));
      for(const p of Object.values(pages)){const keys=await teacher.evaluate(()=>Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter(k=>k.startsWith('SIDE_EXCEL_')).map(k=>[k,localStorage.getItem(k)])));await p.evaluate(({keys,reports})=>{for(const[k,v]of Object.entries(keys))localStorage.setItem(k,v);localStorage.setItem('SIDE_STUDENT_REPORTS',JSON.stringify(reports));currentCategory='A';renderTabs();renderDecisionCategory();},{keys,reports});}
      await pages.A.screenshot({path:path.join(out,`sim-${numero}-ciclo-${ciclo}.png`),fullPage:true});
      assert.ok(await pages.A.locator('#companySummaryMount .excel-resultados').count(),'El estudiante ve el resultado Excel');
      await pages.A.locator('#companySummaryMount .excel-resultados').screenshot({path:path.join(out,`sim-${numero}-resultado-${ciclo}.png`)});
    }
    // Reetiquetar exclusivamente identidad local; los importes siguen siendo salida del navegador.
    const resultados=history.map(c=>({...c,resultadosPorEmpresa:Object.fromEntries(Object.entries(ids).filter(([,local])=>c.resultadosPorEmpresa[local]).map(([id,local])=>[id,c.resultadosPorEmpresa[local]]))}));
    fs.writeFileSync(path.join(out,`sim-${numero}-navegador.json`),JSON.stringify({escenario:escenario.id,ids,resultados,errors},null,2));assert.deepEqual(errors,[]);
    if(numero===1)await comprobarBaseEnBrowser(pages.A);
    {const {valoresDesdeResultados}=require('./oracle/comparar_pipeline.cjs');const valores=valoresDesdeResultados(resultados),esperado=require(`./oracle/esperado_sim${numero}_pipeline.json`).valores;const filas=require('./paridad_base.cjs').comparar(esperado,valores);fs.writeFileSync(path.join(out,`sim-${numero}-paridad.json`),JSON.stringify({total:filas.length,diferencias:filas.filter(f=>!f.ok)},null,2));assert.equal(filas.filter(f=>!f.ok).length,0);}
    console.log(`PASS SIM-${numero}: registro normal, decisiones UI, cierre docente, ${history.length} ciclo(s), ${escenario.empresas.length} empresas.`);return resultados;
  }finally{await browser.close();}
}
if(require.main===module)ejecutar(Number(process.argv[2]||3)).catch(e=>{console.error(e);process.exitCode=1;});module.exports={ejecutar};






