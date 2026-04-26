import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';

export const THEMES = {
    DAY: {
        sky: 0x87ceeb, light: 1.2, amb: 0.5, sun: 0xffcc33, stars: 0,
        water: 0x0077be, sand: 0xe3c18d, name: 'Clear Beach'
    },
    NIGHT: {
        sky: 0x050510, light: 0.1, amb: 0.1, sun: 0xddddff, stars: 1,
        water: 0x001e3c, sand: 0x2c1e14, name: 'Midnight'
    },
    STORM: {
        sky: 0x1a252f, light: 0.3, amb: 0.2, sun: 0x444444, stars: 0,
        water: 0x141a1f, sand: 0x3e2c1c, name: 'Cloudy Storm'
    },
    DAWN: {
        sky: 0xff7e5f, light: 0.8, amb: 0.4, sun: 0xffaa00, stars: 0,
        water: 0x1e3c5a, sand: 0x5d4037, name: 'Golden Dawn'
    }
};

export class EnvironmentManager {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.birds = [];
        this.init();
    }

    init() {
        // --- SKYBOX ---
        this.scene.background = new THREE.Color(0x87ceeb);

        // --- REALISTIC WATER ---
        const waterGeometry = new THREE.PlaneGeometry(1000, 1000);
        this.water = new Water(waterGeometry, {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: new THREE.TextureLoader().load('https://threejs.org/examples/textures/waternormals.jpg', function (texture) {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            }),
            sunDirection: new THREE.Vector3(),
            sunColor: 0xffffff,
            waterColor: 0x001e3f,
            distortionScale: 3.7,
            fog: this.scene.fog !== undefined
        });
        this.water.rotation.x = -Math.PI / 2;
        this.water.position.y = -5.8;
        this.water.position.z = -200; // Far sea
        this.scene.add(this.water);

        // --- REALISTIC SAND ---
        const sandGeo = new THREE.PlaneGeometry(200, 100);
        this.sandMat = new THREE.MeshStandardMaterial({ 
            color: 0xe3c18d, 
            roughness: 0.9,
            metalness: 0.1,
            normalMap: new THREE.TextureLoader().load('https://threejs.org/examples/textures/terrain/grasslight-big_nm.jpg')
        });
        this.sand = new THREE.Mesh(sandGeo, this.sandMat);
        this.sand.rotation.x = -Math.PI / 2;
        this.sand.position.y = -6;
        this.sand.position.z = 20; // Shoreline
        this.sand.receiveShadow = true;
        this.scene.add(this.sand);

        // --- SUN / MOON ---
        this.sun = new THREE.PointLight(0xffffff, 1, 500);
        this.sun.castShadow = true;
        this.scene.add(this.sun);
        
        const sunVisualGeo = new THREE.SphereGeometry(2, 32, 32);
        this.sunVisualMat = new THREE.MeshBasicMaterial({ color: 0xffcc33 });
        this.sunVisual = new THREE.Mesh(sunVisualGeo, this.sunVisualMat);
        this.scene.add(this.sunVisual);

        // --- STARS ---
        const starGeo = new THREE.BufferGeometry();
        const starCoords = [];
        for(let i=0; i<3000; i++) {
            starCoords.push((Math.random()-0.5)*400, Math.random()*200, (Math.random()-0.5)*400);
        }
        starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starCoords, 3));
        this.starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1, transparent: true, opacity: 0 });
        this.stars = new THREE.Points(starGeo, this.starsMat);
        this.scene.add(this.stars);

        // --- BIRDS ---
        for(let i=0; i<8; i++) this.birds.push(new Bird(this.scene));
    }

    update(time, currentTheme, targetTheme, lerp) {
        // Theme Interpolation
        const bgColor = new THREE.Color(currentTheme.sky).lerp(new THREE.Color(targetTheme.sky), lerp);
        this.scene.background = bgColor;
        
        const sunColor = new THREE.Color(currentTheme.sun).lerp(new THREE.Color(targetTheme.sun), lerp);
        this.sunVisualMat.color.copy(sunColor);
        this.sun.color.copy(sunColor);
        
        this.starsMat.opacity = THREE.MathUtils.lerp(currentTheme.stars, targetTheme.stars, lerp);
        this.water.material.uniforms['waterColor'].value.lerp(new THREE.Color(targetTheme.water), 0.01);
        this.sandMat.color.lerp(new THREE.Color(targetTheme.sand), 0.01);

        // Animation
        const sunOrbit = time * 0.05;
        this.sun.position.set(Math.cos(sunOrbit)*100, Math.sin(sunOrbit)*100, -80);
        this.sunVisual.position.copy(this.sun.position);
        
        this.water.material.uniforms['time'].value += 1.0 / 60.0;
        this.water.material.uniforms['sunDirection'].value.copy(this.sun.position).normalize();

        this.birds.forEach(b => b.update(time));
    }
}

class Bird {
    constructor(scene) {
        const group = new THREE.Group();
        const wingGeo = new THREE.PlaneGeometry(0.5, 0.15);
        const wingMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
        this.leftWing = new THREE.Mesh(wingGeo, wingMat);
        this.rightWing = new THREE.Mesh(wingGeo, wingMat);
        this.leftWing.position.x = -0.25;
        this.rightWing.position.x = 0.25;
        group.add(this.leftWing, this.rightWing);
        this.mesh = group;
        this.reset();
        scene.add(this.mesh);
    }
    reset() {
        this.mesh.position.set(-80 - Math.random()*50, 15 + Math.random()*15, (Math.random()-0.5)*60);
        this.speed = 0.15 + Math.random()*0.15;
    }
    update(time) {
        this.mesh.position.x += this.speed;
        const flap = Math.sin(time * 6 + this.mesh.position.x) * 0.6;
        this.leftWing.rotation.z = flap;
        this.rightWing.rotation.z = -flap;
        if(this.mesh.position.x > 80) this.reset();
    }
}
