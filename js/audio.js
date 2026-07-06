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
   * Returns a stop function to cancel the ambient loop.
   */
  const Ambient = (() => {
    let activeCtx = null;
    let activeNodes = [];
    let stopFn = null;

    function _getCtx() {
      if (!activeCtx || activeCtx.state === 'closed') {
        activeCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      return activeCtx;
    }

    function _stopAll() {
      activeNodes.forEach(n => { try { n.stop(); } catch(e) {} });
      activeNodes = [];
      if (stopFn) { stopFn(); stopFn = null; }
    }

    /**
     * Classroom: muffled student murmurs — low-frequency filtered noise
     * that sounds like distant voices in another room.
     */
    function classroom() {
      _stopAll();
      try {
        const ctx = _getCtx();
        const interval = setInterval(() => {
          // Random short burst of filtered noise = muffled voice
          const buf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
          const data = buf.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          // Bandpass around 300-600hz = muffled speech frequency
          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.value = 300 + Math.random() * 300;
          filter.Q.value = 0.8;
          const gain = ctx.createGain();
          gain.gain.value = 0.045 + Math.random() * 0.03;
          src.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          src.start();
          activeNodes.push(src);
        }, 800 + Math.random() * 1200);
        stopFn = () => clearInterval(interval);
      } catch(e) {}
    }

    /**
     * Library: page turning — a short crisp noise burst every few seconds,
     * pitched to sound like paper rather than static.
     */
    function library() {
      _stopAll();
      try {
        const ctx = _getCtx();
        function turnPage() {
          const dur = 0.08 + Math.random() * 0.06;
          const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
          const data = buf.getChannelData(0);
          for (let i = 0; i < data.length; i++) {
            // Envelope: quick attack, fast decay — crisp page sound
            const env = Math.sin((i / data.length) * Math.PI);
            data[i] = (Math.random() * 2 - 1) * env;
          }
          const src = ctx.createBufferSource();
          src.buffer = buf;
          const filter = ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.value = 2000; // paper = high frequency
          const gain = ctx.createGain();
          gain.gain.value = 0.12 + Math.random() * 0.08;
          src.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          src.start();
          activeNodes.push(src);
          // Occasionally a second page turn follows quickly
          if (Math.random() < 0.35) {
            setTimeout(turnPage, 120 + Math.random() * 180);
          }
        }
        const interval = setInterval(turnPage, 3000 + Math.random() * 4000);
        turnPage(); // one immediately
        stopFn = () => clearInterval(interval);
      } catch(e) {}
    }

    /**
     * Hallway: distant footsteps — low-frequency thumps with slight reverb,
     * irregular timing so they feel like someone else walking, not a loop.
     */
    function hallway() {
      _stopAll();
      try {
        const ctx = _getCtx();
        function step() {
          const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
          const data = buf.getChannelData(0);
          for (let i = 0; i < data.length; i++) {
            const env = Math.exp(-i / (data.length * 0.3));
            data[i] = (Math.random() * 2 - 1) * env;
          }
          const src = ctx.createBufferSource();
          src.buffer = buf;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 180 + Math.random() * 80; // footstep = low thud
          const gain = ctx.createGain();
          gain.gain.value = 0.18 + Math.random() * 0.1;
          src.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          src.start();
          activeNodes.push(src);
        }
        // Walk pattern: 2-4 steps then a pause
        function walkCycle() {
          const stepCount = 2 + Math.floor(Math.random() * 3);
          let delay = 0;
          for (let i = 0; i < stepCount; i++) {
            setTimeout(step, delay);
            delay += 380 + Math.random() * 200;
          }
        }
        walkCycle();
        const interval = setInterval(walkCycle, 5000 + Math.random() * 4000);
        stopFn = () => clearInterval(interval);
      } catch(e) {}
    }

    function stop() { _stopAll(); }

    return { classroom, library, hallway, stop };
  })();

  return { play, stop, unlock, playStatic, TRACKS, Ambient,
    get _currentAudio() { return currentAudio; } };
})();
