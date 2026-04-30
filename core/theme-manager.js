/* ── THEME MANAGER ── */
const ThemeManager = (() => {
  const THEMES = ['neon','fire','ocean','forest','gold','light','sunset','cyber'];
  const KEY = 'ga_theme';
  let current = localStorage.getItem(KEY) || 'neon';
  const listeners = [];

  function apply(theme) {
    if (!THEMES.includes(theme)) theme = 'neon';
    current = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
    document.querySelectorAll('.theme-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
    // Broadcast to any active game iframe
    if (typeof IframeBridge !== 'undefined') {
      IframeBridge.sendToGame({ type: 'THEME', theme });
    }
    // Notify all onChange listeners
    listeners.forEach(fn => { try { fn(theme); } catch(e) { console.warn(e); } });
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  function init() {
    apply(current);
    document.getElementById('theme-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      const panel = document.getElementById('theme-panel');
      panel?.classList.toggle('hidden');
    });
    document.getElementById('close-theme-btn')?.addEventListener('click', () => {
      document.getElementById('theme-panel')?.classList.add('hidden');
    });
    document.querySelectorAll('.theme-opt').forEach(btn => {
      btn.addEventListener('click', () => { apply(btn.dataset.theme); });
    });
    document.addEventListener('click', e => {
      const panel = document.getElementById('theme-panel');
      if (panel && !panel.classList.contains('hidden') &&
          !panel.contains(e.target) &&
          e.target.id !== 'theme-btn') {
        panel.classList.add('hidden');
      }
    });
  }

  return { init, apply, current: () => current, onChange };
})();
