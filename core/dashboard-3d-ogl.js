/**
 * Dashboard3DOGL — Premium OGL visual engine for GamerZ Arena
 * Renders animated background grid, particle field, and hero 3D shapes.
 * Theme-reactive: reads CSS variables and transitions colors smoothly.
 */
const Dashboard3DOGL = (() => {
  const { Renderer, Camera, Transform, Program, Mesh, Box, Sphere, Color, Geometry, Vec3 } = ogl;

  // ─── State ───
  let bgRenderer, bgCamera, bgScene;
  let gridMesh, particleMesh;
  let mouse = { x: 0, y: 0 }, targetMouse = { x: 0, y: 0 };
  let time = 0;
  let currentColors = { primary: [0, 0.96, 1], secondary: [0.75, 0, 1], accent: [1, 0, 0.43] };
  let targetColors = { ...currentColors };
  let animId = null;

  // ─── Theme Color Extraction ───
  function hexToGL(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
  }

  function readThemeColors() {
    const s = getComputedStyle(document.documentElement);
    const p = s.getPropertyValue('--primary').trim();
    const sec = s.getPropertyValue('--secondary').trim();
    const acc = s.getPropertyValue('--accent').trim();
    if (p) targetColors.primary = hexToGL(p);
    if (sec) targetColors.secondary = hexToGL(sec);
    if (acc) targetColors.accent = hexToGL(acc);
  }

  function lerpColor(cur, tgt, t) {
    return [
      cur[0] + (tgt[0] - cur[0]) * t,
      cur[1] + (tgt[1] - cur[1]) * t,
      cur[2] + (tgt[2] - cur[2]) * t
    ];
  }

  // ═══════════════════════════════════════
  //   BACKGROUND SCENE — Grid + Particles
  // ═══════════════════════════════════════
  const bgVert = /* glsl */`
    attribute vec3 position;
    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;
    uniform float uTime;
    varying vec3 vPos;
    void main() {
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const gridFrag = /* glsl */`
    precision highp float;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform float uTime;
    varying vec3 vPos;
    void main() {
      float lineW = 0.06;
      float gridSize = 2.0;
      vec2 p = vPos.xz + vec2(0.0, uTime * 2.0);
      vec2 g = abs(fract(p / gridSize - 0.5) - 0.5) * gridSize;
      float line = min(g.x, g.y);
      float alpha = smoothstep(lineW, 0.0, line) * 0.35;
      float d = length(vPos.xz) / 30.0;
      alpha *= max(0.0, 1.0 - d);
      vec3 col = mix(uColor1, uColor2, sin(uTime * 0.3 + vPos.x * 0.1) * 0.5 + 0.5);
      gl_FragColor = vec4(col, alpha);
    }
  `;

  const particleVert = /* glsl */`
    attribute vec3 position;
    attribute float aSize;
    attribute float aSpeed;
    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;
    uniform float uTime;
    varying float vAlpha;
    void main() {
      vec3 pos = position;
      pos.y += sin(uTime * aSpeed + position.x * 2.0) * 1.5;
      pos.x += cos(uTime * aSpeed * 0.7 + position.z) * 0.5;
      float dist = length(pos.xz) / 40.0;
      vAlpha = max(0.0, 1.0 - dist) * 0.6;
      vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = aSize * (200.0 / -mvPos.z);
      gl_Position = projectionMatrix * mvPos;
    }
  `;

  const particleFrag = /* glsl */`
    precision highp float;
    uniform vec3 uColor;
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      if (d > 1.0) discard;
      float glow = exp(-d * d * 3.0);
      gl_FragColor = vec4(uColor, glow * vAlpha);
    }
  `;

  function initBackground() {
    const canvas = document.getElementById('bg-3d-canvas');
    if (!canvas) return;

    bgRenderer = new Renderer({ canvas, dpr: Math.min(window.devicePixelRatio, 2), alpha: true, premultipliedAlpha: false });
    const gl = bgRenderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    bgCamera = new Camera(gl, { fov: 60 });
    bgCamera.position.set(0, 18, 24);
    bgCamera.lookAt([0, 0, 0]);

    bgScene = new Transform();

    // ── Grid Plane ──
    const gridGeo = new Geometry(gl, {
      position: { size: 3, data: new Float32Array([
        -40, 0, -40, 40, 0, -40, 40, 0, 40,
        -40, 0, -40, 40, 0, 40, -40, 0, 40
      ])}
    });
    const gridProg = new Program(gl, {
      vertex: bgVert, fragment: gridFrag,
      uniforms: {
        uColor1: { value: new Float32Array(currentColors.primary) },
        uColor2: { value: new Float32Array(currentColors.secondary) },
        uTime: { value: 0 }
      },
      transparent: true, depthTest: false
    });
    gridMesh = new Mesh(gl, { geometry: gridGeo, program: gridProg });
    gridMesh.setParent(bgScene);

    // ── Particles ──
    const pCount = 250;
    const pPos = new Float32Array(pCount * 3);
    const pSize = new Float32Array(pCount);
    const pSpeed = new Float32Array(pCount);
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 60;
      pPos[i * 3 + 1] = Math.random() * 20 + 2;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 60;
      pSize[i] = Math.random() * 3 + 1;
      pSpeed[i] = Math.random() * 0.4 + 0.1;
    }
    const pGeo = new Geometry(gl, {
      position: { size: 3, data: pPos },
      aSize: { size: 1, data: pSize },
      aSpeed: { size: 1, data: pSpeed }
    });
    const pProg = new Program(gl, {
      vertex: particleVert, fragment: particleFrag,
      uniforms: {
        uColor: { value: new Float32Array(currentColors.primary) },
        uTime: { value: 0 }
      },
      transparent: true, depthTest: false
    });
    particleMesh = new Mesh(gl, { mode: gl.POINTS, geometry: pGeo, program: pProg });
    particleMesh.setParent(bgScene);

    bgRenderer.setSize(window.innerWidth, window.innerHeight);
    bgCamera.perspective({ aspect: window.innerWidth / window.innerHeight });
  }


  // ═══════════════════════════════════════
  //   ANIMATION LOOP
  // ═══════════════════════════════════════
  function animate(t) {
    animId = requestAnimationFrame(animate);
    time = t * 0.001;

    // Smooth mouse
    mouse.x += (targetMouse.x - mouse.x) * 0.04;
    mouse.y += (targetMouse.y - mouse.y) * 0.04;

    // Lerp theme colors
    currentColors.primary = lerpColor(currentColors.primary, targetColors.primary, 0.03);
    currentColors.secondary = lerpColor(currentColors.secondary, targetColors.secondary, 0.03);
    currentColors.accent = lerpColor(currentColors.accent, targetColors.accent, 0.03);

    // ── Background ──
    if (bgRenderer && bgScene && bgCamera) {
      // Update grid colors
      if (gridMesh) {
        gridMesh.program.uniforms.uTime.value = time;
        gridMesh.program.uniforms.uColor1.value[0] = currentColors.primary[0];
        gridMesh.program.uniforms.uColor1.value[1] = currentColors.primary[1];
        gridMesh.program.uniforms.uColor1.value[2] = currentColors.primary[2];
        gridMesh.program.uniforms.uColor2.value[0] = currentColors.secondary[0];
        gridMesh.program.uniforms.uColor2.value[1] = currentColors.secondary[1];
        gridMesh.program.uniforms.uColor2.value[2] = currentColors.secondary[2];
      }
      if (particleMesh) {
        particleMesh.program.uniforms.uTime.value = time;
        particleMesh.program.uniforms.uColor.value[0] = currentColors.primary[0];
        particleMesh.program.uniforms.uColor.value[1] = currentColors.primary[1];
        particleMesh.program.uniforms.uColor.value[2] = currentColors.primary[2];
      }

      // Camera parallax
      bgCamera.position.x = mouse.x * 3;
      bgCamera.position.y = 18 + mouse.y * 2;
      bgCamera.lookAt([0, 0, 0]);

      bgRenderer.render({ scene: bgScene, camera: bgCamera });
    }
  }

  // ═══════════════════════════════════════
  //   RESIZE & EVENTS
  // ═══════════════════════════════════════
  function handleResize() {
    if (bgRenderer && bgCamera) {
      bgRenderer.setSize(window.innerWidth, window.innerHeight);
      bgCamera.perspective({ aspect: window.innerWidth / window.innerHeight });
    }
  }

  function onMouseMove(e) {
    targetMouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
    targetMouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
  }

  function onThemeChange() {
    // Small delay to let CSS vars apply
    setTimeout(() => readThemeColors(), 50);
  }

  // ═══════════════════════════════════════
  //   INTERSECTION OBSERVER for card animations
  // ═══════════════════════════════════════
  function initCardAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('card-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

    // Observe existing and future cards via MutationObserver
    const watchGrids = () => {
      document.querySelectorAll('.game-card:not(.card-observed), .cat-card:not(.card-observed)').forEach((card, i) => {
        card.classList.add('card-observed');
        card.style.setProperty('--card-index', i % 12);
        observer.observe(card);
      });
    };
    watchGrids();

    // Watch for dynamically injected cards
    const mutObs = new MutationObserver(watchGrids);
    const grids = document.querySelectorAll('.games-grid, .cat-grid');
    grids.forEach(g => mutObs.observe(g, { childList: true }));
  }

  // ═══════════════════════════════════════
  //   NAVBAR SCROLL EFFECT
  // ═══════════════════════════════════════
  function initNavbarEffect() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrolled = window.scrollY > 60;
          navbar.classList.toggle('navbar-scrolled', scrolled);
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  // ═══════════════════════════════════════
  //   STATS COUNTER ANIMATION
  // ═══════════════════════════════════════
  function initStatsCounter() {
    const statVals = document.querySelectorAll('.stat-val[id]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const finalVal = parseInt(el.textContent);
          if (isNaN(finalVal)) return;
          let current = 0;
          const step = Math.ceil(finalVal / 30);
          const interval = setInterval(() => {
            current += step;
            if (current >= finalVal) { current = finalVal; clearInterval(interval); }
            el.textContent = current;
          }, 30);
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.5 });
    statVals.forEach(el => observer.observe(el));
  }

  // ═══════════════════════════════════════
  //   PUBLIC INIT
  // ═══════════════════════════════════════
  function init() {
    try {
      readThemeColors();
      initBackground();
      initCardAnimations();
      initNavbarEffect();
      initStatsCounter();

      window.addEventListener('mousemove', onMouseMove, { passive: true });
      window.addEventListener('resize', handleResize);

      // Listen for theme changes
      if (typeof ThemeManager !== 'undefined' && ThemeManager.onChange) {
        ThemeManager.onChange(onThemeChange);
      }

      animate(0);
    } catch (e) {
      console.warn('Dashboard3DOGL: Init failed (OGL may not be loaded)', e);
    }
  }

  return { init, onThemeChange };
})();
