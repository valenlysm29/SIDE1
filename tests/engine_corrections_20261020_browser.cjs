'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output/engine-corrections-20261020');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<html lang="es"><meta name="viewport" content="width=device-width, initial-scale=1"><body><main id="editor"></main></body></html>',{waitUntil:'networkidle'});
  for(const name of ['design-system','excel'])await page.addStyleTag({path:path.join(root,'css',name+'.css')});
  for(const name of ['config_excel','catalogo_excel','puntajes','produccion','costos','consecuencias','mercado','ciclo','caja','ui_excel'])await page.addScriptTag({path:path.join(root,'js/engine',name+'.js')});
  await page.evaluate(()=>{window.saved=null;SIDE_EXCEL_UI.mountEditor(document.querySelector('#editor'),{round:1,motorVersion:SIDE_EXCEL_CONFIG.MOTOR_ACTUAL,getState:()=>({}),save:value=>window.saved=value});});
  assert.equal(await page.locator('[data-excel-enable]').count(),0);
  await page.locator('[data-excel-regimen]').selectOption('NO_MYPE');assert.match(await page.locator('#editor').textContent(),/1,856\.54/);
  await page.locator('[data-excel-regimen]').selectOption('MYPE');
  await page.locator('details').evaluateAll(rows=>rows.forEach(el=>el.open=true));
  await page.locator('[data-activo="mesa"]').fill('6');assert.equal(await page.locator('[data-activo="mesa"]').inputValue(),'1');
  await page.locator('[data-lote="0"][data-campo="cantidad"]').fill('-5');assert.equal(await page.locator('[data-lote="0"][data-campo="cantidad"]').inputValue(),'0');
  await page.locator('[data-excel-guardar]').click();assert.equal(await page.evaluate(()=>saved.habilitado),true);assert.equal(await page.evaluate(()=>saved.enviado),false);
  const layouts=[];for(const [width,height] of [[360,800],[414,896],[1150,666],[1440,900]]){
   await page.setViewportSize({width,height});const geometry=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));assert.ok(geometry.document<=width+1,JSON.stringify(geometry));
   await page.screenshot({path:path.join(out,`editor-${width}.png`),fullPage:true});layouts.push({width,height,...geometry});
  }
  const distribution=[];for(const category of ['B','C','D','E','F']){
   await page.evaluate(category=>SIDE_EXCEL_UI.mountEditor(document.querySelector('#editor'),{round:1,motorVersion:SIDE_EXCEL_CONFIG.MOTOR_ACTUAL,category,getState:()=>window.saved||{},save:value=>window.saved=value}),category);
   const controls=await page.locator('[data-excel-section]').evaluateAll(rows=>rows.map(el=>el.dataset.excelSection));assert.ok(controls.length>0);assert.ok(controls.every(cat=>cat===category));
   const selectors={B:'[data-activo="mesa"]',C:'[data-lote="0"][data-campo="cantidad"]',D:'[data-excel-marketing]',E:'[data-excel-prestamo]',F:'[data-compra="INS-01"]'};assert.equal(await page.locator(selectors[category]).count(),1);
   if(category==='E'){await page.locator('[data-excel-prestamo]').fill('1234');assert.equal(await page.evaluate(()=>saved.decisiones.montoPrestamo),1234);}
   distribution.push({category,controls:controls.length});
  }
  assert.equal(await page.evaluate(()=>saved.decisiones.montoPrestamo),1234);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({passed:true,layouts,distribution,errors},null,2));console.log(JSON.stringify({passed:true,layouts}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
