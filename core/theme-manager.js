/* ================================================
   THEME MANAGER
   ================================================ */

const ThemeManager = (() => {

  const STORAGE_KEY = 'gamezone_theme';
  const THEMES = ['neon', 'fire', 'ocean', 'forest', 'gold'];
  let current = 'neon';

  // Apply theme to document
  function apply(theme) {
    if (!THEMES.includes(theme)) theme = 'neon';
    current = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    updateUI();
  }

  // Update theme panel UI
  function updateUI() {
    document.querySelectorAll('.theme-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === current);
    });
  }

  // Load saved theme
  function load() {
    const saved = localStorage.getItem(STORAGE_KEY) || 'neon';
    apply(saved);
  }

  // Get current theme
  function getCurrent() { return current; }

  // Cycle to next theme
  function cycleNext() {
    const idx  = THEMES.indexOf(current);
    const next = THEMES[(idx + 1) % THEMES.length];
    apply(next);
    return next;
  }

  return { apply, load, getCurrent, cycleNext, THEMES };

})();