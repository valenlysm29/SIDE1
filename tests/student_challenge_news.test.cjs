'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../js/student_challenge_news.js');
const event={eventId:'PE69',round:2,intensity:20,status:'programado',title:'Noticia',description:'Demanda relativa'};
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('respuestas tardías no cruzan empresas ni sesiones',async()=>{
 let ctx={gameId:'g',companyId:1,epoch:1,version:'demand-share-v1',connected:true};const first=defer(),second=defer();let calls=0;
 const ctl=create({context:()=>ctx,read:()=>++calls===1?first.promise:second.promise});
 const a=ctl.refresh();ctx={...ctx,companyId:2,epoch:2};assert.deepEqual(ctl.visible(),[]);const b=ctl.refresh();
 first.resolve({success:true,data:[event]});assert.equal(await a,false);assert.deepEqual(ctl.visible(),[]);
 second.resolve({success:true,data:[{...event,title:'Empresa 2'}]});assert.equal(await b,true);assert.equal(ctl.visible()[0].title,'Empresa 2');
 ctx={...ctx,connected:false};assert.deepEqual(ctl.visible(),[]);assert.equal(ctl.state(),'idle');
});
test('sin V2 no consulta y el error no se muestra como ausencia de desafíos',async()=>{
 let ctx={gameId:'g',companyId:1,epoch:1,version:null,connected:true},calls=0;
 const ctl=create({context:()=>ctx,read:async()=>{calls++;return {success:false};}});
 assert.equal(await ctl.refresh(),false);assert.equal(calls,0);
 ctx={...ctx,version:'demand-share-v1'};assert.equal(await ctl.refresh(),false);assert.equal(calls,1);assert.equal(ctl.state(),'error');assert.deepEqual(ctl.visible(),[]);
});
test('rechaza noticias desconocidas o incompletas',async()=>{
 const ctx={gameId:'g',companyId:1,epoch:1,version:'demand-share-v1',connected:true};
 const ctl=create({context:()=>ctx,read:async()=>({success:true,data:[{...event,eventId:'PE89'}]})});
 assert.equal(await ctl.refresh(),false);assert.equal(ctl.state(),'error');assert.deepEqual(ctl.visible(),[]);
});
