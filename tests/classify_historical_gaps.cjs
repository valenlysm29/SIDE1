'use strict';
// Evaluate existing evidence in an UNEXPOSED RESTORE, always rolling back RPCs.
// Persistence is intercepted; no historical closure is created, even locally.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'tests/output/fase01/finalizacion');
const database=process.argv[2]||'fase01_restore3';
if(!/^fase01_restore\d*$/.test(database))throw Error('Only a local unexposed restore is allowed');
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
const arg=v=>v===null?'null':typeof v==='object'?q(JSON.stringify(v))+'::jsonb':typeof v==='number'?String(v):q(v);
function sql(source){return execFileSync('docker',['exec','-i','supabase_db_fase01local','psql','-U','supabase_admin','-d',database,'-v','ON_ERROR_STOP=1','-Atq'],{input:source,encoding:'utf8'}).trim();}
const fingerprint=()=>sql("select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by id),'')) from partidas t; select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by empresa_id),'')) from side_student_state t; select md5(string_agg(md5(cierre::text),'' order by partida_id,ciclo)) from side_business_closures;");
(async()=>{
 const before=fingerprint(),legacy=await import('../supabase/functions/side-business-close/legacy-runtime.mjs'),modern=require('../services/business_runtime.cjs');
 const gaps=JSON.parse(fs.readFileSync(path.join(root,'tests/output/fase01/historical-gaps.json'),'utf8')),report=[];
 for(const gap of gaps){
  let save=null,context=null;
  const rpc=async(name,args)=>{
   if(name==='side_cierres_pendientes')return {data:[{id:gap.id,cycles:[gap.ciclo]}],error:null};
   if(name.startsWith('side_guardar_cierre')){
    save=args.p_cierre;return {data:null,error:{code:'DIAGNOSTICO_SIN_ESCRITURA',message:'Persistence deliberately disabled in historical diagnosis'}};
   }
   if(!['side_version_worker_cierre','side_contexto_cierre_negocio','side_material_context_v1','side_event_context_v1','side_legacy_event_context_v1'].includes(name))throw Error('Unexpected diagnostic RPC '+name);
   const call=`select public.${name}(${Object.entries(args).map(([k,v])=>k+' => '+arg(v)).join(',')})::text;`;
   const source="begin; set request.jwt.claims='{"+'"role":"service_role"'+"}'; set role service_role; "+call+' rollback;';
   const data=JSON.parse(sql(source));
   if(name==='side_contexto_cierre_negocio'&&Number(args.p_ciclo)===gap.ciclo)context=data;
   return {data,error:null};
  };
  const version=(await rpc('side_version_worker_cierre',{p_partida_id:gap.id})).data;
  const results=await (version==='0'?legacy:modern).runOnce(rpc),result=results[0];
  const eligible=context?.empresas?.map(c=>String(c.id))||[];
  // The context RPC can synthesize a no-plan policy. That is NOT historical
  // evidence under this recovery task. Inspect persisted evidence separately.
  const rawEvidence=JSON.parse(sql(`select coalesce(jsonb_object_agg(t.empresa_id::text,jsonb_build_object('plan',s.snapshot#>array['decision_state','__cyclePlans',${q(gap.ciclo)}],
   'confirmed',s.snapshot->>'decisions_submitted'='true','currentDecision',exists(select 1 from jsonb_each(coalesce(s.snapshot->'decision_state','{}')) d where left(d.key,2)<>'__' and d.value->>'round'=${q(gap.ciclo)}))),'{}') from participantes t left join side_student_state s on s.empresa_id=t.empresa_id where t.partida_id=${q(gap.id)} and t.expulsada_at is null;`));
  const allPlans=!!eligible.length&&eligible.every(id=>{
   const raw=rawEvidence[id],prepared=context.empresas.find(c=>String(c.id)===id)?.snapshot?.decision_state?.__cyclePlans?.[gap.ciclo];
   return !!raw?.plan?.state&&raw.plan.source!=='no-plan'||!!raw?.confirmed&&!!raw?.currentDecision&&prepared?.source==='recovered-confirmation';
  });
  const complete=!!save?.resultadosPorEmpresa&&eligible.every(id=>save.resultadosPorEmpresa[id]?.receipt&&save.resultadosPorEmpresa[id]?.financial&&save.resultadosPorEmpresa[id]?.state);
  // A legacy engine reaching persistence does not prove historical event facts.
  // These cases stay in reconciliation until a separate source is demonstrated.
  const verified=allPlans&&complete&&gap.snapshots_con_eventos===0;
  report.push({...gap,workerVersion:version,validationCode:result?.code||null,eligibleCompanies:eligible.length,allEligiblePlansPresent:allPlans,reachesPersistence:!!save,recoverableWithCurrentEvidence:verified,
   classification:verified?'CANDIDATO_VERIFICABLE_SIN_ESCRITURA':gap.ciclo>1&&['CIERRE_ANTERIOR_REQUERIDO','SALDO_ANTERIOR_NO_VERIFICADO','HISTORIAL_ACTIVOS_NO_VERIFICADO'].includes(result?.code)?'DEPENDENCIA_HISTORICA':!allPlans?'EVIDENCIA_INCOMPLETA':'CONCILIACION_REQUERIDA',
   economicEventEvidenceReviewRequired:gap.snapshots_con_eventos>0,
   evidenceSources:eligible.map(id=>({company:id,persistedPlan:!!rawEvidence[id]?.plan?.state,source:rawEvidence[id]?.plan?.source||null,confirmed:rawEvidence[id]?.confirmed||false,currentDecision:rawEvidence[id]?.currentDecision||false})),
   candidateHash:verified?crypto.createHash('sha256').update(JSON.stringify(save)).digest('hex'):null});
 }
 if(before!==fingerprint())throw Error('Historical diagnosis mutated restored data');
 fs.writeFileSync(path.join(folder,'historical-classification.json'),JSON.stringify({database,unchanged:true,rows:report},null,2));
 console.log('PASS classified',report.length,'historical gaps; candidates',report.filter(r=>r.recoverableWithCurrentEvidence).length,'; no writes');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
