import { test, expect } from '@playwright/test';

test.use({ channel: 'chrome' });

for (const viewport of [{width:1280,height:900},{width:390,height:844}]) {
 test(`panel docente conserva controles y navegación ${viewport.width}`, async ({page}) => {
  await page.setViewportSize(viewport);
  await page.route('**/api/**', route => route.fulfill({status: 401, contentType: 'application/json', body: '{"error":"Sin sesión"}'}));
  await page.goto(process.env.SIDE_LITE_TEST_BASE || 'http://127.0.0.1:4178/');
  await page.locator('#login').waitFor({state:'attached'});
  await page.evaluate(async () => {
    const app=document.querySelector('#app');
    app.innerHTML='<div class="toolbar"><div><button id="back">Mis partidas</button><h1>Partida de prueba</h1></div><div><strong>Código: ABC</strong><p id="clock"></p></div></div><section class="summary"><div>Ciclo 1</div></section><p class="event-note">Sin evento</p><p class="processing hidden">Procesando</p><div class="layout"><section class="panel"><h2>Supervisión</h2><button id="start">Iniciar ciclo</button><table><tr><td>Empresa</td></tr></table></section><aside><section class="panel"><h2>Clasificación</h2><p>Ranking</p></section><section class="panel"><h2>Resultados</h2><p>Resultado</p></section></aside></div>';
    const {renderTeacherGame}=await import('/teacher-original.js'); renderTeacherGame(app);
  });
  await expect(page.getByRole('heading',{name:'Partida de prueba'})).toBeVisible();
  await expect(page.locator('#start')).toBeVisible();
  await page.getByRole('button',{name:'Empresas',exact:true}).click();
  await expect(page.locator('[data-teacher-tab="empresas"] table')).toBeVisible();
  await expect(page.locator('#start')).toBeHidden();
  await page.getByRole('button',{name:'Resultados',exact:true}).click();
  await expect(page.getByText('Resultado',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Ganador y podio'}).click();
  await expect(page.getByText('Ranking',{exact:true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 });
}

test('configuración conserva campos, valores y eventos', async ({page}) => {
 await page.route('**/api/**', route => route.fulfill({status: 401, contentType: 'application/json', body: '{"error":"Sin sesión"}'}));
  await page.goto(process.env.SIDE_LITE_TEST_BASE || 'http://127.0.0.1:4178/');
  await page.locator('#login').waitFor({state:'attached'});
 await page.evaluate(async () => {
  const app=document.querySelector('#app');
  app.innerHTML='<div class="toolbar"><h1>Mis partidas</h1></div><div class="layout"><section class="panel"><h2>Partidas disponibles</h2><button data-game="42">Partida</button></section><section class="panel"><h2>Crear partida</h2><form id="create"><input name="name" value="Simulación"><button type="submit">Crear partida</button></form></section></div>';
  document.querySelector('#create').addEventListener('submit', e => {e.preventDefault();window.sideFormSubmitted = e.target.elements.name.value});
  document.querySelector('[data-game]').addEventListener('click', () => {window.sideGameOpened = '42'});
  const {renderTeacherHome}=await import('/teacher-original.js'); renderTeacherHome(app);
 });
 await expect(page.locator('#create [name=name]')).toHaveValue('Simulación');
 await page.locator('#create button').click();
 expect(await page.evaluate(() => window.sideFormSubmitted)).toBe('Simulación');
 await page.getByRole('button',{name:'Mis partidas',exact:true}).click();
 await page.locator('[data-game="42"]').click();
 expect(await page.evaluate(() => window.sideGameOpened)).toBe('42');
});



test('configuración agrupa campos reales sin alterar valores ni envío', async ({page}) => {
 await page.route('**/api/**', route => route.fulfill({status:401,contentType:'application/json',body:'{"error":"Sin sesión"}'}));
 await page.goto(process.env.SIDE_LITE_TEST_BASE || 'http://127.0.0.1:4178/');
 await page.locator('#login').waitFor({state:'attached'});
 await page.evaluate(async()=>{
  const app=document.querySelector('#app');
  app.innerHTML=`<div class="layout"><section class="panel">Partidas</section><section class="panel"><h2>Crear</h2><form id="create"><label>Nombre<input name="name" value="Prueba"></label><div class="row"><label>Ciclos<select name="cycleCount"><option>3</option></select></label><label>Segundos<input name="duration" value="120"></label></div><div class="row"><input name="capitalMin" value="30000"><input name="capitalMax" value="100000"></div><div class="row"><input name="basic" value="50"><input name="standard" value="80"><input name="premium" value="120"></div><strong>Eventos activos</strong><div class="events"><label><input type="checkbox" name="events" value="evento" checked>Evento</label></div><p><button>Crear partida</button></p></form></section></div>`;
  document.querySelector('#create').addEventListener('submit',e=>{e.preventDefault();window.created=Object.fromEntries(new FormData(e.target))});
  const {renderTeacherHome}=await import('/teacher-original.js');renderTeacherHome(app);
 });
 await expect(page.locator('.lite-teacher-config-card')).toHaveCount(5);
 await page.locator('#create [name=name]').fill('Nueva');
 await page.locator('#create button').click();
 expect(await page.evaluate(()=>window.created)).toEqual({name:'Nueva',cycleCount:'3',duration:'120',capitalMin:'30000',capitalMax:'100000',basic:'50',standard:'80',premium:'120',events:'evento'});
});
