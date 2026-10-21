'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const C=require('../js/engine/config_excel.js'),COS=require('../js/engine/costos.js'),M=require('../js/engine/ciclo.js'),CAJA=require('../js/engine/caja.js');
const actual=C.paraMotor(C.MOTOR_ACTUAL),cerca=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function plan(){return {seleccion:['COM-01C','INV-01A','FIN-01A'],garantiaDias:180,mantenimientoPreventivo:true,marketingNivel:'baja',analistaCompras:true,garantiaProveedor:80,tiendasPorDistrito:{los_olivos:1,miraflores:2,sjl:1},montoPrestamo:2000,regimen:'MYPE',personal:{corte:[1,0,0],ensamble:[1,0,0],acabado:[1,0,0]},maquinaria:{mesa:1,'INF-08':1},comprasUnidades:{'INS-01':60,'INS-04':100,'INS-06':3},lotes:[{segmento:'SEG-01',molde:'INF-08',cuero:'INS-01',accesorios:'INS-04',hilo:'INS-06',cantidad:30,precio:100}]};}
function browser(){
 const values=new Map(),ctx={localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}};vm.createContext(ctx);
 for(const name of ['config_excel','catalogo_excel','puntajes','produccion','costos','consecuencias','mercado','ciclo','caja','ui_excel'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/engine',name+'.js'),'utf8'),ctx);
 return ctx;
}
test('Nueva versión explícita preserva la regla del Excel para partidas anteriores',()=>{
 assert.equal(C.CONFIG.VERSION,'excel-16');assert.equal(C.configurar({}).NUEVO_MODELO,false);assert.equal(C.configurar(actual).NUEVO_MODELO,true);
 assert.deepEqual(M.cerrarCiclo({empresas:['A']}).eliminadas,['A']);
 const r=M.cerrarCiclo({empresas:['A']},actual);assert.deepEqual(r.eliminadas,[]);cerca(r.resultadosPorEmpresa.A.costosTotales,2712.32);
});
test('No enviar paga local y limpieza en tres ciclos; caja y estados reconcilian',()=>{
 let historia={};for(let ciclo=1;ciclo<=3;ciclo++){
  const r=CAJA.adjuntarCaja(M.cerrarCiclo({ciclo,empresas:['A'],historialPorEmpresa:historia},actual),{capitalPorEmpresa:{A:100000},historialAnterior:historia,overrides:actual});
  const f=r.resultadosPorEmpresa.A.financial;cerca(f.balanceCaja.cajaInicial,100000-(ciclo-1)*2712.32);cerca(f.balanceCaja.cajaFinal,100000-ciclo*2712.32);
  cerca(f.balanceCaja.cajaInicial+f.balanceCaja.entradas-f.balanceCaja.salidas,f.balanceCaja.cajaFinal);cerca(f.balanceGeneral.activos,f.balanceGeneral.deuda+f.balanceGeneral.patrimonio);
  cerca(f.flujoCaja.operacion+f.flujoCaja.inversion+f.flujoCaja.financiamiento,f.flujoCaja.flujoNeto);historia=r.historialPorEmpresa;
 }
});
test('Borrador guardado se envía automáticamente una sola vez y conserva su evidencia',()=>{
 const d=plan(),r=M.cerrarCiclo({empresas:['A','B'],borradoresPorEmpresa:{A:d}},actual);assert.deepEqual(r.autoenviadas,['A']);assert.equal(r.resultadosPorEmpresa.A.envioAutomatico,true);assert.ok(r.resultadosPorEmpresa.A.unidadesVendidas>0);
 assert.equal(r.resultadosPorEmpresa.B.envioAutomatico,false);assert.equal(r.resultadosPorEmpresa.A.financiamiento.montoPrestamo,2000);
 const next=M.cerrarCiclo({ciclo:2,empresas:['A'],historialPorEmpresa:r.historialPorEmpresa},actual).resultadosPorEmpresa.A;
 assert.equal(next.financiamiento.montoPrestamo,0);assert.deepEqual(next.decisiones.comprasUnidades,{});assert.equal(next.produccion.totalProducido,0);
});
test('Local y limpieza no se pueden desactivar enviando un plan manipulado',()=>{
 const r=M.cerrarCiclo({empresas:['A'],decisionesPorEmpresa:{A:{local:false,limpieza:false,lotes:[]}}},actual).resultadosPorEmpresa.A;
 cerca(r.costos.costoMOciclo,2712.32);
});
test('Canales cobran exactamente web y alquiler por distrito, sin segundo cargo del catálogo',()=>{
 const d=plan(),cost=COS.costosCanales(d),r=M.cerrarCiclo({empresas:['A'],decisionesPorEmpresa:{A:d}},actual).resultadosPorEmpresa.A;
 assert.equal(cost.total,1800+7000+2200+500);assert.equal(r.costos.detallesRecurrentes.filter(d=>/^COM-01/.test(d.codigo)).length,0);
 cerca(r.costos.costoDecisionesRecurrentes,cost.total+1000+r.ingresos*.01);
});
test('Monto de préstamo nuevo nunca queda ignorado por un selector de acceso contradictorio',()=>{
 const d=plan();d.seleccion=d.seleccion.filter(k=>k!=='FIN-01A').concat('FIN-01B');
 const r=M.cerrarCiclo({empresas:['A'],borradoresPorEmpresa:{A:d}},actual).resultadosPorEmpresa.A;assert.equal(r.financiamiento.montoPrestamo,d.montoPrestamo);assert.ok(r.decisiones.seleccion.includes('FIN-01A'));assert.ok(!r.decisiones.seleccion.includes('FIN-01B'));
});
test('Contrato de tiendas mantiene cantidades hasta el ciclo 12 y permite finalizar luego',()=>{
 const first=M.cerrarCiclo({empresas:['A'],decisionesPorEmpresa:{A:plan()}},actual),d={...plan(),tiendasPorDistrito:{}};
 for(const ciclo of [2,12])assert.equal(M.cerrarCiclo({ciclo,empresas:['A'],historialPorEmpresa:first.historialPorEmpresa,decisionesPorEmpresa:{A:d}},actual).resultadosPorEmpresa.A.decisiones.tiendasPorDistrito.miraflores,2);
 assert.equal(M.cerrarCiclo({ciclo:13,empresas:['A'],historialPorEmpresa:first.historialPorEmpresa,decisionesPorEmpresa:{A:d}},actual).resultadosPorEmpresa.A.decisiones.tiendasPorDistrito.miraflores,0);
});
test('No produce con molde o mesa no comprados; la mesa única se limita a una',()=>{
 const d=plan();for(const maquinaria of [{mesa:1},{'INF-08':1},{}])assert.equal(M.prepararEmpresa({...d,maquinaria},{},actual).produccion.totalProducido,0);
 const r=M.prepararEmpresa({...d,maquinaria:{...d.maquinaria,mesa:8}},{},actual);assert.equal(r.decisionesAplicadas.maquinaria.mesa,1);assert.ok(r.produccion.totalProducido>0);
});
test('Decisiones ocultas no generan efectos nuevos y garantía visible no cobra',()=>{
 const d=plan(),hidden=['INF-11C','INS-09A','INS-10A','INS-11A','FIN-02C','INS-12C'];d.seleccion.push(...hidden);
 const r=M.cerrarCiclo({empresas:['A'],decisionesPorEmpresa:{A:d}},actual).resultadosPorEmpresa.A;
 for(const k of hidden)assert.ok(!r.decisiones.seleccion.includes(k));assert.equal(r.costos.costoGarantia,0);assert.equal(r.costos.costoPoliticaMantenimiento,200);
});
test('Costos laborales visibles se derivan del mismo cálculo para ambos regímenes',()=>{
 const b=browser();for(const regimen of ['MYPE','NO_MYPE'])for(const rol of ['corte','ensamble','acabado','jefatura','limpieza'])for(const nivel of (['jefatura','limpieza'].includes(rol)?[1]:[1,2,3])){
  const d=COS.costoLaboral(rol,nivel,regimen),html=b.SIDE_EXCEL_UI.costoLaboralHtml(rol,nivel,regimen),formatted='S/ '+d.pagoMensual.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});assert.ok(html.includes(formatted));
 }
});
test('Cada activo muestra precio, instalación y capacitación realmente cobrados',()=>{
 const b=browser();for(const codigo of Object.keys(C.CONFIG.MAQUINARIA))for(const regimen of ['MYPE','NO_MYPE']){
  const d=COS.costoMaquinaria(codigo,regimen),html=b.SIDE_EXCEL_UI.costoActivoHtml(codigo,regimen);assert.ok(html.includes('S/ '+d.salidaCompra.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})));assert.ok(html.includes('Mantenimiento mensual'));
 }
});
test('Editor nuevo no contiene casilla optativa y valida compras obligatorias',()=>{
 const b=browser(),container={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null};b.SIDE_EXCEL_UI.mountEditor(container,{round:1,motorVersion:C.MOTOR_ACTUAL,getState:()=>({}),save:()=>{}});
 assert.doesNotMatch(container.innerHTML,/data-excel-enable/);assert.match(container.innerHTML,/24 días productivos/);assert.match(container.innerHTML,/12 ciclos mensuales/);assert.match(container.innerHTML,/1,800/);
 const d=plan();assert.equal(b.SIDE_EXCEL_UI.validar(d,C.MOTOR_ACTUAL),'');delete d.maquinaria.mesa;assert.match(b.SIDE_EXCEL_UI.validar(d,C.MOTOR_ACTUAL),/mesa/);d.maquinaria.mesa=1;delete d.maquinaria['INF-08'];assert.match(b.SIDE_EXCEL_UI.validar(d,C.MOTOR_ACTUAL),/molde/);
});

test('Editor remoto nuevo bloquea confirmación hasta que el servidor sea compatible',()=>{
 const b=browser(),container={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null};
 b.SIDE_EXCEL_UI.mountEditor(container,{round:1,motorVersion:C.MOTOR_ACTUAL,local:false,remoteReady:false,getState:()=>({}),save:()=>{}});
 assert.match(container.innerHTML,/data-excel-enviar[^>]*disabled/);
 assert.match(container.innerHTML,/Consulta a tu docente/);
 assert.doesNotMatch(container.innerHTML,/supabase\/migrations/);
});
test('Cierre local nuevo incluye empresas sin estado, autoenvía y es idempotente',()=>{
 const b=browser(),reports=[{id:'A',partida:'TEST',capital:100000},{id:'B',partida:'TEST',capital:100000,excelDecisionState:{habilitado:true,round:1,enviado:false,decisiones:plan()}}];
 const first=b.SIDE_EXCEL_UI.cerrarLocal({game:'TEST',ciclo:1,reports,motorVersion:C.MOTOR_ACTUAL});assert.equal(Object.keys(first.resultadosPorEmpresa).length,2);assert.equal(reports[1].excelDecisionState.enviosAutomaticos[1],true);
 const second=b.SIDE_EXCEL_UI.cerrarLocal({game:'TEST',ciclo:1,reports,motorVersion:C.MOTOR_ACTUAL});assert.equal(JSON.stringify(first),JSON.stringify(second));assert.ok(reports[0].caja<100000);
});
test('La fuente salarial y los valores pendientes permanecen explícitos y configurables',()=>{
 assert.match(C.CONFIG.FUENTE_SUELDO_CORTE,/pendiente/);assert.deepEqual(C.CONFIG.SUELDOS.corte,[1500,2000,3800]);
 for(const key of ['HORAS_EXTRA_PCT','COSTO_ALMACENAJE_UNIDAD','TEA_ADICIONAL_PP'])assert.ok(C.CONFIG.PENDIENTE_DEFINIR.includes(key));
 assert.equal(COS.costosCanales({tiendasPorDistrito:{los_olivos:1}},{COSTOS_TIENDAS:{los_olivos:123}}).total,123);
});
