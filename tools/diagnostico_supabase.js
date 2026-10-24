#!/usr/bin/env node
'use strict';
// Read-only by default. Never applies SQL, closes a real room or prints tokens.
// Usage: SIDE_DIAGNOSTIC_JWT=<teacher access_token> node tools/diagnostico_supabase.js
// Optional: --demo-local SIDE-000 runs a disposable PGlite demo, never production.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');process.chdir(root);
async function main(){
 const args=process.argv.slice(2),demo=args.indexOf('--demo-local');
 if(args.includes('--help')){console.log('Read-only remote diagnosis: set SIDE_DIAGNOSTIC_JWT; node tools/diagnostico_supabase.js. Optional --demo-local SIDE-000 uses disposable local PostgreSQL. No production writes.');return;}
 if(demo>=0&&args[demo+1]!=='SIDE-000')throw Error('Only the explicit local demo SIDE-000 is allowed.');
 const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/config.js'),'utf8'),sandbox);
 const config=sandbox.window.SIDE_CONFIG||{},url=process.env.SIDE_DIAGNOSTIC_URL||config.SUPABASE_URL,key=process.env.SIDE_DIAGNOSTIC_KEY||config.SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw Error('Missing Supabase URL / publishable key.');
 const token=process.env.SIDE_DIAGNOSTIC_JWT,headers={apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})};
 const request=async name=>{const response=await fetch(url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(15000)});const data=await response.json();return {ok:response.ok,status:response.status,data};};
 const connection=await request('side_admission_features');
 const result={mode:'read-only',connection:{ok:connection.ok,status:connection.status,serverTime:connection.data?.serverTime},database:null,limitations:['Schema checks do not prove every RLS policy grants the intended user access. No real cycle is closed.']};
 if(token){
  const check=await request('side_diagnostico_v19');
  if(check.ok&&check.data){result.database=check.data;result.passed=Object.values(check.data.functions||{}).every(Boolean)&&Object.values(check.data.columns||{}).every(Boolean)&&check.data.legacyTriggers?.length===0;}
  else{result.database={ok:false,status:check.status,code:check.data?.code,message:check.data?.message};result.passed=false;}
 }else result.limitations.push('Set SIDE_DIAGNOSTIC_JWT to inspect protected schema diagnostics after applying the v19 migration.');
 console.log(JSON.stringify(result,null,2));
 if(demo>=0){
  const run=spawnSync(process.execPath,[path.join(root,'tests/cierre_v19_db.cjs'),'--demo','SIDE-000'],{cwd:root,stdio:'inherit'});
  if(run.status!==0)throw Error('Disposable local SIDE-000 demo failed.');
 }
 if(!connection.ok||result.passed===false)process.exitCode=1;
}
main().catch(error=>{console.error('Diagnostic:',error.message);process.exitCode=1;});
