(function (root) {
  'use strict';
  const normalizeEmail = value => String(value || '').trim().toLowerCase();
  function institutionalEmail(value, exceptions = []) {
    const email = normalizeEmail(value);
    return /^[^\s@]+@upch\.pe$/.test(email) || exceptions.map(normalizeEmail).includes(email);
  }
  const api = { institutionalEmail, normalizeEmail };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SIDE_TEACHER_AUTH = api;
  if (!root.document) return;

  const byId = id => document.getElementById(id);
  const tell = (id, text, error = false) => {
    const node = byId(id);
    if (node) { node.textContent = text; node.classList.toggle('error', error); node.setAttribute('role', error ? 'alert' : 'status'); }
  };
  const exceptions = () => root.SIDE_CONFIG?.TEACHER_EMAIL_EXCEPTIONS || [];
  const allowed = email => institutionalEmail(email, exceptions());
  const domainMessage = 'Usa tu correo institucional @upch.pe. Si tienes una excepción autorizada, consulta al administrador.';
  function readableError(error, fallback) {
    if (/invalid login credentials/i.test(error?.message || '')) return 'El correo o la contraseña no coinciden. Revisa tus datos.';
    if (/email not confirmed/i.test(error?.message || '')) return 'Confirma tu correo antes de iniciar sesión.';
    if (/rate limit|too many|over_email_send_rate_limit/i.test(error?.message || error?.code || '')) return 'Has realizado varios intentos. Espera unos minutos y vuelve a intentar.';
    if (/correo institucional|dominio|upch\.pe/i.test(error?.message || '')) return domainMessage;
    return fallback;
  }
  async function busy(form, action) {
    const submit = form?.querySelector('[type="submit"]');
    if (submit?.disabled) return;
    if (submit) submit.disabled = true;
    try { await action(); } finally { if (submit) submit.disabled = false; }
  }
  document.querySelectorAll('[data-toggle-password]').forEach(button => button.addEventListener('click', () => {
    const input = byId(button.dataset.togglePassword);
    if (!input) return;
    const show = input.type === 'password'; input.type = show ? 'text' : 'password';
    button.textContent = show ? 'Ocultar contraseña' : 'Mostrar contraseña';
    button.setAttribute('aria-pressed', String(show)); button.setAttribute('aria-controls', input.id);
  }));
  byId('loginForm')?.addEventListener('submit', event => {
    event.preventDefault();
    busy(event.currentTarget, async () => {
      const email = normalizeEmail(byId('loginEmail').value), password = byId('loginPassword').value;
      if (!allowed(email)) { tell('loginMessage', domainMessage, true); return; }
      if (!hasConfig && email === DEMO_TEACHER.email && password === DEMO_TEACHER.password) { openTeacherPanel(); return; }
      if (!requireSupabase()) return;
      tell('loginMessage', 'Ingresando…');
      try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) { tell('loginMessage', readableError(error, 'No se pudo iniciar sesión. Revisa tus datos y vuelve a intentar.'), true); return; }
        openTeacherPanel();
      } catch (_) { tell('loginMessage', 'No se pudo conectar. Revisa tu conexión y vuelve a intentar.', true); }
    });
  });
  byId('registerForm')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    busy(form, async () => {
      const email = normalizeEmail(byId('registerEmail').value), password = byId('registerPassword').value;
      if (!allowed(email)) { tell('registerMessage', domainMessage, true); return; }
      if (password.length < 6) { tell('registerMessage', 'La contraseña debe tener al menos 6 caracteres.', true); return; }
      if (password !== byId('registerPasswordConfirm')?.value) { tell('registerMessage', 'Las contraseñas no coinciden. Vuelve a escribirlas.', true); byId('registerPasswordConfirm')?.focus(); return; }
      if (!requireSupabase()) return;
      tell('registerMessage', 'Creando cuenta…');
      try {
        const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { data: {
          nombre: byId('registerName').value.trim(), apellido: byId('registerLastName').value.trim(), curso: byId('registerCourse').value.trim()
        } } });
        if (error) { tell('registerMessage', readableError(error, 'No se pudo crear la cuenta. Revisa tu correo institucional y vuelve a intentar.'), true); return; }
        form.reset();
        if (data.session) openTeacherPanel();
        else tell('registerMessage', 'Solicitud recibida. Revisa tu correo para confirmar la cuenta.');
      } catch (_) { tell('registerMessage', 'No se pudo conectar. Revisa tu conexión y vuelve a intentar.', true); }
    });
  });
  byId('forgotPassword')?.addEventListener('click', async event => {
    const email = normalizeEmail(byId('loginEmail')?.value);
    if (!allowed(email)) { tell('recoveryMessage', 'Escribe tu correo institucional en el campo de correo para recuperar la contraseña.', true); return; }
    if (!requireSupabase()) return;
    const button = event.currentTarget; if (button.disabled) return; button.disabled = true;
    try {
      const redirect = new URL('index.html', root.location.href); redirect.searchParams.set('recuperar', '1');
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: redirect.href });
      tell('recoveryMessage', error ? readableError(error, 'No se pudo enviar el enlace. Espera unos minutos y vuelve a intentar.') : 'Si el correo tiene una cuenta, recibirás un enlace para cambiar tu contraseña.', !!error);
    } catch (_) { tell('recoveryMessage', 'No se pudo conectar. Vuelve a intentar.', true); }
    finally { button.disabled = false; }
  });
  let recoverySession = false;
  function showRecovery() {
    recoverySession = true;
    showModal('teacherLoginModal');
    byId('loginForm')?.classList.add('hidden');
    byId('passwordRecoveryForm')?.classList.remove('hidden');
    tell('recoveryUpdateMessage', 'Escribe y confirma tu nueva contraseña.');
    byId('recoveryPassword')?.focus();
  }
  supabaseClient?.auth.onAuthStateChange?.((event) => { if (event === 'PASSWORD_RECOVERY') showRecovery(); });
  // The SDK may finish reading the recovery link before this script subscribes.
  // Only show the form for an authenticated recovery redirect; no token is logged.
  if (new URLSearchParams(root.location.search).get('recuperar') === '1') {
    supabaseClient?.auth.getSession?.().then(({ data }) => { if (data?.session) showRecovery(); });
  }
  byId('passwordRecoveryForm')?.addEventListener('submit', event => {
    event.preventDefault();
    busy(event.currentTarget, async () => {
      const password = byId('recoveryPassword')?.value || '';
      if (!recoverySession) { tell('recoveryUpdateMessage', 'Abre el enlace de recuperación que recibiste por correo.', true); return; }
      if (password.length < 6 || password !== byId('recoveryPasswordConfirm')?.value) { tell('recoveryUpdateMessage', 'Escribe al menos 6 caracteres y confirma la misma contraseña.', true); return; }
      try {
        const { error } = await supabaseClient.auth.updateUser({ password });
        if (error) { tell('recoveryUpdateMessage', readableError(error, 'No se pudo guardar la contraseña. Solicita un nuevo enlace.'), true); return; }
        recoverySession = false;
        byId('passwordRecoveryForm')?.classList.add('hidden'); byId('loginForm')?.classList.remove('hidden');
        event.target.reset();
        tell('loginMessage', 'Contraseña actualizada. Ya puedes iniciar sesión.');
        root.history.replaceState({}, '', new URL('index.html', root.location.href).pathname);
      } catch (_) { tell('recoveryUpdateMessage', 'No se pudo conectar. Vuelve a intentar.', true); }
    });
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
