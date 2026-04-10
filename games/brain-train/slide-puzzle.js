/* ================================================
   SLIDE PUZZLE
   Classic number sliding grid puzzle.
   Category: Puzzle
   Controls: Mouse click (desktop) | Tap (mobile)
   ================================================ */

(function () {
  'use strict';

  /* ---------- GAME CONFIG ---------- */
  const LEVELS = [
    { name: 'Easy',   size: 3, time: 120 }, // 3x3
    { name: 'Medium', size: 4, time: 240 }, // 4x4
    { name: 'Hard',   size: 5, time: 480 }  // 5x5
  ];

  /* ---------- STATE ---------- */
  let container     = null;
  let gameEl        = null;
  let board         = [];
  let size          = 3;
  let score         = 0;
  let moves         = 0;
  let timeLeft      = 0;
  let timerInterval = null;
  let isRunning     = false;
  let currentLevel  = 0;

  /* ================================================
     REGISTER WITH GAME REGISTRY (Rule 2)
  ================================================ */
  GameRegistry.register({
    id:          'slide-puzzle',
    title:       'Slide Puzzle',
    category:    'puzzle',
    description: 'Slide tiles into the empty space to arrange them in numerical order!',
    emoji:       '🧩',
    difficulty:  'medium',
    controls:    { dpad: false, actions: false, center: false },
    init:        (c) => start(c),
    destroy:     () => destroy()
  });

  /* ================================================
     START GAME
  ================================================ */
  function start(cont) {
    container = cont;
    currentLevel = 0;
    _injectStyles(); // Rule 17
    showLevelSelect();
  }

  /* ================================================
     LEVEL SELECT SCREEN
  ================================================ */
  function showLevelSelect() {
    cleanup();

    gameEl = document.createElement('div');
    gameEl.className = 'sp-wrap';
    gameEl.innerHTML = `
      <div class="sp-level-select">
        <div class="sp-logo">🧩</div>
        <h2 class="sp-heading">Slide Puzzle</h2>
        <p class="sp-sub">Select grid size to start</p>
        <div class="sp-level-btns">
          ${LEVELS.map((lvl, i) => `
            <button class="sp-level-btn" data-level="${i}">
              <span class="sp-lvl-name">${lvl.name} (${lvl.size}x${lvl.size})</span>
              <span class="sp-lvl-detail">${lvl.time}s</span>
            </button>
          `).join('')}
        </div>
      </div>`;

    container.appendChild(gameEl);

    // Bind level buttons
    gameEl.querySelectorAll('.sp-level-btn').forEach(btn => {
      // Touch and Click support (Rule 18)
      const handler = (e) => {
        if(e.type === 'touchstart') e.preventDefault();
        SoundManager.click();
        currentLevel = parseInt(btn.dataset.level);
        startLevel(currentLevel);
      };
      btn.addEventListener('click', handler);
      btn.addEventListener('touchstart', handler, { passive: false });
    });
  }

  /* ================================================
     START LEVEL
  ================================================ */
  function startLevel(levelIdx) {
    cleanup();
    isRunning = true;
    score     = 0;
    moves     = 0;

    const level = LEVELS[levelIdx];
    size        = level.size;
    timeLeft    = level.time;

    // Generate solvable shuffled board
    board = _createSolvableBoard(size);

    // Build UI
    gameEl = document.createElement('div');
    gameEl.className = 'sp-wrap';
    gameEl.innerHTML = `
      <div class="sp-game">

        <!-- HUD -->
        <div class="sp-hud">
          <div class="sp-hud-item">
            <span class="sp-hud-label">Score</span>
            <span class="sp-hud-val" id="sp-score">0</span>
          </div>
          <div class="sp-hud-item sp-timer-wrap">
            <span class="sp-hud-label">Time</span>
            <span class="sp-hud-val sp-timer" id="sp-timer">${timeLeft}</span>
          </div>
          <div class="sp-hud-item">
            <span class="sp-hud-label">Moves</span>
            <span class="sp-hud-val" id="sp-moves">0</span>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="sp-progress-wrap">
          <div class="sp-progress-bar" id="sp-progress" style="width:100%"></div>
        </div>

        <!-- Game Board -->
        <div class="sp-board-wrap">
          <div class="sp-grid" id="sp-grid" style="--size:${size}"></div>
        </div>

      </div>`;

    container.appendChild(gameEl);

    _renderTiles();
    startTimer(level.time);
  }

  /* ================================================
     BOARD GENERATOR (GUARANTEES SOLVABILITY)
  ================================================ */
  function _createSolvableBoard(sz) {
    const total = sz * sz;
    const b = Array.from({length: total - 1}, (_, i) => i + 1);
    b.push(0); // 0 represents the empty space

    let blankIdx = total - 1;

    // Shuffle by making valid moves backwards from solved state
    // This physically guarantees it is 100% solvable without complex math
    let lastMove = -1;
    const shuffles = sz * sz * 15; 
    
    for (let i = 0; i < shuffles; i++) {
      const moves = [];
      const r = Math.floor(blankIdx / sz), c = blankIdx % sz;
      if (r > 0) moves.push(blankIdx - sz);      // up
      if (r < sz - 1) moves.push(blankIdx + sz); // down
      if (c > 0) moves.push(blankIdx - 1);       // left
      if (c < sz - 1) moves.push(blankIdx + 1);  // right

      // Prevent immediate backtracking for better shuffling
      const filtered = moves.filter(m => m !== lastMove);
      const moveTo = filtered.length > 0 
        ? filtered[Math.floor(Math.random() * filtered.length)] 
        : moves[0];

      // Swap
      b[blankIdx] = b[moveTo];
      b[moveTo] = 0;
      lastMove = blankIdx;
      blankIdx = moveTo;
    }
    return b;
  }

  /* ================================================
     RENDER TILES
  ================================================ */
  function _renderTiles() {
    const grid = gameEl.querySelector('#sp-grid');
    grid.innerHTML = ''; // Clear

    for (let i = 1; i < size * size; i++) {
      const el = document.createElement('div');
      el.className = 'sp-tile';
      el.id = `tile-${i}`;
      el.innerHTML = `<div class="sp-tile-inner">${i}</div>`;
      
      const handler = (e) => {
        if(e.type === 'touchstart') e.preventDefault();
        _handleTileClick(i);
      };
      el.addEventListener('click', handler);
      el.addEventListener('touchstart', handler, { passive: false });
      
      grid.appendChild(el);
    }
    
    _updateTilePositions();
  }

  /* ================================================
     UPDATE POSITIONS (CSS TRANSFORM)
  ================================================ */
  function _updateTilePositions() {
    for (let i = 0; i < board.length; i++) {
      const tileNum = board[i];
      if (tileNum === 0) continue; // Empty space

      const el = gameEl.querySelector(`#tile-${tileNum}`);
      if (el) {
        const row = Math.floor(i / size);
        const col = i % size;
        // Using % for transform translates relative to the element's own width/height!
        el.style.transform = `translate(${col * 100}%, ${row * 100}%)`;
      }
    }
  }

  /* ================================================
     HANDLE MOVE
  ================================================ */
  function _handleTileClick(tileNum) {
    if (!isRunning) return;

    const tileIdx = board.indexOf(tileNum);
    const blankIdx = board.indexOf(0);

    const tileRow = Math.floor(tileIdx / size);
    const tileCol = tileIdx % size;
    const blankRow = Math.floor(blankIdx / size);
    const blankCol = blankIdx % size;

    // Check if adjacent (Manhattan distance == 1)
    const isAdjacent = Math.abs(tileRow - blankRow) + Math.abs(tileCol - blankCol) === 1;

    if (isAdjacent) {
      // Swap in array
      board[blankIdx] = tileNum;
      board[tileIdx] = 0;

      moves++;
      SoundManager.navigate(); // Nice soft "slide" sound effect
      _updateTilePositions();
      updateHUD();
      
      if (_checkWin()) {
        setTimeout(() => endGame(true), 300); // Small delay to let slide finish
      }
    } else {
      // Invalid move shake effect
      const el = gameEl.querySelector(`#tile-${tileNum}`);
      if(el) {
        el.classList.add('shake');
        SoundManager.wrong();
        setTimeout(() => el.classList.remove('shake'), 400);
      }
    }
  }

  /* ================================================
     WIN CONDITION CHECK
  ================================================ */
  function _checkWin() {
    for (let i = 0; i < board.length - 1; i++) {
      if (board[i] !== i + 1) return false;
    }
    return board[board.length - 1] === 0;
  }

  /* ================================================
     TIMER
  ================================================ */
  function startTimer(seconds) {
    clearInterval(timerInterval);
    timeLeft = seconds;

    timerInterval = setInterval(() => {
      if (!isRunning) return;
      timeLeft--;

      const timerEl = gameEl?.querySelector('#sp-timer');
      if (timerEl) {
        timerEl.textContent = timeLeft;
        timerEl.style.color = timeLeft <= 10 ? 'var(--accent)' : 'var(--primary)';
      }

      const bar = gameEl?.querySelector('#sp-progress');
      if (bar) {
        const pct = (timeLeft / seconds) * 100;
        bar.style.width = pct + '%';
        bar.style.background = timeLeft <= 10 ? 'var(--accent)' : 'var(--primary)';
      }

      if (timeLeft <= 10 && timeLeft > 0) {
        SoundManager.timerWarning();
      }

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        endGame(false);
      }
    }, 1000);
  }

  /* ================================================
     UPDATE HUD
  ================================================ */
  function updateHUD() {
    // Dynamic Score calculation
    const basePts = (currentLevel + 1) * 1000;
    const movePenalty = moves * 10;
    score = Math.max(0, basePts - movePenalty + (timeLeft * 5));

    const scoreEl = gameEl?.querySelector('#sp-score');
    const movesEl = gameEl?.querySelector('#sp-moves');

    if (scoreEl) scoreEl.textContent = score;
    if (movesEl) movesEl.textContent = moves;

    App.updateScoreDisplay(score, ScoreManager.getBestScore('slide-puzzle'));
  }

  /* ================================================
     END GAME
  ================================================ */
  function endGame(won) {
    isRunning = false;
    clearInterval(timerInterval);

    if (won) {
      score += timeLeft * 10; // Final time bonus
      updateHUD();
      SoundManager.win();
    } else {
      SoundManager.gameOver();
    }

    // Save High Score
    ScoreManager.submitScore('slide-puzzle', score);

    // Platform standard overlay
    setTimeout(() => {
      App.showGameResult(score, won);
    }, won ? 600 : 200);
  }

  /* ================================================
     CLEANUP
  ================================================ */
  function cleanup() {
    clearInterval(timerInterval);
    isRunning = false;
    if (gameEl && gameEl.parentNode) {
      gameEl.parentNode.removeChild(gameEl);
    }
    gameEl = null;
  }

  function destroy() {
    cleanup();
  }

  /* ================================================
     INJECT STYLES (Rule 17 & 19)
  ================================================ */
  function _injectStyles() {
    if (document.getElementById('sp-styles')) return;
    const style = document.createElement('style');
    style.id = 'sp-styles';
    style.textContent = `
      /* Wrapper */
      .sp-wrap {
        width: 100%; height: 100%;
        display: flex; align-items: center; justify-content: center;
        padding: 1rem; overflow-y: auto;
      }

      /* Level Select (Matches Memory Match exactly) */
      .sp-level-select { text-align: center; max-width: 400px; width: 100%; }
      .sp-logo {
        font-size: 4rem; margin-bottom: 0.5rem;
        filter: drop-shadow(0 0 15px var(--primary));
      }
      .sp-heading {
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(1.3rem, 4vw, 2rem);
        font-weight: 900; color: var(--primary);
        text-shadow: var(--glow); margin-bottom: 0.5rem;
      }
      .sp-sub { color: var(--text2); font-size: 0.9rem; margin-bottom: 1.5rem; }
      .sp-level-btns { display: flex; flex-direction: column; gap: 0.75rem; }
      .sp-level-btn {
        display: flex; align-items: center; justify-content: space-between;
        padding: 1rem 1.5rem; background: var(--bg3);
        border: 1px solid var(--border); border-radius: 12px;
        color: var(--text); font-family: 'Rajdhani', sans-serif;
        font-size: 1rem; font-weight: 600; cursor: pointer;
        transition: all 0.2s;
      }
      .sp-level-btn:hover {
        border-color: var(--border2); background: var(--primary-dim);
        color: var(--primary); transform: translateX(4px);
        box-shadow: var(--glow);
      }
      .sp-lvl-name { font-family: 'Orbitron', sans-serif; font-size: 0.9rem; }
      .sp-lvl-detail { font-size: 0.8rem; color: var(--text2); }

      /* Game Layout */
      .sp-game {
        width: 100%; max-width: 500px; /* slightly smaller max-width for tight grid */
        display: flex; flex-direction: column; gap: 0.75rem;
      }

      /* HUD */
      .sp-hud {
        display: flex; gap: 0; background: var(--bg2);
        border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
      }
      .sp-hud-item {
        flex: 1; display: flex; flex-direction: column; align-items: center;
        padding: 0.6rem 0.5rem; border-right: 1px solid var(--border);
      }
      .sp-hud-item:last-child { border-right: none; }
      .sp-hud-label {
        font-size: 0.62rem; color: var(--text3);
        letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 2px;
      }
      .sp-hud-val {
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(0.85rem, 2.5vw, 1.1rem);
        font-weight: 700; color: var(--primary);
      }
      .sp-timer { transition: color 0.3s; }

      /* Progress Bar */
      .sp-progress-wrap { height: 4px; background: var(--bg2); border-radius: 2px; overflow: hidden; }
      .sp-progress-bar {
        height: 100%; background: var(--primary); border-radius: 2px;
        transition: width 1s linear, background 0.3s; box-shadow: var(--glow);
      }

      /* Board & Grid */
      .sp-board-wrap {
        width: 100%;
        aspect-ratio: 1 / 1; /* Perfect Square */
        background: var(--bg2);
        border: 2px solid var(--border);
        border-radius: 12px;
        padding: 6px;
        box-shadow: var(--glow);
      }
      .sp-grid {
        position: relative;
        width: 100%; height: 100%;
      }

      /* Tiles */
      .sp-tile {
        position: absolute;
        width: calc(100% / var(--size));
        height: calc(100% / var(--size));
        padding: 3px; /* Gap between tiles */
        transition: transform 0.2s ease-in-out;
        user-select: none;
        -webkit-user-select: none;
        cursor: pointer;
      }
      .sp-tile-inner {
        width: 100%; height: 100%;
        background: var(--bg3);
        border: 1px solid var(--border);
        border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(1.5rem, 5vw, 2.5rem);
        font-weight: bold;
        color: var(--text);
        box-shadow: inset 0 0 15px rgba(0,0,0,0.5);
        transition: border-color 0.2s, color 0.2s, background 0.2s;
      }
      .sp-tile:hover .sp-tile-inner {
        border-color: var(--border2);
        color: var(--primary);
        background: var(--primary-dim);
      }

      /* Shake Animation for Invalid Moves */
      .sp-tile.shake .sp-tile-inner {
        animation: spShake 0.4s ease;
        border-color: var(--accent);
        color: var(--accent);
      }
      @keyframes spShake {
        0%,100% { transform: translateX(0); }
        20%     { transform: translateX(-4px); }
        40%     { transform: translateX(4px); }
        60%     { transform: translateX(-2px); }
        80%     { transform: translateX(2px); }
      }

      /* Mobile Adjustments */
      @media (max-width: 600px) {
        .sp-wrap { padding: 0.5rem; align-items: flex-start; }
        .sp-game { gap: 0.5rem; }
        .sp-tile { padding: 2px; }
        .sp-tile-inner { border-radius: 6px; }
      }
    `;
    document.head.appendChild(style);
  }

})();
