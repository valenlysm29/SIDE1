/* Estructura de la ventana de decisiones de SIDE, conectada al formulario real de Lite. */
const app = document.querySelector('#app');
const icons = 'assets/original/categories/';
function card(title, icon, id, node) {
  const section = document.createElement('section');
  section.className = 'decision-card';
  section.id = id;
  const head = document.createElement('div');
  head.className = 'decision-card-art';
  const image = document.createElement('img'); image.src = icons + icon; image.alt = '';
  const text = document.createElement('div');
  const heading = document.createElement('h3'); heading.textContent = title;
  text.append(heading); head.append(image, text); section.append(head, node);
  return section;
}
function enhanceStudent() {
  const form = app.querySelector('#decision');
  if (!form || form.dataset.sideOriginal) return;
  form.dataset.sideOriginal = 'true';
  const panel = form.closest('.panel'); panel.classList.add('lite-student-decisions', 'decision-window');
  const title = document.createElement('div'); title.className = 'decision-detail-head';
  title.innerHTML = '<div class="detail-heading"><img src="' + icons + 'canales_ventas.svg" alt=""><div><span>SECCIÓN DE DECISIÓN</span><h1>Decisiones de tu empresa</h1><p>Prepara y confirma tus decisiones para este ciclo.</p></div></div>';
  panel.insertBefore(title, form);
  const nav = document.createElement('nav'); nav.className = 'decision-tabs'; nav.setAttribute('aria-label', 'Decisiones');
  for (const [id, label, icon] of [['lite-quality','Calidad','insumos.svg'], ['lite-quantity','Cantidad','inversiones.svg'], ['lite-price','Precio','canales_ventas.svg'], ['lite-marketing','Marketing','finanzas.svg']]) {
    const link = document.createElement('a'); link.href = '#' + id;
    const img = document.createElement('img'); img.src = icons + icon; img.alt = '';
    const span = document.createElement('span'); span.textContent = label; link.append(img, span);
    link.addEventListener('click', event => { event.preventDefault(); document.getElementById(id)?.scrollIntoView({behavior: 'smooth', block:'start'}); });
    nav.append(link);
  }
  panel.insertBefore(nav, title);
  const quality = form.querySelector('select[name=quality]').closest('label');
  const row = form.querySelector('.row');
  const quantity = row.querySelector('input[name=quantity]').closest('label');
  const price = row.querySelector('input[name=price]').closest('label');
  const marketing = form.querySelector('.campaign-section');
  const cards = document.createElement('div'); cards.className = 'decision-cards';
  form.insertBefore(cards, quality);
  cards.append(card('Calidad', 'insumos.svg', 'lite-quality', quality), card('Cantidad', 'inversiones.svg', 'lite-quantity', quantity), card('Precio', 'canales_ventas.svg', 'lite-price', price), card('Marketing', 'finanzas.svg', 'lite-marketing', marketing));
  row.remove();
  const actions = form.querySelector('.inline'); if (actions) actions.classList.add('section-save-bar');
}
new MutationObserver(enhanceStudent).observe(app, {childList: true});
enhanceStudent();

/* La sala y los informes usan los datos y controles ya rendereados por Lite. */
function enhanceStudentGame() {
  if (!app.querySelector('#back') || app.querySelector('#start') || app.querySelector('.lite-teacher-shell')) { app.classList.remove('lite-student-lobby'); return; }
  const toolbar = app.querySelector(':scope > .toolbar');
  const layout = app.querySelector(':scope > .layout');
  if (!toolbar || !layout || layout.dataset.studentLobby) return;
  layout.dataset.studentLobby = 'true';
  app.classList.add('lite-student-lobby');
  toolbar.classList.add('student-lobby-header');
  const logo = document.createElement('img');
  logo.className = 'student-lobby-logo';
  logo.src = 'assets/logo-side-original-pdf.png';
  logo.alt = 'SIDE';
  toolbar.prepend(logo);
  const primary = layout.querySelector(':scope > .panel');
  const aside = layout.querySelector(':scope > aside');
  if (primary) primary.classList.add('student-lobby-primary');
  if (aside) {
    aside.classList.add('student-lobby-reports');
    const [ranking, results] = aside.querySelectorAll(':scope > .panel');
    ranking?.classList.add('student-ranking');
    results?.classList.add('student-results');
  }
  app.querySelector(':scope > .summary')?.classList.add('student-cycle-summary');
  app.querySelector(':scope > .event-note')?.classList.add('student-news');
}
new MutationObserver(enhanceStudentGame).observe(app, {childList:true});
enhanceStudentGame();

/* La partida activa usa la barra y el escenario de decisiones de SIDE. */
function installDecisionStage() {
  const form = app.querySelector('#decision');
  if (!form) { app.classList.remove('lite-decision-active'); return; }
  if (app.querySelector('.lite-decision-topbar')) return;
  const panel = form.closest('.panel');
  const originalClock = app.querySelector('#clock');
  const topbar = document.createElement('header');
  topbar.className = 'lite-decision-topbar';
  topbar.innerHTML = `<div class="lite-decision-identity"><button type="button" class="lite-return-lobby" aria-label="Volver a la sala">←</button><div><strong>DECISIONES</strong><small>CICLO · TU EMPRESA</small></div></div><div class="lite-decision-metrics"><div><span>CAJA / EFECTIVO</span><strong class="lite-cash"></strong><small>Disponible para decidir</small></div><div><span>TIEMPO DEL CICLO</span><strong class="lite-clock"></strong></div></div><div class="lite-decision-actions"><div><span>PROGRESO</span><strong>Plan pendiente de confirmar</strong></div><button type="button" class="lite-send-all">✓ ENVIAR TODO</button></div>`;
  const cash = panel.querySelector(':scope > p strong');
  topbar.querySelector('.lite-cash').textContent = cash?.textContent || '';
  const clock = topbar.querySelector('.lite-clock');
  const syncClock = () => { clock.textContent = originalClock?.textContent.replace('Tiempo oficial: ', '') || '—'; };
  if (originalClock) new MutationObserver(syncClock).observe(originalClock, {childList:true,characterData:true,subtree:true});
  syncClock();
  const show = active => { app.classList.toggle('lite-decision-active', active); };
  topbar.querySelector('.lite-return-lobby').addEventListener('click', () => show(false));
  topbar.querySelector('.lite-send-all').addEventListener('click', () => form.requestSubmit(form.querySelector('[name=action][value=confirm]')));
  const toolbar = app.querySelector(':scope > .toolbar');
  const open = document.createElement('button'); open.type='button'; open.className='lite-enter-decisions'; open.textContent='ENTRAR AL MENÚ DE DECISIONES';
  open.addEventListener('click', () => show(true));
  toolbar?.append(open);
  app.prepend(topbar);
  show(true);
}
new MutationObserver(installDecisionStage).observe(app, {childList:true});
installDecisionStage();
