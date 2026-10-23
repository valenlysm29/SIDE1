'use strict';
// Included in the default Node regression suite, not only an optional QA script.
const test=require('node:test');
const path=require('node:path');
const {promisify}=require('node:util');
const execFile=promisify(require('node:child_process').execFile);
test('Todo el catálogo autorizado dispone de controles visibles, editables y guardado de borradores en las cinco pestañas de decisión actuales', {timeout:240000}, async()=>{
 try{await execFile(process.execPath,[path.join(__dirname,'restaurar_decisiones_catalogo.cjs')],{cwd:path.join(__dirname,'..'),timeout:220000,maxBuffer:1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});}
 catch(error){throw new Error((error.stdout||'')+(error.stderr||'')+error.message,{cause:error});}
});
