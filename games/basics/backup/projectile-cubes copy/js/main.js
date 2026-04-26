import * as THREE from 'three';
import { THEMES, EnvironmentManager } from './environment.js';
import { ShooterManager, ProjectileCube } from './shooter.js';

// --- INITIALIZATION ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x87ceeb, 0.005);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 2, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// --- ENVIRONMENT & SHOOTER ---
const envMap = null; // We'll rely on ToneMapping and Light for now
const envManager = new EnvironmentManager(scene, camera, renderer);
const shooter = new ShooterManager(scene, camera, null);

// --- AUDIO ---
const listener = new THREE.AudioListener();
camera.add(listener);
const shootSound = new THREE.Audio(listener);
const ambientSound = new THREE.Audio(listener);
const thunderSound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();

const SOUNDS = {
    waves: 'https://cdn.freesound.org/previews/337/337435_5831968-lq.mp3',
    shot: 'https://cdn.freesound.org/previews/174/174436_3242048-lq.mp3',
    thunder: 'https://cdn.freesound.org/previews/347/347492_321967-lq.mp3'
};
audioLoader.load(SOUNDS.shot, buffer => shootSound.setBuffer(buffer));

// --- THEME CYCLE ---
let currentTheme = THEMES.DAY;
let targetTheme = THEMES.DAY;
let themeLerp = 0;

function changeTheme(theme) {
    targetTheme = theme; themeLerp = 0;
    if (ambientSound.isPlaying) ambientSound.stop();
    audioLoader.load(targetTheme.sound, buffer => {
        ambientSound.setBuffer(buffer); ambientSound.setLoop(true); ambientSound.setVolume(0.4); ambientSound.play();
    });
}

// Initial cycle
setInterval(() => {
    const themes = Object.values(THEMES);
    const nextIdx = (themes.indexOf(targetTheme) + 1) % themes.length;
    changeTheme(themes[nextIdx]);
}, 20000);

// --- TARGETS ---
const COLORS = [{main: '#23a4b0'}, {main: '#b63ee6'}, {main: '#e67e22'}];
function getFrustumHeight() { return 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.position.z; }
let cubes = Array.from({length: 3}, (_, i) => new ProjectileCube(scene, i, COLORS, null, getFrustumHeight, camera));

// --- PARTICLES ---
const particles = [];
function createBlast(pos, color) {
    for (let i = 0; i < 20; i++) {
        const frag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 }));
        frag.position.copy(pos);
        frag.velocity = new THREE.Vector3((Math.random()-0.5)*0.8, (Math.random()-0.5)*0.8, (Math.random()-0.5)*0.8);
        frag.life = 1.0;
        scene.add(frag);
        particles.push(frag);
    }
}

// --- INTERACTION ---
const mouse = new THREE.Vector2();
window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    const crosshair = document.getElementById('crosshair');
    if (crosshair) { crosshair.style.left = e.clientX + 'px'; crosshair.style.top = e.clientY + 'px'; }
});
window.addEventListener('mousedown', () => shooter.shoot(mouse, shootSound));
window.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    mouse.x = (t.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(t.clientY / window.innerHeight) * 2 + 1;
    shooter.shoot(mouse, shootSound);
});

// --- ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const time = Date.now() * 0.001;

    // Smooth Theme Transition
    if (themeLerp < 1) {
        themeLerp += 0.003;
        envManager.update(time, currentTheme, targetTheme, themeLerp);
        if (themeLerp >= 1) currentTheme = targetTheme;
    } else {
        envManager.update(time, currentTheme, targetTheme, 1.0);
    }

    // Thunder logic
    if (currentTheme.name === 'Cloudy Storm' && Math.random() > 0.992) {
        envManager.sun.intensity = 10;
        if (!thunderSound.isPlaying) {
            audioLoader.load(SOUNDS.thunder, buffer => { thunderSound.setBuffer(buffer); thunderSound.play(); });
        }
    } else if (currentTheme.name === 'Cloudy Storm') {
        envManager.sun.intensity = THREE.MathUtils.lerp(envManager.sun.intensity, targetTheme.light, 0.1);
    }

    // Managers Update
    shooter.update(mouse);
    shooter.checkCollisions(cubes, createBlast, (c) => c.reset(getFrustumHeight, camera));

    // Particle Updates
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.position.add(p.velocity);
        p.life -= 0.02; p.scale.setScalar(p.life);
        if (p.life <= 0) { scene.remove(p); particles.splice(i, 1); }
    }

    cubes.forEach(c => c.update(getFrustumHeight, camera));
    renderer.render(scene, camera);
}

// Kickstart
changeTheme(THEMES.DAY);
animate();

// Handle Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
