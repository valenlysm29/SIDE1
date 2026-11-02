'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {execFileSync}=require('node:child_process'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'js/docente.js'),'utf8');
test('report reconciliation keeps verified previews while waiting, coalesces requests and rejects old rooms',async()=>{
  let release,reads=0,renders=0;
  const original={id:'1',fuente:'supabase',partida:'SIDE-TEST',materialPreview:'verified',materialDeliveryForms:'form'};
  const ctx={state:{partidaId:'A',reports:[original],authoritative:{materialRulesVersion:'receipts-v1'}},roomGeneration:1,reportsRevision:0,reportsBusy:false,reportsAgain:false,providerDeliveryPending:0,providerDeliveryEditing:()=>false,$:()=>({value:'SIDE-TEST'}),localStorage:{getItem:()=>null},window:{},setTimeout(){},console,
    supabaseReports:async()=>{reads++;return new Promise(resolve=>release=resolve)},applyConfirmedReportClosures:rows=>rows,renderResults:()=>renders++,renderCompanies(){},renderWinnerSelect(){},renderTeacherLobby(){},renderTeacherChallengeControls(){}};
  vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function loadReports('),source.indexOf('\nfunction sectionBadges(')),ctx);
  const request=ctx.loadReports();await ctx.loadReports();
  assert.equal(reads,1);assert.equal(renders,0);assert.equal(original.materialPreview,'verified');assert.equal(original.materialDeliveryForms,'form');
  ctx.state.partidaId='B';ctx.roomGeneration++;release([{id:'old'}]);await request;
  assert.equal(ctx.state.reports[0],original);assert.equal(renders,0);
});
test('teacher and laboratory retain unchanged DOM in desktop and mobile Chromium',async()=>{
  const python=process.env.PYTHON_BIN||'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
  const html=execFileSync(python,['-c',"import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('docente.html'))"],{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const errors=[];
  try{for(const width of [1366,390]){
    const page=await browser.newPage({viewport:{width,height:900}});page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>r.abort());await page.setContent(html,{waitUntil:'load'});
    const result=await page.evaluate(()=>{
      stopLiveCompanies();clearInterval(teacherPoll);clearInterval(teacherTick);
      $('tab-resultados').classList.add('active');state.partidaId='test';state.resultCompanyId='1';
      state.reports=[1,2,3].map(id=>({id:String(id),empresaId:id,empresa:'Empresa '+id,ronda:1,estado:'activa',apartados:{},cycleReceipt:{sold:10},estadoResultados:{ingresos:1000,utilidadNeta:100},ingresos:1000,utilidad:100,costos:900,caja:100100}));
      renderResults();const select=$('resultComparisonSort'),detail=$('detailReports').firstElementChild,stats=$('resultStats').firstElementChild;
      select.focus();for(let i=0;i<10;i++)renderResults();
      const stable=select===$('resultComparisonSort')&&detail===$('detailReports').firstElementChild&&stats===$('resultStats').firstElementChild&&document.activeElement===select;
      state.reports[0].ingresos=2000;state.reports[0].estadoResultados.ingresos=2000;renderResults();
      return {stable,updated:$('detailReports').textContent.includes('2,000')||$('detailReports').textContent.includes('2.000')};
    });assert.deepEqual(result,{stable:true,updated:true});
    await page.evaluate(()=>{
      const svc=SIDE_LAB_SERVICE;svc.games=async()=>[{id:'g',nombre:'Prueba',configuracion:{cycles:3}}];svc.companies=async()=>[1,2,3].map(id=>({empresa_id:id,empresa:'Empresa '+id}));
      svc.closure=async()=>({resultadosPorEmpresa:Object.fromEntries([1,2,3].map(id=>[id,{receipt:{produced:10,sold:10,revenue:1000},financial:{estadoResultados:{ingresos:1000,costos:900,utilidadNeta:100},balanceCaja:{cajaFinal:100100}}}]))});SIDE_LAB.open();
    });
    await page.waitForSelector('.lab-chart',{state:'attached'});
    await page.evaluate(()=>window.labNode=document.querySelector('.lab-chart'));
    await page.evaluate(()=>SIDE_LAB.open());await page.waitForTimeout(200);
    assert.equal(await page.evaluate(()=>labNode===document.querySelector('.lab-chart')),true);
    await page.screenshot({path:path.join(__dirname,`output/parpadeos-docente-${width}.png`),fullPage:true});await page.close();
  }assert.deepEqual(errors,[]);}finally{await browser.close();}
});
