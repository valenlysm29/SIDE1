'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../js/docente.js'),'utf8');
function setup(participants,base,report){
 const ctx={state:{partidaId:'room',reports:base},roomGeneration:1,$:()=>({value:'SIDE-TEST'}),presenceTracker:{observe(){}},supabaseCatalog:async()=>null,runtime:()=>({}),remoteProgress:()=>({total:0}),window:{SIDE:{SupabaseClient:{isReady:()=>true},PartidaService:{listarParticipantes:async()=>({success:true,data:participants})},DecisionesService:{obtenerReporte:async id=>({success:true,data:report(id)})}}}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function supabaseReports('),source.indexOf("let rosterSyncError='',reportsBusy")),ctx);return ctx;
}
const participant=id=>({empresa_id:id,empresa:'Igual',empresas:{nombre_comercial:'Igual',ciclo_actual:2}});
test('does not borrow financial data from another company with the same name',async()=>{
 const ctx=setup([participant('b')],[{id:'a',empresaId:'a',empresa:'Igual',ronda:2,utilidad:900,estadoResultados:{utilidad:900}}],()=>({empresa:{nombre_comercial:'Igual',ciclo_actual:2}}));
 const rows=await ctx.supabaseReports();assert.equal(rows.find(r=>r.empresaId==='b').utilidad,0);assert.equal(rows.length,2);
});
test('does not fill current cycle statements with previous cycle data',async()=>{
 const ctx=setup([participant('a')],[{id:'a',empresaId:'a',empresa:'Igual',ronda:1,utilidad:900,estadoResultados:{utilidad:900},flujoCaja:{operacion:600}}],()=>({empresa:{nombre_comercial:'Igual',ciclo_actual:2}}));
 const [row]=await ctx.supabaseReports();assert.equal(row.ronda,2);assert.equal(row.utilidad,0);assert.equal(Object.keys(row.estadoResultados).length,0);assert.equal(Object.keys(row.flujoCaja).length,0);
});
test('keeps same-company same-cycle fallback when its report is pending',async()=>{
 const ctx=setup([participant('a')],[{id:'a',empresaId:'a',empresa:'Igual',ronda:2,utilidad:900}],()=>({empresa:{nombre_comercial:'Igual',ciclo_actual:2}}));
 const [row]=await ctx.supabaseReports();assert.equal(row.utilidad,900);
});
