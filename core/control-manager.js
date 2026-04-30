/* ═══════════════════════════════════════════════════════════
   CONTROL MANAGER
   Supports: D-Pad · PUBG Joystick · Swipe · Action Buttons
             PC Keyboard hints · Mouse forwarding · Pause
   ═══════════════════════════════════════════════════════════ */
const ControlManager = (() => {
  let currentConfig = null;
  let isPaused = false;
  let joystickActive = false;
  let joystickOrigin = { x: 0, y: 0 };
  let lastJoyDir = null;
  let swipeStart = null;
  const JOYSTICK_RADIUS = 50; // px, max knob travel
  const JOYSTICK_DEAD = 12;   // px, dead-zone

  /* ── helpers ── */
  function isTouchDevice() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }
  function send(msg) { IframeBridge.sendToGame(msg); }
  function sendKey(key, eventType) { send({ type: 'CONTROL', key, eventType }); }

  /* ══════════════════════════════════════════════════════════
     PAUSE SYSTEM
  ══════════════════════════════════════════════════════════ */
  function togglePause() {
    isPaused = !isPaused;
    send({ type: isPaused ? 'PAUSE' : 'RESUME' });

    // Update header pause icon
    const icon = document.getElementById('game-pause-icon');
    if (icon) {
      icon.className = isPaused ? 'fas fa-play' : 'fas fa-pause';
    }

    // Show/hide the shell-level pause overlay
    const overlay = document.getElementById('pause-overlay');
    if (overlay) overlay.classList.toggle('hidden', !isPaused);
  }

  function resetPause() {
    isPaused = false;
    const icon = document.getElementById('game-pause-icon');
    if (icon) icon.className = 'fas fa-pause';
    document.getElementById('pause-overlay')?.classList.add('hidden');
  }

  function initPauseBtn() {
    document.getElementById('game-pause-btn')?.addEventListener('click', togglePause);
    document.getElementById('pause-resume-btn')?.addEventListener('click', togglePause);
    // ESC key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !document.getElementById('game-screen')?.classList.contains('hidden')) {
        e.preventDefault();
        togglePause();
      }
    });
  }

  /* ══════════════════════════════════════════════════════════
     PC KEYBOARD HINTS
  ══════════════════════════════════════════════════════════ */
  function renderPCHints(config) {
    const hintsEl = document.getElementById('pc-key-hints');
    if (!hintsEl) return;
    if (isTouchDevice() || config.hideHints) { hintsEl.classList.add('hidden'); return; }

    const hints = [];
    if (config.controlType === 'dpad' || config.keyboard) {
      hints.push({ keys: ['↑', '↓', '←', '→'], label: 'Move' });
      hints.push({ keys: ['W', 'A', 'S', 'D'], label: 'Alt Move' });
    }
    if (config.actions?.length) {
      config.actions.forEach(a => {
        const keyLabel = a.key === ' ' ? 'Space' : a.key.toUpperCase();
        hints.push({ keys: [keyLabel], label: a.label });
      });
    }
    hints.push({ keys: ['Esc'], label: 'Pause' });

    hintsEl.innerHTML = hints.map(h =>
      `<div class="key-hint">
        ${h.keys.map(k => `<kbd class="key-chip">${k}</kbd>`).join('')}
        <span>${h.label}</span>
      </div>`
    ).join('');
    hintsEl.classList.remove('hidden');
  }

  /* ══════════════════════════════════════════════════════════
     D-PAD (Classic 4-way)
  ══════════════════════════════════════════════════════════ */
  function initDpad() {
    document.querySelectorAll('[data-dpad]').forEach(btn => {
      const key = btn.dataset.dpad;
      const fire = type => sendKey(key, type);
      btn.addEventListener('touchstart', e => { e.preventDefault(); fire('keydown'); }, { passive: false });
      btn.addEventListener('touchend',   e => { e.preventDefault(); fire('keyup');   }, { passive: false });
      btn.addEventListener('mousedown',  ()  => fire('keydown'));
      btn.addEventListener('mouseup',    ()  => fire('keyup'));
      btn.addEventListener('mouseleave', ()  => fire('keyup'));
    });
  }

  /* ══════════════════════════════════════════════════════════
     PUBG-STYLE FLOATING JOYSTICK
  ══════════════════════════════════════════════════════════ */
  function joystickAngleToDir(angle) {
    // angle in degrees from East, going CCW
    // returns dominant direction key
    const a = ((angle % 360) + 360) % 360;
    if (a >= 315 || a < 45)  return 'ArrowRight';
    if (a >= 45  && a < 135) return 'ArrowUp';
    if (a >= 135 && a < 225) return 'ArrowLeft';
    return 'ArrowDown';
  }

  function initJoystick() {
    const zone  = document.getElementById('joystick-zone');
    const base  = document.getElementById('joystick-base');
    const knob  = document.getElementById('joystick-knob');
    if (!zone || !base || !knob) return;

    // Arrow elements for visual feedback
    const arrows = {
      ArrowUp:    document.getElementById('joy-arrow-up'),
      ArrowDown:  document.getElementById('joy-arrow-down'),
      ArrowLeft:  document.getElementById('joy-arrow-left'),
      ArrowRight: document.getElementById('joy-arrow-right'),
    };

    function clearArrows() {
      Object.values(arrows).forEach(a => a?.classList.remove('active'));
    }
    function highlightArrow(dir) {
      clearArrows();
      if (dir && arrows[dir]) arrows[dir].classList.add('active');
    }

    function resetKnob() {
      knob.style.transform = 'translate(-50%, -50%)';
      base.classList.remove('active');
      joystickActive = false;
      clearArrows();
      if (lastJoyDir) { sendKey(lastJoyDir, 'keyup'); lastJoyDir = null; }
    }

    function onMove(cx, cy) {
      const dx = cx - joystickOrigin.x;
      const dy = joystickOrigin.y - cy; // y inverted
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < JOYSTICK_DEAD) {
        if (lastJoyDir) { sendKey(lastJoyDir, 'keyup'); lastJoyDir = null; }
        knob.style.transform = 'translate(-50%, -50%)';
        clearArrows();
        return;
      }

      // Clamp to radius
      const clamped = Math.min(dist, JOYSTICK_RADIUS);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const rx = (dx / dist) * clamped;
      const ry = -(dy / dist) * clamped; // re-invert for CSS
      knob.style.transform = `translate(calc(-50% + ${rx}px), calc(-50% + ${ry}px))`;

      // Direction
      const newDir = joystickAngleToDir(angle);
      if (newDir !== lastJoyDir) {
        if (lastJoyDir) sendKey(lastJoyDir, 'keyup');
        sendKey(newDir, 'keydown');
        lastJoyDir = newDir;
        highlightArrow(newDir);
      }
    }

    zone.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      const rect = zone.getBoundingClientRect();
      joystickOrigin = {
        x: rect.left + rect.width  / 2,
        y: rect.top  + rect.height / 2
      };
      base.classList.add('active');
      joystickActive = true;
      send({ type: 'CONTROL', key: '__start__', eventType: 'keydown' });
    }, { passive: false });

    zone.addEventListener('touchmove', e => {
      e.preventDefault();
      if (!joystickActive) return;
      const t = e.changedTouches[0];
      onMove(t.clientX, t.clientY);
    }, { passive: false });

    zone.addEventListener('touchend',    e => { e.preventDefault(); resetKnob(); }, { passive: false });
    zone.addEventListener('touchcancel', e => { e.preventDefault(); resetKnob(); }, { passive: false });

    /* ── Mouse support (desktop click-and-drag) ── */
    zone.addEventListener('mousedown', e => {
      e.preventDefault();
      const rect = zone.getBoundingClientRect();
      joystickOrigin = {
        x: rect.left + rect.width  / 2,
        y: rect.top  + rect.height / 2
      };
      base.classList.add('active');
      joystickActive = true;
      send({ type: 'CONTROL', key: '__start__', eventType: 'keydown' });
    });
    document.addEventListener('mousemove', e => {
      if (!joystickActive) return;
      onMove(e.clientX, e.clientY);
    });
    document.addEventListener('mouseup', () => {
      if (joystickActive) resetKnob();
    });
  }

  /* ══════════════════════════════════════════════════════════
     SWIPE GESTURES (fallback for dpad games on mobile)
  ══════════════════════════════════════════════════════════ */
  function initSwipe() {
    const gameWrap = document.getElementById('game-iframe-wrap');
    if (!gameWrap) return;

    gameWrap.addEventListener('touchstart', e => {
      swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });

    gameWrap.addEventListener('touchend', e => {
      if (!swipeStart) return;
      const dx = e.changedTouches[0].clientX - swipeStart.x;
      const dy = e.changedTouches[0].clientY - swipeStart.y;
      swipeStart = null;

      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return; // too small

      let key;
      if (Math.abs(dx) > Math.abs(dy)) {
        key = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
      } else {
        key = dy > 0 ? 'ArrowDown' : 'ArrowUp';
      }
      sendKey(key, 'keydown');
      setTimeout(() => sendKey(key, 'keyup'), 80);
    }, { passive: true });
  }

  /* ══════════════════════════════════════════════════════════
     DYNAMIC ACTION BUTTONS
  ══════════════════════════════════════════════════════════ */
  function renderActionButtons(actions) {
    const rightEl = document.getElementById('ctrl-action-right');
    const leftEl  = document.getElementById('ctrl-action-left');
    if (!rightEl || !leftEl) return;

    rightEl.innerHTML = '';
    leftEl.innerHTML  = '';

    (actions || []).forEach(action => {
      const btn = document.createElement('button');
      btn.className    = `action-btn2 action-${action.color || 'primary'}`;
      btn.id           = `action-btn-${action.id}`;
      btn.dataset.key  = action.key;
      btn.setAttribute('title', `${action.label} [${action.key === ' ' ? 'Space' : action.key.toUpperCase()}]`);

      // Use PNG asset if provided; fall back to icon text
      if (action.imgSrc) {
        btn.innerHTML = `
          <img src="${action.imgSrc}" alt="${action.label}"
               class="action-img"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <span class="action-icon-fallback" style="display:none;flex-direction:column;align-items:center;gap:2px">
            <span class="action-icon">${action.icon || ''}</span>
            <span class="action-label">${action.label}</span>
          </span>`;
      } else {
        btn.innerHTML = `
          <span class="action-icon">${action.icon || ''}</span>
          <span class="action-label">${action.label}</span>`;
      }

      const fire = type => sendKey(action.key, type);
      btn.addEventListener('touchstart', e => { e.preventDefault(); fire('keydown'); btn.classList.add('pressed'); }, { passive: false });
      btn.addEventListener('touchend',   e => { e.preventDefault(); fire('keyup');   btn.classList.remove('pressed'); }, { passive: false });
      btn.addEventListener('mousedown',  ()  => { fire('keydown'); btn.classList.add('pressed'); });
      btn.addEventListener('mouseup',    ()  => { fire('keyup'); btn.classList.remove('pressed'); });
      btn.addEventListener('mouseleave', ()  => { fire('keyup'); btn.classList.remove('pressed'); });

      // Also register PC keyboard shortcut
      document.addEventListener('keydown', e => { if (e.key === action.key) btn.classList.add('pressed'); });
      document.addEventListener('keyup',   e => { if (e.key === action.key) btn.classList.remove('pressed'); });

      (action.side === 'left' ? leftEl : rightEl).appendChild(btn);
    });
  }

  /* ══════════════════════════════════════════════════════════
     MOUSE FORWARDING (for aim/rotate games)
  ══════════════════════════════════════════════════════════ */
  function initMouse(mouseMode) {
    if (!mouseMode) return;
    const wrap = document.getElementById('game-iframe-wrap');
    if (!wrap) return;

    wrap.addEventListener('mousemove', e => {
      const r = wrap.getBoundingClientRect();
      send({ type: 'MOUSE_MOVE', x: e.clientX - r.left, y: e.clientY - r.top,
             pctX: (e.clientX - r.left) / r.width, pctY: (e.clientY - r.top) / r.height });
    });
    wrap.addEventListener('click', e => {
      send({ type: 'MOUSE_CLICK', button: e.button });
    });
  }

  /* ══════════════════════════════════════════════════════════
     SHOW / HIDE (called after iframe loads)
  ══════════════════════════════════════════════════════════ */
  function show(gameConfig) {
    currentConfig = gameConfig;
    resetPause();
    const tc = document.getElementById('touch-controls');
    if (!tc) return;

    const type = gameConfig?.controls?.controlType || 'none';
    const hasActions = !!(gameConfig?.controls?.actions?.length);

    // Always render PC hints and action buttons
    renderPCHints(gameConfig?.controls || {});
    renderActionButtons(gameConfig?.controls?.actions || []);

    // Determine if we need to show any on-screen controls
    const needsNav     = (type === 'dpad' || type === 'joystick');
    const needsActions = hasActions;

    if (!needsNav && !needsActions) {
      // Pure click/tap game with no on-screen controls
      tc.classList.add('hidden');
      return;
    }

    // Show the control bar if it's a touch device
    if (isTouchDevice()) {
      tc.classList.remove('hidden');
    } else {
      tc.classList.add('hidden');
    }

    // Show/hide nav zones
    const dpadZone     = document.getElementById('dpad-zone');
    const joystickZone = document.getElementById('joystick-zone');
    dpadZone?.classList.add('hidden');
    joystickZone?.classList.add('hidden');

    if (type === 'dpad')     dpadZone?.classList.remove('hidden');
    if (type === 'joystick') joystickZone?.classList.remove('hidden');

    // Center joystick / dpad when there are no action buttons
    if (!hasActions) {
      tc.setAttribute('data-nav-only', '');
      tc.removeAttribute('data-has-actions');
    } else {
      tc.removeAttribute('data-nav-only');
      tc.setAttribute('data-has-actions', '');
    }
  }

  function hide() {
    document.getElementById('touch-controls')?.classList.add('hidden');
    document.getElementById('pc-key-hints')?.classList.add('hidden');
    resetPause();
  }

  /* ══════════════════════════════════════════════════════════
     INIT (once, on app boot)
  ══════════════════════════════════════════════════════════ */
  function init() {
    initPauseBtn();
    initDpad();
    initJoystick();
    // Swipe is attached per-game in show(), but we init globally too
    // (attaches to the iframe wrap which is always present)
  }

  return { init, show, hide, isTouchDevice, togglePause, resetPause };
})();
