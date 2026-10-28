const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
const RULES=require('../js/side_rules.js');
function block(start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));}
function store(){const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)};}
function state(){
 const window={SIDE_FINANCE_CONFIG:require('../services/finance_config.js')};
 const context={window,RULES,localStorage:store(),currentStudent:{empresaId:7,game:{id:'room-b',codigo:'SIDE-NEW'}},studentConnected:true,studentSessionRecovering:false,studentProgressHydrated:true,authoritativeStudentState:null,studentClock:null,performance:{now:()=>0},studentNow:()=>Date.parse('2026-10-11T12:00:00Z'),currentRound:()=>1,teacherConfig:()=>({}),deepClone:value=>JSON.parse(JSON.stringify(value))};
 vm.createContext(context);vm.runInContext("function admissionCode(value){return String(value||'').trim().toUpperCase();}\n"+block('function studentAccess(','function updateIntegrationUI(')+block('function applyStudentGameState(','function remoteSnapshot('),context);return context;
}
test('una cancelación antigua no se atribuye a otra sala aunque tenga el mismo empresaId',()=>{
 const c=state();c.authoritativeStudentState={empresaId:7,gameId:'room-a',code:'SIDE-OLD',config:{cancelledAt:'2026-10-10'},status:{},runtime:{phase:'cancelled'}};
 const access=c.studentAccess();assert.equal(access.cancelled,undefined);assert.equal(access.canOperate,false);assert.match(access.reason,/Verificando/);
});
test('la sala nueva en espera sustituye la cancelación local y conserva cancelaciones reales del servidor',()=>{
 const c=state();c.localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({cancelledAt:'old',code:'SIDE-OLD'}));
 const partida={id:'room-b',codigo:'SIDE-NEW',estado:'esperando',serverTime:'2026-10-11T12:00:00Z',configuracion:{lifecycleVersion:2,gameStartAt:'2026-10-11T12:02:00Z',runtime:{round:1,phase:'integration',status:'waiting',running:false}}};
 c.applyStudentGameState(partida);assert.equal(c.studentAccess().cancelled,undefined);assert.equal(c.studentAccess().integration,true);assert.equal(c.studentAccess().remaining,120);
 c.applyStudentGameState({...partida,configuracion:{...partida.configuracion,cancelledAt:'2026-10-11T12:00:01Z',runtime:{phase:'cancelled'}}});assert.equal(c.studentAccess().cancelled,true);
});
test('una respuesta tardía de otra sala no sobrescribe estado ni reloj de la sala actual',()=>{
 const c=state();c.localStorage.setItem('SIDE_GAME_STATUS','preserved');
 assert.throws(()=>c.applyStudentGameState({id:'room-a',codigo:'SIDE-OLD',serverTime:'2026-10-10',configuracion:{cancelledAt:'old'}}),/otra sala/);
 assert.equal(c.localStorage.getItem('SIDE_GAME_STATUS'),'preserved');assert.equal(c.authoritativeStudentState,null);assert.equal(c.studentClock,null);
});
test('un enlace a otra sala abre ingreso sin recuperar la sesión cancelada anterior',async()=>{
 for(const [search,expected] of [['?partida=SIDE-NEW',0],['?partida=side-old',1],['',1]]){
  let resumes=0;const sessionStorage=store();sessionStorage.setItem('SIDE_STUDENT_SESSION',JSON.stringify({game:{id:'room-a',codigo:'SIDE-OLD'},company:'demo1',empresaId:7}));
  const c={sessionStorage,window:{location:{search}},URLSearchParams,admissionCode:value=>String(value||'').trim().toUpperCase(),studentSnapshotEpoch:0,currentStudent:{},studentConnected:false,loadDecisionState(){},resumeStudentSession:async()=>{resumes++;},startStudentSync(){}};
  vm.createContext(c);const start=source.indexOf('(async function restoreStudentSession(){'),end=source.indexOf('\n// Shared links',start);await vm.runInContext(source.slice(start,end).trim().replace(/;$/,''),c);
  assert.equal(resumes,expected);assert.equal(c.studentConnected,Boolean(expected));assert.equal(JSON.parse(sessionStorage.getItem('SIDE_STUDENT_SESSION')).game.codigo,'SIDE-OLD','el progreso anterior se conserva');
 }
});
test('abrir ingreso manual invalida una recuperación pendiente y conserva sesión y decisiones anteriores',async()=>{
 const c=state();c.sessionStorage=store();c.sessionStorage.setItem('SIDE_STUDENT_SESSION','saved-old-room');c.localStorage.setItem('SIDE_DECISIONS_SIDE-OLD_demo1','saved-decisions');
 c.studentSnapshotEpoch=4;c.studentSessionRecovering=true;c.studentStateFailure=null;c.autoEnterDecisions=true;c.stopStudentSync=()=>{};c.$=id=>['studentLobby','decisionMenu'].includes(id)?null:({classList:{add(){}}});c.message=()=>{};c.showModal=()=>{};c.showScreen=()=>{throw new Error('una recuperación vieja no debe cambiar la pantalla')};
 let complete;c.studentSyncPending=()=>false;c.cyclePlanSyncPending=()=>false;c.refreshStudentGame=()=>new Promise(resolve=>complete=resolve);c.prepareLobby=()=>{throw new Error('una recuperación vieja no debe abrir lobby')};
 vm.runInContext(block('function openStudentAdmission(','document.querySelectorAll(\'.profile-card\')')+block('function resumeStudentSession(){','(async function restoreStudentSession(){'),c);c.studentSessionRecoveryTask=null;
 const recovery=c.resumeStudentSession();c.openStudentAdmission();complete(true);assert.equal(await recovery,false);
 assert.equal(c.studentConnected,false);assert.equal(c.studentSnapshotEpoch,5);assert.equal(c.authoritativeStudentState,null);assert.equal(c.sessionStorage.getItem('SIDE_STUDENT_SESSION'),'saved-old-room');assert.equal(c.localStorage.getItem('SIDE_DECISIONS_SIDE-OLD_demo1'),'saved-decisions');
});

test('otra pestaña no cambia configuración, ciclo ni reloj de la sala confirmada del alumno',()=>{
 const c=state();const partida={id:'room-b',codigo:'SIDE-NEW',estado:'esperando',serverTime:'2026-10-11T12:00:00Z',configuracion:{lifecycleVersion:2,cycles:3,gameStartAt:'2026-10-11T12:02:00Z',runtime:{round:1,phase:'integration'}}};
 c.applyStudentGameState(partida);
 c.localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({cancelledAt:'cancelled-other',cycles:20}));c.localStorage.setItem('SIDE_ACTIVE_ROUND','9');c.localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({phase:'cancelled',round:9}));
 vm.runInContext(block('function scopedStudentState(){','function stableHash(')+block('function currentRound(){','function studentAccess(')+block('function readRoundRuntime(){','function syncStudentTimer(){'),c);
 assert.equal(c.teacherConfig().cancelledAt,undefined);assert.equal(c.teacherConfig().cycles,3);assert.equal(c.currentRound(),1);assert.equal(c.readRoundRuntime().phase,'integration');assert.equal(c.studentAccess().integration,true);
});
