/* El evento load indica que terminó la carga de los recursos de la página;
   no se simulan porcentajes intermedios ni se bloquea la navegación. */
(() => {
  const progress = document.getElementById('landingProgress');
  const text = document.getElementById('landingProgressText');
  if (!progress || !text) return;
  const complete = () => {
    progress.classList.add('is-complete');
    progress.setAttribute('aria-valuenow', '100');
    progress.setAttribute('aria-valuetext', 'Página cargada');
    text.textContent = '100%';
  };
  if (document.readyState === 'complete') complete();
  else window.addEventListener('load', complete, { once: true });
})();
