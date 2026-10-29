const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const view=require('../js/student_financial_view.js');
test('El estado conserva las filas sin detalles adicionales',()=>{
 const html=view.incomeHtml({ventasTotales:27000,cicloImpuesto:2,baseImponibleAcumulada:0,impuestoRenta:0},{cobrosVentas:18900},{cuentasPorCobrar:8100});
 assert.match(html,/27,000.00/);assert.doesNotMatch(html,/18,900|8,100|Base acumulada|<p>/);assert.match(html,/\(-\) Impuesto a la renta/);
});
test('Estado de resultados conserva las doce filas obligatorias y valores realizados',()=>{
 const er={ventasTotales:1000,costoVentas:400,utilidadBruta:600,gastosOperacion:200,gastosAdministrativos:150,gastosVentas:50,utilidadOperativa:400,ingresosFinancieros:10,gastosFinancieros:20,utilidadAntesImpuestos:390,impuestoRenta:115.05,utilidadNeta:274.95};
 const entries=view.incomeEntries(er);assert.equal(entries.length,12);assert.deepEqual(entries.map(x=>x[1]),[1000,400,600,200,150,50,400,10,20,390,115.05,274.95]);
 assert.match(view.officeHtml({round:1,estadoResultados:er}),/Impuesto a la renta/);
 assert.match(view.summaryHtml({history:[{round:1,estadoResultados:er}]}),/Utilidad Neta/);
});
test('DOM de alumno y profesor consume el mismo estado sin generar movimientos',()=>{
 const src=fs.readFileSync('js/app.js','utf8');const from=src.indexOf('function renderStudentStatus(){');const to=src.indexOf('\nfunction renderOfficeFinances()',from);
 const nodes={studentCashResult:{parentElement:{querySelector:()=>null}},studentIncomeStatement:{},studentEventImpactText:{}};
 const report={round:1,estadoResultados:{ventasTotales:125,costoVentas:75,utilidadNeta:50},balanceCaja:{cajaFinal:125},flujoCaja:{},balanceGeneral:{}};
 const ctx={$:id=>nodes[id],applyEventCashEffects(){},financialReport:()=>report,money:String,window:{SIDE_STUDENT_FINANCIAL_VIEW:view},activeStudentEvents:()=>[],currentRound:()=>1,financialDetailsHtml:()=>'',escapeHtml:String};vm.createContext(ctx);vm.runInContext(src.slice(from,to),ctx);ctx.renderStudentStatus();assert.match(nodes.studentIncomeStatement.innerHTML,/Ventas netas/);assert.match(nodes.studentIncomeStatement.innerHTML,/125\.00/);assert.doesNotMatch(nodes.studentEventImpactText.textContent,/sin depreciación/);
 const teacher=fs.readFileSync('js/docente.js','utf8');assert.match(teacher,/incomeEntries\(er\)/);
 assert.match(fs.readFileSync('docente.html','utf8'),/student_financial_view\.js/);
});
test('Advertencias de garantías son visibles y escapadas en alumno, historial y profesor',()=>{
 const warning='Garantía 180 días sin costo unitario configurado <img src=x onerror="alert(1)">';const er={policyWarnings:[warning]};
 for(const html of [view.incomeHtml(er),view.officeHtml({round:1,estadoResultados:er}),view.summaryHtml({history:[{round:1,estadoResultados:er}]})]){assert.match(html,/Garantía 180 días sin costo unitario configurado/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);assert.match(html,/role="status"/);}
 const src=fs.readFileSync('js/docente.js','utf8');const from=src.indexOf('function teacherSalesDetail(r){');const to=src.indexOf('\nfunction closeBusinessLocalRound()',from);const nodes={resultStats:{},resultCompanySelect:{},detailReports:{}};
 const ctx={state:{reports:[{id:'1',empresa:'Prueba',estadoResultados:{...er,ventasTotales:27000,cicloImpuesto:2,impuestoDiferido:false,utilidadAntesImpuestosAcumulada:-48600.27,baseImponibleAcumulada:0,impuestoRenta:0},flujoCaja:{cobrosVentas:18900},balanceGeneral:{cuentasPorCobrar:8100}}]},$:id=>nodes[id],gradeValue:()=>null,gradeLabel:()=>'',money:String,escapeHtml:String,escapeAttr:String,sectionBadges:()=>'',eventReportTable:()=>'',window:{SIDE_STUDENT_FINANCIAL_VIEW:view}};vm.createContext(ctx);vm.runInContext(src.slice(from,to),ctx);ctx.renderResults();assert.match(nodes.detailReports.innerHTML,/Garantía 180 días/);assert.doesNotMatch(nodes.detailReports.innerHTML,/<img/);assert.match(nodes.detailReports.innerHTML,/27000/);assert.doesNotMatch(nodes.detailReports.innerHTML,/18,900|8,100|Base acumulada/);
 assert.equal(view.policyWarningsHtml({}),'');
});
test('balance identifica las cuentas persistidas que explican los totales',()=>{
 const pdf=require('../js/teacher_report_pdf'),bg={efectivo:174328.31,cuentasPorCobrar:531.25,inventarios:30.53,activosFijos:7734.74,activos:182624.83,deuda:0,impuestosPorPagar:0,interesesPorPagar:0,provisionGarantias:500,patrimonio:182124.83,pasivoPatrimonio:182624.83};
 const rows=pdf.reportData({balanceGeneral:bg},null).statements.find(row=>row[0]==='6. Balance general')[1];for(const [label,val] of [['Cuentas por cobrar',531.25],['Inventarios',30.53],['Provisión por garantías',500]])assert.equal(rows.find(row=>row[0]===label)[1],val);
 const html=view.officeHtml({round:2,balanceGeneral:bg});for(const value of ['531.25','30.53','500.00'])assert.ok(html.includes(value));
});
