/* ── GAME REGISTRY ── */
const GameRegistry = (() => {
  function cardHTML(game) {
    const best = ScoreManager.getBest(game.id);
    const user = Auth.getUser();
    const locked = game.ageRating === '18_plus' && (!user || user.ageGroup !== '18_plus');
    return `
      <div class="game-card" data-id="${game.id}" title="${game.title}">
        <div class="game-thumb">
          <div class="game-3d-icon-wrap">
            <div class="game-3d-icon">
              <div class="game-icon-face face-front"><i class="${game.icon}"></i></div>
              <div class="game-icon-face face-back"><i class="${game.icon}"></i></div>
              <div class="game-icon-face face-right"><i class="${game.icon}"></i></div>
              <div class="game-icon-face face-left"><i class="${game.icon}"></i></div>
              <div class="game-icon-face face-top"><i class="${game.icon}"></i></div>
              <div class="game-icon-face face-bottom"><i class="${game.icon}"></i></div>
            </div>
          </div>
          <div class="game-play-overlay"><div class="play-circle"><i class="fas fa-play"></i></div></div>
          <span class="diff-badge diff-${game.difficulty}">${game.difficulty}</span>
          ${game.ageRating === '18_plus' ? '<span class="age-badge">18+</span>' : ''}
        </div>
        ${locked ? `<div class="locked-overlay"><span>🔞</span><p>18+ Only</p></div>` : ''}
        <div class="game-card-body">
          <div class="game-card-title">${game.title}</div>
          <div class="game-card-desc">${game.description}</div>
        </div>
        <div class="game-card-foot">
          <span class="game-cat-tag">${game.category}</span>
          <span class="game-best"><i class="fas fa-trophy"></i>${best || '-'}</span>
        </div>
      </div>`;
  }

  function skeletons(n = 6) {
    return Array(n).fill('<div class="skeleton-card"></div>').join('');
  }

  function renderGrid(containerId, games) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!games.length) {
      el.innerHTML = '<div class="empty-state"><i class="fas fa-gamepad"></i><p>No games found</p></div>';
      return;
    }
    el.innerHTML = games.map(cardHTML).join('');
    el.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', () => {
        const game = GAMES_CONFIG.GAMES.find(g => g.id === card.dataset.id);
        if (game) GameLoader.launch(game);
      });
    });
  }

  function renderCategories() {
    const { GAMES, CATEGORIES } = GAMES_CONFIG;
    const grid = document.getElementById('cat-grid');
    if (!grid) return;
    grid.innerHTML = CATEGORIES.map(cat => {
      const count = GAMES.filter(g => g.category === cat.id).length;
      return `
        <div class="cat-card" data-cat="${cat.id}">
          <div class="cat-icon"><i class="${cat.icon}"></i></div>
          <h3>${cat.label}</h3>
          <p>${cat.description}</p>
          <span class="cat-count">${count} Game${count !== 1 ? 's' : ''}</span>
        </div>`;
    }).join('');
    grid.querySelectorAll('.cat-card').forEach(card => {
      card.addEventListener('click', () => App.navigate('category', card.dataset.cat));
    });
  }

  function renderNavCategories() {
    const { CATEGORIES } = GAMES_CONFIG;
    const navLinks = document.getElementById('nav-links');
    const mobileNav = document.getElementById('mobile-nav');
    const filterTabs = document.getElementById('filter-tabs');

    const extraLinks = CATEGORIES.map(cat =>
      `<li><a class="nav-link" data-route="category" data-cat="${cat.id}" href="#category/${cat.id}">
        <i class="${cat.icon}"></i><span>${cat.label}</span></a></li>`
    ).join('');
    navLinks?.insertAdjacentHTML('beforeend', extraLinks);
    navLinks?.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        App.navigate(link.dataset.route, link.dataset.cat);
      });
    });

    const extraMobile = CATEGORIES.map(cat =>
      `<a class="mobile-link" data-route="category" data-cat="${cat.id}" href="#category/${cat.id}">
        <i class="${cat.icon}"></i> ${cat.label}</a>`
    ).join('');
    mobileNav?.insertAdjacentHTML('beforeend', extraMobile);
    mobileNav?.querySelectorAll('.mobile-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        App.navigate(link.dataset.route, link.dataset.cat);
        document.getElementById('mobile-nav')?.classList.remove('open');
      });
    });

    const extraTabs = CATEGORIES.map(cat =>
      `<button class="filter-tab" data-filter="${cat.id}"><i class="${cat.icon}"></i> ${cat.label}</button>`
    ).join('');
    filterTabs?.insertAdjacentHTML('beforeend', extraTabs);
    filterTabs?.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        filterTabs.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const filter = tab.dataset.filter;
        const filtered = filter === 'all' ? GAMES_CONFIG.GAMES : GAMES_CONFIG.GAMES.filter(g => g.category === filter);
        renderGrid('all-games-grid', filtered);
      });
    });
  }

  function renderHome() {
    const { GAMES } = GAMES_CONFIG;
    document.getElementById('stat-games').textContent = GAMES.length;
    document.getElementById('stat-cats').textContent = GAMES_CONFIG.CATEGORIES.length;
    renderGrid('featured-grid', GAMES.filter(g => g.featured));
    renderGrid('all-games-grid', GAMES);
    renderCategories();
  }

  function renderCategory(catId) {
    const cat = GAMES_CONFIG.CATEGORIES.find(c => c.id === catId);
    const games = GAMES_CONFIG.GAMES.filter(g => g.category === catId);
    document.getElementById('cat-hero-icon').innerHTML = `<i class="${cat?.icon || 'fas fa-gamepad'}"></i>`;
    document.getElementById('cat-hero-title').textContent = cat?.label || catId;
    document.getElementById('cat-hero-desc').textContent = cat?.description || '';
    document.getElementById('cat-sec-title').innerHTML = `<i class="fas fa-gamepad"></i> ${cat?.label || catId} Games`;
    renderGrid('cat-games-grid', games);
  }

  function renderSearch(query) {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return GAMES_CONFIG.GAMES.filter(g =>
      g.title.toLowerCase().includes(q) ||
      g.description.toLowerCase().includes(q) ||
      g.tags.some(t => t.includes(q))
    );
  }

  return { renderHome, renderCategory, renderNavCategories, renderSearch, renderGrid };
})();
