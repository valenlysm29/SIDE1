const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');

const server=http.createServer((request,response)=>{
  let file;
  try{file=path.resolve(root,'.'+decodeURIComponent(new URL(request.url,'http://localhost').pathname))}
  catch{response.writeHead(400).end();return}
  if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return}
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404).end();return}
  response.setHeader('Content-Type',/\.(m?js)$/.test(file)?'application/javascript':'text/html');
  fs.createReadStream(file).pipe(response);
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try{
    const page=await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
    const result=await page.evaluate(async()=>{
      const THREE=await import('three');
      const {Pathfinding}=await import('./vendor/three-pathfinding.module.js');
      const {buildNpcGridNavmesh}=await import('./services/npc_navmesh_grid.mjs');
      const {createOptionalNpcNavigator}=await import('./services/npc_optional_navigation.mjs');
      const obstacles=[{minX:-1,maxX:1,minZ:-1,maxZ:1}];
      const {geometry,stats}=buildNpcGridNavmesh({THREE,bounds:{minX:-6,maxX:6,minZ:-6,maxZ:6},obstacles,cellSize:1});
      const navigation=createOptionalNpcNavigator({THREE,Pathfinding,geometry,obstacles});
      return {ready:navigation.ready,stats,path:navigation.plan({x:-4,z:0},{x:4,z:0})};
    });
    assert.equal(result.ready,true);
    assert.equal(result.stats.blocked,16);
    assert.ok(result.path.length>=3,`obstacle was not routed around: ${JSON.stringify(result.path)}`);
    assert.ok(result.path.some(point=>Math.abs(point[1])>=2));
    assert.deepEqual(result.path.at(-1),[4,0]);
    console.log(JSON.stringify(result));
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>server.close());
