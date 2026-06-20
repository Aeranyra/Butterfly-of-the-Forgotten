/**
 * STATE LAYER — Firebase Compat Edition
 * ------------------------------------------------------------
 * Uses Firebase compat SDK (no imports needed).
 * Scripts loaded via CDN in index.html before this file.
 * ------------------------------------------------------------
 */

// ---------- FIREBASE SETUP ----------
const firebaseConfig = {
  apiKey: "AIzaSyDkSIwzVhFrXnLUCfDzIStMmTt04B97iac",
  authDomain: "butterfly-of-the-forgotten.firebaseapp.com",
  databaseURL: "https://butterfly-of-the-forgotten-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "butterfly-of-the-forgotten",
  storageBucket: "butterfly-of-the-forgotten.firebasestorage.app",
  messagingSenderId: "277184033301",
  appId: "1:277184033301:web:ea9e8a15e0d15f3aa9d41c",
  measurementId: "G-9QYZSNLRJ0"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ---------- SESSION HELPERS ----------
function getSessionId() {
  const params = new URLSearchParams(window.location.search);
  let sid = params.get('session');
  if (!sid) {
    sid = Math.random().toString(36).substring(2, 6).toUpperCase();
    const url = new URL(window.location.href);
    url.searchParams.set('session', sid);
    window.history.replaceState({}, '', url);
  }
  return sid;
}

function getPlayerId() {
  let pid = sessionStorage.getItem('butterfly_player_id');
  if (!pid) {
    pid = 'player_' + Math.random().toString(36).substring(2, 8);
    sessionStorage.setItem('butterfly_player_id', pid);
  }
  return pid;
}

const SESSION_ID = getSessionId();
const PLAYER_ID  = getPlayerId();

window.BUTTERFLY_SESSION = SESSION_ID;
window.BUTTERFLY_PLAYER  = PLAYER_ID;

console.log(`[Butterfly] Session: ${SESSION_ID} | Player: ${PLAYER_ID}`);

// ---------- STATE LAYER ----------
const memory    = {};
const listeners = {};

function _watchKey(key) {
  db.ref(`sessions/${SESSION_ID}/state/${key}`).on('value', snapshot => {
    const value = snapshot.val();
    if (value !== null) {
      memory[key] = value;
      if (listeners[key]) {
        listeners[key].forEach(cb => cb(value));
      }
    }
  });
}

const GameState = (() => {

  function saveState(key, value) {
    memory[key] = value;
    db.ref(`sessions/${SESSION_ID}/state/${key}`).set(value)
      .catch(e => console.warn('[Firebase] write error:', e));
    if (listeners[key]) {
      listeners[key].forEach(cb => cb(value));
    }
    return value;
  }

  function loadState(key, fallback = null) {
    return key in memory ? memory[key] : fallback;
  }

  function onStateChange(key, callback) {
    if (!listeners[key]) {
      listeners[key] = [];
      _watchKey(key);
    }
    listeners[key].push(callback);
  }

  return { saveState, loadState, onStateChange };
})();

// ---------- PLAYER ----------
const Player = {
  init() {
    const playerRef = db.ref(`sessions/${SESSION_ID}/players/${PLAYER_ID}`);
    playerRef.once('value').then(snapshot => {
      if (!snapshot.exists()) {
        playerRef.set({
          name: null,
          sanity: 75,
          role: null,
          personalityAnswers: [],
          currentScene: 'title',
          joinedAt: Date.now()
        });
      }
    });
  },

  get() {
    return GameState.loadState('player');
  },

  update(partial) {
    const current = Player.get() || {};
    const updated = { ...current, ...partial };
    GameState.saveState('player', updated);
    db.ref(`sessions/${SESSION_ID}/players/${PLAYER_ID}`)
      .update(partial)
      .catch(e => console.warn('[Firebase] player update error:', e));
    return updated;
  },

  setName(name)   { return Player.update({ name }); },
  setScene(sceneId) { return Player.update({ currentScene: sceneId }); },

  addPersonalityAnswer(promptId, answer) {
    const current = Player.get();
    const answers = [...(current.personalityAnswers || []), { promptId, answer }];
    return Player.update({ personalityAnswers: answers });
  },

  watchAllPlayers(callback) {
    db.ref(`sessions/${SESSION_ID}/players`).on('value', snapshot => {
      callback(snapshot.val() || {});
    });
  },

  getSessionId() { return SESSION_ID; },
  getPlayerId()  { return PLAYER_ID;  }
};

Player.init();
