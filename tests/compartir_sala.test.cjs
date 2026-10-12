const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../js/docente.js'),'utf8');
function fixture({denyClipboard=false,compatible=true}={}){
 const fields={},copies=[],messages=[],temporary=[];
 const ctx={sharedRoom:null,URL,window:{location:{href:'https://side.test/SIDE1/docente.html'}},
  navigator:{clipboard:{writeText:async text=>{if(denyClipboard)throw new Error('permission');copies.push(text);}}},
  console:{warn(){},error(){}},toast:message=>messages.push(message),
  $:id=>fields[id]||(fields[id]={value:'',textContent:'',disabled:true,focus(){},select(){this.selected=true;}}),
  document:{body:{appendChild:field=>temporary.push(field)},createElement:()=>({style:{},select(){},remove(){this.removed=true;}}),execCommand:()=>{if(compatible)copies.push(temporary.at(-1).value);return compatible;}}
 };
 vm.createContext(ctx);
 const remember=source.slice(source.indexOf('function rememberSharedRoom('),source.indexOf('async function loadUsableRoom('));
 const invitation=source.slice(source.indexOf('async function copyInvitation('),source.indexOf("$('copyGameCode')?.addEventListener"));
 vm.runInContext(remember+invitation,ctx);
 return {ctx,copies,messages,fields,temporary};
}
test('copiar usa el código del servidor aunque el campo muestre texto concatenado',async()=>{
 const f=fixture();f.ctx.rememberSharedRoom({id:'real',codigo:'SIDE-WG2',estado:'esperando'});f.fields.gameCode.value='SIDE-WG2SIDE';
 await f.ctx.copyInvitation();await f.ctx.copyInvitation(true);
 assert.deepEqual(f.copies,['SIDE-WG2','https://side.test/SIDE1/index.html?partida=SIDE-WG2']);
});
test('rechazo del portapapeles moderno usa copia compatible y retira campo temporal',async()=>{
 const f=fixture({denyClipboard:true});f.ctx.rememberSharedRoom({id:'real',codigo:'SIDE-AA2',estado:'activa'});
 await f.ctx.copyInvitation();assert.deepEqual(f.copies,['SIDE-AA2']);assert.equal(f.temporary[0].removed,true);
});
test('al finalizar la sala confirmada se deshabilita compartir su código',async()=>{
 const f=fixture();f.ctx.rememberSharedRoom({id:'real',codigo:'SIDE-AA2',estado:'esperando'});f.ctx.rememberSharedRoom({id:'real',codigo:'SIDE-AA2',estado:'finalizada'});
 assert.equal(f.ctx.sharedRoom,null);await f.ctx.copyInvitation();assert.deepEqual(f.copies,[]);
});
test('si fallan ambos métodos selecciona el código real para copia manual',async()=>{
 const f=fixture({denyClipboard:true,compatible:false});f.ctx.rememberSharedRoom({id:'real',codigo:'SIDE-AA2',estado:'esperando'});f.fields.gameCode.value='SIDE-WG2SIDE';
 await f.ctx.copyInvitation();assert.equal(f.fields.gameCode.value,'SIDE-AA2');assert.equal(f.fields.gameCode.selected,true);assert.equal(f.temporary[0].removed,true);
});
