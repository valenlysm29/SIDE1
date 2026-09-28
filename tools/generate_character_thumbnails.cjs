'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const {chromium}=require(path.join(root,'tests/node_modules/playwright'));
const output=path.join(root,'assets/characters/thumbnails');
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
const server=http.createServer((request,response)=>{
  const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404).end();return;}
  response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(response);
});
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    for(const id of ['chico1','chico2','chico3','mona']){
      const page=await browser.newPage({viewport:{width:512,height:640},deviceScaleFactor:1});
      await page.goto(`http://127.0.0.1:${server.address().port}/tools/character_thumbnail_renderer.html?id=${id}`,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.thumbnailReady,{timeout:60000});
      const data=await page.evaluate(()=>window.exportThumbnail());
      const match=/^data:image\/webp;base64,(.+)$/.exec(data);if(!match)throw Error(`WebP no disponible para ${id}`);
      const file=path.join(output,`${id}.webp`);fs.writeFileSync(file,Buffer.from(match[1],'base64'));console.log(`${id}: ${fs.statSync(file).size} bytes`);
      await page.close();
    }
  }finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
