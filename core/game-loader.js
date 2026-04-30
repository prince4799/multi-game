/* ── GAME LOADER ── */
const GameLoader = (() => {
  let _currentGame = null;
  function currentGame() { return _currentGame; }

  function launch(game) {
    if (!game) return;
    const user = Auth.getUser();
    if (game.ageRating === '18_plus') {
      if (!user) { Auth.openAuthModal(); return; }
      if (user.ageGroup !== '18_plus') { App.toast('This game is for 18+ players only.', 'error'); return; }
    }
    if (!user) {
      Auth.showGuestAgeModal(ageGroup => {
        Auth.loginAsGuest(ageGroup);
        Auth.updateNavUI();
        _doLaunch(game);
      });
      return;
    }
    _doLaunch(game);
  }

  function _doLaunch(game) {
    _currentGame = game;
    IframeBridge.setCurrentGame(game.id);
    const screen = document.getElementById('game-screen');
    screen?.classList.remove('hidden');
    document.getElementById('game-title-bar').textContent = game.title;
    document.getElementById('live-score').textContent = '0';
    document.getElementById('live-best').textContent = ScoreManager.getBest(game.id);
    document.getElementById('game-result')?.classList.add('hidden');
    document.getElementById('game-loading-wrap')?.classList.remove('hidden');
    ControlManager.hide();
    AdManager.showPregame(() => _loadIframe(game));
  }

  function _loadIframe(game) {
    const wrap = document.getElementById('game-iframe-wrap');
    wrap?.querySelector('iframe')?.remove();
    const iframe = document.createElement('iframe');
    iframe.src = game.htmlFile + '?t=' + Date.now();
    iframe.title = game.title;
    iframe.allow = 'autoplay';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');

    // Fallback: hide spinner when iframe finishes loading
    iframe.addEventListener('load', () => {
      setTimeout(() => {
        document.getElementById('game-loading-wrap')?.classList.add('hidden');
        ControlManager.show(_currentGame);
      }, 300);
    });

    wrap?.appendChild(iframe);
  }

  function onGameOver(score, best) {
    const isNew = ScoreManager.setBest(_currentGame?.id, score);
    const finalBest = ScoreManager.getBest(_currentGame?.id);
    ScoreManager.addHistory(_currentGame?.id, score);
    document.getElementById('live-score').textContent = score;
    document.getElementById('live-best').textContent = finalBest;
    document.getElementById('result-score').textContent = score;
    document.getElementById('result-best').textContent = finalBest;
    document.getElementById('result-heading').textContent = isNew ? 'New Record! 🏆' : 'Game Over!';
    document.getElementById('result-emoji').textContent = isNew ? '🏆' : '💀';
    document.getElementById('game-result')?.classList.remove('hidden');
    ControlManager.hide();
  }

  function exit() {
    document.getElementById('game-screen')?.classList.add('hidden');
    document.getElementById('game-iframe-wrap')?.querySelector('iframe')?.remove();
    document.getElementById('game-result')?.classList.add('hidden');
    AdManager.hidePregame();
    ControlManager.hide();
    _currentGame = null;
  }

  function init() {
    document.getElementById('game-back-btn')?.addEventListener('click', exit);
    document.getElementById('btn-go-home')?.addEventListener('click', exit);
    document.getElementById('btn-play-again')?.addEventListener('click', () => {
      if (_currentGame) {
        document.getElementById('game-result')?.classList.add('hidden');
        document.getElementById('game-loading-wrap')?.classList.remove('hidden');
        _loadIframe(_currentGame);
      }
    });
  }

  return { init, launch, onGameOver, exit, currentGame };
})();
