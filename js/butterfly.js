/**
 * BUTTERFLY EFFECT
 * The signature visual motif. Spawns SVG butterflies that drift
 * slowly across the screen. Used on the Title screen for ambient
 * life, and can be called elsewhere for narrative beats.
 */

const Butterfly = (() => {
  const SVG_MARKUP = `
    <svg viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
      <g>
        <path class="wing" d="M13 13 C8 4, 1 4, 2 11 C2.5 15, 8 15, 13 13 Z" fill="#9b85b0" opacity="0.85"/>
        <path class="wing" d="M13 13 C18 4, 25 4, 24 11 C23.5 15, 18 15, 13 13 Z" fill="#9b85b0" opacity="0.85"/>
        <path class="wing" d="M13 13 C9 19, 4 20, 5 15.5 C5.5 13.5, 9 13, 13 13 Z" fill="#6b5b7a" opacity="0.75"/>
        <path class="wing" d="M13 13 C17 19, 22 20, 21 15.5 C20.5 13.5, 17 13, 13 13 Z" fill="#6b5b7a" opacity="0.75"/>
        <line x1="13" y1="9" x2="13" y2="17" stroke="#3a3340" stroke-width="0.8"/>
      </g>
    </svg>`;

  function spawn(container, { count = 1, duration = [8000, 14000] } = {}) {
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'butterfly';
      el.innerHTML = SVG_MARKUP;

      const startX = Math.random() * 100;
      const startY = 60 + Math.random() * 35;
      const driftX = (Math.random() - 0.5) * 400;
      const driftY = -100 - Math.random() * 200;
      const driftRot = (Math.random() - 0.5) * 60;
      const dur = duration[0] + Math.random() * (duration[1] - duration[0]);
      const delay = Math.random() * 3000;

      el.style.left = `${startX}%`;
      el.style.top = `${startY}%`;
      el.style.setProperty('--drift-x', `${driftX}px`);
      el.style.setProperty('--drift-y', `${driftY}px`);
      el.style.setProperty('--drift-rot', `${driftRot}deg`);
      el.style.animationDuration = `${dur}ms`;
      el.style.animationDelay = `${delay}ms`;

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
