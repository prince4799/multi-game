/**
 * Dashboard3D — Premium Three.js visual engine for GamerZ Arena
 * Handles the background neon grid and the interactive hero scene.
 */
import * as THREE from 'https://cdn.skypack.dev/three@0.150.1';

const Dashboard3D = (() => {
    let bgScene, bgCamera, bgRenderer, grid;
    let heroScene, heroCamera, heroRenderer, heroGroup;
    let mouse = { x: 0, y: 0 };
    let targetMouse = { x: 0, y: 0 };

    function initBackground() {
        const canvas = document.getElementById('bg-3d-canvas');
        if (!canvas) return;

        bgScene = new THREE.Scene();
        bgCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        bgCamera.position.z = 30;

        bgRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        bgRenderer.setSize(window.innerWidth, window.innerHeight);
        bgRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Create Neon Grid
        const size = 100;
        const divisions = 25;
        grid = new THREE.GridHelper(size, divisions, 0x00f5ff, 0xbf00ff);
        grid.rotation.x = Math.PI / 2;
        grid.position.z = -10;
        grid.material.transparent = true;
        grid.material.opacity = 0.15;
        bgScene.add(grid);

        // Add some ambient particles
        const points = [];
        for (let i = 0; i < 200; i++) {
            points.push(new THREE.Vector3(
                (Math.random() - 0.5) * 100,
                (Math.random() - 0.5) * 100,
                (Math.random() - 0.5) * 50
            ));
        }
        const starGeo = new THREE.BufferGeometry().setFromPoints(points);
        const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 });
        const stars = new THREE.Points(starGeo, starMat);
        bgScene.add(stars);
    }

    function initHero() {
        const container = document.querySelector('.hero-right');
        if (!container) return;
        
        // Remove old orbs if present
        const oldOrbs = container.querySelector('.hero-orbs');
        if (oldOrbs) oldOrbs.remove();

        const canvas = document.createElement('canvas');
        canvas.id = 'hero-3d-canvas';
        container.appendChild(canvas);

        const rect = container.getBoundingClientRect();
        heroScene = new THREE.Scene();
        heroCamera = new THREE.PerspectiveCamera(45, rect.width / rect.height, 0.1, 1000);
        heroCamera.position.z = 20;

        heroRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        heroRenderer.setSize(rect.width, rect.height);
        heroRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        heroGroup = new THREE.Group();
        heroScene.add(heroGroup);

        // Add premium geometric objects
        const geometries = [
            new THREE.IcosahedronGeometry(3, 0),
            new THREE.TorusKnotGeometry(2, 0.6, 100, 16),
            new THREE.OctahedronGeometry(2.5, 0),
            new THREE.BoxGeometry(3, 3, 3)
        ];

        const colors = [0x00f5ff, 0xbf00ff, 0xff006e, 0x00ff88];

        geometries.forEach((geo, i) => {
            const mat = new THREE.MeshPhysicalMaterial({
                color: colors[i],
                emissive: colors[i],
                emissiveIntensity: 0.5,
                metalness: 0.8,
                roughness: 0.2,
                transparent: true,
                opacity: 0.9,
                wireframe: i % 2 === 0
            });
            const mesh = new THREE.Mesh(geo, mat);
            
            // Scatter them
            mesh.position.set(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 5
            );
            mesh.userData.rotationSpeed = {
                x: Math.random() * 0.01 + 0.005,
                y: Math.random() * 0.01 + 0.005
            };
            heroGroup.add(mesh);
        });

        const light = new THREE.PointLight(0xffffff, 1, 100);
        light.position.set(10, 10, 10);
        heroScene.add(light);
        heroScene.add(new THREE.AmbientLight(0x404040));
    }

    function onMouseMove(e) {
        targetMouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
        targetMouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    }

    function animate() {
        requestAnimationFrame(animate);

        // Smooth mouse following
        mouse.x += (targetMouse.x - mouse.x) * 0.05;
        mouse.y += (targetMouse.y - mouse.y) * 0.05;

        // Background grid tilt
        if (grid) {
            grid.rotation.y = mouse.x * 0.05;
            grid.rotation.x = (Math.PI / 2) + (mouse.y * 0.05);
        }

        // Hero objects rotation
        if (heroGroup) {
            heroGroup.children.forEach(mesh => {
                mesh.rotation.x += mesh.userData.rotationSpeed.x;
                mesh.rotation.y += mesh.userData.rotationSpeed.y;
            });
            heroGroup.rotation.y = mouse.x * 0.2;
            heroGroup.rotation.x = -mouse.y * 0.2;
        }

        if (bgRenderer && bgScene && bgCamera) bgRenderer.render(bgScene, bgCamera);
        if (heroRenderer && heroScene && heroCamera) heroRenderer.render(heroScene, heroCamera);
    }

    function handleResize() {
        if (bgRenderer && bgCamera) {
            bgCamera.aspect = window.innerWidth / window.innerHeight;
            bgCamera.updateProjectionMatrix();
            bgRenderer.setSize(window.innerWidth, window.innerHeight);
        }
        const container = document.querySelector('.hero-right');
        if (container && heroRenderer && heroCamera) {
            const rect = container.getBoundingClientRect();
            heroCamera.aspect = rect.width / rect.height;
            heroCamera.updateProjectionMatrix();
            heroRenderer.setSize(rect.width, rect.height);
        }
    }

    function init() {
        initBackground();
        initHero();
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('resize', handleResize);
        animate();
    }

    return { init };
})();

// Wait for DOM to ensure hero-right is present
document.addEventListener('DOMContentLoaded', Dashboard3D.init);

export default Dashboard3D;
