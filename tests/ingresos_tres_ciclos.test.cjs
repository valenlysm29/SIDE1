'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const C=require('../js/engine/config_excel.js'),CICLO=require('../js/engine/ciclo.js');
const {decision}=require('./escenarios_excel.cjs');
const overrides={},plain=v=>JSON.parse(JSON.stringify(v));
const cerca=(a,b)=>assert.ok(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function plan(){return decision({seleccion:['INF-02','INF-05','INF-08','RH-01','RH-04','RH-07','RH-10B','COM-01B','FIN-01B'],marketingNivel:null,compras:{},comprasUnidades:{'INS-01':25,'INS-04':80,'INS-06':2},lotes:[{segmento:'SEG-01',cantidad:100,cuero:'INS-01',accesorios:'INS-04',hilo:'INS-06',molde:'INF-08',precio:40}]});}
function entorno(mock){const store=new Map(),ctx={SIDE:{SupabaseClient:{get:()=>mock}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}};ctx.window=ctx;vm.createContext(ctx);
 for(const name of ['config_excel','catalogo_excel','puntajes','produccion','costos','consecuencias','mercado','ciclo','caja','ui_excel'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/engine',name+'.js'),'utf8'),ctx);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'fixtures/previous_model_partida_service.js'),'utf8'),ctx);return ctx;}

test('Diagnóstico ingresos: un plan factible vende; faltar recursos produce cero sin inventar stock',()=>{
 const d=plan(),close=dec=>CICLO.cerrarCiclo({empresas:['A'],decisionesPorEmpresa:{A:dec}},overrides).resultadosPorEmpresa.A;
 assert.ok(close(d).ingresos>0);
 // El motor Excel restaurado toma la capacidad de la matriz de personal;
 // no exige una compra de maquinaria como condición adicional para producir.
 const sinCompraMaquinaria=close({...d,maquinaria:{}});
 assert.equal(sinCompraMaquinaria.produccion.totalProducido,close(d).produccion.totalProducido);
 assert.ok(sinCompraMaquinaria.ingresos>0);
 for(const patch of [{personal:{}},...['corte','ensamble','acabado'].map(area=>({personal:{...d.personal,[area]:[]}})),{comprasUnidades:{}},{comprasUnidades:{...d.comprasUnidades,'INS-04':0}},{lotes:[]}]){
  const r=close({...d,...patch});assert.equal(r.produccion.totalProducido,0);assert.equal(r.ingresos,0);
 }
});

test('Modo actual: tres ciclos local/remoto, caja, utilidad, inventario, puntajes e idempotencia',async()=>{
 let round=1,history={},envelope,saves=0;const stored={};
 const ctx=entorno({rpc:async(name,args)=>{
  if(name==='side_contexto_cierre_excel')return {data:stored[args.p_ciclo]?{cierre:stored[args.p_ciclo]}:{motor_version:'excel-16',empresas:[{id:'A',capital:100000,envelope}],historialPorEmpresa:history,token:'revision-'+round}};
  assert.equal(name,'side_guardar_cierre_excel');assert.equal(args.p_token,'revision-'+round);saves++;stored[round]=plain(args.p_cierre);history=stored[round].historialPorEmpresa;return {data:{cierre:stored[round]}};
 }}),reports=[{id:'A',partida:'INGRESOS-3',capital:100000}],rows=[];
 for(round=1;round<=3;round++){
  envelope={habilitado:true,motor_version:'excel-16',round,enviado:true,decisiones:plan()};reports[0].excelDecisionState=envelope;
  const prior=plain(history),local=ctx.SIDE_EXCEL_UI.cerrarLocal({game:'INGRESOS-3',ciclo:round,reports,motorVersion:'excel-16'});
  const remote=await ctx.SIDE.PartidaService.cerrarExcel('partida-demo',round,overrides);assert.equal(remote.success,true);assert.deepEqual(plain(remote.data),plain(local));
  const r=remote.data.resultadosPorEmpresa.A,f=r.financial,bc=f.balanceCaja,fc=f.flujoCaja,er=f.estadoResultados;
  assert.ok(r.ingresos>0);cerca(r.ingresos,r.ventas.reduce((s,v)=>s+v.vendido*v.precioEfectivo,0));
  cerca(bc.cajaInicial,round===1?100000:prior.A.cajaFinal);cerca(bc.cajaFinal,bc.cajaInicial+bc.entradas-bc.salidas);
  cerca(bc.cajaFinal,bc.cajaInicial+r.ingresos+fc.financiamiento-fc.pagosOperacion-fc.compraActivos);
  cerca(er.utilidad,r.ingresos-r.costosTotales-er.intereses);cerca(er.utilidad,er.ingresos-er.costos);
  if(round>1)assert.equal(fc.compraActivos,0,'los activos conservados no vuelven a comprarse');
  const legacy=CICLO.prepararEmpresa({...plan(),ciclo:round},prior.A||{});
  assert.deepEqual(plain(r.puntajes),plain(legacy.puntajes),'puntajes compartidos con motor Excel');
  assert.deepEqual(plain(r.produccion),plain(legacy.produccion),'producción compartida con motor Excel');
  for(const [code,amount] of Object.entries(r.produccion.inventarioFinal))cerca(amount+r.produccion.consumoPorInsumo[code],r.produccion.disponibleInicial[code]);
  assert.equal(history.A.financialHistory.length,round);assert.ok(history.A.financialHistory.every(h=>!h.history));
  assert.equal((await ctx.SIDE.PartidaService.cerrarExcel('partida-demo',round,overrides)).reused,true);assert.equal(saves,round);
  rows.push({ciclo:round,planeado:r.produccion.totalPlaneado,producido:r.produccion.totalProducido,vendido:r.unidadesVendidas,ingresos:r.ingresos,cajaInicial:bc.cajaInicial,cajaFinal:bc.cajaFinal,costos:er.costos,utilidad:er.utilidad,calidad:r.puntajes.calidadEmpresaMotor,eficiencia:r.puntajes.puntajeEficiencia,reputacion:r.reputacionMatriz});
 }
 const output=path.join(__dirname,'output/ingresos-tres-ciclos-20261021.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({motor:'excel-16',persistencia:'RPC Supabase simulada; no modifica servidor',filas:rows},null,2)+'\n');
 console.table(rows);
});

test('Preparar el plan no descuenta caja; local y limpieza son gasto de cada cierre',()=>{
 const d=plan(),ctx=entorno({}),reports=[{id:'A',partida:'FIJOS',capital:100000,excelDecisionState:{habilitado:true,motor_version:'excel-16',round:1,enviado:true,decisiones:d}}];
 const before=JSON.stringify(reports);CICLO.prepararEmpresa(d,{},overrides);assert.equal(JSON.stringify(reports),before);
 const c=ctx.SIDE_EXCEL_UI.cerrarLocal({game:'FIJOS',ciclo:1,reports,motorVersion:'excel-16'}),r=c.resultadosPorEmpresa.A;
 assert.equal(r.financial.balanceCaja.cajaInicial,100000);
 assert.ok(r.costos.detalles.manoObra.some(row=>row.rol==='local'&&row.costo>0));assert.ok(r.costos.detalles.manoObra.some(row=>row.rol==='limpieza'&&row.costo>0));
 assert.deepEqual(plain(ctx.SIDE_EXCEL_UI.cerrarLocal({game:'FIJOS',ciclo:1,reports,motorVersion:'excel-16'})),plain(c));
});
