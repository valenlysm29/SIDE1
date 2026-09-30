'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const history=require('../teacher_history.js');
const catalogWindow={};
vm.runInNewContext(fs.readFileSync(path.join(root,'decision_catalog.js'),'utf8'),{window:catalogWindow});
const catalog=catalogWindow.SIDE_DECISION_CATALOG;

function service(client){
  const errors=[];
  const window={SIDE:{SupabaseClient:{get:()=>client}}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'services/teacher_history_service.js'),'utf8'),{
    window,console:{error:(...args)=>errors.push(args),warn:(...args)=>errors.push(args)}
  });
  return {api:window.SIDE.TeacherHistoryService,errors};
}

test('history service distinguishes no previous game and preserves every company, cycle and zero grade',async()=>{
  let data=null;const calls=[];
  const {api}=service({rpc:async(...args)=>{calls.push(args);return {data,error:null}}});
  assert.deepEqual(JSON.parse(JSON.stringify(await api.obtenerUltima())),{success:true,data:null});
  data={partida:{id:'one',codigo:'SIDE-123',ciclos_jugados:2,cantidad_empresas:2},empresas:[
    {id:1,nombre_comercial:'Andina',puntaje_docente:0,decisiones:[{ciclo:1,decision_id:'MESA_CORTE',categoria:'B',cantidad:2}],reportes:[{ciclo:1,caja_final:25000},{ciclo:2,caja_final:35000}]},
    {id:2,nombre_comercial:'Costa',puntaje_docente:null,decisiones:[],reportes:[{ciclo:1,caja_final:10000}]}
  ]};
  assert.equal((await api.obtenerUltima()).data,data);
  assert.equal(calls.length,2);
  assert.ok(calls.every(([name])=>name==='obtener_ultima_partida_docente'));
  assert.ok(calls.every(args=>args.length===1),'the client cannot request a different professor');
});

test('history service re-reads the last game rather than accumulating older games',async()=>{
  let data={partida:{id:'first'},empresas:[]};
  const {api}=service({rpc:async()=>({data,error:null})});
  assert.equal((await api.obtenerUltima()).data.partida.id,'first');
  data={partida:{id:'newest'},empresas:[]};
  const refreshed=await api.obtenerUltima();
  assert.equal(refreshed.data.partida.id,'newest');
  assert.equal(Array.isArray(refreshed.data),false);
});

test('missing RPC or table returns actionable configuration feedback without console spam',async()=>{
  for(const code of ['PGRST202','PGRST205','42P01','42883']){
    const {api,errors}=service({rpc:async()=>({data:null,error:{code,message:'does not exist'}})});
    for(let count=0;count<3;count++){
      const result=await api.obtenerUltima();
      assert.equal(result.success,false);assert.equal(result.unavailable,true);
      assert.equal(result.code,'HISTORIAL_NO_CONFIGURADO');
      assert.match(result.error,/docs\/supabase_teacher_history\.sql/);
    }
    assert.deepEqual(errors,[]);
  }
});

test('history service reports unavailable connection, rejected permission and RPC exceptions',async()=>{
  assert.equal((await service(null).api.obtenerUltima()).offline,true);
  for(const client of [
    {rpc:async()=>({error:{code:'42501',message:'permission denied'},data:null})},
    {rpc:async()=>({data:{success:false,code:'42501',error:'permission denied'},error:null})},
    {rpc:async()=>{throw new Error('connection lost')}}
  ]){
    const {api,errors}=service(client),result=await api.obtenerUltima();
    assert.equal(result.success,false);assert.equal(result.unavailable,undefined);
    assert.match(result.error,/permission denied|connection lost/);assert.deepEqual(errors,[]);
  }
});

test('history presentation uses catalog categories, labels and every recorded cycle',()=>{
  const company={nombre_comercial:'Andina',puntaje_docente:0,decisiones:[
    {ciclo:1,decision_id:'MESA_CORTE',opcion_id:'mesa',cantidad:2,costo_total:5000},
    {ciclo:2,decision_id:'PRODUCCION_META',cantidad:80,costo_total:0}
  ],reportes:[{ciclo:1,ingresos:20000,utilidad:3000,caja_final:25000,balance_caja:{balanceGeneral:{activos:40000}},estado_resultados:{ventasNetas:20000,utilidad:3000},indicadores:{rentabilidad:0.15}}]};
  assert.deepEqual(history.cycleNumbers(company,3),[1,2,3]);
  const groups=history.decisionGroups(company.decisiones,catalog);
  assert.equal(groups[0].title,'Infraestructura');assert.equal(groups[0].rows[0].name,'Mesas de corte');
  assert.equal(groups[0].rows[0].option,'Mesa de corte');assert.equal(groups[1].title,'Producción');
  const html=history.companyHtml(company,3,catalog);
  assert.match(html,/0 \/ 20/);assert.match(html,/Ciclo 3/);assert.match(html,/rentabilidad/);
  assert.match(html,/Balance general/);assert.match(html,/No se registraron resultados para este ciclo/);
  assert.doesNotMatch(html,/<input|<button|<form/,'historical grade and decisions cannot be edited');
});

test('history presentation handles empty games, company selection and escaped student values',()=>{
  assert.match(history.snapshotHtml(null),/Aún no hay una partida anterior registrada/);
  const snapshot={partida:{codigo:'SIDE-777',ciclos_jugados:2},empresas:[
    {id:1,nombre_comercial:'Andina',puntaje_docente:0,decisiones:[],reportes:[]},
    {id:2,nombre_comercial:'<img onerror="evil()">',nombre_legal:'Costa',decisiones:[],reportes:[]}
  ]};
  const html=history.snapshotHtml(snapshot,'2',catalog);
  assert.match(html,/value="2" selected/);assert.match(html,/&lt;img onerror=/);
  assert.doesNotMatch(html,/<img onerror=/);assert.match(html,/Sin calificar/);
  assert.match(history.snapshotHtml({partida:{},empresas:[]}),/no tiene empresas participantes/);
  const fallback=history.companyHtml({nombre_comercial:'Costa',decisiones:[],reportes:[{
    ciclo:1,decisiones:[null,42,false,{decision_nombre:'Mesas de corte: <script>evil()</script>'},{decision_id:'PRECIO'},'Producción deseada: 80 unidades']
  }]},1,catalog);
  assert.match(fallback,/Decisión registrada/,'null, numbers and booleans have a safe fallback');
  assert.match(fallback,/Infraestructura/);assert.match(fallback,/Producción/);
  assert.match(fallback,/&lt;script&gt;evil\(\)&lt;\/script&gt;/);
  assert.doesNotMatch(fallback,/<script>|\[object Object\]/);
});

test('history controller discards obsolete responses and clears previous data on unavailable schema',async()=>{
  const mount={innerHTML:'',attrs:{},setAttribute(key,value){this.attrs[key]=value},addEventListener(){}};
  const status={textContent:''},refresh={disabled:false,addEventListener(){}};
  const pending=[];
  const controller=history.createController({mount,status,refresh,service:{obtenerUltima:()=>new Promise(resolve=>pending.push(resolve))}});
  const old=controller.load(),latest=controller.load();
  pending[1]({success:true,data:{partida:{codigo:'SIDE-NEW'},empresas:[]}});await latest;
  pending[0]({success:true,data:{partida:{codigo:'SIDE-OLD'},empresas:[]}});await old;
  assert.match(mount.innerHTML,/SIDE-NEW/);assert.doesNotMatch(mount.innerHTML,/SIDE-OLD/);
  const missing=controller.load();pending[2]({success:false,unavailable:true});await missing;
  assert.equal(mount.innerHTML,'');assert.match(status.textContent,/SQL/);
  assert.equal(refresh.disabled,false);assert.equal(mount.attrs['aria-busy'],'false');
  const staleFailure=controller.load(),newest=controller.load();
  pending[3]({success:false,unavailable:true});await staleFailure;
  assert.match(status.textContent,/Cargando/,'an outdated failure cannot override a newer pending request');
  assert.equal(refresh.disabled,true);assert.equal(mount.attrs['aria-busy'],'true');
  pending[4]({success:true,data:null});await newest;
  assert.match(mount.innerHTML,/Aún no hay una partida anterior registrada/);
  assert.doesNotMatch(status.textContent,/SQL/);assert.equal(refresh.disabled,false);
});
