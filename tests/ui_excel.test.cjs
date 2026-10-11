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
test('Editor conserva distritos y opciones base; no ofrece ni reactiva decisiones retiradas',()=>{
 const {api}=entorno(),d=decision(api);let saved;
 d.seleccion=['RH-10A','FIN-02B','INS-12C','INS-09A','INS-10A','INS-11A','INF-11C','COM-06C'];
 const status={textContent:''},container={innerHTML:'',querySelectorAll:()=>[],querySelector:selector=>selector==='[data-excel-status]'?status:null};
 api.mountEditor(container,{round:1,getState:()=>({habilitado:true,decisiones:d}),save:envelope=>{saved=envelope;}});
 assert.doesNotMatch(container.innerHTML,/data-excel-creditopct|Método de depreciación|Política de inventarios|Numero de proveedores|Politica de pago a proveedores|Lead time|Zona alta/);
 assert.match(container.innerHTML,/Cobertura comercial 180 días/);assert.match(container.innerHTML,/Mantenimiento preventivo opcional \(S\/ 200\.00\)/);
 assert.equal((container.innerHTML.match(/data-excel-marketing/g)||[]).length,1);assert.doesNotMatch(container.innerHTML,/data-excel-publicidad/);
 container.oninput({target:{dataset:{excelTienda:'los_olivos'},value:'3',matches:()=>false}});
 container.oninput({target:{dataset:{excelTienda:'miraflores'},value:'2',matches:()=>false}});
 container.oninput({target:{dataset:{},value:'120',matches:selector=>selector==='[data-excel-creditopct]'}});
 container.oninput({target:{dataset:{},value:'180',matches:selector=>selector==='[data-excel-garantia]'}});
 container.oninput({target:{dataset:{},checked:true,matches:selector=>selector==='[data-excel-mantenimiento]'}});
 const button={disabled:false,dataset:{},hasAttribute:attr=>attr==='data-excel-enviar'};
 container.onclick({target:{closest:()=>button}});
 assert.equal(saved.enviado,true);assert.deepEqual(JSON.parse(JSON.stringify(saved.decisiones.tiendasPorDistrito)),{los_olivos:3,miraflores:2,sjl:0});assert.equal(saved.decisiones.porcentajeVentasCredito,undefined);
 assert.equal(saved.planesPorCiclo[1].tiendasPorDistrito.los_olivos,3);assert.equal(saved.decisiones.garantiaDias,180);assert.equal(saved.decisiones.mantenimientoPreventivo,true);
 assert.deepEqual(Array.from(saved.decisiones.seleccion),['RH-10A']);
});

test('Marketing base alto pasa S/12000 al Excel sin doble cobro y analista conserva su negociación por ciclo',()=>{
 const {api}=entorno(),d=api.prepararDecisiones({...decision(api),marketingNivel:'alta',analistaCompras:true,garantiaProveedor:80});
 assert.equal(d.publicidad,12000);assert.equal(d.seleccion.filter(k=>k==='INV-02C').length,1);
 const reports=[{id:'A',partida:'MARKETING',capital:100000,excelDecisionState:{habilitado:true,round:1,enviado:true,decisiones:d}}];
 const r=api.cerrarLocal({game:'MARKETING',ciclo:1,reports}).resultadosPorEmpresa.A;
 assert.equal(r.costos.costoPublicidad,12000);assert.equal(r.costos.costoDecisionesRecurrentes,0);
 assert.equal(r.costos.costoAnalistaCompras,5000);assert.equal(r.costos.descuentoAnalistaPct,12);assert.equal(r.costos.factorDescuento,0.92*0.88);
 assert.equal(r.costos.reputacion.factorPublicidad,12);assert.equal(r.decisiones.garantiaProveedor,80);
});

test('Garantías 30/90 tienen mapeo exacto de puntaje y conservan costo base cero; mantenimiento opcional cobra S/200 una vez',()=>{
 const {api}=entorno(),base=decision(api);
 for(const [dias,codigo] of [[30,'COM-06B'],[90,'COM-06C'],[180,null]]){
  const d=api.prepararDecisiones({...base,garantiaDias:dias,mantenimientoPreventivo:true});
  assert.equal(d.seleccion.includes(codigo),!!codigo);
  const reports=[{id:'A',partida:'G'+dias,capital:100000,excelDecisionState:{habilitado:true,round:1,enviado:true,decisiones:d}}];
  const r=api.cerrarLocal({game:'G'+dias,ciclo:1,reports}).resultadosPorEmpresa.A;
  assert.equal(r.costos.costoGarantia,0);assert.equal(r.costos.costoPoliticaMantenimiento,200);assert.equal(r.costos.costoDecisionesRecurrentes,0);
 }
});
test('Activación en ciclo 2 no elimina retroactivamente una empresa durante cierre del ciclo 1',()=>{
 const {api}=entorno(),reports=[{id:'A',partida:'DEMO',capital:100000,excelDecisionState:{habilitado:true,cicloActivacion:2,round:2,enviado:true,decisiones:decision(api)}}];
 assert.equal(api.cerrarLocal({game:'DEMO',ciclo:1,reports}),null);assert.notEqual(reports[0].estado,'eliminada');
 const ciclo2=api.cerrarLocal({game:'DEMO',ciclo:2,reports});assert.equal(ciclo2.eliminadas.length,0);assert.ok(ciclo2.resultadosPorEmpresa.A);
});
