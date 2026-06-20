/**
 * TRUST INDICATOR (solo-test scaffold)
 * ------------------------------------------------------------
 * The full Trust Engine (group-wide, multiplayer) is locked design
 * but not yet buildable without the Session Lobby / Firebase sync.
 * This module renders the visible indicator and exposes a simple
 * local value so Classroom can call Trust.shift() and see the UI
 * react correctly. When real multiplayer trust exists, only the
 * INSIDE of these functions changes — Classroom's calls stay the same.
 * ------------------------------------------------------------
 */

const Trust = (() => {
  let value = 60; // mid-default for solo testing; group sessions start elsewhere

  function _render() {
    const el = document.querySelector('.trust-indicator');
    if (!el) return;
    const pct = Math.max(0, Math.min(100, value));
    el.style.width = `${20 + (pct / 100) * 40}px`;
    el.style.opacity = String(0.3 + (pct / 100) * 0.5);
    if (pct <= 30) {
      el.style.background = 'var(--accent-warning-bright)';
    } else {
      el.style.background = 'var(--accent-violet-bright)';
    }
  }

  function get() {
    return value;
  }

  function shift(delta) {
    const prev = value;
    value = Math.max(0, Math.min(100, value + delta));
    GameState.saveState('trust', value);
    _render();
    if (value !== prev) {
      const el = document.querySelector('.trust-indicator');
      if (el) {
        el.classList.remove('pulse');
        // Force reflow so re-adding the class restarts the animation
        // even if a pulse from a prior shift is still mid-flight.
        void el.offsetWidth;
        el.classList.add('pulse');
        setTimeout(() => el.classList.remove('pulse'), 900);
      }
    }
    return value;
  }

  function init() {
    const saved = GameState.loadState('trust');
    if (saved !== null) value = saved;
    _render();
  }

  return { get, shift, init };
})();
