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
   */
  function playStatic(intensity = 0.3) {
    // Lightweight noise burst using Web Audio API — no extra asset needed.
    try {
      const ctx = playStatic._ctx || (playStatic._ctx = new (window.AudioContext || window.webkitAudioContext)());
      const bufferSize = ctx.sampleRate * 0.4; // 400ms burst
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * intensity;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = intensity * 0.4;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch (e) {
      // Web Audio unsupported — silently skip, not critical
    }
  }

  return { play, stop, unlock, playStatic, TRACKS };
})();
