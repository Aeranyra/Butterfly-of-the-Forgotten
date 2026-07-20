/**
 * HORROR EFFECTS MODULE
 * Implements all 7 atmosphere + consequence upgrades:
 * 1. Screen bleed on bad choices
 * 2. Text distortion on low sanity
 * 3. Silence spike before bad events
 * 4. Butterfly behavior shift on low trust
 * 5. Named sanity drops (private messages)
 * 6. Compound wrong riddle answer tracking
 * 7. Betrayer echo (Plant Doubt paranoia message)
 */

const Horror = (() => {

  // Respects the OS/browser-level reduced-motion preference. The CSS
  // @media (prefers-reduced-motion) rule only covers class-based CSS
  // animations/transitions — it has no effect on inline styles set
  // directly from JS (screen bleed, cursor trail), so those need their
  // own check.
  function _prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // ── 1. SCREEN BLEED ──────────────────────────────────────────────────
  // Slow red creep from screen corners on bad choices. Created once,
  // reused on every trigger so we don't litter the DOM.
  let bleedEl = null;

  function _ensureBleed() {
    if (bleedEl) return;
    bleedEl = document.createElement('div');
    bleedEl.id = 'screen-bleed';
    bleedEl.style.cssText = `
      position: fixed; inset: 0; pointer-events: none; z-index: 999;
      background: radial-gradient(ellipse at center,
        transparent 50%,
        rgba(176, 68, 68, 0) 62%,
        rgba(176, 68, 68, 0.2) 82%,
        rgba(176, 68, 68, 0.38) 100%);
      opacity: 0; transition: opacity 0.4s ease;
    `;
    document.body.appendChild(bleedEl);
  }

  function screenBleed(intensity = 0.6) {
    _ensureBleed();
    if (_prefersReducedMotion()) {
      // Same feedback, no animated creep — a brief static tint instead
      // of a moving/fading gradient.
      bleedEl.style.transition = 'none';
      bleedEl.style.opacity = String(Math.min(intensity, 0.3));
      setTimeout(() => { bleedEl.style.opacity = '0'; }, 500);
      return;
    }
    bleedEl.style.transition = 'opacity 0.3s ease';
    bleedEl.style.opacity = String(intensity);
    setTimeout(() => {
      bleedEl.style.transition = 'opacity 2s ease';
      bleedEl.style.opacity = '0';
    }, 600);
  }

  // ── 2. TEXT DISTORTION ───────────────────────────────────────────────
  // Below sanity 60, narrative lines occasionally flicker 1-2 wrong chars
  // for a single frame as they render. Subtle — player might think they
  // misread. Applied via a MutationObserver that watches for new .beat
  // spans being added to the DOM.
  let distortionObserver = null;
  const DISTORT_CHARS = ['▓', '░', '▒', '¬', '§'];

  function _distortOnce(el) {
    const original = el.textContent;
    if (!original || original.length < 4) return;
    const chars = original.split('');
    const idx = Math.floor(Math.random() * chars.length);
    chars[idx] = DISTORT_CHARS[Math.floor(Math.random() * DISTORT_CHARS.length)];
    el.textContent = chars.join('');
    // Restore after one frame — player sees the flicker, not the change
    requestAnimationFrame(() => { el.textContent = original; });
  }

  function startTextDistortion() {
    if (distortionObserver) return;
    distortionObserver = new MutationObserver(mutations => {
      const sanity = Player.get().sanity;
      if (sanity >= 60) return; // only fires below Stable threshold
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1 && node.classList.contains('beat')) {
            // Random chance scales with sanity — lower sanity = more frequent
            const chance = sanity < 30 ? 0.7 : 0.35;
            if (Math.random() < chance) {
              setTimeout(() => _distortOnce(node), 200 + Math.random() * 400);
            }
          }
        });
      });
    });
    distortionObserver.observe(document.getElementById('app'), {
      childList: true,
      subtree: true
    });
  }

  function stopTextDistortion() {
    if (distortionObserver) {
      distortionObserver.disconnect();
      distortionObserver = null;
    }
  }

  // ── 3. SILENCE SPIKE ─────────────────────────────────────────────────
  // Ducks background music to near-silence for 1-2s before a bad event,
  // then restores. Creates dread before the consequence lands.
  function silenceSpike(durationMs = 1400) {
    const audio = AudioManager._currentAudio ? AudioManager._currentAudio :
      document.querySelector('audio'); // fallback
    if (!audio) return;
    const original = audio.volume;
    audio.volume = 0.04;
    setTimeout(() => {
      const steps = 20;
      const step = (original - 0.04) / steps;
      let i = 0;
      const interval = setInterval(() => {
        audio.volume = Math.min(original, audio.volume + step);
        if (++i >= steps) clearInterval(interval);
      }, 50);
    }, durationMs);
  }

  // ── 4. ERRATIC BUTTERFLY BEHAVIOR ────────────────────────────────────
  // Returns spawn options for Butterfly.spawn() that make butterflies
  // move faster and more erratically during low-trust moments.
  function erraticButterflyOptions(trust) {
    if (trust > 40) return {}; // normal behavior above trust threshold
    const speed = trust < 20 ? [800, 1800] : [1400, 2800];
    return { duration: speed, count: trust < 20 ? 3 : 2 };
  }

  // ── 5. NAMED SANITY DROPS ────────────────────────────────────────────
  // Shows a brief private message to the player when a consequence lands,
  // so they know something shifted without knowing the exact number.
  const CONSEQUENCE_MESSAGES = {
    heavy: [
      'Something slipped.',
      'You felt that.',
      'That answer cost something.',
      'The academy noted your hesitation.',
      'A part of you disagrees with what you just said.'
    ],
    medium: [
      'The air shifted.',
      'That sits wrong.',
      'Something remembered that.',
      'Not the right answer. You knew that.'
    ],
    light: [
      'The room is quieter now.',
      'A small wrongness.',
      'Noted.'
    ]
  };

  let msgEl = null;

  function _ensureMsgEl() {
    if (msgEl) return;
    msgEl = document.createElement('div');
    msgEl.id = 'consequence-msg';
    msgEl.style.cssText = `
      position: fixed; bottom: 22%; left: 0; right: 0;
      text-align: center; pointer-events: none; z-index: 998;
      font-family: 'Jost', sans-serif; font-weight: 300;
      font-size: 0.75rem; letter-spacing: 0.14em;
      text-transform: uppercase; color: rgba(176, 68, 68, 0.85);
      opacity: 0; transition: opacity 0.4s ease;
      text-shadow: 0 0 12px rgba(176,68,68,0.3);
    `;
    document.body.appendChild(msgEl);
  }

  function consequenceMessage(severity = 'medium') {
    _ensureMsgEl();
    const pool = CONSEQUENCE_MESSAGES[severity] || CONSEQUENCE_MESSAGES.medium;
    const msg = pool[Math.floor(Math.random() * pool.length)];
    msgEl.textContent = msg;
    msgEl.style.transition = 'opacity 0.4s ease';
    msgEl.style.opacity = '1';
    setTimeout(() => {
      msgEl.style.transition = 'opacity 1.8s ease';
      msgEl.style.opacity = '0';
    }, 1600);
  }

  // ── 6. COMPOUND RIDDLE TRACKING ──────────────────────────────────────
  // Tracks how many times a player has picked the "deeply wrong" riddle
  // answer (the one that triggers glitch). On the 3rd such choice, a
  // private warning fires before the next riddle question.
  let wrongRiddleCount = 0;

  function trackWrongRiddle() {
    wrongRiddleCount++;
    GameState.saveState('wrongRiddleCount', wrongRiddleCount);
    if (wrongRiddleCount >= 2) {
      // On 2nd+ deeply wrong answer, compound effect fires
      screenBleed(0.85);
      consequenceMessage('heavy');
      AudioManager.playStatic(0.7);
    }
  }

  function getCompoundWarning() {
    const saved = GameState.loadState('wrongRiddleCount');
    wrongRiddleCount = saved || 0;
    if (wrongRiddleCount >= 2) {
      return 'The academy has recorded your previous answers. It is watching more carefully now.';
    }
    return null;
  }

  // ── 7. BETRAYER ECHO ─────────────────────────────────────────────────
  // When Plant Doubt is used against a player, they receive a subtle
  // private message — not telling them they were targeted, just enough
  // to plant paranoia. Called by the Betrayer system when it fires.
  const BETRAYER_ECHOES = [
    'Did you mean to choose that?',
    'That answer felt different from what you thought.',
    'Something changed before it was counted.',
    'The academy recorded something other than your intention.'
  ];

  function betrayerEcho() {
    _ensureMsgEl();
    const msg = BETRAYER_ECHOES[Math.floor(Math.random() * BETRAYER_ECHOES.length)];
    msgEl.textContent = msg;
    msgEl.style.color = 'rgba(155, 133, 176, 0.9)'; // violet for Betrayer, not red
    msgEl.style.transition = 'opacity 0.6s ease';
    msgEl.style.opacity = '1';
    setTimeout(() => {
      msgEl.style.transition = 'opacity 2.2s ease';
      msgEl.style.opacity = '0';
      // reset color back to red for future consequence messages
      setTimeout(() => { msgEl.style.color = 'rgba(176, 68, 68, 0.85)'; }, 2200);
    }, 2400);
  }

  // ── INIT ─────────────────────────────────────────────────────────────
  function init() {
    _ensureBleed();
    _ensureMsgEl();
    startTextDistortion();
    // Restore compound count from session storage
    const saved = GameState.loadState('wrongRiddleCount');
    if (saved) wrongRiddleCount = saved;
  }

  return {
    screenBleed,
    silenceSpike,
    consequenceMessage,
    trackWrongRiddle,
    getCompoundWarning,
    betrayerEcho,
    erraticButterflyOptions,
    startTextDistortion,
    stopTextDistortion,
    prefersReducedMotion: _prefersReducedMotion,
    init
  };
})();
