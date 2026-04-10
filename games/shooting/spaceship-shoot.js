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
    asteroid: new Image(),
    explosion: new Image()
  };

  // Entities
  let asteroids = [];
  let lasers    = [];
  let particles = [];
  let stars     = [];

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
    invincible: 0, visible: true
  };

  // ==============================================================================
  // 3. HELPERS
  // ==============================================================================
  function imgOk(img) {
    return img && img.complete && img.naturalWidth > 0;
  }
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
      _gameOverPending = false;
      _startGame();
    }
  };

  // REGISTER GAME (Rule 1 & 2)
  GameRegistry.register({
    id: 'asteroid-blast',
    title: 'Asteroid Blast',
    category: 'shooting',
    description: 'Aim and blast incoming asteroids! Asteroids split when hit.',
    emoji: '☄️',
    difficulty: 'medium',
    controls: { dpad: true, actions: true, center: true }, // Joystick aim + Space shoot
    version: '1.0',
    init: (c) => AsteroidBlast.start(c),
    destroy: () => AsteroidBlast.destroy(),
    restart: () => AsteroidBlast.restart()
  });

  // ==============================================================================
  // 5. ASSET LOADER & OVERLAYS (Rule 16)
  // ==============================================================================
  function _buildDOM(container) {
    // Game Canvas
    _canvas = document.createElement('canvas');
    _canvas.style.position = 'absolute';
    _canvas.style.top = '0'; _canvas.style.left = '0';
    _canvas.style.width = '100%'; _canvas.style.height = '100%';
    _canvas.style.zIndex = '10';
    _canvas.style.backgroundColor = 'var(--bg3, #0a0a1a)'; // Fallback dark
    _ctx = _canvas.getContext('2d');

    // Joystick Canvas (Rule 20)
    _joyCanvas = document.createElement('canvas');
    _joyCanvas.style.position = 'absolute';
    _joyCanvas.style.top = '0'; _joyCanvas.style.left = '0';
    _joyCanvas.style.width = '100%'; _joyCanvas.style.height = '100%';
    _joyCanvas.style.zIndex = '25';
    _joyCanvas.style.pointerEvents = 'auto'; // Captures touches
    _joyCanvas.style.display = window.matchMedia('(pointer: coarse)').matches ? 'block' : 'none';
    _jctx = _joyCanvas.getContext('2d');

    // Custom Local HUD (syncs with Platform HUD)
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

    // Keep player strictly in center
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
      <div id="ast-load-text" style="font-size: 1.5rem; margin-bottom: 15px;">Loading Systems...</div>
      <div style="width: 200px; height: 10px; background: var(--bg3); border-radius: 5px; overflow: hidden; border: 1px solid var(--border);">
        <div id="ast-load-bar" style="width: 0%; height: 100%; background: var(--primary); transition: width 0.2s;"></div>
      </div>
    `;
    _canvas.parentElement.appendChild(_loadingOverlay);
  }

  function _updateLoadingProgress(loaded, total) {
    const bar = document.getElementById('ast-load-bar');
    const txt = document.getElementById('ast-load-text');
    if (bar) bar.style.width = `${(loaded / total) * 100}%`;
    if (txt) txt.textContent = `Loading Assets... ${loaded}/${total}`;
  }

  function _hideLoadingOverlay() {
    if (_loadingOverlay) {
      _loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        if (_loadingOverlay && _loadingOverlay.parentNode) {
          _loadingOverlay.parentNode.removeChild(_loadingOverlay);
        }
        _loadingOverlay = null;
      }, 400);
    }
  }

  function _loadAssets() {
    const list = [
      { img: assets.ship, src: 'games/assets/spaceship.png' },
      { img: assets.asteroid, src: 'games/assets/asteroid.png' },
      { img: assets.explosion, src: 'games/assets/explosion.png' }
    ];
    let loaded = 0;
    const total = list.length;

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
      img.onload = onDone;
      img.onerror = onDone; // graceful fallback via Rule 9
      img.src = src;
      if (img.complete) onDone();
    });
  }

  // ==============================================================================
  // 6. INPUT HANDLING (Mouse, Keyboard, Joystick)
  // ==============================================================================
  function _attachListeners() {
    // Keyboard Input (Rule 8)
    ControlManager.on('keydown', 'asteroid-blast', key => {
      if ((key === ' ' || key === 'Enter') && game.running) {
        _shoot();
      }
    });

    // Mouse Aiming
    _canvas.addEventListener('mousemove', (e) => {
      if (!joystick.active) {
        const rect = _canvas.getBoundingClientRect();
        _mouseX = e.clientX - rect.left;
        _mouseY = e.clientY - rect.top;
        _updatePlayerAngleFromMouse();
      }
    });

    // Mouse/Desktop Firing
    _canvas.addEventListener('mousedown', () => { _isPointerDown = true; _shoot(); });
    window.addEventListener('mouseup', () => { _isPointerDown = false; });

    // Touch Support & Mobile Joystick (Rules 18 & 20)
    _joyCanvas.addEventListener('touchstart', _handleTouchStart, { passive: false });
    _joyCanvas.addEventListener('touchmove', _handleTouchMove, { passive: false });
    _joyCanvas.addEventListener('touchend', _handleTouchEnd, { passive: false });
    _joyCanvas.addEventListener('touchcancel', _handleTouchEnd, { passive: false });
  }

  function _removeListeners() {
    window.removeEventListener('mouseup', () => {});
    // Event listeners attached to dynamically removed DOM elements are GC'd automatically
  }

  function _handleTouchStart(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      // Left side = Joystick
      if (t.clientX < window.innerWidth / 2 && !joystick.active) {
        joystick.active = true;
        joystick.touchId = t.identifier;
        joystick.baseX = t.clientX;
        joystick.baseY = t.clientY;
        joystick.stickX = t.clientX;
        joystick.stickY = t.clientY;
        joystick.dx = 0; joystick.dy = 0;
      } 
      // Right side = Shoot
      else if (t.clientX >= window.innerWidth / 2) {
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
        
        // Normalize -1 to 1
        joystick.dx = dx / joystick.maxDist;
        joystick.dy = dy / joystick.maxDist;

        // Update player angle
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
        joystick.active = false;
        joystick.touchId = null;
        joystick.dx = 0; joystick.dy = 0;
      } else {
        _isPointerDown = false; // Right side release
      }
    }
  }

  function _updatePlayerAngleFromMouse() {
    if (!game.running || player.invincible > 0 && !player.visible) return;
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
    
    game.score = 0;
    game.lives = START_LIVES;
    game.time = 0;
    game.spawnRate = 120; // Frames between spawns
    game.nextSpawn = 60;
    game.running = true;
    _gameOverPending = false;

    player.x = W() / 2;
    player.y = H() / 2;
    player.r = U() * 0.04;
    player.angle = -Math.PI / 2; // Face up initially
    player.invincible = 120;     // 2 seconds invincibility
    player.visible = true;

    _updateHUD();
    SoundManager.gameStart();
    _startLoop();
  }

  function _initStars() {
    stars = [];
    for (let i=0; i<100; i++) {
      stars.push({
        x: rnd(0, W()), y: rnd(0, H()),
        s: rnd(0.5, 2.5),
        alpha: rnd(0.2, 1)
      });
    }
  }

  function _shoot() {
    if (!game.running || _gameOverPending || player.invincible > 0 && !player.visible) return;
    
    const now = Date.now();
    if (now - _lastShootTime < 200) return; // Fire rate limit (5 shots/sec)
    _lastShootTime = now;

    SoundManager.navigate(); // Using navigate as a UI/pew sound alternative (Rule 7)
    
    // Spawn laser at tip of ship
    const tipX = player.x + Math.cos(player.angle) * player.r * 1.2;
    const tipY = player.y + Math.sin(player.angle) * player.r * 1.2;
    const speed = U() * 0.025;

    lasers.push({
      x: tipX, y: tipY,
      vx: Math.cos(player.angle) * speed,
      vy: Math.sin(player.angle) * speed,
      life: 100 // frames before despawn
    });
  }

  function _spawnAsteroid(size, x, y, angle) {
    let ax, ay, vx, vy;
    const cfg = ASTEROID_SIZES[size];
    const speed = U() * 0.003 * cfg.speedMod;

    if (x === undefined || y === undefined) {
      // Spawn on edges
      const edge = Math.floor(rnd(0, 4));
      if (edge === 0) { ax = rnd(0, W()); ay = -100; }             // Top
      else if (edge === 1) { ax = W() + 100; ay = rnd(0, H()); }  // Right
      else if (edge === 2) { ax = rnd(0, W()); ay = H() + 100; }  // Bottom
      else { ax = -100; ay = rnd(0, H()); }                       // Left

      // Aim generally towards center
      const targetX = player.x + rnd(-200, 200);
      const targetY = player.y + rnd(-200, 200);
      const theta = Math.atan2(targetY - ay, targetX - ax);
      vx = Math.cos(theta) * speed;
      vy = Math.sin(theta) * speed;
    } else {
      // Spawn from split
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

  function _spawnParticles(x, y, color, count, speedMod = 1) {
    for (let i = 0; i < count; i++) {
      const angle = rnd(0, Math.PI * 2);
      const speed = rnd(1, 4) * speedMod;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: rnd(20, 50),
        maxLife: 50,
        color,
        size: rnd(2, 5)
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
    _spawnParticles(player.x, player.y, 'var(--accent, #ff0055)', 30, 2);
    
    game.lives--;
    _updateHUD();

    if (game.lives <= 0) {
      game.running = false;
      player.visible = false;
      setTimeout(_gameOver, 800); // Rule 12 Flow
    } else {
      // Respawn logic
      player.invincible = 150; // 2.5s iframes
      // Destroy nearby asteroids to prevent instant re-death
      asteroids = asteroids.filter(a => {
        if (_circles(player.x, player.y, U()*0.3, a.x, a.y, a.r)) {
          _spawnParticles(a.x, a.y, '#999', 10);
          return false;
        }
        return true;
      });
    }
  }

  function _gameOver() {
    if (_gameOverPending) return;
    _gameOverPending = true;
    game.running = false;

    // Save High Score (Rule 5 & 12)
    const isNewBest = ScoreManager.submitScore('asteroid-blast', game.score);
    if (isNewBest) SoundManager.newBest();

    _updateHUD();
    
    _stopLoop();
    App.showGameResult(game.score, false); // Rule 3
  }

  function _updateHUD() {
    // Platform HUD sync (Rule 4)
    const best = ScoreManager.getBestScore('asteroid-blast');
    App.updateScoreDisplay(game.score, best);

    // Local Canvas HUD
    let livesStr = '';
    for (let i = 0; i < START_LIVES; i++) {
      livesStr += i < game.lives ? '❤️ ' : '🖤 ';
    }
    _hudEl.innerHTML = `<div>${livesStr}</div>`;
  }

  // ==============================================================================
  // 9. UPDATE LOOP
  // ==============================================================================
  function _update() {
    game.time++;

    // Continuous fire if pointer held
    if (_isPointerDown) _shoot();

    // Player invincibility
    if (player.invincible > 0) player.invincible--;

    // Difficulty scaling
    if (game.time % 600 === 0 && game.spawnRate > 40) {
      game.spawnRate -= 10;
    }

    // Spawn new asteroids
    if (game.time > game.nextSpawn) {
      _spawnAsteroid(3); // Spawn a Big asteroid
      game.nextSpawn = game.time + game.spawnRate;
    }

    // Update Lasers
    for (let i = lasers.length - 1; i >= 0; i--) {
      const l = lasers[i];
      l.x += l.vx; l.y += l.vy;
      l.life--;
      if (l.life <= 0 || l.x < 0 || l.x > W() || l.y < 0 || l.y > H()) {
        lasers.splice(i, 1);
      }
    }

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Update Asteroids & Collisions
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const a = asteroids[i];
      a.x += a.vx; a.y += a.vy;
      a.rot += a.rotSpeed;

      // Screen wrapping for asteroids
      if (a.x < -a.r*2) a.x = W() + a.r;
      if (a.x > W() + a.r*2) a.x = -a.r;
      if (a.y < -a.r*2) a.y = H() + a.r;
      if (a.y > H() + a.r*2) a.y = -a.r;

      // Check collision with player
      if (player.visible && _circles(player.x, player.y, player.r*0.7, a.x, a.y, a.r)) {
        _hitPlayer();
        continue;
      }

      // Check collision with lasers
      let hit = false;
      for (let j = lasers.length - 1; j >= 0; j--) {
        const l = lasers[j];
        if (_circles(a.x, a.y, a.r, l.x, l.y, U()*0.01)) {
          hit = true;
          lasers.splice(j, 1); // remove laser
          break;
        }
      }

      if (hit) {
        SoundManager.correct(); // Hit sound
        game.score += ASTEROID_SIZES[a.size].score;
        _updateHUD();
        _spawnParticles(a.x, a.y, '#ccc', a.size * 10);
        
        // Split if big enough
        if (a.size > 1) {
          const baseAngle = Math.atan2(a.vy, a.vx);
          _spawnAsteroid(a.size - 1, a.x, a.y, baseAngle - Math.PI/6);
          _spawnAsteroid(a.size - 1, a.x, a.y, baseAngle + Math.PI/6);
        }
        
        asteroids.splice(i, 1); // Remove original asteroid
      }
    }

    // Joystick logic fade
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
    _ctx.fillStyle = 'white';
    stars.forEach(s => {
      _ctx.globalAlpha = s.alpha;
      _ctx.beginPath();
      _ctx.arc(s.x, s.y, s.s, 0, Math.PI*2);
      _ctx.fill();
    });
    _ctx.globalAlpha = 1.0;

    // Draw Lasers
    _ctx.strokeStyle = 'var(--primary, #0ff)';
    _ctx.lineWidth = U() * 0.005;
    _ctx.lineCap = 'round';
    lasers.forEach(l => {
      _ctx.beginPath();
      _ctx.moveTo(l.x, l.y);
      _ctx.lineTo(l.x - l.vx*2, l.y - l.vy*2); // trail
      _ctx.stroke();
    });

    // Draw Particles
    particles.forEach(p => {
      _ctx.globalAlpha = p.life / p.maxLife;
      _ctx.fillStyle = p.color;
      _ctx.beginPath();
      _ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
      _ctx.fill();
    });
    _ctx.globalAlpha = 1.0;

    // Draw Asteroids (Rule 9 Emoji Fallback)
    asteroids.forEach(a => {
      _ctx.save();
      _ctx.translate(a.x, a.y);
      _ctx.rotate(a.rot);
      if (imgOk(assets.asteroid)) {
        const s = a.r * 2.2; // slight scale adjustment
        _ctx.drawImage(assets.asteroid, -s/2, -s/2, s, s);
      } else {
        _ctx.font = `${a.r*1.8}px serif`;
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'middle';
        _ctx.fillText('☄️', 0, 0);
      }
      _ctx.restore();
    });

    // Draw Player
    if (player.visible) {
      const blink = player.invincible > 0 && Math.floor(game.time / 5) % 2 === 0;
      if (!blink) {
        _ctx.save();
        _ctx.translate(player.x, player.y);
        _ctx.rotate(player.angle);

        // Standardize Image / Emoji rotation.
        if (imgOk(assets.ship)) {
          // IMPORTANT: User specified the nose of the spaceship image points LEFT.
          // Since ctx.rotate(player.angle) aligns the canvas X-axis with the firing angle,
          // drawing an image facing left would shoot out of its rear.
          // By rotating another Math.PI (180deg), we flip the ship so its nose points to X-axis.
          _ctx.rotate(Math.PI); 
          const s = player.r * 2.5;
          _ctx.drawImage(assets.ship, -s/2, -s/2, s, s);
        } else {
          // Emoji 🚀 inherently points to Top-Right (-45 deg).
          // To make it point directly Right (X-axis), we rotate it by +45 deg (PI/4).
          _ctx.rotate(Math.PI / 4);
          _ctx.font = `${player.r * 2}px serif`;
          _ctx.textAlign = 'center';
          _ctx.textBaseline = 'middle';
          _ctx.fillText('🚀', 0, 0);
        }
        
        // Draw Invincibility Shield
        if (player.invincible > 0) {
          _ctx.rotate(-Math.PI/4); // reset local rotation
          _ctx.strokeStyle = 'var(--primary, #0ff)';
          _ctx.lineWidth = 2;
          _ctx.beginPath();
          _ctx.arc(0, 0, player.r * 1.5, 0, Math.PI * 2);
          _ctx.stroke();
        }
        
        _ctx.restore();
      }
    }

    // Draw Mobile Joystick (Rule 20)
    _jctx.clearRect(0, 0, W(), H());
    if (joystick.opacity > 0) {
      _jctx.globalAlpha = joystick.opacity * 0.4;
      
      // Base
      _jctx.beginPath();
      _jctx.arc(joystick.baseX, joystick.baseY, joystick.baseRadius, 0, Math.PI * 2);
      _jctx.fillStyle = '#ffffff';
      _jctx.fill();
      
      // Stick
      _jctx.globalAlpha = joystick.opacity * 0.8;
      _jctx.beginPath();
      _jctx.arc(joystick.stickX, joystick.stickY, joystick.stickRadius, 0, Math.PI * 2);
      _jctx.fillStyle = 'var(--primary, #00ffff)';
      _jctx.fill();
    }
  }

  // ==============================================================================
  // 11. RAF LOOP (Rule 11)
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
