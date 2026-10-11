const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../js/engine/puntajes.js'),CON=require('../js/engine/consecuencias.js');
const f=require('../docs/logica_excel/fixtures_excel.json');
const {CONFIG}=require('../js/engine/config_excel.js');
test('Lotes y Motor: fixture 6.2,17,8,-3 sin normalizar',()=>{const r=P.calcularPuntajes(f.lotes_motor);assert.deepEqual([r.calidadEmpresaMotor,r.puntajeEficiencia,r.reputacionMatriz,r.saludFinanciera],[6.2,17,8,-3]);assert.deepEqual(r.lotes.map(l=>l.calidad),[12,5,4]);assert.equal(r.costoInsumos,28000);assert.equal(r.niveles.calidad,'Medio');});
test('Catálogo: todas las filas, costos y aportes coinciden con extracción Excel',()=>{assert.deepEqual(P.catalogo,require('../docs/logica_excel/catalogo_excel.json'));assert.equal(P.catalogo.length,68);});
test('Menú congelado: diez selectores y seis campos base; marketing se elige una sola vez',()=>{
 assert.equal(CONFIG.GRUPOS_MOTOR.length,16);assert.equal(CONFIG.DECISIONES_VISIBLES.length,10);assert.equal(CONFIG.CAMPOS_LEGACY_VISIBLES.length,6);
 for(const grupo of CONFIG.DECISIONES_VISIBLES)assert.ok(CONFIG.GRUPOS_MOTOR.includes(grupo));
 for(const grupo of ['Numero de proveedores','Politica de pago a proveedores','Lead time','Método de depreciación','Política de inventarios','Garantía del producto','Mantenimiento de maquinaria','Inversion en marketing'])assert.ok(!CONFIG.DECISIONES_VISIBLES.includes(grupo));
 assert.deepEqual(CONFIG.GARANTIA_DIAS_BASE,[30,90,180]);assert.equal(CONFIG.COSTO_MANTENIMIENTO_BASE,200);
 assert.deepEqual(Object.values(CONFIG.DISTRITOS_TIENDAS),['Los Olivos','Miraflores','San Juan de Lurigancho']);
});
test('Decisiones congeladas: solo garantía y mantenimiento ya existentes suman; catálogo interno intacto',()=>{const r=P.calcularPuntajes({seleccion:['FIN-02B','COM-06C','INF-11C','INS-12C','SEG-03','INF-01','INS-03']});const rows=P.catalogo.filter(o=>['COM-06C','INF-11C'].includes(o.codigo));assert.deepEqual([r.puntajeEficiencia,r.reputacionMatriz,r.saludFinanciera],['eficiencia','reputacion','financiero'].map(k=>rows.reduce((sum,row)=>sum+row[k],0)));});
test('No duplica grupos ni acepta más de tres lotes',()=>{assert.throws(()=>P.calcularPuntajes({seleccion:['RH-01','RH-02']}));assert.throws(()=>P.calcularPuntajes({lotes:[{},{},{},{}]}));});
test('Mensajes de consecuencias son literales del libro',()=>{for(const row of f.consecuencias)assert.equal(CON.TEXTOS[row.id],row.mensaje);});
test('Premium insuficiente, coherente y rango sin efecto; reputación una vez por regla',()=>{const lotes=[{segmento:'SEG-03',cantidad:10,calidad:3},{segmento:'SEG-03',cantidad:20,calidad:12},{segmento:'SEG-03',cantidad:10,calidad:4},{segmento:'SEG-03',cantidad:10,calidad:12}];const r=CON.evaluarConsecuencias({puntajes:{puntajeEficiencia:8,reputacionMatriz:5,saludFinanciera:5},lotes,jefes:1});assert.deepEqual(r.efectos.precios,[.65,1.4,1,1.4]);assert.equal(r.efectos.reputacionCambio,0);});
test('Todas las consecuencias: multiplicación, historial, costos y tasa',()=>{const r=CON.evaluarConsecuencias({puntajes:{puntajeEficiencia:2,reputacionMatriz:1,saludFinanciera:1},lotes:[],jefes:0,planeado:200,capacidad:100,producido:60,demanda:20,costoMOciclo:1000},{ciclosReputacionBaja:1});assert.ok(Math.abs(r.efectos.factorProduccion-.665)<1e-9);assert.equal(r.efectos.factorDemanda,.8);assert.equal(r.efectos.tasaAdicionalPP,3);assert.equal(r.efectos.costoHorasExtra,250);assert.equal(r.efectos.costoAlmacenaje,80);assert.equal(r.efectos.ciclosReputacionBaja,2);assert.deepEqual(r.mensajes.map(m=>m.id).sort(),['CONS-03','CONS-04','CONS-05','CONS-06','CONS-07','CONS-08']);});

