'use strict';
// Deterministic in-memory exploration, not an authoritative budget admission test.
const E=require('../js/engine/cierre.js'),C=require('../js/cycle_model.js'),F=require('./economic_v19_fixture.cjs');
const fs=require('node:fs');
const limit=Math.max(1,Number(process.argv[2])||3000),products=['esencial','urbano','premium'];
const targets=[50,100,250,500,1000],leather=['cuero_sint','cuero_std','cuero_prem'],thread=['hilo_std','hilo_ref','hilo_prem'];
const worker=[['corte_basico','ens_personal_basico','aca_personal_basico'],['corte_exp','ens_personal_ind','aca_personal_tec'],['corte_maestro','ens_personal_esp','aca_personal_art'],['corte_basico','ens_personal_ind','aca_personal_art']];
const equipment=[['ens_basica','aca_basica'],['ens_semi','aca_semi'],['ens_ind','aca_ind']];
const summary={generated:0,closed:0,errors:{},rows:[],totals:{legacy:{},proposed:{}}};
function add(version,product,r){const d=summary.totals[version][product]??={count:0,profitable:0,negativeCash:0,net:0};d.count++;d.profitable+=r.net>0;d.negativeCash+=r.cash<0;d.net+=r.net;}
for(let i=0;i<limit;i++){
 let x=i;const type=x%3;x=Math.floor(x/3);const target=targets[x%5];x=Math.floor(x/5);const mat=x%3;x=Math.floor(x/3);const labor=x%4;x=Math.floor(x/4);const machine=x%3;x=Math.floor(x/3);const countMode=x%2;x=Math.floor(x/2);const leader=x%2;x=Math.floor(x/2);const channel=x%2;
 const count=Math.max(1,Math.ceil(target/(countMode?240:150))),s=F.state(1,{},type),ids=['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO'];
 ids.forEach((id,j)=>{s[id]={round:1,quantities:{[worker[labor][j]]:count},optionIds:[worker[labor][j]]};});
 for(const [id,option] of [['MESA_CORTE','mesa'],['ENSAMBLE',equipment[machine][0]],['ACABADOS',equipment[machine][1]]])s[id]={round:1,quantities:{[option]:count},purchases:{1:{[option]:count}}};
 const recipe=[[.3,1,6],[.4,1,7],[.7,1,13]][type];
 for(const [id,sku,q] of [['CUERO',leather[mat],recipe[0]*target],['ACCESORIOS',mat===0?'acc_eco':'acc_prem',target],['HILO',thread[mat],recipe[2]*target]])s[id]={round:1,quantities:{[sku]:q}};
 s.PRODUCCION_META={round:1,moldTargets:{['molde_'+(type+1)]:target}};s.JEFATURA={round:1,optionIds:[leader?'si_jefatura':'no_jefatura']};s.CANALES={round:1,optionIds:[channel?'sjl':'web']};
 const priceCase=Math.floor(i/3)%3,prices={esencial:[42.5,95,120][priceCase],urbano:[100,150,180][priceCase],premium:[250,280,350][priceCase]},capital=[50000,100000,200000][Math.floor(i/15)%3];
 const base={state:s,catalog:F.catalog,round:1,capital,prices};summary.generated++;
 try{
  const outputs={};for(const [name,policy] of [['legacy',{}],['proposed',{economicRulesVersion:'utility-v1'}]]){
   const r=C.close({...base,state:structuredClone(s),financialPolicy:{cycles:6,...policy}}),a=r.financial.estadoResultados,b=r.financial.balanceGeneral;
   outputs[name]={net:a.utilidadNeta,sales:a.ventasTotales,cost:a.costoVentas,operating:a.gastosOperacion,cash:b.efectivo,inventoryMP:b.inventarioMP,inventoryPT:b.inventarioPT,produced:r.receipt.produced,sold:r.receipt.sold,demand:r.receipt.sales[type].demand};add(name,products[type],outputs[name]);
  }
  summary.closed++;if(summary.rows.length<12||(!summary.rows.some(r=>r.product===products[type]&&r.proposed.net>0)&&outputs.proposed.net>0))summary.rows.push({i,product:products[type],target,material:mat,labor,machine,count,leader,channel,capital,prices,...outputs});
 }catch(e){summary.errors[e.message]=(summary.errors[e.message]||0)+1;}
}
fs.mkdirSync('tests/output',{recursive:true});fs.writeFileSync('tests/output/matriz_utilidad_experimental.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify({generated:summary.generated,closed:summary.closed,totals:summary.totals,errors:summary.errors,examples:summary.rows},null,2));
