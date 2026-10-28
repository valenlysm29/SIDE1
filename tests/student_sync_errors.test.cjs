'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createQueue,pendingMessage}=require('../services/student_sync.js');
const identity={codigo:'SIDE-TEST',nombreLegal:'Empresa prueba',nombreComercial:'Prueba'};
function service(reply){
  const window={SIDE:{SupabaseClient:{get:()=>({rpc:async()=>{
    if(reply instanceof Error)throw reply;
    return reply;
  }})}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../services/decisiones_service.js'),'utf8'),{window});
  return window.SIDE.DecisionesService;
}
const save=(s,method)=>method==='guardar'?s.guardar(identity,1,[{decision_id:'CANALES',opcion_id:'web',cantidad:1}],3):s.guardarReporte(identity,1,{capital:100000},3);

test('decision writes preserve technical errors and require an explicit acknowledgment',async()=>{
  for(const method of ['guardar']){
    const s=service({error:{code:'PGRST202',message:'Function missing',details:'signature',hint:'reload schema',status:404}});
    const result=await save(s,method);
    assert.equal(result.success,false);assert.equal(result.technical,true);
    assert.equal(result.code,'PGRST202');assert.equal(result.details,'signature');assert.equal(result.status,404);
    for(const data of [null,{},[],{guardadas:1}]){
      const unconfirmed=await save(service({data}),method);
      assert.equal(unconfirmed.success,false);assert.equal(unconfirmed.code,'RESPUESTA_GUARDADO_INVALIDA');
    }
    assert.equal((await save(service({data:{success:true}}),method)).success,true);
    const rejection=await save(service({data:{success:false,code:'CICLO_PAUSADO',error:'En pausa'}}),method);
    assert.equal(rejection.code,'CICLO_PAUSADO');assert.equal(rejection.technical,undefined);
    const exception=await save(service(Object.assign(new Error('connection failed'),{code:'FETCH_ERROR'})),method);
    assert.equal(exception.code,'FETCH_ERROR');assert.equal(exception.technical,true);
  }
});

test('report preview never writes a financial result from the client',async()=>{const result=await save(service({data:{success:false}}),'guardarReporte');assert.equal(result.success,true);assert.equal(result.data.persisted,false);assert.equal(result.data.provisional,true);});

test('the status gives a useful reason without discarding the local save',()=>{
  assert.match(pendingMessage({code:'CICLO_PAUSADO'}),/docente debe reanudar/);
  assert.match(pendingMessage({code:'PGRST202',error:'missing signature'}),/actualización \(PGRST202\)/);
  assert.match(pendingMessage({error:'Failed to fetch'}),/reintentará automáticamente/);
  assert.match(pendingMessage({code:'42P10',error:'No hay restricción única'}),/Motivo: No hay restricción única \(42P10\)/);
});

test('manual retry bypasses backoff and resumes only unfinished operations',async()=>{
  const memory=new Map(),cleared=[],timers=[];let revision=0,snapshots=0,operations=0,available=false;
  const queue=createQueue({storage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},
    context:()=>({connected:true,identityKey:'test',identity,revision,epoch:1}),
    now:()=>0,schedule:(fn,delay)=>{timers.push({fn,delay});return timers.length;},clearSchedule:id=>cleared.push(id),
    onRevision:r=>revision=r,
    saveSnapshot:async()=>{snapshots++;return {success:true,data:{snapshot_revision:1}};},
    saveOperation:async()=>{operations++;return available?{success:true}:{success:false,error:'Failed to fetch'};}});
  await queue.enqueue({round:1,decision_state:{}},{key:'decisions:B',type:'decisions',payload:[1]});
  assert.equal(snapshots,1);assert.equal(operations,1);assert.equal(queue.pending(),true);
  available=true;assert.equal(await queue.flush(),false);assert.equal(operations,1);
  assert.equal(await queue.flush({force:true}),true);
  assert.equal(operations,2);assert.equal(snapshots,1);assert.equal(queue.pending(),false);assert.equal(cleared.length,1);
});
