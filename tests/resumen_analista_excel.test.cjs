'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {decision}=require('./escenarios_excel.cjs'),{prepararEmpresa}=require('../js/engine/ciclo.js');
test('Resumen del ciclo 2 usa el descuento vigente del analista, igual que la proyección y el cierre',()=>{
  const d=decision({analistaCompras:true}),mount={innerHTML:'',querySelector:()=>null};let recibido;
  const context={window:{SIDE_REVIEW_MODEL:{},addEventListener(){},SIDE_EXCEL_CICLO:{prepararEmpresa},SIDE_EXCEL_UI:{historial(){return{}},resumenHtml(r){recibido=r;return 'Resumen';}}},
    $:id=>id==='companySummaryMount'?mount:null,decisionState:{__excel:{habilitado:true,decisiones:d}},currentRound:()=>2,
    excelSavedResult:()=>null,excelGameCode:()=> 'PRUEBA',excelCompanyId:()=> 'A',financialReport:()=>({balanceCaja:{cajaFinal:100000}})};
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/company_summary.js'),'utf8'),context);
  vm.runInContext('renderCompanySummary()',context);
  assert.ok(recibido,'el resumen ejecuta la proyección real');assert.equal(recibido.costos.descuentoAnalistaPct,10);
  assert.equal(recibido.costos.costoMP,prepararEmpresa({...d,ciclo:2}).costos.costoMP);
  assert.notEqual(recibido.costos.costoMP,prepararEmpresa({...d,ciclo:1}).costos.costoMP);
});

test('Resumen canónico aplica la misma versión y alquiler de tiendas que el editor',()=>{
  const engine=require('../js/engine/config_excel.js');
  const d=decision({seleccion:['COM-01C'],tiendasPorDistrito:{los_olivos:1,miraflores:0,sjl:0}}),mount={innerHTML:'',querySelector:()=>null};let recibido;
  const context={window:{SIDE_REVIEW_MODEL:{},SIDE_EXCEL_CONFIG:engine,addEventListener(){},SIDE_EXCEL_CICLO:{prepararEmpresa},SIDE_EXCEL_UI:{historial:()=>({}),resumenHtml:r=>{recibido=r;return 'Resumen';}}},
    teacherConfig:()=>({motor_version:engine.MOTOR_ACTUAL}),$:id=>id==='companySummaryMount'?mount:null,decisionState:{__excel:{habilitado:true,decisiones:d}},currentRound:()=>1,
    excelSavedResult:()=>null,excelGameCode:()=> 'PRUEBA',excelCompanyId:()=> 'A',financialReport:()=>({balanceCaja:{cajaFinal:100000}})};
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/company_summary.js'),'utf8'),context);vm.runInContext('renderCompanySummary()',context);
  assert.ok(recibido);const expected=prepararEmpresa({...d,ciclo:1},{},engine.paraMotor(engine.MOTOR_ACTUAL));
  assert.equal(recibido.costos.costosEstimados,expected.costos.costosEstimados);
  assert.ok(recibido.costos.detallesRecurrentes.some(row=>row.costo===1800));
});
