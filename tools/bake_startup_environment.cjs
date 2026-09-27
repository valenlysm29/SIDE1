// Bake the existing Three.js studio lighting once, rather than on every entry.
// Run from SIDE1: node tools/bake_startup_environment.cjs
const {chromium}=require('../tests/node_modules/playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  if(req.url==='/favicon.ico'){res.writeHead(204).end();return;}
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script>');return;}
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type','application/javascript');fs.createReadStream(file).pipe(res);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage(),errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const data=await page.evaluate(async()=>{
      const T=await import('three'),{RoomEnvironment}=await import('three/addons/environments/RoomEnvironment.js');
      const renderer=new T.WebGLRenderer(),room=new RoomEnvironment(),generator=new T.PMREMGenerator(renderer);
      const target=generator.fromScene(room,.06,.1,100,{size:128});
      const pixels=new Uint16Array(target.width*target.height*4);
      renderer.readRenderTargetPixels(target,0,0,target.width,target.height,pixels);
      const bytes=new Uint8Array(pixels.buffer);let binary='';
      for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      const result={width:target.width,height:target.height,pixels:btoa(binary),energy:pixels.reduce((sum,n,i)=>sum+(i%4===3?0:T.DataUtils.fromHalfFloat(n)),0)};
      target.dispose();generator.dispose();room.dispose();renderer.dispose();return result;
    });
    if(errors.length||!Number.isFinite(data.energy)||data.energy<=0)throw Error(JSON.stringify({errors,energy:data.energy}));
    const header=Buffer.alloc(16);header.write('SIDE');header.writeUInt32LE(1,4);header.writeUInt32LE(data.width,8);header.writeUInt32LE(data.height,12);
    const result=Buffer.concat([header,Buffer.from(data.pixels,'base64')]);
    const directory=path.join(root,'assets/environments');fs.mkdirSync(directory,{recursive:true});
    fs.writeFileSync(path.join(directory,'studio-128.bin'),result);
    console.log(JSON.stringify({width:data.width,height:data.height,bytes:result.length,energy:data.energy}));
  }finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
