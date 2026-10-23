'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function load(){
 const c={};vm.createContext(c);
 for(const file of ['config_excel','catalogo_excel','puntajes','produccion','costos','consecuencias','mercado','ciclo','caja','ui_excel']){
  const source=file==='ui_excel'&&process.env.SIDE_DOP_UI_SOURCE?process.env.SIDE_DOP_UI_SOURCE:path.join(__dirname,'../js/engine',file+'.js');
  vm.runInContext(fs.readFileSync(source,'utf8'),c);
 }
 return c;
}
function mount(c,d,options={}){
 let saved;const status={textContent:''},container={innerHTML:'',querySelectorAll:()=>[],querySelector:selector=>selector==='[data-excel-status]'?status:null};
 c.SIDE_EXCEL_UI.mountEditor(container,{round:1,cash:1000000,getState:()=>({habilitado:true,decisiones:d}),save:value=>saved=value,...options});
 const button={disabled:false,dataset:{},hasAttribute:key=>key==='data-excel-enviar'};
 return {confirm:()=>container.onclick({target:{closest:()=>button}}),status,saved:()=>saved};
}
function plan(c){
 const d=c.SIDE_EXCEL_UI.nuevasDecisiones();
 d.personal={corte:[1,1,1],ensamble:[[0,0,1],[1,0,0],[0,1,0]],acabado:[[0,1,0],0,1]};
 d.seleccion=['RH-10A'];d.maquinaria={mesa:1,'INF-02':1,'INF-03':1,'INF-04':1,'INF-05':1,'INF-06':1,'INF-08':1};
 d.comprasUnidades={'INS-01':1000,'INS-04':1000,'INS-06':20};
 d.lotes=[{segmento:'SEG-01',molde:'INF-08',cuero:'INS-01',accesorios:'INS-04',hilo:'INS-06',cantidad:520,precio:40}];
 return d;
}
test('desired quantity above Excel capacity is confirmed intact and executed with existing limits',()=>{
 const c=load(),d=plan(c),editor=mount(c,d);editor.confirm();
 assert.equal(editor.saved()?.enviado,true,'The input quantity must not be rejected merely because resources limit execution');
 assert.equal(editor.saved().decisiones.lotes[0].cantidad,520);assert.equal(editor.saved().planesPorCiclo[1].lotes[0].cantidad,520);
 assert.match(editor.status.textContent,/producción real se limitará/);
 const result=c.SIDE_EXCEL_CICLO.prepararEmpresa(editor.saved().decisiones);
 assert.equal(result.produccion.produccionCapacidad,396);assert.equal(result.produccion.totalPlaneado,520);
 assert.ok(result.produccion.totalProducido<=396);assert.ok(result.consecuencias.mensajes.some(row=>row.id==='CONS-06'));
});
test('material shortage warns and preserves the target while the engine never consumes missing stock',()=>{
 const c=load(),d=plan(c);d.lotes[0].cantidad=10;d.comprasUnidades={};
 const editor=mount(c,d);editor.confirm();assert.equal(editor.saved()?.enviado,true);assert.match(editor.status.textContent,/materiales disponibles/);
 assert.equal(editor.saved().decisiones.lotes[0].cantidad,10);
 const result=c.SIDE_EXCEL_CICLO.prepararEmpresa(editor.saved().decisiones);
 assert.equal(result.produccion.totalProducido,0);assert.ok(Object.values(result.produccion.consumoPorInsumo).every(value=>value===0));
});
test('cash, disconnection, pause and required fields still prevent confirmation',()=>{
 const c=load();
 for(const [options,pattern] of [[{cash:1},/caja disponible/],[{local:false,remoteReady:false},/conexión/],[{canSave:()=>false},/pausa/]]){
  const editor=mount(c,plan(c),options);editor.confirm();assert.equal(editor.saved(),undefined);assert.match(editor.status.textContent,pattern);
 }
 const invalid=plan(c);invalid.lotes[0].precio=0;const editor=mount(c,invalid);editor.confirm();assert.equal(editor.saved(),undefined);assert.match(editor.status.textContent,/precio/);
});
