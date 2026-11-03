'use strict';
// Real PostgreSQL connections, real closure RPCs, isolated from all remote services.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawn,execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const worker=require('../services/business_runtime.cjs'),F=require('../js/financial_model');
const fixture=require('./economic_v19_fixture.cjs'),original=require('./fixtures/financial_forensic.json');
const name='side-forense-'+crypto.randomBytes(5).toString('hex'),teacher='11111111-1111-1111-1111-111111111111';
const edgeName=name+'-edge';
const out=path.resolve('tests/output/forense_v2');fs.mkdirSync(out,{recursive:true});
const docker=args=>execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
const arg=v=>v==null?'null':typeof v==='object'?quote(JSON.stringify(v))+'::jsonb':typeof v==='number'?String(v):quote(v);
async function sql(text){return new Promise((resolve,reject)=>{
 const p=spawn('docker',['exec','-i',name,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq']);let stdout='',stderr='';
 p.stdout.setEncoding('utf8');p.stderr.setEncoding('utf8');
 p.stdout.on('data',x=>stdout+=x);p.stderr.on('data',x=>stderr+=x);p.on('error',reject);p.on('close',code=>code?reject(Error(stderr)):resolve(stdout.trim()));p.stdin.end(text);
});}
const prefix=`set test.uid=${quote(teacher)}; set test.role='service_role';`;
const rpcSQL=(func,args)=>prefix+`set role service_role; select public.${func}(${Object.entries(args).map(([k,v])=>`${k} => ${arg(v)}`).join(',')})::text;`;
const readJSON=async text=>JSON.parse(await sql(text));
const wire=value=>JSON.parse(JSON.stringify(value));
// Math.pow differs by ~1e-16 between Node and Deno. Only this diagnostic
// factor is normalized; quantities, prices and every financial field stay exact.
const denoComparable=value=>JSON.parse(JSON.stringify(value,(key,value)=>key==='factorPrecioAbsoluto'&&typeof value==='number'?Number(value.toPrecision(14)):value));
const near=(a,b,label)=>assert.ok(Math.abs(Number(a)-Number(b))<1e-7,`${label}: ${a} != ${b}`);
function reconcile(r,previous){
 const f=r.financial,e=f.estadoResultados,b=f.balanceGeneral,c=f.flujoCaja;
 near(e.ventasTotales-e.costoVentas,e.utilidadBruta,'bruta');near(e.gastosAdministrativos+e.gastosVentas,e.gastosOperacion,'operación');
 near(e.utilidadBruta-e.gastosOperacion+e.ingresosFinancieros-e.gastosFinancieros-e.impuestoRenta,e.utilidadNeta,'resultado');
 near(b.efectivo+b.cuentasPorCobrar+(b.anticiposMateriales||0)+b.inventarioMP+b.inventarioPT+b.activosFijos,b.activos,'activos');
 near(b.deuda+(b.cuentasPorPagarProveedores||0)+b.impuestosPorPagar+b.interesesPorPagar+b.provisionGarantias+b.patrimonio,b.pasivoPatrimonio,'pasivo');near(b.activos,b.pasivoPatrimonio,'balance');
 near(c.cobrosVentas+c.reembolsos+c.pagosOperacion+c.eventos+c.otros+c.impuestoRenta,c.operacion,'flujo operación');near(c.compraActivos+c.ventaActivos,c.inversion,'inversión');near(c.operacion+c.inversion+c.financiamiento,c.flujoNeto,'flujo neto');near(c.cajaInicial+c.flujoNeto,c.cajaFinal,'caja');near(c.cajaFinal,b.efectivo,'efectivo');
 if(previous){near(c.cajaInicial,previous.financial.balanceGeneral.efectivo,'arrastre caja');near(b.resultadosAcumulados,previous.financial.balanceGeneral.resultadosAcumulados+e.utilidadNeta,'arrastre resultados');}
 const s=structuredClone(r.state);delete s.__financialSnapshots[r.receipt.round];
 const rebuilt=F.calculate({capital:200000,catalog:fixture.catalog,round:r.receipt.round,state:s,ledger:r.ledger,sectionsByRound:r.financialSections,financialPolicy:r.receipt.financialPolicy});
 for(const key of ['estadoResultados','balanceGeneral','flujoCaja'])assert.deepEqual(rebuilt[key],f[key],`replay ${key}`);
}

test('tres y seis ciclos: Node, Edge y PostgreSQL real; siete escenarios y reintento',{timeout:600000},async()=>{
 const evidence={database:'PostgreSQL 17, Docker network=none; real committed RPC writes and independent read connections',scenarios:[],cycles:[]};
 try{
  // tmpfs avoids leaving database engine files anywhere on the host.
  docker(['run','-d','--rm','--network','none','--tmpfs','/var/lib/postgresql/data','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine']);
  let ready=false;for(let i=0;i<80;i++){try{if(!docker(['logs',name]).includes('PostgreSQL init process complete; ready for start up.'))throw Error('initdb still running');docker(['exec',name,'pg_isready','-U','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,250));}}assert.ok(ready);
  const fixtureSource=fs.readFileSync('tests/lifecycle_db_fixture.cjs','utf8'),base=fixtureSource.match(/await db\.exec\(`([\s\S]*?)`\);/)[1];
  await sql(base+"create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$;");
  const migrations=['supabase/migrations/supabase_migration.sql','supabase/migrations/supabase_game_lifecycle.sql','supabase/migrations/supabase_student_admission.sql','supabase/migrations/20260930_preservar_opciones_decisiones.sql','supabase/migrations/20261009_sala_espera_identidad_exacta.sql','docs/sql/20261023_despliegue_cierre_v19.sql','supabase/migrations/20261026_cierre_sin_expulsion_automatica.sql','supabase/migrations/20261027_corregir_ventas_generales.sql','supabase/migrations/20261028_cierre_servidor.sql'];
  for(const file of migrations){if(file.includes('20261026_'))await sql('alter table participantes add column if not exists expulsada_at timestamptz;');await sql(fs.readFileSync(file,'utf8').replace(/create extension if not exists "pgcrypto";/,''));}
  await sql(`insert into auth.users values(${quote(teacher)},'{}','forense@example.invalid');`);
  const edge=await import(pathToFileURL(path.resolve('supabase/functions/side-business-close/runtime.mjs')).href);
  const {runVersioned}=await import(pathToFileURL(path.resolve('supabase/functions/side-business-close/route.mjs')).href);
  await sql(fs.readFileSync('supabase/migrations/20261102034926_versionar_worker_cierres.sql','utf8'));
  const edgeDir=path.join(out,'edge_service');fs.mkdirSync(edgeDir,{recursive:true});fs.copyFileSync('tests/fixtures/forense_edge_runtime/index.ts',path.join(edgeDir,'index.ts'));fs.copyFileSync('supabase/functions/side-business-close/runtime.mjs',path.join(edgeDir,'runtime.mjs'));
  fs.copyFileSync('supabase/functions/side-business-close/route.mjs',path.join(edgeDir,'route.mjs'));
  docker(['run','-d','--rm','--name',edgeName,'-p','127.0.0.1::9000','--mount',`type=bind,source=${edgeDir},target=/service,readonly`,'--entrypoint','edge-runtime','public.ecr.aws/supabase/edge-runtime:v1.77.8','start','--main-service','/service']);
  const edgeAddress='http://'+docker(['port',edgeName,'9000']).trim();let edgeReady=false;
  for(let i=0;i<80;i++){try{const response=await fetch(edgeAddress,{signal:AbortSignal.timeout(1000)});if(response.ok){edgeReady=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}if(!edgeReady)throw Error('Edge Runtime no inició: '+docker(['logs',edgeName]));
  evidence.edgeRuntime='Supabase Edge Runtime v1.77.8 (Deno), HTTP en localhost, RPC de lectura reproducidas sin credenciales';
  evidence.comparisonPolicy='Exact JSON equality except factorPrecioAbsoluto (Math.pow diagnostic), rounded to 14 significant digits. All three financial statements remain exact.';
  evidence.nodeFinancialSHA256=crypto.createHash('sha256').update(fs.readFileSync('js/financial_model.js')).digest('hex');evidence.edgeSHA256=crypto.createHash('sha256').update(fs.readFileSync('supabase/functions/side-business-close/runtime.mjs')).digest('hex');
  const cases=['sin producción','producción sin ventas','ventas parciales','ventas completas','fijos elevados','recursos alternativos','configuración rentable'];
  for(const total of [3,6].filter(n=>!process.env.SIDE_FORENSE_CYCLES||n===Number(process.env.SIDE_FORENSE_CYCLES)))for(const scenario of cases.filter(s=>!process.env.SIDE_FORENSE_SCENARIO||s===process.env.SIDE_FORENSE_SCENARIO)){
   const config={lifecycleVersion:2,cycleCloseMode:'manual',integrationDurationMinutes:5,integrationMinutes:0,cycles:total,roundHours:0,roundMinutes:10,enabledEvents:[],capital:200000,economicRulesVersion:'utility-v1',sequentialCloseVersion:'1'};
   const game=await readJSON(prefix+`insert into partidas(profesor_id,nombre,configuracion) values(${quote(teacher)},${quote('QA forense '+scenario)},${arg(config)}) returning row_to_json(partidas)::text;`);
   const joined=await readJSON(prefix+`select public.ingresar_empresa(${quote(game.codigo)},'Forense QA','Forense QA')::text;`),id=Number(joined.empresa_id);
   let previous=null;const historicalHashes={};
   for(let round=1;round<=total;round++){
    const plan=structuredClone(original[0].cierre.resultadosPorEmpresa['188'].receipt.decisions);
    for(const value of Object.values(plan))if(value&&typeof value==='object')value.round=round;
    // Only the optional maintenance differs; no arbitrary deletion of fixed costs.
    plan.MANTENIMIENTO.optionIds=round%2?['correctivo']:[];
    if(scenario==='sin producción')plan.PRODUCCION_META.moldTargets={molde_1:0,molde_2:0,molde_3:0};
    if(scenario==='producción sin ventas')plan.CANALES.optionIds=[];
    if(scenario==='ventas parciales')plan.CANALES.transfers={esencial:{'los_olivos:1':10}};
    if(scenario==='recursos alternativos'){
     plan.ENSAMBLE.purchases={1:{ens_semi:1}};plan.ACABADOS.purchases={1:{aca_semi:1}};
     plan.PERS_ENSAMBLE.quantities={ens_personal_ind:1};plan.PERS_ACABADO.quantities={aca_personal_tec:1};
    }
    if(scenario==='fijos elevados')plan.JEFATURA.optionIds=['si_jefatura'];
    if(scenario==='configuración rentable'){
     plan.MOLDE.optionIds=['molde_3'];plan.MOLDE.purchases={1:{molde_3:1}};plan.PRODUCCION_META.moldTargets={molde_1:0,molde_2:0,molde_3:100};
     plan.CUERO.quantities={cuero_prem:70};plan.ACCESORIOS.quantities={acc_prem:100};plan.HILO.quantities={hilo_std:1300};plan.ANALISTA_COMPRAS.optionIds=['no_analista'];
    }
    if(round>1)for(const key of ['MESA_CORTE','ENSAMBLE','ACABADOS','MOLDE']){plan[key].purchases=structuredClone(previous.state[key].purchases);plan[key].purchases[round]={};if(key==='MOLDE')plan[key].optionIds=[];}
    const saved=round===1?{decision_state:{},cash_ledger:{},financial_sections:{}}:await readJSON(`select snapshot::text from side_student_state where empresa_id=${id};`);
    saved.decisions_submitted=true;saved.decision_state.__cyclePlans={...saved.decision_state.__cyclePlans,[round]:{state:plan}};
    await sql(`update side_student_state set snapshot=${arg(saved)} where empresa_id=${id}; update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',${round},'phase','results','status','finished')) where id=${quote(game.id)};`);
    const initialContext=await readJSON(rpcSQL('side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:round}));assert.ok(initialContext.token,JSON.stringify(initialContext));
    let nodeClosure;const reads=[];
    const run=async(engine,persist)=>runVersioned(async(func,args)=>{
     const response=await (async()=>{
     if(func==='side_cierres_pendientes')return {data:[{id:game.id,cycles:[round]}]};
     if(func==='side_contexto_cierre_negocio'&&Number(args.p_ciclo)===round)return {data:structuredClone(initialContext)};
     if(func==='side_guardar_cierre_negocio'){
      if(!persist){nodeClosure=wire(args.p_cierre);return {data:{cierre:args.p_cierre}};}
      assert.deepEqual(wire(args.p_cierre),nodeClosure,'Node y Edge antes de persistir (contrato JSON)');
     }
     try{return {data:await readJSON(rpcSQL(func,args))};}catch(error){return {error:{message:error.message}};}
     })();if(!persist&&func!=='side_guardar_cierre_negocio')reads.push({name:func,args,response:wire(response)});return response;
    },async call=>{assert.deepEqual((await call('side_cierres_pendientes',{})).data,[]);return [];},engine.runOnce);
    const a=await run(worker,false);assert.equal(a[0].success,true,JSON.stringify(a));
    const deno=await (await fetch(edgeAddress,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reads}),signal:AbortSignal.timeout(30000)})).json();assert.ok(!deno.error,JSON.stringify(deno));assert.equal(deno.results[0].success,true,JSON.stringify(deno));assert.deepEqual(denoComparable(deno.closure),denoComparable(nodeClosure),'Deno Edge real frente a Node');
    for(const key of ['estadoResultados','balanceGeneral','flujoCaja'])assert.deepEqual(deno.closure.resultadosPorEmpresa[id].financial[key],nodeClosure.resultadosPorEmpresa[id].financial[key],`Deno ${key}: igualdad exacta`);
    const b=await run(edge,true);assert.equal(b[0].success,true,JSON.stringify(b));
    const closure=await readJSON(`select cierre::text from side_business_closures where partida_id=${quote(game.id)} and ciclo=${round};`);assert.deepEqual(closure,nodeClosure,'relectura PostgreSQL independiente');
    const r=closure.resultadosPorEmpresa[String(id)];
    try{reconcile(r,previous);}catch(error){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({scenario,total,round,result:r,previous},null,2));throw error;}
    const report=await readJSON(`select jsonb_build_object('er',estado_resultados,'fc',flujo_caja,'bc',balance_caja,'cash',caja_final)::text from reportes_ciclo where empresa_id=${id} and ciclo=${round};`);
    for(const [key,value] of Object.entries(r.financial.estadoResultados))assert.deepEqual(report.er[key],value,`reporte ER ${key}`);assert.deepEqual(report.fc,r.financial.flujoCaja);assert.deepEqual(report.er.balanceGeneral,r.financial.balanceGeneral);assert.deepEqual(report.bc,r.financial.balanceCaja);near(report.cash,r.financial.balanceGeneral.efectivo,'reporte caja');
    const snapshot=await readJSON(`select snapshot::text from side_student_state where empresa_id=${id};`);assert.deepEqual(snapshot.cash_ledger,r.ledger);assert.deepEqual(snapshot.financial_sections,r.financialSections);assert.deepEqual(snapshot.decision_state.__financialSnapshots[round].balanceGeneral,r.financial.balanceGeneral);
    for(const mold of ['molde_1','molde_2','molde_3'])assert.equal(r.financial.depreciationValues[mold],undefined);assert.equal(r.financial.estadoResultados.desgloseCostos.mantenimiento,Math.round((r.receipt.maintenanceCost+(round%2?1500:0))*100)/100);
    const er=r.financial.estadoResultados,bg=r.financial.balanceGeneral;
    assert.equal(er.depreciacion,scenario==='recursos alternativos'?123.70:59.38,'oráculo mensual: máquinas, sin molde');
    const acquisition=scenario==='recursos alternativos'?15528:scenario==='configuración rentable'?11095:7863;
    near(bg.activosFijos,acquisition-round*er.depreciacion,'activo original menos depreciación exclusiva de máquinas');
    assert.equal(r.financial.flujoCaja.compraActivos,round===1?-acquisition:0);
    if(scenario==='sin producción'){assert.equal(r.receipt.produced,0);assert.equal(er.costoVentas,0);assert.ok(er.utilidadNeta<0);}
    if(scenario==='producción sin ventas'){assert.ok(r.receipt.produced>0);assert.equal(r.receipt.sold,0);assert.equal(er.costoVentas,0);assert.ok(bg.inventarioPT>0);}
    if(scenario==='ventas parciales'){assert.ok(r.receipt.sold>0&&r.receipt.sold<r.receipt.produced);assert.ok(bg.inventarioPT>0);}
    if(scenario==='ventas completas')assert.equal(r.receipt.sold,r.receipt.produced);
    if(scenario==='configuración rentable')assert.ok(er.utilidadNeta>0,`rentabilidad ${round}: ${er.utilidadNeta}`);
    const hashes=await readJSON(`select jsonb_object_agg(ciclo,md5(cierre::text))::text from side_business_closures where partida_id=${quote(game.id)};`);for(const [cycle,hash] of Object.entries(historicalHashes))assert.equal(hashes[cycle],hash,'histórico anterior intacto');Object.assign(historicalHashes,hashes);
    const retry=await worker.runOnce(async(func,args)=>func==='side_cierres_pendientes'?{data:[{id:game.id,cycles:[round]}]}:{data:await readJSON(rpcSQL(func,args))});assert.equal(retry[0].success,true);
    assert.deepEqual(await readJSON(`select cierre::text from side_business_closures where partida_id=${quote(game.id)} and ciclo=${round};`),closure,'reintento no reescribe cierre');
    const financial=structuredClone(r.financial);delete financial.history;
    evidence.cycles.push({scenario,total,round,receipt:r.receipt,financial});previous=r;
   }
   assert.equal(await sql(`select count(*) from side_business_closures where partida_id=${quote(game.id)};`),String(total));evidence.scenarios.push({scenario,total,validated:true});console.log(`OK PostgreSQL: ${scenario}, ${total} ciclos`);
  }
  fs.writeFileSync(path.join(out,'postgres.json'),JSON.stringify(evidence,null,2));
 }finally{for(const container of [edgeName,name])try{docker(['rm','-f',container]);}catch{}}
});
