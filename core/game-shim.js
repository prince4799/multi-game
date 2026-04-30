/* ================================================================
   GAME SHIM  —  GamerZ Arena Compatibility Layer
   Bridges the old multi-game API → postMessage protocol so that
   legacy game JS files can run inside the new iframe shell without
   any changes to game code.

   Provides stubs for:
     window.GameRegistry   — captures init/destroy/restart config
     window.App            — score display + game-result forwarding
     window.ControlManager — keyboard + postMessage CONTROL routing
     window.SoundManager   — silent no-ops (sounds optional later)
     window.ScoreManager   — localStorage best-score read/write
================================================================ */

(function () {
  'use strict';

  /* ── SoundManager — silent stubs ─────────────────────────── */
  window.SoundManager = {
    click()        {},
    correct()      {},
    wrong()        {},
    navigate()     {},
    gameStart()    {},
    newBest()      {},
    timerWarning() {},
    buttonPress()  {},
    cardFlip()     {},
    cardMatch()    {},
    cardMismatch() {},
    win()          {}
  };

  /* ── ScoreManager — localStorage ─────────────────────────── */
  window.ScoreManager = {
    submitScore(gameId, score) {
      const s = score | 0;
      const key = 'gz_best_' + gameId;
      if (s > parseInt(localStorage.getItem(key) || '0')) {
        localStorage.setItem(key, s);
      }
      window.parent.postMessage({ type: 'SCORE_UPDATE', score: s }, '*');
    },
    getBestScore(gameId) {
      return parseInt(localStorage.getItem('gz_best_' + gameId) || '0');
    }
  };

  /* ── ControlManager — keyboard + postMessage routing ──────── */
  const _handlers = { keydown: {}, keyup: {} };

  window.ControlManager = {
    on(event, gameId, fn) {
      if (!_handlers[event]) _handlers[event] = {};
      _handlers[event][gameId] = fn;
    },
    off(event, gameId) {
      if (_handlers[event]) delete _handlers[event][gameId];
    },
    clearKeys() {
      Object.keys(_handlers).forEach(ev => {
        Object.keys(_handlers[ev]).forEach(id => {
          // send synthetic keyup for all keys to prevent stuck keys
        });
      });
    },
    isTouchDevice() {
      return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    },
    showTouchControls() { /* shell handles this */ },
    hideTouchControls() { /* shell handles this */ },
    _fire(event, key) {
      const hs = _handlers[event] || {};
      Object.values(hs).forEach(fn => {
        try { fn(key); } catch (e) { console.warn('[shim] handler error:', e); }
      });
    }
  };

  /* Forward native keyboard → ControlManager handlers */
  document.addEventListener('keydown', e => {
    ControlManager._fire('keydown', e.key);
  });
  document.addEventListener('keyup', e => {
    ControlManager._fire('keyup', e.key);
  });

  /* Forward shell postMessage CONTROL / PAUSE / RESUME → handlers */
  window.addEventListener('message', e => {
    if (!e.data || typeof e.data !== 'object') return;
    const { type, key, eventType } = e.data;

    if (type === 'CONTROL') {
      ControlManager._fire(eventType || 'keydown', key);
    }

    if (type === 'PAUSE') {
      // 1. Call game-specific hook if registered
      if (typeof window.__onPause === 'function') window.__onPause();
      // 2. Fire Escape key as a universal fallback for games that use it
      ControlManager._fire('keydown', 'Escape');
    }

    if (type === 'RESUME') {
      if (typeof window.__onResume === 'function') window.__onResume();
    }

    if (type === 'THEME') {
      if (typeof window.__onTheme === 'function') window.__onTheme(e.data.theme);
    }
  });

  /* ── App — shell bridge ───────────────────────────────────── */
  window.App = {
    updateScoreDisplay(score, best) {
      window.parent.postMessage({ type: 'SCORE_UPDATE', score: score | 0 }, '*');
    },
    showGameResult(score, isWin) {
      const gameId  = window.__gameId || 'unknown';
      const prevBest = ScoreManager.getBestScore(gameId);
      const newBest  = Math.max(prevBest, score | 0);
      if (newBest > prevBest) localStorage.setItem('gz_best_' + gameId, newBest);
      window.parent.postMessage({
        type:  'GAME_OVER',
        score: score | 0,
        best:  newBest
      }, '*');
    },
    showToast(msg, type, duration) {
      /* no-op — could forward to shell in future */
    }
  };

  /* ── GameRegistry — captures game config and auto-launches ── */
  window.GameRegistry = {
    _config: null,
    register(config) {
      this._config  = config;
      window.__gameId = config.id;
    },
    _launch(container) {
      if (!this._config) return;
      const cfg = this._config;
      /* Notify shell this game is ready */
      window.parent.postMessage({ type: 'GAME_READY', title: cfg.title }, '*');
      /* Start the game */
      if (cfg.init) cfg.init(container);
    },
    /* Called by space-dog.js and any other game that uses GameRegistry.onGameOver() */
    onGameOver(payload) {
      const gameId  = window.__gameId || 'unknown';
      const score   = (payload && payload.score)     ? payload.score     : 0;
      const best    = (payload && payload.highScore)  ? payload.highScore : score;
      if (best > parseInt(localStorage.getItem('gz_best_' + gameId) || '0')) {
        localStorage.setItem('gz_best_' + gameId, best);
      }
      window.parent.postMessage({ type: 'GAME_OVER', score, best }, '*');
    }
  };

  /* Auto-launch after all scripts have loaded */
  window.addEventListener('load', () => {
    const container = document.getElementById('game-container');
    if (container && window.GameRegistry._config) {
      window.GameRegistry._launch(container);
    }
  });

})();
