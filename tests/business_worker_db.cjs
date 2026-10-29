'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
const worker=require('../services/business_worker.cjs');
const root=path.resolve(__dirname,'..'),load=p=>fs.readFileSync(path.join(root,p),'utf8');
function plan(round){
 const state={};
 const counts={MESA_CORTE:{mesa:1},ENSAMBLE:{ens_basica:1},ACABADOS:{aca_basica:1},PERS_CORTE:{corte_basico:1},PERS_ENSAMBLE:{ens_personal_basico:1},PERS_ACABADO:{aca_personal_basico:1},CUERO:process.argv.includes('--mixed')?{cuero_sint:30,cuero_prem:40}:{cuero_sint:70},ACCESORIOS:{acc_eco:100},HILO:{hilo_std:1300}};
 for(const [id,quantities]of Object.entries(counts))state[id]={round,quantities,optionIds:Object.keys(quantities),...(['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(id)?{purchases:{1:quantities}}:{})};
 state.MOLDE={round:1,optionIds:['molde_3']};state.PRODUCCION_META={round,moldTargets:{molde_3:90}};state.CANALES={round,optionIds:['web']};return state;
}
(async()=>{
 const {runOnce}=process.argv.includes('--edge')?await import('../supabase/functions/side-business-close/runtime.mjs'):worker;
 const db=await database();
 try{
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; alter table participantes add column if not exists expulsada_at timestamptz");
  for(const file of ['docs/sql/20261023_despliegue_cierre_v19.sql','supabase/migrations/20261026_cierre_sin_expulsion_automatica.sql','supabase/migrations/20261027_corregir_ventas_generales.sql','supabase/migrations/20261028_cierre_servidor.sql','supabase/migrations/20261028_cierre_servidor.sql'])await db.exec(load(file));
  const game=await createGame(db,config({cycles:2,capital:200000,cycleCloseMode:'automatic',roundMinutes:1,planSyncGraceSeconds:0}));
  const joined=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Ventas automáticas',p_nombre_comercial:'Ventas automáticas'});
  assert.ok(joined.empresa_id,JSON.stringify(joined));const id=joined.empresa_id;
  const snapshot={decision_state:{...plan(2),__cyclePlans:{1:{state:plan(1)},2:{state:plan(2)}}},cash_ledger:{},financial_sections:{}};
  await db.query('insert into side_student_state(empresa_id,snapshot) values($1,$2) on conflict(empresa_id) do update set snapshot=excluded.snapshot',[id,snapshot]);
  await db.query("update partidas set configuracion=jsonb_set(configuracion,'{gameStartAt}',to_jsonb(now()-interval '3 minutes')) where id=$1",[game.id]);
  // No teacher token or browser; server clock and trusted process perform both closes.
  await db.query("select set_config('test.uid','',false),set_config('test.role','service_role',false)");
  await db.exec('set role service_role');
  const call=async(name,args)=>({data:await rpc(db,name,args),error:null});
  const results=await runOnce(call);assert.equal(results.length,2);assert.ok(results.every(r=>r.success&&!r.pending),JSON.stringify(results));
  assert.deepEqual(await runOnce(call),[],'restart/retry must not duplicate any closure');
  await db.exec('reset role');
  const rows=(await db.query('select ciclo,ingresos,estado_resultados,balance_caja from reportes_ciclo where empresa_id=$1 order by ciclo',[id])).rows;
  assert.equal(rows.length,2);
  for(const row of rows){assert.equal(Number(row.ingresos),22500);assert.equal(row.estado_resultados.cycleReceipt.sold,90);assert.equal(row.estado_resultados.cycleReceipt.produced,90);const lots=row.estado_resultados.cycleReceipt.materialLots;assert.equal(lots.length,1);assert.deepEqual(lots[0].unknown,[]);const expectedQuality=process.argv.includes('--mixed')?4+1+1+(30+33*3)/63:7;assert.ok(Math.abs(lots[0].excelQuality-expectedQuality)<1e-8);assert.ok(Math.abs(row.estado_resultados.cycleReceipt.sales[2].quality-expectedQuality)<1e-8);}
  assert.equal(rows[0].estado_resultados.impuestoRenta,0);
  const preTax=rows.reduce((s,row)=>s+row.estado_resultados.utilidadAntesImpuestos,0),expected=Math.round((Math.min(preTax,82500)*.10+Math.max(0,preTax-82500)*.295)*100)/100;
  assert.ok(expected>0);assert.equal(rows[1].estado_resultados.impuestoRenta,expected);
  assert.equal(rows[1].balance_caja.cajaFinal,Math.round((rows[1].balance_caja.cajaInicial+rows[1].balance_caja.entradas-rows[1].balance_caja.salidas)*100)/100);
  assert.ok(rows[1].balance_caja.salidas>=expected);
  const saved=(await db.query('select snapshot from side_student_state where empresa_id=$1',[id])).rows[0].snapshot;
  const restored=require('../js/financial_model.js').calculate({round:2,state:saved.decision_state,ledger:saved.cash_ledger});
  assert.equal(restored.estadoResultados.impuestoRenta,expected);
  assert.equal(restored.balanceGeneral.activos,restored.balanceGeneral.pasivoPatrimonio);
  await db.query("select set_config('test.role','authenticated',false)");await db.exec('set role authenticated');
  await assert.rejects(()=>rpc(db,'side_cierres_pendientes',{}));
  await assert.rejects(()=>rpc(db,'side_guardar_cierre_negocio',{p_partida_id:game.id,p_ciclo:1,p_token:'fake',p_cierre:{}}));
  await db.exec('reset role');
  const evidence=rows.map(row=>({cycle:row.ciclo,sold:row.estado_resultados.cycleReceipt.sold,revenue:Number(row.ingresos),preTax:row.estado_resultados.utilidadAntesImpuestos,tax:row.estado_resultados.impuestoRenta}));
  fs.mkdirSync(path.join(__dirname,'output'),{recursive:true});fs.writeFileSync(path.join(__dirname,'output/business-worker-two-cycles.json'),JSON.stringify(evidence,null,2));
  fs.writeFileSync(path.join(__dirname,'output/business-worker-state.json'),JSON.stringify(saved));
  console.table(evidence);console.log('PASS: automatic clock, two closures without teacher, sales, final accumulated tax, restart, persisted balances, server-only write permissions.');
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={plan};
