
/* ================================================
   AD MANAGER
   Manages all Google AdSense zones
   ================================================ */

const AdManager = (() => {

  // Config - set to true when AdSense is live
  const config = {
    adsEnabled:   false, // SET TO true when you add AdSense code
    showPregame:  true,  // Show pre-game ad before each game
    pregameDelay: 3,     // Seconds before skip button appears
    devMode:      true   // Shows placeholder borders in dev
  };

  // All ad zone IDs
  const zones = {
    top:          'ad-top',
    inlineHome:   'ad-inline-home',
    sidebarLeft:  'ad-sidebar-left',
    sidebarRight: 'ad-sidebar-right',
    mobileBottom: 'ad-mobile-bottom',
    pregame:      'ad-pregame',
    gameover:     'ad-gameover'
  };

  // Skip countdown timer reference
  let skipTimer = null;
  let onSkipCallback = null;

  // Show/hide a specific zone
  function showZone(zoneId) {
    const el = document.getElementById(zoneId);
    if (el) el.style.display = 'flex';
  }

  function hideZone(zoneId) {
    const el = document.getElementById(zoneId);
    if (el) el.style.display = 'none';
  }

  // Show pre-game ad with countdown
  function showPregameAd(onComplete) {
    if (!config.showPregame) {
      onComplete && onComplete();
      return;
    }

    onSkipCallback = onComplete;

    const adEl       = document.getElementById('ad-pregame');
    const countdown  = document.getElementById('skip-countdown');
    const skipBtn    = document.getElementById('skip-ad-btn');

    if (!adEl) {
      onComplete && onComplete();
      return;
    }

    adEl.classList.remove('hidden');
    adEl.classList.add('show');

    if (skipBtn) skipBtn.classList.add('hidden');

    let secs = config.pregameDelay;
    if (countdown) countdown.textContent = `Skip in ${secs}...`;

    clearInterval(skipTimer);
    skipTimer = setInterval(() => {
      secs--;
      if (secs > 0) {
        if (countdown) countdown.textContent = `Skip in ${secs}...`;
      } else {
        clearInterval(skipTimer);
        if (countdown) countdown.textContent = '';
        if (skipBtn) skipBtn.classList.remove('hidden');
      }
    }, 1000);
  }

  // Skip pre-game ad
  function skipPregameAd() {
    clearInterval(skipTimer);
    const adEl = document.getElementById('ad-pregame');
    if (adEl) {
      adEl.classList.remove('show');
      adEl.classList.add('hidden');
    }
    if (onSkipCallback) {
      onSkipCallback();
      onSkipCallback = null;
    }
  }

  // Init ad zones based on device
  function init() {
    const isMobile = window.innerWidth <= 1024;

    // Mobile: show bottom banner, hide sidebars
    if (isMobile) {
      showZone(zones.mobileBottom);
      hideZone(zones.sidebarLeft);
      hideZone(zones.sidebarRight);
    } else {
      // Desktop: show sidebars if wide enough
      if (window.innerWidth >= 1300) {
        showZone(zones.sidebarLeft);
        showZone(zones.sidebarRight);
      }
      hideZone(zones.mobileBottom);
    }

    // Skip ad button listener
    const skipBtn = document.getElementById('skip-ad-btn');
    if (skipBtn) {
      skipBtn.addEventListener('click', skipPregameAd);
    }

    // Resize handler
    window.addEventListener('resize', () => {
      const isNowMobile = window.innerWidth <= 1024;
      if (isNowMobile) {
        showZone(zones.mobileBottom);
        hideZone(zones.sidebarLeft);
        hideZone(zones.sidebarRight);
      } else {
        hideZone(zones.mobileBottom);
        if (window.innerWidth >= 1300) {
          showZone(zones.sidebarLeft);
          showZone(zones.sidebarRight);
        }
      }
    });
  }

  return {
    init,
    showZone,
    hideZone,
    showPregameAd,
    skipPregameAd,
    zones,
    config
  };

})();
