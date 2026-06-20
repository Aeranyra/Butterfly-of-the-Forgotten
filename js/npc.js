/**
 * NPC SYSTEM
 * Implements the locked design: NPCs are never confirmed real, speak in
 * lines that are always slightly "off", and render into a reserved zone
 * so they never collide with main narrative text.
 *
 * Two types implemented here:
 *  - Background Students (silent, ambient, decorative-but-not-only)
 *  - Named Recurring NPCs (Teacher, Girl in the Corridor, Librarian,
 *    Boy Who Remembers) — each has a fixed identity but lines are
 *    authored per-room, passed in by the calling room script.
 */

const NPC = (() => {

  function getZone() {
    return document.querySelector('.npc-zone');
  }

  /**
   * Shows a single NPC line in the reserved zone. Optionally glitched —
   * NPCs are allowed to use the Glitch Dialogue System more liberally
   * than player-facing UI, per the locked rule that glitch lines feel
   * native to them rather than jarring.
   */
  function speak(text, { glitch = false, sanity = 75, holdMs = 3200 } = {}) {
    const zone = getZone();
    if (!zone) return Promise.resolve();

    return new Promise(resolve => {
      const line = document.createElement('p');
      line.className = 'npc-line';
      zone.innerHTML = '';
      zone.appendChild(line);

      // Force reflow so the transition fires
      void line.offsetWidth;

      if (glitch && window.GlitchDialogue) {
        line.classList.add('visible');
        line.textContent = '';
        // small delay so the fade-in starts before the glitch scramble
        setTimeout(() => GlitchDialogue.render(line, text, sanity), 150);
      } else {
        line.textContent = text;
        line.classList.add('visible');
      }

      setTimeout(() => {
        line.classList.remove('visible');
        setTimeout(resolve, 1000);
      }, holdMs);
    });
  }

  /**
   * Background Students — ambient, near-silent presence. Per design,
   * decorative but not decoration-only: rendered distinctly dim/small
   * so they read as population, not narration.
   */
  function showBackgroundStudents(count = 3) {
    const zone = getZone();
    if (!zone) return;
    const line = document.createElement('p');
    line.className = 'npc-line background-student';
    zone.innerHTML = '';
    zone.appendChild(line);
    void line.offsetWidth;
    line.textContent = count === 1
      ? 'A student you don\'t recognize sits nearby.'
      : `${count} students fill the other seats. None of them look new.`;
    line.classList.add('visible');
  }

  function clearZone() {
    const zone = getZone();
    if (zone) zone.innerHTML = '';
  }

  // Named Recurring NPCs — identity registry only; actual lines are
  // authored per-room (e.g. Classroom passes The Teacher's lesson
  // fragment directly to speak()).
  const NAMED = {
    teacher: { label: 'The Teacher', firstAppearance: 'classroom' },
    girlInCorridor: { label: 'The Girl in the Corridor', firstAppearance: 'hallway' },
    librarian: { label: 'The Librarian', firstAppearance: 'library' },
    boyWhoRemembers: { label: 'The Boy Who Remembers', firstAppearance: 'clockTower' }
  };

  return { speak, showBackgroundStudents, clearZone, NAMED };
})();
