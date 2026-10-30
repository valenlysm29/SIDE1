'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
const PRO=require('../js/production_model'),fixture=require('./economic_v19_fixture.cjs');
const {chromium}=require('playwright'),{execFileSync}=require('node:child_process');
function html(name){return execFileSync('python',['-c',`import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('${name}'))`],{encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1'}})}
test('confirmación, entrega docente y cierre comparten libro en PGlite',async()=>{
 const db=await database();
 try{
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$;");
  await db.exec('alter table participantes add column if not exists expulsada_at timestamptz; create schema side_private; create table side_private.student_claims(empresa_id bigint primary key,owner_id uuid);');
  for(const name of ['../docs/sql/20261023_despliegue_cierre_v19.sql','../supabase/migrations/20261026_cierre_sin_expulsion_automatica.sql','../supabase/migrations/20261027_corregir_ventas_generales.sql','../supabase/migrations/20261028_cierre_servidor.sql'])await db.exec(fs.readFileSync(require.resolve(name),'utf8'));
  await db.exec(fs.readFileSync(require.resolve('../supabase/migrations/20261030162649_side_pedidos_autoritativos.sql'),'utf8'));
  const revisionMigration=fs.readFileSync(require.resolve('../supabase/migrations/20261030165204_side_cierre_revision_pedidos.sql'),'utf8');await db.exec(revisionMigration);await db.exec(revisionMigration);
  for(const n of ['../supabase/migrations/20261030172347_material_preview_autorizado.sql','../supabase/migrations/20261030173958_ordenes_confirmacion_atomica.sql'])await db.exec(fs.readFileSync(require.resolve(n),'utf8'));
  await db.exec('alter function public.guardar_estado_estudiante(text,text,text,jsonb,bigint) set schema side_private; alter function side_private.guardar_estado_estudiante(text,text,text,jsonb,bigint) rename to side_ident_guardar_estado;');
  await db.exec(fs.readFileSync(require.resolve('../supabase/migrations/20261030180225_entrega_operativa_autorizada.sql'),'utf8'));
  const game=await createGame(db,config({cycles:1,materialRulesVersion:'receipts-v1',materialLeadTimeDays:0,materialPaymentMode:'cash',deliveryPolicy:'explicit_provider_event_v1'}));
  const entry=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Temporal QA',p_nombre_comercial:'Temporal QA'}),id=Number(entry.empresa_id);
  const state=fixture.state(1,{},2);state.MOLDE={round:1,optionIds:['molde_3']};state.__inventarioMP={};state.CUERO={round:1,quantities:{cuero_prem:140}};state.ACCESORIOS={round:1,quantities:{acc_prem:200}};state.HILO={round:1,quantities:{hilo_std:2600}};state.PRODUCCION_META.moldTargets={molde_1:0,molde_2:0,molde_3:200};state.JEFATURA={round:1,optionIds:['no_jefatura']};
  for(const [key,opt] of [['MESA_CORTE','mesa'],['ENSAMBLE','ens_basica'],['ACABADOS','aca_basica'],['PERS_CORTE','corte_basico'],['PERS_ENSAMBLE','ens_personal_basico'],['PERS_ACABADO','aca_personal_basico']])state[key]={round:1,quantities:{[opt]:1},...(['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(key)?{purchases:{1:{[opt]:1}}}:{})};
  await db.query("insert into side_private.student_claims values($1,'22222222-2222-2222-2222-222222222222')",[id]);
  await db.query("update partidas set estado='activa',configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','decisions','status','running','running',true,'startedAt',now(),'duration',600)) where id=$1",[game.id]);
  await db.query("select set_config('test.role','authenticated',false)");
  const args={p_codigo:game.codigo,p_nombre_legal:'Temporal QA',p_nombre_comercial:'Temporal QA',p_expected_revision:0,p_snapshot:{round:1,decisions_submitted:false,decision_state:{__cyclePlans:{1:{state}}}}};
  let savedDraft=await rpc(db,'guardar_estado_estudiante',args);assert.equal(savedDraft.success,true);assert.equal((await db.query('select count(*) n from side_material_orders_v1')).rows[0].n,0);
  args.p_expected_revision=savedDraft.snapshot_revision;args.p_snapshot.decisions_submitted=true;
  assert.equal((await rpc(db,'guardar_estado_estudiante',args)).success,true);
  const orders=(await db.query('select * from side_material_orders_v1 where empresa_id=$1',[id])).rows;assert.equal(orders.length,3);
  await db.exec('set role authenticated');
  for(const [sku,quantity] of [['cuero_prem',140],['acc_prem',200]]){
   const order=orders.find(o=>o.sku===sku);await rpc(db,'side_registrar_entrega_proveedor_v1',{p_partida_id:game.id,p_order_id:order.order_id,p_receipt_id:'event-'+sku,p_quantity:quantity});
  }
  const previewArgs={p_partida_id:game.id,p_empresa_id:id,p_ciclo:1};
  const before=await rpc(db,'side_material_preview_v1',previewArgs);assert.equal(PRO.calculate({state:{...state,__materialOrders:before},catalog:fixture.catalog,round:1}).producibleUnits,0);
  // Freeze the test server clock inside day 7; browser startup under load can
  // otherwise advance the real cycle into day 8 before the delivery click.
  await db.exec('reset role');await db.query("update partidas set configuracion=jsonb_set(configuracion,'{runtime}',(configuracion->'runtime')||jsonb_build_object('status','paused','running',false,'remaining',459)) where id=$1",[game.id]);await db.exec('set role authenticated');
  const order=orders.find(o=>o.sku==='hilo_std');
  const chromePath='C:/Program Files/Google/Chrome/Application/chrome.exe',actionBrowser=await chromium.launch({headless:true,...(fs.existsSync(chromePath)?{executablePath:chromePath}:{})});
  try{
   const page=await actionBrowser.newPage();
   await page.exposeBinding('pgliteRpc',async(_source,name,args)=>{await db.query("select set_config('test.uid','11111111-1111-1111-1111-111111111111',false)");try{return {data:await rpc(db,name,args),error:null};}catch(error){return {data:null,error:{message:error.message,code:error.code}};}});
   await page.setContent(html('docente.html'),{waitUntil:'load'});
   await page.evaluate(async({state:plan,id,game})=>{
    const store={};Object.defineProperty(window,'sessionStorage',{value:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v},removeItem:k=>{delete store[k]}},configurable:true});
    if(!crypto.randomUUID)Object.defineProperty(crypto,'randomUUID',{value:()=> 'vertical-event-uuid'});
    state.partidaId=game.id;state.authoritative={materialRulesVersion:'receipts-v1'};$('gameCode').value=game.codigo;
    window.SIDE.SupabaseClient={isReady:()=>true,get:()=>({rpc:window.pgliteRpc})};
    window.SIDE.PartidaService={listarParticipantes:async()=>({success:true,data:[{empresa_id:id,empresa:'Temporal QA',empresas:{nombre_comercial:'Temporal QA',ciclo_actual:1,caja_inicial:100000}}]})};
    window.SIDE.DecisionesService.obtenerCatalogo=async()=>({success:true,data:{decisions:[],options:[]}});
    window.SIDE.DecisionesService.obtenerReporte=async()=>({success:true,data:{empresa:{nombre_comercial:'Temporal QA',ciclo_actual:1},decisiones:[],reportes:[],contexto_juego:{partida_id:game.id,codigo:game.codigo,ciclo:1,estado:'activa',phase:'decisions',configuracion:{materialRulesVersion:'receipts-v1',deliveryPolicy:'explicit_provider_event_v1'},snapshot:{decisions_submitted:true,decision_state:{...plan,__cyclePlans:{1:{state:plan}}}}}}});
    state.reports=await supabaseReports([]);renderResults();loadReports=async()=>{};
   },{state,id,game});
   const form=page.locator('[data-provider-delivery]').filter({hasText:'hilo_std'});await form.evaluate(el=>{el.querySelector('input').value='2600';el.requestSubmit();});
   await page.waitForFunction(()=>[...document.querySelectorAll('[data-provider-delivery] [role=status]')].some(e=>e.textContent.includes('Entrega confirmada')));
  }finally{await actionBrowser.close();}
  await db.exec('reset role');const recorded=(await db.query("select * from side_material_receipts_v1 where order_id=$1",[order.order_id])).rows[0];assert.equal(Number(recorded.receipt_day),7);assert.equal(Number(recorded.quantity),2600);
  await db.exec('set role authenticated');const delivery={p_partida_id:game.id,p_order_id:order.order_id,p_receipt_id:recorded.receipt_id,p_quantity:2600};assert.equal((await rpc(db,'side_registrar_entrega_proveedor_v1',delivery)).reused,true);
  const teacher=await rpc(db,'side_material_preview_v1',previewArgs);await db.query("select set_config('test.uid','22222222-2222-2222-2222-222222222222',false)");const student=await rpc(db,'side_material_preview_v1',previewArgs);assert.deepEqual(student,teacher);
  const preview=PRO.calculate({state:{...state,__materialOrders:student},catalog:fixture.catalog,round:1});assert.equal(preview.producibleUnits,125);assert.equal(preview.temporal.consumedBySku.hilo_std,1625);assert.equal(preview.temporal.stockBySku.hilo_std,975);
  // Browser transport forwards real RPCs to this exact PGlite instance. Roster
  // and confirmed snapshot are fixture data; the material book is not mocked.
  const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe',browser=await chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{})});
  try{
   async function makePage(name,uid){const page=await browser.newPage();await page.exposeBinding('pgliteRpc',async(_source,name,args)=>{await db.query("select set_config('test.uid',$1,false)",[uid]);try{return {data:await rpc(db,name,args),error:null};}catch(error){return {data:null,error:{message:error.message,code:error.code}};}});await page.setContent(html(name),{waitUntil:'load'});return page;}
   const pupil=await makePage('index.html','22222222-2222-2222-2222-222222222222');
   const studentText=await pupil.evaluate(async({state,id,game})=>{
    currentStudent={company:'Temporal QA',legalName:'Temporal QA',empresaId:id,game:{id:game.id,codigo:game.codigo}};studentConnected=true;
    authoritativeStudentState={empresaId:id,gameId:game.id,code:admissionCode(game.codigo),config:{materialRulesVersion:'receipts-v1',cycles:1},runtime:{round:1,phase:'decisions'}};
    decisionState=state;decisionDrafts={};currentCategory='C';window.SIDE.SupabaseClient={getStudent:()=>({rpc:window.pgliteRpc}),get:()=>({rpc:window.pgliteRpc})};
    await refreshStudentMaterialBook();renderDecisionCategory();return $('decisionCards').innerText;
   },{state,id,game});
   assert.match(studentText,/producción factible 125/i);assert.match(studentText,/consumido 1625/i);assert.match(studentText,/final 975/i);assert.ok(studentText.includes(student.revision));
   const teacherPage=await makePage('docente.html','11111111-1111-1111-1111-111111111111');
   const teacherText=await teacherPage.evaluate(async({state:plan,id,game})=>{
    state.partidaId=game.id;state.authoritative={materialRulesVersion:'receipts-v1'};$('gameCode').value=game.codigo;
    window.SIDE.SupabaseClient={isReady:()=>true,get:()=>({rpc:window.pgliteRpc})};
    window.SIDE.PartidaService={listarParticipantes:async()=>({success:true,data:[{empresa_id:id,empresa:'Temporal QA',empresas:{nombre_comercial:'Temporal QA',ciclo_actual:1,caja_inicial:100000}}]})};
    window.SIDE.DecisionesService.obtenerCatalogo=async()=>({success:true,data:{decisions:[],options:[]}});
    window.SIDE.DecisionesService.obtenerReporte=async()=>({success:true,data:{empresa:{nombre_comercial:'Temporal QA',ciclo_actual:1},decisiones:[],reportes:[],contexto_juego:{partida_id:game.id,codigo:game.codigo,ciclo:1,estado:'activa',phase:'decisions',configuracion:{materialRulesVersion:'receipts-v1',deliveryPolicy:'explicit_provider_event_v1'},snapshot:{decisions_submitted:true,decision_state:{...plan,__cyclePlans:{1:{state:plan}}}}}}});
    state.reports=await supabaseReports([]);renderResults();return $('detailReports').innerText;
   },{state,id,game});
   assert.match(teacherText,/producción factible 125/i);assert.match(teacherText,/consumido 1625/i);assert.match(teacherText,/final 975/i);assert.ok(teacherText.includes(student.revision));
  }finally{await browser.close();}
  await db.exec('reset role');await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','results','status','finished')) where id=$1",[game.id]);
  await db.query("select set_config('test.role','service_role',false)");await db.exec('set role service_role');
  const without=before;
  const context=await rpc(db,'side_material_context_v1',{p_partida_id:game.id,p_empresa_id:id,p_cutoff_day:29});
  const plan=PRO.calculate({state:{...state,__materialOrders:context},catalog:fixture.catalog,round:1});assert.equal(context.revision,student.revision);
  assert.equal(plan.processCapacity,162);assert.equal(plan.producibleUnits,125);assert.equal(plan.temporal.consumedBySku.hilo_std,1625);assert.equal(plan.temporal.stockBySku.hilo_std,975);
  assert.equal(plan.temporal.windows.slice(0,7).reduce((sum,row)=>sum+row.produced,0),0);
  const closeContext=await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1});
  const payload={p_partida_id:game.id,p_ciclo:1,p_token:closeContext.token,p_revisiones:{[id]:without.revision},p_cierre:{}};
  const stale=await rpc(db,'side_guardar_cierre_temporal_v1',payload);assert.equal(stale.code,'ORDENES_DESACTUALIZADAS');
  const validRevision=await rpc(db,'side_guardar_cierre_temporal_v1',{...payload,p_revisiones:{[id]:context.revision}});assert.ok(validRevision.error);assert.notEqual(validRevision.code,'ORDENES_DESACTUALIZADAS');
  const calls=[],worker=require('../services/business_runtime.cjs');
  await db.exec('begin');
  const result=await worker.runOnce(async(name,args)=>{calls.push(name);if(name==='side_cierres_pendientes')return {data:[{id:game.id,cycles:[1]}]};try{return {data:await rpc(db,name,args),error:null};}catch(error){return {data:null,error:{message:error.message}};}});
  assert.equal(result[0].success,true,JSON.stringify(result));
  assert.ok(calls.includes('side_material_context_v1'));assert.ok(calls.includes('side_guardar_cierre_temporal_v1'));
  const saved=await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1});
  const closed=saved.cierre.resultadosPorEmpresa[String(id)];
  assert.equal(closed.receipt.produced,125);assert.equal(closed.receipt.production.temporal.consumedBySku.hilo_std,1625);assert.equal(closed.receipt.inventory.hilo_std,975);
  assert.deepEqual(closed.receipt.production.temporal,plan.temporal);
  assert.equal(closed.financial.balanceGeneral.inventarioMP,closed.financial.inventoryValues.materials.hilo_std+closed.financial.inventoryValues.materials.cuero_prem+closed.financial.inventoryValues.materials.acc_prem);
  assert.equal(closed.financial.inventoryValues.materials.hilo_std,1794);
  assert.equal(closed.receipt.materialReceiptFacts.receivedValueBySku.hilo_std,4784);
  assert.equal(closed.financial.estadoResultados.desgloseCostos.materiales,10465);
  assert.equal(closed.financial.balanceGeneral.inventarioMP,6279);
  assert.equal(closed.financial.balanceGeneral.anticiposMateriales,0);
  assert.equal(closed.financial.balanceCaja.cajaFinal,Math.round((closed.financial.balanceCaja.cajaInicial+closed.financial.balanceCaja.entradas-closed.financial.balanceCaja.salidas)*100)/100);
  assert.equal(closed.financial.balanceGeneral.activos,closed.financial.balanceGeneral.pasivoPatrimonio);
  console.log('CIERRE_TEMPORAL_QA '+JSON.stringify({produccion:closed.receipt.produced,vendidas:closed.receipt.sold,hiloRecibido:closed.receipt.materialReceiptFacts.receivedBySku.hilo_std,hiloConsumido:closed.receipt.production.temporal.consumedBySku.hilo_std,hiloFinal:closed.receipt.inventory.hilo_std,valorHiloRecibido:closed.receipt.materialReceiptFacts.receivedValueBySku.hilo_std,valorHiloFinal:closed.financial.inventoryValues.materials.hilo_std,anticipos:closed.financial.balanceGeneral.anticiposMateriales,cajaInicial:closed.financial.balanceCaja.cajaInicial,cajaFinal:closed.financial.balanceCaja.cajaFinal,ventas:closed.receipt.revenue,costoVentas:closed.financial.estadoResultados.costoVentas,utilidad:closed.financial.estadoResultados.utilidadNeta}));
  await db.exec('rollback');
  const edge=await import(require('node:url').pathToFileURL(require('node:path').resolve(__dirname,'../supabase/functions/side-business-close/runtime.mjs')).href);
  const edgeResult=await edge.runOnce(async(name,args)=>name==='side_cierres_pendientes'?{data:[{id:game.id,cycles:[1]}]}:{data:await rpc(db,name,args),error:null});
  assert.equal(edgeResult[0].success,true,JSON.stringify(edgeResult));
  const edgeSaved=await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1});assert.deepEqual(edgeSaved.cierre,saved.cierre);
  const again=await edge.runOnce(async(name,args)=>name==='side_cierres_pendientes'?{data:[{id:game.id,cycles:[1]}]}:{data:await rpc(db,name,args),error:null});
  assert.equal(again[0].success,true);assert.deepEqual((await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1})).cierre,edgeSaved.cierre);
  await db.exec('reset role');
  assert.equal(Number((await db.query('select count(*) as n from side_business_closures where partida_id=$1',[game.id])).rows[0].n),1);
  const stored=(await db.query('select ingresos,caja_final,estado_resultados from reportes_ciclo where empresa_id=$1 and ciclo=1',[id])).rows[0];
  assert.equal(Number(stored.caja_final),closed.financial.balanceCaja.cajaFinal);assert.equal(Number(stored.ingresos),closed.receipt.revenue);
  assert.deepEqual(stored.estado_resultados.cycleReceipt,closed.receipt);
  assert.equal(Number((await db.query('select caja_actual from empresas where id=$1',[id])).rows[0].caja_actual),closed.financial.balanceCaja.cajaFinal);
  await db.query("select set_config('test.role','authenticated',false)");await db.exec('set role authenticated');
  await assert.rejects(()=>rpc(db,'side_guardar_cierre_temporal_v1',{...payload,p_revisiones:{[id]:context.revision},p_cierre:{ciclo:1,resultadosPorEmpresa:{[id]:{financial:{balanceCaja:{cajaFinal:999999}}}}}}),/permission denied/i);
  await db.exec('reset role');assert.deepEqual((await db.query('select cierre from side_business_closures where partida_id=$1 and ciclo=1',[game.id])).rows[0].cierre,edgeSaved.cierre);

 }finally{await db.close();}
});
