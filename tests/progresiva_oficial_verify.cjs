'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),F=require('./progresiva_fixture.cjs'),worker=require('../services/business_runtime.cjs');
const out=path.resolve(__dirname,'output/progresiva'),json=file=>JSON.parse(fs.readFileSync(path.join(out,file),'utf8')),plain=x=>JSON.parse(JSON.stringify(x));
async function main(){
 const edge=await import('../supabase/functions/side-business-close/runtime.mjs'),summary=[];
 for(const cycles of [3,6]){
  const m=json('partida-'+cycles+'.json');
  for(let round=1;round<=cycles;round++){
   const file=cycles+'-historia-'+round+'.json';if(!fs.existsSync(path.join(out,file)))continue;
   const h=json(file),rows=h.cycles.filter(x=>x.ciclo===round&&x.status==='confirmed');
   assert.equal(rows.length,12);const actual=Object.fromEntries(rows.map(x=>[String(x.empresa_id),x.result]));
   const prior=round>1?Object.fromEntries(h.cycles.filter(x=>x.ciclo===round-1&&x.status==='confirmed').map(x=>[String(x.empresa_id),x.result])):{};
   const plans=json(cycles+'-planes-'+round+'.json');
   // A timed-out QA submission is an explicit negative lifecycle case. Replay
   // the actually confirmed input; retain the intended target as evidence.
   const omitted=cycles===6&&round===5?'234':null;
   if(omitted){assert.equal(actual[omitted].receipt.production.target,0);plans[omitted]=actual[omitted].receipt.decisions;}
   const config={...m.game.configuracion,economicEventsVersion:'demand-share-v1'};
   async function run(engine){
    let written;const rpc=async(name,args)=>{
     if(name==='side_cierres_pendientes')return {data:[{id:m.game.id,cycles:[round]}]};
     if(name==='side_contexto_cierre_negocio'){
      if(Number(args.p_ciclo)===round-1)return {data:{cierre:{ciclo:round-1,resultadosPorEmpresa:prior}}};
      return {data:{empresas:m.companies.map(c=>({id:String(c.id),capital:F.capital,snapshot:{decisions_submitted:true,decision_state:{__cyclePlans:{[round]:{state:plans[String(c.id)]}}}}})),financialConfig:config,token:'replay'}};
     }
     if(name==='side_event_context_v1')return {data:{companyId:String(args.p_empresa_id),round,events:(actual[String(args.p_empresa_id)].receipt.events||[]).map(e=>({id:e.id,round:e.round,intensity:e.intensity}))}};
     if(name==='side_guardar_cierre_negocio'){written=plain(args.p_cierre);return {data:{cierre:written}}}
     throw Error(name);
    };
    const result=await engine(rpc);assert.ok(result[0]?.success,JSON.stringify(result));return written;
   }
   const local=await run(worker.runOnce),remote=await run(edge.runOnce);assert.deepEqual(remote,local,'Node/Edge '+cycles+'/'+round);
   for(const company of m.companies){
    const id=String(company.id),r=actual[id],p=prior[id],expected=local.resultadosPorEmpresa[id];
    for(const key of ['estadoResultados','balanceCaja','flujoCaja','balanceGeneral'])assert.deepEqual(r.financial[key],expected.financial[key],cycles+'/'+round+'/'+id+'/'+key);
    assert.deepEqual(r.receipt.production,expected.receipt.production);
    assert.deepEqual(r.receipt.sales,expected.receipt.sales);assert.deepEqual(r.receipt.inventory,expected.receipt.inventory);
    F.validate(r,{state:plans[id],round},p);
    if(round>1){
     const old=json(cycles+'-historia-'+(round-1)+'.json');
     const before=old.cycles.filter(x=>x.ciclo<round&&x.status==='confirmed'),after=h.cycles.filter(x=>x.ciclo<round&&x.status==='confirmed');
     assert.deepEqual(after,before,'Sellos anteriores inmutables');
     const assets=['MESA_CORTE','ENSAMBLE','ACABADOS','MOLDE'];
     for(const key of assets)for(const [cycle,quantities]of Object.entries(p.state[key].purchases||{}))assert.deepEqual(r.state[key].purchases[cycle],quantities,'Compras anteriores intactas');
    }
    const q=(cycles===6?F.quantities:[100,500,1000])[round-1];
    const row=F.summarize(company.key+'-c'+round,r,company.strategy,company.kind,q,{entorno:'Supabase + Edge real',partida:m.game.codigo,ciclos:cycles,ciclo:round,empresa:company.id,eventos:r.receipt.events,metaPorMolde:r.receipt.production.targets,conciliacion:'Node = PostgreSQL = Edge',...(id===omitted?{incidencia:'Plan QA de 2250 unidades no confirmado antes de vencer el ciclo; cierre oficial con meta 0, sin sobrescribirlo.'}:{})});
    summary.push(row);
   }
   console.log('PARITY OFFICIAL',cycles,round,rows.length);
  }
 }
 fs.writeFileSync(path.join(out,'matriz-oficial.json'),JSON.stringify(summary,null,2));
 console.log('OFFICIAL TOTAL',summary.length);
}
main().catch(e=>{console.error(e);process.exitCode=1});
