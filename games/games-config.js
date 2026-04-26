/**
 * GamerZ Arena — Static Game Registry
 *
 * controls schema:
 *   controlType : 'dpad'     — classic 4-way pad (Snake, Tetris, Sliding Puzzle)
 *               | 'joystick' — analog joystick (Space Dog)
 *               | 'none'     — tap/click only (Brain Train games, Memory, Space Dog self-managed)
 *   keyboard    : true/false — PC arrow/WASD keys active
 *   mouse       : false | 'aim' | 'rotate' — forward mouse events to game
 *   swipe       : true/false — swipe gestures on mobile (fallback for dpad)
 *   actions     : []         — on-screen buttons (PC hint + mobile button)
 *     { id, label, icon, key, color, side }
 *       side: 'left' | 'right'
 *       color: 'primary' | 'danger' | 'success' | 'warning' | 'info'
 */

const GAMES = [
  // ── RACING ─────────────────────────────────────────────────────────


  // ── ARCADE ────────────────────────────────────────────────────────
  {
    id: 'snake',
    title: 'Snake Classic',
    category: 'arcade',
    icon: 'fas fa-staff-snake',
    description: "Eat food, grow longer, don't hit the walls!",
    htmlFile: 'games/snake/index.html',
    controls: {
      controlType: 'joystick',
      keyboard: true,
      mouse: false,
      swipe: false,
      actions: []
    },
    difficulty: 'easy',
    ageRating: 'all',
    tags: ['snake', 'classic', 'arcade', 'retro'],
    featured: true
  },

  // ── BRAIN TRAIN ───────────────────────────────────────────────────
  {
    id: 'chess',
    title: 'Chess',
    category: 'brain-train',
    icon: 'fas fa-chess-knight',
    description: 'Train your brain with chess!',
    htmlFile: 'games/brain-train/chess/index.html',
    controls: {
      controlType: 'none',
      keyboard: false,
      mouse: false,
      swipe: false,
      actions: []
    },
    difficulty: 'medium',
    ageRating: 'all',
    tags: ['brain-train', 'chess'],
    featured: true
  },

  {
    id: 'math-speed',
    title: 'Math Speed',
    category: 'brain-train',
    icon: 'fas fa-bolt',
    description: 'Race against the clock — pick the correct answer to maths questions!',
    htmlFile: 'games/brain-train/math-speed/index.html',
    controls: {
      controlType: 'none',
      keyboard: false,
      mouse: false,
      swipe: false,
      actions: []
    },
    difficulty: 'medium',
    ageRating: 'all',
    tags: ['math', 'brain', 'speed', 'quiz'],
    featured: true
  },
  {
    id: 'math-beach-shooter',
    title: 'Math Beach Shooter',
    category: 'brain-train',
    icon: 'fas fa-crosshairs',
    description: 'Tactical math shooting! Blast the correct answer cubes in a beautiful 3D beach arena.',
    htmlFile: 'games/basics/projectile-cubes/index.html',
    controls: {
      controlType: 'none',
      keyboard: false,
      mouse: false,
      swipe: false,
      actions: []
    },
    difficulty: 'hard',
    ageRating: 'all',
    tags: ['math', '3d', 'shooter', 'brain', 'speed'],
    featured: true
  },
  {
    id: 'memory-match',
    title: 'Memory Match',
    category: 'brain-train',
    icon: 'fas fa-clone',
    description: 'Flip cards to find all matching pairs before time runs out!',
    htmlFile: 'games/brain-train/memory-match/index.html',
    controls: {
      controlType: 'none',
      keyboard: false,
      mouse: false,
      swipe: false,
      actions: []
    },
    difficulty: 'easy',
    ageRating: 'all',
    tags: ['memory', 'cards', 'brain', 'match'],
    featured: false
  },
  

  // ── PUZZLE ────────────────────────────────────────────────────────
  {
    id: 'tetris',
    title: 'Tetris Classic',
    category: 'puzzle',
    icon: 'fas fa-cubes',
    description: 'Classic Tetris with ghost piece, combos & escalating levels!',
    htmlFile: 'games/puzzle/tetris/index.html',
    controls: {
      controlType: 'joystick',   // same joystick as Snake (left/right/down = move, up = rotate)
      keyboard: true,
      mouse: false,
      swipe: false,
      actions: [
        {
          id: 'rotate-cw',
          label: 'ROTATE',
          icon: '↻',
          imgSrc: 'games/puzzle/tetris/assets/rotate-cw.png',
          key: 'ArrowUp',
          color: 'primary',
          side: 'right'
        },
        {
          id: 'hard-drop',
          label: 'DROP',
          icon: '⬇',
          imgSrc: 'games/puzzle/tetris/assets/drop.png',
          key: ' ',
          color: 'warning',
          side: 'right'
        },
        {
          id: 'rotate-ccw',
          label: 'ROT ↺',
          icon: '↺',
          imgSrc: 'games/puzzle/tetris/assets/rotate-ccw.png',
          key: 'z',
          color: 'info',
          side: 'right'
        }
      ]
    },
    difficulty: 'medium',
    ageRating: 'all',
    tags: ['tetris', 'blocks', 'puzzle', 'classic'],
    featured: true
  },
  {
    id: 'sliding-puzzle',
    title: 'Sliding Puzzle',
    category: 'puzzle',
    icon: 'fas fa-th',
    description: 'Slide tiles into order — choose 3×3, 4×4 or brutal 5×5!',
    htmlFile: 'games/puzzle/sliding-puzzle/index.html',
    controls: {
      controlType: 'none',
      keyboard: true,
      mouse: false,
      swipe: false,
      actions: []
    },
    difficulty: 'medium',
    ageRating: 'all',
    tags: ['sliding', 'puzzle', 'tiles', 'logic'],
    featured: false
  },

  // ── SHOOTING ──────────────────────────────────────────────────────
  {
    id: 'space-dog',
    title: 'Super Space Dog',
    category: 'shooting',
    icon: 'fas fa-rocket',
    description: 'A brave dog in space! Dodge comets and fight to survive the cosmos.',
    htmlFile: 'games/shooting/space-dog/index.html',
    controls: {
      controlType: 'none',   // Space Dog manages its own joystick + fire canvas internally
      keyboard: true,
      mouse: false,
      swipe: false,
      actions: []
    },
    difficulty: 'hard',
    ageRating: 'all',
    tags: ['space', 'dog', 'shooting', 'action', 'survive'],
    featured: true
  },

  // ── ACTION ────────────────────────────────────────────────────────
  {
    id: 'shadow-strike',
    title: 'Shadow Strike',
    category: 'action',
    icon: 'fas fa-user-ninja',
    description: 'Sneak through facilities, eliminate guards from behind, and reach the exit!',
    htmlFile: 'games/action/shadow-strike/index.html',
    controls: {
      controlType: 'joystick',
      keyboard: true,
      mouse: false,
      swipe: false,
      actions: [
        { id: 'throw', icon: '🎯', label: 'Throw', key: ' ' }
      ]
    },
    difficulty: 'hard',
    ageRating: 'all',
    tags: ['stealth', 'ninja', 'action', 'maze'],
    featured: true
  }
];

const CATEGORIES = [
  { id: 'arcade',      label: 'Arcade',      icon: 'fas fa-gamepad', description: 'Fast reflexes, instant fun'    },
  { id: 'brain-train', label: 'Brain Train',  icon: 'fas fa-brain',   description: 'Boost your mind & memory'      },
  { id: 'puzzle',      label: 'Puzzle',       icon: 'fas fa-puzzle-piece', description: 'Solve, think, win'              },
  { id: 'shooting',    label: 'Shooting',     icon: 'fas fa-crosshairs', description: 'Aim, fire, survive'             },
  { id: 'action',      label: 'Action',       icon: 'fas fa-bolt',   description: 'High stakes, stealth, and speed'}
];

window.GAMES_CONFIG = { GAMES, CATEGORIES };
