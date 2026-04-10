(function () {
  'use strict';

  // ==============================================================================
  // 1. CONSTANTS & PRIVATE STATE
  // ==============================================================================
  const POWERUP_DURATION = 360; 

  let _canvas          = null;
  let _ctx             = null;
  let _animId          = null;
  let _running         = false;
  let _gameOverPending = false;
  let _resizeHandler   = null;
  let _loadingOverlay  = null;
  
  // Custom Local HUD elements
  let _hudContainer    = null;
  let _comboEl         = null;
  let _powerUpUi       = null;
  let _powerUpName     = null;
  let _powerUpBar      = null;

  // Input
  let _mouseX = 0, _mouseY = 0;

  // Game Objects
  let core, satellite;
  let enemies       = [];
  let particles     = [];
  let projectiles   = [];
  let shockwaves    = [];
  let floatingTexts = [];

  // Game State
  const game = {
    running: false, score: 0, highScore: 0,
    time: 0, multiplier: 1, comboTimer: 0,
    spawnRate: 110, shakeAmount: 0,
    activePowerUp: null, powerUpTimer: 0
  };

  // ==============================================================================
  // 2. HELPERS
  // ==============================================================================
  function W() { return _canvas ? _canvas.width : window.innerWidth; }
  function H() { return _canvas ? _canvas.height : window.innerHeight; }
  function CX() { return W() / 2; }
  function CY() { return H() / 2; }
  function rnd(min, max) { return Math.random() * (max - min) + min; }
  function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

  function applyShake() {
    if (game.shakeAmount > 0) {
      _ctx.translate(rnd(-game.shakeAmount, game.shakeAmount), rnd(-game.shakeAmount, game.shakeAmount));
      game.shakeAmount *= 0.9;
      if (game.shakeAmount < 0.5) game.shakeAmount = 0;
    }
  }

  // ==============================================================================
  // 3. ENTITY CLASSES (Adapted for GameZone)
  // ==============================================================================
  class FloatingText {
    constructor(x, y, text, color, size=20) {
      this.x = x; this.y = y; this.text = text;
      this.color = color; this.size = size;
      this.alpha = 1; this.vy = -1.5;
    }
    update() { this.y += this.vy; this.alpha -= 0.02; }
    draw() {
      _ctx.save(); _ctx.globalAlpha = Math.max(0, this.alpha);
      _ctx.fillStyle = this.color; _ctx.font = `bold ${this.size}px Orbitron`;
      _ctx.shadowBlur = 10; _ctx.shadowColor = this.color;
      _ctx.fillText(this.text, this.x - _ctx.measureText(this.text).width/2, this.y);
      _ctx.restore();
    }
  }

  class Core {
    constructor() {
      this.x = CX(); this.y = CY(); this.radius = 20;
      this.pulse = 0; this.hp = 3; this.iFrames = 0;
    }
    takeDamage() {
      if(this.iFrames > 0 || _gameOverPending) return;
      this.hp--; this.iFrames = 60; game.shakeAmount = 15;
      createExplosion(this.x, this.y, 'var(--primary, #0ff)', 30);
      
      if(this.hp <= 0) {
        _triggerGameOver();
      } else {
        SoundManager.wrong();
      }
    }
    draw() {
      if(this.iFrames > 0) { this.iFrames--; if(this.iFrames % 10 < 5) return; }
      this.pulse += 0.05;
      const r = this.radius + Math.sin(this.pulse) * 3;
      
      _ctx.beginPath(); _ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      _ctx.fillStyle = 'var(--primary, #0ff)'; _ctx.shadowBlur = 30; _ctx.shadowColor = 'var(--primary, #0ff)'; _ctx.fill();
      _ctx.beginPath(); _ctx.arc(this.x, this.y, r * 0.5, 0, Math.PI * 2);
      _ctx.fillStyle = '#fff'; _ctx.fill(); _ctx.shadowBlur = 0;

      for(let i=0; i<this.hp; i++) {
        _ctx.beginPath(); _ctx.arc(this.x, this.y, this.radius + 15 + (i*10), 0, Math.PI*2);
        _ctx.strokeStyle = `rgba(0, 255, 255, ${0.8 - (i*0.2)})`;
        _ctx.lineWidth = 2; _ctx.stroke();
      }
    }
  }

  class Satellite {
    constructor() {
      this.x = CX(); this.y = CY(); this.vx = 0; this.vy = 0;
      this.radius = 12; this.speed = 0.2;
      this.maxDistance = Math.min(W(), H()) * 0.4; 
    }
    update() {
      this.maxDistance = Math.min(W(), H()) * 0.4; 
      const prevX = this.x, prevY = this.y;
      const angle = Math.atan2(_mouseY - core.y, _mouseX - core.x);
      let d = dist(core.x, core.y, _mouseX, _mouseY);
      if (d > this.maxDistance) d = this.maxDistance;
      
      this.x += ((core.x + Math.cos(angle) * d) - this.x) * this.speed;
      this.y += ((core.y + Math.sin(angle) * d) - this.y) * this.speed;
      this.vx = this.x - prevX; this.vy = this.y - prevY;
    }
    draw() {
      _ctx.beginPath(); _ctx.moveTo(core.x, core.y); _ctx.lineTo(this.x, this.y);
      const glowColor = game.activePowerUp ? _powerUpName.style.color : 'rgba(0, 255, 255, 0.4)';
      _ctx.strokeStyle = glowColor;
      _ctx.lineWidth = game.activePowerUp ? 4 : 2; _ctx.stroke();
      
      _ctx.beginPath(); _ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      _ctx.fillStyle = game.activePowerUp ? _powerUpName.style.color : 'var(--primary, #0ff)';
      _ctx.shadowBlur = game.activePowerUp ? 30 : 20; _ctx.shadowColor = _ctx.fillStyle;
      _ctx.fill(); _ctx.shadowBlur = 0;
    }
  }

  class Enemy {
    constructor(customX, customY, customRadius, isSplit=false) {
      this.isPowerUp = !isSplit && Math.random() < 0.08;
      this.isSplitter = !isSplit && !this.isPowerUp && game.score > 300 && Math.random() < 0.15;
      this.isDead = false; this.flash = 0; 
      
      this.radius = customRadius || (this.isSplitter ? rnd(35, 45) : rnd(15, 25));
      
      if (this.isSplitter) {
        this.hp = 3; this.color = 'var(--accent, #ff0033)';
        this.speed = rnd(0.3, 0.7) + (game.score * 0.0002);
      } else if (this.isPowerUp) {
        this.hp = 1; this.powerUpType = Math.random() < 0.5 ? 'SHOCKWAVE' : 'BLASTER';
        this.color = this.powerUpType === 'SHOCKWAVE' ? '#00ff00' : '#cc00ff';
        this.speed = rnd(1.5, 2.5) + (game.score * 0.0005);
      } else {
        this.hp = this.radius > 20 ? 2 : 1;
        this.color = this.hp > 1 ? '#ff8800' : 'var(--accent, #ff0055)';
        let baseSpeed = this.hp > 1 ? rnd(0.8, 1.4) : rnd(1.5, 2.8);
        this.speed = isSplit ? rnd(2.5, 4.0) : baseSpeed + (game.score * 0.0005);
      }
      
      this.vertices = [];
      const vCount = Math.floor(rnd(6, 11));
      for (let i = 0; i < vCount; i++) {
        const angle = (i / vCount) * Math.PI * 2;
        const r = this.radius * rnd(0.6, 1.2); 
        this.vertices.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
      }

      this.rotation = 0; this.rotationSpeed = rnd(-0.05, 0.05);
      
      if (customX) { this.x = customX; this.y = customY; } 
      else {
        if (Math.random() < 0.5) { this.x = Math.random() < 0.5 ? -50 : W() + 50; this.y = rnd(0, H()); } 
        else { this.x = rnd(0, W()); this.y = Math.random() < 0.5 ? -50 : H() + 50; }
      }
    }
    takeDamage(amount) {
      this.hp -= amount; this.flash = 5; 
      if (this.hp <= 0) this.isDead = true;
      else if (!this.isSplitter && !this.isPowerUp) this.color = this.hp > 1 ? '#ff8800' : 'var(--accent, #ff0055)';
    }
    update() {
      const angle = Math.atan2(core.y - this.y, core.x - this.x);
      this.x += Math.cos(angle) * this.speed; this.y += Math.sin(angle) * this.speed;
      this.rotation += this.rotationSpeed;
      if(this.flash > 0) this.flash--;
    }
    draw() {
      _ctx.save(); _ctx.translate(this.x, this.y); _ctx.rotate(this.rotation); 
      _ctx.beginPath(); _ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
      for (let i = 1; i < this.vertices.length; i++) _ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
      _ctx.closePath();

      const currentFill = this.flash > 0 ? '#fff' : this.color;
      const currentStroke = this.flash > 0 ? '#fff' : this.color;
      const currentAlpha = this.flash > 0 ? 0.8 : (this.isSplitter ? 0.3 : 0.15);

      _ctx.fillStyle = currentFill; _ctx.globalAlpha = currentAlpha; _ctx.fill();
      _ctx.globalAlpha = 1; _ctx.lineWidth = this.isSplitter ? 3 : 2;
      _ctx.strokeStyle = currentStroke; _ctx.shadowBlur = 15; _ctx.shadowColor = currentStroke; _ctx.stroke();

      if (this.isPowerUp || this.isSplitter) {
        _ctx.beginPath(); _ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
        _ctx.fillStyle = this.isSplitter ? (this.flash > 0 ? '#fff' : 'var(--accent, #ff0033)') : '#fff';
        _ctx.shadowBlur = 20; _ctx.shadowColor = currentStroke; _ctx.fill();
      }
      _ctx.restore();
    }
  }

  class Projectile {
    constructor(x, y, vx, vy, color) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.color = color; this.radius = 4; this.life = 100;
    }
    update() { this.x += this.vx; this.y += this.vy; this.life--; }
    draw() {
      _ctx.beginPath(); _ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      _ctx.fillStyle = this.color; _ctx.shadowBlur = 15; _ctx.shadowColor = this.color; _ctx.fill();
    }
  }

  class Shockwave {
    constructor(x, y, color) { 
      this.x = x; this.y = y; this.color = color; 
      this.radius = 10; this.alpha = 1; this.hitList = new Set(); 
    }
    update() { this.radius += 12; this.alpha -= 0.03; }
    draw() {
      _ctx.save(); _ctx.globalAlpha = Math.max(0, this.alpha);
      _ctx.beginPath(); _ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      _ctx.strokeStyle = this.color; _ctx.lineWidth = 4;
      _ctx.shadowBlur = 20; _ctx.shadowColor = this.color; _ctx.stroke(); _ctx.restore();
    }
  }

  class Particle {
    constructor(x, y, color) {
      this.x = x; this.y = y; this.color = color; this.radius = rnd(2, 5);
      const angle = rnd(0, Math.PI * 2), vel = rnd(2, 8);
      this.vx = Math.cos(angle) * vel; this.vy = Math.sin(angle) * vel;
      this.alpha = 1; this.decay = rnd(0.01, 0.03);
    }
    update() { this.x += this.vx; this.y += this.vy; this.vx *= 0.95; this.vy *= 0.95; this.alpha -= this.decay; }
    draw() {
      _ctx.save(); _ctx.globalAlpha = this.alpha;
      _ctx.beginPath(); _ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      _ctx.fillStyle = this.color; _ctx.shadowBlur = 10; _ctx.shadowColor = this.color; _ctx.fill(); _ctx.restore();
    }
  }

  function createExplosion(x, y, color, amount) {
    for (let i = 0; i < amount; i++) particles.push(new Particle(x, y, color));
    game.shakeAmount = amount > 15 ? 10 : 5;
  }

  function activatePowerUp(e) {
    SoundManager.win(); // Replaces custom powerup synth
    game.activePowerUp = e.powerUpType; 
    game.powerUpTimer = POWERUP_DURATION;
    
    _powerUpUi.style.display = 'block'; 
    _powerUpName.innerText = `${game.activePowerUp} ACTIVE`;
    _powerUpName.style.color = e.color; 
    _powerUpName.style.textShadow = `0 0 10px ${e.color}`;
    _powerUpBar.parentElement.style.borderColor = e.color; 
    _powerUpBar.style.background = e.color;
    
    createExplosion(e.x, e.y, e.color, 40);
    floatingTexts.push(new FloatingText(e.x, e.y - 20, game.activePowerUp, e.color, 24));
    
    App.showToast(`${game.activePowerUp} ACTIVATED!`, 'info', 1500); // Rule 6
  }

  // ==============================================================================
  // 4. CORE ENGINE & DOM BUILDER
  // ==============================================================================
  const NeonTether = {
    start(container) {
      game.highScore = parseInt(localStorage.getItem('neontether_hi') || '0');
      _buildDOM(container);
      _showLoadingOverlay();
      
      // Simulate asset loading since it's 100% canvas (Rule 16)
      setTimeout(() => {
        _hideLoadingOverlay();
        _attachListeners();
        _startGame();
      }, 400);
    },
    destroy() {
      _stopLoop();
      _removeListeners();
      ControlManager.off('keydown', 'neon-tether');
      ControlManager.clearKeys();
      if (_resizeHandler) {
        window.removeEventListener('resize', _resizeHandler);
        _resizeHandler = null;
      }
      [_canvas, _loadingOverlay, _hudContainer].forEach(el => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
      _canvas = _ctx = null;
    },
    restart() {
      _startGame();
    }
  };

  // REGISTER GAME (Rule 1 & 2)
  GameRegistry.register({
    id: 'neon-tether',
    title: 'Neon Tether',
    category: 'shooting', // Best fit for projectiles and defending
    description: 'Defend your Core. Swing your orb to smash asteroids. Collect powerups!',
    emoji: '🌌',
    difficulty: 'hard',
    controls: { dpad: true, actions: false, center: false }, // Tracks mouse/touch natively
    version: '1.0',
    init: (c) => NeonTether.start(c),
    destroy: () => NeonTether.destroy(),
    restart: () => NeonTether.restart()
  });

  // ==============================================================================
  // 5. DOM & OVERLAYS
  // ==============================================================================
  function _buildDOM(container) {
    _canvas = document.createElement('canvas');
    _canvas.style.position = 'absolute';
    _canvas.style.top = '0'; _canvas.style.left = '0';
    _canvas.style.width = '100%'; _canvas.style.height = '100%';
    _canvas.style.zIndex = '10';
    _canvas.style.backgroundColor = 'var(--bg3, #050505)';
    _canvas.style.touchAction = 'none'; // Prevent pull-to-refresh
    _ctx = _canvas.getContext('2d');

    // Local HUD (Multiplier & PowerUps)
    _hudContainer = document.createElement('div');
    _hudContainer.style.position = 'absolute';
    _hudContainer.style.top = '20px'; _hudContainer.style.left = '20px';
    _hudContainer.style.zIndex = '20';
    _hudContainer.style.pointerEvents = 'none';
    _hudContainer.style.fontFamily = 'Orbitron, sans-serif';

    _comboEl = document.createElement('div');
    _comboEl.style.fontSize = '24px';
    _comboEl.style.color = '#fff';
    _comboEl.style.textShadow = '0 0 10px rgba(255,255,255,0.5)';
    _comboEl.innerHTML = `COMBO: <span id="nt-multiplier" style="color: #ff0ff0; text-shadow: 0 0 10px #ff0ff0;">x1</span>`;

    _powerUpUi = document.createElement('div');
    _powerUpUi.style.marginTop = '15px';
    _powerUpUi.style.display = 'none';
    _powerUpUi.style.fontSize = '18px';
    _powerUpUi.style.fontWeight = 'bold';
    
    _powerUpUi.innerHTML = `
      <span id="nt-pu-name">POWERUP</span>
      <div style="width: 150px; height: 8px; background: rgba(255, 255, 255, 0.2); margin-top: 5px; border-radius: 4px; overflow: hidden; border: 1px solid #fff;">
        <div id="nt-pu-bar" style="width: 100%; height: 100%; background: #fff; transition: width 0.1s linear;"></div>
      </div>
    `;

    _hudContainer.appendChild(_comboEl);
    _hudContainer.appendChild(_powerUpUi);
    
    container.appendChild(_canvas);
    container.appendChild(_hudContainer);

    _powerUpName = document.getElementById('nt-pu-name');
    _powerUpBar  = document.getElementById('nt-pu-bar');

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
    
    if (core) {
      core.x = w / 2;
      core.y = h / 2;
    }
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
      <div style="font-size: 3rem; margin-bottom: 20px;">🌌</div>
      <div style="font-size: 1.5rem; margin-bottom: 15px;">Charging Core...</div>
      <div style="width: 200px; height: 10px; background: var(--bg3); border-radius: 5px; border: 1px solid var(--border);">
        <div style="width: 100%; height: 100%; background: var(--primary); animation: pulse 1s infinite;"></div>
      </div>
    `;
    _canvas.parentElement.appendChild(_loadingOverlay);
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

  // ==============================================================================
  // 6. INPUT HANDLING
  // ==============================================================================
  function _attachListeners() {
    const updateMouse = (e, isTouch = false) => {
      const rect = _canvas.getBoundingClientRect();
      const clientX = isTouch ? e.touches[0].clientX : e.clientX;
      const clientY = isTouch ? e.touches[0].clientY : e.clientY;
      _mouseX = clientX - rect.left;
      _mouseY = clientY - rect.top;
    };

    _canvas.addEventListener('mousemove', (e) => updateMouse(e, false));
    _canvas.addEventListener('touchstart', (e) => { e.preventDefault(); updateMouse(e, true); }, { passive: false });
    _canvas.addEventListener('touchmove', (e) => { e.preventDefault(); updateMouse(e, true); }, { passive: false });
  }

  function _removeListeners() {
    // Canvas listeners die with the canvas
  }

  // ==============================================================================
  // 7. GAME FLOW
  // ==============================================================================
  function _startGame() {
    game.score = 0; game.multiplier = 1; game.time = 0;
    game.spawnRate = 110; game.shakeAmount = 0;
    game.activePowerUp = null; game.comboTimer = 0;
    
    enemies = []; particles = []; projectiles = []; 
    shockwaves = []; floatingTexts = [];
    
    core = new Core(); 
    satellite = new Satellite();
    
    _mouseX = CX(); _mouseY = CY() + 50;
    
    _powerUpUi.style.display = 'none';
    _updateScoreHUD();

    _gameOverPending = false;
    game.running = true;
    
    SoundManager.gameStart();
    _startLoop();
  }

  function _triggerGameOver() {
    if (_gameOverPending) return;
    _gameOverPending = true;
    game.running = false; // Stops spawning and updating
    
    createExplosion(core.x, core.y, 'var(--primary, #0ff)', 80);
    SoundManager.gameOver();

    // Save Score (Rule 5 & 12)
    const isNewBest = ScoreManager.submitScore('neon-tether', game.score);
    if (isNewBest) SoundManager.newBest();
    _updateScoreHUD();

    // Wait for explosion to finish before showing result screen
    setTimeout(() => {
      _stopLoop();
      App.showGameResult(game.score, false); // Rule 3
    }, 1500);
  }

  function _updateScoreHUD() {
    // Update platform HUD (Rule 4)
    App.updateScoreDisplay(game.score, ScoreManager.getBestScore('neon-tether'));
    
    // Update local HUD
    const multSpan = document.getElementById('nt-multiplier');
    if (multSpan) {
      multSpan.innerText = `x${game.multiplier}`;
      multSpan.style.color = game.multiplier > 1 ? '#ff0ff0' : '#fff';
      multSpan.style.textShadow = game.multiplier > 1 ? '0 0 10px #ff0ff0' : 'none';
    }
  }

  // ==============================================================================
  // 8. UPDATE LOOP
  // ==============================================================================
  function _update() {
    if (game.activePowerUp) {
      game.powerUpTimer--; 
      _powerUpBar.style.width = `${(game.powerUpTimer / POWERUP_DURATION) * 100}%`;
      
      if (game.powerUpTimer <= 0) { 
        game.activePowerUp = null; 
        _powerUpUi.style.display = 'none'; 
      }
      
      if (game.activePowerUp === 'BLASTER' && game.time % 4 === 0) {
        if (Math.hypot(satellite.vx, satellite.vy) > 3) { 
          SoundManager.click(); // Replaces synth shoot
          let ang = Math.atan2(satellite.vy, satellite.vx);
          let projSpeed = Math.min(35, 15 + (game.score * 0.002));
          projectiles.push(new Projectile(satellite.x, satellite.y, Math.cos(ang)*projSpeed, Math.sin(ang)*projSpeed, '#cc00ff'));
        }
      }
    }

    if (game.comboTimer > 0) {
      game.comboTimer--; 
      if (game.comboTimer === 0 && game.multiplier > 1) { 
        game.multiplier = 1; _updateScoreHUD(); 
      }
    }

    if (game.running) {
      game.time++;
      if (game.time % 600 === 0 && game.spawnRate > 25) game.spawnRate -= 10; 
      if (game.time % game.spawnRate === 0) enemies.push(new Enemy());
      
      satellite.update();
    }

    // Projectiles 
    for (let p = projectiles.length - 1; p >= 0; p--) {
      let proj = projectiles[p]; proj.update();
      let hit = false;
      for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        if (!e.isDead && dist(proj.x, proj.y, e.x, e.y) < e.radius + proj.radius) {
          hit = true; SoundManager.click(); e.takeDamage(1); 
          createExplosion(proj.x, proj.y, '#fff', 3); break;
        }
      }
      if (hit || proj.life <= 0) projectiles.splice(p, 1);
    }

    // Shockwaves
    for(let i = shockwaves.length - 1; i >= 0; i--) {
      let sw = shockwaves[i]; sw.update();
      for(let j = 0; j < enemies.length; j++) {
        let e = enemies[j];
        if(!e.isDead && !sw.hitList.has(e) && dist(sw.x, sw.y, e.x, e.y) < sw.radius + e.radius) {
          sw.hitList.add(e); SoundManager.click(); e.takeDamage(2);
          if(!e.isDead) {
            let ang = Math.atan2(e.y - sw.y, e.x - sw.x);
            e.x += Math.cos(ang) * 40; e.y += Math.sin(ang) * 40;
          }
        }
      }
      if(sw.alpha <= 0) shockwaves.splice(i, 1);
    }

    // Enemies vs Core & Satellite
    if (game.running) {
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i]; if(e.isDead) continue;
        e.update();

        if (dist(e.x, e.y, core.x, core.y) < e.radius * 0.8 + core.radius) {
          core.takeDamage(); e.isDead = true; continue;
        }

        if (dist(e.x, e.y, satellite.x, satellite.y) < e.radius * 0.8 + satellite.radius) {
          if(e.isPowerUp) { e.isDead = true; continue; }
          e.takeDamage(1); SoundManager.click();
          
          if (game.activePowerUp === 'SHOCKWAVE') { 
            SoundManager.correct(); // Smash sound
            shockwaves.push(new Shockwave(e.x, e.y, '#00ff00')); 
          }
          if (!e.isDead) {
            let ang = Math.atan2(e.y - satellite.y, e.x - satellite.x);
            e.x += Math.cos(ang) * 50; e.y += Math.sin(ang) * 50;
            createExplosion(e.x, e.y, '#fff', 5);
          }
        }
      }
    }

    // Reap Dead Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      let e = enemies[i];
      if (e.isDead) {
        if(e.isPowerUp) { activatePowerUp(e); } 
        else {
          SoundManager.correct(); // Smash sound
          createExplosion(e.x, e.y, e.color, e.isSplitter ? 30 : 15);
          let pts = (e.isSplitter ? 30 : 10) * game.multiplier;
          game.score += pts; 
          floatingTexts.push(new FloatingText(e.x, e.y, `+${pts}`, '#fff'));
          
          if(e.isSplitter) {
            enemies.push(new Enemy(e.x + 10, e.y + 10, 15, true));
            enemies.push(new Enemy(e.x - 10, e.y - 10, 15, true));
          }

          if(game.multiplier < 10) {
            game.multiplier++;
            if(game.multiplier % 2 === 0) {
              floatingTexts.push(new FloatingText(CX(), CY() - 60, `x${game.multiplier} COMBO!`, '#ff0ff0', 28));
            }
          }
          game.comboTimer = 150; 
          _updateScoreHUD();
        }
        enemies.splice(i, 1);
      }
    }

    particles.forEach((p, i) => { p.update(); if(p.alpha<=0) particles.splice(i,1); });
    floatingTexts.forEach((ft, i) => { ft.update(); if(ft.alpha<=0) floatingTexts.splice(i,1); });
  }

  // ==============================================================================
  // 9. RENDER LOOP
  // ==============================================================================
  function _drawBackground() {
    _ctx.fillStyle = 'rgba(5, 5, 5, 0.4)'; 
    _ctx.fillRect(0, 0, W(), H()); 
    _ctx.save();
    _ctx.strokeStyle = 'rgba(0, 255, 255, 0.03)'; 
    _ctx.lineWidth = 1;
    let offset = (game.time * 0.5) % 50;
    for(let i = -50; i < W(); i+=50) { 
      _ctx.beginPath(); _ctx.moveTo(i+offset, 0); _ctx.lineTo(i+offset, H()); _ctx.stroke(); 
    }
    for(let i = -50; i < H(); i+=50) { 
      _ctx.beginPath(); _ctx.moveTo(0, i+offset); _ctx.lineTo(W(), i+offset); _ctx.stroke(); 
    }
    _ctx.restore();
  }

  function _draw() {
    _drawBackground();
    _ctx.save(); 
    applyShake();

    projectiles.forEach(p => p.draw());
    shockwaves.forEach(sw => sw.draw());
    
    if (game.running) {
      core.draw(); 
      satellite.draw();
    }
    
    enemies.forEach(e => e.draw());
    particles.forEach(p => p.draw());
    floatingTexts.forEach(ft => ft.draw());

    _ctx.restore();
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
