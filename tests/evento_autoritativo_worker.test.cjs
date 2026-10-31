'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {runOnce}=require('../services/business_runtime.cjs');
const fixture=require('./economic_v19_fixture.cjs');
function snapshot(marketing=true){
 const s=fixture.state(1,{},0);
 if(marketing)s.INV_MARKETING={round:1,value:1000};
 for(const [key,id] of [['MESA_CORTE','mesa'],['ENSAMBLE','ens_ind'],['ACABADOS','aca_ind'],['PERS_CORTE','corte_maestro'],['PERS_ENSAMBLE','ens_personal_esp'],['PERS_ACABADO','aca_personal_art']]) {s[key].quantities={[id]:10};if(s[key].purchases)s[key].purchases={1:{[id]:10}};}
 s.CUERO.quantities={cuero_prem:900};s.ACCESORIOS.quantities={acc_prem:3000};s.HILO.quantities={hilo_prem:18000};s.PRODUCCION_META.moldTargets={molde_1:3000,molde_2:0,molde_3:0};
 return {decision_state:{__cyclePlans:{1:{state:s}}}};
}
async function close(eventFor='',eventId='PE69',intensity=20,marketing=true){
 let posted;
 const rpc=async(name,args)=>{
  if(name==='side_cierres_pendientes')return {data:[{id:'g',cycles:[1]}]};
  if(name==='side_contexto_cierre_negocio')return {data:{empresas:['1','2','3'].map(id=>({id,capital:1000000,snapshot:snapshot(marketing)})),financialConfig:{cycles:6,economicEventsVersion:'demand-share-v1'},token:'t'}};
  if(name==='side_event_context_v1')return {data:{companyId:String(args.p_empresa_id),round:1,events:String(args.p_empresa_id)===eventFor?(Array.isArray(eventId)?eventId.map(([id,intensity])=>({id,round:1,intensity})):[{id:eventId,round:1,intensity}]):[]}};
  if(name==='side_guardar_cierre_negocio'){posted=args.p_cierre;return {data:{cierre:posted}};}
  throw Error(name);
 };
 const results=await runOnce(rpc);assert.equal(results[0].success,true,JSON.stringify(results));return posted.resultadosPorEmpresa;
}
test('evento verificado redistribuye un mercado fijo entre tres empresas y respeta stock',async()=>{
 const base=await close(), event=await close('1');
 const row=(data,id)=>data[id].receipt.sales.find(s=>s.id==='esencial');
 assert.ok(row(event,'1').sold>row(base,'1').sold);
 const allocation=(data,id)=>data[id].receipt.marketAllocation.products.esencial.asignado;
 assert.ok(allocation(event,'1')>allocation(base,'1'));
 assert.equal(['1','2','3'].reduce((sum,id)=>sum+allocation(event,id),0),['1','2','3'].reduce((sum,id)=>sum+allocation(base,id),0));
 for(const id of ['1','2','3'])assert.ok(row(event,id).sold<=row(event,id).available);
 assert.equal(event['1'].receipt.events[0].id,'PE69');assert.deepEqual(event['2'].receipt.events,[]);
});

test('dos sorteos independientes afectan mercado y gasto sin duplicar unidades',async()=>{
 const base=await close(),event=await close('1',[['PE69',20],['PE68',1]]);
 assert.ok(event['1'].receipt.marketAllocation.products.esencial.asignado>base['1'].receipt.marketAllocation.products.esencial.asignado);
 assert.equal(event['1'].financial.flujoCaja.eventos,-1200);
 assert.deepEqual(event['1'].receipt.events.map(e=>e.id),['PE69','PE68']);
 for(const c of ['1','2','3'])for(const sale of event[c].receipt.sales)assert.ok(sale.sold<=sale.available);
});

for(const [id,intensity,direction] of [['PE71',15,1],['PE74',12,1],['PE75',6,-1]])test(`${id} cambia el atractivo y conserva la demanda y el stock`,async()=>{
 const base=await close(),event=await close('1',id,intensity);
 const allocation=(r,company)=>r[company].receipt.marketAllocation.products.esencial.asignado;
 assert.ok(direction*(allocation(event,'1')-allocation(base,'1'))>0);
 assert.equal(['1','2','3'].reduce((sum,c)=>sum+allocation(event,c),0),['1','2','3'].reduce((sum,c)=>sum+allocation(base,c),0));
 for(const c of ['1','2','3'])for(const sale of event[c].receipt.sales)assert.ok(sale.sold<=sale.available);
 assert.equal(event['1'].receipt.events[0].id,id);
});
test('PE74 no altera el mercado ni figura aplicado si no existe campaña financiada',async()=>{
 const base=await close('','PE69',20,false),event=await close('1','PE74',12,false);
 assert.equal(event['1'].receipt.marketAllocation.products.esencial.asignado,base['1'].receipt.marketAllocation.products.esencial.asignado);
 assert.deepEqual(event['1'].receipt.events,[]);
});

test('una programación de servidor inválida no llega al cierre',async()=>{
 let posted=false;
 const rpc=async(name,args)=>{
  if(name==='side_cierres_pendientes')return {data:[{id:'g',cycles:[1]}]};
  if(name==='side_contexto_cierre_negocio')return {data:{empresas:[{id:'1',capital:1000000,snapshot:snapshot()}],financialConfig:{cycles:6,economicEventsVersion:'demand-share-v1'},token:'t'}};
  if(name==='side_event_context_v1')return {data:{companyId:'1',round:1,events:[{id:'PE69',round:1,intensity:900}]}};
  if(name==='side_guardar_cierre_negocio'){posted=true;return {data:{}};}
  throw Error(name);
 };
 const result=await runOnce(rpc);assert.equal(result[0].code,'EVENTOS_NO_VERIFICADOS');assert.equal(posted,false);
});

test('el cierre rechaza duplicados incluso si el contexto proviene del servidor',async()=>{
 let posted=false;
 const rpc=async(name)=>{
  if(name==='side_cierres_pendientes')return {data:[{id:'g',cycles:[1]}]};
  if(name==='side_contexto_cierre_negocio')return {data:{empresas:[{id:'1',capital:1000000,snapshot:snapshot()}],financialConfig:{cycles:6,economicEventsVersion:'demand-share-v1'},token:'t'}};
  if(name==='side_event_context_v1')return {data:{companyId:'1',round:1,events:[{id:'PE69',round:1,intensity:20},{id:'PE69',round:1,intensity:20}]}};
  if(name==='side_guardar_cierre_negocio'){posted=true;return {data:{}};}throw Error(name);
 };
 const result=await runOnce(rpc);assert.equal(result[0].code,'EVENTOS_NO_VERIFICADOS');assert.equal(posted,false);
});

test('Node y Edge aplican la misma asignación autoritativa',async()=>{
 const edge=await import(require('node:url').pathToFileURL(require('node:path').resolve('supabase/functions/side-business-close/runtime.mjs')).href);
 async function run(worker,eventId,intensity){
  let posted;const rpc=async(name,args)=>{
   if(name==='side_cierres_pendientes')return {data:[{id:'g',cycles:[1]}]};
   if(name==='side_contexto_cierre_negocio')return {data:{empresas:['1','2','3'].map(id=>({id,capital:1000000,snapshot:snapshot()})),financialConfig:{cycles:6,economicEventsVersion:'demand-share-v1'},token:'t'}};
   if(name==='side_event_context_v1')return {data:{companyId:String(args.p_empresa_id),round:1,events:String(args.p_empresa_id)==='1'?(Array.isArray(eventId)?eventId.map(([id,intensity])=>({id,round:1,intensity})):[{id:eventId,round:1,intensity}]):[]}};
   if(name==='side_guardar_cierre_negocio'){posted=args.p_cierre;return {data:{cierre:posted}};}
   throw Error(name);
  };const r=await worker(rpc);assert.equal(r[0].success,true);return posted;
 }
 for(const [eventId,intensity] of [['PE23',1],['PE30',25],['PE68',1],['PE69',20],['PE71',15],['PE74',12],['PE75',6],['PE77',1]])assert.deepEqual(await run(edge.runOnce,eventId,intensity),await run(runOnce,eventId,intensity));
 assert.deepEqual(await run(edge.runOnce,[['PE68',1],['PE69',20]]),await run(runOnce,[['PE68',1],['PE69',20]]));
});
