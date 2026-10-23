'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function load(){const c={};vm.createContext(c);for(const file of ['config_excel','catalogo_excel','puntajes','produccion','costos','consecuencias','mercado','ciclo','caja','ui_excel'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/engine',file+'.js'),'utf8'),c);return c;}
function editor(c,options={}){let saved;const state=options.getState||(()=>({}));const status={textContent:''},container={innerHTML:'',querySelectorAll:()=>[],querySelector:s=>s==='[data-excel-status]'?status:null};c.SIDE_EXCEL_UI.mountEditor(container,{round:1,motorVersion:'excel-16',getState:()=>({}),save:value=>saved=value,...options,getState:()=>({habilitado:true,...state()})});return {container,status,saved:()=>saved};}
test('Remote capability failure preserves editable autosaved draft and blocks confirmation',()=>{
 const c=load(),e=editor(c,{local:false,remoteReady:false});
 assert.doesNotMatch(e.container.innerHTML,/data-excel-prestamo[^>]*disabled/);
 assert.match(e.container.innerHTML,/data-excel-enviar[^>]*disabled/);
 assert.match(e.container.innerHTML,/Puedes editar y guardar tu borrador/);
 const input={type:'number',step:'0.01',max:'500',value:'900',dataset:{},matches:s=>s==='[data-excel-prestamo]'};
 e.container.oninput({target:input});assert.equal(e.saved().decisiones.montoPrestamo,500);assert.equal(e.saved().enviado,false);
 input.value='-7';e.container.oninput({target:input});assert.equal(e.saved().decisiones.montoPrestamo,0);
});
test('A mounted editor rejects input when the runtime becomes paused and resumes safely',()=>{
 const c=load();let active=true;const e=editor(c,{canSave:()=>active,lockReason:()=>active?'':'La partida está pausada.'});
 const input={type:'number',step:'1',max:'',value:'2',dataset:{activo:'mesa'},matches:()=>false};
 active=false;e.container.oninput({target:input});assert.equal(e.saved(),undefined);assert.match(e.status.textContent,/pausada/);
 active=true;e.container.oninput({target:input});assert.equal(e.saved().decisiones.maquinaria.mesa,2);
});
test('Plan projection reserves costs once, preserves owned assets, and matches a zero-sales close',()=>{
 const c=load(),api=c.SIDE_EXCEL_UI,version='excel-16',d=api.nuevasDecisiones();
 d.seleccion=['FIN-01A'];d.lotes=[];d.maquinaria={mesa:1,'INF-08':1};d.montoPrestamo=1000;d.marketingNivel='baja';d.comprasUnidades={'INS-01':2};
 const history={maquinariaActivos:{mesa:1},deudaPrincipal:2000,teaVigente:30,cajaFinal:100000};
 const before=JSON.stringify(history),projection=api.proyectarPlan(d,{cash:100000,historial:history,motorVersion:version});
 const overrides={},closed=c.SIDE_EXCEL_CICLO.cerrarCiclo({empresas:['A'],decisionesPorEmpresa:{A:api.prepararDecisiones(d)},historialPorEmpresa:{A:history}},overrides);
 const result=c.SIDE_EXCEL_CAJA.adjuntarCaja(closed,{historialAnterior:{A:history},overrides}).resultadosPorEmpresa.A;
 assert.ok(Math.abs(projection.cashAfter-result.financial.balanceCaja.cajaFinal)<1e-8);
 assert.equal(JSON.stringify(history),before);assert.ok(projection.cashAfter<100000);
 d.maquinaria['INF-08']=2;assert.ok(api.proyectarPlan(d,{cash:100000,historial:history,motorVersion:version}).cashAfter<projection.cashAfter);
});
test('Confirmation rejects unfunded plans but preserves desired quantities above capacity',()=>{
 const c=load(),api=c.SIDE_EXCEL_UI,d=api.nuevasDecisiones();
 d.maquinaria={mesa:1,'INF-08':1};d.personal={corte:[1,0,0],ensamble:[1,0,0],acabado:[1,0,0]};d.comprasUnidades={'INS-01':10,'INS-04':10,'INS-06':1};
 d.lotes=[{segmento:'SEG-01',molde:'INF-08',cuero:'INS-01',accesorios:'INS-04',hilo:'INS-06',cantidad:10,precio:100}];
 const button={disabled:false,dataset:{},hasAttribute:key=>key==='data-excel-enviar'};
 const confirm=e=>e.container.onclick({target:{closest:()=>button}});
 const poor=editor(c,{cash:1,getState:()=>({decisiones:d})});confirm(poor);assert.match(poor.status.textContent,/caja disponible/);assert.equal(poor.saved(),undefined);
 const large=JSON.parse(JSON.stringify(d));large.lotes[0].cantidad=100000;
 const over=editor(c,{cash:10000000,getState:()=>({decisiones:large})});confirm(over);assert.match(over.status.textContent,/capacidad o los materiales/);assert.equal(over.saved().enviado,true);assert.equal(over.saved().planesPorCiclo[1].lotes[0].cantidad,100000);
 const funded=editor(c,{cash:100000,getState:()=>({decisiones:d})});confirm(funded);assert.equal(funded.saved().enviado,true);
});


test('Material purchases preserve fractional conversions required by the Excel oracle',()=>{
 const c=load(),e=editor(c,{motorVersion:'excel-16'});
 assert.match(e.container.innerHTML,/step="any" data-compra=/);
 const converted=2000/c.SIDE_EXCEL_CONFIG.CONFIG.CONVERSION_COMPRA['INS-06'];
 const input={type:'number',step:'any',max:'',value:String(converted),dataset:{compra:'INS-06'},matches:()=>false};
 e.container.oninput({target:input});
 assert.equal(e.saved().decisiones.comprasUnidades['INS-06'],converted);
 input.value='-1';e.container.oninput({target:input});assert.equal(e.saved().decisiones.comprasUnidades['INS-06'],0);
});
