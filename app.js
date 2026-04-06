/* ================================================
   APP.JS - Main Application Controller
   FIXED VERSION
   ================================================ */

const App = (() => {

  /* ---------- STATE ---------- */
  let currentPage   = 'home';
  let currentGame   = null;
  let currentFilter = 'all';
  let searchQuery   = '';

  /* ================================================
     INIT
  ================================================ */
  function init() {
    simulateLoading(() => {
      ThemeManager.load();
      SoundManager.init();
      ControlManager.init();
      AdManager.init();

      renderAllGrids();
      updateStats();
      bindEvents();
      showApp();
    });
  }

  /* ================================================
     LOADING SIMULATION
  ================================================ */
  function simulateLoading(onComplete) {
    const bar  = document.getElementById('loading-bar');
    const text = document.getElementById('loading-text');

    const steps = [
      { pct: 20,  msg: 'Loading core systems...'  },
      { pct: 45,  msg: 'Building game library...' },
      { pct: 70,  msg: 'Preparing themes...'      },
      { pct: 90,  msg: 'Almost ready...'          },
      { pct: 100, msg: "Let's play!"              }
    ];

    let i = 0;
    const tick = () => {
      if (i >= steps.length) {
        setTimeout(() => {
          const screen = document.getElementById('loading-screen');
          if (screen) {
            screen.classList.add('fade-out');
            setTimeout(onComplete, 600);
          } else {
            onComplete();
          }
        }, 300);
        return;
      }
      const step = steps[i++];
      if (bar)  bar.style.width  = step.pct + '%';
      if (text) text.textContent = step.msg;
      setTimeout(tick, 350);
    };
    tick();
  }

  /* ================================================
     SHOW APP
  ================================================ */
  function showApp() {
    const app = document.getElementById('app');
    if (app) {
      app.classList.remove('hidden');
    }
  }

  /* ================================================
     NAVIGATION
  ================================================ */
  function navigateTo(page) {
    SoundManager.navigate();

    /* hide all pages */
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    /* show target page */
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');

    /* update nav links */
    document.querySelectorAll('.nav-link, .mobile-link').forEach(link => {
      link.classList.toggle('active', link.dataset.page === page);
    });

    closeMobileNav();
    currentPage = page;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeMobileNav() {
    const nav  = document.getElementById('mobile-nav');
    const icon = document.getElementById('hamburger-icon');
    if (nav)  nav.classList.remove('open');
    if (icon) {
      icon.classList.remove('fa-times');
      icon.classList.add('fa-bars');
    }
  }

  /* ================================================
     RENDER GAME GRIDS
  ================================================ */
  function renderAllGrids() {
    renderGrid('home-games-grid',  GameRegistry.getAll());
    renderGrid('brain-train-grid', GameRegistry.getByCategory('brain-train'));
    renderGrid('puzzle-grid',      GameRegistry.getByCategory('puzzle'));
    renderGrid('racing-grid',      GameRegistry.getByCategory('racing'));
    renderGrid('shooting-grid',    GameRegistry.getByCategory('shooting'));
  }

  function renderGrid(gridId, gamesList) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    grid.innerHTML = '';

    if (!gamesList || gamesList.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-gamepad"></i>
          <p>Games coming soon!</p>
        </div>`;
      return;
    }

    gamesList.forEach(game => {
      const card = createGameCard(game);
      grid.appendChild(card);
    });
  }

  function createGameCard(game) {
    const best    = ScoreManager.getBestScore(game.id);
    const catInfo = GameRegistry.getCategoryInfo(game.category);

    const card = document.createElement('div');
    card.className  = 'game-card';
    card.dataset.gameId = game.id;
    /* ---- FIXED: use pointer cursor and clear click area ---- */
    card.style.cursor = 'pointer';

    card.innerHTML = `
      <div class="game-thumb">
        <span style="position:relative;z-index:1;font-size:3rem;">${game.emoji}</span>
        <div class="game-play-overlay">
          <div class="play-circle">
            <i class="fas fa-play"></i>
          </div>
        </div>
        <span class="diff-badge diff-${game.difficulty}">${game.difficulty}</span>
      </div>
      <div class="game-card-body">
        <div class="game-card-title">${game.title}</div>
        <div class="game-card-desc">${game.description}</div>
      </div>
      <div class="game-card-foot">
        <span class="game-cat-tag">
          ${catInfo ? catInfo.icon : ''} ${catInfo ? catInfo.label : game.category}
        </span>
        <span class="game-best-score">
          <i class="fas fa-trophy"></i>
          ${best > 0 ? best : '-'}
        </span>
      </div>`;

    /* ---- FIXED: single clean click listener ---- */
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      launchGame(game.id);
    });

    return card;
  }

  /* ================================================
     FILTER & SEARCH
  ================================================ */
  function applyFilter(filter) {
    currentFilter = filter;

    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.filter === filter);
    });

    let list = searchQuery
      ? GameRegistry.search(searchQuery)
      : GameRegistry.getAll();

    if (filter !== 'all') {
      list = list.filter(g => g.category === filter);
    }

    renderGrid('home-games-grid', list);
  }

  function applySearch(query) {
    searchQuery = query.trim();

    const clearBtn = document.getElementById('search-clear');
    if (clearBtn) clearBtn.classList.toggle('hidden', !searchQuery);

    let list = GameRegistry.search(searchQuery);

    if (currentFilter !== 'all') {
      list = list.filter(g => g.category === currentFilter);
    }

    renderGrid('home-games-grid', list);
  }

  /* ================================================
     UPDATE STATS
  ================================================ */
  function updateStats() {
    const total = document.getElementById('stat-total-games');
    if (total) total.textContent = GameRegistry.count();

    ['brain-train', 'puzzle', 'racing', 'shooting'].forEach(cat => {
      const el = document.getElementById(`count-${cat}`);
      if (el) {
        const n = GameRegistry.countByCategory(cat);
        el.textContent = `${n} Game${n !== 1 ? 's' : ''}`;
      }
    });
  }

  /* ================================================
     LAUNCH GAME  ← FIXED
  ================================================ */
  function launchGame(gameId) {
    const game = GameRegistry.getById(gameId);
    if (!game) {
      showToast('Game not found!', 'error');
      return;
    }

    currentGame = game;
    SoundManager.click();

    /* Skip pre-game ad for now and go straight to game
       (ad system can be re-enabled later with real AdSense) */
    openGameScreen(game);
  }

  /* ================================================
     OPEN GAME SCREEN  ← FIXED
  ================================================ */
  function openGameScreen(game) {
    const screen = document.getElementById('game-screen');
    const title  = document.getElementById('game-title-bar');
    const canvas = document.getElementById('game-canvas-wrap');
    const loader = document.getElementById('game-loading-wrap');
    const result = document.getElementById('game-result');
    const adPre  = document.getElementById('ad-pregame');

    if (!screen || !canvas) {
      showToast('Game screen not found!', 'error');
      return;
    }

    /* hide pre-game ad if showing */
    if (adPre) {
      adPre.classList.add('hidden');
      adPre.classList.remove('show');
    }

    /* update header title */
    if (title) title.textContent = game.title;

    /* hide result screen */
    if (result) result.classList.remove('show');

    /* show loader */
    if (loader) loader.style.display = 'flex';

    /* open the full-screen game overlay */
    screen.classList.add('open');

    /* prevent body scroll */
    document.body.style.overflow = 'hidden';

    /* update score display */
    updateScoreDisplay(0, ScoreManager.getBestScore(game.id));

    /* setup controls */
    ControlManager.offAll();
    ControlManager.showTouchControls(game.controls || {});

    /* clear any leftover game elements then init */
    setTimeout(() => {
      if (loader) loader.style.display = 'none';

      /* remove previous game content */
      Array.from(canvas.children).forEach(child => {
        if (child.id !== 'game-loading-wrap') child.remove();
      });

      try {
        SoundManager.gameStart();
        game.init(canvas);
      } catch (err) {
        console.error('Game init error:', err);
        showToast('Failed to load game!', 'error');
      }
    }, 400);
  }

  /* ================================================
     CLOSE GAME SCREEN
  ================================================ */
  function closeGameScreen() {
    const screen = document.getElementById('game-screen');
    const canvas = document.getElementById('game-canvas-wrap');

    /* destroy current game */
    if (currentGame && typeof currentGame.destroy === 'function') {
      try { currentGame.destroy(); } catch (e) { /* ignore */ }
    }

    /* clear canvas */
    if (canvas) {
      Array.from(canvas.children).forEach(child => {
        if (child.id !== 'game-loading-wrap') child.remove();
      });
    }

    /* hide screen */
    if (screen) screen.classList.remove('open');

    /* restore scroll */
    document.body.style.overflow = '';

    /* clean up controls */
    ControlManager.hideTouchControls();
    ControlManager.offAll();
    ControlManager.clearKeys();

    currentGame = null;
    SoundManager.click();
  }

  /* ================================================
     SHOW GAME RESULT
  ================================================ */
  function showGameResult(score, isWin = false) {
    const result   = document.getElementById('game-result');
    const emoji    = document.getElementById('result-emoji');
    const heading  = document.getElementById('result-heading');
    const scoreVal = document.getElementById('result-score-val');
    const bestVal  = document.getElementById('result-best-val');

    if (!result) return;

    const isNewBest = ScoreManager.submitScore(currentGame.id, score);
    const best      = ScoreManager.getBestScore(currentGame.id);

    if (scoreVal) scoreVal.textContent = score;
    if (bestVal)  bestVal.textContent  = best;

    if (isWin) {
      if (emoji)   emoji.textContent   = '🏆';
      if (heading) heading.textContent = 'You Win!';
      SoundManager.win();
    } else {
      if (emoji)   emoji.textContent   = '💀';
      if (heading) heading.textContent = 'Game Over!';
      SoundManager.gameOver();
    }

    if (isNewBest && score > 0) {
      setTimeout(() => {
        SoundManager.newBest();
        showToast('🏆 New Best Score!', 'success');
      }, 600);
    }

    updateScoreDisplay(score, best);
    refreshGameCards(currentGame.id);
    result.classList.add('show');
  }

  /* ================================================
     UPDATE SCORE DISPLAY
  ================================================ */
  function updateScoreDisplay(score, best) {
    const scoreEl = document.getElementById('game-score-display');
    const bestEl  = document.getElementById('game-best-display');
    if (scoreEl) scoreEl.textContent = score;
    if (bestEl)  bestEl.textContent  = best;
  }

  function refreshGameCards(gameId) {
    const cards = document.querySelectorAll(`[data-game-id="${gameId}"]`);
    const best  = ScoreManager.getBestScore(gameId);
    cards.forEach(card => {
      const el = card.querySelector('.game-best-score');
      if (el) el.innerHTML = `<i class="fas fa-trophy"></i> ${best > 0 ? best : '-'}`;
    });
  }

  /* ================================================
     TOAST
  ================================================ */
  function showToast(message, type = 'info', duration = 3000) {
    const wrap = document.getElementById('toast-wrap');
    if (!wrap) return;

    const icons = {
      success: 'fa-check-circle',
      error:   'fa-times-circle',
      info:    'fa-info-circle',
      warning: 'fa-exclamation-triangle'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i class="fas ${icons[type] || icons.info}"></i>
      <span>${message}</span>`;

    wrap.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /* ================================================
     BIND EVENTS
  ================================================ */
  function bindEvents() {

    /* ------ NAV LINKS ------ */
    document.querySelectorAll('.nav-link, .mobile-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const page = link.dataset.page;
        if (page) {
          SoundManager.click();
          navigateTo(page);
        }
      });
    });

    /* ------ LOGO → HOME ------ */
    const logo = document.getElementById('nav-logo');
    if (logo) {
      logo.addEventListener('click', () => {
        SoundManager.click();
        navigateTo('home');
      });
    }

    /* ------ HAMBURGER ------ */
    const hamburger = document.getElementById('hamburger-btn');
    if (hamburger) {
      hamburger.addEventListener('click', () => {
        SoundManager.click();
        const nav  = document.getElementById('mobile-nav');
        const icon = document.getElementById('hamburger-icon');
        if (!nav) return;
        const open = nav.classList.toggle('open');
        if (icon) {
          icon.classList.toggle('fa-bars',  !open);
          icon.classList.toggle('fa-times',  open);
        }
      });
    }

    /* ------ THEME BUTTON ------ */
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        SoundManager.click();
        const panel = document.getElementById('theme-panel');
        if (panel) panel.classList.toggle('open');
      });
    }

    /* ------ CLOSE THEME PANEL ------ */
    const closeTheme = document.getElementById('close-theme-btn');
    if (closeTheme) {
      closeTheme.addEventListener('click', () => {
        SoundManager.click();
        const panel = document.getElementById('theme-panel');
        if (panel) panel.classList.remove('open');
      });
    }

    /* ------ THEME OPTIONS ------ */
    document.querySelectorAll('.theme-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        ThemeManager.apply(opt.dataset.theme);
        SoundManager.click();
        showToast(`Theme: ${opt.textContent.trim()}`, 'info', 1500);
      });
    });

    /* ------ CLOSE THEME ON OUTSIDE CLICK ------ */
    document.addEventListener('click', e => {
      const panel    = document.getElementById('theme-panel');
      const themeBtn = document.getElementById('theme-btn');
      if (!panel || !themeBtn) return;
      if (panel.classList.contains('open')) {
        if (!panel.contains(e.target) && !themeBtn.contains(e.target)) {
          panel.classList.remove('open');
        }
      }
    });

    /* ------ SOUND TOGGLE ------ */
    const soundBtn = document.getElementById('sound-btn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const muted = SoundManager.toggleMute();
        updateSoundIcons(muted);
        if (!muted) SoundManager.click();
      });
    }

    /* ------ SOUND TOGGLE IN GAME ------ */
    const gameSoundBtn = document.getElementById('game-sound-btn');
    if (gameSoundBtn) {
      gameSoundBtn.addEventListener('click', () => {
        const muted = SoundManager.toggleMute();
        updateSoundIcons(muted);
        if (!muted) SoundManager.click();
      });
    }

    /* ------ HERO PLAY BUTTON ------ */
    const heroBtn = document.getElementById('hero-play-btn');
    if (heroBtn) {
      heroBtn.addEventListener('click', () => {
        SoundManager.click();
        const grid = document.getElementById('home-games-grid');
        if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    /* ------ CATEGORY CARDS ------ */
    document.querySelectorAll('.cat-card').forEach(card => {
      card.addEventListener('click', () => {
        SoundManager.click();
        const page = card.dataset.page;
        if (page) navigateTo(page);
      });
    });

    /* ------ FILTER TABS ------ */
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        SoundManager.click();
        applyFilter(tab.dataset.filter);
      });
    });

    /* ------ SEARCH ------ */
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        applySearch(e.target.value);
      });
    }

    const searchClear = document.getElementById('search-clear');
    if (searchClear) {
      searchClear.addEventListener('click', () => {
        const input = document.getElementById('search-input');
        if (input) input.value = '';
        applySearch('');
        SoundManager.click();
      });
    }

    /* ------ GAME BACK BUTTON ------ */
    const backBtn = document.getElementById('game-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        closeGameScreen();
      });
    }

    /* ------ PLAY AGAIN ------ */
    const playAgainBtn = document.getElementById('btn-play-again');
    if (playAgainBtn) {
      playAgainBtn.addEventListener('click', () => {
        SoundManager.click();

        const result = document.getElementById('game-result');
        if (result) result.classList.remove('show');

        if (currentGame) {
          const canvas  = document.getElementById('game-canvas-wrap');
          if (canvas) {
            Array.from(canvas.children).forEach(child => {
              if (child.id !== 'game-loading-wrap') child.remove();
            });
          }

          updateScoreDisplay(0, ScoreManager.getBestScore(currentGame.id));
          ControlManager.offAll();
          ControlManager.clearKeys();

          setTimeout(() => {
            try {
              SoundManager.gameStart();
              currentGame.init(canvas);
            } catch (err) {
              console.error('Restart error:', err);
            }
          }, 200);
        }
      });
    }

    /* ------ GO HOME FROM RESULT ------ */
    const goHomeBtn = document.getElementById('btn-go-home');
    if (goHomeBtn) {
      goHomeBtn.addEventListener('click', () => {
        closeGameScreen();
        navigateTo('home');
      });
    }

    /* ------ INIT AUDIO ON FIRST INTERACTION ------ */
    const initAudio = () => {
      SoundManager.init();
      document.removeEventListener('click',      initAudio);
      document.removeEventListener('touchstart', initAudio);
      document.removeEventListener('keydown',    initAudio);
    };
    document.addEventListener('click',      initAudio);
    document.addEventListener('touchstart', initAudio);
    document.addEventListener('keydown',    initAudio);

    /* ------ ESC KEY ------ */
    ControlManager.on('keydown', 'app-escape', key => {
      if (key === 'Escape') {
        const screen = document.getElementById('game-screen');
        const result = document.getElementById('game-result');
        if (screen && screen.classList.contains('open')) {
          if (result && result.classList.contains('show')) {
            closeGameScreen();
          }
        }
      }
    });

    /* set initial sound icon state */
    updateSoundIcons(SoundManager.getMuted());
  }

  /* ================================================
     UPDATE SOUND ICONS
  ================================================ */
  function updateSoundIcons(muted) {
    document.querySelectorAll('#sound-icon, #game-sound-icon').forEach(icon => {
      icon.className = muted ? 'fas fa-volume-mute' : 'fas fa-volume-up';
    });
  }

  /* ================================================
     PUBLIC API
  ================================================ */
  return {
    init,
    navigateTo,
    launchGame,
    closeGameScreen,
    showGameResult,
    updateScoreDisplay,
    showToast,
    updateStats,
    renderAllGrids
  };

})();

/* ================================================
   BOOT
================================================ */
document.addEventListener('DOMContentLoaded', () => App.init());