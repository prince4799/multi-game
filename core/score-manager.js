/* ── SCORE MANAGER ── */
const ScoreManager = (() => {
  const KEY = 'ga_scores';

  function getAll() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch { return {}; }
  }

  function getBest(gameId) {
    return getAll()[gameId] || 0;
  }

  function setBest(gameId, score) {
    const all = getAll();
    if (score > (all[gameId] || 0)) {
      all[gameId] = score;
      localStorage.setItem(KEY, JSON.stringify(all));
      return true; // new record
    }
    return false;
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem('ga_history')) || []; }
    catch { return []; }
  }

  function addHistory(gameId, score) {
    const h = getHistory();
    h.unshift({ gameId, score, ts: Date.now() });
    if (h.length > 50) h.pop();
    localStorage.setItem('ga_history', JSON.stringify(h));
  }

  return { getBest, setBest, getAll, getHistory, addHistory };
})();
