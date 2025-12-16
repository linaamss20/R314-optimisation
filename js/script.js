(function () {

  /* ---- Simulation de charge non bloquante ---- */
  function simulateWork(durationMs) {
    const start = performance.now();

    function step() {
      // petit travail CPU
      for (let i = 0; i < 500; i++) {
        Math.random();
      }

      if (performance.now() - start < durationMs) {
        requestIdleCallback(step);
      }
    }

    requestIdleCallback(step);
  }

  simulateWork(2000);

  /* ---- Allocation mémoire contrôlée ---- */
  const waste = new Float32Array(20000);
  for (let i = 0; i < waste.length; i++) {
    waste[i] = Math.random() * i;
  }
  window.__waste = waste;

  /* ---- Gestion images optimisée ---- */
  function onImageLoad(img) {
    img.classList.add('loaded');
  }

  window.addEventListener('load', () => {
    document.querySelectorAll('.card img').forEach(img => {
      if (img.complete) {
        onImageLoad(img);
      } else {
        img.addEventListener('load', () => onImageLoad(img), { once: true });
      }
    });

    // petite charge différée après le load
    requestIdleCallback(() => simulateWork(1000));
  });

})();

