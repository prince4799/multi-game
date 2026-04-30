/* ================================================
   SHADOW STRIKE
   Stealth killer game with procedural levels,
   vision cones, and thematic environments.
   Category: Action
   ================================================ */

(function () {
  'use strict';

  // ================================================================
  //  CONSTANTS & SETTINGS
  // ================================================================
  let CELL_SIZE = 40; // Pixels per grid cell (dynamically scaled)
  let COLS = 15;
  let ROWS = 24;      // Base grid size, will be scaled to fit screen

  const GAME_THEMES = [
    { name: 'cyberpunk', bg: '#080812', wall: '#00f5ff', floor: '#0a0f1a', guard: '#bf00ff', vision: 'rgba(255, 0, 110, 0.4)' },
    { name: 'ninja',     bg: '#1a1005', wall: '#ff4500', floor: '#2a1a0a', guard: '#aa0000', vision: 'rgba(255, 100, 0, 0.4)' },
    { name: 'military',  bg: '#051505', wall: '#00e676', floor: '#0a250a', guard: '#556b2f', vision: 'rgba(100, 255, 100, 0.4)' }
  ];

  // Optional image assets (user will provide later)
  const ASSETS = {
    player: new Image(),
    guard:  new Image(),
    wall:   new Image(),
    floor:  new Image(),
    exit:   new Image(),
    intel:  new Image(),
    vent:   new Image(),
    coin:   new Image()
  };
  ASSETS.player.src = './assets/player.png';
  ASSETS.guard.src  = './assets/guard.png';
  ASSETS.wall.src   = './assets/wall.png';
  ASSETS.floor.src  = './assets/floor.png';
  ASSETS.exit.src   = './assets/exit.png';
  ASSETS.intel.src  = './assets/intel.gif';
  ASSETS.vent.src   = './assets/vent.png';
  ASSETS.coin.src   = './assets/coin.png';

  // ================================================================
  //  AUDIO SYSTEM (Web Audio API Synthesizer)
  // ================================================================
  const ShadowAudio = (() => {
    let ctx = null;
    let bgmOsc = null;
    let bgmGain = null;
    let initialized = false;

    function init() {
      if (initialized) return;
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!window.AudioContext) return;
      ctx = new AudioContext();
      initialized = true;
      playBGM();
    }

    function playTone(freq, type, duration, vol=0.1, slideFreq=null) {
      if (!ctx || ctx.state === 'suspended') return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideFreq) osc.frequency.exponentialRampToValueAtTime(slideFreq, ctx.currentTime + duration);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    }

    function playBGM() {
      if (!ctx || bgmOsc) return;
      bgmOsc = ctx.createOscillator();
      bgmGain = ctx.createGain();
      bgmOsc.type = 'triangle';
      bgmOsc.frequency.value = 55; // Low drone
      bgmOsc.connect(bgmGain);
      bgmGain.connect(ctx.destination);
      bgmGain.gain.value = 0.05;
      bgmOsc.start();
      
      setInterval(() => {
        if (!bgmGain || !ctx) return;
        bgmGain.gain.setTargetAtTime(0.08, ctx.currentTime, 0.5);
        setTimeout(() => { if (bgmGain) bgmGain.gain.setTargetAtTime(0.03, ctx.currentTime, 0.5); }, 1000);
      }, 2000);
    }

    function stopBGM() {
      if (bgmOsc) { bgmOsc.stop(); bgmOsc.disconnect(); bgmOsc = null; }
      if (bgmGain) { bgmGain.disconnect(); bgmGain = null; }
    }

    return {
      init, stopBGM,
      intel: () => playTone(600, 'sine', 0.2, 0.1, 1200),
      toss: () => playTone(800, 'square', 0.1, 0.05),
      alert: () => playTone(150, 'sawtooth', 1.0, 0.2, 50),
      takedown: () => playTone(100, 'square', 0.2, 0.2, 20),
      win: () => {
        playTone(400, 'sine', 0.1);
        setTimeout(() => playTone(500, 'sine', 0.1), 100);
        setTimeout(() => playTone(600, 'sine', 0.3), 200);
      }
    };
  })();

  // ================================================================
  //  STATE
  // ================================================================
  let containerEl = null;
  let canvas = null;
  let ctx = null;
  let animId = null;
  let lastTime = 0;

  const game = {
    running: false,
    paused: false,
    level: 1,
    maxLevel: 30,
    score: 0,
    state: 'MENU', // MENU, PLAYING, LEVEL_CLEAR, GAME_OVER
    themeIdx: 0,
    width: 0,
    height: 0,
    cameraX: 0,
    cameraY: 0,
    intelTotal: 0,
    intelCollected: 0
  };

  let map = []; // 2D array: 0=floor, 1=wall
  let player = { x: 0, y: 0, vx: 0, vy: 0, radius: 12, speed: 180, color: '#fff', angle: 0, hidden: false };
  let guards = [];
  let particles = [];
  let alerts = [];
  let intels = [];
  let vents = [];
  let coins = [];
  let exitTile = null;

  // Joystick Input
  let inputDir = { x: 0, y: 0 };

  // ================================================================
  //  DOM & INITIALIZATION
  // ================================================================
  function _buildDOM(container) {
    containerEl = container;
    container.innerHTML = '';
    
    canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
      position: 'absolute', inset: '0', display: 'block', width: '100%', height: '100%'
    });
    container.appendChild(canvas);
    
    // Container for DOM overlays (like GIF sprites)
    const overlays = document.createElement('div');
    overlays.id = 'shadow-strike-overlays';
    Object.assign(overlays.style, {
      position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden', zIndex: '10'
    });
    container.appendChild(overlays);

    ctx = canvas.getContext('2d');
    
    _resize();
    window.addEventListener('resize', _resize);
    
    // Auto-focus so keyboard controls work immediately without clicking
    window.focus();
    canvas.focus();
  }

  function _resize() {
    if (!canvas || !containerEl) return;
    const w = containerEl.clientWidth;
    const h = containerEl.clientHeight;
    canvas.width = w;
    canvas.height = h;
    game.width = w;
    game.height = h;
    
    // Dynamic cell size: aim for ~16 columns on desktop, less on narrow screens
    CELL_SIZE = Math.floor(w / 14);
    if (CELL_SIZE > 65) CELL_SIZE = 65; // Cap size on ultra-wide
    if (CELL_SIZE < 30) CELL_SIZE = 30; // Min size on tiny phones
    
    COLS = Math.floor(w / CELL_SIZE) + 2;
    ROWS = Math.floor(h / CELL_SIZE) + 2;
    if (COLS < 10) COLS = 10;
    if (ROWS < 15) ROWS = 15;
    
    // Scale player proportionally
    player.radius = CELL_SIZE * 0.35;
    player.speed = CELL_SIZE * 4.5;
  }

  // ================================================================
  //  LEVEL GENERATOR
  // ================================================================
  function _generateLevel(levelNum) {
    // Determine theme based on level (change every 5 levels)
    game.themeIdx = Math.floor((levelNum - 1) / 5) % GAME_THEMES.length;
    
    // Init map boundaries
    map = [];
    for (let r = 0; r < ROWS; r++) {
      let row = [];
      for (let c = 0; c < COLS; c++) {
        if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
          row.push(1); // Outer walls
        } else {
          row.push(0); // Floor
        }
      }
      map.push(row);
    }

    // Generate random internal walls (sparse placement to prevent blocking)
    const obstacleDensity = Math.min(0.2 + (levelNum * 0.02), 0.4); 
    for (let r = 2; r < ROWS - 2; r += 2) {
      for (let c = 2; c < COLS - 2; c += 2) {
        if (Math.random() < obstacleDensity) {
          map[r][c] = 1;
          // Randomly extend wall to make L-shapes or blocks, but rarely
          if (Math.random() < 0.3) map[r][c+1] = 1;
          if (Math.random() < 0.3) map[r+1][c] = 1;
        }
      }
    }

    // Ensure a path exists (crude carve-out for start area)
    player.x = 1.5 * CELL_SIZE;
    player.y = 1.5 * CELL_SIZE;
    player.hidden = false;
    map[1][1] = 0; map[1][2] = 0; map[2][1] = 0; map[2][2] = 0;

    intels = [];
    vents = [];
    coins = [];
    exitTile = null;
    game.intelCollected = 0;
    game.intelTotal = Math.min(1 + Math.floor(levelNum / 3), 5);

    // Generate Vents
    for (let r = 2; r < ROWS - 2; r++) {
      for (let c = 2; c < COLS - 2; c++) {
        if (map[r][c] === 0 && Math.random() < 0.05) {
          vents.push({ c, r });
        }
      }
    }

    // Generate Intel
    const overlays = document.getElementById('shadow-strike-overlays');
    if (overlays) overlays.innerHTML = '';
    
    const isIntelGif = ASSETS.intel.src.toLowerCase().includes('.gif');

    for (let i = 0; i < game.intelTotal; i++) {
      let c, r;
      do {
        c = Math.floor(Math.random() * (COLS - 4)) + 2;
        r = Math.floor(Math.random() * (ROWS - 4)) + 2;
      } while (map[r][c] !== 0 || (c < 4 && r < 4) || intels.some(int => int.c === c && int.r === r));
      
      let intelObj = { c, r, collected: false, domNode: null };
      
      if (isIntelGif && overlays) {
        const img = document.createElement('img');
        img.src = ASSETS.intel.src;
        img.style.position = 'absolute';
        img.style.width = '24px';
        img.style.height = '24px';
        img.style.marginLeft = '-12px';
        img.style.marginTop = '-12px';
        overlays.appendChild(img);
        intelObj.domNode = img;
      }
      
      intels.push(intelObj);
    }

    // Generate Guards
    guards = [];
    const numGuards = Math.min(1 + Math.floor(levelNum / 2), 15);
    for (let i = 0; i < numGuards; i++) {
      let gx, gy, c, r;
      do {
        c = Math.floor(Math.random() * (COLS - 4)) + 2;
        r = Math.floor(Math.random() * (ROWS - 4)) + 2;
      } while (map[r][c] !== 0 || (c < 4 && r < 4) || (c > COLS-4 && r > ROWS-4)); // Don't spawn on walls, start, or exit
      
      const patrolAxis = Math.random() > 0.5 ? 'x' : 'y';
      const maxDistBlocks = Math.floor(Math.random() * 3) + 2;
      let validDistBlocks = 0;
      let dir = Math.random() > 0.5 ? 1 : -1;
      
      // Check forward path for walls
      for (let step = 1; step <= maxDistBlocks; step++) {
        let checkC = c + (patrolAxis === 'x' ? step * dir : 0);
        let checkR = r + (patrolAxis === 'y' ? step * dir : 0);
        if (checkC < 0 || checkC >= COLS || checkR < 0 || checkR >= ROWS || map[checkR][checkC] !== 0) break;
        validDistBlocks = step;
      }
      
      // If blocked immediately, try the opposite direction
      if (validDistBlocks === 0) {
        dir *= -1;
        for (let step = 1; step <= maxDistBlocks; step++) {
          let checkC = c + (patrolAxis === 'x' ? step * dir : 0);
          let checkR = r + (patrolAxis === 'y' ? step * dir : 0);
          if (checkC < 0 || checkC >= COLS || checkR < 0 || checkR >= ROWS || map[checkR][checkC] !== 0) break;
          validDistBlocks = step;
        }
      }
      
      let p1 = { x: c * CELL_SIZE + CELL_SIZE/2, y: r * CELL_SIZE + CELL_SIZE/2 };
      let p2 = { 
        x: p1.x + (patrolAxis === 'x' ? validDistBlocks * dir * CELL_SIZE : 0), 
        y: p1.y + (patrolAxis === 'y' ? validDistBlocks * dir * CELL_SIZE : 0) 
      };

      
      let type = 'normal';
      let speedMultiplier = 1;
      let visionMult = 1;
      let fovMult = 1;

      if (levelNum > 2 && Math.random() < 0.2) type = 'spinner';
      else if (levelNum > 4 && Math.random() < 0.15) type = 'heavy';

      if (type === 'spinner') {
        speedMultiplier = 0;
        p2 = { x: p1.x, y: p1.y };
      } else if (type === 'heavy') {
        speedMultiplier = 0.6;
        visionMult = 1.5;
        fovMult = 1.5;
      }

      guards.push({
        x: p1.x, y: p1.y,
        vx: 0, vy: 0,
        radius: CELL_SIZE * 0.35 * (type === 'heavy' ? 1.2 : 1),
        speed: CELL_SIZE * (1.5 + levelNum * 0.05) * speedMultiplier,
        patrol: [p1, p2],
        patrolIdx: 1,
        angle: 0,
        visionRange: CELL_SIZE * (3.5 + levelNum * 0.1) * visionMult,
        visionFov: (Math.PI / 3) * fovMult, // 60 degrees base
        state: 'PATROL', // PATROL, ALERT, DEAD, INVESTIGATING
        type: type,
        alertTimer: 0,
        investigatePos: null
      });

    }

    particles = [];
    alerts = [];
    game.state = 'PLAYING';
    
    // Show level banner
    alerts.push({ text: `LEVEL ${levelNum}`, x: game.width/2, y: game.height/2, life: 2, maxLife: 2 });
  }

  // ================================================================
  //  GAME LOOP
  // ================================================================
  function _startLevel(level) {
    game.level = level;
    _generateLevel(level);
    game.running = true;
    game.paused = false;
    lastTime = performance.now();
    if (!animId) animId = requestAnimationFrame(_loop);
  }

  function _loop(ts) {
    if (!game.running || game.paused) {
      animId = requestAnimationFrame(_loop);
      return;
    }
    const dt = Math.min((ts - lastTime) / 1000, 0.1); // Max 100ms dt
    lastTime = ts;

    _update(dt);
    _draw();
    animId = requestAnimationFrame(_loop);
  }

  // ================================================================
  //  UPDATE LOGIC
  // ================================================================
  function _update(dt) {
    if (game.state !== 'PLAYING') {
      _updateParticles(dt);
      _updateAlerts(dt);
      return;
    }

    // --- Player Movement ---
    if (inputDir.x !== 0 || inputDir.y !== 0) {
      // Normalize joystick input to max length 1
      const len = Math.hypot(inputDir.x, inputDir.y);
      const nx = len > 1 ? inputDir.x / len : inputDir.x;
      const ny = len > 1 ? inputDir.y / len : inputDir.y;
      
      player.vx = nx * player.speed;
      player.vy = ny * player.speed;
      player.angle = Math.atan2(ny, nx);
    } else {
      player.vx = 0;
      player.vy = 0;
    }

    let nextX = player.x + player.vx * dt;
    let nextY = player.y + player.vy * dt;

    // Collision with walls (AABB vs Circle approximation)
    const padding = player.radius;
    const cMinX = Math.floor((nextX - padding) / CELL_SIZE);
    const cMaxX = Math.floor((nextX + padding) / CELL_SIZE);
    const cMinY = Math.floor((player.y - padding) / CELL_SIZE);
    const cMaxY = Math.floor((player.y + padding) / CELL_SIZE);
    
    let collideX = false;
    for (let r = cMinY; r <= cMaxY; r++) {
      for (let c = cMinX; c <= cMaxX; c++) {
        if (_isWall(r, c)) collideX = true;
      }
    }
    if (!collideX) player.x = nextX;

    const rMinX = Math.floor((player.x - padding) / CELL_SIZE);
    const rMaxX = Math.floor((player.x + padding) / CELL_SIZE);
    const rMinY = Math.floor((nextY - padding) / CELL_SIZE);
    const rMaxY = Math.floor((nextY + padding) / CELL_SIZE);
    
    let collideY = false;
    for (let r = rMinY; r <= rMaxY; r++) {
      for (let c = rMinX; c <= rMaxX; c++) {
        if (_isWall(r, c)) collideY = true;
      }
    }
    if (!collideY) player.y = nextY;

    // Check Vents (Hiding)
    player.hidden = false;
    for (let v of vents) {
      const vx = v.c * CELL_SIZE + CELL_SIZE/2;
      const vy = v.r * CELL_SIZE + CELL_SIZE/2;
      if (Math.hypot(player.x - vx, player.y - vy) < CELL_SIZE/2) {
        player.hidden = true;
        break;
      }
    }

    // Check Intel
    for (let i of intels) {
      if (!i.collected) {
        const ix = i.c * CELL_SIZE + CELL_SIZE/2;
        const iy = i.r * CELL_SIZE + CELL_SIZE/2;
        if (Math.hypot(player.x - ix, player.y - iy) < player.radius + 15) {
          i.collected = true;
          if (i.domNode) i.domNode.style.display = 'none';
          game.intelCollected++;
          game.score += 50;
          ShadowAudio.intel();
          alerts.push({ text: 'INTEL SECURED!', x: ix, y: iy - 20, life: 1, maxLife: 1 });
          
          if (game.intelCollected >= game.intelTotal && !exitTile) {
            // Spawn Exit near a guard to make it challenging
            let ec, er;
            const livingGuards = guards.filter(g => g.state !== 'DEAD');
            if (livingGuards.length > 0) {
              const targetGuard = livingGuards[Math.floor(Math.random() * livingGuards.length)];
              do {
                ec = Math.floor(targetGuard.x / CELL_SIZE) + (Math.floor(Math.random() * 5) - 2);
                er = Math.floor(targetGuard.y / CELL_SIZE) + (Math.floor(Math.random() * 5) - 2);
              } while (_isWall(er, ec) || (ec < 1) || (er < 1) || (ec >= COLS-1) || (er >= ROWS-1));
            } else {
              // Fallback if all guards are dead
              do {
                ec = Math.floor(Math.random() * (COLS - 4)) + 2;
                er = Math.floor(Math.random() * (ROWS - 4)) + 2;
              } while (_isWall(er, ec));
            }
            exitTile = { c: ec, r: er };
            alerts.push({ text: 'EXIT OPEN!', x: game.width/2, y: 100, life: 3, maxLife: 3 });
          }
        }
      }
    }

    // Update Coins
    for (let i = coins.length - 1; i >= 0; i--) {
      let c = coins[i];
      if (c.life > 0) {
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.vx *= 0.9; // Friction
        c.vy *= 0.9;
        if (Math.hypot(c.vx, c.vy) < 10) { c.vx = 0; c.vy = 0; }
        c.life -= dt;
      } else {
        coins.splice(i, 1);
      }
    }

    // Check Exit
    if (exitTile) {
      const ex = exitTile.c * CELL_SIZE + CELL_SIZE/2;
      const ey = exitTile.r * CELL_SIZE + CELL_SIZE/2;
      if (Math.hypot(player.x - ex, player.y - ey) < player.radius + CELL_SIZE/2) {
        game.state = 'LEVEL_CLEAR';
        game.score += 200;
        alerts.push({ text: 'LEVEL CLEARED!', x: player.x, y: player.y - 30, life: 2, maxLife: 2 });
        ShadowAudio.win();
        setTimeout(() => _startLevel(game.level + 1), 2000);
        return;
      }
    }

    // --- Guards Logic ---
    for (let i = guards.length - 1; i >= 0; i--) {
      let g = guards[i];
      if (g.state === 'DEAD') continue;

      if (g.state === 'INVESTIGATING' && g.investigatePos) {
        const dx = g.investigatePos.x - g.x;
        const dy = g.investigatePos.y - g.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 5) {
          g.state = 'PATROL';
          g.investigatePos = null;
        } else {
          g.angle = Math.atan2(dy, dx);
          g.x += Math.cos(g.angle) * g.speed * dt;
          g.y += Math.sin(g.angle) * g.speed * dt;
        }
      } else if (g.type === 'spinner') {
        g.angle += 1.5 * dt; // Spin continuously
      } else {
        // Normal Patrol Move
        const target = g.patrol[g.patrolIdx];
        const dx = target.x - g.x;
        const dy = target.y - g.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist < 5) {
          g.patrolIdx = (g.patrolIdx + 1) % g.patrol.length;
        } else {
          g.angle = Math.atan2(dy, dx);
          g.x += Math.cos(g.angle) * g.speed * dt;
          g.y += Math.sin(g.angle) * g.speed * dt;
        }
      }

      // Check for coin noises if not already investigating
      if (g.state !== 'INVESTIGATING') {
        for (let coin of coins) {
          if (coin.life > 4.5 && Math.hypot(coin.x - g.x, coin.y - g.y) < 200) { // Just thrown
            g.state = 'INVESTIGATING';
            g.investigatePos = { x: coin.x, y: coin.y };
            alerts.push({ text: '?', x: g.x, y: g.y - 20, life: 1, maxLife: 1 });
            break;
          }
        }
      }

      // Vision check (Raycast to player)
      const distToPlayer = Math.hypot(player.x - g.x, player.y - g.y);
      if (!player.hidden && distToPlayer < g.visionRange) {
        const angleToPlayer = Math.atan2(player.y - g.y, player.x - g.x);
        let angleDiff = Math.abs(angleToPlayer - g.angle);
        if (angleDiff > Math.PI) angleDiff = (2 * Math.PI) - angleDiff;
        
        if (angleDiff < g.visionFov / 2) {
          // In cone angle, now check line of sight
          if (_hasLineOfSight(g.x, g.y, player.x, player.y)) {
            // DETECTED!
            g.state = 'ALERT';
            game.state = 'GAME_OVER';
            alerts.push({ text: 'DETECTED!', x: player.x, y: player.y - 30, life: 3, maxLife: 3 });
            ShadowAudio.alert();
            ShadowAudio.stopBGM();
            setTimeout(() => _gameOver(), 2000);
            return;
          }
        }
      }

      // Takedown logic (Player touches guard outside vision cone)
      if (distToPlayer < player.radius + g.radius + 5) {
        // Player is close, check if behind
        g.state = 'DEAD';
        game.score += 100;
        ShadowAudio.takedown();
        _spawnParticles(g.x, g.y, '#ff0000', 15);
        alerts.push({ text: '+100', x: g.x, y: g.y - 20, life: 1, maxLife: 1 });
      }
    }

    // Camera follow player
    game.cameraX = player.x - game.width / 2;
    game.cameraY = player.y - game.height / 2;
    
    // Clamp camera
    game.cameraX = Math.max(0, Math.min(game.cameraX, COLS * CELL_SIZE - game.width));
    game.cameraY = Math.max(0, Math.min(game.cameraY, ROWS * CELL_SIZE - game.height));

    _updateParticles(dt);
    _updateAlerts(dt);
  }

  function _isWall(r, c) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
    return map[r][c] === 1;
  }

  // Simple DDA Raycasting to check line of sight
  function _hasLineOfSight(x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let x = Math.floor(x0 / CELL_SIZE);
    let y = Math.floor(y0 / CELL_SIZE);
    let n = 1;
    let x_inc, y_inc;
    let error;

    if (dx === 0) { x_inc = 0; error = Infinity; }
    else if (x1 > x0) { x_inc = 1; n += Math.floor(x1 / CELL_SIZE) - x; error = (Math.floor(x0 / CELL_SIZE) + 1 - x0 / CELL_SIZE) * dy; }
    else { x_inc = -1; n += x - Math.floor(x1 / CELL_SIZE); error = (x0 / CELL_SIZE - Math.floor(x0 / CELL_SIZE)) * dy; }

    if (dy === 0) { y_inc = 0; error -= Infinity; }
    else if (y1 > y0) { y_inc = 1; n += Math.floor(y1 / CELL_SIZE) - y; error -= (Math.floor(y0 / CELL_SIZE) + 1 - y0 / CELL_SIZE) * dx; }
    else { y_inc = -1; n += y - Math.floor(y1 / CELL_SIZE); error -= (y0 / CELL_SIZE - Math.floor(y0 / CELL_SIZE)) * dx; }

    for (; n > 0; --n) {
      if (_isWall(y, x)) return false; // Hit a wall
      if (error > 0) { y += y_inc; error -= dx; }
      else { x += x_inc; error += dy; }
    }
    return true; // No walls hit
  }

  function _updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      let p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function _updateAlerts(dt) {
    for (let i = alerts.length - 1; i >= 0; i--) {
      let a = alerts[i];
      a.y -= 20 * dt;
      a.life -= dt;
      if (a.life <= 0) alerts.splice(i, 1);
    }
  }

  function _spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 100 + 50;
      particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.5, maxLife: 1,
        color, size: Math.random() * 3 + 2
      });
    }
  }

  function _gameOver() {
    App.showGameResult(game.score, false);
  }

  // ================================================================
  //  RENDER
  // ================================================================
  function _draw() {
    if (!ctx) return;
    const theme = GAME_THEMES[game.themeIdx];

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, game.width, game.height);

    ctx.save();
    ctx.translate(-game.cameraX, -game.cameraY);

    // Draw Floor Tiles (if no image, skip, use bg)
    if (ASSETS.floor.complete && ASSETS.floor.naturalWidth > 0) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (map[r][c] === 0 || map[r][c] === 2) {
             ctx.drawImage(ASSETS.floor, c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          }
        }
      }
    }

    // Draw Walls
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (map[r][c] === 1) {
          if (ASSETS.wall.complete && ASSETS.wall.naturalWidth > 0) {
            ctx.drawImage(ASSETS.wall, c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          } else {
            ctx.fillStyle = theme.wall;
            ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            ctx.strokeStyle = '#000';
            ctx.strokeRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          }
        }
      }
    }

    // Draw Vents
    vents.forEach(v => {
      const vx = v.c * CELL_SIZE;
      const vy = v.r * CELL_SIZE;
      if (ASSETS.vent.complete && ASSETS.vent.naturalWidth > 0) {
        ctx.drawImage(ASSETS.vent, vx, vy, CELL_SIZE, CELL_SIZE);
      } else {
        ctx.fillStyle = 'rgba(50,50,50,0.8)';
        ctx.fillRect(vx + 4, vy + 4, CELL_SIZE - 8, CELL_SIZE - 8);
        ctx.strokeStyle = '#222';
        ctx.strokeRect(vx + 4, vy + 4, CELL_SIZE - 8, CELL_SIZE - 8);
        ctx.beginPath();
        for(let i=8; i<CELL_SIZE-8; i+=6) { ctx.moveTo(vx+8, vy+i); ctx.lineTo(vx+CELL_SIZE-8, vy+i); }
        ctx.stroke();
      }
    });

    // Draw Intel
    intels.forEach(i => {
      if(i.collected) return;
      const ix = i.c * CELL_SIZE + CELL_SIZE/2;
      const iy = i.r * CELL_SIZE + CELL_SIZE/2;
      
      if (i.domNode) {
        i.domNode.style.left = (ix - game.cameraX) + 'px';
        i.domNode.style.top = (iy - game.cameraY) + 'px';
      } else {
        if (ASSETS.intel.complete && ASSETS.intel.naturalWidth > 0) {
          ctx.drawImage(ASSETS.intel, ix - 12, iy - 12, 24, 24);
        } else {
          ctx.fillStyle = '#ffcc00';
          ctx.fillRect(ix - 10, iy - 8, 20, 16);
          ctx.fillStyle = '#cc9900';
          ctx.fillRect(ix - 4, iy - 10, 8, 2);
        }
      }
    });

    // Draw Exit
    if (exitTile) {
      const ex = exitTile.c * CELL_SIZE;
      const ey = exitTile.r * CELL_SIZE;
      if (ASSETS.exit.complete && ASSETS.exit.naturalWidth > 0) {
        ctx.drawImage(ASSETS.exit, ex, ey, CELL_SIZE, CELL_SIZE);
      } else {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.fillRect(ex, ey, CELL_SIZE, CELL_SIZE);
        ctx.fillStyle = '#0f0';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('EXIT', ex + CELL_SIZE/2, ey + CELL_SIZE/2 + 4);
      }
    }

    // Draw Coins
    coins.forEach(c => {
      if (ASSETS.coin.complete && ASSETS.coin.naturalWidth > 0) {
        ctx.drawImage(ASSETS.coin, c.x - 6, c.y - 6, 12, 12);
      } else {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath(); ctx.arc(c.x, c.y, 4, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#daa520'; ctx.stroke();
      }
    });


    // Draw Guards
    guards.forEach(g => {
      if (g.state === 'DEAD') {
        ctx.fillStyle = 'rgba(150,0,0,0.5)';
        ctx.beginPath(); ctx.arc(g.x, g.y, g.radius, 0, Math.PI*2); ctx.fill();
        return;
      }

      // Draw Vision Cone
      ctx.fillStyle = g.state === 'ALERT' ? 'rgba(255,0,0,0.6)' : theme.vision;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.arc(g.x, g.y, g.visionRange, g.angle - g.visionFov/2, g.angle + g.visionFov/2);
      ctx.lineTo(g.x, g.y);
      ctx.fill();

      // Guard Body
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.angle);
      if (ASSETS.guard.complete && ASSETS.guard.naturalWidth > 0) {
        ctx.drawImage(ASSETS.guard, -g.radius, -g.radius, g.radius*2, g.radius*2);
        if (g.type !== 'normal') {
          ctx.fillStyle = g.type === 'heavy' ? 'rgba(255,0,0,0.4)' : 'rgba(255,255,0,0.4)';
          ctx.beginPath(); ctx.arc(0, 0, g.radius, 0, Math.PI*2); ctx.fill();
        }
      } else {
        ctx.fillStyle = g.type === 'heavy' ? '#cc0000' : g.type === 'spinner' ? '#cccc00' : theme.guard;
        ctx.beginPath(); ctx.arc(0, 0, g.radius, 0, Math.PI*2); ctx.fill();
        // Eye indicator
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(g.radius - 4, -4, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(g.radius - 4, 4, 3, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    });

    // Draw Player
    if (player.hidden) ctx.globalAlpha = 0.4;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    if (ASSETS.player.complete && ASSETS.player.naturalWidth > 0) {
      ctx.drawImage(ASSETS.player, -player.radius, -player.radius, player.radius*2, player.radius*2);
    } else {
      ctx.fillStyle = player.color;
      ctx.beginPath(); ctx.arc(0, 0, player.radius, 0, Math.PI*2); ctx.fill();
      // Direction indicator
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(player.radius, 0); ctx.lineTo(0, 6); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // Draw Particles
    particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    });

    // Draw Alerts
    alerts.forEach(a => {
      ctx.fillStyle = `rgba(255,255,255,${a.life / a.maxLife})`;
      ctx.font = 'bold 20px "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(a.text, a.x, a.y);
    });

    ctx.restore();

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = '20px "Orbitron", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`LVL: ${game.level} | SCR: ${game.score} | INTEL: ${game.intelCollected}/${game.intelTotal}`, 10, 30);
  }

  // ================================================================
  //  CONTROLS
  // ================================================================
  function _attachControls() {
    ControlManager.on('keydown', 'shadow-strike', (key) => {
      ShadowAudio.init(); // Requires user gesture
      if (key === 'ArrowUp' || key === 'w' || key === 'W') inputDir.y = -1;
      if (key === 'ArrowDown' || key === 's' || key === 'S') inputDir.y = 1;
      if (key === 'ArrowLeft' || key === 'a' || key === 'A') inputDir.x = -1;
      if (key === 'ArrowRight' || key === 'd' || key === 'D') inputDir.x = 1;
    });

    ControlManager.on('action', 'shadow-strike', (actionId) => {
      ShadowAudio.init();
      if (actionId === 'throw' && game.state === 'PLAYING') {
        const speed = 400;
        coins.push({
          x: player.x,
          y: player.y,
          vx: Math.cos(player.angle) * speed,
          vy: Math.sin(player.angle) * speed,
          life: 5
        });
        ShadowAudio.toss();
      }
    });

    ControlManager.on('keyup', 'shadow-strike', (key) => {
      if (key === 'ArrowUp' || key === 'w' || key === 'W') if (inputDir.y < 0) inputDir.y = 0;
      if (key === 'ArrowDown' || key === 's' || key === 'S') if (inputDir.y > 0) inputDir.y = 0;
      if (key === 'ArrowLeft' || key === 'a' || key === 'A') if (inputDir.x < 0) inputDir.x = 0;
      if (key === 'ArrowRight' || key === 'd' || key === 'D') if (inputDir.x > 0) inputDir.x = 0;
    });

    // Handle Joystick via postMessage from shell directly (since game-shim doesn't fully proxy analog joystick coords nicely yet without a small modification)
    // Wait, Space Dog uses joystick. Let's see how Space Dog receives it... it listens to 'message' for 'JOYSTICK_MOVE'
    window.addEventListener('message', _joystickHandler);
  }

  function _joystickHandler(e) {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'JOYSTICK_MOVE') {
      // x, y are between -1 and 1
      inputDir.x = e.data.x;
      inputDir.y = e.data.y;
    }
    if (e.data.type === 'JOYSTICK_END') {
      inputDir.x = 0;
      inputDir.y = 0;
    }
  }

  function _detachControls() {
    ControlManager.off('keydown', 'shadow-strike');
    ControlManager.off('keyup', 'shadow-strike');
    window.removeEventListener('message', _joystickHandler);
  }

  // ================================================================
  //  PAUSE & THEME HOOKS
  // ================================================================
  window.__onPause = () => {
    game.paused = true;
  };
  window.__onResume = () => {
    game.paused = false;
  };
  window.__onTheme = (themeName) => {
    // We can use this to override styles, but since themes are tied to levels in this game, 
    // we might just ignore the shell's theme or blend it. For now, let level dictate theme.
  };

  // ================================================================
  //  API
  // ================================================================
  const ShadowStrike = {
    start(container) {
      _buildDOM(container);
      _attachControls();
      _startLevel(1);
      App.updateScoreDisplay(0, ScoreManager.getBestScore('shadow-strike'));
    },
    destroy() {
      game.running = false;
      if (animId) cancelAnimationFrame(animId);
      _detachControls();
      window.removeEventListener('resize', _resize);
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      canvas = null;
      ctx = null;
    }
  };

  // ================================================================
  //  REGISTRATION
  // ================================================================
  GameRegistry.register({
    id: 'shadow-strike',
    title: 'Shadow Strike',
    category: 'action',
    description: 'Sneak through enemy facilities, eliminate guards from behind, and reach the exit!',
    emoji: '🥷',
    difficulty: 'hard',
    controls: { controlType: 'joystick', keyboard: true, mouse: false, swipe: false, actions: [] },
    init: (c) => ShadowStrike.start(c),
    destroy: () => ShadowStrike.destroy()
  });

})();
