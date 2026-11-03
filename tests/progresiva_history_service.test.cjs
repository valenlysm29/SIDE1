'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function load(){const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(require.resolve('../services/official_history_service'),'utf8'),c);return c.SIDE_OFFICIAL_HISTORY_SERVICE;}
test('historial paginado: 12 empresas × 6 ciclos, concurrencia acotada, orden y valores idénticos',async()=>{
 const api=load();let active=0,maximum=0;const calls=[];
 const rpc=async(name,args)=>{assert.equal(name,'side_historial_oficial');assert.ok(args.p_empresa_id);active++;maximum=Math.max(maximum,active);calls.push(args.p_empresa_id);await new Promise(r=>setTimeout(r,2));active--;return {data:{version:'official-history-v1',partida_id:'g',companies:[{id:args.p_empresa_id,nombre:'QA'}],cycles:Array.from({length:6},(_,i)=>({partida_id:'g',empresa_id:args.p_empresa_id,ciclo:i+1,status:'confirmed',result:{financial:{utilidad:123.45}}}))}}};
 const result=JSON.parse(JSON.stringify(await api.read({rpc},'g',[12,4,1,2,3,4,5,6,7,8,9,10,11])));
 assert.equal(calls.length,12);assert.equal(maximum,2);assert.equal(result.cycles.length,72);
 assert.deepEqual(result.cycles.map(r=>[r.ciclo,r.empresa_id]),Array.from({length:6},(_,i)=>Array.from({length:12},(_,j)=>[i+1,j+1])).flat());
 assert.ok(result.cycles.every(r=>r.result.financial.utilidad===123.45));
});
test('no acepta resultados parciales, empresas ajenas, duplicados ni fallos de autorización',async()=>{
 const api=load(),base={version:'official-history-v1',partida_id:'g',companies:[{id:1}],cycles:[{partida_id:'g',empresa_id:1,ciclo:1,status:'confirmed'}]};
 await assert.rejects(api.read({rpc:async()=>({error:{code:'42501',message:'Denied'}})},'g',[1]),/Denied/);
 for(const data of [{...base,partida_id:'other'},{...base,companies:[{id:2}]},{...base,cycles:[{...base.cycles[0],empresa_id:2}]},{...base,cycles:[base.cycles[0],base.cycles[0]]}]){
  await assert.rejects(api.read({rpc:async()=>({data})},'g',[1]));
 }
});
