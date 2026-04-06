/* ================================================
   SOUND MANAGER
   Web Audio API - No external files needed!
   ================================================ */

const SoundManager = (() => {

  let audioCtx  = null;
  let masterGain = null;
  let isMuted   = false;
  let isReady   = false;

  // Load mute preference
  const saved = localStorage.getItem('gamezone_sound');
  isMuted = saved === 'muted';

  // Init Audio Context (must be triggered by user gesture)
  function init() {
    if (isReady) return;
    try {
      audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = isMuted ? 0 : 0.4;
      masterGain.connect(audioCtx.destination);
      isReady = true;
    } catch (e) {
      console.warn('SoundManager: Web Audio not supported');
    }
  }

  // Resume context (needed on some browsers)
  function resume() {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // Core: Play a tone
  function playTone(frequency, duration, type = 'sine', volume = 0.3, delay = 0) {
    if (!isReady || isMuted) return;
    resume();

    try {
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(masterGain);

      osc.type      = type;
      osc.frequency.setValueAtTime(frequency, audioCtx.currentTime + delay);

      gain.gain.setValueAtTime(0, audioCtx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);

      osc.start(audioCtx.currentTime + delay);
      osc.stop(audioCtx.currentTime + delay + duration);
    } catch (e) { /* silent fail */ }
  }

  // Core: Play noise burst (for shooting/explosions)
  function playNoise(duration = 0.1, volume = 0.2) {
    if (!isReady || isMuted) return;
    resume();

    try {
      const bufferSize = audioCtx.sampleRate * duration;
      const buffer     = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data       = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1);
      }

      const source = audioCtx.createBufferSource();
      const gain   = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();

      source.buffer = buffer;
      filter.type   = 'bandpass';
      filter.frequency.value = 800;

      source.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      source.start();
      source.stop(audioCtx.currentTime + duration);
    } catch (e) { /* silent fail */ }
  }

  /* ---- NAMED SOUND EFFECTS ---- */

  // UI click
  function click() {
    playTone(800, 0.08, 'sine', 0.2);
  }

  // Navigation / page change
  function navigate() {
    playTone(400, 0.06, 'sine', 0.15);
    playTone(600, 0.08, 'sine', 0.15, 0.06);
  }

  // Game start
  function gameStart() {
    playTone(300, 0.1,  'square', 0.2, 0.0);
    playTone(400, 0.1,  'square', 0.2, 0.1);
    playTone(600, 0.15, 'square', 0.25, 0.2);
    playTone(800, 0.2,  'square', 0.25, 0.35);
  }

  // Score / point earned
  function score() {
    playTone(600, 0.08, 'sine', 0.2);
    playTone(900, 0.1,  'sine', 0.2, 0.08);
  }

  // Card flip (memory game)
  function cardFlip() {
    playTone(500, 0.08, 'triangle', 0.2);
  }

  // Card match success
  function cardMatch() {
    playTone(500, 0.08, 'sine', 0.2, 0.0);
    playTone(700, 0.08, 'sine', 0.2, 0.08);
    playTone(900, 0.12, 'sine', 0.25, 0.16);
  }

  // Card mismatch
  function cardMismatch() {
    playTone(300, 0.1, 'sawtooth', 0.2);
    playTone(200, 0.15, 'sawtooth', 0.2, 0.1);
  }

  // Correct answer
  function correct() {
    playTone(523, 0.1, 'sine', 0.2);
    playTone(659, 0.1, 'sine', 0.2, 0.1);
    playTone(784, 0.15, 'sine', 0.25, 0.2);
  }

  // Wrong answer
  function wrong() {
    playTone(300, 0.15, 'sawtooth', 0.25);
    playTone(200, 0.2,  'sawtooth', 0.2, 0.15);
  }

  // Game win / level complete
  function win() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((note, i) => {
      playTone(note, 0.15, 'sine', 0.3, i * 0.12);
    });
    playTone(1047, 0.4, 'sine', 0.35, 0.5);
  }

  // Game over / lose
  function gameOver() {
    playTone(400, 0.15, 'sawtooth', 0.3, 0.0);
    playTone(300, 0.15, 'sawtooth', 0.3, 0.15);
    playTone(200, 0.3,  'sawtooth', 0.3, 0.3);
  }

  // Button press (game action)
  function buttonPress() {
    playTone(440, 0.06, 'square', 0.15);
  }

  // Shoot (laser sound)
  function shoot() {
    playTone(800, 0.05, 'square', 0.2, 0);
    playTone(400, 0.1,  'square', 0.15, 0.05);
  }

  // Explosion
  function explosion() {
    playNoise(0.3, 0.4);
    playTone(150, 0.3, 'sawtooth', 0.3);
  }

  // Hit (enemy hit)
  function hit() {
    playNoise(0.1, 0.25);
    playTone(300, 0.1, 'square', 0.2);
  }

  // Move (sliding puzzle, etc)
  function move() {
    playTone(350, 0.06, 'triangle', 0.15);
  }

  // Tile slide
  function slide() {
    playTone(400, 0.08, 'triangle', 0.15);
    playTone(300, 0.06, 'triangle', 0.1, 0.06);
  }

  // Level up
  function levelUp() {
    playTone(523, 0.1, 'sine', 0.25, 0.0);
    playTone(784, 0.1, 'sine', 0.25, 0.1);
    playTone(1047, 0.2, 'sine', 0.3, 0.2);
  }

  // Countdown beep
  function beep() {
    playTone(880, 0.1, 'sine', 0.2);
  }

  // Timer warning (fast beeps)
  function timerWarning() {
    playTone(1000, 0.08, 'square', 0.2);
  }

  // Power up
  function powerUp() {
    for (let i = 0; i < 5; i++) {
      playTone(300 + i * 100, 0.08, 'sine', 0.2, i * 0.07);
    }
  }

  // New best score
  function newBest() {
    playTone(523, 0.1,  'sine', 0.3, 0.0);
    playTone(659, 0.1,  'sine', 0.3, 0.1);
    playTone(784, 0.1,  'sine', 0.3, 0.2);
    playTone(1047, 0.3, 'sine', 0.35, 0.3);
  }

  // Toggle mute
  function toggleMute() {
    isMuted = !isMuted;
    if (masterGain) {
      masterGain.gain.value = isMuted ? 0 : 0.4;
    }
    localStorage.setItem('gamezone_sound', isMuted ? 'muted' : 'on');
    return isMuted;
  }

  function getMuted() { return isMuted; }

  return {
    init,
    resume,
    toggleMute,
    getMuted,
    // All sounds
    click,
    navigate,
    gameStart,
    score,
    cardFlip,
    cardMatch,
    cardMismatch,
    correct,
    wrong,
    win,
    gameOver,
    buttonPress,
    shoot,
    explosion,
    hit,
    move,
    slide,
    levelUp,
    beep,
    timerWarning,
    powerUp,
    newBest
  };

})();