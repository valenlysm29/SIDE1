const { chromium } = require('@playwright/test');
const {pathToFileURL} = require('url');
const fs = require('fs');
const path = require('path');
(async () => {
 const dir=path.resolve('tests/output/comparacion-original');fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.SIDE_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 for(const [name,width,height] of [['escritorio',1366,900],['movil',390,844]]){
  const context=await browser.newContext({viewport:{width,height}});
  const original=await context.newPage();await original.goto(pathToFileURL(path.resolve('.codex-work/actions34/index.html')).href,{waitUntil:'domcontentloaded'});await original.screenshot({path:path.join(dir,`original-portada-${name}.png`)});
  // El archivo local no puede inicializar los servicios; se muestran sus vistas existentes para comparación visual.
  await original.evaluate(()=>{document.querySelector('#landing').classList.add('hidden');document.querySelector('#profiles').classList.remove('hidden')});
  await original.screenshot({path:path.join(dir,`original-perfiles-${name}.png`)});
  await original.evaluate(()=>{document.querySelector('#modalRoot').classList.remove('hidden');document.querySelector('#teacherLoginModal').classList.remove('hidden')});
  await original.screenshot({path:path.join(dir,`original-acceso-${name}.png`)});
  const lite=await context.newPage();await lite.goto('http://127.0.0.1:4178/',{waitUntil:'networkidle'});await lite.locator('#landing').waitFor();await lite.screenshot({path:path.join(dir,`lite-portada-${name}.png`)});
  await lite.getByRole('button',{name:'EMPEZAR'}).click();await lite.locator('#profiles').waitFor();await lite.screenshot({path:path.join(dir,`lite-perfiles-${name}.png`)});
  await lite.getByRole('button',{name:/Profesor/}).click();await lite.locator('#login').waitFor();await lite.screenshot({path:path.join(dir,`lite-acceso-${name}.png`)});
  if(await lite.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error(`Desbordamiento en ${name}`);
  await context.close();
 }
 await browser.close();console.log('Portada, perfiles y acceso capturados en escritorio y móvil');
})().catch(e=>{console.error(e);process.exitCode=1});
