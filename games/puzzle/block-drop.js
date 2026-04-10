(function () {
  'use strict';

  // ==============================================================================
  // 1. CONSTANTS & TETROMINO DEFINITIONS
  // ==============================================================================
  const COLS = 10;
  const ROWS = 20;
  const EMPTY = 0;

  // Shapes & Colors (Neon Theme)
  const SHAPES = [
    [], // Empty placeholder
    { matrix: [[1, 1, 1, 1]], color: '#00ffff' }, // I - Cyan
    { matrix: [[2, 0, 0], [2, 2, 2]], color: '#0055ff' }, // J - Blue
    { matrix: [[0, 0, 3], [3, 3, 3]], color: '#ffaa00' }, // L - Orange
    { matrix: [[4, 4], [4, 4]], color: '#ffff00' }, // O - Yellow
    { matrix: [[0, 5, 5], [5, 5, 0]], color: '#00ff00' }, // S - Green
    { matrix: [[0, 6, 0], [6, 6, 6]], color: '#cc00ff' }, // T - Purple
    { matrix: [[7, 7, 0], [0, 7, 7]], color: '#ff0055' }  // Z - Red
  ];

  // ==============================================================================
  // 2. PRIVATE STATE
  // ==============================================================================
  let _canvas          = null;
  let _ctx             = null;
  let _joyCanvas       = null;
  let _jctx            = null;
  let _animId          = null;
  let _running         = false;
  let _gameOverPending = false;
  let _resizeHandler   = null;
  let _hudEl           = null;

  // Responsiveness
  let _cellSize = 0;
  let _boardX   = 0;
  let _boardY   = 0;

  // Grid
  let _board = [];

  // Entities
  let _piece     = null;
  let _nextPiece = null;
  let _particles = [];

  // Standard Joystick Object (Rule 20)
  const joystick = {
    active: false, touchId: null,
    baseX: 0, baseY: 0,
    stickX: 0, stickY: 0,
    dx: 0, dy: 0,
    baseRadius: 55, stickRadius: 24,
    maxDist: 50, opacity: 0
  };

  // Game State
  const game = {
    running: false, score: 0, lines: 0, level: 1,
    highScore: parseInt(localStorage.getItem('blockdrop_hi') || '0'),
    lastDropTime: 0, dropInterval: 1000,
    lastMoveTime: 0, moveInterval: 150 // DAS delay
  };

  // ==============================================================================
  // 3. HELPERS
  // ==============================================================================
  function W() { return _canvas ? _canvas.width : window.innerWidth; }
  function H() { return _canvas ? _canvas.height : window.innerHeight; }

  function _randomPiece() {
    const id = Math.floor(Math.random() * 7) + 1;
    const shape = SHAPES[id];
    return {
      id: id,
      matrix: JSON.parse(JSON.stringify(shape.matrix)),
      color: shape.color,
      x: Math.floor(COLS / 2) - Math.floor(shape.matrix[0].length / 2),
      y: 0
    };
  }

  // ==============================================================================
  // 4. CORE ENGINE & DOM BUILDER
  // ==============================================================================
  const BlockDrop = {
    start(container) {
      _buildDOM(container);
      _attachListeners();
      _startGame();
    },
    destroy() {
      _stopLoop();
      _removeListeners();
      ControlManager.off('keydown', 'block-drop');
      ControlManager.clearKeys();
      if (_resizeHandler) {
        window.removeEventListener('resize', _resizeHandler);
        _resizeHandler = null;
      }
      [_canvas, _joyCanvas, _hudEl].forEach(el => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
      _canvas = _ctx = _joyCanvas = _jctx = null;
    },
    restart() {
      _startGame();
    }
  };

  GameRegistry.register({
    id: 'block-drop',
    title: 'Block Drop',
    category: 'puzzle',
    description: 'Classic falling blocks! Clear lines to level up.',
    emoji: '🧱',
    difficulty: 'medium',
    controls: { dpad: true, actions: true, center: false },
    version: '1.1',
    init: (c) => BlockDrop.start(c),
    destroy: () => BlockDrop.destroy(),
    restart: () => BlockDrop.restart()
  });

  // ==============================================================================
  // 5. DOM & RESPONSIVENESS (Rule 14) - FULL SCREEN MOBILE FIX
  // ==============================================================================
  function _buildDOM(container) {
    _canvas = document.createElement('canvas');
    _canvas.style.position = 'absolute';
    _canvas.style.inset = '0';
    _canvas.style.width = '100%'; _canvas.style.height = '100%';
    _canvas.style.zIndex = '10';
    _canvas.style.backgroundColor = 'var(--bg3, #0a0a1a)';
    _ctx = _canvas.getContext('2d');

    _joyCanvas = document.createElement('canvas');
    _joyCanvas.style.position = 'absolute';
    _joyCanvas.style.inset = '0';
    _joyCanvas.style.width = '100%'; _joyCanvas.style.height = '100%';
    _joyCanvas.style.zIndex = '25';
    _joyCanvas.style.pointerEvents = 'auto';
    _joyCanvas.style.display = window.matchMedia('(pointer: coarse)').matches ? 'block' : 'none';
    _jctx = _joyCanvas.getContext('2d');

    _hudEl = document.createElement('div');
    _hudEl.style.position = 'absolute';
    _hudEl.style.top = '10px'; _hudEl.style.left = '10px';
    _hudEl.style.color = '#ffffff';
    _hudEl.style.fontFamily = 'Orbitron, sans-serif';
    _hudEl.style.zIndex = '20';
    _hudEl.style.pointerEvents = 'none';

    container.appendChild(_canvas);
    container.appendChild(_joyCanvas);
    container.appendChild(_hudEl);

    _resizeHandler = () => { _resize(); };
    window.addEventListener('resize', _resizeHandler);
    _resize();
  }

  function _resize() {
    if (!_canvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    _canvas.width = w; _canvas.height = h;
    if (_joyCanvas) { _joyCanvas.width = w; _joyCanvas.height = h; }

    // Maximize Grid:
    // Leave 80px at the top for HUD and NEXT piece. Leave 20px at bottom.
    const maxW = w * 0.95;
    const maxH = h - 100;
    
    _cellSize = Math.floor(Math.min(maxW / COLS, maxH / ROWS));
    
    // Center Horizontally
    _boardX = Math.floor((w - (_cellSize * COLS)) / 2);
    // Push to bottom to leave top space
    _boardY = h - (_cellSize * ROWS) - 20;
  }

  // ==============================================================================
  // 6. INPUT HANDLING
  // ==============================================================================
  function _attachListeners() {
    ControlManager.on('keydown', 'block-drop', key => {
      if (!game.running || _gameOverPending) return;
      if (key === 'ArrowLeft')  _move(-1);
      if (key === 'ArrowRight') _move(1);
      if (key === 'ArrowDown')  _softDrop();
      if (key === 'ArrowUp')    _rotate();
      if (key === ' ')          _hardDrop();
    });

    _joyCanvas.addEventListener('touchstart', _handleTouchStart, { passive: false });
    _joyCanvas.addEventListener('touchmove', _handleTouchMove, { passive: false });
    _joyCanvas.addEventListener('touchend', _handleTouchEnd, { passive: false });
  }

  function _removeListeners() {
    ControlManager.off('keydown', 'block-drop');
  }

  function _handleTouchStart(e) {
    e.preventDefault();
    if (!game.running || _gameOverPending) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const cx = t.clientX;
      const cy = t.clientY;

      // Left Half = Joystick
      if (cx < W() / 2 && !joystick.active) {
        joystick.active = true;
        joystick.touchId = t.identifier;
        joystick.baseX = cx; joystick.baseY = cy;
        joystick.stickX = cx; joystick.stickY = cy;
        joystick.dx = 0; joystick.dy = 0;
      } 
      // Right Half = Actions
      else if (cx >= W() / 2) {
        if (cy < H() / 2) {
          _rotate(); // Top Right Tap
        } else {
          _hardDrop(); // Bottom Right Tap
        }
      }
    }
  }

  function _handleTouchMove(e) {
    e.preventDefault();
    if (!game.running || _gameOverPending) return;
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (joystick.active && t.identifier === joystick.touchId) {
        let dx = t.clientX - joystick.baseX;
        let dy = t.clientY - joystick.baseY;
        const dist = Math.hypot(dx, dy);
        
        if (dist > joystick.maxDist) {
          dx = (dx / dist) * joystick.maxDist;
          dy = (dy / dist) * joystick.maxDist;
        }
        
        joystick.stickX = joystick.baseX + dx;
        joystick.stickY = joystick.baseY + dy;
        joystick.dx = dx / joystick.maxDist;
        joystick.dy = dy / joystick.maxDist;

        // DAS (Delayed Auto Shift) Movement
        const now = Date.now();
        if (now - game.lastMoveTime > game.moveInterval) {
          if (joystick.dx < -0.4) { _move(-1); game.lastMoveTime = now; }
          else if (joystick.dx > 0.4) { _move(1); game.lastMoveTime = now; }
          
          if (joystick.dy > 0.5) { _softDrop(); game.lastMoveTime = now; }
        }
      }
    }
  }

  function _handleTouchEnd(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (joystick.active && t.identifier === joystick.touchId) {
        joystick.active = false;
        joystick.touchId = null;
      }
    }
  }

  // ==============================================================================
  // 7. ROBUST TETRIS LOGIC
  // ==============================================================================
  function _startGame() {
    _board = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
    game.score = 0; game.lines = 0; game.level = 1;
    game.dropInterval = 1000;
    game.lastDropTime = Date.now();
    _gameOverPending = false;
    _particles = [];

    _piece = _randomPiece();
    _nextPiece = _randomPiece();

    _updateHUD();
    SoundManager.gameStart();
    game.running = true;
    _startLoop();
  }

  function _collide(p = _piece) {
    for (let r = 0; r < p.matrix.length; r++) {
      for (let c = 0; c < p.matrix[r].length; c++) {
        if (p.matrix[r][c] !== EMPTY) {
          const newX = p.x + c;
          const newY = p.y + r;
          if (newX < 0 || newX >= COLS || newY >= ROWS) return true; // Walls/Floor
          if (newY >= 0 && _board[newY][newX] !== EMPTY) return true; // Blocks
        }
      }
    }
    return false;
  }

  function _move(dir) {
    _piece.x += dir;
    if (_collide()) {
      _piece.x -= dir;
    } else {
      SoundManager.navigate();
    }
  }

  function _softDrop() {
    _piece.y++;
    if (_collide()) {
      _piece.y--;
      _lockPiece();
    } else {
      game.score += 1;
      _updateHUD();
    }
  }

  function _hardDrop() {
    while (!_collide()) {
      _piece.y++;
      game.score += 2;
    }
    _piece.y--;
    _lockPiece();
  }

  function _rotate() {
    const m = _piece.matrix;
    const N = m.length;
    const result = Array.from({length: N}, () => new Array(N).fill(EMPTY));
    
    // Transpose & Reverse
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        result[c][N - 1 - r] = m[r][c];
      }
    }
    
    const prevMatrix = _piece.matrix;
    _piece.matrix = result;

    // Robust Wall Kick
    let kicked = false;
    if (_collide()) {
      _piece.x++; // Try right 1
      if (_collide()) {
        _piece.x -= 2; // Try left 1
        if (_collide()) {
          _piece.x++; 
          _piece.y--; // Try up 1 (Floor kick)
          if (_collide()) {
            _piece.y++; 
            _piece.matrix = prevMatrix; // Abandon
            kicked = true;
          }
        }
      }
    }
    if (!kicked) SoundManager.buttonPress();
  }

  function _lockPiece() {
    for (let r = 0; r < _piece.matrix.length; r++) {
      for (let c = 0; c < _piece.matrix[r].length; c++) {
        if (_piece.matrix[r][c] !== EMPTY) {
          const y = _piece.y + r;
          if (y < 0) {
            _triggerGameOver();
            return;
          }
          _board[y][_piece.x + c] = _piece.id;
        }
      }
    }
    SoundManager.click();
    _clearLines();
    
    _piece = _nextPiece;
    _nextPiece = _randomPiece();
    game.lastDropTime = Date.now();

    if (_collide()) _triggerGameOver();
  }

  function _clearLines() {
    // 100% bug-free line clearing using Array filter
    const newBoard = _board.filter(row => row.some(cell => cell === EMPTY));
    const linesCleared = ROWS - newBoard.length;

    if (linesCleared > 0) {
      // Spawn particles at cleared heights
      for (let r = 0; r < ROWS; r++) {
        if (!_board[r].some(cell => cell === EMPTY)) _spawnLineParticles(r);
      }

      // Add empty rows to top
      for (let i = 0; i < linesCleared; i++) {
        newBoard.unshift(new Array(COLS).fill(EMPTY));
      }
      _board = newBoard;

      SoundManager.correct();
      const multipliers = [0, 100, 300, 500, 800];
      game.score += multipliers[linesCleared] * game.level;
      game.lines += linesCleared;

      if (Math.floor(game.lines / 10) + 1 > game.level) {
        game.level++;
        game.dropInterval = Math.max(100, 1000 - ((game.level - 1) * 100));
        SoundManager.win();
        App.showToast(`LEVEL ${game.level}!`, 'success', 1500);
      }
      _updateHUD();
    }
  }

  function _spawnLineParticles(row) {
    const y = _boardY + (row * _cellSize) + (_cellSize / 2);
    for (let c = 0; c < COLS; c++) {
      const x = _boardX + (c * _cellSize) + (_cellSize / 2);
      for (let i = 0; i < 4; i++) {
        _particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12,
          life: 30, maxLife: 30, color: '#ffffff'
        });
      }
    }
  }

  // ==============================================================================
  // 8. GAME OVER & HUD
  // ==============================================================================
  function _triggerGameOver() {
    if (_gameOverPending) return;
    _gameOverPending = true;
    game.running = false;
    SoundManager.gameOver();

    const isNewBest = ScoreManager.submitScore('block-drop', game.score);
    if (isNewBest) SoundManager.newBest();
    _updateHUD();

    // Red cascade animation
    let r = ROWS - 1;
    const interval = setInterval(() => {
      if (r < 0) {
        clearInterval(interval);
        setTimeout(() => {
          _stopLoop();
          App.showGameResult(game.score, false);
        }, 500);
        return;
      }
      for(let c=0; c<COLS; c++) {
        if(_board[r][c] !== EMPTY) _board[r][c] = 7; // turn red
      }
      r--;
    }, 30);
  }

  function _updateHUD() {
    App.updateScoreDisplay(game.score, ScoreManager.getBestScore('block-drop'));
    _hudEl.innerHTML = `
      <div style="font-size:24px; font-weight:bold; color:var(--primary, #0ff)">${game.score}</div>
      <div style="font-size:14px; color:#aaa">LINES: ${game.lines} | LVL: ${game.level}</div>
    `;
  }

  // ==============================================================================
  // 9. UPDATE & DRAW LOOPS
  // ==============================================================================
  function _update() {
    if (game.running) {
      const now = Date.now();
      if (now - game.lastDropTime > game.dropInterval) {
        _softDrop();
        game.lastDropTime = now;
      }
    }

    for (let i = _particles.length - 1; i >= 0; i--) {
      const p = _particles[i];
      p.x += p.vx; p.y += p.vy; p.life--;
      if (p.life <= 0) _particles.splice(i, 1);
    }

    if (joystick.active) {
      joystick.opacity = Math.min(1, joystick.opacity + 0.15);
    } else {
      joystick.opacity = Math.max(0, joystick.opacity - 0.08);
    }
  }

  function _drawBlock(x, y, color) {
    _ctx.fillStyle = color;
    _ctx.fillRect(x, y, _cellSize, _cellSize);
    
    // Gem Bevels
    _ctx.fillStyle = 'rgba(255,255,255,0.4)';
    _ctx.fillRect(x, y, _cellSize, 3);
    _ctx.fillRect(x, y, 3, _cellSize);
    
    _ctx.fillStyle = 'rgba(0,0,0,0.4)';
    _ctx.fillRect(x, y + _cellSize - 3, _cellSize, 3);
    _ctx.fillRect(x + _cellSize - 3, y, 3, _cellSize);
    
    _ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    _ctx.lineWidth = 1;
    _ctx.strokeRect(x, y, _cellSize, _cellSize);
  }

  function _draw() {
    _ctx.clearRect(0, 0, W(), H());

    // 1. Board Background
    _ctx.fillStyle = 'rgba(10, 10, 20, 0.8)';
    _ctx.fillRect(_boardX, _boardY, COLS * _cellSize, ROWS * _cellSize);
    _ctx.strokeStyle = 'var(--primary, #0ff)';
    _ctx.lineWidth = 3;
    _ctx.strokeRect(_boardX - 1, _boardY - 1, (COLS * _cellSize) + 2, (ROWS * _cellSize) + 2);

    // 2. Grid lines
    _ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    _ctx.lineWidth = 1;
    _ctx.beginPath();
    for(let r=1; r<ROWS; r++) { _ctx.moveTo(_boardX, _boardY + r*_cellSize); _ctx.lineTo(_boardX + COLS*_cellSize, _boardY + r*_cellSize); }
    for(let c=1; c<COLS; c++) { _ctx.moveTo(_boardX + c*_cellSize, _boardY); _ctx.lineTo(_boardX + c*_cellSize, _boardY + ROWS*_cellSize); }
    _ctx.stroke();

    // 3. Locked Blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (_board[r][c] !== EMPTY) {
          _drawBlock(_boardX + (c * _cellSize), _boardY + (r * _cellSize), SHAPES[_board[r][c]].color);
        }
      }
    }

    // 4. Ghost & Active Piece
    if (game.running && _piece) {
      let ghostY = _piece.y;
      while (!_collide({ ..._piece, y: ghostY + 1 })) { ghostY++; }

      for (let r = 0; r < _piece.matrix.length; r++) {
        for (let c = 0; c < _piece.matrix[r].length; c++) {
          if (_piece.matrix[r][c] !== EMPTY) {
            // Ghost
            if (ghostY >= 0) {
              const gx = _boardX + ((_piece.x + c) * _cellSize);
              const gy = _boardY + ((ghostY + r) * _cellSize);
              _ctx.fillStyle = `rgba(255,255,255,0.1)`;
              _ctx.fillRect(gx, gy, _cellSize, _cellSize);
              _ctx.strokeStyle = _piece.color;
              _ctx.lineWidth = 2;
              _ctx.strokeRect(gx+1, gy+1, _cellSize-2, _cellSize-2);
            }
            // Active
            if (_piece.y + r >= 0) {
              _drawBlock(_boardX + ((_piece.x + c) * _cellSize), _boardY + ((_piece.y + r) * _cellSize), _piece.color);
            }
          }
        }
      }
    }

    // 5. NEXT Piece Panel (Now at TOP RIGHT)
    if (_nextPiece) {
      const panelX = W() - 100;
      const panelY = Math.max(10, _boardY - 70); // Keep above board
      _ctx.fillStyle = 'var(--text2, #aaa)';
      _ctx.font = '12px Orbitron';
      _ctx.fillText('NEXT', panelX, panelY);
      
      const nm = _nextPiece.matrix;
      const smallCell = 15; // Fixed small size
      for (let r = 0; r < nm.length; r++) {
        for (let c = 0; c < nm[r].length; c++) {
          if (nm[r][c] !== EMPTY) {
            _ctx.fillStyle = _nextPiece.color;
            _ctx.fillRect(panelX + (c * smallCell), panelY + 10 + (r * smallCell), smallCell, smallCell);
            _ctx.strokeStyle = '#000';
            _ctx.lineWidth = 1;
            _ctx.strokeRect(panelX + (c * smallCell), panelY + 10 + (r * smallCell), smallCell, smallCell);
          }
        }
      }
    }

    // 6. Particles
    _particles.forEach(p => {
      _ctx.globalAlpha = p.life / p.maxLife;
      _ctx.fillStyle = p.color;
      _ctx.beginPath(); _ctx.arc(p.x, p.y, 4, 0, Math.PI*2); _ctx.fill();
    });
    _ctx.globalAlpha = 1.0;

    // 7. Mobile UI Hints & Joystick
    _jctx.clearRect(0, 0, W(), H());
    if (window.matchMedia('(pointer: coarse)').matches && game.running) {
      _jctx.font = 'bold 20px sans-serif';
      _jctx.fillStyle = 'rgba(255,255,255,0.15)';
      _jctx.textAlign = 'center';
      
      // Tap Zone Hints
      if (joystick.opacity > 0) {
        _jctx.fillText('↻ ROTATE', W() * 0.75, H() * 0.25);
        _jctx.fillText('⏬ DROP', W() * 0.75, H() * 0.75);
      }

      // Joystick Base
      if (joystick.opacity > 0) {
        _jctx.globalAlpha = joystick.opacity * 0.3;
        _jctx.beginPath(); _jctx.arc(joystick.baseX, joystick.baseY, joystick.baseRadius, 0, Math.PI * 2);
        _jctx.fillStyle = '#ffffff'; _jctx.fill();
        
        _jctx.globalAlpha = joystick.opacity * 0.8;
        _jctx.beginPath(); _jctx.arc(joystick.stickX, joystick.stickY, joystick.stickRadius, 0, Math.PI * 2);
        _jctx.fillStyle = 'var(--primary, #00ffff)'; _jctx.fill();
      }
    }
  }

  // ==============================================================================
  // 10. RAF LOOP
  // ==============================================================================
  function _startLoop() {
    _running = true;
    const loop = () => {
      if (!_running) return;
      _update();
      _draw();
      _animId = requestAnimationFrame(loop);
    };
    _animId = requestAnimationFrame(loop);
  }

  function _stopLoop() {
    _running = false;
    if (_animId) {
      cancelAnimationFrame(_animId);
      _animId = null;
    }
  }

})();
