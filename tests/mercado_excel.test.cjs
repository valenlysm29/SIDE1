const {test}=require('node:test'),assert=require('node:assert/strict');
const {repartoMercado,repartoModelo1}=require('../js/engine/mercado.js');
const {excelRound,excelRoundDown}=require('../js/engine/config_excel.js');
test('Excel redondea mitades lejos de cero y trunca negativos',()=>{assert.equal(excelRound(-2.5),-3);assert.equal(excelRound(1.005,2),1.01);assert.equal(excelRoundDown(-1.99),-1);});
for(const [segmento,precios,expected] of [['SEG-01',[40,45,43,41],[1292,285,772,1151]],['SEG-02',[120,150,190,200],[1067,955,819,659]],['SEG-03',[250,300,220,400],[174,194,236,195]]]){
  test('Mercado literal '+segmento,()=>{const rows=repartoMercado(precios.map((precio,i)=>({precio,reputacionMercado:[7,8.3,10.2,9][i]})),segmento,{CALIDAD_MERCADO_MODO:'excel_literal'});assert.deepEqual(rows.map(e=>e.asignado),expected);});
}
test('Modelo 1 conserva sobrante literal',()=>{assert.deepEqual(repartoModelo1([40,45,43,41].map((precio,i)=>({precio,reputacionMercado:[7,8.3,10.2,9][i]})),3500).map(e=>e.asignado),[784,836,973,908]);});
test('Mercado vacío y empate de precios son finitos',()=>{assert.deepEqual(repartoMercado([],'SEG-01'),[]);assert.equal(repartoMercado([{precio:40,reputacionMercado:1,calidadEmpresaMotor:4}],'SEG-01')[0].asignado,3500);});
