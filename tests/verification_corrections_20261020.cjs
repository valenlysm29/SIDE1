'use strict';
// Independent black-box verification: production files are read from SIDE_ROOT.
// This runner never connects to Supabase and does not rewrite product code.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require(process.env.SIDE_NODE_MODULES?path.join(process.env.SIDE_NODE_MODULES,'playwright'):'playwright');
const ROOT=path.resolve(process.env.SIDE_ROOT||path.join(__dirname,'..'));
const OUT=path.join(ROOT,'tests/output/correcciones-2026-10-20/independiente');fs.mkdirSync(OUT,{recursive:true});
const VERSION='excel-16';
const state={started:new Date().toISOString(),root:ROOT,checks:[],simulations:[],errors:[]};
const save=()=>fs.writeFileSync(path.join(OUT,state.evidenceName||'verification.json'),JSON.stringify(state,null,2));
function check(label,condition=true){assert.ok(condition,label);state.checks.push(label);console.log('PASS '+label);save();}
const near=(a,b,label)=>check(label,Math.abs(a-b)<1e-6);
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.wasm':'application/wasm','.glb':'model/gltf-binary'};
const server=http.createServer((req,res)=>{
 const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';const file=path.resolve(ROOT,relative);
 if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 if(relative==='js/config.js'){res.writeHead(200,{'Content-Type':'application/javascript'}).end('window.SIDE_CONFIG={};');return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
});
async function sync(page,cycle,reports=[]){await page.evaluate(({cycle,reports,version})=>{
 const teacher={codigo:'SIDE-000',nombre:'Verificación independiente',capital:100000,cycles:3,round:cycle,cycleCloseMode:'manual',integrationMinutes:0,integrationDurationMinutes:0,roundHours:0,roundMinutes:10,motor_version:version};
 localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify(teacher));localStorage.setItem('SIDE_ACTIVE_ROUND',String(cycle));localStorage.setItem('SIDE_STUDENT_REPORTS',JSON.stringify(reports));localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:true,startedAt:new Date(Date.now()-1000).toISOString()}));localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({round:cycle,phase:'decisions',status:'running',running:true,remaining:600,startedAt:new Date().toISOString(),duration:600}));
 if(typeof currentStudent!=='undefined'){if(typeof loadDecisionState==='function')loadDecisionState();if(typeof tickStudentGame==='function')tickStudentGame();}
 },{cycle,reports,version:VERSION});}
async function newPage(browser,origin,name,teacher=false){
 const context=await browser.newContext({viewport:{width:1150,height:666},locale:'es-PE',timezoneId:'America/Lima'});await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 const page=await context.newPage();page.on('pageerror',e=>{state.errors.push({name,message:e.message});save();});await page.goto(origin+(teacher?'/docente.html':'/index.html'),{waitUntil:'networkidle'});
 await sync(page,1);
 if(!teacher){await page.evaluate(()=>showModal('studentModal'));await page.locator('#gameCode').fill('SIDE-000');await page.locator('#companyLegalName').fill('Verificación '+name+' SAC');await page.locator('#companyBrandName').fill(name);await page.locator('#studentForm button[type=submit]').click();await page.waitForFunction(name=>studentConnected&&currentStudent.company===name,name);await page.evaluate(()=>{decisionState.__excel={habilitado:true,round:currentRound(),enviado:false,decisiones:SIDE_EXCEL_UI.nuevasDecisiones()};persistGameState();openDecisionMenu();});}
 return {page,context};
}
async function category(page,cat){await page.locator(`[data-cat="${cat}"]`).click();await page.waitForSelector('#excelProductionMount .excel-editor');await page.locator('#excelProductionMount details').evaluateAll(items=>items.forEach(el=>el.open=true));}
async function change(page,selector,value){
 const input=page.locator(selector);assert.equal(await input.count(),1,'Unique canonical field '+selector);
 const tag=await input.evaluate(el=>el.tagName);if(tag==='SELECT'||await input.getAttribute('type')==='checkbox'){const card=input.locator('xpath=ancestor::fieldset[1]');const wanted=tag==='SELECT'?String(value):(value?'1':'0');await card.locator('[data-excel-choice]').evaluateAll((items,wanted)=>{const target=items.find(el=>el.value===wanted);if(!target)throw Error('Missing visible alternative '+wanted);target.click();},wanted);}else await input.fill(String(value));
}
async function group(page,codigo){const selector=await page.evaluate(codigo=>{const o=[...document.querySelectorAll('[data-excel-grupo] option')].find(o=>o.value===codigo);return o?'[data-excel-grupo="'+o.parentElement.dataset.excelGrupo+'"]':null;},codigo);assert.ok(selector,'Visible group for '+codigo);await change(page,selector,codigo);}
async function fillPlan(page,{cycle,borrow,auto,variant,physical=false}){
 await page.evaluate(()=>{currentCategory='B';renderTabs();renderDecisionCategory();});
 await category(page,'B');await change(page,'[data-activo="mesa"]',1);await change(page,'[data-activo="INF-02"]',1);await change(page,'[data-activo="INF-05"]',1);await change(page,'[data-activo="INF-08"]',1);
 if(variant&&cycle>1)await change(page,'[data-activo="INF-09"]',1);
 await category(page,'C');await change(page,'[data-personal="corte,0,0"]',1);await change(page,'[data-personal="ensamble,0,0"]',1);await change(page,'[data-personal="acabado,0,0"]',1);
 await change(page,'[data-excel-garantia]',30);
 for(const [field,value] of Object.entries({segmento:variant&&cycle>1?'SEG-02':'SEG-01',cantidad:40,cuero:variant&&cycle>1?'INS-02':'INS-01',accesorios:'INS-04',hilo:variant&&cycle>1?'INS-07':'INS-06',molde:variant&&cycle>1?'INF-09':'INF-08',precio:variant&&cycle>1?100:45}))await change(page,`[data-lote="0"][data-campo="${field}"]`,value);
 await category(page,'D');await group(page,physical?'COM-01C':'COM-01B');if(physical)await change(page,'[data-excel-tienda="los_olivos"]',1);await change(page,'[data-excel-marketing]','baja');
 await category(page,'E');await change(page,'[data-excel-prestamo]',borrow&&cycle===1?5000:0);
 await category(page,'C');for(const [code,qty] of Object.entries({'INS-01':30,'INS-02':30,'INS-04':100,'INS-06':3,'INS-07':3}))await change(page,`[data-compra="${code}"]`,qty);
 if(auto){await page.locator('[data-excel-guardar]').click();check('Saved draft remains unsubmitted',!await page.evaluate(()=>decisionState.__excel.enviado));}
 else {await page.locator('[data-excel-enviar]').click();check('Confirmed plan through delivered UI',await page.evaluate(()=>decisionState.__excel.enviado));}
 const saved=await page.evaluate(()=>syncStudentReportPreview());assert.ok(saved.excelDecisionState?.decisiones);return saved;
}
async function simulation(browser,origin,label){
 const contexts=[],students={},ids={};let reports=[],previous={},history=[];
 try{
  for(const name of ['A','B','C','D','E']){const item=await newPage(browser,origin,label+'-'+name);contexts.push(item.context);students[name]=item.page;const report=await item.page.evaluate(()=>syncStudentReportPreview());ids[name]=report.id;reports.push(report);}
  const t=await newPage(browser,origin,label+'-teacher',true);contexts.push(t.context);
  for(let cycle=1;cycle<=3;cycle++){
   for(const name of ['A','B','C','D','E']){
    const page=students[name];await sync(page,cycle,reports);
    // Company A never opens a canonical editor or sends any plan in any cycle.
    if(name!=='A'){const report=await fillPlan(page,{cycle,borrow:name==='B',auto:name==='C',variant:label==='SIM-C'&&name==='C'});reports=reports.map(r=>r.id===report.id?report:r);}
   }
   await sync(t.page,cycle,reports);
   const closure=await t.page.evaluate(({cycle,reports,version})=>{state.partidaId=null;state.round=cycle;state.authoritative={motor_version:version};state.reports=reports;$('gameCode').value='SIDE-000';localStorage.setItem('SIDE_STUDENT_REPORTS',JSON.stringify(reports));return closeExcelLocalRound();},{cycle,reports,version:VERSION});
   check(label+' includes all five companies cycle '+cycle,Object.keys(closure.resultadosPorEmpresa).length===5);check(label+' no company eliminated',closure.eliminadas.length===0);
   reports=await t.page.evaluate(()=>JSON.parse(localStorage.getItem('SIDE_STUDENT_REPORTS')));
   const a=closure.resultadosPorEmpresa[ids.A];near(a.financial.balanceCaja.salidas,2712.32,label+' non-sender pays local and cleaning '+cycle);
   check(label+' automatic draft tracked '+cycle,closure.autoenviadas.includes(ids.C)&&closure.resultadosPorEmpresa[ids.C].envioAutomatico===true);
   for(const [name,id] of Object.entries(ids)){
    const r=closure.resultadosPorEmpresa[id],f=r.financial,bc=f.balanceCaja,bg=f.balanceGeneral,fc=f.flujoCaja;
    check(label+' ledger exists '+name+'/'+cycle,Array.isArray(r.libroMovimientos?.movimientos));near(bc.cajaInicial+bc.entradas-bc.salidas,bc.cajaFinal,label+' cash reconciles '+name+'/'+cycle);near(bg.activos,bg.deuda+bg.patrimonio,label+' balance reconciles '+name+'/'+cycle);near(fc.operacion+fc.inversion+fc.financiamiento,bc.cajaFinal-bc.cajaInicial,label+' flows reconcile '+name+'/'+cycle);near(bc.cajaInicial,previous[id]?.financial.balanceCaja.cajaFinal??100000,label+' opening cash carries '+name+'/'+cycle);
    const report=reports.find(v=>v.id===id);near(report.caja,bc.cajaFinal,label+' teacher cash equals book '+name+'/'+cycle);near(report.utilidad,f.estadoResultados.utilidad,label+' teacher profit equals book '+name+'/'+cycle);
   }
   near(closure.resultadosPorEmpresa[ids.B].financial.flujoCaja.financiamiento,cycle===1?5000:0,label+' loan charged once '+cycle);
   const keys=await t.page.evaluate(()=>Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter(k=>k.startsWith('SIDE_EXCEL_')).map(k=>[k,localStorage.getItem(k)])));
   for(const name of Object.keys(students)){
    const page=students[name];await page.evaluate(({keys,reports,id})=>{for(const[k,v]of Object.entries(keys))localStorage.setItem(k,v);localStorage.setItem('SIDE_STUDENT_REPORTS',JSON.stringify(reports));const own=reports.find(r=>r.id===id);if(own?.excelDecisionState)decisionState.__excel=JSON.parse(JSON.stringify(own.excelDecisionState));currentCategory='A';renderTabs();renderDecisionCategory();updateHud();},{keys,reports,id:ids[name]});
    const shown=await page.evaluate(()=>({cash:cashBalance(),financial:financialReport()}));near(shown.cash,closure.resultadosPorEmpresa[ids[name]].financial.balanceCaja.cajaFinal,label+' student cash equals book '+name+'/'+cycle);
   }
   await students.B.screenshot({path:path.join(OUT,label+'-cycle-'+cycle+'.png'),fullPage:true});
   previous=closure.resultadosPorEmpresa;history.push(closure);
  }
  state.simulations.push({name:label,cycles:3,companies:5,ids,results:history});save();
 }finally{for(const context of contexts)await context.close();}
}
module.exports={fs,path,chromium,ROOT,OUT,VERSION,state,server,save,check,near,sync,newPage,category,change,group,fillPlan,simulation};
if(require.main===module)(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{for(const label of ['SIM-A','SIM-B','SIM-C'])await simulation(browser,origin,label);check('No uncaught JavaScript errors',state.errors.length===0);state.finished=new Date().toISOString();save();console.log('PASS independent simulations '+state.checks.length+' checks');}
 finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{state.failure={message:error.message,stack:error.stack};save();console.error(error);server.close();process.exitCode=1;});
