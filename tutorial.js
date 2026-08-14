(function () {
  "use strict";

  let tutorialCleanup = null;

  window.initSIDETutorial = function (onFinish) {
    const root = document.querySelector("#tutorial");
    const track = document.querySelector("#tutorialTrack");
    const slides = Array.from(document.querySelectorAll(".tutorial-slide"));
    const dots = document.querySelector("#tutorialDots");
    const prev = document.querySelector("#tutorialPrev");
    const next = document.querySelector("#tutorialNext");
    const skip = document.querySelector("#tutorialSkip");
    const continueBtn = document.querySelector("#tutorialContinue");
    const progress = document.querySelector("#tutorialProgressFill");
    const current = document.querySelector("#tutorialCurrent");

    if (!root || !track || !slides.length) return;

    if (tutorialCleanup) tutorialCleanup();

    let index = 0;
    let timer = null;
    let touchPaused = false;
    const AUTO_DELAY = 4800;

    dots.innerHTML = slides.map((_, i) =>
      `<button type="button" class="tutorial-dot${i === 0 ? " active" : ""}" aria-label="Ir a la diapositiva ${i + 1}" data-slide="${i}"></button>`
    ).join("");

    const dotButtons = Array.from(dots.querySelectorAll(".tutorial-dot"));

    function render() {
      track.style.transform = `translate3d(-${index * 100}%, 0, 0)`;
      slides.forEach((slide, i) => slide.classList.toggle("active", i === index));
      dotButtons.forEach((dot, i) => dot.classList.toggle("active", i === index));
      if (current) current.textContent = String(index + 1);
      if (progress) progress.style.width = `${((index + 1) / slides.length) * 100}%`;
      if (prev) prev.disabled = index === 0;
      if (next) next.disabled = index === slides.length - 1;
      if (continueBtn) {
        continueBtn.innerHTML = index === slides.length - 1
          ? `EMPEZAR A JUGAR <span>→</span>`
          : `CONTINUAR AL JUEGO <span>→</span>`;
      }
    }

    function stopTimer() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function scheduleAutoAdvance() {
      stopTimer();
      if (touchPaused) return;

      timer = setTimeout(() => {
        timer = null;
        if (index < slides.length - 1) {
          index += 1;
          render();
          scheduleAutoAdvance();
        } else {
          finish();
        }
      }, AUTO_DELAY);
    }

    function goTo(value) {
      if (value >= slides.length) {
        finish();
        return;
      }
      if (value < 0) value = 0;
      index = value;
      render();
      // Cada cambio manual reinicia el contador para que la siguiente tarjeta
      // también avance automáticamente.
      scheduleAutoAdvance();
    }

    function finish() {
      stopTimer();
      root.classList.add("tutorial-leaving");
      setTimeout(() => {
        root.classList.remove("tutorial-leaving");
        if (typeof onFinish === "function") onFinish();
      }, 260);
    }

    const onPrev = () => goTo(index - 1);
    const onNext = () => goTo(index + 1);
    const onSkip = () => finish();
    const onContinue = () => finish();

    prev.addEventListener("click", onPrev);
    next.addEventListener("click", onNext);
    skip.addEventListener("click", onSkip);
    continueBtn.addEventListener("click", onContinue);

    dotButtons.forEach(dot => {
      dot.addEventListener("click", () => goTo(Number(dot.dataset.slide)));
    });

    const onKey = e => {
      if (!root.classList.contains("hidden")) {
        if (e.key === "ArrowLeft") onPrev();
        if (e.key === "ArrowRight") onNext();
        if (e.key === "Escape") finish();
      }
    };
    document.addEventListener("keydown", onKey);

    // IMPORTANTE: no pausamos al pasar el mouse por encima.
    // El tutorial debe avanzar solo aunque el cursor esté dentro del cuadro.
    let touchStartX = 0;
    root.addEventListener("touchstart", e => {
      touchStartX = e.changedTouches[0].screenX;
      touchPaused = true;
      stopTimer();
    }, { passive: true });

    root.addEventListener("touchend", e => {
      const diff = e.changedTouches[0].screenX - touchStartX;
      if (Math.abs(diff) > 45) {
        goTo(diff > 0 ? index - 1 : index + 1);
      }
      touchPaused = false;
      scheduleAutoAdvance();
    }, { passive: true });

    tutorialCleanup = () => {
      stopTimer();
      prev.removeEventListener("click", onPrev);
      next.removeEventListener("click", onNext);
      skip.removeEventListener("click", onSkip);
      continueBtn.removeEventListener("click", onContinue);
      document.removeEventListener("keydown", onKey);
    };

    render();

    // Arranca el carrusel automáticamente al abrir el tutorial.
    scheduleAutoAdvance();
  };
})();
