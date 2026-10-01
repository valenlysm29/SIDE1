'use strict';
// One ephemeral local server; no remote account or production storage is used.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const server=http.createServer((request,response)=>{
  let file;
  try{file=path.resolve(root,'.'+decodeURIComponent(new URL(request.url,'http://localhost').pathname));}catch{response.writeHead(400).end();return;}
  if(file===root)file=path.join(root,'index.html');
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404).end();return;}
  response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(file).pipe(response);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const output=path.join(__dirname,'output/continuous');fs.mkdirSync(output,{recursive:true});
  const scripts=process.argv.slice(2);
  const suites=scripts.length?scripts:['playable_hub.cjs','continuous_world.cjs','gameplay_hud.cjs','world_business_ui.cjs','world_cycle_restart.cjs','world_startup.cjs','world_loading.cjs','world_entry_assets.cjs','supplied_npcs.cjs','mona_npc.cjs','npc_locomotion.cjs','game_lifecycle_db.cjs','game_observations_db.cjs','game_lifecycle_ui.cjs','decisions_cycle_ui.cjs','teacher_lifecycle_ui.cjs','tablet_return_browser.cjs','npc_world_fixes_browser.cjs','world_orientation_mobile.cjs'];
  const results=[];
  try{
    for(const script of suites){
      const start=Date.now();console.log(`RUN ${script}`);
      const log=fs.createWriteStream(path.join(output,script+'.log'));
      const child=spawn(process.execPath,[path.join(__dirname,script)],{cwd:root,env:{...process.env,SIDE_TEST_URL:`http://127.0.0.1:${server.address().port}/`},stdio:['ignore','pipe','pipe']});
      for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{process.stdout.write(chunk);log.write(chunk);});
      const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
      await new Promise(resolve=>log.end(resolve));
      results.push({suite:script,passed:code===0,durationMs:Date.now()-start});
      fs.writeFileSync(path.join(output,'regression.json'),JSON.stringify(results,null,2));
    }
    if(results.some(result=>!result.passed))process.exitCode=1;
    console.log(JSON.stringify(results,null,2));
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
