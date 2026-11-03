'use strict';
// Portable gate for the authoritative business contract. Connected acceptance is separate.
const {spawnSync}=require('node:child_process'),fs=require('node:fs');
const tests=[
 'authoritative_worker.test.cjs','business_edge_auth.test.cjs','business_rpc_http.test.cjs',
 'cierre_aislamiento_historico.test.cjs','cierre_tracked_aislamiento.test.cjs','cierre_worker_versiones.test.cjs',
 'cierre_guardia_manual.test.cjs','cierre_guardia_automatico.test.cjs','eventos_costos_restriccion.test.cjs',
 'eventos_seleccion_disponible.test.cjs','event_semantics_v2.test.cjs','forense_correcciones.test.cjs','forense_redondeo.test.cjs',
 'product_cost_indicators.test.cjs','financial_presentation.test.cjs','student_financial_summary.test.js',
 'legacy_asset_inventory.test.cjs','legacy_production_targets.test.cjs','lotes_fifo_integrado.test.cjs',
 'sales_accounting_integration.test.cjs','sales_projection.test.cjs','revenue_excel_current.test.cjs',
 'oraculo_capacidad_independiente.test.cjs','md_logic.test.cjs','dop_resource_planning.test.cjs','production_dop_target_ui.test.js','profit_projection.test.cjs',
 'official_history.test.cjs','crear_partida_service.test.cjs','finance_config.test.cjs',
 'loan_schedule.test.cjs','event_cost_bases.test.cjs','rentabilidad_integral.test.cjs','rentabilidad_projection.test.cjs','rentabilidad_waiting.test.cjs'
].filter(name=>{if(!fs.existsSync('tests/'+name))throw Error('Missing gate test '+name);return true;});
const generated='supabase/functions/side-business-close/runtime.mjs',before=fs.readFileSync(generated,'utf8').replace(/\r\n/g,'\n');
let r=spawnSync(process.execPath,['tools/build_business_edge.cjs'],{stdio:'inherit'});if(r.status)process.exit(r.status||1);
if(before!==fs.readFileSync(generated,'utf8').replace(/\r\n/g,'\n'))throw Error('Edge runtime is stale: regenerate and commit it');
r=spawnSync(process.execPath,['--test','--test-concurrency=2',...tests.map(n=>'tests/'+n)],{stdio:'inherit'});process.exit(Number.isInteger(r.status)?r.status:1);

