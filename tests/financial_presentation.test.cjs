const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const view=require('../js/student_financial_view.js');
test('El cierre explica ventas, cobros, crédito e impuesto cero por pérdida acumulada',()=>{
 const html=view.incomeHtml({ventasTotales:27000,ingresosFinancieros:0,cicloImpuesto:2,impuestoDiferido:false,utilidadAntesImpuestosAcumulada:-48600.27,baseImponibleAcumulada:0,impuestoRenta:0},{cobrosVentas:18900},{cuentasPorCobrar:8100});
 for(const text of ['27,000.00','18,900.00','8,100.00','-48,600.27','base imponible','ingresos financieros son otra partida'])assert.ok(html.includes(text),text);
 assert.match(view.incomeHtml({cicloImpuesto:2,impuestoDiferido:true}),/se calculará.*ciclo 2/);
});
test('Estado de resultados conserva las doce filas obligatorias y valores realizados',()=>{
 const er={ventasTotales:1000,costoVentas:400,utilidadBruta:600,gastosOperacion:200,gastosAdministrativos:150,gastosVentas:50,utilidadOperativa:400,ingresosFinancieros:10,gastosFinancieros:20,utilidadAntesImpuestos:390,impuestoRenta:115.05,utilidadNeta:274.95};
 const entries=view.incomeEntries(er);assert.equal(entries.length,12);assert.deepEqual(entries.map(x=>x[1]),[1000,400,600,200,150,50,400,10,20,390,115.05,274.95]);
 assert.match(view.officeHtml({round:1,estadoResultados:er}),/Impuesto a la Renta \(29.5%\)/);
 assert.match(view.summaryHtml({history:[{round:1,estadoResultados:er}]}),/Utilidad Neta/);
});
test('DOM de alumno y profesor consume el mismo estado sin generar movimientos',()=>{
 const src=fs.readFileSync('js/app.js','utf8');const from=src.indexOf('function renderStudentStatus(){');const to=src.indexOf('\nfunction renderOfficeFinances()',from);
 const nodes={studentCashResult:{parentElement:{querySelector:()=>null}},studentIncomeStatement:{},studentEventImpactText:{}};
 const report={round:1,estadoResultados:{ventasTotales:125,costoVentas:75,utilidadNeta:50},balanceCaja:{cajaFinal:125},flujoCaja:{},balanceGeneral:{}};
 const ctx={$:id=>nodes[id],applyEventCashEffects(){},financialReport:()=>report,money:String,window:{SIDE_STUDENT_FINANCIAL_VIEW:view},activeStudentEvents:()=>[],currentRound:()=>1,financialDetailsHtml:()=>'',escapeHtml:String};vm.createContext(ctx);vm.runInContext(src.slice(from,to),ctx);ctx.renderStudentStatus();assert.match(nodes.studentIncomeStatement.innerHTML,/Ventas Totales/);assert.match(nodes.studentIncomeStatement.innerHTML,/125\.00/);assert.doesNotMatch(nodes.studentEventImpactText.textContent,/sin depreciación/);
 const teacher=fs.readFileSync('js/docente.js','utf8');assert.match(teacher,/section\(r\.provisional\?'Estado de resultados estimado':'Estado de resultados',window\.SIDE_STUDENT_FINANCIAL_VIEW\.incomeEntries\(er\)\)/);
 assert.match(fs.readFileSync('docente.html','utf8'),/student_financial_view\.js/);
});
test('Advertencias de garantías son visibles y escapadas en alumno, historial y profesor',()=>{
 const warning='Garantía 180 días sin costo unitario configurado <img src=x onerror="alert(1)">';const er={policyWarnings:[warning]};
 for(const html of [view.incomeHtml(er),view.officeHtml({round:1,estadoResultados:er}),view.summaryHtml({history:[{round:1,estadoResultados:er}]})]){assert.match(html,/Garantía 180 días sin costo unitario configurado/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);assert.match(html,/role="status"/);}
 const src=fs.readFileSync('js/docente.js','utf8');const from=src.indexOf('function teacherSalesDetail(r){');const to=src.indexOf('\nfunction closeBusinessLocalRound()',from);const nodes={resultStats:{},resultCompanySelect:{},detailReports:{}};
 const ctx={state:{reports:[{id:'1',empresa:'Prueba',estadoResultados:er}]},$:id=>nodes[id],gradeValue:()=>null,gradeLabel:()=>'',money:String,escapeHtml:String,escapeAttr:String,sectionBadges:()=>'',eventReportTable:()=>'',window:{SIDE_STUDENT_FINANCIAL_VIEW:view}};vm.createContext(ctx);vm.runInContext(src.slice(from,to),ctx);ctx.renderResults();assert.match(nodes.detailReports.innerHTML,/Garantía 180 días/);assert.doesNotMatch(nodes.detailReports.innerHTML,/<img/);
 assert.equal(view.policyWarningsHtml({}),'');
});
