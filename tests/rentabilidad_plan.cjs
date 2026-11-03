'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
function plan({round,cycles,previous=null,scenario='transition'}){
 const sequence=cycles===3?[0,1,2]:[0,0,1,1,2,2],goals=cycles===3?[430,430,140]:[150,150,200,200,150,150];
 const segment=scenario==='analyst-benefit'?1:sequence[round-1],target=scenario==='scale-1000'||scenario==='analyst-benefit'?1000:scenario==='inefficient'?30:goals[round-1];
 const pairs=scenario==='scale-1000'||scenario==='analyst-benefit'?7:scenario==='inefficient'?4:cycles===3?3:round<=2?1:2;
 const old=previous?.state||previous?.decision_state||{},s={};
 for(const [id,opt] of [['MESA_CORTE','mesa'],['ENSAMBLE','ens_basica'],['ACABADOS','aca_basica']]){
  const purchases=clone(old[id]?.purchases||{}),owned=Object.values(purchases).reduce((sum,row)=>sum+Number(row[opt]||0),0),quantity=Math.max(0,pairs-owned);purchases[round]={[opt]:quantity};s[id]={round,purchases,quantities:{[opt]:quantity}};
 }
 for(const [id,opt] of [['PERS_CORTE','corte_basico'],['PERS_ENSAMBLE','ens_personal_basico'],['PERS_ACABADO','aca_personal_basico']])s[id]={round,quantities:{[opt]:pairs},previousQuantities:clone(old[id]?.quantities||{})};
 const mold='molde_'+(segment+1),purchases=clone(old.MOLDE?.purchases||{}),owned=Object.values(purchases).some(row=>Number(row[mold])>0);purchases[round]=owned?{}:{[mold]:1};s.MOLDE={round,optionIds:owned?[]:[mold],purchases};
 const premium=segment===2||scenario==='analyst-benefit',stock=previous?.receipt?.inventory||old.__inventarioMP||{},recipe=[[.3,1,6],[.4,1,7],[.7,1,13]][segment];
 for(const [i,id,sku] of [[0,'CUERO',premium?'cuero_prem':segment===1?'cuero_std':'cuero_sint'],[1,'ACCESORIOS',premium?'acc_prem':'acc_eco'],[2,'HILO',premium?'hilo_prem':'hilo_std']])s[id]={round,quantities:{[sku]:Math.max(0,Math.round((target*recipe[i]-Number(stock[sku]||0))*10000)/10000)}};
 s.PRODUCCION_META={round,moldTargets:{molde_1:0,molde_2:0,molde_3:0,[mold]:target},value:target};
 for(const [id,opt] of [['JEFATURA','no_jefatura'],['LIMPIEZA','limpieza'],['LOCAL_PROD','local_std'],['GARANTIA_PT','pt_30'],['INV_RRHH','cap_no'],['GARANTIA_PROV','gar_0']])s[id]={round,optionIds:[opt]};
 s.CANALES={round,optionIds:['web']};s.INV_MARKETING={round,optionIds:scenario==='inefficient'?['mkt_alta']:[]};s.MANTENIMIENTO={round,optionIds:[]};s.ANALISTA_COMPRAS={round,optionIds:['analyst-benefit','inefficient'].includes(scenario)?['si_analista']:['no_analista']};s.PRESTAMO={round,amount:0};
 return s;
}
module.exports={plan};
if(require.main===module){let text='';process.stdin.setEncoding('utf8');process.stdin.on('data',x=>text+=x);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(plan(JSON.parse(text)))));}
