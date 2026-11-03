'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const F=require('./progresiva_fixture.cjs'),worker=require('../services/business_runtime.cjs');
const statements=['estadoResultados','balanceCaja','flujoCaja','balanceGeneral'];
test('90 escenarios: cantidades y soles concilian; ganancias y pérdidas reales',async()=>{
 const rows=await F.runMatrix();assert.equal(rows.length,90);
 assert.ok(rows.filter(r=>r.estrategia==='eficiente'&&r.molde.startsWith('molde')).every(r=>r.utilidad>0));
 assert.ok(rows.some(r=>r.estrategia==='ineficiente'&&r.utilidad<0));
 assert.ok(rows.some(r=>r.molde==='molde_3'&&r.meta===1000&&r.vendido<r.producido));
});
test('Node y Edge: las 90 estrategias aplican exactamente iguales producción, costos y estados',async()=>{
 const edge=await import('../supabase/functions/side-business-close/runtime.mjs');
 for(const spec of F.scenarios()){
  async function run(engine){let seal;const state=F.plan(spec.target,spec.strategy);
   const rpc=async(name,args)=>{
    if(name==='side_cierres_pendientes')return {data:[{id:spec.id,cycles:[1]}]};
    if(name==='side_contexto_cierre_negocio')return {data:{empresas:[{id:'qa',capital:F.capital,snapshot:{decision_state:{__cyclePlans:{1:{state}}}}}],financialConfig:{cycles:3,capital:F.capital,economicRulesVersion:'utility-v1',loanPolicy:{version:'french-v1'}},token:'fixture'}};
    if(name==='side_guardar_cierre_negocio'){seal=structuredClone(args.p_cierre);return {data:{cierre:seal}}}
    throw Error(name);
   };
   const rows=await engine(rpc);assert.ok(rows.every(r=>r.success),JSON.stringify(rows));return seal;
  }
  assert.deepEqual(await run(edge.runOnce),await run(worker.runOnce),spec.id);
 }
});
test('restricciones: dotación sin máquina, falta de hilo y cuota parcial no crean producción ni materiales',()=>{
 const base=F.plan({molde_1:1000},'eficiente');
 const close=state=>F.C.close({state,catalog:F.F.catalog,round:1,capital:F.capital,financialPolicy:F.policy()});
 const full=close(base);
 const extra=structuredClone(base);extra.PERS_CORTE.quantities.corte_basico*=10;
 assert.equal(close(extra).receipt.production.processes[0].cycleCapacity,full.receipt.production.processes[0].cycleCapacity);
 const missing=structuredClone(base);missing.ENSAMBLE={round:1,purchases:{1:{ens_basica:0}},quantities:{ens_basica:0}};
 assert.equal(close(missing).receipt.produced,0);
 const thread=structuredClone(base);thread.HILO.quantities.hilo_std=3000;
 assert.equal(close(thread).receipt.produced,500);
 assert.equal(close(thread).receipt.inventory.hilo_std,0);
 const zero=structuredClone(base);zero.HILO.quantities.hilo_std=0;assert.equal(close(zero).receipt.produced,0);
});
test('PostgreSQL real del fixture: persiste 90 escenarios y el reintento Edge coincide con Node',{timeout:240000},async()=>{
 const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs'),db=await database();
 const edge=await import('../supabase/functions/side-business-close/runtime.mjs');let count=0;
 try{
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; alter table participantes add column if not exists expulsada_at timestamptz");
  for(const file of ['../docs/sql/20261023_despliegue_cierre_v19.sql','../supabase/migrations/20261026_cierre_sin_expulsion_automatica.sql','../supabase/migrations/20261027_corregir_ventas_generales.sql','../supabase/migrations/20261028_cierre_servidor.sql'])await db.exec(fs.readFileSync(require.resolve(file),'utf8'));
  for(const spec of F.scenarios()){
   await db.exec('reset role');
   const game=await createGame(db,config({cycles:3,capital:F.capital,economicRulesVersion:'utility-v1',loanPolicy:{version:'french-v1'}}));
   const joined=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:spec.id,p_nombre_comercial:spec.id}),id=Number(joined.empresa_id),state=F.plan(spec.target,spec.strategy);
   await db.query('update side_student_state set snapshot=$2 where empresa_id=$1',[id,{decisions_submitted:true,decision_state:{__cyclePlans:{1:{state}}}}]);
   await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','results','status','finished')) where id=$1",[game.id]);
   await db.query("select set_config('test.role','service_role',false)");await db.exec('set role service_role');
   const call=async(name,args)=>{if(name==='side_cierres_pendientes')return {data:[{id:game.id,cycles:[1]}]};try{return {data:await rpc(db,name,args)}}catch(error){return {error:{message:error.message}}}};
   await db.exec('begin');let run=await worker.runOnce(call);assert.ok(run[0].success,JSON.stringify(run));
   const node=(await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1})).cierre;await db.exec('rollback');
   run=await edge.runOnce(call);assert.ok(run[0].success,JSON.stringify(run));
   const stored=(await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1})).cierre;
   assert.deepEqual(stored,node,spec.id);
   const expected=F.C.close({state,catalog:F.F.catalog,round:1,capital:F.capital,financialPolicy:F.policy()});
   // JSON/PostgreSQL represents signed zero as zero; compare the same transport.
   for(const key of statements)assert.deepEqual(stored.resultadosPorEmpresa[String(id)].financial[key],JSON.parse(JSON.stringify(expected.financial[key])),spec.id+' '+key);
   assert.ok((await edge.runOnce(call))[0].success);
   await db.exec('reset role');assert.equal(Number((await db.query('select count(*) n from side_business_closures where partida_id=$1',[game.id])).rows[0].n),1);
   count++;if(count%18===0)console.log('POSTGRES_MATRIX',count);
  }
  assert.equal(count,90);
 }finally{await db.close()}
});
