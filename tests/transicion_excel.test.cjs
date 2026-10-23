'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {adjuntarCaja,sembrarTransicion}=require('../js/engine/caja.js'),{cerrarCiclo}=require('../js/engine/ciclo.js'),{decision}=require('./escenarios_excel.cjs');
test('Transición importa activos y deuda pagados en flujo previo sin duplicar compra ni financiación',()=>{
 const source=fs.readFileSync(require.resolve('../js/app.js'),'utf8'),start=source.indexOf('function captureExcelTransition(){'),end=source.indexOf('\nfunction renderDecisionRow',start);
 const definitions={MESA_CORTE:{id:'MESA_CORTE',options:[]},ENSAMBLE:{id:'ENSAMBLE',options:[{id:'ens_basica',codigoExcel:'INF-02',cost:3500}]},ACABADOS:{id:'ACABADOS',options:[]},MOLDE:{id:'MOLDE',options:[]}};
 const state={ENSAMBLE:{purchases:{1:{ens_basica:1}}},__inventarioMP:{'INS-01':12}};
 const context={decisionState:state,currentRound:()=>2,findDecisionItem:id=>definitions[id],savedEntry:item=>state[item.id],initialCapital:()=>100000,financialAdjustment:()=>0,financialLedger:()=>({}),ledgerTotal:()=>1500,recordedFinancialSections:()=>({}),DECISION_CATALOG:[],cashLedger:{'1:B':-3500,'1:PRESTAMO':5000},teacherConfig:()=>({interest:20}),window:{SIDE_FINANCIAL_MODEL:{calculate:()=>({balanceGeneral:{deuda:5000}})},SIDE_EXCEL_CONFIG:require('../js/engine/config_excel.js')}};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);const transicion=JSON.parse(JSON.stringify(context.captureExcelTransition()));
 assert.deepEqual(transicion.maquinariaActivos,{'INF-02':1});assert.equal(transicion.activosCosto,3500);assert.equal(transicion.cajaFinal,101500);assert.equal(transicion.deudaPrincipal,5000);assert.equal(transicion.inventarioMP['INS-01'],12);
 const h=sembrarTransicion({},[{id:'A',envelope:{transicion}}]),d=decision({maquinaria:{'INF-02':1},compras:{},seleccion:['FIN-01A'],montoPrestamo:0});
 const cierre=adjuntarCaja(cerrarCiclo({empresas:['A'],decisionesPorEmpresa:{A:d},historialPorEmpresa:h}),{historialAnterior:h,capitalPorEmpresa:{A:100000}}),r=cierre.resultadosPorEmpresa.A;
 assert.equal(r.financial.flujoCaja.compraActivos,0);assert.equal(r.financial.flujoCaja.financiamiento,0);assert.equal(r.financial.balanceCaja.cajaInicial,101500);assert.equal(r.financial.balanceGeneral.deuda,5000);assert.equal(r.financial.balanceGeneral.activosFijos,3500-r.costos.depreciacion);
 assert.deepEqual(sembrarTransicion({A:{cajaFinal:42}},[{id:'A',envelope:{transicion}}]),{A:{cajaFinal:42}},'La transición no puede sustituir un historial establecido');
});
test('Activación se bloquea si el ciclo actual ya tiene movimiento monetario legacy',async()=>{
 const source=fs.readFileSync(require.resolve('../js/app.js'),'utf8'),start=source.indexOf('async function mountExcelProductionEditor(){'),end=source.indexOf('\nfunction captureExcelTransition',start);
 let mounted;
 const container={id:'',isConnected:true},context={usesCanonicalMotor:()=>false,initialCapital:()=>100000,financialAdjustment:()=>0,cashBalance:()=>96500,studentAccess:()=>({canOperate:true}),teacherConfig:()=>({}),creditAvailable:()=>70000,document:{createElement:()=>container,querySelector:()=>null},$:()=>({prepend(){}}),currentStudent:{empresaId:null},decisionState:{},cashLedger:{'1:B':-3500},currentRound:()=>1,cycleDecisionsLocked:()=>false,excelGameCode:()=> 'DEMO',excelCompanyId:()=> 'A',captureExcelTransition:()=>({cajaFinal:96500,maquinariaActivos:{'INF-02':1}}),importExcelPersonnel:()=>({}),window:{SIDE_EXCEL_UI:{historial:()=>({}),mountEditor:(_,ctx)=>{mounted=ctx;}}}};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);await context.mountExcelProductionEditor();assert.equal(mounted.activationBlocked,true);
 context.currentRound=()=>2;await context.mountExcelProductionEditor();assert.equal(mounted.activationBlocked,false);assert.equal(mounted.historial.maquinariaActivos['INF-02'],1);
});
