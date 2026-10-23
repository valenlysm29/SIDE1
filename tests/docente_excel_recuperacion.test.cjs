'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {adjuntarCaja}=require('../js/engine/caja.js'),{cerrarCiclo}=require('../js/engine/ciclo.js'),{decision}=require('./escenarios_excel.cjs');
test('Profesor en navegador nuevo reconstruye balance financiero desde reporte persistido sin cache local',async()=>{
 const source=fs.readFileSync(require.resolve('../js/docente.js'),'utf8'),inicio=source.indexOf('async function supabaseReports(reportsBase=state.reports){'),fin=source.indexOf('\nlet rosterSyncError',inicio);
 assert.ok(inicio>0&&fin>inicio);
 const cierre=adjuntarCaja(cerrarCiclo({empresas:['1'],decisionesPorEmpresa:{1:decision({seleccion:['FIN-01A'],montoPrestamo:5000})}}),{capitalPorEmpresa:{1:100000}}),r=cierre.resultadosPorEmpresa['1'];
 const financial=r.financial,report={ciclo:1,capital:100000,ingresos:r.ingresos,costos:financial.estadoResultados.costos,utilidad:financial.estadoResultados.utilidad,caja_final:financial.balanceCaja.cajaFinal,balance_caja:financial.balanceCaja,flujo_caja:financial.flujoCaja,estado_resultados:{...financial.estadoResultados,excel:r}};
 const context={roomGeneration:0,presenceTracker:{observe:()=>{}},state:{partidaId:'partida-test',reports:[]},rosterSyncError:'',runtime:()=>({phase:'results'}),$:()=>({value:'DEMO'}),supabaseCatalog:async()=>null,remoteProgress:()=>({total:0}),window:{SIDE:{SupabaseClient:{isReady:()=>true},PartidaService:{listarParticipantes:async()=>({success:true,data:[{empresa_id:1,nombre:'Ana',empresa:'Empresa A',empresas:{nombre_comercial:'Empresa A',ciclo_actual:1,caja_actual:financial.balanceCaja.cajaFinal}}]})},DecisionesService:{obtenerReporte:async()=>({success:true,data:{empresa:{nombre_comercial:'Empresa A',ciclo_actual:1,caja_inicial:100000},reportes:[report],decisiones:[]}})}}}};
 vm.createContext(context);vm.runInContext(source.slice(inicio,fin),context);
 const out=await context.supabaseReports();assert.deepEqual(JSON.parse(JSON.stringify(out[0].balanceGeneral)),financial.balanceGeneral);
 assert.equal(out[0].caja,financial.balanceCaja.cajaFinal);assert.equal(out[0].costos,financial.estadoResultados.costos);assert.equal(out[0].utilidad,financial.estadoResultados.utilidad);
 report.estado_resultados={...financial.estadoResultados,balanceGeneral:financial.balanceGeneral};
 const current=await context.supabaseReports();assert.deepEqual(JSON.parse(JSON.stringify(current[0].balanceGeneral)),financial.balanceGeneral,'current business closure restores its persisted balance sheet');
});
