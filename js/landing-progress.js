/* El navegador no expone el progreso agregado de sus recursos. La barra se
   mantiene indeterminada hasta terminar la carga y preparar imágenes y fuentes. */
(() => {
  const progress = document.getElementById('landingProgress');
  const text = document.getElementById('landingProgressText');
  const button = document.getElementById('startBtn');
  if (!progress || !text || !button) return;
  const finish = async () => {
    try {
      await Promise.all([
        document.fonts.ready,
        ...Array.from(document.querySelectorAll('#landing img'), image => image.decode())
      ]);
      if (typeof showScreen !== 'function') throw new Error('No se pudo preparar la navegación');
      progress.classList.add('is-complete');
      progress.setAttribute('aria-valuenow', '100');
      progress.setAttribute('aria-valuetext', 'Página cargada');
      text.textContent = '100%';
      button.disabled = false;
    } catch (error) {
      progress.classList.add('has-error');
      progress.setAttribute('aria-valuetext', 'No se pudo completar la carga');
      text.textContent = 'No se pudo cargar';
      console.error('SIDE: error al preparar la portada', error);
    }
  };
  if (document.readyState === 'complete') finish();
  else window.addEventListener('load', finish, { once: true });
})();
