const SFX = {
  ctx: null,
  noiseBuffer: null,
  lastStep: 0,
  lastBeat: 0,
  lastAmbient: 0,
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
        const len = this.ctx.sampleRate * 1.5;
        this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          b0 = 0.99765 * b0 + w * 0.0990460;
          b1 = 0.96300 * b1 + w * 0.2965164;
          b2 = 0.57000 * b2 + w * 1.0526913;
          data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  },
  noise(dur, filterFreq, filterType = 'lowpass', vol = 0.35, q = 1.0) {
    this.init();
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(q, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + dur);
  },
  tone(freq, type, dur, vol = 0.25, endFreq = null, delay = 0) {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  },
  ambientDrip() {
    const now = performance.now();
    if (now - this.lastAmbient < 9000) return;
    this.lastAmbient = now;
    this.tone(1150, 'sine', 0.08, 0.05, 1650);
  },
  jumpscareScream() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(460, now);
    osc1.frequency.exponentialRampToValueAtTime(840, now + 0.14);
    osc1.frequency.exponentialRampToValueAtTime(320, now + 0.85);
    osc2.frequency.setValueAtTime(472, now);
    osc2.frequency.exponentialRampToValueAtTime(870, now + 0.14);
    osc2.frequency.exponentialRampToValueAtTime(300, now + 0.85);

    const vocalFilter = this.ctx.createBiquadFilter();
    vocalFilter.type = 'bandpass';
    vocalFilter.frequency.setValueAtTime(1150, now);
    vocalFilter.Q.setValueAtTime(4.2, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.65, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    osc1.connect(vocalFilter);
    osc2.connect(vocalFilter);
    vocalFilter.connect(gain);
    gain.connect(this.ctx.destination);
    osc1.start(now); osc2.start(now);
    osc1.stop(now + 0.85); osc2.stop(now + 0.85);
    this.tone(105, 'sine', 0.6, 0.75, 34);
  },
  stunZap() {
    this.noise(0.2, 2200, 'bandpass', 0.35, 2.0);
    this.tone(620, 'sawtooth', 0.22, 0.24, 160);
  },
  siren() {
    this.tone(560, 'sawtooth', 0.35, 0.2, 380);
    this.tone(420, 'sawtooth', 0.35, 0.2, 300, 0.36);
  },
  step(sprinting) {
    const now = performance.now();
    if (now - this.lastStep < (sprinting ? 270 : 450)) return;
    this.lastStep = now;
    const p = 0.92 + Math.random() * 0.16;
    this.noise(0.1, (sprinting ? 460 : 350) * p, 'lowpass', sprinting ? 0.45 : 0.3, 0.8);
    this.tone(88 * p, 'sine', 0.08, sprinting ? 0.32 : 0.2, 38);
  },
  heartbeat(dist) {
    const now = performance.now();
    const interval = Math.max(700, dist * 85);
    if (now - this.lastBeat < interval) return;
    this.lastBeat = now;
    this.tone(72, 'sine', 0.16, 0.55, 36, 0);
    this.tone(62, 'sine', 0.19, 0.42, 32, 0.17);
  }
};

window.addEventListener('touchstart', () => SFX.init(), { passive: true });
window.addEventListener('pointerdown', () => SFX.init(), { passive: true });

function makeTexture(type) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  if (type === 'wall') {
    ctx.fillStyle = '#243042';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 248, 380);
    ctx.strokeRect(260, 4, 248, 380);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 392, 512, 42);
    ctx.fillStyle = '#09090b';
    for (let i = -64; i < 560; i += 48) {
      ctx.beginPath();
      ctx.moveTo(i, 392); ctx.lineTo(i + 24, 392);
      ctx.lineTo(i + 4, 434); ctx.lineTo(i - 20, 434);
      ctx.closePath(); ctx.fill();
    }
  } else if (type === 'floor') {
    ctx.fillStyle = '#18212f';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#090d14';
    ctx.lineWidth = 5;
    for (let i = 0; i <= 512; i += 128) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#0f1622';
    ctx.fillRect(0, 0, 512, 512);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const Game3D = {
  scene: null,
  camera: null,
  renderer: null,
  flashlight: null,
  playerHandGroup: null,
  wallBoxes: [],
  teammateMeshes: {},
  hunter: { x: 18, z: -18, yaw: 0, mesh: null, patrolAngle: 0, stunnedUntil: 0 },
  level: 1,
  battery: 100,
  stunCharges: 3,
  hasFuse: false,
  powerRestored: false,
  fuseMesh: null,
  genMesh: null,
  exitMesh: null,
  lockers: [],
  notes: [],
  terminals: [],
  locks: [false, false, false],
  codes: ['123', '456', '789'],
  activeTerminalIdx: -1,
  typedCode: '',
  selfDestructActive: false,
  escapeTimeLeft: 60,
  lastTick: 0,
  gameOver: false,
  lastNetSync: 0,
  flickerLights: [],
  dustSystem: null,
  velX: 0,
  velZ: 0,
  walkBob: 0,
  fpsFrames: 0,
  fpsLastTime: performance.now(),
  keys: {},
  joy: { active: false, dx: 0, dy: 0 },
  sprinting: false,
  nearAction: null,
  animStarted: false,

  start(codes, noteSpots, fuseSpot) {
    this.codes = codes;
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('story-intro').classList.remove('hidden');

    const lines = '11:48 PM — Sector-09 Bio-Lab has lost main power. Subject-0 escaped containment. Find the Blue Power Fuse, restore generator power, decode Dr. Verma\'s 3 logs, and reach the Surface Helipad!';
    let i = 0;
    const target = document.getElementById('story-typewriter');
    target.textContent = '';
    const typer = setInterval(() => {
      target.textContent += lines.charAt(i++);
      if (i >= lines.length) clearInterval(typer);
    }, 18);

    document.getElementById('enter-bunker-btn').onclick = () => {
      clearInterval(typer);
      SFX.init();
      document.getElementById('story-intro').classList.add('hidden');
      document.getElementById('game-screen').classList.remove('hidden');
      this.init3D(noteSpots, fuseSpot);
    };
  },

  init3D(noteSpots, fuseSpot) {
    const me = Net.players[Net.myId];
    document.getElementById('role-badge').textContent = me ? me.role : 'SCOUT';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090e17);
    this.scene.fog = new THREE.FogExp2(0x090e17, 0.026);

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 80);
    this.camera.rotation.order = 'YXZ';

    const container = document.getElementById('three-container');
    container.innerHTML = '';
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(this.renderer.domElement);

    // Bright enough base visibility so nothing ever goes pitch black
    this.scene.add(new THREE.HemisphereLight(0x94a3b8, 0x1e293b, 0.95));

    // Player Flashlight & Tactical Arms
    this.flashlight = new THREE.SpotLight(0xfffbeb, 6.0, 34, Math.PI / 4.2, 0.35, 1.0);
    this.flashlight.position.set(0, 0, 0);
    this.flashlight.target.position.set(0, 0, -1);
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlight.target);

    this.playerHandGroup = new THREE.Group();
    const armMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.45), armMat);
    leftArm.position.set(-0.28, -0.26, -0.35);
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.45), armMat);
    rightArm.position.set(0.28, -0.26, -0.35);
    const stunBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.11, 0.32),
      new THREE.MeshStandardMaterial({ color: 0xc084fc, emissive: 0x7e22ce, emissiveIntensity: 0.5 })
    );
    stunBody.position.set(0.28, -0.19, -0.52);
    this.playerHandGroup.add(leftArm, rightArm, stunBody);
    this.camera.add(this.playerHandGroup);
    this.scene.add(this.camera);

    this.buildBunker(noteSpots, fuseSpot);
    this.buildMonster();
    this.setupControls();

    window.addEventListener('resize', () => {
      if (!this.renderer || !this.camera) return;
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    if (!this.animStarted) {
      this.animStarted = true;
      this.animate();
    }
  },

  buildBunker(noteSpots, fuseSpot) {
    this.wallBoxes = [];
    this.lockers = [];
    this.notes = [];
    this.terminals = [];
    this.flickerLights = [];

    const floorTex = makeTexture('floor');
    floorTex.repeat.set(14, 14);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(48, 48),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 })
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const ceilTex = makeTexture('ceil');
    ceilTex.repeat.set(12, 12);
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(48, 48),
      new THREE.MeshStandardMaterial({ map: ceilTex, side: THREE.DoubleSide })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 4.0;
    this.scene.add(ceiling);

    // Floating Dust Particles
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(360 * 3);
    for (let i = 0; i < dustPos.length; i += 3) {
      dustPos[i] = (Math.random() - 0.5) * 44;
      dustPos[i + 1] = Math.random() * 3.8;
      dustPos[i + 2] = (Math.random() - 0.5) * 44;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    this.dustSystem = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xcbd5e1, size: 0.04, transparent: true, opacity: 0.4 }));
    this.scene.add(this.dustSystem);

    // Ceiling Corridor Lights
    const lightCoords = [
      { x: -16, z: 16, flicker: false }, { x: 0, z: 0, flicker: true },
      { x: 14, z: 14, flicker: true }, { x: -14, z: -14, flicker: false },
      { x: 14, z: -14, flicker: false }
    ];
    lightCoords.forEach(lc => {
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.35), new THREE.MeshBasicMaterial({ color: 0xbae6fd }));
      fixture.position.set(lc.x, 3.92, lc.z);
      const pLight = new THREE.PointLight(0x93c5fd, 1.3, 18);
      pLight.position.set(lc.x, 3.6, lc.z);
      this.scene.add(fixture, pLight);
      if (lc.flicker) this.flickerLights.push({ light: pLight, mesh: fixture });
    });

    // Walls
    const wallTex = makeTexture('wall');
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.55 });
    const addWall = (x, z, w, d) => {
      const t = wallTex.clone();
      t.needsUpdate = true;
      t.repeat.set(Math.max(1, Math.round(Math.max(w, d) / 4)), 1);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 4.0, d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 }));
      mesh.position.set(x, 2.0, z);
      this.scene.add(mesh);
      this.wallBoxes.push({ minX: x - w / 2 - 0.45, maxX: x + w / 2 + 0.45, minZ: z - d / 2 - 0.45, maxZ: z + d / 2 + 0.45 });
    };

    addWall(0, -24, 48, 1); addWall(0, 24, 48, 1);
    addWall(-24, 0, 1, 48); addWall(24, 0, 1, 48);
    addWall(-8, 10, 14, 0.8); addWall(8, 10, 12, 0.8);
    addWall(-10, -6, 0.8, 14); addWall(6, -8, 14, 0.8);
    addWall(14, 2, 0.8, 12); addWall(-2, -16, 12, 0.8);

    // Bright Glowing Green SAFE LOCKERS (Impossible to miss!)
    const lockerSpots = [
      { x: -20, z: 6 }, { x: -2, z: 6 }, { x: 10, z: -12 }, { x: 20, z: 14 }
    ];
    lockerSpots.forEach(l => {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 2.35, 1.15),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0369a1, emissiveIntensity: 0.45 })
      );
      body.position.y = 1.175;
      const topBeacon = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.18, 1.22), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
      topBeacon.position.y = 2.42;
      const sideStrip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.6, 1.22), new THREE.MeshBasicMaterial({ color: 0x4ade80 }));
      sideStrip.position.y = 1.2;
      const glow = new THREE.PointLight(0x22c55e, 1.5, 6);
      glow.position.y = 2.5;
      grp.add(body, topBeacon, sideStrip, glow);
      grp.position.set(l.x, 0, l.z);
      this.scene.add(grp);
      this.lockers.push(l);
    });

    // Blue Power Fuse
    this.fuseMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.7, 12),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.4 })
    );
    this.fuseMesh.position.set(fuseSpot.x, 0.95, fuseSpot.z);
    const fuseLight = new THREE.PointLight(0x38bdf8, 2.0, 7);
    fuseLight.position.set(fuseSpot.x, 1.3, fuseSpot.z);
    this.scene.add(this.fuseMesh, fuseLight);

    // Main Generator
    this.genMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.8, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x991b1b, emissive: 0xdc2626, emissiveIntensity: 0.8 })
    );
    this.genMesh.position.set(-20, 0.9, 20);
    this.scene.add(this.genMesh);

    // 3 Research Logs
    const logTexts = [
      'Dr. Verma Log #1: Subject-0 hunts by sound. Use the blue code below on Terminal #1:',
      'Dr. Verma Log #2: Stun Gun freezes Subject-0 with high-voltage arcs. Terminal #2 code:',
      'Dr. Verma Log #3: Final override code for Terminal #3 before reaching the Helipad:'
    ];
    noteSpots.forEach((spot, idx) => {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.85, 0.9), wallMat);
      stand.position.set(spot.x, 0.425, spot.z);
      const paper = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.06, 0.55),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 0.75 })
      );
      paper.position.set(spot.x, 0.88, spot.z);
      this.scene.add(stand, paper);
      this.notes.push({ x: spot.x, z: spot.z, idx, text: logTexts[idx] });
    });

    // 3 Security Terminals
    const termSpots = [{ x: -6, z: 21 }, { x: 12, z: 21 }, { x: 21, z: -4 }];
    termSpots.forEach((spot, idx) => {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.6, 0.8),
        new THREE.MeshStandardMaterial({ color: 0xb91c1c, emissive: 0xef4444, emissiveIntensity: 0.65 })
      );
      box.position.set(spot.x, 0.8, spot.z);
      this.scene.add(box);
      this.terminals.push({ x: spot.x, z: spot.z, idx, mesh: box });
    });

    // Exit Gate
    this.exitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 3.2, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x0f172a })
    );
    this.exitMesh.position.set(20, 1.6, -23.3);
    this.scene.add(this.exitMesh);
  },

  buildMonster() {
    const grp = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.3 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.35, 0.48), skin);
    torso.position.y = 1.45;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.54, 0.54), skin);
    head.position.y = 2.38;

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), eyeMat);
    eyeL.position.set(-0.14, 2.42, 0.27);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.14;

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.24), skin);
    legL.position.set(-0.22, 0.42, 0);
    const legR = legL.clone();
    legR.position.x = 0.22;

    const aura = new THREE.PointLight(0xff0000, 2.2, 8);
    aura.position.set(0, 1.8, 0.3);

    grp.add(torso, head, eyeL, eyeR, legL, legR, aura);
    grp.position.set(this.hunter.x, 0, this.hunter.z);
    this.scene.add(grp);
    this.hunter.mesh = grp;
  },

  setupControls() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyF') this.toggleTorch();
      if (e.code === 'KeyE') this.interact();
      if (e.code === 'KeyQ') this.fireStun();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    // Look Zone Touch Swipe
    const lookZone = document.getElementById('look-zone');
    let lookId = null, lastX = 0, lastY = 0;
    lookZone.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      lookId = t.identifier;
      lastX = t.clientX;
      lastY = t.clientY;
    }, { passive: true });
    lookZone.addEventListener('touchmove', (e) => {
      const me = Net.players[Net.myId];
      if (!me) return;
      for (const t of e.changedTouches) {
        if (t.identifier === lookId) {
          me.yaw -= (t.clientX - lastX) * 0.0062;
          this.camera.rotation.x = Math.max(-0.9, Math.min(0.9, this.camera.rotation.x - (t.clientY - lastY) * 0.0048));
          lastX = t.clientX;
          lastY = t.clientY;
        }
      }
    }, { passive: true });

    // Joystick
    const joyZone = document.getElementById('joystick-zone');
    const stick = document.getElementById('joystick-stick');
    joyZone.addEventListener('touchstart', (e) => {
      if (document.getElementById('game-screen').classList.contains('hud-editing')) return;
      e.preventDefault();
      this.joy.active = true;
    }, { passive: false });
    joyZone.addEventListener('touchmove', (e) => {
      if (!this.joy.active) return;
      e.preventDefault();
      const rect = joyZone.getBoundingClientRect();
      const t = e.touches[0];
      let dx = t.clientX - (rect.left + rect.width / 2);
      let dy = t.clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy);
      if (dist > 34) { dx = (dx / dist) * 34; dy = (dy / dist) * 34; }
      stick.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy.dx = dx / 34;
      this.joy.dy = dy / 34;
    }, { passive: false });
    const resetJoy = () => {
      this.joy.active = false;
      this.joy.dx = 0;
      this.joy.dy = 0;
      stick.style.transform = 'translate(0,0)';
    };
    joyZone.addEventListener('touchend', resetJoy);
    joyZone.addEventListener('touchcancel', resetJoy);

    // 4 Action Buttons
    document.getElementById('torch-btn').addEventListener('click', () => this.toggleTorch());
    document.getElementById('interact-btn').addEventListener('click', () => this.interact());
    document.getElementById('stun-btn').addEventListener('click', () => this.fireStun());
    document.getElementById('mic-btn').addEventListener('click', () => Net.toggleMic());

    const sprintBtn = document.getElementById('sprint-btn');
    sprintBtn.addEventListener('touchstart', (e) => {
      if (document.getElementById('game-screen').classList.contains('hud-editing')) return;
      e.preventDefault();
      this.sprinting = true;
    }, { passive: false });
    sprintBtn.addEventListener('touchend', () => { this.sprinting = false; });

    // Radio Quick Chat
    document.querySelectorAll('.radio-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const me = Net.players[Net.myId];
        const msg = btn.dataset.msg;
        this.showRadioToast(me ? me.name : 'You', msg);
        if (Net.isHost) Net.broadcast({ type: 'RADIO', sender: me.name, msg });
        else Net.sendToHost({ type: 'RADIO', sender: me.name, msg });
      });
    });

    // Modals
    document.getElementById('close-note-btn').onclick = () => document.getElementById('note-modal').classList.add('hidden');
    document.querySelectorAll('.key').forEach(k => {
      k.onclick = () => {
        if (k.classList.contains('close')) return document.getElementById('puzzle-modal').classList.add('hidden');
        if (k.classList.contains('clear')) { this.typedCode = ''; return this.updateKeypadUI(); }
        if (this.typedCode.length < 3) {
          this.typedCode += k.dataset.val;
          this.updateKeypadUI();
          if (this.typedCode.length === 3) this.checkPuzzleCode();
        }
      };
    });

    // Instant Restart Button
    document.getElementById('instant-restart-btn').onclick = () => {
      const codes = [
        String(Math.floor(100 + Math.random() * 899)),
        String(Math.floor(100 + Math.random() * 899)),
        String(Math.floor(100 + Math.random() * 899))
      ];
      const fuseSpot = { x: -16, z: -4 };
      const noteSpots = [{ x: -18, z: -18 }, { x: 0, z: 16 }, { x: 18, z: 4 }];
      if (Net.isHost) {
        Net.broadcast({ type: 'RESTART', players: Net.players, codes, noteSpots, fuseSpot });
      }
      this.resetAndRestart(codes, noteSpots, fuseSpot);
    };

    this.setupHudCustomizer();
  },

  setupHudCustomizer() {
    const fsBtn = document.getElementById('fs-rotate-btn');
    const editBtn = document.getElementById('edit-hud-btn');
    const editorBar = document.getElementById('hud-editor-bar');
    const saveBtn = document.getElementById('save-hud-btn');
    const resetBtn = document.getElementById('reset-hud-btn');
    const gameScreen = document.getElementById('game-screen');

    fsBtn.onclick = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
          await screen.orientation?.lock?.('landscape').catch(() => {});
          fsBtn.textContent = '⛶ EXIT FS';
          fsBtn.classList.add('on');
        } else {
          await document.exitFullscreen();
          fsBtn.textContent = '⛶ LANDSCAPE';
          fsBtn.classList.remove('on');
        }
      } catch (e) {}
    };

    const draggableIds = ['joystick-zone', 'stun-btn', 'sprint-btn', 'torch-btn', 'interact-btn', 'radar-wrap', 'radio-bar'];
    const saved = JSON.parse(localStorage.getItem('sb_hud_v2') || '{}');
    draggableIds.forEach(id => {
      const el = document.getElementById(id);
      if (el && saved[id]) {
        el.style.left = saved[id].left;
        el.style.top = saved[id].top;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
      }
    });

    let isEditing = false;
    editBtn.onclick = () => {
      isEditing = !isEditing;
      gameScreen.classList.toggle('hud-editing', isEditing);
      editorBar.classList.toggle('hidden', !isEditing);
    };

    draggableIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      let sx = 0, sy = 0, ol = 0, ot = 0;
      el.addEventListener('touchstart', (e) => {
        if (!isEditing) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const t = e.touches[0];
        const r = el.getBoundingClientRect();
        sx = t.clientX; sy = t.clientY; ol = r.left; ot = r.top;
        el.style.left = ol + 'px';
        el.style.top = ot + 'px';
        el.style.right = 'auto';
        el.style.bottom = 'auto';
      }, { passive: false, capture: true });

      el.addEventListener('touchmove', (e) => {
        if (!isEditing) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const t = e.touches[0];
        const nl = Math.max(4, Math.min(window.innerWidth - el.offsetWidth - 4, ol + (t.clientX - sx)));
        const nt = Math.max(4, Math.min(window.innerHeight - el.offsetHeight - 4, ot + (t.clientY - sy)));
        el.style.left = nl + 'px';
        el.style.top = nt + 'px';
      }, { passive: false, capture: true });
    });

    saveBtn.onclick = () => {
      const layout = {};
      draggableIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.style.left) layout[id] = { left: el.style.left, top: el.style.top };
      });
      localStorage.setItem('sb_hud_v2', JSON.stringify(layout));
      isEditing = false;
      gameScreen.classList.remove('hud-editing');
      editorBar.classList.add('hidden');
      this.showRadioToast('SETTINGS', '✅ Custom button layout saved!');
    };

    resetBtn.onclick = () => {
      localStorage.removeItem('sb_hud_v2');
      draggableIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.left = ''; el.style.top = ''; el.style.right = ''; el.style.bottom = ''; }
      });
      this.showRadioToast('SETTINGS', '🔄 Reset to default button positions!');
    };
  },

  toggleTorch() {
    const me = Net.players[Net.myId];
    if (!me || me.downed || this.battery <= 0) return;
    me.torch = !me.torch;
    this.flashlight.visible = me.torch;
    document.getElementById('torch-btn').classList.toggle('torch-on', me.torch);
  },

  fireStun() {
    const me = Net.players[Net.myId];
    if (!me || me.downed || me.hiding) return;
    if (this.stunCharges <= 0) return this.showRadioToast('SYSTEM', '⚠️ Stun Gun out of charges!');
    this.stunCharges--;
    document.getElementById('stun-status').textContent = `🔫 ${this.stunCharges}/3`;
    SFX.stunZap();

    const startPt = new THREE.Vector3(me.x, 1.35, me.z);
    const dirVec = new THREE.Vector3(-Math.sin(me.yaw), 0, -Math.cos(me.yaw));
    const dist = Math.hypot(this.hunter.x - me.x, this.hunter.z - me.z);
    const hit = dist < 12;
    const endPt = hit ? new THREE.Vector3(this.hunter.x, 1.3, this.hunter.z) : startPt.clone().addScaledVector(dirVec, 9);

    for (let b = 0; b < 3; b++) {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const p = new THREE.Vector3().lerpVectors(startPt, endPt, i / 10);
        if (i > 0 && i < 10) {
          p.x += (Math.random() - 0.5) * 0.4;
          p.y += (Math.random() - 0.5) * 0.4;
          p.z += (Math.random() - 0.5) * 0.4;
        }
        pts.push(p);
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: b === 0 ? 0xffffff : 0x38bdf8 })
      );
      this.scene.add(line);
      setTimeout(() => this.scene.remove(line), 260);
    }

    if (hit) {
      this.hunter.stunnedUntil = performance.now() + 5500;
      this.showRadioToast('STUN HIT', '⚡ ELECTRIC SHOCK! Subject-0 frozen for 5.5s!');
    } else {
      this.showRadioToast('STUN', '⚡ Electric Arc fired—target too far!');
    }
  },

  interact() {
    const me = Net.players[Net.myId];
    if (!me || me.downed || !this.nearAction) return;
    const act = this.nearAction;

    if (act.type === 'LOCKER') {
      me.hiding = !me.hiding;
      this.showRadioToast('STEALTH', me.hiding ? '🔒 Hidden inside Safe Locker!' : '🚪 Exited Safe Locker.');
    } else if (act.type === 'FUSE') {
      this.hasFuse = true;
      this.fuseMesh.visible = false;
      document.getElementById('objective-banner').textContent = 'CHAPTER 2: Activate the main GENERATOR (red glowing box)';
      this.showRadioToast('ITEM', '🔋 Picked up Blue Power Fuse!');
    } else if (act.type === 'GEN') {
      if (!this.hasFuse) return this.showRadioToast('OBJECTIVE', '⚠️ Find the Blue Power Fuse first!');
      this.restorePower();
      if (Net.isHost) Net.broadcast({ type: 'POWER_ON' });
      else Net.sendToHost({ type: 'POWER_ON' });
    } else if (act.type === 'NOTE') {
      document.getElementById('note-title').textContent = `DR. VERMA LOG #${act.note.idx + 1}`;
      document.getElementById('note-body').textContent = act.note.text;
      document.getElementById('note-code-reveal').textContent = this.codes[act.note.idx];
      document.getElementById('note-modal').classList.remove('hidden');
    } else if (act.type === 'TERM') {
      if (!this.powerRestored) return this.showRadioToast('LOCKED', '⚠️ Restore Generator power first!');
      this.activeTerminalIdx = act.term.idx;
      this.typedCode = '';
      this.updateKeypadUI();
      document.getElementById('puzzle-title').textContent = `SECURITY TERMINAL #${act.term.idx + 1}`;
      document.getElementById('puzzle-modal').classList.remove('hidden');
    } else if (act.type === 'REVIVE') {
      act.target.downed = false;
      this.showRadioToast('MEDIC', `💉 Revived ${act.target.name}!`);
      if (!Net.isHost) Net.sendToHost({ type: 'REVIVE', targetId: act.target.id });
    }
  },

  restorePower() {
    if (this.powerRestored) return;
    this.powerRestored = true;
    this.genMesh.material.color.setHex(0x16a34a);
    this.genMesh.material.emissive.setHex(0x22c55e);
    document.getElementById('locks-status').textContent = '⚡ ON (0/3)';
    document.getElementById('objective-banner').textContent = 'CHAPTER 3: Read Dr. Verma\'s 3 logs & unlock 3 terminals (0/3)';
    this.showRadioToast('POWER', '⚡ Main Power Restored!');
  },

  updateKeypadUI() {
    const d = this.typedCode.padEnd(3, '_').split('').join(' ');
    document.getElementById('keypad-display').textContent = d;
  },

  checkPuzzleCode() {
    if (this.typedCode === this.codes[this.activeTerminalIdx]) {
      document.getElementById('puzzle-modal').classList.add('hidden');
      this.unlockTerminal(this.activeTerminalIdx);
      if (Net.isHost) Net.broadcast({ type: 'UNLOCK', lockIdx: this.activeTerminalIdx });
      else Net.sendToHost({ type: 'UNLOCK', lockIdx: this.activeTerminalIdx });
    } else {
      this.typedCode = '';
      this.updateKeypadUI();
      SFX.tone(150, 'sawtooth', 0.25, 0.2);
    }
  },

  unlockTerminal(idx) {
    if (this.locks[idx]) return;
    this.locks[idx] = true;
    const t = this.terminals[idx];
    if (t) {
      t.mesh.material.color.setHex(0x16a34a);
      t.mesh.material.emissive.setHex(0x22c55e);
    }
    const count = this.locks.filter(Boolean).length;
    document.getElementById('locks-status').textContent = `🔓 ${count}/3`;
    if (count === 3) {
      this.selfDestructActive = true;
      this.escapeTimeLeft = 60;
      this.lastTick = performance.now();
      this.exitMesh.material.color.setHex(0x22c55e);
      this.exitMesh.material.emissive.setHex(0x4ade80);
      document.getElementById('timer-badge').classList.remove('hidden');
      document.getElementById('objective-banner').textContent = '🚨 ALL LOCKS OPEN! Reach the GREEN EXIT GATE in 60s!';
      SFX.siren();
    } else {
      document.getElementById('objective-banner').textContent = `CHAPTER 3: Unlock remaining terminals (${count}/3)`;
    }
  },

  startLevel2() {
    this.level = 2;
    this.locks = [false, false, false];
    this.selfDestructActive = false;
    document.getElementById('timer-badge').classList.add('hidden');
    document.getElementById('locks-status').textContent = '☢️ LVL 2 (0/3)';
    document.getElementById('objective-banner').textContent = '☢️ LEVEL 2 (BIO-REACTOR): Re-unlock all 3 terminals!';
    this.terminals.forEach(t => {
      t.mesh.material.color.setHex(0xb91c1c);
      t.mesh.material.emissive.setHex(0xef4444);
    });
    const me = Net.players[Net.myId];
    if (me) { me.x = -18; me.z = 18; }
    this.hunter.x = 18; this.hunter.z = -18;
    this.scene.background = new THREE.Color(0x18070a);
    this.scene.fog = new THREE.FogExp2(0x18070a, 0.028);
    this.showRadioToast('LEVEL 2', '☢️ Entered Bio-Reactor Core!');
  },

  startLevel3() {
    this.level = 3;
    this.selfDestructActive = true;
    this.escapeTimeLeft = 45;
    this.lastTick = performance.now();
    document.getElementById('timer-badge').classList.remove('hidden');
    document.getElementById('locks-status').textContent = '🚁 HELIPAD';
    document.getElementById('objective-banner').textContent = '🚁 LEVEL 3 (HELIPAD): Survive 45s until helicopter extraction!';
    const me = Net.players[Net.myId];
    if (me) { me.x = 0; me.z = 0; me.downed = false; }
    this.hunter.x = 18; this.hunter.z = -18;
    this.scene.background = new THREE.Color(0x070d19);
    this.scene.fog = new THREE.FogExp2(0x070d19, 0.022);
    SFX.siren();
    this.showRadioToast('LEVEL 3', '🚁 Hold out at Surface Helipad for 45s!');
  },

  triggerJumpscare() {
    SFX.jumpscareScream();
    const ov = document.getElementById('jumpscare-overlay');
    ov.classList.remove('hidden');
    setTimeout(() => ov.classList.add('hidden'), 1300);
  },

  triggerEnd(win, reason) {
    if (this.gameOver) return;
    this.gameOver = true;
    document.getElementById('jumpscare-overlay').classList.add('hidden');
    document.getElementById('end-title').textContent = win ? '🏆 MISSION ACCOMPLISHED' : '💀 SQUAD WIPED OUT';
    document.getElementById('end-title').style.color = win ? '#4ade80' : '#ef4444';
    document.getElementById('end-desc').textContent = reason;
    document.getElementById('end-modal').classList.remove('hidden');
  },

  resetAndRestart(codes, noteSpots, fuseSpot) {
    document.getElementById('end-modal').classList.add('hidden');
    document.getElementById('jumpscare-overlay').classList.add('hidden');
    document.getElementById('timer-badge').classList.add('hidden');
    this.gameOver = false;
    this.level = 1;
    this.battery = 100;
    this.stunCharges = 3;
    this.hasFuse = false;
    this.powerRestored = false;
    this.selfDestructActive = false;
    this.locks = [false, false, false];
    this.codes = codes;
    this.hunter.x = 18;
    this.hunter.z = -18;
    this.hunter.stunnedUntil = 0;

    if (this.fuseMesh) this.fuseMesh.visible = true;
    this.genMesh?.material.color.setHex(0x991b1b);
    this.genMesh?.material.emissive.setHex(0xdc2626);
    this.terminals.forEach(t => {
      t.mesh.material.color.setHex(0xb91c1c);
      t.mesh.material.emissive.setHex(0xef4444);
    });

    const spawns = [{ x: -18, z: 18 }, { x: -16, z: 18 }, { x: -18, z: 16 }, { x: -16, z: 16 }];
    Object.values(Net.players).forEach((p, idx) => {
      const sp = spawns[idx % 4];
      p.x = sp.x; p.z = sp.z; p.downed = false; p.hiding = false; p.torch = true;
    });

    document.getElementById('battery-badge').textContent = '🔋 100%';
    document.getElementById('locks-status').textContent = '⚡ OFF';
    document.getElementById('stun-status').textContent = '🔫 3/3';
    document.getElementById('objective-banner').textContent = 'CHAPTER 1: Find the blue POWER FUSE in the dark storage room';
    this.scene.background = new THREE.Color(0x090e17);
    this.scene.fog = new THREE.FogExp2(0x090e17, 0.026);
    this.showRadioToast('MISSION', '🔄 New round started! Good luck, Squad!');
  },

  checkCollision(x, z) {
    if (x < -23.1 || x > 23.1 || z < -23.1 || z > 23.1) return true;
    for (const w of this.wallBoxes) {
      if (x > w.minX && x < w.maxX && z > w.minZ && z < w.maxZ) return true;
    }
    return false;
  },

  showRadioToast(sender, msg) {
    const el = document.getElementById('radio-toast');
    el.textContent = `${sender}: ${msg}`;
    el.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
  },

  drawRadar(me) {
    const cvs = document.getElementById('radar-canvas');
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const w = cvs.width, h = cvs.height, cx = w / 2, cy = h / 2;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(34, 197, 94, 0.25)';
    ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 36, 0, Math.PI * 2); ctx.stroke();

    // Sweep line
    const ang = performance.now() * 0.003;
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.6)';
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * 40, cy + Math.sin(ang) * 40); ctx.stroke();

    // Center Player
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();

    // Monster Dot
    const dx = this.hunter.x - me.x;
    const dz = this.hunter.z - me.z;
    const cos = Math.cos(-me.yaw), sin = Math.sin(-me.yaw);
    const rx = (dx * cos - dz * sin) * 1.4;
    const rz = (dx * sin + dz * cos) * 1.4;
    const dist = Math.hypot(rx, rz);
    const clamp = dist > 36 ? 36 / dist : 1;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(cx + rx * clamp, cy + rz * clamp, 4, 0, Math.PI * 2); ctx.fill();
  },

  animate() {
    requestAnimationFrame(() => this.animate());
    if (!this.renderer || !this.scene || !this.camera) return;

    this.fpsFrames++;
    const nowFps = performance.now();
    if (nowFps - this.fpsLastTime >= 500) {
      const fps = Math.round((this.fpsFrames * 1000) / (nowFps - this.fpsLastTime));
      const el = document.getElementById('fps-badge');
      if (el) {
        el.textContent = `FPS: ${fps}`;
        el.className = 'fps-badge' + (fps < 30 ? ' low' : fps < 50 ? ' mid' : '');
      }
      this.fpsFrames = 0;
      this.fpsLastTime = nowFps;
    }

    const me = Net.players[Net.myId];
    if (!me) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (!this.gameOver) {
      SFX.ambientDrip();
      Net.updateVoiceProximity(me);

      if (this.dustSystem) this.dustSystem.rotation.y += 0.0007;
      this.flickerLights.forEach((fl, idx) => {
        const on = Math.sin(performance.now() * 0.02 + idx * 3) > -0.7;
        fl.light.intensity = on ? 1.3 : 0.25;
      });

      // Player Movement
      let fwd = 0, str = 0;
      if (this.keys['KeyW'] || this.keys['ArrowUp']) fwd += 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) fwd -= 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) str -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) str += 1;
      if (this.joy.active) { fwd -= this.joy.dy; str += this.joy.dx; }

      const isRunning = (this.keys['ShiftLeft'] || this.sprinting) && !me.downed && !me.hiding;
      const speed = me.downed ? 0.025 : me.hiding ? 0 : (isRunning ? 0.125 : 0.075);

      const sin = Math.sin(me.yaw), cos = Math.cos(me.yaw);
      const moveX = (-fwd * sin + str * cos);
      const moveZ = (-fwd * cos - str * sin);
      const len = Math.hypot(moveX, moveZ);

      const tvx = len > 0.05 ? (moveX / len) * speed : 0;
      const tvz = len > 0.05 ? (moveZ / len) * speed : 0;
      this.velX = THREE.MathUtils.lerp(this.velX, tvx, 0.22);
      this.velZ = THREE.MathUtils.lerp(this.velZ, tvz, 0.22);

      me.makingNoise = false;
      if (Math.hypot(this.velX, this.velZ) > 0.004) {
        const nx = me.x + this.velX;
        const nz = me.z + this.velZ;
        if (!this.checkCollision(nx, me.z)) me.x = nx;
        if (!this.checkCollision(me.x, nz)) me.z = nz;
        this.walkBob += isRunning ? 0.24 : 0.15;
        SFX.step(isRunning);
        if (isRunning || Net.voiceLoud) me.makingNoise = true;
      }

      const bob = me.downed ? 0 : Math.sin(this.walkBob) * 0.04;
      this.camera.position.set(me.x, (me.downed ? 0.55 : 1.62) + bob, me.z);
      this.camera.rotation.y = me.yaw;

      // Battery Drain
      if (me.torch && this.battery > 0) {
        this.battery = Math.max(0, this.battery - 0.012);
        if (this.battery === 0) { me.torch = false; this.flashlight.visible = false; }
        document.getElementById('battery-badge').textContent = `🔋 ${Math.ceil(this.battery)}%`;
      }

      // Context Interaction Hint
      this.nearAction = null;
      const hint = document.getElementById('interact-hint');
      for (const lk of this.lockers) {
        if (Math.hypot(lk.x - me.x, lk.z - me.z) < 2.2) {
          this.nearAction = { type: 'LOCKER' };
          hint.textContent = me.hiding ? '🚪 [USE] Exit Safe Locker' : '🔒 [USE] Hide in Safe Locker';
          break;
        }
      }
      if (!this.nearAction && !this.hasFuse && this.fuseMesh && Math.hypot(this.fuseMesh.position.x - me.x, this.fuseMesh.position.z - me.z) < 2.2) {
        this.nearAction = { type: 'FUSE' };
        hint.textContent = '🔋 [USE] Pick up Power Fuse';
      }
      if (!this.nearAction && Math.hypot(-20 - me.x, 20 - me.z) < 2.6) {
        this.nearAction = { type: 'GEN' };
        hint.textContent = '⚡ [USE] Activate Generator';
      }
      if (!this.nearAction) {
        for (const n of this.notes) {
          if (Math.hypot(n.x - me.x, n.z - me.z) < 2.2) {
            this.nearAction = { type: 'NOTE', note: n };
            hint.textContent = `📄 [USE] Read Log #${n.idx + 1}`;
            break;
          }
        }
      }
      if (!this.nearAction) {
        for (const t of this.terminals) {
          if (Math.hypot(t.x - me.x, t.z - me.z) < 2.2) {
            this.nearAction = { type: 'TERM', term: t };
            hint.textContent = `💻 [USE] Terminal #${t.idx + 1}`;
            break;
          }
        }
      }
      if (!this.nearAction) {
        for (const p of Object.values(Net.players)) {
          if (p.id !== Net.myId && p.downed && Math.hypot(p.x - me.x, p.z - me.z) < 2.4) {
            this.nearAction = { type: 'REVIVE', target: p };
            hint.textContent = `💉 [USE] Revive ${p.name}`;
            break;
          }
        }
      }
      hint.classList.toggle('hidden', !this.nearAction);

      // Exit Gate Check
      if (this.selfDestructActive && this.level < 3 && Math.hypot(20 - me.x, -23.3 - me.z) < 2.8 && Net.isHost) {
        if (this.level === 1) {
          this.startLevel2();
          Net.broadcast({ type: 'LEVEL_2' });
        } else if (this.level === 2) {
          this.startLevel3();
          Net.broadcast({ type: 'LEVEL_3' });
        }
      }

      // Countdown Timer
      if (this.selfDestructActive) {
        const now = performance.now();
        if (now - this.lastTick >= 1000) {
          this.lastTick = now;
          this.escapeTimeLeft--;
          document.getElementById('timer-badge').textContent = (this.level === 3 ? '🚁 ' : '☢️ ') + `${this.escapeTimeLeft}s`;
          if (this.escapeTimeLeft <= 0 && Net.isHost) {
            if (this.level === 3) {
              const msg = '🚁 Rescue Helicopter arrived! Your squad cleared all 3 levels!';
              Net.broadcast({ type: 'GAMEOVER', win: true, reason: msg });
              this.triggerEnd(true, msg);
            } else {
              const msg = 'Time is up! Sector-09 self-destructed!';
              Net.broadcast({ type: 'GAMEOVER', win: false, reason: msg });
              this.triggerEnd(false, msg);
            }
          }
        }
      }

      // Monster AI (Host Controlled)
      const isStunned = performance.now() < this.hunter.stunnedUntil;
      if (this.hunter.mesh) {
        this.hunter.mesh.position.y = isStunned ? -0.4 : 0;
        if (isStunned) {
          this.hunter.mesh.rotation.z = (Math.random() - 0.5) * 0.18;
          if (Math.random() > 0.35) {
            const sp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.06), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
            sp.position.set(this.hunter.x + (Math.random() - 0.5), 0.6 + Math.random() * 1.5, this.hunter.z + (Math.random() - 0.5));
            this.scene.add(sp);
            setTimeout(() => this.scene.remove(sp), 100);
          }
        } else {
          this.hunter.mesh.rotation.z = 0;
        }
        const aura = this.hunter.mesh.children.find(c => c.isPointLight);
        if (aura) aura.color.setHex(isStunned ? 0x38bdf8 : 0xff0000);
      }

      if (Net.isHost && !isStunned) {
        let target = null, minDist = 999;
        for (const p of Object.values(Net.players)) {
          if (p.downed || p.hiding) continue;
          const d = Math.hypot(p.x - this.hunter.x, p.z - this.hunter.z);
          const detectRange = p.makingNoise ? 24 : (p.torch ? 14 : 7);
          if (d < detectRange && d < minDist) { minDist = d; target = p; }
        }

        if (target) {
          const ang = Math.atan2(target.x - this.hunter.x, target.z - this.hunter.z);
          this.hunter.yaw = ang;
          const mSpeed = this.level === 3 ? 0.095 : 0.072;
          const nx = this.hunter.x + Math.sin(ang) * mSpeed;
          const nz = this.hunter.z + Math.cos(ang) * mSpeed;
          if (!this.checkCollision(nx, this.hunter.z)) this.hunter.x = nx;
          if (!this.checkCollision(this.hunter.x, nz)) this.hunter.z = nz;

          if (minDist < 1.35) {
            target.downed = true;
            if (target.id === Net.myId) this.triggerJumpscare();
          }
        } else {
          this.hunter.patrolAngle += 0.012;
          const px = Math.cos(this.hunter.patrolAngle) * 16;
          const pz = Math.sin(this.hunter.patrolAngle) * 16;
          const ang = Math.atan2(px - this.hunter.x, pz - this.hunter.z);
          this.hunter.yaw = ang;
          const nx = this.hunter.x + Math.sin(ang) * 0.048;
          const nz = this.hunter.z + Math.cos(ang) * 0.048;
          if (!this.checkCollision(nx, this.hunter.z)) this.hunter.x = nx;
          if (!this.checkCollision(this.hunter.x, nz)) this.hunter.z = nz;
        }

        // Check Squad Wipe
        const allPlayers = Object.values(Net.players);
        if (allPlayers.length > 0 && allPlayers.every(p => p.downed)) {
          const msg = 'Squad wiped! Subject-0 caught everyone.';
          Net.broadcast({ type: 'GAMEOVER', win: false, reason: msg });
          this.triggerEnd(false, msg);
        }
      }

      // Monster Mesh Smooth Sync & Proximity Heartbeat
      if (this.hunter.mesh) {
        this.hunter.mesh.position.x = THREE.MathUtils.lerp(this.hunter.mesh.position.x, this.hunter.x, 0.25);
        this.hunter.mesh.position.z = THREE.MathUtils.lerp(this.hunter.mesh.position.z, this.hunter.z, 0.25);
        this.hunter.mesh.rotation.y = this.hunter.yaw;
        this.hunter.mesh.rotation.x = 0.16;
      }

      const dMonster = Math.hypot(this.hunter.x - me.x, this.hunter.z - me.z);
      const danger = document.getElementById('danger-overlay');
      if (dMonster < 12 && !me.hiding) {
        SFX.heartbeat(dMonster);
        danger.style.boxShadow = `inset 0 0 ${Math.round((12 - dMonster) * 10)}px rgba(220,38,38,0.65)`;
      } else {
        danger.style.boxShadow = 'none';
      }

      // Network Sync (20 Hz)
      const nowNet = performance.now();
      if (nowNet - this.lastNetSync > 50) {
        this.lastNetSync = nowNet;
        if (Net.isHost) {
          Net.broadcast({ type: 'STATE', players: Net.players, hunter: { x: this.hunter.x, z: this.hunter.z, yaw: this.hunter.yaw } });
        } else {
          Net.sendToHost({ type: 'MOVE', id: Net.myId, state: { x: me.x, z: me.z, yaw: me.yaw, torch: me.torch, hiding: me.hiding, makingNoise: me.makingNoise } });
        }
      }

      this.drawRadar(me);
    }

    this.renderer.render(this.scene, this.camera);
  }
};
