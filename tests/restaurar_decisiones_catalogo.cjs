'use strict';
// Independent browser contract: every authorized legacy decision has a visible,
// enabled control. Internal Excel rows are deliberately not new player decisions.
const qa=require('./verification_corrections_20261020.cjs');
const assert=require('node:assert/strict');
const {fs,path,chromium,server,newPage}=qa;
const out=path.join(__dirname,'output/restaurar-decisiones');fs.mkdirSync(out,{recursive:true});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const evidence=[];
 try{
 const {page,context}=await newPage(browser,'http://127.0.0.1:'+server.address().port,'catalog-coverage');
 const tabs=await page.locator('#decisionTabs [data-cat]').evaluateAll(els=>els.map(el=>[el.dataset.cat,el.innerText]));
 assert.deepEqual(tabs.map(t=>t[0]),['A','B','C','D','E']);
 const group=async code=>page.evaluate(code=>{const o=[...document.querySelectorAll('[data-excel-grupo] option')].find(o=>o.value===code);return o?'[data-excel-grupo="'+o.parentElement.dataset.excelGrupo+'"]':null;},code);
 async function open(cat){await page.locator('#decisionTabs [data-cat="'+cat+'"]').click();await page.locator('#excelProductionMount details').evaluateAll(els=>els.forEach(el=>el.open=true));}
 async function exercise(id,cat,selector,value){
  await open(cat);const field=page.locator(selector);assert.equal(await field.count(),1,id+' unique field');
  const card=field.locator('xpath=ancestor::fieldset[contains(@class,"excel-decision-card")][1]');assert.ok(await card.count(),id+' decision card');
  const type=await field.getAttribute('type'),tag=await field.evaluate(el=>el.tagName);
  if(tag==='SELECT'||type==='checkbox'){
    const radio=field.locator('xpath=ancestor::fieldset[1]').locator('input[data-excel-choice][value="'+value+'"]');
    assert.ok(await radio.isVisible(),id+' visible radio '+value);assert.ok(await radio.isEnabled(),id+' editable '+value);await radio.check();assert.ok(await radio.isChecked());
    assert.equal(tag==='SELECT'?await field.inputValue():(await field.isChecked()?'1':'0'),String(value),id+' canonical input updated');
  }else{assert.ok(await field.isVisible(),id+' visible quantity');assert.ok(await field.isEnabled(),id+' editable quantity');await field.fill(String(value));await field.press('Tab');assert.equal(await field.inputValue(),String(value));}
  const state=await page.evaluate(()=>decisionState.__excel.decisiones);assert.ok(state,id+' reaches canonical motor plan');
  await card.locator('[data-excel-guardar-item]').last().click();
  const saved=await page.evaluate(()=>decisionState.__excel.decisionesGuardadas);assert.ok(saved,id+' saved item');
  const contract=await field.evaluate(el=>({activo:el.dataset.activo,compra:el.dataset.compra,personal:el.dataset.personal,lote:el.dataset.lote,campo:el.dataset.campo,tienda:el.dataset.excelTienda,group:el.dataset.excelGrupo,attrs:el.getAttributeNames()}));
  let actual;if(contract.activo)actual=saved.maquinaria[contract.activo];else if(contract.compra)actual=saved.comprasUnidades[contract.compra];else if(contract.personal){const[a,n,m]=contract.personal.split(',');actual=saved.personal[a][n][m];}else if(contract.lote!==undefined)actual=saved.lotes[contract.lote][contract.campo];else if(contract.tienda)actual=saved.tiendasPorDistrito[contract.tienda];else if(contract.group!==undefined){if(value)assert.ok(saved.seleccion.includes(value),'Saved motor group '+value);}else{const keys={'data-excel-prestamo':'montoPrestamo','data-excel-marketing':'marketingNivel','data-excel-garantia':'garantiaDias','data-excel-mantenimiento':'mantenimientoPreventivo','data-excel-analista':'analistaCompras','data-excel-garantia-proveedor':'garantiaProveedor'};const key=Object.entries(keys).find(([attribute])=>contract.attrs.includes(attribute))?.[1];if(key)actual=saved[key];}
  if(actual!==undefined)assert.equal(type==='checkbox'?(actual?'1':'0'):String(actual??''),String(value),id+' saved engine value');
  evidence.push({id,cat,selector,value,state,saved});
 }
 const catalog=await page.evaluate(()=>SIDE_DECISION_CATALOG.flatMap(c=>c.items.map(i=>({id:i.id,type:i.type}))));
 const covered=new Set();
 const quantities={MESA_CORTE:['B',['mesa']],ENSAMBLE:['B',['INF-02','INF-03','INF-04']],ACABADOS:['B',['INF-05','INF-06','INF-07']],MOLDE:['B',['INF-08','INF-09','INF-10']]};
 for(const[id,[cat,codes]]of Object.entries(quantities)){for(const code of codes)await exercise(id,cat,'[data-activo="'+code+'"]',1);covered.add(id);}
 for(const[id,area]of Object.entries({PERS_CORTE:'corte',PERS_ENSAMBLE:'ensamble',PERS_ACABADO:'acabado'})){for(let level=0;level<3;level++)for(let machine=0;machine<(area==='corte'?1:3);machine++)await exercise(id,'C','[data-personal="'+[area,level,machine].join(',')+'"]',1);covered.add(id);}
 for(const[id,codes]of Object.entries({CUERO:['INS-01','INS-02','INS-03'],ACCESORIOS:['INS-04','INS-05'],HILO:['INS-06','INS-07','INS-08']})){for(const code of codes)await exercise(id,'C','[data-compra="'+code+'"]',1);covered.add(id);}
 for(const[id,cat,selector,values]of [['MANTENIMIENTO','B','[data-excel-mantenimiento]',['0','1']],['ANALISTA_COMPRAS','C','[data-excel-analista]',['0','1']],['GARANTIA_PROV','C','[data-excel-garantia-proveedor]',['0','80','100']],['GARANTIA_PT','C','[data-excel-garantia]',['30','90','180']],['INV_MARKETING','D','[data-excel-marketing]',['','baja','media','alta']],['PRESTAMO','E','[data-excel-prestamo]',[500]]]){for(const value of values)await exercise(id,cat,selector,value);covered.add(id);}
 for(const[id,cat,codes]of [['INV_RRHH','A',['INV-01A','INV-01B','INV-01C']],['JEFATURA','C',['RH-10A','RH-10B']],['CANALES','D',['COM-01A','COM-01B','COM-01C']]]){await open(cat);const selector=await group(codes[0]);assert.ok(selector,id+' authorized group');for(const code of codes){await exercise(id,cat,selector,code);assert.ok((await page.evaluate(()=>decisionState.__excel.decisiones.seleccion)).includes(code),code+' feeds engine');}covered.add(id);}
 for(const district of ['los_olivos','miraflores','sjl'])await exercise('CANALES','D','[data-excel-tienda="'+district+'"]',1);
 await exercise('HILO decimal exacto','C','[data-compra="INS-06"]',22.22222222222222);
 for(const[field,value]of Object.entries({cantidad:3,precio:99}))await exercise('PRODUCCION_META','C','[data-lote="0"][data-campo="'+field+'"]',value);
 for(const field of ['segmento','cuero','accesorios','hilo','molde']){await open('C');const sel='[data-lote="0"][data-campo="'+field+'"]';const values=await page.locator(sel+' option').evaluateAll(els=>els.map(el=>el.value).filter(Boolean));for(const value of values)await exercise('PRODUCCION_META','C',sel,value);}covered.add('PRODUCCION_META');
 // Fixed mandatory operating charges and three automatic rules remain information.
 for(const id of ['LOCAL_PROD','LIMPIEZA','PERSONAL_VENTAS','CREDITO_VENTAS','DEVOLUCIONES']){await open(['LOCAL_PROD'].includes(id)?'B':id==='LIMPIEZA'?'C':'D');const text=await page.locator('#excelProductionMount').innerText();assert.match(text,id==='LOCAL_PROD'?/Local de producción/:id==='LIMPIEZA'?/Limpieza/:id==='PERSONAL_VENTAS'?/vendedor|comisión/:id==='CREDITO_VENTAS'?/crédito/:/fallado|devoluci/i);covered.add(id);}
 assert.deepEqual(catalog.filter(i=>!covered.has(i.id)),[],'Every authorized catalog item covered');
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});for(const cat of ['A','C','D']){await open(cat);await page.locator('.excel-cycle-help,.excel-compulsory-details').evaluateAll(els=>els.forEach(el=>el.open=false));for(const selector of ['#categoryEyebrow','[data-saved-final-balance]']){assert.ok(await page.locator(selector).isVisible(),selector+' visible');const bounds=await page.locator(selector).boundingBox();assert.ok(bounds.width>50&&bounds.height>10,selector+' has readable size');assert.ok(bounds.y+bounds.height<900,selector+' visible in viewport');}await page.screenshot({path:path.join(out,'portal-'+cat+'-'+width+'.png'),fullPage:true});const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(geometry.scroll<=width+1,JSON.stringify(geometry));}}
 await context.close();fs.writeFileSync(path.join(out,'catalogo.json'),JSON.stringify({tabs,catalogItems:catalog.length,covered:[...covered],interactions:evidence},null,2));
 console.log('PASS catálogo: '+covered.size+' decisiones/informativas; '+evidence.length+' interacciones visibles con guardado por ítem');
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
