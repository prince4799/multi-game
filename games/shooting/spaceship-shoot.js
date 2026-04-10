/* ================================================
   ASTEROID BLAST v2.0
   Shoot asteroids — explode on hit, special abilities,
   powerup drops, in-canvas game-over overlay
   Category: Shooting
   ================================================ */

(function () {
  'use strict';

  // ================================================================
  //  CONSTANTS
  // ================================================================
  const START_LIVES = 3;
  const MAX_LIVES   = 5;

  const ASTEROID_CFG = {
    big:    { score: 30, rMod: 0.075, sMod: 0.80 },
    medium: { score: 20, rMod: 0.050, sMod: 1.15 },
    small:  { score: 10, rMod: 0.028, sMod: 1.55 }
  };

  // Powerup definitions
  const POWERUPS = [
    { type: 'life',   emoji: '❤️',  color: '#ff0066', label: '+1 Life!',         weight: 0.10 },
    { type: 'weapon', emoji: '⚡',  color: '#ffff00', label: 'Weapon Up!',        weight: 0.14 },
    { type: 'sonic',  emoji: '💥',  color: '#ff6600', label: 'Sonic Blast!',      weight: 0.12 },
    { type: 'freeze', emoji: '❄️',  color: '#00cfff', label: 'Time Freeze!',      weight: 0.12 },
    { type: 'shield', emoji: '🛡️', color: '#9900ff', label: 'Shield!',           weight: 0.10 }
  ];

  const ABILITY_FRAMES = { sonic: 1, freeze: 300, shield: 360 };

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
  let _abilityEl       = null;
  let _overlayEl       = null;

  let _mouseX        = 0;
  let _mouseY        = 0;
  let _isPointerDown = false;
  let _lastShootTime = 0;

  let _bMouseMove  = null;
  let _bMouseDown  = null;
  let _bMouseUp    = null;
  let _bTouchStart = null;
  let _bTouchMove  = null;
  let _bTouchEnd   = null;

  const imgs = { ship: new Image(), asteroid: new Image() };

  let asteroids     = [];
  let lasers        = [];
  let particles     = [];
  let stars         = [];
  let powerups      = [];
  let shockwaves    = [];
  let activeAbility = null;   // { type, timer }
  let freezeActive  = false;
  let shieldActive  = false;

  const joystick = {
    active: false, touchId: null,
    baseX: 0, baseY: 0,
    stickX: 0, stickY: 0,
    dx: 0, dy: 0,
    baseRadius: 55, stickRadius: 24,
    maxDist: 50, opacity: 0
  };

  const game = {
    running:   false,
    score:     0,
    lives:     START_LIVES,
    highScore: parseInt(localStorage.getItem('ab_hi') || '0'),
    time:      0,
    spawnRate: 130,
    nextSpawn: 70
  };

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
  function randInt(a, b) { return Math.floor(rnd(a, b + 1)); }

  function _pickPowerup() {
    let r = Math.random(), sum = 0;
    for (const p of POWERUPS) { sum += p.weight; if (r < sum) return p; }
    return null;
  }

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
      game.running     = false;
      _running         = false;
      _gameOverPending = false;
      [_loadingEl, _hudEl, _abilityEl, _overlayEl, _joyCanvas, _canvas].forEach(el => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
      _canvas = _ctx = _joyCanvas = _jctx = null;
      _loadingEl = _hudEl = _abilityEl = _overlayEl = null;
    },
    restart() {
      _removeOverlay();
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
    description: 'Blast asteroids! Grab special abilities — Sonic Blast, Time Freeze & more!',
    emoji:       '☄️',
    difficulty:  'medium',
    controls:    { dpad: false, actions: false, center: false },
    version:     '2.0',
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
      position: 'absolute', inset: '0', zIndex: '100',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center,#0a0a2e,#000)',
      gap: '20px'
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

    if (!document.getElementById('ab-kf')) {
      const kf = document.createElement('style');
      kf.id = 'ab-kf';
      kf.textContent = `
        @keyframes ab-spin  { to{transform:rotate(360deg)} }
        @keyframes ab-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes ab-pop   { 0%{transform:scale(0.6);opacity:0} 60%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
        @keyframes ab-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes ab-shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-5px)}
          80%{transform:translateX(5px)}
        }`;
      document.head.appendChild(kf);
    }

    if (_canvas && _canvas.parentNode) _canvas.parentNode.appendChild(_loadingEl);
  }

  function _updateLoadingProgress(loaded, total) {
    const bar  = document.getElementById('ab-load-bar');
    const text = document.getElementById('ab-load-text');
    if (bar)  bar.style.width  = `${Math.round((loaded / total) * 100)}%`;
    if (text) text.textContent = `Loading assets... ${loaded}/${total}`;
  }

  function _hideLoadingOverlay() {
    if (!_loadingEl) return;
    _loadingEl.style.transition = 'opacity 0.4s ease';
    _loadingEl.style.opacity    = '0';
    setTimeout(() => {
      if (_loadingEl && _loadingEl.parentNode) _loadingEl.parentNode.removeChild(_loadingEl);
      _loadingEl = null;
    }, 420);
  }

  // ================================================================
  //  DOM BUILDER
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

    _joyCanvas = document.createElement('canvas');
    Object.assign(_joyCanvas.style, {
      position: 'absolute', top: '0', left: '0',
      width: '100%', height: '100%',
      zIndex: '25', touchAction: 'none', display: 'none'
    });
    container.appendChild(_joyCanvas);
    _jctx = _joyCanvas.getContext('2d');

    if (window.matchMedia('(pointer: coarse)').matches) {
      _joyCanvas.style.display = 'block';
    }

    // Main HUD — top bar
    _hudEl = document.createElement('div');
    Object.assign(_hudEl.style, {
      position: 'absolute', top: '0', left: '0',
      width: '100%', display: 'flex',
      justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '10px 16px', boxSizing: 'border-box',
      pointerEvents: 'none', zIndex: '10',
      fontFamily: "'Orbitron',sans-serif", color: '#fff',
      background: 'linear-gradient(to bottom,rgba(0,0,0,0.6),transparent)'
    });
    _hudEl.innerHTML = `
      <div id="ab-lives"  style="font-size:clamp(13px,3.5vw,19px);letter-spacing:2px"></div>
      <div id="ab-weapon" style="font-size:clamp(8px,1.8vw,11px);
        color:rgba(255,255,255,0.5);letter-spacing:2px;text-align:right;margin-top:2px"></div>`;
    container.appendChild(_hudEl);

    // Ability HUD — bottom center
    _abilityEl = document.createElement('div');
    Object.assign(_abilityEl.style, {
      position: 'absolute', bottom: '18px', left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex', gap: '10px', alignItems: 'center',
      pointerEvents: 'none', zIndex: '10'
    });
    container.appendChild(_abilityEl);

    _resize();
    _resizeHandler = () => { _resize(); _initStars(); };
    window.addEventListener('resize', _resizeHandler);
  }

  function _resize() {
    if (!_canvas) return;
    const p = _canvas.parentElement;
    const w = p ? p.clientWidth  : window.innerWidth;
    const h = p ? p.clientHeight : window.innerHeight;
    _canvas.width = w; _canvas.height = h;
    if (_joyCanvas) { _joyCanvas.width = w; _joyCanvas.height = h; }
    if (!game.running) { player.x = w / 2; player.y = h / 2; }
    player.r = Math.min(w, h) * 0.04;
  }

  // ================================================================
  //  ASSET LOADING
  // ================================================================
  function _loadAssets() {
    const list = [
      { img: imgs.ship,     src: 'games/assets/spaceship.png' },
      { img: imgs.asteroid, src: 'games/assets/asteroid.png'  }
    ];
    const total = list.length;
    let loaded  = 0;
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
    list.forEach(({ img, src }) => {
      img.onload = onDone; img.onerror = onDone;
      img.src = src;
      if (img.complete) onDone();
    });
  }

  // ================================================================
  //  INPUT
  // ================================================================
  function _attachListeners() {
    ControlManager.on('keydown', 'asteroid-blast', key => {
      if ((key === ' ' || key === 'Enter') && game.running) _shoot();
    });

    _bMouseMove = (e) => {
      if (!_canvas) return;
      const r = _canvas.getBoundingClientRect();
      _mouseX = e.clientX - r.left;
      _mouseY = e.clientY - r.top;
      if (game.running) player.angle = Math.atan2(_mouseY - player.y, _mouseX - player.x);
    };
    _bMouseDown = () => { _isPointerDown = true; if (game.running) _shoot(); };
    _bMouseUp   = () => { _isPointerDown = false; };

    _canvas.addEventListener('mousemove', _bMouseMove);
    _canvas.addEventListener('mousedown', _bMouseDown);
    window.addEventListener('mouseup',   _bMouseUp);

    _bTouchStart = _onTouchStart;
    _bTouchMove  = _onTouchMove;
    _bTouchEnd   = _onTouchEnd;
    _joyCanvas.addEventListener('touchstart',  _bTouchStart, { passive: false });
    _joyCanvas.addEventListener('touchmove',   _bTouchMove,  { passive: false });
    _joyCanvas.addEventListener('touchend',    _bTouchEnd,   { passive: false });
    _joyCanvas.addEventListener('touchcancel', _bTouchEnd,   { passive: false });
  }

  function _removeListeners() {
    ControlManager.off('keydown', 'asteroid-blast');
    ControlManager.clearKeys();
    if (_canvas) {
      if (_bMouseMove) _canvas.removeEventListener('mousemove', _bMouseMove);
      if (_bMouseDown) _canvas.removeEventListener('mousedown', _bMouseDown);
    }
    if (_bMouseUp) window.removeEventListener('mouseup', _bMouseUp);
    if (_joyCanvas) {
      if (_bTouchStart) _joyCanvas.removeEventListener('touchstart',  _bTouchStart);
      if (_bTouchMove)  _joyCanvas.removeEventListener('touchmove',   _bTouchMove);
      if (_bTouchEnd) {
        _joyCanvas.removeEventListener('touchend',    _bTouchEnd);
        _joyCanvas.removeEventListener('touchcancel', _bTouchEnd);
      }
    }
    _bMouseMove = _bMouseDown = _bMouseUp = null;
    _bTouchStart = _bTouchMove = _bTouchEnd = null;
    _isPointerDown = false;
  }

  // ================================================================
  //  TOUCH
  // ================================================================
  function _onTouchStart(e) {
    e.preventDefault();
    if (!_canvas) return;
    const rect = _canvas.getBoundingClientRect();
    for (const t of e.changedTouches) {
      const tx = t.clientX - rect.left;
      const ty = t.clientY - rect.top;
      if (tx < W() / 2) {
        if (!joystick.active) {
          joystick.active  = true; joystick.touchId = t.identifier;
          joystick.baseX   = joystick.stickX = tx;
          joystick.baseY   = joystick.stickY = ty;
          joystick.dx = joystick.dy = 0; joystick.opacity = 1;
        }
      } else {
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
      let dx = tx - joystick.baseX, dy = ty - joystick.baseY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > joystick.maxDist) { dx = dx/dist*joystick.maxDist; dy = dy/dist*joystick.maxDist; }
      joystick.stickX = joystick.baseX + dx; joystick.stickY = joystick.baseY + dy;
      joystick.dx = dx / joystick.maxDist;   joystick.dy = dy / joystick.maxDist;
      if (Math.abs(joystick.dx) > 0.1 || Math.abs(joystick.dy) > 0.1) {
        player.angle = Math.atan2(joystick.dy, joystick.dx);
      }
    }
  }

  function _onTouchEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (joystick.active && t.identifier === joystick.touchId) {
        joystick.active = false; joystick.touchId = null;
        joystick.dx = joystick.dy = 0;
      } else { _isPointerDown = false; }
    }
  }

  // ================================================================
  //  STARS
  // ================================================================
  function _initStars() {
    stars = [];
    for (let i = 0; i < 130; i++) {
      stars.push({
        x: rnd(0, W()), y: rnd(0, H()),
        r: rnd(0.4, 2.2),
        twinkle: Math.random() * Math.PI * 2
      });
    }
  }

  // ================================================================
  //  GAME FLOW
  // ================================================================
  function _startGame() {
    _stopLoop();
    asteroids = []; lasers = []; particles = [];
    powerups  = []; shockwaves = [];
    activeAbility = null; freezeActive = false; shieldActive = false;
    _isPointerDown = false;

    game.running   = true; game.score  = 0;
    game.lives     = START_LIVES; game.time = 0;
    game.spawnRate = 130; game.nextSpawn = 70;
    _gameOverPending = false;

    player.x = W()/2; player.y = H()/2; player.r = U()*0.04;
    player.angle = -Math.PI/2; player.invincible = 120;
    player.visible = true; player.weaponLevel = 1;

    _initStars();
    _updateHUD();
    _updateAbilityHUD();
    SoundManager.gameStart();
    _startLoop();
  }

  // ================================================================
  //  GAME OVER OVERLAY
  // ================================================================
  function _showGameOverOverlay() {
    _removeOverlay();

    const isNewBest = game.score > game.highScore;
    if (isNewBest) {
      game.highScore = game.score;
      localStorage.setItem('ab_hi', game.highScore);
    }
    ScoreManager.submitScore('asteroid-blast', game.score);

    const cont = _canvas ? _canvas.parentElement : null;
    if (!cont) {
      App.showGameResult(game.score, false);
      return;
    }

    _overlayEl = document.createElement('div');
    Object.assign(_overlayEl.style, {
      position: 'absolute', inset: '0', zIndex: '50',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.82)',
      animation: 'ab-pop 0.4s ease'
    });

    _overlayEl.innerHTML = `
      <div style="
        background:linear-gradient(135deg,#0a0a2e,#12122a);
        border:1px solid rgba(0,255,255,0.3);
        border-radius:20px;padding:2rem 1.8rem;
        max-width:340px;width:88%;text-align:center;
        box-shadow:0 0 40px rgba(0,255,255,0.15);
        display:flex;flex-direction:column;align-items:center;gap:0.9rem;">

        <div style="font-size:3.5rem;animation:ab-pulse 1s ease infinite">💀</div>

        <div style="font-family:'Orbitron',sans-serif;font-size:clamp(1.1rem,3.5vw,1.4rem);
          font-weight:900;color:#ff3333;text-shadow:0 0 20px #ff3333;letter-spacing:2px">
          GAME OVER</div>

        ${isNewBest ? `
        <div style="background:rgba(255,215,0,0.12);border:1px solid rgba(255,215,0,0.4);
          border-radius:8px;padding:0.35rem 1rem;
          font-family:'Orbitron',sans-serif;font-size:0.75rem;
          color:#ffd700;letter-spacing:1px">🏆 NEW BEST SCORE!</div>` : ''}

        <div style="background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);
          border-radius:12px;padding:1rem 1.5rem;width:100%;box-sizing:border-box">
          <div style="font-size:0.65rem;color:rgba(255,255,255,0.4);
            letter-spacing:2px;text-transform:uppercase;
            font-family:'Rajdhani',sans-serif;margin-bottom:4px">YOUR SCORE</div>
          <div id="ab-ov-score" style="font-family:'Orbitron',sans-serif;
            font-size:clamp(2rem,6vw,2.8rem);font-weight:900;
            color:#0ff;text-shadow:0 0 20px #0ff">${game.score}</div>
          <div style="font-size:0.7rem;color:rgba(255,255,255,0.35);margin-top:4px;
            font-family:'Rajdhani',sans-serif">
            Best: <span style="color:rgba(0,255,255,0.6)">${game.highScore}</span>
          </div>
        </div>

        <button id="ab-btn-replay" style="
          width:100%;padding:0.85rem;
          background:linear-gradient(135deg,#0066cc,#0044aa);
          color:#fff;border:none;border-radius:10px;
          font-family:'Orbitron',sans-serif;font-size:0.85rem;
          font-weight:700;letter-spacing:1px;cursor:pointer;
          display:flex;align-items:center;justify-content:center;gap:8px;
          transition:all 0.2s;box-shadow:0 0 20px rgba(0,100,255,0.4);
          touch-action:manipulation">
          <i class="fas fa-redo"></i> Play Again
        </button>

        <button id="ab-btn-home" style="
          width:100%;padding:0.75rem;
          background:rgba(255,255,255,0.05);
          color:rgba(255,255,255,0.7);
          border:1px solid rgba(255,255,255,0.12);
          border-radius:10px;font-family:'Orbitron',sans-serif;
          font-size:0.78rem;font-weight:700;letter-spacing:1px;
          cursor:pointer;display:flex;align-items:center;
          justify-content:center;gap:8px;transition:all 0.2s;
          touch-action:manipulation">
          <i class="fas fa-home"></i> Home
        </button>

      </div>`;

    cont.appendChild(_overlayEl);

    const replayBtn = _overlayEl.querySelector('#ab-btn-replay');
    const homeBtn   = _overlayEl.querySelector('#ab-btn-home');

    const onReplay = () => {
      SoundManager.click();
      AsteroidBlast.restart();
    };
    const onHome = () => {
      SoundManager.click();
      _removeOverlay();
      _stopLoop();
      App.showGameResult(game.score, false);
    };

    replayBtn.addEventListener('click',      onReplay);
    replayBtn.addEventListener('touchstart', (e) => { e.preventDefault(); onReplay(); }, { passive: false });
    homeBtn.addEventListener('click',        onHome);
    homeBtn.addEventListener('touchstart',   (e) => { e.preventDefault(); onHome(); }, { passive: false });

    replayBtn.addEventListener('mouseenter', () => { replayBtn.style.transform = 'translateY(-2px)'; });
    replayBtn.addEventListener('mouseleave', () => { replayBtn.style.transform = 'translateY(0)'; });
    homeBtn.addEventListener('mouseenter',   () => { homeBtn.style.borderColor = 'rgba(255,255,255,0.3)'; });
    homeBtn.addEventListener('mouseleave',   () => { homeBtn.style.borderColor = 'rgba(255,255,255,0.12)'; });

    if (isNewBest) {
      setTimeout(() => { SoundManager.newBest(); App.showToast('🏆 New Best Score!', 'success', 2000); }, 400);
    }
  }

  function _removeOverlay() {
    if (_overlayEl && _overlayEl.parentNode) {
      _overlayEl.parentNode.removeChild(_overlayEl);
    }
    _overlayEl = null;
  }

  // ================================================================
  //  SHOOT
  // ================================================================
  function _shoot() {
    if (!game.running || _gameOverPending || !player.visible) return;
    const now = Date.now();
    const delay = player.weaponLevel >= 3 ? 140 : 195;
    if (now - _lastShootTime < delay) return;
    _lastShootTime = now;

    SoundManager.navigate();

    const tipX  = player.x + Math.cos(player.angle) * player.r * 1.3;
    const tipY  = player.y + Math.sin(player.angle) * player.r * 1.3;
    const speed = U() * 0.022;

    const fire = (off) => {
      const a = player.angle + off;
      lasers.push({ x: tipX, y: tipY, vx: Math.cos(a)*speed, vy: Math.sin(a)*speed, life: 90 });
    };

    if      (player.weaponLevel === 1) { fire(0); }
    else if (player.weaponLevel === 2) { fire(-0.1); fire(0.1); }
    else                               { fire(0); fire(-0.16); fire(0.16); }
  }

  // ================================================================
  //  SPAWN ASTEROID
  // ================================================================
  function _spawnAsteroid(sizeKey, x, y, angle) {
    const cfg = ASTEROID_CFG[sizeKey];
    if (!cfg) return;

    const speed = U() * 0.003 * cfg.sMod;
    let ax, ay, vx, vy;

    if (x === undefined) {
      const edge = randInt(0, 3);
      if      (edge === 0) { ax = rnd(0, W()); ay = -80; }
      else if (edge === 1) { ax = W()+80;      ay = rnd(0, H()); }
      else if (edge === 2) { ax = rnd(0, W()); ay = H()+80; }
      else                 { ax = -80;         ay = rnd(0, H()); }
      const theta = Math.atan2(player.y + rnd(-120,120) - ay, player.x + rnd(-120,120) - ax);
      vx = Math.cos(theta)*speed; vy = Math.sin(theta)*speed;
    } else {
      ax = x; ay = y;
      vx = Math.cos(angle)*speed; vy = Math.sin(angle)*speed;
    }

    const numV = randInt(7, 12);
    const verts = [];
    for (let i = 0; i < numV; i++) {
      verts.push({ a: (i/numV)*Math.PI*2, r: 0.7 + Math.random()*0.5 });
    }

    asteroids.push({
      x: ax, y: ay, vx, vy,
      sizeKey,
      r: U() * cfg.rMod,
      rot: rnd(0, Math.PI*2),
      rotSpeed: rnd(-0.04, 0.04),
      verts
    });
  }

  // ================================================================
  //  SPAWN POWERUP
  // ================================================================
  function _trySpawnPowerup(x, y) {
    if (Math.random() > 0.35) return;
    const def = _pickPowerup();
    if (!def) return;

    powerups.push({
      x, y, ...def,
      vx: rnd(-0.9, 0.9), vy: rnd(-0.9, 0.9),
      r:  U() * 0.024,
      life: 540,
      pulse: Math.random() * Math.PI * 2
    });
  }

  // ================================================================
  //  APPLY ABILITY
  // ================================================================
  function _applyAbility(type) {
    SoundManager.correct();

    switch (type) {
      case 'life':
        if (game.lives < MAX_LIVES) {
          game.lives++;
          App.showToast('+1 Life! ❤️', 'success', 1800);
        } else {
          game.score += 150;
          _spawnScorePopup(player.x, player.y - 40, '+150 ⭐');
          App.showToast('Full lives! +150 pts', 'info', 1500);
        }
        break;

      case 'weapon':
        player.weaponLevel = Math.min(player.weaponLevel + 1, 3);
        App.showToast('Weapon Up! ⚡', 'info', 1500);
        break;

      case 'sonic':
        App.showToast('💥 SONIC BLAST!', 'success', 2000);
        _triggerSonicBlast();
        break;

      case 'freeze':
        freezeActive  = true;
        activeAbility = { type: 'freeze', timer: ABILITY_FRAMES.freeze };
        App.showToast('❄️ Time Freeze! 5s', 'info', 2000);
        break;

      case 'shield':
        shieldActive  = true;
        player.invincible = ABILITY_FRAMES.shield;
        activeAbility = { type: 'shield', timer: ABILITY_FRAMES.shield };
        App.showToast('🛡️ Shield Activated!', 'success', 2000);
        break;
    }

    _updateHUD();
    _updateAbilityHUD();
  }

  function _triggerSonicBlast() {
    shockwaves.push({ x: player.x, y: player.y, r: 0, maxR: Math.max(W(), H()), life: 40, maxLife: 40 });

    const blasted = [...asteroids];
    asteroids = [];
    blasted.forEach(a => {
      game.score += ASTEROID_CFG[a.sizeKey].score;
      _spawnExplosionParticles(a.x, a.y, a.r);
    });
    _updateHUD();
  }

  // ================================================================
  //  PARTICLES
  // ================================================================
  function _spawnParticles(x, y, color, count, sMod = 1, lMod = 1) {
    for (let i = 0; i < count; i++) {
      const a = rnd(0, Math.PI*2);
      const s = rnd(1, 4) * sMod;
      particles.push({
        x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s,
        life: rnd(20,50)*lMod, maxLife: 50*lMod,
        color, size: rnd(1.5, 5)
      });
    }
    if (particles.length > 350) particles.splice(0, particles.length - 350);
  }

  function _spawnExplosionParticles(x, y, r) {
    const count = Math.floor(r * 1.2) + 12;
    _spawnParticles(x, y, '#ffaa00', count, 2.0, 1.4);
    _spawnParticles(x, y, '#ff4400', Math.floor(count*0.6), 1.4, 1.0);
    _spawnParticles(x, y, '#ffffff', Math.floor(count*0.3), 3.0, 0.7);
  }

  function _spawnScorePopup(x, y, text) {
    particles.push({
      x, y, vx: 0, vy: -1.5, life: 55, maxLife: 55,
      color: '#fff', size: 0, text
    });
  }

  // ================================================================
  //  COLLISIONS
  // ================================================================
  function _circles(ax, ay, ar, bx, by, br) {
    const dx = ax-bx, dy = ay-by;
    return dx*dx + dy*dy < (ar+br)*(ar+br);
  }

  // ================================================================
  //  HIT PLAYER
  // ================================================================
  function _hitPlayer() {
    if (player.invincible > 0) return;
    if (_gameOverPending)       return;
    if (shieldActive)           return;

    SoundManager.wrong();
    _spawnParticles(player.x, player.y, '#ff4444', 28, 2);

    player.weaponLevel = Math.max(1, player.weaponLevel - 1);
    game.lives--;
    _updateHUD();

    if (game.lives <= 0) {
      _gameOverPending = true;
      game.running     = false;
      player.visible   = false;

      _spawnParticles(player.x, player.y, '#ffaa00', 55, 3.5, 1.5);
      _spawnParticles(player.x, player.y, '#ff0044', 35, 2.0, 2.0);

      setTimeout(() => {
        _stopLoop();
        _showGameOverOverlay();
      }, 1200);

    } else {
      player.invincible = 160;
      _spawnParticles(player.x, player.y, '#ffcc00', 14, 1.5);

      asteroids = asteroids.filter(a => {
        if (_circles(player.x, player.y, U()*0.26, a.x, a.y, a.r)) {
          _spawnExplosionParticles(a.x, a.y, a.r * 0.6);
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
      const total = Math.max(START_LIVES, game.lives);
      for (let i = 0; i < total; i++) {
        s += (i < game.lives) ? (i >= START_LIVES ? '💙 ' : '❤️ ') : '🖤 ';
      }
      livesEl.textContent = s.trim();
    }

    if (weaponEl) {
      weaponEl.textContent = ['','WEAPON LV1','WEAPON LV2','WEAPON MAX'][player.weaponLevel] || '';
    }

    const gs = document.getElementById('game-score-display');
    const gb = document.getElementById('game-best-display');
    if (gs) gs.textContent = game.score;
    if (gb) gb.textContent = game.highScore;
    App.updateScoreDisplay(game.score, ScoreManager.getBestScore('asteroid-blast'));
  }

  function _updateAbilityHUD() {
    if (!_abilityEl) return;
    if (!activeAbility) {
      _abilityEl.innerHTML = '';
      return;
    }

    const def   = POWERUPS.find(p => p.type === activeAbility.type);
    const pct   = Math.max(0, activeAbility.timer / ABILITY_FRAMES[activeAbility.type] * 100);
    const label = def ? def.label : activeAbility.type;
    const color = def ? def.color : '#0ff';

    _abilityEl.innerHTML = `
      <div style="
        background:rgba(0,0,0,0.7);
        border:1px solid ${color}44;
        border-radius:20px;padding:5px 14px;
        display:flex;align-items:center;gap:8px;
        font-family:'Orbitron',sans-serif;font-size:clamp(9px,2vw,12px);
        color:${color};letter-spacing:1px">
        <span>${def ? def.emoji : '⚡'}</span>
        <span>${label}</span>
        <div style="width:60px;height:4px;background:rgba(255,255,255,0.1);
          border-radius:2px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${color};
            border-radius:2px;transition:width 0.1s linear"></div>
        </div>
      </div>`;
  }

  // ================================================================
  //  UPDATE
  // ================================================================
  function _update() {
    _updateParticles();
    _updateShockwaves();

    if (!game.running) return;

    game.time++;

    if (_isPointerDown) _shoot();

    if (player.invincible > 0) player.invincible--;

    if (activeAbility) {
      activeAbility.timer--;
      if (activeAbility.timer <= 0) {
        if (activeAbility.type === 'freeze') freezeActive = false;
        if (activeAbility.type === 'shield') shieldActive = false;
        activeAbility = null;
        _updateAbilityHUD();
      } else if (game.time % 6 === 0) {
        _updateAbilityHUD();
      }
    }

    if (game.time % 600 === 0 && game.spawnRate > 40) game.spawnRate -= 8;

    if (game.time >= game.nextSpawn) {
      const roll = Math.random();
      const sk   = roll < 0.5 ? 'big' : roll < 0.8 ? 'medium' : 'small';
      _spawnAsteroid(sk);
      game.nextSpawn = game.time + game.spawnRate + randInt(0, 28);
    }

    stars.forEach(s => { s.twinkle += 0.025; });

    // ---- Lasers ----
    for (let i = lasers.length - 1; i >= 0; i--) {
      const l = lasers[i];
      l.x += l.vx; l.y += l.vy; l.life--;
      if (l.life <= 0 || l.x < -20 || l.x > W()+20 || l.y < -20 || l.y > H()+20) {
        lasers.splice(i, 1);
      }
    }

    // ---- Powerups ----
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.x += p.vx; p.y += p.vy; p.life--;
      p.pulse += 0.08;

      if (p.x < -p.r) p.x = W()+p.r;  if (p.x > W()+p.r) p.x = -p.r;
      if (p.y < -p.r) p.y = H()+p.r;  if (p.y > H()+p.r) p.y = -p.r;

      if (player.visible && _circles(player.x, player.y, player.r+10, p.x, p.y, p.r)) {
        _spawnParticles(p.x, p.y, p.color, 14, 2.2);
        _applyAbility(p.type);
        powerups.splice(i, 1);
        continue;
      }

      if (p.life <= 0) powerups.splice(i, 1);
    }

    // ---- Asteroids ----
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const a = asteroids[i];

      if (!freezeActive) {
        a.x += a.vx; a.y += a.vy;
      }
      a.rot += a.rotSpeed * (freezeActive ? 0.1 : 1);

      const pad = a.r * 2.5;
      if (a.x < -pad) a.x = W()+a.r;  if (a.x > W()+pad) a.x = -a.r;
      if (a.y < -pad) a.y = H()+a.r;  if (a.y > H()+pad) a.y = -a.r;

      if (player.visible &&
          _circles(player.x, player.y, player.r*0.68, a.x, a.y, a.r*0.82)) {
        _hitPlayer();
        if (_gameOverPending) {
          _spawnExplosionParticles(a.x, a.y, a.r);
          asteroids.splice(i, 1);
          break;
        }
        continue;
      }

      let hit = false;
      for (let j = lasers.length - 1; j >= 0; j--) {
        if (_circles(a.x, a.y, a.r, lasers[j].x, lasers[j].y, U()*0.012)) {
          lasers.splice(j, 1);
          hit = true;
          break;
        }
      }

      if (hit) {
        const pts = ASTEROID_CFG[a.sizeKey].score;
        game.score += pts;
        _spawnExplosionParticles(a.x, a.y, a.r);
        _spawnScorePopup(a.x, a.y - a.r - 10, `+${pts}`);
        _trySpawnPowerup(a.x, a.y);
        SoundManager.click();
        asteroids.splice(i, 1);
        _updateHUD();
      }
    }

    joystick.opacity = joystick.active
      ? Math.min(1, joystick.opacity + 0.15)
      : Math.max(0, joystick.opacity - 0.08);
  }

  function _updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function _updateShockwaves() {
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const s = shockwaves[i];
      s.r    += s.maxR / s.maxLife * 2.5;
      s.life--;
      if (s.life <= 0) shockwaves.splice(i, 1);
    }
  }

  // ================================================================
  //  DRAW
  // ================================================================
  function _draw() {
    if (!_ctx || !_canvas) return;
    _ctx.clearRect(0, 0, W(), H());

    // Background
    const bg = _ctx.createRadialGradient(W()/2, H()/2, 0, W()/2, H()/2, Math.max(W(),H())*0.72);
    bg.addColorStop(0,   '#0d0d28');
    bg.addColorStop(0.6, '#080818');
    bg.addColorStop(1,   '#030308');
    _ctx.fillStyle = bg;
    _ctx.fillRect(0, 0, W(), H());

    // Freeze tint overlay
    if (freezeActive) {
      _ctx.save();
      _ctx.globalAlpha = 0.08 + 0.05 * Math.sin(game.time * 0.1);
      _ctx.fillStyle   = '#00cfff';
      _ctx.fillRect(0, 0, W(), H());
      _ctx.restore();
    }

    // Stars
    stars.forEach(s => {
      _ctx.globalAlpha = 0.35 + 0.45 * Math.sin(s.twinkle || 0);
      _ctx.fillStyle   = '#fff';
      _ctx.beginPath(); _ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); _ctx.fill();
    });
    _ctx.globalAlpha = 1;

    // Shockwave rings
    shockwaves.forEach(s => {
      const a = s.life / s.maxLife;
      _ctx.save();
      _ctx.globalAlpha = a * 0.6;
      _ctx.strokeStyle = '#ff6600';
      _ctx.lineWidth   = 4 * a;
      _ctx.shadowColor = '#ff6600';
      _ctx.shadowBlur  = 20;
      _ctx.beginPath(); _ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); _ctx.stroke();
      _ctx.restore();
    });

    // Lasers
    _ctx.save();
    _ctx.shadowBlur  = 14;
    _ctx.shadowColor = '#00ffff';
    _ctx.strokeStyle = '#fff';
    _ctx.lineWidth   = Math.max(2, U()*0.007);
    _ctx.lineCap     = 'round';
    lasers.forEach(l => {
      _ctx.beginPath();
      _ctx.moveTo(l.x, l.y);
      _ctx.lineTo(l.x - l.vx * 3, l.y - l.vy * 3);
      _ctx.stroke();
    });
    _ctx.restore();

    // Asteroids
    asteroids.forEach(a => {
      _ctx.save();
      _ctx.translate(a.x, a.y);
      _ctx.rotate(a.rot);

      if (imgOk(imgs.asteroid)) {
        _ctx.drawImage(imgs.asteroid, -a.r, -a.r, a.r * 2, a.r * 2);
      } else {
        // Fallback polygon
        _ctx.beginPath();
        a.verts.forEach((v, i) => {
          const px = Math.cos(v.a) * a.r * v.r;
          const py = Math.sin(v.a) * a.r * v.r;
          if (i === 0) _ctx.moveTo(px, py);
          else _ctx.lineTo(px, py);
        });
        _ctx.closePath();
        _ctx.fillStyle   = '#888';
        _ctx.strokeStyle = '#bbb';
        _ctx.lineWidth   = 1.5;
        _ctx.fill();
        _ctx.stroke();
      }

      // Freeze tint on asteroids
      if (freezeActive) {
        _ctx.globalAlpha = 0.35;
        _ctx.fillStyle   = '#00cfff';
        _ctx.beginPath();
        _ctx.arc(0, 0, a.r, 0, Math.PI * 2);
        _ctx.fill();
        _ctx.globalAlpha = 1;
      }

      _ctx.restore();
    });

    // Powerups
    powerups.forEach(p => {
      const pulse = 0.75 + 0.25 * Math.sin(p.pulse);
      _ctx.save();
      _ctx.globalAlpha = Math.min(1, p.life / 60) * pulse;
      _ctx.translate(p.x, p.y);

      // Glow ring
      _ctx.shadowColor = p.color;
      _ctx.shadowBlur  = 18;
      _ctx.strokeStyle = p.color;
      _ctx.lineWidth   = 2;
      _ctx.beginPath();
      _ctx.arc(0, 0, p.r * 1.2, 0, Math.PI * 2);
      _ctx.stroke();

      // Emoji icon
      _ctx.shadowBlur       = 0;
      _ctx.font             = `${Math.floor(p.r * 1.4)}px serif`;
      _ctx.textAlign        = 'center';
      _ctx.textBaseline     = 'middle';
      _ctx.fillText(p.emoji, 0, 0);

      _ctx.restore();
    });

    // Particles
    particles.forEach(p => {
      const alpha = Math.max(0, p.life / p.maxLife);
      _ctx.save();
      _ctx.globalAlpha = alpha;

      if (p.text) {
        // Score popup text
        _ctx.font             = `bold ${Math.floor(U() * 0.032)}px 'Orbitron', sans-serif`;
        _ctx.fillStyle        = '#ffffff';
        _ctx.textAlign        = 'center';
        _ctx.textBaseline     = 'middle';
        _ctx.shadowColor      = '#00ffff';
        _ctx.shadowBlur       = 10;
        _ctx.fillText(p.text, p.x, p.y);
      } else {
        _ctx.fillStyle   = p.color;
        _ctx.shadowColor = p.color;
        _ctx.shadowBlur  = 6;
        _ctx.beginPath();
        _ctx.arc(p.x, p.y, Math.max(0.5, p.size * alpha), 0, Math.PI * 2);
        _ctx.fill();
      }

      _ctx.restore();
    });

    // Player ship
    if (player.visible && !_gameOverPending) {
      const blink = player.invincible > 0
        ? (Math.floor(game.time / 5) % 2 === 0)
        : true;

      if (blink) {
        _ctx.save();
        _ctx.translate(player.x, player.y);
        _ctx.rotate(player.angle + Math.PI / 2);

        // Shield visual
        if (shieldActive) {
          _ctx.save();
          _ctx.globalAlpha = 0.35 + 0.15 * Math.sin(game.time * 0.15);
          _ctx.strokeStyle = '#9900ff';
          _ctx.lineWidth   = 3;
          _ctx.shadowColor = '#9900ff';
          _ctx.shadowBlur  = 22;
          _ctx.beginPath();
          _ctx.arc(0, 0, player.r * 1.45, 0, Math.PI * 2);
          _ctx.stroke();
          _ctx.globalAlpha = 0.08;
          _ctx.fillStyle   = '#9900ff';
          _ctx.fill();
          _ctx.restore();
        }

        if (imgOk(imgs.ship)) {
          _ctx.drawImage(imgs.ship, -player.r, -player.r, player.r * 2, player.r * 2);
        } else {
          // Fallback triangle ship
          _ctx.fillStyle   = '#00ffff';
          _ctx.strokeStyle = '#ffffff';
          _ctx.lineWidth   = 2;
          _ctx.shadowColor = '#00ffff';
          _ctx.shadowBlur  = 14;
          _ctx.beginPath();
          _ctx.moveTo(0,              -player.r);
          _ctx.lineTo( player.r*0.6,  player.r*0.85);
          _ctx.lineTo(-player.r*0.6,  player.r*0.85);
          _ctx.closePath();
          _ctx.fill();
          _ctx.stroke();
        }

        // Engine thrust flicker when using joystick
        if (joystick.active && (joystick.dx !== 0 || joystick.dy !== 0)) {
          _ctx.globalAlpha = 0.6 + 0.4 * Math.random();
          _ctx.fillStyle   = '#ff6600';
          _ctx.shadowColor = '#ff6600';
          _ctx.shadowBlur  = 16;
          const tw = player.r * 0.28;
          const th = player.r * (0.4 + Math.random() * 0.4);
          const ty = player.r * 1.0;
          _ctx.beginPath();
          _ctx.moveTo(-tw, ty);
          _ctx.lineTo(0,   ty + th);
          _ctx.lineTo( tw, ty);
          _ctx.closePath();
          _ctx.fill();
        }

        _ctx.restore();
      }
    }

    // Joystick overlay
    _drawJoystick();
  }

  // ================================================================
  //  JOYSTICK DRAW
  // ================================================================
  function _drawJoystick() {
    if (!_jctx || !_joyCanvas) return;
    _jctx.clearRect(0, 0, _joyCanvas.width, _joyCanvas.height);

    if (joystick.opacity <= 0.01) return;

    _jctx.save();
    _jctx.globalAlpha = joystick.opacity * 0.75;

    // Base ring
    _jctx.strokeStyle = 'rgba(255,255,255,0.5)';
    _jctx.lineWidth   = 2;
    _jctx.beginPath();
    _jctx.arc(joystick.baseX, joystick.baseY, joystick.baseRadius, 0, Math.PI * 2);
    _jctx.stroke();

    // Base fill
    _jctx.fillStyle = 'rgba(255,255,255,0.06)';
    _jctx.fill();

    // Stick
    _jctx.fillStyle   = 'rgba(0,255,255,0.55)';
    _jctx.shadowColor = '#00ffff';
    _jctx.shadowBlur  = 12;
    _jctx.beginPath();
    _jctx.arc(joystick.stickX, joystick.stickY, joystick.stickRadius, 0, Math.PI * 2);
    _jctx.fill();

    _jctx.restore();
  }

  // ================================================================
  //  MAIN LOOP
  // ================================================================
  function _loop() {
    _update();
    _draw();
    _animId = requestAnimationFrame(_loop);
  }

  function _startLoop() {
    _stopLoop();
    _running = true;
    _animId  = requestAnimationFrame(_loop);
  }

  function _stopLoop() {
    _running = false;
    if (_animId) {
      cancelAnimationFrame(_animId);
      _animId = null;
    }
  }

})();
