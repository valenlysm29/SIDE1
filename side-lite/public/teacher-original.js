/* Adaptación del panel docente de SIDE a los datos disponibles en SIDE Lite. */
let selectedGameTab = 'rondas';
const tabs = {
  configuracion: ['Configuración', 'configuracion'],
  rondas: ['Rondas y eventos', 'rondas'],
  empresas: ['Empresas', 'empresas'],
  resultados: ['Resultados', 'resultados'],
  podio: ['Ganador y podio', 'podio'],
  partidas: ['Mis partidas', 'decisiones']
};
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
function shell(app, tabNames, initial, onSelect, onBack) {
  const frame = el('div', 'lite-teacher-shell');
  const sidebar = el('aside', 'lite-teacher-sidebar');
  const brand = el('div', 'lite-teacher-brand', 'SIDE');
  const nav = el('nav', 'lite-teacher-nav');
  nav.setAttribute('aria-label', 'Secciones del panel docente');
  const content = el('div', 'lite-teacher-content');
  const panels = new Map();
  const buttons = new Map();
  function select(name) {
    for (const [key, panel] of panels) panel.hidden = key !== name;
    for (const [key, button] of buttons) {
      button.classList.toggle('active', key === name);
      if (key === name) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    onSelect?.(name);
  }
  for (const name of tabNames) {
    const [label, icon] = tabs[name];
    const button = el('button', 'lite-teacher-nav-btn');
    button.type = 'button';
    const image = el('img'); image.src = `assets/teacher/${icon}.svg`; image.alt = '';
    button.append(image, el('span', '', label));
    button.addEventListener('click', () => select(name));
    nav.append(button); buttons.set(name, button);
    const panel = el('section', 'lite-teacher-view'); panel.dataset.teacherTab = name;
    content.append(panel); panels.set(name, panel);
  }
  sidebar.append(brand, nav);
  if (onBack) {
    const back = el('button', 'lite-teacher-back', '←  Volver al inicio'); back.type = 'button';
    back.addEventListener('click', onBack); sidebar.append(back);
  }
  const signOut = el('button', 'lite-teacher-signout', 'Cerrar sesión'); signOut.type = 'button';
  signOut.addEventListener('click', () => document.querySelector('#logout')?.click());
  sidebar.append(signOut);
  frame.append(sidebar, content); app.replaceChildren(frame);
  select(initial);
  return { panels };
}
function header(title, subtitle) {
  const bar = el('div', 'lite-teacher-topbar');
  const mark = el('p', 'lite-teacher-eyebrow', 'SIMULADOR DE DECISIONES FINANCIERAS');
  const h = el('h1', '', title); bar.append(mark, h);
  if (subtitle) bar.append(el('p', 'lite-teacher-subtitle', subtitle));
  return bar;
}
/** Reubica los formularios existentes; sus identificadores y eventos se conservan. */
export function renderTeacherHome(app) {
  const layout = app.querySelector(':scope > .layout');
  if (!layout) return;
  const [games, configuration] = [...layout.children];
  if (!games || !configuration) return;
  const {panels} = shell(app, ['configuracion', 'partidas'], 'configuracion');
  const configPanel = panels.get('configuracion');
  const hero = el('div', 'lite-teacher-hero');
  const intro = el('div');
  intro.append(el('span', 'lite-teacher-eyebrow', 'PARTIDA'), el('h2', '', 'Configuración de la simulación'),
    el('p', '', 'Configura la partida y comparte el código con tus estudiantes.'));
  hero.append(intro, el('div', 'lite-teacher-hero-mark', 'SIDE'));
  const status = el('div', 'lite-teacher-info', 'Configura los apartados para crear una partida.');
  configPanel.append(header('Configuración de la simulación'), status, hero, configuration);
  arrangeConfiguration(configuration);
  panels.get('partidas').append(header('Mis partidas'), games);
}
/** Presenta los campos existentes en las tarjetas del panel original sin duplicarlos. */
function arrangeConfiguration(configuration) {
  const form = configuration.querySelector('#create');
  if (!form || !form.elements.cycleCount) return;
  const labels = [...form.children];
  const find = name => labels.find(node => node.matches('label') && node.querySelector(`[name="${name}"]`));
  const rows = [...form.querySelectorAll(':scope > .row')];
  const row = name => rows.find(node => node.querySelector(`[name="${name}"]`));
  const events = form.querySelector(':scope > .events');
  const eventTitle = events?.previousElementSibling;
  const submit = form.querySelector(':scope > p:last-child');
  const grid = el('div', 'lite-teacher-config-grid');
  function card(title, badge, nodes) {
    const article = el('article', 'lite-teacher-config-card');
    const head = el('div', 'lite-teacher-card-title');
    head.append(el('h3', '', title), el('span', '', badge));
    article.append(head, ...nodes.filter(Boolean)); grid.append(article);
  }
  card('Identificación', 'Partida', [find('name')]);
  card('Duración y ciclos', 'Tiempo', [row('cycleCount')]);
  card('Caja / efectivo', 'Capital inicial', [row('capitalMin')]);
  card('Costo de productos', 'Calidad', [row('basic')]);
  if (events) card('Eventos habilitados', 'Eventos', [eventTitle, events]);
  form.prepend(grid);
  if (submit) { submit.classList.add('lite-teacher-config-actions'); form.append(submit); }
  configuration.classList.add('lite-teacher-configuration');
}
/** Agrupa supervisión, empresas, resultados y ranking sin duplicar datos de la API. */
export function renderTeacherGame(app) {
  const toolbar = app.querySelector(':scope > .toolbar');
  const summary = app.querySelector(':scope > .summary');
  const note = app.querySelector(':scope > .event-note');
  const notice = app.querySelector(':scope > .processing');
  const layout = app.querySelector(':scope > .layout');
  if (!toolbar || !summary || !layout) return;
  const control = layout.querySelector(':scope > .panel');
  const aside = layout.querySelector(':scope > aside');
  const [ranking, results] = aside ? [...aside.children] : [];
  const table = control?.querySelector('table');
  if (!control || !ranking || !results || !table) return;
  const back = toolbar.querySelector('#back');
  const gameName = toolbar.querySelector('h1')?.textContent || 'Partida';
  const {panels} = shell(app, ['rondas', 'empresas', 'resultados', 'podio'], selectedGameTab,
    name => { selectedGameTab = name; }, () => back?.click());
  const bar = header(gameName);
  const identity = el('div', 'lite-teacher-game-identity');
  while (toolbar.lastElementChild && toolbar.lastElementChild !== toolbar.firstElementChild)
    identity.prepend(toolbar.lastElementChild);
  bar.append(identity);
  const common = el('div', 'lite-teacher-common'); if (back) { back.hidden = true; common.append(back); } common.append(bar, summary);
  if (note) common.append(note);
  if (notice) common.append(notice);
  app.querySelector('.lite-teacher-content').prepend(common);
  const companies = el('article', 'panel');
  companies.append(el('h2', '', 'Empresas'), table);
  panels.get('rondas').append(control);
  panels.get('empresas').append(companies);
  panels.get('resultados').append(results);
  panels.get('podio').append(ranking);
}



/* Encabezados y presentación de sección del panel docente original. */
function sectionHeading(title, icon, eyebrow = '', description = '') {
  const section = el('div', 'lite-teacher-section-head');
  if (eyebrow) {
    const text = el('div');
    text.append(el('span', 'lite-teacher-eyebrow', eyebrow), el('h2', '', title));
    section.append(text);
    return section;
  }
  const image = el('img'); image.src = `assets/teacher/${icon}.svg`; image.alt = '';
  const box = el('span', 'lite-teacher-section-icon'); box.append(image);
  const text = el('div'); text.append(el('h2', '', title));
  if (description) text.append(el('p', '', description));
  section.append(box, text); return section;
}