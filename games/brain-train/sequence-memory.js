/* ================================================
   SEQUENCE MEMORY
   Watch the pattern, then repeat it! (Simon Says)
   Category: Brain Train
   Controls: Mouse click (desktop) | Tap (mobile)
   ================================================ */

const SequenceMemory = (() => {

  /* ---------- CONFIG ---------- */
  const COLORS = [
    { id: 0, color: '#ff3232', glow: 'rgba(255,50,50,0.7)',   label: 'Red'    },
    { id: 1, color: '#00e676', glow: 'rgba(0,230,118,0.7)',   label: 'Green'  },
    { id: 2, color: '#00cfff', glow: 'rgba(0,207,255,0.7)',   label: 'Blue'   },
    { id: 3, color: '#ffd700', glow: 'rgba(255,215,0,0.7)',   label: 'Yellow' }
  ];

  const CONFIG = {
    startLength:   3,
    addPerRound:   1,
    showSpeed:     600,  // ms per color flash
    minShowSpeed:  250,  // minimum ms (gets faster each round)
    speedDecrement:20,   // ms faster each round
    pointsPerStep: 10
  };

  /* ---------- STATE ---------- */
  let container    = null;
  let gameEl       = null;
  let sequence     = [];
  let playerInput  = [];
  let round        = 0;
  let score        = 0;
  let isPlaying    = false;
  let isWatching   = false;
  let showSpeed    = CONFIG.showSpeed;
  let isRunning    = false;
  let padsEl       = [];

  /* ================================================
     REGISTER
  ================================================ */
  GameRegistry.register({
    id:          'sequence-memory',
    title:       'Sequence Memory',
    category:    'brain-train',
    description: 'Watch the color sequence and repeat it! How far can you go?',
    emoji:       '🎯',
    difficulty:  'medium',
    controls:    { dpad: false, actions: false, center: false },
    init:        (c) => SequenceMemory.start(c),
    destroy:     () => SequenceMemory.destroy()
  });

  /* ================================================
     START
  ================================================ */
  function start(cont) {
    container = cont;
    showStartScreen();
  }

  /* ================================================
     START SCREEN
  ================================================ */
  function showStartScreen() {
    cleanup();

    gameEl = document.createElement('div');
    gameEl.className = 'sm-wrap';
    gameEl.innerHTML = `
      <div class="sm-start">
        <div class="sm-logo">🎯</div>
        <h2 class="sm-heading">Sequence Memory</h2>
        <p class="sm-sub">Watch the pattern, then repeat it!</p>
        <div class="sm-preview-pads">
          ${COLORS.map(c => `
            <div class="sm-prev-pad"
              style="background:${c.color};box-shadow:0 0 15px ${c.glow}">
            </div>
          `).join('')}
        </div>
        <div class="sm-instructions">
          <div class="sm-inst-item">
            <span class="sm-inst-icon">👁️</span>
            <span>Watch the flashing sequence</span>
          </div>
          <div class="sm-inst-item">
            <span class="sm-inst-icon">🎯</span>
            <span>Click the pads in the same order</span>
          </div>
          <div class="sm-inst-item">
            <span class="sm-inst-icon">🚀</span>
            <span>Sequence gets longer each round!</span>
          </div>
        </div>
        <button class="sm-start-btn" id="sm-start-btn">
          <i class="fas fa-play"></i> Start Game
        </button>
      </div>`;

    container.appendChild(gameEl);

    gameEl.querySelector('#sm-start-btn').addEventListener('click', () => {
      SoundManager.click();
      startGame();
    });
  }

  /* ================================================
     START GAME
  ================================================ */
  function startGame() {
    cleanup();
    isRunning   = true;
    sequence    = [];
    playerInput = [];
    round       = 0;
    score       = 0;
    showSpeed   = CONFIG.showSpeed;

    gameEl = document.createElement('div');
    gameEl.className = 'sm-wrap';
    gameEl.innerHTML = `
      <div class="sm-game">

        <!-- HUD -->
        <div class="sm-hud">
          <div class="sm-hud-item">
            <span class="sm-hud-label">Round</span>
            <span class="sm-hud-val" id="sm-round">1</span>
          </div>
          <div class="sm-hud-item">
            <span class="sm-hud-label">Score</span>
            <span class="sm-hud-val" id="sm-score">0</span>
          </div>
          <div class="sm-hud-item">
            <span class="sm-hud-label">Sequence</span>
            <span class="sm-hud-val" id="sm-seq-len">0</span>
          </div>
          <div class="sm-hud-item">
            <span class="sm-hud-label">Best</span>
            <span class="sm-hud-val" id="sm-best">
              ${ScoreManager.getBestScore('sequence-memory')}
            </span>
          </div>
        </div>

        <!-- Status Message -->
        <div class="sm-status" id="sm-status">
          <span id="sm-status-text">Get Ready...</span>
        </div>

        <!-- Progress dots -->
        <div class="sm-progress-dots" id="sm-dots"></div>

        <!-- Color Pads -->
        <div class="sm-pads" id="sm-pads">
          ${COLORS.map(c => `
            <button
              class="sm-pad"
              id="sm-pad-${c.id}"
              data-id="${c.id}"
              style="
                --pad-color: ${c.color};
                --pad-glow: ${c.glow}
              "
              disabled>
              <span class="sm-pad-inner"></span>
            </button>
          `).join('')}
        </div>

        <!-- Keyboard hints (desktop only) -->
        <div class="sm-keyboard-hints desktop-only">
          <span>Keys: <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd></span>
        </div>

      </div>`;

    container.appendChild(gameEl);

    // Store pad elements
    padsEl = Array.from(gameEl.querySelectorAll('.sm-pad'));

    // Bind pad clicks
    padsEl.forEach(pad => {
      const id = parseInt(pad.dataset.id);

      pad.addEventListener('click', () => handlePadClick(id));

      pad.addEventListener('touchstart', e => {
        e.preventDefault();
        handlePadClick(id);
      }, { passive: false });
    });

    // Keyboard support
    ControlManager.on('keydown', 'seq-mem', key => {
      if (!isRunning || isWatching) return;
      const map = { '1': 0, '2': 1, '3': 2, '4': 3 };
      if (map[key] !== undefined) handlePadClick(map[key]);
    });

    // Start first round after short delay
    setTimeout(() => nextRound(), 1000);
  }

  /* ================================================
     NEXT ROUND
  ================================================ */
  function nextRound() {
    if (!isRunning) return;

    round++;
    playerInput = [];

    // Make sequence faster as rounds increase
    showSpeed = Math.max(
      CONFIG.minShowSpeed,
      CONFIG.showSpeed - (round - 1) * CONFIG.speedDecrement
    );

    // Add new step to sequence
    const newStep = Math.floor(Math.random() * COLORS.length);
    sequence.push(newStep);

    // Update HUD
    const roundEl  = gameEl?.querySelector('#sm-round');
    const seqEl    = gameEl?.querySelector('#sm-seq-len');
    if (roundEl) roundEl.textContent = round;
    if (seqEl)   seqEl.textContent   = sequence.length;

    // Update progress dots
    updateProgressDots();

    // Set status to watching
    setStatus('👁️ Watch carefully...', 'watching');
    disablePads();
    isWatching = true;

    // Play sequence
    playSequence(() => {
      isWatching = false;
      setStatus('🎯 Your turn! Repeat the sequence', 'player');
      enablePads();
    });
  }

  /* ================================================
     PLAY SEQUENCE (show flashes)
  ================================================ */
  // function playSequence(onComplete) {
  //   let i = 0;

  //   const showNext = () => {
  //     if (!isRunning) return;
  //     if (i >= sequence.length) {
  //       setTimeout(onComplete, 400);
  //       return;
  //     }

  //     const colorId = sequence[i];
  //     flashPad(colorId, showSpeed * 0.7);
  //     i++;
  //     setTimeout(showNext, showSpeed);
  //   };

  //   // Small delay before starting
  //   setTimeout(showNext, 500);
  // }

  function playSequence(onComplete, force = false) {
  let i = 0;

  const showNext = () => {
    if (!isRunning && !force) return; // 👈 FIX

    if (i >= sequence.length) {
      setTimeout(onComplete, 400);
      return;
    }

    const colorId = sequence[i];
    flashPad(colorId, showSpeed * 0.7);
    i++;
    setTimeout(showNext, showSpeed);
  };

  setTimeout(showNext, 500);
}

  /* ================================================
     FLASH A PAD
  ================================================ */
  function flashPad(colorId, duration = 400) {
    const pad = gameEl?.querySelector(`#sm-pad-${colorId}`);
    if (!pad) return;

    pad.classList.add('sm-pad-flash');

    // Play matching tone for each color
    const tones = [261, 329, 392, 523];
    SoundManager.beep && playColorTone(tones[colorId]);

    setTimeout(() => {
      pad.classList.remove('sm-pad-flash');
    }, duration);
  }

  function playColorTone(freq) {
    // Direct tone play for color feedback
    if (!SoundManager.getMuted()) {
      try {
        const ctx  = new (window.AudioContext || window.webkitAudioContext)();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } catch (e) { /* silent */ }
    }
  }

  /* ================================================
     HANDLE PAD CLICK
  ================================================ */
  function handlePadClick(colorId) {
    if (!isRunning || isWatching) return;

    // Flash the clicked pad
    flashPad(colorId, 200);

    playerInput.push(colorId);
    const idx = playerInput.length - 1;

    // Update progress dots
    updateProgressDots(idx);

    // Check if correct
    if (playerInput[idx] !== sequence[idx]) {
      // WRONG!
      handleWrong();
      return;
    }

    // Check if completed sequence
    if (playerInput.length === sequence.length) {
      handleRoundComplete();
    }
  }

  /* ================================================
     ROUND COMPLETE
  ================================================ */
  function handleRoundComplete() {
    disablePads();

    const points = sequence.length * CONFIG.pointsPerStep * round;
    score += points;

    SoundManager.correct();
    setStatus(`✅ Correct! +${points} points`, 'correct');

    const scoreEl = gameEl?.querySelector('#sm-score');
    if (scoreEl) scoreEl.textContent = score;

    App.updateScoreDisplay(score, ScoreManager.getBestScore('sequence-memory'));

    // Level up every 3 rounds
    if (round % 3 === 0) {
      SoundManager.levelUp();
      App.showToast(`🚀 Level Up! Round ${round + 1}`, 'success', 1500);
    }

    setTimeout(() => {
      if (isRunning) nextRound();
    }, 1200);
  }

  /* ================================================
     HANDLE WRONG
  ================================================ */
  function handleWrong() {
    isRunning = false;
    disablePads();

    SoundManager.wrong();
    setStatus(`❌ Wrong! Sequence was ${sequence.length} steps`);
    setStatus(`❌ Wrong! You reached round ${round}`, 'wrong');

    // Flash all pads red to show failure
    padsEl.forEach(pad => {
      pad.classList.add('sm-pad-error');
      setTimeout(() => pad.classList.remove('sm-pad-error'), 800);
    });

    // Show the correct sequence briefly
    setTimeout(() => {
      if (gameEl) {
        setStatus('👁️ Correct sequence was...', 'watching');
        playSequence(() => {
          setTimeout(() => {
            App.showGameResult(score, false);
          }, 500);
        });
      }
    }, 1000);
    enablePads();
  }

  /* ================================================
     PROGRESS DOTS
  ================================================ */
  function updateProgressDots(completedIdx = -1) {
    const dotsEl = gameEl?.querySelector('#sm-dots');
    if (!dotsEl) return;

    dotsEl.innerHTML = sequence.map((_, i) => {
      let cls = 'sm-dot';
      if (i < completedIdx)       cls += ' sm-dot-done';
      else if (i === completedIdx) cls += ' sm-dot-current';
      return `<div class="${cls}"></div>`;
    }).join('');
  }

  /* ================================================
     STATUS MESSAGE
  ================================================ */
  function setStatus(msg, type) {
    const el = gameEl?.querySelector('#sm-status-text');
    const wrap = gameEl?.querySelector('#sm-status');
    if (el)   el.textContent = msg;
    if (wrap) {
      wrap.className = `sm-status sm-status-${type}`;
    }
  }

  /* ================================================
     ENABLE / DISABLE PADS
  ================================================ */
  function enablePads() {
    padsEl.forEach(pad => {
      pad.disabled = false;
      pad.classList.add('sm-pad-active');
    });
  }

  function disablePads() {
    padsEl.forEach(pad => {
      pad.disabled = true;
      pad.classList.remove('sm-pad-active');
    });
  }

  /* ================================================
     CLEANUP
  ================================================ */
  function cleanup() {
    isRunning  = false;
    isWatching = false;
    padsEl     = [];
    ControlManager.off('keydown', 'seq-mem');
    if (gameEl && gameEl.parentNode) {
      gameEl.parentNode.removeChild(gameEl);
    }
    gameEl = null;
  }

  function destroy() { cleanup(); }

  /* ================================================
     STYLES
  ================================================ */
  const style = document.createElement('style');
  style.textContent = `

    /* Wrapper */
    .sm-wrap {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      overflow-y: auto;
    }

    /* ---- START SCREEN ---- */
    .sm-start {
      text-align: center;
      max-width: 420px;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }
    .sm-logo {
      font-size: 3.5rem;
      filter: drop-shadow(0 0 15px var(--primary));
      animation: floatOrb 3s ease-in-out infinite;
    }
    .sm-heading {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(1.3rem,4vw,2rem);
      font-weight: 900;
      color: var(--primary);
      text-shadow: var(--glow);
    }
    .sm-sub {
      color: var(--text2);
      font-size: 0.9rem;
    }

    /* Preview pads */
    .sm-preview-pads {
      display: flex;
      gap: 12px;
      justify-content: center;
    }
    .sm-prev-pad {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      opacity: 0.7;
      animation: smPrevPulse 2s ease-in-out infinite;
    }
    .sm-prev-pad:nth-child(1) { animation-delay: 0s; }
    .sm-prev-pad:nth-child(2) { animation-delay: 0.3s; }
    .sm-prev-pad:nth-child(3) { animation-delay: 0.6s; }
    .sm-prev-pad:nth-child(4) { animation-delay: 0.9s; }

    /* Instructions */
    .sm-instructions {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      width: 100%;
    }
    .sm-inst-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0.7rem 1rem;
      background: var(--bg3);
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 0.85rem;
      color: var(--text2);
      text-align: left;
    }
    .sm-inst-icon { font-size: 1.1rem; flex-shrink: 0; }

    /* Start button */
    .sm-start-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0.9rem 2.5rem;
      background: var(--btn-bg);
      color: var(--btn-text);
      border: none;
      border-radius: 12px;
      font-family: 'Orbitron', sans-serif;
      font-size: 0.9rem;
      font-weight: 700;
      letter-spacing: 1px;
      transition: all 0.3s;
      box-shadow: var(--glow);
      cursor: pointer;
    }
    .sm-start-btn:hover {
      transform: translateY(-3px);
      box-shadow: var(--glow2);
    }

    /* ---- GAME SCREEN ---- */
    .sm-game {
      width: 100%;
      max-width: 500px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.85rem;
    }

    /* HUD */
    .sm-hud {
      display: flex;
      width: 100%;
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    .sm-hud-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.6rem 0.25rem;
      border-right: 1px solid var(--border);
    }
    .sm-hud-item:last-child { border-right: none; }
    .sm-hud-label {
      font-size: 0.6rem;
      color: var(--text3);
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .sm-hud-val {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(0.85rem,2.5vw,1.1rem);
      font-weight: 700;
      color: var(--primary);
    }

    /* Status */
    .sm-status {
      width: 100%;
      padding: 0.7rem 1rem;
      border-radius: 10px;
      text-align: center;
      font-size: 0.9rem;
      font-weight: 600;
      letter-spacing: 0.5px;
      border: 1px solid var(--border);
      background: var(--bg2);
      transition: all 0.3s;
    }
    .sm-status-watching {
      background: rgba(0,207,255,0.08);
      border-color: rgba(0,207,255,0.3);
      color: #00cfff;
    }
    .sm-status-player {
      background: rgba(0,230,118,0.08);
      border-color: rgba(0,230,118,0.3);
      color: #00e676;
      animation: smStatusPulse 1.5s ease-in-out infinite;
    }
    .sm-status-correct {
      background: rgba(0,230,118,0.12);
      border-color: rgba(0,230,118,0.4);
      color: #00e676;
    }
    .sm-status-wrong {
      background: rgba(255,50,50,0.12);
      border-color: rgba(255,50,50,0.4);
      color: #ff3232;
    }

    /* Progress Dots */
    .sm-progress-dots {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: center;
      min-height: 14px;
    }
    .sm-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--bg3);
      border: 1px solid var(--border);
      transition: all 0.2s;
    }
    .sm-dot-done {
      background: var(--primary);
      border-color: var(--primary);
      box-shadow: var(--glow);
    }
    .sm-dot-current {
      background: var(--secondary);
      border-color: var(--secondary);
      box-shadow: 0 0 8px var(--secondary);
      transform: scale(1.3);
    }

    /* Color Pads */
    .sm-pads {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: clamp(10px,2vw,18px);
      width: 100%;
      max-width: 380px;
    }
    .sm-pad {
      aspect-ratio: 1;
      border-radius: 16px;
      border: 3px solid rgba(255,255,255,0.1);
      background: color-mix(in srgb, var(--pad-color) 25%, var(--bg2));
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
    }
    .sm-pad:disabled {
      cursor: default;
      opacity: 0.6;
    }
    .sm-pad-active {
      opacity: 1 !important;
      cursor: pointer;
    }
    .sm-pad-active:hover {
      transform: scale(1.04);
      border-color: var(--pad-color);
      box-shadow: 0 0 20px var(--pad-glow);
    }
    .sm-pad-active:active {
      transform: scale(0.95);
    }
    .sm-pad-inner {
      width: 40%;
      height: 40%;
      border-radius: 50%;
      background: var(--pad-color);
      opacity: 0.4;
      transition: all 0.15s;
    }

    /* Flash animation */
    .sm-pad-flash {
      background: var(--pad-color) !important;
      border-color: var(--pad-color) !important;
      box-shadow: 0 0 40px var(--pad-glow) !important;
      transform: scale(1.05) !important;
    }
    .sm-pad-flash .sm-pad-inner {
      opacity: 1 !important;
      transform: scale(1.2);
    }

    /* Error flash */
    .sm-pad-error {
      background: rgba(255,50,50,0.5) !important;
      border-color: #ff3232 !important;
      box-shadow: 0 0 30px rgba(255,50,50,0.8) !important;
      animation: smErrorShake 0.5s ease;
    }

    /* Keyboard hints */
    .desktop-only {
      display: none;
      color: var(--text3);
      font-size: 0.75rem;
      letter-spacing: 1px;
    }
    kbd {
      display: inline-block;
      padding: 2px 7px;
      background: var(--bg3);
      border: 1px solid var(--border);
      border-radius: 5px;
      font-size: 0.75rem;
      color: var(--text2);
      font-family: monospace;
      margin: 0 2px;
    }

    @media (min-width: 1025px) {
      .desktop-only { display: block; }
    }

    /* Animations */
    @keyframes smPrevPulse {
      0%, 100% { transform: scale(1);    opacity: 0.7; }
      50%      { transform: scale(1.15); opacity: 1;   }
    }
    @keyframes smStatusPulse {
      0%, 100% { opacity: 1;   }
      50%      { opacity: 0.7; }
    }
    @keyframes smErrorShake {
      0%,100% { transform: translateX(0); }
      20%     { transform: translateX(-8px); }
      40%     { transform: translateX(8px); }
      60%     { transform: translateX(-5px); }
      80%     { transform: translateX(5px); }
    }

    /* Mobile adjustments */
    @media (max-width: 600px) {
      .sm-wrap { padding: 0.5rem; align-items: flex-start; }
      .sm-game { gap: 0.6rem; }
      .sm-pads { max-width: 320px; gap: 10px; }
      .sm-pad  { border-radius: 12px; }
    }
    @media (max-width: 380px) {
      .sm-pads { max-width: 280px; }
    }
  `;
  document.head.appendChild(style);

  return { start, destroy };

})();
