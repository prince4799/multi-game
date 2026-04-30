/**
 * Spell Run 3D - Runner Engine
 * High-performance Three.js Action-Spelling Game
 */

class SpellRun {
  constructor() {
    this.container = document.getElementById('three-canvas-container');
    this.scoreVal = document.getElementById('score-val');
    this.comboVal = document.getElementById('combo-val');
    this.livesVal = document.getElementById('lives-val');
    this.lettersContainer = document.getElementById('letters-container');

    // Game Constants
    this.LANES = [-4, 0, 4];
    this.MOVE_DURATION = 200;
    this.LANE_WIDTH = 4;
    this.SPEED_BASE = 0.45;
    this.BLOCK_SPAWN_Z = -100;
    
    // Game State
    this.state = {
      score: 0,
      combo: 1.0,
      lives: 3,
      speed: this.SPEED_BASE,
      currentLane: 1, // 0: Left, 1: Center, 2: Right
      isJumping: false,
      isCrouching: false,
      targetWord: "SPACE",
      collectedIndex: 0,
      activeBlocks: [],
      gameRunning: true,
      clock: new THREE.Clock()
    };

    this.init();
  }

  async init() {
    // 1. Scene Setup
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x060610, 0.015);
    
    // 2. Camera Setup
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 2, -10);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0x00f5ff, 1);
    dirLight.position.set(5, 10, 5);
    this.scene.add(dirLight);

    // 5. Environment
    this.createBridge();
    this.createBackground();
    this.createPlayer();
    
    // 6. UI Initialization
    this.setNewWord("READY");

    // 7. Event Listeners
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('keydown', (e) => this.handleInput(e));
    this.setupTouchControls();

    // 8. Start Loop
    this.animate();
    this.spawnLoop();
  }

  createBridge() {
    const bridgeGeo = new THREE.BoxGeometry(14, 0.5, 2000);
    const bridgeMat = new THREE.MeshPhysicalMaterial({
      color: 0x111122,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.8,
      emissive: 0x002244
    });
    this.bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
    this.bridge.position.z = -500;
    this.scene.add(this.bridge);

    // Lane Lines
    const lineGeo = new THREE.PlaneGeometry(0.1, 2000);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.3 });
    [-2, 2].forEach(x => {
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.26, -500);
      this.scene.add(line);
    });
  }

  createBackground() {
    const starGeo = new THREE.BufferGeometry();
    const starCount = 2000;
    const pos = new Float32Array(starCount * 3);
    for(let i=0; i<starCount * 3; i++) pos[i] = (Math.random() - 0.5) * 600;
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7 });
    this.stars = new THREE.Points(starGeo, starMat);
    this.scene.add(this.stars);
  }

  createPlayer() {
    // A soft, glowing capsule character
    const bodyGeo = new THREE.CapsuleGeometry(0.8, 1.5, 4, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ 
      color: 0x00f5ff, 
      emissive: 0x00f5ff, 
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0.9
    });
    this.player = new THREE.Mesh(bodyGeo, bodyMat);
    this.player.position.set(this.LANES[this.state.currentLane], 1.5, 0);
    this.scene.add(this.player);
  }

  setNewWord(word) {
    this.state.targetWord = word.toUpperCase();
    this.state.collectedIndex = 0;
    this.lettersContainer.innerHTML = '';
    
    for(let char of this.state.targetWord) {
      const slot = document.createElement('div');
      slot.className = 'letter-slot';
      slot.textContent = char;
      this.lettersContainer.appendChild(slot);
    }
  }

  handleInput(e) {
    if(!this.state.gameRunning) return;
    switch(e.key) {
      case 'ArrowLeft': this.changeLane(-1); break;
      case 'ArrowRight': this.changeLane(1); break;
      case 'ArrowUp': case ' ': this.jump(); break;
      case 'ArrowDown': this.crouch(); break;
    }
  }

  setupTouchControls() {
    let startX, startY;
    window.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    });
    window.addEventListener('touchend', (e) => {
      const deltaX = e.changedTouches[0].clientX - startX;
      const deltaY = e.changedTouches[0].clientY - startY;
      if(Math.abs(deltaX) > Math.abs(deltaY)) {
        if(deltaX > 50) this.changeLane(1);
        else if(deltaX < -50) this.changeLane(-1);
      } else {
        if(deltaY < -50) this.jump();
        else if(deltaY > 50) this.crouch();
      }
    });
  }

  changeLane(dir) {
    const nextLane = THREE.MathUtils.clamp(this.state.currentLane + dir, 0, 2);
    if(nextLane === this.state.currentLane) return;
    
    this.state.currentLane = nextLane;
    new TWEEN.Tween(this.player.position)
      .to({ x: this.LANES[nextLane] }, this.MOVE_DURATION)
      .easing(TWEEN.Easing.Quadratic.Out)
      .start();
  }

  jump() {
    if(this.state.isJumping || this.state.isCrouching) return;
    this.state.isJumping = true;
    new TWEEN.Tween(this.player.position)
      .to({ y: 5 }, 400)
      .easing(TWEEN.Easing.Quadratic.Out)
      .chain(
        new TWEEN.Tween(this.player.position)
          .to({ y: 1.5 }, 300)
          .easing(TWEEN.Easing.Quadratic.In)
          .onComplete(() => { this.state.isJumping = false; })
      )
      .start();
  }

  crouch() {
    if(this.state.isJumping || this.state.isCrouching) return;
    this.state.isCrouching = true;
    this.player.scale.set(1.2, 0.5, 1.2);
    this.player.position.y = 0.75;
    setTimeout(() => {
      this.player.scale.set(1, 1, 1);
      this.player.position.y = 1.5;
      this.state.isCrouching = false;
    }, 600);
  }

  spawnLoop() {
    if(!this.state.gameRunning) return;
    
    // Spawn every 1.5 - 2.5 seconds
    const interval = 1500 + Math.random() * 1000;
    setTimeout(() => {
      this.spawnBlock();
      this.spawnLoop();
    }, interval);
  }

  spawnBlock() {
    const laneIdx = Math.floor(Math.random() * 3);
    const isTarget = Math.random() > 0.4; // 60% chance to spawn target letter
    
    const char = isTarget 
      ? this.state.targetWord[this.state.collectedIndex] 
      : String.fromCharCode(65 + Math.floor(Math.random() * 26));

    const height = Math.random() > 0.7 ? 5 : 1.5; // High or low letter

    // Use a simple box with letter overlay for now (TextGeometry is heavy)
    const blockGeo = new THREE.BoxGeometry(2, 2, 2);
    const blockMat = new THREE.MeshStandardMaterial({ 
      color: isTarget ? 0xbf00ff : 0x444444, 
      emissive: isTarget ? 0xbf00ff : 0x000000,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.9
    });
    const block = new THREE.Mesh(blockGeo, blockMat);
    block.position.set(this.LANES[laneIdx], height, this.BLOCK_SPAWN_Z);
    block.userData = { char, isTarget };
    
    this.scene.add(block);
    this.state.activeBlocks.push(block);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    TWEEN.update();
    
    if(this.state.gameRunning) {
      const dt = this.state.clock.getDelta();
      
      // Move Blocks and Check Collision
      for(let i = this.state.activeBlocks.length - 1; i >= 0; i--) {
        const block = this.state.activeBlocks[i];
        block.position.z += this.state.speed * 60 * dt;
        block.rotation.y += 0.02;

        // Collision Check
        if(block.position.distanceTo(this.player.position) < 2.5) {
          this.handleCollision(block);
          this.cleanupBlock(block, i);
          continue;
        }

        // Cleanup
        if(block.position.z > 20) {
          this.cleanupBlock(block, i);
        }
      }

      // Parallax Background
      this.stars.rotation.z += 0.0005;
      this.bridge.position.z += this.state.speed;
      if(this.bridge.position.z > 500) this.bridge.position.z = -500;
    }

    this.renderer.render(this.scene, this.camera);
  }

  handleCollision(block) {
    const { char, isTarget } = block.userData;
    
    if(isTarget && char === this.state.targetWord[this.state.collectedIndex]) {
      // Correct Letter!
      this.state.score += 100 * this.state.combo;
      this.state.combo += 0.1;
      this.markLetterCollected();
    } else {
      // Wrong Letter or Obstacle
      this.state.lives--;
      this.state.combo = 1.0;
      this.updateLivesUI();
      if(this.state.lives <= 0) this.gameOver();
    }
    
    this.updateStatsUI();
  }

  markLetterCollected() {
    const slots = this.lettersContainer.children;
    if(slots[this.state.collectedIndex]) {
      slots[this.state.collectedIndex].classList.add('filled');
    }
    
    this.state.collectedIndex++;
    
    if(this.state.collectedIndex >= this.state.targetWord.length) {
      // Word Complete!
      this.state.score += 500;
      this.state.speed += 0.05;
      setTimeout(() => {
        const nextWords = ["FUTURE", "NEBULA", "ENERGY", "GALAXY", "PIXEL"];
        this.setNewWord(nextWords[Math.floor(Math.random() * nextWords.length)]);
      }, 500);
    }
  }

  cleanupBlock(block, index) {
    this.scene.remove(block);
    this.state.activeBlocks.splice(index, 1);
  }

  updateStatsUI() {
    this.scoreVal.textContent = Math.floor(this.state.score);
    this.comboVal.textContent = `x${this.state.combo.toFixed(1)}`;
  }

  updateLivesUI() {
    this.livesVal.textContent = "❤️".repeat(Math.max(0, this.state.lives)) + "🖤".repeat(Math.max(0, 3 - this.state.lives));
  }

  gameOver() {
    this.state.gameRunning = false;
    alert("GAME OVER! Score: " + this.state.score);
    window.location.reload();
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Start Game
new SpellRun();
