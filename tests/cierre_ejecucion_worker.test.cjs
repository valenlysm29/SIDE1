'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
test('attempt claims serialize cycles and record results without bypassing the seal',async()=>{
 const {runTracked}=await import('../supabase/functions/side-business-close/route.mjs');
 const calls=[],locked=new Set();
 const rpc=async(name,args)=>{calls.push([name,args]);if(name==='side_cierres_pendientes')return {data:[{id:'g',cycles:[1,2]}]};if(name==='side_version_worker_cierre')return {data:'1'};if(name==='side_iniciar_intento_cierre'){let key=args.p_partida+args.p_ciclo;if(locked.has(key))return {data:false};locked.add(key);return {data:true};}if(name==='side_finalizar_intento_cierre')return {data:null};throw Error(name)};
 const engine=async call=>{let game=(await call('side_cierres_pendientes',{})).data[0];return [{game:game.id,cycle:game.cycles[0],success:true}];};
 const [a,b]=await Promise.all([runTracked(rpc,engine,engine,{runId:'a'}),runTracked(rpc,engine,engine,{runId:'b'})]);
 assert.equal(a.length+b.length,2);assert.equal(calls.filter(([n])=>n==='side_finalizar_intento_cierre').length,2);
});
test('lost execution fails closed and leaves server evidence for recovery',async()=>{
 const {runTracked}=await import('../supabase/functions/side-business-close/route.mjs');let finished=false;
 const rpc=async(name)=>name==='side_cierres_pendientes'?{data:[{id:'g',cycles:[1]}]}:name==='side_version_worker_cierre'?{data:'1'}:name==='side_iniciar_intento_cierre'?{data:true}:name==='side_finalizar_intento_cierre'?(finished=true,{data:null}):{};
 await assert.rejects(runTracked(rpc,async()=>[],async()=>{throw Error('red')},{runId:'a'}),/red/);assert.equal(finished,false);
});
test('a failed economic close is journaled and stops the next cycle',async()=>{
 const {runTracked}=await import('../supabase/functions/side-business-close/route.mjs');const calls=[];
 const rpc=async(name,args)=>{calls.push([name,args]);return name==='side_cierres_pendientes'?{data:[{id:'g',cycles:[1,2]}]}:name==='side_version_worker_cierre'?{data:'1'}:name==='side_iniciar_intento_cierre'?{data:true}:{data:null};};
 const result=await runTracked(rpc,async()=>[],async()=>[{game:'g',cycle:1,success:false,code:'DECISION_INVALIDA'}],{runId:'a'});
 assert.equal(result.length,1);assert.equal(calls.filter(([n])=>n==='side_iniciar_intento_cierre').length,1);assert.equal(calls.find(([n])=>n==='side_finalizar_intento_cierre')[1].p_code,'DECISION_INVALIDA');
});
