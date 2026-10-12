const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
const serviceSource=fs.readFileSync(path.join(__dirname,'../services/empresa_service.js'),'utf8');

function form(result){
 const fields=Object.fromEntries(['gameCode','gameCodeError','companyLegalName','companyBrandName'].map(id=>[id,{value:'',textContent:'',attributes:{},classList:{toggle(){}},setAttribute(name,value){this.attributes[name]=value;},focus(){this.focused=true;}}]));
 fields.companyLegalName.value='demo1';fields.companyBrandName.value='demo1';
 let calls=0,message='',logs=[];
 const context={console:{error:(...args)=>logs.push(args)},$:id=>fields[id],window:{SIDE:{EmpresaService:{ingresar:async()=>{calls++;return result;}}}},hasConfig:true,teacherConfig:()=>({}),requireSupabase:()=>true,stopStudentSync(){},studentSessionRecovering:false,studentStateFailure:null,studentProgressHydrated:false,studentSnapshotEpoch:0,COMPANY_NAME:'Empresa',message:(id,text)=>{message=text;}};
 vm.createContext(context);
 const constants=source.slice(source.indexOf('const JOIN_STARTED_MESSAGE'),source.indexOf('const DECISION_CATALOG'));
 const start=source.indexOf("$('studentForm')?.addEventListener('submit',async e=>{")+"$('studentForm')?.addEventListener('submit',".length;
 const end=source.indexOf('\nfunction startJoinLoading',start);
 const callback=source.slice(start,end).trim().replace(/\);$/,'');
 vm.runInContext(constants+'\nthis.submit='+callback,context);
 return {fields,context,get calls(){return calls;},get message(){return message;},get logs(){return logs;}};
}

test('el formulario rechaza el código concatenado de la captura antes de llamar al servidor',async()=>{
 const f=form({success:false,code:'CREDENCIALES_INVALIDAS'});
 for(const code of ['SIDE-WG2SIDE','SIDE-WG2 SIDE','SÍDE-WG2','SIDE-WG2!','SIDE-WG']){
  f.fields.gameCode.value=code;
  await f.context.submit({preventDefault(){}});
  assert.equal(f.calls,0);
  assert.match(f.message,/código como SIDE-PTV6 o PTV6/);
  assert.equal(f.fields.gameCode.attributes['aria-invalid'],'true');
  assert.equal(f.fields.gameCodeError.textContent,f.message);
  assert.equal(f.fields.gameCode.value,code,'no transforma ni trunca el código a otra sala');
 }
});

test('código inexistente se explica junto al campo y no se atribuye a los nombres de empresa',async()=>{
 const f=form({success:false,code:'PARTIDA_NO_ENCONTRADA'});
 f.fields.gameCode.value=' side-wg2 ';
 await f.context.submit({preventDefault(){}});
 assert.equal(f.calls,1);
 assert.equal(f.fields.gameCode.value,'SIDE-WG2');
 assert.match(f.message,/No existe una partida/);
 assert.equal(f.fields.gameCodeError.textContent,f.message);
 assert.equal(f.logs.length,0);
});
test('un código retirado se explica junto al campo y exige el código de una sala nueva',async()=>{
 const f=form({success:false,code:'CODIGO_RETIRADO'});f.fields.gameCode.value='SIDE-RX8';
 await f.context.submit({preventDefault(){}});
 assert.equal(f.calls,1);assert.match(f.message,/sala anterior.*ya no se puede utilizar.*sala nueva/);
 assert.equal(f.fields.gameCodeError.textContent,f.message);assert.equal(f.fields.gameCode.attributes['aria-invalid'],'true');
});

test('la identidad exacta y la restricción de reingreso tras inicio se conservan',async()=>{
 for(const [code,expected] of [['CREDENCIALES_INVALIDAS',/mayúsculas y tildes/],['PARTIDA_INICIADA',/Solo pueden reingresar/],['PARTIDA_CANCELADA',/fue cancelada/],['PARTIDA_FINALIZADA',/ya finalizó/]]){
  const f=form({success:false,code});f.fields.gameCode.value='SIDE-000';
  await f.context.submit({preventDefault(){}});
  assert.equal(f.calls,1);assert.match(f.message,expected);
  assert.equal(f.fields.gameCode.attributes['aria-invalid'],'false');
 }
});

test('el servicio rechaza códigos inválidos antes de consultar capacidades o ingresar una empresa',async()=>{
 let calls=0;
 const window={SIDE:{SupabaseClient:{get:()=>({rpc:async()=>{calls++;return {data:{waitingRoomVersion:3,exactIdentityVersion:2}};}})}}};
 vm.runInNewContext(serviceSource,{window,console});
 for(const codigo of ['SIDE-WG2SIDE','SÍDE-WG2','SIDE-WG2 SIDE','SIDE-WG2!']){
  const result=await window.SIDE.EmpresaService.ingresar({codigo,nombreLegal:'demo1',nombreComercial:'demo1'});
  assert.equal(result.success,false);assert.equal(result.code,'CODIGO_INVALIDO');
 }
 assert.equal(calls,0);
});
