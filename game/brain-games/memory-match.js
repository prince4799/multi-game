/* ================================================
   MEMORY MATCH
   Flip cards and find all matching pairs!
   Category: Brain Train
   Controls: Mouse click (desktop) | Tap (mobile)
   ================================================ */

const MemoryMatch = (() => {

  /* ---------- GAME CONFIG ---------- */
  const LEVELS = [
    { name: 'Easy',   pairs: 6,  cols: 4, time: 60  },
    { name: 'Medium', pairs: 8,  cols: 4, time: 90  },
    { name: 'Hard',   pairs: 10, cols: 5, time: 120 }
  ];

  const EMOJIS = [
    '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼',
    '🐨','🐯','🦁','🐮','🐷','🐸','🐵','🦋',
    '🌸','⭐','🎮','🏆','🎯','🎪','🎨','🎭',
    '🍎','🍊','🍋','🍇','🍓','🎂'
  ];

  /* ---------- STATE ---------- */
  let container    = null;
  let cards        = [];
  let flipped      = [];
  let matched      = [];
  let score        = 0;
  let moves        = 0;
  let timeLeft     = 0;
  let timerInterval = null;
  let isLocked     = false;
  let currentLevel = 0;
  let isRunning    = false;
  let gameEl       = null;

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
    container = cont;
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

    // Bind level buttons
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

    const level   = LEVELS[levelIdx];
    timeLeft      = level.time;
    const pairs   = level.pairs;
    const cols    = level.cols;

    // Build shuffled card deck
    const emojiSet = EMOJIS.slice(0, pairs);
    const deck     = [...emojiSet, ...emojiSet];
    shuffleArray(deck);

    cards = deck.map((emoji, i) => ({
      id: i, emoji, isFlipped: false, isMatched: false
    }));

    // Build UI
    gameEl = document.createElement('div');
    gameEl.className = 'mm-wrap';
    gameEl.innerHTML = `
      <div class="mm-game">

        <!-- HUD -->
        <div class="mm-hud">
          <div class="mm-hud-item">
            <span class="mm-hud-label">Score</span>
            <span class="mm-hud-val" id="mm-score">0</span>
          </div>
          <div class="mm-hud-item mm-timer-wrap">
            <span class="mm-hud-label">Time</span>
            <span class="mm-hud-val mm-timer" id="mm-timer">${timeLeft}</span>
          </div>
          <div class="mm-hud-item">
            <span class="mm-hud-label">Moves</span>
            <span class="mm-hud-val" id="mm-moves">0</span>
          </div>
          <div class="mm-hud-item">
            <span class="mm-hud-label">Pairs</span>
            <span class="mm-hud-val">
              <span id="mm-matched">0</span>/${pairs}
            </span>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="mm-progress-wrap">
          <div class="mm-progress-bar" id="mm-progress" style="width:100%"></div>
        </div>

        <!-- Card Grid -->
        <div class="mm-grid"
          id="mm-grid"
          style="--cols:${cols}">
        </div>

      </div>`;

    container.appendChild(gameEl);

    // Render cards
    const grid = gameEl.querySelector('#mm-grid');
    cards.forEach(card => {
      const el = createCardEl(card);
      grid.appendChild(el);
    });

    // Start timer
    startTimer(level.time, pairs);

    // Brief peek - show all cards then flip back
    peekCards();
  }

  /* ================================================
     PEEK: Show all cards briefly at start
  ================================================ */
  function peekCards() {
    isLocked = true;

    // Flip all cards face up
    document.querySelectorAll('.mm-card').forEach(el => {
      el.classList.add('flipped');
    });

    // Flip back after 1.5 seconds
    setTimeout(() => {
      document.querySelectorAll('.mm-card').forEach(el => {
        el.classList.remove('flipped');
      });
      isLocked = false;
    }, 1500);
  }

  /* ================================================
     CREATE CARD ELEMENT
  ================================================ */
  function createCardEl(card) {
    const el = document.createElement('div');
    el.className = 'mm-card';
    el.dataset.id = card.id;
    el.innerHTML = `
      <div class="mm-card-inner">
        <div class="mm-card-front">❓</div>
        <div class="mm-card-back">${card.emoji}</div>
      </div>`;

    el.addEventListener('click',     () => handleCardClick(card.id));
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
    if (!isRunning) return;
    if (isLocked)   return;

    const card = cards[cardId];
    if (!card)             return;
    if (card.isFlipped)    return;
    if (card.isMatched)    return;
    if (flipped.length >= 2) return;

    // Flip card
    card.isFlipped = true;
    flipped.push(card);
    SoundManager.cardFlip();

    // Update DOM
    const el = gameEl.querySelector(`[data-id="${cardId}"]`);
    if (el) el.classList.add('flipped');

    // Check for match when 2 cards are flipped
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
      // MATCH!
      a.isMatched = b.isMatched = true;
      matched.push(a.id, b.id);

      // Score based on time left + moves
      const points = Math.max(10, 50 - moves + Math.floor(timeLeft / 5));
      score += points;

      SoundManager.cardMatch();

      // Mark matched in DOM
      [a.id, b.id].forEach(id => {
        const el = gameEl.querySelector(`[data-id="${id}"]`);
        if (el) el.classList.add('matched');
      });

      updateHUD();

      // Check if all matched
      const level = LEVELS[currentLevel];
      if (matched.length === level.pairs * 2) {
        setTimeout(() => endGame(true), 500);
      }

    } else {
      // NO MATCH
      SoundManager.cardMismatch();

      // Flip back
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
  function startTimer(seconds, totalPairs) {
    clearInterval(timerInterval);
    timeLeft = seconds;

    timerInterval = setInterval(() => {
      if (!isRunning) return;
      timeLeft--;

      // Update timer display
      const timerEl = gameEl?.querySelector('#mm-timer');
      if (timerEl) {
        timerEl.textContent = timeLeft;
        timerEl.style.color = timeLeft <= 10
          ? 'var(--accent)'
          : 'var(--primary)';
      }

      // Update progress bar
      const bar = gameEl?.querySelector('#mm-progress');
      if (bar) {
        const pct = (timeLeft / seconds) * 100;
        bar.style.width = pct + '%';
        bar.style.background = timeLeft <= 10
          ? 'var(--accent)'
          : 'var(--primary)';
      }

      // Warning beeps in last 10 seconds
      if (timeLeft <= 10 && timeLeft > 0) {
        SoundManager.timerWarning();
      }

      // Time up!
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        endGame(false);
      }
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

    // Update app header score
    App.updateScoreDisplay(score, ScoreManager.getBestScore('memory-match'));
  }

  /* ================================================
     END GAME
  ================================================ */
  function endGame(won) {
    isRunning = false;
    clearInterval(timerInterval);

    // Bonus points for time left if won
    if (won) {
      score += timeLeft * 2;
      updateHUD();
    }

    setTimeout(() => {
      App.showGameResult(score, won);
    }, won ? 800 : 400);
  }

  /* ================================================
     CLEANUP
  ================================================ */
  function cleanup() {
    clearInterval(timerInterval);
    isRunning = false;
    if (gameEl && gameEl.parentNode) {
      gameEl.parentNode.removeChild(gameEl);
    }
    gameEl = null;
  }

  function destroy() {
    cleanup();
  }

  /* ================================================
     UTILS
  ================================================ */
  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ================================================
     INJECT STYLES
  ================================================ */
  const style = document.createElement('style');
  style.textContent = `

    /* Wrapper */
    .mm-wrap {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      overflow-y: auto;
    }

    /* Level Select */
    .mm-level-select {
      text-align: center;
      max-width: 400px;
      width: 100%;
    }
    .mm-logo {
      font-size: 4rem;
      margin-bottom: 0.5rem;
      filter: drop-shadow(0 0 15px var(--primary));
      animation: floatOrb 3s ease-in-out infinite;
    }
    .mm-heading {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(1.3rem,4vw,2rem);
      font-weight: 900;
      color: var(--primary);
      text-shadow: var(--glow);
      margin-bottom: 0.5rem;
    }
    .mm-sub {
      color: var(--text2);
      font-size: 0.9rem;
      margin-bottom: 1.5rem;
    }
    .mm-level-btns {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .mm-level-btn {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      background: var(--bg3);
      border: 1px solid var(--border);
      border-radius: 12px;
      color: var(--text);
      font-family: 'Rajdhani', sans-serif;
      font-size: 1rem;
      font-weight: 600;
      transition: all 0.2s;
    }
    .mm-level-btn:hover {
      border-color: var(--border2);
      background: var(--primary-dim);
      color: var(--primary);
      transform: translateX(4px);
      box-shadow: var(--glow);
    }
    .mm-lvl-name {
      font-family: 'Orbitron', sans-serif;
      font-size: 0.9rem;
    }
    .mm-lvl-detail {
      font-size: 0.8rem;
      color: var(--text2);
    }

    /* Game Layout */
    .mm-game {
      width: 100%;
      max-width: 620px;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    /* HUD */
    .mm-hud {
      display: flex;
      gap: 0;
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    .mm-hud-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.6rem 0.5rem;
      border-right: 1px solid var(--border);
    }
    .mm-hud-item:last-child { border-right: none; }
    .mm-hud-label {
      font-size: 0.62rem;
      color: var(--text3);
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .mm-hud-val {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(0.85rem,2.5vw,1.1rem);
      font-weight: 700;
      color: var(--primary);
    }
    .mm-timer {
      transition: color 0.3s;
    }

    /* Progress Bar */
    .mm-progress-wrap {
      height: 4px;
      background: var(--bg2);
      border-radius: 2px;
      overflow: hidden;
    }
    .mm-progress-bar {
      height: 100%;
      background: var(--primary);
      border-radius: 2px;
      transition: width 1s linear, background 0.3s;
      box-shadow: var(--glow);
    }

    /* Card Grid */
    .mm-grid {
      display: grid;
      grid-template-columns: repeat(var(--cols), 1fr);
      gap: clamp(6px,1.5vw,12px);
      width: 100%;
    }

    /* Card */
    .mm-card {
      aspect-ratio: 3/4;
      cursor: pointer;
      perspective: 600px;
      user-select: none;
      -webkit-user-select: none;
    }
    .mm-card-inner {
      width: 100%;
      height: 100%;
      position: relative;
      transform-style: preserve-3d;
      transition: transform 0.45s cubic-bezier(0.4,0,0.2,1);
      border-radius: 10px;
    }
    .mm-card.flipped .mm-card-inner,
    .mm-card.matched .mm-card-inner {
      transform: rotateY(180deg);
    }
    .mm-card-front,
    .mm-card-back {
      position: absolute;
      inset: 0;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      font-size: clamp(1.2rem,3.5vw,2rem);
      border: 2px solid var(--border);
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .mm-card-front {
      background: var(--bg3);
      background-image: repeating-linear-gradient(
        45deg,
        var(--primary-dim) 0px,
        var(--primary-dim) 2px,
        transparent 2px,
        transparent 10px
      );
    }
    .mm-card-back {
      background: var(--bg2);
      transform: rotateY(180deg);
    }
    .mm-card:hover:not(.matched) .mm-card-front {
      border-color: var(--border2);
      box-shadow: var(--glow);
    }
    .mm-card.matched .mm-card-back {
      background: var(--primary-dim);
      border-color: var(--border2);
      box-shadow: var(--glow);
    }
    .mm-card.shake {
      animation: mmShake 0.4s ease;
    }

    @keyframes mmShake {
      0%,100% { transform: translateX(0); }
      20%     { transform: translateX(-6px); }
      40%     { transform: translateX(6px); }
      60%     { transform: translateX(-4px); }
      80%     { transform: translateX(4px); }
    }

    /* Mobile adjustments */
    @media (max-width: 600px) {
      .mm-wrap { padding: 0.5rem; align-items: flex-start; }
      .mm-game { gap: 0.5rem; }
      .mm-grid { gap: 5px; }
      .mm-card-front, .mm-card-back { font-size: 1.2rem; border-radius: 7px; }
    }
  `;
  document.head.appendChild(style);

  return { start, destroy };

})();