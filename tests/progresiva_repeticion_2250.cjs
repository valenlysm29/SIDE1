'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),F=require('./progresiva_fixture.cjs'),worker=require('../services/business_runtime.cjs');
const out=path.resolve(__dirname,'output/progresiva'),read=name=>JSON.parse(fs.readFileSync(path.join(out,name),'utf8')),plan=F.plan(F.targets('combinado',750),'ineficiente');
if(process.argv[2]==='plan')fs.writeFileSync(path.join(out,'repeticion2250-plan.json'),JSON.stringify(plan));
else (async()=>{
 const m=read('repeticion2250.json'),history=read('repeticion2250-oficial.json'),actual=history.cycles.find(r=>r.ciclo===1).result,id=String(m.company.id),edge=await import('../supabase/functions/side-business-close/runtime.mjs');
 async function run(engine){let seal;const rpc=async(name,args)=>{
  if(name==='side_cierres_pendientes')return {data:[{id:m.game.id,cycles:[1]}]};
  if(name==='side_contexto_cierre_negocio')return {data:{empresas:[{id,capital:F.capital,snapshot:{decisions_submitted:true,decision_state:{__cyclePlans:{1:{state:plan}}}}}],financialConfig:m.game.configuracion,token:'replay'}};
  if(name==='side_event_context_v1')return {data:{companyId:id,round:1,events:[]}};
  if(name==='side_guardar_cierre_negocio'){seal=JSON.parse(JSON.stringify(args.p_cierre));return {data:{cierre:seal}}}
  throw Error(name);
 };const result=await engine(rpc);assert.ok(result[0].success);return seal;}
 const node=await run(worker.runOnce),deployed=await run(edge.runOnce);assert.deepEqual(node,deployed);
 const expected=node.resultadosPorEmpresa[id];
 for(const key of ['estadoResultados','balanceCaja','flujoCaja','balanceGeneral'])assert.deepEqual(actual.financial[key],expected.financial[key]);
 for(const key of ['production','sales','inventory'])assert.deepEqual(actual.receipt[key],expected.receipt[key]);
 F.validate(actual,{state:plan,round:1});assert.equal(actual.receipt.produced,2250);assert.ok(actual.financial.estadoResultados.utilidadNeta<0);
 const row=F.summarize('repeticion2250',actual,'ineficiente','combinado',750,{entorno:'Supabase + Edge real',partida:m.game.codigo,ciclos:3,ciclo:1,empresa:m.company.id,conciliacion:'Node = PostgreSQL = Edge',repeticion:'Repite 750 unidades de cada molde; no reemplaza el cierre original de C5.'});
 fs.writeFileSync(path.join(out,'matriz-repeticion.json'),JSON.stringify([row],null,2));console.log('RERUN',JSON.stringify({partida:m.game.codigo,producido:row.producido,vendido:row.vendido,utilidad:row.utilidad,caja:row.caja}));
})().catch(e=>{console.error(e);process.exitCode=1});
