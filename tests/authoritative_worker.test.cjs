'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const {runOnce}=require('../services/business_runtime.cjs');
async function run(snapshot,cycle=1,previous=null){let posted;
 const rpc=async(name,args)=>{if(name==='side_cierres_pendientes')return {data:[{id:'g',cycles:[cycle]}]};if(name==='side_contexto_cierre_negocio')return {data:args.p_ciclo===cycle?{empresas:[{id:'1',capital:1000,snapshot}],financialConfig:{cycles:3},token:'t'}:{cierre:previous}};if(name==='side_guardar_cierre_negocio'){posted=args.p_cierre;return {data:{cierre:posted}};}throw Error(name)};
 const results=await runOnce(rpc);return {results,posted};}
const makeSnapshot=()=>({decision_state:{__cyclePlans:{1:{state:{}}}},cash_ledger:{},financial_sections:{}});
test('worker ignores forged current ledger, valid section and financial snapshot',async()=>{const a=makeSnapshot(),b=makeSnapshot();b.cash_ledger={'1:FORGED':900000,'1:B':900000};b.financial_sections={1:{B:{net:900000,recordedNet:900000,items:[]}}};b.decision_state.__financialSnapshots={1:{balanceGeneral:{efectivo:900000}}};const plain=await run(a),attack=await run(b);assert.equal(plain.posted.resultadosPorEmpresa['1'].financial.balanceCaja.cajaFinal,attack.posted.resultadosPorEmpresa['1'].financial.balanceCaja.cajaFinal);assert.ok(!('1:FORGED' in attack.posted.resultadosPorEmpresa['1'].ledger));});
test('worker restores previous immutable closure, rejecting forged current opening cash',async()=>{const first=await run(makeSnapshot()),previous=first.posted;const snapshot={decision_state:{__cyclePlans:{2:{state:{}}},__financialSnapshots:{1:{balanceGeneral:{efectivo:900000}}},__finishedGoods:{premium:999}},cash_ledger:{'1:FORGED':900000,'2:FORGED':900000}};const next=await run(snapshot,2,previous);assert.equal(next.results[0].success,true);assert.ok(next.posted.resultadosPorEmpresa['1'].financial.balanceCaja.cajaFinal<10000);});
test('unverifiable events fail closed',async()=>{const s=makeSnapshot();s.decision_state.__cycleBusiness={1:{events:[{effect:{revenuePct:50}}]}};const r=await run(s);assert.equal(r.results[0].success,false);assert.equal(r.results[0].code,'DATOS_ECONOMICOS_NO_VERIFICADOS');assert.equal(r.posted,undefined);});

test('legitimate loan is reconstructed from confirmed decision, not client ledger',async()=>{const s=makeSnapshot();s.decision_state.__cyclePlans[1].state.PRESTAMO={round:1,amount:500};s.cash_ledger={'1:F':900000};const r=await run(s);assert.equal(r.results[0].success,true);const f=r.posted.resultadosPorEmpresa['1'].financial;assert.equal(f.balanceCaja.prestamos,500);assert.ok(f.balanceCaja.cajaFinal<2000);assert.equal(f.balanceGeneral.deuda,500);});
test('worker usa precio interno pese a precio inyectado con producción y ventas',async()=>{
 const s=makeSnapshot(),state=s.decision_state.__cyclePlans[1].state;
 for(const [id,quantities] of Object.entries({MESA_CORTE:{mesa:1},ENSAMBLE:{ens_basica:1},ACABADOS:{aca_basica:1},PERS_CORTE:{corte_basico:1},PERS_ENSAMBLE:{ens_personal_basico:1},PERS_ACABADO:{aca_personal_basico:1},CUERO:{cuero_sint:70},ACCESORIOS:{acc_eco:100},HILO:{hilo_std:1300}}))state[id]={round:1,quantities,optionIds:Object.keys(quantities),...(['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(id)?{purchases:{1:quantities}}:{})};
 state.MOLDE={round:1,optionIds:['molde_3']};state.PRODUCCION_META={round:1,moldTargets:{molde_3:90},prices:{premium:900000}};state.CANALES={round:1,optionIds:['web']};
 const result=await run(s);assert.equal(result.results[0].success,true);const receipt=result.posted.resultadosPorEmpresa['1'].receipt;
 assert.equal(receipt.sold,90);assert.equal(receipt.sales.find(x=>x.id==='premium').quality,7);assert.equal(receipt.sales.find(x=>x.id==='premium').chosenPrice,250);assert.equal(receipt.sales.find(x=>x.id==='premium').price,350);assert.equal(receipt.revenue,31500);
});
test('missing prior immutable closure fails closed',async()=>{const s={decision_state:{__cyclePlans:{2:{state:{}}}}};const r=await run(s,2,null);assert.equal(r.results[0].success,false);assert.equal(r.results[0].code,'CIERRE_ANTERIOR_REQUERIDO');assert.equal(r.posted,undefined);});
test('forged past acquisitions cannot create assets in a later cycle',async()=>{const first=await run(makeSnapshot());const s={decision_state:{__cyclePlans:{2:{state:{MESA_CORTE:{round:2,purchases:{1:{mesa:1000}}}}}}}};const result=await run(s,2,first.posted);assert.equal(result.results[0].success,false);assert.equal(result.results[0].code,'HISTORIAL_ACTIVOS_NO_VERIFICADO');assert.equal(result.posted,undefined);});

test('worker rejects invalid decisions before calculating or persisting',async()=>{
 for(const state of [
  {MESA_CORTE:{round:1,purchases:{1:{mesa:'invalid'}}}},
  {MESA_CORTE:{round:1,purchases:{1:{mesa:true}}}},
  {MESA_CORTE:{round:1,purchases:{1:{mesa:[]}}}},
  {MESA_CORTE:{round:1,purchases:{1:{mesa:1e20}}}},
  {MESA_CORTE:{round:1,purchases:{2:{mesa:1}}}},
  {MESA_CORTE:{round:1,purchases:{'01':{mesa:1}}}},
  {MESA_CORTE:{round:1,purchases:{'0':{mesa:1}}}},
  {MESA_CORTE:{round:1,purchases:{1:{mesa:-10}}}},
  {MOLDE:{round:1,optionIds:['falso']}},
  {JEFATURA:{round:1,optionIds:['falso']}},
  {CANALES:{round:1,optionIds:['web','web']}},
  {PERS_CORTE:{round:1,quantities:{inventado:1}}},
  {HILO:{round:1,quantities:{hilo_std:-5}}},
  {PRODUCCION_META:{round:1,moldTargets:{molde_1:-2}}},
  {PRODUCCION_META:{round:1,prices:{premium:-1}}},
  {PRODUCCION_META:{round:1,prices:{premium:true}}},
  {PRODUCCION_META:{round:1,prices:{premium:'   '}}},
  {PRODUCCION_META:{round:1,prices:{premium:1e100}}},
  {HILO:{round:1,quantities:{hilo_std:[]}}},
  {INV_MARKETING:{round:1,value:10001}},
  {PRESTAMO:{round:1,amount:900000}},
  {CANALES:{round:1,optionIds:['web'],transfers:{premium:{'miraflores:1':2}}}}
 ]){const snapshot=makeSnapshot();snapshot.decision_state.__cyclePlans[1].state=state;const result=await run(snapshot);assert.equal(result.results[0].code,'DECISION_INVALIDA');assert.equal(result.posted,undefined);}
});

test('later credit line rejects fabricated loan and permits verified available line',async()=>{
 const previous=(await run(makeSnapshot())).posted;
 const snapshot=amount=>({decision_state:{__cyclePlans:{2:{state:{PRESTAMO:{round:2,amount}}}}}});
 const forged=await run(snapshot(900000),2,previous);assert.equal(forged.results[0].code,'DECISION_INVALIDA');assert.equal(forged.posted,undefined);
 const allowed=await run(snapshot(500),2,previous);assert.equal(allowed.results[0].success,true);assert.equal(allowed.posted.resultadosPorEmpresa['1'].financial.balanceCaja.prestamos,500);
});

test('worker rejects cycle totals above six before persisting a closure',async()=>{
 let posted=false;
 const rpc=async(name)=>{
  if(name==='side_cierres_pendientes')return {data:[{id:'g',cycles:[1]}]};
  if(name==='side_contexto_cierre_negocio')return {data:{empresas:[{id:'1',capital:1000,snapshot:makeSnapshot()}],financialConfig:{cycles:7},token:'t'}};
  if(name==='side_guardar_cierre_negocio'){posted=true;return {data:{}};}
  throw Error(name);
 };
 const result=await runOnce(rpc);
 assert.equal(result[0].code,'DURACION_INVALIDA');assert.equal(posted,false);
});

test('worker rejects an out-of-range cycle even when a context is returned',async()=>{
 let posted=false;
 const rpc=async(name)=>{
  if(name==='side_cierres_pendientes')return {data:[{id:'g',cycles:[4]}]};
  if(name==='side_contexto_cierre_negocio')return {data:{empresas:[],financialConfig:{cycles:3},token:'t'}};
  if(name==='side_guardar_cierre_negocio'){posted=true;return {data:{}};}
  throw Error(name);
 };
 const result=await runOnce(rpc);assert.equal(result[0].code,'CICLO_INVALIDO');assert.equal(posted,false);
});

test('worker no convierte compras en stock cuando la sala requiere recepción temporal',async()=>{
 let posted=false;
 const rpc=async(name)=>{
  if(name==='side_cierres_pendientes')return {data:[{id:'g',cycles:[1]}]};
  if(name==='side_contexto_cierre_negocio')return {data:{empresas:[{id:'1',capital:1000,snapshot:makeSnapshot()}],financialConfig:{cycles:3,materialRulesVersion:'receipts-v1'},token:'t'}};
  if(name==='side_material_context_v1')return {data:{companyId:'1',events:{},revision:'verified'}};
  if(name==='side_guardar_cierre_negocio'){posted=true;return {data:{}};}
  throw Error(name);
 };
 const result=await runOnce(rpc);assert.equal(result[0].code,'RECEPCIONES_NO_DISPONIBLES');assert.equal(posted,false);
});
