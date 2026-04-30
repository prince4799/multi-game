/*
 * Beach Math 3D — Cubes pop from water, shoot the right answer!
 */
var G = (function() {
    var R = ogl.Renderer, Cam = ogl.Camera, Tr = ogl.Transform, Bx = ogl.Box,
        Sp = ogl.Sphere, Pl = ogl.Plane, Pr = ogl.Program, Ms = ogl.Mesh,
        Cl = ogl.Color, V3 = ogl.Vec3, M4 = ogl.Mat4, Cy = ogl.Cylinder;

    var LV = 'attribute vec3 position; attribute vec3 normal; uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix; uniform mat3 normalMatrix; varying vec3 vN; void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
    var LF = 'precision mediump float; uniform vec3 uColor; varying vec3 vN; void main() { vec3 sun = normalize(vec3(0.4,1.0,0.3)); float d = dot(vN, sun)*0.45+0.55; gl_FragColor = vec4(uColor * d, 1.0); }';
    var GF = 'precision mediump float; uniform vec3 uColor; varying vec3 vN; void main() { float r = pow(1.0-max(0.0,dot(vN,vec3(0,0,1))),2.0); gl_FragColor = vec4(uColor+r*0.8, 1.0); }';
    var TF = 'precision mediump float; uniform vec3 uColor; uniform float uHit; varying vec3 vN; void main() { vec3 sun = normalize(vec3(0.4,1.0,0.3)); float d = dot(vN,sun)*0.45+0.55; float r = pow(1.0-max(0.0,dot(vN,vec3(0,0,1))),3.0)*0.3; vec3 c = mix(uColor,vec3(1.0),uHit)*d+r; gl_FragColor = vec4(c,1.0); }';
    var WV = 'attribute vec3 position; attribute vec2 uv; uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix; uniform float uTime; varying vec2 vUv; void main() { vUv = uv; vec3 p = position; p.z += sin(p.x*0.3+uTime*2.0)*0.6 + sin(p.y*0.5+uTime*1.5)*0.4; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }';
    var WF = 'precision mediump float; varying vec2 vUv; uniform float uTime; void main() { vec3 s = vec3(0.0,0.8,0.95); vec3 dp = vec3(0.0,0.25,0.55); float m = smoothstep(0.0,1.0,vUv.y); vec3 c = mix(s,dp,m); float sp = pow(max(sin(vUv.x*50.0+uTime*3.0)*0.5+0.5,0.0),40.0)*0.7; float foam = smoothstep(0.5,1.0,sin(vUv.x*30.0+uTime*4.0)*sin(vUv.y*20.0+uTime*2.0))*0.15; c += sp + foam; gl_FragColor = vec4(c, 0.9); }';
    var CV = 'attribute vec3 position; attribute vec2 uv; uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix; varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
    var CF = 'precision mediump float; varying vec2 vUv; void main() { vec2 c = vUv-0.5; float d = length(c*vec2(1.0,2.5)); float a = smoothstep(0.5,0.05,d)*0.6; gl_FragColor = vec4(1.0,1.0,1.0,a); }';

    function Game() {
        this.renderer = new R({ dpr: Math.min(window.devicePixelRatio, 2), antialias: true });
        this.gl = this.renderer.gl;
        this.gl.clearColor(0.53, 0.81, 0.98, 1.0); // SKY BLUE background
        document.getElementById('canvas-container').appendChild(this.gl.canvas);
        this.camera = new Cam(this.gl, { fov: 45 });
        this.camera.position.set(0, 14, 22);
        this.camera.lookAt([0, 2, -5]);
        this.scene = new Tr();
        this.projectiles = []; this.targets = []; this.particles = [];
        this.score = 0; this.timeLeft = 60;
        this.gameStarted = false; this.isGameOver = false;
        this.gunMuzzlePos = [0, 4, 16];
        this.targetSpawnTime = 0; this.arcDuration = 3.5; this.maxArcH = 14;

        this.buildScene();
        this.nextQuestion();
        this.buildCrosshair();

        var self = this;
        window.addEventListener('resize', function() { self.resize(); });
        this.resize();
        window.addEventListener('mousedown', function(e) { self.onShoot(e.clientX, e.clientY); });
        window.addEventListener('touchstart', function(e) { self.onShoot(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
        window.addEventListener('mousemove', function(e) {
            if (self.crosshair) { self.crosshair.style.left = e.clientX+'px'; self.crosshair.style.top = e.clientY+'px'; }
            if (self.gunGroup && !self.isGameOver) {
                var x = (e.clientX / window.innerWidth) * 2 - 1;
                self.gunGroup.rotation[1] = -x * 0.6;
            }
        });
        window.addEventListener('message', function(e) { if (e.data && e.data.type === 'RESTART') self.reset(); });
        requestAnimationFrame(function loop(t) { requestAnimationFrame(loop); self.update(t); });
    }

    Game.prototype.buildScene = function() {
        var gl = this.gl;
        // SUN
        var sunGeo = new Sp(gl, { radius: 3, widthSegments: 16 });
        var sun = new Ms(gl, { geometry: sunGeo, program: new Pr(gl, { vertex: LV, fragment: 'precision mediump float; void main() { gl_FragColor = vec4(1.0,0.95,0.7,1.0); }' }) });
        sun.position.set(25, 35, -40); sun.setParent(this.scene);
        // CLOUDS
        var cloudGeo = new Pl(gl, { width: 30, height: 12 });
        var cloudPos = [[-18,28,-35],[12,32,-45],[30,26,-30],[-8,35,-50],[0,30,-40]];
        for (var i = 0; i < 5; i++) {
            var cloud = new Ms(gl, { geometry: cloudGeo, program: new Pr(gl, { vertex: CV, fragment: CF, transparent: true, depthWrite: false }) });
            cloud.position.set(cloudPos[i][0], cloudPos[i][1], cloudPos[i][2]);
            cloud.scale.set(1 + Math.random() * 0.5);
            cloud.setParent(this.scene);
        }
        // WATER
        var waterGeo = new Pl(gl, { width: 100, height: 100, widthSegments: 48, heightSegments: 48 });
        this.water = new Ms(gl, { geometry: waterGeo, program: new Pr(gl, { vertex: WV, fragment: WF, uniforms: { uTime: { value: 0 } }, transparent: true }) });
        this.water.rotation.x = -Math.PI / 2; this.water.position.set(0, -1, -10); this.water.setParent(this.scene);
        // SAND (beach edge)
        var sandGeo = new Pl(gl, { width: 100, height: 40 });
        var sand = new Ms(gl, { geometry: sandGeo, program: new Pr(gl, { vertex: LV, fragment: LF, uniforms: { uColor: { value: new Cl('#f2d2a9') } } }) });
        sand.rotation.x = -Math.PI / 2; sand.position.set(0, -1.5, 15); sand.setParent(this.scene);
        // TREES
        for (var i = 0; i < 10; i++) {
            var side = i % 2 === 0 ? 1 : -1;
            var tree = new Tr(); tree.position.set(20 * side + (Math.random()-0.5)*6, -1.5, -i*8+12); tree.setParent(this.scene);
            var trunk = new Ms(gl, { geometry: new Bx(gl, {width:0.8,height:12,depth:0.8}), program: new Pr(gl, {vertex:LV,fragment:LF,uniforms:{uColor:{value:new Cl('#6b4226')}}}) });
            trunk.position.y = 6; trunk.setParent(tree);
            for (var l = 0; l < 5; l++) {
                var leaf = new Ms(gl, { geometry: new Bx(gl, {width:6,height:0.12,depth:2}), program: new Pr(gl, {vertex:LV,fragment:LF,uniforms:{uColor:{value:new Cl('#2d8a35')}}}) });
                leaf.position.y = 12; leaf.rotation.y = (l*Math.PI*2)/5; leaf.rotation.z = 0.5; leaf.setParent(tree);
            }
        }
        // GUN
        this.gunGroup = new Tr(); this.gunGroup.position.set(0, 0, 16); this.gunGroup.setParent(this.scene);
        // Body
        var body = new Ms(gl, { geometry: new Bx(gl, {width:2.2,height:1.8,depth:3.5}), program: new Pr(gl, {vertex:LV,fragment:LF,uniforms:{uColor:{value:new Cl('#1a1a1a')}}}) });
        body.position.set(0, 3, 0); body.setParent(this.gunGroup);
        // Barrel
        var barrel = new Ms(gl, { geometry: new Cy(gl, {radiusTop:0.45,radiusBottom:0.55,height:6,radialSegments:12}), program: new Pr(gl, {vertex:LV,fragment:LF,uniforms:{uColor:{value:new Cl('#333')}}}) });
        barrel.rotation.x = -Math.PI/2; barrel.position.set(0, 3.6, -4.5); barrel.setParent(this.gunGroup);
        // Muzzle tip (neon)
        var muzzle = new Ms(gl, { geometry: new Cy(gl, {radiusTop:0.55,radiusBottom:0.6,height:0.8,radialSegments:12}), program: new Pr(gl, {vertex:LV,fragment:GF,uniforms:{uColor:{value:new Cl('#00f2ff')}}}) });
        muzzle.rotation.x = -Math.PI/2; muzzle.position.set(0, 3.6, -7.5); muzzle.setParent(this.gunGroup);
        // Grip
        var grip = new Ms(gl, { geometry: new Bx(gl, {width:1.0,height:3.5,depth:1.2}), program: new Pr(gl, {vertex:LV,fragment:LF,uniforms:{uColor:{value:new Cl('#111')}}}) });
        grip.position.set(0, 0.8, 0.5); grip.rotation.x = 0.15; grip.setParent(this.gunGroup);
        // Scope
        var scope = new Ms(gl, { geometry: new Bx(gl, {width:0.5,height:0.5,depth:2}), program: new Pr(gl, {vertex:LV,fragment:LF,uniforms:{uColor:{value:new Cl('#222')}}}) });
        scope.position.set(0, 4.2, -0.5); scope.setParent(this.gunGroup);
        // Target cube + laser geo
        this.cubeGeo = new Bx(gl, { width: 2.5, height: 2.5, depth: 2.5 });
        this.laserGeo = new Sp(gl, { radius: 0.5, widthSegments: 8 });
        this.partGeo = new Bx(gl, { width: 0.4, height: 0.4, depth: 0.4 });
        this.buildTargets();
    };

    Game.prototype.buildTargets = function() {
        var gl = this.gl;
        var colors = ['#ffcc00', '#00f2ff', '#ff007a'];
        for (var i = 0; i < 3; i++) {
            var prog = new Pr(gl, { vertex: LV, fragment: TF, uniforms: { uColor: { value: new Cl(colors[i]) }, uHit: { value: 0 } } });
            var mesh = new Ms(gl, { geometry: this.cubeGeo, program: prog });
            mesh.position.set((i - 1) * 10, -5, -8); mesh.setParent(this.scene);
            mesh.baseX = (i - 1) * 10; mesh.baseZ = -8;
            var label = document.createElement('div');
            label.style.cssText = 'position:absolute;color:#fff;font-size:3rem;font-weight:900;text-shadow:0 0 15px #000,0 2px 6px #000;pointer-events:none;transform:translate(-50%,-50%);z-index:100;font-family:"Outfit",sans-serif;';
            document.body.appendChild(label);
            this.targets.push({ mesh: mesh, label: label, value: 0, hit: false });
        }
    };

    Game.prototype.buildCrosshair = function() {
        this.crosshair = document.createElement('div');
        this.crosshair.innerHTML = '<div style="position:absolute;top:50%;left:0;width:100%;height:2px;background:#00f2ff;opacity:0.8"></div><div style="position:absolute;top:0;left:50%;width:2px;height:100%;background:#00f2ff;opacity:0.8"></div>';
        this.crosshair.style.cssText = 'position:fixed;width:40px;height:40px;border:2px solid #00f2ff;border-radius:50%;pointer-events:none;z-index:200;transform:translate(-50%,-50%);display:none;box-shadow:0 0 10px rgba(0,242,255,0.4);';
        document.body.appendChild(this.crosshair);
    };

    Game.prototype.nextQuestion = function() {
        var ops = ['+','-','*'], op = ops[Math.floor(Math.random()*ops.length)];
        var a, b, ans;
        if (op==='+') { a=Math.floor(Math.random()*20)+1; b=Math.floor(Math.random()*20)+1; ans=a+b; }
        else if (op==='-') { a=Math.floor(Math.random()*40)+10; b=Math.floor(Math.random()*10)+1; ans=a-b; }
        else { a=Math.floor(Math.random()*10)+2; b=Math.floor(Math.random()*9)+2; ans=a*b; }
        this.currentEquation = a+' '+(op==='*'?'×':op)+' '+b;
        this.currentAnswer = ans;
        document.getElementById('equation').innerText = this.currentEquation;
        var opts = [ans]; while (opts.length < 3) { var w = ans+Math.floor(Math.random()*10)-5; if (w!==ans && opts.indexOf(w)===-1) opts.push(w); }
        opts.sort(function() { return Math.random()-0.5; });
        for (var i = 0; i < 3; i++) {
            this.targets[i].value = opts[i]; this.targets[i].label.innerText = opts[i];
            this.targets[i].hit = false;
            this.targets[i].mesh.program.uniforms.uHit.value = 0;
            this.targets[i].mesh.scale.set(1);
        }
        this.targetSpawnTime = performance.now() * 0.001;
        // Splash particles
        for (var i = 0; i < 3; i++) {
            for (var j = 0; j < 5; j++) {
                var sp = new Ms(this.gl, { geometry: this.partGeo, program: new Pr(this.gl, { vertex: LV, fragment: LF, uniforms: { uColor: { value: new Cl('#aaeeff') } } }) });
                sp.position.set(this.targets[i].mesh.baseX + (Math.random()-0.5)*2, -1, this.targets[i].mesh.baseZ);
                sp.setParent(this.scene);
                this.particles.push({ mesh: sp, vx: (Math.random()-0.5)*0.3, vy: Math.random()*0.5+0.2, vz: (Math.random()-0.5)*0.3, life: 25 });
            }
        }
    };

    Game.prototype.onShoot = function(cx, cy) {
        if (!this.gameStarted || this.isGameOver) return;
        var closest = null, closestDist = 100;
        for (var i = 0; i < this.targets.length; i++) {
            if (this.targets[i].hit) continue;
            var r = this.targets[i].label.getBoundingClientRect();
            var d = Math.sqrt(Math.pow(cx-r.left-r.width/2,2)+Math.pow(cy-r.top-r.height/2,2));
            if (d < closestDist) { closestDist = d; closest = this.targets[i]; }
        }
        var tx, ty, tz;
        if (closest) { tx=closest.mesh.position[0]; ty=closest.mesh.position[1]; tz=closest.mesh.position[2]; }
        else { tx=(cx/window.innerWidth*2-1)*15; ty=8; tz=-8; }
        var gx=this.gunMuzzlePos[0], gy=this.gunMuzzlePos[1], gz=this.gunMuzzlePos[2];
        var dx=tx-gx, dy=ty-gy, dz=tz-gz;
        var len=Math.sqrt(dx*dx+dy*dy+dz*dz); if(len<0.01)len=1;
        dx/=len; dy/=len; dz/=len;
        var laser = new Ms(this.gl, { geometry: this.laserGeo, program: new Pr(this.gl, { vertex: LV, fragment: 'precision mediump float; void main(){gl_FragColor=vec4(0.0,1.0,1.0,1.0);}' }) });
        laser.position.set(gx,gy,gz); laser.setParent(this.scene);
        this.projectiles.push({ mesh: laser, dx:dx, dy:dy, dz:dz, speed:4.0, target: closest });
        // Recoil
        this.gunGroup.position[2] += 1; var g = this.gunGroup; setTimeout(function(){g.position[2]-=1;}, 80);
    };

    Game.prototype.handleHit = function(tgt) {
        tgt.hit = true;
        if (tgt.value === this.currentAnswer) {
            this.score += 100;
            // Pop all and next question
            for (var i = 0; i < this.targets.length; i++) this.targets[i].hit = true;
            var self = this; setTimeout(function() { self.nextQuestion(); }, 500);
        } else { this.score = Math.max(0, this.score - 50); }
        document.getElementById('score').innerText = this.score;
        this.popEffect(tgt);
    };

    Game.prototype.popEffect = function(tgt) {
        var m = tgt.mesh; m.program.uniforms.uHit.value = 1.0; m.scale.set(1.8);
        setTimeout(function() { m.program.uniforms.uHit.value = 0; m.scale.set(1); }, 300);
        for (var i = 0; i < 12; i++) {
            var p = new Ms(this.gl, { geometry: this.partGeo, program: new Pr(this.gl, {vertex:LV,fragment:LF,uniforms:{uColor:{value:m.program.uniforms.uColor.value}}}) });
            p.position.set(m.position[0], m.position[1], m.position[2]); p.setParent(this.scene);
            this.particles.push({ mesh:p, vx:(Math.random()-0.5)*0.6, vy:Math.random()*0.4+0.1, vz:(Math.random()-0.5)*0.6, life:35 });
        }
    };

    Game.prototype.start = function() {
        this.gameStarted = true; this.isGameOver = false; this.score = 0; this.timeLeft = 60;
        document.getElementById('overlay').classList.add('hidden');
        document.getElementById('score').innerText = '0'; document.getElementById('timer').innerText = '60';
        if (this.crosshair) this.crosshair.style.display = 'block';
        this.nextQuestion();
        if (this.timerInterval) clearInterval(this.timerInterval);
        var self = this;
        this.timerInterval = setInterval(function() { self.timeLeft--; document.getElementById('timer').innerText = self.timeLeft; if (self.timeLeft<=0) self.gameOver(); }, 1000);
    };

    Game.prototype.reset = function() {
        this.score=0; this.timeLeft=60; this.gameStarted=false; this.isGameOver=false;
        document.getElementById('overlay').classList.remove('hidden');
        document.getElementById('score').innerText='0'; document.getElementById('timer').innerText='60';
        if(this.crosshair) this.crosshair.style.display='none';
        for(var i=0;i<this.projectiles.length;i++) if(this.projectiles[i].mesh.parent) this.projectiles[i].mesh.setParent(null);
        this.projectiles=[];
        for(var i=0;i<this.particles.length;i++) if(this.particles[i].mesh.parent) this.particles[i].mesh.setParent(null);
        this.particles=[];
        this.nextQuestion();
    };

    Game.prototype.gameOver = function() {
        this.gameStarted=false; this.isGameOver=true; clearInterval(this.timerInterval);
        if(this.crosshair) this.crosshair.style.display='none';
        document.getElementById('overlay').classList.remove('hidden');
        document.getElementById('status-text').innerText = 'Game Over — Score: '+this.score;
    };

    Game.prototype.resize = function() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.camera.perspective({ aspect: this.gl.canvas.width / this.gl.canvas.height });
    };

    Game.prototype.update = function(t) {
        var time = t * 0.001;
        if (this.water) this.water.program.uniforms.uTime.value = time;

        // TARGET ARC ANIMATION — cubes pop from water
        if (this.gameStarted && !this.isGameOver) {
            var elapsed = time - this.targetSpawnTime;
            var progress = elapsed / this.arcDuration;
            if (progress > 1.0) {
                // Targets fell back — missed! Spawn new
                this.score = Math.max(0, this.score - 25);
                document.getElementById('score').innerText = this.score;
                this.nextQuestion();
            } else {
                var height = this.maxArcH * 4 * progress * (1 - progress); // parabolic
                for (var i = 0; i < this.targets.length; i++) {
                    var tgt = this.targets[i];
                    if (tgt.hit) { tgt.mesh.position[1] = -5; continue; } // hide hit targets
                    tgt.mesh.position[0] = tgt.mesh.baseX;
                    tgt.mesh.position[1] = -1 + height;
                    tgt.mesh.position[2] = tgt.mesh.baseZ;
                    tgt.mesh.rotation[1] += 0.03;
                }
            }
        } else {
            for (var i = 0; i < this.targets.length; i++) this.targets[i].mesh.position[1] = -5;
        }

        // PROJECTILES
        for (var i = this.projectiles.length-1; i >= 0; i--) {
            var p = this.projectiles[i];
            p.mesh.position[0] += p.dx*p.speed; p.mesh.position[1] += p.dy*p.speed; p.mesh.position[2] += p.dz*p.speed;
            if (p.target && !p.target.hit) {
                var ex=p.mesh.position[0]-p.target.mesh.position[0], ey=p.mesh.position[1]-p.target.mesh.position[1], ez=p.mesh.position[2]-p.target.mesh.position[2];
                if (Math.sqrt(ex*ex+ey*ey+ez*ez) < 4.0) {
                    this.handleHit(p.target); p.mesh.setParent(null); this.projectiles.splice(i,1); continue;
                }
            }
            if (p.mesh.position[2]<-50||p.mesh.position[1]>40||p.mesh.position[1]<-10) { if(p.mesh.parent) p.mesh.setParent(null); this.projectiles.splice(i,1); }
        }

        // PARTICLES
        for (var i = this.particles.length-1; i >= 0; i--) {
            var pp = this.particles[i];
            pp.mesh.position[0] += pp.vx; pp.mesh.position[1] += pp.vy; pp.mesh.position[2] += pp.vz;
            pp.vy -= 0.018; pp.mesh.rotation[0] += 0.1; pp.life--;
            if (pp.life <= 0) { pp.mesh.setParent(null); this.particles.splice(i,1); }
        }

        // LABELS follow cubes
        for (var i = 0; i < this.targets.length; i++) {
            var tgt = this.targets[i];
            if (tgt.mesh.position[1] < -2 || tgt.hit) { tgt.label.style.opacity = '0'; continue; }
            var sp = this.p2s(tgt.mesh.position);
            tgt.label.style.left = sp.x+'px'; tgt.label.style.top = sp.y+'px';
            tgt.label.style.opacity = this.gameStarted ? '1' : '0';
        }

        this.renderer.render({ scene: this.scene, camera: this.camera });
    };

    Game.prototype.p2s = function(pos) {
        var mvp = new M4(); mvp.multiply(this.camera.projectionMatrix, this.camera.viewMatrix);
        var x=pos[0],y=pos[1],z=pos[2];
        var cx=x*mvp[0]+y*mvp[4]+z*mvp[8]+mvp[12], cy=x*mvp[1]+y*mvp[5]+z*mvp[9]+mvp[13], cw=x*mvp[3]+y*mvp[7]+z*mvp[11]+mvp[15];
        return { x:(cx/cw*0.5+0.5)*window.innerWidth, y:(1-(cy/cw*0.5+0.5))*window.innerHeight };
    };

    return Game;
})();
var game = new G();
document.getElementById('start-btn').onclick = function() { game.start(); };
