/* ================================================
   MEMORY MATCH
   Flip cards and find all matching pairs!
   Category: Brain Train
   Controls: Mouse click (desktop) | Tap (mobile)
   ================================================ */

const MemoryMatch = (() => {

  /* ---------- GAME CONFIG ---------- */
  const LEVELS = [
    { name: 'Easy',   pairs: 6,  cols: 4, time: 60,  theme: 'purple' },
    { name: 'Medium', pairs: 8,  cols: 4, time: 90,  theme: 'blue'   },
    { name: 'Hard',   pairs: 10, cols: 5, time: 120, theme: 'fire'   }
  ];

  const EMOJIS = [
    '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼',
    '🐨','🐯','🦁','🐮','🐷','🐸','🐵','🦋',
    '🌸','⭐','🎮','🏆','🎯','🎪','🎨','🎭',
    '🍎','🍊','🍋','🍇','🍓','🎂'
  ];

  /* ---------- STATE ---------- */
  let container     = null;
  let cards         = [];
  let flipped       = [];
  let matched       = [];
  let score         = 0;
  let moves         = 0;
  let timeLeft      = 0;
  let timerInterval = null;
  let isLocked      = false;
  let currentLevel  = 0;
  let isRunning     = false;
  let isPaused      = false;
  let gameEl        = null;

  /* ================================================
     REGISTER WITH GAME REGISTRY
  ================================================ */
  GameRegistry.register({
    id:          'memory-match',
    title:       'Memory Match',
    category:    'brain-train',
    description: 'Flip cards and find all matching pairs before time runs out!',
    emoji:       '🃏',
    difficulty:  'easy',
    controls:    { dpad: false, actions: false, center: false },
    init:        (c) => MemoryMatch.start(c),
    destroy:     () => MemoryMatch.destroy()
  });

  /* ================================================
     START GAME
  ================================================ */
  function start(cont) {
    container    = cont;
    currentLevel = 0;
    showLevelSelect();
  }

  /* ================================================
     LEVEL SELECT SCREEN
  ================================================ */
  function showLevelSelect() {
    cleanup();

    gameEl = document.createElement('div');
    gameEl.className = 'mm-wrap';
    gameEl.innerHTML = `
      <div class="mm-level-select">
        <div class="mm-logo">🃏</div>
        <h2 class="mm-heading">Memory Match</h2>
        <p class="mm-sub">Select difficulty to start</p>
        <div class="mm-level-btns">
          ${LEVELS.map((lvl, i) => `
            <button class="mm-level-btn" data-level="${i}">
              <span class="mm-lvl-name">${lvl.name}</span>
              <span class="mm-lvl-detail">${lvl.pairs} Pairs · ${lvl.time}s</span>
            </button>
          `).join('')}
        </div>
      </div>`;

    container.appendChild(gameEl);

    gameEl.querySelectorAll('.mm-level-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        SoundManager.click();
        currentLevel = parseInt(btn.dataset.level);
        startLevel(currentLevel);
      });
    });
  }

  /* ================================================
     START LEVEL
  ================================================ */
  function startLevel(levelIdx) {
    cleanup();
    isRunning = true;
    score     = 0;
    moves     = 0;
    flipped   = [];
    matched   = [];
    isLocked  = false;

    const level = LEVELS[levelIdx];
    timeLeft    = level.time;
    const pairs = level.pairs;
    const cols  = level.cols;

    const emojiSet = EMOJIS.slice(0, pairs);
    const deck     = [...emojiSet, ...emojiSet];
    shuffleArray(deck);

    cards = deck.map((emoji, i) => ({
      id: i, emoji, isFlipped: false, isMatched: false
    }));

    gameEl = document.createElement('div');
    gameEl.className     = 'mm-wrap';
    gameEl.dataset.theme = level.theme;   // purple | blue | fire
    gameEl.innerHTML = `
      <div class="mm-game">
        <div class="mm-hud">
          <div class="mm-hud-item">
            <span class="mm-hud-label">Score</span>
            <span class="mm-hud-val" id="mm-score">0</span>
          </div>
          <div class="mm-hud-item">
            <span class="mm-hud-label">Time</span>
            <span class="mm-hud-val mm-timer" id="mm-timer">${timeLeft}</span>
          </div>
          <div class="mm-hud-item">
            <span class="mm-hud-label">Moves</span>
            <span class="mm-hud-val" id="mm-moves">0</span>
          </div>
          <div class="mm-hud-item">
            <span class="mm-hud-label">Pairs</span>
            <span class="mm-hud-val"><span id="mm-matched">0</span>/${pairs}</span>
          </div>
        </div>
        <div class="mm-progress-wrap">
          <div class="mm-progress-bar" id="mm-progress" style="width:100%"></div>
        </div>
        <div class="mm-grid" id="mm-grid" style="--cols:${cols}"></div>
      </div>`;

    container.appendChild(gameEl);

    const grid = gameEl.querySelector('#mm-grid');
    cards.forEach(card => grid.appendChild(createCardEl(card)));

    startTimer(level.time, pairs);
    peekCards();
  }

  /* ================================================
     PEEK: Show all cards briefly at start
  ================================================ */
  function peekCards() {
    isLocked = true;
    document.querySelectorAll('.mm-card').forEach(el => el.classList.add('flipped'));
    setTimeout(() => {
      document.querySelectorAll('.mm-card').forEach(el => el.classList.remove('flipped'));
      isLocked = false;
    }, 1500);
  }

  /* ================================================
     CREATE CARD ELEMENT
  ================================================ */
  function createCardEl(card) {
    const el = document.createElement('div');
    el.className  = 'mm-card';
    el.dataset.id = card.id;
    el.innerHTML  = `
      <div class="mm-card-inner">
        <div class="mm-card-front"></div>
        <div class="mm-card-back">${card.emoji}</div>
      </div>`;

    el.addEventListener('click', () => handleCardClick(card.id));
    el.addEventListener('touchstart', e => {
      e.preventDefault();
      handleCardClick(card.id);
    }, { passive: false });

    return el;
  }

  /* ================================================
     HANDLE CARD CLICK
  ================================================ */
  function handleCardClick(cardId) {
    if (!isRunning)        return;
    if (isLocked)          return;
    const card = cards[cardId];
    if (!card)             return;
    if (card.isFlipped)    return;
    if (card.isMatched)    return;
    if (flipped.length >= 2) return;

    card.isFlipped = true;
    flipped.push(card);
    SoundManager.cardFlip();

    const el = gameEl.querySelector(`[data-id="${cardId}"]`);
    if (el) el.classList.add('flipped');

    if (flipped.length === 2) {
      moves++;
      updateHUD();
      isLocked = true;
      setTimeout(() => checkMatch(), 700);
    }
  }

  /* ================================================
     CHECK MATCH
  ================================================ */
  function checkMatch() {
    const [a, b] = flipped;

    if (a.emoji === b.emoji) {
      a.isMatched = b.isMatched = true;
      matched.push(a.id, b.id);

      const points = Math.max(10, 50 - moves + Math.floor(timeLeft / 5));
      score += points;
      SoundManager.cardMatch();

      [a.id, b.id].forEach(id => {
        const el = gameEl.querySelector(`[data-id="${id}"]`);
        if (el) el.classList.add('matched');
      });

      updateHUD();

      const level = LEVELS[currentLevel];
      if (matched.length === level.pairs * 2) {
        setTimeout(() => endGame(true), 500);
      }
    } else {
      SoundManager.cardMismatch();
      [a, b].forEach(card => {
        card.isFlipped = false;
        const el = gameEl.querySelector(`[data-id="${card.id}"]`);
        if (el) {
          el.classList.remove('flipped');
          el.classList.add('shake');
          setTimeout(() => el.classList.remove('shake'), 500);
        }
      });
    }

    flipped  = [];
    isLocked = false;
  }

  /* ================================================
     TIMER
  ================================================ */
  function startTimer(seconds) {
    clearInterval(timerInterval);
    timeLeft = seconds;

    timerInterval = setInterval(() => {
      if (!isRunning || isPaused) return;   // ← respect pause
      timeLeft--;

      const timerEl = gameEl?.querySelector('#mm-timer');
      if (timerEl) {
        timerEl.textContent = timeLeft;
        timerEl.style.color = timeLeft <= 10 ? '#ff4444' : '#00f5ff';
      }

      const bar = gameEl?.querySelector('#mm-progress');
      if (bar) {
        bar.style.width      = (timeLeft / seconds * 100) + '%';
        bar.style.background = timeLeft <= 10 ? '#ff4444' : '#00f5ff';
        bar.style.boxShadow  = timeLeft <= 10
          ? '0 0 8px #ff4444'
          : '0 0 8px #00f5ff';
      }

      if (timeLeft <= 10 && timeLeft > 0) SoundManager.timerWarning();
      if (timeLeft <= 0) { clearInterval(timerInterval); endGame(false); }
    }, 1000);
  }

  /* ================================================
     UPDATE HUD
  ================================================ */
  function updateHUD() {
    const scoreEl   = gameEl?.querySelector('#mm-score');
    const movesEl   = gameEl?.querySelector('#mm-moves');
    const matchedEl = gameEl?.querySelector('#mm-matched');
    if (scoreEl)   scoreEl.textContent   = score;
    if (movesEl)   movesEl.textContent   = moves;
    if (matchedEl) matchedEl.textContent = matched.length / 2;
    App.updateScoreDisplay(score, ScoreManager.getBestScore('memory-match'));
  }

  /* ================================================
     END GAME
  ================================================ */
  function endGame(won) {
    isRunning = false;
    clearInterval(timerInterval);
    if (won) { score += timeLeft * 2; updateHUD(); }
    setTimeout(() => App.showGameResult(score, won), won ? 800 : 400);
  }

  /* ================================================
     CLEANUP
  ================================================ */
  function cleanup() {
    clearInterval(timerInterval);
    isRunning = false;
    isPaused  = false;
    if (gameEl && gameEl.parentNode) gameEl.parentNode.removeChild(gameEl);
    gameEl = null;
  }

  function destroy() { cleanup(); }

  /* ================================================
     PAUSE / RESUME  — hooked by game-shim PAUSE msg
  ================================================ */
  function pause() {
    if (!isRunning || isPaused) return;
    isPaused = true;
    isLocked = true;
    // Show pause overlay
    let ov = document.getElementById('mm-pause-ov');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'mm-pause-ov';
      Object.assign(ov.style, {
        position: 'fixed', inset: '0', zIndex: '999',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)', webkitBackdropFilter: 'blur(6px)'
      });
      ov.innerHTML = `
        <div style="font-family:'Orbitron',sans-serif;font-size:clamp(1.4rem,4vw,2rem);
          font-weight:900;color:#00f5ff;text-shadow:0 0 20px rgba(0,245,255,0.6);
          letter-spacing:3px;margin-bottom:0.5rem">⏸ PAUSED</div>
        <div style="font-size:0.8rem;color:rgba(255,255,255,0.4);letter-spacing:2px">
          Resume from the game menu</div>`;
      document.body.appendChild(ov);
    }
    ov.style.display = 'flex';
  }

  function resume() {
    if (!isPaused) return;
    isPaused = false;
    isLocked = false;
    const ov = document.getElementById('mm-pause-ov');
    if (ov) ov.style.display = 'none';
  }

  // Register hooks for game-shim.js to call
  window.__onPause  = pause;
  window.__onResume = resume;

  /* ================================================
     THEME  —  shell broadcasts current theme on load
     and whenever user changes it
  ================================================ */
  const THEME_PALETTE = {
    neon:   { primary: '#00f5ff', secondary: '#bf00ff', bg: '#0a0a1a',
              glow: 'rgba(0,245,255,0.55)',  cardBg: 'rgba(0,30,80,0.3)'  },
    fire:   { primary: '#ff4500', secondary: '#ff8c00', bg: '#120300',
              glow: 'rgba(255,69,0,0.55)',   cardBg: 'rgba(80,15,0,0.35)' },
    ocean:  { primary: '#00cfff', secondary: '#0055ff', bg: '#00101e',
              glow: 'rgba(0,207,255,0.55)',  cardBg: 'rgba(0,40,80,0.3)'  },
    forest: { primary: '#00e676', secondary: '#76ff03', bg: '#011501',
              glow: 'rgba(0,230,118,0.55)',  cardBg: 'rgba(0,40,10,0.35)' },
    gold:   { primary: '#ffd700', secondary: '#ff9500', bg: '#120f00',
              glow: 'rgba(255,215,0,0.55)',  cardBg: 'rgba(60,45,0,0.35)' },
    light:  { primary: '#6c63ff', secondary: '#ff6584', bg: '#f0f4ff',
              glow: 'rgba(108,99,255,0.45)', cardBg: 'rgba(108,99,255,0.08)' }
  };

  let _themeStyleEl = null;

  function applyTheme(themeName) {
    const p = THEME_PALETTE[themeName] || THEME_PALETTE.neon;
    const isLight = themeName === 'light';

    // Create/reuse a dedicated <style> for theme variable overrides
    if (!_themeStyleEl) {
      _themeStyleEl = document.createElement('style');
      _themeStyleEl.id = 'mm-theme-vars';
      document.head.appendChild(_themeStyleEl);
    }

    const textColor      = isLight ? '#1a1a3e' : '#e0e0ff';
    const textMuted      = isLight ? 'rgba(26,26,62,0.5)' : 'rgba(255,255,255,0.35)';
    const hudBorder      = isLight ? 'rgba(0,0,0,0.1)' : `rgba(${hexToRgb(p.primary)},0.18)`;
    const hudBg          = isLight ? 'rgba(240,244,255,0.95)' : 'rgba(10,10,30,0.9)';

    _themeStyleEl.textContent = `
      .mm-wrap {
        background:
          radial-gradient(ellipse at 20% 10%, ${p.cardBg} 0%, transparent 55%),
          radial-gradient(ellipse at 80% 90%, ${p.cardBg} 0%, transparent 55%),
          ${p.bg} !important;
      }
      .mm-heading {
        color: ${p.primary} !important;
        text-shadow: 0 0 20px ${p.glow}, 0 0 40px ${p.glow} !important;
      }
      .mm-logo { filter: drop-shadow(0 0 20px ${p.primary}) !important; }
      .mm-lvl-name  { color: ${p.primary} !important; }
      .mm-level-btn { border-color: rgba(${hexToRgb(p.primary)},0.2) !important; }
      .mm-level-btn:hover {
        border-color: rgba(${hexToRgb(p.primary)},0.55) !important;
        box-shadow: 0 0 20px rgba(${hexToRgb(p.primary)},0.12) !important;
      }
      .mm-hud { background: ${hudBg} !important; border-color: ${hudBorder} !important; }
      .mm-hud-label { color: ${textMuted} !important; }
      .mm-hud-val   { color: ${p.primary} !important; }
      .mm-sub       { color: ${textMuted} !important; }
      .mm-progress-bar { background: ${p.primary} !important; box-shadow: 0 0 8px ${p.primary} !important; }
    `;

    // Also update live timer/progress if game is active
    const timerEl = document.querySelector('#mm-timer');
    if (timerEl) timerEl.style.color = p.primary;
    const bar = document.querySelector('#mm-progress');
    if (bar) { bar.style.background = p.primary; bar.style.boxShadow = `0 0 8px ${p.primary}`; }
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.replace('#',''), 16);
    return `${(n>>16)&255},${(n>>8)&255},${n&255}`;
  }

  window.__onTheme = applyTheme;

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ================================================
     INJECT STYLES — Cyber-Fantasy Card Theme
     Card back art: ./assets/card-back.png
  ================================================ */
  const style = document.createElement('style');
  style.textContent = `

    .mm-wrap {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      padding: 0.75rem; overflow-y: auto;
      background:
        radial-gradient(ellipse at 20% 10%, rgba(0,245,255,0.04) 0%, transparent 55%),
        radial-gradient(ellipse at 80% 90%, rgba(0,100,255,0.05) 0%, transparent 55%),
        #0a0a1a;
    }

    /* ── Level Select ── */
    .mm-level-select { text-align: center; max-width: 420px; width: 100%; }
    .mm-logo {
      font-size: 4rem; margin-bottom: 0.5rem;
      filter: drop-shadow(0 0 20px #00f5ff);
      animation: mmFloat 3s ease-in-out infinite;
    }
    @keyframes mmFloat {
      0%,100% { transform: translateY(0); }
      50%     { transform: translateY(-10px); }
    }
    .mm-heading {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(1.4rem, 4vw, 2.1rem); font-weight: 900;
      color: #00f5ff;
      text-shadow: 0 0 20px rgba(0,245,255,0.6), 0 0 40px rgba(0,245,255,0.2);
      margin-bottom: 0.3rem; letter-spacing: 2px;
    }
    .mm-sub {
      color: rgba(255,255,255,0.4); font-size: 0.88rem;
      margin-bottom: 1.75rem; letter-spacing: 1px;
    }
    .mm-level-btns { display: flex; flex-direction: column; gap: 0.75rem; }
    .mm-level-btn {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 1.4rem;
      background: linear-gradient(135deg, rgba(0,245,255,0.05), rgba(0,100,200,0.08));
      border: 1px solid rgba(0,245,255,0.2);
      border-radius: 12px; color: #e0e0ff;
      font-family: 'Rajdhani', sans-serif; font-size: 1rem; font-weight: 600;
      transition: all 0.2s; cursor: pointer; position: relative; overflow: hidden;
    }
    .mm-level-btn::before {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(135deg, rgba(0,245,255,0.07), transparent);
      opacity: 0; transition: opacity 0.2s;
    }
    .mm-level-btn:hover::before { opacity: 1; }
    .mm-level-btn:hover {
      border-color: rgba(0,245,255,0.55); transform: translateX(5px);
      box-shadow: 0 0 20px rgba(0,245,255,0.12);
    }
    .mm-lvl-name {
      font-family: 'Orbitron', sans-serif; font-size: 0.88rem;
      color: #00f5ff; letter-spacing: 1px;
    }
    .mm-lvl-detail { font-size: 0.78rem; color: rgba(255,255,255,0.4); }

    /* ── Game Layout ── */
    .mm-game {
      width: 100%; max-width: 600px;
      display: flex; flex-direction: column; gap: 0.6rem;
    }

    /* ── HUD ── */
    .mm-hud {
      display: flex;
      background: rgba(10,10,30,0.9);
      border: 1px solid rgba(0,245,255,0.18);
      border-radius: 12px; overflow: hidden;
    }
    .mm-hud-item {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      padding: 0.55rem 0.4rem;
      border-right: 1px solid rgba(0,245,255,0.1);
    }
    .mm-hud-item:last-child { border-right: none; }
    .mm-hud-label {
      font-size: 0.58rem; color: rgba(255,255,255,0.35);
      letter-spacing: 2px; text-transform: uppercase; margin-bottom: 2px;
    }
    .mm-hud-val {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(0.82rem, 2.2vw, 1rem); font-weight: 700; color: #00f5ff;
    }
    .mm-timer { transition: color 0.3s; }

    /* ── Progress Bar ── */
    .mm-progress-wrap {
      height: 3px; background: rgba(0,245,255,0.08);
      border-radius: 2px; overflow: hidden;
    }
    .mm-progress-bar {
      height: 100%; background: #00f5ff; border-radius: 2px;
      transition: width 1s linear, background 0.3s, box-shadow 0.3s;
      box-shadow: 0 0 8px #00f5ff;
    }

    /* ── Card Grid ── */
    .mm-grid {
      display: grid;
      grid-template-columns: repeat(var(--cols, 4), 1fr);
      gap: clamp(5px, 1.4vw, 10px);
      width: 100%;
    }

    /* ── Card 3D flip ── */
    .mm-card {
      aspect-ratio: 3/4; cursor: pointer;
      perspective: 800px;
      user-select: none; -webkit-user-select: none;
    }
    .mm-card-inner {
      width: 100%; height: 100%; position: relative;
      transform-style: preserve-3d;
      transition: transform 0.5s cubic-bezier(0.4,0,0.2,1);
      border-radius: 10px;
    }
    .mm-card.flipped .mm-card-inner,
    .mm-card.matched .mm-card-inner { transform: rotateY(180deg); }

    /* ── Shared face rules ── */
    .mm-card-front,
    .mm-card-back {
      position: absolute; inset: 0; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      backface-visibility: hidden; -webkit-backface-visibility: hidden;
    }

    /* ── Card FRONT (face-down) — base ── */
    .mm-card-front {
      background-size: cover; background-position: center;
      background-color: #0a1025;        /* fallback colour */
      border: 2px solid transparent;
      box-shadow: 0 6px 20px rgba(0,0,0,0.7);
      overflow: hidden;
    }
    /* Subtle inner glow overlay (sits on top of the image) */
    .mm-card-front::before {
      content: '';
      position: absolute; inset: 0; border-radius: 10px;
      background: radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.06) 0%, transparent 65%);
      pointer-events: none;
    }

    /* ─── PURPLE theme (Easy) ─────────────────────── */
    [data-theme="purple"] .mm-card-front {
      background-image: url('./assets/card-back-purple.png');
      border-color: rgba(168,85,247,0.55);
      box-shadow:
        0 0 0 1px rgba(168,85,247,0.1),
        inset 0 0 30px rgba(139,92,246,0.15),
        0 6px 20px rgba(0,0,0,0.7);
    }
    [data-theme="purple"] .mm-card:hover:not(.matched):not(.flipped) .mm-card-front {
      border-color: rgba(192,132,252,0.9);
      box-shadow: 0 0 22px rgba(168,85,247,0.4), 0 6px 22px rgba(0,0,0,0.7);
      transform: scale(1.04); transition: all 0.15s;
    }
    [data-theme="purple"] .mm-card-back {
      background: linear-gradient(145deg, #1a0a2e 0%, #120820 50%, #1e0d35 100%);
      border: 2px solid rgba(168,85,247,0.45);
      box-shadow: inset 0 0 25px rgba(139,92,246,0.2), 0 4px 16px rgba(0,0,0,0.6);
    }
    [data-theme="purple"] .mm-card-back::before {
      background: radial-gradient(ellipse at 50% 45%,
        rgba(168,85,247,0.22) 0%, rgba(109,40,217,0.1) 45%, transparent 70%);
    }
    [data-theme="purple"] .mm-card.matched .mm-card-back {
      background: linear-gradient(145deg, #2a0a4a 0%, #1e0838 100%);
      border-color: rgba(192,132,252,0.75);
      box-shadow: 0 0 22px rgba(168,85,247,0.5), inset 0 0 28px rgba(139,92,246,0.2);
      animation: mmMatchPulse 0.55s ease forwards;
    }
    @keyframes mmMatchPulsePurple {
      0%   { box-shadow: 0 0 0 0    rgba(168,85,247,0.7); }
      50%  { box-shadow: 0 0 0 14px rgba(168,85,247,0);   }
      100% { box-shadow: 0 0 22px   rgba(168,85,247,0.5); }
    }

    /* ─── BLUE theme (Medium) ─────────────────────── */
    [data-theme="blue"] .mm-card-front {
      background-image: url('./assets/card-back-metallic-blue.png');
      border-color: rgba(0,180,255,0.55);
      box-shadow:
        0 0 0 1px rgba(0,245,255,0.08),
        inset 0 0 30px rgba(0,100,200,0.2),
        0 6px 20px rgba(0,0,0,0.7);
    }
    [data-theme="blue"] .mm-card:hover:not(.matched):not(.flipped) .mm-card-front {
      border-color: rgba(0,245,255,0.9);
      box-shadow: 0 0 22px rgba(0,245,255,0.35), 0 6px 22px rgba(0,0,0,0.7);
      transform: scale(1.04); transition: all 0.15s;
    }
    [data-theme="blue"] .mm-card-back {
      background: linear-gradient(145deg, #0a1428 0%, #071020 50%, #0d1830 100%);
      border: 2px solid rgba(0,200,255,0.4);
      box-shadow: inset 0 0 25px rgba(0,100,200,0.2), 0 4px 16px rgba(0,0,0,0.6);
    }
    [data-theme="blue"] .mm-card-back::before {
      background: radial-gradient(ellipse at 50% 45%,
        rgba(0,245,255,0.16) 0%, rgba(0,100,200,0.08) 45%, transparent 70%);
    }
    [data-theme="blue"] .mm-card.matched .mm-card-back {
      background: linear-gradient(145deg, #071830 0%, #041220 100%);
      border-color: rgba(0,230,255,0.75);
      box-shadow: 0 0 22px rgba(0,200,255,0.5), inset 0 0 28px rgba(0,150,255,0.15);
      animation: mmMatchPulseBlue 0.55s ease forwards;
    }
    @keyframes mmMatchPulseBlue {
      0%   { box-shadow: 0 0 0 0    rgba(0,200,255,0.7); }
      50%  { box-shadow: 0 0 0 14px rgba(0,200,255,0);   }
      100% { box-shadow: 0 0 22px   rgba(0,200,255,0.5); }
    }

    /* ─── FIRE theme (Hard) ──────────────────────── */
    [data-theme="fire"] .mm-card-front {
      background-image: url('./assets/card-back-fire-red.png');
      border-color: rgba(255,100,30,0.6);
      box-shadow:
        0 0 0 1px rgba(255,80,0,0.1),
        inset 0 0 30px rgba(200,60,0,0.2),
        0 6px 20px rgba(0,0,0,0.7);
    }
    [data-theme="fire"] .mm-card:hover:not(.matched):not(.flipped) .mm-card-front {
      border-color: rgba(255,140,40,0.95);
      box-shadow: 0 0 22px rgba(255,100,20,0.45), 0 6px 22px rgba(0,0,0,0.7);
      transform: scale(1.04); transition: all 0.15s;
    }
    [data-theme="fire"] .mm-card-back {
      background: linear-gradient(145deg, #2a0d04 0%, #1e0802 50%, #2e0f05 100%);
      border: 2px solid rgba(255,100,30,0.45);
      box-shadow: inset 0 0 25px rgba(200,60,0,0.2), 0 4px 16px rgba(0,0,0,0.6);
    }
    [data-theme="fire"] .mm-card-back::before {
      background: radial-gradient(ellipse at 50% 45%,
        rgba(255,120,30,0.22) 0%, rgba(180,60,0,0.1) 45%, transparent 70%);
    }
    [data-theme="fire"] .mm-card.matched .mm-card-back {
      background: linear-gradient(145deg, #3a1004 0%, #280a02 100%);
      border-color: rgba(255,160,40,0.8);
      box-shadow: 0 0 24px rgba(255,100,20,0.55), inset 0 0 28px rgba(200,80,0,0.2);
      animation: mmMatchPulseFire 0.55s ease forwards;
    }
    @keyframes mmMatchPulseFire {
      0%   { box-shadow: 0 0 0 0    rgba(255,120,30,0.7); }
      50%  { box-shadow: 0 0 0 14px rgba(255,120,30,0);   }
      100% { box-shadow: 0 0 24px   rgba(255,100,20,0.55); }
    }

    /* ── Card BACK common — emoji font ── */
    .mm-card-back {
      transform: rotateY(180deg);
      font-size: clamp(1.8rem, 5vw, 2.8rem);
      overflow: hidden;
    }
    /* Pseudo-element shared base (theme overrides add their gradient) */
    .mm-card-back::before {
      content: '';
      position: absolute; inset: 0; border-radius: 10px;
      pointer-events: none;
    }

    /* ── Shake (mismatch) ── */
    .mm-card.shake { animation: mmShake 0.42s ease; }
    @keyframes mmShake {
      0%,100% { transform: translateX(0);   }
      20%     { transform: translateX(-7px); }
      40%     { transform: translateX( 7px); }
      60%     { transform: translateX(-4px); }
      80%     { transform: translateX( 4px); }
    }

    /* ── Mobile ── */
    @media (max-width: 600px) {
      .mm-wrap { padding: 0.4rem; align-items: flex-start; }
      .mm-game { gap: 0.4rem; }
      .mm-grid { gap: 4px; }
      .mm-card-front, .mm-card-back { border-radius: 7px; }
      .mm-card-back { font-size: 1.3rem; }
    }
  `;
  document.head.appendChild(style);

  return { start, destroy };

})();