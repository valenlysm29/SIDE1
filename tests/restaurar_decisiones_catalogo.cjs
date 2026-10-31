'use strict';
// Browser coverage of the delivered decision catalog, without reviving a legacy editor.
const qa=require('./verification_corrections_20261020.cjs'),assert=require('node:assert/strict');
const {fs,path,chromium,server,newPage}=qa;
const out=path.join(__dirname,'output/restaurar-decisiones');fs.mkdirSync(out,{recursive:true});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const evidence=[];
 try{
  const {page,context}=await newPage(browser,'http://127.0.0.1:'+server.address().port,'catalog-coverage');
  const tabs=await page.locator('#decisionTabs [data-cat]').evaluateAll(els=>els.map(el=>[el.dataset.cat,el.innerText]));
  assert.deepEqual(tabs.map(t=>t[0]),['B','C','F','D','E','A']);
  assert.equal(await page.evaluate(()=>Boolean(decisionState.__excel)),false,'current UI does not activate legacy state');
  const catalog=await page.evaluate(()=>SIDE_DECISION_CATALOG.map(c=>({cat:c.cat,items:c.items})));
  async function open(cat){await page.locator('#decisionTabs [data-cat="'+cat+'"]').click();}
  async function saved(id,expected){
   await page.locator('#saveDecisionSection').click();
   const actual=await page.evaluate(id=>({live:decisionState[id],stored:JSON.parse(localStorage.getItem(decisionKey()))[id]}),id);
   assert.deepEqual(actual.live,actual.stored,id+' persisted in decision storage');
   for(const [key,value]of Object.entries(expected))assert.deepEqual(actual.stored[key],value,id+' saved '+key);
   evidence.push({id,expected,saved:actual.stored});
  }
  async function numeric(selector,value,id,expected){
   const field=page.locator(selector);assert.equal(await field.count(),1,id+' unique numeric control');
   await field.scrollIntoViewIfNeeded();assert.ok(await field.isVisible(),id+' visible');assert.ok(await field.isEnabled(),id+' editable');
   await field.fill(String(value));await field.press('Tab');assert.equal(await field.inputValue(),String(value));
   await saved(id,expected);
  }
  const covered=[];
  for(const {cat,items}of catalog){
   if(cat==='A')continue;await open(cat);
   for(const item of items){
    if(item.displayAsAsterisk){assert.match(await page.locator('#decisionCards').innerText(),new RegExp(item.desc.slice(0,35)));covered.push(item.id);continue;}
    const card=page.locator('[data-item="'+item.id+'"]');assert.equal(await card.count(),1,item.id+' rendered');
    await card.scrollIntoViewIfNeeded();assert.ok(await card.isVisible(),item.id+' visible');
    if(item.mandatoryFixed){const selected=card.locator('input:checked');assert.equal(await selected.count(),1);assert.ok(await selected.isDisabled(),item.id+' required fixed cost');}
    else if(item.type==='info'){assert.ok((await card.innerText()).includes(item.name));}
    else if(['quantity','quantity-choice'].includes(item.type)){
     for(const option of item.options){const quantities=await page.evaluate(id=>({...initDraft(findDecisionItem(id)).quantities}),item.id);quantities[option.id]=item.material?1.25:1;
      await numeric('[data-qty="'+item.id+'"][data-option="'+option.id+'"]',quantities[option.id],item.id,item.asset?{purchases:{1:quantities}}:{quantities});}
    }else if(['choice','multi-choice'].includes(item.type)){
     for(const option of item.options){const selector='[data-choice="'+item.id+'"][data-option="'+option.id+'"]',field=page.locator(selector);
      assert.equal(await field.count(),1);
      if(item.id==='MANTENIMIENTO'&&option.id!=='correctivo'){assert.ok(await field.isDisabled(),item.id+'/'+option.id+' disponible desde ciclo 2');continue;}
      assert.ok(await field.isEnabled(),item.id+'/'+option.id+' editable');
      const label=page.locator('label').filter({has:field});await label.scrollIntoViewIfNeeded();assert.ok(await label.isVisible());await label.click();
      assert.ok(await page.locator(selector).isChecked(),item.id+'/'+option.id+' selected');
      const optionIds=await page.evaluate(id=>[...initDraft(findDecisionItem(id)).optionIds],item.id);await saved(item.id,{optionIds});}
    }else if(item.type==='production-plan'){
     const targets=await card.locator('[data-production-mold] option').evaluateAll(els=>els.map(el=>el.value));assert.deepEqual(targets,['molde_1','molde_2','molde_3']);
     for(const id of targets){await page.locator('[data-production-mold]').selectOption(id);const moldTargets=await page.evaluate(()=>({...initDraft(findDecisionItem('PRODUCCION_META')).moldTargets}));moldTargets[id]=3;
      await numeric('[data-mold-target="'+id+'"]',3,item.id,{moldTargets});}
    }else if(item.type==='loan')await numeric('[data-loan-number="'+item.id+'"]',500,item.id,{amount:500});
    else if(item.type==='number')await numeric('[data-number="'+item.id+'"]',3,item.id,{value:3});
    else throw Error('Missing coverage for catalog type '+item.type);
    covered.push(item.id);
   }
   if(cat==='B'){
    // Finish the infrastructure draft with one selected mold before checking
    // production. Optional choice exploration must not leave a zero-mold plan.
    const mold=page.locator('[data-choice="MOLDE"][data-option="molde_1"]');
    if(!await mold.isChecked())await page.locator('label').filter({has:mold}).click();
    await saved('MOLDE',{optionIds:['molde_1']});
   }
  }
  assert.deepEqual(covered.sort(),catalog.flatMap(c=>c.items.map(i=>i.id)).sort(),'every current catalog item covered');
  // Reopening each section must retain the saved draft without locking editing.
  for(const {cat,items}of catalog.filter(c=>c.items.length)){
   await open(cat);assert.equal(await page.locator('#saveDecisionSection').isEnabled(),true);
   for(const item of items.filter(i=>['quantity','quantity-choice'].includes(i.type))){
    const persisted=await page.evaluate(id=>decisionState[id].quantities||decisionState[id].purchases?.[1]||{},item.id);
    for(const [option,value]of Object.entries(persisted))assert.equal(await page.locator('[data-qty="'+item.id+'"][data-option="'+option+'"]').inputValue(),String(value));
   }
  }
  for(const width of [1440,390]){await page.setViewportSize({width,height:900});for(const cat of ['A','C','D']){await open(cat);assert.ok(await page.locator('#cashBalance').isVisible());await page.screenshot({path:path.join(out,'portal-'+cat+'-'+width+'.png'),fullPage:true});const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(geometry.scroll<=width+1,JSON.stringify(geometry));}}
  assert.equal(await page.evaluate(()=>Boolean(decisionState.__excel)),false,'saving current catalog never activates legacy model');
  await context.close();fs.writeFileSync(path.join(out,'catalogo.json'),JSON.stringify({tabs,catalogItems:covered.length,covered,interactions:evidence},null,2));
  console.log('PASS catálogo actual: '+covered.length+' decisiones/informativas; '+evidence.length+' guardados verificados');
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
