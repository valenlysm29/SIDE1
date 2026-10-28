'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(process.env.SIDE_DOCENTE_SOURCE||require.resolve('../js/docente.js'),'utf8');
function section(start,end){
 const from=source.indexOf(start),to=source.indexOf(end,from);
 assert.ok(from>=0&&to>from,'No se encontró el bloque docente: '+start);
 return source.slice(from,to);
}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function teacher(){
 const elements={},storage=new Map([['SIDE_PROFESOR_ID','owner']]),calls=[];
 const context={confirmedReportClosures:new Map(),ownConfigRevisions:new Map(),stopLiveCompanies(){},sharedRoom:null,console:{error(){}},Promise,clearInterval(){},toast(){},
  state:{partidaId:null,lifecycleVersion:2,starting:false,cancelling:false,round:1},roomGeneration:0,
  teacherRead:Promise.resolve(),publishChain:Promise.resolve(),teacherBusy:false,
  teacherPoll:null,teacherTick:null,teacherClock:null,publishedState:'',
  creationRequest:null,previousRoom:{id:'old',codigo:'SIDE-AA2',estado:'esperando'},active:false,
  localStorage:{removeItem:k=>storage.delete(k),setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)||null},
  refreshSetupSummary(){},refreshStartButton(){},gameStatus:()=>({active:context.active}),
  closeBusinessRemoteRound:async()=>true,
  applyTeacherState:data=>{context.active=data.estado!=='finalizada';storage.set('SIDE_GAME_STATUS',JSON.stringify({active:context.active}));},
  window:{SIDE:{PartidaService:{cancelar:async id=>({success:true,data:{id,estado:'cancelada'}}),controlar:async(id,action)=>{
   calls.push({id,action});return {success:true,data:{id,estado:action==='cancelar'?'finalizada':'activa',configuracion:{runtime:{round:1,phase:'results'}}}};
  }}}}
 };
 Object.defineProperty(context,'active',{get:()=>JSON.parse(storage.get('SIDE_GAME_STATUS')||'null')?.active===true,
  set:value=>storage.set('SIDE_GAME_STATUS',JSON.stringify({active:value}))});
 context.$=id=>elements[id]||(elements[id]={textContent:'',disabled:false,dataset:{},
  classList:{toggle(){},add(){},remove(){}},close(){this.closed=true},addEventListener(event,fn){this.handler=fn}});
 vm.createContext(context);
 vm.runInContext(section('function creationFeedback(','function renderTeacherLobby(')+
  section('async function refreshTeacherGame(){','function watchTeacherGame(){')+
  section("$('confirmCancelGame')?.addEventListener","$('backHome')?.addEventListener"),context);
 return {context,calls,storage,confirm:()=>context.$('confirmCancelGame').handler()};
}
test('un fallo de cancelación conserva la identidad heredada para reintentar sin falso éxito',async()=>{
 const t=teacher();let fail=true;
 t.context.window.SIDE.PartidaService.cancelar=async id=>{
  const action='cancelar';
  t.calls.push({id,action});return fail?{success:false,error:'Conexión interrumpida'}:{success:true,data:{id,estado:'cancelada'}};
 };
 await t.confirm();
 assert.equal(t.context.previousRoom?.id,'old','el fallo debe conservar la partida recuperada');
 assert.equal(t.context.$('cancelGameDialog').closed,undefined,'el fallo no cierra la confirmación');
 assert.doesNotMatch(t.context.$('creationMessage').textContent,/ya terminó|Partida cancelada/);
 fail=false;await t.confirm();
 assert.deepEqual(t.calls,[{id:'old',action:'cancelar'},{id:'old',action:'cancelar'}]);
 assert.equal(t.context.previousRoom,null);assert.equal(t.context.$('cancelGameDialog').closed,true);
});
test('un poll detenido en cierre de negocio no reaplica su sala activa después de cancelar',async()=>{
 const t=teacher(),closure=deferred(),entered=deferred();
 t.context.state.partidaId='old';t.context.active=true;
 t.context.closeBusinessRemoteRound=async()=>{entered.resolve();return closure.promise;};
 const poll=t.context.refreshTeacherGame();await entered.promise;
 await t.confirm();
 assert.equal(t.context.state.partidaId,null);assert.equal(t.context.active,false);
 closure.resolve(true);await poll;
 assert.equal(t.context.active,false,'el snapshot activo anterior debe quedar invalidado');
 assert.equal(t.context.state.partidaId,null);
  assert.equal(JSON.parse(t.storage.get('SIDE_GAME_STATUS')).active,false,'el poll antiguo debe conservar el estado terminal local');
});

test('solo el propietario ve cancelar una sala abierta',()=>{
 const t=teacher();assert.equal(t.context.canCancelRoom({id:'old',estado:'esperando',profesor_id:'owner'}),true);
 assert.equal(t.context.canCancelRoom({id:'old',estado:'activa',profesor_id:'another'}),false);
 assert.equal(t.context.canCancelRoom({id:'old',estado:'cancelada',profesor_id:'owner'}),false);
 t.storage.delete('SIDE_PROFESOR_ID');assert.equal(t.context.canCancelRoom({id:'old',estado:'esperando',profesor_id:'owner'}),false);
});
