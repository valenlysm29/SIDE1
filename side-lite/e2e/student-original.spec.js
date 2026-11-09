import {test,expect} from '@playwright/test';
import path from 'node:path';

test('la ventana original conserva los controles y el envío de las cuatro decisiones', async ({page}) => {
  await page.setContent(`<main id="app"><div id="back"></div><section class="panel"><h2>Tienda</h2><form id="decision"><label>Calidad<select name="quality"><option value="basic">Básico</option><option value="premium">Prémium</option></select></label><div class="row"><label>Cantidad<input name="quantity" type="number" value="5"></label><label>Precio<input name="price" type="number" value="100"></label></div><section class="campaign-section"><input name="marketingAmount" value="200"></section><p id="estimate"></p><div class="inline"><button name="action" value="draft">Guardar</button><button name="action" value="confirm">Confirmar</button></div></form></section></main>`);
  await page.locator('#decision').evaluate(form=>form.addEventListener('input',()=>{form.dataset.inputSeen='yes'}));
  await page.addScriptTag({path:path.resolve('public/student-original.js')});
  await expect(page.locator('.decision-card')).toHaveCount(4);
  await expect(page.getByRole('navigation',{name:'Decisiones'}).getByRole('link')).toHaveCount(4);
  await page.locator('[name=quality]').selectOption('premium');
  await page.locator('[name=quantity]').fill('12');
  await page.locator('[name=price]').fill('150');
  await page.locator('[name=marketingAmount]').fill('500');
  await expect(page.locator('#decision')).toHaveAttribute('data-input-seen','yes');
  const fields=await page.locator('#decision').evaluate(form=>Object.fromEntries(new FormData(form)));
  expect(fields).toEqual({quality:'premium',quantity:'12',price:'150',marketingAmount:'500'});
  await page.locator('#decision').evaluate(form=>form.addEventListener('submit',event=>{event.preventDefault();form.dataset.action=event.submitter.value}));
  await page.getByRole('button',{name:'Confirmar'}).click();
  await expect(page.locator('#decision')).toHaveAttribute('data-action','confirm');
});


for (const viewport of [{width:1280,height:900},{width:390,height:844}]) {
  test(`la sala conserva resumen y resultados en ${viewport.width}px`, async ({page}) => {
    await page.setViewportSize(viewport);
    await page.setContent(`<main id="app"><div class="toolbar"><div><button id="back">Mis partidas</button><h1>Partida</h1></div><div><strong>Código: PRUEBA</strong><p id="clock">1:30</p></div></div><section class="summary"><div><span>Ciclo</span><strong>1 de 3</strong></div></section><p class="event-note">Sin evento</p><div class="layout"><section class="panel"><h2>Tienda</h2><p>Espera al docente</p></section><aside><section class="panel"><h2>Clasificación</h2><table><tr><td>Empresa</td><td>10 %</td></tr></table></section><section class="panel"><h2>Resultados</h2><p>Ciclo 1</p><details><summary>Ver detalle económico</summary><p>Venta S/ 100</p></details></section></aside></div></main>`);
    await page.addStyleTag({path:path.resolve('public/style.css')});
    await page.addStyleTag({path:path.resolve('public/student-original.css')});
    await page.addScriptTag({path:path.resolve('public/student-original.js')});
    await expect(page.locator('.student-lobby-logo')).toHaveCount(1);
    await expect(page.locator('.student-ranking')).toContainText('Empresa');
    await page.getByText('Ver detalle económico').click();
    await expect(page.getByText('Venta S/ 100')).toBeVisible();
    await expect(page.locator('#clock')).toHaveText('1:30');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('barra de decisiones vuelve a sala y envía el formulario existente', async ({page}) => {
 await page.setContent(`<main id="app"><div class="toolbar"><button id="back">Mis partidas</button><p id="clock">Tiempo oficial: 1:59</p></div><div class="layout"><section class="panel"><h2>Tienda</h2><p>Caja: <strong>S/ 30,000</strong></p><form id="decision"><label>Calidad<select name="quality"><option value="basic">Básico</option></select></label><div class="row"><label>Cantidad<input name="quantity" value="0"></label><label>Precio<input name="price" value="100"></label></div><section class="campaign-section"><input name="marketingAmount" value="0"></section><div class="inline"><button name="action" value="draft">Guardar</button><button name="action" value="confirm">Confirmar</button></div></form></section><aside></aside></div></main>`);
 await page.locator('#decision').evaluate(form=>form.addEventListener('submit', e=>{e.preventDefault();form.dataset.action=e.submitter.value}));
 await page.addScriptTag({path:path.resolve('public/student-original.js')});
 await expect(page.locator('.lite-clock')).toHaveText('1:59');
 await page.getByRole('button',{name:'Volver a la sala'}).click();
 await expect(page.locator('#app')).not.toHaveClass(/lite-decision-active/);
 await page.getByRole('button',{name:'ENTRAR AL MENÚ DE DECISIONES'}).click();
 await expect(page.locator('#app')).toHaveClass(/lite-decision-active/);
 await page.getByRole('button',{name:'ENVIAR TODO'}).click();
 await expect(page.locator('#decision')).toHaveAttribute('data-action','confirm');
 await page.locator('#clock').evaluate(node=>node.textContent='Tiempo oficial: 1:00');
 await expect(page.locator('.lite-clock')).toHaveText('1:00');
});
