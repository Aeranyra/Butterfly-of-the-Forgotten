/**
 * CURSOR TRAIL
 * Ambient, decorative-only. A faint trail of glowing dots follows the
 * pointer (mouse, pen, or touch — Pointer Events cover all three),
 * alternating between the violet and red accents already used by the
 * Glitch Dialogue System and the butterfly motif, so it reads as part
 * of the same visual language rather than a generic effect.
 *
 * Respects prefers-reduced-motion (skips entirely) and throttles spawn
 * rate so it never floods the DOM.
 */

const CursorTrail = (() => {
  const COLORS = [
    'rgba(155, 133, 176, 0.7)',  // violet
    'rgba(176, 68, 68, 0.65)'    // red
  ];

  const MIN_INTERVAL_MS = 40;
  const DOT_LIFETIME_MS = 700;

  let lastSpawn = 0;
  let colorIndex = 0;

  function spawnDot(x, y) {
    const dot = document.createElement('div');
    dot.className = 'cursor-trail-dot';
    const color = COLORS[colorIndex % COLORS.length];
    colorIndex++;

    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    dot.style.background = color;
    dot.style.boxShadow = `0 0 7px ${color}`;

    document.body.appendChild(dot);

    // Force reflow so the transition actually animates from the start state
    void dot.offsetWidth;

    requestAnimationFrame(() => {
      dot.style.transform = 'translate(-50%, -50%) scale(0)';
      dot.style.opacity = '0';
    });

    setTimeout(() => dot.remove(), DOT_LIFETIME_MS);
  }

  function handlePointerMove(e) {
    const now = performance.now();
    if (now - lastSpawn < MIN_INTERVAL_MS) return;
    lastSpawn = now;
    spawnDot(e.clientX, e.clientY);
  }

  function init() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
  }

  return { init };
})();
