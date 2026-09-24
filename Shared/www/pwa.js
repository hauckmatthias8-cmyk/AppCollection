(() => {
  if (!('serviceWorker' in navigator)) return;
  let reloaded = false;
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', {scope:'./'});
      registration.update().catch(() => {});
    } catch (err) {
      console.warn('Service Worker konnte nicht registriert werden:', err);
    }
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
})();
