'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
const {runOnce}=require('../services/business_worker.cjs');
const root=path.resolve(__dirname,'..'), read=p=>fs.readFileSync(path.join(root,p),'utf8');
function plan(round,price){
 const state={}; const counts={MESA_CORTE:{mesa:1},ENSAMBLE:{ens_basica:1},ACABADOS:{aca_basica:1},PERS_CORTE:{corte_basico:1},PERS_ENSAMBLE:{ens_personal_basico:1},PERS_ACABADO:{aca_personal_basico:1},CUERO:{cuero_sint:70},ACCESORIOS:{acc_eco:100},HILO:{hilo_std:1300}};
 for(const [id,quantities] of Object.entries(counts))state[id]={round,quantities,optionIds:Object.keys(quantities),...(['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(id)?{purchases:{1:quantities}}:{})};
 state.MOLDE={round:1,optionIds:['molde_3']};state.PRODUCCION_META={round,moldTargets:{molde_3:90},prices:{premium:price}};state.CANALES={round,optionIds:['web']};return state;
}
(async()=>{const db=await database();try{
 await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; alter table participantes add column if not exists expulsada_at timestamptz");
 for(const file of ['docs/sql/20261023_despliegue_cierre_v19.sql','supabase/migrations/20261026_cierre_sin_expulsion_automatica.sql','supabase/migrations/20261027_corregir_ventas_generales.sql','supabase/migrations/20261028_cierre_servidor.sql','supabase/migrations/20261028150647_cierre_sin_plan.sql'])await db.exec(read(file));
 const game=await createGame(db,config({cycles:3,capital:200000,cycleCloseMode:'automatic',roundMinutes:1,planSyncGraceSeconds:0}));let ids=[];
 for(let i=0;i<4;i++){
  const name=`TEST-20261028-${i}`,joined=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:name,p_nombre_comercial:name});assert.ok(joined.empresa_id,JSON.stringify(joined));ids.push(joined.empresa_id);
  if(i<3){const plans={};for(let round=1;round<=3;round++)plans[round]={state:plan(round,240+i*10)};const snapshot={decision_state:{...plan(3,240+i*10),__cyclePlans:plans},cash_ledger:{},financial_sections:{}};await db.query('insert into side_student_state(empresa_id,snapshot) values($1,$2) on conflict(empresa_id) do update set snapshot=excluded.snapshot',[joined.empresa_id,snapshot]);}
 }
 await db.query("update partidas set configuracion=jsonb_set(configuracion,'{gameStartAt}',to_jsonb(now()-interval '5 minutes')) where id=$1",[game.id]);
 await db.query("select set_config('test.uid','',false),set_config('test.role','service_role',false)");await db.exec('set role service_role');
 const call=async(name,args)=>({data:await rpc(db,name,args),error:null});const results=await runOnce(call);assert.equal(results.length,3);assert.ok(results.every(x=>x.success&&!x.pending),JSON.stringify(results));assert.deepEqual(await runOnce(call),[]);await db.exec('reset role');
 const rows=(await db.query('select empresa_id,ciclo,ingresos,costos,utilidad,caja_final,balance_caja,flujo_caja,estado_resultados from reportes_ciclo order by empresa_id,ciclo')).rows;
 assert.equal(rows.length,12);const evidence=[];
 for(const row of rows){const e=row.estado_resultados,r=e.cycleReceipt;assert.ok(r);const sales=r.sales;assert.equal(Number(row.ingresos),sales.reduce((s,x)=>s+x.sold*x.price,0));for(const line of sales)assert.equal(r.goods[line.id],line.available-line.sold);if(row.empresa_id===ids[3])assert.equal(r.produced,0);else{assert.ok(r.produced>0);assert.ok(r.sold>0);assert.ok(Number(row.ingresos)>0);}if(row.ciclo<3)assert.equal(e.impuestoRenta,0);evidence.push({empresa:ids.indexOf(row.empresa_id)+1,ciclo:row.ciclo,producido:r.produced,disponible:sales.reduce((s,x)=>s+x.available,0),demanda:sales.reduce((s,x)=>s+x.assignedDemand,0),vendidas:r.sold,ingresos:Number(row.ingresos),costos:Number(row.costos),utilidad:Number(row.utilidad),caja:Number(row.caja_final),impuesto:e.impuestoRenta});}
 const inactive=(await db.query('select expulsada_at from participantes where empresa_id=$1',[ids[3]])).rows[0];assert.equal(inactive.expulsada_at,null);
 const positive=rows.filter(r=>r.empresa_id===ids[0]);assert.ok(positive.at(-1).estado_resultados.baseImponibleAcumulada>0);assert.ok(positive.at(-1).estado_resultados.impuestoRenta>0);
 const reportDir=path.join(root,'reports/evidencia_ventas_2026-10-28');fs.mkdirSync(reportDir,{recursive:true});fs.writeFileSync(path.join(reportDir,'simulacion.json'),JSON.stringify(evidence,null,2));fs.writeFileSync(path.join(reportDir,'snapshots.json'),JSON.stringify(rows,null,2));console.table(evidence);console.log('PASS: tres ciclos, cuatro empresas, persistencia, ventas, stock, impuesto final, sin expulsión y reintento.');
 }finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1});
