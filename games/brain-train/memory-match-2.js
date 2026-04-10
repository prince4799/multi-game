/* ================================================
   MEMORY MATCH
   Card flip memory game with level progression
   Category: Brain Train
   ================================================ */

(function () {

  'use strict';

  // ----------------------------------------------------------------
  //  LEVEL CONFIG
  // ----------------------------------------------------------------
  const LEVELS = [
    {
      name:       'Level 1',
      cols:       4,
      rows:       3,
      timeLimit:  60,
      basePoints: 500,
      minMoves:   6,   // minimum possible moves (= pairs)
      hint:       'Match all 6 pairs!'
    },
    {
      name:       'Level 2',
      cols:       4,
      rows:       4,
      timeLimit:  90,
      basePoints: 750,
      minMoves:   8,
      hint:       'Match all 8 pairs!'
    },
    {
      name:       'Level 3',
      cols:       5,
      rows:       4,
      timeLimit:  120,
      basePoints: 1000,
      minMoves:   10,
      hint:       'Match all 10 pairs — final level!'
    }
  ];

  // Card emoji pool — enough for max 10 pairs
  const CARD_EMOJIS = [
    '🐶','🐱','🚀','🌙','⭐','🔥',
    '💎','🎮','🏆','🎯','🌈','🦊',
    '🐸','🍕','🎵','🌺','🦋','❄️',
    '🎪','🍀'
  ];

  // ----------------------------------------------------------------
  //  STATE
  // ----------------------------------------------------------------
  let container     = null;
  let gameEl        = null;
  let currentLevel  = 0;
  let totalScore    = 0;
  let isRunning     = false;
  let cards         = [];         // card data array
  let flipped       = [];         // indices of currently flipped (unmatched) cards
  let matched       = new Set();  // indices of matched cards
  let moves         = 0;
  let mistakes      = 0;
  let timeLeft      = 0;
  let timerInterval = null;
  let lockBoard     = false;      // prevent clicks during flip animation
  let levelScore    = 0;

  // ----------------------------------------------------------------
  //  REGISTER
  // ----------------------------------------------------------------
  GameRegistry.register({
    id:          'memory-match-2',
    title:       'Memory Match 2',
    category:    'brain-train',
    description: 'Flip cards to find matching pairs. Train your memory across 3 levels!',
    emoji:       '🃏',
    difficulty:  'easy',
    controls:    { dpad: false, actions: false, center: false },
    version:     '1.0',
    init:        (c) => MemoryMatch.start(c),
    destroy:     () => MemoryMatch.destroy()
  });

  // ----------------------------------------------------------------
  //  PUBLIC
  // ----------------------------------------------------------------
  const MemoryMatch = {
    start(cont) {
      container    = cont;
      currentLevel = 0;
      totalScore   = 0;
      _injectStyles();
      _showLevelIntro(0);
    },
    destroy() {
      _cleanup();
    }
  };

  // ----------------------------------------------------------------
  //  LEVEL INTRO SCREEN
  // ----------------------------------------------------------------
  function _showLevelIntro(levelIdx) {
    _cleanup();
    isRunning = false;

    const lvl = LEVELS[levelIdx];

    gameEl = document.createElement('div');
    gameEl.className = 'mm-wrap';
    gameEl.innerHTML = `
      <div class="mm-intro">

        <!-- Progress dots -->
        <div class="mm-progress-dots">
          ${LEVELS.map((_, i) => `
            <div class="mm-dot ${i < levelIdx ? 'done' : ''} ${i === levelIdx ? 'active' : ''}">
              ${i < levelIdx ? '✓' : i + 1}
            </div>
          `).join('')}
        </div>

        <!-- Icon -->
        <div class="mm-intro-icon">🃏</div>

        <!-- Title -->
        <div class="mm-intro-level">${lvl.name}</div>
        <div class="mm-intro-title">Memory Match 2</div>

        <!-- Info cards -->
        <div class="mm-intro-stats">
          <div class="mm-istat">
            <span class="mm-istat-val">${lvl.cols +'x'+ lvl.rows}</span>
            <span class="mm-istat-lbl">Cards</span>
          </div>
          <div class="mm-istat">
            <span class="mm-istat-val">${lvl.minMoves}</span>
            <span class="mm-istat-lbl">Pairs</span>
          </div>
          <div class="mm-istat">
            <span class="mm-istat-val">${lvl.timeLimit}s</span>
            <span class="mm-istat-lbl">Time</span>
          </div>
        </div>

        <p class="mm-intro-hint">${lvl.hint}</p>

        ${totalScore > 0 ? `
          <div class="mm-running-score">
            Total Score So Far: <strong>${totalScore}</strong>
          </div>` : ''
        }

        <button class="mm-start-btn" id="mm-start-btn">
          <i class="fas fa-play"></i>
          ${levelIdx === 0 ? 'Start Game' : 'Start Level ' + (levelIdx + 1)}
        </button>

      </div>`;

    container.appendChild(gameEl);

    gameEl.querySelector('#mm-start-btn').addEventListener('click', () => {
      SoundManager.click();
      _startLevel(levelIdx);
    });
  }

  // ----------------------------------------------------------------
  //  START LEVEL
  // ----------------------------------------------------------------
  function _startLevel(levelIdx) {
    _cleanup();

    currentLevel = levelIdx;
    isRunning    = true;
    moves        = 0;
    mistakes     = 0;
    levelScore   = 0;
    flipped      = [];
    matched      = new Set();
    lockBoard    = false;

    const lvl   = LEVELS[levelIdx];
    timeLeft    = lvl.timeLimit;
    const pairs = (lvl.cols * lvl.rows) / 2;

    // Build shuffled card deck
    const pool    = [...CARD_EMOJIS].slice(0, pairs);
    const deck    = _shuffle([...pool, ...pool]);
    cards         = deck.map((emoji, i) => ({ id: i, emoji, matched: false }));

    // Build DOM
    gameEl = document.createElement('div');
    gameEl.className = 'mm-wrap';
    gameEl.innerHTML = `
      <div class="mm-game">

        <!-- Top HUD -->
        <div class="mm-hud">
          <div class="mm-hud-item">
            <span class="mm-hud-label">Level</span>
            <span class="mm-hud-val mm-hud-level">${levelIdx + 1}/${LEVELS.length}</span>
          </div>
          <div class="mm-hud-item">
            <span class="mm-hud-label">Moves</span>
            <span class="mm-hud-val" id="mm-moves">0</span>
          </div>
          <div class="mm-hud-item">
            <span class="mm-hud-label">Pairs</span>
            <span class="mm-hud-val">
              <span id="mm-pairs">0</span>/${pairs}
            </span>
          </div>
          <div class="mm-hud-item">
            <span class="mm-hud-label">Score</span>
            <span class="mm-hud-val mm-score-val" id="mm-score">${totalScore}</span>
          </div>
        </div>

        <!-- Timer bar -->
        <div class="mm-timer-wrap">
          <div class="mm-timer-bar" id="mm-timer-bar"></div>
          <span class="mm-timer-label" id="mm-timer-label">${lvl.timeLimit}s</span>
        </div>

        <!-- Progress dots -->
        <div class="mm-progress-dots mm-dots-ingame">
          ${LEVELS.map((_, i) => `
            <div class="mm-dot ${i < levelIdx ? 'done' : ''} ${i === levelIdx ? 'active' : ''}">
              ${i < levelIdx ? '✓' : i + 1}
            </div>
          `).join('')}
        </div>

        <!-- Card grid -->
        <div class="mm-grid mm-grid-${lvl.cols}col" id="mm-grid"
          style="grid-template-columns: repeat(${lvl.cols}, 1fr);">
        </div>

      </div>`;

    container.appendChild(gameEl);

    // Render cards
    _renderCards(lvl);

    // Start timer
    _startTimer(lvl);

    // Update platform score display
    App.updateScoreDisplay(totalScore, ScoreManager.getBestScore('memory-match-2'));
  }

  // ----------------------------------------------------------------
  //  RENDER CARDS
  // ----------------------------------------------------------------
  function _renderCards(lvl) {
    const grid = gameEl.querySelector('#mm-grid');
    if (!grid) return;

    grid.innerHTML = '';

    cards.forEach((card, idx) => {
      const el = document.createElement('div');
      el.className   = 'mm-card';
      el.dataset.idx = idx;
      el.innerHTML   = `
        <div class="mm-card-inner">
          <div class="mm-card-front">
            <span class="mm-card-emoji">${card.emoji}</span>
          </div>
          <div class="mm-card-back">
            <span class="mm-card-back-icon">🃏</span>
          </div>
        </div>`;

      el.addEventListener('click',      () => _onCardClick(idx));
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        _onCardClick(idx);
      }, { passive: false });

      grid.appendChild(el);
    });

    // Brief peek — show all cards for 1s then flip back
    setTimeout(() => {
      if (!isRunning) return;
      grid.querySelectorAll('.mm-card').forEach(el => el.classList.add('mm-peeked'));
      setTimeout(() => {
        if (!isRunning) return;
        grid.querySelectorAll('.mm-card').forEach(el => el.classList.remove('mm-peeked'));
        lockBoard = false;
      }, 900);
    }, 200);

    lockBoard = true; // locked during peek
  }

  // ----------------------------------------------------------------
  //  CARD CLICK
  // ----------------------------------------------------------------
  function _onCardClick(idx) {
    if (!isRunning)           return;
    if (lockBoard)            return;
    if (matched.has(idx))     return;
    if (flipped.includes(idx)) return;
    if (flipped.length >= 2)  return;

    SoundManager.buttonPress();

    // Flip card
    const cardEl = _getCardEl(idx);
    if (cardEl) cardEl.classList.add('mm-flipped');
    flipped.push(idx);

    if (flipped.length === 2) {
      moves++;
      _updateHUD();
      _checkMatch();
    }
  }

  // ----------------------------------------------------------------
  //  CHECK MATCH
  // ----------------------------------------------------------------
  function _checkMatch() {
    const [a, b] = flipped;
    const match  = cards[a].emoji === cards[b].emoji;

    lockBoard = true;

    if (match) {
      // ✅ Match!
      SoundManager.correct();

      setTimeout(() => {
        if (!isRunning) return;

        matched.add(a);
        matched.add(b);

        const elA = _getCardEl(a);
        const elB = _getCardEl(b);
        if (elA) elA.classList.add('mm-matched');
        if (elB) elB.classList.add('mm-matched');

        flipped    = [];
        lockBoard  = false;

        _updateHUD();
        _showFloatingText(elA, '+Match!', '#00e676');

        // Check level complete
        if (matched.size === cards.length) {
          setTimeout(_onLevelComplete, 400);
        }
      }, 350);

    } else {
      // ❌ No match
      mistakes++;
      SoundManager.wrong();

      const elA = _getCardEl(a);
      const elB = _getCardEl(b);
      if (elA) elA.classList.add('mm-wrong');
      if (elB) elB.classList.add('mm-wrong');

      setTimeout(() => {
        if (!isRunning) return;

        if (elA) { elA.classList.remove('mm-flipped', 'mm-wrong'); }
        if (elB) { elB.classList.remove('mm-flipped', 'mm-wrong'); }

        flipped   = [];
        lockBoard = false;
      }, 900);
    }
  }

  // ----------------------------------------------------------------
  //  TIMER
  // ----------------------------------------------------------------
  function _startTimer(lvl) {
    clearInterval(timerInterval);

    const bar   = gameEl?.querySelector('#mm-timer-bar');
    const label = gameEl?.querySelector('#mm-timer-label');

    if (bar) {
      bar.style.transition = 'none';
      bar.style.width      = '100%';
      void bar.offsetWidth;
      bar.style.transition = `width ${lvl.timeLimit}s linear`;
      bar.style.width      = '0%';
    }

    timerInterval = setInterval(() => {
      if (!isRunning) return;
      timeLeft--;

      if (label) label.textContent = `${timeLeft}s`;

      if (bar) {
        bar.style.background = timeLeft <= 10
          ? 'var(--accent)'
          : timeLeft <= 20
            ? '#ff9500'
            : 'var(--primary)';
      }

      if (timeLeft <= 5 && timeLeft > 0) {
        SoundManager.timerWarning();
      }

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        _onTimeout();
      }
    }, 1000);
  }

  // ----------------------------------------------------------------
  //  TIMEOUT
  // ----------------------------------------------------------------
  function _onTimeout() {
    if (!isRunning) return;
    isRunning = false;

    App.showToast('⏰ Time\'s up!', 'error', 2000);
    _showOverlay('timeout');
  }

  // ----------------------------------------------------------------
  //  LEVEL COMPLETE
  // ----------------------------------------------------------------
  function _onLevelComplete() {
    if (!isRunning) return;
    isRunning = false;
    clearInterval(timerInterval);

    const lvl = LEVELS[currentLevel];

    // Calculate level score
    const timeBonus    = timeLeft * 10;
    const perfectBonus = mistakes === 0 ? 300 : 0;
    const movePenalty  = Math.max(0, (moves - lvl.minMoves) * 5);
    levelScore         = Math.max(0, lvl.basePoints + timeBonus + perfectBonus - movePenalty);
    totalScore        += levelScore;

    SoundManager.win();
    App.updateScoreDisplay(totalScore, ScoreManager.getBestScore('memory-match-2'));

    const isLast = currentLevel === LEVELS.length - 1;

    if (isLast) {
      // All levels done — show final result
      ScoreManager.submitScore('memory-match-2', totalScore);
      setTimeout(() => {
        App.showGameResult(totalScore, true);
      }, 600);
    } else {
      // Show level complete overlay then advance
      _showLevelCompleteOverlay(levelScore, perfectBonus > 0);
    }
  }

  // ----------------------------------------------------------------
  //  LEVEL COMPLETE OVERLAY
  // ----------------------------------------------------------------
  function _showLevelCompleteOverlay(score, isPerfect) {
    const existing = gameEl?.querySelector('#mm-level-overlay');
    if (existing) existing.remove();

    const nextLvl  = currentLevel + 1;
    const overlay  = document.createElement('div');
    overlay.id     = 'mm-level-overlay';
    overlay.className = 'mm-level-overlay';

    overlay.innerHTML = `
      <div class="mm-level-overlay-box">

        <!-- Animated checkmark -->
        <div class="mm-check-wrap">
          <div class="mm-check">✓</div>
        </div>

        <div class="mm-lo-level">LEVEL ${currentLevel + 1} COMPLETE!</div>

        ${isPerfect ? '<div class="mm-lo-perfect">⭐ PERFECT — No Mistakes! +300</div>' : ''}

        <!-- Score breakdown -->
        <div class="mm-lo-breakdown">
          <div class="mm-lo-row">
            <span>Base Score</span>
            <span class="mm-lo-pts">+${LEVELS[currentLevel].basePoints}</span>
          </div>
          <div class="mm-lo-row">
            <span>Time Bonus</span>
            <span class="mm-lo-pts">+${timeLeft * 10}</span>
          </div>
          ${isPerfect ? `
          <div class="mm-lo-row">
            <span>Perfect Bonus</span>
            <span class="mm-lo-pts mm-lo-perfect-pts">+300</span>
          </div>` : ''}
          <div class="mm-lo-row mm-lo-total">
            <span>Level Score</span>
            <span class="mm-lo-pts">${score}</span>
          </div>
        </div>

        <div class="mm-lo-total-score">
          Total: <strong>${totalScore}</strong>
        </div>

        <!-- Progress dots -->
        <div class="mm-progress-dots">
          ${LEVELS.map((_, i) => `
            <div class="mm-dot ${i <= currentLevel ? 'done' : ''} ${i === nextLvl ? 'next' : ''}">
              ${i <= currentLevel ? '✓' : i + 1}
            </div>
          `).join('')}
        </div>

        <div class="mm-lo-next">
          Get ready for Level ${nextLvl + 1}...
        </div>

        <!-- Auto-progress bar -->
        <div class="mm-lo-progress-wrap">
          <div class="mm-lo-progress-bar" id="mm-lo-bar"></div>
        </div>

        <button class="mm-lo-skip-btn" id="mm-lo-skip">
          Next Level <i class="fas fa-arrow-right"></i>
        </button>

      </div>`;

    gameEl.appendChild(overlay);

    // Animate progress bar over 2.5s then auto-advance
    const bar = overlay.querySelector('#mm-lo-bar');
    if (bar) {
      requestAnimationFrame(() => {
        bar.style.transition = 'width 2.5s linear';
        bar.style.width      = '100%';
      });
    }

    // Skip button
    overlay.querySelector('#mm-lo-skip').addEventListener('click', () => {
      SoundManager.click();
      _advanceLevel();
    });

    // Auto advance after 2.8s
    setTimeout(() => {
      _advanceLevel();
    }, 2800);
  }

  function _advanceLevel() {
    // Guard: only advance once
    const overlay = gameEl?.querySelector('#mm-level-overlay');
    if (!overlay) return;
    overlay.remove();
    _showLevelIntro(currentLevel + 1);
  }

  // ----------------------------------------------------------------
  //  TIMEOUT OVERLAY
  // ----------------------------------------------------------------
  function _showOverlay(type) {
    const existing = gameEl?.querySelector('#mm-level-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id    = 'mm-level-overlay';
    overlay.className = 'mm-level-overlay';

    overlay.innerHTML = `
      <div class="mm-level-overlay-box">
        <div class="mm-lo-timeout-icon">⏰</div>
        <div class="mm-lo-level">TIME'S UP!</div>
        <p class="mm-lo-next" style="margin-top:8px">
          You matched ${matched.size / 2} of
          ${cards.length / 2} pairs.
        </p>
        <div class="mm-lo-total-score">
          Total Score: <strong>${totalScore}</strong>
        </div>
        <div class="mm-lo-actions">
          <button class="mm-lo-skip-btn" id="mm-retry-btn">
            <i class="fas fa-redo"></i> Retry Level
          </button>
          <button class="mm-lo-home-btn" id="mm-home-btn">
            <i class="fas fa-home"></i> Quit
          </button>
        </div>
      </div>`;

    gameEl.appendChild(overlay);

    overlay.querySelector('#mm-retry-btn').addEventListener('click', () => {
      SoundManager.click();
      totalScore = Math.max(0, totalScore - levelScore);
      _startLevel(currentLevel);
    });

    overlay.querySelector('#mm-home-btn').addEventListener('click', () => {
      SoundManager.click();
      ScoreManager.submitScore('memory-match-2', totalScore);
      App.showGameResult(totalScore, false);
    });
  }

  // ----------------------------------------------------------------
  //  HUD UPDATE
  // ----------------------------------------------------------------
  function _updateHUD() {
    const movesEl = gameEl?.querySelector('#mm-moves');
    const pairsEl = gameEl?.querySelector('#mm-pairs');
    const scoreEl = gameEl?.querySelector('#mm-score');

    if (movesEl) movesEl.textContent = moves;
    if (pairsEl) pairsEl.textContent = matched.size / 2;
    if (scoreEl) scoreEl.textContent = totalScore;

    App.updateScoreDisplay(totalScore, ScoreManager.getBestScore('memory-match-2'));
  }

  // ----------------------------------------------------------------
  //  FLOATING TEXT
  // ----------------------------------------------------------------
  function _showFloatingText(el, text, color) {
    if (!el || !gameEl) return;
    const rect    = el.getBoundingClientRect();
    const wrapRect = gameEl.getBoundingClientRect();
    const float   = document.createElement('div');
    float.className = 'mm-float-text';
    float.textContent = text;
    float.style.cssText = `
      left:  ${rect.left - wrapRect.left + rect.width / 2}px;
      top:   ${rect.top  - wrapRect.top}px;
      color: ${color};`;
    gameEl.appendChild(float);
    setTimeout(() => float.remove(), 900);
  }

  // ----------------------------------------------------------------
  //  HELPERS
  // ----------------------------------------------------------------
  function _getCardEl(idx) {
    return gameEl?.querySelector(`[data-idx="${idx}"]`);
  }

  function _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function _cleanup() {
    clearInterval(timerInterval);
    isRunning = false;
    if (gameEl && gameEl.parentNode) {
      gameEl.parentNode.removeChild(gameEl);
    }
    gameEl = null;
  }

  // ----------------------------------------------------------------
  //  STYLES
  // ----------------------------------------------------------------
  function _injectStyles() {
    if (document.getElementById('mm-styles')) return;
    const style = document.createElement('style');
    style.id    = 'mm-styles';
    style.textContent = `

    /* ---- WRAP ---- */
    .mm-wrap {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      overflow-y: auto; padding: 0.5rem;
      box-sizing: border-box;
    }

    /* ====================================================
       INTRO SCREEN
    ==================================================== */
    .mm-intro {
      text-align: center;
      max-width: 420px; width: 100%;
      display: flex; flex-direction: column;
      align-items: center; gap: 1rem;
      padding: 1rem 0;
    }
    .mm-intro-icon {
      font-size: clamp(3rem, 10vw, 4.5rem);
      filter: drop-shadow(0 0 18px var(--primary));
      animation: floatOrb 3s ease-in-out infinite;
    }
    .mm-intro-level {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(0.75rem, 2vw, 0.9rem);
      color: var(--text3);
      letter-spacing: 3px;
      text-transform: uppercase;
    }
    .mm-intro-title {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(1.4rem, 4vw, 2rem);
      font-weight: 900;
      color: var(--primary);
      text-shadow: var(--glow);
      margin-top: -0.5rem;
    }
    .mm-intro-stats {
      display: flex; gap: 1rem;
      justify-content: center;
    }
    .mm-istat {
      display: flex; flex-direction: column;
      align-items: center; gap: 3px;
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 0.6rem 1.1rem;
    }
    .mm-istat-val {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(1.1rem, 3vw, 1.4rem);
      font-weight: 900;
      color: var(--primary);
    }
    .mm-istat-lbl {
      font-size: 0.7rem;
      color: var(--text3);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .mm-intro-hint {
      color: var(--text2);
      font-size: 0.88rem;
      margin: 0;
    }
    .mm-running-score {
      background: var(--bg2);
      border: 1px solid var(--border2);
      border-radius: 10px;
      padding: 0.5rem 1.2rem;
      color: var(--primary);
      font-size: 0.9rem;
      font-family: 'Rajdhani', sans-serif;
    }
    .mm-start-btn {
      padding: 0.85rem 2.5rem;
      background: var(--btn-bg);
      color: var(--btn-text);
      border: none; border-radius: 12px;
      font-family: 'Orbitron', sans-serif;
      font-size: 0.9rem; font-weight: 700;
      letter-spacing: 1px;
      display: flex; align-items: center; gap: 10px;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: var(--glow);
      touch-action: manipulation;
    }
    .mm-start-btn:hover  { transform: translateY(-2px); box-shadow: var(--glow2); }
    .mm-start-btn:active { transform: scale(0.97); }

    /* ====================================================
       PROGRESS DOTS
    ==================================================== */
    .mm-progress-dots {
      display: flex; gap: 10px;
      justify-content: center;
      align-items: center;
    }
    .mm-dots-ingame { margin-bottom: 2px; }
    .mm-dot {
      width: 32px; height: 32px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Orbitron', sans-serif;
      font-size: 0.75rem; font-weight: 700;
      border: 2px solid var(--border);
      color: var(--text3);
      background: var(--bg2);
      transition: all 0.3s;
    }
    .mm-dot.active {
      border-color: var(--primary);
      color: var(--primary);
      background: var(--primary-dim);
      box-shadow: var(--glow);
    }
    .mm-dot.done {
      border-color: #00e676;
      color: #00e676;
      background: rgba(0,230,118,0.12);
    }
    .mm-dot.next {
      border-color: var(--secondary);
      color: var(--secondary);
      animation: mm-pulse-dot 1s ease-in-out infinite;
    }
    @keyframes mm-pulse-dot {
      0%,100% { transform: scale(1);    box-shadow: none; }
      50%     { transform: scale(1.15); box-shadow: 0 0 12px var(--secondary); }
    }

    /* ====================================================
       GAME LAYOUT
    ==================================================== */
    .mm-game {
      width: 100%; max-width: 560px;
      display: flex; flex-direction: column;
      gap: 0.55rem;
      padding: 0.25rem 0;
    }

    /* HUD */
    .mm-hud {
      display: flex;
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    .mm-hud-item {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; padding: 0.5rem 0.2rem;
      border-right: 1px solid var(--border);
    }
    .mm-hud-item:last-child { border-right: none; }
    .mm-hud-label {
      font-size: 0.58rem; color: var(--text3);
      letter-spacing: 1px; text-transform: uppercase;
      margin-bottom: 2px;
    }
    .mm-hud-val {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(0.78rem,2.2vw,1rem);
      font-weight: 700; color: var(--primary);
    }
    .mm-hud-level { color: var(--secondary); }
    .mm-score-val { color: #ffd700; }

    /* Timer bar */
    .mm-timer-wrap {
      position: relative; height: 8px;
      background: var(--bg2);
      border-radius: 4px; overflow: hidden;
    }
    .mm-timer-bar {
      height: 100%; width: 100%;
      background: var(--primary);
      border-radius: 4px;
      box-shadow: var(--glow);
    }
    .mm-timer-label {
      position: absolute; right: 6px; top: -18px;
      font-family: 'Orbitron', sans-serif;
      font-size: 0.65rem; color: var(--text3);
    }

    /* ====================================================
       CARD GRID
    ==================================================== */
    .mm-grid {
      display: grid;
      gap: clamp(5px, 1.5vw, 10px);
      width: 100%;
    }

    /* ---- CARD ---- */
    .mm-card {
      aspect-ratio: 3/4;
      cursor: pointer;
      perspective: 800px;
      touch-action: manipulation;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    .mm-card-inner {
      position: relative; width: 100%; height: 100%;
      transform-style: preserve-3d;
      transition: transform 0.38s cubic-bezier(0.4,0,0.2,1);
      border-radius: clamp(6px, 1.5vw, 10px);
    }

    /* Flip states */
    .mm-card.mm-flipped .mm-card-inner,
    .mm-card.mm-matched .mm-card-inner,
    .mm-card.mm-peeked  .mm-card-inner {
      transform: rotateY(180deg);
    }

    .mm-card-front,
    .mm-card-back {
      position: absolute; inset: 0;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      border-radius: inherit;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid var(--border);
    }

    /* Front (emoji face) */
    .mm-card-front {
      transform: rotateY(180deg);
      background: var(--bg2);
      border-color: var(--border2);
    }
    .mm-card-emoji {
      font-size: clamp(1.2rem, 4vw, 2.2rem);
      line-height: 1;
      pointer-events: none;
    }

    /* Back (face-down) */
    .mm-card-back {
      background: linear-gradient(135deg, var(--bg3), var(--bg2));
      border-color: var(--border);
    }
    .mm-card-back-icon {
      font-size: clamp(1rem, 3vw, 1.8rem);
      opacity: 0.5;
      pointer-events: none;
    }

    /* Matched state */
    .mm-card.mm-matched .mm-card-front {
      border-color: #00e676;
      background: rgba(0,230,118,0.1);
      box-shadow: 0 0 14px rgba(0,230,118,0.4);
    }
    .mm-card.mm-matched {
      animation: mm-matched-bounce 0.4s cubic-bezier(0.36,0.07,0.19,0.97);
    }

    /* Wrong state */
    .mm-card.mm-wrong .mm-card-front {
      border-color: #ff3232;
      background: rgba(255,50,50,0.12);
    }
    .mm-card.mm-wrong .mm-card-inner {
      animation: mm-shake 0.4s ease;
    }

    /* Hover */
    .mm-card:not(.mm-matched):not(.mm-flipped):hover .mm-card-inner {
      transform: rotateY(10deg) scale(1.04);
      border-color: var(--border2);
    }

    /* ====================================================
       LEVEL COMPLETE OVERLAY
    ==================================================== */
    .mm-level-overlay {
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.82);
      display: flex; align-items: center; justify-content: center;
      z-index: 50;
      animation: mm-fade-in 0.3s ease;
    }
    .mm-level-overlay-box {
      background: var(--bg2);
      border: 1px solid var(--border2);
      border-radius: 20px;
      padding: 1.8rem 1.5rem;
      max-width: 340px; width: 90%;
      display: flex; flex-direction: column;
      align-items: center; gap: 0.8rem;
      text-align: center;
      box-shadow: 0 0 40px rgba(0,0,0,0.6);
    }

    /* Checkmark */
    .mm-check-wrap {
      width: 64px; height: 64px;
      border-radius: 50%;
      background: rgba(0,230,118,0.15);
      border: 2px solid #00e676;
      display: flex; align-items: center; justify-content: center;
      animation: mm-check-pop 0.5s cubic-bezier(0.36,0.07,0.19,0.97);
    }
    .mm-check {
      font-size: 2rem; color: #00e676;
      font-weight: 900; line-height: 1;
    }
    .mm-lo-timeout-icon { font-size: 3rem; }

    .mm-lo-level {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(1rem, 3vw, 1.2rem);
      font-weight: 900;
      color: var(--primary);
      text-shadow: var(--glow);
      letter-spacing: 1px;
    }
    .mm-lo-perfect {
      background: rgba(255,215,0,0.15);
      border: 1px solid rgba(255,215,0,0.4);
      border-radius: 8px;
      padding: 0.35rem 0.9rem;
      color: #ffd700;
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    /* Score breakdown */
    .mm-lo-breakdown {
      width: 100%;
      background: var(--bg3);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }
    .mm-lo-row {
      display: flex; justify-content: space-between;
      align-items: center;
      padding: 0.4rem 0.8rem;
      border-bottom: 1px solid var(--border);
      font-size: 0.82rem; color: var(--text2);
    }
    .mm-lo-row:last-child { border-bottom: none; }
    .mm-lo-total {
      background: var(--primary-dim);
      color: var(--text);
      font-weight: 700;
    }
    .mm-lo-pts {
      font-family: 'Orbitron', sans-serif;
      font-size: 0.82rem;
      color: var(--primary);
      font-weight: 700;
    }
    .mm-lo-perfect-pts { color: #ffd700; }

    .mm-lo-total-score {
      font-family: 'Rajdhani', sans-serif;
      font-size: 1rem;
      color: var(--text2);
    }
    .mm-lo-total-score strong {
      font-family: 'Orbitron', sans-serif;
      color: #ffd700;
      font-size: 1.1rem;
    }
    .mm-lo-next {
      color: var(--text3);
      font-size: 0.82rem;
      margin: 0;
    }

    /* Auto-progress bar */
    .mm-lo-progress-wrap {
      width: 100%; height: 4px;
      background: var(--bg3);
      border-radius: 2px; overflow: hidden;
    }
    .mm-lo-progress-bar {
      height: 100%; width: 0%;
      background: linear-gradient(90deg, var(--primary), var(--secondary));
      border-radius: 2px;
    }

    .mm-lo-actions {
      display: flex; gap: 10px;
      width: 100%;
    }
    .mm-lo-skip-btn {
      flex: 1;
      padding: 0.75rem 1rem;
      background: var(--btn-bg);
      color: var(--btn-text);
      border: none; border-radius: 10px;
      font-family: 'Orbitron', sans-serif;
      font-size: 0.78rem; font-weight: 700;
      letter-spacing: 0.5px;
      cursor: pointer;
      display: flex; align-items: center;
      justify-content: center; gap: 8px;
      transition: all 0.2s;
      box-shadow: var(--glow);
      touch-action: manipulation;
    }
    .mm-lo-skip-btn:hover  { transform: translateY(-2px); }
    .mm-lo-skip-btn:active { transform: scale(0.97); }
    .mm-lo-home-btn {
      flex: 1;
      padding: 0.75rem 1rem;
      background: var(--bg3);
      color: var(--text2);
      border: 1px solid var(--border);
      border-radius: 10px;
      font-family: 'Orbitron', sans-serif;
      font-size: 0.78rem; font-weight: 700;
      cursor: pointer;
      display: flex; align-items: center;
      justify-content: center; gap: 8px;
      transition: all 0.2s;
      touch-action: manipulation;
    }
    .mm-lo-home-btn:hover  { border-color: var(--border2); }
    .mm-lo-home-btn:active { transform: scale(0.97); }

    /* ====================================================
       FLOATING TEXT
    ==================================================== */
    .mm-float-text {
      position: absolute;
      transform: translateX(-50%);
      font-size: 0.85rem;
      font-weight: 700;
      font-family: 'Rajdhani', sans-serif;
      pointer-events: none;
      white-space: nowrap;
      animation: mm-float-up 0.9s ease forwards;
      z-index: 60;
    }

    /* ====================================================
       KEYFRAMES
    ==================================================== */
    @keyframes mm-matched-bounce {
      0%   { transform: scale(1);    }
      40%  { transform: scale(1.12); }
      70%  { transform: scale(0.96); }
      100% { transform: scale(1);    }
    }
    @keyframes mm-shake {
      0%,100% { transform: rotateY(180deg) translateX(0);    }
      25%      { transform: rotateY(180deg) translateX(-6px); }
      75%      { transform: rotateY(180deg) translateX(6px);  }
    }
    @keyframes mm-check-pop {
      0%   { transform: scale(0);   opacity: 0; }
      70%  { transform: scale(1.2); opacity: 1; }
      100% { transform: scale(1);   opacity: 1; }
    }
    @keyframes mm-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes mm-float-up {
      0%   { opacity: 1; transform: translateX(-50%) translateY(0);    }
      100% { opacity: 0; transform: translateX(-50%) translateY(-50px); }
    }

    /* ====================================================
       RESPONSIVE
    ==================================================== */
    @media (max-width: 400px) {
      .mm-wrap  { padding: 0.25rem; }
      .mm-game  { gap: 0.4rem; }
      .mm-istat { padding: 0.5rem 0.7rem; }
    }
    @media (max-height: 650px) {
      .mm-wrap { align-items: flex-start; }
      .mm-game { padding-bottom: 0.5rem; }
    }
    `;
    document.head.appendChild(style);
  }

})();
