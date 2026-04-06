/* ================================================
   CONTROL MANAGER
   Handles keyboard, touch and on-screen controls
   ================================================ */

const ControlManager = (() => {

  // Device detection
  const isTouchDevice = () =>
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0) ||
    (window.matchMedia('(pointer: coarse)').matches);

  const isMobile = () => window.innerWidth <= 600;
  const isTablet = () => window.innerWidth > 600 && window.innerWidth <= 1024;
  const isDesktop = () => window.innerWidth > 1024;

  // Active keys state
  const keys = {};

  // Listeners registered by games
  let listeners = {};

  /* ---------- KEYBOARD ---------- */
  function initKeyboard() {
    window.addEventListener('keydown', e => {
      if (keys[e.key]) return; // prevent repeat
      keys[e.key] = true;
      emit('keydown', e.key);

      // Prevent page scroll on game keys
      const gameKeys = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '];
      if (gameKeys.includes(e.key)) e.preventDefault();
    });

    window.addEventListener('keyup', e => {
      keys[e.key] = false;
      emit('keyup', e.key);
    });
  }

  /* ---------- ON-SCREEN D-PAD ---------- */
  function initDpad() {
    const dpadBtns = document.querySelectorAll('.dpad-btn');
    const actionBtns = document.querySelectorAll('.action-btn');
    const centerBtns = document.querySelectorAll('.center-btn');

    const allBtns = [...dpadBtns, ...actionBtns, ...centerBtns];

    allBtns.forEach(btn => {
      const key = btn.dataset.key;
      if (!key) return;

      // Touch events for mobile (no delay)
      btn.addEventListener('touchstart', e => {
        e.preventDefault();
        btn.classList.add('pressed');
        keys[key] = true;
        emit('keydown', key);
        SoundManager.buttonPress();
      }, { passive: false });

      btn.addEventListener('touchend', e => {
        e.preventDefault();
        btn.classList.remove('pressed');
        keys[key] = false;
        emit('keyup', key);
      }, { passive: false });

      btn.addEventListener('touchcancel', e => {
        btn.classList.remove('pressed');
        keys[key] = false;
        emit('keyup', key);
      });

      // Mouse events for desktop testing
      btn.addEventListener('mousedown', e => {
        btn.classList.add('pressed');
        keys[key] = true;
        emit('keydown', key);
      });

      btn.addEventListener('mouseup', e => {
        btn.classList.remove('pressed');
        keys[key] = false;
        emit('keyup', key);
      });

      btn.addEventListener('mouseleave', e => {
        if (btn.classList.contains('pressed')) {
          btn.classList.remove('pressed');
          keys[key] = false;
          emit('keyup', key);
        }
      });
    });
  }

  /* ---------- TOUCH SWIPE (for puzzle games) ---------- */
  let swipeStartX = 0;
  let swipeStartY = 0;
  let swipeActive = false;

  function initSwipe(element) {
    element.addEventListener('touchstart', e => {
      swipeStartX = e.touches[0].clientX;
      swipeStartY = e.touches[0].clientY;
      swipeActive = true;
    }, { passive: true });

    element.addEventListener('touchend', e => {
      if (!swipeActive) return;
      swipeActive = false;

      const dx = e.changedTouches[0].clientX - swipeStartX;
      const dy = e.changedTouches[0].clientY - swipeStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) < 30) return; // too small

      if (absDx > absDy) {
        // Horizontal swipe
        const dir = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
        emit('swipe', dir);
        emit('keydown', dir);
        setTimeout(() => emit('keyup', dir), 100);
      } else {
        // Vertical swipe
        const dir = dy > 0 ? 'ArrowDown' : 'ArrowUp';
        emit('swipe', dir);
        emit('keydown', dir);
        setTimeout(() => emit('keyup', dir), 100);
      }
    }, { passive: true });
  }

  /* ---------- SHOW/HIDE TOUCH CONTROLS ---------- */
  function showTouchControls(config = {}) {
    const wrap = document.getElementById('touch-controls');
    if (!wrap) return;

    if (!isTouchDevice() && isDesktop()) {
      wrap.classList.remove('show');
      return;
    }

    wrap.classList.add('show');

    // Configure which controls to show
    const dpad    = document.getElementById('dpad');
    const actions = document.getElementById('action-btns');
    const center  = document.getElementById('center-btns');

    if (dpad)    dpad.style.display    = config.dpad    === false ? 'none' : '';
    if (actions) actions.style.display = config.actions === false ? 'none' : '';
    if (center)  center.style.display  = config.center  === false ? 'none' : '';
  }

  function hideTouchControls() {
    const wrap = document.getElementById('touch-controls');
    if (wrap) wrap.classList.remove('show');
  }

  /* ---------- EVENT EMITTER ---------- */
  function on(event, id, callback) {
    if (!listeners[event]) listeners[event] = {};
    listeners[event][id] = callback;
  }

  function off(event, id) {
    if (listeners[event]) delete listeners[event][id];
  }

  function offAll() {
    listeners = {};
  }

  function emit(event, data) {
    if (!listeners[event]) return;
    Object.values(listeners[event]).forEach(cb => cb(data));
  }

  /* ---------- HELPERS ---------- */
  function isKeyDown(key) { return !!keys[key]; }

  function clearKeys() {
    Object.keys(keys).forEach(k => keys[k] = false);
  }

  /* ---------- INIT ---------- */
  function init() {
    initKeyboard();
    initDpad();
  }

  return {
    init,
    initSwipe,
    showTouchControls,
    hideTouchControls,
    on,
    off,
    offAll,
    isKeyDown,
    clearKeys,
    isTouchDevice,
    isMobile,
    isTablet,
    isDesktop
  };

})();