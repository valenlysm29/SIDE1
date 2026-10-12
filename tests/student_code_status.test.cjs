const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function service(answer,diagnostic){
 const calls=[],window={SIDE:{SupabaseClient:{get:()=>({rpc:async(name,args)=>{calls.push({name,args});return name==='side_admission_features'?{data:{waitingRoomVersion:3,exactIdentityVersion:2}}:name==='side_estado_codigo_sala'?diagnostic:{data:answer};}})}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../services/empresa_service.js'),'utf8'),{window,console:{error(){},warn(){}}});
 return {api:window.SIDE.EmpresaService,calls};
}
const identity={codigo:'SIDE-RX8',nombreLegal:'demo1',nombreComercial:'demo1'};
for(const code of ['PARTIDA_CANCELADA','PARTIDA_FINALIZADA','CODIGO_RETIRADO','PARTIDA_NO_ENCONTRADA'])test('rechazo distingue '+code+' sin registrar una empresa nueva',async()=>{
 const s=service({success:false,code:'CREDENCIALES_INVALIDAS'},{data:{codigo:identity.codigo,code}});
 const result=await s.api.ingresar(identity);assert.equal(result.success,false);assert.equal(result.code,code);assert.equal(result.technical,false);
 assert.equal(s.calls.filter(c=>c.name==='ingresar_empresa').length,1);assert.equal(s.calls.at(-1).name,'side_estado_codigo_sala');
});
test('una respuesta de sala cancelada no se convierte en ingreso exitoso',async()=>{
 const s=service({success:true,partida:{estado:'finalizada',configuracion:{cancelledAt:'2026-10-11T12:00:00Z'},serverTime:'2026-10-11T12:00:00Z'}});
 assert.equal((await s.api.ingresar(identity)).code,'PARTIDA_CANCELADA');
});
test('cancelledAt null no rechaza una sala válida',async()=>{
 const s=service({success:true,partida:{estado:'esperando',configuracion:{cancelledAt:null,runtime:{phase:'integration'}},serverTime:'2026-10-11T12:00:00Z'}});
 assert.equal((await s.api.ingresar(identity)).success,true);
});
test('sin diagnóstico nuevo no se inventa cancelación ni ingreso',async()=>{
 const s=service({success:false,code:'CREDENCIALES_INVALIDAS'},{error:{code:'PGRST202',message:'Missing function'}});
 assert.equal((await s.api.ingresar(identity)).code,'CREDENCIALES_INVALIDAS');
});
test('partida iniciada se distingue de cancelada usando estado público del código',async()=>{
 const s=service({success:false,code:'PARTIDA_INICIADA'},{data:{codigo:identity.codigo,code:'PARTIDA_CANCELADA'}});
 assert.equal((await s.api.ingresar(identity)).code,'PARTIDA_CANCELADA');
});
test('marcadores nulos o falsos no equivalen a cancelar, ni en textos antiguos',async()=>{
 for(const value of [null,false,0,'','false','0','null','   ']){
  const s=service({success:true,partida:{estado:'esperando',configuracion:{cancelledAt:value,runtime:{phase:'integration'}},serverTime:'2026-10-11T12:00:00Z'}});
  assert.equal((await s.api.ingresar(identity)).success,true,String(value));
 }
});
