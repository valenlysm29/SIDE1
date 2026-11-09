const app = document.querySelector('#app');
let entered = false;
const observer = new MutationObserver(() => {
  const login = app.querySelector('#login');
  const register = app.querySelector('#register');
  if (!login || !register || app.querySelector('#profiles')) return;
  observer.disconnect();
  const verify = app.querySelector('#verify-code');
  const loginPanel = login.closest('.panel');
  const registerPanel = register.closest('.panel');
  const localRole = register.elements.role;
  const shell = document.createElement('div');
  shell.innerHTML = `<section id="landing" class="lite-screen"><img class="landing-faculty-logo" src="assets/logo-ciencias-ingenieria.png" alt="Ciencias e Ingeniería Cayetano"><div class="landing-content"><img class="landing-wordmark" src="assets/logo-side-original-pdf.png" alt="SIDE"><p class="landing-subtitle">Simulador de Decisiones Financieras</p><div class="loading-wrap"><div class="landing-progress is-complete" role="progressbar" aria-label="Carga de la página" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><div class="landing-progress-fill"></div><span>100%</span></div><button class="start-link" type="button">EMPEZAR</button></div></div></section><section id="profiles" class="lite-screen hidden"><img class="profile-faculty-logo" src="assets/logo-ciencias-ingenieria.png" alt="Ciencias e Ingeniería Cayetano"><div class="profile-main"><img class="profile-side-logo" src="assets/logo-side-original-pdf.png" alt="SIDE"><h1 class="profile-title">Elige cómo entrar</h1><div class="profile-cards"><button class="profile-card student-hero" data-profile="student" type="button"><img class="student-hero-img" src="assets/icons/profile-person.webp" alt=""><span class="profile-copy"><span class="hero-eyebrow">Estudiante</span><span class="profile-description">Dirige tu empresa y decide en cada ciclo.</span><span class="hero-cta">Entrar a una partida</span></span></button><button class="profile-card teacher-mini" data-profile="teacher" type="button"><img class="teacher-mini-img" src="assets/icons/perfil-profesor.png" alt=""><span class="profile-copy"><span class="mini-eyebrow">Profesor</span><span class="profile-description">Administra una partida</span><span class="mini-cta">Iniciar sesión</span></span></button></div></div></section><div id="modalRoot" class="lite-modal-root hidden"><div class="modal-backdrop"></div><section class="modal" role="dialog" aria-modal="true" aria-labelledby="lite-auth-title"><button class="close-btn" type="button" aria-label="Cerrar">×</button><img class="modal-side-logo" src="assets/logo-side-original-pdf.png" alt="SIDE"><h2 id="lite-auth-title">Acceso</h2><p class="modal-lead">Ingresa a tu cuenta para continuar.</p><div id="lite-login"></div><div id="lite-register" class="hidden"></div><p class="switch-line"><button type="button" id="lite-switch">Crear cuenta</button></p></section></div>`;
  shell.querySelector('#lite-login').append(login);
  shell.querySelector('#lite-register').append(register);
  if (verify) shell.querySelector('#lite-register').append(verify);
  app.replaceChildren(...shell.childNodes);
  const landing = app.querySelector('#landing'), profiles = app.querySelector('#profiles'), modal = app.querySelector('#modalRoot');
  if (entered) { landing.classList.add('hidden'); profiles.classList.remove('hidden'); }
  app.querySelector('.start-link').onclick = () => { entered = true; landing.classList.add('hidden'); profiles.classList.remove('hidden'); };
  let profile = 'student';
  const show = registration => {
    app.querySelector('#lite-login').classList.toggle('hidden', registration);
    app.querySelector('#lite-register').classList.toggle('hidden', !registration);
    app.querySelector('#lite-auth-title').textContent = registration ? (profile === 'teacher' ? 'Registro del profesor' : 'Registro del estudiante') : (profile === 'teacher' ? 'Acceso del profesor' : 'Entrar a una partida');
    app.querySelector('#lite-switch').textContent = registration ? '¿Ya tienes cuenta? Iniciar sesión' : '¿No tienes cuenta? Crear cuenta';
  };
  app.querySelectorAll('[data-profile]').forEach(button => button.onclick = () => { profile = button.dataset.profile; if (localRole) { localRole.value = profile; localRole.dispatchEvent(new Event('change')); } show(false); modal.classList.remove('hidden'); });
  app.querySelector('#lite-switch').onclick = () => show(app.querySelector('#lite-register').classList.contains('hidden'));
  const close = () => modal.classList.add('hidden');
  app.querySelector('.close-btn').onclick = close;
  app.querySelector('.modal-backdrop').onclick = close;
  observer.observe(app, {childList:true});
});
observer.observe(app, {childList:true});
