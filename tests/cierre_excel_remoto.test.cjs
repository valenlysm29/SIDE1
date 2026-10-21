'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {decision}=require('./escenarios_excel.cjs');
function entorno(mock){const store=new Map(),context={SIDE:{SupabaseClient:{get:()=>mock}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}};context.window=context;vm.createContext(context);
 for(const f of ['config_excel','catalogo_excel','puntajes','produccion','costos','consecuencias','mercado','ciclo','caja','ui_excel'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/engine',f+'.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../services/partida_service.js'),'utf8'),context);return context;}
test('Cierre remoto mock y local usan exactamente motor y caja comunes; retry no duplica',async()=>{
 let saved=null,calls=0;const d=decision({seleccion:['FIN-01A'],montoPrestamo:5000}),envelope={habilitado:true,round:1,enviado:true,decisiones:d,cajaTransicion:98000};
 const mock={rpc:async(name,args)=>{if(name==='side_contexto_cierre_excel')return {data:saved?{cierre:saved}:{empresas:[{id:'1',capital:100000,revision:3,envelope}],historialPorEmpresa:{},token:'cas-3'}};if(name==='side_guardar_cierre_excel'){calls++;assert.equal(args.p_token,'cas-3');saved=args.p_cierre;return {data:{cierre:saved,reused:false}};}throw Error('RPC inesperada '+name);}};
 const ctx=entorno(mock),reports=[{id:'1',partida:'TEST',capital:100000,excelDecisionState:envelope}];
 const local=ctx.SIDE_EXCEL_UI.cerrarLocal({game:'TEST',ciclo:1,reports}),remote=await ctx.SIDE.PartidaService.cerrarExcel('partida-test',1);
 assert.equal(remote.success,true);assert.deepEqual(JSON.parse(JSON.stringify(remote.data)),JSON.parse(JSON.stringify(local)));
 assert.equal((await ctx.SIDE.PartidaService.cerrarExcel('partida-test',1)).reused,true);assert.equal(calls,1);
 assert.equal(reports[0].caja,remote.data.resultadosPorEmpresa['1'].financial.balanceCaja.cajaFinal);
});
test('CAS rechazado y migración faltante devuelven error sin cierre local ni avance',async()=>{
 const ctx=entorno({rpc:async name=>name==='side_contexto_cierre_excel'?{data:{empresas:[{id:'1',capital:100000,envelope:{round:1,enviado:true,decisiones:decision()}}],historialPorEmpresa:{},token:'x'}}:{data:{error:'Snapshot cambió',code:'ESTADO_DESACTUALIZADO'}}});
 const failed=await ctx.SIDE.PartidaService.cerrarExcel('test',1);assert.equal(failed.success,false);assert.equal(failed.code,'ESTADO_DESACTUALIZADO');
 const missing=entorno({rpc:async()=>({error:{code:'PGRST202',message:'No existe función'}})});
 const absent=await missing.SIDE.PartidaService.cerrarExcel('test',1);assert.equal(absent.success,false);assert.equal(absent.migrationMissing,true);
});
test('Cierre tardío usa plan confirmado del ciclo histórico y parámetros profesor',async()=>{
 let persisted;const old=decision(),now=decision({lotes:[{...old.lotes[0],cantidad:900}]});const ctx=entorno({rpc:async name=>name==='side_contexto_cierre_excel'?{data:{empresas:[{id:'1',capital:100000,envelope:{round:2,enviado:true,decisiones:now,planesPorCiclo:{1:old}}}],historialPorEmpresa:{},token:'x',overrides:{DIAS_CICLO:30}}}:{data:{cierre:persisted}}});
 ctx.SIDE.SupabaseClient.get=()=>({rpc:async(name,args)=>{if(name==='side_contexto_cierre_excel')return {data:{empresas:[{id:'1',capital:100000,envelope:{round:2,enviado:true,decisiones:now,planesPorCiclo:{1:old}}}],historialPorEmpresa:{},token:'x',overrides:{DIAS_CICLO:30}}};persisted=args.p_cierre;return {data:{cierre:persisted}};}});
 const r=await ctx.SIDE.PartidaService.cerrarExcel('test',1);assert.equal(r.data.resultadosPorEmpresa['1'].produccion.totalPlaneado,200);assert.equal(r.data.resultadosPorEmpresa['1'].produccion.capacidadCiclo,150);
});
test('Tres ciclos remoto mock igualan cierre local y recuperan historial monetario del servidor',async()=>{
 let current=1,history={},envelope,stored={};const ctx=entorno({rpc:async(name,args)=>{
   if(name==='side_contexto_cierre_excel')return {data:stored[args.p_ciclo]?{cierre:stored[args.p_ciclo]}:{empresas:[{id:'1',capital:100000,envelope}],historialPorEmpresa:history,token:'revision-'+current}};
   stored[args.p_ciclo]=JSON.parse(JSON.stringify(args.p_cierre));history=stored[args.p_ciclo].historialPorEmpresa;return {data:{cierre:stored[args.p_ciclo]}};
 }});
 const reports=[{id:'1',partida:'DEMO',capital:100000}];
 for(current=1;current<=3;current++){
   const d=decision({seleccion:['FIN-01A'],montoPrestamo:current===1?5000:0});envelope={habilitado:true,round:current,enviado:true,decisiones:d};reports[0].excelDecisionState=envelope;
   const local=ctx.SIDE_EXCEL_UI.cerrarLocal({game:'DEMO',ciclo:current,reports});
   const remote=await ctx.SIDE.PartidaService.cerrarExcel('partida-test',current);assert.equal(remote.success,true);
   assert.deepEqual(JSON.parse(JSON.stringify(remote.data)),JSON.parse(JSON.stringify(local)));
   // El siguiente contexto se hidrata desde la respuesta persistida, sin usar ledger.
   assert.equal(history['1'].cajaFinal,reports[0].caja);assert.equal(history['1'].deudaPrincipal,5000);
 }
 assert.ok(history['1'].tasaMensualVigente>0);assert.equal(Object.keys(stored).length,3);
});
test('Feature check ausente desactiva solo editor remoto, RPC legacy sigue disponible',async()=>{
 const names=[];const ctx=entorno({rpc:async name=>{names.push(name);return name==='side_excel_features'?{error:{code:'PGRST202',message:'No migration'}}:{data:{configuracion:{runtime:{round:1}}}};}});
 const feature=await ctx.SIDE.PartidaService.excelDisponible();assert.equal(feature.available,false);assert.equal(feature.migrationMissing,true);
 assert.equal((await ctx.SIDE.PartidaService.controlar('demo','cerrar',null,1)).success,true);assert.deepEqual(names,['side_excel_features','controlar_partida']);
});

test('motor nuevo rechaza contexto antiguo antes de cobrar o guardar',async()=>{
 let saved=false;const ctx=entorno({rpc:async name=>{
  if(name==='side_contexto_cierre_excel')return {data:{empresas:[{id:'1',capital:100000,envelope:{}}],historialPorEmpresa:{},token:'old'}};
  saved=true;return {data:{}};
 }});
 const result=await ctx.SIDE.PartidaService.cerrarExcel('demo',1,{VERSION:ctx.SIDE_EXCEL_CONFIG.MOTOR_ACTUAL});
 assert.equal(result.code,'MIGRACION_PENDIENTE');assert.equal(saved,false);
});
