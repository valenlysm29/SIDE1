'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {calcularCostos,costoLaboral,costoMaquinaria,consumirAlmacen,reputacionOperativa}=require('../js/engine/costos.js');
function cerca(obtenido,esperado){assert.ok(Math.abs(obtenido-esperado)<=1e-9*Math.max(1,Math.abs(esperado)),`${obtenido} != ${esperado}`);}
const compras={'INS-01':60,'INS-02':110,'INS-03':30,'INS-04':200,'INS-05':190,'INS-06':0,'INS-07':1500,'INS-08':1400};
const consumoTabla={'INS-01':60,'INS-02':107,'INS-03':0,'INS-04':200,'INS-05':185,'INS-06':0,'INS-07':1500,'INS-08':1400};

test('MO conserva fórmulas, CTS manual y divisores de Costos!U5:AD39',()=>{
  const referencias={corte:[[21135,24135],[28180,32180],[52392,58842]],ensamble:[[21135,24135],[38802,43752],[61905,69405]],acabado:[[21135,24135],[38802,43752],[61905,69405]]};
  for(const [rol,filas] of Object.entries(referencias))for(let nivel=1;nivel<=3;nivel++)for(const [indice,regimen] of ['MYPE','NO_MYPE'].entries()){
    const resultado=costoLaboral(rol,nivel,regimen);cerca(resultado.sumaAnual,filas[nivel-1][indice]);cerca(resultado.pagoMensual,filas[nivel-1][indice]/[12.5,13][indice]);
  }
  for(const [rol,anuales] of [['jefatura',[41520,46770]],['limpieza',[8904,10554]]])for(const [indice,regimen] of ['MYPE','NO_MYPE'].entries())cerca(costoLaboral(rol,1,regimen).sumaAnual,anuales[indice]);
  cerca(costoLaboral('local').pagoMensual,2000);
  cerca(costoLaboral('corte',2).cts,1000);cerca(costoLaboral('ensamble',2).cts,750);
  cerca(costoLaboral('corte',1,'MYPE',{ESSALUD_ANUAL_LITERAL:false}).sumaAnual,22620);
});

test('maquinaria y moldes reproducen las veinte sumas anuales MYPE/No MYPE',()=>{
  const referencias={mesa:[2512.5,2675],'INF-02':[3517.5,3745],'INF-03':[7537.5,8025],'INF-04':[15075,16050],'INF-05':[1177.5,1257],'INF-06':[4415.625,4713.75],'INF-07':[9321.875,9951.25],'INF-08':[261,276],'INF-09':[1044,1104],'INF-10':[3045,3220]};
  for(const [codigo,anuales] of Object.entries(referencias))for(const [indice,regimen] of ['MYPE','NO_MYPE'].entries())cerca(costoMaquinaria(codigo,regimen).sumaAnual,anuales[indice]);
  const mesa=costoMaquinaria('mesa');cerca(mesa.instalacion,75);cerca(mesa.capacitacion,50);cerca(mesa.mantenimientoAnual,125);cerca(mesa.depreciacionAnual,-237.5);
});

test('almacén consume en jerarquía según necesidad y usa inventario inicial',()=>{
  const resultado=consumirAlmacen({compras,necesidad:{cuero:167.5,accesorios:385,hilo:3115}});
  assert.deepEqual(resultado.consumoMP,{...consumoTabla,'INS-02':107.5});
  cerca(resultado.inventarioFinal['INS-02'],2.5);cerca(resultado.faltantes.hilo,215);
  const arrastre=consumirAlmacen({inventarioInicial:{'INS-01':3},compras:{'INS-01':2,'INS-02':5},necesidad:{cuero:7}});
  cerca(arrastre.consumoMP['INS-01'],5);cerca(arrastre.consumoMP['INS-02'],2);cerca(arrastre.inventarioFinal['INS-02'],3);
});

test('tabla de valorización AB88:AC96 usa el fixture propio107, separado de F55=107.5',()=>{
  const resultado=calcularCostos({compras,consumoMP:consumoTabla});
  cerca(resultado.valorComprado,27160);cerca(resultado.valorCompradoNeto,24987.2);
  cerca(resultado.valorConsumido,24580);cerca(resultado.valorConsumidoNeto,22613.6);
  cerca(resultado.valorInventario,2580);cerca(resultado.valorInventarioNeto,2373.6);
  const almacenReal=calcularCostos({compras,consumoMP:{...consumoTabla,'INS-02':107.5}});
  cerca(almacenReal.valorConsumido,24602.5);cerca(almacenReal.valorInventario,2557.5);
});

test('reputación operativa conserva C65:G65 y el denominador literal de H61',()=>{
  const resultado=reputacionOperativa({produccion:{lotes:[{molde:'INF-08',producido:150},{molde:'INF-09',producido:140},{molde:'INF-10',producido:78}],totalProducido:368,proporcionN3:2/7},consumoMP:consumoTabla,publicidad:3000});
  cerca(resultado.factorProduccion,78/368*10);cerca(resultado.factorMO,2/7*10);cerca(resultado.factorMP,(185/385+1400/2900)/3*10);cerca(resultado.factorPublicidad,3);
  cerca(resultado.valor,11.187635078939427);
  const hilo={consumoMP:{'INS-06':100,'INS-07':100,'INS-08':100}};
  cerca(reputacionOperativa(hilo).proporciones.hilo,0.5);cerca(reputacionOperativa(hilo,{REPUTACION_HILO_DENOMINADOR_LITERAL:false}).proporciones.hilo,1/3);
  cerca(reputacionOperativa().valor,0);
});

test('los descuentos son multiplicativos, preservan valoración e inventario entre ciclos',()=>{
  const resultado=calcularCostos({compras,consumoMP:consumoTabla,seleccion:['INS-09A','INS-10A']});
  cerca(resultado.factorDescuento,0.92*0.98*0.97);cerca(resultado.costoMP,24580*0.92*0.98*0.97);
  const siguiente=calcularCostos({inventarioInicial:resultado.inventarioFinal,compras:{'INS-03':5},consumoMP:{'INS-03':4}});
  cerca(siguiente.inventarioFinal['INS-03'],31);cerca(siguiente.valorInventario,resultado.valorInventario+80);
  assert.throws(()=>calcularCostos({consumoMP:{'INS-01':1}}),/Consumo superior/);
});

test('costos de ciclo cuentan operarios de toda matriz, mantenimiento y depreciación no caja',()=>{
  const resultado=calcularCostos({personal:{corte:[[1,0,0],[1,0,0],[0,0,0]],ensamble:[[0,0,1],[1,0,0],[0,1,0]],acabado:[[0,0,0],[0,0,1],[1,0,0]]},jefes:0,maquinaria:{mesa:1},seleccion:['INF-11B'],publicidad:3000});
  cerca(resultado.costoMOciclo,1690.8+2254.4+1690.8+3104.16+4952.4+3104.16+4952.4+712.32+2000);
  cerca(resultado.costoMantenimiento,125/12+1500);cerca(resultado.depreciacion,237.5/12);
  cerca(resultado.reputacion.factorMO,2/7*10);
  cerca(resultado.totalCostos,resultado.costoMOciclo+resultado.costoMantenimiento+resultado.depreciacion+3000);
  assert.ok(resultado.detalles.maquinaria[0].salidaCompra>0);
});

test('métodos de depreciación definidos y pendientes usan parámetros inyectables',()=>{
  cerca(costoMaquinaria('mesa','MYPE',{metodo:'FIN-02B',unidadesCiclo:100},{UNIDADES_VIDA:1000}).depreciacionCiclo,237.5);
  cerca(costoMaquinaria('mesa','MYPE',{metodo:'FIN-02C',ciclo:1}).depreciacionCiclo,2375*10/55/12);
  cerca(costoMaquinaria('mesa','MYPE',{metodo:'FIN-02C',ciclo:13}).depreciacionCiclo,2375*9/55/12);
});
