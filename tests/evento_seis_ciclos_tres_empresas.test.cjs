'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
const {runOnce}=require('../services/business_runtime.cjs');const fixture=require('./economic_v19_fixture.cjs');
for(const cycles of [3,6])test(`tres empresas durante ${cycles} ciclos con desafíos rotados y cierres persistidos`,async()=>{
 const db=await database();
 try{
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; alter table participantes add column if not exists expulsada_at timestamptz");
  for(const file of ['docs/sql/20261023_despliegue_cierre_v19.sql','supabase/migrations/20261026_cierre_sin_expulsion_automatica.sql','supabase/migrations/20261027_corregir_ventas_generales.sql','supabase/migrations/20261028_cierre_servidor.sql','supabase/migrations/20261031025358_desafios_autoritativos_v1.sql'])await db.exec(fs.readFileSync(file,'utf8'));
  await db.exec('create schema side_private; create table side_private.student_claims(empresa_id bigint primary key,owner_id uuid)');
  for(const file of ['supabase/migrations/20261031030035_consulta_privada_desafios.sql','supabase/migrations/20261031043153_programacion_desafios_autoritativa.sql','supabase/migrations/20261031050037_eventos_grupales_mercado_v1.sql'])await db.exec(fs.readFileSync(file,'utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261031055001_mercado_global_escenarios_v2.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261031055442_eventos_productivos_v2.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261031060031_eventos_atractivo_duracion_v2.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261031060810_proteger_programacion_desafios.sql','utf8'));
  const game=await createGame(db,config({cycles,capital:1000000,economicEventsVersion:'demand-share-v1'})),ids=[];
  for(let i=1;i<=3;i++){const company=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Empresa '+i,p_nombre_comercial:'Marca '+i});ids.push(Number(company.empresa_id));}
  const events=cycles===3?[{id:'PE70',intensity:12,sign:-1},{id:'PE69',intensity:20,sign:1},{id:'PE75',intensity:6,sign:-1}]:[{id:'PE70',intensity:12,sign:-1},{id:'PE91',intensity:7,sign:1},{id:'PE92',intensity:12,sign:-1},{id:'PE69',intensity:20,sign:1},{id:'PE71',intensity:15,sign:1},{id:'PE75',intensity:6,sign:-1}];
  for(let round=1;round<=cycles;round++){const event=events[(round-1)%events.length];await rpc(db,'side_assign_event_v1',{p_partida_id:game.id,p_empresa_id:ids[(round-1)%3],p_ciclo:round,p_event_id:event.id,p_intensity:event.intensity});}
  const groups=[{id:'PE01',intensity:10},{id:'PE02',intensity:15},{id:'PE03',intensity:25},{id:'PE04',intensity:30},{id:'PE17',intensity:10},{id:'PE18',intensity:10}];
  for(let round=1;round<=cycles;round++){const event=groups[(round-1)%groups.length];await rpc(db,'side_assign_group_event_v1',{p_partida_id:game.id,p_ciclo:round,p_event_id:event.id,p_intensity:event.intensity});}
  const source=fs.readFileSync('js/docente.js','utf8'),project=source.slice(source.indexOf('function applyConfirmedReportClosures('),source.indexOf('\nlet rosterSyncError=')),lab=require('../js/laboratorio_model.js');
  const teacher={state:{partidaId:game.id},roomGeneration:1,confirmedReportClosures:new Map()};vm.createContext(teacher);vm.runInContext(project,teacher);
  let previous={};
  for(let round=1;round<=cycles;round++){
   await db.exec('reset role');
   for(const id of ids){
    const state=fixture.state(round,previous[id]?.state||{},0);
    state.PRODUCCION_META.moldTargets={molde_1:90,molde_2:0,molde_3:0};
    const snapshot={decisions_submitted:true,decision_state:{__cyclePlans:{[round]:{state}}}};
    await db.query('update side_student_state set snapshot=$2 where empresa_id=$1',[id,snapshot]);
   }
   await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',$2::int,'phase','results','status','finished')) where id=$1",[game.id,round]);
   await db.query("select set_config('test.role','service_role',false)");await db.exec('set role service_role');
   const call=async(name,args)=>{if(name==='side_cierres_pendientes')return {data:[{id:game.id,cycles:[round]}]};try{return {data:await rpc(db,name,args)};}catch(e){return {error:{message:e.message}};}};
   const outcomes=await runOnce(call);assert.equal(outcomes[0].success,true,JSON.stringify(outcomes));
   const results=(await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:round})).cierre.resultadosPorEmpresa;
   for(const id of ids){
    const result=results[id],expected=[groups[(round-1)%groups.length].id];if(id===ids[(round-1)%3])expected.push(events[(round-1)%events.length].id);if(round>=2&&['PE70','PE91','PE92'].includes(events[round-2].id)&&id===ids[(round-2)%3])expected.push(events[round-2].id);assert.deepEqual(result.receipt.events.map(event=>event.id).sort(),expected.sort());
    teacher.confirmedReportClosures.set(JSON.stringify([1,game.id,round,String(id)]),{...result.financial,cycleReceipt:result.receipt});
    const projected={empresaId:id,ronda:round};teacher.applyConfirmedReportClosures([projected]);const laboratory=lab.read(result);
    assert.equal(projected.ingresos,laboratory.revenue);assert.equal(projected.utilidad,laboratory.profit);assert.equal(projected.caja,laboratory.cash);assert.equal(projected.unidadesVendidas,laboratory.sold);assert.equal(projected.cycleHistory.length,round);
    assert.equal(result.financial.balanceGeneral.activos,result.financial.balanceGeneral.pasivoPatrimonio);
    if(round>1)assert.equal(result.financial.balanceCaja.cajaInicial,previous[id].financial.balanceCaja.cajaFinal);
    for(const sale of result.receipt.sales)assert.ok(sale.sold<=sale.available);
    const consumed={};for(const lot of result.receipt.materialLots)for(const family of Object.values(lot.materials))for(const [sku,q] of Object.entries(family))consumed[sku]=(consumed[sku]||0)+q;
    for(const family of ['CUERO','ACCESORIOS','HILO'])for(const [sku,q] of Object.entries(result.receipt.decisions[family].quantities))assert.ok(Math.abs(Number(result.receipt.openingInventory[sku]||0)+q-Number(consumed[sku]||0)-Number(result.receipt.inventory[sku]||0))<1e-7,`ciclo ${round}, empresa ${id}, ${sku}`);
   }
   assert.equal(ids.reduce((sum,id)=>sum+results[id].receipt.marketAllocation.products.esencial.asignado,0),Math.round(3500*(1+(groups[(round-1)%groups.length].id==='PE17'?-1:1)*groups[(round-1)%groups.length].intensity/100)));
   const affected=ids[(round-1)%3],other=ids[round%3];
   const shock=events[(round-1)%events.length];
   if(shock.sign&&round!==3)assert.ok(shock.sign*(results[affected].receipt.marketAllocation.products.esencial.asignado-results[other].receipt.marketAllocation.products.esencial.asignado)>0);
   else if(!shock.sign){const capacity=id=>results[id].receipt.production.processes.find(p=>p.id==='assembly').dailyCapacity;assert.equal(capacity(affected),capacity(other)*.75);assert.equal(results[affected].financial.flujoCaja.eventos,-200);}
   const again=await runOnce(call);assert.equal(again[0].success,true);
   assert.deepEqual((await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:round})).cierre.resultadosPorEmpresa,results);
   previous=results;
  }
 }finally{await db.close();}
});
