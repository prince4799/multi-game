/* ── AD MANAGER ── */
const AdManager = (() => {
  let skipTimer = null;

  function applyAgePolicy() {
    const isAdult = Auth.isAdult();
    const isMobile = window.innerWidth < 768;

    // Sidebar ads: CSS handles breakpoint visibility (1400px+).
    // We only hide them entirely for under-18 users.
    ['ad-sidebar-left','ad-sidebar-right'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.visibility = isAdult ? 'visible' : 'hidden';
    });

    // Mobile sticky bottom ad (18+ only)
    const mobileAd = document.getElementById('ad-mobile-bottom');
    if (mobileAd) {
      if (isMobile && isAdult) {
        mobileAd.classList.remove('hidden');
        document.body.classList.add('has-bottom-ad');
      } else {
        mobileAd.classList.add('hidden');
        document.body.classList.remove('has-bottom-ad');
      }
    }
  }

  function showPregame(cb) {
    const overlay = document.getElementById('pregame-overlay');
    const countdown = document.getElementById('skip-countdown');
    const skipBtn = document.getElementById('skip-ad-btn');
    if (!overlay) { cb(); return; }
    const waitSecs = Auth.isAdult() ? 3 : 1;
    overlay.classList.remove('hidden');
    skipBtn?.classList.add('hidden');
    let secs = waitSecs;
    countdown.textContent = `Ad ends in ${secs}...`;
    skipTimer = setInterval(() => {
      secs--;
      if (secs <= 0) {
        clearInterval(skipTimer);
        countdown.textContent = '';
        skipBtn?.classList.remove('hidden');
      } else {
        countdown.textContent = `Ad ends in ${secs}...`;
      }
    }, 1000);
    let called = false;
    const done = () => {
      if (called) return;
      called = true;
      clearInterval(skipTimer);
      overlay.classList.add('hidden');
      cb();
    };

    skipBtn.onclick = done;
    setTimeout(done, (waitSecs + 2) * 1000);
  }

  function hidePregame() {
    clearInterval(skipTimer);
    document.getElementById('pregame-overlay')?.classList.add('hidden');
  }

  function showCookieBanner() {
    if (localStorage.getItem('ga_cookie_consent')) return;
    const banner = document.getElementById('cookie-banner');
    banner?.classList.remove('hidden');
    document.getElementById('cookie-accept')?.addEventListener('click', () => {
      localStorage.setItem('ga_cookie_consent', 'all');
      banner?.classList.add('hidden');
    });
    document.getElementById('cookie-necessary')?.addEventListener('click', () => {
      localStorage.setItem('ga_cookie_consent', 'necessary');
      banner?.classList.add('hidden');
    });
  }

  function init() {
    showCookieBanner();
    applyAgePolicy();
    window.addEventListener('resize', applyAgePolicy);
  }

  return { init, applyAgePolicy, showPregame, hidePregame };
})();
