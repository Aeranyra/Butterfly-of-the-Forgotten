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

  // Cursor trail color cycle — reuses the game's existing palette so it
  // never feels off-brand, just more alive than a single fixed color.
  const CURSOR_TRAIL_COLORS = [
    { wingOuter: '#9b85b0', wingInner: '#6b5b7a', vein: '#3a3340' }, // violet (default)
    { wingOuter: '#b04444', wingInner: '#7a2e2e', vein: '#3a1f1f' }, // warning red
    { wingOuter: '#e8e6e0', wingInner: '#c9c6c0', vein: '#8a8790' }, // pale
    { wingOuter: '#15131a', wingInner: '#0a090c', vein: '#6b5b7a' }  // black
  ];

  function _coloredSvg(colors) {
    return `
    <svg viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
      <g>
        <path class="wing" d="M13 13 C8 4, 1 4, 2 11 C2.5 15, 8 15, 13 13 Z" fill="${colors.wingOuter}" opacity="0.9"/>
        <path class="wing" d="M13 13 C18 4, 25 4, 24 11 C23.5 15, 18 15, 13 13 Z" fill="${colors.wingOuter}" opacity="0.9"/>
        <path class="wing" d="M13 13 C9 19, 4 20, 5 15.5 C5.5 13.5, 9 13, 13 13 Z" fill="${colors.wingInner}" opacity="0.82"/>
        <path class="wing" d="M13 13 C17 19, 22 20, 21 15.5 C20.5 13.5, 17 13, 13 13 Z" fill="${colors.wingInner}" opacity="0.82"/>
        <line x1="13" y1="9" x2="13" y2="17" stroke="${colors.vein}" stroke-width="0.8"/>
      </g>
    </svg>`;
  }

  /**
   * Cursor trail — a small butterfly that follows the mouse/touch with a
   * light lag, leaving a brief fading trail of color-cycling copies behind
   * it as it moves. More noticeable than a single static-color follower:
   * cycles through the game's palette and leaves visible breadcrumbs.
   * Returns a stop function that removes the trail and its listeners.
   */
  function cursorTrail(container, { variant = null } = {}) {
    // Purely decorative, continuously-animated follower — skip entirely
    // for reduced-motion users instead of just disabling the CSS parts.
    if (typeof Horror !== 'undefined' && Horror.prefersReducedMotion()) {
      return function stop() {};
    }

    const leadEl = document.createElement('div');
    leadEl.className = 'butterfly butterfly-cursor';
    leadEl.style.animation = 'none';
    leadEl.style.opacity = '0';
    container.appendChild(leadEl);

    let targetX = -100, targetY = -100;
    let curX = -100, curY = -100;
    let raf = null;
    let active = false;
    let colorIndex = 0;
    let frameCount = 0;
    let lastTrailX = -100, lastTrailY = -100;

    function currentColors() {
      // If a fixed variant was requested, stick to it; otherwise cycle.
      if (variant === 'black') return CURSOR_TRAIL_COLORS[3];
      if (variant === 'violet') return CURSOR_TRAIL_COLORS[0];
      return CURSOR_TRAIL_COLORS[colorIndex];
    }

    function onMove(e) {
      const point = e.touches ? e.touches[0] : e;
      if (!point) return;
      const rect = container.getBoundingClientRect();
      targetX = point.clientX - rect.left;
      targetY = point.clientY - rect.top;
      if (!active) {
        active = true;
        leadEl.style.opacity = '0.85';
      }
    }

    function spawnTrailDot(x, y) {
      const dot = document.createElement('div');
      dot.className = 'butterfly butterfly-cursor-trail';
      dot.innerHTML = _coloredSvg(currentColors());
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      container.appendChild(dot);
      requestAnimationFrame(() => {
        dot.style.opacity = '0';
        dot.style.transform = 'translate(-50%, -50%) scale(0.4)';
      });
      setTimeout(() => dot.remove(), 900);
    }

    function tick() {
      // Lagging follow — ~10% of the distance per frame.
      curX += (targetX - curX) * 0.1;
      curY += (targetY - curY) * 0.1;
      leadEl.style.left = `${curX}px`;
      leadEl.style.top = `${curY}px`;
      leadEl.style.transform = `translate(-50%, -60%)`;
      leadEl.innerHTML = _coloredSvg(currentColors());

      frameCount++;
      // Cycle color roughly twice a second
      if (variant === null && frameCount % 30 === 0) {
        colorIndex = (colorIndex + 1) % CURSOR_TRAIL_COLORS.length;
      }

      // Drop a fading trail dot every few frames, only while actually moving
      const moved = Math.hypot(curX - lastTrailX, curY - lastTrailY);
      if (active && moved > 14) {
        spawnTrailDot(curX, curY);
        lastTrailX = curX;
        lastTrailY = curY;
      }

      raf = requestAnimationFrame(tick);
    }

    container.addEventListener('mousemove', onMove);
    container.addEventListener('touchmove', onMove, { passive: true });
    raf = requestAnimationFrame(tick);

    return function stop() {
      cancelAnimationFrame(raf);
      container.removeEventListener('mousemove', onMove);
      container.removeEventListener('touchmove', onMove);
      leadEl.remove();
      container.querySelectorAll('.butterfly-cursor-trail').forEach(d => d.remove());
    };
  }

  return { spawn, ambient, cursorTrail };
})();
