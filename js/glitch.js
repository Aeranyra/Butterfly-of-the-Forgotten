/**
 * GLITCH DIALOGUE SYSTEM
 * Implements the locked design: writer-tagged lines glitch visually
 * and play a static burst. Intensity scales with current sanity.
 */

const GlitchDialogue = (() => {
  const FAKE_CHARS = ['#', '%', '&', '¬', '§', '±', '¤', '/'];

  function _tierFromSanity(sanity) {
    if (sanity >= 60) return 'stable';
    if (sanity >= 30) return 'distorted';
    return 'lost';
  }

  function _scrambleOnce(el, originalText, intensity) {
    const chars = originalText.split('');
    const swapCount = Math.max(1, Math.floor(chars.length * intensity * 0.18));
    for (let i = 0; i < swapCount; i++) {
      const idx = Math.floor(Math.random() * chars.length);
      if (chars[idx] !== ' ') {
        chars[idx] = FAKE_CHARS[Math.floor(Math.random() * FAKE_CHARS.length)];
      }
    }
    el.textContent = chars.join('');
  }

  /**
   * Renders a glitched line into el, then settles to the true text.
   * sanity: current player sanity (0-100)
   */
  function render(el, text, sanity) {
    const tier = _tierFromSanity(sanity);
    const intensityMap = { stable: 0.25, distorted: 0.55, lost: 1 };
    const intensity = intensityMap[tier];

    el.classList.add('glitch-active');
    if (tier === 'lost') el.classList.add('intensity-lost');

    AudioManager.playStatic(intensity);

    const pulses = tier === 'stable' ? 2 : tier === 'distorted' ? 4 : 7;
    const pulseSpeed = tier === 'lost' ? 70 : 110;

    let i = 0;
    const interval = setInterval(() => {
      _scrambleOnce(el, text, intensity);
      i++;
      if (i >= pulses) {
        clearInterval(interval);
        el.textContent = text;
        setTimeout(() => {
          el.classList.remove('glitch-active', 'intensity-lost');
        }, tier === 'lost' ? 400 : 150);
      }
    }, pulseSpeed);
  }

  return { render };
})();
