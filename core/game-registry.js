/* ================================================
   GAME REGISTRY
   Central database for all games.
   To add a new game: just call GameRegistry.register({...})
   from your game file!
   ================================================ */

const GameRegistry = (() => {

  // Internal games list
  let games = [];

  // Category definitions
  const categories = {
    'brain-train': { label: 'Brain Train', icon: '🧠', color: '#bf00ff' },
    'puzzle':      { label: 'Puzzle',      icon: '🧩', color: '#00cfff' },
    'racing':      { label: 'Racing',      icon: '🏎️', color: '#ff9500' },
    'shooting':    { label: 'Shooting',    icon: '🔫', color: '#ff3232' }
  };

  /*
    Register a game.
    Required fields:
      id          - unique string e.g. 'memory-match'
      title       - display name
      category    - 'brain-train' | 'puzzle' | 'racing' | 'shooting'
      description - short description
      emoji       - emoji for thumbnail
      init        - function(container) that starts the game

    Optional fields:
      difficulty  - 'easy' | 'medium' | 'hard'  (default: 'medium')
      controls    - { dpad, actions, center }     (default: all true)
      version     - string e.g. '1.0'
  */
  function register(gameConfig) {
    // Validate required fields
    const required = ['id', 'title', 'category', 'description', 'emoji', 'init'];
    const missing  = required.filter(f => !gameConfig[f]);

    if (missing.length) {
      console.error(`GameRegistry: Missing fields for game: ${missing.join(', ')}`);
      return false;
    }

    if (!categories[gameConfig.category]) {
      console.error(`GameRegistry: Unknown category "${gameConfig.category}"`);
      return false;
    }

    // Check for duplicate ID
    if (games.find(g => g.id === gameConfig.id)) {
      console.warn(`GameRegistry: Game "${gameConfig.id}" already registered`);
      return false;
    }

    // Set defaults
    const game = {
      difficulty: 'medium',
      controls: { dpad: true, actions: true, center: true },
      version: '1.0',
      ...gameConfig
    };

    games.push(game);
    console.log(`GameRegistry: ✅ Registered "${game.title}"`);
    return true;
  }

  // Get all games
  function getAll() { return [...games]; }

  // Get games by category
  function getByCategory(category) {
    return games.filter(g => g.category === category);
  }

  // Get single game by ID
  function getById(id) {
    return games.find(g => g.id === id) || null;
  }

  // Search games by title or description
  function search(query) {
    const q = query.toLowerCase().trim();
    if (!q) return [...games];
    return games.filter(g =>
      g.title.toLowerCase().includes(q) ||
      g.description.toLowerCase().includes(q) ||
      g.category.includes(q)
    );
  }

  // Get total count
  function count() { return games.length; }

  // Get count by category
  function countByCategory(category) {
    return games.filter(g => g.category === category).length;
  }

  // Get category info
  function getCategoryInfo(category) {
    return categories[category] || null;
  }

  // Get all categories
  function getCategories() { return { ...categories }; }

  return {
    register,
    getAll,
    getByCategory,
    getById,
    search,
    count,
    countByCategory,
    getCategoryInfo,
    getCategories
  };

})();