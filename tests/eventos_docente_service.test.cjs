'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),init=require('../services/partida_service.js');
function service(response){const global={SIDE:{SupabaseClient:{get:()=>({rpc:async()=>response})}}};init(global);return global.SIDE.PartidaService;}
test('el servicio docente rechaza asignaciones confirmadas para otra empresa o ciclo',async()=>{
 for(const data of [{eventId:'PE69',companyId:'2',round:1,intensity:20},{eventId:'PE69',companyId:'1',round:2,intensity:20},{eventId:'PE69',companyId:'1',round:1,intensity:10}]){
  const result=await service({data,error:null}).asignarDesafio('game',1,1,'PE69',20);assert.equal(result.code,'EVENTO_NO_CONFIRMADO');
 }
 assert.equal((await service({data:{},error:null}).consultarDesafios('game')).code,'EVENTOS_NO_VERIFICADOS');
});
test('el servicio acepta solo sorteos confirmados para el ciclo solicitado',async()=>{
 for(const data of [{sourceCycle:2,events:[],reused:false},{sourceCycle:1,events:null,reused:false},{sourceCycle:1,events:[],reused:'false'}])assert.equal((await service({data,error:null}).sortearDesafios('game',1)).code,'EVENTOS_NO_VERIFICADOS');
 assert.equal((await service({data:{sourceCycle:1,events:[],reused:false},error:null}).sortearDesafios('game',1)).success,true);
});
test('rotación rechaza respuesta inválida y conserva reintentos verificados',async()=>{const ok={round:1,reused:false,events:[{companyId:'1',eventId:'PE69',round:1,intensity:2},{companyId:'2',eventId:'PE71',round:1,intensity:2},{companyId:'3',eventId:'PE75',round:1,intensity:2}]};const a=await service({data:ok,error:null}).programarDesafiosEquilibrados('game',1);assert.equal(a.success,true);const b=await service({data:{...ok,events:[ok.events[0],ok.events[0]]},error:null}).programarDesafiosEquilibrados('game',1);assert.equal(b.code,'EVENTOS_NO_VERIFICADOS');assert.equal((await service({data:ok,error:null}).programarDesafiosEquilibrados('game',7)).code,'CICLO_INVALIDO')});
