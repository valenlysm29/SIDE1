'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('zero confirmed plans is a provisional no-op and never calls persistence RPC',async()=>{
 const calls=[],window={SIDE:{SupabaseClient:{get:()=>({rpc:async name=>{calls.push(name);return {data:{code:'SIN_PLANES_CONFIRMADOS'}};}})}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../services/partida_service.js'),'utf8'),{window,console,setTimeout,clearTimeout});
 const result=await window.SIDE.PartidaService.cerrarNegocio('game',1);
 assert.equal(result.success,true);assert.equal(result.pending,true);assert.equal(result.data,null);
 assert.deepEqual(calls,['side_contexto_cierre_negocio']);
});
test('malformed confirmed plans still return an error',async()=>{
 const window={SIDE:{SupabaseClient:{get:()=>({rpc:async()=>({data:{code:'PLANES_PENDIENTES',error:'Plan incompleto'}})})}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../services/partida_service.js'),'utf8'),{window,console,setTimeout,clearTimeout});
 const result=await window.SIDE.PartidaService.cerrarNegocio('game',1);
 assert.equal(result.success,false);assert.equal(result.code,'PLANES_PENDIENTES');
});
test('cut, advance and pause controls can continue without submitted plans and never claim a persisted closure',async()=>{
 const source=fs.readFileSync(require.resolve('../js/docente.js'),'utf8');
 for(const action of ['cerrar','avanzar','pausar']){
  const calls=[],status={textContent:''},context={teacherRead:Promise.resolve(),teacherBusy:false,state:{partidaId:'game',round:1,reports:[],authoritative:{runtime:{phase:'decisions'}}},
   window:{SIDE:{PartidaService:{controlar:async(id,command)=>{calls.push(command);return {success:true,data:{}};},cerrarNegocio:async()=>({success:true,pending:true,data:null})}}},
   $:()=>status,applyTeacherState(){},toast(){throw Error('unexpected failure toast');},persistReports(){throw Error('provisional closure persisted');},renderResults(){throw Error('provisional closure rendered as final');}};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('async function closeBusinessRemoteRound('),source.indexOf('\nfunction renderWinnerSelect(')),context);
  vm.runInContext(source.slice(source.indexOf('async function controlGame('),source.indexOf('\nasync function startGame(')),context);
  assert.equal(await context.controlGame(action),true);assert.deepEqual(calls,[action]);
  if(action!=='pausar')assert.match(status.textContent,/sin planes confirmados.*pendiente/);
 }
});
