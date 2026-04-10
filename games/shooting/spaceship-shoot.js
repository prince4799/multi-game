(function () {
  'use strict';

  // ==============================================================================
  // 1. CONSTANTS & CONFIGURATION
  // ==============================================================================
  const START_LIVES = 3;
  const MAX_LIVES   = 5;

  const ASTEROID_SIZES = {
    3: { score: 30, radiusMod: 0.08, speedMod: 0.8 }, // Big
    2: { score: 20, radiusMod: 0.05, speedMod: 1.2 }, // Medium
    1: { score: 10, radiusMod: 0.03, speedMod: 1.6 }  // Small
  };

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
  let _loadingOverlay  = null;
  let _hudEl           = null;
  
  // Input State
  let _mouseX = 0, _mouseY = 0;
  let _isPointerDown = false;
  let _lastShootTime = 0;

  // Images
  const assets = {
    ship: new Image(),
    asteroid: new Image()
  };

  // Entities
  let asteroids = [];
  let lasers    = [];
  let particles = [];
  let stars     = [];
  let powerups  = [];

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
    running: false, score: 0, lives: START_LIVES,
    highScore: parseInt(localStorage.getItem('asteroidblast_hi') || '0'),
    time: 0, nextSpawn: 100, spawnRate: 120
  };

  // Player State
  const player = {
    x: 0, y: 0, r: 0, angle: 0,
    invincible: 0, visible: true,
    weaponLevel: 1 // 1: single, 2: dual, 3: spread
  };

  // ==============================================================================
  // 3. HELPERS
  // ==============================================================================
  function imgOk(img) { return img && img.complete && img.naturalWidth > 0; }
  function W() { return _canvas ? _canvas.width : window.innerWidth; }
  function H() { return _canvas ? _canvas.height : window.innerHeight; }
  function U() { return Math.min(W(), H()); } // Base unit for responsive scaling
  function rnd(min, max) { return Math.random() * (max - min) + min; }

  // ==============================================================================
  // 4. CORE ENGINE & DOM BUILDER
  // ==============================================================================
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
      if (_resizeHandler) {
        window.removeEventListener('resize', _resizeHandler);
        _resizeHandler = null;
      }
      [_canvas, _joyCanvas, _loadingOverlay, _hudEl].forEach(el => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
      _canvas = _ctx = _joyCanvas = _jctx = null;
    },
    restart() {
      _startGame();
    }
  };

  GameRegistry.register({
    id: 'asteroid-blast',
    title: 'Asteroid Blast',
    category: 'shooting',
    description: 'Aim and blast incoming asteroids! Collect powerups for upgraded lasers.',
    emoji: '☄️',
    difficulty: 'medium',
    controls: { dpad: true, actions: true, center: true },
    version: '1.1',
    init: (c) => AsteroidBlast.start(c),
    destroy: () => AsteroidBlast.destroy(),
    restart: () => AsteroidBlast.restart()
  });

  // ==============================================================================
  // 5. ASSET LOADER & OVERLAYS
  // ==============================================================================
  function _buildDOM(container) {
    _canvas = document.createElement('canvas');
    _canvas.style.position = 'absolute';
    _canvas.style.top = '0'; _canvas.style.left = '0';
    _canvas.style.width = '100%'; _canvas.style.height = '100%';
    _canvas.style.zIndex = '10';
    _canvas.style.backgroundColor = 'var(--bg3, #0a0a1a)';
    _ctx = _canvas.getContext('2d');

    _joyCanvas = document.createElement('canvas');
    _joyCanvas.style.position = 'absolute';
    _joyCanvas.style.top = '0'; _joyCanvas.style.left = '0';
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
    _hudEl.style.fontSize = '24px';
    _hudEl.style.zIndex = '20';
    _hudEl.style.pointerEvents = 'none';
    _hudEl.style.textShadow = '0 0 8px var(--primary)';

    container.appendChild(_canvas);
    container.appendChild(_joyCanvas);
    container.appendChild(_hudEl);

    _resizeHandler = () => _resize();
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

    player.x = w / 2;
    player.y = h / 2;
    player.r = U() * 0.04;
  }

  function _showLoadingOverlay() {
    _loadingOverlay = document.createElement('div');
    _loadingOverlay.style.position = 'absolute';
    _loadingOverlay.style.inset = '0';
    _loadingOverlay.style.backgroundColor = 'var(--bg2)';
    _loadingOverlay.style.color = 'var(--primary)';
    _loadingOverlay.style.display = 'flex';
    _loadingOverlay.style.flexDirection = 'column';
    _loadingOverlay.style.alignItems = 'center';
    _loadingOverlay.style.justifyContent = 'center';
    _loadingOverlay.style.fontFamily = 'Orbitron, sans-serif';
    _loadingOverlay.style.zIndex = '30';
    _loadingOverlay.style.transition = 'opacity 0.4s';

    _loadingOverlay.innerHTML = `
      <div style="font-size: 3rem; margin-bottom: 20px;">🚀</div>
      <div id="ast-load-text" style="font-size: 1.5rem; margin-bottom: 15px;">Initializing Systems...</div>
      <div style="width: 200px; height: 10px; background: var(--bg3); border-radius: 5px; overflow: hidden; border: 1px solid var(--border);">
        <div id="ast-load-bar" style="width: 0%; height: 100%; background: var(--primary); transition: width 0.2s;"></div>
      </div>
    `;
    _canvas.parentElement.appendChild(_loadingOverlay);
  }

  function _updateLoadingProgress(loaded, total) {
    const bar = document.getElementById('ast-load-bar');
    if (bar) bar.style.width = `${(loaded / total) * 100}%`;
  }

  function _loadAssets() {
    const list = [
      { img: assets.ship, src: 'games/assets/spaceship.png' },
      { img: assets.asteroid, src: 'games/assets/asteroid.png' }
    ];
    let loaded = 0;
    const total = list.length;

    const onDone = () => {
      loaded++;
      _updateLoadingProgress(loaded, total);
      if (loaded >= total) {
        setTimeout(() => {
          if (_loadingOverlay) _loadingOverlay.style.opacity = '0';
          setTimeout(() => {
            if (_loadingOverlay && _loadingOverlay.parentNode) _loadingOverlay.parentNode.removeChild(_loadingOverlay);
            _loadingOverlay = null;
            _attachListeners();
            _startGame();
          }, 400);
        }, 300);
      }
    };

    list.forEach(({ img, src }) => {
      img.onload = onDone;
      img.onerror = onDone;
      img.src = src;
      if (img.complete) onDone();
    });
  }

  // ==============================================================================
  // 6. INPUT HANDLING
  // ==============================================================================
  function _attachListeners() {
    ControlManager.on('keydown', 'asteroid-blast', key => {
      if ((key === ' ' || key === 'Enter') && game.running) _shoot();
    });

    _canvas.addEventListener('mousemove', (e) => {
      if (!joystick.active) {
        const rect = _canvas.getBoundingClientRect();
        _mouseX = e.clientX - rect.left;
        _mouseY = e.clientY - rect.top;
        _updatePlayerAngleFromMouse();
      }
    });

    _canvas.addEventListener('mousedown', () => { _isPointerDown = true; _shoot(); });
    window.addEventListener('mouseup', () => { _isPointerDown = false; });

    _joyCanvas.addEventListener('touchstart', _handleTouchStart, { passive: false });
    _joyCanvas.addEventListener('touchmove', _handleTouchMove, { passive: false });
    _joyCanvas.addEventListener('touchend', _handleTouchEnd, { passive: false });
    _joyCanvas.addEventListener('touchcancel', _handleTouchEnd, { passive: false });
  }

  function _removeListeners() {
    window.removeEventListener('mouseup', () => {});
  }

  function _handleTouchStart(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.clientX < window.innerWidth / 2 && !joystick.active) {
        joystick.active = true;
        joystick.touchId = t.identifier;
        joystick.baseX = joystick.stickX = t.clientX;
        joystick.baseY = joystick.stickY = t.clientY;
        joystick.dx = joystick.dy = 0;
      } else if (t.clientX >= window.innerWidth / 2) {
        _isPointerDown = true;
        _shoot();
      }
    }
  }

  function _handleTouchMove(e) {
    e.preventDefault();
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

        if (Math.abs(joystick.dx) > 0.1 || Math.abs(joystick.dy) > 0.1) {
          player.angle = Math.atan2(joystick.dy, joystick.dx);
        }
      }
    }
  }

  function _handleTouchEnd(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (joystick.active && t.identifier === joystick.touchId) {
        joystick.active = false; joystick.touchId = null;
        joystick.dx = joystick.dy = 0;
      } else {
        _isPointerDown = false;
      }
    }
  }

  function _updatePlayerAngleFromMouse() {
    if (!game.running || !player.visible) return;
    player.angle = Math.atan2(_mouseY - player.y, _mouseX - player.x);
  }

  // ==============================================================================
  // 7. GAME LOGIC & SPANWERS
  // ==============================================================================
  function _startGame() {
    _initStars();
    asteroids = [];
    lasers = [];
    particles = [];
    powerups = [];
    
    game.score = 0;
    game.lives = START_LIVES;
    game.time = 0;
    game.spawnRate = 120;
    game.nextSpawn = 60;
    game.running = true;
    _gameOverPending = false;

    player.x = W() / 2;
    player.y = H() / 2;
    player.r = U() * 0.04;
    player.angle = -Math.PI / 2;
    player.invincible = 120;
    player.visible = true;
    player.weaponLevel = 1;

    _updateHUD();
    SoundManager.gameStart();
    _startLoop();
  }

  function _initStars() {
    stars = [];
    for (let i=0; i<120; i++) {
      stars.push({
        x: rnd(0, W()), y: rnd(0, H()),
        s: rnd(0.5, 2.5), alpha: rnd(0.2, 1)
      });
    }
  }

  function _shoot() {
    if (!game.running || _gameOverPending || !player.visible) return;
    
    const now = Date.now();
    const fireDelay = player.weaponLevel === 3 ? 150 : 200; // faster fire rate at max level
    if (now - _lastShootTime < fireDelay) return;
    _lastShootTime = now;

    SoundManager.navigate(); // UI tick acts as a great laser sound
    
    const tipX = player.x + Math.cos(player.angle) * player.r * 1.2;
    const tipY = player.y + Math.sin(player.angle) * player.r * 1.2;
    const speed = U() * 0.025;

    function _fireBolt(offsetAngle) {
      const a = player.angle + offsetAngle;
      lasers.push({
        x: tipX, y: tipY,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 100
      });
    }

    if (player.weaponLevel === 1) {
      _fireBolt(0);
    } else if (player.weaponLevel === 2) {
      _fireBolt(-0.1);
      _fireBolt(0.1);
    } else {
      _fireBolt(0);
      _fireBolt(-0.15);
      _fireBolt(0.15);
    }
  }

  function _spawnAsteroid(size, x, y, angle) {
    let ax, ay, vx, vy;
    const cfg = ASTEROID_SIZES[size];
    const speed = U() * 0.003 * cfg.speedMod;

    if (x === undefined || y === undefined) {
      const edge = Math.floor(rnd(0, 4));
      if (edge === 0) { ax = rnd(0, W()); ay = -100; }
      else if (edge === 1) { ax = W() + 100; ay = rnd(0, H()); }
      else if (edge === 2) { ax = rnd(0, W()); ay = H() + 100; }
      else { ax = -100; ay = rnd(0, H()); }

      const targetX = player.x + rnd(-200, 200);
      const targetY = player.y + rnd(-200, 200);
      const theta = Math.atan2(targetY - ay, targetX - ax);
      vx = Math.cos(theta) * speed;
      vy = Math.sin(theta) * speed;
    } else {
      ax = x; ay = y;
      vx = Math.cos(angle) * speed;
      vy = Math.sin(angle) * speed;
    }

    asteroids.push({
      x: ax, y: ay, vx, vy, size,
      r: U() * cfg.radiusMod,
      rot: rnd(0, Math.PI * 2),
      rotSpeed: rnd(-0.05, 0.05)
    });
  }

  function _spawnPowerup(x, y) {
    const rand = Math.random();
    let type = null;
    if (rand < 0.05) type = 'life';        // 5% chance for life
    else if (rand < 0.15) type = 'weapon'; // 10% chance for weapon upgrade
    
    if (type) {
      powerups.push({
        x, y, type,
        vx: rnd(-1, 1), vy: rnd(-1, 1),
        r: U() * 0.02, life: 600 // 10 seconds before despawn
      });
    }
  }

  function _spawnParticles(x, y, color, count, speedMod = 1, lifeMod = 1) {
    for (let i = 0; i < count; i++) {
      const angle = rnd(0, Math.PI * 2);
      const speed = rnd(1, 4) * speedMod;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: rnd(20, 50) * lifeMod,
        maxLife: 50 * lifeMod,
        color,
        size: rnd(2, 6)
      });
    }
  }

  // ==============================================================================
  // 8. COLLISIONS & GAME FLOW
  // ==============================================================================
  function _circles(ax, ay, ar, bx, by, br) {
    const dx = ax - bx, dy = ay - by;
    return (dx*dx + dy*dy) < (ar+br)*(ar+br);
  }

  function _hitPlayer() {
    if (player.invincible > 0 || _gameOverPending) return;

    SoundManager.wrong();
    _spawnParticles(player.x, player.y, 'var(--accent, #ff0055)', 40, 2);
    
    game.lives--;
    player.weaponLevel = 1; // Lose weapon power on hit
    _updateHUD();

    if (game.lives <= 0) {
      // EXPLICIT RULE 12 IMPLEMENTATION - FIXES THE "FREEZE"
      _gameOverPending = true;
      player.visible = false;
      game.running = false; // logic flag stops new spawns
      
      // Massive explosion on death
      _spawnParticles(player.x, player.y, '#ffaa00', 80, 4, 1.5);
      _spawnParticles(player.x, player.y, '#ff0055', 50, 2, 2);

      // Save high score immediately
      if (game.score > game.highScore) {
        game.highScore = game.score;
        const isNewBest = ScoreManager.submitScore('asteroid-blast', game.score);
        if (isNewBest) SoundManager.newBest();
      }

      // Let the particle explosion play out for 1000ms BEFORE stopping the loop
      setTimeout(() => {
        _stopLoop();
        App.showGameResult(game.score, false); 
      }, 1000);

    } else {
      player.invincible = 150;
      asteroids = asteroids.filter(a => {
        if (_circles(player.x, player.y, U()*0.3, a.x, a.y, a.r)) {
          _spawnParticles(a.x, a.y, '#999', 15);
          return false;
        }
        return true;
      });
    }
  }

  function _updateHUD() {
    App.updateScoreDisplay(game.score, ScoreManager.getBestScore('asteroid-blast'));
    
    let livesStr = '';
    for (let i = 0; i < START_LIVES; i++) {
      livesStr += i < game.lives ? '❤️ ' : '🖤 ';
    }
    // Add extra lives as blue hearts if above START_LIVES
    for (let i = START_LIVES; i < game.lives; i++) {
      livesStr += '💙 '; 
    }
    
    let wepStr = player.weaponLevel === 1 ? 'LVL 1' : (player.weaponLevel === 2 ? 'LVL 2' : 'MAX LVL');
    _hudEl.innerHTML = `<div>${livesStr}</div><div style="font-size:14px; margin-top:5px; color:var(--text2)">WEAPON: ${wepStr}</div>`;
  }

  // ==============================================================================
  // 9. UPDATE LOOP
  // ==============================================================================
  function _update() {
    game.time++;

    if (game.running) {
      if (_isPointerDown) _shoot();
      if (player.invincible > 0) player.invincible--;

      if (game.time % 600 === 0 && game.spawnRate > 40) {
        game.spawnRate -= 10;
      }

      if (game.time > game.nextSpawn) {
        _spawnAsteroid(3);
        game.nextSpawn = game.time + game.spawnRate;
      }
    }

    // Lasers
    for (let i = lasers.length - 1; i >= 0; i--) {
      const l = lasers[i];
      l.x += l.vx; l.y += l.vy;
      l.life--;
      if (l.life <= 0 || l.x < 0 || l.x > W() || l.y < 0 || l.y > H()) {
        lasers.splice(i, 1);
      }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.x += p.vx; p.y += p.vy;
      p.life--;

      // Screen wrapping
      if (p.x < -p.r) p.x = W() + p.r;
      if (p.x > W() + p.r) p.x = -p.r;
      if (p.y < -p.r) p.y = H() + p.r;
      if (p.y > H() + p.r) p.y = -p.r;

      // Collection
      if (player.visible && _circles(player.x, player.y, player.r, p.x, p.y, p.r)) {
        SoundManager.correct(); // positive sound
        if (p.type === 'life') {
          game.lives = Math.min(game.lives + 1, MAX_LIVES);
          App.showToast('+1 Life!', 'success', 1500);
        } else if (p.type === 'weapon') {
          player.weaponLevel = Math.min(player.weaponLevel + 1, 3);
          App.showToast('Weapon Upgrade!', 'info', 1500);
        }
        _updateHUD();
        powerups.splice(i, 1);
        continue;
      }

      if (p.life <= 0) powerups.splice(i, 1);
    }

    // Asteroids
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const a = asteroids[i];
      a.x += a.vx; a.y += a.vy;
      a.rot += a.rotSpeed;

      if (a.x < -a.r*2) a.x = W() + a.r;
      if (a.x > W() + a.r*2) a.x = -a.r;
      if (a.y < -a.r*2) a.y = H() + a.r;
      if (a.y > H() + a.r*2) a.y = -a.r;

      if (player.visible && _circles(player.x, player.y, player.r*0.7, a.x, a.y, a.r)) {
        _hitPlayer();
        continue;
      }

      let hit = false;
      for (let j = lasers.length - 1; j >= 0; j--) {
        const l = lasers[j];
        if (_circles(a.x, a.y, a.r, l.x, l.y, U()*0.01)) {
          hit = true;
          lasers.splice(j, 1);
          break;
        }
      }

      if (hit) {
        SoundManager.click(); // Using click as hit marker
        game.score += ASTEROID_SIZES[a.size].score;
        _updateHUD();
        _spawnParticles(a.x, a.y, '#ccc', a.size * 10);
        _spawnPowerup(a.x, a.y); // Chance to drop bonus
        
        if (a.size > 1) {
          const baseAngle = Math.atan2(a.vy, a.vx);
          _spawnAsteroid(a.size - 1, a.x, a.y, baseAngle - Math.PI/6);
          _spawnAsteroid(a.size - 1, a.x, a.y, baseAngle + Math.PI/6);
        }
        
        asteroids.splice(i, 1);
      }
    }

    if (joystick.active) {
      joystick.opacity = Math.min(1, joystick.opacity + 0.15);
    } else {
      joystick.opacity = Math.max(0, joystick.opacity - 0.08);
    }
  }

  // ==============================================================================
  // 10. RENDER LOOP
  // ==============================================================================
  function _draw() {
    _ctx.clearRect(0, 0, W(), H());

    // Draw Stars
    _ctx.fillStyle = '#ffffff';
    stars.forEach(s => {
      _ctx.globalAlpha = s.alpha;
      _ctx.beginPath();
      _ctx.arc(s.x, s.y, s.s, 0, Math.PI*2);
      _ctx.fill();
    });
    _ctx.globalAlpha = 1.0;

    // Draw Lasers (Bright Neon Canvas SVG equivalent)
    _ctx.save();
    _ctx.shadowBlur = 12;
    _ctx.shadowColor = 'var(--primary, #00ffff)';
    _ctx.strokeStyle = '#ffffff';
    _ctx.lineWidth = U() * 0.008;
    _ctx.lineCap = 'round';
    lasers.forEach(l => {
      _ctx.beginPath();
      _ctx.moveTo(l.x, l.y);
      _ctx.lineTo(l.x - l.vx * 2.5, l.y - l.vy * 2.5); // Laser trail
      _ctx.stroke();
    });
    _ctx.restore();

    // Draw Particles
    particles.forEach(p => {
      _ctx.globalAlpha = p.life / p.maxLife;
      _ctx.fillStyle = p.color;
      _ctx.beginPath();
      _ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
      _ctx.fill();
    });
    _ctx.globalAlpha = 1.0;

    // Draw Powerups with Glow
    powerups.forEach(p => {
      _ctx.save();
      _ctx.translate(p.x, p.y);
      // Pulsing effect
      const scale = 1 + Math.sin(game.time * 0.1) * 0.2;
      _ctx.scale(scale, scale);
      
      _ctx.shadowBlur = 15;
      _ctx.shadowColor = p.type === 'life' ? '#ff0055' : '#ffff00';
      _ctx.font = `${p.r * 2}px sans-serif`;
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(p.type === 'life' ? '❤️' : '⚡', 0, 0);
      _ctx.restore();
    });

    // Draw Asteroids
    asteroids.forEach(a => {
      _ctx.save();
      _ctx.translate(a.x, a.y);
      _ctx.rotate(a.rot);
      if (imgOk(assets.asteroid)) {
        const s = a.r * 2.2;
        _ctx.drawImage(assets.asteroid, -s/2, -s/2, s, s);
      } else {
        _ctx.font = `${a.r*1.8}px serif`;
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'middle';
        _ctx.fillText('☄️', 0, 0);
      }
      _ctx.restore();
    });

    // Draw Player (Ship with Neon Glow)
    if (player.visible) {
      const blink = player.invincible > 0 && Math.floor(game.time / 5) % 2 === 0;
      if (!blink) {
        _ctx.save();
        _ctx.translate(player.x, player.y);
        _ctx.rotate(player.angle);

        // Thruster flame when moving joystick/mouse aim
        if (game.running) {
          _ctx.shadowBlur = 10 + Math.random() * 10;
          _ctx.shadowColor = '#00ffff';
          _ctx.fillStyle = '#ffffff';
          _ctx.beginPath();
          _ctx.moveTo(-player.r * 1.2, -player.r * 0.3);
          _ctx.lineTo(-player.r * (1.8 + Math.random()), 0);
          _ctx.lineTo(-player.r * 1.2, player.r * 0.3);
          _ctx.fill();
        }

        // Apply Neon Aura to Ship
        _ctx.shadowBlur = 15;
        _ctx.shadowColor = 'var(--primary, #00ffff)';

        if (imgOk(assets.ship)) {
          _ctx.rotate(Math.PI); // Correct left-facing nose
          const s = player.r * 2.5;
          _ctx.drawImage(assets.ship, -s/2, -s/2, s, s);
        } else {
          _ctx.rotate(Math.PI / 4); // Correct emoji rotation
          _ctx.font = `${player.r * 2}px serif`;
          _ctx.textAlign = 'center';
          _ctx.textBaseline = 'middle';
          _ctx.fillText('🚀', 0, 0);
        }
        
        if (player.invincible > 0) {
          _ctx.rotate(imgOk(assets.ship) ? -Math.PI : -Math.PI/4); // Reset local rotation
          _ctx.strokeStyle = '#00ffff';
          _ctx.shadowBlur = 5;
          _ctx.lineWidth = 2;
          _ctx.beginPath();
          _ctx.arc(0, 0, player.r * 1.5, 0, Math.PI * 2);
          _ctx.stroke();
        }
        
        _ctx.restore();
      }
    }

    // Draw Mobile Joystick
    _jctx.clearRect(0, 0, W(), H());
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

  // ==============================================================================
  // 11. RAF LOOP
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
