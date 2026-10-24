'use strict';
const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),output=path.join(__dirname,'output/ventas-v19-browser');
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const html=execFileSync('python',['-c',"import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('index.html'))"],{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1'}});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
 const page=await browser.newPage({viewport:{width:1366,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());await page.route('http://side.test/**',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('http://side.test/');
 const results=await page.evaluate(()=>{
 localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:200000,cycles:6,roundHours:8,interest:20}));
 currentStudent={name:'QA INTEGRAL',company:'QA INTEGRAL',game:DEMO_GAME};openDecisionMenu();
 const rows=[];
 for(let round=1;round<=3;round++){
 localStorage.setItem('SIDE_ACTIVE_ROUND',String(round));
 const quantities={MESA_CORTE:{mesa:1},ENSAMBLE:{ens_ind:1},ACABADOS:{aca_ind:1},PERS_CORTE:{corte_maestro:1},PERS_ENSAMBLE:{ens_personal_esp:1},PERS_ACABADO:{aca_personal_art:1},CUERO:{cuero_sint:30},ACCESORIOS:{acc_eco:100},HILO:{hilo_std:600}};
 for(const [id,q] of Object.entries(quantities))decisionState[id]={round,quantities:q,optionIds:Object.keys(q),...(['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(id)?{purchases:{1:q}}:{})};
 decisionState.MOLDE={round:1,optionIds:['molde_1']};decisionState.JEFATURA={round,optionIds:['si_jefatura']};decisionState.PRODUCCION_META={round,value:100,moldTargets:{molde_1:100,molde_2:0,molde_3:0},prices:{esencial:43,urbano:160,premium:250}};decisionState.CANALES={round,optionIds:['web','los_olivos'],quantities:{los_olivos:1}};
 decisionDrafts={};for(const [id,entry] of Object.entries(decisionState)){if(!id.startsWith('__'))decisionDrafts[id]=deepClone(entry);}const sections=recordedFinancialSections();sections[round]={};for(const cat of decisionCategories().filter(c=>!c.summaryOnly)){const sec=window.SIDE_REVIEW_MODEL.section(cat,decisionModelContext());sections[round][cat.cat]={...sec,recordedNet:sec.net};cashLedger[`${round}:${cat.cat}`]=sec.net;}localStorage.setItem(financialSectionsKey(),JSON.stringify(sections));const plan=productionPlan();const diagram=productionDopHtml(plan);captureCyclePlan();const closed=settleCycle(round);renderStudentStatus();renderDecisionCategory();
 const receipt=decisionState.__cycleSettlements[round],er=financialReport().estadoResultados;
 rows.push({round,closed,produced:plan.producibleUnits,sold:receipt.sold,revenue:receipt.revenue,diagram,er,html:document.getElementById('studentIncomeStatement').innerHTML,repeat:settleCycle(round),stock:decisionState.__finishedGoods});
 }
 currentCategory='C';renderDecisionCategory();const priceInput=document.querySelector('[data-sale-price=esencial]');if(!priceInput)throw Error('Falta precio visible');priceInput.value='46';priceInput.dispatchEvent(new Event('input',{bubbles:true}));if(priceInput.checkValidity())throw Error('Precio fuera de rango aceptado');if(!reviewProblems(liveCompanyReview(),['C']).some(issue=>/precio/.test(issue.text)))throw Error('Confirmación de resumen acepta precio inválido');priceInput.value='44';priceInput.dispatchEvent(new Event('input',{bubbles:true}));if(!priceInput.checkValidity())throw Error('Precio corregido sigue inválido');if(reviewProblems(liveCompanyReview(),['C']).some(issue=>/precio/.test(issue.text)))throw Error('Resumen rechaza precio corregido');const salesHtml=cycleSalesHtml(3);if(!/Demanda asignada/.test(salesHtml)||!/Unidades disponibles/.test(salesHtml))throw Error('Falta detalle ventas');const historyBefore=JSON.stringify(decisionState.__cycleSettlements[1]);decisionState.PRODUCCION_META.value=999;financialReport();
 return {rows,historyStable:historyBefore===JSON.stringify(decisionState.__cycleSettlements[1])};
 });
 fs.writeFileSync(path.join(output,'debug-cycle-results.json'),JSON.stringify(results,null,2));for(const r of results.rows){assert.equal(r.closed,true);assert.equal(r.produced,100);assert.ok(r.sold>0);assert.ok(r.sold<=r.produced);assert.equal(r.revenue,r.sold*43);assert.equal(r.er.ventasTotales,r.revenue);assert.ok(r.er.costoVentas>0);assert.match(r.html,/Ventas Totales/);assert.match(r.diagram,/pd-node/);assert.doesNotMatch(r.diagram,/NaN|undefined/);assert.equal(r.repeat,false);assert.equal(r.er.impuestoRenta,Math.round(Math.max(0,r.er.utilidadAntesImpuestos*.295)*100)/100);}
 assert.equal(results.historyStable,true);assert.deepEqual(errors,[]);
 await page.screenshot({path:path.join(output,'student-dop-and-finance.png'),fullPage:true});
 fs.writeFileSync(path.join(output,'browser-cycle-results.json'),JSON.stringify(results,null,2));console.log('PASS delivered index.html app functions: three production/DOP/actual sales/inventory/accounting cycles, student ER rendering, idempotence, immutable receipts; no page errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
