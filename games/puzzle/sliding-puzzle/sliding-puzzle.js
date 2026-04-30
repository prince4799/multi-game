/* ================================================
   SLIDING PUZZLE
   Arrange numbered tiles into correct order!
   Category: Puzzle
   Controls: Click/tap tile OR Arrow keys
   ================================================ */

(function () {

  'use strict';

  /* ---------- REGISTER ---------- */
  GameRegistry.register({
    id:          'sliding-puzzle',
    title:       'Sliding Puzzle',
    category:    'puzzle',
    description: 'Slide the tiles into the correct order. How fast can you solve it?',
    emoji:       '🔲',
    difficulty:  'medium',
    controls:    { dpad: true, actions: false, center: false },
    version:     '1.0',
    init:        (c) => SlidingPuzzle.start(c),
    destroy:     () => SlidingPuzzle.destroy()
  });

  /* ================================================
     GAME OBJECT
  ================================================ */
  const SlidingPuzzle = {
    start(container) { _start(container); },
    destroy()        { _destroy();        }
  };

  /* ---------- STATE ---------- */
  let _container  = null;
  let _gameEl     = null;
  let _grid       = [];       // 1D array, 0 = blank
  let _size       = 3;        // 3x3 default
  let _moves      = 0;
  let _seconds    = 0;
  let _timerInt   = null;
  let _solved     = false;
  let _started    = false;    // first move starts timer

  /* ================================================
     START  →  show size selector
  ================================================ */
  function _start(container) {
    _container = container;
    _destroy();
    _showMenu();
  }

  /* ================================================
     MENU
  ================================================ */
  function _showMenu() {
    _gameEl = document.createElement('div');
    _gameEl.className = 'sp-wrap';
    _gameEl.innerHTML = `
      <div class="sp-menu">
        <div class="sp-logo">🔲</div>
        <h2 class="sp-heading">Sliding Puzzle</h2>
        <p class="sp-sub">Slide tiles to arrange them in order!</p>

        <div class="sp-size-label">Choose Grid Size</div>
        <div class="sp-size-btns">
          <button class="sp-size-btn" data-size="3">
            <span class="sp-size-num">3×3</span>
            <span class="sp-size-desc">8 tiles · Easy</span>
          </button>
          <button class="sp-size-btn" data-size="4">
            <span class="sp-size-num">4×4</span>
            <span class="sp-size-desc">15 tiles · Medium</span>
          </button>
          <button class="sp-size-btn" data-size="5">
            <span class="sp-size-num">5×5</span>
            <span class="sp-size-desc">24 tiles · Hard</span>
          </button>
        </div>

        <div class="sp-how">
          <p>⬆⬇⬅➡ Arrow keys or tap a tile to slide it</p>
        </div>
      </div>`;

    _container.appendChild(_gameEl);

    _gameEl.querySelectorAll('.sp-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        SoundManager.click();
        _size = parseInt(btn.dataset.size);
        _initGame();
      });
    });
  }

  /* ================================================
     INIT GAME
  ================================================ */
  function _initGame() {
    _destroy(true); // keep container

    _moves   = 0;
    _seconds = 0;
    _solved  = false;
    _started = false;

    // Build solved state then shuffle
    _grid = [];
    const total = _size * _size;
    for (let i = 1; i < total; i++) _grid.push(i);
    _grid.push(0); // blank at end

    _shuffle();
    _buildUI();
    _bindKeys();
  }

  /* ================================================
     SHUFFLE  (guaranteed solvable)
  ================================================ */
  function _shuffle() {
    // Do random valid moves instead of array shuffle
    // → always solvable
    const dirs = [
      { r: -1, c: 0 }, { r: 1, c: 0 },
      { r: 0, c: -1 }, { r: 0, c: 1 }
    ];
    const moves = _size === 3 ? 200 : _size === 4 ? 500 : 800;
    let lastBlank = -1;

    for (let i = 0; i < moves; i++) {
      const blankIdx = _grid.indexOf(0);
      const br = Math.floor(blankIdx / _size);
      const bc = blankIdx % _size;

      // Pick random valid neighbor (avoid immediate undo)
      const valid = dirs.filter(d => {
        const nr = br + d.r, nc = bc + d.c;
        if (nr < 0 || nr >= _size || nc < 0 || nc >= _size) return false;
        const ni = nr * _size + nc;
        return ni !== lastBlank;
      });

      const d  = valid[Math.floor(Math.random() * valid.length)];
      const ni = (br + d.r) * _size + (bc + d.c);
      _grid[blankIdx] = _grid[ni];
      _grid[ni]       = 0;
      lastBlank       = blankIdx;
    }
  }

  /* ================================================
     BUILD UI
  ================================================ */
  function _buildUI() {
    _gameEl = document.createElement('div');
    _gameEl.className = 'sp-wrap';

    // Tile size responsive
    const maxBoard = Math.min(
      window.innerWidth  - 40,
      window.innerHeight - 200,
      480
    );
    const tileSize = Math.floor(maxBoard / _size);
    const board    = tileSize * _size;

    _gameEl.innerHTML = `
      <div class="sp-game">

        <!-- HUD -->
        <div class="sp-hud">
          <div class="sp-hud-box">
            <span class="sp-hud-label">Moves</span>
            <span class="sp-hud-val" id="sp-moves">0</span>
          </div>
          <div class="sp-hud-box">
            <span class="sp-hud-label">Time</span>
            <span class="sp-hud-val" id="sp-time">0:00</span>
          </div>
          <div class="sp-hud-box">
            <span class="sp-hud-label">Best</span>
            <span class="sp-hud-val" id="sp-best">-</span>
          </div>
        </div>

        <!-- Board -->
        <div class="sp-board" id="sp-board"
             style="width:${board}px;height:${board}px;
                    grid-template-columns:repeat(${_size},1fr)">
        </div>

        <!-- Hint -->
        <p class="sp-hint" id="sp-hint">Tap a tile next to the gap to slide it</p>

        <!-- Buttons -->
        <div class="sp-btns">
          <button class="sp-btn sp-btn-secondary" id="sp-shuffle-btn">
            🔀 Shuffle
          </button>
          <button class="sp-btn sp-btn-primary" id="sp-menu-btn">
            🏠 Menu
          </button>
        </div>

      </div>`;

    _container.appendChild(_gameEl);

    _renderTiles();
    _updateHUD();

    // Shuffle / menu buttons
    document.getElementById('sp-shuffle-btn').addEventListener('click', () => {
      SoundManager.click();
      _initGame();
    });
    document.getElementById('sp-menu-btn').addEventListener('click', () => {
      SoundManager.click();
      _stopTimer();
      _destroy(true);
      _showMenu();
    });
  }

  /* ================================================
     RENDER TILES
  ================================================ */
  function _renderTiles() {
    const board = document.getElementById('sp-board');
    if (!board) return;
    board.innerHTML = '';

    _grid.forEach((val, idx) => {
      const tile = document.createElement('div');

      if (val === 0) {
        tile.className = 'sp-tile sp-blank';
      } else {
        const correct = (val === idx + 1) ||
                        (val === _size * _size && idx === _size * _size - 1);
        tile.className = `sp-tile sp-num ${correct ? 'sp-correct' : ''}`;
        tile.textContent = val;
      }

      tile.dataset.idx = idx;

      tile.addEventListener('click', () => {
        if (_solved) return;
        _tryMove(idx);
      });

      board.appendChild(tile);
    });
  }

  /* ================================================
     TRY MOVE  (click or arrow key)
  ================================================ */
  function _tryMove(tileIdx) {
    if (_solved) return;

    const blankIdx = _grid.indexOf(0);
    if (!_isAdjacent(tileIdx, blankIdx)) return;

    // Swap
    _grid[blankIdx] = _grid[tileIdx];
    _grid[tileIdx]  = 0;
    _moves++;

    // Start timer on first move
    if (!_started) {
      _started = true;
      _startTimer();
    }

    SoundManager.buttonPress
      ? SoundManager.buttonPress()
      : SoundManager.click();

    _renderTiles();
    _updateHUD();
    _animateTile(blankIdx); // animate the tile that moved into blank

    if (_checkSolved()) {
      _onSolved();
    }
  }

  /* ================================================
     ADJACENT CHECK
  ================================================ */
  function _isAdjacent(a, b) {
    const ar = Math.floor(a / _size), ac = a % _size;
    const br = Math.floor(b / _size), bc = b % _size;
    return (Math.abs(ar - br) + Math.abs(ac - bc)) === 1;
  }

  /* ================================================
     ARROW KEY MOVE
     Arrow key moves the BLANK in that direction
     (i.e. slides the tile FROM that direction)
  ================================================ */
  function _arrowMove(dir) {
    const blankIdx = _grid.indexOf(0);
    const br = Math.floor(blankIdx / _size);
    const bc = blankIdx % _size;

    let tr = br, tc = bc;
    if (dir === 'ArrowUp')    tr = br + 1; // tile below moves up
    if (dir === 'ArrowDown')  tr = br - 1; // tile above moves down
    if (dir === 'ArrowLeft')  tc = bc + 1; // tile right moves left
    if (dir === 'ArrowRight') tc = bc - 1; // tile left moves right

    if (tr < 0 || tr >= _size || tc < 0 || tc >= _size) return;
    const tileIdx = tr * _size + tc;
    _tryMove(tileIdx);
  }

  /* ================================================
     ANIMATE TILE
  ================================================ */
  function _animateTile(idx) {
    const board = document.getElementById('sp-board');
    if (!board) return;
    const tile = board.children[idx];
    if (!tile) return;
    tile.classList.remove('sp-slide');
    void tile.offsetWidth;
    tile.classList.add('sp-slide');
  }

  /* ================================================
     CHECK SOLVED
  ================================================ */
  function _checkSolved() {
    const total = _size * _size;
    for (let i = 0; i < total - 1; i++) {
      if (_grid[i] !== i + 1) return false;
    }
    return _grid[total - 1] === 0;
  }

  /* ================================================
     ON SOLVED
  ================================================ */
  function _onSolved() {
    _solved = true;
    _stopTimer();

    // Score: base points minus time and move penalties
    const base      = _size === 3 ? 1000 : _size === 4 ? 2000 : 3000;
    const timePen   = _seconds * 2;
    const movePen   = Math.max(0, _moves - (_size * _size * 2)) * 5;
    const score     = Math.max(100, base - timePen - movePen);

    // Flash all tiles green
    const board = document.getElementById('sp-board');
    if (board) {
      board.querySelectorAll('.sp-tile').forEach(t => {
        t.classList.add('sp-win');
      });
    }

    const hint = document.getElementById('sp-hint');
    if (hint) hint.textContent = `🎉 Solved in ${_moves} moves, ${_fmtTime(_seconds)}!`;

    if (window.SoundManager && SoundManager.win) SoundManager.win();

    setTimeout(() => {
      App.showGameResult(score, true);
    }, 1000);
  }

  /* ================================================
     TIMER
  ================================================ */
  function _startTimer() {
    _stopTimer();
    _timerInt = setInterval(() => {
      _seconds++;
      _updateHUD();
    }, 1000);
  }

  function _stopTimer() {
    if (_timerInt) { clearInterval(_timerInt); _timerInt = null; }
  }

  function _fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  /* ================================================
     HUD
  ================================================ */
  function _updateHUD() {
    const movesEl = document.getElementById('sp-moves');
    const timeEl  = document.getElementById('sp-time');
    const bestEl  = document.getElementById('sp-best');

    if (movesEl) movesEl.textContent = _moves;
    if (timeEl)  timeEl.textContent  = _fmtTime(_seconds);
    if (bestEl) {
      const best = ScoreManager.getBestScore('sliding-puzzle');
      bestEl.textContent = best > 0 ? best : '-';
    }

    App.updateScoreDisplay(_moves, ScoreManager.getBestScore('sliding-puzzle'));
  }

  /* ================================================
     KEY BINDINGS
  ================================================ */
  function _bindKeys() {
    ControlManager.on('keydown', 'sliding-puzzle', key => {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key)) {
        _arrowMove(key);
      }
    });
  }

  /* ================================================
     DESTROY
  ================================================ */
  function _destroy(keepContainer = false) {
    _stopTimer();
    _solved  = false;
    _started = false;
    ControlManager.off('keydown', 'sliding-puzzle');

    if (_gameEl && _gameEl.parentNode) {
      _gameEl.parentNode.removeChild(_gameEl);
    }
    _gameEl = null;
  }

  /* ================================================
     STYLES
  ================================================ */
  const _style = document.createElement('style');
  _style.textContent = `

    /* ---- Wrapper ---- */
    .sp-wrap {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      overflow-y: auto;
    }

    /* ---- Menu ---- */
    .sp-menu {
      text-align: center;
      max-width: 400px;
      width: 100%;
    }
    .sp-logo {
      font-size: 3.5rem;
      margin-bottom: 0.5rem;
      filter: drop-shadow(0 0 15px var(--primary));
      animation: floatOrb 3s ease-in-out infinite;
    }
    .sp-heading {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(1.3rem,4vw,2rem);
      font-weight: 900;
      color: var(--primary);
      text-shadow: var(--glow);
      margin-bottom: 0.4rem;
    }
    .sp-sub {
      color: var(--text2);
      font-size: 0.9rem;
      margin-bottom: 1.5rem;
    }
    .sp-size-label {
      font-size: 0.75rem;
      color: var(--text3);
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 0.75rem;
    }
    .sp-size-btns {
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
      margin-bottom: 1.25rem;
    }
    .sp-size-btn {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      background: var(--bg3);
      border: 1px solid var(--border);
      border-radius: 12px;
      color: var(--text);
      font-family: 'Rajdhani', sans-serif;
      transition: all 0.2s;
      cursor: pointer;
    }
    .sp-size-btn:hover {
      border-color: var(--border2);
      background: var(--primary-dim);
      transform: translateX(4px);
      box-shadow: var(--glow);
    }
    .sp-size-num {
      font-family: 'Orbitron', sans-serif;
      font-size: 1rem;
      color: var(--primary);
    }
    .sp-size-desc {
      font-size: 0.8rem;
      color: var(--text2);
    }
    .sp-how {
      color: var(--text3);
      font-size: 0.8rem;
      padding: 0.75rem;
      background: var(--bg2);
      border-radius: 8px;
      border: 1px solid var(--border);
    }

    /* ---- Game ---- */
    .sp-game {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      width: 100%;
      max-width: 520px;
    }

    /* ---- HUD ---- */
    .sp-hud {
      display: flex;
      gap: 1px;
      background: var(--border);
      border-radius: 12px;
      overflow: hidden;
      width: 100%;
      max-width: 360px;
    }
    .sp-hud-box {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.6rem 0.5rem;
      background: var(--bg2);
      gap: 2px;
    }
    .sp-hud-label {
      font-size: 0.6rem;
      color: var(--text3);
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .sp-hud-val {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(0.85rem,2vw,1.1rem);
      font-weight: 700;
      color: var(--primary);
    }

    /* ---- Board ---- */
    .sp-board {
      display: grid;
      gap: 6px;
      padding: 10px;
      background: var(--bg2);
      border: 2px solid var(--border2);
      border-radius: 16px;
      box-shadow: var(--glow);
      touch-action: none;
      user-select: none;
    }

    /* ---- Tiles ---- */
    .sp-tile {
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      font-family: 'Orbitron', sans-serif;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.1s, background 0.2s, box-shadow 0.2s;
      user-select: none;
      -webkit-user-select: none;
      touch-action: manipulation;
      will-change: transform;
    }
    .sp-num {
      background: var(--bg3);
      border: 2px solid var(--border2);
      color: var(--text);
      font-size: clamp(1rem,3vw,1.6rem);
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .sp-num:hover {
      background: var(--primary-dim);
      border-color: var(--primary);
      color: var(--primary);
      box-shadow: var(--glow);
      transform: scale(1.04);
    }
    .sp-num:active {
      transform: scale(0.96);
    }
    .sp-correct {
      background: rgba(0,230,118,0.12) !important;
      border-color: #00e676 !important;
      color: #00e676 !important;
    }
    .sp-blank {
      background: transparent;
      border: 2px dashed rgba(255,255,255,0.06);
      cursor: default;
      box-shadow: none;
    }
    .sp-blank:hover {
      background: transparent;
      transform: none;
      box-shadow: none;
    }
    .sp-win {
      background: rgba(0,230,118,0.25) !important;
      border-color: #00e676 !important;
      color: #00e676 !important;
      box-shadow: 0 0 16px rgba(0,230,118,0.4) !important;
      animation: spWinPop 0.4s ease both;
    }

    /* Slide animation */
    .sp-slide {
      animation: spSlide 0.12s ease;
    }

    /* ---- Hint ---- */
    .sp-hint {
      font-size: 0.78rem;
      color: var(--text3);
      text-align: center;
      min-height: 20px;
      transition: color 0.3s;
    }

    /* ---- Buttons ---- */
    .sp-btns {
      display: flex;
      gap: 0.75rem;
    }
    .sp-btn {
      padding: 0.7rem 1.4rem;
      border: none;
      border-radius: 10px;
      font-family: 'Rajdhani', sans-serif;
      font-size: 0.9rem;
      font-weight: 700;
      letter-spacing: 0.5px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .sp-btn-primary {
      background: var(--btn-bg);
      color: var(--btn-text);
      box-shadow: var(--glow);
    }
    .sp-btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: var(--glow2);
    }
    .sp-btn-secondary {
      background: var(--bg3);
      color: var(--text2);
      border: 1px solid var(--border);
    }
    .sp-btn-secondary:hover {
      border-color: var(--border2);
      color: var(--primary);
    }

    /* ---- Animations ---- */
    @keyframes spSlide {
      0%   { transform: scale(0.9); }
      60%  { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    @keyframes spWinPop {
      0%   { transform: scale(0.85); }
      60%  { transform: scale(1.12); }
      100% { transform: scale(1); }
    }

    /* ---- Mobile ---- */
    @media (max-width: 600px) {
      .sp-wrap  { padding: 0.5rem; }
      .sp-board { gap: 4px; padding: 8px; border-radius: 12px; }
      .sp-tile  { border-radius: 8px; }
      .sp-btns  { flex-wrap: wrap; justify-content: center; }
    }
  `;
  document.head.appendChild(_style);

})();