/* ================================================
   SCORE MANAGER
   Handles all game scores via localStorage
   ================================================ */

const ScoreManager = (() => {

  const STORAGE_KEY = 'gamezone_scores';

  // Get all scores
  function getAllScores() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  // Save all scores
  function saveAllScores(scores) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    } catch (e) {
      console.warn('ScoreManager: Could not save scores', e);
    }
  }

  // Get best score for a game
  function getBestScore(gameId) {
    const scores = getAllScores();
    return scores[gameId] || 0;
  }

  // Submit new score - returns true if new best
  function submitScore(gameId, score) {
    const scores  = getAllScores();
    const current = scores[gameId] || 0;
    const isNewBest = score > current;

    if (isNewBest) {
      scores[gameId] = score;
      saveAllScores(scores);
    }

    return isNewBest;
  }

  // Reset score for one game
  function resetScore(gameId) {
    const scores = getAllScores();
    delete scores[gameId];
    saveAllScores(scores);
  }

  // Reset all scores
  function resetAllScores() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // Get top scores sorted (for leaderboard if needed)
  function getTopScores(limit = 10) {
    const scores = getAllScores();
    return Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([gameId, score]) => ({ gameId, score }));
  }

  return {
    getBestScore,
    submitScore,
    resetScore,
    resetAllScores,
    getTopScores,
    getAllScores
  };

})();