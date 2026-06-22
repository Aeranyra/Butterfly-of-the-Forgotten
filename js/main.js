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

      // ---- EVENT 1: ROLL CALL ----
      NPC.showBackgroundStudents(4);
      await showLine('Five chairs. Five names. None of them feel new.', { meta: 'Roll Call' });
      NPC.clearZone();

      // ---- EVENT 2: SEATING DISCREPANCY ----
      await showLine('There are six seats.', { meta: 'Seating' });
      await showLine('There are five of you.', { meta: 'Seating' });

      const role = (Player.get().role) || 'wanderer';
      const reaction = SEATING_REACTIONS[role] || SEATING_REACTIONS.wanderer;
      Trust.shift(0); // no trust change yet — this beat is personal, not group
      await showLine(reaction, { meta: 'Seating' });

      // ---- EVENT 3: LESSON FRAGMENT ----
      await wait(500);
      await NPC.speak(
        '"...and so the names that remain are the names that were chosen to remain..."',
        { glitch: true, sanity: Player.get().sanity, holdMs: 3800 }
      );
      await showLine('The sentence never finishes. No one explains who is teaching.', { meta: 'Lesson' });

      // ---- EVENT 4: QUIET QUESTION (first real choice) ----
      await showLine('The sixth seat is still there. No one else seems to be counting.', { meta: 'Seating' });
      await runQuietQuestion();

      // ---- EXIT ----
      await showLine('The bell does not ring. You simply know it\'s time to leave.', { meta: 'Classroom', holdForClick: false });
      await wait(1800);

      sceneEl.classList.add('scene-fading-out');
      await wait(1300);

      sceneEl.classList.remove('scene-fading-out');
      goToScene('scene-hallway');
      AudioManager.play('hallway');
      runHallway();
    }

    function runQuietQuestion() {
      return new Promise(resolve => {
        metaEl.textContent = 'Quiet Question';
        textEl.innerHTML = '<span class="beat">The sixth seat is still there. No one else seems to be counting.</span>';

        setTimeout(() => {
          textEl.innerHTML = '<span class="beat">Do you say something about the sixth seat?</span>';

          const options = [
            { text: 'Ask the room', trustDelta: -3, flavor: 'No one answers. The silence sits there, awkward and total.' },
            { text: 'Ask one person quietly', trustDelta: 0, flavor: 'They glance at the seat, then at you. Neither of you says more.' },
            { text: 'Say nothing', trustDelta: 0, flavor: 'You let it go. The seat count stays wrong, unspoken.' }
          ];

          choiceContainer.style.display = 'flex';
          choiceContainer.innerHTML = '';

          options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = opt.text;
            btn.addEventListener('click', async () => {
              choiceContainer.style.display = 'none';
              Trust.shift(opt.trustDelta);
              if (opt.text === 'Say nothing') {
                // Per locked design: no immediate effect, but Forgotten
                // instability ticks up slightly faster later. Tracked here
                // as a flag for future rooms to read.
                Player.update({ saidNothingInClassroom: true });
              }
              await showLine(opt.flavor, { meta: 'Quiet Question' });
              resolve();
            }, { once: true });
            choiceContainer.appendChild(btn);
          });
        }, 1800);
      });
    }

    sequence();
  }

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
        Trust.shift(-4);
      } else if (role === 'observer') {
        await showLine('"This corridor has been walked before."', { meta: 'Interference', glitch: true });
        Player.update({ sanity: Math.max(0, Player.get().sanity - 3) });
      } else if (role === 'forgotten') {
        await showLine('A voice says your name. It gets it wrong.', { meta: 'Interference' });
      } else {
        await NPC.speak('Someone falls out of step beside you, then catches up. You\'re not sure who.', { holdMs: 3000 });
      }

      // ---- SEPARATION EVENT (key hallway mechanic) ----
      await wait(400);
      await showLine('For a moment, this doesn\'t look like the same hallway anymore.', { meta: 'Separation' });
      await showLine('But you\'re still in the same space. You\'re sure of that. Mostly.', { meta: 'Separation' });

      // ---- EXIT ----
      await showLine('"The library remembers you."', { meta: 'Hallway', holdForClick: false, glitch: true });
      await wait(2200);

      sceneEl.classList.add('scene-fading-out');
      await wait(1300);

      sceneEl.classList.remove('scene-fading-out');
      goToScene('scene-library');
      AudioManager.play('library');
      runLibrary();
    }

    function runMovementChoice() {
      return new Promise(resolve => {
        metaEl.textContent = 'Movement';
        textEl.innerHTML = '<span class="beat">The hallway splits in three directions, plus the one behind you.</span>';

        setTimeout(() => {
          textEl.innerHTML = '<span class="beat">Which direction feels correct?</span>';

          // Per locked rule: ALL choices lead forward. Only the flavor text differs.
          const options = [
            { text: 'Left corridor', flavor: 'You go left. The hallway accepts it without comment.' },
            { text: 'Right corridor', flavor: 'You go right. Nothing about it feels more or less correct than left would have.' },
            { text: 'Forward', flavor: 'You go straight on. It\'s the only choice that doesn\'t feel like a choice.' },
            { text: 'Stay still', flavor: 'You wait. Eventually the hallway moves instead — or you do, and don\'t notice.' }
          ];

          choiceContainer.style.display = 'flex';
          choiceContainer.innerHTML = '';

          options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = opt.text;
            btn.addEventListener('click', async () => {
              choiceContainer.style.display = 'none';
              // Per locked Sanity rule: choosing Stay still is a small,
              // cautious sanity gain.
              if (opt.text === 'Stay still') {
                Player.update({ sanity: Math.min(100, Player.get().sanity + 2) });
              }
              await showLine(opt.flavor, { meta: 'Movement' });
              resolve();
            }, { once: true });
            choiceContainer.appendChild(btn);
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

      // ---- EXIT ----
      await showLine('The Librarian closes the book without looking at it. Without looking at you.', { meta: 'Library', holdForClick: false });
      await wait(2000);

      sceneEl.classList.add('scene-fading-out');
      await wait(1300);

      sceneEl.classList.remove('scene-fading-out');
      goToScene('scene-convergence');
      AudioManager.play('library');
      runConvergence();
    }

    function runObserverChoice() {
      return new Promise(resolve => {
        metaEl.textContent = 'Observer';
        textEl.innerHTML = '<span class="beat">You could look closer. It would cost you something to see clearly.</span>';

        const options = [
          {
            text: 'Look closer',
            apply: async () => {
              Player.update({ sanity: Math.max(0, Player.get().sanity - 5) });
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

        setTimeout(() => {
          textEl.innerHTML = '<span class="beat">Do you tell them what you read?</span>';

          const options = [
            { text: 'Tell them exactly what you read', trustDelta: 2, flavor: 'You say it plainly. No one challenges you. That, somehow, is worse.' },
            { text: 'Tell a softened version', trustDelta: 0, flavor: 'You leave out the part that frightened you. It still shows on your face.' },
            { text: 'Say you found nothing', trustDelta: -3, flavor: 'You lie. The book is still open on the table behind you.' }
          ];

          choiceContainer.style.display = 'flex';
          choiceContainer.innerHTML = '';

          options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = opt.text;
            btn.addEventListener('click', async () => {
              choiceContainer.style.display = 'none';
              Trust.shift(opt.trustDelta);
              await showLine(opt.flavor, { meta: 'Fragment' });
              resolve();
            }, { once: true });
            choiceContainer.appendChild(btn);
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

      // Solo-test note: real cross-player tallying needs all 5 sessions
      // synced through Firebase. Here, the "group" result is approximated
      // from the player's own answer plus a weighted random spread, just
      // enough to demonstrate the majority/split mechanic until live
      // 5-player tallying is wired in.
      const simulatedGroup = [answer];
      for (let i = 0; i < 4; i++) {
        const pool = ['leave', 'stay', 'unsure'];
        simulatedGroup.push(pool[Math.floor(Math.random() * pool.length)]);
      }
      const counts = simulatedGroup.reduce((acc, a) => { acc[a] = (acc[a] || 0) + 1; return acc; }, {});
      const majorityCount = Math.max(...Object.values(counts));
      const majorityReached = majorityCount >= 3; // 3 of 5 = real majority

      Player.update({ convergenceMajorityReached: majorityReached });
      Trust.shift(majorityReached ? 5 : -3);

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
      return new Promise(resolve => {
        metaEl.textContent = 'The Question';
        textEl.innerHTML = '<span class="beat">"If the gate opened right now — would you walk through it?"</span>';

        const options = [
          { value: 'leave', text: 'Yes. Whatever is on the other side.', flavor: 'You answer before you can think better of it.' },
          { value: 'stay', text: 'No. Not yet.', flavor: 'You hold the answer back, even from yourself.' },
          { value: 'unsure', text: 'I don\'t know what I\'d be leaving.', flavor: 'The honest answer. The academy seems to prefer it.' }
        ];

        choiceContainer.style.display = 'flex';
        choiceContainer.innerHTML = '';

        options.forEach(opt => {
          const btn = document.createElement('button');
          btn.className = 'choice-btn';
          btn.textContent = opt.text;
          btn.addEventListener('click', async () => {
            choiceContainer.style.display = 'none';
            await showLine(opt.flavor, { meta: 'The Question' });
            resolve(opt.value);
          }, { once: true });
          choiceContainer.appendChild(btn);
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
        Player.update({ sanity: Math.max(0, Player.get().sanity - 3) });
        await showLine('You see the tower\'s gears running backward. Looking costs you something, every time.', { meta: 'Pressure', glitch: true });
      } else if (role === 'forgotten') {
        await showLine('"I never did," someone says, about something you don\'t remember asking.', { meta: 'Pressure' });
      } else {
        await showLine('You climb. The stairs feel like they\'re counting something.', { meta: 'Pressure' });
      }

      // ---- FINAL ALIGNMENT EVENT ----
      await runFinalAlignment();

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

        setTimeout(() => {
          textEl.innerHTML = '<span class="beat">Choose what you believe is real.</span>';

          const options = [
            { text: 'The academy is real, and we are trapped here', sanityDelta: 2, flavor: 'Saying it steadies you, a little. At least it\'s a shape you can hold.' },
            { text: 'None of this is real, and we will wake up', sanityDelta: -2, flavor: 'It feels true for a moment. Then the tower reminds you it isn\'t.' },
            { text: 'I don\'t know, and I\'m done pretending I do', sanityDelta: 1, flavor: 'No one disagrees with you. That might be the most honest thing said all day.' }
          ];

          choiceContainer.style.display = 'flex';
          choiceContainer.innerHTML = '';

          options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = opt.text;
            btn.addEventListener('click', async () => {
              choiceContainer.style.display = 'none';
              const current = Player.get().sanity;
              Player.update({ sanity: Math.max(0, Math.min(100, current + opt.sanityDelta)) });
              Player.update({ alignmentChoice: opt.text });
              await showLine(opt.flavor, { meta: 'Final Alignment' });
              resolve();
            }, { once: true });
            choiceContainer.appendChild(btn);
          });
        }, 1800);
      });
    }

    sequence();
  }

  // ====================================================================
  // FINAL GATE
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

      // ---- EVENT 4: OBSERVER DECISION PHASE ----
      let observerChoice = null;
      if (role === 'observer') {
        observerChoice = await runObserverDecision();
      } else {
        await wait(400);
      }

      // ---- EVENT 5 (SECRET): BUTTERFLY CONDITION CHECK ----
      const butterflyConditionMet = tier === 'stable' && trust >= 70;

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
    // Secret Butterfly Ending — rarest of all, full truth completion
    if (butterflyConditionMet) return 'secretButterfly';

    // Forgotten identity collapse — sanity fully gone
    if (tier === 'lost') return 'forgottenEnding';

    // Betrayal ending — trust collapsed OR trust was never healthy (≤40).
    // Raised from ≤20 to ≤40 so most struggling groups hit this naturally,
    // not just groups who catastrophically failed.
    if (groupTrustCollapse || trust <= 40) return 'betrayalEnding';

    // Forgotten ending — Distorted sanity (30-59) means the player is too
    // unstable to escape cleanly, even if trust didn't fully collapse.
    // This is now the default for "almost made it" sessions.
    if (tier === 'distorted') return 'forgottenEnding';

    // Observer ending — their own decision shapes the close.
    if (role === 'observer' && observerChoice) return 'observerEnding';

    // True Escape — genuinely rare. Requires ALL of:
    // - Stable sanity (≥60)
    // - High group trust (≥75, up from previous implicit "not collapsed")
    // - Convergence majority alignment achieved
    // - Betrayer did NOT silently succeed (trust > 40 already gates this,
    //   but also check that trust stayed above 60 through to Final Gate
    //   to prevent a group that recovered from near-collapse from slipping in)
    const convergenceMajorityReached = Player.get().convergenceMajorityReached === true;
    if (tier === 'stable' && trust >= 75 && convergenceMajorityReached && trust > 60) return 'trueEnding';

    // Final fallback — Stable sanity but trust or alignment insufficient.
    // Forgotten over Betrayal here since the player isn't actively hostile,
    // just... didn't make it. The academy stops pointing at you.
    return role === 'observer' ? 'observerEnding' : 'forgottenEnding';
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
    observerEnding: {
      bg: 'https://files.catbox.moe/bcavv5.jpg',
      track: 'observerEnding',
      title: 'Observer',
      text: 'What you chose to see becomes what was true. The others never know how much of this was your decision.',
      closingLine: 'The academy remembers what you chose to see.'
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
    observerEnding: [
      'Observers are not released.',
      'They are relocated between interpretations.',
      'You will be watching again soon.'
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

    document.getElementById('btn-play-again').onclick = () => {
      window.location.reload();
    };
    document.getElementById('btn-return-title').onclick = () => {
      window.location.reload();
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
        if (!session) return;
        // This subscription stays alive for the rest of the game (it's
        // never unsubscribed), so it doubles as the live trust sync for
        // every room — not just the lobby. Whenever ANY player's choice
        // shifts trust, every player's indicator reconciles to it here,
        // in real time, regardless of which scene they're currently in.
        Trust.syncFromRemote(session.trust);

        if (!session.players) return;
        const count = Object.keys(session.players).length;
        countEl.textContent = `${count} / 5 have arrived`;

        // Per locked design: cannot proceed until exactly 5 are present
        if (count >= 5 && !entryStarted) {
          entryStarted = true;
          beginSynchronizedEntry();
        }
      });
    }

    async function beginSynchronizedEntry() {
      if (stopButterflies) stopButterflies();
      await Session.setPlayerData({ name: Player.get().name });

      waitingContent.innerHTML = '<p class="narrative-text"><span class="beat">Five chairs were always going to be filled.</span></p>';
      await new Promise(r => setTimeout(r, 2600));

      // Role assignment now happens through the real session rather than
      // the solo weighted-random placeholder — see assignRolesIfHost().
      await assignRolesIfHost();

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
      const snapshot = await firebase.database().ref('sessions/' + Session.getCode()).once('value');
      const session = snapshot.val();
      if (!session || !session.players) return;

      const entries = Object.entries(session.players);
      const sortedByJoin = entries.sort((a, b) => a[1].joinedAt - b[1].joinedAt);
      const isHost = sortedByJoin[0][0] === Session.getPlayerId();

      if (isHost) {
        const alreadyAssigned = entries.every(([, p]) => p.role);
        if (!alreadyAssigned) {
          const roles = shuffle(['wanderer', 'wanderer', 'betrayer', 'observer', 'forgotten']);
          const updates = {};
          sortedByJoin.forEach(([pid], i) => {
            updates[`players/${pid}/role`] = roles[i];
          });
          await firebase.database().ref('sessions/' + Session.getCode()).update(updates);
        }
      }

      // All players (host included) wait briefly then read their own role
      await new Promise(r => setTimeout(r, isHost ? 0 : 600));
      const myRoleSnap = await firebase.database()
        .ref(`sessions/${Session.getCode()}/players/${Session.getPlayerId()}/role`)
        .once('value');
      const myRole = myRoleSnap.val();
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
      choiceContent.querySelectorAll('button').forEach(b => b.disabled = true);
      try {
        const code = await Session.create();
        enterWaitingRoom(code);
      } catch (e) {
        console.error('Session.create() failed:', e);
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

      const result = await Session.join(code);
      if (!result.ok) {
        showError(result.reason === 'full'
          ? 'That session already has five. The academy will not allow more.'
          : 'No such session. Check the code and try again.');
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
  });

})();
