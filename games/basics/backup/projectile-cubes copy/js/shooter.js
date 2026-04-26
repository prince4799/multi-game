import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export class ShooterManager {
    constructor(scene, camera, envMap) {
        this.scene = scene;
        this.camera = camera;
        this.envMap = envMap;
        this.bullets = [];
        this.particles = [];
        this.recoilAmount = 0;
        this.flashTimer = 0;
        this.init();
    }

    init() {
        this.gun = this.createGun();
    }

    createGun() {
        const gunGroup = new THREE.Group();
        const metalMat = new THREE.MeshPhysicalMaterial({ 
            color: 0x1a1a1a, metalness: 0.9, roughness: 0.3, clearcoat: 0.2, envMap: this.envMap 
        });
        const gripMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.8 });
        const glowMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

        const body = new THREE.Mesh(new RoundedBoxGeometry(0.7, 1.0, 2.0, 2, 0.1), metalMat);
        gunGroup.add(body);

        const slide = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.4, 2.05, 3, 0.05), metalMat);
        slide.position.y = 0.4;
        gunGroup.add(slide);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.8, 32), metalMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = -2.2;
        gunGroup.add(barrel);

        const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), metalMat);
        rearSight.position.set(0, 0.7, 0.8);
        gunGroup.add(rearSight);

        const redDot = new THREE.Mesh(new THREE.SphereGeometry(0.04), glowMat);
        redDot.position.set(0, 0.72, -1.75);
        gunGroup.add(redDot);

        const guard = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 16, 32, Math.PI), metalMat);
        guard.position.set(0, -0.6, -0.2);
        guard.rotation.x = Math.PI / 2;
        gunGroup.add(guard);

        const grip = new THREE.Mesh(new RoundedBoxGeometry(0.5, 1.5, 0.8, 4, 0.1), gripMat);
        grip.position.set(0, -1.0, 0.4);
        grip.rotation.x = -Math.PI / 10;
        gunGroup.add(grip);

        const flashGeo = new THREE.SphereGeometry(0.6, 16, 16);
        const flashMat = new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0 });
        this.muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
        this.muzzleFlash.position.z = -4.2;
        gunGroup.add(this.muzzleFlash);

        this.flashLight = new THREE.PointLight(0xffaa00, 0, 30);
        this.flashLight.position.z = -4.5;
        gunGroup.add(this.flashLight);

        this.scene.add(gunGroup);
        return gunGroup;
    }

    shoot(mouse, shootSound) {
        this.recoilAmount = 0.4;
        this.flashTimer = 5;
        if (shootSound.isPlaying) shootSound.stop();
        shootSound.play();

        const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(this.camera);
        const dir = vector.sub(this.camera.position).normalize();
        const targetPos = this.camera.position.clone().add(dir.multiplyScalar(50));

        const barrelTip = new THREE.Vector3(0, 0, -4.0);
        barrelTip.applyMatrix4(this.gun.matrixWorld);
        this.bullets.push(new Bullet(this.scene, barrelTip, targetPos));
    }

    update(mouse) {
        // Flash logic
        if (this.flashTimer > 0) {
            const flicker = Math.random() * 0.5 + 0.5;
            this.muzzleFlash.material.opacity = flicker;
            this.muzzleFlash.scale.setScalar(flicker * 1.5);
            this.flashLight.intensity = 25 * flicker;
            this.flashTimer--;
        } else {
            this.muzzleFlash.material.opacity = 0;
            this.flashLight.intensity = 0;
        }

        // Gun Follow
        const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(this.camera);
        const dir = vector.sub(this.camera.position).normalize();
        const pos = this.camera.position.clone().add(dir.multiplyScalar(-this.camera.position.z / dir.z));
        this.gun.position.copy(this.camera.position).add(new THREE.Vector3(0, -1.2, -2.5));
        this.gun.lookAt(pos);

        // Recoil
        if (this.recoilAmount > 0) {
            this.gun.position.z += this.recoilAmount;
            this.gun.rotation.x -= this.recoilAmount * 0.3;
            this.recoilAmount *= 0.82;
        }

        // Update Bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            if (!this.bullets[i].update(this.scene)) {
                this.bullets.splice(i, 1);
            }
        }
    }

    checkCollisions(cubes, createBlast, hitCubeReset) {
        for (let bullet of this.bullets) {
            for (let cube of cubes) {
                if (cube.mesh.visible && bullet.mesh.position.distanceTo(cube.mesh.position) < 1.8) {
                    createBlast(cube.mesh.position, cube.color);
                    cube.mesh.visible = false;
                    setTimeout(() => { hitCubeReset(cube); }, 800);
                    bullet.life = 0;
                    break;
                }
            }
        }
    }
}

export class ProjectileCube {
    constructor(scene, index, colors, envMap, getFrustumHeight, camera) {
        this.index = index;
        const size = window.innerWidth < 600 ? 1.6 : 2.4;
        const theme = colors[index % colors.length];
        this.color = theme.main;
        
        const material = new THREE.MeshPhysicalMaterial({
            color: theme.main, metalness: 0.1, roughness: 0.1, transmission: 0.6,
            thickness: 1.0, ior: 1.5, envMap: envMap, transparent: true, opacity: 0.8,
            emissive: theme.main, emissiveIntensity: 0.2
        });

        this.mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        scene.add(this.mesh);
        this.reset(getFrustumHeight, camera);
    }

    reset(getFrustumHeight, camera) {
        const fh = getFrustumHeight();
        const fw = fh * camera.aspect;
        const side = Math.random() > 0.5 ? 1 : -1;
        this.mesh.position.set(side * (fw / 2 + 3), -fh / 2 - 2, -8);
        const targetHeight = fh * (0.4 + Math.random() * 0.3);
        const gravity = 0.008;
        this.velocity = new THREE.Vector3(-side * (0.06 + Math.random() * 0.12), Math.sqrt(2 * gravity * targetHeight), 0);
        this.gravity = -gravity * 0.6;
    }

    update(getFrustumHeight, camera) {
        this.velocity.y += this.gravity;
        this.mesh.position.add(this.velocity);
        this.mesh.rotation.x += 0.01;
        this.mesh.rotation.y += 0.01;
        if (this.mesh.position.y < -15) this.reset(getFrustumHeight, camera);
    }
}

class Bullet {
    constructor(scene, startPos, targetPos) {
        this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
        this.mesh.position.copy(startPos);
        this.mesh.lookAt(targetPos);
        this.mesh.rotateX(Math.PI/2);
        this.direction = targetPos.clone().sub(startPos).normalize();
        this.speed = 1.6;
        this.life = 100;
        scene.add(this.mesh);
    }
    update(scene) {
        this.mesh.position.add(this.direction.clone().multiplyScalar(this.speed));
        this.life--;
        if (this.life <= 0) { scene.remove(this.mesh); return false; }
        return true;
    }
}
