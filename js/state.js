/**
 * STATE LAYER
 * ------------------------------------------------------------
 * All game state lives behind these three functions:
 *   saveState(key, value)
 *   loadState(key)
 *   onStateChange(key, callback)
 *
 * Right now they just use an in-memory object (and sessionStorage
 * as a soft backup so a refresh doesn't wipe progress). Later,
 * when Firebase is wired in, only the INSIDE of these three
 * functions needs to change — nothing else in the game touches
 * storage directly, so the swap is small and contained here.
 * ------------------------------------------------------------
 */

const GameState = (() => {
  const memory = {};
  const listeners = {};

  function _persist() {
    try {
      sessionStorage.setItem('butterfly_state', JSON.stringify(memory));
    } catch (e) {
      // sessionStorage unavailable — memory-only fallback, fine for now
    }
  }

  function _restore() {
    try {
      const raw = sessionStorage.getItem('butterfly_state');
      if (raw) Object.assign(memory, JSON.parse(raw));
    } catch (e) {
      // ignore, start fresh
    }
  }

  function saveState(key, value) {
    memory[key] = value;
    _persist();
    if (listeners[key]) {
      listeners[key].forEach(cb => cb(value));
    }
    return value;
  }

  function loadState(key, fallback = null) {
    return key in memory ? memory[key] : fallback;
  }

  function onStateChange(key, callback) {
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(callback);
  }

  _restore();

  return { saveState, loadState, onStateChange };
})();

/**
 * ENDINGS JOURNAL
 * ------------------------------------------------------------
 * Tracks which of the game's endings this browser has unlocked, as a
 * light "collection" incentive for replaying. Deliberately backed by
 * localStorage (not the sessionStorage-backed GameState above) since
 * this is meant to persist across full browser restarts, not just
 * page reloads within one play session.
 * ------------------------------------------------------------
 */
const EndingsJournal = (() => {
  const KEY = 'butterfly_endings_unlocked';
  const ALL_ENDINGS = [
    'trueEnding', 'betrayalEnding', 'forgottenEnding',
    'observerEscape', 'observerStay', 'observerSacrifice',
    'secretButterfly'
  ];

  function _load() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function unlock(endingKey) {
    const current = _load();
    if (!ALL_ENDINGS.includes(endingKey)) return current;
    if (!current.includes(endingKey)) {
      current.push(endingKey);
      try { localStorage.setItem(KEY, JSON.stringify(current)); } catch (e) {}
    }
    return current;
  }

  function getUnlocked() {
    return _load();
  }

  function totalCount() {
    return ALL_ENDINGS.length;
  }

  return { unlock, getUnlocked, totalCount, ALL_ENDINGS };
})();

const Player = {
  init() {
    if (GameState.loadState('player') === null) {
      GameState.saveState('player', {
        name: null,
        sanity: 75,            // starts Stable, per Final Gate tiers (60-100)
        role: null,            // assigned after Personality Test
        personalityAnswers: [],
        currentScene: 'title'
      });
    }
  },
  get() {
    return GameState.loadState('player');
  },
  update(partial) {
    const current = Player.get() || {};
    const updated = { ...current, ...partial };
    GameState.saveState('player', updated);

    // Keep the shared session's copy of this player's sanity in sync so
    // other players (e.g. Observer's borrowMemory) see real values instead
    // of only ever reading their own local state.
    if ('sanity' in partial && typeof Session !== 'undefined' && Session.getCode()) {
      Session.setPlayerData({ sanity: updated.sanity }).catch(() => {});
    }

    return updated;
  },
  setName(name) {
    return Player.update({ name });
  },
  addPersonalityAnswer(promptId, answer) {
    const current = Player.get();
    const answers = [...(current.personalityAnswers || []), { promptId, answer }];
    return Player.update({ personalityAnswers: answers });
  },
  setScene(sceneId) {
    return Player.update({ currentScene: sceneId });
  }
};

Player.init();
