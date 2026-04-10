/* ================================================
   ASTEROID BLAST
   Shoot asteroids from the center — they split!
   Category: Shooting
   ================================================ */

(function () {
  'use strict';

  // ================================================================
  //  CONSTANTS
  // ================================================================
  const START_LIVES = 3;
  const MAX_LIVES   = 5;

  const ASTEROID_SIZES = {
    3: { score: 30, radiusMod: 0.075, speedMod: 0.8  }, // Big
    2: { score: 20, radiusMod: 0.048, speedMod: 1.2  }, // Medium
    1: { score: 10, radiusMod: 0.026, speedMod: 1.65 }  // Small
  };

  // ================================================================
  //  PRIVATE STATE
  // ================================================================
  let _canvas          = null;
  let _ctx             = null;
  let _joyCanvas       = null;
  let _jctx            = null;
  let _animId          = null;
  let _running         = false;
  let _gameOverPending = false;
  let _resizeHandler   = null;
  let _loadingEl       = null;
  let _hudEl           = null;

  // Input
  let _mouseX        = 0;
  let _mouseY        = 0;
  let _isPointerDown = false;
  let _lastShootTime = 0;

  // Bound listener refs so we can remove them cleanly
  let _boundMouseMove  = null;
  let _boundMouseDown  = null;
  let _boundMouseUp    = null;
  let _boundTouchStart = null;
  let _boundTouchMove  = null;
  let _boundTouchEnd   = null;

  // Images
  const imgs = {
    ship:     new Image(),
    asteroid: new Image()
  };

  // Entity arrays
  let asteroids = [];
  let lasers    = [];
  let particles = [];
  let stars     = [];
  let powerups  = [];

  // Joystick
  const joystick = {
    active: false, touchId: null,
    baseX: 0, baseY: 0,
    stickX: 0, stickY: 0,
    dx: 0, dy: 0,
    baseRadius: 55, stickRadius: 24,
    maxDist: 50, opacity: 0
  };

  // Game state
  const game = {
    running:    false,
    score:      0,
    lives:      START_LIVES,
    highScore:  parseInt(localStorage.getItem('ab_hi') || '0'),
    time:       0,
    spawnRate:  120,
    nextSpawn:  60
  };

  // Player
  const player = {
    x: 0, y: 0, r: 0,
    angle:       -Math.PI / 2,
    invincible:  0,
    visible:     true,
    weaponLevel: 1
  };

  // ================================================================
  //  HELPERS
  // ================================================================
  function imgOk(img) { return img && img.complete && img.naturalWidth > 0; }
  function W()        { return _canvas ? _canvas.width  : window.innerWidth;  }
  function H()        { return _canvas ? _canvas.height : window.innerHeight; }
  function U()        { return Math.min(W(), H()); }
  function rnd(a, b)  { return Math.random() * (b - a) + a; }

  // ================================================================
  //  PUBLIC OBJECT
  // ================================================================
  const AsteroidBlast = {
    start(container) {
      _buildDOM(container);
      _showLoadingOverlay();
      _loadAssets();
    },
    destroy() {
      _stopLoop();
      _removeListeners();
      ControlManager.off('keydown', 'asteroid-blast');
      ControlManager.clearKeys();
      game.running     = false;
      _running         = false;
      _gameOverPending = false;
      [_loadingEl, _hudEl, _joyCanvas, _canvas].forEach(el => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
      _canvas = _ctx = _joyCanvas = _jctx = _loadingEl = _hudEl = null;
    },
    restart() {
      _gameOverPending = false;
      _startGame();
    }
  };

  // ================================================================
  //  REGISTER
  // ================================================================
  GameRegistry.register({
    id:          'asteroid-blast',
    title:       'Asteroid Blast',
    category:    'shooting',
    description: 'Aim and blast asteroids — they split! Collect powerups for upgrades.',
    emoji:       '☄️',
    difficulty:  'medium',
    controls:    { dpad: false, actions: false, center: false },
    version:     '1.2',
    init:        (c) => AsteroidBlast.start(c),
    destroy:     () => AsteroidBlast.destroy(),
    restart:     () => AsteroidBlast.restart()
  });

  // ================================================================
  //  LOADING OVERLAY
  // ================================================================
  function _showLoadingOverlay() {
    _hideLoadingOverlay();

    _loadingEl = document.createElement('div');
    Object.assign(_loadingEl.style, {
      position:       'absolute',
      inset:          '0',
      zIndex:         '100',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      background:     'radial-gradient(ellipse at center, #0a0a2e, #000)',
      gap:            '20px'
    });

    _loadingEl.innerHTML = `
      <div style="font-size:clamp(3rem,10vw,5rem);
        animation:ab-float 2s ease-in-out infinite;
        filter:drop-shadow(0 0 20px #0ff)">🚀</div>
      <div style="font-family:'Orbitron',sans-serif;
        font-size:clamp(1rem,3vw,1.4rem);font-weight:700;
        color:#0ff;text-shadow:0 0 20px #0ff;letter-spacing:3px">
        ASTEROID BLAST</div>
      <div style="width:48px;height:48px;
        border:4px solid rgba(0,255,255,0.15);
        border-top-color:#0ff;border-radius:50%;
        animation:ab-spin 0.8s linear infinite"></div>
      <div id="ab-load-text" style="color:rgba(255,255,255,0.45);
        font-size:0.8rem;letter-spacing:2px;text-transform:uppercase;
        font-family:'Rajdhani',sans-serif">Loading assets...</div>
      <div style="width:clamp(160px,40vw,260px);height:3px;
        background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden">
        <div id="ab-load-bar" style="height:100%;width:0%;
          background:linear-gradient(90deg,#0ff,#bf00ff);
          border-radius:2px;transition:width 0.3s ease"></div>
      </div>`;

    if (!document.getElementById('ab-keyframes')) {
      const kf = document.createElement('style');
      kf.id = 'ab-keyframes';
      kf.textContent = `
        @keyframes ab-spin  { to { transform:rotate(360deg); } }
        @keyframes ab-float {
          0%,100% { transform:translateY(0);     }
          50%     { transform:translateY(-12px);  }
        }`;
      document.head.appendChild(kf);
    }

    if (_canvas && _canvas.parentNode) {
      _canvas.parentNode.appendChild(_loadingEl);
    }
  }

  function _updateLoadingProgress(loaded, total) {
    const bar  = document.getElementById('ab-load-bar');
    const text = document.getElementById('ab-load-text');
    if (bar)  bar.style.width  = `${Math.round((loaded / total) * 100)}%`;
    if (text) text.textContent = `Loading assets... ${loaded}/${total}`;
  }

  function _hideLoadingOverlay() {
    if (_loadingEl) {
      _loadingEl.style.transition = 'opacity 0.4s ease';
      _loadingEl.style.opacity    = '0';
      setTimeout(() => {
        if (_loadingEl && _loadingEl.parentNode) {
          _loadingEl.parentNode.removeChild(_loadingEl);
        }
        _loadingEl = null;
      }, 420);
    }
  }

  // ================================================================
  //  DOM BUILDER
  // ================================================================
  function _buildDOM(container) {
    Object.assign(container.style, {
      position:   'relative',
      overflow:   'hidden',
      background: '#000',
      width:      '100%',
      height:     '100%'
    });

    // Main canvas
    _canvas = document.createElement('canvas');
    Object.assign(_canvas.style, {
      position: 'absolute', top: '0', left: '0',
      width: '100%', height: '100%',
      zIndex: '1', display: 'block'
    });
    container.appendChild(_canvas);
    _ctx = _canvas.getContext('2d');

    // Joystick canvas
    _joyCanvas = document.createElement('canvas');
    Object.assign(_joyCanvas.style, {
      position:    'absolute', top: '0', left: '0',
      width:       '100%', height: '100%',
      zIndex:      '25',
      touchAction: 'none',
      display:     'none'
    });
    container.appendChild(_joyCanvas);
    _jctx = _joyCanvas.getContext('2d');

    if (window.matchMedia('(pointer: coarse)').matches) {
      _joyCanvas.style.display = 'block';
    }

    // HUD
    _hudEl = document.createElement('div');
    Object.assign(_hudEl.style, {
      position:      'absolute',
      top:           '10px',
      left:          '0',
      width:         '100%',
      display:       'flex',
      justifyContent:'space-between',
      alignItems:    'flex-start',
      padding:       '0 16px',
      boxSizing:     'border-box',
      pointerEvents: 'none',
      zIndex:        '10',
      fontFamily:    "'Orbitron', sans-serif",
      color:         '#fff'
    });
    _hudEl.innerHTML = `
      <div id="ab-lives" style="font-size:clamp(14px,3.5vw,20px);
        letter-spacing:2px"></div>
      <div id="ab-weapon" style="font-size:clamp(8px,1.8vw,11px);
        color:rgba(255,255,255,0.5);letter-spacing:2px;
        text-align:right;margin-top:2px"></div>`;
    container.appendChild(_hudEl);

    _resize();
    _resizeHandler = () => { _resize(); _initStars(); };
    window.addEventListener('resize', _resizeHandler);
  }

  function _resize() {
    if (!_canvas) return;
    const p = _canvas.parentElement;
    const w = p ? p.clientWidth  : window.innerWidth;
    const h = p ? p.clientHeight : window.innerHeight;
    _canvas.width  = w;
    _canvas.height = h;
    if (_joyCanvas) { _joyCanvas.width = w; _joyCanvas.height = h; }

    // Re-center player on resize but only if not mid-game
    if (!game.running) {
      player.x = w / 2;
      player.y = h / 2;
    }
    player.r = Math.min(w, h) * 0.04;
  }

  // ================================================================
  //  ASSET LOADING
  // ================================================================
  function _loadAssets() {
    const assetList = [
      { img: imgs.ship,     src: 'games/assets/spaceship.png' },
      { img: imgs.asteroid, src: 'games/assets/asteroid.png'  }
    ];

    const total  = assetList.length;
    let   loaded = 0;

    const onDone = () => {
      loaded++;
      _updateLoadingProgress(loaded, total);
      if (loaded >= total) {
        setTimeout(() => {
          _hideLoadingOverlay();
          _attachListeners();
          _startGame();
        }, 300);
      }
    };

    assetList.forEach(({ img, src }) => {
      img.onload  = onDone;
      img.onerror = onDone;
      img.src     = src;
      if (img.complete) onDone();
    });
  }

  // ================================================================
  //  INPUT LISTENERS
  // ================================================================
  function _attachListeners() {
    // Keyboard
    ControlManager.on('keydown', 'asteroid-blast', key => {
      if ((key === ' ' || key === 'Enter') && game.running) _shoot();
    });

    // Mouse aim + shoot
    _boundMouseMove = (e) => {
      if (!_canvas) return;
      const r = _canvas.getBoundingClientRect();
      _mouseX = e.clientX - r.left;
      _mouseY = e.clientY - r.top;
      if (game.running) {
        player.angle = Math.atan2(_mouseY - player.y, _mouseX - player.x);
      }
    };
    _boundMouseDown = () => {
      _isPointerDown = true;
      if (game.running) _shoot();
    };
    _boundMouseUp = () => { _isPointerDown = false; };

    _canvas.addEventListener('mousemove', _boundMouseMove);
    _canvas.addEventListener('mousedown', _boundMouseDown);
    window.addEventListener('mouseup',   _boundMouseUp);

    // Touch — joystick (left half) + fire (right half)
    _boundTouchStart = _onTouchStart;
    _boundTouchMove  = _onTouchMove;
    _boundTouchEnd   = _onTouchEnd;

    _joyCanvas.addEventListener('touchstart',  _boundTouchStart, { passive: false });
    _joyCanvas.addEventListener('touchmove',   _boundTouchMove,  { passive: false });
    _joyCanvas.addEventListener('touchend',    _boundTouchEnd,   { passive: false });
    _joyCanvas.addEventListener('touchcancel', _boundTouchEnd,   { passive: false });
  }

  function _removeListeners() {
    ControlManager.off('keydown', 'asteroid-blast');
    ControlManager.clearKeys();

    if (_canvas) {
      if (_boundMouseMove) _canvas.removeEventListener('mousemove', _boundMouseMove);
      if (_boundMouseDown) _canvas.removeEventListener('mousedown', _boundMouseDown);
    }
    if (_boundMouseUp) window.removeEventListener('mouseup', _boundMouseUp);

    if (_joyCanvas) {
      if (_boundTouchStart) _joyCanvas.removeEventListener('touchstart',  _boundTouchStart);
      if (_boundTouchMove)  _joyCanvas.removeEventListener('touchmove',   _boundTouchMove);
      if (_boundTouchEnd)   _joyCanvas.removeEventListener('touchend',    _boundTouchEnd);
      if (_boundTouchEnd)   _joyCanvas.removeEventListener('touchcancel', _boundTouchEnd);
    }

    _boundMouseMove = _boundMouseDown = _boundMouseUp = null;
    _boundTouchStart = _boundTouchMove = _boundTouchEnd = null;
    _isPointerDown = false;
  }

  // ================================================================
  //  TOUCH HANDLERS
  // ================================================================
  function _onTouchStart(e) {
    e.preventDefault();
    if (!_canvas) return;
    const rect = _canvas.getBoundingClientRect();

    for (const t of e.changedTouches) {
      const tx = t.clientX - rect.left;
      const ty = t.clientY - rect.top;

      if (tx < W() / 2) {
        // Left half — joystick
        if (!joystick.active) {
          joystick.active  = true;
          joystick.touchId = t.identifier;
          joystick.baseX   = joystick.stickX = tx;
          joystick.baseY   = joystick.stickY = ty;
          joystick.dx      = 0;
          joystick.dy      = 0;
          joystick.opacity = 1;
        }
      } else {
        // Right half — fire
        _isPointerDown = true;
        if (game.running) _shoot();
      }
    }
  }

  function _onTouchMove(e) {
    e.preventDefault();
    if (!_canvas) return;
    const rect = _canvas.getBoundingClientRect();

    for (const t of e.changedTouches) {
      if (!joystick.active || t.identifier !== joystick.touchId) continue;

      const tx = t.clientX - rect.left;
      const ty = t.clientY - rect.top;
      let dx = tx - joystick.baseX;
      let dy = ty - joystick.baseY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > joystick.maxDist) {
        dx = (dx / dist) * joystick.maxDist;
        dy = (dy / dist) * joystick.maxDist;
      }

      joystick.stickX = joystick.baseX + dx;
      joystick.stickY = joystick.baseY + dy;
      joystick.dx     = dx / joystick.maxDist;
      joystick.dy     = dy / joystick.maxDist;

      // Joystick aims the ship
      if (Math.abs(joystick.dx) > 0.1 || Math.abs(joystick.dy) > 0.1) {
        player.angle = Math.atan2(joystick.dy, joystick.dx);
      }
    }
  }

  function _onTouchEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (joystick.active && t.identifier === joystick.touchId) {
        joystick.active  = false;
        joystick.touchId = null;
        joystick.dx      = 0;
        joystick.dy      = 0;
      } else {
        _isPointerDown = false;
      }
    }
  }

  // ================================================================
  //  STARS
  // ================================================================
  function _initStars() {
    stars = [];
    for (let i = 0; i < 130; i++) {
      stars.push({
        x:     rnd(0, W()),
        y:     rnd(0, H()),
        r:     rnd(0.4, 2.2),
        alpha: rnd(0.15, 0.9),
        twinkle: Math.random() * Math.PI * 2
      });
    }
  }

  // ================================================================
  //  GAME FLOW
  // ================================================================
  function _startGame() {
    _stopLoop();

    asteroids    = [];
    lasers       = [];
    particles    = [];
    powerups     = [];
    _isPointerDown = false;

    game.running    = true;
    game.score      = 0;
    game.lives      = START_LIVES;
    game.time       = 0;
    game.spawnRate  = 120;
    game.nextSpawn  = 60;
    _gameOverPending = false;

    player.x           = W() / 2;
    player.y           = H() / 2;
    player.r           = U() * 0.04;
    player.angle       = -Math.PI / 2;
    player.invincible  = 120;
    player.visible     = true;
    player.weaponLevel = 1;

    _initStars();
    _updateHUD();
    SoundManager.gameStart();
    _startLoop();
  }

  // ================================================================
  //  SHOOT
  // ================================================================
  function _shoot() {
    if (!game.running || _gameOverPending || !player.visible) return;

    const now       = Date.now();
    const fireDelay = player.weaponLevel >= 3 ? 150 : 200;
    if (now - _lastShootTime < fireDelay) return;
    _lastShootTime = now;

    SoundManager.navigate();

    const tipX  = player.x + Math.cos(player.angle) * player.r * 1.3;
    const tipY  = player.y + Math.sin(player.angle) * player.r * 1.3;
    const speed = U() * 0.022;

    const fireBolt = (offsetAngle) => {
      const a = player.angle + offsetAngle;
      lasers.push({
        x: tipX, y: tipY,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 90
      });
    };

    if (player.weaponLevel === 1) {
      fireBolt(0);
    } else if (player.weaponLevel === 2) {
      fireBolt(-0.1);
      fireBolt(0.1);
    } else {
      fireBolt(0);
      fireBolt(-0.16);
      fireBolt(0.16);
    }
  }

  // ================================================================
  //  SPAWN ASTEROID
  // ================================================================
  function _spawnAsteroid(size, x, y, angle) {
    const cfg   = ASTEROID_SIZES[size];
    const speed = U() * 0.003 * cfg.speedMod;
    let ax, ay, vx, vy;

    if (x === undefined) {
      // Spawn from random edge
      const edge = Math.floor(rnd(0, 4));
      if      (edge === 0) { ax = rnd(0, W()); ay = -80;       }
      else if (edge === 1) { ax = W() + 80;    ay = rnd(0, H()); }
      else if (edge === 2) { ax = rnd(0, W()); ay = H() + 80;   }
      else                 { ax = -80;         ay = rnd(0, H()); }

      const tx    = player.x + rnd(-150, 150);
      const ty    = player.y + rnd(-150, 150);
      const theta = Math.atan2(ty - ay, tx - ax);
      vx = Math.cos(theta) * speed;
      vy = Math.sin(theta) * speed;
    } else {
      ax = x; ay = y;
      vx = Math.cos(angle) * speed;
      vy = Math.sin(angle) * speed;
    }

    // Build a rough polygon shape for fallback drawing
    const numVerts = randInt(7, 12);
    const verts    = [];
    for (let i = 0; i < numVerts; i++) {
      const a   = (i / numVerts) * Math.PI * 2;
      const rad = cfg.radiusMod * (0.7 + Math.random() * 0.5);
      verts.push({ a, r: rad });
    }

    asteroids.push({
      x: ax, y: ay, vx, vy, size,
      r:        U() * cfg.radiusMod,
      rot:      rnd(0, Math.PI * 2),
      rotSpeed: rnd(-0.04, 0.04),
      verts
    });
  }

  function randInt(a, b) { return Math.floor(rnd(a, b + 1)); }

  // ================================================================
  //  SPAWN POWERUP
  // ================================================================
  function _spawnPowerup(x, y) {
    const r = Math.random();
    let type = null;
    if      (r < 0.05)  type = 'life';
    else if (r < 0.18)  type = 'weapon';
    if (!type) return;

    powerups.push({
      x, y,
      type,
      vx:   rnd(-0.8, 0.8),
      vy:   rnd(-0.8, 0.8),
      r:    U() * 0.022,
      life: 540
    });
  }

  // ================================================================
  //  PARTICLES
  // ================================================================
  function _spawnParticles(x, y, color, count, speedMod = 1, lifeMod = 1) {
    for (let i = 0; i < count; i++) {
      const a = rnd(0, Math.PI * 2);
      const s = rnd(1, 4) * speedMod;
      particles.push({
        x, y,
        vx:      Math.cos(a) * s,
        vy:      Math.sin(a) * s,
        life:    rnd(20, 50) * lifeMod,
        maxLife: 50 * lifeMod,
        color,
        size:    rnd(1.5, 5)
      });
    }
    if (particles.length > 300) particles.splice(0, particles.length - 300);
  }

  function _spawnScorePopup(x, y, text) {
    particles.push({
      x, y,
      vx: 0, vy: -1.4,
      life: 50, maxLife: 50,
      color: '#fff', size: 0, text
    });
  }

  // ================================================================
  //  COLLISIONS
  // ================================================================
  function _circles(ax, ay, ar, bx, by, br) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy < (ar + br) * (ar + br);
  }

  // ================================================================
  //  HIT PLAYER
  // ================================================================
  function _hitPlayer() {
    if (player.invincible > 0) return;
    if (_gameOverPending)       return;

    SoundManager.wrong();
    _spawnParticles(player.x, player.y, '#ff4444', 30, 2);

    game.lives--;
    player.weaponLevel = Math.max(1, player.weaponLevel - 1);
    _updateHUD();

    if (game.lives <= 0) {
      // ---- GAME OVER ----
      _gameOverPending = true;
      game.running     = false;
      player.visible   = false;

      _spawnParticles(player.x, player.y, '#ffaa00', 60, 3.5, 1.5);
      _spawnParticles(player.x, player.y, '#ff0044', 40, 2,   2);

      if (game.score > game.highScore) {
        game.highScore = game.score;
        localStorage.setItem('ab_hi', game.highScore);
      }
      ScoreManager.submitScore('asteroid-blast', game.score);

      // Loop keeps running so explosion particles render
      // _stopLoop + App.showGameResult called after delay
      setTimeout(() => {
        _stopLoop();
        App.showGameResult(game.score, false);
      }, 1000);

    } else {
      // Survived — brief invincibility + clear nearby asteroids
      player.invincible = 160;
      _spawnParticles(player.x, player.y, '#ffaa00', 15, 1.5);

      asteroids = asteroids.filter(a => {
        if (_circles(player.x, player.y, U() * 0.28, a.x, a.y, a.r)) {
          _spawnParticles(a.x, a.y, '#888', 12);
          return false;
        }
        return true;
      });
    }
  }

  // ================================================================
  //  HUD
  // ================================================================
  function _updateHUD() {
    const livesEl  = document.getElementById('ab-lives');
    const weaponEl = document.getElementById('ab-weapon');

    if (livesEl) {
      let s = '';
      for (let i = 0; i < Math.max(START_LIVES, game.lives); i++) {
        if (i < game.lives) {
          s += i >= START_LIVES ? '💙' : '❤️';
        } else {
          s += '🖤';
        }
        s += ' ';
      }
      livesEl.textContent = s.trim();
    }

    if (weaponEl) {
      const wl = ['', 'WEAPON: LV1', 'WEAPON: LV2', 'WEAPON: MAX'][player.weaponLevel] || '';
      weaponEl.textContent = wl;
    }

    const gs = document.getElementById('game-score-display');
    const gb = document.getElementById('game-best-display');
    if (gs) gs.textContent = game.score;
    if (gb) gb.textContent = game.highScore;

    App.updateScoreDisplay(game.score, ScoreManager.getBestScore('asteroid-blast'));
  }

  // ================================================================
  //  UPDATE
  // ================================================================
  function _update() {
    // Always update these even when game.running = false
    // so death particles + explosions finish rendering
    _updateParticles();

    if (!game.running) return;

    game.time++;

    // Hold-to-fire
    if (_isPointerDown) _shoot();

    // Invincibility countdown
    if (player.invincible > 0) player.invincible--;

    // Speed up spawning over time
    if (game.time % 600 === 0 && game.spawnRate > 40) {
      game.spawnRate -= 8;
    }

    // Spawn asteroid
    if (game.time >= game.nextSpawn) {
      _spawnAsteroid(3);
      game.nextSpawn = game.time + game.spawnRate + randInt(0, 30);
    }

    // Stars twinkle
    stars.forEach(s => { s.twinkle += 0.025; });

    // ---- Lasers ----
    for (let i = lasers.length - 1; i >= 0; i--) {
      const l = lasers[i];
      l.x += l.vx;
      l.y += l.vy;
      l.life--;
      if (l.life <= 0 || l.x < -20 || l.x > W() + 20 ||
          l.y < -20 || l.y > H() + 20) {
        lasers.splice(i, 1);
      }
    }

    // ---- Powerups ----
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      // Wrap
      if (p.x < -p.r)       p.x = W() + p.r;
      if (p.x > W() + p.r)  p.x = -p.r;
      if (p.y < -p.r)       p.y = H() + p.r;
      if (p.y > H() + p.r)  p.y = -p.r;

      // Collect
      if (player.visible && _circles(player.x, player.y, player.r + 8, p.x, p.y, p.r)) {
        SoundManager.correct();
        if (p.type === 'life' && game.lives < MAX_LIVES) {
          game.lives++;
          App.showToast('+1 Life! ❤️', 'success', 1500);
        } else if (p.type === 'weapon') {
          player.weaponLevel = Math.min(player.weaponLevel + 1, 3);
          App.showToast('Weapon Upgrade! ⚡', 'info', 1500);
        } else if (p.type === 'life') {
          // Already at max lives — give score instead
          game.score += 100;
          _spawnScorePopup(p.x, p.y - 20, '+100');
        }
        _spawnParticles(p.x, p.y, p.type === 'life' ? '#ff0066' : '#ffff00', 12, 2);
        powerups.splice(i, 1);
        _updateHUD();
        continue;
      }

      if (p.life <= 0) powerups.splice(i, 1);
    }

    // ---- Asteroids ----
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const a = asteroids[i];
      a.x   += a.vx;
      a.y   += a.vy;
      a.rot += a.rotSpeed;

      // Screen wrap
      const pad = a.r * 2.5;
      if (a.x < -pad)       a.x = W() + a.r;
      if (a.x > W() + pad)  a.x = -a.r;
      if (a.y < -pad)       a.y = H() + a.r;
      if (a.y > H() + pad)  a.y = -a.r;

      // Player collision
      if (player.visible &&
          _circles(player.x, player.y, player.r * 0.68, a.x, a.y, a.r * 0.82)) {
        _hitPlayer();
        if (_gameOverPending) break; // stop processing after death
        continue;
      }

      // Laser collision
      let hit = false;
      for (let j = lasers.length - 1; j >= 0; j--) {
        const l = lasers[j];
        if (_circles(a.x, a.y, a.r, l.x, l.y, U() * 0.012)) {
          hit = true;
          lasers.splice(j, 1);
          break;
        }
      }

      if (hit) {
        const pts = ASTEROID_SIZES[a.size].score;
        game.score += pts;
        _spawnParticles(a.x, a.y, '#aaaaaa', a.size * 8, 1.2);
        _spawnScorePopup(a.x, a.y - a.r - 8, `+${pts}`);
        _spawnPowerup(a.x, a.y);
        SoundManager.click();

        // Split
        if (a.size > 1) {
          const baseAngle = Math.atan2(a.vy, a.vx);
          _spawnAsteroid(a.size - 1, a.x, a.y, baseAngle - Math.PI / 5);
          _spawnAsteroid(a.size - 1, a.x, a.y, baseAngle + Math.PI / 5);
        }

        asteroids.splice(i, 1);
        _updateHUD();
      }
    }

    // Joystick opacity fade
    joystick.opacity = joystick.active
      ? Math.min(1, joystick.opacity + 0.15)
      : Math.max(0, joystick.opacity - 0.08);
  }

  function _updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // ================================================================
  //  DRAW
  // ================================================================
  function _draw() {
    if (!_ctx || !_canvas) return;

    _ctx.clearRect(0, 0, W(), H());

    // ---- Background ----
    const bg = _ctx.createRadialGradient(W()/2, H()/2, 0, W()/2, H()/2, Math.max(W(),H())*0.7);
    bg.addColorStop(0,   '#0d0d28');
    bg.addColorStop(0.6, '#080818');
    bg.addColorStop(1,   '#030308');
    _ctx.fillStyle = bg;
    _ctx.fillRect(0, 0, W(), H());

    // ---- Stars ----
    stars.forEach(s => {
      const a = 0.35 + 0.45 * Math.sin(s.twinkle || 0);
      _ctx.globalAlpha = a;
      _ctx.fillStyle   = '#ffffff';
      _ctx.beginPath();
      _ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      _ctx.fill();
    });
    _ctx.globalAlpha = 1;

    // ---- Lasers ----
    _ctx.save();
    _ctx.shadowBlur  = 14;
    _ctx.shadowColor = '#00ffff';
    _ctx.strokeStyle = '#ffffff';
    _ctx.lineWidth   = Math.max(2, U() * 0.007);
    _ctx.lineCap     = 'round';
    lasers.forEach(l => {
      _ctx.beginPath();
      _ctx.moveTo(l.x, l.y);
      _ctx.lineTo(l.x - l.vx * 2.8, l.y - l.vy * 2.8);
      _ctx.stroke();
    });
    _ctx.restore();

    // ---- Particles ----
    particles.forEach(p => {
      const a = Math.max(0, p.life / p.maxLife);
      _ctx.save();
      _ctx.globalAlpha = a;
      if (p.text) {
        _ctx.fillStyle    = 'gold';
        _ctx.font         = `bold ${Math.max(12, U() * 0.03)}px sans-serif`;
        _ctx.textAlign    = 'center';
        _ctx.shadowColor  = 'rgba(255,200,0,0.8)';
        _ctx.shadowBlur   = 8;
        _ctx.fillText(p.text, p.x, p.y);
      } else {
        _ctx.fillStyle = p.color;
        _ctx.beginPath();
        _ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        _ctx.fill();
      }
      _ctx.restore();
    });

    // ---- Powerups ----
    powerups.forEach(p => {
      const pulse = 1 + 0.18 * Math.sin(game.time * 0.1);
      const fs    = p.r * 2 * pulse;
      _ctx.save();
      _ctx.translate(p.x, p.y);
      _ctx.shadowBlur  = 18;
      _ctx.shadowColor = p.type === 'life' ? '#ff0066' : '#ffff00';
      _ctx.font         = `${fs}px serif`;
      _ctx.textAlign    = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(p.type === 'life' ? '❤️' : '⚡', 0, 0);
      _ctx.restore();
    });

    // ---- Asteroids ----
    asteroids.forEach(a => {
      _ctx.save();
      _ctx.translate(a.x, a.y);
      _ctx.rotate(a.rot);

      if (imgOk(imgs.asteroid)) {
        const s = a.r * 2.4;
        _ctx.drawImage(imgs.asteroid, -s / 2, -s / 2, s, s);
      } else {
        // Vector fallback — rough polygon
        _ctx.beginPath();
        a.verts.forEach((v, idx) => {
          const px = Math.cos(v.a) * a.r * (0.75 + v.r);
          const py = Math.sin(v.a) * a.r * (0.75 + v.r);
          idx === 0 ? _ctx.moveTo(px, py) : _ctx.lineTo(px, py);
        });
        _ctx.closePath();
        const gr = _ctx.createRadialGradient(0, 0, 0, 0, 0, a.r);
        gr.addColorStop(0,   '#888888');
        gr.addColorStop(0.6, '#555555');
        gr.addColorStop(1,   '#333333');
        _ctx.fillStyle   = gr;
        _ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        _ctx.lineWidth   = 1.5;
        _ctx.fill();
        _ctx.stroke();
      }
      _ctx.restore();
    });

    // ---- Player Ship ----
    if (player.visible) {
      const blink = player.invincible > 0 && Math.floor(game.time / 5) % 2 === 0;
      if (!blink) {
        _ctx.save();
        _ctx.translate(player.x, player.y);
        _ctx.rotate(player.angle);

        // Thruster flame
        if (game.running) {
          const flameLen = player.r * (1.4 + Math.random() * 0.6);
          const flameGr  = _ctx.createLinearGradient(0, 0, -flameLen, 0);
          flameGr.addColorStop(0,   'rgba(0,255,255,0.9)');
          flameGr.addColorStop(0.5, 'rgba(0,150,255,0.5)');
          flameGr.addColorStop(1,   'rgba(0,100,200,0)');
          _ctx.fillStyle = flameGr;
          _ctx.beginPath();
          _ctx.moveTo(-player.r * 1.0, -player.r * 0.28);
          _ctx.lineTo(-flameLen,        0);
          _ctx.lineTo(-player.r * 1.0,  player.r * 0.28);
          _ctx.fill();
        }

        // Glow
        _ctx.shadowBlur  = 18;
        _ctx.shadowColor = '#00ffff';

        if (imgOk(imgs.ship)) {
          _ctx.rotate(Math.PI); // correct orientation
          const s = player.r * 2.6;
          _ctx.drawImage(imgs.ship, -s / 2, -s / 2, s, s);
        } else {
          // Vector fallback ship
          _ctx.fillStyle = '#00ccff';
          _ctx.beginPath();
          _ctx.moveTo( player.r * 1.2,  0);
          _ctx.lineTo(-player.r * 0.8, -player.r * 0.6);
          _ctx.lineTo(-player.r * 0.5,  0);
          _ctx.lineTo(-player.r * 0.8,  player.r * 0.6);
          _ctx.closePath();
          _ctx.fill();
          _ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          _ctx.lineWidth   = 1.5;
          _ctx.stroke();
        }

        // Invincibility shield ring
        if (player.invincible > 0) {
          _ctx.rotate(imgOk(imgs.ship) ? -Math.PI : 0);
          const shieldAlpha = 0.4 + 0.4 * Math.sin(game.time * 0.2);
          _ctx.globalAlpha  = shieldAlpha;
          _ctx.strokeStyle  = '#00ffff';
          _ctx.lineWidth    = 2.5;
          _ctx.shadowBlur   = 12;
          _ctx.shadowColor  = '#00ffff';
          _ctx.beginPath();
          _ctx.arc(0, 0, player.r * 1.6, 0, Math.PI * 2);
          _ctx.stroke();
          _ctx.globalAlpha = 1;
        }

        _ctx.restore();
      }
    }

    // ---- Joystick ----
    if (_jctx) {
      _jctx.clearRect(0, 0, W(), H());

      if (joystick.opacity > 0.01) {
        const a = joystick.opacity;
        _jctx.save();

        // Base
        _jctx.globalAlpha = a * 0.22;
        _jctx.beginPath();
        _jctx.arc(joystick.baseX, joystick.baseY, joystick.baseRadius, 0, Math.PI * 2);
        _jctx.fillStyle = '#ffffff';
        _jctx.fill();
        _jctx.globalAlpha = a * 0.45;
        _jctx.strokeStyle = '#00ffff';
        _jctx.lineWidth   = 2.5;
        _jctx.stroke();

        // Stick
        const sx = joystick.active ? joystick.stickX : joystick.baseX;
        const sy = joystick.active ? joystick.stickY : joystick.baseY;
        _jctx.globalAlpha = a * 0.78;
        const sg = _jctx.createRadialGradient(sx - 4, sy - 4, 2, sx, sy, joystick.stickRadius);
        sg.addColorStop(0, '#66ffff');
        sg.addColorStop(1, '#007799');
        _jctx.beginPath();
        _jctx.arc(sx, sy, joystick.stickRadius, 0, Math.PI * 2);
        _jctx.fillStyle = sg;
        _jctx.fill();
        _jctx.globalAlpha = a * 0.9;
        _jctx.strokeStyle = '#00ffff';
        _jctx.lineWidth   = 2;
        _jctx.stroke();

        _jctx.restore();
      }
    }
  }

  // ================================================================
  //  LOOP
  // ================================================================
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
