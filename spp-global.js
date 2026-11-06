/* Shared Shoto Point Productions preloader. */
(function () {
  'use strict';
  const loader = document.getElementById('spp-global-preloader');
  if (loader) {
    let hidden = false;
    const hide = () => {
      if (hidden) return;
      hidden = true;
      const elapsed = performance.now() - (window.__sppLoaderStartedAt || performance.now());
      const delay = Math.max(0, 420 - elapsed);
      window.setTimeout(() => loader.classList.add('is-hidden'), delay);
      window.setTimeout(() => loader.remove(), delay + 750);
    };
    if (document.readyState === 'complete') hide();
    else window.addEventListener('load', hide, { once: true });
    // A failed image/video request must never leave the page covered indefinitely.
    window.setTimeout(hide, 9000);
  }

})();
