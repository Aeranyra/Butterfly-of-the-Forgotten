/**
 * MAIN GAME CONTROLLER
 * Wires: Title -> Prologue -> Personality Test -> Name Input
 * Uses Player/GameState (state.js), AudioManager (audio.js),
 * Butterfly (butterfly.js), and GlitchDialogue (glitch.js).
 */

(() => {

  // ---------- PROLOGUE CONTENT (from locked design doc) ----------
  const PROLOGUE_BEATS = [
    "Where am I?",
    "You wake within an academy that should not exist.",
    "No—",
    "That's not how it starts.",
    "I…",
    "I don't remember opening my eyes.",
    "Just darkness.",
    "Then this place.",
    "The students know my name.",
    "I don't know theirs.",
    "I don't know mine either.",
    "But they look at me like I've always been here.",
    "The halls remember my footsteps.",
    "That thought makes my stomach twist.",
    "Because I don't remember walking.",
    "At all.",
    "Something is wrong.",
    "I can feel it under my skin.",
    "Like a warning I can't translate.",
    "A black butterfly lands somewhere nearby.",
    "I don't see where it came from.",
    "I just know it's there.",
    "Watching.",
    "And then—",
    "A message.",
    "Not spoken.",
    "Not heard.",
    "Just… understood.",
    "\"Only those who remember may leave.\"",
    "Remember what?",
    "I can't remember anything.",
    "Not my name.",
    "Not my past.",
    "Not how I got here.",
    "Five people awaken inside the academy.",
    "That part feels… real.",
    "Like I'm not the only one confused.",
    "Like I'm not alone in this nightmare.",
    "But that doesn't make it better.",
    "It makes it worse.",
    "None of us remember how we arrived.",
    "None of us are saying it out loud.",
    "Because saying it makes it real.",
    "But not everyone is who they seem.",
    "That thought appears in my mind.",
    "I don't know if it's mine.",
    "The academy is silent.",
    "Too silent.",
    "Like it's listening.",
    "And somewhere in the darkness…",
    "the butterfly waits.",
    "Not moving.",
    "Not leaving.",
    "Just waiting.",
    "For me to remember something I don't even know I've forgotten."
  ];

  // ---------- PERSONALITY PROMPTS (from locked design doc) ----------
  const PROMPTS = [
    {
      id: 'p1',
      text: '"Your name feels like it belongs to someone else."',
      choices: ['It doesn\'t', 'I don\'t know', 'It might', 'I don\'t have one']
    },
    {
      id: 'p2',
      text: '"Something follows when you stop thinking about it."',
      choices: ['Keep thinking', 'Stop thinking', 'Turn away', 'Ignore it completely']
    },
    {
      id: 'p3',
      text: '"There is a place that does not change even when you forget it."',
      choices: ['I want to see it', 'I have seen it before', 'It should not exist', 'I will not go']
    }
  ];

  // ---------- SCENE TRANSITION HELPER ----------
  function goToScene(sceneId) {
    document.querySelectorAll('.scene').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sceneId);
    if (target) target.classList.add('active');
    Player.setScene(sceneId);
  }

  // ====================================================================
  // TITLE SCREEN
  // ====================================================================
  function initTitleScreen() {
    const clickHint = document.getElementById('click-to-begin');
    const titleScene = document.getElementById('scene-title');
    let stopButterflies = null;

    // Ambient butterflies once unlocked
    function startAmbience() {
      if (stopButterflies) return;
      stopButterflies = Butterfly.ambient(titleScene, 4500);
    }

    // Any click anywhere unlocks audio (browser requirement) and starts music
    document.body.addEventListener('click', function unlockOnce() {
      AudioManager.unlock('menu');
      startAmbience();
      if (clickHint) clickHint.style.display = 'none';
      document.body.removeEventListener('click', unlockOnce);
    }, { once: true });

    document.getElementById('btn-start').addEventListener('click', (e) => {
      e.stopPropagation();
      beginOpeningSequence();
    });

    document.getElementById('btn-how-to-play').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('modal-how-to-play').classList.add('active');
    });
    document.getElementById('close-how-to-play').addEventListener('click', () => {
      document.getElementById('modal-how-to-play').classList.remove('active');
    });

    document.getElementById('btn-credits').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('modal-credits').classList.add('active');
    });
    document.getElementById('close-credits').addEventListener('click', () => {
      document.getElementById('modal-credits').classList.remove('active');
    });
  }

  // ====================================================================
  // OPENING SEQUENCE -> PROLOGUE
  // ====================================================================
  function beginOpeningSequence() {
    const titleScene = document.getElementById('scene-title');
    titleScene.style.transition = 'opacity 1.4s ease';
    titleScene.style.opacity = '0';

    setTimeout(() => {
      goToScene('scene-prologue');
      AudioManager.play('prologue');
      runPrologue();
    }, 1500);
  }

  // Lines that force a silent pause before the click prompt appears
  const PROLOGUE_FORCED_PAUSES = {
    "I don't remember opening my eyes.": 1500,
    "Watching.": 2000,
    "Because saying it makes it real.": 1500,
    "the butterfly waits.": 2000
  };

  // The one line that flickers in instead of fading in (received, not narrated)
  const PROLOGUE_FLICKER_LINE = '"Only those who remember may leave."';

  // Triggers the false-interaction butterfly moment right after this line
  const PROLOGUE_BUTTERFLY_TRIGGER = 'A black butterfly lands somewhere nearby.';

  function runPrologue() {
    const textEl = document.getElementById('prologue-text');
    const sceneEl = document.getElementById('scene-prologue');
    const continueBtn = document.getElementById('btn-prologue-continue');
    let index = 0;
    let awaitingClick = false;
    let extraDelay = 0; // set by the false-interaction moment

    function flickerIn(el, text) {
      let pulses = 0;
      el.style.opacity = '0';
      el.textContent = text;
      const interval = setInterval(() => {
        el.style.opacity = el.style.opacity === '0' ? '1' : '0';
        pulses++;
        if (pulses >= 5) {
          clearInterval(interval);
          el.style.opacity = '1';
        }
      }, 90);
    }

    function showBeat() {
      if (index >= PROLOGUE_BEATS.length) {
        continueBtn.style.display = 'inline-block';
        return;
      }

      const beat = PROLOGUE_BEATS[index];
      awaitingClick = false;

      const render = () => {
        if (beat === PROLOGUE_FLICKER_LINE) {
          const span = document.createElement('span');
          span.className = 'beat';
          span.style.animation = 'none';
          span.style.opacity = '1';
          textEl.innerHTML = '';
          textEl.appendChild(span);
          flickerIn(span, beat);
        } else {
          textEl.innerHTML = `<span class="beat">${beat}</span>`;
        }
        index++;
        awaitingClick = true;

        // False interaction: a real butterfly drifts across, clickable but inert
        if (beat === PROLOGUE_BUTTERFLY_TRIGGER) {
          Butterfly.spawn(sceneEl, { count: 1, duration: [3000, 4000] });
          extraDelay = 600; // next beat lands slightly later than expected, regardless of click
        }
      };

      const forcedPause = PROLOGUE_FORCED_PAUSES[beat];
      if (forcedPause) {
        awaitingClick = false; // block input during forced silence
        setTimeout(() => render(), forcedPause);
      } else {
        render();
      }
    }

    function advance() {
      if (!awaitingClick) return; // ignore clicks during forced pauses
      const hint = document.getElementById('prologue-tap-hint');
      if (hint) hint.style.display = 'none';
      awaitingClick = false;
      const delay = extraDelay;
      extraDelay = 0;
      if (delay) {
        setTimeout(showBeat, delay);
      } else {
        showBeat();
      }
    }

    sceneEl.addEventListener('click', advance);
    showBeat();

    continueBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sceneEl.removeEventListener('click', advance);
      goToScene('scene-personality');
      AudioManager.play('personalityTest');
      runPersonalityTest();
    }, { once: true });
  }

  // ====================================================================
  // PERSONALITY TEST
  // ====================================================================
  function runPersonalityTest() {
    let promptIndex = 0;

    function showPrompt() {
      if (promptIndex >= PROMPTS.length) {
        finishPersonalityTest();
        return;
      }
      const prompt = PROMPTS[promptIndex];
      document.getElementById('prompt-meta').textContent = `Prompt ${promptIndex + 1} / ${PROMPTS.length}`;
      document.getElementById('prompt-text').textContent = prompt.text;

      const choiceContainer = document.getElementById('prompt-choices');
      choiceContainer.innerHTML = '';

      // One option per prompt is subtly de-emphasized — never labeled, never explained
      const oddIndex = Math.floor(Math.random() * prompt.choices.length);

      const buttons = [];
      prompt.choices.forEach((choiceText, i) => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = choiceText;
        if (i === oddIndex) {
          btn.style.opacity = '0.82';
          btn.style.paddingLeft = '1.2rem';
        }
        btn.addEventListener('click', () => {
          // Choice acknowledgment beat: chosen brightens, others fade, brief held pause
          buttons.forEach(b => {
            if (b === btn) {
              b.style.opacity = '1';
              b.style.borderColor = 'var(--accent-violet-bright)';
            } else {
              b.style.transition = 'opacity 0.3s ease';
              b.style.opacity = '0.08';
              b.disabled = true;
            }
          });
          AudioManager.playStatic(0.1);

          setTimeout(() => {
            Player.addPersonalityAnswer(prompt.id, choiceText);
            promptIndex++;
            showPrompt();
          }, 700); // 300ms fade + 400ms held pause
        });
        choiceContainer.appendChild(btn);
        buttons.push(btn);
      });
    }

    function finishPersonalityTest() {
      const content = document.querySelector('#scene-personality .scene-content');
      content.innerHTML = `<p class="narrative-text" id="role-decision-text"></p>`;
      const textEl = document.getElementById('role-decision-text');

      // Lengthened pre-reveal silence: screen dims slightly, no text, before the glitch line fires
      const sceneEl = document.getElementById('scene-personality');
      sceneEl.style.transition = 'filter 1.2s ease';
      sceneEl.style.filter = 'brightness(0.6)';

      setTimeout(() => {
        sceneEl.style.filter = 'brightness(1)';
        GlitchDialogue.render(textEl, 'RESPONSE ACCEPTED.', Player.get().sanity);
      }, 2500);

      setTimeout(() => {
        GlitchDialogue.render(textEl, 'ACADEMY HAS MADE ITS DECISION.', Player.get().sanity);
      }, 4300);

      setTimeout(() => {
        // Solo-test placeholder: real distribution is 2 Wanderer / 1 Betrayer /
        // 1 Observer / 1 Forgotten across a 5-player session (locked design),
        // assigned by the Session Lobby system once it exists. Until then,
        // weight a single-player roll to match that ratio (2/5 Wanderer odds)
        // rather than an even 1-in-4 roll across all roles.
        const weightedRoles = ['wanderer', 'wanderer', 'betrayer', 'observer', 'forgotten'];
        const assignedRole = weightedRoles[Math.floor(Math.random() * weightedRoles.length)];
        Player.update({ role: assignedRole });

        goToScene('scene-name-input');
        AudioManager.play('nameInput');
      }, 6100);
    }

    showPrompt();
  }

  // ====================================================================
  // NAME INPUT
  // ====================================================================
  function initNameInput() {
    document.getElementById('btn-name-continue').addEventListener('click', () => {
      const field = document.getElementById('name-field');
      const name = field.value.trim();
      if (!name) {
        field.focus();
        field.style.borderColor = 'var(--accent-warning-bright)';
        return;
      }
      Player.setName(name);
      goToScene('scene-classroom-stub');
      AudioManager.play('classroom');
    });

    // Allow Enter key to confirm
    document.getElementById('name-field').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('btn-name-continue').click();
      }
    });
  }

  // ====================================================================
  // INIT
  // ====================================================================
  document.addEventListener('DOMContentLoaded', () => {
    initTitleScreen();
    initNameInput();
  });

})();
