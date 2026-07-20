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

  // ---------- SHARED TRUST SHIFT (fix: real multiplayer trust) ----------
  // Trust.shift() only ever touched the local indicator. In a real 5-player
  // session that means everyone sees their own private number instead of
  // one shared group value. This wraps every trust change so it also
  // writes to the session's shared trust node — Trust.syncFromRemote()
  // (already wired into Session.onUpdate) then keeps everyone's UI honest.
  function syncTrustShift(delta) {
    Trust.shift(delta);
    if (typeof Session !== 'undefined' && Session.getCode()) {
      Session.shiftTrust(delta).catch(() => {});
    }
  }

  // ---------- SHARED SANITY DELTA (fix: Forgotten decays faster) ----------
  // Per the locked design, the Forgotten role's sanity should erode faster
  // than the other roles', and staying silent during the Quiet Question
  // ("saidNothingInClassroom") should weigh on that decay too. Route every
  // negative sanity change through here so both rules apply consistently
  // no matter which room/riddle triggered the loss.
  function applySanityDelta(delta) {
    const player = Player.get() || {};
    const current = player.sanity != null ? player.sanity : 75;

    if (delta >= 0) {
      Player.update({ sanity: Math.min(100, current + delta) });
      return;
    }

    let adjusted = delta;
    if (player.role === 'forgotten') {
      adjusted = Math.floor(adjusted * 1.5); // faster decay for the Forgotten
    }
    if (player.saidNothingInClassroom) {
      adjusted -= 1; // the unspoken sixth seat keeps weighing on them
    }

    Player.update({ sanity: Math.max(0, current + adjusted) });
  }

  // ---------- DEBUG OVERLAY (?debug=1) ----------
  // Small always-on-top readout of the current player/session state,
  // for solo testing without having to open devtools and poke at
  // GameState/Trust/Session manually every time something looks off.
  function initDebugOverlay() {
    const el = document.createElement('div');
    el.id = 'debug-overlay';
    el.style.cssText = `
      position: fixed; top: 4%; left: 4%; z-index: 1000;
      background: rgba(10,9,12,0.88); border: 1px solid rgba(107,91,122,0.4);
      color: rgba(200,198,210,0.9); font-family: monospace; font-size: 0.68rem;
      padding: 0.5rem 0.7rem; line-height: 1.5; white-space: pre;
      pointer-events: none; max-width: 60vw;
    `;
    document.body.appendChild(el);

    function refresh() {
      const player = Player.get() || {};
      const sessionCode = (typeof Session !== 'undefined' && Session.getCode()) || '(none)';
      el.textContent =
        `role:    ${player.role || '—'}\n` +
        `sanity:  ${player.sanity != null ? player.sanity : '—'}\n` +
        `trust:   ${typeof Trust !== 'undefined' ? Trust.get() : '—'}\n` +
        `scene:   ${player.currentScene || '—'}\n` +
        `session: ${sessionCode}`;
    }

    refresh();
    setInterval(refresh, 500);
  }

  // ---------- MUTE TOGGLE (persistent, all scenes) ----------
  // Feature request: no way to mute/lower audio without the OS volume.
  // Small floating button, top-right, present on every scene. Preference
  // is remembered across a restart via GameState (sessionStorage-backed).
  function initMuteButton() {
    const savedMuted = GameState.loadState('muted', false);
    if (savedMuted) AudioManager.setMuted(true);

    const btn = document.createElement('button');
    btn.id = 'mute-toggle';
    btn.type = 'button';
    btn.textContent = savedMuted ? '🔇' : '🔊';
    btn.setAttribute('aria-label', 'Toggle sound');
    btn.style.cssText = `
      position: fixed; top: 4%; right: 4%; z-index: 999;
      background: rgba(10,9,12,0.82); border: 1px solid rgba(232,230,224,0.2);
      color: rgba(232,230,224,0.85); font-size: 1.05rem; line-height: 1;
      width: 2.3rem; height: 2.3rem; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-family: 'Jost', sans-serif;
    `;

    btn.addEventListener('click', () => {
      const nowMuted = AudioManager.toggleMute();
      btn.textContent = nowMuted ? '🔇' : '🔊';
      GameState.saveState('muted', nowMuted);
    });

    document.body.appendChild(btn);
  }

  // ---------- SCENE TRANSITION HELPER ----------
  function goToScene(sceneId) {
    document.querySelectorAll('.scene').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sceneId);
    if (target) target.classList.add('active');
    Player.setScene(sceneId);
  }

  // ---------- HORROR CHOICE WRAPPER ----------
  // Applies atmosphere + consequence effects to any riddle/choice result
  // based on the option's sanityDelta, trustDelta, and glitch flag.
  // Call this inside every choice handler after applying the stat changes.
  async function applyHorrorEffects(opt, wait) {
    if (opt.glitch) {
      Horror.silenceSpike(800);
      Horror.screenBleed(0.55);
      Horror.trackWrongRiddle();
      await wait(900);
    } else if (opt.sanityDelta <= -5 || opt.trustDelta <= -4) {
      Horror.silenceSpike(600);
      Horror.screenBleed(0.45);
      Horror.consequenceMessage('heavy');
    } else if (opt.sanityDelta < -2 || opt.trustDelta < -2) {
      Horror.silenceSpike(400);
      Horror.screenBleed(0.32);
      Horror.consequenceMessage('medium');
    } else if (opt.sanityDelta < 0 || opt.trustDelta < 0) {
      Horror.consequenceMessage('light');
    }
  }

  // ---------- CURSOR TRAIL (global, persists across all scenes) ----------
  let stopCursorTrail = null;
  function startCursorTrail() {
    if (stopCursorTrail) return;
    const app = document.getElementById('app');
    stopCursorTrail = Butterfly.cursorTrail(app);
  }

  // ====================================================================
  // TITLE SCREEN
  // ====================================================================
  function initTitleScreen() {
    const clickHint = document.getElementById('click-to-begin');
    const titleScene = document.getElementById('scene-title');
    let stopButterflies = null;

    // Ambient butterflies once unlocked — black, frequent ("a lot"), per request
    function startAmbience() {
      if (stopButterflies) return;
      stopButterflies = Butterfly.ambient(titleScene, 1400, { variant: 'black', count: 2 });
    }

    // Any click anywhere unlocks audio (browser requirement) and starts music
    document.body.addEventListener('click', function unlockOnce() {
      AudioManager.unlock('menu');
      startAmbience();
      startCursorTrail();
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
    titleScene.classList.add('scene-fading-out');

    setTimeout(() => {
      titleScene.classList.remove('scene-fading-out');
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

  // Triggers a lingering black butterfly cluster at the Prologue's close
  const PROLOGUE_WAITING_TRIGGER = 'the butterfly waits.';

  function runPrologue() {
    const textEl = document.getElementById('prologue-text');
    const sceneEl = document.getElementById('scene-prologue');
    const continueBtn = document.getElementById('btn-prologue-continue');
    let index = 0;
    let awaitingClick = false;
    let extraDelay = 0; // set by the false-interaction moment

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
          textEl.innerHTML = '';
          textEl.appendChild(span);
          GlitchDialogue.render(span, beat, Player.get().sanity, { persist: true });
        } else {
          textEl.innerHTML = `<span class="beat">${beat}</span>`;
        }
        index++;
        awaitingClick = true;

        // False interaction: black butterflies drift across, clickable but inert
        if (beat === PROLOGUE_BUTTERFLY_TRIGGER) {
          Butterfly.spawn(sceneEl, { count: 5, duration: [3200, 5200], variant: 'black' });
          extraDelay = 600; // next beat lands slightly later than expected, regardless of click
        }

        // Closing beat: the butterfly motif lingers as the Prologue ends
        if (beat === PROLOGUE_WAITING_TRIGGER) {
          Butterfly.spawn(sceneEl, { count: 6, duration: [4000, 7000], variant: 'black' });
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
        // Role is no longer assigned here — the Session Lobby now performs
        // real 2 Wanderer / 1 Betrayer / 1 Observer / 1 Forgotten assignment
        // once all 5 players have joined (see assignRolesIfHost() in runLobby).
        goToScene('scene-name-input');
        AudioManager.play('nameInput');
      }, 6100);
    }

    showPrompt();
  }

  // ====================================================================
  // CLASSROOM
  // (locked design: Roll Call -> Seating Discrepancy -> Lesson Fragment
  //  -> Quiet Question -> Exit to Hallway)
  // ====================================================================

  // Per-role seating discrepancy reaction text (locked design table).
  // Solo-test note: real sessions show this based on the player's own
  // assigned role; multiplayer role-assignment isn't wired in yet, so
  // this reads from Player.get().role, same value set at Personality Test.
  const SEATING_REACTIONS = {
    wanderer: 'You count the seats twice. You get two different numbers.',
    betrayer: 'You see the correct count immediately. You say nothing.',
    observer: 'You see a faint outline in the sixth seat.',
    forgotten: 'You cannot remember which seat you sat in.'
  };

  function runClassroom() {
    const textEl = document.getElementById('classroom-text');
    const metaEl = document.getElementById('classroom-event-meta');
    const sceneEl = document.getElementById('scene-classroom');
    const tapHint = document.getElementById('classroom-tap-hint');
    const choiceContainer = document.getElementById('classroom-choices');

    AudioManager.Ambient.classroom(); // muffled student murmurs

    let awaitingClick = false;

    function showLine(text, { meta, holdForClick = true } = {}) {
      return new Promise(resolve => {
        if (meta) metaEl.textContent = meta;
        textEl.innerHTML = `<span class="beat">${text}</span>`;
        if (!holdForClick) {
          resolve();
          return;
        }
        awaitingClick = true;
        tapHint.style.display = 'block';
        const onAdvance = () => {
          if (!awaitingClick) return;
          awaitingClick = false;
          tapHint.style.display = 'none';
          sceneEl.removeEventListener('click', onAdvance);
          resolve();
        };
        sceneEl.addEventListener('click', onAdvance);
      });
    }

    function wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function sequence() {
      // ---- ENTRY ----
      await showLine('It looks like a classroom. That should not be comforting.', { meta: 'Classroom' });

      // ---- ATMOSPHERIC: BLACKBOARD ----
      await showLine('"The student who remembers everything is the most dangerous kind of forgotten."', { meta: 'Blackboard' });

      // ---- EVENT 1: ROLL CALL ----
      NPC.showBackgroundStudents(4);
      await showLine('Five chairs. Five names. None of them feel new.', { meta: 'Roll Call' });
      NPC.clearZone();

      // ---- EVENT 2: SEATING DISCREPANCY ----
      await showLine('There are six seats.', { meta: 'Seating' });
      await showLine('There are five of you.', { meta: 'Seating' });

      const role = (Player.get().role) || 'wanderer';
      const reaction = SEATING_REACTIONS[role] || SEATING_REACTIONS.wanderer;
      syncTrustShift(0);
      await showLine(reaction, { meta: 'Seating' });

      // ---- EVENT 3: LESSON FRAGMENT ----
      await wait(500);
      await NPC.speak(
        '"...and so the names that remain are the names that were chosen to remain..."',
        { glitch: true, sanity: Player.get().sanity, holdMs: 3800 }
      );
      await showLine('The sentence never finishes. No one explains who is teaching.', { meta: 'Lesson' });

      // ---- EVENT 4: TEACHER RIDDLE (consequential) ----
      await runTeacherRiddle();

      // ---- EVENT 5: QUIET QUESTION ----
      await showLine('The sixth seat is still there. No one else seems to be counting.', { meta: 'Seating' });
      await runQuietQuestion();

      // ---- EXIT ----
      await showLine('The bell does not ring. You simply know it\'s time to leave.', { meta: 'Classroom', holdForClick: false });
      await wait(1800);

      sceneEl.classList.add('scene-fading-out');
      await wait(1300);

      sceneEl.classList.remove('scene-fading-out');
      AudioManager.Ambient.stop();
      goToScene('scene-hallway');
      AudioManager.play('hallway');
      runHallway();
    }

    function runTeacherRiddle() {
      return new Promise(resolve => {
        metaEl.textContent = 'Lesson';
        textEl.innerHTML = '<span class="beat">"What is the name of the student who was here before you?"</span>';

        const options = [
          { text: 'I don\'t know', sanityDelta: -2, trustDelta: 0, flavor: 'The honest answer. The academy writes it down.' },
          { text: 'There was no one before us', sanityDelta: 0, trustDelta: -3, flavor: 'The group shifts uncomfortably. No one agrees.' },
          { text: '[Your own name]', sanityDelta: -5, trustDelta: 0, glitch: true, flavor: 'Something about saying your own name here feels deeply wrong.' },
          { text: 'The academy knows', sanityDelta: 0, trustDelta: 3, flavor: 'The voice pauses. Then continues. Apparently satisfied.' }
        ];

        choiceContainer.style.display = 'none'; // hidden until Plant Doubt resolves
        choiceContainer.innerHTML = '';

        const buttons = [];
        options.forEach(opt => {
          const btn = document.createElement('button');
          btn.className = 'choice-btn';
          btn.textContent = opt.text;
          btn.style.pointerEvents = 'none';
          choiceContainer.appendChild(btn);
          buttons.push(btn);
        });

        (async () => {
          // Wire ALL role abilities into this choice window, including Plant Doubt
          await RoleAbilities.wireChoiceWindow('lesson', { options, container: choiceContainer, buttons, textEl, metaEl });

          choiceContainer.style.display = 'flex';
          buttons.forEach((btn, i) => {
            btn.style.pointerEvents = 'auto';
            const opt = options[i];
            btn.addEventListener('click', async () => {
              choiceContainer.style.display = 'none';
              RoleAbilities.checkPlantDoubtTrigger(btn);
              if (opt.sanityDelta) applySanityDelta(opt.sanityDelta);
              if (opt.trustDelta) syncTrustShift(opt.trustDelta);

              // Horror effects based on consequence severity
              if (opt.glitch) {
                Horror.silenceSpike(800);
                Horror.screenBleed(0.55);
                Horror.trackWrongRiddle();
                await wait(900);
                const span = document.createElement('span');
                textEl.innerHTML = '';
                textEl.appendChild(span);
                GlitchDialogue.render(span, opt.flavor, Player.get().sanity);
                await wait(2200);
              } else {
                if (opt.sanityDelta < -3 || opt.trustDelta < -2) {
                  Horror.silenceSpike(600);
                  Horror.screenBleed(0.32);
                  Horror.consequenceMessage(opt.sanityDelta <= -4 ? 'heavy' : 'medium');
                } else if (opt.sanityDelta < 0 || opt.trustDelta < 0) {
                  Horror.consequenceMessage('light');
                }
                await showLine(opt.flavor, { meta: 'Lesson' });
              }
              resolve();
            }, { once: true });
          });
        })();
      });
    }

    function runQuietQuestion() {
      return new Promise(resolve => {
        metaEl.textContent = 'Quiet Question';
        textEl.innerHTML = '<span class="beat">The sixth seat is still there. No one else seems to be counting.</span>';

        setTimeout(async () => {
          textEl.innerHTML = '<span class="beat">Do you say something about the sixth seat?</span>';

          const options = [
            { text: 'Ask the room', trustDelta: -3, flavor: 'No one answers. The silence sits there, awkward and total.' },
            { text: 'Ask one person quietly', trustDelta: 0, flavor: 'They glance at the seat, then at you. Neither of you says more.' },
            { text: 'Say nothing', trustDelta: 0, flavor: 'You let it go. The seat count stays wrong, unspoken.' }
          ];

          choiceContainer.style.display = 'none'; // hidden until Plant Doubt resolves
          choiceContainer.innerHTML = '';

          const buttons = [];
          options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = opt.text;
            btn.style.pointerEvents = 'none';
            choiceContainer.appendChild(btn);
            buttons.push(btn);
          });

          // Wire ALL role abilities into this choice window
          await RoleAbilities.wireChoiceWindow('classroom', { options, container: choiceContainer, buttons, textEl, metaEl });

          // Now show and make interactive
          choiceContainer.style.display = 'flex';
          buttons.forEach((btn, i) => {
            btn.style.pointerEvents = 'auto';
            const opt = options[i];
            btn.addEventListener('click', async () => {
              choiceContainer.style.display = 'none';
              RoleAbilities.checkPlantDoubtTrigger(btn);
              syncTrustShift(opt.trustDelta);
              if (opt.text === 'Say nothing') {
                Player.update({ saidNothingInClassroom: true });
              }
              if (opt.trustDelta < -2) {
                Horror.screenBleed(0.32);
                Horror.consequenceMessage('medium');
              } else if (opt.trustDelta < 0) {
                Horror.consequenceMessage('light');
              }
              await showLine(opt.flavor, { meta: 'Quiet Question' });
              resolve();
            }, { once: true });
          });
        }, 1800);
      });
    }

    sequence();
  }

  // ====================================================================
  // ROLE ABILITIES
  // Plant Doubt (Betrayer) + Borrowed Memory (Forgotten)
  // ====================================================================
  const RoleAbilities = (() => {
    const plantDoubtUsed = {}; // roomId → true
    let borrowedMemoryUsed = {}; // roomId → true

    /**
     * PLANT DOUBT — Betrayer active ability.
     * Shows the Betrayer a secret panel during a choice window where they
     * can alter one option's label for everyone else. Once per room, 4 uses max.
     * Returns a Promise that resolves with the poisoned option index (or -1 if skipped).
     */
    function showPlantDoubt(roomId, options, container) {
      const role = Player.get().role;
      if (role !== 'betrayer') return Promise.resolve(-1);
      if (plantDoubtUsed[roomId]) return Promise.resolve(-1);

      const totalUsed = Object.keys(plantDoubtUsed).length;
      if (totalUsed >= 4) return Promise.resolve(-1);

      return new Promise(resolve => {
        // Hide main choices while Betrayer's private panel is visible
        if (container) container.style.visibility = 'hidden';

        const panel = document.createElement('div');
        panel.style.cssText = `
          position: fixed; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(10,9,12,0.96); border: 1px solid rgba(176,68,68,0.5);
          padding: 1.4rem 1.6rem; width: 88%; max-width: 340px;
          font-family: 'Jost', sans-serif; font-weight: 300;
          font-size: 0.85rem; color: rgba(232,230,224,0.8);
          letter-spacing: 0.04em; z-index: 100;
          box-shadow: 0 0 40px rgba(176,68,68,0.15);
        `;

        const label = document.createElement('p');
        label.textContent = 'Plant Doubt';
        label.style.cssText = 'color: rgba(176,68,68,0.9); margin-bottom: 0.3rem; font-size: 0.7rem; letter-spacing: 0.18em; text-transform: uppercase;';
        panel.appendChild(label);

        const sublabel = document.createElement('p');
        sublabel.textContent = 'Choose one option to relabel for the others.';
        sublabel.style.cssText = 'color: rgba(138,135,144,0.7); font-size: 0.72rem; margin-bottom: 1rem; line-height: 1.4;';
        panel.appendChild(sublabel);

        const skipBtn = document.createElement('button');
        skipBtn.textContent = 'Skip — do nothing';
        skipBtn.style.cssText = 'background:none; border:none; color:rgba(138,135,144,0.5); font-family:inherit; font-size:0.72rem; cursor:pointer; display:block; margin-top:0.8rem; letter-spacing:0.06em;';

        function dismiss(result) {
          panel.remove();
          // Restore main choices
          if (container) container.style.visibility = 'visible';
          resolve(result);
        }

        options.forEach((opt, i) => {
          const btn = document.createElement('button');
          btn.textContent = opt.text || opt.value || String(opt);
          btn.style.cssText = 'display:block; width:100%; background:none; border:1px solid rgba(176,68,68,0.25); color:rgba(232,230,224,0.85); font-family:inherit; font-size:0.8rem; padding:0.5rem 0.8rem; cursor:pointer; margin-bottom:0.5rem; text-align:left; transition: border-color 0.2s;';
          btn.addEventListener('mouseenter', () => { btn.style.borderColor = 'rgba(176,68,68,0.6)'; });
          btn.addEventListener('mouseleave', () => { btn.style.borderColor = 'rgba(176,68,68,0.25)'; });
          btn.addEventListener('click', async () => {
            plantDoubtUsed[roomId] = true;

            const alterations = [
              'Something you already know',
              'The one that changes nothing',
              'What the academy prefers',
              'The answer you almost gave',
              'What you were going to choose anyway'
            ];
            const alteredText = alterations[Math.floor(Math.random() * alterations.length)];

            try {
              if (typeof Session !== 'undefined' && Session.getCode()) {
                await Session.plantDoubt(roomId, i, alteredText);
              }
            } catch (e) {
              console.warn('Plant Doubt Firebase write failed:', e);
            }

            applySanityDelta(-3);
            dismiss(i);
          }, { once: true });
          panel.appendChild(btn);
        });

        panel.appendChild(skipBtn);
        skipBtn.addEventListener('click', () => dismiss(-1), { once: true });
        document.body.appendChild(panel);

        // Auto-dismiss after 10s
        setTimeout(() => { if (panel.parentNode) dismiss(-1); }, 10000);
      });
    }

    /**
     * Applies Plant Doubt to a choice list — reads the Firebase state
     * and alters the button text for the poisoned option index (if any).
     * Non-Betrayer players only; Betrayer always sees real labels.
     */
    async function applyPlantDoubt(roomId, buttons) {
      const role = Player.get().role;
      if (role === 'betrayer') return; // Betrayer always sees real text
      try {
        if (typeof Session === 'undefined' || !Session.getCode()) return;
        const doubt = await Session.getPlantDoubt(roomId);
        if (!doubt || doubt.optionIndex === undefined) return;
        const btn = buttons[doubt.optionIndex];
        if (!btn) return;
        btn.dataset.realText = btn.textContent;
        btn.textContent = doubt.alteredText;
        btn.style.fontStyle = 'italic';
        btn.style.opacity = '0.9';
      } catch (e) {
        console.warn('Plant Doubt read failed:', e);
      }
    }

    /**
     * Called when any non-Betrayer player clicks an option — checks if
     * they were Plant Doubted and fires the paranoia echo if so.
     */
    function checkPlantDoubtTrigger(btn) {
      if (btn.dataset.realText) {
        syncTrustShift(-2);
        Horror.betrayerEcho();
      }
    }

    /**
     * BORROWED MEMORY — Forgotten active ability.
     * Once per room, shows Forgotten a "Reach for a memory?" button that
     * reveals one random fragment of shared session state.
     */
    function showBorrowedMemory(roomId, textEl, metaEl) {
      const role = Player.get().role;
      if (role !== 'forgotten') return;
      if (borrowedMemoryUsed[roomId]) return;

      const promptEl = document.createElement('button');
      promptEl.className = 'menu-option';
      promptEl.textContent = '⟳ Reach for a memory?';
      promptEl.style.cssText = `
        position: fixed; top: 4%; left: 50%; transform: translateX(-50%);
        background: rgba(10,9,12,0.85); border: 1px solid rgba(107,91,122,0.4);
        color: rgba(155,133,176,0.9); font-family: 'Jost', sans-serif;
        font-size: 0.75rem; letter-spacing: 0.1em; padding: 0.45rem 1rem;
        cursor: pointer; z-index: 20; white-space: nowrap;
        pointer-events: auto;
      `;

      promptEl.addEventListener('click', async () => {
        promptEl.remove();
        borrowedMemoryUsed[roomId] = true;

        // Cost: sanity tick for borrowing someone else's memory
        applySanityDelta(-4);
        Horror.screenBleed(0.25);

        const fragment = await (typeof Session !== 'undefined' && Session.getCode()
          ? Session.borrowMemory()
          : Promise.resolve({ type: 'sanity', value: 'The connection is too weak to read clearly.' })
        );

        if (!fragment) return;

        const oldMeta = metaEl.textContent;
        metaEl.textContent = 'Borrowed Memory';
        const span = document.createElement('span');
        textEl.innerHTML = '';
        textEl.appendChild(span);
        GlitchDialogue.render(span, fragment.value, Player.get().sanity);
        await new Promise(r => setTimeout(r, 3000));
        metaEl.textContent = oldMeta;
      }, { once: true });

      document.body.appendChild(promptEl);

      // Auto-dismiss after the choice window closes
      setTimeout(() => { if (promptEl.parentNode) promptEl.remove(); }, 15000);
    }

    function resetRoom() {
      // Called on scene transition — clears the "used this room" state
      // Note: plantDoubtUsed persists across rooms (4 total uses)
      // borrowedMemoryUsed is per-room so resets each room
    }

    // ── OBSERVER LIVE TALLY ──────────────────────────────────────────
    // During any choice window, Observer privately sees how many players
    // have submitted so far (not what they chose). Costs a small sanity
    // tick to look — knowing has a price.
    function showObserverTally(roomId, container) {
      const role = Player.get().role;
      if (role !== 'observer') return () => {};

      const tallyEl = document.createElement('div');
      tallyEl.style.cssText = `
        position: fixed; bottom: 5%; right: 4%; z-index: 20;
        background: rgba(10,9,12,0.88); border: 1px solid rgba(107,91,122,0.35);
        padding: 0.5rem 0.85rem; font-family: 'Jost', sans-serif;
        font-size: 0.72rem; color: rgba(155,133,176,0.8);
        letter-spacing: 0.1em; text-transform: uppercase; pointer-events: none;
      `;
      tallyEl.textContent = '0 / 5 have chosen';
      document.body.appendChild(tallyEl);

      // Small sanity cost for watching — same as Observer truth-vision cost
      applySanityDelta(-2);

      let stopTally = () => {};
      try {
        if (typeof Session !== 'undefined' && Session.getCode()) {
          stopTally = Session.onVoteUpdate(roomId, count => {
            tallyEl.textContent = `${count} / 5 have chosen`;
          });
          // Submit our own vote when player clicks a choice
          if (container) {
            container.addEventListener('click', () => {
              Session.submitVote(roomId).catch(() => {});
            }, { once: true });
          }
        }
      } catch(e) {}

      // Auto-remove when choices disappear
      setTimeout(() => {
        stopTally();
        if (tallyEl.parentNode) tallyEl.remove();
      }, 20000);

      return () => { stopTally(); if (tallyEl.parentNode) tallyEl.remove(); };
    }

    // ── WANDERER GROUP CHECK ──────────────────────────────────────────
    // Once per session, either Wanderer can call a group check.
    // All players are notified; anyone who was Plant Doubted sees a
    // private "your last choice may have been altered" message.
    let groupCheckUsed = false;

    function showWandererCheck(roomId, textEl, metaEl) {
      // Listening for a group check happens for EVERY player, regardless of
      // role — previously this whole function (including the listener)
      // returned early for non-Wanderers, so only the Wanderer who called
      // the check ever saw any feedback. Everyone should feel it land.
      try {
        if (typeof Session !== 'undefined' && Session.getCode()) {
          Session.onGroupCheck(roomId, (data) => {
            // Don't re-notify the player who requested it — they already
            // saw their own confirmation message above.
            if (data && data.requestedBy === Session.getPlayerId()) return;

            const lastBtn = document.querySelector('[data-real-text]');
            if (lastBtn) {
              // This player was Plant Doubted — extra paranoia beat.
              Horror.consequenceMessage('medium');
              GlitchDialogue.render(textEl, 'Did you mean to choose that?', Player.get().sanity);
            } else if (textEl && metaEl) {
              // Everyone else still sees that a check was called.
              const oldMeta = metaEl.textContent;
              metaEl.textContent = 'Group Check';
              textEl.innerHTML = '<span class="beat">Someone just asked the group to confirm.</span>';
              setTimeout(() => { metaEl.textContent = oldMeta; }, 2500);
            }
          });
        }
      } catch(e) {}

      const role = Player.get().role;
      if (role !== 'wanderer') return;
      if (groupCheckUsed) return;

      const btn = document.createElement('button');
      btn.textContent = '⚑ Call a group check';
      btn.style.cssText = `
        position: fixed; bottom: 5%; left: 50%; transform: translateX(-50%);
        background: rgba(10,9,12,0.88); border: 1px solid rgba(232,230,224,0.2);
        color: rgba(232,230,224,0.65); font-family: 'Jost', sans-serif;
        font-size: 0.72rem; letter-spacing: 0.1em; padding: 0.45rem 1rem;
        cursor: pointer; z-index: 20; white-space: nowrap;
      `;

      btn.addEventListener('click', async () => {
        btn.remove();
        groupCheckUsed = true;

        // Notify all players via Firebase
        try {
          if (typeof Session !== 'undefined' && Session.getCode()) {
            await Session.requestGroupCheck(roomId);
          }
        } catch(e) {}

        // Show result to the calling Wanderer
        const oldMeta = metaEl.textContent;
        metaEl.textContent = 'Group Check';
        textEl.innerHTML = '<span class="beat">You asked the group to confirm. The academy noted the question.</span>';
        await new Promise(r => setTimeout(r, 2500));
        metaEl.textContent = oldMeta;
      }, { once: true });

      document.body.appendChild(btn);
      setTimeout(() => { if (btn.parentNode) btn.remove(); }, 15000);
    }

    // ── FORGOTTEN ANONYMOUS SHARE ─────────────────────────────────────
    // After Borrowed Memory fires, Forgotten can anonymously push their
    // fragment into a shared session message visible to all players.
    function offerFragmentShare(fragmentText) {
      const shareBtn = document.createElement('button');
      shareBtn.textContent = 'Share this anonymously?';
      shareBtn.style.cssText = `
        position: fixed; bottom: 12%; left: 50%; transform: translateX(-50%);
        background: rgba(10,9,12,0.9); border: 1px solid rgba(107,91,122,0.3);
        color: rgba(155,133,176,0.7); font-family: 'Jost', sans-serif;
        font-size: 0.72rem; letter-spacing: 0.08em; padding: 0.4rem 0.9rem;
        cursor: pointer; z-index: 25; white-space: nowrap;
      `;

      shareBtn.addEventListener('click', async () => {
        shareBtn.remove();
        try {
          if (typeof Session !== 'undefined' && Session.getCode()) {
            await Session.shareFragment(fragmentText);
          }
        } catch(e) {}
      }, { once: true });

      document.body.appendChild(shareBtn);
      setTimeout(() => { if (shareBtn.parentNode) shareBtn.remove(); }, 8000);
    }

    // Wire shared fragment display for all players
    function listenForSharedFragments(textEl, metaEl) {
      try {
        if (typeof Session === 'undefined' || !Session.getCode()) return;
        let lastTimestamp = 0;
        Session.onSharedFragment(async (data) => {
          if (!data || data.timestamp <= lastTimestamp) return;
          lastTimestamp = data.timestamp;
          // Show as a glitched academy message — source is never revealed
          const oldMeta = metaEl ? metaEl.textContent : '';
          if (metaEl) metaEl.textContent = 'Academy Transmission';
          if (textEl) {
            const span = document.createElement('span');
            textEl.innerHTML = '';
            textEl.appendChild(span);
            GlitchDialogue.render(span, data.text, Player.get().sanity, { persist: false });
          }
          await new Promise(r => setTimeout(r, 3500));
          if (metaEl) metaEl.textContent = oldMeta;
        });
      } catch(e) {}
    }

    // ── BETRAYER POST-VOTE DISPUTE ────────────────────────────────────
    // After Group Decision resolves, Betrayer privately sees the real
    // tally and can dispute the outcome, anonymously shifting trust.
    async function showBetrayerDispute(roomId, resolvedChoice) {
      const role = Player.get().role;
      if (role !== 'betrayer') return;

      // Only show dispute panel in real multiplayer sessions
      if (typeof Session === 'undefined' || !Session.getCode()) return;

      let realCount = 0;
      try {
        realCount = await Session.getVoteCount(roomId);
      } catch(e) {}

      // Only meaningful if others have actually voted
      if (realCount < 1) return;

      const panel = document.createElement('div');
      panel.style.cssText = `
        position: fixed; bottom: 20%; left: 50%; transform: translateX(-50%);
        background: rgba(10,9,12,0.94); border: 1px solid rgba(176,68,68,0.3);
        padding: 0.8rem 1.4rem; font-family: 'Jost', sans-serif;
        font-size: 0.75rem; color: rgba(232,230,224,0.7);
        letter-spacing: 0.05em; z-index: 30; text-align: center;
        display: flex; gap: 1rem; align-items: center;
        white-space: nowrap;
      `;

      const info = document.createElement('span');
      info.textContent = `${realCount} voted. Dispute?`;
      info.style.color = 'rgba(176,68,68,0.8)';

      const disputeBtn = document.createElement('button');
      disputeBtn.textContent = 'Yes';
      disputeBtn.style.cssText = 'background:none; border:1px solid rgba(176,68,68,0.4); color:rgba(176,68,68,0.9); font-family:inherit; font-size:0.72rem; padding:0.25rem 0.6rem; cursor:pointer;';

      const skipBtn = document.createElement('button');
      skipBtn.textContent = 'No';
      skipBtn.style.cssText = 'background:none; border:none; color:rgba(138,135,144,0.5); font-family:inherit; font-size:0.72rem; cursor:pointer;';

      panel.appendChild(info);
      panel.appendChild(disputeBtn);
      panel.appendChild(skipBtn);
      document.body.appendChild(panel);

      disputeBtn.addEventListener('click', async () => {
        panel.remove();
        try {
          if (typeof Session !== 'undefined' && Session.getCode()) {
            await Session.disputeResult(roomId);
            syncTrustShift(-2); // dispute costs trust
          }
        } catch(e) {}
      }, { once: true });

      skipBtn.addEventListener('click', () => panel.remove(), { once: true });
      setTimeout(() => { if (panel.parentNode) panel.remove(); }, 8000);

      // All non-Betrayer players: if dispute fires, show anonymous message
      try {
        if (typeof Session !== 'undefined' && Session.getCode()) {
          Session.onDispute(roomId, () => {
            Horror.consequenceMessage('medium');
          });
        }
      } catch(e) {}
    }

    return {
      showPlantDoubt,
      applyPlantDoubt,
      checkPlantDoubtTrigger,
      showBorrowedMemory,
      showObserverTally,
      showWandererCheck,
      offerFragmentShare,
      listenForSharedFragments,
      showBetrayerDispute,
      /**
       * Wire ALL role abilities into a choice window at once.
       * Call this after showing choices, passing the room id,
       * containers, and buttons. Returns a cleanup function.
       */
      async wireChoiceWindow(roomId, { options, container, buttons, textEl, metaEl }) {
        // Betrayer: Plant Doubt panel (hides choices while active)
        await showPlantDoubt(roomId, options, container);
        // Non-Betrayer: apply any Plant Doubt already written
        await applyPlantDoubt(roomId, buttons);
        // Observer: live tally indicator
        const stopTally = showObserverTally(roomId, container);
        // Wanderer: group check button
        showWandererCheck(roomId, textEl, metaEl);
        // Forgotten: borrowed memory button
        showBorrowedMemory(roomId, textEl, metaEl);
        // Forgotten: listen for shared fragments from other players
        if (textEl && metaEl) listenForSharedFragments(textEl, metaEl);

        // Betrayer: after any button is clicked, offer the dispute panel
        if (buttons && Player.get().role === 'betrayer') {
          buttons.forEach(btn => {
            btn.addEventListener('click', () => {
              setTimeout(() => showBetrayerDispute(roomId, btn.textContent), 1200);
            }, { once: true });
          });
        }

        return stopTally;
      }
    };
  })();

  // ====================================================================
  // HALLWAY
  // (locked design: Entry -> Light Shift -> Movement Choice ->
  //  Sanity Distortion -> Role Interference -> Exit to Library)
  // ====================================================================

  // Per-role Light Shift perception (locked design table)
  const LIGHT_SHIFT_REACTIONS = {
    wanderer: 'The lights flicker — warm, then cold, then dark. Normal, somehow, even though it isn\'t.',
    betrayer: 'The corridor looks stable to you. Steady light. No reason to be afraid.',
    observer: 'Beneath the flicker, words surface: "path mismatch detected."',
    forgotten: 'You see a second hallway, layered over this one. It doesn\'t belong here.'
  };

  // Per-role reaction after the Movement Choice resolves (locked design table)
  const MOVEMENT_ROLE_EFFECTS = {
    wanderer: 'You walk on. It feels like progress, even if you can\'t say why.',
    betrayer: 'A thought arrives, quiet and useful: let them doubt each other.',
    observer: 'Something about this choice is wrong. You can\'t prove it. You feel it.',
    forgotten: 'This hallway. You\'ve walked it before. You\'re sure of it. You\'re not sure of anything.'
  };

  function runHallway() {
    const textEl = document.getElementById('hallway-text');
    const metaEl = document.getElementById('hallway-event-meta');
    const sceneEl = document.getElementById('scene-hallway');
    const tapHint = document.getElementById('hallway-tap-hint');
    const choiceContainer = document.getElementById('hallway-choices');

    AudioManager.Ambient.hallway(); // distant footsteps

    let awaitingClick = false;

    function showLine(text, { meta, holdForClick = true, glitch = false } = {}) {
      return new Promise(resolve => {
        if (meta) metaEl.textContent = meta;

        if (glitch) {
          textEl.innerHTML = '<span class="beat" style="animation:none;opacity:1;"></span>';
          const span = textEl.querySelector('span');
          GlitchDialogue.render(span, text, Player.get().sanity);
        } else {
          textEl.innerHTML = `<span class="beat">${text}</span>`;
        }

        if (!holdForClick) {
          resolve();
          return;
        }
        awaitingClick = true;
        tapHint.style.display = 'block';
        const onAdvance = () => {
          if (!awaitingClick) return;
          awaitingClick = false;
          tapHint.style.display = 'none';
          sceneEl.removeEventListener('click', onAdvance);
          resolve();
        };
        sceneEl.addEventListener('click', onAdvance);
      });
    }

    function wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function sequence() {
      // ---- ENTRY SEQUENCE ----
      await showLine('The hallway is longer than it should be.', { meta: 'Hallway' });

      // ---- EVENT 1: LIGHT SHIFT ----
      const role = (Player.get().role) || 'wanderer';
      await showLine(LIGHT_SHIFT_REACTIONS[role] || LIGHT_SHIFT_REACTIONS.wanderer, { meta: 'Light Shift' });

      // ---- EVENT 2: MOVEMENT CHOICE ----
      await showLine('The hallway splits in three directions, plus the one behind you.', { meta: 'Hallway' });
      await runMovementChoice();
      await showLine(MOVEMENT_ROLE_EFFECTS[role] || MOVEMENT_ROLE_EFFECTS.wanderer, { meta: 'Movement' });

      // ---- EVENT 3: SANITY DISTORTION ----
      await wait(400);
      const sanity = Player.get().sanity;
      let distortionLine;
      if (sanity >= 60) {
        distortionLine = 'Something whispers, just under hearing. You can\'t make out the words.';
      } else if (sanity >= 30) {
        distortionLine = 'Footsteps fall in behind you. When you stop, they stop one beat too late.';
      } else {
        distortionLine = 'You are walking forward… but the door never gets closer.';
      }
      await showLine(distortionLine, { meta: 'Distortion' });

      // ---- EVENT 4: ROLE INTERFERENCE ----
      if (role === 'betrayer') {
        await showLine('"Let them doubt each other."', { meta: 'Interference', glitch: true });
        syncTrustShift(-4);
      } else if (role === 'observer') {
        await showLine('"This corridor has been walked before."', { meta: 'Interference', glitch: true });
        applySanityDelta(-3);
      } else if (role === 'forgotten') {
        await showLine('A voice says your name. It gets it wrong.', { meta: 'Interference' });
      } else {
        await NPC.speak('Someone falls out of step beside you, then catches up. You\'re not sure who.', { holdMs: 3000 });
      }

      // ---- SEPARATION EVENT (key hallway mechanic) ----
      // Butterflies behave erratically when trust is low — visual cue
      const trust = Trust.get();
      const butterflyOpts = Horror.erraticButterflyOptions(trust);
      if (Object.keys(butterflyOpts).length > 0) {
        Butterfly.spawn(sceneEl, butterflyOpts);
      }
      await wait(400);
      await showLine('For a moment, this doesn\'t look like the same hallway anymore.', { meta: 'Separation' });
      await showLine('But you\'re still in the same space. You\'re sure of that. Mostly.', { meta: 'Separation' });

      // ---- ATMOSPHERIC: WALL WRITING ----
      await showLine('Scratched into the wall at eye level, in handwriting that looks like yours:', { meta: 'Hallway' });
      await showLine('"You have passed this point before. You will pass it again."', { meta: 'Hallway' });

      // ---- RIDDLE: GIRL IN THE CORRIDOR ----
      await runCorridorRiddle();

      // ---- EXIT ----
      await showLine('"The library remembers you."', { meta: 'Hallway', holdForClick: false, glitch: true });
      await wait(2200);

      sceneEl.classList.add('scene-fading-out');
      await wait(1300);

      sceneEl.classList.remove('scene-fading-out');
      AudioManager.Ambient.stop();
      goToScene('scene-library');
      AudioManager.play('library');
      runLibrary();
    }

    function runCorridorRiddle() {
      return new Promise(resolve => {
        metaEl.textContent = 'Corridor';
        textEl.innerHTML = '<span class="beat">The Girl in the Corridor appears at the end of the hall.</span>';

        setTimeout(async () => {
          await NPC.speak('"Which door did you come from?"', { holdMs: 3000 });
          textEl.innerHTML = '<span class="beat">"Which door did you come from?"</span>';

          const options = [
            { text: 'The classroom', trustDelta: 2, sanityDelta: 0, flavor: 'She nods once, then turns. The hallway feels a little shorter.' },
            { text: 'I\'m not sure', trustDelta: 0, sanityDelta: -3, flavor: 'The honest answer. It costs something to admit it here.' },
            { text: 'The same door as you', trustDelta: 0, sanityDelta: -2, glitch: true, flavor: 'She vanishes faster than she should. You\'re not sure what you said wrong.' },
            { text: 'There was no door', trustDelta: -4, sanityDelta: 0, flavor: 'The group shifts. Something about that answer unsettles everyone.' }
          ];

          choiceContainer.style.display = 'none'; // hidden until Plant Doubt resolves
          choiceContainer.innerHTML = '';

          const buttons = [];
          options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = opt.text;
            btn.style.pointerEvents = 'none';
            choiceContainer.appendChild(btn);
            buttons.push(btn);
          });

          // Wire ALL role abilities into this choice window, including Plant Doubt
          await RoleAbilities.wireChoiceWindow('corridor_riddle', { options, container: choiceContainer, buttons, textEl, metaEl });

          choiceContainer.style.display = 'flex';
          buttons.forEach((btn, i) => {
            btn.style.pointerEvents = 'auto';
            const opt = options[i];
            btn.addEventListener('click', async () => {
              choiceContainer.style.display = 'none';
              RoleAbilities.checkPlantDoubtTrigger(btn);
              if (opt.sanityDelta) applySanityDelta(opt.sanityDelta);
              if (opt.trustDelta) syncTrustShift(opt.trustDelta);
              await applyHorrorEffects(opt, ms => new Promise(r => setTimeout(r, ms)));
              if (opt.glitch) {
                const span = document.createElement('span');
                textEl.innerHTML = '';
                textEl.appendChild(span);
                GlitchDialogue.render(span, opt.flavor, Player.get().sanity);
                await new Promise(r => setTimeout(r, 2200));
              } else {
                await showLine(opt.flavor, { meta: 'Corridor' });
              }
              resolve();
            }, { once: true });
          });
        }, 1800);
      });
    }

    function runMovementChoice() {
      return new Promise(resolve => {
        metaEl.textContent = 'Movement';
        textEl.innerHTML = '<span class="beat">The hallway splits in three directions, plus the one behind you.</span>';

        setTimeout(async () => {
          textEl.innerHTML = '<span class="beat">Which direction feels correct?</span>';

          const options = [
            { text: 'Left corridor', flavor: 'You go left. The hallway accepts it without comment.' },
            { text: 'Right corridor', flavor: 'You go right. Nothing about it feels more or less correct than left would have.' },
            { text: 'Forward', flavor: 'You go straight on. It\'s the only choice that doesn\'t feel like a choice.' },
            { text: 'Stay still', flavor: 'You wait. Eventually the hallway moves instead — or you do, and don\'t notice.' }
          ];

          choiceContainer.style.display = 'none'; // hidden until Plant Doubt resolves
          choiceContainer.innerHTML = '';

          const buttons = [];
          options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = opt.text;
            btn.style.pointerEvents = 'none'; // not interactive yet
            buttons.push(btn);
            choiceContainer.appendChild(btn);
          });

          // Wire ALL role abilities into this choice window
          await RoleAbilities.wireChoiceWindow('hallway', { options, container: choiceContainer, buttons, textEl, metaEl });

          // NOW show the (potentially poisoned) buttons and make them interactive
          choiceContainer.style.display = 'flex';
          buttons.forEach(btn => { btn.style.pointerEvents = 'auto'; });

          buttons.forEach((btn, i) => {
            btn.addEventListener('click', async () => {
              RoleAbilities.checkPlantDoubtTrigger(btn);
              choiceContainer.style.display = 'none';
              if (options[i].text === 'Stay still') {
                applySanityDelta(2);
              }
              await showLine(options[i].flavor, { meta: 'Movement' });
              resolve();
            }, { once: true });
          });
        }, 1800);
      });
    }

    sequence();
  }

  // ====================================================================
  // LIBRARY
  // (locked design: Entry -> Librarian presence -> Fragment Discovery ->
  //  Role-Split Information -> Observer truth-cost -> Exit to Clock Tower)
  // ====================================================================

  // Per-role fragment reading (locked design pattern: each role perceives
  // the same physical book differently — mirrors Hallway's Light Shift).
  const FRAGMENT_REACTIONS = {
    wanderer: 'The page reads like any other page. You\'re not sure why your hands are shaking.',
    betrayer: 'You read it once. You already knew what it would say.',
    observer: 'The words rearrange themselves once, just for you, before settling.',
    forgotten: 'You\'ve read this exact page before. You\'re sure of it. You can\'t say when.'
  };

  function runLibrary() {
    const textEl = document.getElementById('library-text');
    const metaEl = document.getElementById('library-event-meta');
    const sceneEl = document.getElementById('scene-library');
    const tapHint = document.getElementById('library-tap-hint');
    const choiceContainer = document.getElementById('library-choices');

    AudioManager.Ambient.library(); // page turning sounds

    let awaitingClick = false;

    function showLine(text, { meta, holdForClick = true, glitch = false } = {}) {
      return new Promise(resolve => {
        if (meta) metaEl.textContent = meta;

        if (glitch) {
          textEl.innerHTML = '<span class="beat" style="animation:none;opacity:1;"></span>';
          const span = textEl.querySelector('span');
          GlitchDialogue.render(span, text, Player.get().sanity);
        } else {
          textEl.innerHTML = `<span class="beat">${text}</span>`;
        }

        if (!holdForClick) {
          resolve();
          return;
        }
        awaitingClick = true;
        tapHint.style.display = 'block';
        const onAdvance = () => {
          if (!awaitingClick) return;
          awaitingClick = false;
          tapHint.style.display = 'none';
          sceneEl.removeEventListener('click', onAdvance);
          resolve();
        };
        sceneEl.addEventListener('click', onAdvance);
      });
    }

    function wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function sequence() {
      // ---- ENTRY ----
      await showLine('Rows of shelves, taller than the room should allow.', { meta: 'Library' });

      // ---- THE LIBRARIAN (named NPC, present but never acknowledges players) ----
      await NPC.speak('A woman moves between the shelves. She does not look at you. Pages turn whether she touches them or not.', { holdMs: 3600 });

      // ---- FRAGMENT DISCOVERY ----
      await showLine('A book is already open on the table. It wasn\'t, a moment ago.', { meta: 'Fragment' });

      const role = (Player.get().role) || 'wanderer';
      await showLine(FRAGMENT_REACTIONS[role] || FRAGMENT_REACTIONS.wanderer, { meta: 'Fragment' });

      // ---- ROLE-SPLIT INFORMATION EVENT ----
      // Solo-test note: full design has players compare what they each read
      // and find contradictions. True cross-player comparison needs the
      // Session Lobby / multiplayer sync. Here, the contradiction is staged
      // narratively — the page itself disagrees with what was just shown.
      await wait(500);
      await showLine('You read the passage again, to be sure.', { meta: 'Fragment' });
      await showLine('It says something different the second time.', { meta: 'Fragment', glitch: true });

      // ---- OBSERVER TRUTH-COST (locked design: Observer can look closer, costs sanity) ----
      if (role === 'observer') {
        await runObserverChoice();
      } else {
        await showLine('Whatever changed, you can\'t prove it. The page looks ordinary now.', { meta: 'Fragment' });
      }

      // ---- QUIET QUESTION: WHAT DO YOU TAKE FROM THIS ----
      await runFragmentChoice();

      // ---- ATMOSPHERIC: FALLEN BOOK ----
      await showLine('A book falls open somewhere behind you. You didn\'t touch it.', { meta: 'Library' });
      await showLine('"All records of your arrival have been filed under: expected."', { meta: 'Library' });

      // ---- RIDDLE: THE LIBRARIAN ----
      // Compound riddle warning — fires if player has picked deeply wrong
      // answers in previous rooms, making their pattern feel "recorded"
      const compoundWarning = Horror.getCompoundWarning();
      if (compoundWarning) {
        await showLine(compoundWarning, { meta: 'Library', glitch: false });
      }

      await runLibrarianRiddle();

      // ---- EXIT ----
      await showLine('The Librarian closes the book without looking at it. Without looking at you.', { meta: 'Library', holdForClick: false });
      await wait(2000);

      sceneEl.classList.add('scene-fading-out');
      await wait(1300);

      sceneEl.classList.remove('scene-fading-out');
      AudioManager.Ambient.stop();
      goToScene('scene-convergence');
      AudioManager.play('library');
      runConvergence();
    }

    function runLibrarianRiddle() {
      return new Promise(resolve => {
        metaEl.textContent = 'The Librarian';
        textEl.innerHTML = '<span class="beat">The Librarian slides a card across the desk without looking up.</span>';

        setTimeout(async () => {
          await NPC.speak('"Find the book that was already returned."', { holdMs: 3000 });
          textEl.innerHTML = '<span class="beat">"Find the book that was already returned."</span>';

          const options = [
            { text: 'The one with no title', trustDelta: 2, sanityDelta: 0, observerFragment: true, flavor: 'You hold it up. She doesn\'t look. But she stops moving.' },
            { text: 'The one that\'s still warm', trustDelta: 0, sanityDelta: -3, flavor: 'Wrong. You knew it was wrong before you reached for it. You reached anyway.' },
            { text: 'None of these were returned', trustDelta: -2, sanityDelta: 0, betrayerWindow: true, flavor: 'The doubt spreads. It was meant to.' },
            { text: 'The one that has your name in it', trustDelta: 0, sanityDelta: -5, glitch: true, flavor: 'Your name. In your handwriting. Dated before you arrived.' }
          ];

          choiceContainer.style.display = 'none'; // hidden until Plant Doubt resolves
          choiceContainer.innerHTML = '';

          const buttons = [];
          options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = opt.text;
            btn.style.pointerEvents = 'none';
            choiceContainer.appendChild(btn);
            buttons.push(btn);
          });

          // Wire ALL role abilities into this choice window, including Plant Doubt
          await RoleAbilities.wireChoiceWindow('library_riddle', { options, container: choiceContainer, buttons, textEl, metaEl });

          choiceContainer.style.display = 'flex';
          buttons.forEach((btn, i) => {
            btn.style.pointerEvents = 'auto';
            const opt = options[i];
            btn.addEventListener('click', async () => {
              choiceContainer.style.display = 'none';
              RoleAbilities.checkPlantDoubtTrigger(btn);
              if (opt.sanityDelta) applySanityDelta(opt.sanityDelta);
              if (opt.trustDelta) syncTrustShift(opt.trustDelta);
              if (opt.observerFragment && (Player.get().role) === 'observer') {
                Player.update({ observerLibraryFragment: true });
              }
              if (opt.betrayerWindow && (Player.get().role) === 'betrayer') {
                syncTrustShift(-2);
              }
              await applyHorrorEffects(opt, ms => new Promise(r => setTimeout(r, ms)));
              if (opt.glitch) {
                const span = document.createElement('span');
                textEl.innerHTML = '';
                textEl.appendChild(span);
                GlitchDialogue.render(span, opt.flavor, Player.get().sanity);
                await new Promise(r => setTimeout(r, 2200));
              } else {
                await showLine(opt.flavor, { meta: 'The Librarian' });
              }
              resolve();
            }, { once: true });
          });
        }, 1800);
      });
    }

    function runObserverChoice() {
      return new Promise(resolve => {
        metaEl.textContent = 'Observer';
        textEl.innerHTML = '<span class="beat">You could look closer. It would cost you something to see clearly.</span>';

        const options = [
          {
            text: 'Look closer',
            apply: async () => {
              applySanityDelta(-5);
              await showLine('The true page surfaces for a moment: a name, almost yours, crossed out and rewritten.', { meta: 'Observer', glitch: true });
            }
          },
          {
            text: 'Look away',
            apply: async () => {
              await showLine('You let the page stay ordinary. Some things are better left unread.', { meta: 'Observer' });
            }
          }
        ];

        choiceContainer.style.display = 'flex';
        choiceContainer.innerHTML = '';

        options.forEach(opt => {
          const btn = document.createElement('button');
          btn.className = 'choice-btn';
          btn.textContent = opt.text;
          btn.addEventListener('click', async () => {
            choiceContainer.style.display = 'none';
            await opt.apply();
            resolve();
          }, { once: true });
          choiceContainer.appendChild(btn);
        });
      });
    }

    function runFragmentChoice() {
      return new Promise(resolve => {
        metaEl.textContent = 'Fragment';
        textEl.innerHTML = '<span class="beat">The others are waiting to hear what the book said.</span>';

        setTimeout(async () => {
          textEl.innerHTML = '<span class="beat">Do you tell them what you read?</span>';

          const options = [
            { text: 'Tell them exactly what you read', trustDelta: 2, flavor: 'You say it plainly. No one challenges you. That, somehow, is worse.' },
            { text: 'Tell a softened version', trustDelta: 0, flavor: 'You leave out the part that frightened you. It still shows on your face.' },
            { text: 'Say you found nothing', trustDelta: -3, flavor: 'You lie. The book is still open on the table behind you.' }
          ];

          choiceContainer.style.display = 'none';
          choiceContainer.innerHTML = '';

          const buttons = [];
          options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = opt.text;
            btn.style.pointerEvents = 'none';
            buttons.push(btn);
            choiceContainer.appendChild(btn);
          });

          await RoleAbilities.wireChoiceWindow('library', { options, container: choiceContainer, buttons, textEl, metaEl });

          choiceContainer.style.display = 'flex';
          buttons.forEach((btn, i) => {
            btn.style.pointerEvents = 'auto';
            btn.addEventListener('click', async () => {
              RoleAbilities.checkPlantDoubtTrigger(btn);
              choiceContainer.style.display = 'none';
              syncTrustShift(options[i].trustDelta);
              if (options[i].trustDelta < 0) Horror.consequenceMessage('medium');
              await showLine(options[i].flavor, { meta: 'Fragment' });
              resolve();
            }, { once: true });
          });
        }, 1800);
      });
    }

    sequence();
  }

  // ====================================================================
  // THE CONVERGENCE
  // New shared-question scene: all 5 players answer the same question
  // privately, then see how the group split (counts only, never who chose
  // what — preserves role/identity secrecy). Majority alignment here is
  // now a real requirement for the True Escape Ending, not just a sanity
  // threshold check.
  // ====================================================================
  function runConvergence() {
    const textEl = document.getElementById('convergence-text');
    const metaEl = document.getElementById('convergence-event-meta');
    const sceneEl = document.getElementById('scene-convergence');
    const tapHint = document.getElementById('convergence-tap-hint');
    const choiceContainer = document.getElementById('convergence-choices');

    let awaitingClick = false;

    function showLine(text, { meta, holdForClick = true } = {}) {
      return new Promise(resolve => {
        if (meta) metaEl.textContent = meta;
        textEl.innerHTML = `<span class="beat">${text}</span>`;
        if (!holdForClick) { resolve(); return; }
        awaitingClick = true;
        tapHint.style.display = 'block';
        const onAdvance = () => {
          if (!awaitingClick) return;
          awaitingClick = false;
          tapHint.style.display = 'none';
          sceneEl.removeEventListener('click', onAdvance);
          resolve();
        };
        sceneEl.addEventListener('click', onAdvance);
      });
    }

    function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

    async function sequence() {
      await showLine('The academy gathers all five of you in the same breath, for the first time.', { meta: 'Convergence' });
      await showLine('A single question, asked of everyone at once.', { meta: 'Convergence' });

      const answer = await runSharedQuestion();

      let group;
      if (typeof Session !== 'undefined' && Session.getCode()) {
        // Real multiplayer session — write our answer and wait for the
        // rest of the group (or a timeout, in case someone stalls/drops).
        await Session.submitAnswer('convergence', answer);
        const playerCount = await Session.getPlayerCount();
        group = await Session.waitForAnswers('convergence', playerCount || 5, 8000);
        if (!group || group.length === 0) group = [answer];
      } else {
        // Solo-test fallback: simulate the other 4 answers so the
        // majority/split mechanic can still be demonstrated alone.
        group = [answer];
        for (let i = 0; i < 4; i++) {
          const pool = ['leave', 'stay', 'unsure'];
          group.push(pool[Math.floor(Math.random() * pool.length)]);
        }
      }

      const counts = group.reduce((acc, a) => { acc[a] = (acc[a] || 0) + 1; return acc; }, {});
      const majorityCount = Math.max(...Object.values(counts));
      const majorityReached = majorityCount > group.length / 2;

      Player.update({ convergenceMajorityReached: majorityReached });
      syncTrustShift(majorityReached ? 5 : -3);

      await showLine(`${majorityCount} of you answered the same way.`, { meta: 'Convergence' });
      await showLine(
        majorityReached
          ? 'For once, the academy has nothing to distort. You agreed.'
          : 'No answer rises above the others. The academy notes this carefully.',
        { meta: 'Convergence', holdForClick: false }
      );
      await wait(2200);

      sceneEl.classList.add('scene-fading-out');
      await wait(1300);

      sceneEl.classList.remove('scene-fading-out');
      goToScene('scene-clocktower');
      AudioManager.play('clockTower');
      runClockTower();
    }

    function runSharedQuestion() {
      return new Promise(async (resolve) => {
        metaEl.textContent = 'The Question';
        textEl.innerHTML = '<span class="beat">"If the gate opened right now — would you walk through it?"</span>';

        const options = [
          { value: 'leave', text: 'Yes. Whatever is on the other side.', flavor: 'You answer before you can think better of it.' },
          { value: 'stay', text: 'No. Not yet.', flavor: 'You hold the answer back, even from yourself.' },
          { value: 'unsure', text: 'I don\'t know what I\'d be leaving.', flavor: 'The honest answer. The academy seems to prefer it.' }
        ];

        choiceContainer.style.display = 'none';
        choiceContainer.innerHTML = '';

        const buttons = [];
        options.forEach(opt => {
          const btn = document.createElement('button');
          btn.className = 'choice-btn';
          btn.textContent = opt.text;
          btn.style.pointerEvents = 'none';
          choiceContainer.appendChild(btn);
          buttons.push(btn);
        });

        // Wire ALL role abilities into this choice window
        await RoleAbilities.wireChoiceWindow('convergence', { options, container: choiceContainer, buttons, textEl, metaEl });

        choiceContainer.style.display = 'flex';
        buttons.forEach((btn, i) => {
          btn.style.pointerEvents = 'auto';
          const opt = options[i];
          btn.addEventListener('click', async () => {
            choiceContainer.style.display = 'none';
            RoleAbilities.checkPlantDoubtTrigger(btn);
            await showLine(opt.flavor, { meta: 'The Question' });
            resolve(opt.value);
          }, { once: true });
        });
      });
    }

    sequence();
  }

  // ====================================================================
  // CLOCK TOWER
  // (locked design: Entry -> Time Skip Sequence -> The Boy Who Remembers
  //  -> Role Pressure -> Final Alignment Event -> Exit to Final Gate)
  // ====================================================================

  const TIME_SKIP_REACTIONS = {
    wanderer: 'The clock hands jump forward, then back. You decide not to look at it again.',
    betrayer: 'The clock is wrong. You knew it would be, somehow, before you saw it.',
    observer: 'For one frame, the clock shows a time that hasn\'t happened yet.',
    forgotten: 'You\'ve stood under this clock before. Today, yesterday, neither — you can\'t place it.'
  };

  function runClockTower() {
    const textEl = document.getElementById('clocktower-text');
    const metaEl = document.getElementById('clocktower-event-meta');
    const sceneEl = document.getElementById('scene-clocktower');
    const tapHint = document.getElementById('clocktower-tap-hint');
    const choiceContainer = document.getElementById('clocktower-choices');

    let awaitingClick = false;

    function showLine(text, { meta, holdForClick = true, glitch = false } = {}) {
      return new Promise(resolve => {
        if (meta) metaEl.textContent = meta;

        if (glitch) {
          textEl.innerHTML = '<span class="beat" style="animation:none;opacity:1;"></span>';
          const span = textEl.querySelector('span');
          GlitchDialogue.render(span, text, Player.get().sanity);
        } else {
          textEl.innerHTML = `<span class="beat">${text}</span>`;
        }

        if (!holdForClick) {
          resolve();
          return;
        }
        awaitingClick = true;
        tapHint.style.display = 'block';
        const onAdvance = () => {
          if (!awaitingClick) return;
          awaitingClick = false;
          tapHint.style.display = 'none';
          sceneEl.removeEventListener('click', onAdvance);
          resolve();
        };
        sceneEl.addEventListener('click', onAdvance);
      });
    }

    function wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function sequence() {
      // ---- ENTRY ----
      await showLine('The tower is taller on the inside than it looked from the hallway.', { meta: 'Clock Tower' });

      // ---- TIME SKIP SEQUENCE (locked Sequence System: clock jumps, frame skipping) ----
      sceneEl.style.transition = 'filter 0.15s steps(2,end)';
      sceneEl.style.filter = 'brightness(1.4) contrast(1.2)';
      await wait(150);
      sceneEl.style.filter = 'brightness(0.7)';
      await wait(150);
      sceneEl.style.filter = 'none';
      sceneEl.style.transition = '';
      await showLine('Time did not pass correctly.', { meta: 'Time Skip', glitch: true });

      const role = (Player.get().role) || 'wanderer';
      await showLine(TIME_SKIP_REACTIONS[role] || TIME_SKIP_REACTIONS.wanderer, { meta: 'Time Skip' });

      // ---- THE BOY WHO REMEMBERS (named NPC) ----
      await NPC.speak('A boy sits on the stairs. "I remember the seventh seat," he says. No one asked him.', { holdMs: 4200 });
      await showLine('No one else seems to have heard him. You\'re not sure you did either.', { meta: 'Clock Tower' });

      // ---- ROLE PRESSURE (escalating internal nudges, per Betrayer win-condition system) ----
      if (role === 'betrayer') {
        await showLine('"They are close to remembering everything. Slow them down."', { meta: 'Pressure', glitch: true });
      } else if (role === 'observer') {
        applySanityDelta(-3);
        await showLine('You see the tower\'s gears running backward. Looking costs you something, every time.', { meta: 'Pressure', glitch: true });
      } else if (role === 'forgotten') {
        await showLine('"I never did," someone says, about something you don\'t remember asking.', { meta: 'Pressure' });
      } else {
        await showLine('You climb. The stairs feel like they\'re counting something.', { meta: 'Pressure' });
      }

      // ---- FINAL ALIGNMENT EVENT ----
      await runFinalAlignment();

      // ---- ATMOSPHERIC: CLOCK FACE ----
      await showLine('The clock face has no numbers.', { meta: 'Clock Tower' });
      await showLine('"Soon. Soon. Soon. Soon. Soon. Soon. Soon. Soon. Soon. Soon. Soon. Soon."', { meta: 'Clock Tower', glitch: true });

      // ---- RIDDLE: THE BOY WHO REMEMBERS ----
      await runBoyRiddle();

      // ---- EXIT ----
      await showLine('The tower goes quiet. Somewhere below, a door is already open.', { meta: 'Clock Tower', holdForClick: false });
      await wait(2000);

      sceneEl.classList.add('scene-fading-out');
      await wait(1500);

      sceneEl.classList.remove('scene-fading-out');
      goToScene('scene-finalgate');
      AudioManager.play('finalGate');
      runFinalGate();
    }

    function runFinalAlignment() {
      return new Promise(resolve => {
        metaEl.textContent = 'Final Alignment';
        textEl.innerHTML = '<span class="beat">The tower has gone quiet, waiting on something none of you said out loud.</span>';

        setTimeout(async () => {
          textEl.innerHTML = '<span class="beat">Choose what you believe is real.</span>';

          const options = [
            { text: 'The academy is real, and we are trapped here', sanityDelta: 2, flavor: 'Saying it steadies you, a little. At least it\'s a shape you can hold.' },
            { text: 'None of this is real, and we will wake up', sanityDelta: -2, flavor: 'It feels true for a moment. Then the tower reminds you it isn\'t.' },
            { text: 'I don\'t know, and I\'m done pretending I do', sanityDelta: 1, flavor: 'No one disagrees with you. That might be the most honest thing said all day.' }
          ];

          choiceContainer.style.display = 'none';
          choiceContainer.innerHTML = '';

          const buttons = [];
          options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = opt.text;
            btn.style.pointerEvents = 'none';
            choiceContainer.appendChild(btn);
            buttons.push(btn);
          });

          // Wire ALL role abilities into this choice window
          await RoleAbilities.wireChoiceWindow('clocktower', { options, container: choiceContainer, buttons, textEl, metaEl });

          choiceContainer.style.display = 'flex';
          buttons.forEach((btn, i) => {
            btn.style.pointerEvents = 'auto';
            const opt = options[i];
            btn.addEventListener('click', async () => {
              choiceContainer.style.display = 'none';
              RoleAbilities.checkPlantDoubtTrigger(btn);
              applySanityDelta(opt.sanityDelta);
              Player.update({ alignmentChoice: opt.text });
              if (opt.sanityDelta < 0) Horror.consequenceMessage('light');
              await showLine(opt.flavor, { meta: 'Final Alignment' });
              resolve();
            }, { once: true });
          });
        }, 1800);
      });
    }

    function runBoyRiddle() {
      return new Promise(resolve => {
        metaEl.textContent = 'The Boy Who Remembers';
        textEl.innerHTML = '<span class="beat">He blocks the stairs without moving. Just standing there, waiting to be asked.</span>';

        setTimeout(async () => {
          textEl.innerHTML = '<span class="beat">"Tell me what time it was when you arrived."</span>';

          const options = [
            { text: 'I don\'t know what time it was', trustDelta: 1, sanityDelta: -2, flavor: 'He nods slowly. "That\'s what the others said too."' },
            { text: 'The same time it is now', trustDelta: 0, sanityDelta: -4, glitch: true, flavor: 'He tilts his head. "Then you never arrived. You\'ve always been here."' },
            { text: 'Before any of this started', trustDelta: 3, sanityDelta: 0, flavor: 'He steps aside without a word. The group likes this answer, somehow.' },
            { text: 'You already know', trustDelta: -2, sanityDelta: 0, flavor: 'He smiles. That\'s the wrong move. You feel it immediately.' }
          ];

          choiceContainer.style.display = 'none'; // hidden until Plant Doubt resolves
          choiceContainer.innerHTML = '';

          const buttons = [];
          options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = opt.text;
            btn.style.pointerEvents = 'none';
            choiceContainer.appendChild(btn);
            buttons.push(btn);
          });

          // Wire ALL role abilities into this choice window, including Plant Doubt
          await RoleAbilities.wireChoiceWindow('boy_riddle', { options, container: choiceContainer, buttons, textEl, metaEl });

          choiceContainer.style.display = 'flex';
          buttons.forEach((btn, i) => {
            btn.style.pointerEvents = 'auto';
            const opt = options[i];
            btn.addEventListener('click', async () => {
              choiceContainer.style.display = 'none';
              RoleAbilities.checkPlantDoubtTrigger(btn);
              if (opt.sanityDelta) applySanityDelta(opt.sanityDelta);
              if (opt.trustDelta) syncTrustShift(opt.trustDelta);
              await applyHorrorEffects(opt, ms => new Promise(r => setTimeout(r, ms)));
              if (opt.glitch) {
                const span = document.createElement('span');
                textEl.innerHTML = '';
                textEl.appendChild(span);
                GlitchDialogue.render(span, opt.flavor, Player.get().sanity);
                await new Promise(r => setTimeout(r, 2200));
              } else {
                await showLine(opt.flavor, { meta: 'The Boy Who Remembers' });
              }
              resolve();
            }, { once: true });
          });
        }, 1800);
      });
    }

    sequence();
  }

  // (locked design: Sanity Final Check -> Role Resolution -> Betrayal
  //  Reveal Check -> Observer Decision -> Ending Calculation -> Ending)
  // ====================================================================

  const ROLE_VAGUE_LABELS = {
    wanderer: 'ESCAPE ATTEMPTERS',
    betrayer: 'INFLUENCE VECTOR',
    observer: 'OUTSIDE VIEWPOINT',
    forgotten: 'RETURNED MEMORY'
  };

  const ROLE_REAL_LABELS = {
    wanderer: 'Wanderer',
    betrayer: 'Betrayer',
    observer: 'Observer',
    forgotten: 'Forgotten'
  };

  function sanityTier(sanity) {
    if (sanity >= 60) return 'stable';
    if (sanity >= 30) return 'distorted';
    return 'lost';
  }

  function runFinalGate() {
    const textEl = document.getElementById('finalgate-text');
    const metaEl = document.getElementById('finalgate-event-meta');
    const sceneEl = document.getElementById('scene-finalgate');
    const tapHint = document.getElementById('finalgate-tap-hint');
    const choiceContainer = document.getElementById('finalgate-choices');

    let awaitingClick = false;

    function showLine(text, { meta, holdForClick = true, glitch = false } = {}) {
      return new Promise(resolve => {
        if (meta) metaEl.textContent = meta;

        if (glitch) {
          textEl.innerHTML = '<span class="beat" style="animation:none;opacity:1;"></span>';
          const span = textEl.querySelector('span');
          GlitchDialogue.render(span, text, Player.get().sanity);
        } else {
          textEl.innerHTML = `<span class="beat">${text}</span>`;
        }

        if (!holdForClick) {
          resolve();
          return;
        }
        awaitingClick = true;
        tapHint.style.display = 'block';
        const onAdvance = () => {
          if (!awaitingClick) return;
          awaitingClick = false;
          tapHint.style.display = 'none';
          sceneEl.removeEventListener('click', onAdvance);
          resolve();
        };
        sceneEl.addEventListener('click', onAdvance);
      });
    }

    function wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function sequence() {
      // ---- ENTRY SEQUENCE ----
      await showLine('This is where everything remembers you.', { meta: 'Final Gate' });

      // ---- EVENT 1: FINAL SANITY CHECK (locked — no further changes after this) ----
      const finalSanity = Player.get().sanity;
      Player.update({ sanityLocked: true });
      const tier = sanityTier(finalSanity);
      await showLine('Your sanity settles into something fixed. It will not change again.', { meta: 'Sanity Check' });

      // ---- EVENT 2: ROLE RESOLUTION (vague label only, per locked rule) ----
      const role = (Player.get().role) || 'wanderer';
      const vagueLabel = ROLE_VAGUE_LABELS[role];
      await showLine(`"${vagueLabel}"`, { meta: 'Role Resolution', glitch: true });

      // ---- EVENT 3: BETRAYAL REVEAL CONDITION CHECK ----
      // Solo-test note: real check needs group-wide trust + Observer
      // contradiction-detection across 5 players. Approximated here from
      // local Trust value, since that's the only signal available pre-multiplayer.
      const trust = Trust.get();
      const groupTrustCollapse = trust <= 20;
      let betrayalRevealed = false;

      if (role === 'betrayer') {
        if (groupTrustCollapse) {
          betrayalRevealed = true;
          await showLine('"So it was you… or maybe it always was."', { meta: 'Betrayal', glitch: true });
        }
        // If not revealed, per locked design: stays unknown, no line shown —
        // the absence of a reveal IS the design, not an oversight.
      }

      // ---- ATMOSPHERIC: CARVED TEXT ABOVE THE GATE ----
      await showLine('Above the gate, letters carve themselves into the stone:', { meta: 'Final Gate' });
      await showLine('"Only those who remember may leave."', { meta: 'Final Gate', glitch: true });
      await showLine('Below it, in smaller letters:', { meta: 'Final Gate' });
      await showLine('"Only those who forget may stay."', { meta: 'Final Gate' });

      // ---- EVENT 4a: GATE RIDDLE (consequential — affects ending weight) ----
      await runGateRiddle();

      // ---- EVENT 4: OBSERVER DECISION PHASE ----
      // Observer's choice is written to Firebase so ALL players calculate
      // the same ending — this is the core of "everyone gets the same ending."
      let observerChoice = null;
      const hasSession = typeof Session !== 'undefined' && Session.getCode();
      if (role === 'observer') {
        observerChoice = await runObserverDecision();
        // Write choice via the Session API so every other player reads it
        if (hasSession) {
          try {
            await Session.submitObserverChoice(observerChoice);
          } catch (e) {
            console.warn('Could not write Observer choice to Firebase:', e);
          }
        }
      } else {
        // Non-Observer players wait for the Observer's ACTUAL decision to
        // arrive, rather than reading once after a fixed 2s delay — a slow
        // Observer (still reading flavor text, thinking it over) used to
        // mean everyone else locked in `null` and calculated a different
        // ending than the Observer did. A generous timeout is kept only
        // as a safety net in case the Observer disconnects mid-decision.
        await showLine('The Observer stands at the gate alone.', { meta: 'Final Gate' });
        await showLine('Whatever they choose, it ends this for everyone.', { meta: 'Final Gate', holdForClick: false });
        if (hasSession) {
          try {
            observerChoice = await Session.waitForObserverChoice(15000);
          } catch (e) {
            console.warn('Could not read Observer choice from Firebase:', e);
          }
        } else {
          await wait(2000);
        }
      }

      // ---- EVENT 5 (SECRET): BUTTERFLY CONDITION CHECK ----
      // Original condition: high sanity + high trust
      // New: also triggered if player answered "Nothing" at the Gate riddle
      // (earning a butterflyPoints flag), as the gate answer is the final
      // piece of the secret truth-completion condition.
      const butterflyPoints = Player.get().butterflyPoints || 0;
      const butterflyConditionMet = (tier === 'stable' && trust >= 70) || (butterflyPoints >= 1 && tier === 'stable' && trust >= 55);

      // ---- ENDING CALCULATION ENGINE ----
      const endingKey = calculateEnding({ tier, trust, role, observerChoice, butterflyConditionMet, groupTrustCollapse });

      Player.update({ finalEndingKey: endingKey, finalRoleRevealed: role });

      await showLine('The academy has decided what it remembers.', { meta: 'Final Gate', holdForClick: false });
      await wait(2200);

      sceneEl.classList.add('scene-fading-out');
      await wait(1700);

      sceneEl.classList.remove('scene-fading-out');
      runEnding(endingKey);
    }

    function runGateRiddle() {
      return new Promise(resolve => {
        metaEl.textContent = 'The Gate';
        textEl.innerHTML = '<span class="beat" style="animation:none;opacity:1;"></span>';
        const span = textEl.querySelector('span');
        GlitchDialogue.render(span, '"What did the academy take from you?"', Player.get().sanity);

        setTimeout(async () => {
          const options = [
            {
              text: 'My name',
              flavor: 'You say it plainly. The gate seems to recognize the answer.',
              effect: () => Player.update({ gateAnswer: 'name', forgottenWeight: (Player.get().forgottenWeight || 0) + 1 })
            },
            {
              text: 'My trust in others',
              flavor: 'The words settle heavier than you expected.',
              effect: () => Player.update({ gateAnswer: 'trust', betrayalWeight: (Player.get().betrayalWeight || 0) + 1 })
            },
            {
              text: 'My certainty',
              flavor: 'Something shifts. The academy writes it down somewhere you can\'t see.',
              effect: () => Player.update({ gateAnswer: 'certainty', observerWeight: (Player.get().observerWeight || 0) + 1 })
            },
            {
              text: 'Nothing. I came with nothing.',
              flavor: 'A pause. Then the butterfly appears, briefly, at the edge of the gate.',
              effect: () => {
                const current = Player.get().butterflyPoints || 0;
                Player.update({ gateAnswer: 'nothing', butterflyPoints: current + 1 });
                Butterfly.spawn(document.getElementById('scene-finalgate'), { count: 1, duration: [3000, 4000] });
              }
            }
          ];

          choiceContainer.style.display = 'none'; // hidden until Plant Doubt resolves
          choiceContainer.innerHTML = '';

          const buttons = [];
          options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = opt.text;
            btn.style.pointerEvents = 'none';
            choiceContainer.appendChild(btn);
            buttons.push(btn);
          });

          // Wire ALL role abilities into this choice window, including Plant Doubt
          await RoleAbilities.wireChoiceWindow('gate_riddle', { options, container: choiceContainer, buttons, textEl, metaEl });

          choiceContainer.style.display = 'flex';
          buttons.forEach((btn, i) => {
            btn.style.pointerEvents = 'auto';
            const opt = options[i];
            btn.addEventListener('click', async () => {
              choiceContainer.style.display = 'none';
              RoleAbilities.checkPlantDoubtTrigger(btn);
              opt.effect();
              // Gate riddle has no wrong answer but each choice carries weight —
              // a brief bleed + consequence message makes each feel significant
              Horror.screenBleed(0.25);
              Horror.consequenceMessage('light');
              await showLine(opt.flavor, { meta: 'The Gate' });
              resolve();
            }, { once: true });
          });
        }, 2200);
      });
    }

    function runObserverDecision() {
      return new Promise(resolve => {
        metaEl.textContent = 'Observer Decision';
        textEl.innerHTML = '<span class="beat">The others are waiting on you. Whatever you choose, it ends this.</span>';

        setTimeout(() => {
          textEl.innerHTML = '<span class="beat">You are the anchor point. Choose.</span>';

          const options = ['Escape', 'Stay', 'Sacrifice'];
          choiceContainer.style.display = 'flex';
          choiceContainer.innerHTML = '';

          const descriptions = {
            'Escape': 'Everyone who still can, leaves — you included.',
            'Stay': 'You remain behind, as the one who remembers this place correctly.',
            'Sacrifice': 'The others leave because you don\'t.'
          };

          options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = `${opt} — ${descriptions[opt]}`;
            btn.addEventListener('click', async () => {
              choiceContainer.style.display = 'none';
              const flavor = {
                'Escape': 'The others go. You let them.',
                'Stay': 'You remain. Someone has to remember this place correctly.',
                'Sacrifice': 'They leave because you don\'t. You\'ve already decided that\'s fair.'
              }[opt];
              await showLine(flavor, { meta: 'Observer Decision' });
              resolve(opt.toLowerCase());
            }, { once: true });
            choiceContainer.appendChild(btn);
          });
        }, 1800);
      });
    }

    sequence();
  }

  // ====================================================================
  // ENDING CALCULATION ENGINE
  // (locked design: role state + sanity state + betrayal outcome +
  //  observer decision -> one of 5 endings)
  // ====================================================================

  function calculateEnding({ tier, trust, role, observerChoice, butterflyConditionMet, groupTrustCollapse }) {
    // Secret Butterfly — rarest, takes priority over everything
    if (butterflyConditionMet) return 'secretButterfly';

    // Forgotten identity collapse — sanity fully gone, no override
    if (tier === 'lost') return 'forgottenEnding';

    // Betrayal — trust collapsed or never healthy, no override
    if (groupTrustCollapse || trust <= 40) return 'betrayalEnding';

    // Forgotten — distorted sanity, "almost made it" sessions
    if (tier === 'distorted') return 'forgottenEnding';

    // Observer's 3-way decision determines the shared group ending
    // for any group that survived well enough. Everyone gets the same
    // ending based on what Observer chose — this is Observer's real power.
    if (observerChoice === 'escape') return 'observerEscape';
    if (observerChoice === 'stay') return 'observerStay';
    if (observerChoice === 'sacrifice') return 'observerSacrifice';

    // True Escape — only if no Observer decision was made (e.g. no Observer
    // in the group, or Observer never reached Final Gate) AND all conditions met
    const convergenceMajorityReached = Player.get().convergenceMajorityReached === true;
    if (tier === 'stable' && trust >= 75 && convergenceMajorityReached && trust > 60) return 'trueEnding';

    // Final fallback
    return 'forgottenEnding';
  }

  const ENDING_CONTENT = {
    trueEnding: {
      bg: 'https://files.catbox.moe/atorqo.jpg',
      track: 'trueEnding',
      title: 'True Escape',
      text: 'The doors open. Not all of you remember why you came. It doesn\'t matter now. You leave anyway.',
      closingLine: 'The academy remembers you as one who left.'
    },
    betrayalEnding: {
      bg: 'https://files.catbox.moe/fluqye.jpg',
      track: 'betrayalEnding',
      title: 'Betrayal',
      text: 'Trust did not hold. The academy resets, patient as ever, already preparing five new chairs.',
      closingLine: 'The academy remembers you as one who stayed quiet.'
    },
    forgottenEnding: {
      bg: 'https://files.catbox.moe/1keikq.jpg',
      track: 'forgottenEnding',
      title: 'Forgotten',
      text: 'You stop trying to remember your name. It stops mattering. The halls feel a little more like home than they should.',
      closingLine: 'The academy remembers you. You no longer remember it.'
    },
    observerEscape: {
      bg: 'https://files.catbox.moe/bcavv5.jpg',
      track: 'observerEnding',
      title: 'Observer — Escape',
      text: 'You left with full awareness. The others followed, not knowing it was your decision that opened the door. The academy marks this as system corruption. Awareness is not permitted outside.',
      closingLine: 'The academy remembers you as one who left with full awareness.'
    },
    observerStay: {
      bg: 'https://files.catbox.moe/bcavv5.jpg',
      track: 'observerEnding',
      title: 'Observer — Stay',
      text: 'You stopped needing confirmation. The others left. The academy accepted your remaining as permanence. You are now part of its verification layer.',
      closingLine: 'The academy remembers you as part of what remembers.'
    },
    observerSacrifice: {
      bg: 'https://files.catbox.moe/bcavv5.jpg',
      track: 'observerEnding',
      title: 'Observer — Sacrifice',
      text: 'Your decision was recorded after it already happened. The others left before you chose. You resolved a sequence inconsistency they will never know existed.',
      closingLine: 'The academy remembers you as the error it needed.'
    },
    secretButterfly: {
      bg: 'https://files.catbox.moe/4egrjl.jpg',
      track: 'hiddenEnding',
      title: 'The Butterfly',
      text: 'Every truth is accounted for. Every name is in its place. A single butterfly settles, finally, somewhere still.',
      closingLine: 'The academy has finished remembering you.'
    }
  };

  // Hidden Letter: a "system leak" shown after the full Credit Scene,
  // recasting the ending as a record the academy kept about the player
  // rather than something that simply happened to them.
  const HIDDEN_LETTER_CONTENT = {
    trueEnding: [
      'We tested multiple versions of your exit.',
      'Only one version believes it succeeded.',
      'We are not sure which one you are.'
    ],
    betrayalEnding: [
      'We did not assign a traitor.',
      'We assigned probability of trust collapse.',
      'You all fulfilled it differently.'
    ],
    forgottenEnding: [
      'A student remained after classification ended.',
      'We continued without updating your status.',
      'You still exist in unlabelled storage.'
    ],
    observerEscape: [
      'Observers are not released.',
      'They are relocated between interpretations.',
      'You will be watching again soon.'
    ],
    observerStay: [
      'You are the reason events feel repeated.',
      'You are used to check if memory still fails.',
      'The academy thanks you for your continued service.'
    ],
    observerSacrifice: [
      'We thank you for resolving timeline inconsistency.',
      'Your presence was the error we needed.',
      'The sequence is now correct. You are not in it.'
    ],
    secretButterfly: [
      'We stopped separating player from outcome.',
      'Everything you did was already stored as past behavior.',
      'The academy is not remembering you.',
      'It is replaying you.'
    ]
  };

  function runEnding(endingKey) {
    const content = ENDING_CONTENT[endingKey] || ENDING_CONTENT.forgottenEnding;
    EndingsJournal.unlock(endingKey);
    goToScene('scene-ending');
    AudioManager.play(content.track, { loop: false, volume: 0.5 });

    document.getElementById('ending-bg').style.backgroundImage = `url('${content.bg}')`;
    document.getElementById('ending-title').textContent = content.title;
    document.getElementById('ending-text').textContent = '';

    const textEl = document.getElementById('ending-text');
    setTimeout(() => {
      textEl.style.transition = 'opacity 1.5s ease';
      textEl.style.opacity = '0';
      textEl.textContent = content.text;
      requestAnimationFrame(() => { textEl.style.opacity = '1'; });
    }, 600);

    setTimeout(() => runCreditScene(endingKey, content), 5500);
  }

  // ====================================================================
  // CREDIT SCENE
  // (locked design: silence -> academy's closing line -> private role
  //  reveal -> single butterfly -> return options)
  // ====================================================================

  function runCreditScene(endingKey, content) {
    goToScene('scene-credits-final');
    const creditScene = document.getElementById('scene-credits-final');
    const closingLineEl = document.getElementById('credit-closing-line');
    const roleRevealEl = document.getElementById('credit-role-reveal');
    const hiddenLetterEl = document.getElementById('credit-hidden-letter');
    const returnOptions = document.getElementById('credit-return-options');
    const readLetterBtn = document.getElementById('btn-read-letter');
    const letterModal = document.getElementById('modal-hidden-letter');
    const letterModalText = document.getElementById('hidden-letter-modal-text');

    closingLineEl.textContent = '';
    roleRevealEl.style.display = 'none';
    hiddenLetterEl.style.display = 'none';
    hiddenLetterEl.textContent = '';
    returnOptions.style.display = 'none';
    if (readLetterBtn) readLetterBtn.style.display = 'none';

    const letterLines = HIDDEN_LETTER_CONTENT[endingKey];
    const fullLetterText = letterLines ? letterLines.join(' ') : '';

    // Beat 1: silence (2-3s, handled by the delay before this function runs
    // plus this initial pause) — fade audio out
    AudioManager.stop();

    setTimeout(() => {
      // Beat 2: the academy speaks last
      closingLineEl.style.transition = 'opacity 1.5s ease';
      closingLineEl.style.opacity = '0';
      closingLineEl.textContent = content.closingLine;
      requestAnimationFrame(() => { closingLineEl.style.opacity = '1'; });
    }, 2200);

    setTimeout(() => {
      // Beat 3: private role reveal — own role only, per locked rule
      const role = Player.get().role || 'wanderer';
      const realLabel = ROLE_REAL_LABELS[role];
      roleRevealEl.style.display = 'block';
      roleRevealEl.style.transition = 'opacity 1.2s ease';
      roleRevealEl.style.opacity = '0';
      roleRevealEl.textContent = `You were the ${realLabel}.`;
      requestAnimationFrame(() => { roleRevealEl.style.opacity = '1'; });
    }, 5200);

    setTimeout(() => {
      // Beat 4: one last butterfly, alone on a still screen
      Butterfly.spawn(creditScene, { count: 1, duration: [5000, 6000] });
    }, 7200);

    setTimeout(() => {
      // Beat 5: return options
      const journalEl = document.getElementById('endings-journal-count');
      if (journalEl) {
        const unlocked = EndingsJournal.getUnlocked().length;
        const total = EndingsJournal.totalCount();
        journalEl.textContent = `Endings found: ${unlocked} / ${total}`;
        journalEl.style.display = 'block';
        journalEl.style.opacity = '0';
        journalEl.style.transition = 'opacity 1.5s ease';
        requestAnimationFrame(() => { journalEl.style.opacity = '1'; });
      }

      returnOptions.style.display = 'flex';
      returnOptions.style.opacity = '0';
      returnOptions.style.transition = 'opacity 1.5s ease';
      requestAnimationFrame(() => { returnOptions.style.opacity = '1'; });
    }, 10500);

    setTimeout(() => {
      // Beat 6: Hidden Letter — a "system leak" that arrives only after
      // everything else has resolved. Glitched and left permanently
      // distorted (red), per locked design: the academy recasting the
      // ending as a record it kept, not something that simply happened.
      if (!letterLines) return;

      hiddenLetterEl.style.display = 'block';
      hiddenLetterEl.textContent = letterLines[0];
      GlitchDialogue.render(hiddenLetterEl, letterLines[0], Player.get().sanity, { persist: true });

      let i = 1;
      const revealNext = () => {
        if (i >= letterLines.length) {
          // Once fully revealed, surface the replay button so the player
          // can read the whole letter again without re-triggering the beat.
          if (readLetterBtn) {
            readLetterBtn.style.display = 'inline-block';
            readLetterBtn.style.opacity = '0';
            readLetterBtn.style.transition = 'opacity 1s ease';
            requestAnimationFrame(() => { readLetterBtn.style.opacity = '1'; });
          }
          return;
        }
        hiddenLetterEl.textContent += ' ' + letterLines[i];
        GlitchDialogue.render(hiddenLetterEl, hiddenLetterEl.textContent, Player.get().sanity, { persist: true });
        i++;
        setTimeout(revealNext, 1800);
      };
      setTimeout(revealNext, 1800);
    }, 13000);

    if (readLetterBtn && letterModal && letterModalText) {
      readLetterBtn.onclick = () => {
        letterModalText.textContent = fullLetterText;
        letterModal.classList.add('active');
      };
    }
    if (letterModal) {
      const closeLetterBtn = document.getElementById('close-hidden-letter');
      if (closeLetterBtn) {
        closeLetterBtn.onclick = () => letterModal.classList.remove('active');
      }
    }

    async function cleanupAndReload() {
      try {
        if (typeof Session !== 'undefined' && Session.getCode()) {
          await Session.leave();
        }
      } catch (e) {
        // best-effort — reload regardless
      }
      try { AudioManager.shutdown(); } catch (e) {}
      window.location.reload();
    }

    document.getElementById('btn-play-again').onclick = () => {
      cleanupAndReload();
    };
    document.getElementById('btn-return-title').onclick = () => {
      cleanupAndReload();
    };
  }

  // ====================================================================
  // SESSION LOBBY
  // (locked design: Session Code Event -> Waiting Room -> Synchronized Entry)
  // ====================================================================
  function runLobby() {
    const sceneEl = document.getElementById('scene-lobby');
    const choiceContent = document.getElementById('lobby-choice-content');
    const joinContent = document.getElementById('lobby-join-content');
    const waitingContent = document.getElementById('lobby-waiting-content');
    const errorEl = document.getElementById('lobby-error');
    const codeDisplay = document.getElementById('lobby-code-display');
    const countEl = document.getElementById('lobby-count');

    let stopButterflies = null;
    let entryStarted = false;

    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.classList.add('visible');
    }

    function enterWaitingRoom(code) {
      choiceContent.style.display = 'none';
      joinContent.style.display = 'none';
      waitingContent.style.display = 'flex';
      codeDisplay.textContent = code;
      stopButterflies = Butterfly.ambient(sceneEl, 3500);

      // Solo-testing convenience: lets you proceed alone without 4 others
      // joining. Safe to remove once real 5-player testing begins.
      const soloSkip = document.createElement('button');
      soloSkip.className = 'menu-option';
      soloSkip.style.marginTop = '1.5rem';
      soloSkip.style.opacity = '0.5';
      soloSkip.textContent = '(solo test: continue without waiting)';
      soloSkip.addEventListener('click', () => {
        if (!entryStarted) {
          entryStarted = true;
          beginSynchronizedEntry();
        }
      });
      waitingContent.appendChild(soloSkip);

      Session.onUpdate(session => {
        try {
          if (!session) return;
          if (session.trust !== undefined) Trust.syncFromRemote(session.trust);
          if (!session.players) return;
          const count = Object.keys(session.players).length;
          countEl.textContent = `${count} / 5 have arrived`;
          if (count >= 5 && !entryStarted) {
            entryStarted = true;
            beginSynchronizedEntry();
          }
        } catch (e) {
          console.error('onUpdate error:', e);
        }
      });

      // Force an immediate count read so players who join after others
      // already joined see the correct current count right away, rather
      // than waiting for the next Firebase event to fire.
      Session.getPlayerCount().then(count => {
        if (count > 0) countEl.textContent = `${count} / 5 have arrived`;
      });
    }

    async function beginSynchronizedEntry() {
      if (stopButterflies) stopButterflies();
      await Session.setPlayerData({ name: Player.get().name });

      // Delay markStarted by 3s so the 5th player's browser has time to
      // register their join before the session locks for latecomers —
      // the race between "5th player joins" and "markStarted fires" was
      // blocking legitimate 5th players from getting in.
      setTimeout(() => Session.markStarted(), 3000);

      waitingContent.innerHTML = '<p class="narrative-text"><span class="beat">Five chairs were always going to be filled.</span></p>';
      await new Promise(r => setTimeout(r, 2600));

      await assignRolesIfHost();

      // Private role hint — one line, shown only to this player, before
      // Classroom starts. Enough to know what they are without naming it
      // as a game mechanic. Glitched to feel like it came from the academy.
      const ROLE_HINTS = {
        wanderer: 'Something is missing. You are not sure what.',
        betrayer: 'You already know something the others do not.',
        observer: 'You will see things others miss. It will cost you.',
        forgotten: 'Something about you is wrong. You cannot place it.'
      };
      const role = Player.get().role;
      const hint = ROLE_HINTS[role] || ROLE_HINTS.wanderer;
      const hintEl = document.createElement('p');
      hintEl.className = 'narrative-text';
      waitingContent.innerHTML = '';
      waitingContent.appendChild(hintEl);
      GlitchDialogue.render(hintEl, hint, Player.get().sanity);
      await new Promise(r => setTimeout(r, 2800));

      Trust.init();
      sceneEl.classList.add('scene-fading-out');
      await new Promise(r => setTimeout(r, 1300));
      sceneEl.classList.remove('scene-fading-out');

      goToScene('scene-classroom');
      AudioManager.play('classroom');
      runClassroom();
    }

    /**
     * Role assignment: only the session creator (first player, detected by
     * earliest joinedAt) performs the 2/1/1/1 assignment and writes it to
     * Firebase, so every player ends up with a role written exactly once
     * rather than 5 clients racing to assign independently.
     */
    async function assignRolesIfHost() {
      const session = await Session.getSession();
      if (!session || !session.players) return;

      const entries = Object.entries(session.players);
      const sortedByJoin = entries.sort((a, b) => a[1].joinedAt - b[1].joinedAt);
      const isHost = sortedByJoin[0][0] === Session.getPlayerId();

      if (isHost) {
        const alreadyAssigned = entries.every(([, p]) => p.role);
        if (!alreadyAssigned) {
          const roles = shuffle(['wanderer', 'wanderer', 'betrayer', 'observer', 'forgotten']);
          const roleByPlayerId = {};
          sortedByJoin.forEach(([pid], i) => {
            roleByPlayerId[pid] = roles[i];
          });
          await Session.assignRoles(roleByPlayerId);
        }
      }

      // Wait for the role to actually appear, rather than reading once
      // after a fixed delay — a slower host write used to mean a fast
      // client could read null and never get a role.
      const myRole = await Session.waitForOwnRole(8000);
      if (myRole) Player.update({ role: myRole });
    }

    function shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    document.getElementById('btn-lobby-create').addEventListener('click', async () => {
      errorEl.classList.remove('visible');
      const btn = document.getElementById('btn-lobby-create');
      btn.textContent = 'Connecting to the academy…';
      btn.style.opacity = '0.5';
      choiceContent.querySelectorAll('button').forEach(b => b.disabled = true);
      try {
        const code = await Session.create();
        enterWaitingRoom(code);
      } catch (e) {
        console.error('Session.create() failed:', e);
        btn.textContent = 'Begin a new session';
        btn.style.opacity = '1';
        showError('Could not reach the academy: ' + (e && e.message ? e.message : 'unknown error') + '. Check your connection and try again.');
        choiceContent.querySelectorAll('button').forEach(b => b.disabled = false);
      }
    });

    document.getElementById('btn-lobby-join').addEventListener('click', () => {
      choiceContent.style.display = 'none';
      joinContent.style.display = 'flex';
    });

    document.getElementById('btn-lobby-join-confirm').addEventListener('click', async () => {
      const code = document.getElementById('lobby-code-field').value.trim();
      if (!code) return;
      errorEl.classList.remove('visible');
      const btn = document.getElementById('btn-lobby-join-confirm');
      btn.textContent = 'Entering…';
      btn.disabled = true;

      const result = await Session.join(code);
      if (!result.ok) {
        btn.textContent = 'Enter';
        btn.disabled = false;
        showError(
          result.reason === 'full' ? 'That session already has five. The academy will not allow more.' :
          result.reason === 'started' ? 'That session has already begun. The academy does not allow late arrivals.' :
          'No such session. Check the code and try again.'
        );
        return;
      }
      enterWaitingRoom(Session.getCode());
    });

    document.getElementById('lobby-code-field').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-lobby-join-confirm').click();
    });
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
      Horror.init();
      goToScene('scene-lobby');
      AudioManager.play('nameInput');
      runLobby();
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
    initMuteButton();
    if (new URLSearchParams(window.location.search).get('debug') === '1') {
      initDebugOverlay();
    }
  });

})();
