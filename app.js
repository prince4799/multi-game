/* ── APP BOOTSTRAP ── */
const App = (() => {
  function navigate(route, param) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link, .mobile-link').forEach(l => l.classList.remove('active'));

    if (route === 'home' || !route) {
      document.getElementById('page-home')?.classList.add('active');
      document.querySelectorAll('[data-route="home"]').forEach(l => l.classList.add('active'));
      history.replaceState(null, '', '#home');
      GameRegistry.renderHome();
    } else if (route === 'category' && param) {
      document.getElementById('page-category')?.classList.add('active');
      document.querySelectorAll(`[data-cat="${param}"]`).forEach(l => l.classList.add('active'));
      history.replaceState(null, '', `#category/${param}`);
      GameRegistry.renderCategory(param);
    } else if (route === 'profile') {
      document.getElementById('page-profile')?.classList.add('active');
      history.replaceState(null, '', '#profile');
      renderProfile();
    } else if (route === 'leaderboard') {
      document.getElementById('page-leaderboard')?.classList.add('active');
      history.replaceState(null, '', '#leaderboard');
    } else {
      navigate('home');
    }
    window.scrollTo(0, 0);
  }

  function renderProfile() {
    const user = Auth.getUser();
    if (!user) { Auth.openAuthModal(); return; }
    document.getElementById('profile-username').textContent = user.username;
    document.getElementById('profile-email').textContent = user.email || '';
    document.getElementById('profile-badge').textContent = user.isGuest ? 'Guest' : (user.ageGroup === '18_plus' ? '18+ Player' : 'Player');
    document.getElementById('profile-avatar').textContent = user.isGuest ? '👤' : '🎮';
    const history = ScoreManager.getHistory();
    const scores = ScoreManager.getAll();
    const topScore = Object.values(scores).length ? Math.max(...Object.values(scores)) : 0;
    document.getElementById('ps-played').textContent = history.length;
    document.getElementById('ps-best').textContent = topScore;
    document.getElementById('ps-streak').textContent = '1';
    const histEl = document.getElementById('profile-history');
    if (!history.length) { histEl.innerHTML = '<p class="lb-empty">No games played yet!</p>'; return; }
    histEl.innerHTML = history.slice(0, 10).map(h => {
      const game = GAMES_CONFIG.GAMES.find(g => g.id === h.gameId);
      return `<div class="lb-row"><span class="lb-rank">${game?.emoji||'🎮'}</span><span class="lb-name">${game?.title||h.gameId}</span><span class="lb-score">${h.score}</span></div>`;
    }).join('');
  }

  function toast(msg, type = 'info') {
    const wrap = document.getElementById('toast-wrap');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    t.innerHTML = `<i class="fas ${icons[type]||'fa-info-circle'}"></i>${msg}`;
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add('fade-out'); setTimeout(() => t.remove(), 300); }, 3000);
  }

  function initSearch() {
    const bar = document.getElementById('nav-search-bar');
    const input = document.getElementById('nav-search-input');
    const drop = document.getElementById('search-results-drop');
    document.getElementById('search-toggle-btn')?.addEventListener('click', () => {
      bar?.classList.toggle('hidden');
      if (!bar?.classList.contains('hidden')) input?.focus();
    });
    document.getElementById('nav-search-close')?.addEventListener('click', () => { bar?.classList.add('hidden'); drop.innerHTML = ''; });
    input?.addEventListener('input', () => {
      const results = GameRegistry.renderSearch(input.value);
      if (!results.length) { drop.innerHTML = ''; return; }
      drop.innerHTML = results.slice(0, 5).map(g =>
        `<div class="search-result-item" data-id="${g.id}"><span class="sr-emoji">${g.emoji}</span><div class="sr-info"><h4>${g.title}</h4><p>${g.category} · ${g.difficulty}</p></div></div>`
      ).join('');
      drop.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          const game = GAMES_CONFIG.GAMES.find(g => g.id === item.dataset.id);
          if (game) { bar?.classList.add('hidden'); drop.innerHTML = ''; GameLoader.launch(game); }
        });
      });
    });
  }

  function initHamburger() {
    document.getElementById('hamburger-btn')?.addEventListener('click', () => {
      const mn = document.getElementById('mobile-nav');
      const icon = document.getElementById('hamburger-icon');
      mn?.classList.toggle('open');
      icon?.classList.toggle('fa-bars');
      icon?.classList.toggle('fa-times');
    });
  }

  function routeFromHash() {
    const hash = location.hash.replace('#', '') || 'home';
    if (!hash || hash === 'home') navigate('home');
    else if (hash.startsWith('category/')) navigate('category', hash.split('/')[1]);
    else if (hash === 'profile') navigate('profile');
    else if (hash === 'leaderboard') navigate('leaderboard');
    else navigate('home');
  }

  function initLoading() {
    const bar = document.getElementById('ld-bar');
    const text = document.getElementById('ld-text');
    const msgs = ['Loading arena...', 'Setting up games...', 'Almost ready!'];
    let pct = 0, mi = 0;
    const iv = setInterval(() => {
      pct += Math.random() * 28 + 12;
      if (pct > 100) pct = 100;
      if (bar) bar.style.width = pct + '%';
      if (text && mi < msgs.length) text.textContent = msgs[mi++];
      if (pct >= 100) {
        clearInterval(iv);
        setTimeout(() => {
          const ls = document.getElementById('loading-screen');
          ls?.classList.add('fade-out');
          setTimeout(() => { ls?.remove(); document.getElementById('app')?.classList.remove('hidden'); }, 600);
        }, 300);
      }
    }, 280);
  }

  function init() {
    initLoading();
    ThemeManager.init();
    IframeBridge.listen();
    ControlManager.init();
    Auth.init();
    GameRegistry.renderNavCategories();
    AdManager.init();
    GameLoader.init();
    initSearch();
    initHamburger();
    routeFromHash();
    window.addEventListener('hashchange', routeFromHash);
    document.getElementById('nav-logo')?.addEventListener('click', () => navigate('home'));

    // Boot OGL 3D visual engine
    if (typeof Dashboard3DOGL !== 'undefined') {
      Dashboard3DOGL.init();
      ThemeManager.onChange(() => Dashboard3DOGL.onThemeChange());
    }
  }

  return { init, navigate, toast, renderProfile };
})();

document.addEventListener('DOMContentLoaded', App.init);
