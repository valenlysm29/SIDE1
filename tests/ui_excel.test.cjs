'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function entorno(){
  const data=new Map(),context={localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v))}};
  vm.createContext(context);
  for(const file of ['config_excel','catalogo_excel','puntajes','produccion','costos','consecuencias','mercado','ciclo','caja','ui_excel'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/engine',file+'.js'),'utf8'),context);
  return {api:context.SIDE_EXCEL_UI,data};
}
function decision(api){const d=api.nuevasDecisiones();d.personal={corte:[1,0,0],ensamble:[1,0,0],acabado:[1,0,0]};d.comprasUnidades={'INS-01':100,'INS-04':100,'INS-06':4};d.lotes=[{segmento:'SEG-01',cantidad:100,molde:'INF-08',cuero:'INS-01',accesorios:'INS-04',hilo:'INS-06',precio:40}];return d;}
test('Cierre local por lotes es idempotente y no añade movimientos al ledger 3D',()=>{
  const {api,data}=entorno();data.set('SIDE_LEDGER_DEMO_A','{"venta":55}');
  const reports=[{id:'A',partida:'DEMO',empresa:'Empresa A',excelDecisionState:{habilitado:true,round:1,enviado:true,decisiones:decision(api)},estadoResultados:{}}];
  const uno=api.cerrarLocal({game:'DEMO',ciclo:1,reports}),historia=data.get(api.historiaKey('DEMO'));
  const dos=api.cerrarLocal({game:'DEMO',ciclo:1,reports});
  assert.equal(JSON.stringify(uno),JSON.stringify(dos));assert.equal(data.get(api.historiaKey('DEMO')),historia);
  assert.equal(reports[0].estadoResultados.excel.produccion.totalProducido,66);
  assert.equal(data.get('SIDE_LEDGER_DEMO_A'),'{"venta":55}');
  assert.equal(api.resultado('DEMO',1,'A').utilidad,reports[0].utilidad);
});
test('Empresa sin plan confirmado se elimina en ciclo 1; historial replica un ciclo posterior',()=>{
  const {api}=entorno(),d=decision(api);
  const reports=[{id:'A',partida:'DEMO',empresa:'Empresa A',excelDecisionState:{habilitado:true,round:1,enviado:true,decisiones:d}},
    {id:'B',partida:'DEMO',empresa:'Empresa B',excelDecisionState:{habilitado:true,round:1,enviado:false,decisiones:d}}];
  const uno=api.cerrarLocal({game:'DEMO',ciclo:1,reports});assert.deepEqual(Array.from(uno.eliminadas),['B']);assert.equal(reports[1].estado,'eliminada');
  const dos=api.cerrarLocal({game:'DEMO',ciclo:2,reports});assert.ok(dos.replicadas.includes('A'));assert.ok(!dos.resultadosPorEmpresa.B);
});
test('Validación acepta IFERROR de componentes o decisiones ausentes y exige plan con precio',()=>{
  const {api}=entorno(),d=decision(api);delete d.lotes[0].hilo;delete d.lotes[0].accesorios;
  assert.equal(api.validar(d),'');d.lotes[0].precio=0;assert.match(api.validar(d),/precio/);
});
test('Cierre local tardío conserva plan confirmado previo aunque editor ya avanzó de ciclo',()=>{
 const {api}=entorno(),original=decision(api),nuevo=decision(api);nuevo.lotes[0].cantidad=900;
 const reports=[{id:'A',partida:'DEMO',capital:100000,excelDecisionState:{habilitado:true,round:2,enviado:true,decisiones:nuevo,planesPorCiclo:{1:original}}}];
 const r=api.cerrarLocal({game:'DEMO',ciclo:1,reports});assert.equal(r.resultadosPorEmpresa.A.produccion.totalPlaneado,100);assert.equal(r.eliminadas.length,0);
});
