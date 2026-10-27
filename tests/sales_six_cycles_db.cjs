'use strict';
// Replays the SIX actual UI-selected snapshots through the delivered service
// and SQL functions in disposable PostgreSQL. Does not contact hosted Supabase.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
const CYCLE=require('../js/cycle_model'),FIN=require('../js/financial_model'),{catalog}=require('./economic_v19_fixture.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output/sales-six-cycles');
const near=(a,b)=>assert.ok(Math.abs(Number(a)-Number(b))<.02,`${a} != ${b}`);
(async()=>{
 const ui=JSON.parse(fs.readFileSync(path.join(out,'ui-results.json'),'utf8'));
 assert.equal(ui.passed,true);assert.equal(ui.completedCycles,6);
 const db=await database(),rows=[];
 try{
  await db.exec('alter table participantes add column if not exists expulsada_at timestamptz');
  await db.exec(fs.readFileSync(path.join(root,'docs/sql/20261023_despliegue_cierre_v19.sql'),'utf8'));
  const game=await createGame(db,config({capital:200000,cycles:6,interest:20,creditPercentStart:20}));
  const joined=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'QA seis ciclos',p_nombre_comercial:'QA seis ciclos'});
  assert.equal(joined.success,true);const id=String(joined.empresa_id);
  const window={SIDE_CYCLE_MODEL:CYCLE,SIDE_FINANCIAL_MODEL:FIN,SIDE_FINANCE_CONFIG:require('../services/finance_config'),SIDE_DECISION_CATALOG:catalog,SIDE:{SupabaseClient:{get:()=>({rpc:async(name,args)=>({data:await rpc(db,name,args),error:null})})}}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'services/partida_service.js'),'utf8'),{window,console,setTimeout,clearTimeout});
  for(const selected of ui.rows){
   const round=selected.cycle,snapshot=selected.before.snapshot;
   assert.equal(Object.keys(snapshot.section_submissions).filter(key=>snapshot.section_submissions[key]&&key!=='A').length,5);
   assert.equal(snapshot.decisions_submitted,true);
   await db.query('insert into side_student_state(empresa_id,snapshot) values($1,$2) on conflict(empresa_id) do update set snapshot=excluded.snapshot,revision=side_student_state.revision+1',[id,snapshot]);
   await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',$2::int,'phase','results','status','finished')) where id=$1",[game.id,round]);
   const closed=await window.SIDE.PartidaService.cerrarNegocio(game.id,round);
   assert.equal(closed.success,true,JSON.stringify(closed));assert.equal(closed.reused,false);
   const result=closed.data.resultadosPorEmpresa[id],receipt=result.receipt,f=result.financial;
   assert.equal(receipt.produced,selected.produced);assert.equal(receipt.sold,selected.sold);assert.ok(receipt.sold>0);
   near(receipt.revenue,selected.revenue);near(receipt.revenue,f.estadoResultados.ingresos);
   near(f.estadoResultados.utilidad,selected.profit);near(f.balanceCaja.cajaFinal,selected.cash);
   near(f.balanceGeneral.activos,f.balanceGeneral.pasivoPatrimonio);
   for(const line of receipt.sales){assert.ok(line.sold<=line.available);near(line.revenue,line.sold*line.price);}
   for(const material of receipt.production.materials)assert.ok(material.consumption<=material.available+1e-7);
   const saved=(await db.query('select snapshot,revision from side_student_state where empresa_id=$1',[id])).rows[0];
   const reconnected=FIN.calculate({state:saved.snapshot.decision_state,ledger:saved.snapshot.cash_ledger,sectionsByRound:saved.snapshot.financial_sections,catalog,capital:200000,round});
   near(reconnected.estadoResultados.ingresos,selected.revenue);near(reconnected.balanceCaja.cajaFinal,selected.cash);
   assert.equal(saved.snapshot.decision_state.__cycleSettlements[round].sold,selected.sold);
   const history=(await db.query('select ciclo,ingresos,estado_resultados,caja_final from reportes_ciclo where empresa_id=$1 order by ciclo',[id])).rows;
   assert.equal(history.length,round);
   for(const r of history){const expected=ui.rows[r.ciclo-1];near(r.ingresos,expected.revenue);assert.equal(r.estado_resultados.cycleReceipt.sold,expected.sold);near(r.caja_final,expected.cash);}
   assert.equal((await window.SIDE.PartidaService.cerrarNegocio(game.id,round)).reused,true);
   const afterRetry=(await db.query('select revision from side_student_state where empresa_id=$1',[id])).rows[0];assert.equal(afterRetry.revision,saved.revision);
   rows.push({cycle:round,produced:receipt.produced,sold:receipt.sold,revenue:receipt.revenue,profit:f.estadoResultados.utilidad,cash:f.balanceCaja.cajaFinal,recoveredIncome:reconnected.estadoResultados.ingresos,historyPeriods:history.length});
  }
  const result={passed:true,cycles:6,source:'actual browser selections and submissions',database:'disposable local PostgreSQL',rows,totalSold:rows.reduce((n,r)=>n+r.sold,0),totalRevenue:rows.reduce((n,r)=>n+r.revenue,0)};
  fs.writeFileSync(path.join(out,'db-results.json'),JSON.stringify(result,null,2));console.table(rows);console.log('PASS six real UI snapshots: SQL, service, reports, cash, inventory, reload and closure idempotence.');
  const money=value=>'S/ '+Number(value).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
  const plans=['Básico: 100','Medio: 120','Premium: 100','Mixto: 40 + 40 + 40','Premium: 140','Premium: 160'];
  const table=rows.map((r,i)=>`| ${r.cycle} | ${plans[i]} | ${r.produced} | ${r.sold} | ${money(r.revenue)} | ${money(r.profit)} | ${money(r.cash)} |`).join('\n');
  const report=`# Prueba de seis ciclos completos — 27/10/2026

Resultado: seis ciclos completados, con ventas y unidades vendidas positivas en todos.
Total vendido: **${result.totalSold} unidades**. Ingresos acumulados: **${money(result.totalRevenue)}**.

## Decisiones seleccionadas

Capital inicial S/200000, seis ciclos manuales, sin eventos externos ni préstamos.
En el ciclo 1 se compró una mesa y una máquina básica de ensamble y de acabados.
Se compró el molde básico en el ciclo 1, el mejorado en el 2 y el premium en el 3.
En ciclos 4–6 se reutilizaron los moldes y equipos adquiridos, sin recomprarlos.

Cada ciclo: un operario básico de corte, un costurero básico y un operario básico
de acabado; sin jefatura ni analista; garantía de producto de 30 días; cuero
sintético, accesorios económicos e hilo estándar en las cantidades calculadas
para cada plan; canal web; sin capacitación e inversión baja en marketing.
Local y limpieza corresponden a los costos obligatorios existentes.

Las cantidades y opciones se eligieron en los controles reales. No se asignaron
decisiones directamente al estado del motor. Se enviaron las cinco secciones en
cada ciclo: 30 envíos, seis cierres mediante el botón docente y seis avances.

## Resultados definitivos

| Ciclo | Plan | Producidas | Vendidas | Ingresos | Utilidad neta | Caja final |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
${table}

Los ciclos con pérdida siguen teniendo ventas: utilidad e ingresos se verifican
por separado. La caja incorpora compras, cobros y ventas a crédito; no equivale
a sumar todos los ingresos al capital inicial.

## Comprobaciones

- Alumno y docente coinciden en ventas e ingresos de cada ciclo.
- Los resultados definitivos son visibles; no se presentan proyecciones como cierres.
- Se recargó la página después de cada cierre: ventas, caja e historial se conservaron.
- Se repitió cada cierre: no se duplicaron producción, cobros ni ventas.
- Los seis snapshots elegidos en navegador se procesaron con el servicio real de
  cierre y las funciones SQL actuales en PostgreSQL local desechable.
- Recibos, reportes SQL, ledger, estados financieros y reconexión coinciden.
- Se conservaron los seis períodos y sus unidades vendidas; ventas no exceden stock
  ni consumo de materiales excede existencias. Los balances cuadran a céntimos.
- Cero errores de página. No se cambió el código ni los controles de decisiones.

## Alcance y evidencias

Los seis ciclos se ejecutaron en un entorno aislado de prueba con las páginas
entregadas de alumno y docente y persistencia SQL local. No se creó ni cerró una
partida en Supabase alojado. La consulta remota de solo lectura al validador SQL
devolvió HTTP 200 y true para los precios internos 42.5 / 100 / 250, confirmando
que esa validación remota está actualizada.

Evidencias en tests/output/sales-six-cycles/: ui.log, ui-results.json, db.log,
db-results.json, remote-sql-check.json y cycle-1-sales.png a cycle-6-sales.png.
Pruebas reproducibles: tests/sales_six_cycles_ui.py y tests/sales_six_cycles_db.cjs.
`;
  fs.writeFileSync(path.join(root,'reports/prueba_ventas_seis_ciclos_20261027.md'),report);
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
