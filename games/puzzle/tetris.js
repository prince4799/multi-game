/* ================================================
   TETRIS v1.0
   Classic tetris with modern visuals, hold piece,
   ghost piece, levels, combos, in-canvas game-over
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
    I: '#00f0f0',
    O: '#f0f000',
    T: '#a000f0',
    S: '#00f000',
    Z: '#f00000',
    J: '#0000f0',
    L: '#f0a000'
  };

  const SHADOW = {
    I: '#00a0a0',
    O: '#a0a000',
    T: '#6800a0',
    S: '#008000',
    Z: '#a00000',
    J: '#000080',
    L: '#a06800'
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
    '0>1': [[-1,0],[-1,1],[0,-2],[-1,-2]],
    '1>0': [[ 1,0],[ 1,-1],[0,2],[1,2]],
    '1>2': [[ 1,0],[ 1,-1],[0,2],[1,2]],
    '2>1': [[-1,0],[-1,1],[0,-2],[-1,-2]],
    '2>3': [[ 1,0],[ 1,1],[0,-2],[1,-2]],
    '3>2': [[-1,0],[-1,-1],[0,2],[-1,2]],
    '3>0': [[-1,0],[-1,-1],[0,2],[-1,2]],
    '0>3': [[ 1,0],[ 1,1],[0,-2],[1,-2]]
  };
  const KICKS_I = {
    '0>1': [[-2,0],[1,0],[-2,-1],[1,2]],
    '1>0': [[ 2,0],[-1,0],[2,1],[-1,-2]],
    '1>2': [[-1,0],[2,0],[-1,2],[2,-1]],
    '2>1': [[ 1,0],[-2,0],[1,-2],[-2,1]],
    '2>3': [[ 2,0],[-1,0],[2,1],[-1,-2]],
    '3>2': [[-2,0],[1,0],[-2,-1],[1,2]],
    '3>0': [[ 1,0],[-2,0],[1,-2],[-2,1]],
    '0>3': [[-1,0],[2,0],[-1,2],[2,-1]]
  };

  const POINTS     = [0, 100, 300, 500, 800];
  const LEVEL_UP   = 10;
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
  let _hudEl         = null;
  let _padEl         = null;   // mobile gamepad element
  let _resizeHandler = null;
  let _isMobile      = false;

  let _lastTime  = 0;
  let _dropAccum = 0;

  // Keyboard state
  const _keys     = {};
  const _dasState = { left: 0, right: 0 };

  let _bKeyDown = null;
  let _bKeyUp   = null;

  // Gamepad button pressed state (for repeat)
  const _padHeld    = {};
  const _padDas     = { left: 0, right: 0, down: 0 };

  const game = {
    running:   false,
    over:      false,
    score:     0,
    lines:     0,
    level:     1,
    combo:     0,
    highScore: parseInt(localStorage.getItem('tet_hi') || '0'),
    time:      0
  };

  let board      = [];
  let piece      = null;
  let nextQueue  = [];
  let holdPiece  = null;
  let holdUsed   = false;

  let lockTimer  = 0;
  let lockReset  = 0;

  let particles  = [];
  let lineFlash  = [];

  // ================================================================
  //  HELPERS
  // ================================================================
  function W()      { return _canvas ? _canvas.width  : window.innerWidth;  }
  function H()      { return _canvas ? _canvas.height : window.innerHeight; }
  function rnd(a,b) { return Math.random()*(b-a)+a; }

  function _isMobileDevice() {
    return window.matchMedia('(pointer: coarse)').matches;
  }

  function _cellSize() {
    const padH  = _isMobile ? H() * 0.28 : 0;   // reserve space for pad
    const availH = (H() - padH) * 0.92;
    const maxH  = availH / ROWS;
    const maxW  = (W() * 0.54) / COLS;
    return Math.floor(Math.min(maxH, maxW, 34));
  }

  function _boardOrigin() {
    const cs  = _cellSize();
    const bw  = cs * COLS;
    const bh  = cs * ROWS;
    const padH = _isMobile ? H() * 0.28 : 0;
    return {
      x: Math.floor((W() - bw) / 2) - Math.floor(cs * 2),
      y: Math.floor(((H() - padH) - bh) / 2)
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
    if (_bag.length === 0) _refillBag();
    return _bag.pop();
  }

  // ================================================================
  //  BOARD
  // ================================================================
  function _emptyBoard() {
    board = [];
    for (let r = 0; r < TOTAL_ROWS; r++) {
      board.push(new Array(COLS).fill(null));
    }
  }

  // ================================================================
  //  PIECE
  // ================================================================
  function _makePiece(type) {
    return { type, rot: 0, row: 0, col: Math.floor(COLS/2) - 2 };
  }
  function _cells(p) {
    return SHAPES[p.type][p.rot].map(([r,c]) => [r+p.row, c+p.col]);
  }
  function _valid(p, dr=0, dc=0, rot=p.rot) {
    const t = { ...p, row: p.row+dr, col: p.col+dc, rot };
    return _cells(t).every(([r,c]) =>
      c >= 0 && c < COLS && r < TOTAL_ROWS && (r < 0 || !board[r][c])
    );
  }
  function _ghostRow(p) {
    let dr = 0;
    while (_valid(p, dr+1)) dr++;
    return p.row + dr;
  }

  // ================================================================
  //  SPAWN
  // ================================================================
  function _spawn() {
    holdUsed = false;
    piece = _makePiece(nextQueue.shift());
    nextQueue.push(_nextFromBag());
    if (!_valid(piece)) _triggerGameOver();
    lockTimer = 0; lockReset = 0;
  }

  // ================================================================
  //  ROTATION (SRS)
  // ================================================================
  function _rotate(dir) {
    if (!piece) return;
    const fromRot = piece.rot;
    const toRot   = (fromRot + (dir > 0 ? 1 : 3)) % 4;
    const key     = `${fromRot}>${toRot}`;
    const kicks   = (piece.type === 'I' ? KICKS_I : KICKS)[key] || [];

    if (_valid(piece, 0, 0, toRot)) {
      piece = { ...piece, rot: toRot };
      _resetLock(); SoundManager.navigate(); return;
    }
    for (const [dc, dr] of kicks) {
      if (_valid(piece, dr, dc, toRot)) {
        piece = { ...piece, rot: toRot, row: piece.row+dr, col: piece.col+dc };
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
    piece = { ...piece, row: piece.row+dr };
    game.score += dr * 2;
    SoundManager.correct(); _lock();
  }
  function _resetLock() {
    if (lockReset < 15) { lockTimer = 0; lockReset++; }
  }

  // ================================================================
  //  HOLD
  // ================================================================
  function _hold() {
    if (!piece || holdUsed) return;
    const hType = holdPiece ? holdPiece.type : null;
    holdPiece = { type: piece.type };
    holdUsed  = true;
    if (hType) { piece = _makePiece(hType); }
    else       { _spawn(); return; }
    lockTimer = 0; lockReset = 0;
    SoundManager.navigate();
  }

  // ================================================================
  //  LOCK
  // ================================================================
  function _lock() {
    if (!piece) return;
    _cells(piece).forEach(([r,c]) => { if (r >= 0) board[r][c] = COLORS[piece.type]; });
    SoundManager.click();
    _clearLines();
    _spawn();
  }

  // ================================================================
  //  LINE CLEAR
  // ================================================================
  function _clearLines() {
    const full = [];
    for (let r = 0; r < TOTAL_ROWS; r++) {
      if (board[r].every(c => c !== null)) full.push(r);
    }
    if (full.length === 0) { game.combo = 0; return; }

    lineFlash = full.map(r => ({ row: r, timer: 18 }));

    const n   = full.length;
    const combo = ++game.combo;
    let pts  = POINTS[n] * game.level;
    if (combo > 1) pts += 50 * (combo-1) * game.level;
    game.score += pts;
    game.lines += n;

    const newLevel = Math.floor(game.lines / LEVEL_UP) + 1;
    if (newLevel > game.level) {
      game.level = newLevel;
      App.showToast(`Level ${game.level}! 🚀`, 'success', 1500);
    }

    full.forEach(r => {
      for (let c = 0; c < COLS; c++) _spawnParticles(c, r, board[r][c] || '#fff', 4);
    });

    for (const r of full.sort((a,b) => b-a)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(null));
    }

    _updateHUD();
    SoundManager.correct();
    if (n === 4) App.showToast('TETRIS! 🎉', 'success', 2000);
    else if (combo > 2) App.showToast(`${combo}x COMBO! 🔥`, 'info', 1500);
  }

  // ================================================================
  //  PARTICLES
  // ================================================================
  function _spawnParticles(gc, gr, color, count) {
    const cs   = _cellSize();
    const orig = _boardOrigin();
    const px   = orig.x + gc*cs + cs/2;
    const py   = orig.y + (gr - HIDDEN_ROWS)*cs + cs/2;
    for (let i = 0; i < count; i++) {
      const a = rnd(0, Math.PI*2), s = rnd(1,4);
      particles.push({
        x: px, y: py,
        vx: Math.cos(a)*s, vy: Math.sin(a)*s,
        life: rnd(20,45), maxLife: 45,
        color, size: rnd(2,5)
      });
    }
    if (particles.length > 400) particles.splice(0, particles.length-400);
  }

  // ================================================================
  //  GAME OVER
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
    rb.addEventListener('click',      onReplay);
    rb.addEventListener('touchstart', e => { e.preventDefault(); onReplay(); }, { passive: false });
    hb.addEventListener('click',      onHome);
    hb.addEventListener('touchstart', e => { e.preventDefault(); onHome(); },   { passive: false });
    if (isNewBest) {
      setTimeout(() => { SoundManager.newBest(); App.showToast('🏆 New Best!', 'success', 2000); }, 400);
    }
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
  //  KEYBOARD INPUT
  // ================================================================
  function _attachKeyboard() {
    _bKeyDown = (e) => {
      if (!game.running) return;
      if (['Space','ArrowLeft','ArrowRight','ArrowDown','ArrowUp'].includes(e.code)) e.preventDefault();
      _keys[e.code] = true;
      switch (e.code) {
        case 'ArrowLeft':  case 'KeyA': _move(-1); _dasState.left=0;  break;
        case 'ArrowRight': case 'KeyD': _move( 1); _dasState.right=0; break;
        case 'ArrowDown':  case 'KeyS': _softDrop(); break;
        case 'ArrowUp':    case 'KeyW': case 'KeyX': _rotate(1);  break;
        case 'KeyZ':                                  _rotate(-1); break;
        case 'Space':       _hardDrop(); break;
        case 'ShiftLeft': case 'ShiftRight': case 'KeyC': _hold(); break;
      }
    };
    _bKeyUp = (e) => {
      _keys[e.code] = false;
      if (e.code === 'ArrowLeft'  || e.code === 'KeyA') _dasState.left  = 0;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') _dasState.right = 0;
    };
    window.addEventListener('keydown', _bKeyDown);
    window.addEventListener('keyup',   _bKeyUp);
  }

  // ================================================================
  //  MOBILE GAMEPAD
  // ================================================================
  /*
    Layout (bottom of screen):

    [ ← ]  [ → ]    [ ↺ CCW ] [ ↻ CW ]
    [ ↓ soft ]       [  HOLD  ]
    [    ▼ HARD DROP (wide)   ]
  */

  function _buildGamepad(container) {
    _padEl = document.createElement('div');
    Object.assign(_padEl.style, {
      position:  'absolute',
      bottom:    '0', left: '0', right: '0',
      height:    '28%',
      zIndex:    '20',
      display:   'grid',
      gridTemplateColumns: '1fr 1fr 1fr 1fr',
      gridTemplateRows:    '1fr 1fr 1fr',
      gap:       '5px',
      padding:   '6px 8px 10px',
      boxSizing: 'border-box',
      background:'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
      userSelect:'none'
    });

    // Button definitions: [label, icon, gridArea, action, repeatType]
    // repeatType: 'once' | 'hold' | 'das'
    const btns = [
      // Row 1
      { id:'pad-left',  icon:'◀',   label:'Left',     area:'1/1/2/2', action:()=>_move(-1),   repeat:'das-left'  },
      { id:'pad-right', icon:'▶',   label:'Right',    area:'1/2/2/3', action:()=>_move( 1),   repeat:'das-right' },
      { id:'pad-ccw',   icon:'↺',   label:'Rotate↺',  area:'1/3/2/4', action:()=>_rotate(-1), repeat:'once'      },
      { id:'pad-cw',    icon:'↻',   label:'Rotate↻',  area:'1/4/2/5', action:()=>_rotate( 1), repeat:'once'      },
      // Row 2
      { id:'pad-soft',  icon:'▼',   label:'Soft',     area:'2/1/3/3', action:()=>_softDrop(), repeat:'hold'      },
      { id:'pad-hold',  icon:'⊞',   label:'Hold',     area:'2/3/3/5', action:()=>_hold(),     repeat:'once'      },
      // Row 3 — hard drop full width
      { id:'pad-hard',  icon:'⬇⬇', label:'Hard Drop', area:'3/1/4/5', action:()=>_hardDrop(), repeat:'once'      }
    ];

    btns.forEach(b => {
      const btn = document.createElement('button');
      btn.id = b.id;
      Object.assign(btn.style, {
        gridArea:      b.area,
        background:    'rgba(255,255,255,0.08)',
        border:        '1px solid rgba(255,255,255,0.18)',
        borderRadius:  '10px',
        color:         '#fff',
        fontSize:      'clamp(14px,4vw,22px)',
        fontFamily:    "'Orbitron', sans-serif",
        cursor:        'pointer',
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        justifyContent:'center',
        gap:           '2px',
        touchAction:   'manipulation',
        WebkitUserSelect: 'none',
        transition:    'background 0.08s, transform 0.08s',
        outline:       'none'
      });

      // Label below icon
      btn.innerHTML = `
        <span style="font-size:1em;line-height:1">${b.icon}</span>
        <span style="font-size:clamp(7px,1.8vw,10px);opacity:0.55;
          letter-spacing:0.5px;font-family:'Rajdhani',sans-serif">
          ${b.label}
        </span>`;

      // Active state style
      const setActive = (on) => {
        btn.style.background = on
          ? 'rgba(160,0,240,0.45)'
          : 'rgba(255,255,255,0.08)';
        btn.style.transform = on ? 'scale(0.93)' : 'scale(1)';
        btn.style.borderColor = on
          ? 'rgba(160,0,240,0.8)'
          : 'rgba(255,255,255,0.18)';
      };

      // Touch handling
      const onDown = (e) => {
        e.preventDefault();
        if (!game.running) return;
        setActive(true);
        b.action();
        _padHeld[b.id]  = true;
        _padDas[b.id]   = 0;
      };
      const onUp = (e) => {
        e.preventDefault();
        setActive(false);
        _padHeld[b.id] = false;
        _padDas[b.id]  = 0;
      };

      // Store repeat type on element for update loop
      btn.dataset.repeat = b.repeat;
      btn.dataset.padId  = b.id;

      btn.addEventListener('touchstart',  onDown, { passive: false });
      btn.addEventListener('touchend',    onUp,   { passive: false });
      btn.addEventListener('touchcancel', onUp,   { passive: false });

      // Also handle mouse for testing on desktop
      btn.addEventListener('mousedown', onDown);
      btn.addEventListener('mouseup',   onUp);
      btn.addEventListener('mouseleave',onUp);

      _padEl.appendChild(btn);
    });

    container.appendChild(_padEl);
  }

  function _updateGamepad() {
    if (!_isMobile || !game.running) return;

    // das-left
    if (_padHeld['pad-left']) {
      _padDas['pad-left'] = (_padDas['pad-left'] || 0) + 1;
      const d = _padDas['pad-left'];
      if (d > DAS_DELAY && (d - DAS_DELAY) % DAS_SPEED === 0) _move(-1);
    }
    // das-right
    if (_padHeld['pad-right']) {
      _padDas['pad-right'] = (_padDas['pad-right'] || 0) + 1;
      const d = _padDas['pad-right'];
      if (d > DAS_DELAY && (d - DAS_DELAY) % DAS_SPEED === 0) _move(1);
    }
    // soft drop hold
    if (_padHeld['pad-soft']) {
      _padDas['pad-soft'] = (_padDas['pad-soft'] || 0) + 1;
      if (_padDas['pad-soft'] % 3 === 0) _softDrop();
    }
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
      width: '100%', height: '100%',
      zIndex: '1', display: 'block'
    });
    container.appendChild(_canvas);
    _ctx = _canvas.getContext('2d');

    _isMobile = _isMobileDevice();
    if (_isMobile) _buildGamepad(container);

    _injectCSS();
    _resize();
    _resizeHandler = () => { _isMobile = _isMobileDevice(); _resize(); };
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
    holdPiece = null; holdUsed = false;
    _bag = []; _refillBag();
    nextQueue = [_nextFromBag(), _nextFromBag(), _nextFromBag()];

    game.running = true; game.over   = false;
    game.score   = 0;    game.lines  = 0;
    game.level   = 1;    game.combo  = 0; game.time = 0;
    _dropAccum   = 0;    _lastTime   = 0;

    Object.keys(_keys).forEach(k => { _keys[k] = false; });
    Object.keys(_padHeld).forEach(k => { _padHeld[k] = false; });
    _dasState.left = 0; _dasState.right = 0;
    _padDas.left   = 0; _padDas.right   = 0; _padDas.down = 0;

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

    // Keyboard DAS
    if (_keys['ArrowLeft']  || _keys['KeyA']) {
      _dasState.left++;
      if (_dasState.left > DAS_DELAY && (_dasState.left - DAS_DELAY) % DAS_SPEED === 0) _move(-1);
    }
    if (_keys['ArrowRight'] || _keys['KeyD']) {
      _dasState.right++;
      if (_dasState.right > DAS_DELAY && (_dasState.right - DAS_DELAY) % DAS_SPEED === 0) _move(1);
    }
    if (_keys['ArrowDown']  || _keys['KeyS']) _softDrop();

    // Gamepad repeat
    _updateGamepad();

    // Gravity
    _dropAccum += dt;
    const interval = _dropInterval();
    while (_dropAccum >= interval) {
      _dropAccum -= interval;
      if (piece) {
        if (_valid(piece, 1)) { piece = { ...piece, row: piece.row+1 }; lockTimer = 0; }
        else { lockTimer++; if (lockTimer >= LOCK_DELAY) _lock(); }
      }
    }

    lineFlash = lineFlash.filter(f => { f.timer--; return f.timer > 0; });
    _updateParticles();
  }

  function _updateParticles() {
    for (let i = particles.length-1; i >= 0; i--) {
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

    // Board border
    _ctx.save();
    _ctx.fillStyle   = 'rgba(255,255,255,0.03)';
    _ctx.strokeStyle = 'rgba(160,0,240,0.3)';
    _ctx.lineWidth   = 1.5;
    _roundRect(orig.x-2, orig.y-2, bw+4, bh+4, 4);
    _ctx.fill(); _ctx.stroke();
    _ctx.restore();

    // Grid
    _ctx.save();
    _ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    _ctx.lineWidth   = 0.5;
    for (let r = 0; r <= ROWS; r++) {
      _ctx.beginPath();
      _ctx.moveTo(orig.x, orig.y+r*cs); _ctx.lineTo(orig.x+bw, orig.y+r*cs); _ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      _ctx.beginPath();
      _ctx.moveTo(orig.x+c*cs, orig.y); _ctx.lineTo(orig.x+c*cs, orig.y+bh); _ctx.stroke();
    }
    _ctx.restore();

    // Board cells
    for (let r = HIDDEN_ROWS; r < TOTAL_ROWS; r++) {
      const dr = r - HIDDEN_ROWS;
      const isFlash = lineFlash.some(f => f.row === r);
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]) {
          if (isFlash) _drawCell(orig.x+c*cs, orig.y+dr*cs, cs, '#fff', '#aaa', 1);
          else         _drawCell(orig.x+c*cs, orig.y+dr*cs, cs, board[r][c], SHADOW[_typeFromColor(board[r][c])]);
        }
      }
    }

    // Ghost piece
    if (piece && game.running) {
      const gr = _ghostRow(piece);
      if (gr !== piece.row) {
        _ctx.save(); _ctx.globalAlpha = 0.18;
        SHAPES[piece.type][piece.rot].forEach(([dr,dc]) => {
          const rr = gr+dr, cc = piece.col+dc;
          if (rr >= HIDDEN_ROWS)
            _drawCell(orig.x+cc*cs, orig.y+(rr-HIDDEN_ROWS)*cs, cs, COLORS[piece.type], SHADOW[piece.type]);
        });
        _ctx.restore();
      }
    }

    // Active piece
    if (piece) {
      const blink = Math.floor(game.time/4)%2===0;
      const alpha = (lockTimer > LOCK_DELAY*0.7 && !blink) ? 0.45 : 1;
      _ctx.save(); _ctx.globalAlpha = alpha;
      SHAPES[piece.type][piece.rot].forEach(([dr,dc]) => {
        const rr = piece.row+dr, cc = piece.col+dc;
        if (rr >= HIDDEN_ROWS)
          _drawCell(orig.x+cc*cs, orig.y+(rr-HIDDEN_ROWS)*cs, cs, COLORS[piece.type], SHADOW[piece.type]);
      });
      _ctx.restore();
    }

    // Particles
    particles.forEach(p => {
      const a = Math.max(0, p.life/p.maxLife);
      _ctx.save();
      _ctx.globalAlpha = a;
      _ctx.fillStyle   = p.color;
      _ctx.shadowColor = p.color;
      _ctx.shadowBlur  = 6;
      _ctx.beginPath(); _ctx.arc(p.x, p.y, Math.max(0.5, p.size*a), 0, Math.PI*2); _ctx.fill();
      _ctx.restore();
    });

    // Side panels
    _drawSidePanels(orig, cs, bw, bh);

    // Desktop key hints
    if (!_isMobile) _drawKeyHints(orig, cs, bh);
  }

  // ================================================================
  //  SIDE PANELS
  // ================================================================
  function _drawSidePanels(orig, cs, bw, bh) {
    const rightX = orig.x + bw + 14;
    const leftX  = orig.x - cs*4 - 14;
    const panelW = cs * 4;
    const lblSz  = Math.max(9, cs*0.38);
    const font   = `'Orbitron', sans-serif`;

    // RIGHT — NEXT
    _ctx.save();
    _ctx.fillStyle   = 'rgba(255,255,255,0.03)';
    _ctx.strokeStyle = 'rgba(160,0,240,0.22)';
    _ctx.lineWidth   = 1;
    _roundRect(rightX, orig.y, panelW, cs*14, 6);
    _ctx.fill(); _ctx.stroke();
    _ctx.fillStyle = 'rgba(160,0,240,0.85)';
    _ctx.font      = `bold ${lblSz}px ${font}`;
    _ctx.textAlign = 'center';
    _ctx.fillText('NEXT', rightX+panelW/2, orig.y+lblSz+8);
    nextQueue.forEach((type, i) => {
      _drawMiniPiece(type, rightX+panelW/2, orig.y+lblSz+22+i*(cs*3.2)+cs*1.2, cs*0.72);
    });
    _ctx.restore();

    // LEFT — HOLD + STATS
    _ctx.save();
    _ctx.fillStyle   = 'rgba(255,255,255,0.03)';
    _ctx.strokeStyle = 'rgba(0,240,240,0.22)';
    _ctx.lineWidth   = 1;
    _roundRect(leftX, orig.y, panelW, cs*8, 6);
    _ctx.fill(); _ctx.stroke();
    _ctx.fillStyle = 'rgba(0,240,240,0.85)';
    _ctx.font      = `bold ${lblSz}px ${font}`;
    _ctx.textAlign = 'center';
    _ctx.fillText('HOLD', leftX+panelW/2, orig.y+lblSz+8);
    if (holdPiece) {
      _ctx.globalAlpha = holdUsed ? 0.35 : 1;
      _drawMiniPiece(holdPiece.type, leftX+panelW/2, orig.y+lblSz+26+cs*1.2, cs*0.72);
      _ctx.globalAlpha = 1;
    }

    const statsY    = orig.y + cs*5.2;
    const statFont  = `'Rajdhani', sans-serif`;
    const statSz    = Math.max(8, cs*0.35);
    [['SCORE',game.score],['LINES',game.lines],['LEVEL',game.level]].forEach(([lbl,val],i) => {
      const sy = statsY + i*(cs*1.6);
      _ctx.fillStyle = 'rgba(255,255,255,0.45)';
      _ctx.font      = `${statSz}px ${statFont}`;
      _ctx.textAlign = 'center';
      _ctx.fillText(lbl, leftX+panelW/2, sy);
      _ctx.fillStyle = '#fff';
      _ctx.font      = `bold ${statSz*1.4}px ${font}`;
      _ctx.fillText(val, leftX+panelW/2, sy+statSz*1.5);
    });
    _ctx.restore();
  }

  // ================================================================
  //  DESKTOP KEY HINTS
  // ================================================================
  function _drawKeyHints(orig, cs, bh) {
    const hints = [
      ['←→ / A D', 'Move'],
      ['↑ / W / X', 'Rotate CW'],
      ['Z',         'Rotate CCW'],
      ['↓ / S',     'Soft Drop'],
      ['Space',     'Hard Drop'],
      ['C / Shift', 'Hold']
    ];
    const x    = orig.x - cs*4 - 14;
    const startY = orig.y + bh - hints.length * (cs*0.75) - 4;
    const sz   = Math.max(8, cs*0.3);

    _ctx.save();
    _ctx.textAlign = 'center';
    hints.forEach(([key, desc], i) => {
      const y = startY + i*(sz*2.1);
      _ctx.font      = `bold ${sz}px 'Orbitron',sans-serif`;
      _ctx.fillStyle = 'rgba(160,0,240,0.7)';
      _ctx.fillText(key, x + cs*2, y);
      _ctx.font      = `${sz*0.85}px 'Rajdhani',sans-serif`;
      _ctx.fillStyle = 'rgba(255,255,255,0.3)';
      _ctx.fillText(desc, x + cs*2, y + sz*1.1);
    });
    _ctx.restore();
  }

  // ================================================================
  //  DRAW HELPERS
  // ================================================================
  function _drawCell(x, y, cs, color, shadow, alpha=1) {
    const pad = Math.max(1, cs*0.05);
    _ctx.save();
    _ctx.globalAlpha *= alpha;
    _ctx.fillStyle = shadow || '#333';
    _ctx.fillRect(x+pad, y+pad, cs-pad*2, cs-pad*2);
    const g = _ctx.createLinearGradient(x, y, x+cs, y+cs);
    g.addColorStop(0,   _lighten(color,30));
    g.addColorStop(0.5, color);
    g.addColorStop(1,   _darken(color,30));
    _ctx.fillStyle = g;
    _ctx.fillRect(x+pad, y+pad, cs-pad*2-2, cs-pad*2-2);
    _ctx.fillStyle = 'rgba(255,255,255,0.18)';
    _ctx.fillRect(x+pad, y+pad, cs-pad*2-2, Math.floor(cs*0.3));
    _ctx.restore();
  }

  function _drawMiniPiece(type, cx, cy, cs) {
    const shape = SHAPES[type][0];
    const minR  = Math.min(...shape.map(([r])=>r));
    const maxR  = Math.max(...shape.map(([r])=>r));
    const minC  = Math.min(...shape.map(([,c])=>c));
    const maxC  = Math.max(...shape.map(([,c])=>c));
    const offX  = -(minC+maxC+1)/2*cs;
    const offY  = -(minR+maxR+1)/2*cs;
    shape.forEach(([r,c]) => _drawCell(cx+offX+c*cs, cy+offY+r*cs, cs, COLORS[type], SHADOW[type]));
  }

  function _roundRect(x,y,w,h,r) {
    _ctx.beginPath();
    _ctx.moveTo(x+r,y);
    _ctx.lineTo(x+w-r,y);   _ctx.arcTo(x+w,y,   x+w,  y+r,  r);
    _ctx.lineTo(x+w,y+h-r); _ctx.arcTo(x+w,y+h, x+w-r,y+h,  r);
    _ctx.lineTo(x+r,y+h);   _ctx.arcTo(x,  y+h, x,    y+h-r,r);
    _ctx.lineTo(x,y+r);     _ctx.arcTo(x,  y,   x+r,  y,    r);
    _ctx.closePath();
  }

  function _lighten(hex,amt) { return _shiftColor(hex, amt);  }
  function _darken(hex,amt)  { return _shiftColor(hex,-amt);  }
  function _shiftColor(hex,amt) {
    const n=parseInt(hex.replace('#',''),16);
    const r=Math.min(255,Math.max(0,(n>>16)+amt));
    const g=Math.min(255,Math.max(0,((n>>8)&0xff)+amt));
    const b=Math.min(255,Math.max(0,(n&0xff)+amt));
    return `rgb(${r},${g},${b})`;
  }

  const _colorTypeMap = Object.fromEntries(Object.entries(COLORS).map(([k,v])=>[v,k]));
  function _typeFromColor(c) { return _colorTypeMap[c]||'I'; }

  // ================================================================
  //  MAIN LOOP
  // ================================================================
  function _loop(ts) {
    const dt = _lastTime ? Math.min(ts-_lastTime, 100) : 16;
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
      setTimeout(() => { _attachKeyboard(); _startGame(); }, 650);
    },
    destroy() {
      _stopLoop();
      if (_bKeyDown) window.removeEventListener('keydown', _bKeyDown);
      if (_bKeyUp)   window.removeEventListener('keyup',   _bKeyUp);
      if (_resizeHandler) window.removeEventListener('resize', _resizeHandler);
      [_loadingEl, _padEl, _overlayEl, _canvas].forEach(el => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
      _canvas = _ctx = null;
      _loadingEl = _padEl = _overlayEl = null;
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
    description: 'Classic Tetris — hold, ghost piece, combos & levels!',
    emoji:       '🧱',
    difficulty:  'medium',
    controls:    { dpad: false, actions: false, center: false },
    version:     '1.0',
    init:        (c) => Tetris.start(c),
    destroy:     () => Tetris.destroy(),
    restart:     () => Tetris.restart()
  });

})();
