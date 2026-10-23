'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const REVENUE=require('../js/revenue_model.js'),CYCLE=require('../js/cycle_model.js');
const productIds=['esencial','urbano','premium'];
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
// Literal source values checked in DECISIONES SIDE (17).xlsx, Costos!C118:J147.
const prices=[[40,45,43,41],[120,150,190,200],[250,300,220,400]];
const expected=[[1292,285,772,1151],[1067,955,819,659],[174,194,236,195]];
function tableInputs(){return [7,8.3,10.2,9].map((rep,i)=>({id:String(i),round:1,prices:Object.fromEntries(productIds.map((id,j)=>[id,prices[j][i]])),state:{CANALES:{optionIds:['web']},
  PERS_CORTE:{round:1,quantities:{corte_maestro:i===2?87:rep*10,corte_basico:i===2?13:100-rep*10}},
  ...(i===2?{INV_MARKETING:{round:1,optionIds:['mkt_baja']}}:{})
},production:{productLines:productIds.map(()=>({target:5000,plannedUnits:0})),materials:[]}}));}
test('current revenue adapter reproduces all twelve Excel market allocations',()=>{
  const inputs=tableInputs(),allocations=REVENUE.allocate(inputs);
  inputs.forEach((input,i)=>{
    near(REVENUE.profile(input).reputacionMercado,[7,8.3,10.2,9][i]);
    productIds.forEach((id,j)=>assert.equal(allocations[input.id].products[id].asignado,expected[j][i]));
  });
});
test('operational reputation maps actual staff, material consumption, premium output and publicity',()=>{
  const profile=REVENUE.profile({id:'A',round:2,state:{
    PERS_CORTE:{round:2,quantities:{corte_maestro:1,corte_basico:1}},
    CUERO:{round:2,quantities:{cuero_sint:10,cuero_prem:30}},
    ACCESORIOS:{round:2,quantities:{acc_eco:10,acc_prem:10}},
    HILO:{round:2,quantities:{hilo_std:100,hilo_ref:20,hilo_prem:20}},
    INV_MARKETING:{optionIds:['mkt_media']}
  },production:{productLines:[{plannedUnits:60},{plannedUnits:20},{plannedUnits:20}],materials:[
    {id:'CUERO',consumption:40},{id:'ACCESORIOS',consumption:20},{id:'HILO',consumption:140}
  ]}});
  near(profile.reputation.factorProduccion,2);near(profile.reputation.factorMO,5);
  near(profile.reputation.factorMP,(.75+.5+.5)/3*10);near(profile.reputation.factorPublicidad,6);
});
test('shared closure competes across companies, caps sales at stock and reconciles POS once',()=>{
  const inputs=[40,45,43,41].map((price,i)=>({id:String(i),round:1,capital:100000,prices:{esencial:price},
    state:{CANALES:{optionIds:['web']},PERS_CORTE:{round:1,quantities:{corte_maestro:[70,83,87,90][i],corte_basico:[30,17,13,10][i]}},...(i===2?{INV_MARKETING:{optionIds:['mkt_baja']}}:{})},
    production:{producibleUnits:2000,productLines:[{target:2000,plannedUnits:2000}],materials:[]},ledger:{'1:SIM_VENTAS':999999,'1:C':-2000},soldUnits:500,soldByProduct:{esencial:500}}));
  const results=CYCLE.closeMany(inputs);
  for(const [i,input] of inputs.entries()){
    const r=results[input.id];assert.equal(r.receipt.sold,Math.max(500,expected[0][i]));
    assert.equal(r.receipt.revenue,Math.max(500,expected[0][i])*prices[0][i]);
    assert.equal(r.ledger['1:SIM_VENTAS'],r.receipt.revenue);
    assert.equal(r.ledger['1:C'],-2000);assert.equal(r.state.__finishedGoods.esencial,2000-r.receipt.sold);
    assert.equal(r.financial.balanceCaja.cajaFinal,98000+r.receipt.revenue+r.ledger['1:COMISION_VENTAS']);
    assert.equal(CYCLE.close({...input,state:r.state,ledger:r.ledger}).reused,true);
  }
  const short=CYCLE.close({state:{CANALES:{optionIds:['web']}},round:1,production:{producibleUnits:12,productLines:[{plannedUnits:12}],materials:[]},prices:{esencial:40}});
  assert.equal(short.receipt.sold,12);assert.equal(short.receipt.revenue,480);
});
test('unsold goods carry forward; web and store counts no longer impose invented demand',()=>{
  for(const optionIds of [[],['web'],['los_olivos','miraflores','sjl']]){
    const r=CYCLE.close({round:2,state:{CANALES:{optionIds},__finishedGoods:{esencial:10}},production:{producibleUnits:1000,productLines:[{plannedUnits:1000}],materials:[]},prices:{esencial:40}});
    assert.equal(r.receipt.sold,optionIds.length?1010:0);assert.equal(r.receipt.revenue,optionIds.length?40400:0);assert.equal(r.state.__finishedGoods.esencial,optionIds.length?0:1010);
  }
});
test('browser pages load the same revenue dependencies as Node',()=>{
  for(const page of ['index.html','docente.html']){
    const html=fs.readFileSync(require('node:path').join(__dirname,'..',page),'utf8'),context={};context.globalThis=context;vm.createContext(context);
    for(const name of ['engine/config_excel','engine/mercado','engine/costos','revenue_model']){
      assert.ok(html.indexOf(`js/${name}.js`)<html.indexOf('js/cycle_model.js'));
      vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../js',name+'.js'),'utf8'),context);
    }
    const actual=context.SIDE_REVENUE_MODEL.allocate(tableInputs());
    assert.deepEqual(JSON.parse(JSON.stringify(actual)),REVENUE.allocate(tableInputs()));
  }
});
test('remote service settles the entire population together and preserves prices and expenses',async()=>{
  const inputs=tableInputs().map(input=>({...input,production:{producibleUnits:2000,productLines:[{plannedUnits:2000,target:2000}],materials:[]}}));
  const companies=inputs.map(input=>({id:input.id,capital:100000,snapshot:{decision_state:{...input.state,__cyclePlans:{1:{state:input.state,production:input.production}},__cycleBusiness:{1:{prices:input.prices}}},cash_ledger:{'1:C':-1000}}}));
  let payload;
  const window={SIDE_CYCLE_MODEL:CYCLE,SIDE_FINANCIAL_MODEL:require('../js/financial_model.js'),SIDE_DECISION_CATALOG:[],SIDE:{SupabaseClient:{get:()=>({rpc:async(name,args)=>{
    if(name==='side_contexto_cierre_negocio')return {data:{empresas:companies,token:'test',financialConfig:{}}};
    assert.equal(name,'side_guardar_cierre_negocio');payload=args.p_cierre;return {data:{cierre:payload}};
  }})}}};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../services/partida_service.js'),'utf8'),{window,console,setTimeout,clearTimeout});
  const response=await window.SIDE.PartidaService.cerrarNegocio('game',1);
  assert.equal(response.success,true,JSON.stringify(response));
  inputs.forEach((input,i)=>{
    const result=payload.resultadosPorEmpresa[input.id];
    assert.equal(result.receipt.sold,expected[0][i]);assert.equal(result.financial.estadoResultados.ingresos,expected[0][i]*prices[0][i]);
    assert.equal(result.ledger['1:C'],-1000);
  });
});
test('connected students cannot allocate the whole shared market to themselves',()=>{
  const source=fs.readFileSync(require('node:path').join(__dirname,'../js/app.js'),'utf8');
  const fn=source.slice(source.indexOf('function settleCycle('),source.indexOf('\nfunction syncStudentReportPreview('));
  const ctx={window:{SIDE_CYCLE_MODEL:CYCLE},decisionState:{},currentStudent:{empresaId:'A'},currentRound:()=>1};
  vm.createContext(ctx);vm.runInContext(fn,ctx);assert.equal(ctx.settleCycle(1),false);
});
