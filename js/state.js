/**
 * STATE LAYER — Firebase Edition
 * ------------------------------------------------------------
 * Syncs all game state to Firebase Realtime Database so all
 * 5 players share the same session in real-time.
 *
 * Session ID is stored in the URL: ?session=XXXX
 * If no session ID, a new one is created automatically.
 * ------------------------------------------------------------
 */

// ---------- FIREBASE SETUP ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

// ---------- SESSION HELPERS ----------
function getSessionId() {
  const params = new URLSearchParams(window.location.search);
  let sid = params.get('session');
  if (!sid) {
    // Generate a short random room code like "A3F7"
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

// Expose session info so other parts of the game can use it
window.BUTTERFLY_SESSION = SESSION_ID;
window.BUTTERFLY_PLAYER  = PLAYER_ID;

console.log(`[Butterfly] Session: ${SESSION_ID} | Player: ${PLAYER_ID}`);

// ---------- FIREBASE STATE LAYER ----------
const memory    = {};
const listeners = {};

// Sync a key FROM Firebase whenever it changes remotely
function _watchKey(key) {
  const r = ref(db, `sessions/${SESSION_ID}/state/${key}`);
  onValue(r, snapshot => {
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
    // Push to Firebase
    const r = ref(db, `sessions/${SESSION_ID}/state/${key}`);
    set(r, value).catch(e => console.warn('[Firebase] write error:', e));
    // Notify local listeners
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
      _watchKey(key);   // start listening to Firebase for this key
    }
    listeners[key].push(callback);
  }

  return { saveState, loadState, onStateChange };
})();

// ---------- PLAYER HELPERS ----------
const Player = {
  init() {
    const playerRef = ref(db, `sessions/${SESSION_ID}/players/${PLAYER_ID}`);
    get(playerRef).then(snapshot => {
      if (!snapshot.exists()) {
        // First time this player joins
        set(playerRef, {
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
    // Also update this player's own record
    const playerRef = ref(db, `sessions/${SESSION_ID}/players/${PLAYER_ID}`);
    update(playerRef, partial).catch(e => console.warn('[Firebase] player update error:', e));
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
  },

  // Watch all players in this session (for multiplayer UI)
  watchAllPlayers(callback) {
    const allRef = ref(db, `sessions/${SESSION_ID}/players`);
    onValue(allRef, snapshot => {
      const players = snapshot.val() || {};
      callback(players);
    });
  },

  getSessionId() { return SESSION_ID; },
  getPlayerId()  { return PLAYER_ID;  }
};

Player.init();
