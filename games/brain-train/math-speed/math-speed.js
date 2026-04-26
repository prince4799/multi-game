/* ================================================
   MATH SPEED
   Solve math problems as fast as you can!
   Category: Brain Train
   Controls: Type answer + Enter (desktop)
             On-screen numpad (mobile/tablet)
   ================================================ */

const MathSpeed = (() => {

  /* ---------- CONFIG ---------- */
  const LEVELS = [
    {
      name: 'Easy',
      ops: ['+', '-'],
      maxNum: 10,
      questions: 10,
      timePerQ: 8,
      pointsBase: 100
    },
    {
      name: 'Medium',
      ops: ['+', '-', '*'],
      maxNum: 20,
      questions: 15,
      timePerQ: 10,
      pointsBase: 150
    },
    {
      name: 'Hard',
      ops: ['+', '-', '*', '/'],
      maxNum: 50,
      questions: 20,
      timePerQ: 12,
      pointsBase: 200
    }
  ];

  /* ---------- STATE ---------- */
  let container      = null;
  let gameEl         = null;
  let currentLevel   = 0;
  let score          = 0;
  let currentQ       = 0;
  let totalQ         = 0;
  let correctAnswers = 0;
  let wrongAnswers   = 0;
  let timeLeft       = 0;
  let timerInterval  = null;
  let question       = null;
  let isRunning      = false;
  let userAnswer     = '';

  /* ================================================
     REGISTER
  ================================================ */
  GameRegistry.register({
    id:          'math-speed',
    title:       'Math Speed',
    category:    'brain-train',
    description: 'Solve math equations as fast as you can! Race against the clock!',
    emoji:       '🧮',
    difficulty:  'medium',
    controls:    { dpad: false, actions: false, center: false },
    init:        (c) => MathSpeed.start(c),
    destroy:     () => MathSpeed.destroy()
  });

  /* ================================================
     START
  ================================================ */
  function start(cont) {
    container    = cont;
    currentLevel = 0;
    showLevelSelect();
  }

  /* ================================================
     LEVEL SELECT
  ================================================ */
  function showLevelSelect() {
    cleanup();

    gameEl = document.createElement('div');
    gameEl.className = 'ms-wrap';
    gameEl.innerHTML = `
      <div class="ms-level-select">
        <div class="ms-logo">🧮</div>
        <h2 class="ms-heading">Math Speed</h2>
        <p class="ms-sub">How fast can you calculate?</p>
        <div class="ms-level-btns">
          ${LEVELS.map((lvl, i) => `
            <button class="ms-level-btn" data-level="${i}">
              <div class="ms-lvl-left">
                <span class="ms-lvl-name">${lvl.name}</span>
                <span class="ms-lvl-ops">Ops: ${lvl.ops.join(' ')}</span>
              </div>
              <div class="ms-lvl-right">
                <span>${lvl.questions} Questions</span>
                <span>${lvl.timePerQ}s each</span>
              </div>
            </button>
          `).join('')}
        </div>
      </div>`;

    container.appendChild(gameEl);

    gameEl.querySelectorAll('.ms-level-btn').forEach(btn => {
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
    isRunning      = true;
    score          = 0;
    currentQ       = 0;
    correctAnswers = 0;
    wrongAnswers   = 0;
    userAnswer     = '';

    const level = LEVELS[levelIdx];
    totalQ      = level.questions;

    gameEl = document.createElement('div');
    gameEl.className = 'ms-wrap';
    gameEl.innerHTML = `
      <div class="ms-game">

        <!-- HUD -->
        <div class="ms-hud">
          <div class="ms-hud-item">
            <span class="ms-hud-label">Score</span>
            <span class="ms-hud-val" id="ms-score">0</span>
          </div>
          <div class="ms-hud-item">
            <span class="ms-hud-label">Question</span>
            <span class="ms-hud-val">
              <span id="ms-qnum">1</span>/${totalQ}
            </span>
          </div>
          <div class="ms-hud-item">
            <span class="ms-hud-label">✅ Correct</span>
            <span class="ms-hud-val ms-correct" id="ms-correct">0</span>
          </div>
          <div class="ms-hud-item">
            <span class="ms-hud-label">❌ Wrong</span>
            <span class="ms-hud-val ms-wrong" id="ms-wrong">0</span>
          </div>
        </div>

        <!-- Timer Bar -->
        <div class="ms-timer-wrap">
          <div class="ms-timer-bar" id="ms-timer-bar"></div>
        </div>

        <!-- Question Display -->
        <div class="ms-question-area">
          <div class="ms-question" id="ms-question">?</div>
          <div class="ms-equals">=</div>
          <div class="ms-answer-display" id="ms-answer-display">
            <span id="ms-answer-text">_</span>
            <span class="ms-cursor">|</span>
          </div>
        </div>

        <!-- Feedback -->
        <div class="ms-feedback" id="ms-feedback"></div>

        <!-- Numpad (always shown, keyboard also works on desktop) -->
        <div class="ms-numpad" id="ms-numpad">
          <div class="ms-numpad-grid">
            ${[7,8,9,4,5,6,1,2,3].map(n => `
              <button class="ms-num-btn" data-num="${n}">${n}</button>
            `).join('')}
            <button class="ms-num-btn ms-neg-btn" data-num="neg">±</button>
            <button class="ms-num-btn" data-num="0">0</button>
            <button class="ms-num-btn ms-del-btn" data-num="del">⌫</button>
          </div>
          <button class="ms-submit-btn" id="ms-submit-btn">
            <i class="fas fa-check"></i> Submit
          </button>
        </div>

      </div>`;

    container.appendChild(gameEl);

    // Bind numpad
    bindNumpad();

    // Next question
    nextQuestion();
  }

  /* ================================================
     BIND NUMPAD + KEYBOARD
  ================================================ */
  function bindNumpad() {
    // Numpad buttons
    gameEl.querySelectorAll('.ms-num-btn').forEach(btn => {
      const handler = () => {
        if (!isRunning) return;
        const val = btn.dataset.num;
        SoundManager.buttonPress();
        handleInput(val);
      };
      btn.addEventListener('click', handler);
      btn.addEventListener('touchstart', e => {
        e.preventDefault();
        handler();
      }, { passive: false });
    });

    // Submit button
    const submitBtn = gameEl.querySelector('#ms-submit-btn');
    if (submitBtn) {
      const handler = () => {
        if (!isRunning) return;
        SoundManager.buttonPress();
        submitAnswer();
      };
      submitBtn.addEventListener('click', handler);
      submitBtn.addEventListener('touchstart', e => {
        e.preventDefault();
        handler();
      }, { passive: false });
    }

    // Keyboard support for desktop
    ControlManager.on('keydown', 'math-speed', key => {
      if (!isRunning) return;
      if (key >= '0' && key <= '9') handleInput(key);
      else if (key === 'Backspace')  handleInput('del');
      else if (key === '-')          handleInput('neg');
      else if (key === 'Enter' || key === ' ') submitAnswer();
    });
  }

  /* ================================================
     HANDLE INPUT
  ================================================ */
  function handleInput(val) {
    if (val === 'del') {
      userAnswer = userAnswer.slice(0, -1);
    } else if (val === 'neg') {
      // Toggle negative
      if (userAnswer.startsWith('-')) {
        userAnswer = userAnswer.slice(1);
      } else if (userAnswer.length > 0) {
        userAnswer = '-' + userAnswer;
      } else {
        userAnswer = '-';
      }
    } else {
      if (userAnswer.length < 6) {
        userAnswer += val;
      }
    }
    updateAnswerDisplay();
  }

  function updateAnswerDisplay() {
    const el = gameEl?.querySelector('#ms-answer-text');
    if (el) el.textContent = userAnswer || '_';
  }

  /* ================================================
     GENERATE QUESTION
  ================================================ */
  function generateQuestion(level) {
    const ops   = level.ops;
    const max   = level.maxNum;
    const op    = ops[Math.floor(Math.random() * ops.length)];

    let a, b, answer;

    switch (op) {
      case '+':
        a = randInt(1, max);
        b = randInt(1, max);
        answer = a + b;
        break;
      case '-':
        a = randInt(1, max);
        b = randInt(1, a); // ensure positive result
        answer = a - b;
        break;
      case '*':
        a = randInt(1, Math.min(max, 12));
        b = randInt(1, Math.min(max, 12));
        answer = a * b;
        break;
      case '/':
        b      = randInt(2, Math.min(max, 12));
        answer = randInt(1, Math.min(max, 10));
        a      = b * answer; // ensure clean division
        break;
    }

    return {
      text:   `${a} ${opSymbol(op)} ${b}`,
      answer: answer,
      op:     op
    };
  }

  function opSymbol(op) {
    return op === '*' ? '×' : op === '/' ? '÷' : op;
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /* ================================================
     NEXT QUESTION
  ================================================ */
  function nextQuestion() {
    if (!isRunning) return;

    currentQ++;
    userAnswer = '';
    updateAnswerDisplay();

    const level = LEVELS[currentLevel];

    // All questions done
    if (currentQ > totalQ) {
      endGame();
      return;
    }

    // Generate question
    question = generateQuestion(level);

    // Update UI
    const qEl   = gameEl?.querySelector('#ms-question');
    const qNum  = gameEl?.querySelector('#ms-qnum');
    const fbEl  = gameEl?.querySelector('#ms-feedback');

    if (qEl)  {
      qEl.textContent = question.text;
      qEl.classList.remove('ms-q-anim');
      void qEl.offsetWidth; // reflow
      qEl.classList.add('ms-q-anim');
    }
    if (qNum) qNum.textContent = currentQ;
    if (fbEl) {
      fbEl.textContent = '';
      fbEl.className   = 'ms-feedback';
    }

    // Start question timer
    startQuestionTimer(level.timePerQ);
  }

  /* ================================================
     QUESTION TIMER
  ================================================ */
  function startQuestionTimer(seconds) {
    clearInterval(timerInterval);
    timeLeft = seconds;

    const bar = gameEl?.querySelector('#ms-timer-bar');
    if (bar) {
      bar.style.transition = 'none';
      bar.style.width = '100%';
      bar.style.background = 'var(--primary)';
      void bar.offsetWidth;
      bar.style.transition = `width ${seconds}s linear`;
      bar.style.width = '0%';
    }

    timerInterval = setInterval(() => {
      if (!isRunning) return;
      timeLeft--;

      if (bar) {
        bar.style.background = timeLeft <= 3
          ? 'var(--accent)'
          : 'var(--primary)';
      }

      if (timeLeft <= 3 && timeLeft > 0) {
        SoundManager.timerWarning();
      }

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        handleTimeout();
      }
    }, 1000);
  }

  /* ================================================
     SUBMIT ANSWER
  ================================================ */
  function submitAnswer() {
    if (!isRunning || !question) return;
    if (!userAnswer || userAnswer === '-') return;

    clearInterval(timerInterval);
    const given   = parseInt(userAnswer, 10);
    const correct = question.answer;

    if (given === correct) {
      handleCorrect();
    } else {
      handleWrong(correct);
    }
  }

  function handleCorrect() {
    correctAnswers++;
    const level   = LEVELS[currentLevel];
    const bonus   = Math.max(0, timeLeft);
    const points  = level.pointsBase + bonus * 10;
    score        += points;

    SoundManager.correct();
    showFeedback(`✅ Correct! +${points}`, 'correct');
    updateHUD();

    setTimeout(() => nextQuestion(), 900);
  }

  function handleWrong(correctAnswer) {
    wrongAnswers++;
    SoundManager.wrong();
    showFeedback(`❌ Wrong! Answer: ${correctAnswer}`, 'wrong');
    updateHUD();

    // Shake question
    const qEl = gameEl?.querySelector('#ms-question');
    if (qEl) {
      qEl.classList.add('ms-shake');
      setTimeout(() => qEl.classList.remove('ms-shake'), 500);
    }

    setTimeout(() => nextQuestion(), 1200);
  }

  function handleTimeout() {
    wrongAnswers++;
    SoundManager.wrong();
    showFeedback(`⏰ Time up! Answer: ${question.answer}`, 'timeout');
    updateHUD();
    setTimeout(() => nextQuestion(), 1200);
  }

  /* ================================================
     FEEDBACK
  ================================================ */
  function showFeedback(msg, type) {
    const el = gameEl?.querySelector('#ms-feedback');
    if (!el) return;
    el.textContent  = msg;
    el.className    = `ms-feedback ms-fb-${type}`;
  }

  /* ================================================
     UPDATE HUD
  ================================================ */
  function updateHUD() {
    const scoreEl   = gameEl?.querySelector('#ms-score');
    const correctEl = gameEl?.querySelector('#ms-correct');
    const wrongEl   = gameEl?.querySelector('#ms-wrong');

    if (scoreEl)   scoreEl.textContent   = score;
    if (correctEl) correctEl.textContent = correctAnswers;
    if (wrongEl)   wrongEl.textContent   = wrongAnswers;

    App.updateScoreDisplay(score, ScoreManager.getBestScore('math-speed'));
  }

  /* ================================================
     END GAME
  ================================================ */
  function endGame() {
    isRunning = false;
    clearInterval(timerInterval);

    // Accuracy bonus
    const accuracy = Math.round((correctAnswers / totalQ) * 100);
    if (accuracy === 100) {
      score += 500;
      App.showToast('🌟 Perfect Score! +500 Bonus!', 'success');
    }

    setTimeout(() => {
      App.showGameResult(score, correctAnswers >= Math.ceil(totalQ / 2));
    }, 500);
  }

  /* ================================================
     CLEANUP
  ================================================ */
  function cleanup() {
    clearInterval(timerInterval);
    isRunning = false;
    ControlManager.off('keydown', 'math-speed');
    if (gameEl && gameEl.parentNode) {
      gameEl.parentNode.removeChild(gameEl);
    }
    gameEl = null;
  }

  function destroy() { cleanup(); }

  /* ================================================
     STYLES
  ================================================ */
  const style = document.createElement('style');
  style.textContent = `

    .ms-wrap {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      overflow-y: auto;
    }

    /* Level Select */
    .ms-level-select {
      text-align: center;
      max-width: 420px;
      width: 100%;
    }
    .ms-logo {
      font-size: 3.5rem;
      margin-bottom: 0.5rem;
      filter: drop-shadow(0 0 15px var(--primary));
      animation: floatOrb 3s ease-in-out infinite;
    }
    .ms-heading {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(1.3rem,4vw,2rem);
      font-weight: 900;
      color: var(--primary);
      text-shadow: var(--glow);
      margin-bottom: 0.5rem;
    }
    .ms-sub {
      color: var(--text2);
      font-size: 0.9rem;
      margin-bottom: 1.5rem;
    }
    .ms-level-btns {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .ms-level-btn {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      background: var(--bg3);
      border: 1px solid var(--border);
      border-radius: 12px;
      color: var(--text);
      font-family: 'Rajdhani', sans-serif;
      transition: all 0.2s;
    }
    .ms-level-btn:hover {
      border-color: var(--border2);
      background: var(--primary-dim);
      transform: translateX(4px);
      box-shadow: var(--glow);
    }
    .ms-lvl-left {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
    }
    .ms-lvl-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
      font-size: 0.78rem;
      color: var(--text2);
    }
    .ms-lvl-name {
      font-family: 'Orbitron', sans-serif;
      font-size: 0.9rem;
      color: var(--primary);
    }
    .ms-lvl-ops {
      font-size: 0.78rem;
      color: var(--text2);
      letter-spacing: 2px;
    }

    /* Game */
    .ms-game {
      width: 100%;
      max-width: 480px;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    /* HUD */
    .ms-hud {
      display: flex;
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    .ms-hud-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.6rem 0.25rem;
      border-right: 1px solid var(--border);
    }
    .ms-hud-item:last-child { border-right: none; }
    .ms-hud-label {
      font-size: 0.6rem;
      color: var(--text3);
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .ms-hud-val {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(0.8rem,2vw,1rem);
      font-weight: 700;
      color: var(--primary);
    }
    .ms-correct { color: #00e676 !important; }
    .ms-wrong   { color: #ff3232 !important; }

    /* Timer Bar */
    .ms-timer-wrap {
      height: 6px;
      background: var(--bg2);
      border-radius: 3px;
      overflow: hidden;
    }
    .ms-timer-bar {
      height: 100%;
      width: 100%;
      background: var(--primary);
      border-radius: 3px;
      box-shadow: var(--glow);
    }

    /* Question Area */
    .ms-question-area {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 1.5rem 1rem;
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: 16px;
      flex-wrap: wrap;
    }
    .ms-question {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(1.6rem,5vw,2.8rem);
      font-weight: 900;
      color: var(--text);
      letter-spacing: 2px;
      min-width: 120px;
      text-align: center;
    }
    .ms-q-anim {
      animation: msQPop 0.3s cubic-bezier(0.36,0.07,0.19,0.97);
    }
    .ms-equals {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(1.5rem,4vw,2.4rem);
      color: var(--text2);
    }
    .ms-answer-display {
      display: flex;
      align-items: center;
      gap: 2px;
      min-width: 100px;
      justify-content: center;
      padding: 0.5rem 1rem;
      background: var(--bg3);
      border: 2px solid var(--border2);
      border-radius: 10px;
    }
    #ms-answer-text {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(1.4rem,4vw,2.2rem);
      font-weight: 700;
      color: var(--primary);
      min-width: 40px;
      text-align: center;
    }
    .ms-cursor {
      font-size: 1.5rem;
      color: var(--primary);
      animation: msBlink 1s step-end infinite;
    }

    /* Feedback */
    .ms-feedback {
      text-align: center;
      font-size: 0.9rem;
      font-weight: 600;
      min-height: 24px;
      letter-spacing: 0.5px;
      transition: all 0.2s;
    }
    .ms-fb-correct { color: #00e676; }
    .ms-fb-wrong,
    .ms-fb-timeout { color: #ff3232; }

    /* Numpad */
    .ms-numpad { display: flex; flex-direction: column; gap: 8px; }
    .ms-numpad-grid {
      display: grid;
      grid-template-columns: repeat(3,1fr);
      gap: 8px;
    }
    .ms-num-btn {
      padding: 0.85rem;
      background: var(--bg3);
      border: 1px solid var(--border);
      border-radius: 10px;
      color: var(--text);
      font-family: 'Orbitron', sans-serif;
      font-size: 1.1rem;
      font-weight: 700;
      transition: all 0.1s;
      touch-action: manipulation;
    }
    .ms-num-btn:hover {
      background: var(--primary-dim);
      border-color: var(--border2);
      color: var(--primary);
    }
    .ms-num-btn:active {
      transform: scale(0.93);
      background: var(--primary-dim);
    }
    .ms-del-btn { color: var(--accent); }
    .ms-neg-btn { color: var(--secondary); }

    .ms-submit-btn {
      width: 100%;
      padding: 0.9rem;
      background: var(--btn-bg);
      color: var(--btn-text);
      border: none;
      border-radius: 10px;
      font-family: 'Orbitron', sans-serif;
      font-size: 0.9rem;
      font-weight: 700;
      letter-spacing: 1px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
      box-shadow: var(--glow);
      touch-action: manipulation;
    }
    .ms-submit-btn:hover {
      transform: translateY(-2px);
      box-shadow: var(--glow2);
    }
    .ms-submit-btn:active { transform: scale(0.97); }

    .ms-shake {
      animation: mmShake 0.4s ease;
    }

    @keyframes msQPop {
      0%   { transform: scale(0.8); opacity: 0.5; }
      60%  { transform: scale(1.08); }
      100% { transform: scale(1);   opacity: 1; }
    }
    @keyframes msBlink {
      0%, 100% { opacity: 1; }
      50%      { opacity: 0; }
    }

    /* Mobile */
    @media (max-width: 600px) {
      .ms-wrap { padding: 0.5rem; align-items: flex-start; }
      .ms-game { gap: 0.5rem; }
      .ms-question-area { padding: 1rem 0.5rem; gap: 0.5rem; }
      .ms-num-btn { padding: 0.7rem; font-size: 1rem; }
    }
  `;
  document.head.appendChild(style);

  return { start, destroy };

})();