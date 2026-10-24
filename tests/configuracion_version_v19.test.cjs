'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('configuration conflict retains form version despite newer polling state',async()=>{
 const source=fs.readFileSync(require.resolve('../js/docente.js'),'utf8'),calls=[],feedback=[];
 const context={state:{partidaId:'G',configRevision:4,formConfigRevision:3,authoritative:{}},gameStatus:()=>({active:true}),runtime:()=>({}),getConfig:()=>({eventRules:{local:true}}),creationFeedback:(...args)=>feedback.push(args),toast(){},applyTeacherState(){throw Error('conflict must not apply state');},window:{SIDE:{PartidaService:{actualizarConfiguracion:async(...args)=>{calls.push(args);return {success:false,code:'CONFIG_DESACTUALIZADA',error:'Otra sesión cambió la configuración'};}}}}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('let publishedState='),source.indexOf('\nlet companiesPoll=')),context);
 assert.equal(await context.publishGameState(),false);assert.equal(calls[0][2],3);assert.equal(context.state.formConfigRevision,3);assert.equal(context.state.configRevision,4);assert.equal(feedback.length,1);
});
test('explicit version uses CAS; two-argument legacy call remains compatible',async()=>{
 const calls=[],window={SIDE:{SupabaseClient:{get:()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:{config_revision:1,configuracion:{}},error:null};}})}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../services/partida_service.js'),'utf8'),{window,console,setTimeout,clearTimeout});
 assert.equal((await window.SIDE.PartidaService.actualizarConfiguracion('G',{lifecycleVersion:2},0)).success,true);
 assert.equal(calls[0].name,'side_guardar_configuracion_v19');assert.equal(calls[0].args.p_expected_revision,0);
 await window.SIDE.PartidaService.actualizarConfiguracion('G',{lifecycleVersion:2});assert.equal(calls[1].name,'controlar_partida');
});
test('two queued own saves rebase only the revision acknowledged by the first save',async()=>{
 const source=fs.readFileSync(require.resolve('../js/docente.js'),'utf8'),calls=[];
 const context={state:{partidaId:'G',configRevision:0,formConfigRevision:0,authoritative:{}},gameStatus:()=>({active:true}),runtime:()=>({}),creationFeedback(){throw Error('false conflict');},toast(){},applyTeacherState(data){context.state.configRevision=data.config_revision;},window:{SIDE:{PartidaService:{actualizarConfiguracion:async(_id,config,expected)=>{calls.push(expected);return {success:true,data:{config_revision:expected+1,configuracion:config}};}}}}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('let publishedState='),source.indexOf('\nlet companiesPoll=')),context);
 const first=context.publishGameState({eventRules:{a:1}}),second=context.publishGameState({eventRules:{a:2}});
 assert.deepEqual(await Promise.all([first,second]),[true,true]);assert.deepEqual(calls,[0,1]);
});
