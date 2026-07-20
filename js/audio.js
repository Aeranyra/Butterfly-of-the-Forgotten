/**
 * AUDIO MANAGER
 * Handles background music per scene, with crossfade between tracks
 * so transitions don't hard-cut (matches the "academy editing reality"
 * feel from the Sequence System design).
 */

const AudioManager = (() => {
  const TRACKS = {
    menu: 'https://files.catbox.moe/65ntst.mp3',
    personalityTest: 'https://files.catbox.moe/zo3w4o.mp3',
    prologue: 'https://files.catbox.moe/jqhso7.mp3',
    nameInput: 'https://files.catbox.moe/x4p3l8.mp3',
    classroom: 'https://files.catbox.moe/iufxfv.mp3',
    hallway: 'https://files.catbox.moe/wo0ygv.mp3',
    library: 'https://files.catbox.moe/6xdkjm.mp3',
    clockTower: 'https://files.catbox.moe/n2esqe.mp3',
    finalGate: 'https://files.catbox.moe/attj2c.mp3',
    trueEnding: 'https://files.catbox.moe/8aia7g.mp3',
    betrayalEnding: 'https://files.catbox.moe/zkeus3.mp3',
    forgottenEnding: 'https://files.catbox.moe/te08fg.mp3',
    observerEnding: 'https://files.catbox.moe/sdixkl.mp3',
    hiddenEnding: 'https://files.catbox.moe/hs0pb8.mp3'
  };

  let currentAudio = null;
  let currentTrackName = null;
  let unlocked = false;
  let staticAudio = null;

  function _fadeOut(audio, duration = 800) {
    return new Promise(resolve => {
      if (!audio) return resolve();
      const startVolume = audio.volume;
      const steps = 20;
      const stepTime = duration / steps;
      let step = 0;
      const interval = setInterval(() => {
        step++;
        audio.volume = Math.max(0, startVolume * (1 - step / steps));
        if (step >= steps) {
          clearInterval(interval);
          audio.pause();
          resolve();
        }
      }, stepTime);
    });
  }

  function _fadeIn(audio, targetVolume = 0.6, duration = 800) {
    audio.volume = 0;
    audio.play().catch(() => {
      // Autoplay blocked until user interacts — handled by unlock()
    });
    const steps = 20;
    const stepTime = duration / steps;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      audio.volume = Math.min(targetVolume, targetVolume * (step / steps));
      if (step >= steps) clearInterval(interval);
    }, stepTime);
  }

  async function play(trackName, { loop = true, volume = 0.6 } = {}) {
    if (!TRACKS[trackName]) {
      console.warn(`AudioManager: unknown track "${trackName}"`);
      return;
    }
    if (currentTrackName === trackName && currentAudio && !currentAudio.paused) {
      return; // already playing this track, don't restart
    }

    const newAudio = new Audio(TRACKS[trackName]);
    newAudio.loop = loop;
    newAudio.preload = 'auto';

    const oldAudio = currentAudio;
    currentAudio = newAudio;
    currentTrackName = trackName;

    _fadeIn(newAudio, volume);
    if (oldAudio) await _fadeOut(oldAudio);
  }

  function stop() {
    if (currentAudio) {
      _fadeOut(currentAudio);
      currentAudio = null;
      currentTrackName = null;
    }
  }

  /**
   * Browsers block autoplay until the user interacts with the page.
   * Call this on the very first click (e.g. "Click anywhere to begin").
   */
  function unlock(initialTrack) {
    if (unlocked) return;
    unlocked = true;
    // Create the shared AudioContext now, after user gesture, so it's
    // not suspended when ambient sounds need it later in the rooms.
    if (!playStatic._ctx) {
      try {
        playStatic._ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch(e) {}
    }
    if (initialTrack) play(initialTrack);
  }

  /**
   * Static overlay for the Glitch Dialogue System.
   * Plays a short static burst under a line, intensity 0-1.
   * Raised the audible floor so even low-intensity (Stable tier) glitches
   * are clearly heard rather than nearly silent.
   */
  function playStatic(intensity = 0.3) {
    // Lightweight noise burst using Web Audio API — no extra asset needed.
    try {
      const ctx = playStatic._ctx || (playStatic._ctx = new (window.AudioContext || window.webkitAudioContext)());
      const bufferSize = ctx.sampleRate * 0.25; // short burst, meant to repeat per pulse
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * intensity;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      // Raised floor and ceiling so static is clearly audible at all tiers
      gain.gain.value = 0.55 + intensity * 0.65;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch (e) {
      // Web Audio unsupported — silently skip, not critical
    }
  }

  /**
   * AMBIENT SOUNDS
   * Procedural ambient audio for each room — no extra assets needed.
   * Shares the same AudioContext as playStatic to avoid the mobile
   * "suspended context before user gesture" silent failure.
   * Returns a stop function to cancel the ambient loop.
   */
  const Ambient = (() => {
    let activeNodes = [];
    let stopFn = null;

    function _getCtx() {
      // Reuse the same context as playStatic — already resumed by user gesture
      if (!playStatic._ctx) {
        playStatic._ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = playStatic._ctx;
      // Resume if suspended (mobile browsers suspend until user gesture)
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function _stopAll() {
      activeNodes.forEach(n => { try { n.stop(); } catch(e) {} });
      activeNodes = [];
      if (stopFn) { stopFn(); stopFn = null; }
    }

    function _noise(ctx, durationSec, filter, gainVal, filterFreq, filterType = 'bandpass', Q = 1) {
      try {
        const buf = ctx.createBuffer(1, ctx.sampleRate * durationSec, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const f = ctx.createBiquadFilter();
        f.type = filterType;
        f.frequency.value = filterFreq;
        if (Q) f.Q.value = Q;
        const g = ctx.createGain();
        g.gain.value = gainVal;
        src.connect(f); f.connect(g); g.connect(ctx.destination);
        src.start();
        activeNodes.push(src);
        return src;
      } catch(e) { return null; }
    }

    /**
     * Classroom: muffled student murmurs
     */
    function classroom() {
      _stopAll();
      const interval = setInterval(() => {
        const ctx = _getCtx();
        _noise(ctx, 0.18, true, 0.04 + Math.random() * 0.03,
          300 + Math.random() * 300, 'bandpass', 0.8);
      }, 900 + Math.random() * 1100);
      stopFn = () => clearInterval(interval);
    }

    /**
     * Library: page turning sounds
     */
    function library() {
      _stopAll();
      function turnPage() {
        const ctx = _getCtx();
        const dur = 0.08 + Math.random() * 0.06;
        const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          const env = Math.sin((i / data.length) * Math.PI);
          data[i] = (Math.random() * 2 - 1) * env;
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const f = ctx.createBiquadFilter();
        f.type = 'highpass'; f.frequency.value = 2000;
        const g = ctx.createGain();
        g.gain.value = 0.15 + Math.random() * 0.1;
        src.connect(f); f.connect(g); g.connect(ctx.destination);
        src.start();
        activeNodes.push(src);
        if (Math.random() < 0.35) setTimeout(turnPage, 130 + Math.random() * 160);
      }
      turnPage();
      const interval = setInterval(turnPage, 3500 + Math.random() * 3500);
      stopFn = () => clearInterval(interval);
    }

    /**
     * Hallway: distant footsteps
     */
    function hallway() {
      _stopAll();
      function step() {
        const ctx = _getCtx();
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.14, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          const env = Math.exp(-i / (data.length * 0.25));
          data[i] = (Math.random() * 2 - 1) * env;
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 160 + Math.random() * 80;
        const g = ctx.createGain();
        g.gain.value = 0.22 + Math.random() * 0.1;
        src.connect(f); f.connect(g); g.connect(ctx.destination);
        src.start();
        activeNodes.push(src);
      }
      function walkCycle() {
        const count = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) setTimeout(step, i * (400 + Math.random() * 180));
      }
      walkCycle();
      const interval = setInterval(walkCycle, 5000 + Math.random() * 4000);
      stopFn = () => clearInterval(interval);
    }

    function stop() { _stopAll(); }

    return { classroom, library, hallway, stop };
  })();

  /**
   * Fully closes the shared AudioContext instead of just stopping playback.
   * Ambient/track stop() calls before this only released their own nodes —
   * the underlying AudioContext stayed open for the life of the page.
   * Call this right before a full reload/restart, not mid-game.
   */
  function shutdown() {
    stop();
    Ambient.stop();
    if (playStatic._ctx) {
      try { playStatic._ctx.close(); } catch (e) {}
      playStatic._ctx = null;
    }
  }

  return { play, stop, unlock, playStatic, TRACKS, Ambient, shutdown,
    get _currentAudio() { return currentAudio; } };
})();
