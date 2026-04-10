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
  let _animId          = null;
  let _running         = false;
  let _gameOverPending = false;
  let _resizeHandler   = null;
  let _loadingEl       = null;
  let _padEl           = null;   // custom full-width gamepad overlay

  // Held-key state
  const _held = {};

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
  let timers     = { enemy: 0, coin: 0 };

  // ----------------------------------------------------------------
  //  ROAD STATE
  // ----------------------------------------------------------------
  const road = {
    x:         0,
    width:     0,
    laneWidth: 0,
    scrollY:   0,
    speed:     BASE_SPEED
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
    shakeIntensity: 0,
    coinBonus:      0
  };

  // ----------------------------------------------------------------
  //  PLAYER
  // ----------------------------------------------------------------
  const player = {
    x: 0, y: 0,
    w: 0, h: 0,
    invincible: 0,
    tilt: 0
  };

  // ----------------------------------------------------------------
  //  HELPERS
  // ----------------------------------------------------------------
  function imgOk(img) {
    return img && img.complete && img.naturalWidth > 0;
  }
  function W() { return _canvas ? _canvas.width  : window.innerWidth;  }
  function H() { return _canvas ? _canvas.height : window.innerHeight; }

  function carW()   { return road.laneWidth * 0.62; }
  function carH()   { return carW() * 1.7;          }
  function truckW() { return road.laneWidth * 0.72; }
  function truckH() { return truckW() * 1.9;        }

  function laneX(i) {
    return road.x + road.laneWidth * i + road.laneWidth / 2;
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
      _detachControls();
      _removeCustomPad();
      if (_resizeHandler) {
        window.removeEventListener('resize', _resizeHandler);
        _resizeHandler = null;
      }
      game.running     = false;
      _running         = false;
      _gameOverPending = false;
      [_loadingEl, _canvas].forEach(el => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
      _canvas = _ctx = _loadingEl = null;
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
    version:     '1.2',
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
      <div style="font-size:clamp(3rem,10vw,5rem);
        animation:hd-float 2s ease-in-out infinite;
        filter:drop-shadow(0 0 20px #ff9500)">🚗</div>
      <div style="font-family:'Orbitron',sans-serif;
        font-size:clamp(1rem,3vw,1.4rem);font-weight:700;
        color:#ff9500;text-shadow:0 0 20px #ff9500;letter-spacing:3px">
        HIGHWAY DASH</div>
      <div style="width:48px;height:48px;
        border:4px solid rgba(255,149,0,0.15);border-top-color:#ff9500;
        border-radius:50%;animation:hd-spin 0.8s linear infinite"></div>
      <div id="hd-load-text" style="color:rgba(255,255,255,0.45);
        font-size:0.8rem;letter-spacing:2px;text-transform:uppercase;
        font-family:'Rajdhani',sans-serif">Loading assets...</div>
      <div style="width:clamp(160px,40vw,260px);height:3px;
        background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden">
        <div id="hd-load-bar" style="height:100%;width:0%;
          background:linear-gradient(90deg,#ff9500,#ff3200);
          border-radius:2px;transition:width 0.3s ease"></div>
      </div>`;

    if (!document.getElementById('hd-keyframes')) {
      const kf = document.createElement('style');
      kf.id = 'hd-keyframes';
      kf.textContent = `
        @keyframes hd-spin  { to { transform:rotate(360deg); } }
        @keyframes hd-float {
          0%,100% { transform:translateY(0); }
          50%     { transform:translateY(-12px); }
        }
        @keyframes hd-btn-pulse {
          0%,100% { box-shadow: inset 0 0 0 rgba(255,149,0,0); }
          50%     { box-shadow: inset 0 0 30px rgba(255,149,0,0.18); }
        }`;
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

    _canvas = document.createElement('canvas');
    Object.assign(_canvas.style, {
      position: 'absolute', top: '0', left: '0',
      width: '100%', height: '100%',
      zIndex: '1', display: 'block'
    });
    container.appendChild(_canvas);
    _ctx = _canvas.getContext('2d');

    // HUD
    const hud = document.createElement('div');
    hud.id = 'hd-hud';
    Object.assign(hud.style, {
      position:       'absolute', top: '0', left: '0',
      width:          '100%',
      display:        'flex',
      justifyContent: 'space-between',
      alignItems:     'center',
      padding:        '10px 16px',
      pointerEvents:  'none',
      zIndex:         '10',
      boxSizing:      'border-box',
      background:     'linear-gradient(to bottom,rgba(0,0,0,0.65),transparent)'
    });
    hud.innerHTML = `
      <span style="color:#fff;font-size:clamp(11px,2.5vw,15px);
        font-family:'Orbitron',sans-serif;
        text-shadow:0 0 8px rgba(255,149,0,0.8)">
        🏁 <span id="hd-dist">0</span>m
      </span>
      <span style="color:#fff;font-family:'Orbitron',sans-serif;
        font-size:clamp(11px,2.5vw,15px);
        text-shadow:0 0 8px rgba(255,149,0,0.8)">
        ⭐ <span id="hd-score">0</span>
      </span>
      <span id="hd-lives" style="color:#fff;
        font-size:clamp(14px,3vw,18px);letter-spacing:2px">
        ${'❤️'.repeat(START_LIVES)}
      </span>`;
    container.appendChild(hud);

    // Speed meter
    const speedEl = document.createElement('div');
    speedEl.id = 'hd-speed-wrap';
    Object.assign(speedEl.style, {
      position:      'absolute',
      bottom:        '16px',
      left:          '16px',
      zIndex:        '10',
      pointerEvents: 'none',
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'flex-start',
      gap:           '2px'
    });
    speedEl.innerHTML = `
      <span style="font-family:'Orbitron',sans-serif;
        font-size:clamp(8px,1.5vw,10px);
        color:rgba(255,255,255,0.5);letter-spacing:2px">SPEED</span>
      <span id="hd-speed-val" style="font-family:'Orbitron',sans-serif;
        font-size:clamp(18px,4vw,26px);font-weight:900;
        color:#ff9500;text-shadow:0 0 12px #ff9500">0</span>
      <span style="font-family:'Orbitron',sans-serif;
        font-size:clamp(7px,1.2vw,9px);
        color:rgba(255,255,255,0.4)">KM/H</span>`;
    container.appendChild(speedEl);

    _resize();
    _resizeHandler = () => {
      _resize();
      _initRoadLines();
      if (game.running) { player.w = carW(); player.h = carH(); }
    };
    window.addEventListener('resize', _resizeHandler);
  }

  // ----------------------------------------------------------------
  //  CUSTOM FULL-WIDTH GAMEPAD  (mobile only)
  //  Injected into #game-canvas-wrap's parent — same level as
  //  #touch-controls — so it sits BELOW the canvas at full width.
  //  We keep #touch-controls hidden and render our own pad instead.
  // ----------------------------------------------------------------
  function _buildCustomPad() {
    // Only on touch devices
    if (!ControlManager.isTouchDevice()) return;

    // Hide the default touch-controls entirely for this game
    ControlManager.hideTouchControls();

    // Find the game-screen container to append our pad
    const gameScreen = document.getElementById('game-screen');
    if (!gameScreen) return;

    _padEl = document.createElement('div');
    _padEl.id = 'hd-custom-pad';
    Object.assign(_padEl.style, {
      position:        'absolute',
      bottom:          '0',
      left:            '0',
      right:           '0',
      height:          '22%',          // same visual weight as default touch-controls
      minHeight:       '90px',
      maxHeight:       '140px',
      display:         'flex',
      flexDirection:   'row',
      zIndex:          '30',
      background:      'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)',
      padding:         '8px 10px 12px',
      boxSizing:       'border-box',
      gap:             '8px',
      touchAction:     'none',
      userSelect:      'none',
      WebkitUserSelect:'none'
    });

    // LEFT button
    const leftBtn = _makeSteerBtn('◀', 'LEFT', 'ArrowLeft', '#ff9500');
    // RIGHT button
    const rightBtn = _makeSteerBtn('▶', 'RIGHT', 'ArrowRight', '#ff9500');

    _padEl.appendChild(leftBtn);
    _padEl.appendChild(rightBtn);
    gameScreen.appendChild(_padEl);
  }

  function _makeSteerBtn(icon, label, key, accentColor) {
    const btn = document.createElement('button');
    Object.assign(btn.style, {
      flex:            '1',
      height:          '100%',
      background:      'rgba(255,255,255,0.07)',
      border:          `2px solid rgba(255,149,0,0.3)`,
      borderRadius:    '14px',
      color:           '#fff',
      display:         'flex',
      flexDirection:   'column',
      alignItems:      'center',
      justifyContent:  'center',
      gap:             '4px',
      cursor:          'pointer',
      touchAction:     'manipulation',
      outline:         'none',
      transition:      'background 0.08s, border-color 0.08s, transform 0.08s',
      WebkitTapHighlightColor: 'transparent'
    });

    btn.innerHTML = `
      <span style="font-size:clamp(28px,7vw,44px);line-height:1">${icon}</span>
      <span style="font-family:'Orbitron',sans-serif;
        font-size:clamp(9px,2.2vw,13px);font-weight:700;
        letter-spacing:2px;opacity:0.7">${label}</span>`;

    // Active visual state
    const setActive = (on) => {
      btn.style.background   = on
        ? `rgba(255,149,0,0.22)`
        : 'rgba(255,255,255,0.07)';
      btn.style.borderColor  = on
        ? `rgba(255,149,0,0.9)`
        : 'rgba(255,149,0,0.3)';
      btn.style.transform    = on ? 'scale(0.96)' : 'scale(1)';
      btn.style.boxShadow    = on
        ? `inset 0 0 24px rgba(255,149,0,0.18), 0 0 16px rgba(255,149,0,0.15)`
        : 'none';
    };

    // Touch events — fire ControlManager events so _held state updates
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (!game.running) return;
      setActive(true);
      _held[key] = true;
    }, { passive: false });

    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      setActive(false);
      _held[key] = false;
    }, { passive: false });

    btn.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      setActive(false);
      _held[key] = false;
    }, { passive: false });

    // Mouse fallback (desktop testing)
    btn.addEventListener('mousedown', (e) => {
      if (!game.running) return;
      setActive(true);
      _held[key] = true;
    });
    btn.addEventListener('mouseup', () => {
      setActive(false);
      _held[key] = false;
    });
    btn.addEventListener('mouseleave', () => {
      setActive(false);
      _held[key] = false;
    });

    return btn;
  }

  function _removeCustomPad() {
    if (_padEl && _padEl.parentNode) {
      _padEl.parentNode.removeChild(_padEl);
    }
    _padEl = null;
  }

  // ----------------------------------------------------------------
  //  RESIZE
  // ----------------------------------------------------------------
  function _resize() {
    if (!_canvas) return;
    const p = _canvas.parentElement;
    const w = p ? p.clientWidth  : window.innerWidth;
    const h = p ? p.clientHeight : window.innerHeight;
    _canvas.width  = w;
    _canvas.height = h;
    road.width     = Math.max(260, Math.min(460, w * 0.68));
    road.x         = (w - road.width) / 2;
    road.laneWidth = road.width / LANE_COUNT;
  }

  // ----------------------------------------------------------------
  //  ASSET LOADING  — updated asset names
  // ----------------------------------------------------------------
  function _loadAssets() {
    playerCarImg = new Image();
    enemyCar1Img = new Image();
    enemyCar2Img = new Image();
    explosionImg = new Image();
    coinImg      = new Image();

    const assets = [
      { img: playerCarImg, src: 'games/assets/player-car.png'   },
      { img: enemyCar1Img, src: 'games/assets/enemy-car-1.png'    },
      { img: enemyCar2Img, src: 'games/assets/enemy-car-2.png'    },
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
          _attachControls();
          _buildCustomPad();
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
  //  CONTROL MANAGER INTEGRATION
  // ----------------------------------------------------------------
  function _attachControls() {
    ControlManager.on('keydown', 'highway-dash', (key) => {
      _held[key] = true;
    });
    ControlManager.on('keyup', 'highway-dash', (key) => {
      _held[key] = false;
    });
  }

  function _detachControls() {
    ControlManager.off('keydown', 'highway-dash');
    ControlManager.off('keyup',   'highway-dash');
    ControlManager.clearKeys();
    Object.keys(_held).forEach(k => { _held[k] = false; });
  }

  // ----------------------------------------------------------------
  //  ROAD LINES
  // ----------------------------------------------------------------
  function _initRoadLines() {
    roadLines = [];
    const lineH   = Math.max(30, H() * 0.07);
    const lineGap = lineH * 0.7;
    const total   = Math.ceil(H() / (lineH + lineGap)) + 3;
    for (let i = 0; i < total; i++) {
      roadLines.push({ y: i * (lineH + lineGap), h: lineH, gap: lineGap });
    }
  }

  // ----------------------------------------------------------------
  //  ROAD UPDATE & DRAW
  // ----------------------------------------------------------------
  function _updateRoad() {
    const lineH   = roadLines[0] ? roadLines[0].h   : 40;
    const lineGap = roadLines[0] ? roadLines[0].gap  : 28;
    road.scrollY += game.speed;
    if (road.scrollY > lineH + lineGap) road.scrollY = 0;
  }

  function _drawRoad() {
    const ctx = _ctx;
    const rx  = road.x;
    const rw  = road.width;
    const lw  = road.laneWidth;

    // Grass sides
    ctx.fillStyle = '#1e3a1e';
    ctx.fillRect(0, 0, rx, H());
    ctx.fillRect(rx + rw, 0, W() - (rx + rw), H());

    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle   = '#2d5a2d';
    for (let gy = 0; gy < H(); gy += 24) {
      ctx.fillRect(0,       gy, rx,          12);
      ctx.fillRect(rx + rw, gy, W()-(rx+rw), 12);
    }
    ctx.restore();

    // Road base
    const roadGrad = ctx.createLinearGradient(rx, 0, rx + rw, 0);
    roadGrad.addColorStop(0,    '#282828');
    roadGrad.addColorStop(0.08, '#323232');
    roadGrad.addColorStop(0.5,  '#363636');
    roadGrad.addColorStop(0.92, '#323232');
    roadGrad.addColorStop(1,    '#282828');
    ctx.fillStyle = roadGrad;
    ctx.fillRect(rx, 0, rw, H());

    // White edge lines
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = Math.max(2, rw * 0.008);
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(rx, 0);      ctx.lineTo(rx, H());      ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx + rw, 0); ctx.lineTo(rx + rw, H()); ctx.stroke();
    ctx.restore();

    // Yellow shoulder lines
    ctx.save();
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth   = Math.max(2, rw * 0.006);
    ctx.globalAlpha = 0.75;
    const inset = rw * 0.022;
    ctx.beginPath(); ctx.moveTo(rx + inset, 0);      ctx.lineTo(rx + inset, H());      ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx+rw-inset, 0); ctx.lineTo(rx+rw-inset, H()); ctx.stroke();
    ctx.restore();

    // Dashed lane dividers
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth   = Math.max(1.5, rw * 0.005);
    const lineH   = roadLines[0] ? roadLines[0].h   : 40;
    const lineGap = roadLines[0] ? roadLines[0].gap  : 28;
    const cycle   = lineH + lineGap;
    for (let lane = 1; lane < LANE_COUNT; lane++) {
      const lx = rx + lw * lane;
      for (let rl of roadLines) {
        const y = (rl.y + road.scrollY) % (H() + cycle) - lineH;
        ctx.beginPath();
        ctx.moveTo(lx, y); ctx.lineTo(lx, y + rl.h); ctx.stroke();
      }
    }
    ctx.restore();

    // Speed shimmer
    const sr = Math.min(1, (game.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED));
    if (sr > 0.3) {
      ctx.save();
      ctx.globalAlpha = sr * 0.1;
      const sh = ctx.createLinearGradient(rx, 0, rx + rw, 0);
      sh.addColorStop(0,   'transparent');
      sh.addColorStop(0.5, '#ff9500');
      sh.addColorStop(1,   'transparent');
      ctx.fillStyle = sh;
      ctx.fillRect(rx, 0, rw, H());
      ctx.restore();
    }
  }

  // ----------------------------------------------------------------
  //  PLAYER
  // ----------------------------------------------------------------
  function _resetPlayer() {
    player.w = carW();
    player.h = carH();
    player.x = laneX(Math.floor(LANE_COUNT / 2));
    player.y = H() * 0.74;
    player.invincible = 0;
    player.tilt       = 0;
  }

  function _updatePlayer() {
    let inputDx = 0;
    if (_held['ArrowLeft']  || _held['KeyA']) inputDx = -1;
    if (_held['ArrowRight'] || _held['KeyD']) inputDx =  1;

    const moveSpd = road.laneWidth * 0.14;
    player.x += inputDx * moveSpd;

    const minX = road.x + player.w / 2 + road.width * 0.025;
    const maxX = road.x + road.width - player.w / 2 - road.width * 0.025;
    player.x   = Math.max(minX, Math.min(maxX, player.x));

    player.tilt += (inputDx * 0.15 - player.tilt) * 0.14;
    if (player.invincible > 0) player.invincible--;
  }

  function _drawPlayer() {
    const ctx = _ctx;
    const pw  = player.w;
    const ph  = player.h;

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.tilt);

    if (player.invincible > 0 && Math.floor(player.invincible / 4) % 2 === 0) {
      ctx.globalAlpha = 0.3;
    }

    if (imgOk(playerCarImg)) {
      ctx.drawImage(playerCarImg, -pw / 2, -ph / 2, pw, ph);
    } else {
      _drawCarFallback(ctx, 0, 0, pw, ph, '#1a9fff', '#0066cc', true);
    }

    // Exhaust
    const sr = Math.min(1, (game.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED));
    if (sr > 0.25 && Math.random() > 0.45) {
      ctx.globalAlpha *= 0.5 * sr;
      ctx.fillStyle    = '#ff7700';
      const ew = pw * 0.18;
      ctx.beginPath();
      ctx.ellipse(-pw * 0.22, ph * 0.52, ew * 0.4, ew, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse( pw * 0.22, ph * 0.52, ew * 0.4, ew, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ----------------------------------------------------------------
  //  FALLBACK VECTOR CAR
  // ----------------------------------------------------------------
  function _drawCarFallback(ctx, cx, cy, w, h, bodyCol, darkCol, isPlayer) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle   = '#000';
    ctx.beginPath();
    ctx.ellipse(cx + 4, cy + 6, w * 0.44, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = bodyCol;
    ctx.beginPath();
    ctx.roundRect(cx - w/2, cy - h/2, w, h,
      [w*0.22, w*0.22, w*0.14, w*0.14]);
    ctx.fill();

    ctx.fillStyle = darkCol;
    ctx.beginPath();
    ctx.roundRect(cx - w*0.38, cy - h*0.28, w*0.76, h*0.34, 5);
    ctx.fill();

    ctx.fillStyle = isPlayer
      ? 'rgba(160,220,255,0.75)'
      : 'rgba(255,140,140,0.75)';
    ctx.beginPath();
    ctx.roundRect(cx - w*0.30, cy - h*0.26, w*0.60, h*0.18, 4);
    ctx.fill();

    ctx.fillStyle = isPlayer
      ? 'rgba(120,190,230,0.55)'
      : 'rgba(220,110,110,0.55)';
    ctx.beginPath();
    ctx.roundRect(cx - w*0.26, cy + h*0.06, w*0.52, h*0.14, 4);
    ctx.fill();

    const hlCol = isPlayer ? '#ffffff' : '#ff4444';
    ctx.fillStyle   = hlCol;
    ctx.shadowColor = hlCol;
    ctx.shadowBlur  = 8;
    const hlY = cy - h*0.43, hlOX = w*0.27, hlW = w*0.13, hlH = h*0.05;
    ctx.beginPath(); ctx.ellipse(cx-hlOX, hlY, hlW, hlH, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+hlOX, hlY, hlW, hlH, 0, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    const tlCol = isPlayer ? '#ff2222' : '#ffffff';
    ctx.fillStyle   = tlCol;
    ctx.shadowColor = tlCol;
    ctx.shadowBlur  = 6;
    const tlY = cy + h*0.43;
    ctx.beginPath(); ctx.ellipse(cx-hlOX, tlY, hlW, hlH, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+hlOX, tlY, hlW, hlH, 0, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    const wy = h*0.34, wx = w*0.50, wrx = w*0.13, wry = h*0.09;
    ctx.fillStyle = '#111';
    [[-wx,-wy],[wx,-wy],[-wx,wy],[wx,wy]].forEach(([ox,oy]) => {
      ctx.beginPath();
      ctx.ellipse(cx+ox, cy+oy, wrx, wry, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.ellipse(cx+ox, cy+oy, wrx*0.5, wry*0.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#111';
    });
  }

  // ----------------------------------------------------------------
  //  ENEMIES
  // ----------------------------------------------------------------
  const ENEMY_COLORS = [
    ['#e03030','#991818'], ['#30c030','#186018'],
    ['#e0c030','#907018'], ['#c030c0','#601860'],
    ['#30c0c0','#186060'], ['#e07030','#904018']
  ];

  function _spawnEnemy() {
    const lane      = randInt(0, LANE_COUNT - 1);
    const colorPair = ENEMY_COLORS[randInt(0, ENEMY_COLORS.length - 1)];
    const isTruck   = Math.random() > 0.72;
    const ew        = isTruck ? truckW() : carW();
    const eh        = isTruck ? truckH() : carH();
    enemies.push({
      x:     laneX(lane), y: -eh - 20,
      w:     ew, h: eh, lane,
      speed: game.speed * (0.28 + Math.random() * 0.32),
      color: colorPair[0], dark: colorPair[1],
      isTruck, img: isTruck ? enemyCar2Img : enemyCar1Img
    });
  }

  function _updateEnemies() {
    enemies.forEach(e => { e.y += e.speed; });
    enemies = enemies.filter(e => e.y - e.h/2 < H() + 100);
  }

  function _drawEnemies() {
    enemies.forEach(e => {
      _ctx.save();
      _ctx.translate(e.x, e.y);
      _ctx.rotate(Math.PI);
      if (imgOk(e.img)) {
        _ctx.drawImage(e.img, -e.w/2, -e.h/2, e.w, e.h);
      } else {
        _drawCarFallback(_ctx, 0, 0, e.w, e.h, e.color, e.dark, false);
      }
      _ctx.restore();
    });
  }

  // ----------------------------------------------------------------
  //  COINS
  // ----------------------------------------------------------------
  function _spawnCoin() {
    const r = Math.max(10, road.laneWidth * 0.18);
    coins.push({
      x:     laneX(randInt(0, LANE_COUNT - 1)), y: -r - 10, r,
      speed: game.speed * 0.52,
      angle: 0,
      glow:  Math.random() * Math.PI * 2
    });
  }

  function _updateCoins() {
    coins.forEach(c => { c.y += c.speed; c.angle += 0.07; c.glow += 0.1; });
    coins = coins.filter(c => c.y - c.r < H() + 40);
  }

  function _drawCoins() {
    coins.forEach(c => {
      _ctx.save();
      _ctx.translate(c.x, c.y);
      _ctx.shadowColor = '#ffd700';
      _ctx.shadowBlur  = 10 + 5 * Math.sin(c.glow);

      if (imgOk(coinImg)) {
        _ctx.rotate(c.angle);
        const s = c.r * 2.2;
        _ctx.drawImage(coinImg, -s/2, -s/2, s, s);
      } else {
        const g = _ctx.createRadialGradient(-c.r*0.2, -c.r*0.2, 1, 0, 0, c.r);
        g.addColorStop(0, '#ffe566');
        g.addColorStop(0.7, '#ffd700');
        g.addColorStop(1, '#b8860b');
        _ctx.beginPath(); _ctx.arc(0, 0, c.r, 0, Math.PI*2);
        _ctx.fillStyle = g; _ctx.fill();
        _ctx.shadowBlur   = 0;
        _ctx.fillStyle    = 'rgba(120,80,0,0.8)';
        _ctx.font         = `bold ${Math.round(c.r*1.1)}px sans-serif`;
        _ctx.textAlign    = 'center';
        _ctx.textBaseline = 'middle';
        _ctx.fillText('$', 0, 1);
      }
      _ctx.shadowBlur = 0;
      _ctx.restore();
    });
  }

  // ----------------------------------------------------------------
  //  EXPLOSIONS
  // ----------------------------------------------------------------
  function _spawnExplosion(x, y, size) {
    explosions.push({ x, y, size, age: 0, maxAge: 42 });
  }
  function _updateExplosions() {
    explosions.forEach(e => e.age++);
    explosions = explosions.filter(e => e.age < e.maxAge);
  }
  function _drawExplosions() {
    explosions.forEach(e => {
      const p  = e.age / e.maxAge;
      const sc = 0.3 + Math.pow(p, 0.5) * 1.5;
      const a  = p < 0.25 ? 1 : 1 - (p - 0.25) / 0.75;
      const s  = e.size * sc;
      _ctx.save();
      _ctx.globalAlpha = Math.max(0, a);
      if (imgOk(explosionImg)) {
        _ctx.drawImage(explosionImg, e.x - s/2, e.y - s/2, s, s);
      } else {
        const gr = _ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, s/2);
        gr.addColorStop(0,   'rgba(255,220,50,0.95)');
        gr.addColorStop(0.4, 'rgba(255,100,0,0.7)');
        gr.addColorStop(1,   'rgba(100,0,0,0)');
        _ctx.fillStyle = gr;
        _ctx.beginPath(); _ctx.arc(e.x, e.y, s/2, 0, Math.PI*2); _ctx.fill();
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
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        life: 25 + Math.random() * 20, maxLife: 45,
        r: 1.5 + Math.random() * 3, color
      });
    }
    if (particles.length > 200) particles.splice(0, particles.length - 200);
  }

  function _spawnScorePopup(x, y, text) {
    particles.push({
      x, y, vx: 0, vy: -1.5, life: 55, maxLife: 55,
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
        _ctx.font        = `bold ${Math.max(12, road.laneWidth * 0.15)}px sans-serif`;
        _ctx.textAlign   = 'center';
        _ctx.shadowColor = 'rgba(255,200,0,0.8)';
        _ctx.shadowBlur  = 8;
        _ctx.fillText(p.text, p.x, p.y);
      } else {
        _ctx.beginPath();
        _ctx.arc(p.x, p.y, p.r * a, 0, Math.PI*2);
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
    const f = 0.62;
    return (
      Math.abs(ax - bx) < (aw + bw) / 2 * f &&
      Math.abs(ay - by) < (ah + bh) / 2 * f
    );
  }
  function _circleRect(cx, cy, cr, rx, ry, rw, rh) {
    const nx = Math.max(rx - rw/2, Math.min(cx, rx + rw/2));
    const ny = Math.max(ry - rh/2, Math.min(cy, ry + rh/2));
    const dx = cx - nx, dy = cy - ny;
    return dx*dx + dy*dy < (cr + 8) * (cr + 8);
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
      speedEl.textContent      = kmh;
      speedEl.style.color      = game.speed > MAX_SPEED * 0.75 ? '#ff3300' : '#ff9500';
      speedEl.style.textShadow = `0 0 12px ${game.speed > MAX_SPEED * 0.75 ? '#ff3300' : '#ff9500'}`;
    }

    if (livesEl) {
      livesEl.textContent = game.lives <= 0
        ? '💀'
        : '❤️'.repeat(Math.min(game.lives, MAX_LIVES));
    }

    const gs = document.getElementById('game-score-display');
    const gb = document.getElementById('game-best-display');
    if (gs) gs.textContent = game.score;
    if (gb) gb.textContent = game.highScore;
    App.updateScoreDisplay(game.score, ScoreManager.getBestScore('highway-dash'));
  }

  // ----------------------------------------------------------------
  //  DISTANCE MILESTONES
  // ----------------------------------------------------------------
  const _milestones = new Set();
  function _checkMilestone() {
    const d = Math.floor(game.distance);
    [100,250,500,750,1000,1500,2000,3000,5000].forEach(m => {
      if (d >= m && !_milestones.has(m)) {
        _milestones.add(m);
        App.showToast(`🏁 ${m}m reached!`, 'success', 1800);
        _spawnScorePopup(W()/2, H()/2 - 30, `${m}M!`);
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
    game.coinBonus      = 0;
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
    timers     = { enemy: 60, coin: 140 };
    _milestones.clear();

    Object.keys(_held).forEach(k => { _held[k] = false; });

    _initRoadLines();
    _resetPlayer();
    _updateHUD();
    SoundManager.gameStart();
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
    game.shakeIntensity = 11;
    player.invincible   = 120;

    _spawnExplosion(player.x, player.y, player.h * 1.2);
    _spawnParticles(player.x, player.y, '#ff4444', 22, 5);
    if (ex !== undefined) _spawnParticles(ex, ey, '#ff8800', 14, 4);
    SoundManager.wrong();
    _updateHUD();

    if (game.lives <= 0) {
      game.running = false;
      _spawnExplosion(player.x, player.y, player.h * 2);
      _spawnParticles(player.x, player.y, '#ff8800', 38, 7);
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
      App.showToast('🏆 New Best Score!', 'success', 2000);
    }

    ScoreManager.submitScore('highway-dash', game.score);
    _updateHUD();

    setTimeout(() => {
      _stopLoop();
      App.showGameResult(game.score, game.distance >= 500);
    }, 900);
  }

  // ----------------------------------------------------------------
  //  SPEED LINES
  // ----------------------------------------------------------------
  function _drawSpeedLines() {
    const sr = Math.min(1, (game.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED));
    if (sr < 0.25) return;
    const count = Math.floor(sr * 14);
    _ctx.save();
    _ctx.globalAlpha = sr * 0.15;
    _ctx.strokeStyle = '#ffffff';
    _ctx.lineWidth   = 1;
    for (let i = 0; i < count; i++) {
      const x   = road.x + Math.random() * road.width;
      const y   = Math.random() * H();
      const len = 18 + sr * 55;
      _ctx.beginPath();
      _ctx.moveTo(x, y); _ctx.lineTo(x, y + len); _ctx.stroke();
    }
    _ctx.restore();
  }

  // ----------------------------------------------------------------
  //  MAX SPEED BANNER
  // ----------------------------------------------------------------
  function _drawSpeedBanner() {
    const sr = Math.min(1, (game.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED));
    if (sr < 0.62) return;
    _ctx.save();
    _ctx.globalAlpha = (sr - 0.62) / 0.38 * 0.85;
    _ctx.fillStyle   = '#ff3300';
    _ctx.font        = `bold ${Math.max(10, W() * 0.022)}px 'Orbitron', sans-serif`;
    _ctx.textAlign   = 'center';
    _ctx.fillText('⚡ MAX SPEED ⚡', W() / 2, 40);
    _ctx.restore();
  }

  // ----------------------------------------------------------------
  //  DESKTOP KEY HINTS
  // ----------------------------------------------------------------
  function _drawKeyHints() {
    if (ControlManager.isTouchDevice()) return;
    _ctx.save();
    _ctx.globalAlpha = 0.35;
    _ctx.font        = `${Math.max(10, W() * 0.018)}px 'Orbitron', sans-serif`;
    _ctx.fillStyle   = '#ffffff';
    _ctx.textAlign   = 'center';
    _ctx.fillText('← → or A D to steer', W() / 2, H() - 16);
    _ctx.restore();
  }

  // ----------------------------------------------------------------
  //  UPDATE
  // ----------------------------------------------------------------
  function _update() {
    if (!game.running) {
      _updateExplosions();
      _updateParticles();
      _updateRoad();
      return;
    }

    game.time++;
    game.speed = Math.min(MAX_SPEED, BASE_SPEED + game.time * SPEED_INCREMENT);
    road.speed = game.speed;
    game.distance += game.speed * 0.04;
    _checkMilestone();

    if (--timers.enemy <= 0) {
      _spawnEnemy();
      timers.enemy = Math.max(30, 78 - game.time * 0.012) + randInt(0, 18);
    }
    if (--timers.coin <= 0) {
      _spawnCoin();
      timers.coin = 155 + randInt(0, 75);
    }

    _updatePlayer();
    _updateRoad();
    _updateEnemies();
    _updateCoins();
    _updateExplosions();
    _updateParticles();

    // Collision: player vs enemy
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (_rectOverlap(player.x, player.y, player.w, player.h,
                       e.x, e.y, e.w, e.h)) {
        _hitPlayer(e.x, e.y);
        _spawnExplosion(e.x, e.y, e.h * 1.1);
        enemies.splice(i, 1);
        break;
      }
    }

    // Collision: player vs coin
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      if (_circleRect(c.x, c.y, c.r,
                      player.x, player.y, player.w, player.h)) {
        game.coinBonus += 25;
        _spawnParticles(c.x, c.y, '#ffd700', 10, 3);
        _spawnScorePopup(c.x, c.y - 20, '+25 🪙');
        SoundManager.correct();
        coins.splice(i, 1);
      }
    }

    game.score = Math.floor(game.distance) + game.coinBonus;
    _updateHUD();

    if (game.shakeTimer > 0) game.shakeTimer--;
  }

  // ----------------------------------------------------------------
  //  DRAW
  // ----------------------------------------------------------------
  function _draw() {
    if (!_ctx || !_canvas) return;
    _ctx.clearRect(0, 0, W(), H());

    const shaking = game.shakeTimer > 0;
    if (shaking) {
      const intensity = (game.shakeTimer / 22) * game.shakeIntensity;
      _ctx.save();
      _ctx.translate(
        (Math.random() - 0.5) * intensity * 2,
        (Math.random() - 0.5) * intensity * 2
      );
    }

    _drawRoad();
    _drawSpeedLines();
    _drawCoins();
    _drawEnemies();
    if (game.lives > 0 || player.invincible > 0) _drawPlayer();
    _drawExplosions();
    _drawParticles();
    _drawSpeedBanner();
    _drawKeyHints();

    if (shaking) _ctx.restore();
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
    if (_animId) { cancelAnimationFrame(_animId); _animId = null; }
  }

})();
