'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {crearSim1,crearSim2,crearSim3,decision}=require('./escenarios_excel.cjs');
const {CONFIG}=require('../js/engine/config_excel.js');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output/logica_excel');fs.mkdirSync(out,{recursive:true});
const evidence=path.join(root,'tests/output/restaurar-decisiones/sim');fs.mkdirSync(evidence,{recursive:true});
const python=process.env.PYTHON_BIN||'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
function html(name){return execFileSync(python,['-c',`import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('${name}'))`],{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1'}}).replace('const cfg = window.SIDE_CONFIG || {};','window.SIDE_CONFIG={};const cfg = window.SIDE_CONFIG || {};').replace('const cfg=window.SIDE_CONFIG||{};','window.SIDE_CONFIG={};const cfg=window.SIDE_CONFIG||{};');}
async function comprobarBaseEnBrowser(p){
  await p.addScriptTag({content:fs.readFileSync(path.join(root,'js/engine/inventario.js'),'utf8')});
  const valores=await p.evaluate(({base,costos,carga,fixtures,celdas})=>{
    const modules={'../js/engine/produccion.js':SIDE_EXCEL_PRODUCCION,'../js/engine/puntajes.js':SIDE_EXCEL_PUNTAJES,'../js/engine/mercado.js':SIDE_EXCEL_MERCADO,'../js/engine/inventario.js':SIDE_EXCEL_INVENTARIO,'../js/engine/costos.js':SIDE_EXCEL_COSTOS,'../js/engine/config_excel.js':SIDE_EXCEL_CONFIG,'../docs/logica_excel/fixtures_excel.json':fixtures,'../docs/logica_excel/celdas_excel.json':celdas,'node:fs':{},'node:path':{},'node:assert/strict':{equal(a,b,msg){if(!Object.is(a,b))throw new Error(msg||'assert.equal');},ok(value,msg){if(!value)throw new Error(msg||'assert.ok');}}};
    const req=k=>{if(!(k in modules))throw new Error('Módulo de prueba no disponible: '+k);return modules[k];};
    const ml={exports:{}};new Function('require','module',carga)(req,ml);modules['./fixtures_excel.cjs']=ml.exports;const mb={exports:{}},mc={exports:{}};new Function('require','module','__dirname',base)(req,mb,'tests');new Function('require','module','__dirname',costos)(req,mc,'tests');return {...mb.exports.valoresBase(),...mc.exports.calcularValoresCostos()};
  },{carga:fs.readFileSync(path.join(__dirname,'fixtures_excel.cjs'),'utf8'),base:fs.readFileSync(path.join(__dirname,'paridad_base.cjs'),'utf8'),costos:fs.readFileSync(path.join(__dirname,'paridad_costos.cjs'),'utf8'),fixtures:require('../docs/logica_excel/fixtures_excel.json'),celdas:require('../docs/logica_excel/celdas_excel.json')});
  const filas=require('./paridad_base.cjs').comparar(require('./oracle/esperado_base.json').valores,valores);fs.writeFileSync(path.join(out,'sim-1-componentes-paridad.json'),JSON.stringify({total:filas.length,diferencias:filas.filter(f=>!f.ok)},null,2));assert.equal(filas.filter(f=>!f.ok).length,0);
}
async function ejecutar(numero=3){
  const escenario=numero===1?crearSim1():numero===2?crearSim2():crearSim3();
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),errors=[],pages={},ids={},history=[],studentHTML=html('index.html'),teacherHTML=html('docente.html');
  let reports=[];const game='SIDE-000';
  async function nueva(source){const p=await browser.newPage({viewport:{width:1366,height:900}});p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.abort());await p.setContent(source,{waitUntil:'networkidle'});return p;}
  async function sync(p,ciclo){await p.evaluate(({reports,ciclo,overrides})=>{Object.assign(SIDE_EXCEL_CONFIG.CONFIG,overrides);localStorage.setItem('SIDE_STUDENT_REPORTS',JSON.stringify(reports));localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({codigo:'SIDE-000',integrationMinutes:0,cycles:3,round:ciclo,cycleCloseMode:'manual',capital:1000000}));localStorage.setItem('SIDE_ACTIVE_ROUND',String(ciclo));localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:true,startedAt:new Date(Date.now()-10000).toISOString()}));localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({round:ciclo,phase:'decisions',status:'running',running:true,remaining:3600}));if(typeof currentStudent!=='undefined'){if(typeof tickStudentGame!=='function')throw new Error('Falta tickStudentGame real');tickStudentGame();}}, {reports,ciclo,overrides:escenario.overrides});}
  async function llenar(p,d,ciclo){
    const ledgerAntes=await p.evaluate(()=>JSON.stringify(cashLedger));
    await p.evaluate(({d,ciclo})=>{
      // Solo entradas de escenario: la confirmación, preview y cierre usan la UI entregada.
      decisionState.__excel={habilitado:true,version:1,round:ciclo,decisiones:SIDE_EXCEL_UI.nuevasDecisiones(),enviado:false};
      if(d.reputacionLiteral!==undefined)decisionState.__excel.decisiones.reputacionLiteral=d.reputacionLiteral;persistGameState();currentCategory='C';openDecisionMenu();currentCategory='C';renderDecisionCategory();
    },{d,ciclo});
    for(let i=1;i<d.lotes.length;i++)await p.locator('[data-agregar-lote]').click();
    if(!await p.locator('[data-excel-regimen]').count())console.log('DIAGNOSTICO',await p.evaluate(()=>({round:currentRound(),cat:currentCategory,excel:decisionState.__excel,dom:document.querySelector('#excelProductionMount')?.innerHTML,access:studentAccess()})));
    await p.evaluate(d=>{
      const assertZeroUnusedCut=value=>{if(Number(value)!==0)throw Error('Corte solo admite maquina manual');};
      const dispatch=(selector,value)=>{let el=document.querySelector(selector);if(!el){let cat=selector.includes('prestamo')?'E':selector.includes('marketing')||selector.includes('tienda')?'D':selector.includes('activo')||selector.includes('mantenimiento')?'B':'C';if(selector.includes('grupo')){const g=SIDE_EXCEL_PUNTAJES.indice[value]?.grupo;cat=({'Inversion en RR.HH.':'A','Maquina de ensamblado':'B','Maquina de acabados':'B','Molde':'B','Canal de venta':'D','Acceso a prestamo bancario':'E'})[g]||'C';}currentCategory=cat;renderTabs();renderDecisionCategory();el=document.querySelector(selector);}if(!el&&/data-personal="corte,[0-2],[1-2]"/.test(selector)){assertZeroUnusedCut(value);return;}if(!el)throw new Error('Falta control '+selector);el.value=String(value??'');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
      dispatch('[data-excel-regimen]',d.regimen||'MYPE');dispatch('[data-excel-prestamo]',d.montoPrestamo||0);
      dispatch('[data-excel-garantia]',d.garantiaDias??'');dispatch('[data-excel-marketing]',d.marketingNivel??'');dispatch('[data-excel-garantia-proveedor]',d.garantiaProveedor??0);
      for(const [selector,checked] of [['[data-excel-mantenimiento]',d.mantenimientoPreventivo],['[data-excel-analista]',d.analistaCompras]]){currentCategory=selector.includes('mantenimiento')?'B':'C';renderTabs();renderDecisionCategory();const el=document.querySelector(selector);if(!el)throw new Error('Falta control '+selector);el.checked=!!checked;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
      for(const [district,count] of Object.entries(d.tiendasPorDistrito||{}))dispatch(`[data-excel-tienda="${district}"]`,count);
      const normal=SIDE_EXCEL_PRODUCCION.normalizarPersonal(d.personal||{});for(const [area,filas] of Object.entries(normal))filas.forEach((fila,n)=>fila.forEach((v,m)=>dispatch(`[data-personal="${area},${n},${m}"]`,v)));
      for(const [k,v] of Object.entries(d.maquinaria||{}))dispatch(`[data-activo="${k}"]`,v);
      for(const [k,v] of Object.entries(d.comprasUnidades||{}))dispatch(`[data-compra="${k}"]`,v);
      for(const [k,v] of Object.entries(d.compras||{}))dispatch(`[data-compra="${k}"]`,v/SIDE_EXCEL_CONFIG.CONFIG.CONVERSION_COMPRA[k]);
      const derivados=[...Object.values(SIDE_EXCEL_CONFIG.CONFIG.GARANTIA_MAPEO_EXACTO),...Object.values(SIDE_EXCEL_CONFIG.CONFIG.MARKETING_BASE).map(row=>row.codigo)];
      for(const code of d.seleccion||[]){if(derivados.includes(code))continue;const cat=({'Inversion en RR.HH.':'A','Maquina de ensamblado':'B','Maquina de acabados':'B','Molde':'B','Canal de venta':'D','Acceso a prestamo bancario':'E'})[SIDE_EXCEL_PUNTAJES.indice[code]?.grupo]||'C';currentCategory=cat;renderTabs();renderDecisionCategory();const option=[...document.querySelectorAll('[data-excel-grupo] option')].find(o=>o.value===code);if(!option)throw new Error('Opción Excel ausente: '+code);dispatch(`[data-excel-grupo="${option.parentElement.dataset.excelGrupo}"]`,code);}
      d.lotes.forEach((l,i)=>{for(const campo of ['segmento','cantidad','cuero','accesorios','hilo','molde','precio'])dispatch(`[data-lote="${i}"][data-campo="${campo}"]`,l[campo]??'');});
    },d);
    if(numero===3&&ciclo===1&&d.garantiaDias===180){
      await p.setViewportSize({width:390,height:844});
      await p.locator('.excel-editor details').evaluateAll(items=>items.forEach(el=>el.open=true));
      await p.screenshot({path:path.join(evidence,'auditoria-menu-congelado-movil.png'),fullPage:true});
      const menu=await p.evaluate(()=>({ancho:document.documentElement.scrollWidth,viewport:innerWidth,
        grupos:[...document.querySelectorAll('[data-excel-grupo]')].map(el=>({grupo:el.parentElement.firstChild.textContent,opciones:[...el.options].map(o=>o.value)})),
        garantia:[...document.querySelector('[data-excel-garantia]').options].map(o=>o.value),marketing:(()=>{currentCategory='D';renderTabs();renderDecisionCategory();const result=[...document.querySelector('[data-excel-marketing]').options].map(o=>o.textContent);currentCategory='C';renderTabs();renderDecisionCategory();return result;})(),
        creditoEditable:!!document.querySelector('[data-excel-credito]'),publicidadLibre:!!document.querySelector('[data-excel-publicidad]')}));
      assert.ok(menu.ancho<=menu.viewport+1,'Editor congelado sin desborde móvil');assert.equal(menu.creditoEditable,false);assert.equal(menu.publicidadLibre,false);
      fs.writeFileSync(path.join(evidence,'auditoria-menu-congelado.json'),JSON.stringify(menu,null,2));
      await p.setViewportSize({width:1366,height:900});
    }
    await p.locator('[data-excel-enviar]').click();assert.match(await p.locator('[data-excel-status]').innerText(),/confirmado/);
    await p.evaluate(()=>updateHud());assert.equal(await p.evaluate(()=>decisionProgressPercent()),100,'Confirmar lotes completa progreso');assert.match(await p.locator('#decisionProgressText').innerText(),/5\/5.*100%/);assert.equal(await p.locator('#topSubmitAllDecisions').isDisabled(),true,'Plan confirmado no reabre revisión antigua');
    assert.equal(await p.evaluate(()=>JSON.stringify(cashLedger)),ledgerAntes,'Confirmar Excel no vuelve a descontar el ledger anterior');
    const report=await p.evaluate(()=>syncStudentReportPreview());const enviadas=report.excelDecisionState?.decisiones;assert.ok(enviadas,'Reporte conserva plan confirmado');assert.equal(enviadas.montoPrestamo,d.montoPrestamo||0,'Préstamo UI igual al escenario');if(d.reputacionLiteral!==undefined)assert.equal(enviadas.reputacionLiteral,d.reputacionLiteral,'Reputación literal igual al escenario');assert.equal(enviadas.lotes.length,d.lotes.length,'Lotes completos');
    for(const [i,lote] of d.lotes.entries())for(const campo of ['segmento','cantidad','cuero','accesorios','hilo','molde','precio'])assert.equal(enviadas.lotes[i][campo]??'',lote[campo]??'',`Lote ${i} ${campo}: UI conserva entrada`);
    const personalEsperado=require('../js/engine/produccion.js').normalizarPersonal(d.personal||{});assert.deepEqual(enviadas.personal,personalEsperado,'Personal UI igual al escenario');
    assert.deepEqual([...enviadas.seleccion].sort(),[...d.seleccion].sort(),'UI y oráculo reciben los mismos grupos finales');
    for(const campo of ['garantiaDias','marketingNivel','analistaCompras','mantenimientoPreventivo','garantiaProveedor','publicidad'])assert.equal(enviadas[campo],d[campo],`UI conserva ${campo}`);
    assert.deepEqual(enviadas.tiendasPorDistrito,d.tiendasPorDistrito,'UI conserva distritos anteriores');
    for(const [codigo,cantidad] of Object.entries(d.compras||{}))assert.equal(enviadas.comprasUnidades[codigo],cantidad/CONFIG.CONVERSION_COMPRA[codigo],`Compra ${codigo}: mismas unidades`);
    return report;
  }
  try{
    for(const id of escenario.empresas){console.log('Registro',id);const p=await nueva(studentHTML);pages[id]=p;await sync(p,1);await p.evaluate(()=>showModal('studentModal'));await p.locator('#gameCode').fill(game);await p.locator('#companyLegalName').fill('Empresa '+id);await p.locator('#companyBrandName').fill(id);await p.evaluate(id=>localStorage.setItem('SIDE_DECISIONS_SIDE-000_'+id,JSON.stringify({__excel:{habilitado:true,version:1,round:1,enviado:false,decisiones:SIDE_EXCEL_UI.nuevasDecisiones()}})),id);await p.locator('#studentForm button[type=submit]').click();await p.waitForFunction(id=>currentStudent.company===id&&studentConnected,id);if(await p.locator('#cycleCostsUnderstood').isVisible())await p.locator('#cycleCostsUnderstood').click();const r=await p.evaluate(()=>syncStudentReportPreview());ids[id]=r.id;reports.push(r);}
    const teacher=await nueva(teacherHTML);
    for(let i=0;i<escenario.ciclos.length;i++){
      console.log('Ciclo',i+1);const ciclo=i+1,decisiones=escenario.ciclos[i].decisionesPorEmpresa;
      for(const id of escenario.empresas){const p=pages[id];await sync(p,ciclo);if(!decisiones[id]){if(ciclo===1){await p.evaluate(()=>{decisionState.__excel={habilitado:true,round:1,enviado:false,decisiones:SIDE_EXCEL_UI.nuevasDecisiones()};persistGameState();});const report=await p.evaluate(()=>syncStudentReportPreview());reports=reports.map(r=>r.id===report.id?report:r);}continue;}console.log('Decision',ciclo,id);const report=await llenar(p,decisiones[id],ciclo);reports=reports.map(r=>r.id===report.id?report:r);}
      await sync(teacher,ciclo);const closure=await teacher.evaluate(({ciclo,reports})=>{state.partidaId=null;state.round=ciclo;state.reports=reports;$('gameCode').value='SIDE-000';return closeExcelLocalRound();},{ciclo,reports});
      assert.ok(closure,'Cierre docente local');history.push(closure);reports=await teacher.evaluate(()=>JSON.parse(localStorage.getItem('SIDE_STUDENT_REPORTS')));
      for(const [id,r] of Object.entries(closure.resultadosPorEmpresa)){
        assert.ok(r.financial,'El cierre entrega una sola caja');
        const report=reports.find(x=>x.id===id);assert.ok(report,'Reporte del cierre');
        assert.equal(report.caja,r.financial.balanceCaja.cajaFinal,'Docente y reporte comparten caja');
        assert.equal(report.utilidad,r.financial.estadoResultados.utilidad,'Docente y reporte comparten utilidad');
      }
      for(const p of Object.values(pages)){const keys=await teacher.evaluate(()=>Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter(k=>k.startsWith('SIDE_EXCEL_')).map(k=>[k,localStorage.getItem(k)])));await p.evaluate(({keys,reports})=>{for(const[k,v]of Object.entries(keys))localStorage.setItem(k,v);localStorage.setItem('SIDE_STUDENT_REPORTS',JSON.stringify(reports));currentCategory='A';renderTabs();renderDecisionCategory();},{keys,reports});}
      await pages.A.screenshot({path:path.join(out,`sim-${numero}-ciclo-${ciclo}.png`),fullPage:true});
      assert.ok(await pages.A.locator('#companySummaryMount .excel-resultados').count(),'El estudiante ve el resultado Excel');
      const financialA=closure.resultadosPorEmpresa[ids.A].financial;
      const visibleA=await pages.A.evaluate(()=>({cash:cashBalance(),financial:financialReport(),summary:document.querySelector('#companySummaryMount .excel-resultados')?.textContent}));
      assert.equal(visibleA.cash,financialA.balanceCaja.cajaFinal,'Caja decisiones coincide con cierre');
      // El transporte JSON de localStorage normaliza -0 a 0; comparar el mismo contrato persistido.
      assert.deepEqual(visibleA.financial,JSON.parse(JSON.stringify(financialA)),'Resumen estudiante conserva estados del cierre');
      assert.ok(visibleA.summary.includes(financialA.balanceCaja.cajaFinal.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})),'Resumen muestra caja final');
      const hudA=await pages.A.evaluate(()=>{const ledger=JSON.stringify(cashLedger);updateCashHud();return {ledger,despues:JSON.stringify(cashLedger),texto:$('cashBalance').textContent,esperado:money(cashBalance()),animada:$('cashBalance').classList.contains('cash-pulse')};});
      assert.equal(hudA.texto,hudA.esperado,'HUD decisiones muestra caja del mismo cierre');assert.equal(hudA.ledger,hudA.despues,'Actualizar caja no duplica cargos');
      if(financialA.flujoCaja.flujoNeto!==0)assert.ok(hudA.animada,'Cambio real de caja conserva animación');
      await pages.A.locator('#companySummaryMount .excel-resultados').last().screenshot({path:path.join(out,`sim-${numero}-resultado-${ciclo}.png`)});
    }
    // Reetiquetar exclusivamente identidad local; los importes siguen siendo salida del navegador.
    const resultados=history.map(c=>({...c,resultadosPorEmpresa:Object.fromEntries(Object.entries(ids).filter(([,local])=>c.resultadosPorEmpresa[local]).map(([id,local])=>[id,c.resultadosPorEmpresa[local]]))}));
    fs.writeFileSync(path.join(out,`sim-${numero}-navegador.json`),JSON.stringify({escenario:escenario.id,ids,resultados,errors},null,2));assert.deepEqual(errors,[]);
    if(numero===1)await comprobarBaseEnBrowser(pages.A);
    {const {valoresDesdeResultados}=require('./oracle/comparar_pipeline.cjs');const valores=valoresDesdeResultados(resultados),esperado=require(`./oracle/esperado_sim${numero}_pipeline.json`).valores;const filas=require('./paridad_base.cjs').comparar(esperado,valores);fs.writeFileSync(path.join(out,`sim-${numero}-paridad.json`),JSON.stringify({total:filas.length,diferencias:filas.filter(f=>!f.ok)},null,2));assert.equal(filas.filter(f=>!f.ok).length,0);}
    await pages.A.setViewportSize({width:390,height:844});
    await pages.A.locator('#companySummaryMount .excel-resultados').last().scrollIntoViewIfNeeded();
    const mobile=await pages.A.evaluate(()=>({viewport:innerWidth,ancho:document.documentElement.scrollWidth,resultados:[...document.querySelectorAll('#companySummaryMount .excel-resultados')].map(el=>({ancho:el.getBoundingClientRect().width,derecha:el.getBoundingClientRect().right}))}));
    fs.writeFileSync(path.join(out,`sim-${numero}-movil-geometria.json`),JSON.stringify(mobile,null,2));
    assert.ok(mobile.resultados.length>0&&mobile.resultados.every(r=>r.ancho>0),'Resultado visible en móvil');
    assert.ok(mobile.resultados.every(r=>r.derecha<=mobile.viewport+1),`Resumen completo dentro de móvil: ${JSON.stringify(mobile)}`);
    assert.ok(mobile.ancho<=mobile.viewport+1,`Sin desborde móvil: ${JSON.stringify(mobile)}`);
    await pages.A.screenshot({path:path.join(out,`sim-${numero}-movil.png`),fullPage:true});
    for(const name of fs.readdirSync(out).filter(n=>n.startsWith(`sim-${numero}-`)))fs.copyFileSync(path.join(out,name),path.join(evidence,name));
    console.log(`PASS SIM-${numero}: registro normal, decisiones UI, cierre docente, ${history.length} ciclo(s), ${escenario.empresas.length} empresas; móvil sin desborde.`);return resultados;
  }finally{await browser.close();}
}
if(require.main===module)ejecutar(Number(process.argv[2]||3)).catch(e=>{console.error(e);process.exitCode=1;});module.exports={ejecutar,html};









