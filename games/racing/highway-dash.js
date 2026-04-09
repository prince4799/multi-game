/* ================================================
   HIGHWAY DASH
   Endless top-down highway racing game
   ================================================ */

(function () {

  'use strict';

  // ----------------------------------------------------------------
  //  CONSTANTS
  // ----------------------------------------------------------------
  const START_LIVES     = 3;
  const MAX_LIVES       = 5;
  const LANE_COUNT      = 4;
  const BASE_SPEED      = 4;
  const SPEED_INCREMENT = 0.0008;
  const MAX_SPEED       = 18;

  // ----------------------------------------------------------------
  //  PRIVATE STATE
  // ----------------------------------------------------------------
  let _canvas          = null;
  let _ctx             = null;
  let _joyCanvas       = null;
  let _jctx            = null;
  let _animId          = null;
  let _running         = false;
  let _gameOverPending = false;
  let _resizeHandler   = null;
  let _loadingEl       = null;

  let keys     = {};
  let fireHeld = false;

  let playerCarImg = null;
  let enemyCar1Img = null;
  let enemyCar2Img = null;
  let explosionImg = null;
  let coinImg      = null;

  // ----------------------------------------------------------------
  //  GAME OBJECTS
  // ----------------------------------------------------------------
  let enemies    = [];
  let coins      = [];
  let particles  = [];
  let explosions = [];
  let roadLines  = [];
  let sideLines  = [];
  let timers     = { enemy: 0, coin: 0 };

  // ----------------------------------------------------------------
  //  ROAD STATE
  // ----------------------------------------------------------------
  const road = {
    x:           0,
    width:       0,
    laneWidth:   0,
    scrollY:     0,
    lineHeight:  60,
    lineGap:     40,
    speed:       BASE_SPEED
  };

  // ----------------------------------------------------------------
  //  JOYSTICK
  // ----------------------------------------------------------------
  const joystick = {
    active: false, touchId: null,
    baseX: 0, baseY: 0,
    stickX: 0, stickY: 0,
    dx: 0, dy: 0,
    baseRadius: 60, stickRadius: 28,
    maxDist: 55, opacity: 0
  };

  // ----------------------------------------------------------------
  //  GAME STATE
  // ----------------------------------------------------------------
  const game = {
    running:        false,
    score:          0,
    lives:          START_LIVES,
    highScore:      parseInt(localStorage.getItem('hd_hi') || '0'),
    distance:       0,
    speed:          BASE_SPEED,
    time:           0,
    shakeTimer:     0,
    shakeIntensity: 0
  };

  // ----------------------------------------------------------------
  //  PLAYER
  // ----------------------------------------------------------------
  const CAR_W = 46;
  const CAR_H = 80;
  const player = {
    x:          0,
    y:          0,
    w:          CAR_W,
    h:          CAR_H,
    targetX:    0,
    currentLane:1,
    invincible: 0,
    tilt:       0,
    speed:      0
  };

  // ----------------------------------------------------------------
  //  HELPERS
  // ----------------------------------------------------------------
  function imgOk(img) {
    return img && img.complete && img.naturalWidth > 0;
  }
  function W() { return _canvas ? _canvas.width  : window.innerWidth;  }
  function H() { return _canvas ? _canvas.height : window.innerHeight; }

  function laneX(laneIndex) {
    return road.x + road.laneWidth * laneIndex + road.laneWidth / 2;
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ----------------------------------------------------------------
  //  PUBLIC GAME OBJECT
  // ----------------------------------------------------------------
  const HighwayDash = {
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
      [_loadingEl, _joyCanvas, _canvas].forEach(el => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
      _canvas = _ctx = _joyCanvas = _jctx = _loadingEl = null;
    },
    restart() {
      _hideLoadingOverlay();
      _gameOverPending = false;
      _startGame();
    }
  };

  // ----------------------------------------------------------------
  //  REGISTER
  // ----------------------------------------------------------------
  GameRegistry.register({
    id:          'highway-dash',
    title:       'Highway Dash',
    category:    'racing',
    description: 'Weave through traffic on an endless highway. How far can you go?',
    emoji:       '🚗',
    difficulty:  'medium',
    controls:    { dpad: false, actions: false, center: false },
    version:     '1.0',
    init:        (container) => HighwayDash.start(container),
    destroy:     () => HighwayDash.destroy(),
    restart:     () => HighwayDash.restart()
  });

  // ----------------------------------------------------------------
  //  LOADING OVERLAY
  // ----------------------------------------------------------------
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
      background:     'radial-gradient(ellipse at center, #0a1a0a, #000)',
      gap:            '20px'
    });

    _loadingEl.innerHTML = `
      <div style="
        font-size: clamp(3rem, 10vw, 5rem);
        animation: hd-float 2s ease-in-out infinite;
        filter: drop-shadow(0 0 20px #ff9500);
      ">🚗</div>

      <div style="
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(1rem, 3vw, 1.4rem);
        font-weight: 700;
        color: #ff9500;
        text-shadow: 0 0 20px #ff9500;
        letter-spacing: 3px;
      ">HIGHWAY DASH</div>

      <div style="
        width: 48px; height: 48px;
        border: 4px solid rgba(255,149,0,0.15);
        border-top-color: #ff9500;
        border-radius: 50%;
        animation: hd-spin 0.8s linear infinite;
      "></div>

      <div id="hd-load-text" style="
        color: rgba(255,255,255,0.45);
        font-size: 0.8rem;
        letter-spacing: 2px;
        text-transform: uppercase;
        font-family: 'Rajdhani', sans-serif;
      ">Loading assets...</div>

      <div style="
        width: clamp(160px, 40vw, 260px);
        height: 3px;
        background: rgba(255,255,255,0.08);
        border-radius: 2px;
        overflow: hidden;
      ">
        <div id="hd-load-bar" style="
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, #ff9500, #ff3200);
          border-radius: 2px;
          transition: width 0.3s ease;
        "></div>
      </div>
    `;

    if (!document.getElementById('hd-keyframes')) {
      const kf = document.createElement('style');
      kf.id = 'hd-keyframes';
      kf.textContent = `
        @keyframes hd-spin  { to { transform: rotate(360deg); } }
        @keyframes hd-float {
          0%,100% { transform: translateY(0);    }
          50%     { transform: translateY(-12px); }
        }
        @keyframes hd-pulse {
          0%,100% { opacity: 1;   }
          50%     { opacity: 0.4; }
        }
      `;
      document.head.appendChild(kf);
    }

    if (_canvas && _canvas.parentNode) {
      _canvas.parentNode.appendChild(_loadingEl);
    }
  }

  function _updateLoadingProgress(loaded, total) {
    const bar  = document.getElementById('hd-load-bar');
    const text = document.getElementById('hd-load-text');
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

  // ----------------------------------------------------------------
  //  DOM BUILDER
  // ----------------------------------------------------------------
  function _buildDOM(container) {
    Object.assign(container.style, {
      position:   'relative',
      overflow:   'hidden',
      background: '#111',
      width:      '100%',
      height:     '100%'
    });

    // Main canvas
    _canvas = document.createElement('canvas');
    Object.assign(_canvas.style, {
      position: 'absolute', top: '0', left: '0',
      width: '100%', height: '100%', zIndex: '1'
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
    const hud = document.createElement('div');
    hud.id = 'hd-hud';
    Object.assign(hud.style, {
      position:       'absolute',
      top:            '0',
      left:           '0',
      width:          '100%',
      display:        'flex',
      justifyContent: 'space-between',
      alignItems:     'center',
      padding:        '10px 18px',
      pointerEvents:  'none',
      zIndex:         '10',
      background:     'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)'
    });
    hud.innerHTML = `
      <span style="
        color: #fff;
        font-size: 15px;
        font-family: 'Orbitron', sans-serif;
        text-shadow: 0 0 8px rgba(255,149,0,0.8);
      ">
        🏁 <span id="hd-dist">0</span>m
      </span>
      <span style="
        color: #fff;
        font-family: 'Orbitron', sans-serif;
        font-size: 15px;
        text-shadow: 0 0 8px rgba(255,149,0,0.8);
      ">
        ⭐ <span id="hd-score">0</span>
      </span>
      <span id="hd-lives" style="
        color: #fff;
        font-size: 18px;
        letter-spacing: 2px;
      ">
        ${'❤️'.repeat(START_LIVES)}
      </span>
    `;
    container.appendChild(hud);

    // Speed meter
    const speedEl = document.createElement('div');
    speedEl.id = 'hd-speed-wrap';
    Object.assign(speedEl.style, {
      position:      'absolute',
      bottom:        '20px',
      left:          '20px',
      zIndex:        '10',
      pointerEvents: 'none',
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'flex-start',
      gap:           '4px'
    });
    speedEl.innerHTML = `
      <span style="
        font-family: 'Orbitron', sans-serif;
        font-size: 10px;
        color: rgba(255,255,255,0.5);
        letter-spacing: 2px;
      ">SPEED</span>
      <span id="hd-speed-val" style="
        font-family: 'Orbitron', sans-serif;
        font-size: 22px;
        font-weight: 900;
        color: #ff9500;
        text-shadow: 0 0 12px #ff9500;
      ">0</span>
      <span style="
        font-family: 'Orbitron', sans-serif;
        font-size: 9px;
        color: rgba(255,255,255,0.4);
      ">KM/H</span>
    `;
    container.appendChild(speedEl);

    _resize();
    _resizeHandler = () => { _resize(); _initRoadLines(); };
    window.addEventListener('resize', _resizeHandler);
    _attachListeners();
  }

  function _resize() {
    if (!_canvas) return;
    const p = _canvas.parentElement;
    const w = p ? p.clientWidth  : window.innerWidth;
    const h = p ? p.clientHeight : window.innerHeight;
    _canvas.width  = w;
    _canvas.height = h;
    if (_joyCanvas) {
      _joyCanvas.width  = w;
      _joyCanvas.height = h;
    }

    // Road is 70% of screen width, centered
    road.width     = Math.min(w * 0.72, 420);
    road.x         = (w - road.width) / 2;
    road.laneWidth = road.width / LANE_COUNT;
  }

  // ----------------------------------------------------------------
  //  ASSET LOADING
  // ----------------------------------------------------------------
  function _loadAssets() {
    playerCarImg = new Image();
    enemyCar1Img = new Image();
    enemyCar2Img = new Image();
    explosionImg = new Image();
    coinImg      = new Image();

    const assets = [
      { img: playerCarImg, src: 'games/assets/player-car.png'  },
      { img: enemyCar1Img, src: 'games/assets/enemy-car-1.png' },
      { img: enemyCar2Img, src: 'games/assets/enemy-car-2.png' },
      { img: explosionImg, src: 'games/assets/explosion.png'   },
      { img: coinImg,      src: 'games/assets/coin.png'        }
    ];

    const total  = assets.length;
    let   loaded = 0;

    const onDone = () => {
      loaded++;
      _updateLoadingProgress(loaded, total);
      if (loaded >= total) {
        setTimeout(() => {
          _hideLoadingOverlay();
          _startGame();
        }, 300);
      }
    };

    assets.forEach(({ img, src }) => {
      img.onload  = onDone;
      img.onerror = onDone;
      img.src     = src;
      if (img.complete) onDone();
    });
  }

  // ----------------------------------------------------------------
  //  INPUT LISTENERS
  // ----------------------------------------------------------------
  const _onKeyDown = (e) => {
    keys[e.code] = true;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  };
  const _onKeyUp = (e) => { keys[e.code] = false; };

  let _mouseJoy = false;
  const _onMouseMove = (e) => {
    if (_mouseJoy && joystick.active && _canvas) {
      const r = _canvas.getBoundingClientRect();
      _joyMove(e.clientX - r.left, e.clientY - r.top);
    }
  };
  const _onMouseUp = () => {
    if (_mouseJoy) { _joyEnd(); _mouseJoy = false; }
  };

  function _attachListeners() {
    window.addEventListener('keydown',   _onKeyDown);
    window.addEventListener('keyup',     _onKeyUp);
    window.addEventListener('mousemove', _onMouseMove);
    window.addEventListener('mouseup',   _onMouseUp);

    _joyCanvas.addEventListener('touchstart',  _joyTouchStart, { passive: false });
    _joyCanvas.addEventListener('touchmove',   _joyTouchMove,  { passive: false });
    _joyCanvas.addEventListener('touchend',    _joyTouchEnd,   { passive: false });
    _joyCanvas.addEventListener('touchcancel', _joyTouchEnd,   { passive: false });

    _joyCanvas.addEventListener('mousedown', (e) => {
      if (!_canvas) return;
      const r = _canvas.getBoundingClientRect();
      if (_joyStart(e.clientX - r.left, e.clientY - r.top, -1)) {
        _mouseJoy = true;
      }
    });
  }

  function _removeListeners() {
    window.removeEventListener('keydown',   _onKeyDown);
    window.removeEventListener('keyup',     _onKeyUp);
    window.removeEventListener('mousemove', _onMouseMove);
    window.removeEventListener('mouseup',   _onMouseUp);
    if (_resizeHandler) {
      window.removeEventListener('resize', _resizeHandler);
      _resizeHandler = null;
    }
    keys     = {};
    fireHeld = false;
  }

  // ----------------------------------------------------------------
  //  JOYSTICK
  // ----------------------------------------------------------------
  const _joyTouchStart = (e) => {
    e.preventDefault();
    if (!_canvas) return;
    const r = _canvas.getBoundingClientRect();
    for (const t of e.changedTouches) {
      _joyStart(t.clientX - r.left, t.clientY - r.top, t.identifier);
    }
  };
  const _joyTouchMove = (e) => {
    e.preventDefault();
    if (!_canvas) return;
    const r = _canvas.getBoundingClientRect();
    for (const t of e.changedTouches) {
      if (joystick.active && t.identifier === joystick.touchId) {
        _joyMove(t.clientX - r.left, t.clientY - r.top);
      }
    }
  };
  const _joyTouchEnd = (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (joystick.active && t.identifier === joystick.touchId) _joyEnd();
    }
  };

  function _joyStart(x, y, id) {
    joystick.active  = true;
    joystick.touchId = id;
    joystick.baseX   = x; joystick.baseY  = y;
    joystick.stickX  = x; joystick.stickY = y;
    joystick.dx = 0; joystick.dy = 0;
    joystick.opacity = 1;
    return true;
  }
  function _joyMove(x, y) {
    if (!joystick.active) return;
    let dx = x - joystick.baseX;
    let dy = y - joystick.baseY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > joystick.maxDist) {
      dx = (dx / dist) * joystick.maxDist;
      dy = (dy / dist) * joystick.maxDist;
    }
    joystick.stickX = joystick.baseX + dx;
    joystick.stickY = joystick.baseY + dy;
    joystick.dx = dx / joystick.maxDist;
    joystick.dy = dy / joystick.maxDist;
  }
  function _joyEnd() {
    joystick.active  = false;
    joystick.touchId = null;
    joystick.dx = 0; joystick.dy = 0;
  }

  // ----------------------------------------------------------------
  //  ROAD LINES INIT
  // ----------------------------------------------------------------
  function _initRoadLines() {
    roadLines = [];
    const total = Math.ceil(H() / (road.lineHeight + road.lineGap)) + 2;
    for (let i = 0; i < total; i++) {
      roadLines.push({
        y: i * (road.lineHeight + road.lineGap)
      });
    }
    // Side decoration lines
    sideLines = [];
    for (let i = 0; i < 20; i++) {
      sideLines.push({
        side:  Math.random() > 0.5 ? 'left' : 'right',
        y:     Math.random() * H(),
        speed: 0.5 + Math.random() * 1.5,
        alpha: 0.1 + Math.random() * 0.25
      });
    }
  }

  // ----------------------------------------------------------------
  //  ROAD UPDATE & DRAW
  // ----------------------------------------------------------------
  function _updateRoad() {
    road.scrollY += game.speed;
    if (road.scrollY > road.lineHeight + road.lineGap) {
      road.scrollY = 0;
    }

    // Update side decoration lines
    sideLines.forEach(sl => {
      sl.y += game.speed * sl.speed;
      if (sl.y > H() + 40) sl.y = -40;
    });
  }

  function _drawRoad() {
    const ctx = _ctx;
    const rx  = road.x;
    const rw  = road.width;

    // ---- Grass / sides ----
    // Left side
    const leftGrad = ctx.createLinearGradient(0, 0, rx, 0);
    leftGrad.addColorStop(0,   '#1a2e1a');
    leftGrad.addColorStop(0.7, '#1f361f');
    leftGrad.addColorStop(1,   '#243824');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, rx, H());

    // Right side
    const rightGrad = ctx.createLinearGradient(rx + rw, 0, W(), 0);
    rightGrad.addColorStop(0,   '#243824');
    rightGrad.addColorStop(0.3, '#1f361f');
    rightGrad.addColorStop(1,   '#1a2e1a');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(rx + rw, 0, W() - (rx + rw), H());

    // Side decoration lines (trees / barriers feel)
    sideLines.forEach(sl => {
      const x = sl.side === 'left'
        ? rx * 0.25
        : rx + rw + rx * 0.75;
      ctx.save();
      ctx.globalAlpha = sl.alpha;
      ctx.fillStyle   = '#4a7a4a';
      ctx.fillRect(x - 3, sl.y, 6, 30);
      ctx.restore();
    });

    // ---- Road base ----
    const roadGrad = ctx.createLinearGradient(rx, 0, rx + rw, 0);
    roadGrad.addColorStop(0,   '#2a2a2a');
    roadGrad.addColorStop(0.5, '#333333');
    roadGrad.addColorStop(1,   '#2a2a2a');
    ctx.fillStyle = roadGrad;
    ctx.fillRect(rx, 0, rw, H());

    // ---- Road edge lines ----
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 4;
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(rx, 0);      ctx.lineTo(rx, H());      ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx + rw, 0); ctx.lineTo(rx + rw, H()); ctx.stroke();
    ctx.restore();

    // ---- Solid shoulder lines (yellow) ----
    ctx.save();
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth   = 3;
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(rx + 6, 0);      ctx.lineTo(rx + 6, H());      ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx + rw - 6, 0); ctx.lineTo(rx + rw - 6, H()); ctx.stroke();
    ctx.restore();

    // ---- Lane dividers (dashed white) ----
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth   = 2;
    for (let lane = 1; lane < LANE_COUNT; lane++) {
      const lx = rx + road.laneWidth * lane;
      roadLines.forEach(rl => {
        const y = (rl.y + road.scrollY) % (H() + road.lineHeight + road.lineGap) - road.lineHeight;
        ctx.beginPath();
        ctx.moveTo(lx, y);
        ctx.lineTo(lx, y + road.lineHeight);
        ctx.stroke();
      });
    }
    ctx.restore();

    // ---- Speed shimmer effect at high speed ----
    const speedRatio = (game.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED);
    if (speedRatio > 0.3) {
      ctx.save();
      ctx.globalAlpha = speedRatio * 0.12;
      const shimmer = ctx.createLinearGradient(rx, 0, rx + rw, 0);
      shimmer.addColorStop(0,   'transparent');
      shimmer.addColorStop(0.5, '#ff9500');
      shimmer.addColorStop(1,   'transparent');
      ctx.fillStyle = shimmer;
      ctx.fillRect(rx, 0, rw, H());
      ctx.restore();
    }
  }

  // ----------------------------------------------------------------
  //  PLAYER
  // ----------------------------------------------------------------
  function _resetPlayer() {
    player.currentLane = Math.floor(LANE_COUNT / 2);
    player.x           = laneX(player.currentLane);
    player.targetX     = player.x;
    player.y           = H() * 0.75;
    player.invincible  = 0;
    player.tilt        = 0;
    player.speed       = 0;
  }

  function _updatePlayer() {
    // ---- Horizontal input ----
    let inputDx = 0;

    if (keys['ArrowLeft']  || keys['KeyA']) inputDx = -1;
    if (keys['ArrowRight'] || keys['KeyD']) inputDx =  1;

    if (joystick.active && Math.abs(joystick.dx) > 0.25) {
      inputDx = joystick.dx;
    }

    // Move player horizontally (smooth, clamped to road)
    const moveSpeed = 5.5;
    player.x += inputDx * moveSpeed;

    // Clamp to road boundaries
    const minX = road.x + player.w / 2 + 8;
    const maxX = road.x + road.width - player.w / 2 - 8;
    player.x   = Math.max(minX, Math.min(maxX, player.x));

    // Tilt car based on movement
    player.tilt += (inputDx * 0.18 - player.tilt) * 0.12;

    if (player.invincible > 0) player.invincible--;
  }

  function _drawPlayer() {
    const ctx = _ctx;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.tilt);

    // Flash when invincible
    if (player.invincible > 0 && Math.floor(player.invincible / 4) % 2 === 0) {
      ctx.globalAlpha = 0.3;
    }

    if (imgOk(playerCarImg)) {
      ctx.drawImage(
        playerCarImg,
        -CAR_W / 2, -CAR_H / 2,
        CAR_W, CAR_H
      );
    } else {
      // Fallback drawn car
      _drawCarShape(ctx, 0, 0, CAR_W, CAR_H, '#00aaff', '#0066cc', true);
    }

    // Exhaust particles effect at high speed
    const speedRatio = (game.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED);
    if (speedRatio > 0.2 && Math.random() > 0.5) {
      ctx.globalAlpha = 0.4 * speedRatio;
      ctx.fillStyle   = '#ff6600';
      const ew = 6 + speedRatio * 6;
      ctx.beginPath();
      ctx.ellipse(-CAR_W * 0.2, CAR_H * 0.5 + 5, ew / 3, ew, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse( CAR_W * 0.2, CAR_H * 0.5 + 5, ew / 3, ew, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Fallback vector car drawing
  function _drawCarShape(ctx, cx, cy, w, h, bodyColor, shadowColor, isPlayer) {
    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle   = shadowColor;
    ctx.beginPath();
    ctx.ellipse(cx + 3, cy + 3, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, [w * 0.2, w * 0.2, w * 0.15, w * 0.15]);
    ctx.fill();

    // Windshield
    ctx.fillStyle = isPlayer ? 'rgba(100,200,255,0.7)' : 'rgba(255,100,100,0.7)';
    ctx.beginPath();
    ctx.roundRect(cx - w * 0.32, cy - h * 0.38, w * 0.64, h * 0.22, 4);
    ctx.fill();

    // Rear window
    ctx.fillStyle = isPlayer ? 'rgba(80,160,220,0.5)' : 'rgba(200,80,80,0.5)';
    ctx.beginPath();
    ctx.roundRect(cx - w * 0.28, cy + h * 0.12, w * 0.56, h * 0.16, 4);
    ctx.fill();

    // Headlights / taillights
    const lightColor = isPlayer ? '#ffffff' : '#ff3333';
    ctx.fillStyle = lightColor;
    ctx.shadowColor = lightColor;
    ctx.shadowBlur  = 8;
    ctx.beginPath(); ctx.ellipse(cx - w * 0.3, cy - h * 0.46, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + w * 0.3, cy - h * 0.46, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Wheels
    ctx.fillStyle = '#111';
    [[-w * 0.44, -h * 0.32], [w * 0.44, -h * 0.32],
     [-w * 0.44,  h * 0.28], [w * 0.44,  h * 0.28]].forEach(([wx, wy]) => {
      ctx.beginPath();
      ctx.ellipse(cx + wx, cy + wy, 5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ----------------------------------------------------------------
  //  ENEMIES
  // ----------------------------------------------------------------
  const ENEMY_COLORS = [
    ['#ff4444', '#cc2222'],
    ['#44ff44', '#22cc22'],
    ['#ffff44', '#cccc22'],
    ['#ff44ff', '#cc22cc'],
    ['#44ffff', '#22cccc'],
    ['#ff8844', '#cc6622']
  ];

  function _spawnEnemy() {
    const lane      = randInt(0, LANE_COUNT - 1);
    const colorPair = ENEMY_COLORS[randInt(0, ENEMY_COLORS.length - 1)];
    const isTruck   = Math.random() > 0.7;
    const w         = isTruck ? CAR_W * 1.15 : CAR_W;
    const h         = isTruck ? CAR_H * 1.35 : CAR_H;

    enemies.push({
      x:       laneX(lane),
      y:       -h - 20,
      w, h,
      lane,
      speed:   game.speed * (0.3 + Math.random() * 0.35),
      color:   colorPair[0],
      shadow:  colorPair[1],
      isTruck,
      img:     isTruck ? enemyCar2Img : enemyCar1Img
    });
  }

  function _updateEnemies() {
    enemies.forEach(e => { e.y += e.speed; });
    enemies = enemies.filter(e => e.y - e.h / 2 < H() + 80);
  }

  function _drawEnemies() {
    enemies.forEach(e => {
      _ctx.save();
      _ctx.translate(e.x, e.y);
      _ctx.rotate(Math.PI); // face downward (towards player)

      if (imgOk(e.img)) {
        _ctx.drawImage(e.img, -e.w / 2, -e.h / 2, e.w, e.h);
      } else {
        _drawCarShape(_ctx, 0, 0, e.w, e.h, e.color, e.shadow, false);
      }
      _ctx.restore();
    });
  }

  // ----------------------------------------------------------------
  //  COINS
  // ----------------------------------------------------------------
  function _spawnCoin() {
    const lane = randInt(0, LANE_COUNT - 1);
    coins.push({
      x:      laneX(lane),
      y:      -30,
      r:      14,
      speed:  game.speed * 0.55,
      angle:  0,
      glow:   Math.random() * Math.PI * 2,
      lane
    });
  }

  function _updateCoins() {
    coins.forEach(c => {
      c.y     += c.speed;
      c.angle += 0.08;
      c.glow  += 0.1;
    });
    coins = coins.filter(c => c.y - c.r < H() + 40);
  }

  function _drawCoins() {
    coins.forEach(c => {
      _ctx.save();
      _ctx.translate(c.x, c.y);

      if (imgOk(coinImg)) {
        const s = c.r * 2.2;
        _ctx.rotate(c.angle);
        _ctx.shadowColor = '#ffd700';
        _ctx.shadowBlur  = 10 + 6 * Math.sin(c.glow);
        _ctx.drawImage(coinImg, -s / 2, -s / 2, s, s);
        _ctx.shadowBlur = 0;
      } else {
        // Fallback coin
        _ctx.shadowColor = '#ffd700';
        _ctx.shadowBlur  = 12 + 6 * Math.sin(c.glow);
        _ctx.beginPath();
        _ctx.arc(0, 0, c.r, 0, Math.PI * 2);
        const g = _ctx.createRadialGradient(-3, -3, 2, 0, 0, c.r);
        g.addColorStop(0, '#ffe066');
        g.addColorStop(0.6, '#ffd700');
        g.addColorStop(1, '#b8860b');
        _ctx.fillStyle = g;
        _ctx.fill();
        _ctx.shadowBlur = 0;
        _ctx.fillStyle  = 'rgba(255,255,255,0.35)';
        _ctx.beginPath();
        _ctx.ellipse(-3, -3, c.r * 0.4, c.r * 0.55, -0.5, 0, Math.PI * 2);
        _ctx.fill();
        // $ symbol
        _ctx.fillStyle  = '#b8860b';
        _ctx.font       = `bold ${c.r}px sans-serif`;
        _ctx.textAlign  = 'center';
        _ctx.textBaseline = 'middle';
        _ctx.fillText('$', 0, 1);
      }
      _ctx.restore();
    });
  }

  // ----------------------------------------------------------------
  //  EXPLOSIONS
  // ----------------------------------------------------------------
  function _spawnExplosion(x, y, size) {
    explosions.push({ x, y, size, age: 0, maxAge: 40 });
  }
  function _updateExplosions() {
    explosions.forEach(e => e.age++);
    explosions = explosions.filter(e => e.age < e.maxAge);
  }
  function _drawExplosions() {
    explosions.forEach(e => {
      const progress = e.age / e.maxAge;
      const scale    = 0.3 + Math.pow(progress, 0.5) * 1.5;
      const alpha    = progress < 0.25 ? 1 : 1 - (progress - 0.25) / 0.75;
      const s        = e.size * scale;
      _ctx.save();
      _ctx.globalAlpha = Math.max(0, alpha);
      if (imgOk(explosionImg)) {
        _ctx.drawImage(explosionImg, e.x - s / 2, e.y - s / 2, s, s);
      } else {
        const g = _ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, s / 2);
        g.addColorStop(0,   'rgba(255,220,50,0.95)');
        g.addColorStop(0.4, 'rgba(255,100,0,0.7)');
        g.addColorStop(1,   'rgba(100,0,0,0)');
        _ctx.fillStyle = g;
        _ctx.beginPath();
        _ctx.arc(e.x, e.y, s / 2, 0, Math.PI * 2);
        _ctx.fill();
      }
      _ctx.globalAlpha = 1;
      _ctx.restore();
    });
  }

  // ----------------------------------------------------------------
  //  PARTICLES
  // ----------------------------------------------------------------
  function _spawnParticles(x, y, color, count = 10, spread = 4) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.5 + Math.random() * spread;
      particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 25 + Math.random() * 20,
        maxLife: 45,
        r: 1.5 + Math.random() * 3,
        color
      });
    }
    if (particles.length > 200) particles.splice(0, particles.length - 200);
  }

  function _spawnScorePopup(x, y, text) {
    particles.push({
      x, y, vx: 0, vy: -1.5,
      life: 55, maxLife: 55,
      r: 0, color: '#fff', text
    });
  }

  function _updateParticles() {
    particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; });
    particles = particles.filter(p => p.life > 0);
  }

  function _drawParticles() {
    particles.forEach(p => {
      const a = Math.max(0, p.life / p.maxLife);
      _ctx.save();
      _ctx.globalAlpha = a;
      if (p.text) {
        _ctx.fillStyle   = 'gold';
        _ctx.font        = 'bold 17px sans-serif';
        _ctx.textAlign   = 'center';
        _ctx.shadowColor = 'rgba(255,200,0,0.8)';
        _ctx.shadowBlur  = 8;
        _ctx.fillText(p.text, p.x, p.y);
      } else {
        _ctx.beginPath();
        _ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
        _ctx.fillStyle = p.color;
        _ctx.fill();
      }
      _ctx.restore();
    });
  }

  // ----------------------------------------------------------------
  //  COLLISION HELPERS
  // ----------------------------------------------------------------
  function _rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    const margin = 0.65; // forgiveness factor
    return (
      Math.abs(ax - bx) < (aw + bw) / 2 * margin &&
      Math.abs(ay - by) < (ah + bh) / 2 * margin
    );
  }

  function _circleRect(cx, cy, cr, rx, ry, rw, rh) {
    const nearX = Math.max(rx - rw / 2, Math.min(cx, rx + rw / 2));
    const nearY = Math.max(ry - rh / 2, Math.min(cy, ry + rh / 2));
    const dx = cx - nearX, dy = cy - nearY;
    return dx * dx + dy * dy < cr * cr;
  }

  // ----------------------------------------------------------------
  //  HUD UPDATE
  // ----------------------------------------------------------------
  function _updateHUD() {
    const distEl  = document.getElementById('hd-dist');
    const scoreEl = document.getElementById('hd-score');
    const livesEl = document.getElementById('hd-lives');
    const speedEl = document.getElementById('hd-speed-val');

    if (distEl)  distEl.textContent  = Math.floor(game.distance);
    if (scoreEl) scoreEl.textContent = game.score;
    if (speedEl) {
      const kmh = Math.round((game.speed / BASE_SPEED) * 60);
      speedEl.textContent = kmh;
      speedEl.style.color = game.speed > MAX_SPEED * 0.7 ? '#ff3300' : '#ff9500';
    }

    if (livesEl) {
      if (game.lives <= 0) {
        livesEl.textContent = '💀';
      } else {
        livesEl.textContent = '❤️'.repeat(Math.min(game.lives, MAX_LIVES));
      }
    }

    // Platform displays
    const gs = document.getElementById('game-score-display');
    const gb = document.getElementById('game-best-display');
    if (gs) gs.textContent = game.score;
    if (gb) gb.textContent = game.highScore;
  }

  // ----------------------------------------------------------------
  //  DISTANCE MILESTONE TOASTS
  // ----------------------------------------------------------------
  const _milestones = new Set();
  function _checkMilestone() {
    const d = Math.floor(game.distance);
    [100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000].forEach(m => {
      if (d >= m && !_milestones.has(m)) {
        _milestones.add(m);
        App.showToast(`🏁 ${m}m reached!`, 'success', 1800);
        _spawnScorePopup(W() / 2, H() / 2, `${m}M!`);
      }
    });
  }

  // ----------------------------------------------------------------
  //  GAME FLOW
  // ----------------------------------------------------------------
  function _startGame() {
    _stopLoop();

    game.running        = true;
    game.score          = 0;
    game.lives          = START_LIVES;
    game.distance       = 0;
    game.speed          = BASE_SPEED;
    game.time           = 0;
    game.shakeTimer     = 0;
    game.shakeIntensity = 0;
    _gameOverPending    = false;

    enemies    = [];
    coins      = [];
    particles  = [];
    explosions = [];
    timers     = { enemy: 60, coin: 120 };
    keys       = {};
    _milestones.clear();

    _initRoadLines();
    _resetPlayer();
    _updateHUD();
    _startLoop();
  }

  // ----------------------------------------------------------------
  //  HIT PLAYER
  // ----------------------------------------------------------------
  function _hitPlayer(ex, ey) {
    if (player.invincible > 0) return;
    if (_gameOverPending)       return;

    game.lives--;
    game.shakeTimer     = 22;
    game.shakeIntensity = 10;
    player.invincible   = 120;

    _spawnExplosion(player.x, player.y, 90);
    _spawnParticles(player.x, player.y, '#ff4444', 20, 5);
    if (ex !== undefined) _spawnParticles(ex, ey, '#ff8800', 12, 4);
    _updateHUD();

    if (game.lives <= 0) {
      game.running = false;
      _spawnExplosion(player.x, player.y, 160);
      _spawnParticles(player.x, player.y, '#ff8800', 35, 7);
      setTimeout(_gameOver, 900);
    }
  }

  // ----------------------------------------------------------------
  //  GAME OVER
  // ----------------------------------------------------------------
  function _gameOver() {
    if (_gameOverPending) return;
    _gameOverPending = true;
    game.running     = false;

    if (game.score > game.highScore) {
      game.highScore = game.score;
      localStorage.setItem('hd_hi', game.highScore);
    }

    _updateHUD();

    setTimeout(() => {
      _stopLoop();
      const passed = game.distance >= 500;
      App.showGameResult(game.score, passed);
    }, 900);
  }

  // ----------------------------------------------------------------
  //  JOYSTICK DRAW
  // ----------------------------------------------------------------
  function _drawJoystick() {
    if (!_jctx) return;
    _jctx.clearRect(0, 0, _joyCanvas.width, _joyCanvas.height);
    joystick.opacity = joystick.active
      ? Math.min(1, joystick.opacity + 0.15)
      : Math.max(0, joystick.opacity - 0.08);
    if (joystick.opacity <= 0.01) return;

    const alpha = joystick.opacity;
    _jctx.save();

    _jctx.globalAlpha = alpha * 0.25;
    _jctx.beginPath();
    _jctx.arc(joystick.baseX, joystick.baseY, joystick.baseRadius, 0, Math.PI * 2);
    _jctx.fillStyle = '#ffffff';
    _jctx.fill();
    _jctx.globalAlpha = alpha * 0.45;
    _jctx.strokeStyle = '#ff9500';
    _jctx.lineWidth   = 2.5;
    _jctx.stroke();

    const sx = joystick.active ? joystick.stickX : joystick.baseX;
    const sy = joystick.active ? joystick.stickY : joystick.baseY;
    _jctx.globalAlpha = alpha * 0.75;
    const sg = _jctx.createRadialGradient(sx - 5, sy - 5, 2, sx, sy, joystick.stickRadius);
    sg.addColorStop(0, '#ffcc66');
    sg.addColorStop(1, '#cc6600');
    _jctx.beginPath();
    _jctx.arc(sx, sy, joystick.stickRadius, 0, Math.PI * 2);
    _jctx.fillStyle = sg;
    _jctx.fill();
    _jctx.globalAlpha = alpha * 0.9;
    _jctx.strokeStyle = '#ff9500';
    _jctx.lineWidth   = 2;
    _jctx.stroke();

    _jctx.restore();
  }

  // ----------------------------------------------------------------
  //  DRAW SPEED LINES (high speed effect)
  // ----------------------------------------------------------------
  function _drawSpeedLines() {
    const ratio = (game.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED);
    if (ratio < 0.25) return;

    const count = Math.floor(ratio * 18);
    _ctx.save();
    _ctx.globalAlpha = ratio * 0.18;
    _ctx.strokeStyle = '#ffffff';
    _ctx.lineWidth   = 1;

    for (let i = 0; i < count; i++) {
      const x   = road.x + Math.random() * road.width;
      const y   = Math.random() * H();
      const len = 20 + ratio * 60;
      _ctx.beginPath();
      _ctx.moveTo(x, y);
      _ctx.lineTo(x, y + len);
      _ctx.stroke();
    }
    _ctx.restore();
  }

  // ----------------------------------------------------------------
  //  DRAW OVERLAY (distance + speed banner)
  // ----------------------------------------------------------------
  function _drawSpeedBanner() {
    const ratio = (game.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED);
    if (ratio < 0.6) return;

    _ctx.save();
    _ctx.globalAlpha  = (ratio - 0.6) / 0.4 * 0.7;
    _ctx.fillStyle    = '#ff3300';
    _ctx.font         = 'bold 11px sans-serif';
    _ctx.textAlign    = 'center';
    _ctx.letterSpacing = '3px';
    _ctx.fillText('⚡ MAX SPEED ⚡', W() / 2, 38);
    _ctx.restore();
  }

  // ----------------------------------------------------------------
  //  UPDATE — main logic
  // ----------------------------------------------------------------
  function _update() {
    if (!game.running) {
      _updateExplosions();
      _updateParticles();
      _updateRoad();
      return;
    }

    game.time++;

    // Ramp speed up over time (capped)
    game.speed = Math.min(
      MAX_SPEED,
      BASE_SPEED + game.time * SPEED_INCREMENT
    );
    road.speed = game.speed;

    // Distance in "meters"
    game.distance += game.speed * 0.04;

    // Score = distance + coin bonuses
    game.score = Math.floor(game.distance) + (game.score - Math.floor(game.distance - game.speed * 0.04));

    _checkMilestone();

    // ---- Spawn timers ----
    if (--timers.enemy <= 0) {
      _spawnEnemy();
      timers.enemy = Math.max(28, 75 - game.time * 0.015) + randInt(0, 20);
    }
    if (--timers.coin <= 0) {
      _spawnCoin();
      timers.coin = 150 + randInt(0, 80);
    }

    // ---- Updates ----
    _updatePlayer();
    _updateRoad();
    _updateEnemies();
    _updateCoins();
    _updateExplosions();
    _updateParticles();

    // ---- Collisions: player vs enemy ----
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (_rectOverlap(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h)) {
        _hitPlayer(e.x, e.y);
        _spawnExplosion(e.x, e.y, e.h);
        enemies.splice(i, 1);
        break;
      }
    }

    // ---- Collisions: player vs coin ----
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      if (_circleRect(c.x, c.y, c.r + 10, player.x, player.y, player.w, player.h)) {
        game.score += 25;
        _spawnParticles(c.x, c.y, '#ffd700', 10, 3);
        _spawnScorePopup(c.x, c.y - 20, '+25 🪙');
        coins.splice(i, 1);
        _updateHUD();
      }
    }

    // Update score continuously
    game.score = Math.floor(game.distance) +
      (game.score - Math.floor(game.distance));

    _updateHUD();

    if (game.shakeTimer > 0) game.shakeTimer--;
  }

  // ----------------------------------------------------------------
  //  DRAW
  // ----------------------------------------------------------------
  function _draw() {
    if (!_ctx || !_canvas) return;

    // Clear
    _ctx.clearRect(0, 0, W(), H());

    // Screen shake
    const shaking = game.shakeTimer > 0;
    if (shaking) {
      const intensity = (game.shakeTimer / 22) * game.shakeIntensity;
      _ctx.save();
      _ctx.translate(
        (Math.random() - 0.5) * intensity * 2,
        (Math.random() - 0.5) * intensity * 2
      );
    }

    // Road + environment
    _drawRoad();

    // Speed lines overlay
    _drawSpeedLines();

    // Game objects
    _drawCoins();
    _drawEnemies();

    // Player (hide after confirmed dead)
    if (game.lives > 0 || player.invincible > 0) _drawPlayer();

    // Effects
    _drawExplosions();
    _drawParticles();

    // Speed banner
    _drawSpeedBanner();

    if (shaking) _ctx.restore();

    // Joystick overlay
    _drawJoystick();
  }

  // ----------------------------------------------------------------
  //  LOOP
  // ----------------------------------------------------------------
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
