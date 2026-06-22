/**
 * GLITCH DIALOGUE SYSTEM
 * Implements the locked design: writer-tagged lines glitch visually
 * and play a static burst. Intensity scales with current sanity.
 */

const GlitchDialogue = (() => {
  // Disturbing-leaning character set: broken/occult-adjacent symbols rather
  // than neutral punctuation, so a scramble reads as "wrong" not just "garbled"
  const FAKE_CHARS = ['#', '¬', '§', '±', '¤', '☖', '✕', '͏', '꙰', '0', '1'];

  function _tierFromSanity(sanity) {
    if (sanity >= 60) return 'stable';
    if (sanity >= 30) return 'distorted';
    return 'lost';
  }

  function _scrambleOnce(el, originalText, intensity) {
    const chars = originalText.split('');
    const swapCount = Math.max(1, Math.floor(chars.length * intensity * 0.24));
    for (let i = 0; i < swapCount; i++) {
      const idx = Math.floor(Math.random() * chars.length);
      if (chars[idx] !== ' ') {
        chars[idx] = FAKE_CHARS[Math.floor(Math.random() * FAKE_CHARS.length)];
      }
    }
    const scrambled = chars.join('');
    el.textContent = scrambled;
    el.setAttribute('data-glitch-text', scrambled);
  }

  /**
   * Renders a glitched line into el, then settles to the true text.
   * sanity: current player sanity (0-100)
   * persist: if true, the line stays visually glitched (red, distorted)
   *          permanently after settling, instead of reverting to plain
   *          text. Used for lines that are meant to feel permanently
   *          "wrong" rather than a brief flicker of distortion.
   */
  function render(el, text, sanity, { persist = false } = {}) {
    const tier = _tierFromSanity(sanity);
    const intensityMap = { stable: 0.25, distorted: 0.55, lost: 1 };
    const intensity = intensityMap[tier];

    el.setAttribute('data-glitch-text', text);
    el.classList.add('glitch-active');
    if (tier === 'lost' || persist) el.classList.add('intensity-lost');

    const pulses = tier === 'stable' ? 3 : tier === 'distorted' ? 6 : 10;
    const pulseSpeed = tier === 'lost' ? 55 : 90;

    AudioManager.playStatic(intensity);

    let i = 0;
    const interval = setInterval(() => {
      _scrambleOnce(el, text, intensity);
      AudioManager.playStatic(intensity);
      i++;
      if (i >= pulses) {
        clearInterval(interval);
        el.textContent = text;
        el.setAttribute('data-glitch-text', text);

        if (persist) {
          // Stay red/distorted permanently — slow the shudder/flicker so it
          // reads as "unsettled" rather than actively broken, but never
          // remove the glitch-active class.
          el.classList.add('glitch-persist');
          return;
        }

        setTimeout(() => {
          el.classList.remove('glitch-active', 'intensity-lost');
          el.removeAttribute('data-glitch-text');
        }, tier === 'lost' ? 450 : 180);
      }
    }, pulseSpeed);
  }

  return { render };
})();
