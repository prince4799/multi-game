/* ── IFRAME BRIDGE — postMessage protocol ── */
const IframeBridge = (() => {
  let currentGameId = null;

  function listen() {
    window.addEventListener('message', e => {
      if (!e.data || typeof e.data !== 'object') return;
      const { type, ...payload } = e.data;
      switch (type) {
        case 'GAME_READY':
          document.getElementById('game-loading-wrap')?.classList.add('hidden');
          ControlManager.show(GameLoader.currentGame());
          // Send current theme so game can style itself immediately
          IframeBridge.sendToGame({ type: 'THEME', theme: ThemeManager.current() });
          break;
        case 'SCORE_UPDATE':
          document.getElementById('live-score').textContent = payload.score ?? 0;
          break;
        case 'GAME_OVER':
          GameLoader.onGameOver(payload.score ?? 0, payload.best ?? 0);
          break;
        case 'GAME_PAUSE':
          document.getElementById('game-pause-icon')?.classList.toggle('fa-pause');
          document.getElementById('game-pause-icon')?.classList.toggle('fa-play');
          break;
      }
    });
  }

  function sendToGame(msg) {
    const iframe = document.querySelector('#game-iframe-wrap iframe');
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(msg, '*');
    }
  }

  function setCurrentGame(id) { currentGameId = id; }

  return { listen, sendToGame, setCurrentGame };
})();
