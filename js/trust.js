/**
 * TRUST INDICATOR (live, group-shared)
 * ------------------------------------------------------------
 * Trust is the room's mood, shared by everyone in the session — not a
 * private stat. A choice that shifts trust optimistically updates the
 * local indicator right away, but also writes through to the shared
 * session value (Session.shiftTrust), and every player's indicator —
 * including the one who made the choice — reconciles to that
 * authoritative value as soon as Firebase echoes it back. In solo
 * testing (no session active), it behaves exactly as before: a local
 * value backed by GameState.
 * ------------------------------------------------------------
 */

const Trust = (() => {
  let value = 60; // mid-default; overwritten by session/local state on init

  function _hasSession() {
    return typeof Session !== 'undefined' && !!Session.getCode();
  }

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

  function _pulse() {
    const el = document.querySelector('.trust-indicator');
    if (!el) return;
    el.classList.remove('pulse');
    // Force reflow so re-adding the class restarts the animation
    // even if a pulse from a prior shift is still mid-flight.
    void el.offsetWidth;
    el.classList.add('pulse');
    setTimeout(() => el.classList.remove('pulse'), 900);
  }

  function get() {
    return value;
  }

  /**
   * Local-feeling shift: updates the indicator immediately for snappy
   * feedback, then pushes the same delta into the shared session value
   * (if a session is active). The local value here is provisional —
   * syncFromRemote() will correct it to the authoritative shared value
   * a moment later, which also fans the same change out to every other
   * player in real time.
   */
  function shift(delta) {
    const prev = value;
    value = Math.max(0, Math.min(100, value + delta));
    GameState.saveState('trust', value);
    _render();
    if (value !== prev) _pulse();

    if (_hasSession()) {
      Session.shiftTrust(delta).catch(() => {
        // Network hiccup — local value stands until the next sync.
      });
    }

    return value;
  }

  /**
   * Reconciles the local indicator to the authoritative session trust
   * value. Called from the live Session.onUpdate subscription, so this
   * fires for EVERY player whenever ANYONE's choice moves trust — that's
   * what makes the room feel shared rather than five separate meters.
   * A noticeable drop (someone else's choice going badly) gets a faint
   * static cue, like the room itself reacting.
   */
  function syncFromRemote(remoteValue) {
    if (typeof remoteValue !== 'number') return;
    const clamped = Math.max(0, Math.min(100, remoteValue));
    const prev = value;
    if (clamped === prev) {
      _render();
      return;
    }
    value = clamped;
    GameState.saveState('trust', value);
    _render();
    _pulse();

    if (value < prev - 1 && typeof AudioManager !== 'undefined') {
      AudioManager.playStatic(0.18);
    }

    // A sharp drop (not just a normal -3 nudge) dims whichever room is
    // currently on screen — the space itself reacting to the group,
    // not just a meter ticking down.
    if (prev - value >= 5) {
      const activeScene = document.querySelector('.scene.active');
      if (activeScene) {
        activeScene.style.transition = 'filter 0.4s ease';
        activeScene.style.filter = 'brightness(0.55)';
        setTimeout(() => {
          activeScene.style.filter = '';
        }, 500);
      }
    }
  }

  function init() {
    if (!_hasSession()) {
      const saved = GameState.loadState('trust');
      if (saved !== null) value = saved;
    }
    // If a session is active, `value` is already kept current by
    // syncFromRemote (the session's onUpdate listener fires immediately
    // with the current value as soon as it's attached, before this
    // function ever runs), so we leave it as-is rather than clobbering
    // it with stale local/session-default state.
    _render();
  }

  return { get, shift, syncFromRemote, init };
})();
