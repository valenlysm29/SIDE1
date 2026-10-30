'use strict';
// Browser admission against the isolated local stack; no remote requests allowed.
const {chromium}=require('playwright'),{execFileSync}=require('node:child_process'),crypto=require('node:crypto'),fs=require('node:fs');
(async()=>{
 const status=JSON.parse(execFileSync('.\\node_modules\\.bin\\supabase.cmd',['status','--workdir','.codex-work/p01-http-stack','-o','json'],{encoding:'utf8',shell:true,stdio:['ignore','pipe','ignore']}));
 if(status.API_URL!=='http://127.0.0.1:57321')throw Error('Refusing nonlocal API');const key=status.ANON_KEY,base=status.API_URL;
 const email=`p01-${crypto.randomBytes(6).toString('hex')}@example.test`,password='Side-local-test-2026!';
 const create=await fetch(base+'/auth/v1/signup',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email,password})});const teacher=await create.json();if(!teacher.user?.id)throw Error('No local teacher identity');
 const code='SIDE-'+crypto.randomBytes(2).toString('hex').toUpperCase(),id=crypto.randomUUID(),cfg={lifecycleVersion:2,cycleCloseMode:'manual',integrationDurationMinutes:5,integrationMinutes:0,cycles:1,roundHours:0,roundMinutes:10,enabledEvents:[],materialRulesVersion:'receipts-v1',materialLeadTimeDays:0,materialPaymentMode:'cash',deliveryPolicy:'explicit_provider_event_v1'};
 const sql=`insert into public.profesores(id,nombre,apellido) values ('${teacher.user.id}','Test','Teacher') on conflict(id) do nothing; insert into partidas(id,profesor_id,nombre,codigo,configuracion) values ('${id}','${teacher.user.id}','P01 Browser','${code}','${JSON.stringify(cfg)}'::jsonb)`;
 execFileSync('docker',['exec','supabase_db_sidep01http','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',sql],{stdio:'ignore'});
 const browser=await chromium.launch({headless:true,...(fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{
  const context=await browser.newContext();await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1'){await route.abort();return;}if(u.pathname==='/js/config.js'){await route.fulfill({status:200,contentType:'text/javascript',body:`window.SIDE_CONFIG=${JSON.stringify({SUPABASE_URL:base,SUPABASE_PUBLISHABLE_KEY:key})};`});return;}await route.continue();});
  const page=await context.newPage();await page.goto('http://127.0.0.1:57380/index.html',{waitUntil:'domcontentloaded'});
  await page.locator('#startBtn').click({timeout:20000});await page.locator('[data-profile=student]').click();await page.locator('#gameCode').fill(code);await page.locator('#companyLegalName').fill('Empresa P01');await page.locator('#companyBrandName').fill('Empresa P01');await page.locator('#studentForm button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#studentModal')?.classList.contains('hidden'),null,{timeout:30000});
  const result=execFileSync('docker',['exec','supabase_db_sidep01http','psql','-U','postgres','-d','postgres','-At','-c',`select count(*) from participantes where partida_id='${id}' and nombre_comercial_ingreso='Empresa P01'`],{encoding:'utf8'}).trim();if(result!=='1')throw Error('No persisted student admission');
  console.log('PASS browser student admission: real JWT and HTTP local; game '+id);
  execFileSync('docker',['exec','supabase_db_sidep01http','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',`update partidas set estado='activa',configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','decisions','status','running','running',true,'startedAt',now(),'duration',600)) where id='${id}'`],{stdio:'ignore'});
  await page.waitForTimeout(5000);
  console.log('UI state',JSON.stringify({screen:await page.locator('section.screen:not(.hidden)').evaluateAll(nodes=>nodes.map(n=>n.id)),buttons:await page.locator('button:visible').allTextContents()}));
  const costs=page.locator('#cycleCostsModal button:visible').first();if(await costs.count())await costs.click();
  await page.getByRole('button',{name:'Logística',exact:true}).click();
  console.log('material inputs',JSON.stringify(await page.locator('[data-qty]:visible').evaluateAll(nodes=>nodes.map(n=>[n.dataset.qty,n.dataset.option]))));
  await page.locator('[data-qty="HILO"][data-option="hilo_std"]').fill('2600');await page.locator('#saveDecisionSection').click();
  await page.waitForTimeout(3000);
  const count=execFileSync('docker',['exec','supabase_db_sidep01http','psql','-U','postgres','-d','postgres','-At','-c',`select count(*) from side_material_orders_v1 where partida_id='${id}'`],{encoding:'utf8'}).trim();if(count!=='0')throw Error('Draft created orders');
  console.log('PASS draft via visible controls: no orders');
  await page.locator('#topSubmitAllDecisions').click();await page.waitForTimeout(500);
  console.log('review',await page.locator('#companyReviewDialog').innerText().catch(()=>''));
  await page.locator('#cancelCompanyReview').click();
  await page.getByRole('button',{name:'Infraestructura',exact:true}).click();
  for(const [item,opt] of [['MESA_CORTE','mesa'],['ENSAMBLE','ens_basica'],['ACABADOS','aca_basica']])await page.locator(`[data-qty="${item}"][data-option="${opt}"]`).fill('1');
  await page.locator('[data-choice="MOLDE"][data-option="molde_3"]').check();await page.locator('#saveDecisionSection').click();
  await page.getByRole('button',{name:'Producción',exact:true}).click();await page.locator('#productionMoldSelector').selectOption('molde_3');await page.locator('[data-mold-target="molde_3"]').fill('200');
  for(const [item,opt] of [['PERS_CORTE','corte_basico'],['PERS_ENSAMBLE','ens_personal_basico'],['PERS_ACABADO','aca_personal_basico']])await page.locator(`[data-qty="${item}"][data-option="${opt}"]`).fill('1');
  await page.locator('[data-choice="GARANTIA_PT"][data-option="pt_30"]').check();await page.locator('#saveDecisionSection').click();
  await page.getByRole('button',{name:'Logística',exact:true}).click();await page.locator('[data-qty="CUERO"][data-option="cuero_prem"]').fill('140');await page.locator('[data-qty="ACCESORIOS"][data-option="acc_prem"]').fill('200');await page.locator('[data-qty="HILO"][data-option="hilo_std"]').fill('2600');await page.locator('#saveDecisionSection').click();
  await page.getByRole('button',{name:'Ventas',exact:true}).click();await page.locator('[data-choice="CANALES"][data-option="web"]').check();await page.locator('#saveDecisionSection').click();
  await page.locator('#topSubmitAllDecisions').click();const confirm=page.locator('#confirmCompanyReview');
  if(await confirm.isDisabled()){console.log('BLOCKED review',await page.locator('#companyReviewDialog').innerText());throw Error('Decision review remains incomplete');}
  await confirm.click();await page.waitForTimeout(5000);
  const orderCount=execFileSync('docker',['exec','supabase_db_sidep01http','psql','-U','postgres','-d','postgres','-At','-c',`select count(*) from side_material_orders_v1 where partida_id='${id}'`],{encoding:'utf8'}).trim();
  if(orderCount!=='3')throw Error('Server did not create three orders; count '+orderCount);console.log('PASS UI confirmation: three server orders');
  const teacherContext=await browser.newContext();await teacherContext.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1'){await route.abort();return;}if(u.pathname==='/js/config.js'){await route.fulfill({status:200,contentType:'text/javascript',body:`window.SIDE_CONFIG=${JSON.stringify({SUPABASE_URL:base,SUPABASE_PUBLISHABLE_KEY:key})};`});return;}await route.continue();});
  const teacherPage=await teacherContext.newPage();teacherPage.on('console',msg=>{if((msg.type()==='warning'||msg.type()==='error')&&msg.text().startsWith('SIDE:'))console.log('Teacher console',msg.text().slice(0,400));});teacherPage.on('response',r=>{if(r.url().includes('/rpc/side_material_preview_v1'))console.log('Teacher preview HTTP',r.status());});await teacherPage.goto('http://127.0.0.1:57380/index.html',{waitUntil:'domcontentloaded'});await teacherPage.locator('#startBtn').click();await teacherPage.locator('[data-profile=teacher]').click();await teacherPage.locator('#loginEmail').fill(email);await teacherPage.locator('#loginPassword').fill(password);await teacherPage.locator('#loginForm button[type=submit]').click();
  await teacherPage.waitForURL('**/docente.html**',{timeout:30000});console.log('PASS teacher login UI using real local Auth');
  await teacherPage.waitForTimeout(5000);console.log('Teacher UI',JSON.stringify({buttons:await teacherPage.locator('button:visible').allTextContents(),code:await teacherPage.locator('#gameCode').inputValue()}));
  await teacherPage.getByRole('button',{name:'Resultados',exact:true}).click();
  await teacherPage.waitForTimeout(5000);
  console.log('Teacher report',await teacherPage.locator('#detailReports').innerText());
  console.log('Delivery forms',await teacherPage.locator('[data-provider-delivery]').count());
  if(await teacherPage.locator('[data-provider-delivery]').count()!==3)throw Error('Teacher cannot see verified delivery forms');
  execFileSync('docker',['exec','supabase_db_sidep01http','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',`update partidas set configuracion=jsonb_set(configuracion,'{runtime,startedAt}',to_jsonb(now()-interval '141 seconds')) where id='${id}'`],{stdio:'ignore'});
  for(const [sku,quantity] of [['cuero_prem',140],['acc_prem',200],['hilo_std',2600]]){
    const form=teacherPage.locator('[data-provider-delivery]').filter({hasText:sku});await form.waitFor({state:'visible',timeout:30000});await form.locator('input').fill(String(quantity));await form.locator('button').click();
    let found=false;for(let i=0;i<30;i++){const n=execFileSync('docker',['exec','supabase_db_sidep01http','psql','-U','postgres','-d','postgres','-At','-c',`select count(*) from side_material_receipts_v1 r join side_material_orders_v1 o on o.order_id=r.order_id where o.partida_id='${id}' and o.sku='${sku}'`],{encoding:'utf8'}).trim();if(n==='1'){found=true;break;}await new Promise(resolve=>setTimeout(resolve,500));}if(!found)throw Error('Delivery was not persisted: '+sku+'; status '+await form.locator('[role=status]').innerText().catch(()=>'(form removed)'));
  }
  const events=execFileSync('docker',['exec','supabase_db_sidep01http','psql','-U','postgres','-d','postgres','-At','-c',`select count(*) from side_material_receipts_v1 r join side_material_orders_v1 o on o.order_id=r.order_id where o.partida_id='${id}'`],{encoding:'utf8'}).trim();if(events!=='3')throw Error('Expected three receipts, got '+events);console.log('PASS teacher delivery UI: three receipts');
  await teacherPage.getByRole('button',{name:'Rondas y eventos',exact:true}).click();await teacherPage.locator('#cutRound').click();
  const env={...process.env,SUPABASE_URL:base,SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY};execFileSync('node',['services/business_worker.cjs','--once'],{env,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000});
  const row=execFileSync('docker',['exec','supabase_db_sidep01http','psql','-U','postgres','-d','postgres','-At','-c',`select jsonb_build_object('count',(select count(*) from side_business_closures where partida_id='${id}'),'closure',(select cierre from side_business_closures where partida_id='${id}' and ciclo=1),'reports',(select count(*) from reportes_ciclo where empresa_id in(select empresa_id from participantes where partida_id='${id}')))::text`],{encoding:'utf8'}).trim();
  const saved=JSON.parse(row);if(saved.count!==1||saved.reports!==1)throw Error('Closure/report not uniquely persisted '+JSON.stringify({closures:saved.count,reports:saved.reports}));
  const closed=Object.values(saved.closure.resultadosPorEmpresa)[0],facts=closed.receipt.materialReceiptFacts,used=closed.receipt.production.temporal.consumedBySku;
  for(const sku of ['hilo_std','cuero_prem','acc_prem'])if(Math.abs(Number(facts.receivedBySku[sku])-Number(used[sku])-Number(closed.receipt.inventory[sku]))>0.00001)throw Error('Inventario no concilia: '+sku);
  const bc=closed.financial.balanceCaja;if(Math.abs(Number(bc.cajaInicial)+Number(bc.entradas)-Number(bc.salidas)-Number(bc.cajaFinal))>0.011)throw Error('Caja no concilia');
  console.log('PASS same game closure',JSON.stringify({game:id,produced:closed.receipt.produced,received:facts.receivedBySku,inventory:closed.receipt.inventory,consumed:used,sales:closed.receipt.revenue,cash:bc.cajaFinal,initialCash:bc.cajaInicial,cashIn:bc.entradas,cashOut:bc.salidas}));
 }finally{await browser.close();}
})().catch(e=>{console.error('FAIL student admission:',e.message);process.exitCode=1});
