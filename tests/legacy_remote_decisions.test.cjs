'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {state,catalog}=require('./economic_v19_fixture.cjs'),CYCLE=require('../js/cycle_model');
const {database,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
const source=fs.readFileSync(require.resolve('../js/app.js'),'utf8');
const sandbox={Number,Math,Map,Infinity,findDecisionItem:id=>catalog.flatMap(c=>c.items).find(item=>item.id===id)};
vm.createContext(sandbox);vm.runInContext(source.slice(source.indexOf('function legacyRemoteDecisionState('),source.indexOf('function hydrateRemoteProgress(')),sandbox);
const restore=data=>JSON.parse(JSON.stringify(sandbox.legacyRemoteDecisionState(data)));
const row=(decision_key,option_key,ciclo,cantidad,costo_total=0)=>({decision_key,option_key,ciclo,cantidad,costo_total});

test('RPC history restores only the latest cycle for production, materials, staff, channels and loan',()=>{
 const rows=[
  row('PRODUCCION_META',null,1,100),row('PRODUCCION_META',null,2,30),
  row('CUERO','cuero_prem',1,100,8000),row('CUERO','cuero_sint',2,10,250),
  row('PERS_CORTE','corte_maestro',1,3,12000),row('PERS_CORTE','corte_basico',2,1,1690.8),
  row('CANALES','miraflores',1,2,7000),row('CANALES','web',2,1,500),
  row('PRESTAMO',null,1,1,20000),row('PRESTAMO',null,2,1,5000)
 ];
 for(const history of [rows,[...rows].reverse()]){
  const s=restore({ciclo_partida:2,decisiones_historial:history});
  assert.equal(s.PRODUCCION_META.value,30);assert.equal(s.PRODUCCION_META.round,2);
  assert.deepEqual(s.CUERO.quantities,{cuero_sint:10});assert.equal(s.CUERO.cost,250);
  assert.deepEqual(s.PERS_CORTE.quantities,{corte_basico:1});assert.deepEqual(s.PERS_CORTE.optionIds,['corte_basico']);
  assert.deepEqual(s.CANALES.optionIds,['web']);assert.equal(s.CANALES.storeContracts,undefined);
  assert.equal(s.PRESTAMO.amount,5000);
 }
});

test('asset history preserves purchases and disposals while molds retain their first acquisition cycle',()=>{
 const s=restore({ciclo_partida:3,decisiones_historial:[
  row('ENSAMBLE','ens_basica',1,2,7000),row('ENSAMBLE','ens_basica',2,-1,-1400),row('ENSAMBLE','ens_ind',3,1,15000),
  row('MOLDE','molde_1',2,1,300),row('MOLDE','molde_1',1,1,300),row('MOLDE','molde_2',3,1,1200)
 ]});
 assert.deepEqual(s.ENSAMBLE.purchases,{'1':{ens_basica:2},'2':{ens_basica:-1},'3':{ens_ind:1}});
 assert.equal(s.MOLDE.optionRounds.molde_1,1);assert.equal(s.MOLDE.optionRounds.molde_2,3);
 assert.deepEqual(new Set(s.MOLDE.optionIds),new Set(['molde_1','molde_2']));
});

test('fallbacks keep the true cycle of older decisions and exclude future-cycle rows',()=>{
 const s=restore({ciclo_partida:2,decisionesHistorial:[
  row('PRODUCCION_META',null,1,100),row('PRODUCCION_META',null,3,900),
  row('CUERO','cuero_prem',1,100),row('CUERO','cuero_sint',3,1),
  row('MESA_CORTE','mesa',1,1),row('MESA_CORTE','mesa',3,10)
 ]});
 assert.equal(s.PRODUCCION_META.round,1);assert.equal(s.PRODUCCION_META.value,100);
 assert.deepEqual(s.CUERO.quantities,{cuero_prem:100});assert.equal(s.MESA_CORTE.purchases[3],undefined);
 assert.equal(CYCLE.close({state:s,catalog,round:2,capital:200000}).receipt.sold,0,'older purchases must not become new-cycle production');
 assert.equal(restore({decisiones_ciclo:[row('PRODUCCION_META',null,2,90)]}).PRODUCCION_META.value,90);
});

test('recovered two-cycle plans sell the current target rather than summing historical targets',()=>{
 const s=state(2),rows=[];
 for(const [id,entry] of Object.entries(s)){
  const item=catalog.flatMap(c=>c.items).find(item=>item.id===id);
  if(!item)continue;
  if(id==='PRODUCCION_META'){
   rows.push(row(id,null,1,300),row(id,null,2,90));
  }else if(entry.quantities){
   for(const [option,quantity] of Object.entries(entry.quantities))rows.push(row(id,option,item.asset?1:2,quantity));
  }else for(const option of entry.optionIds||[])rows.push(row(id,option,id==='MOLDE'?1:2,1));
 }
 const restored=restore({ciclo_partida:2,decisiones_historial:rows});
 const closed=CYCLE.close({state:restored,catalog,round:2,capital:200000});
 assert.equal(closed.receipt.production.target,90);assert.equal(closed.receipt.sold,90);assert.equal(closed.receipt.revenue,3825);
});

test('real admission RPC supplies complete history without merging prior-cycle material and target rows',async()=>{
 const db=await database();
 try{
  const game=await createGame(db),identity={p_codigo:game.codigo,p_nombre_legal:'Historial QA',p_nombre_comercial:'Historial QA'};
  const joined=await rpc(db,'ingresar_empresa',identity),id=joined.empresa_id;
  await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',2,'phase','decisions')) where id=$1",[game.id]);
  for(const r of [row('PRODUCCION_META',null,1,300),row('PRODUCCION_META',null,2,90),row('CUERO','cuero_prem',1,200),row('CUERO','cuero_sint',2,30)]){
   await db.query(`insert into empresas_decisiones(empresa_id,ciclo,decision_id,opcion_id,cantidad,costo_total,enviada)
    select $1,$2,d.id,o.id,$5,$6,true from decisiones_catalogo d left join decisiones_opciones o on o.decision_id=d.id and o.opcion_id=$4 where d.decision_id=$3`,
    [id,r.ciclo,r.decision_key,r.option_key,r.cantidad,r.costo_total]);
  }
  const response=await rpc(db,'obtener_estado_estudiante',identity);
  assert.equal(response.decisiones_historial.length,4);assert.equal(response.decisiones_ciclo.length,2);
  const restored=restore(response);assert.equal(restored.PRODUCCION_META.value,90);assert.deepEqual(restored.CUERO.quantities,{cuero_sint:30});
 }finally{await db.close();}
});
