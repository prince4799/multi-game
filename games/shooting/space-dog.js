/* ================================================
   SUPER SPACE DOG
   Shooting game for GameZone
   ================================================ */

(function () {

  'use strict';

  // ----------------------------------------------------------------
  //  PRIVATE STATE
  // ----------------------------------------------------------------
  let _canvas    = null;
  let _ctx       = null;
  let _joyCanvas = null;
  let _jctx      = null;
  let _fireBtn   = null;
  let _animId    = null;
  let _running   = false;
  let _resizeHandler = null;

  let keys     = {};
  let fireHeld = false;

  let dogImg       = null;
  let cometImg     = null;
  let explosionImg = null;

  let stars      = [];
  let lasers     = [];
  let comets     = [];
  let crystals   = [];
  let bonusStars = [];
  let particles  = [];
  let explosions = [];
  let timers     = { comet: 0, crystal: 0, star: 0 };

  const joystick = {
    active: false, touchId: null,
    baseX: 0, baseY: 0,
    stickX: 0, stickY: 0,
    dx: 0, dy: 0,
    baseRadius: 60, stickRadius: 28,
    maxDist: 55, opacity: 0
  };

  const game = {
    running: false, score: 0, lives: 3,
    highScore: parseInt(localStorage.getItem('ssd_hi') || '0'),
    difficulty: 1, time: 0,
    shakeTimer: 0, shakeIntensity: 0
  };

  const DOG_W = 120;
  const DOG_H = 65;
  const player = {
    x: 0, y: 0, w: DOG_W, h: DOG_H,
    speed: 5, shootCooldown: 0, invincible: 0,
    animFrame: 0, tilt: 0, moveX: 0, moveY: 0
  };

  // ----------------------------------------------------------------
  //  HELPERS
  // ----------------------------------------------------------------
  function imgOk(img) {
    return img && img.complete && img.naturalWidth > 0;
  }
  function W() { return _canvas ? _canvas.width  : window.innerWidth;  }
  function H() { return _canvas ? _canvas.height : window.innerHeight; }

  // ----------------------------------------------------------------
  //  PUBLIC GAME OBJECT  (used by GameRegistry)
  // ----------------------------------------------------------------
  const SpaceDog = {
    start(container) {
      _buildDOM(container);
      _loadAssets();
      _startGame();
    },
    destroy() {
      _stopLoop();
      _removeListeners();
      game.running = false;
      _running = false;
      [_fireBtn, _joyCanvas, _canvas].forEach(el => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
      _canvas = _ctx = _joyCanvas = _jctx = _fireBtn = null;
    },
    restart() {
      _startGame();
    }
  };

  // ----------------------------------------------------------------
  //  REGISTER — same pattern as math-speed.js / memory-match.js
  // ----------------------------------------------------------------
  GameRegistry.register({
    id:          'space-dog',
    title:       'Super Space Dog',
    category:    'shooting',
    description: 'Defend the galaxy one bark at a time! Shoot comets, dodge crystals, collect stars.',
    emoji:       '🐕',
    difficulty:  'medium',
    controls:    { dpad: false, actions: false, center: false },
    version:     '1.0',
    init:        (container) => SpaceDog.start(container),
    destroy:     () => SpaceDog.destroy(),
    restart:     () => SpaceDog.restart()
  });

  // ----------------------------------------------------------------
  //  DOM BUILDER
  // ----------------------------------------------------------------
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

    // Fire button
    _fireBtn = document.createElement('button');
    _fireBtn.innerHTML = '🔫<br><span style="font-size:11px;font-weight:700;letter-spacing:1px">FIRE</span>';
    Object.assign(_fireBtn.style, {
      position:      'absolute', bottom: '40px', right: '30px',
      width:         '90px', height: '90px',
      borderRadius:  '50%',
      border:        '3px solid rgba(255,40,40,.5)',
      background:    'rgba(255,20,20,.15)',
      color:         '#fff', fontSize: '22px',
      cursor:        'pointer', zIndex: '30',
      display:       'none',
      alignItems:    'center', justifyContent: 'center',
      flexDirection: 'column',
      transition:    'all .1s',
      WebkitTapHighlightColor: 'transparent',
      userSelect:    'none'
    });
    container.appendChild(_fireBtn);

    if (window.matchMedia('(pointer: coarse)').matches) {
      _fireBtn.style.display = 'flex';
    }

    // HUD
    const hud = document.createElement('div');
    Object.assign(hud.style, {
      position:       'absolute', top: '0', left: '0',
      width:          '100%',
      display:        'flex',
      justifyContent: 'space-between',
      alignItems:     'center',
      padding:        '10px 18px',
      pointerEvents:  'none',
      zIndex:         '10'
    });
    hud.innerHTML = `
      <span style="color:#fff;font-size:17px;text-shadow:0 0 8px rgba(0,200,255,.6)">
        ⭐ Score: <b id="ssd-score" style="color:#0ff">0</b>
      </span>
      <span id="ssd-lives" style="color:#fff;font-size:20px;letter-spacing:2px">❤️❤️❤️</span>
    `;
    container.appendChild(hud);

    // Resize
    _resize();
    _resizeHandler = () => { _resize(); _initStars(); };
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
  }

  // ----------------------------------------------------------------
  //  ASSETS
  // ----------------------------------------------------------------
  function _loadAssets() {
    dogImg       = new Image();
    cometImg     = new Image();
    explosionImg = new Image();
    dogImg.src       = 'games/shooting/assets/dog.gif';
    cometImg.src     = 'games/shooting/assets/comet.png';
    explosionImg.src = 'games/shooting/assets/explosion.png';
    dogImg.onerror       = () => {};
    cometImg.onerror     = () => {};
    explosionImg.onerror = () => {};
  }

  // ----------------------------------------------------------------
  //  INPUT LISTENERS
  // ----------------------------------------------------------------
  const _onKeyDown = (e) => {
    keys[e.code] = true;
    if (['Space','ArrowUp','ArrowDown',
         'ArrowLeft','ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  };
  const _onKeyUp   = (e) => { keys[e.code] = false; };

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

    _fireBtn.addEventListener('touchstart', (e) => {
      e.preventDefault(); fireHeld = true;
      _fireBtn.style.background = 'rgba(255,20,20,.5)';
      _fireBtn.style.transform  = 'scale(0.93)';
    }, { passive: false });
    _fireBtn.addEventListener('touchend', (e) => {
      e.preventDefault(); fireHeld = false;
      _fireBtn.style.background = 'rgba(255,20,20,.15)';
      _fireBtn.style.transform  = 'scale(1)';
    }, { passive: false });
    _fireBtn.addEventListener('touchcancel', (e) => {
      e.preventDefault(); fireHeld = false;
      _fireBtn.style.background = 'rgba(255,20,20,.15)';
      _fireBtn.style.transform  = 'scale(1)';
    }, { passive: false });
    _fireBtn.addEventListener('mousedown',  () => { fireHeld = true;  });
    _fireBtn.addEventListener('mouseup',    () => { fireHeld = false; });
    _fireBtn.addEventListener('mouseleave', () => { fireHeld = false; });

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
    if (!_canvas || x > _canvas.width * 0.55) return false;
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
  //  STARS
  // ----------------------------------------------------------------
  function _initStars() {
    stars = [];
    for (let i = 0; i < 200; i++) {
      const layer = Math.random();
      stars.push({
        x: Math.random() * W(), y: Math.random() * H(),
        r: 0.4 + layer * 2, speed: 0.3 + layer * 2.5,
        brightness: 0.3 + layer * 0.7,
        twinkle: Math.random() * Math.PI * 2
      });
    }
  }
  function _updateStars() {
    stars.forEach(s => {
      s.x -= s.speed; s.twinkle += 0.02;
      if (s.x < -3) { s.x = W() + 3; s.y = Math.random() * H(); }
    });
  }
  function _drawStars() {
    stars.forEach(s => {
      const a = s.brightness * (0.6 + 0.4 * Math.sin(s.twinkle));
      _ctx.beginPath();
      _ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      _ctx.fillStyle = `rgba(255,255,255,${a})`;
      _ctx.fill();
    });
  }

  // ----------------------------------------------------------------
  //  PLAYER
  // ----------------------------------------------------------------
  function _resetPlayer() {
    player.x = Math.min(120, W() * 0.15);
    player.y = H() / 2;
    player.shootCooldown = 0; player.invincible = 0;
    player.animFrame = 0;     player.tilt = 0;
    player.moveX = 0;         player.moveY = 0;
  }
  function _drawPlayer() {
    const bob = Math.sin(player.animFrame * 0.07) * 3;
    player.tilt += (player.moveY * -0.2 - player.tilt) * 0.12;
    _ctx.save();
    _ctx.translate(player.x, player.y + bob);
    _ctx.rotate(player.tilt);
    if (player.invincible > 0 && Math.floor(player.invincible / 4) % 2 === 0) {
      _ctx.globalAlpha = 0.35;
    }
    if (imgOk(dogImg)) {
      _ctx.drawImage(dogImg, -DOG_W / 2, -DOG_H / 2, DOG_W, DOG_H);
    } else {
      _ctx.font = '40px serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText('🐕', 0, 0);
    }
    _ctx.globalAlpha = 1;
    _ctx.restore();
  }

  // ----------------------------------------------------------------
  //  LASERS
  // ----------------------------------------------------------------
  function _spawnLaser() {
    if (player.shootCooldown > 0) return;
    const bob = Math.sin(player.animFrame * 0.07) * 3;
    lasers.push({
      x: player.x + DOG_W / 2, y: player.y + bob - 2,
      len: 55, speed: 12, age: 0
    });
    player.shootCooldown = 14;
    _spawnParticles(player.x + DOG_W / 2 + 5, player.y + bob - 2, '#ff3333', 4, 2);
  }
  function _updateLasers() {
    lasers.forEach(l => { l.x += l.speed; l.age++; });
    lasers = lasers.filter(l => l.x - l.len < W() + 20);
  }
  function _drawLasers() {
    lasers.forEach(l => {
      const x1 = l.x, x2 = l.x + l.len, y = l.y;
      _ctx.save();
      _ctx.globalAlpha = 0.5;
      _ctx.strokeStyle = '#ff0000'; _ctx.lineWidth = 9;
      _ctx.shadowColor = '#ff0000'; _ctx.shadowBlur  = 18;
      _ctx.beginPath(); _ctx.moveTo(x1, y); _ctx.lineTo(x2, y); _ctx.stroke();
      _ctx.globalAlpha = 1;
      _ctx.strokeStyle = '#ff1a1a'; _ctx.lineWidth = 2.5; _ctx.shadowBlur = 8;
      _ctx.beginPath(); _ctx.moveTo(x1, y); _ctx.lineTo(x2, y); _ctx.stroke();
      _ctx.strokeStyle = '#ff8888'; _ctx.lineWidth = 1;
      _ctx.beginPath(); _ctx.moveTo(x1 + 5, y); _ctx.lineTo(x2 - 2, y); _ctx.stroke();
      _ctx.beginPath(); _ctx.arc(x2, y, 7, 0, Math.PI * 2);
      _ctx.fillStyle = '#ff0000'; _ctx.shadowBlur = 20; _ctx.fill();
      _ctx.restore();
    });
  }

  // ----------------------------------------------------------------
  //  COMETS
  // ----------------------------------------------------------------
  function _spawnComet() {
    const r = 20 + Math.random() * 28;
    comets.push({
      x: W() + r + 20, y: 40 + Math.random() * (H() - 80),
      r, speed: 2 + Math.random() * 2.5 * game.difficulty,
      rotation: 0, rotSpeed: (Math.random() - 0.5) * 0.04,
      hp: r > 35 ? 2 : 1
    });
  }
  function _updateComets() {
    comets.forEach(c => { c.x -= c.speed; c.rotation += c.rotSpeed; });
    comets = comets.filter(c => c.x + c.r > -30);
  }
  function _drawComets() {
    comets.forEach(c => {
      _ctx.save();
      _ctx.translate(c.x, c.y); _ctx.rotate(c.rotation);
      if (imgOk(cometImg)) {
        const ds = c.r * 2.2;
        _ctx.drawImage(cometImg, -ds / 2, -ds / 2, ds, ds);
      } else {
        _ctx.font = `${c.r * 2}px serif`;
        _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
        _ctx.fillText('☄️', 0, 0);
      }
      _ctx.restore();
      if (c.hp > 1) {
        _ctx.save();
        _ctx.fillStyle = 'rgba(0,0,0,0.5)';
        _ctx.beginPath(); _ctx.arc(c.x, c.y, 10, 0, Math.PI * 2); _ctx.fill();
        _ctx.fillStyle = '#fff'; _ctx.font = 'bold 13px sans-serif';
        _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
        _ctx.fillText(c.hp, c.x, c.y);
        _ctx.restore();
      }
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
        g.addColorStop(0, 'rgba(255,200,50,0.9)');
        g.addColorStop(0.4, 'rgba(255,100,0,0.6)');
        g.addColorStop(1, 'rgba(100,0,0,0)');
        _ctx.fillStyle = g;
        _ctx.beginPath(); _ctx.arc(e.x, e.y, s / 2, 0, Math.PI * 2); _ctx.fill();
      }
      _ctx.globalAlpha = 1;
      _ctx.restore();
    });
  }

  // ----------------------------------------------------------------
  //  CRYSTALS
  // ----------------------------------------------------------------
  function _spawnCrystal() {
    crystals.push({
      x: W() + 30, y: 30 + Math.random() * (H() - 60),
      size: 16 + Math.random() * 14,
      speed: 2.5 + Math.random() * 2 * game.difficulty,
      angle: 0, pulse: Math.random() * Math.PI * 2
    });
  }
  function _updateCrystals() {
    crystals.forEach(c => { c.x -= c.speed; c.angle += 0.04; c.pulse += 0.08; });
    crystals = crystals.filter(c => c.x > -50);
  }
  function _drawCrystals() {
    crystals.forEach(c => {
      _ctx.save();
      _ctx.translate(c.x, c.y); _ctx.rotate(c.angle);
      const s = c.size, p = 1 + 0.1 * Math.sin(c.pulse);
      _ctx.beginPath();
      _ctx.moveTo(0, -s * p); _ctx.lineTo(s * 0.6 * p, 0);
      _ctx.lineTo(0, s * p);  _ctx.lineTo(-s * 0.6 * p, 0);
      _ctx.closePath();
      const gr = _ctx.createLinearGradient(0, -s, 0, s);
      gr.addColorStop(0, '#00ffff'); gr.addColorStop(0.5, '#0088ff'); gr.addColorStop(1, '#cc00ff');
      _ctx.fillStyle = gr; _ctx.fill();
      _ctx.strokeStyle = 'rgba(255,255,255,0.8)'; _ctx.lineWidth = 1.5; _ctx.stroke();
      _ctx.shadowColor = '#00ffff'; _ctx.shadowBlur = 12;
      _ctx.strokeStyle = 'rgba(0,255,255,0.3)'; _ctx.lineWidth = 1; _ctx.stroke();
      _ctx.shadowBlur = 0;
      _ctx.restore();
    });
  }

  // ----------------------------------------------------------------
  //  BONUS STARS
  // ----------------------------------------------------------------
  function _spawnBonusStar() {
    bonusStars.push({
      x: W() + 20, y: 30 + Math.random() * (H() - 60),
      size: 15, speed: 1.5 + Math.random() * 1.2,
      angle: 0, glow: Math.random() * Math.PI * 2
    });
  }
  function _updateBonusStars() {
    bonusStars.forEach(s => { s.x -= s.speed; s.angle += 0.05; s.glow += 0.1; });
    bonusStars = bonusStars.filter(s => s.x > -20);
  }
  function _drawStar5(cx, cy, r, rot) {
    _ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a  = rot + (Math.PI * 2 / 5) * i - Math.PI / 2;
      const ai = a + Math.PI / 5;
      _ctx.lineTo(cx + Math.cos(a)  * r,        cy + Math.sin(a)  * r);
      _ctx.lineTo(cx + Math.cos(ai) * r * 0.45, cy + Math.sin(ai) * r * 0.45);
    }
    _ctx.closePath();
  }
  function _drawBonusStars() {
    bonusStars.forEach(s => {
      _ctx.save();
      _ctx.shadowColor = 'gold'; _ctx.shadowBlur = 12 + 6 * Math.sin(s.glow);
      _drawStar5(s.x, s.y, s.size, s.angle);
      _ctx.fillStyle = '#ffd700'; _ctx.fill();
      _ctx.shadowBlur = 0;
      _ctx.strokeStyle = 'rgba(255,255,255,0.6)'; _ctx.lineWidth = 1; _ctx.stroke();
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
        x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        life: 25 + Math.random() * 20, maxLife: 45,
        r: 1.5 + Math.random() * 3, color
      });
    }
    if (particles.length > 150) particles.splice(0, particles.length - 150);
  }
  function _spawnScorePopup(x, y, text) {
    particles.push({
      x, y, vx: 0.5, vy: -1.2,
      life: 50, maxLife: 50, r: 0, color: '#fff', text
    });
  }
  function _updateParticles() {
    particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; });
    particles = particles.filter(p => p.life > 0);
  }
  function _drawParticles() {
    particles.forEach(p => {
      const a = Math.max(0, p.life / p.maxLife);
      _ctx.save(); _ctx.globalAlpha = a;
      if (p.text) {
        _ctx.fillStyle = 'gold'; _ctx.font = 'bold 18px sans-serif';
        _ctx.textAlign = 'center';
        _ctx.shadowColor = 'rgba(255,200,0,.8)'; _ctx.shadowBlur = 8;
        _ctx.fillText(p.text, p.x, p.y);
      } else {
        _ctx.beginPath(); _ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
        _ctx.fillStyle = p.color; _ctx.fill();
      }
      _ctx.restore();
    });
  }

  // ----------------------------------------------------------------
  //  COLLISION
  // ----------------------------------------------------------------
  function _circles(ax, ay, ar, bx, by, br) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy < (ar + br) * (ar + br);
  }
  function _laserHit(l, cx, cy, cr) {
    const closestX = Math.max(l.x, Math.min(cx, l.x + l.len));
    const dx = cx - closestX, dy = cy - l.y;
    return dx * dx + dy * dy < cr * cr;
  }

  // ----------------------------------------------------------------
  //  HUD
  // ----------------------------------------------------------------
  function _updateHUD() {
    const scoreEl = document.getElementById('ssd-score');
    const livesEl = document.getElementById('ssd-lives');
    if (scoreEl) scoreEl.textContent = game.score;
    if (livesEl) livesEl.textContent = game.lives > 0 ? '❤️'.repeat(game.lives) : '💀';
    const gs = document.getElementById('game-score-display');
    const gb = document.getElementById('game-best-display');
    if (gs) gs.textContent = game.score;
    if (gb) gb.textContent = game.highScore;
  }

  // ----------------------------------------------------------------
  //  GAME FLOW
  // ----------------------------------------------------------------
  function _startGame() {
    _stopLoop();
    game.running    = true;
    game.score      = 0;
    game.lives      = 3;
    game.difficulty = 1;
    game.time       = 0;
    game.shakeTimer = 0;
    lasers = []; comets = []; crystals = [];
    bonusStars = []; particles = []; explosions = [];
    timers = { comet: 50, crystal: 180, star: 280 };
    keys = {}; fireHeld = false;
    _initStars();
    _resetPlayer();
    _updateHUD();
    _startLoop();
  }

  function _gameOver() {
    game.running = false;
    if (game.score > game.highScore) {
      game.highScore = game.score;
      localStorage.setItem('ssd_hi', game.highScore);
    }
    _updateHUD();
    if (window.GameRegistry && window.GameRegistry.onGameOver) {
      window.GameRegistry.onGameOver({
        score:     game.score,
        highScore: game.highScore,
        emoji:     '🐕',
        heading:   'Game Over!'
      });
    }
  }

  function _hitPlayer() {
    if (player.invincible > 0) return;
    game.lives--;
    game.shakeTimer = 18; game.shakeIntensity = 8;
    player.invincible = 100;
    _spawnParticles(player.x, player.y, '#ff4444', 20, 5);
    _spawnExplosion(player.x, player.y, 80);
    _updateHUD();
    if (game.lives <= 0) {
      game.running = false;
      _spawnExplosion(player.x, player.y, 150);
      _spawnParticles(player.x, player.y, '#ff8800', 30, 6);
      setTimeout(_gameOver, 800);
    }
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
    _jctx.fillStyle = '#ffffff'; _jctx.fill();
    _jctx.globalAlpha = alpha * 0.4;
    _jctx.strokeStyle = '#00ccff'; _jctx.lineWidth = 2.5; _jctx.stroke();
    const sx = joystick.active ? joystick.stickX : joystick.baseX;
    const sy = joystick.active ? joystick.stickY : joystick.baseY;
    _jctx.globalAlpha = alpha * 0.7;
    const sg = _jctx.createRadialGradient(sx - 5, sy - 5, 2, sx, sy, joystick.stickRadius);
    sg.addColorStop(0, '#66ddff'); sg.addColorStop(1, '#0077aa');
    _jctx.beginPath();
    _jctx.arc(sx, sy, joystick.stickRadius, 0, Math.PI * 2);
    _jctx.fillStyle = sg; _jctx.fill();
    _jctx.globalAlpha = alpha * 0.9;
    _jctx.strokeStyle = '#00eeff'; _jctx.lineWidth = 2; _jctx.stroke();
    _jctx.restore();
  }

  // ----------------------------------------------------------------
  //  UPDATE
  // ----------------------------------------------------------------
  function _update() {
    if (!game.running) return;
    game.time++;
    game.difficulty = 1 + game.time / 2200;

    let dx = 0, dy = 0;
    if (keys['ArrowUp']    || keys['KeyW']) dy -= 1;
    if (keys['ArrowDown']  || keys['KeyS']) dy += 1;
    if (keys['ArrowLeft']  || keys['KeyA']) dx -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) dx += 1;
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

    if (joystick.active) {
      const dist = Math.sqrt(joystick.dx ** 2 + joystick.dy ** 2);
      if (dist > 0.15) { dx = joystick.dx; dy = joystick.dy; }
    }

    player.moveX = dx; player.moveY = dy;
    player.x += dx * player.speed;
    player.y += dy * player.speed;

    const margin = 15;
    player.x = Math.max(player.w / 2 + margin,
                Math.min(W() - player.w / 2 - margin, player.x));
    player.y = Math.max(player.h / 2 + margin,
                Math.min(H() - player.h / 2 - margin, player.y));

    if (keys['Space'] || fireHeld) _spawnLaser();
    if (player.shootCooldown > 0) player.shootCooldown--;
    if (player.invincible   > 0) player.invincible--;
    player.animFrame++;

    if (--timers.comet <= 0) {
      _spawnComet();
      timers.comet = Math.max(15, 55 - game.difficulty * 5) + Math.random() * 22;
    }
    if (--timers.crystal <= 0) {
      _spawnCrystal();
      timers.crystal = Math.max(45, 150 - game.difficulty * 10) + Math.random() * 45;
    }
    if (--timers.star <= 0) {
      _spawnBonusStar();
      timers.star = 180 + Math.random() * 140;
    }

    _updateStars(); _updateLasers(); _updateComets();
    _updateCrystals(); _updateBonusStars();
    _updateExplosions(); _updateParticles();

    // Laser vs comet
    for (let li = lasers.length - 1; li >= 0; li--) {
      const l = lasers[li];
      for (let ci = comets.length - 1; ci >= 0; ci--) {
        const c = comets[ci];
        if (_laserHit(l, c.x, c.y, c.r * 0.85)) {
          lasers.splice(li, 1); c.hp--;
          if (c.hp <= 0) {
            const pts = Math.round(c.r) * 2;
            game.score += pts;
            _spawnExplosion(c.x, c.y, c.r * 3);
            _spawnParticles(c.x, c.y, '#ff8800', 12, 4);
            _spawnScorePopup(c.x, c.y - c.r - 10, `+${pts}`);
            comets.splice(ci, 1);
            _updateHUD();
          } else {
            _spawnParticles(l.x + l.len, l.y, '#ffcc00', 6, 2);
          }
          break;
        }
      }
    }

    const pHitR = Math.min(player.w, player.h) * 0.32;
    for (let i = comets.length - 1; i >= 0; i--) {
      const c = comets[i];
      if (_circles(player.x, player.y, pHitR, c.x, c.y, c.r * 0.75)) {
        _hitPlayer(); _spawnExplosion(c.x, c.y, c.r * 3);
        _spawnParticles(c.x, c.y, '#ff6600', 15, 5);
        comets.splice(i, 1); break;
      }
    }
    for (let i = crystals.length - 1; i >= 0; i--) {
      const c = crystals[i];
      if (_circles(player.x, player.y, pHitR, c.x, c.y, c.size * 0.55)) {
        _hitPlayer(); _spawnParticles(c.x, c.y, '#00ffff', 12, 4);
        crystals.splice(i, 1); break;
      }
    }
    for (let i = bonusStars.length - 1; i >= 0; i--) {
      const s = bonusStars[i];
      if (_circles(player.x, player.y, pHitR + 12, s.x, s.y, s.size)) {
        game.score += 50;
        _spawnParticles(s.x, s.y, '#ffd700', 10, 3);
        _spawnScorePopup(s.x, s.y - 20, '+50 ⭐');
        bonusStars.splice(i, 1);
        _updateHUD();
      }
    }
    if (game.shakeTimer > 0) game.shakeTimer--;
  }

  // ----------------------------------------------------------------
  //  DRAW
  // ----------------------------------------------------------------
  function _draw() {
    if (!_ctx || !_canvas) return;
    _ctx.clearRect(0, 0, W(), H());
    const bg = _ctx.createLinearGradient(0, 0, W(), H());
    bg.addColorStop(0, '#050520');
    bg.addColorStop(0.5, '#0a0a35');
    bg.addColorStop(1, '#120828');
    _ctx.fillStyle = bg; _ctx.fillRect(0, 0, W(), H());

    const shaking = game.shakeTimer > 0;
    if (shaking) {
      const intensity = (game.shakeTimer / 18) * game.shakeIntensity;
      _ctx.save();
      _ctx.translate(
        (Math.random() - 0.5) * intensity * 2,
        (Math.random() - 0.5) * intensity * 2
      );
    }
    _drawStars(); _drawBonusStars(); _drawLasers();
    _drawComets(); _drawCrystals();
    if (game.lives > 0 || player.invincible > 0) _drawPlayer();
    _drawExplosions(); _drawParticles();

    crystals.forEach(c => {
      const dist = Math.hypot(c.x - player.x, c.y - player.y);
      if (dist < 250) {
        const danger = 1 - dist / 250;
        _ctx.save(); _ctx.globalAlpha = danger * 0.7;
        _ctx.fillStyle = '#ff0000'; _ctx.font = 'bold 11px sans-serif';
        _ctx.textAlign = 'center';
        _ctx.fillText('⚠️ DODGE!', c.x, c.y - c.size - 12);
        _ctx.restore();
      }
    });
    if (shaking) _ctx.restore();
    _drawJoystick();
  }

  // ----------------------------------------------------------------
  //  LOOP
  // ----------------------------------------------------------------
  function _startLoop() {
    _running = true;
    const loop = () => {
      if (!_running) return;
      _update(); _draw();
      _animId = requestAnimationFrame(loop);
    };
    _animId = requestAnimationFrame(loop);
  }
  function _stopLoop() {
    _running = false;
    if (_animId) { cancelAnimationFrame(_animId); _animId = null; }
  }

})();
