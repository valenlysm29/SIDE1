/* Isolated teacher-page test: real jsPDF, clicks and downloads; no live account. */
const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output/teacher-pdf');
const model=require('../js/financial_model');
const python=process.env.PYTHON_BIN||'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
async function main(){
  fs.mkdirSync(out,{recursive:true});
  const sdk=path.join(out,'jspdf.umd.min.js');
  if(!fs.existsSync(sdk)){
    const response=await fetch('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
    assert.ok(response.ok);fs.writeFileSync(sdk,await response.text());
  }
  let html=execFileSync(python,['-c',"import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('docente.html'))"],{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1'}});
  html=html.replace('<head>','<head><script>'+fs.readFileSync(sdk,'utf8').replace(/<\/script/gi,'<\\/script')+'</script>');
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const errors=[];
  try{
    const page=await browser.newPage({acceptDownloads:true,viewport:{width:1366,height:900},locale:'es-PE',timezoneId:'America/Lima'});
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>route.abort());
    await page.route('http://side.test/**',route=>route.fulfill({contentType:'text/html',body:html}));
    await page.goto('http://side.test/');
    await page.waitForFunction(()=>Boolean(window.SIDE_TEACHER_PDF));
    const financial=model.calculate({capital:18500,round:3,ledger:{'3:SIM_VENTAS':72000,'3:SIM_GASTOS':-42800,'3:EVENT_COSTO':-3200,'3:AJUSTE':1500,'3:SIM_INVERSION':-11500,'3:E_FINANZA':5000},breakdowns:{'3:E_FINANZA':{loan:5000}}});
    // Deterministic reference figures, matching the supplied example statements.
    const report={id:'sample',empresa:'Comercial Andina',legalName:'Comercial Andina S.A.C.',nombre:'Equipo Horizonte Empresarial',partida:'SIDE-042',ronda:3,estado:'activa',teacherScore:16,
      estadoResultados:{ventasNetas:72000,costos:42800,impactoEventos:-3200,otros:1500,utilidad:27500},
      balanceCaja:{cajaInicial:18500,entradas:78500,salidas:57500,cajaFinal:39500},
      flujoCaja:{operacion:27500,inversion:-11500,financiamiento:5000,flujoNeto:21000},
      balanceGeneral:{efectivo:39500,activosFijos:35500,activos:75000,deuda:20000,patrimonio:55000,pasivoPatrimonio:75000},
      apartados:{B:{done:3,total:3},C:{done:5,total:5}},eventos:[{titulo:'Alza temporal del costo logístico',afectados:'Comercial Andina S.A.C.',cicloAfecta:'3 y 4',implicancia:'Impacto de (S/ 3,200.00) en el ciclo 3',ocurrencia:25}]};
    async function seed(reports){
      await page.evaluate(reports=>{
        state.reports=reports;state.partidaId=null;state.resultCompanyId=reports[0]?.id;
        localStorage.setItem('SIDE_STUDENT_REPORTS',JSON.stringify(reports));
        $('gameCode').value='SIDE-042';$('gameName').value='SIDE - Simulación Principal';$('cycles').value=6;
        renderResults();switchTab('resultados');
      },reports);
    }
    await seed([report,{...report,id:'excluded',empresa:'EMPRESA ELIMINADA',estado:'eliminada'}]);
    const downloadPromise=page.waitForEvent('download');
    await page.locator('#downloadPdf').click();const download=await downloadPromise;
    assert.equal(download.suggestedFilename(),'SIDE-042-resultados.pdf');
    await download.saveAs(path.join(out,'button-download.pdf'));
    assert.ok(fs.statSync(path.join(out,'button-download.pdf')).size>10000);
    function pdfText(file){
      return execFileSync(python,['-c',"from pypdf import PdfReader; import sys; print(' '.join(p.extract_text() for p in PdfReader(sys.argv[1]).pages))",file],{encoding:'utf8',env:{...process.env,PYTHONUTF8:'1'}});
    }
    const downloadedText=pdfText(path.join(out,'button-download.pdf'));
    for(const value of ['Nombre comercial','Razón social','Comercial Andina S.A.C.','3/6','Proyecto Side','Simulador Interactivo de Decisiones Empresariales'])assert.ok(downloadedText.includes(value),value);
    for(const value of ['Estudiante / equipo','Equipo Horizonte Empresarial','Institución','Importes en soles peruanos','Simulador empresarial educativo','EMPRESA ELIMINADA'])assert.ok(!downloadedText.includes(value),value);
    await page.locator('#viewPdf').click();await page.waitForFunction(()=>$('pdfFrame').src.startsWith('blob:')&&!pdfBusy);
    assert.equal(await page.locator('#pdfModal').isVisible(),true);
    const previewUrl=await page.locator('#pdfFrame').getAttribute('src');
    assert.equal(await page.evaluate(async url=>(await fetch(url)).ok,previewUrl),true);
    await page.locator('#closePdf').click();
    assert.equal(await page.locator('#pdfModal').isVisible(),false);
    assert.equal(await page.evaluate(async url=>{try{await fetch(url);return false}catch{return true}},previewUrl),true);
    async function savePdf(filename,reports,config={}){
      const encoded=await page.evaluate(async ({reports,config})=>window.SIDE_TEACHER_PDF.create({jsPDF:window.jspdf.jsPDF,reports,config:{codigo:'SIDE-042',cycles:6,...config},logo:await pdfLogo(),generatedAt:'2026-09-30T16:00:00Z'}).output('datauristring'),{reports,config});
      fs.writeFileSync(filename,Buffer.from(encoded.split(',')[1],'base64'));
    }
    const output=path.join(root,'output/pdf');fs.mkdirSync(output,{recursive:true});
    await savePdf(path.join(output,'SIDE_Informe_Formato_Integrado.pdf'),[report],{institucion:'Institución Educativa Demo SIDE',docente:'Dra. Ana Torres Salazar'});
    assert.ok(!pdfText(path.join(output,'SIDE_Informe_Formato_Integrado.pdf')).includes('Institución'));
    const long={...report,id:'long',empresa:'Corporación de Calzado e Inversiones Empresariales Los Olivos y Asociados',legalName:'Corporación de Calzado e Inversiones Empresariales Los Olivos y Asociados S.A.C.',nombre:'Equipo de investigación y gestión empresarial María José Quiñones y compañeros',teacherScore:null,
      eventos:Array.from({length:48},(_,i)=>({titulo:`Evento ${i+1}`,descripcion:'Aumento del costo logístico y variación de demanda para todas las empresas participantes.',afectados:'Todas las empresas',cicloAfecta:'3 y 4',implicancia:'Variación de costos y ventas durante los ciclos afectados.',ocurrencia:i===0?0:25}))};
    await savePdf(path.join(out,'stress.pdf'),[long,{...financial,empresa:'Empresa sin eventos',nombre:'José Pérez',ronda:3,teacherScore:0}, {empresa:'Empresa sin datos',nombre:'Lucía Núñez',ronda:1}]);
    const stressText=pdfText(path.join(out,'stress.pdf'));
    assert.ok(stressText.includes('1/6'));assert.ok(stressText.includes('3/6'));
    assert.ok(stressText.includes('Sin datos'));assert.ok(!stressText.includes('Lucía Núñez'));
    await seed([]);await page.locator('#downloadPdf').click();
    await page.waitForFunction(()=>!pdfBusy);
    assert.match(await page.locator('#toast').innerText(),/No hay empresas activas/);
    await seed([report]);
    await page.evaluate(()=>{window.jspdf=null});
    await page.locator('#downloadPdf').click();await page.waitForFunction(()=>!pdfBusy);
    assert.match(await page.locator('#toast').innerText(),/generador PDF/);
    assert.equal(await page.locator('#downloadPdf').isEnabled(),true);
    assert.deepEqual(errors,[]);
    console.log('PASS: actual teacher download and preview; excluded companies; URL cleanup; empty roster; missing SDK; long names; 48 events; missing data; zero grade.');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
