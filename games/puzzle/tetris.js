/* ================================================
   TETRIS v1.0
   Classic tetris — ghost piece, levels, combos,
   in-canvas game-over overlay
   Category: Puzzle
   ================================================ */

(function () {
  'use strict';

  // ================================================================
  //  CONSTANTS
  // ================================================================
  const COLS        = 10;
  const ROWS        = 20;
  const HIDDEN_ROWS = 2;
  const TOTAL_ROWS  = ROWS + HIDDEN_ROWS;

  const COLORS = {
    I: '#00f0f0', O: '#f0f000', T: '#a000f0',
    S: '#00f000', Z: '#f00000', J: '#0000f0', L: '#f0a000'
  };
  const SHADOW = {
    I: '#00a0a0', O: '#a0a000', T: '#6800a0',
    S: '#008000', Z: '#a00000', J: '#000080', L: '#a06800'
  };

  const SHAPES = {
    I: [
      [[0,0],[0,1],[0,2],[0,3]],
      [[0,2],[1,2],[2,2],[3,2]],
      [[1,0],[1,1],[1,2],[1,3]],
      [[0,1],[1,1],[2,1],[3,1]]
    ],
    O: [
      [[0,0],[0,1],[1,0],[1,1]],
      [[0,0],[0,1],[1,0],[1,1]],
      [[0,0],[0,1],[1,0],[1,1]],
      [[0,0],[0,1],[1,0],[1,1]]
    ],
    T: [
      [[0,1],[1,0],[1,1],[1,2]],
      [[0,1],[1,1],[1,2],[2,1]],
      [[1,0],[1,1],[1,2],[2,1]],
      [[0,1],[1,0],[1,1],[2,1]]
    ],
    S: [
      [[0,1],[0,2],[1,0],[1,1]],
      [[0,1],[1,1],[1,2],[2,2]],
      [[1,1],[1,2],[2,0],[2,1]],
      [[0,0],[1,0],[1,1],[2,1]]
    ],
    Z: [
      [[0,0],[0,1],[1,1],[1,2]],
      [[0,2],[1,1],[1,2],[2,1]],
      [[1,0],[1,1],[2,1],[2,2]],
      [[0,1],[1,0],[1,1],[2,0]]
    ],
    J: [
      [[0,0],[1,0],[1,1],[1,2]],
      [[0,1],[0,2],[1,1],[2,1]],
      [[1,0],[1,1],[1,2],[2,2]],
      [[0,1],[1,1],[2,0],[2,1]]
    ],
    L: [
      [[0,2],[1,0],[1,1],[1,2]],
      [[0,1],[1,1],[2,1],[2,2]],
      [[1,0],[1,1],[1,2],[2,0]],
      [[0,0],[0,1],[1,1],[2,1]]
    ]
  };

  const KICKS = {
    '0>1':[[-1,0],[-1,1],[0,-2],[-1,-2]], '1>0':[[1,0],[1,-1],[0,2],[1,2]],
    '1>2':[[1,0],[1,-1],[0,2],[1,2]],     '2>1':[[-1,0],[-1,1],[0,-2],[-1,-2]],
    '2>3':[[1,0],[1,1],[0,-2],[1,-2]],    '3>2':[[-1,0],[-1,-1],[0,2],[-1,2]],
    '3>0':[[-1,0],[-1,-1],[0,2],[-1,2]], '0>3':[[1,0],[1,1],[0,-2],[1,-2]]
  };
  const KICKS_I = {
    '0>1':[[-2,0],[1,0],[-2,-1],[1,2]],  '1>0':[[2,0],[-1,0],[2,1],[-1,-2]],
    '1>2':[[-1,0],[2,0],[-1,2],[2,-1]],  '2>1':[[1,0],[-2,0],[1,-2],[-2,1]],
    '2>3':[[2,0],[-1,0],[2,1],[-1,-2]],  '3>2':[[-2,0],[1,0],[-2,-1],[1,2]],
    '3>0':[[1,0],[-2,0],[1,-2],[-2,1]],  '0>3':[[-1,0],[2,0],[-1,2],[2,-1]]
  };

  const POINTS   = [0,100,300,500,800];
  const LEVEL_UP = 10;
  const LOCK_DELAY = 30;
  const DAS_DELAY  = 10;
  const DAS_SPEED  = 2;

  // ================================================================
  //  PRIVATE STATE
  // ================================================================
  let _canvas        = null;
  let _ctx           = null;
  let _animId        = null;
  let _running       = false;
  let _overlayEl     = null;
  let _loadingEl     = null;
  let _resizeHandler = null;

  let _lastTime  = 0;
  let _dropAccum = 0;

  // Held-key state  (populated via ControlManager keydown/keyup)
  const _held     = {};
  const _dasLeft  = { n: 0 };
  const _dasRight = { n: 0 };
  const _dasSoft  = { n: 0 };

  const game = {
    running:   false, over:      false,
    score:     0,     lines:     0,
    level:     1,     combo:     0,
    highScore: parseInt(localStorage.getItem('tet_hi') || '0'),
    time:      0
  };

  let board     = [];
  let piece     = null;
  let nextPiece = null;   // single look-ahead (shown on desktop panel only)
  let lockTimer = 0;
  let lockReset = 0;
  let particles = [];
  let lineFlash = [];

  // ================================================================
  //  HELPERS
  // ================================================================
  function W()      { return _canvas ? _canvas.width  : window.innerWidth;  }
  function H()      { return _canvas ? _canvas.height : window.innerHeight; }
  function rnd(a,b) { return Math.random()*(b-a)+a; }
  function _touch() { return ControlManager.isTouchDevice(); }

  function _cellSize() {
    const maxH = (H() * 0.93) / ROWS;
    // On desktop we need room for the side panels (~4 cells each side + gap)
    const sideRoom = _touch() ? 0 : cs => cs * 4 + 28;
    // Iterate once to find best fit
    let cs = Math.floor(Math.min(maxH, (W() * 0.56) / COLS, 34));
    if (!_touch()) {
      // Ensure board + two panels fit horizontally
      while (cs > 10 && cs * COLS + (cs * 4 + 28) * 2 > W() * 0.98) cs--;
    }
    return cs;
  }

  function _boardOrigin() {
    const cs = _cellSize();
    const bw = cs * COLS;
    const bh = cs * ROWS;
    // Centre board; on desktop shift slightly left to balance with NEXT panel
    const xOff = _touch() ? 0 : Math.floor(cs * 2);
    return {
      x: Math.floor((W() - bw) / 2) - xOff,
      y: Math.floor((H() - bh) / 2)
    };
  }

  function _dropInterval() {
    const ms = [800,700,600,500,400,300,220,150,100,60];
    return ms[Math.min(game.level - 1, ms.length - 1)];
  }

  // ================================================================
  //  7-BAG
  // ================================================================
  let _bag = [];
  function _refillBag() {
    _bag = ['I','O','T','S','Z','J','L'];
    for (let i = _bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [_bag[i], _bag[j]] = [_bag[j], _bag[i]];
    }
  }
  function _nextFromBag() {
    if (!_bag.length) _refillBag();
    return _bag.pop();
  }

  // ================================================================
  //  BOARD
  // ================================================================
  function _emptyBoard() {
    board = [];
    for (let r = 0; r < TOTAL_ROWS; r++) board.push(new Array(COLS).fill(null));
  }

  // ================================================================
  //  PIECE
  // ================================================================
  function _makePiece(type) {
    return { type, rot: 0, row: 0, col: Math.floor(COLS / 2) - 2 };
  }
  function _cells(p) {
    return SHAPES[p.type][p.rot].map(([r,c]) => [r + p.row, c + p.col]);
  }
  function _valid(p, dr=0, dc=0, rot=p.rot) {
    const t = { ...p, row: p.row+dr, col: p.col+dc, rot };
    return _cells(t).every(([r,c]) =>
      c >= 0 && c < COLS && r < TOTAL_ROWS && (r < 0 || !board[r][c])
    );
  }
  function _ghostRow(p) {
    let dr = 0; while (_valid(p, dr+1)) dr++; return p.row + dr;
  }

  // ================================================================
  //  SPAWN
  // ================================================================
  function _spawn() {
    piece     = _makePiece(nextPiece);
    nextPiece = _nextFromBag();
    if (!_valid(piece)) _triggerGameOver();
    lockTimer = 0; lockReset = 0;
  }

  // ================================================================
  //  ROTATION (SRS)
  // ================================================================
  function _rotate(dir) {
    if (!piece) return;
    const from  = piece.rot;
    const to    = (from + (dir > 0 ? 1 : 3)) % 4;
    const key   = `${from}>${to}`;
    const kicks = (piece.type === 'I' ? KICKS_I : KICKS)[key] || [];

    if (_valid(piece, 0, 0, to)) {
      piece = { ...piece, rot: to }; _resetLock(); SoundManager.navigate(); return;
    }
    for (const [dc, dr] of kicks) {
      if (_valid(piece, dr, dc, to)) {
        piece = { ...piece, rot: to, row: piece.row+dr, col: piece.col+dc };
        _resetLock(); SoundManager.navigate(); return;
      }
    }
  }

  // ================================================================
  //  MOVEMENT
  // ================================================================
  function _move(dc) {
    if (!piece) return;
    if (_valid(piece, 0, dc)) { piece = { ...piece, col: piece.col+dc }; _resetLock(); }
  }
  function _softDrop() {
    if (!piece) return;
    if (_valid(piece, 1)) {
      piece = { ...piece, row: piece.row+1 };
      game.score += 1; _updateHUD(); lockTimer = 0;
    }
  }
  function _hardDrop() {
    if (!piece) return;
    const dr = _ghostRow(piece) - piece.row;
    piece = { ...piece, row: piece.row + dr };
    game.score += dr * 2;
    SoundManager.correct(); _lock();
  }
  function _resetLock() { if (lockReset < 15) { lockTimer = 0; lockReset++; } }

  // ================================================================
  //  LOCK
  // ================================================================
  function _lock() {
    if (!piece) return;
    _cells(piece).forEach(([r,c]) => { if (r >= 0) board[r][c] = COLORS[piece.type]; });
    SoundManager.click(); _clearLines(); _spawn();
  }

  // ================================================================
  //  LINE CLEAR
  // ================================================================
  function _clearLines() {
    const full = [];
    for (let r = 0; r < TOTAL_ROWS; r++) if (board[r].every(c => c !== null)) full.push(r);
    if (!full.length) { game.combo = 0; return; }

    lineFlash = full.map(r => ({ row: r, timer: 18 }));
    const n = full.length, combo = ++game.combo;
    let pts = POINTS[n] * game.level;
    if (combo > 1) pts += 50 * (combo - 1) * game.level;
    game.score += pts;
    game.lines += n;

    const newLv = Math.floor(game.lines / LEVEL_UP) + 1;
    if (newLv > game.level) {
      game.level = newLv;
      App.showToast(`Level ${game.level}! 🚀`, 'success', 1500);
    }

    full.forEach(r => {
      for (let c = 0; c < COLS; c++) _spawnParticles(c, r, board[r][c] || '#fff', 4);
    });
    for (const r of full.sort((a,b) => b-a)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(null));
    }

    _updateHUD(); SoundManager.correct();
    if (n === 4) App.showToast('TETRIS! 🎉', 'success', 2000);
    else if (combo > 2) App.showToast(`${combo}x COMBO! 🔥`, 'info', 1500);
  }

  // ================================================================
  //  PARTICLES
  // ================================================================
  function _spawnParticles(gc, gr, color, count) {
    const cs = _cellSize(), orig = _boardOrigin();
    const px = orig.x + gc*cs + cs/2;
    const py = orig.y + (gr - HIDDEN_ROWS)*cs + cs/2;
    for (let i = 0; i < count; i++) {
      const a = rnd(0, Math.PI*2), s = rnd(1,4);
      particles.push({
        x: px, y: py, vx: Math.cos(a)*s, vy: Math.sin(a)*s,
        life: rnd(20,45), maxLife: 45, color, size: rnd(2,5)
      });
    }
    if (particles.length > 400) particles.splice(0, particles.length - 400);
  }

  // ================================================================
  //  GAME OVER OVERLAY
  // ================================================================
  function _triggerGameOver() {
    game.over = true; game.running = false;
    const isNew = game.score > game.highScore;
    if (isNew) { game.highScore = game.score; localStorage.setItem('tet_hi', game.highScore); }
    ScoreManager.submitScore('tetris', game.score);
    setTimeout(() => _showGameOverOverlay(isNew), 800);
  }

  function _showGameOverOverlay(isNewBest) {
    _removeOverlay();
    const cont = _canvas ? _canvas.parentElement : null;
    if (!cont) { App.showGameResult(game.score, false); return; }

    _overlayEl = document.createElement('div');
    Object.assign(_overlayEl.style, {
      position: 'absolute', inset: '0', zIndex: '50',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)',
      animation: 'tet-pop 0.4s ease'
    });

    _overlayEl.innerHTML = `
      <div style="
        background:linear-gradient(135deg,#0a0a1e,#12122a);
        border:1px solid rgba(160,0,240,0.4);border-radius:20px;
        padding:2rem 1.8rem;max-width:320px;width:88%;text-align:center;
        box-shadow:0 0 40px rgba(160,0,240,0.2);
        display:flex;flex-direction:column;align-items:center;gap:0.85rem;">
        <div style="font-size:3rem;animation:tet-pulse 1s ease infinite">🧱</div>
        <div style="font-family:'Orbitron',sans-serif;
          font-size:clamp(1.1rem,3.5vw,1.4rem);font-weight:900;
          color:#f00;text-shadow:0 0 18px #f00;letter-spacing:2px">GAME OVER</div>
        ${isNewBest ? `
        <div style="background:rgba(255,215,0,0.12);
          border:1px solid rgba(255,215,0,0.4);border-radius:8px;
          padding:0.3rem 1rem;font-family:'Orbitron',sans-serif;
          font-size:0.72rem;color:#ffd700;letter-spacing:1px">
          🏆 NEW BEST SCORE!</div>` : ''}
        <div style="background:rgba(0,0,0,0.4);
          border:1px solid rgba(255,255,255,0.08);border-radius:12px;
          padding:0.9rem 1.4rem;width:100%;box-sizing:border-box">
          <div style="font-size:0.62rem;color:rgba(255,255,255,0.4);
            letter-spacing:2px;font-family:'Rajdhani',sans-serif;margin-bottom:3px">
            YOUR SCORE</div>
          <div style="font-family:'Orbitron',sans-serif;
            font-size:clamp(1.8rem,5vw,2.4rem);font-weight:900;
            color:#a000f0;text-shadow:0 0 18px #a000f0">${game.score}</div>
          <div style="display:flex;justify-content:center;gap:18px;margin-top:8px;
            font-family:'Rajdhani',sans-serif;font-size:0.7rem;
            color:rgba(255,255,255,0.35)">
            <span>Lines <b style="color:#0ff">${game.lines}</b></span>
            <span>Level <b style="color:#0ff">${game.level}</b></span>
            <span>Best  <b style="color:#0ff">${game.highScore}</b></span>
          </div>
        </div>
        <button id="tet-btn-replay" style="
          width:100%;padding:0.85rem;
          background:linear-gradient(135deg,#6600cc,#4400aa);
          color:#fff;border:none;border-radius:10px;
          font-family:'Orbitron',sans-serif;font-size:0.82rem;
          font-weight:700;letter-spacing:1px;cursor:pointer;
          display:flex;align-items:center;justify-content:center;gap:8px;
          box-shadow:0 0 18px rgba(160,0,240,0.4);touch-action:manipulation">
          <i class="fas fa-redo"></i> Play Again
        </button>
        <button id="tet-btn-home" style="
          width:100%;padding:0.72rem;
          background:rgba(255,255,255,0.05);
          color:rgba(255,255,255,0.65);
          border:1px solid rgba(255,255,255,0.12);border-radius:10px;
          font-family:'Orbitron',sans-serif;font-size:0.75rem;
          font-weight:700;letter-spacing:1px;cursor:pointer;
          display:flex;align-items:center;justify-content:center;gap:8px;
          touch-action:manipulation">
          <i class="fas fa-home"></i> Home
        </button>
      </div>`;

    cont.appendChild(_overlayEl);

    const rb = _overlayEl.querySelector('#tet-btn-replay');
    const hb = _overlayEl.querySelector('#tet-btn-home');
    const onReplay = () => { SoundManager.click(); Tetris.restart(); };
    const onHome   = () => { SoundManager.click(); _removeOverlay(); _stopLoop(); App.showGameResult(game.score, false); };
    rb.addEventListener('click', onReplay);
    rb.addEventListener('touchstart', e => { e.preventDefault(); onReplay(); }, { passive: false });
    hb.addEventListener('click', onHome);
    hb.addEventListener('touchstart', e => { e.preventDefault(); onHome(); }, { passive: false });
    if (isNewBest) setTimeout(() => { SoundManager.newBest(); App.showToast('🏆 New Best!', 'success', 2000); }, 400);
  }

  function _removeOverlay() {
    if (_overlayEl && _overlayEl.parentNode) _overlayEl.parentNode.removeChild(_overlayEl);
    _overlayEl = null;
  }

  // ================================================================
  //  HUD
  // ================================================================
  function _updateHUD() {
    App.updateScoreDisplay(game.score, ScoreManager.getBestScore('tetris'));
  }

  // ================================================================
  //  CONTROL MANAGER INTEGRATION
  // ================================================================
  /*
    Your HTML button mapping (from index.html):
    ──────────────────────────────────────────
    D-pad:
      data-key="ArrowUp"    → Rotate CW
      data-key="ArrowLeft"  → Move Left
      data-key="ArrowRight" → Move Right
      data-key="ArrowDown"  → Soft Drop

    Action buttons:
      data-key=" "  (btn-a)  → Hard Drop
      data-key="z"  (btn-b)  → Rotate CCW

    Desktop keyboard (same keys + extras):
      ArrowLeft / ArrowRight → move
      ArrowDown              → soft drop
      ArrowUp                → rotate CW
      z / Z                  → rotate CCW
      Space                  → hard drop
      x / X                  → rotate CW (alt)
    ──────────────────────────────────────────
  */
  function _attachControls() {
    ControlManager.on('keydown', 'tetris', (key) => {
      if (!game.running) return;
      _held[key] = true;

      switch (key) {
        case 'ArrowLeft':                       _move(-1);   _dasLeft.n  = 0; break;
        case 'ArrowRight':                      _move(1);    _dasRight.n = 0; break;
        case 'ArrowDown':                       _softDrop(); _dasSoft.n  = 0; break;
        case 'ArrowUp':   case 'x': case 'X':  _rotate(1);  break;
        case 'z':         case 'Z':             _rotate(-1); break;
        case ' ':         case 'Enter':         _hardDrop(); break;
      }
    });

    ControlManager.on('keyup', 'tetris', (key) => {
      _held[key] = false;
      if (key === 'ArrowLeft')  _dasLeft.n  = 0;
      if (key === 'ArrowRight') _dasRight.n = 0;
      if (key === 'ArrowDown')  _dasSoft.n  = 0;
    });
  }

  function _detachControls() {
    ControlManager.off('keydown', 'tetris');
    ControlManager.off('keyup',   'tetris');
    ControlManager.clearKeys();
    Object.keys(_held).forEach(k => { _held[k] = false; });
    _dasLeft.n = 0; _dasRight.n = 0; _dasSoft.n = 0;
  }

  // Per-frame DAS processing for held keys
  function _processHeld() {
    if (!game.running) return;

    if (_held['ArrowLeft']) {
      _dasLeft.n++;
      if (_dasLeft.n > DAS_DELAY && (_dasLeft.n - DAS_DELAY) % DAS_SPEED === 0) _move(-1);
    }
    if (_held['ArrowRight']) {
      _dasRight.n++;
      if (_dasRight.n > DAS_DELAY && (_dasRight.n - DAS_DELAY) % DAS_SPEED === 0) _move(1);
    }
    if (_held['ArrowDown']) {
      _dasSoft.n++;
      if (_dasSoft.n > 4 && _dasSoft.n % 3 === 0) _softDrop();
    }
  }

  // ================================================================
  //  TOUCH CONTROLS — show existing #touch-controls with correct btns
  // ================================================================
  function _setupTouchControls() {
    /*
      We use your existing HTML buttons exactly as-is:
        dpad-up    data-key="ArrowUp"    → Rotate CW
        dpad-left  data-key="ArrowLeft"  → Move Left
        dpad-right data-key="ArrowRight" → Move Right
        dpad-down  data-key="ArrowDown"  → Soft Drop
        btn-a      data-key=" "          → Hard Drop
        btn-b      data-key="z"          → Rotate CCW

      We relabel the icons so players understand Tetris context.
    */
    ControlManager.showTouchControls({
      dpad:    true,
      actions: true,
      center:  false
    });
    _relabelButtons();
  }

  function _relabelButtons() {
    // Map data-key → new inner HTML  (icon + tiny label)
    const map = {
      'ArrowUp':    { icon: '↻',    sub: 'Rotate' },
      'ArrowLeft':  { icon: '◀',    sub: 'Left'   },
      'ArrowRight': { icon: '▶',    sub: 'Right'  },
      'ArrowDown':  { icon: '▼',    sub: 'Soft'   },
      ' ':          { icon: '⬇⬇',  sub: 'Drop'   },
      'z':          { icon: '↺',    sub: 'Rotate' }
    };

    Object.entries(map).forEach(([key, { icon, sub }]) => {
      // target both dpad-btn and action-btn with matching data-key
      const sel = `.dpad-btn[data-key="${key}"], .action-btn[data-key="${key}"]`;
      document.querySelectorAll(sel).forEach(btn => {
        btn.innerHTML = `
          <span style="display:block;font-size:1.15em;line-height:1.1">${icon}</span>
          <span style="display:block;font-size:clamp(7px,1.5vw,9px);
            opacity:0.6;font-family:'Rajdhani',sans-serif;
            letter-spacing:0.4px;margin-top:1px">${sub}</span>`;
      });
    });
  }

  function _restoreButtonLabels() {
    // Restore original icon-only labels from index.html
    const orig = {
      'ArrowUp':    '<i class="fas fa-chevron-up"></i>',
      'ArrowLeft':  '<i class="fas fa-chevron-left"></i>',
      'ArrowRight': '<i class="fas fa-chevron-right"></i>',
      'ArrowDown':  '<i class="fas fa-chevron-down"></i>',
      ' ':          'A',
      'z':          'B'
    };
    Object.entries(orig).forEach(([key, html]) => {
      const sel = `.dpad-btn[data-key="${key}"], .action-btn[data-key="${key}"]`;
      document.querySelectorAll(sel).forEach(btn => { btn.innerHTML = html; });
    });
  }

  // ================================================================
  //  DOM / RESIZE
  // ================================================================
  function _buildDOM(container) {
    Object.assign(container.style, {
      position: 'relative', overflow: 'hidden',
      background: '#000', width: '100%', height: '100%'
    });

    _canvas = document.createElement('canvas');
    Object.assign(_canvas.style, {
      position: 'absolute', top: '0', left: '0',
      width: '100%', height: '100%', zIndex: '1', display: 'block'
    });
    container.appendChild(_canvas);
    _ctx = _canvas.getContext('2d');

    _injectCSS();
    _resize();
    _resizeHandler = () => _resize();
    window.addEventListener('resize', _resizeHandler);
  }

  function _resize() {
    if (!_canvas) return;
    const p = _canvas.parentElement;
    _canvas.width  = p ? p.clientWidth  : window.innerWidth;
    _canvas.height = p ? p.clientHeight : window.innerHeight;
  }

  function _injectCSS() {
    if (document.getElementById('tet-kf')) return;
    const s = document.createElement('style');
    s.id = 'tet-kf';
    s.textContent = `
      @keyframes tet-pop   { 0%{transform:scale(0.7);opacity:0} 60%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
      @keyframes tet-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      @keyframes tet-spin  { to{transform:rotate(360deg)} }
      @keyframes tet-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
    `;
    document.head.appendChild(s);
  }

  // ================================================================
  //  LOADING OVERLAY
  // ================================================================
  function _showLoadingOverlay() {
    _loadingEl = document.createElement('div');
    Object.assign(_loadingEl.style, {
      position: 'absolute', inset: '0', zIndex: '100',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center,#0a0a1e,#000)', gap: '18px'
    });
    _loadingEl.innerHTML = `
      <div style="font-size:clamp(3rem,10vw,5rem);animation:tet-float 2s ease-in-out infinite">🧱</div>
      <div style="font-family:'Orbitron',sans-serif;font-size:clamp(1rem,3vw,1.4rem);
        font-weight:700;color:#a000f0;text-shadow:0 0 20px #a000f0;letter-spacing:3px">TETRIS</div>
      <div style="width:44px;height:44px;border:4px solid rgba(160,0,240,0.15);
        border-top-color:#a000f0;border-radius:50%;animation:tet-spin 0.8s linear infinite"></div>`;
    if (_canvas && _canvas.parentNode) _canvas.parentNode.appendChild(_loadingEl);
    setTimeout(() => {
      if (_loadingEl) {
        _loadingEl.style.transition = 'opacity 0.4s';
        _loadingEl.style.opacity    = '0';
        setTimeout(() => {
          if (_loadingEl && _loadingEl.parentNode) _loadingEl.parentNode.removeChild(_loadingEl);
          _loadingEl = null;
        }, 420);
      }
    }, 600);
  }

  // ================================================================
  //  GAME FLOW
  // ================================================================
  function _startGame() {
    _stopLoop();
    _emptyBoard();
    particles = []; lineFlash = [];
    _bag = []; _refillBag();
    nextPiece = _nextFromBag();

    game.running = true; game.over  = false;
    game.score   = 0;    game.lines = 0;
    game.level   = 1;    game.combo = 0; game.time = 0;
    _dropAccum   = 0;    _lastTime  = 0;

    Object.keys(_held).forEach(k => { _held[k] = false; });
    _dasLeft.n = 0; _dasRight.n = 0; _dasSoft.n = 0;

    _spawn();
    _updateHUD();
    SoundManager.gameStart();
    _startLoop();
  }

  // ================================================================
  //  UPDATE
  // ================================================================
  function _update(dt) {
    if (!game.running) { _updateParticles(); return; }
    game.time++;

    _processHeld();

    // Gravity
    _dropAccum += dt;
    const interval = _dropInterval();
    while (_dropAccum >= interval) {
      _dropAccum -= interval;
      if (piece) {
        if (_valid(piece, 1)) { piece = { ...piece, row: piece.row + 1 }; lockTimer = 0; }
        else { lockTimer++; if (lockTimer >= LOCK_DELAY) _lock(); }
      }
    }

    lineFlash = lineFlash.filter(f => { f.timer--; return f.timer > 0; });
    _updateParticles();
  }

  function _updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // ================================================================
  //  DRAW
  // ================================================================
  function _draw() {
    if (!_ctx) return;
    _ctx.clearRect(0, 0, W(), H());
    _ctx.fillStyle = '#080810';
    _ctx.fillRect(0, 0, W(), H());

    const cs   = _cellSize();
    const orig = _boardOrigin();
    const bw   = cs * COLS;
    const bh   = cs * ROWS;

    // ---- Board border ----
    _ctx.save();
    _ctx.fillStyle   = 'rgba(255,255,255,0.03)';
    _ctx.strokeStyle = 'rgba(160,0,240,0.35)';
    _ctx.lineWidth   = 1.5;
    _roundRect(orig.x - 2, orig.y - 2, bw + 4, bh + 4, 4);
    _ctx.fill(); _ctx.stroke();
    _ctx.restore();

    // ---- Grid lines ----
    _ctx.save();
    _ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    _ctx.lineWidth   = 0.5;
    for (let r = 0; r <= ROWS; r++) {
      _ctx.beginPath();
      _ctx.moveTo(orig.x, orig.y + r*cs);
      _ctx.lineTo(orig.x + bw, orig.y + r*cs);
      _ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      _ctx.beginPath();
      _ctx.moveTo(orig.x + c*cs, orig.y);
      _ctx.lineTo(orig.x + c*cs, orig.y + bh);
      _ctx.stroke();
    }
    _ctx.restore();

    // ---- Placed cells ----
    for (let r = HIDDEN_ROWS; r < TOTAL_ROWS; r++) {
      const dr      = r - HIDDEN_ROWS;
      const isFlash = lineFlash.some(f => f.row === r);
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]) {
          if (isFlash) _drawCell(orig.x + c*cs, orig.y + dr*cs, cs, '#fff', '#ccc', 1);
          else         _drawCell(orig.x + c*cs, orig.y + dr*cs, cs, board[r][c], SHADOW[_typeFromColor(board[r][c])]);
        }
      }
    }

    // ---- Ghost piece ----
    if (piece && game.running) {
      const gr = _ghostRow(piece);
      if (gr !== piece.row) {
        _ctx.save(); _ctx.globalAlpha = 0.18;
        SHAPES[piece.type][piece.rot].forEach(([dr, dc]) => {
          const rr = gr + dr, cc = piece.col + dc;
          if (rr >= HIDDEN_ROWS)
            _drawCell(orig.x + cc*cs, orig.y + (rr - HIDDEN_ROWS)*cs, cs, COLORS[piece.type], SHADOW[piece.type]);
        });
        _ctx.restore();
      }
    }

    // ---- Active piece ----
    if (piece) {
      const blink = Math.floor(game.time / 4) % 2 === 0;
      const alpha = (lockTimer > LOCK_DELAY * 0.7 && !blink) ? 0.45 : 1;
      _ctx.save(); _ctx.globalAlpha = alpha;
      SHAPES[piece.type][piece.rot].forEach(([dr, dc]) => {
        const rr = piece.row + dr, cc = piece.col + dc;
        if (rr >= HIDDEN_ROWS)
          _drawCell(orig.x + cc*cs, orig.y + (rr - HIDDEN_ROWS)*cs, cs, COLORS[piece.type], SHADOW[piece.type]);
      });
      _ctx.restore();
    }

    // ---- Particles ----
    particles.forEach(p => {
      const a = Math.max(0, p.life / p.maxLife);
      _ctx.save();
      _ctx.globalAlpha = a;
      _ctx.fillStyle   = p.color;
      _ctx.shadowColor = p.color;
      _ctx.shadowBlur  = 6;
      _ctx.beginPath();
      _ctx.arc(p.x, p.y, Math.max(0.5, p.size * a), 0, Math.PI * 2);
      _ctx.fill();
      _ctx.restore();
    });

    // ---- Desktop side panels (NEXT + STATS + KEY HINTS) ----
    // Only draw when NOT a touch device — avoids clutter on mobile
    if (!_touch()) _drawDesktopPanels(orig, cs, bw, bh);

    // ---- Mobile minimal HUD (level indicator top-right of board) ----
    if (_touch()) _drawMobileHUD(orig, cs, bw);
  }

  // ================================================================
  //  DESKTOP PANELS  (NEXT piece + stats + key hints)
  //  Only rendered on non-touch devices
  // ================================================================
  function _drawDesktopPanels(orig, cs, bw, bh) {
    const rightX = orig.x + bw + 16;
    const leftX  = orig.x - cs * 4 - 16;
    const panelW = cs * 4;
    const font   = `'Orbitron', sans-serif`;
    const lblSz  = Math.max(9, cs * 0.38);

    // ── RIGHT: NEXT piece ──
    _ctx.save();
    _ctx.fillStyle   = 'rgba(255,255,255,0.03)';
    _ctx.strokeStyle = 'rgba(160,0,240,0.22)';
    _ctx.lineWidth   = 1;
    _roundRect(rightX, orig.y, panelW, cs * 5.5, 6);
    _ctx.fill(); _ctx.stroke();

    _ctx.fillStyle = 'rgba(160,0,240,0.85)';
    _ctx.font      = `bold ${lblSz}px ${font}`;
    _ctx.textAlign = 'center';
    _ctx.fillText('NEXT', rightX + panelW/2, orig.y + lblSz + 8);

    if (nextPiece) {
      _drawMiniPiece(nextPiece, rightX + panelW/2, orig.y + lblSz + 26 + cs * 1.2, cs * 0.72);
    }
    _ctx.restore();

    // ── LEFT: STATS ──
    _ctx.save();
    _ctx.fillStyle   = 'rgba(255,255,255,0.03)';
    _ctx.strokeStyle = 'rgba(0,240,240,0.22)';
    _ctx.lineWidth   = 1;
    _roundRect(leftX, orig.y, panelW, cs * 8, 6);
    _ctx.fill(); _ctx.stroke();

    const statSz   = Math.max(8, cs * 0.35);
    const statFont = `'Rajdhani', sans-serif`;
    const statsY   = orig.y + cs * 0.6;

    [['SCORE', game.score], ['LINES', game.lines], ['LEVEL', game.level]].forEach(([lbl, val], i) => {
      const sy = statsY + i * (cs * 1.7);
      _ctx.fillStyle = 'rgba(255,255,255,0.45)';
      _ctx.font      = `${statSz}px ${statFont}`;
      _ctx.textAlign = 'center';
      _ctx.fillText(lbl, leftX + panelW/2, sy + statSz);
      _ctx.fillStyle = '#fff';
      _ctx.font      = `bold ${statSz * 1.4}px ${font}`;
      _ctx.fillText(val, leftX + panelW/2, sy + statSz * 2.8);
    });
    _ctx.restore();

    // ── KEY HINTS (below left panel) ──
    _drawKeyHints(leftX, panelW, orig.y + cs * 8 + 12, cs);
  }

  function _drawKeyHints(x, w, startY, cs) {
    const hints = [
      ['← →',   'Move'],
      ['↑ / X',  'Rotate CW'],
      ['Z',      'Rotate CCW'],
      ['↓',      'Soft Drop'],
      ['Space',  'Hard Drop']
    ];
    const sz   = Math.max(7, cs * 0.27);
    const font = `'Orbitron', sans-serif`;
    _ctx.save();
    _ctx.textAlign = 'center';
    hints.forEach(([key, desc], i) => {
      const y = startY + i * (sz * 2.5);
      _ctx.font      = `bold ${sz}px ${font}`;
      _ctx.fillStyle = 'rgba(160,0,240,0.65)';
      _ctx.fillText(key, x + w/2, y);
      _ctx.font      = `${sz * 0.85}px 'Rajdhani', sans-serif`;
      _ctx.fillStyle = 'rgba(255,255,255,0.28)';
      _ctx.fillText(desc, x + w/2, y + sz * 1.2);
    });
    _ctx.restore();
  }

  // ================================================================
  //  MOBILE MINIMAL HUD — level badge + score inside board area
  //  Drawn as a compact bar at the top of the canvas (above board)
  // ================================================================
  function _drawMobileHUD(orig, cs, bw) {
    const y    = orig.y - cs * 0.55;
    const font = `'Orbitron', sans-serif`;
    const sz   = Math.max(9, cs * 0.38);

    _ctx.save();
    _ctx.textAlign = 'left';
    _ctx.font      = `bold ${sz}px ${font}`;
    _ctx.fillStyle = 'rgba(160,0,240,0.85)';
    _ctx.fillText(`LV ${game.level}`, orig.x, y);

    _ctx.textAlign = 'right';
    _ctx.fillStyle = 'rgba(255,255,255,0.7)';
    _ctx.fillText(`${game.lines} lines`, orig.x + bw, y);
    _ctx.restore();
  }

  // ================================================================
  //  DRAW HELPERS
  // ================================================================
  function _drawCell(x, y, cs, color, shadow, alpha = 1) {
    const pad = Math.max(1, cs * 0.05);
    _ctx.save();
    _ctx.globalAlpha *= alpha;
    // Shadow layer
    _ctx.fillStyle = shadow || '#333';
    _ctx.fillRect(x + pad, y + pad, cs - pad*2, cs - pad*2);
    // Gradient fill
    const g = _ctx.createLinearGradient(x, y, x + cs, y + cs);
    g.addColorStop(0,   _lighten(color, 30));
    g.addColorStop(0.5, color);
    g.addColorStop(1,   _darken(color, 30));
    _ctx.fillStyle = g;
    _ctx.fillRect(x + pad, y + pad, cs - pad*2 - 2, cs - pad*2 - 2);
    // Gloss
    _ctx.fillStyle = 'rgba(255,255,255,0.17)';
    _ctx.fillRect(x + pad, y + pad, cs - pad*2 - 2, Math.floor(cs * 0.3));
    _ctx.restore();
  }

  function _drawMiniPiece(type, cx, cy, cs) {
    const shape = SHAPES[type][0];
    const minR  = Math.min(...shape.map(([r])   => r));
    const maxR  = Math.max(...shape.map(([r])   => r));
    const minC  = Math.min(...shape.map(([,c])  => c));
    const maxC  = Math.max(...shape.map(([,c])  => c));
    const offX  = -(minC + maxC + 1) / 2 * cs;
    const offY  = -(minR + maxR + 1) / 2 * cs;
    shape.forEach(([r, c]) =>
      _drawCell(cx + offX + c*cs, cy + offY + r*cs, cs, COLORS[type], SHADOW[type])
    );
  }

  function _roundRect(x, y, w, h, r) {
    _ctx.beginPath();
    _ctx.moveTo(x+r, y);
    _ctx.lineTo(x+w-r, y);    _ctx.arcTo(x+w, y,   x+w,   y+r,   r);
    _ctx.lineTo(x+w, y+h-r);  _ctx.arcTo(x+w, y+h, x+w-r, y+h,   r);
    _ctx.lineTo(x+r, y+h);    _ctx.arcTo(x,   y+h, x,     y+h-r, r);
    _ctx.lineTo(x, y+r);      _ctx.arcTo(x,   y,   x+r,   y,     r);
    _ctx.closePath();
  }

  function _lighten(h, a) { return _shiftColor(h,  a); }
  function _darken(h, a)  { return _shiftColor(h, -a); }
  function _shiftColor(hex, amt) {
    const n = parseInt(hex.replace('#',''), 16);
    const r = Math.min(255, Math.max(0, (n >> 16) + amt));
    const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
    const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
    return `rgb(${r},${g},${b})`;
  }

  const _colorTypeMap = Object.fromEntries(Object.entries(COLORS).map(([k,v]) => [v, k]));
  function _typeFromColor(c) { return _colorTypeMap[c] || 'I'; }

  // ================================================================
  //  MAIN LOOP
  // ================================================================
  function _loop(ts) {
    const dt = _lastTime ? Math.min(ts - _lastTime, 100) : 16;
    _lastTime = ts;
    _update(dt);
    _draw();
    _animId = requestAnimationFrame(_loop);
  }

  function _startLoop() {
    _stopLoop(); _running = true;
    _animId = requestAnimationFrame(_loop);
  }
  function _stopLoop() {
    _running = false;
    if (_animId) { cancelAnimationFrame(_animId); _animId = null; }
  }

  // ================================================================
  //  PUBLIC OBJECT
  // ================================================================
  const Tetris = {
    start(container) {
      _buildDOM(container);
      _showLoadingOverlay();
      _attachControls();
      _setupTouchControls();
      setTimeout(() => _startGame(), 650);
    },
    destroy() {
      _stopLoop();
      _detachControls();
      _restoreButtonLabels();
      ControlManager.hideTouchControls();
      if (_resizeHandler) window.removeEventListener('resize', _resizeHandler);
      [_loadingEl, _overlayEl, _canvas].forEach(el => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
      _canvas = _ctx = null;
      _loadingEl = _overlayEl = null;
      game.running = false;
    },
    restart() { _removeOverlay(); _startGame(); }
  };

  // ================================================================
  //  REGISTER
  // ================================================================
  GameRegistry.register({
    id:          'tetris',
    title:       'Tetris',
    category:    'puzzle',
    description: 'Classic Tetris — ghost piece, combos & levels!',
    emoji:       '🧱',
    difficulty:  'medium',
    controls:    { dpad: true, actions: true, center: false },
    version:     '1.0',
    init:        (c) => Tetris.start(c),
    destroy:     () => Tetris.destroy(),
    restart:     () => Tetris.restart()
  });

})();
