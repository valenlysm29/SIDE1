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
test('la programación equilibrada solo acepta tres asignaciones distintas confirmadas para el ciclo',async()=>{
 const events=['PE69','PE71','PE75'].map((eventId,i)=>({eventId,companyId:String(i+1),round:2,intensity:2}));
 assert.equal((await service({data:{round:2,reused:false,events},error:null}).programarDesafiosEquilibrados('game',2)).success,true);
 assert.equal((await service({data:{round:2,reused:false,events:events.slice(0,2)},error:null}).programarDesafiosEquilibrados('game',2)).success,true);
 assert.equal((await service({data:{round:2,reused:false,events:[...events,{...events[0],companyId:'4'}]},error:null}).programarDesafiosEquilibrados('game',2)).success,true);
 const bad=[{round:2,reused:false,events:events.slice(0,1)},{round:2,reused:false,events:events.map(e=>({...e,companyId:'1'}))},{round:2,reused:false,events:events.map(e=>({...e,intensity:6}))}];
 for(const data of bad)assert.equal((await service({data,error:null}).programarDesafiosEquilibrados('game',2)).code,'EVENTOS_NO_VERIFICADOS');
});
