/**
 * BUTTERFLY EFFECT
 * The signature visual motif. Spawns SVG butterflies that drift
 * slowly across the screen. Used on the Title screen for ambient
 * life, and can be called elsewhere for narrative beats.
 */

const Butterfly = (() => {
  // Color variants. 'violet' is the original ambient/ending butterfly.
  // 'black' and 'red' are used for narrative beats that need a sharper,
  // more ominous read (e.g. the prologue's "black butterfly", glitch/
  // distortion moments).
  const VARIANTS = {
    violet: {
      wingTop: '#9b85b0', wingTopOp: 0.85,
      wingBottom: '#6b5b7a', wingBottomOp: 0.75,
      body: '#3a3340',
      glow: 'rgba(107, 91, 122, 0.6)'
    },
    black: {
      wingTop: '#1a1620', wingTopOp: 0.95,
      wingBottom: '#0c0a10', wingBottomOp: 0.92,
      body: '#000000',
      glow: 'rgba(176, 68, 68, 0.55)'
    },
    red: {
      wingTop: '#9b3a3a', wingTopOp: 0.9,
      wingBottom: '#5e1f1f', wingBottomOp: 0.82,
      body: '#2a1010',
      glow: 'rgba(176, 68, 68, 0.75)'
    }
  };

  function markup(variantName) {
    const v = VARIANTS[variantName] || VARIANTS.violet;
    return `
    <svg viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 5px ${v.glow})">
      <g>
        <path class="wing" d="M13 13 C8 4, 1 4, 2 11 C2.5 15, 8 15, 13 13 Z" fill="${v.wingTop}" opacity="${v.wingTopOp}"/>
        <path class="wing" d="M13 13 C18 4, 25 4, 24 11 C23.5 15, 18 15, 13 13 Z" fill="${v.wingTop}" opacity="${v.wingTopOp}"/>
        <path class="wing" d="M13 13 C9 19, 4 20, 5 15.5 C5.5 13.5, 9 13, 13 13 Z" fill="${v.wingBottom}" opacity="${v.wingBottomOp}"/>
        <path class="wing" d="M13 13 C17 19, 22 20, 21 15.5 C20.5 13.5, 17 13, 13 13 Z" fill="${v.wingBottom}" opacity="${v.wingBottomOp}"/>
        <line x1="13" y1="9" x2="13" y2="17" stroke="${v.body}" stroke-width="0.8"/>
      </g>
    </svg>`;
  }

  /**
   * Spawns one or more butterflies.
   * Options:
   *  - count: how many
   *  - duration: [min, max] ms for the full drift
   *  - variant: 'violet' (default) | 'black' | 'red'
   *  - size: px, defaults to 26 (CSS default). Pass a bigger number to
   *    make a single narrative butterfly impossible to miss.
   *  - startY: [min, max] vertical start position as a % of container
   *    height. Defaults to the lower-third (60-95%) used by ambient
   *    spawns; pass e.g. [30, 50] to place it more centrally on screen.
   *  - driftRange: max horizontal drift in px (default 400, i.e. ±200px).
   *    Lower this for a butterfly that should feel like it's lingering
   *    nearby rather than crossing the whole screen.
   */
  function spawn(container, {
    count = 1,
    duration = [8000, 14000],
    variant = 'violet',
    size = null,
    startY = [60, 95],
    driftRange = 400
  } = {}) {
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'butterfly';
      el.innerHTML = markup(variant);

      const startX = Math.random() * 100;
      const yMin = startY[0], yMax = startY[1];
      const startYPct = yMin + Math.random() * (yMax - yMin);
      const driftX = (Math.random() - 0.5) * driftRange;
      const driftY = -100 - Math.random() * 200;
      const driftRot = (Math.random() - 0.5) * 60;
      const dur = duration[0] + Math.random() * (duration[1] - duration[0]);
      const delay = Math.random() * 3000;

      el.style.left = `${startX}%`;
      el.style.top = `${startYPct}%`;
      el.style.setProperty('--drift-x', `${driftX}px`);
      el.style.setProperty('--drift-y', `${driftY}px`);
      el.style.setProperty('--drift-rot', `${driftRot}deg`);
      el.style.animationDuration = `${dur}ms`;
      el.style.animationDelay = `${delay}ms`;
      if (size) {
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
      }

      container.appendChild(el);

      setTimeout(() => el.remove(), dur + delay + 200);
    }
  }

  /**
   * Continuous ambient spawning, e.g. for the title screen.
   * Returns a stop function.
   */
  function ambient(container, intervalMs = 4500) {
    spawn(container, { count: 1 });
    const id = setInterval(() => spawn(container, { count: 1 }), intervalMs);
    return () => clearInterval(id);
  }

  return { spawn, ambient };
})();
