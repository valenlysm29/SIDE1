'use strict';
const { chromium }=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output/decision-cards-20261022');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<html lang="es"><meta name="viewport" content="width=device-width, initial-scale=1"><body><main id="editor"></main></body></html>');
 for(const name of ['design-system','excel','production'])await page.addStyleTag({path:path.join(root,'css',name+'.css')});
 for(const name of ['config_excel','catalogo_excel','puntajes','produccion','costos','consecuencias','mercado','ciclo','caja','ui_excel'])await page.addScriptTag({path:path.join(root,'js/engine',name+'.js')});
 const mount=async category=>page.evaluate(category=>{window.saved=window.saved||{};SIDE_EXCEL_UI.mountEditor(document.querySelector('#editor'),{category,round:1,cash:100000,motorVersion:SIDE_EXCEL_CONFIG.MOTOR_ACTUAL,getState:()=>window.saved,save:s=>window.saved=s});},category);
 await mount('A');assert.ok(await page.getByRole('radio').count()>0);await page.getByRole('radio',{name:/Baja/}).click();assert.equal(await page.evaluate(()=>saved.decisiones.seleccion.includes('INV-01A')),true);assert.equal(await page.evaluate(()=>saved.decisionesGuardadas.seleccion.includes('INV-01A')),false);
 await page.getByRole('button',{name:'Guardar decisión',exact:true}).first().click();assert.equal(await page.evaluate(()=>saved.decisionesGuardadas.seleccion.includes('INV-01A')),true);
 const savedCash=await page.evaluate(()=>saved.saldoFinalGuardado);await page.getByRole('radio',{name:/Media/}).click();assert.equal(await page.getByRole('button',{name:'Guardar decisión',exact:true}).count(),1);assert.equal(await page.getByText('Cambios pendientes de guardar',{exact:true}).count(),1);
 await mount('B');await page.locator('[data-activo="mesa"]').fill('1');assert.equal(await page.evaluate(()=>saved.saldoFinalGuardado),savedCash);assert.equal(await page.evaluate(()=>saved.decisionesGuardadas.maquinaria.mesa||0),0);
 await mount('A');assert.equal(await page.evaluate(()=>saved.decisionesGuardadas.maquinaria.mesa||0),0);
 await mount('B');await page.locator('[data-activo="mesa"]').locator('xpath=ancestor::fieldset[1]').getByRole('button',{name:'Guardar decisión'}).click();assert.equal(await page.evaluate(()=>saved.decisionesGuardadas.maquinaria.mesa),1);assert.ok(await page.evaluate(()=>saved.saldoFinalGuardado)<savedCash);
 const tabs=[];for(const category of ['A','B','C','D','E']){await mount(category);const controls=await page.locator('select,input[type="number"],input[type="checkbox"]').evaluateAll(els=>els.filter(el=>!el.closest('label[hidden]')).map(el=>({covered:!!el.closest('.excel-decision-card'),label:el.getAttribute('aria-label')})));assert.ok(controls.length>0);assert.ok(controls.every(c=>c.covered),JSON.stringify(controls));const cards=await page.locator('.excel-decision-card').count();if(category==='C')assert.ok(cards<=18,'Producción debe agrupar decisiones, no cada celda');tabs.push({category,controls:controls.length,cards,radios:await page.getByRole('radio').count()});}
 await mount('D');await page.getByRole('radio',{name:/Alta/}).click();assert.equal(await page.evaluate(()=>saved.decisiones.publicidad),12000);
 for(const width of [390,1280]){await page.setViewportSize({width,height:900});await mount('C');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+1);await page.screenshot({path:path.join(out,`produccion-${width}.png`),fullPage:true});}
 await mount('A');await page.setViewportSize({width:390,height:900});await page.screenshot({path:path.join(out,'empresa-390.png')});await mount('D');await page.screenshot({path:path.join(out,'ventas-390.png')});
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({passed:true,tabs,errors},null,2));console.log(JSON.stringify({passed:true,tabs}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
