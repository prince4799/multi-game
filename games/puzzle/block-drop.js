/* ================================================
   BLOCK DROP
   Classic falling tetromino puzzle game.
   Category: Puzzle
   Template: A (Canvas)
   ================================================ */

(function () {
  'use strict';

  // ==============================================================================
  // 1. CONSTANTS & TETROMINO DEFINITIONS
  // ==============================================================================
  const COLS = 10;
  const ROWS = 20;
  const EMPTY = 0;

  // Shapes & Colors (Using bright neon colors)
  const SHAPES = [
    [], // Empty placeholder for 1-based indexing
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
    // Input delays
    lastMoveTime: 0, moveInterval: 120, // DAS (Delayed Auto Shift)
    lastJoyTapTime: 0
  };

  // ==============================================================================
  // 3. HELPERS
  // ==============================================================================
  function W() { return _canvas ? _canvas.width : window.innerWidth; }
  function H() { return _canvas ? _canvas.height : window.innerHeight; }

  // Generate a random piece
  function _randomPiece() {
    const id = Math.floor(Math.random() * 7) + 1;
    const shape = SHAPES[id];
    return {
      id: id,
      matrix: JSON.parse(JSON.stringify(shape.matrix)), // Deep copy
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

  // REGISTER GAME (Rule 1 & 2)
  GameRegistry.register({
    id: 'block-drop',
    title: 'Block Drop',
    category: 'puzzle',
    description: 'Rotate and drop falling blocks to clear lines and score points!',
    emoji: '🧱',
    difficulty: 'medium',
    controls: { dpad: true, actions: true, center: false },
    version: '1.0',
    init: (c) => BlockDrop.start(c),
    destroy: () => BlockDrop.destroy(),
    restart: () => BlockDrop.restart()
  });

  // ==============================================================================
  // 5. DOM & RESPONSIVENESS (Rule 14)
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
    _hudEl.style.color = 'var(--primary, #00ffff)';
    _hudEl.style.fontFamily = 'Orbitron, sans-serif';
    _hudEl.style.fontSize = '20px';
    _hudEl.style.zIndex = '20';
    _hudEl.style.pointerEvents = 'none';
    _hudEl.style.textShadow = '0 0 5px var(--primary)';

    container.appendChild(_canvas);
    container.appendChild(_joyCanvas);
    container.appendChild(_hudEl);

    _resizeHandler = () => { _resize(); };
    window.addEventListener('resize', _resizeHandler);
    _resize();
  }

  function _resize() {
    if (!_canvas) return;
    const p = _canvas.parentElement;
    const w = p ? p.clientWidth : window.innerWidth;
    const h = p ? p.clientHeight : window.innerHeight;
    
    _canvas.width = w; _canvas.height = h;
    if (_joyCanvas) { _joyCanvas.width = w; _joyCanvas.height = h; }

    // Calculate Grid Layout - Keep aspect ratio
    // Leave 10% padding top/bottom
    const availableH = h * 0.8;
    const availableW = w * 0.9;
    
    _cellSize = Math.floor(Math.min(availableW / COLS, availableH / ROWS));
    
    _boardX = Math.floor((w - (_cellSize * COLS)) / 2);
    _boardY = Math.floor((h - (_cellSize * ROWS)) / 2);
  }

  // ==============================================================================
  // 6. INPUT HANDLING
  // ==============================================================================
  function _attachListeners() {
    // Keyboard Input (Rule 8)
    ControlManager.on('keydown', 'block-drop', key => {
      if (!game.running || _gameOverPending) return;
      
      if (key === 'ArrowLeft')  _move(-1);
      if (key === 'ArrowRight') _move(1);
      if (key === 'ArrowDown')  _drop();
      if (key === 'ArrowUp')    _rotate();
      if (key === ' ')          _hardDrop();
    });

    // Touch Support & Mobile Joystick (Rules 18 & 20)
    _joyCanvas.addEventListener('touchstart', _handleTouchStart, { passive: false });
    _joyCanvas.addEventListener('touchmove', _handleTouchMove, { passive: false });
    _joyCanvas.addEventListener('touchend', _handleTouchEnd, { passive: false });
    _joyCanvas.addEventListener('touchcancel', _handleTouchEnd, { passive: false });
  }

  function _removeListeners() {
    // Events tied to DOM elements clean themselves up on removal
  }

  function _handleTouchStart(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      // Left side = Joystick (Move)
      if (t.clientX < window.innerWidth / 2 && !joystick.active) {
        joystick.active = true;
        joystick.touchId = t.identifier;
        joystick.baseX = t.clientX; joystick.baseY = t.clientY;
        joystick.stickX = t.clientX; joystick.stickY = t.clientY;
        joystick.dx = 0; joystick.dy = 0;
      } 
      // Right side = Tap to Rotate
      else if (t.clientX >= window.innerWidth / 2 && game.running) {
        _rotate();
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

        // Apply movement based on joystick tilt
        const now = Date.now();
        if (now - game.lastMoveTime > game.moveInterval) {
          if (joystick.dx < -0.5) { _move(-1); game.lastMoveTime = now; }
          else if (joystick.dx > 0.5) { _move(1); game.lastMoveTime = now; }
          else if (joystick.dy > 0.6) { _drop(); game.lastMoveTime = now; }
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
        joystick.dx = 0; joystick.dy = 0;
      }
    }
  }

  // ==============================================================================
  // 7. GAME LOGIC (TETRIS MECHANICS)
  // ==============================================================================
  function _startGame() {
    // Reset Board
    _board = [];
    for (let r = 0; r < ROWS; r++) {
      _board[r] = new Array(COLS).fill(EMPTY);
    }
    
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
    const m = p.matrix;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c] !== EMPTY) {
          const newX = p.x + c;
          const newY = p.y + r;
          // Bounds check
          if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
          // Piece collision check
          if (newY >= 0 && _board[newY][newX] !== EMPTY) return true;
        }
      }
    }
    return false;
  }

  function _move(dir) {
    _piece.x += dir;
    if (_collide()) {
      _piece.x -= dir; // Revert
    } else {
      SoundManager.navigate(); // UI tick for move
    }
  }

  function _drop() {
    _piece.y++;
    if (_collide()) {
      _piece.y--;
      _lockPiece();
    } else {
      game.lastDropTime = Date.now();
      game.score += 1; // Soft drop score
      _updateHUD();
    }
  }

  function _hardDrop() {
    while (!_collide()) {
      _piece.y++;
      game.score += 2; // Hard drop score
    }
    _piece.y--;
    _lockPiece();
  }

  function _rotate() {
    const m = _piece.matrix;
    const N = m.length;
    const result = [];
    for (let i = 0; i < N; i++) {
      result.push(new Array(N).fill(EMPTY));
    }
    // Transpose & Reverse (90deg clockwise)
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        result[c][N - 1 - r] = m[r][c];
      }
    }
    
    const prevMatrix = _piece.matrix;
    _piece.matrix = result;

    // Wall kick simple (try shifting left/right if stuck)
    let offset = 0;
    if (_collide()) {
      _piece.x++; offset++;
      if (_collide()) {
        _piece.x -= 2; offset -= 2;
        if (_collide()) {
          // Revert if kicks fail
          _piece.x -= offset;
          _piece.matrix = prevMatrix;
          return;
        }
      }
    }
    SoundManager.buttonPress(); // Rotate sound
  }

  function _lockPiece() {
    const m = _piece.matrix;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c] !== EMPTY) {
          const y = _piece.y + r;
          // Game Over check
          if (y < 0) {
            _triggerGameOver();
            return;
          }
          _board[y][_piece.x + c] = _piece.id;
        }
      }
    }
    SoundManager.click(); // Lock sound
    _clearLines();
    
    // Spawn next
    _piece = _nextPiece;
    _nextPiece = _randomPiece();
    game.lastDropTime = Date.now();

    // Instant game over if new piece spawns collided
    if (_collide()) {
      _triggerGameOver();
    }
  }

  function _clearLines() {
    let linesClearedThisTurn = 0;
    
    for (let r = ROWS - 1; r >= 0; r--) {
      let isFull = true;
      for (let c = 0; c < COLS; c++) {
        if (_board[r][c] === EMPTY) {
          isFull = false;
          break;
        }
      }
      
      if (isFull) {
        linesClearedThisTurn++;
        // Remove row and add empty at top
        _board.splice(r, 1);
        _board.unshift(new Array(COLS).fill(EMPTY));
        r++; // Check same index again
        
        // Spawn particles across the cleared line
        _spawnLineParticles(r);
      }
    }

    if (linesClearedThisTurn > 0) {
      SoundManager.correct(); // Line clear sound
      
      // Scoring: classic multiplier
      const lineMultipliers = [0, 100, 300, 500, 800];
      game.score += lineMultipliers[linesClearedThisTurn] * game.level;
      game.lines += linesClearedThisTurn;

      // Level up every 10 lines
      if (Math.floor(game.lines / 10) + 1 > game.level) {
        game.level++;
        game.dropInterval = Math.max(100, 1000 - ((game.level - 1) * 100));
        SoundManager.win(); // Level up sound
        App.showToast(`LEVEL ${game.level}!`, 'success', 1500);
      }
      
      _updateHUD();
    }
  }

  function _spawnLineParticles(row) {
    const y = _boardY + (row * _cellSize) + (_cellSize / 2);
    for (let c = 0; c < COLS; c++) {
      const x = _boardX + (c * _cellSize) + (_cellSize / 2);
      for (let i = 0; i < 5; i++) {
        _particles.push({
          x: x, y: y,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 0.5) * 10,
          life: 30, maxLife: 30,
          color: '#ffffff'
        });
      }
    }
  }

  // ==============================================================================
  // 8. GAME OVER FLOW & HUD
  // ==============================================================================
  function _triggerGameOver() {
    if (_gameOverPending) return;
    _gameOverPending = true;
    game.running = false;

    SoundManager.gameOver();

    // Save high score
    if (game.score > game.highScore) {
      game.highScore = game.score;
      const isNewBest = ScoreManager.submitScore('block-drop', game.score);
      if (isNewBest) SoundManager.newBest();
    }
    _updateHUD();

    // Death animation cascade
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
    }, 40);
  }

  function _updateHUD() {
    // Platform sync (Rule 4)
    App.updateScoreDisplay(game.score, ScoreManager.getBestScore('block-drop'));
    
    // Local Canvas HUD
    _hudEl.innerHTML = `
      <div>LINES: <span style="color:#fff">${game.lines}</span></div>
      <div style="font-size:16px; margin-top:5px; color:var(--text2)">LVL: ${game.level}</div>
    `;
  }

  // ==============================================================================
  // 9. UPDATE & DRAW LOOPS
  // ==============================================================================
  function _update() {
    if (game.running) {
      const now = Date.now();
      if (now - game.lastDropTime > game.dropInterval) {
        _drop();
        game.lastDropTime = now;
      }
    }

    // Particles
    for (let i = _particles.length - 1; i >= 0; i--) {
      const p = _particles[i];
      p.x += p.vx; p.y += p.vy;
      p.life--;
      if (p.life <= 0) _particles.splice(i, 1);
    }

    // Joystick fade
    if (joystick.active) {
      joystick.opacity = Math.min(1, joystick.opacity + 0.15);
    } else {
      joystick.opacity = Math.max(0, joystick.opacity - 0.08);
    }
  }

  function _drawBlock(x, y, color) {
    _ctx.fillStyle = color;
    _ctx.fillRect(x, y, _cellSize, _cellSize);
    
    // Bevel effect
    _ctx.fillStyle = 'rgba(255,255,255,0.3)';
    _ctx.fillRect(x, y, _cellSize, 4);
    _ctx.fillRect(x, y, 4, _cellSize);
    
    _ctx.fillStyle = 'rgba(0,0,0,0.3)';
    _ctx.fillRect(x, y + _cellSize - 4, _cellSize, 4);
    _ctx.fillRect(x + _cellSize - 4, y, 4, _cellSize);
    
    // Grid border
    _ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    _ctx.lineWidth = 1;
    _ctx.strokeRect(x, y, _cellSize, _cellSize);
  }

  function _draw() {
    _ctx.clearRect(0, 0, W(), H());

    // 1. Draw Board Background
    _ctx.fillStyle = 'var(--bg2, #1a1a2a)';
    _ctx.fillRect(_boardX, _boardY, COLS * _cellSize, ROWS * _cellSize);
    _ctx.strokeStyle = 'var(--border, #333)';
    _ctx.lineWidth = 2;
    _ctx.strokeRect(_boardX - 1, _boardY - 1, (COLS * _cellSize) + 2, (ROWS * _cellSize) + 2);

    // Grid lines
    _ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    _ctx.beginPath();
    for(let r=1; r<ROWS; r++) { _ctx.moveTo(_boardX, _boardY + r*_cellSize); _ctx.lineTo(_boardX + COLS*_cellSize, _boardY + r*_cellSize); }
    for(let c=1; c<COLS; c++) { _ctx.moveTo(_boardX + c*_cellSize, _boardY); _ctx.lineTo(_boardX + c*_cellSize, _boardY + ROWS*_cellSize); }
    _ctx.stroke();

    // 2. Draw Locked Blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (_board[r][c] !== EMPTY) {
          const color = SHAPES[_board[r][c]].color;
          _drawBlock(_boardX + (c * _cellSize), _boardY + (r * _cellSize), color);
        }
      }
    }

    // 3. Draw Ghost Piece & Active Piece
    if (game.running && _piece) {
      // Calculate Ghost Y
      let ghostY = _piece.y;
      while (!_collide({ ..._piece, y: ghostY + 1 })) { ghostY++; }

      const m = _piece.matrix;
      for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
          if (m[r][c] !== EMPTY) {
            // Draw Ghost
            if (ghostY >= 0) {
              const gx = _boardX + ((_piece.x + c) * _cellSize);
              const gy = _boardY + ((ghostY + r) * _cellSize);
              _ctx.fillStyle = `rgba(255,255,255,0.15)`;
              _ctx.fillRect(gx, gy, _cellSize, _cellSize);
              _ctx.strokeStyle = _piece.color;
              _ctx.strokeRect(gx, gy, _cellSize, _cellSize);
            }
            // Draw Active
            if (_piece.y + r >= 0) {
              _drawBlock(_boardX + ((_piece.x + c) * _cellSize), _boardY + ((_piece.y + r) * _cellSize), _piece.color);
            }
          }
        }
      }
    }

    // 4. Draw Next Piece Panel
    const panelX = _boardX + (COLS * _cellSize) + 20;
    const panelY = _boardY;
    _ctx.fillStyle = 'var(--text, #fff)';
    _ctx.font = '14px Orbitron';
    _ctx.fillText('NEXT:', panelX, panelY);
    
    if (_nextPiece) {
      const nm = _nextPiece.matrix;
      const smallCell = _cellSize * 0.8;
      for (let r = 0; r < nm.length; r++) {
        for (let c = 0; c < nm[r].length; c++) {
          if (nm[r][c] !== EMPTY) {
            _drawBlock(panelX + (c * smallCell), panelY + 10 + (r * smallCell), _nextPiece.color);
          }
        }
      }
    }

    // 5. Draw Particles
    _particles.forEach(p => {
      _ctx.globalAlpha = p.life / p.maxLife;
      _ctx.fillStyle = p.color;
      _ctx.beginPath();
      _ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
      _ctx.fill();
    });
    _ctx.globalAlpha = 1.0;

    // 6. Draw Mobile Controls
    _jctx.clearRect(0, 0, W(), H());
    if (window.matchMedia('(pointer: coarse)').matches && game.running) {
      // Draw tap zone hint on right side if joystick is active
      if (joystick.opacity > 0) {
        _jctx.globalAlpha = joystick.opacity * 0.3;
        _jctx.fillStyle = '#ffffff';
        _jctx.font = '24px Orbitron';
        _jctx.textAlign = 'center';
        _jctx.fillText('TAP TO ROTATE', W() * 0.75, H() / 2);
      }

      // Draw Joystick (Rule 20)
      if (joystick.opacity > 0) {
        _jctx.globalAlpha = joystick.opacity * 0.4;
        _jctx.beginPath();
        _jctx.arc(joystick.baseX, joystick.baseY, joystick.baseRadius, 0, Math.PI * 2);
        _jctx.fillStyle = '#ffffff';
        _jctx.fill();
        
        _jctx.globalAlpha = joystick.opacity * 0.8;
        _jctx.beginPath();
        _jctx.arc(joystick.stickX, joystick.stickY, joystick.stickRadius, 0, Math.PI * 2);
        _jctx.fillStyle = 'var(--primary, #00ffff)';
        _jctx.fill();
      }
    }
  }

  // ==============================================================================
  // 10. RAF LOOP (Rule 11)
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
