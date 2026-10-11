'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');process.chdir(root);
const {database,createGame,rpc}=require('../tests/lifecycle_db_fixture.cjs');
const {createQueue}=require('../services/student_sync');
const model=require('../js/decision_review_model'),rules=require('../js/side_rules');
const sandbox={window:{},optionUnitCost:(_item,opt)=>Number(opt.cost)||0};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root,'js/decision_catalog.js'),'utf8'),sandbox);
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
vm.runInContext(app.slice(app.indexOf('function buildSupabaseDecision('),app.indexOf('function persistCurrentDraftOnly(')),sandbox);
const catalog=JSON.parse(JSON.stringify(sandbox.window.SIDE_DECISION_CATALOG));
const item=id=>catalog.flatMap(c=>c.items).find(i=>i.id===id);
const build=(id,state,round=1)=>JSON.parse(JSON.stringify(sandbox.buildSupabaseDecision(item(id),state,round)));
const result={checkedAt:new Date().toISOString(),scope:'Local PGlite and actual delivered mapping/outbox; no remote mutations',findings:{}};
(async()=>{
 const db=await database();
 try{
  const game=await createGame(db),identity={p_codigo:game.codigo,p_nombre_legal:'Revision Local SAC',p_nombre_comercial:'Revision Local'};
  const company=await rpc(db,'ingresar_empresa',identity);
  await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'iniciar',p_config:null,p_expected_round:null});
  const save=async(round,decisions,revision=0)=>rpc(db,'guardar_decisiones_estudiante',{...identity,p_ciclo:round,p_decisiones:decisions,p_expected_revision:revision});
  const maintenance=build('MANTENIMIENTO',{optionIds:['correctivo'],cost:200});
  assert.equal((await save(1,[maintenance])).success,true);
  const cleared=build('MANTENIMIENTO',{optionIds:[],cost:0});assert.equal(cleared,null);
  const other=build('LOCAL_PROD',{optionIds:['local_std'],cost:2000});
  assert.equal((await save(1,[other])).success,true);
  const stale=(await db.query('select cantidad,costo_total from empresas_decisiones ed join decisiones_catalogo dc on dc.id=ed.decision_id where ed.empresa_id=$1 and dc.decision_id=$2',[company.empresa_id,'MANTENIMIENTO'])).rows;
  assert.equal(stale.length,1);
  result.findings.clearedOptionalDecision={localSelection:[],mapped:cleared,remainingDatabaseRows:stale};
  const context={catalog,state:{},drafts:{ANALISTA_COMPRAS:{optionIds:['si_analista']},CUERO:{quantities:{cuero_std:100}}},round:1,config:{},rules,capital:100000,ledger:{}};
  const material=model.breakdown(item('CUERO'),context);
  const materialMapped=build('CUERO',{quantities:{cuero_std:100},cost:material.outflow});
  const saleContext={...context,round:2,state:{ENSAMBLE:{purchases:{1:{ens_basica:1}}}},drafts:{ENSAMBLE:{quantities:{ens_basica:-1}}}};
  const sale=model.breakdown(item('ENSAMBLE'),saleContext);
  const saleMapped=build('ENSAMBLE',{purchases:{2:{ens_basica:-1}},cost:-sale.assetIncome},2);
  assert.equal(material.outflow,3960);assert.equal(materialMapped.costo_total,4500);
  assert.equal(sale.assetIncome,1400);assert.equal(saleMapped.costo_total,-3500);
  result.findings.normalizedCosts={material:{actualOutflow:material.outflow,normalizedCost:materialMapped.costo_total},sale:{actualIncome:sale.assetIncome,normalizedCost:saleMapped.costo_total}};
  let online=false,revision=0;
  const storageValues=new Map(),calls=[],storage={getItem:k=>storageValues.get(k)||null,setItem:(k,v)=>storageValues.set(k,v)};
  const queue=createQueue({storage,context:()=>({connected:true,identityKey:'review-company',identity,revision,epoch:1}),
   saveSnapshot:async(_identity,snapshot,expected)=>{calls.push({kind:'snapshot',round:snapshot.round});if(!online)return {success:false,technical:true,error:'Injected network failure'};const response=await rpc(db,'guardar_estado_estudiante',{...identity,p_snapshot:snapshot,p_expected_revision:expected});return response.success?{success:true,data:response}:{success:false,code:response.code,error:response.error};},
   saveOperation:async(_identity,round,operation,expected)=>{const response=await save(round,operation.payload,expected);calls.push({kind:'decisions',round,response});return response.success?{success:true,data:response}:{success:false,code:response.code,error:response.error};},
   onRevision:value=>{revision=value;}
  });
  await queue.enqueue({round:1,decision_state:{MANTENIMIENTO:{optionIds:['correctivo']}}},{key:'decisions:B',type:'decisions',payload:[maintenance]});
  await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'avanzar',p_config:null,p_expected_round:1});
  online=true;
  assert.equal(await queue.flush(),false);
  const next=await queue.enqueue({round:2,decision_state:{MANTENIMIENTO:{optionIds:[]}}},{key:'decisions:B',type:'decisions',payload:[other]});
  assert.equal(next,false);assert.equal(queue.pending(),true);
  assert.equal(calls.some(call=>call.round===2),false);
  result.findings.previousCycleBlocksQueue={currentRound:2,calls,pendingJobs:JSON.parse(storageValues.get('SIDE_STUDENT_SYNC_OUTBOX'))};
 }finally{await db.close();}
 const out=path.join(root,'tests/output/revision-2026-10-05');fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'reproductions.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
