/**
 * BUTTERFLY EFFECT
 * The signature visual motif. Spawns SVG butterflies that drift
 * slowly across the screen. Used on the Title screen for ambient
 * life, and can be called elsewhere for narrative beats.
 */

const Butterfly = (() => {
  const SVG_MARKUP_VIOLET = `
    <svg viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
      <g>
        <path class="wing" d="M13 13 C8 4, 1 4, 2 11 C2.5 15, 8 15, 13 13 Z" fill="#9b85b0" opacity="0.85"/>
        <path class="wing" d="M13 13 C18 4, 25 4, 24 11 C23.5 15, 18 15, 13 13 Z" fill="#9b85b0" opacity="0.85"/>
        <path class="wing" d="M13 13 C9 19, 4 20, 5 15.5 C5.5 13.5, 9 13, 13 13 Z" fill="#6b5b7a" opacity="0.75"/>
        <path class="wing" d="M13 13 C17 19, 22 20, 21 15.5 C20.5 13.5, 17 13, 13 13 Z" fill="#6b5b7a" opacity="0.75"/>
        <line x1="13" y1="9" x2="13" y2="17" stroke="#3a3340" stroke-width="0.8"/>
      </g>
    </svg>`;

  // Black variant — used for the Prologue's "black butterfly" beats and
  // anywhere the academy's presence should read as darker / more ominous
  // than the ambient violet used on the Title screen.
  const SVG_MARKUP_BLACK = `
    <svg viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
      <g>
        <path class="wing" d="M13 13 C8 4, 1 4, 2 11 C2.5 15, 8 15, 13 13 Z" fill="#15131a" opacity="0.92"/>
        <path class="wing" d="M13 13 C18 4, 25 4, 24 11 C23.5 15, 18 15, 13 13 Z" fill="#15131a" opacity="0.92"/>
        <path class="wing" d="M13 13 C9 19, 4 20, 5 15.5 C5.5 13.5, 9 13, 13 13 Z" fill="#0a090c" opacity="0.85"/>
        <path class="wing" d="M13 13 C17 19, 22 20, 21 15.5 C20.5 13.5, 17 13, 13 13 Z" fill="#0a090c" opacity="0.85"/>
        <line x1="13" y1="9" x2="13" y2="17" stroke="#6b5b7a" stroke-width="0.8"/>
      </g>
    </svg>`;

  function spawn(container, { count = 1, duration = [8000, 14000], variant = 'violet' } = {}) {
    const markup = variant === 'black' ? SVG_MARKUP_BLACK : SVG_MARKUP_VIOLET;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'butterfly';
      el.innerHTML = markup;

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
  function ambient(container, intervalMs = 4500, options = {}) {
    spawn(container, { count: 1, ...options });
    const id = setInterval(() => spawn(container, { count: 1, ...options }), intervalMs);
    return () => clearInterval(id);
  }

  /**
   * Cursor trail — a small black butterfly that follows the mouse/touch
   * with a light lag, fading as it settles. Subtle by design: this is
   * meant to feel like something following the player, not a flashy
   * cursor effect, so it stays low-opacity and slow.
   * Returns a stop function that removes the trail and its listeners.
   */
  function cursorTrail(container, { variant = 'black' } = {}) {
    const markup = variant === 'black' ? SVG_MARKUP_BLACK : SVG_MARKUP_VIOLET;
    const el = document.createElement('div');
    el.className = 'butterfly butterfly-cursor';
    el.innerHTML = markup;
    el.style.animation = 'none';
    el.style.opacity = '0';
    container.appendChild(el);

    let targetX = -100, targetY = -100;
    let curX = -100, curY = -100;
    let raf = null;
    let active = false;

    function onMove(e) {
      const point = e.touches ? e.touches[0] : e;
      if (!point) return;
      const rect = container.getBoundingClientRect();
      targetX = point.clientX - rect.left;
      targetY = point.clientY - rect.top;
      if (!active) {
        active = true;
        el.style.opacity = '0.55';
      }
    }

    function tick() {
      // Lagging follow — ~8% of the distance per frame, so the
      // butterfly trails a beat behind rather than snapping to the cursor.
      curX += (targetX - curX) * 0.08;
      curY += (targetY - curY) * 0.08;
      el.style.left = `${curX}px`;
      el.style.top = `${curY}px`;
      el.style.transform = `translate(-50%, -60%)`;
      raf = requestAnimationFrame(tick);
    }

    container.addEventListener('mousemove', onMove);
    container.addEventListener('touchmove', onMove, { passive: true });
    raf = requestAnimationFrame(tick);

    return function stop() {
      cancelAnimationFrame(raf);
      container.removeEventListener('mousemove', onMove);
      container.removeEventListener('touchmove', onMove);
      el.remove();
    };
  }

  return { spawn, ambient, cursorTrail };
})();
