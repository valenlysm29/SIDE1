'use strict';
// Driver for a loopback-only integration test; credentials come from the parent.
const fs=require('node:fs'),vm=require('node:vm');
if(process.env.P01_URL!=='http://127.0.0.1:57321')throw Error('Non-local target refused');
let count=0;const args=JSON.parse(process.env.P01_ARGS);
const rpc=async(name,params)=>{
 count++;const res=await fetch(process.env.P01_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:process.env.P01_KEY,Authorization:'Bearer '+process.env.P01_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(params)});
 const data=await res.json();if(!res.ok){process.stdout.write('attempt '+count+' '+data.code+'\n');return {error:data};}return {data,error:null};
};
const window={setTimeout,SIDE:{SupabaseClient:{get:()=>({rpc})}}};vm.runInNewContext(fs.readFileSync('services/decisiones_service.js','utf8'),{window});
window.SIDE.DecisionesService.registrarEntregaProveedor(args.game,args.order,args.event,args.quantity).then(r=>{process.stdout.write(JSON.stringify({success:r.success,code:r.code,attempts:count,receiptId:r.data?.receiptId})+'\n');process.exitCode=r.success?0:1;});
