/* ── AUTH MANAGER ── */
const Auth = (() => {
  const KEY = 'ga_user';

  function getUser() {
    try { return JSON.parse(localStorage.getItem(KEY)); }
    catch { return null; }
  }

  function setUser(user) {
    localStorage.setItem(KEY, JSON.stringify(user));
  }

  function isLoggedIn() { return !!getUser(); }
  function isGuest() { const u = getUser(); return u && u.isGuest; }
  function getAge() { const u = getUser(); return u ? u.ageGroup : null; }
  function isAdult() { return getAge() === '18_plus'; }

  function login(username, password) {
    const users = JSON.parse(localStorage.getItem('ga_users') || '[]');
    const user = users.find(u => u.username === username);
    if (!user) return { ok: false, msg: 'Username not found' };
    if (user.password !== btoa(password)) return { ok: false, msg: 'Wrong password' };
    const session = { ...user };
    delete session.password;
    setUser(session);
    return { ok: true, user: session };
  }

  function register(username, email, password, ageGroup) {
    if (!username || username.length < 3) return { ok: false, msg: 'Username must be 3+ characters' };
    if (!email || !email.includes('@')) return { ok: false, msg: 'Invalid email' };
    if (!password || password.length < 6) return { ok: false, msg: 'Password must be 6+ characters' };
    if (!ageGroup) return { ok: false, msg: 'Please select your age group' };
    const users = JSON.parse(localStorage.getItem('ga_users') || '[]');
    if (users.find(u => u.username === username)) return { ok: false, msg: 'Username already taken' };
    if (users.find(u => u.email === email)) return { ok: false, msg: 'Email already registered' };
    const user = { id: Date.now(), username, email, password: btoa(password), ageGroup, isGuest: false, joined: Date.now() };
    users.push(user);
    localStorage.setItem('ga_users', JSON.stringify(users));
    const session = { ...user }; delete session.password;
    setUser(session);
    return { ok: true, user: session };
  }

  function loginAsGuest(ageGroup) {
    const user = { id: 'guest_' + Date.now(), username: 'Guest', ageGroup: ageGroup || 'under_18', isGuest: true };
    setUser(user);
    return user;
  }

  function logout() { localStorage.removeItem(KEY); }

  function updateNavUI() {
    const user = getUser();
    const navUser = document.getElementById('nav-user');
    if (!navUser) return;
    if (user) {
      navUser.innerHTML = `
        <div class="nav-user-info" id="nav-user-info" title="Profile">
          <span class="nav-avatar">${user.isGuest ? '👤' : '🎮'}</span>
          <span class="nav-username">${user.username}</span>
        </div>`;
      document.getElementById('nav-user-info')?.addEventListener('click', () => {
        if (user.isGuest) { openAuthModal(); } else { App.navigate('profile'); }
      });
    } else {
      navUser.innerHTML = `<button class="btn-login" id="nav-login-btn"><i class="fas fa-user"></i> Login</button>`;
      document.getElementById('nav-login-btn')?.addEventListener('click', openAuthModal);
    }
  }

  function openAuthModal() {
    document.getElementById('auth-overlay')?.classList.remove('hidden');
    document.getElementById('login-form')?.classList.add('active');
    document.getElementById('register-form')?.classList.remove('active');
    document.querySelector('.auth-tab[data-tab="login"]')?.classList.add('active');
    document.querySelector('.auth-tab[data-tab="register"]')?.classList.remove('active');
  }

  function closeAuthModal() {
    document.getElementById('auth-overlay')?.classList.add('hidden');
    document.getElementById('login-error')?.classList.add('hidden');
    document.getElementById('reg-error')?.classList.add('hidden');
  }

  function showGuestAgeModal(cb) {
    const overlay = document.getElementById('guest-age-overlay');
    overlay?.classList.remove('hidden');
    overlay?.querySelectorAll('.guest-age-btn').forEach(btn => {
      btn.onclick = () => {
        overlay.classList.add('hidden');
        cb(btn.dataset.age);
      };
    });
  }

  function init() {
    // Auth modal tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab + '-form')?.classList.add('active');
      });
    });

    // Close modal
    document.getElementById('auth-close')?.addEventListener('click', closeAuthModal);
    document.getElementById('auth-overlay')?.addEventListener('click', e => {
      if (e.target === document.getElementById('auth-overlay')) closeAuthModal();
    });

    // Login form
    document.getElementById('login-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      const res = login(username, password);
      if (res.ok) {
        closeAuthModal();
        updateNavUI();
        App.toast('Welcome back, ' + res.user.username + '!', 'success');
        AdManager?.applyAgePolicy();
      } else {
        const el = document.getElementById('login-error');
        el.textContent = res.msg; el.classList.remove('hidden');
      }
    });

    // Register form
    document.getElementById('register-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const username = document.getElementById('reg-username').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const ageGroup = document.querySelector('input[name="age_group"]:checked')?.value;
      const res = register(username, email, password, ageGroup);
      if (res.ok) {
        closeAuthModal();
        updateNavUI();
        App.toast('Account created! Welcome, ' + res.user.username + '!', 'success');
        AdManager?.applyAgePolicy();
      } else {
        const el = document.getElementById('reg-error');
        el.textContent = res.msg; el.classList.remove('hidden');
      }
    });

    // Guest buttons
    ['guest-btn-login','guest-btn-reg'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => {
        closeAuthModal();
        showGuestAgeModal(ageGroup => {
          loginAsGuest(ageGroup);
          updateNavUI();
          App.toast('Playing as guest!', 'info');
          AdManager?.applyAgePolicy();
        });
      });
    });

    // Hero buttons
    document.getElementById('hero-login-btn')?.addEventListener('click', openAuthModal);
    document.getElementById('hero-play-btn')?.addEventListener('click', () => {
      const games = GAMES_CONFIG.GAMES;
      if (games.length) GameLoader.launch(games[0]);
    });

    updateNavUI();
  }

  return { init, getUser, isLoggedIn, isGuest, isAdult, logout, openAuthModal, updateNavUI, loginAsGuest, showGuestAgeModal };
})();
