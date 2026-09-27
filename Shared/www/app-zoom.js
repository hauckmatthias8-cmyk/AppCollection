(() => {
  'use strict';

  const STORAGE_KEY = 'haucki.appZoom';
  const MIN = 60;
  const MAX = 200;
  const DEFAULT = 100;

  let zoom = DEFAULT;
  let pinch = null;
  let gestureFallback = null;
  let indicatorTimer = 0;

  function clamp(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT;
    return Math.max(MIN, Math.min(MAX, n));
  }

  function readStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw == null ? DEFAULT : clamp(Number(raw));
    } catch (_) {
      return DEFAULT;
    }
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, String(Math.round(zoom))); } catch (_) {}
  }

  function ensureIndicator() {
    let el = document.querySelector('.app-zoom-indicator');
    if (el || !document.body) return el;

    el = document.createElement('div');
    el.className = 'app-zoom-indicator';
    el.setAttribute('aria-hidden', 'true');
    document.body.append(el);
    return el;
  }

  function showIndicator(linger = false) {
    const el = ensureIndicator();
    if (!el) return;
    el.textContent = `${Math.round(zoom)} %`;
    el.classList.add('visible');
    clearTimeout(indicatorTimer);
    if (linger) {
      indicatorTimer = setTimeout(() => el.classList.remove('visible'), 700);
    }
  }

  function hideIndicatorSoon() {
    const el = ensureIndicator();
    if (!el) return;
    clearTimeout(indicatorTimer);
    indicatorTimer = setTimeout(() => el.classList.remove('visible'), 450);
  }

  function apply(value, save = false, show = false) {
    zoom = clamp(value);
    document.documentElement.style.setProperty('--haucki-app-zoom', String(zoom / 100));
    document.documentElement.dataset.appZoom = String(Math.round(zoom));
    if (save) persist();
    if (show) showIndicator();
    window.dispatchEvent(new CustomEvent('haucki-app-zoom-change', {
      detail: { percent: Math.round(zoom), factor: zoom / 100 }
    }));
  }

  function distance(a, b) {
    const dx = b.clientX - a.clientX;
    const dy = b.clientY - a.clientY;
    return Math.hypot(dx, dy);
  }

  function beginPinch(touches) {
    if (!touches || touches.length !== 2) return false;
    const d = distance(touches[0], touches[1]);
    if (!(d > 0)) return false;
    pinch = { startDistance: d, startZoom: zoom };
    showIndicator();
    return true;
  }

  function updatePinch(touches) {
    if (!pinch || !touches || touches.length !== 2) return false;
    const d = distance(touches[0], touches[1]);
    if (!(d > 0)) return false;
    apply(pinch.startZoom * (d / pinch.startDistance), false, true);
    return true;
  }

  function endPinch() {
    if (!pinch) return;
    pinch = null;
    zoom = Math.round(zoom);
    apply(zoom, true, false);
    hideIndicatorSoon();
  }

  // Apply before first paint as early as possible.
  apply(readStored(), false, false);

  document.addEventListener('touchstart', event => {
    if (event.touches.length === 2) {
      beginPinch(event.touches);
    } else if (pinch && event.touches.length !== 2) {
      endPinch();
    }
  }, { passive: true, capture: true });

  document.addEventListener('touchmove', event => {
    if (event.touches.length === 2) {
      if (!pinch) beginPinch(event.touches);
      if (updatePinch(event.touches)) {
        // Verhindert den Browser-eigenen Seitenzoom; wir skalieren die App selbst.
        event.preventDefault();
      }
    }
  }, { passive: false, capture: true });

  document.addEventListener('touchend', event => {
    if (pinch && event.touches.length < 2) endPinch();
  }, { passive: true, capture: true });

  document.addEventListener('touchcancel', () => endPinch(), {
    passive: true,
    capture: true
  });

  // Safari/iOS-Fallback. Wird nur genutzt, wenn gerade kein Touch-Pinch aktiv ist.
  document.addEventListener('gesturestart', event => {
    if (pinch) return;
    gestureFallback = { startZoom: zoom };
    showIndicator();
    if (event.cancelable) event.preventDefault();
  }, { passive: false, capture: true });

  document.addEventListener('gesturechange', event => {
    if (pinch || !gestureFallback) return;
    apply(gestureFallback.startZoom * Number(event.scale || 1), false, true);
    if (event.cancelable) event.preventDefault();
  }, { passive: false, capture: true });

  document.addEventListener('gestureend', event => {
    if (pinch || !gestureFallback) return;
    gestureFallback = null;
    zoom = Math.round(zoom);
    apply(zoom, true, false);
    hideIndicatorSoon();
    if (event.cancelable) event.preventDefault();
  }, { passive: false, capture: true });

  // Trackpad-Pinch bzw. Ctrl+Mausrad als Desktop-Entsprechung.
  document.addEventListener('wheel', event => {
    if (!event.ctrlKey) return;
    const factor = Math.exp(-event.deltaY * 0.0025);
    apply(zoom * factor, false, true);
    persist();
    showIndicator(true);
    if (event.cancelable) event.preventDefault();
  }, { passive: false, capture: true });

  window.HauckiAppZoom = Object.freeze({
    get: () => Math.round(zoom),
    set: value => apply(value, true, true),
    reset: () => apply(DEFAULT, true, true),
    min: MIN,
    max: MAX
  });
})();
