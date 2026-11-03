import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const sleep=n=>new Promise(r=>setTimeout(r,n)),base='http://127.0.0.1:4181';
const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'4181'},stdio:'ignore'});
try{let ready=false;for(let i=0;i<60;i++){try{ready=(await fetch(base+'/api/me')).status===401;if(ready)break}catch{}await sleep(200)}assert.ok(ready,'Servidor no inició');for(let i=0;i<21;i++){const r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'no-existe@side.test',password:'contraseña-incorrecta'})});assert.equal(r.status,i<20?401:429)}console.log('PASS: límite local de intentos aplicado al acceso')}finally{child.kill()}
