const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createQueue}=require('../services/student_sync.js');
test('manual expulsion remains outside final podium; historical grades can still be consulted',()=>{
 const podium=require('../js/teacher_podium.js');
 const reports=[{empresa:'Eliminada',estado:'eliminada',expulsadaAt:'2026-10-21',teacherScore:20},{empresa:'Activa',estado:'activa',teacherScore:18}];
 assert.deepEqual(podium.finalPodium(reports,r=>r.teacherScore,{finished:true}).map(r=>r.empresa),['Activa']);
});

test('expulsion service confirms RPC and reports missing migration without claiming success',async()=>{
 const calls=[];let response={data:{success:true,empresa_id:7,expulsada_at:'2026-10-21T12:00:00Z'}};
 const window={SIDE:{SupabaseClient:{get:()=>({rpc:async(name,args)=>{calls.push({name,args});return response;}})}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../services/partida_service.js'),'utf8'),{window,console});
 const service=window.SIDE.PartidaService;
 assert.equal((await service.expulsarEmpresa('game',7)).success,true);
 assert.equal(calls[0].name,'side_expulsar_empresa');assert.equal(calls[0].args.p_expulsar,true);
 await service.expulsarEmpresa('game',7,false);assert.equal(calls[1].args.p_expulsar,false);
 response={error:{code:'PGRST202',message:'missing RPC'}};
 const failed=await service.expulsarEmpresa('game',7);assert.equal(failed.success,false);assert.equal(failed.migrationMissing,true);assert.match(failed.error,/2026-10-21_expulsion_empresa.sql/);
 response={data:{success:false,code:'NO_AUTORIZADO',error:'No eres el profesor'}};
 assert.equal((await service.expulsarEmpresa('game',7)).code,'NO_AUTORIZADO');
});

for(const phase of ['snapshot','operation','conflict-read'])test(`expelled student stops durable retries during ${phase}`,async()=>{
 const memory=new Map();let rejected=null,operations=0,reads=0;
 const error={success:false,code:'EMPRESA_EXPULSADA',error:'Eliminada por inactividad'};
 const queue=createQueue({
  storage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},
  context:()=>({connected:true,identityKey:'A',identity:{codigo:'SIDE-AAA'},epoch:1,revision:0}),
  saveSnapshot:async()=>phase==='snapshot'?error:phase==='conflict-read'?{success:false,code:'ESTADO_DESACTUALIZADO'}:{success:true,data:{snapshot_revision:1}},
  saveOperation:async()=>{operations++;return error;},readSnapshot:async()=>{reads++;return error;},
  onRejected:e=>{rejected=e;}
 });
 assert.equal(await queue.enqueue({round:1,decision_state:{}},{key:'report',type:'report',payload:{}}),false);
 assert.equal(queue.pending(),false);assert.equal(rejected.code,'EMPRESA_EXPULSADA');
 assert.equal(operations,phase==='operation'?1:0);assert.equal(reads,phase==='conflict-read'?1:0);
 assert.ok(memory.has('SIDE_STUDENT_SYNC_CONFLICT_A'),'respaldo local de los cambios sin reenviarlos');
 assert.equal(await queue.flush(),true);assert.equal(operations,phase==='operation'?1:0);
});

test('expelled admission remains a user rejection rather than a technical retry',async()=>{
 const window={SIDE:{SupabaseClient:{get:()=>({rpc:async(name)=>name==='side_admission_features'?{data:{waitingRoomVersion:3,exactIdentityVersion:2}}:{data:{success:false,code:'EMPRESA_EXPULSADA',error:'Eliminada por inactividad'}}})}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../services/empresa_service.js'),'utf8'),{window,console});
 const result=await window.SIDE.EmpresaService.ingresar({codigo:'SIDE-AAA',nombreLegal:'Legal',nombreComercial:'Marca'});
 assert.equal(result.code,'EMPRESA_EXPULSADA');assert.equal(result.technical,false);
});
