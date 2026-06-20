/**
 * STATE LAYER — Firebase Hybrid Edition
 * Game works exactly as original. Firebase syncs in background.
 */

// ---------- SESSION ----------
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

// ---------- FIREBASE (optional background sync) ----------
let _db = null;
window.addEventListener('load', () => {
  try {
    if (typeof firebase !== 'undefined') {
      if (!firebase.apps.length) {
        firebase.initializeApp({
          apiKey: "AIzaSyDkSIwzVhFrXnLUCfDzIStMmTt04B97iac",
          authDomain: "butterfly-of-the-forgotten.firebaseapp.com",
          databaseURL: "https://butterfly-of-the-forgotten-default-rtdb.asia-southeast1.firebasedatabase.app",
          projectId: "butterfly-of-the-forgotten",
          storageBucket: "butterfly-of-the-forgotten.firebasestorage.app",
          messagingSenderId: "277184033301",
          appId: "1:277184033301:web:ea9e8a15e0d15f3aa9d41c",
          measurementId: "G-9QYZSNLRJ0"
        });
      }
      _db = firebase.database();
      console.log('[Butterfly] Firebase connected. Session:', SESSION_ID);
    }
  } catch(e) {
    console.warn('[Butterfly] Firebase unavailable:', e);
  }
});

function _fbSet(path, value) {
  try { if (_db) _db.ref(path).set(value); } catch(e) {}
}
function _fbUpdate(path, value) {
  try { if (_db) _db.ref(path).update(value); } catch(e) {}
}

// ---------- CORE STATE (original — unchanged) ----------
const memory = {};
const listeners = {};

function _persist() {
  try { sessionStorage.setItem('butterfly_state', JSON.stringify(memory)); } catch(e) {}
}

function _restore() {
  try {
    const raw = sessionStorage.getItem('butterfly_state');
    if (raw) Object.assign(memory, JSON.parse(raw));
  } catch(e) {}
}

const GameState = (() => {
  function saveState(key, value) {
    memory[key] = value;
    _persist();
    _fbSet(`sessions/${SESSION_ID}/state/${key}`, value);
    if (listeners[key]) listeners[key].forEach(cb => cb(value));
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

// ---------- PLAYER (original — unchanged) ----------
const Player = {
  init() {
    if (GameState.loadState('player') === null) {
      GameState.saveState('player', {
        name: null,
        sanity: 75,
        role: null,
        personalityAnswers: [],
        currentScene: 'title'
      });
    }
  },
  get() { return GameState.loadState('player'); },
  update(partial) {
    const current = Player.get() || {};
    const updated = { ...current, ...partial };
    GameState.saveState('player', updated);
    _fbUpdate(`sessions/${SESSION_ID}/players/${PLAYER_ID}`, partial);
    return updated;
  },
  setName(name)     { return Player.update({ name }); },
  setScene(sceneId) { return Player.update({ currentScene: sceneId }); },
  addPersonalityAnswer(promptId, answer) {
    const current = Player.get();
    const answers = [...(current.personalityAnswers || []), { promptId, answer }];
    return Player.update({ personalityAnswers: answers });
  },
  watchAllPlayers(callback) {
    if (_db) _db.ref(`sessions/${SESSION_ID}/players`).on('value', s => callback(s.val() || {}));
  },
  getSessionId() { return SESSION_ID; },
  getPlayerId()  { return PLAYER_ID; }
};

// Run immediately — same as original
Player.init();
