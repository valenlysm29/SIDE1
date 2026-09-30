'use strict';
// Delivered teacher HTML/CSS/JS in Chromium. No production account or network writes.
const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output/teacher-history');
const python=process.env.PYTHON_BIN||'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const snapshot={partida:{id:'game-one',codigo:'SIDE-777',nombre:'Historial empresarial',curso:'Administración',finalizada_at:'2026-09-30T19:00:00Z',ciclos_jugados:2,cantidad_empresas:2},empresas:[
  {id:1,nombre_comercial:'Comercial Andina',nombre_legal:'Andina SAC',puntaje_docente:0,caja_actual:39000,
    decisiones:[{ciclo:1,decision_id:'MESA_CORTE',opcion_id:'mesa',cantidad:2,costo_total:5000},{ciclo:2,decision_id:'PRODUCCION_META',cantidad:80,costo_total:0}],
    reportes:[1,2].map(ciclo=>({ciclo,ingresos:20000,utilidad:3000,caja_final:25000,estado_resultados:{ventasNetas:20000,costos:17000,utilidad:3000},balance_caja:{cajaInicial:22000,cajaFinal:25000,balanceGeneral:{efectivo:25000,activos:40000,deuda:3000,patrimonio:37000}},flujo_caja:{operacion:3000,inversion:0,financiamiento:0,flujoNeto:3000},indicadores:{rentabilidad:0.15}}))},
  {id:2,nombre_comercial:'Empresa Costa <script>window.historyAttack=true</script>',nombre_legal:'Costa SAC',puntaje_docente:null,decisiones:[],reportes:[]}
]};
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const html=execFileSync(python,['-c',"import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('docente.html'))"],{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1'}});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const failures=[];
  try{
    for(const viewport of [{width:1366,height:900},{width:390,height:844}]){
      const page=await browser.newPage({viewport,locale:'es-PE',timezoneId:'America/Lima'});
      page.setDefaultTimeout(45000);
      page.on('pageerror',error=>failures.push(error.message));
      page.on('console',message=>{if(message.type()==='error')failures.push(message.text())});
      await page.route('**/*',route=>route.abort());
      await page.setContent(html,{waitUntil:'load'});
      await page.evaluate(()=>{
        clearInterval(teacherPoll);clearInterval(companiesPoll);
        window.historyReply={data:null,error:null};window.historyCalls=[];
        SIDE.SupabaseClient.get=()=>({rpc:async(...args)=>{historyCalls.push(args);return historyReply}});
      });
      await page.locator('[data-tab="decisiones"]').click();
      await page.waitForFunction(()=>document.querySelector('#historyContent').getAttribute('aria-busy')==='false');
      assert.match(await page.locator('#historyContent').innerText(),/Aún no hay una partida anterior registrada/);
      assert.equal(await page.locator('#refreshHistory').isEnabled(),true);
      await page.evaluate(data=>{historyReply={data,error:null}},snapshot);
      await page.locator('#refreshHistory').click();
      await page.waitForFunction(()=>Boolean(document.querySelector('#historyCompanySelect')));
      assert.equal(await page.locator('#historyCompanySelect option').count(),2);
      assert.match(await page.locator('#historyContent').innerText(),/SIDE-777/);
      assert.match(await page.locator('.history-grade').innerText(),/0 \/ 20/);
      assert.match(await page.locator('.history-cycle').first().innerText(),/Infraestructura/);
      assert.match(await page.locator('.history-cycle').first().innerText(),/Mesas de corte/);
      assert.equal(await page.locator('.history-cycle').count(),2);
      await page.locator('.history-financial summary').first().click();
      assert.match(await page.locator('.history-financial').first().innerText(),/Balance general/);
      assert.match(await page.locator('.history-financial').first().innerText(),/rentabilidad/);
      assert.equal(await page.locator('#historyContent input,#historyContent textarea,#historyContent button').count(),0);
      await page.locator('.history-cycle > summary').nth(1).click();
      assert.match(await page.locator('.history-cycle').nth(1).innerText(),/Producción/);
      await page.screenshot({path:path.join(out,viewport.width>500?'desktop.png':'mobile.png'),fullPage:true});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'the history panel must not overflow the mobile viewport');
      await page.locator('#historyCompanySelect').selectOption('2');
      assert.match(await page.locator('.history-grade').innerText(),/Sin calificar/);
      assert.match(await page.locator('.history-company-heading h3').innerText(),/Empresa Costa/);
      assert.equal(await page.evaluate(()=>window.historyAttack),undefined);
      await page.evaluate(()=>{historyReply={data:{partida:{codigo:'SIDE-NEW',ciclos_jugados:1},empresas:[{id:3,nombre_comercial:'Empresa Nueva',reportes:[],decisiones:[]}]},error:null}});
      await page.locator('#refreshHistory').click();
      await page.waitForFunction(()=>document.querySelector('#historyContent').textContent.includes('SIDE-NEW'));
      assert.equal(await page.locator('#historyCompanySelect option').count(),1);
      assert.doesNotMatch(await page.locator('#historyContent').innerText(),/Andina|SIDE-777/);
      await page.evaluate(()=>{historyReply={data:null,error:{code:'PGRST202',message:'function does not exist'}}});
      for(let i=0;i<3;i++){
        await page.locator('#refreshHistory').click();
        await page.waitForFunction(()=>document.querySelector('#historyContent').getAttribute('aria-busy')==='false');
        assert.match(await page.locator('#historyStatus').innerText(),/SQL.*Supabase/);
        assert.equal(await page.locator('#historyContent').innerText(),'');
      }
      await page.locator('[data-tab="empresas"]').click();assert.equal(await page.locator('#tab-empresas').isVisible(),true);
      await page.locator('[data-tab="resultados"]').click();assert.equal(await page.locator('#tab-resultados').isVisible(),true);
      await page.locator('[data-tab="configuracion"]').click();assert.equal(await page.locator('#tab-configuracion').isVisible(),true);
      assert.ok((await page.evaluate(()=>historyCalls)).every(args=>args.length===1&&args[0]==='obtener_ultima_partida_docente'));
      await page.close();console.log(`PASS ${viewport.width}px: empty, multi-company/cycle statements/zero grade, read-only, XSS, latest replacement, missing migration feedback and existing navigation`);
    }
    assert.deepEqual(failures,[]);console.log('PASS no new browser or console errors on desktop and mobile');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
