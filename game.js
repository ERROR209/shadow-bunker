window.toggleFullScreen = function() {
  const docEl = document.documentElement;
  if (!document.fullscreenElement) {
    docEl.requestFullscreen?.().catch(() => {});
    screen.orientation?.lock?.('landscape').catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
};

const SFX = {
  ctx: null,
  masterGain: null,
  muted: false,
  lastStep: 0,
  lastDrip: 0,
  lastMonsterStep: 0,
  lastBeat: 0,

  init() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.8;
        this.masterGain.connect(this.ctx.destination);
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch (e) {}
  },

  toggleMute() {
    this.init();
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    }
    const btn = document.getElementById('sfx-toggle-btn');
    if (btn) {
      btn.textContent = this.muted ? '🔇 MUTED' : '🔊 ON';
      btn.style.background = this.muted ? '#dc2626' : '#16a34a';
    }
  },

  tone(freq, type = 'sine', dur = 0.16, vol = 0.16, endFreq = null) {
    this.init();
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type === 'square' ? 'triangle' : type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(vol * 0.7, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + dur);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch (e) {}
  },

  step(running = false) {
    const now = performance.now();
    if (now - this.lastStep < (running ? 290 : 460)) return;
    this.lastStep = now;
    this.tone(running ? 115 : 90, 'sine', 0.08, running ? 0.12 : 0.07, 36);
  },
  torchClick() { this.tone(1100, 'triangle', 0.04, 0.14, 650); },
  stunZap() { this.tone(460, 'sawtooth', 0.25, 0.24, 110); },
  electricShockHit() {
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        this.tone(950 + Math.random() * 900, 'sawtooth', 0.08, 0.24, 140);
        this.tone(220 + Math.random() * 180, 'triangle', 0.1, 0.2, 65);
      }, i * 75);
    }
  },
  siren() { this.tone(440, 'triangle', 0.35, 0.18, 580); },
  pickup() { this.tone(540, 'sine', 0.14, 0.16, 820); },
  ambientDrip() {
    const now = performance.now();
    if (now - this.lastDrip < 8000) return;
    this.lastDrip = now;
    if (Math.random() < 0.4) this.tone(980, 'sine', 0.05, 0.04, 1400);
  },
  monsterStep(dist) {
    if (dist > 20) return;
    const now = performance.now();
    if (now - this.lastMonsterStep < Math.max(260, dist * 35)) return;
    this.lastMonsterStep = now;
    this.tone(72, 'sine', 0.12, Math.min(0.22, (20 - dist) * 0.012), 32);
  },
  heartbeat(dist) {
    const now = performance.now();
    if (now - this.lastBeat < Math.max(320, dist * 55)) return;
    this.lastBeat = now;
    this.tone(64, 'sine', 0.11, 0.16, 42);
  },
  jumpscareScream() { this.tone(240, 'sawtooth', 0.55, 0.28, 75); }
};

function makeTexture(kind = 'wall', lvl = 1) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  if (kind === 'floor') {
    ctx.fillStyle = lvl === 3 ? '#292524' : (lvl === 2 ? '#0b2e26' : '#162033');
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(148,163,184,0.28)';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 60, 60); ctx.strokeRect(66, 2, 60, 60);
    ctx.strokeRect(2, 66, 60, 60); ctx.strokeRect(66, 66, 60, 60);
  } else if (kind === 'ceil') {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 58, 128, 12);
  } else {
    ctx.fillStyle = lvl === 3 ? '#44403c' : (lvl === 2 ? '#134e4a' : '#26354d');
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = lvl === 3 ? '#f97316' : (lvl === 2 ? '#22c55e' : '#eab308');
    ctx.fillRect(0, 96, 128, 10);
    ctx.strokeStyle = 'rgba(56,189,248,0.22)';
    ctx.strokeRect(1, 1, 126, 126);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function buildTacticalCharacter(player = {}) {
  const grp = new THREE.Group();
  const roleColors = { SCOUT: 0x0284c7, ENGINEER: 0xd97706, MEDIC: 0x16a34a, TECH: 0x9333ea };
  const suitMat = new THREE.MeshStandardMaterial({ color: roleColors[player.role] || 0x0284c7, roughness: 0.45 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xfde68a });
  const visorMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.34), suitMat); torso.position.y = 1.12;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat); head.position.y = 1.76;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.06), visorMat); visor.position.set(0, 1.78, -0.21);

  const leftLegPivot = new THREE.Group(); leftLegPivot.position.set(-0.16, 0.72, 0);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.22), darkMat); legL.position.y = -0.36; leftLegPivot.add(legL);
  const rightLegPivot = new THREE.Group(); rightLegPivot.position.set(0.16, 0.72, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.22), darkMat); legR.position.y = -0.36; rightLegPivot.add(legR);
  const leftArmPivot = new THREE.Group(); leftArmPivot.position.set(-0.42, 1.46, 0);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.18), suitMat); armL.position.y = -0.33; leftArmPivot.add(armL);
  const rightArmPivot = new THREE.Group(); rightArmPivot.position.set(0.42, 1.46, 0);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.18), suitMat); armR.position.y = -0.33; rightArmPivot.add(armR);

  grp.add(torso, head, visor, leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot);
  return { grp, limbs: { leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot } };
}

const Game3D = {
  scene: null,
  camera: null,
  renderer: null,
  flashlight: null,
  hemiLight: null,
  playerHandGroup: null,
  selfAvatar: null,
  thirdPerson: false,
  mapGroup: null,
  wallBoxes: [],
  teammateMeshes: {},
  hunter: { x: 26, z: -26, yaw: 0, mesh: null, limbs: null, walkCycle: 0, stunnedUntil: 0, goalX: 16, goalZ: -16, alertUntil: 0 },
  level: 1,
  battery: 100,
  stamina: 100,
  sanity: 100,
  crouching: false,
  lookSens: 1.0,
  flickerLights: [],
  animatedProps: [],
  nvgActive: false,
  skillCooldownUntil: 0,
  turboUntil: 0,
  decoyPos: null,
  decoyUntil: 0,
  stunCharges: 2,
  hasFuse: false,
  powerRestored: false,
  drivesCollected: 0,
  drivesUploaded: false,
  dataDrives: [],
  serverMesh: null,
  fuseMesh: null,
  genMesh: null,
  genPos: { x: -34, z: 34 },
  serverPos: { x: 0, z: -34 },
  genSparks: [],
  exitMesh: null,
  exitBeacon: null,
  exitPos: { x: 34, z: -37.2 },
  lockers: [],
  notes: [],
  terminals: [],
  pickups: [],
  flares: [],
  activePing: null,
  pingMesh: null,
  locks: [false, false, false],
  codes: ['123', '456', '789'],
  spotOrder: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  activeTerminalIdx: -1,
  typedCode: '',
  selfDestructActive: false,
  escapeTimeLeft: 60,
  lastTick: 0,
  gameOver: false,
  lastNetSync: 0,
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
  controlsBound: false,

  start(codes, spotOrder) {
    this.codes = codes || ['123', '456', '789'];
    this.spotOrder = Array.isArray(spotOrder) && spotOrder.length >= 11 ? spotOrder : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    if (window.HomeShowcase3D && HomeShowcase3D.renderer) {
      try {
        HomeShowcase3D.renderer.dispose();
        HomeShowcase3D.renderer.forceContextLoss();
      } catch (e) {}
      HomeShowcase3D.renderer = null;
    }

    const menu = document.getElementById('menu-screen');
    if (menu) { menu.classList.add('hidden'); menu.style.display = 'none'; }
    const gs = document.getElementById('game-screen');
    if (gs) { gs.classList.remove('hidden'); gs.style.display = 'block'; }

    SFX.init();
    this.init3D();
  },

  init3D() {
    const me = Net.players[Net.myId];
    const myRole = me ? me.role : 'SCOUT';
    const rb = document.getElementById('role-badge');
    if (rb) rb.textContent = myRole;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02040a);
    this.scene.fog = new THREE.FogExp2(0x02040a, 0.032);

    const W = Math.max(320, window.innerWidth);
    const H = Math.max(200, window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(74, W / H, 0.1, 100);
    this.camera.rotation.order = 'YXZ';

    const container = document.getElementById('three-container');
    container.innerHTML = '';
    container.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:1;display:block;';

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(W, H);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block;z-index:1;';
    container.appendChild(this.renderer.domElement);

    this.hemiLight = new THREE.HemisphereLight(0x334155, 0x02040a, 0.085);
    this.scene.add(this.hemiLight);

    this.flashlight = new THREE.SpotLight(0xfef3c7, 3.2, 36, Math.PI / 3.6, 0.72, 1.5);
    this.flashlight.position.set(0, 0, 0);
    this.flashlight.target.position.set(0, 0, -1);
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlight.target);

    this.playerHandGroup = new THREE.Group();
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.5 });

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.44), sleeveMat);
    leftArm.position.set(-0.26, -0.22, -0.38);
    const torchTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.038, 0.24, 12),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.7 })
    );
    torchTube.rotation.x = Math.PI / 2;
    torchTube.position.set(-0.26, -0.18, -0.55);

    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.44), sleeveMat);
    rightArm.position.set(0.26, -0.22, -0.38);
    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.11), gloveMat);
    rightHand.position.set(0.26, -0.21, -0.6);
    const stunGun = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.1, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.9 })
    );
    stunGun.position.set(0.26, -0.15, -0.6);

    this.playerHandGroup.add(leftArm, torchTube, rightArm, rightHand, stunGun);
    this.camera.add(this.playerHandGroup);

    this.selfAvatar = this.createTeammateAvatar(me || { name: 'YOU', role: myRole });
    this.selfAvatar.grp.visible = false;

    this.scene.add(this.camera);
    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);

    const initSpawns = [
      { x: -33, z: 31, yaw: -Math.PI / 2 },
      { x: -29, z: 31, yaw: Math.PI / 2 },
      { x: -33, z: 29, yaw: -Math.PI / 2 },
      { x: -29, z: 29, yaw: Math.PI / 2 }
    ];
    this.getOrderedSquad().forEach((p, idx) => {
      const sp = initSpawns[idx % 4];
      p.x = sp.x; p.z = sp.z; p.yaw = sp.yaw;
    });

    this.buildLevelMap(1);
    this.buildMonster(1);
    this.setupControls();

    if (!this.animStarted) {
      this.animStarted = true;
      window.addEventListener('resize', () => {
        if (!this.renderer || !this.camera) return;
        const w = Math.max(320, window.innerWidth);
        const h = Math.max(200, window.innerHeight);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
      });
      this.animate();
    }
    this.showRadioToast('SECTOR-09', '🔦 Find the glowing Blue Power Fuse & activate the Generator!');
  },

  clearMap() {
    while (this.mapGroup && this.mapGroup.children.length > 0) {
      this.mapGroup.remove(this.mapGroup.children[0]);
    }
    this.wallBoxes = [];
    this.lockers = [];
    this.notes = [];
    this.terminals = [];
    this.dataDrives = [];
    this.pickups = [];
  },

  addWall(x, z, w, d, wallTex, h = 4.0) {
    const t = wallTex.clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(1, Math.round(Math.max(w, d) / 4)), 1);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, metalness: 0.02 }));
    mesh.position.set(x, h / 2, z);
    this.mapGroup.add(mesh);
    this.wallBoxes.push({ minX: x - w / 2 - 0.45, maxX: x + w / 2 + 0.45, minZ: z - d / 2 - 0.45, maxZ: z + d / 2 + 0.45 });
  },

  addSafeLockers(spots) {
    spots.forEach(l => {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 2.35, 1.15),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0369a1, emissiveIntensity: 0.55 })
      );
      body.position.y = 1.175;
      const topBeacon = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.18, 1.22), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
      topBeacon.position.y = 2.42;
      grp.add(body, topBeacon);
      grp.position.set(l.x, 0, l.z);
      this.mapGroup.add(grp);
      this.lockers.push(l);
    });
  },

  addRoom(cx, cz, rw, rd, doorSide, wallTex, h = 4.0) {
    const gap = 3.4;
    const hw = rw / 2, hd = rd / 2;
    if (doorSide === 'N') {
      this.addWall(cx - (hw + gap / 2) / 2, cz - hd, hw - gap / 2, 0.85, wallTex, h);
      this.addWall(cx + (hw + gap / 2) / 2, cz - hd, hw - gap / 2, 0.85, wallTex, h);
    } else this.addWall(cx, cz - hd, rw, 0.85, wallTex, h);

    if (doorSide === 'S') {
      this.addWall(cx - (hw + gap / 2) / 2, cz + hd, hw - gap / 2, 0.85, wallTex, h);
      this.addWall(cx + (hw + gap / 2) / 2, cz + hd, hw - gap / 2, 0.85, wallTex, h);
    } else this.addWall(cx, cz + hd, rw, 0.85, wallTex, h);

    if (doorSide === 'W') {
      this.addWall(cx - hw, cz - (hd + gap / 2) / 2, 0.85, hd - gap / 2, wallTex, h);
      this.addWall(cx - hw, cz + (hd + gap / 2) / 2, 0.85, hd - gap / 2, wallTex, h);
    } else this.addWall(cx - hw, cz, 0.85, rd, wallTex, h);

    if (doorSide === 'E') {
      this.addWall(cx + hw, cz - (hd + gap / 2) / 2, 0.85, hd - gap / 2, wallTex, h);
      this.addWall(cx + hw, cz + (hd + gap / 2) / 2, 0.85, hd - gap / 2, wallTex, h);
    } else this.addWall(cx + hw, cz, 0.85, rd, wallTex, h);
  },

  buildLevelMap(lvl) {
    this.clearMap();
    this.level = lvl;
    this.flickerLights = [];
    this.animatedProps = [];
    this.genSparks = [];

    const isRooftop = lvl === 5;
    this.scene.background = new THREE.Color(isRooftop ? 0x070b19 : 0x02040a);
    this.scene.fog = new THREE.FogExp2(isRooftop ? 0x070b19 : 0x02040a, isRooftop ? 0.018 : 0.03);

    const floorTex = makeTexture('floor', lvl);
    floorTex.repeat.set(22, 22);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ map: floorTex, color: isRooftop ? 0x334155 : 0xffffff, roughness: 0.88, metalness: 0.05 })
    );
    floor.rotation.x = -Math.PI / 2;
    this.mapGroup.add(floor);

    if (!isRooftop) {
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: makeTexture('ceil'), side: THREE.DoubleSide }));
      ceil.rotation.x = Math.PI / 2;
      ceil.position.y = 4.2;
      this.mapGroup.add(ceil);
    } else {
      const heliPad = new THREE.Mesh(new THREE.RingGeometry(4.2, 5.0, 32), new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide }));
      heliPad.rotation.x = -Math.PI / 2;
      heliPad.position.set(30, 0.03, -30);
      this.mapGroup.add(heliPad);
    }

    const wallTex = makeTexture('wall', lvl);
    const wallH = isRooftop ? 2.4 : 4.0;
    this.addWall(0, -40, 80, 1.2, wallTex, wallH);
    this.addWall(0, 40, 80, 1.2, wallTex, wallH);
    this.addWall(-40, 0, 1.2, 80, wallTex, wallH);
    this.addWall(40, 0, 1.2, 80, wallTex, wallH);

    const roomConfigs = {
      1: [
        { cx: -27, cz: 27, rw: 18, rd: 18, door: 'E' },
        { cx: -27, cz: 0, rw: 18, rd: 16, door: 'E' },
        { cx: -27, cz: -27, rw: 18, rd: 18, door: 'S' },
        { cx: 0, cz: 27, rw: 18, rd: 18, door: 'N' },
        { cx: 0, cz: -27, rw: 18, rd: 18, door: 'S' },
        { cx: 27, cz: 27, rw: 18, rd: 18, door: 'W' },
        { cx: 27, cz: 0, rw: 18, rd: 16, door: 'W' }
      ],
      2: [
        { cx: -27, cz: 27, rw: 18, rd: 18, door: 'N' },
        { cx: -27, cz: -25, rw: 18, rd: 20, door: 'E' },
        { cx: 0, cz: 0, rw: 18, rd: 18, door: 'S' },
        { cx: 27, cz: 25, rw: 18, rd: 20, door: 'W' },
        { cx: 27, cz: -2, rw: 18, rd: 16, door: 'S' }
      ],
      3: [
        { cx: -27, cz: 27, rw: 18, rd: 18, door: 'E' },
        { cx: -26, cz: -26, rw: 20, rd: 20, door: 'S' },
        { cx: 26, cz: 26, rw: 20, rd: 20, door: 'N' },
        { cx: 0, cz: -27, rw: 18, rd: 18, door: 'S' },
        { cx: 27, cz: 0, rw: 18, rd: 16, door: 'W' }
      ],
      4: [
        { cx: -27, cz: 27, rw: 18, rd: 18, door: 'N' },
        { cx: -27, cz: 0, rw: 18, rd: 16, door: 'E' },
        { cx: -27, cz: -27, rw: 18, rd: 18, door: 'E' },
        { cx: 0, cz: 26, rw: 18, rd: 18, door: 'N' },
        { cx: 27, cz: 26, rw: 18, rd: 18, door: 'W' },
        { cx: 27, cz: 0, rw: 18, rd: 16, door: 'W' }
      ],
      5: [
        { cx: -27, cz: 27, rw: 18, rd: 18, door: 'E', h: 2.4 },
        { cx: -26, cz: -26, rw: 18, rd: 18, door: 'S', h: 2.4 },
        { cx: 26, cz: 26, rw: 18, rd: 18, door: 'N', h: 2.4 },
        { cx: 0, cz: -26, rw: 18, rd: 18, door: 'S', h: 2.4 }
      ]
    };
    (roomConfigs[lvl] || roomConfigs[1]).forEach(r => this.addRoom(r.cx, r.cz, r.rw, r.rd, r.door, wallTex, r.h || wallH));

    [
      { x: -27, z: 27 }, { x: -27, z: 0 }, { x: -27, z: -27 },
      { x: 0, z: 27 }, { x: 0, z: 0 }, { x: 0, z: -27 },
      { x: 27, z: 27 }, { x: 27, z: 0 }, { x: 27, z: -27 }
    ].forEach((pt, idx) => {
      let tubeMat = null;
      if (!isRooftop) {
        tubeMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.35), tubeMat);
        lamp.position.set(pt.x, 4.12, pt.z);
        this.mapGroup.add(lamp);
      }
      const pl = new THREE.PointLight(isRooftop ? 0x60a5fa : 0x38bdf8, isRooftop ? 0.35 : 0.18, 12);
      pl.position.set(pt.x, 3.75, pt.z);
      this.mapGroup.add(pl);
      if (idx !== 0) this.flickerLights.push({ light: pl, mat: tubeMat, phase: idx * 1.9 });
    });

    this.addSafeLockers([
      { x: -33, z: 21 }, { x: -33, z: 5 }, { x: -33, z: -21 }, { x: -6, z: 33 },
      { x: 6, z: -21 }, { x: 33, z: 21 }, { x: 33, z: 5 }, { x: 14, z: -12 },
      { x: -16, z: 8 }, { x: -16, z: -18 }, { x: 16, z: 18 }, { x: 16, z: -2 }
    ]);

    const baseSpots = [
      { x: -27, z: 0 }, { x: -27, z: -27 }, { x: 0, z: 27 }, { x: 0, z: -27 },
      { x: 27, z: 27 }, { x: 27, z: 0 }, { x: -13, z: -13 }, { x: 13, z: 13 },
      { x: -13, z: 13 }, { x: 13, z: -13 }, { x: 0, z: 2 }
    ];
    const orderedSpots = this.spotOrder.map(i => baseSpots[i % baseSpots.length]);

    const fuseSpot = orderedSpots[0];
    this.genPos = orderedSpots[1];
    const driveSpots = [orderedSpots[2], orderedSpots[3], orderedSpots[4]];
    this.serverPos = orderedSpots[5];
    const noteSpots = [orderedSpots[6], orderedSpots[7], orderedSpots[8]];
    const termSpots = [orderedSpots[9], orderedSpots[10], { x: -22, z: -5 }];

    const fuseGrp = new THREE.Group();
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.65, 16), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.14, 16), new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 }));
    capTop.position.y = 0.36;
    const capBot = capTop.clone(); capBot.position.y = -0.36;
    const fRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 24), new THREE.MeshBasicMaterial({ color: 0x7dd3fc }));
    fuseGrp.add(core, capTop, capBot, fRing);
    fuseGrp.position.set(fuseSpot.x, 1.05, fuseSpot.z);
    const fuseLight = new THREE.PointLight(0x38bdf8, 2.8, 11);
    fuseLight.position.set(fuseSpot.x, 1.4, fuseSpot.z);
    this.mapGroup.add(fuseGrp, fuseLight);
    this.fuseMesh = fuseGrp;

    const genGrp = new THREE.Group();
    const steelDark = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.75, roughness: 0.35 });
    const bodyMetal = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.65, roughness: 0.4 });
    const hazardMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.5 });

    const genBase = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.22, 1.55), steelDark);
    genBase.position.y = 0.11;
    genGrp.add(genBase);

    [[-1.15, -0.68], [1.15, -0.68], [-1.15, 0.68], [1.15, 0.68]].forEach(([px, pz]) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.72, 0.11), hazardMat);
      post.position.set(px, 0.96, pz);
      genGrp.add(post);
    });
    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.88, 0.86), bodyMetal);
    engineBlock.position.set(-0.22, 0.72, 0);
    const alternatorDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.75, 18), steelDark);
    alternatorDrum.rotation.z = Math.PI / 2;
    alternatorDrum.position.set(0.65, 0.72, 0);
    const fuelTank = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.32, 0.92), new THREE.MeshStandardMaterial({ color: 0x991b1b, metalness: 0.5, roughness: 0.4 }));
    fuelTank.position.set(-0.15, 1.42, 0);
    genGrp.add(engineBlock, alternatorDrum, fuelTank);

    const genCoil = new THREE.Group();
    const fanHub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 12), hazardMat);
    fanHub.rotation.z = Math.PI / 2;
    genCoil.add(fanHub);
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.62, 0.12), steelDark);
      blade.rotation.x = (b * Math.PI) / 4;
      genCoil.add(blade);
    }
    genCoil.position.set(1.06, 0.72, 0);
    genGrp.add(genCoil);

    const genTank = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.58, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x991b1b, emissive: 0xdc2626, emissiveIntensity: 1.1, roughness: 0.3 })
    );
    genTank.position.set(0.35, 1.05, 0.68);
    genGrp.add(genTank);

    const genSparkLight = new THREE.PointLight(0x38bdf8, 0, 12);
    genSparkLight.position.set(0, 1.5, 0);
    genGrp.add(genSparkLight);

    for (let s = 0; s < 12; s++) {
      const spMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.42, 0.06),
        new THREE.MeshBasicMaterial({ color: s % 2 === 0 ? 0x38bdf8 : 0xfef08a })
      );
      spMesh.visible = false;
      genGrp.add(spMesh);
      this.genSparks.push({ mesh: spMesh, light: genSparkLight, seed: s * 0.9 });
    }
    genGrp.position.set(this.genPos.x, 0, this.genPos.z);
    this.mapGroup.add(genGrp);
    this.genMesh = genTank;
    this.animatedProps.push(genCoil);

    const itemColors = { 1: 0xd8b4fe, 2: 0x38bdf8, 3: 0xf97316, 4: 0x4ade80, 5: 0xfacc15 };
    const itemCol = itemColors[lvl] || 0xd8b4fe;
    driveSpots.forEach((ds, idx) => {
      const dGrp = new THREE.Group();
      const coreObj = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color: itemCol }));
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.03, 8, 24), new THREE.MeshBasicMaterial({ color: itemCol }));
      halo.rotation.x = Math.PI / 2;
      dGrp.add(coreObj, halo);
      dGrp.position.set(ds.x, 1.05, ds.z);
      this.mapGroup.add(dGrp);
      this.dataDrives.push({ x: ds.x, z: ds.z, idx, taken: false, mesh: dGrp });
    });

    const srvGrp = new THREE.Group();
    const rackL = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.3, 0.95), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 }));
    rackL.position.set(-0.55, 1.15, 0);
    const rackR = rackL.clone(); rackR.position.x = 0.55;
    const srvScreen = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.65, 0.12), new THREE.MeshStandardMaterial({ color: 0x6b21a8, emissive: 0x9333ea, emissiveIntensity: 1.2 }));
    srvScreen.position.set(0, 1.45, 0.48);
    srvGrp.add(rackL, rackR, srvScreen);
    srvGrp.position.set(this.serverPos.x, 0, this.serverPos.z);
    this.mapGroup.add(srvGrp);
    this.serverMesh = srvScreen;

    const logTexts = [
      'Dr. Verma Log #1: Objective alerts draw the Monster straight to you! Code #1:',
      'Dr. Verma Log #2: Upload all 3 Data Drives at the Server first! Code #2:',
      'Dr. Verma Log #3: Final override code for Terminal #3:'
    ];
    noteSpots.forEach((spot, idx) => {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.95), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 }));
      stand.position.set(spot.x, 0.425, spot.z);
      const paper = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.62), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      paper.position.set(spot.x, 0.88, spot.z);
      this.mapGroup.add(stand, paper);
      this.notes.push({ x: spot.x, z: spot.z, idx, text: logTexts[idx] });
    });

    termSpots.forEach((spot, idx) => {
      const tGrp = new THREE.Group();
      const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.25, 0.75), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 }));
      pedestal.position.y = 0.625;
      const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.56, 0.16), new THREE.MeshStandardMaterial({ color: 0xb91c1c, emissive: 0xef4444, emissiveIntensity: 1.1 }));
      monitor.position.set(0, 1.48, 0);
      monitor.rotation.x = -0.35;
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.35), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      pad.position.set(0, 1.28, 0.25);
      tGrp.add(pedestal, monitor, pad);
      tGrp.position.set(spot.x, 0, spot.z);
      this.mapGroup.add(tGrp);
      this.terminals.push({ x: spot.x, z: spot.z, idx, mesh: monitor });
    });

    this.exitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 3.5, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x0f172a })
    );
    this.exitMesh.position.set(34, 1.75, -39.2);
    this.mapGroup.add(this.exitMesh);

    const beaconGrp = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.9, 12, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
    );
    beam.position.y = 6;
    beaconGrp.add(beam);
    beaconGrp.position.set(34, 0, -37.2);
    beaconGrp.visible = false;
    this.mapGroup.add(beaconGrp);
    this.exitBeacon = beaconGrp;
    this.exitPos = { x: 34, z: -37.2 };

    [
      { x: -20, z: 26, kind: 'BATTERY' }, { x: 26, z: -18, kind: 'BATTERY' },
      { x: -20, z: -28, kind: 'STUN' }, { x: 24, z: 26, kind: 'STUN' }
    ].forEach((ps, idx) => {
      const isBat = ps.kind === 'BATTERY';
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.52, 0.52),
        new THREE.MeshStandardMaterial({ color: isBat ? 0x22c55e : 0xc084fc, emissive: isBat ? 0x16a34a : 0x9333ea, emissiveIntensity: 1.3 })
      );
      mesh.position.set(ps.x, 0.65, ps.z);
      this.mapGroup.add(mesh);
      this.pickups.push({ ...ps, idx, mesh, taken: false });
    });
  },

  SQUAD_COLORS: [
    { hex: '#facc15', num: 0xfacc15, label: '1' },
    { hex: '#38bdf8', num: 0x38bdf8, label: '2' },
    { hex: '#4ade80', num: 0x4ade80, label: '3' },
    { hex: '#f472b6', num: 0xf472b6, label: '4' }
  ],

  getOrderedSquad() {
    const arr = Object.values(Net.players || {});
    arr.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return arr.slice(0, 4);
  },

  makeNameTagSprite(numStr, playerName, colorHex) {
    const cvs = document.createElement('canvas');
    cvs.width = 256; cvs.height = 64;
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = 'rgba(2, 6, 23, 0.96)';
    ctx.beginPath();
    ctx.roundRect(10, 10, 236, 44, 12);
    ctx.fill();
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = colorHex;
    ctx.beginPath();
    ctx.arc(34, 32, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#090d16';
    ctx.font = '900 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(numStr, 34, 33);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 19px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText((playerName || 'AGENT').slice(0, 12), 56, 33);

    const tex = new THREE.CanvasTexture(cvs);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(1.65, 0.42, 1);
    sp.position.set(0, 2.38, 0);
    return sp;
  },

  updateBgmiSquadHUD() {
    const box = document.getElementById('bgmi-squad-list');
    if (!box) return;
    const squad = this.getOrderedSquad();
    box.innerHTML = squad.map((p, idx) => {
      const col = this.SQUAD_COLORS[idx] || this.SQUAD_COLORS[0];
      const isMe = p.id === Net.myId;
      const statusTxt = p.downed ? '🆘 CAUGHT' : (p.hiding ? '🔒 HIDING' : (p.role || 'SCOUT'));
      const hpWidth = p.downed ? '22%' : '100%';
      const hpColor = p.downed ? '#ef4444' : col.hex;
      return `<div style="display:flex;align-items:center;gap:6px;background:rgba(9,13,22,0.82);border-left:3px solid ${col.hex};padding:3px 8px 3px 5px;border-radius:6px;min-width:132px;backdrop-filter:blur(4px);">
        <span style="width:17px;height:17px;border-radius:50%;background:${col.hex};color:#090d16;font-weight:900;font-size:0.68rem;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">${idx + 1}</span>
        <div style="flex:1;overflow:hidden;">
          <div style="font-size:0.66rem;font-weight:900;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name || 'Agent'} ${isMe ? '(YOU)' : ''}</div>
          <div style="width:100%;height:3px;background:#1e293b;border-radius:2px;margin-top:2px;"><div style="width:${hpWidth};height:100%;background:${hpColor};border-radius:2px;"></div></div>
          <div style="font-size:0.54rem;color:#94a3b8;font-weight:700;margin-top:1px;">${statusTxt}</div>
        </div>
      </div>`;
    }).join('');
  },

  createTeammateAvatar(player, slotIdx = 0) {
    const built = buildTacticalCharacter(player);
    const col = this.SQUAD_COLORS[slotIdx] || this.SQUAD_COLORS[0];
    const nameTag = this.makeNameTagSprite(String(slotIdx + 1), player.name || 'AGENT', col.hex);
    built.grp.add(nameTag);
    const torchLight = new THREE.PointLight(0xfef3c7, 0.9, 8);
    torchLight.position.set(-0.35, 1.35, -0.6);
    built.grp.add(torchLight);
    this.scene.add(built.grp);
    return { grp: built.grp, limbs: built.limbs, torchLight, lastX: player.x || 0, lastZ: player.z || 0, stride: 0 };
  },

  animateCharacterLimbs(charObj, isMoving) {
    if (!charObj || !charObj.limbs) return;
    if (isMoving) {
      charObj.stride += 0.22;
      const swing = Math.sin(charObj.stride) * 0.65;
      charObj.limbs.leftLegPivot.rotation.x = swing;
      charObj.limbs.rightLegPivot.rotation.x = -swing;
      charObj.limbs.leftArmPivot.rotation.x = -swing * 0.75;
      charObj.limbs.rightArmPivot.rotation.x = swing * 0.75 - 0.25;
    } else {
      charObj.limbs.leftLegPivot.rotation.x *= 0.8;
      charObj.limbs.rightLegPivot.rotation.x *= 0.8;
      charObj.limbs.leftArmPivot.rotation.x *= 0.8;
      charObj.limbs.rightArmPivot.rotation.x = -0.2;
    }
  },

  syncTeammates() {
    if (!this.scene) return;
    this.updateBgmiSquadHUD();
    const squad = this.getOrderedSquad();
    squad.forEach((p, idx) => {
      if (p.id === Net.myId) return;
      if (!this.teammateMeshes[p.id]) {
        const created = this.createTeammateAvatar(p, idx);
        created.grp.position.set(p.x || -31, 0, p.z || 31);
        this.teammateMeshes[p.id] = created;
      }
      const tm = this.teammateMeshes[p.id];
      tm.grp.visible = !p.hiding;
      const moved = Math.hypot((p.x || 0) - tm.lastX, (p.z || 0) - tm.lastZ) > 0.006;
      tm.lastX = p.x || 0; tm.lastZ = p.z || 0;
      tm.grp.position.x = THREE.MathUtils.lerp(tm.grp.position.x, p.x || 0, 0.35);
      tm.grp.position.z = THREE.MathUtils.lerp(tm.grp.position.z, p.z || 0, 0.35);
      tm.grp.rotation.y = p.yaw || 0;
      this.animateCharacterLimbs(tm, moved);
    });
  },

  buildMonster(lvl = 1) {
    if (this.hunter && this.hunter.mesh) this.scene.remove(this.hunter.mesh);
    const configs = {
      1: { name: 'SUBJECT-0', skin: 0x18181b, claw: 0x991b1b, eye: 0xff0000, aura: 0xdc2626, sx: 1.0, sy: 1.0, sz: 1.0 },
      2: { name: 'THE WATCHER', skin: 0x0f172a, claw: 0x0284c7, eye: 0x38bdf8, aura: 0x0ea5e9, sx: 0.88, sy: 1.22, sz: 0.88 },
      3: { name: 'REACTOR MUTANT', skin: 0x291509, claw: 0xea580c, eye: 0xfacc15, aura: 0xf97316, sx: 1.18, sy: 1.12, sz: 1.18 },
      4: { name: 'SEWER CRAWLER', skin: 0x052e16, claw: 0x16a34a, eye: 0x4ade80, aura: 0x22c55e, sx: 1.3, sy: 0.68, sz: 1.35 },
      5: { name: 'TITAN PRIME', skin: 0x1e1b4b, claw: 0xc026d3, eye: 0xf43f5e, aura: 0xe11d48, sx: 1.42, sy: 1.35, sz: 1.42 }
    };
    const cfg = configs[lvl] || configs[1];
    this.hunterVariant = cfg.name;

    const grp = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: cfg.skin, roughness: 0.35 });
    const clawMat = new THREE.MeshStandardMaterial({ color: cfg.claw, emissive: cfg.claw, emissiveIntensity: 0.35, roughness: 0.4 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.3, 0.48), skin); torso.position.y = 1.48;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.54, 0.54), skin); head.position.set(0, 2.34, 0.16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: cfg.eye });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), eyeMat); eyeL.position.set(-0.14, 2.38, 0.43);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.14;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.15, 0.2), clawMat); armL.position.set(-0.56, 1.42, 0.12);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.15, 0.2), clawMat); armR.position.set(0.56, 1.42, 0.12);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.9, 0.24), skin); legL.position.set(-0.22, 0.45, 0);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.9, 0.24), skin); legR.position.set(0.22, 0.45, 0);

    const aura = new THREE.PointLight(cfg.aura, 2.2, 10); aura.position.set(0, 1.8, 0.3);
    grp.add(torso, head, eyeL, eyeR, armL, armR, legL, legR, aura);
    grp.scale.set(cfg.sx, cfg.sy, cfg.sz);
    grp.position.set(this.hunter.x, 0, this.hunter.z);
    this.scene.add(grp);

    const shockGrp = new THREE.Group();
    const arcMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.035, 6, 18), arcMat);
      ring.rotation.x = Math.PI / 2 + (i - 0.5) * 0.35;
      ring.position.y = 0.85 + i * 0.75;
      shockGrp.add(ring);
    }
    shockGrp.visible = false;
    grp.add(shockGrp);
    this.hunter.shockGrp = shockGrp;
    this.hunter.mesh = grp;
    this.hunter.limbs = { armL, armR, legL, legR };
  },

  moveHunterToward(tx, tz, speed) {
    let ang = Math.atan2(tx - this.hunter.x, tz - this.hunter.z);
    const frontBlocked = this.checkCollision(this.hunter.x + Math.sin(ang) * 1.35, this.hunter.z + Math.cos(ang) * 1.35);
    if (frontBlocked) ang += 0.85;
    this.hunter.yaw = ang;
    const nx = this.hunter.x + Math.sin(ang) * speed;
    const nz = this.hunter.z + Math.cos(ang) * speed;
    if (!this.checkCollision(nx, this.hunter.z)) this.hunter.x = nx;
    if (!this.checkCollision(this.hunter.x, nz)) this.hunter.z = nz;
  },

  setupControls() {
    if (this.controlsBound) return;
    this.controlsBound = true;

    window.addEventListener('keydown', (e) => {
      if (document.activeElement && ['INPUT', 'SELECT'].includes(document.activeElement.tagName)) return;
      this.keys[e.code] = true;
      if (e.code === 'KeyF') this.toggleTorch();
      if (e.code === 'KeyE' || e.code === 'Enter') this.interact();
      if (e.code === 'KeyQ') this.fireStun();
      if (e.code === 'KeyV') document.getElementById('cam-toggle-btn')?.click();
      if (e.code === 'KeyC') this.toggleCrouch();
      if (e.code === 'KeyM') Net.toggleMic();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    const lookZone = document.getElementById('look-zone');
    let lookTouchId = null, lastTouchX = 0, lastTouchY = 0;
    lookZone.addEventListener('touchstart', (e) => {
      if (lookTouchId !== null) return;
      const t = e.changedTouches[0];
      lookTouchId = t.identifier;
      lastTouchX = t.clientX;
      lastTouchY = t.clientY;
    }, { passive: true });
    lookZone.addEventListener('touchmove', (e) => {
      const me = Net.players[Net.myId];
      if (!me || lookTouchId === null) return;
      for (const t of e.changedTouches) {
        if (t.identifier === lookTouchId) {
          me.yaw -= (t.clientX - lastTouchX) * 0.0068 * (this.lookSens || 1.0);
          this.camera.rotation.x = Math.max(-0.9, Math.min(0.9, this.camera.rotation.x - (t.clientY - lastTouchY) * 0.0045));
          lastTouchX = t.clientX;
          lastTouchY = t.clientY;
        }
      }
    }, { passive: true });
    const endLookTouch = (e) => {
      for (const t of e.changedTouches) if (t.identifier === lookTouchId) lookTouchId = null;
    };
    lookZone.addEventListener('touchend', endLookTouch, { passive: true });
    lookZone.addEventListener('touchcancel', endLookTouch, { passive: true });

    let pcMouseDown = false;
    lookZone.addEventListener('mousedown', (e) => {
      if (e.button === 2) { this.fireStun(); return; }
      pcMouseDown = true;
      if (document.pointerLockElement !== lookZone && lookZone.requestPointerLock) {
        lookZone.requestPointerLock().catch?.(() => {});
      }
    });
    lookZone.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mouseup', () => { pcMouseDown = false; });
    window.addEventListener('mousemove', (e) => {
      const me = Net.players[Net.myId];
      if (!me || this.gameOver) return;
      if (document.pointerLockElement === lookZone || pcMouseDown) {
        me.yaw -= e.movementX * 0.0026 * (this.lookSens || 1.0);
        this.camera.rotation.x = Math.max(-0.95, Math.min(0.95, this.camera.rotation.x - e.movementY * 0.0022));
      }
    });

    const joyZone = document.getElementById('joystick-zone');
    const stick = document.getElementById('joystick-stick');
    let joyTouchId = null;
    const updateJoyStick = (t) => {
      const r = joyZone.getBoundingClientRect();
      let dx = t.clientX - (r.left + r.width / 2);
      let dy = t.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy);
      if (dist > 38) { dx = (dx / dist) * 38; dy = (dy / dist) * 38; }
      stick.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy.dx = dx / 38;
      this.joy.dy = dy / 38;
    };
    joyZone.addEventListener('touchstart', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (joyTouchId !== null) return;
      const t = e.changedTouches[0];
      joyTouchId = t.identifier;
      this.joy.active = true;
      updateJoyStick(t);
    }, { passive: false });
    joyZone.addEventListener('touchmove', (e) => {
      if (!this.joy.active || joyTouchId === null) return;
      e.preventDefault(); e.stopPropagation();
      for (const t of e.changedTouches) if (t.identifier === joyTouchId) updateJoyStick(t);
    }, { passive: false });
    const resetJoy = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyTouchId) {
          joyTouchId = null; this.joy.active = false; this.joy.dx = 0; this.joy.dy = 0;
          stick.style.transform = 'translate(0,0)';
        }
      }
    };
    joyZone.addEventListener('touchend', resetJoy);
    joyZone.addEventListener('touchcancel', resetJoy);

    const bindBtn = (id, fn) => {
      const el = document.getElementById(id);
      if (!el) return;
      let lastFire = 0;
      const trigger = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        const now = performance.now();
        if (now - lastFire < 180) return;
        lastFire = now;
        fn();
      };
      el.addEventListener('touchstart', trigger, { passive: false });
      el.onclick = () => trigger();
    };

    bindBtn('torch-btn', () => this.toggleTorch());
    bindBtn('use-btn', () => this.interact());
    bindBtn('stun-btn', () => this.fireStun());
    bindBtn('crouch-btn', () => this.toggleCrouch());
    bindBtn('ping-btn', () => this.sendTacticalPing());
    bindBtn('flare-btn', () => this.dropFlare());
    bindBtn('skill-btn', () => this.activateClassSkill());
    bindBtn('mic-btn', () => Net.toggleMic());
    bindBtn('nvg-toggle-btn', () => this.toggleNightVision());
    bindBtn('cam-toggle-btn', () => {
      this.thirdPerson = !this.thirdPerson;
      const cb = document.getElementById('cam-toggle-btn');
      if (cb) cb.textContent = this.thirdPerson ? '3RD PERSON' : '1ST PERSON';
      if (this.flashlight && this.flashlight.target) {
        if (this.thirdPerson && this.selfAvatar && this.selfAvatar.grp) {
          this.flashlight.position.set(0, 1.45, -0.55);
          this.flashlight.target.position.set(0, 1.15, -8.0);
          this.selfAvatar.grp.add(this.flashlight);
          this.selfAvatar.grp.add(this.flashlight.target);
        } else if (this.camera) {
          this.flashlight.position.set(0, 0, 0);
          this.flashlight.target.position.set(0, 0, -1);
          this.camera.add(this.flashlight);
          this.camera.add(this.flashlight.target);
        }
      }
    });

    const runBtn = document.getElementById('run-btn');
    if (runBtn) {
      let runTouchId = null;
      runBtn.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        runTouchId = e.changedTouches[0].identifier;
        this.sprinting = true;
        runBtn.style.background = '#dc2626';
      }, { passive: false });
      const endRun = (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === runTouchId) {
            runTouchId = null; this.sprinting = false; runBtn.style.background = '';
          }
        }
      };
      runBtn.addEventListener('touchend', endRun);
      runBtn.addEventListener('touchcancel', endRun);
      runBtn.onmousedown = () => { this.sprinting = true; };
      runBtn.onmouseup = () => { this.sprinting = false; };
    }

    document.querySelectorAll('.radio-btn').forEach(btn => {
      btn.onclick = () => {
        const me = Net.players[Net.myId];
        const msg = btn.dataset.msg;
        this.showRadioToast(me ? me.name : 'You', msg);
        Net.sendEvent({ type: 'RADIO', sender: me ? me.name : 'Squad', msg });
      };
    });

    const closeNote = document.getElementById('close-note-btn');
    if (closeNote) closeNote.onclick = () => document.getElementById('note-modal')?.classList.add('hidden');

    document.querySelectorAll('.key').forEach(k => {
      k.onclick = () => {
        if (k.classList.contains('close')) return document.getElementById('puzzle-modal')?.classList.add('hidden');
        if (k.classList.contains('clear')) { this.typedCode = ''; return this.updateKeypadUI(); }
        if (this.typedCode.length < 3) {
          this.typedCode += k.dataset.val;
          this.updateKeypadUI();
          if (this.typedCode.length === 3) this.checkPuzzleCode();
        }
      };
    });

    const restartBtn = document.getElementById('instant-restart-btn');
    if (restartBtn) restartBtn.onclick = () => location.reload();

    const sensSlider = document.getElementById('sens-slider');
    const sensLabel = document.getElementById('sens-val-label');
    if (sensSlider) {
      sensSlider.oninput = () => {
        this.lookSens = parseFloat(sensSlider.value) || 1.0;
        if (sensLabel) sensLabel.textContent = this.lookSens.toFixed(1) + 'x';
      };
    }
    this.setupHudCustomizer();
  },

  setupHudCustomizer() {
    const settingsModal = document.getElementById('settings-modal');
    const openSetBtn = document.getElementById('open-settings-btn');
    const closeSetBtn = document.getElementById('close-settings-btn');
    const editBtn = document.getElementById('edit-hud-btn');
    const editorBar = document.getElementById('hud-editor-bar');
    const saveBtn = document.getElementById('save-hud-btn');
    const resetBtn = document.getElementById('reset-hud-btn');
    const gameScreen = document.getElementById('game-screen');

    if (openSetBtn && settingsModal) {
      openSetBtn.onclick = () => {
        settingsModal.classList.remove('hidden');
        if (document.pointerLockElement) document.exitPointerLock?.();
      };
    }
    if (closeSetBtn && settingsModal) closeSetBtn.onclick = () => settingsModal.classList.add('hidden');

    const draggableIds = ['joystick-zone', 'stun-btn', 'run-btn', 'torch-btn', 'use-btn', 'tactical-strip', 'radar-canvas'];
    const saved = JSON.parse(localStorage.getItem('sb09_hud_layout_v1') || '{}');
    draggableIds.forEach(id => {
      const el = document.getElementById(id);
      if (el && saved[id]) {
        el.style.position = 'fixed';
        el.style.left = saved[id].left;
        el.style.top = saved[id].top;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
      }
    });

    let isEditing = false;
    if (editBtn) {
      editBtn.onclick = () => {
        if (settingsModal) settingsModal.classList.add('hidden');
        isEditing = true;
        gameScreen?.classList.add('hud-editing');
        if (editorBar) { editorBar.classList.remove('hidden'); editorBar.style.display = 'flex'; }
      };
    }

    draggableIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      let sx = 0, sy = 0, ol = 0, ot = 0, dragging = false;
      const startDrag = (cx, cy) => {
        if (!isEditing) return;
        dragging = true;
        const r = el.getBoundingClientRect();
        sx = cx; sy = cy; ol = r.left; ot = r.top;
        el.style.position = 'fixed';
        el.style.left = ol + 'px'; el.style.top = ot + 'px';
        el.style.right = 'auto'; el.style.bottom = 'auto';
        el.style.outline = '2px dashed #38bdf8';
      };
      const moveDrag = (cx, cy) => {
        if (!isEditing || !dragging) return;
        el.style.left = Math.max(4, Math.min(window.innerWidth - el.offsetWidth - 4, ol + (cx - sx))) + 'px';
        el.style.top = Math.max(4, Math.min(window.innerHeight - el.offsetHeight - 4, ot + (cy - sy))) + 'px';
      };
      const endDrag = () => { dragging = false; };

      el.addEventListener('touchstart', (e) => {
        if (!isEditing) return;
        e.preventDefault(); e.stopImmediatePropagation();
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: false, capture: true });
      el.addEventListener('touchmove', (e) => {
        if (!isEditing) return;
        e.preventDefault(); e.stopImmediatePropagation();
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: false, capture: true });
      el.addEventListener('touchend', endDrag, { capture: true });
      el.addEventListener('mousedown', (e) => {
        if (!isEditing) return;
        e.preventDefault(); e.stopImmediatePropagation();
        startDrag(e.clientX, e.clientY);
      }, { capture: true });
      window.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
      window.addEventListener('mouseup', endDrag);
    });

    if (saveBtn) {
      saveBtn.onclick = () => {
        const layout = {};
        draggableIds.forEach(id => {
          const el = document.getElementById(id);
          if (el) { el.style.outline = ''; if (el.style.left) layout[id] = { left: el.style.left, top: el.style.top }; }
        });
        localStorage.setItem('sb09_hud_layout_v1', JSON.stringify(layout));
        isEditing = false;
        gameScreen?.classList.remove('hud-editing');
        if (editorBar) { editorBar.classList.add('hidden'); editorBar.style.display = 'none'; }
        this.showRadioToast('SETTINGS', '✅ Custom button layout saved!');
      };
    }

    if (resetBtn) {
      resetBtn.onclick = () => {
        localStorage.removeItem('sb09_hud_layout_v1');
        draggableIds.forEach(id => {
          const el = document.getElementById(id);
          if (el) { el.style.outline = ''; el.style.position = ''; el.style.left = ''; el.style.top = ''; el.style.right = ''; el.style.bottom = ''; }
        });
        isEditing = false;
        gameScreen?.classList.remove('hud-editing');
        if (editorBar) { editorBar.classList.add('hidden'); editorBar.style.display = 'none'; }
        this.showRadioToast('SETTINGS', '🔄 Controls reset to default!');
      };
    }
  },

  toggleTorch() {
    const me = Net.players[Net.myId];
    if (!me || me.downed || this.battery <= 0) return;
    me.torch = !me.torch;
    if (this.flashlight) this.flashlight.visible = me.torch;
    SFX.torchClick();
  },

  toggleNightVision() {
    this.nvgActive = !this.nvgActive;
    if (this.hemiLight) {
      this.hemiLight.color.setHex(this.nvgActive ? 0x4ade80 : 0xe0f2fe);
      this.hemiLight.intensity = this.nvgActive ? 1.65 : (this.powerRestored ? 0.16 : 0.085);
    }
    this.showRadioToast('OPTICS', this.nvgActive ? '🥽 Night Vision ON' : '🥽 Night Vision OFF');
  },

  toggleCrouch() {
    this.crouching = !this.crouching;
    const btn = document.getElementById('crouch-btn');
    if (btn) {
      btn.style.background = this.crouching ? '#0284c7' : 'rgba(15,23,42,0.88)';
      btn.textContent = this.crouching ? '🧎 CROUCHED' : '🧍 CROUCH';
    }
  },

  sendTacticalPing() {
    const me = Net.players[Net.myId];
    if (!me) return;
    const px = Math.max(-38, Math.min(38, me.x - Math.sin(me.yaw) * 6.5));
    const pz = Math.max(-38, Math.min(38, me.z - Math.cos(me.yaw) * 6.5));
    this.applyPing(px, pz, me.name || 'Squad');
    Net.sendEvent({ type: 'WORLD_EVENT', action: 'PING', x: px, z: pz, sender: me.name || 'Squad' });
  },

  applyPing(px, pz, sender) {
    if (this.pingMesh) this.mapGroup.remove(this.pingMesh);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.75, 24),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(px, 0.08, pz);
    this.mapGroup.add(ring);
    this.pingMesh = ring;
    this.activePing = { x: px, z: pz, until: performance.now() + 12000 };
    SFX.tone(920, 'sine', 0.12, 0.18, 1280);
    this.showRadioToast('PING', `📍 ${sender} marked a location!`);
  },

  dropFlare() {
    const me = Net.players[Net.myId];
    if (!me || me.downed) return;
    const fx = me.x - Math.sin(me.yaw) * 0.85;
    const fz = me.z - Math.cos(me.yaw) * 0.85;
    this.spawnFlare(fx, fz, me.yaw, me.name || 'Squad');
    Net.sendEvent({ type: 'WORLD_EVENT', action: 'FLARE', x: fx, z: fz, yaw: me.yaw, sender: me.name || 'Squad' });
  },

  spawnFlare(fx, fz, yaw, sender) {
    const flareGrp = new THREE.Group();
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.42, 12),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 })
    );
    stick.rotation.z = Math.PI / 2;
    stick.rotation.y = yaw + 0.5;
    stick.position.y = 0.05;

    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffedd5 }));
    tip.position.set(0.22, 0.06, 0);

    const floorGlow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.45 }));
    floorGlow.rotation.x = -Math.PI / 2;
    floorGlow.position.y = 0.015;

    const fLight = new THREE.PointLight(0xff2a2a, 6.5, 22);
    fLight.position.set(0, 0.45, 0);

    flareGrp.add(stick, tip, floorGlow, fLight);
    flareGrp.position.set(fx, 0, fz);
    this.mapGroup.add(flareGrp);

    this.flares.push({ x: fx, z: fz, grp: flareGrp, light: fLight, until: performance.now() + 20000 });
    this.decoyPos = { x: fx, z: fz };
    this.decoyUntil = performance.now() + 9000;
    SFX.torchClick();
    this.showRadioToast('FLARE', `🧨 ${sender} dropped a Flare! Luring threat!`);
  },

  activateClassSkill() {
    const me = Net.players[Net.myId];
    if (!me) return;
    const now = performance.now();
    if (now < this.skillCooldownUntil) return this.showRadioToast('SKILL', '⏳ Class ability recharging...');
    this.skillCooldownUntil = now + 18000;
    const role = me.role || 'SCOUT';
    if (role === 'ENGINEER') {
      this.decoyPos = { x: me.x, z: me.z };
      this.decoyUntil = now + 11000;
      Net.sendEvent({ type: 'WORLD_EVENT', action: 'DECOY', x: me.x, z: me.z });
      this.showRadioToast('ENGINEER SKILL', '🔧 Sonic Decoy active! Threat lured for 11s!');
    } else if (role === 'MEDIC') {
      me.downed = false;
      this.sanity = 100;
      this.stamina = 100;
      Net.sendEvent({ type: 'WORLD_EVENT', action: 'MEDIC_REVIVE_ALL' });
      this.showRadioToast('MEDIC SKILL', '💉 Adrenaline Surge: Squad revived & Sanity restored!');
    } else if (role === 'TECH') {
      this.battery = 100;
      this.hunter.stunnedUntil = Math.max(this.hunter.stunnedUntil, now + 3000);
      Net.sendEvent({ type: 'WORLD_EVENT', action: 'STUN_MONSTER', dur: 3000 });
      this.showRadioToast('TECH SKILL', '⚡ EMP Pulse: 100% Battery & Monster disrupted!');
    } else {
      this.turboUntil = now + 7500;
      this.showRadioToast('SCOUT SKILL', '🏃 Shadow Dash: 7.5s Silent High-Speed Sprint!');
    }
  },

  fireStun() {
    const me = Net.players[Net.myId];
    if (!me || me.downed || me.hiding) return;
    if (this.stunCharges <= 0) return this.showRadioToast('SYSTEM', '⚠️ Stun Gun out of charges!');
    this.stunCharges--;
    const st = document.getElementById('stun-status');
    if (st) st.textContent = `🔫 ${this.stunCharges}/2`;
    SFX.stunZap();

    const startPt = new THREE.Vector3(me.x, 1.35, me.z);
    const dirVec = new THREE.Vector3(-Math.sin(me.yaw), 0, -Math.cos(me.yaw));
    const dist = Math.hypot(this.hunter.x - me.x, this.hunter.z - me.z);
    const hit = dist < 13;
    const endPt = hit ? new THREE.Vector3(this.hunter.x, 1.3, this.hunter.z) : startPt.clone().addScaledVector(dirVec, 9);

    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([startPt, endPt]),
      new THREE.LineBasicMaterial({ color: 0x38bdf8 })
    );
    this.scene.add(line);
    setTimeout(() => this.scene.remove(line), 260);

    if (hit) {
      this.hunter.stunnedUntil = performance.now() + 4500;
      if (this.hunter.shockGrp) this.hunter.shockGrp.visible = true;
      SFX.electricShockHit();
      Net.sendEvent({ type: 'WORLD_EVENT', action: 'STUN_MONSTER', dur: 4500 });
      this.showRadioToast('STUN HIT', '⚡ HIGH-VOLTAGE SHOCK! Monster stunned for 4.5s!');
    } else {
      this.showRadioToast('STUN', '⚡ Electric Arc fired!');
    }
  },

  applyNetworkEvent(ev) {
    if (!ev || !ev.action) return;
    if (ev.action === 'FUSE_TAKEN') {
      this.hasFuse = true;
      if (this.fuseMesh) this.fuseMesh.visible = false;
      const ob = document.getElementById('objective-banner');
      if (ob) ob.textContent = 'CHAPTER 2: Activate the Generator!';
      this.showRadioToast('SQUAD', `🔋 ${ev.sender || 'Teammate'} picked up the Power Fuse!`);
    } else if (ev.action === 'GEN_ON') {
      this.restorePower(true);
    } else if (ev.action === 'DRIVE_TAKEN') {
      const d = this.dataDrives[ev.idx];
      if (d && !d.taken) {
        d.taken = true;
        if (d.mesh) d.mesh.visible = false;
        this.drivesCollected = this.dataDrives.filter(x => x.taken).length;
        this.showRadioToast('SQUAD', `💾 Data Drive #${ev.idx + 1} collected (${this.drivesCollected}/3)!`);
      }
    } else if (ev.action === 'SERVER_UPLOADED') {
      this.drivesUploaded = true;
      if (this.serverMesh) {
        this.serverMesh.material.color.setHex(0x16a34a);
        this.serverMesh.material.emissive.setHex(0x22c55e);
      }
      const ob = document.getElementById('objective-banner');
      if (ob) ob.textContent = `LVL ${this.level} • CH-4: Read logs & unlock all 3 Terminals!`;
      this.showRadioToast('SERVER', '🖥️ Data Drives uploaded to Mainframe!');
    } else if (ev.action === 'TERM_UNLOCKED') {
      this.unlockTerminal(ev.idx, true);
    } else if (ev.action === 'PICKUP_TAKEN') {
      const pk = this.pickups[ev.idx];
      if (pk) { pk.taken = true; if (pk.mesh) pk.mesh.visible = false; }
    } else if (ev.action === 'STUN_MONSTER') {
      this.hunter.stunnedUntil = performance.now() + (ev.dur || 4500);
      if (this.hunter.shockGrp) this.hunter.shockGrp.visible = true;
      SFX.electricShockHit();
    } else if (ev.action === 'DECOY') {
      this.decoyPos = { x: ev.x, z: ev.z };
      this.decoyUntil = performance.now() + 11000;
    } else if (ev.action === 'PING') {
      this.applyPing(ev.x, ev.z, ev.sender);
    } else if (ev.action === 'FLARE') {
      this.spawnFlare(ev.x, ev.z, ev.yaw || 0, ev.sender);
    } else if (ev.action === 'MEDIC_REVIVE_ALL') {
      Object.values(Net.players).forEach(p => { p.downed = false; });
      this.sanity = 100;
      this.stamina = 100;
    } else if (ev.action === 'PLAYER_CAUGHT') {
      if (Net.players[ev.id]) Net.players[ev.id].downed = true;
      if (ev.id === Net.myId) {
        SFX.jumpscareScream();
        this.showRadioToast('CAUGHT!', '🆘 You were caught! Wait for Medic or Squad!');
      } else {
        this.showRadioToast('SQUAD ALERT', `🆘 ${ev.name || 'A teammate'} was caught!`);
      }
      const alive = Object.values(Net.players).filter(p => !p.downed);
      if (alive.length === 0) {
        this.triggerEnd(false, `💀 ${this.hunterVariant || 'Subject-0'} wiped out the entire squad!`);
      }
    } else if (ev.action === 'NEXT_LEVEL') {
      this.advanceToLevel(ev.level, ev.codes, ev.spotOrder, true);
    } else if (ev.action === 'GAME_WIN') {
      if (window.AgentProfile) {
        AgentProfile.recordVictory(180);
        AgentProfile.addXP(ev.xp || 1000);
      }
      this.triggerEnd(true, ev.reason || '🚁 Squad Extracted!');
    }
  },

  interact() {
    const me = Net.players[Net.myId];
    if (!me || me.downed || !this.nearAction) return;
    const act = this.nearAction;

    if (act.type === 'LOCKER') {
      me.hiding = !me.hiding;
      document.getElementById('locker-overlay')?.classList.toggle('hidden', !me.hiding);
      this.showRadioToast('STEALTH', me.hiding ? '🔒 Hidden inside Safe Locker!' : '🚪 Exited Safe Locker.');
    } else if (act.type === 'PICKUP') {
      act.item.taken = true;
      act.item.mesh.visible = false;
      SFX.pickup();
      Net.sendEvent({ type: 'WORLD_EVENT', action: 'PICKUP_TAKEN', idx: act.item.idx });
      if (act.item.kind === 'BATTERY') {
        this.battery = Math.min(100, this.battery + 40);
        this.showRadioToast('SUPPLY', '🔋 Picked up Spare Battery (+40%)!');
      } else {
        this.stunCharges++;
        const st = document.getElementById('stun-status');
        if (st) st.textContent = `🔫 ${this.stunCharges}/2`;
        this.showRadioToast('SUPPLY', '⚡ Picked up Stun Cell (+1 Charge)!');
      }
    } else if (act.type === 'FUSE') {
      this.hasFuse = true;
      if (this.fuseMesh) this.fuseMesh.visible = false;
      SFX.pickup();
      const ob = document.getElementById('objective-banner');
      if (ob) ob.textContent = 'CHAPTER 2: Activate the Generator!';
      Net.sendEvent({ type: 'WORLD_EVENT', action: 'FUSE_TAKEN', sender: me.name });
      this.alertMonsterTo(me.x, me.z, 'Power Fuse pickup');
    } else if (act.type === 'GEN') {
      if (!this.hasFuse) return this.showRadioToast('OBJECTIVE', '⚠️ Find the Blue Power Fuse first!');
      this.restorePower(false);
    } else if (act.type === 'DRIVE') {
      act.drive.taken = true;
      act.drive.mesh.visible = false;
      this.drivesCollected = this.dataDrives.filter(x => x.taken).length;
      SFX.pickup();
      Net.sendEvent({ type: 'WORLD_EVENT', action: 'DRIVE_TAKEN', idx: act.drive.idx });
      this.alertMonsterTo(act.drive.x, act.drive.z, `Data Drive #${act.drive.idx + 1}`);
    } else if (act.type === 'SERVER') {
      if (!this.powerRestored) return this.showRadioToast('OFFLINE', '⚠️ Restore Generator Power first!');
      if (this.drivesCollected < 3) return this.showRadioToast('SERVER', `⚠️ Collect all 3 Data Drives first (${this.drivesCollected}/3)!`);
      this.drivesUploaded = true;
      this.serverMesh.material.color.setHex(0x16a34a);
      this.serverMesh.material.emissive.setHex(0x22c55e);
      const ob = document.getElementById('objective-banner');
      if (ob) ob.textContent = `LVL ${this.level} • CH-4: Read Dr. Verma logs & unlock all 3 Terminals!`;
      Net.sendEvent({ type: 'WORLD_EVENT', action: 'SERVER_UPLOADED' });
      this.alertMonsterTo(this.serverPos.x, this.serverPos.z, 'the Mainframe Server');
    } else if (act.type === 'NOTE') {
      document.getElementById('note-title').textContent = `DR. VERMA LOG #${act.note.idx + 1}`;
      document.getElementById('note-body').textContent = act.note.text;
      document.getElementById('note-code-reveal').textContent = this.codes[act.note.idx];
      document.getElementById('note-modal')?.classList.remove('hidden');
    } else if (act.type === 'TERM') {
      if (!this.powerRestored) return this.showRadioToast('LOCKED', '⚠️ Restore Generator power first!');
      if (!this.drivesUploaded) return this.showRadioToast('LOCKED', '⚠️ Upload all 3 Data Drives at Server first!');
      this.activeTerminalIdx = act.term.idx;
      this.typedCode = '';
      this.updateKeypadUI();
      document.getElementById('puzzle-title').textContent = `SECURITY TERMINAL #${act.term.idx + 1}`;
      document.getElementById('puzzle-modal')?.classList.remove('hidden');
    }
  },

  restorePower(fromNet = false) {
    if (this.powerRestored) return;
    this.powerRestored = true;
    this.hasFuse = true;
    if (this.fuseMesh) this.fuseMesh.visible = false;
    if (this.hemiLight) this.hemiLight.intensity = 0.16;
    if (this.genMesh) {
      this.genMesh.material.color.setHex(0x16a34a);
      this.genMesh.material.emissive.setHex(0x22c55e);
    }
    const ls = document.getElementById('locks-status');
    if (ls) ls.textContent = '⚡ ON (0/3)';
    const ob = document.getElementById('objective-banner');
    if (ob) ob.textContent = `LVL ${this.level} • CH-3: Collect 3 Data Drives & upload at Mainframe Server!`;
    SFX.pickup();
    this.showRadioToast('POWER', '⚡ Main Bunker Power Restored!');
    if (!fromNet) Net.sendEvent({ type: 'WORLD_EVENT', action: 'GEN_ON' });
  },

  updateKeypadUI() {
    const kd = document.getElementById('keypad-display');
    if (kd) kd.textContent = this.typedCode.padEnd(3, '_').split('').join(' ');
  },

  checkPuzzleCode() {
    if (this.typedCode === this.codes[this.activeTerminalIdx]) {
      document.getElementById('puzzle-modal')?.classList.add('hidden');
      this.unlockTerminal(this.activeTerminalIdx, false);
    } else {
      this.typedCode = '';
      this.updateKeypadUI();
      SFX.tone(150, 'sawtooth', 0.25, 0.2);
    }
  },

  unlockTerminal(idx, fromNet = false) {
    if (this.locks[idx]) return;
    this.locks[idx] = true;
    const t = this.terminals[idx];
    if (t) {
      t.mesh.material.color.setHex(0x16a34a);
      t.mesh.material.emissive.setHex(0x22c55e);
    }
    const count = this.locks.filter(Boolean).length;
    const ls = document.getElementById('locks-status');
    if (ls) ls.textContent = `🔓 ${count}/3`;
    if (!fromNet) {
      Net.sendEvent({ type: 'WORLD_EVENT', action: 'TERM_UNLOCKED', idx });
      if (t) this.alertMonsterTo(t.x, t.z, `Terminal #${idx + 1}`);
    }
    if (count === 3) {
      this.selfDestructActive = true;
      this.escapeTimeLeft = 60;
      this.lastTick = performance.now();
      if (this.exitMesh) { this.exitMesh.material.color.setHex(0x22c55e); this.exitMesh.material.emissive.setHex(0x4ade80); }
      if (this.exitBeacon) this.exitBeacon.visible = true;
      document.getElementById('timer-badge')?.classList.remove('hidden');
      const ob = document.getElementById('objective-banner');
      if (ob) ob.textContent = '🚨 EXIT GATE UNLOCKED! Sprint to the North-East Green Beacon!';
      SFX.siren();
    }
  },

  alertMonsterTo(tx, tz, label) {
    if (Net.isHost) {
      this.hunter.goalX = tx;
      this.hunter.goalZ = tz;
      this.hunter.alertUntil = performance.now() + 16000;
    }
    SFX.tone(320, 'sawtooth', 0.25, 0.22, 160);
    this.showRadioToast('🚨 ALERT!', `👹 ${this.hunterVariant || 'Subject-0'} heard ${label}! Hide!`);
  },

  advanceToLevel(nextLvl, newCodes = null, newSpotOrder = null, fromNet = false) {
    if (this.gameOver || this.level >= nextLvl) return;
    const lvlNames = {
      2: 'LEVEL 2: BIO-RESEARCH LAB',
      3: 'LEVEL 3: DEEP REACTOR CORE',
      4: 'LEVEL 4: VENTILATION TUNNELS',
      5: 'LEVEL 5: ROOFTOP HELIPAD ESCAPE'
    };
    this.hasFuse = false;
    this.powerRestored = false;
    this.drivesCollected = 0;
    this.drivesUploaded = false;
    this.locks = [false, false, false];
    this.selfDestructActive = false;
    this.escapeTimeLeft = 60;
    this.battery = Math.min(100, this.battery + 35);
    this.sanity = Math.min(100, this.sanity + 30);
    this.stunCharges = Math.min(3, this.stunCharges + 1);
    document.getElementById('timer-badge')?.classList.add('hidden');
    const ls = document.getElementById('locks-status');
    if (ls) ls.textContent = '⚡ OFF';
    const st = document.getElementById('stun-status');
    if (st) st.textContent = `🔫 ${this.stunCharges}/2`;

    this.codes = newCodes || Net.generateCodes();
    this.spotOrder = newSpotOrder || Net.generateSpotOrder();

    if (!fromNet) {
      Net.sendEvent({ type: 'WORLD_EVENT', action: 'NEXT_LEVEL', level: nextLvl, codes: this.codes, spotOrder: this.spotOrder });
    }

    this.buildLevelMap(nextLvl);
    const me = Net.players[Net.myId];
    if (me) { me.x = -33; me.z = 31; me.yaw = -Math.PI / 2; me.downed = false; }
    this.hunter.x = 26; this.hunter.z = -26; this.hunter.alertUntil = 0;
    this.buildMonster(nextLvl);
    const ob = document.getElementById('objective-banner');
    if (ob) ob.textContent = `${lvlNames[nextLvl] || 'LEVEL ' + nextLvl} • CH-1: Find Blue Power Fuse!`;
    SFX.pickup();
    this.showRadioToast('NEXT FLOOR', `🛗 Entered ${lvlNames[nextLvl] || 'Level ' + nextLvl}! (+35% Battery)`);
  },

  triggerEnd(win, reason) {
    if (this.gameOver) return;
    this.gameOver = true;
    document.getElementById('end-title').textContent = win ? '🏆 MISSION ACCOMPLISHED' : '💀 SQUAD WIPED OUT';
    document.getElementById('end-title').style.color = win ? '#4ade80' : '#ef4444';
    document.getElementById('end-desc').textContent = reason;
    document.getElementById('end-modal')?.classList.remove('hidden');
  },

  hasLineOfSight(x1, z1, x2, z2) {
    const steps = 10;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.checkCollision(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t)) return false;
    }
    return true;
  },

  checkCollision(x, z) {
    if (x < -38.8 || x > 38.8 || z < -38.8 || z > 38.8) return true;
    for (const w of this.wallBoxes) {
      if (x > w.minX && x < w.maxX && z > w.minZ && z < w.maxZ) return true;
    }
    return false;
  },

  showRadioToast(sender, msg) {
    const el = document.getElementById('radio-toast');
    if (!el) return;
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
    const scale = (w - 10) / 80;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(6, 12, 24, 0.92)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(100, 116, 139, 0.75)';
    for (const wb of this.wallBoxes) {
      const wx = cx + (wb.minX + 0.45) * scale;
      const wz = cy + (wb.minZ + 0.45) * scale;
      const ww = Math.max(1.5, (wb.maxX - wb.minX - 0.9) * scale);
      const wd = Math.max(1.5, (wb.maxZ - wb.minZ - 0.9) * scale);
      ctx.fillRect(wx, wz, ww, wd);
    }

    const objX = this.selfDestructActive ? this.exitPos.x : (!this.hasFuse && this.fuseMesh ? this.fuseMesh.position.x : this.genPos.x);
    const objZ = this.selfDestructActive ? this.exitPos.z : (!this.hasFuse && this.fuseMesh ? this.fuseMesh.position.z : this.genPos.z);
    ctx.fillStyle = this.selfDestructActive ? '#22c55e' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(cx + objX * scale, cy + objZ * scale, 3, 0, Math.PI * 2);
    ctx.fill();

    const squad = this.getOrderedSquad();
    squad.forEach((p, idx) => {
      const col = this.SQUAD_COLORS[idx] || this.SQUAD_COLORS[0];
      const px = cx + (p.x || 0) * scale;
      const pz = cy + (p.z || 0) * scale;
      const headAng = Math.atan2(-Math.cos(p.yaw || 0), -Math.sin(p.yaw || 0));

      ctx.save();
      ctx.translate(px, pz);
      ctx.rotate(headAng);
      ctx.fillStyle = col.hex + '44';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 12, -0.45, 0.45);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = col.hex;
      ctx.beginPath();
      ctx.moveTo(6.5, 0);
      ctx.lineTo(-4, -4);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText(String(idx + 1), px + 4, pz - 3);
    });

    const mx = cx + this.hunter.x * scale;
    const mz = cy + this.hunter.z * scale;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(mx, mz, 4, 0, Math.PI * 2);
    ctx.fill();
  },

  animate() {
    requestAnimationFrame(() => this.animate());
    if (!this.renderer || !this.scene || !this.camera) return;

    this.fpsFrames++;
    const nowFps = performance.now();
    if (nowFps - this.fpsLastTime >= 500) {
      const fps = Math.round((this.fpsFrames * 1000) / (nowFps - this.fpsLastTime));
      const el = document.getElementById('fps-badge');
      if (el) el.textContent = `${fps} FPS`;
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
      if (Net.updateVoiceProximity) Net.updateVoiceProximity(me);
      this.syncTeammates();

      if (this.fuseMesh && this.fuseMesh.visible) this.fuseMesh.rotation.y += 0.04;
      (this.animatedProps || []).forEach(p => { p.rotation.x += 0.05; });
      const tNow = performance.now();
      (this.flickerLights || []).forEach((fl) => {
        const blink = Math.sin(tNow * 0.035 + fl.phase) * Math.sin(tNow * 0.091 + fl.phase) > 0.62;
        if (fl.light) fl.light.intensity = blink ? 0.01 : 0.19;
        if (fl.mat) fl.mat.color.setHex(blink ? 0x1e293b : 0xe0f2fe);
      });
      (this.genSparks || []).forEach((sp) => {
        if (!this.powerRestored) { sp.mesh.visible = false; return; }
        const burst = Math.sin(tNow * 0.045 + sp.seed) > 0.25;
        sp.mesh.visible = burst;
        if (burst) {
          sp.mesh.position.set((Math.random() - 0.5) * 1.9, 0.8 + Math.random() * 1.3, (Math.random() - 0.5) * 1.6);
          sp.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
          if (sp.light) sp.light.intensity = 2.5 + Math.random() * 3.0;
        } else if (sp.light) sp.light.intensity = 0.6;
      });
      const nowFl = performance.now();
      this.flares = this.flares.filter(fl => {
        if (nowFl > fl.until) {
          if (fl.grp) this.mapGroup.remove(fl.grp);
          return false;
        }
        if (fl.light) fl.light.intensity = 5.5 + Math.sin(nowFl * 0.03) * 1.4;
        return true;
      });
      this.pickups.forEach(pk => { if (!pk.taken) pk.mesh.rotation.y += 0.03; });
      this.dataDrives.forEach(d => { if (!d.taken) d.mesh.rotation.y += 0.04; });

      let fwd = 0, str = 0;
      if (this.keys['KeyW'] || this.keys['ArrowUp']) fwd += 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) fwd -= 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) str -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) str += 1;
      if (this.joy.active) { fwd -= this.joy.dy; str += this.joy.dx; }

      const isRunning = (this.keys['ShiftLeft'] || this.sprinting) && !me.downed && !me.hiding && this.stamina > 2;
      const turboBoost = performance.now() < this.turboUntil ? 1.35 : 1.0;
      const crouchMult = this.crouching ? 0.55 : 1.0;
      const speed = (me.downed ? 0.02 : me.hiding ? 0 : (isRunning ? 0.14 : 0.085)) * turboBoost * crouchMult;

      const sin = Math.sin(me.yaw), cos = Math.cos(me.yaw);
      const moveX = (-fwd * sin + str * cos);
      const moveZ = (-fwd * cos - str * sin);
      const len = Math.hypot(moveX, moveZ);

      const tvx = len > 0.05 ? (moveX / len) * speed : 0;
      const tvz = len > 0.05 ? (moveZ / len) * speed : 0;
      this.velX = THREE.MathUtils.lerp(this.velX, tvx, 0.25);
      this.velZ = THREE.MathUtils.lerp(this.velZ, tvz, 0.25);

      const isMoving = Math.hypot(this.velX, this.velZ) > 0.004;
      if (isMoving) {
        const nx = me.x + this.velX;
        const nz = me.z + this.velZ;
        if (!this.checkCollision(nx, me.z)) me.x = nx;
        if (!this.checkCollision(me.x, nz)) me.z = nz;
        this.walkBob += isRunning ? 0.24 : 0.15;
        SFX.step(isRunning);
      }

      const baseEye = this.crouching ? 1.0 : 1.62;
      const bob = me.downed ? 0 : Math.sin(this.walkBob) * 0.04;
      if (this.playerHandGroup) {
        this.playerHandGroup.visible = !this.thirdPerson;
        this.playerHandGroup.position.y = Math.sin(this.walkBob * 2) * 0.015;
      }

      if (this.thirdPerson) {
        if (this.selfAvatar) {
          this.selfAvatar.grp.visible = !me.hiding;
          this.selfAvatar.grp.position.set(me.x, 0, me.z);
          this.selfAvatar.grp.rotation.y = me.yaw;
          this.animateCharacterLimbs(this.selfAvatar, isMoving);
        }
        this.camera.position.set(me.x + Math.sin(me.yaw) * 2.6, 2.25 + bob, me.z + Math.cos(me.yaw) * 2.6);
        this.camera.rotation.y = me.yaw;
      } else {
        if (this.selfAvatar) this.selfAvatar.grp.visible = false;
        this.camera.position.set(me.x, baseEye + bob, me.z);
        this.camera.rotation.y = me.yaw;
      }

      const nearFlare = (this.flares || []).some(f => performance.now() < f.until && Math.hypot(f.x - me.x, f.z - me.z) < 12);
      const nearMate = Object.values(Net.players || {}).some(p => p.id !== Net.myId && Math.hypot((p.x || 0) - me.x, (p.z || 0) - me.z) < 10);
      if (me.torch || nearFlare || nearMate || this.nvgActive || this.powerRestored) {
        this.sanity = Math.min(100, this.sanity + 0.03);
      } else {
        this.sanity = Math.max(0, this.sanity - 0.045);
      }
      const sanEl = document.getElementById('sanity-text');
      if (sanEl) {
        const sVal = Math.round(this.sanity);
        sanEl.textContent = sVal + '%';
        sanEl.style.color = sVal < 30 ? '#ef4444' : (sVal < 60 ? '#facc15' : '#38bdf8');
      }
      if (isRunning && isMoving) this.stamina = Math.max(0, this.stamina - 0.18);
      else this.stamina = Math.min(100, this.stamina + 0.14);
      const stamEl = document.getElementById('stamina-text');
      if (stamEl) stamEl.textContent = Math.round(this.stamina) + '%';

      if (me.torch && this.battery > 0 && !me.downed) {
        this.battery = Math.max(0, this.battery - 0.015);
        if (this.battery === 0) { me.torch = false; this.flashlight.visible = false; }
        const bb = document.getElementById('battery-badge');
        if (bb) bb.textContent = `🔋 ${Math.ceil(this.battery)}%`;
      }

      this.nearAction = null;
      const hint = document.getElementById('interact-hint');
      if (!me.downed && hint) {
        for (const lk of this.lockers) {
          if (Math.hypot(lk.x - me.x, lk.z - me.z) < 2.2) {
            this.nearAction = { type: 'LOCKER' };
            hint.textContent = me.hiding ? '🚪 [USE] Exit Safe Locker' : '🔒 [USE] Hide in Safe Locker';
            break;
          }
        }
        if (!this.nearAction && !this.hasFuse && this.fuseMesh && Math.hypot(this.fuseMesh.position.x - me.x, this.fuseMesh.position.z - me.z) < 2.4) {
          this.nearAction = { type: 'FUSE' };
          hint.textContent = '🔋 [USE] Pick up Blue Power Fuse';
        }
        if (!this.nearAction && Math.hypot(this.genPos.x - me.x, this.genPos.z - me.z) < 3.0) {
          this.nearAction = { type: 'GEN' };
          hint.textContent = '⚡ [USE] Activate Main Generator';
        }
        if (!this.nearAction) {
          for (const d of this.dataDrives) {
            if (!d.taken && Math.hypot(d.x - me.x, d.z - me.z) < 2.4) {
              this.nearAction = { type: 'DRIVE', drive: d };
              hint.textContent = `💾 [USE] Grab Data Drive #${d.idx + 1}`;
              break;
            }
          }
        }
        if (!this.nearAction && !this.drivesUploaded && Math.hypot(this.serverPos.x - me.x, this.serverPos.z - me.z) < 3.0) {
          this.nearAction = { type: 'SERVER' };
          hint.textContent = `🖥️ [USE] Upload Data Drives (${this.drivesCollected}/3)`;
        }
        if (!this.nearAction) {
          for (const n of this.notes) {
            if (Math.hypot(n.x - me.x, n.z - me.z) < 2.3) {
              this.nearAction = { type: 'NOTE', note: n };
              hint.textContent = `📄 [USE] Read Dr. Verma Log #${n.idx + 1}`;
              break;
            }
          }
        }
        if (!this.nearAction) {
          for (const t of this.terminals) {
            if (Math.hypot(t.x - me.x, t.z - me.z) < 2.3) {
              this.nearAction = { type: 'TERM', term: t };
              hint.textContent = `💻 [USE] Open Terminal #${t.idx + 1}`;
              break;
            }
          }
        }
        if (!this.nearAction) {
          for (const pk of this.pickups) {
            if (!pk.taken && Math.hypot(pk.x - me.x, pk.z - me.z) < 2.2) {
              this.nearAction = { type: 'PICKUP', item: pk };
              hint.textContent = pk.kind === 'BATTERY' ? '🔋 [USE] Grab Battery (+40%)' : '⚡ [USE] Grab Stun Cell (+1)';
              break;
            }
          }
        }
        hint.classList.toggle('hidden', !this.nearAction);
      }

      if (this.selfDestructActive) {
        const nowSd = performance.now();
        if (nowSd - this.lastTick >= 1000) {
          this.lastTick = nowSd;
          this.escapeTimeLeft = Math.max(0, this.escapeTimeLeft - 1);
          const tb = document.getElementById('timer-badge');
          if (tb) tb.textContent = `☢️ ${this.escapeTimeLeft}s`;
          if (this.escapeTimeLeft <= 0) {
            this.triggerEnd(false, '💥 Sector-09 Self-Destruct detonated before extraction!');
          }
        }
      }

      if (this.selfDestructActive && Math.hypot(this.exitPos.x - me.x, this.exitPos.z - me.z) < 3.5) {
        if (this.level < 5) {
          this.advanceToLevel(this.level + 1);
        } else {
          const diff = Net.difficulty || 'NORMAL';
          const mult = diff === 'INFERNO' ? 3.0 : (diff === 'NIGHTMARE' ? 1.75 : 1.0);
          const xpEarned = Math.round(1000 * mult);
          const reason = `🚁 All 5 Levels Cleared [${diff}]! Earned +${xpEarned} XP!`;
          if (window.AgentProfile) {
            AgentProfile.recordVictory(180);
            AgentProfile.addXP(xpEarned);
          }
          Net.sendEvent({ type: 'WORLD_EVENT', action: 'GAME_WIN', xp: xpEarned, reason });
          this.triggerEnd(true, reason);
        }
      }

      const isStunned = performance.now() < this.hunter.stunnedUntil;
      if (this.hunter.mesh && this.hunter.limbs) {
        if (this.hunter.shockGrp) this.hunter.shockGrp.visible = isStunned;
        if (isStunned) {
          this.hunter.mesh.position.y = -0.22 + Math.sin(performance.now() * 0.09) * 0.06;
          this.hunter.mesh.rotation.z = Math.sin(performance.now() * 0.12) * 0.16;
          if (this.hunter.shockGrp) this.hunter.shockGrp.rotation.y += 0.25;
        } else {
          this.hunter.mesh.rotation.z = 0;
          this.hunter.walkCycle += 0.16;
          const swing = Math.sin(this.hunter.walkCycle) * 0.55;
          this.hunter.limbs.legL.rotation.x = swing;
          this.hunter.limbs.legR.rotation.x = -swing;
          this.hunter.mesh.position.y = Math.abs(Math.sin(this.hunter.walkCycle)) * 0.08;
        }
      }

      if (Net.isHost && !isStunned) {
        const diff = Net.difficulty || 'NORMAL';
        const diffMult = diff === 'INFERNO' ? 1.25 : (diff === 'NIGHTMARE' ? 1.12 : 1.0);
        const lvlMult = 1 + (this.level - 1) * 0.06;
        const activePlayers = Object.values(Net.players || {}).filter(p => !p.hiding && !p.downed);

        let closestTarget = null;
        let closestDist = Infinity;

        for (const p of activePlayers) {
          const d = Math.hypot((p.x || 0) - this.hunter.x, (p.z || 0) - this.hunter.z);
          const sightRange = (p.torch ? 18 : 9) * diffMult;
          if (d < sightRange && this.hasLineOfSight(this.hunter.x, this.hunter.z, p.x, p.z) && d < closestDist) {
            closestDist = d;
            closestTarget = p;
          }
        }

        if (closestTarget) {
          this.moveHunterToward(closestTarget.x, closestTarget.z, 0.068 * diffMult * lvlMult);
          if (closestDist < 1.35) {
            closestTarget.downed = true;
            const aliveLeft = Object.values(Net.players || {}).filter(p => !p.downed);
            if (aliveLeft.length === 0) {
              SFX.jumpscareScream();
              Net.sendEvent({ type: 'WORLD_EVENT', action: 'PLAYER_CAUGHT', id: closestTarget.id, name: closestTarget.name });
              this.triggerEnd(false, `💀 ${this.hunterVariant || 'Subject-0'} wiped out the squad!`);
            } else {
              if (closestTarget.id === Net.myId) SFX.jumpscareScream();
              Net.sendEvent({ type: 'WORLD_EVENT', action: 'PLAYER_CAUGHT', id: closestTarget.id, name: closestTarget.name });
              this.showRadioToast('SQUAD ALERT', `🆘 ${closestTarget.name} was caught by ${this.hunterVariant}!`);
            }
          }
        } else if (this.decoyPos && performance.now() < this.decoyUntil) {
          this.moveHunterToward(this.decoyPos.x, this.decoyPos.z, 0.075 * diffMult);
        } else {
          const isAlerted = performance.now() < (this.hunter.alertUntil || 0);
          if (Math.hypot(this.hunter.goalX - this.hunter.x, this.hunter.goalZ - this.hunter.z) < 2.0) {
            this.hunter.alertUntil = 0;
            this.hunter.goalX = (Math.random() - 0.5) * 60;
            this.hunter.goalZ = (Math.random() - 0.5) * 60;
          }
          this.moveHunterToward(this.hunter.goalX, this.hunter.goalZ, isAlerted ? 0.078 : 0.048);
        }
      }

      if (this.hunter.mesh) {
        this.hunter.mesh.position.x = THREE.MathUtils.lerp(this.hunter.mesh.position.x, this.hunter.x, 0.25);
        this.hunter.mesh.position.z = THREE.MathUtils.lerp(this.hunter.mesh.position.z, this.hunter.z, 0.25);
        this.hunter.mesh.rotation.y = this.hunter.yaw;
      }

      const wpDist = document.getElementById('waypoint-dist');
      if (wpDist) {
        let tx = this.exitPos.x, tz = this.exitPos.z;
        if (!this.hasFuse) { tx = this.fuseMesh?.position.x || -24; tz = this.fuseMesh?.position.z || 10; }
        else if (!this.powerRestored) { tx = this.genPos.x; tz = this.genPos.z; }
        else if (this.drivesCollected < 3) {
          const nextD = this.dataDrives.find(d => !d.taken);
          if (nextD) { tx = nextD.x; tz = nextD.z; }
        } else if (!this.drivesUploaded) { tx = this.serverPos.x; tz = this.serverPos.z; }
        else if (!this.selfDestructActive) {
          const nextT = this.terminals.find((t, i) => !this.locks[i]);
          if (nextT) { tx = nextT.x; tz = nextT.z; }
        }
        wpDist.textContent = Math.round(Math.hypot(tx - me.x, tz - me.z)) + 'm';
      }

      const dMonster = Math.hypot(this.hunter.x - me.x, this.hunter.z - me.z);
      if (!isStunned) SFX.monsterStep(dMonster);
      const danger = document.getElementById('danger-overlay');
      if (danger) {
        if (dMonster < 14 && !me.hiding && !me.downed) {
          SFX.heartbeat(dMonster);
          danger.style.opacity = Math.min(0.85, (14 - dMonster) / 14).toFixed(2);
        } else if (danger.style.opacity !== '0') {
          danger.style.opacity = '0';
        }
      }

      const nowNet = performance.now();
      if (nowNet - this.lastNetSync > 50) {
        this.lastNetSync = nowNet;
        if (Net.isHost) {
          Net.broadcast({
            type: 'STATE',
            players: Net.players,
            hunter: { x: this.hunter.x, z: this.hunter.z, yaw: this.hunter.yaw, stunnedUntil: this.hunter.stunnedUntil }
          });
        } else {
          Net.sendToHost({
            type: 'MOVE',
            id: Net.myId,
            state: { x: me.x, z: me.z, yaw: me.yaw, torch: me.torch, hiding: me.hiding }
          });
        }
      }

      this.drawRadar(me);
    }

    this.renderer.render(this.scene, this.camera);
  }
};

const HomeShowcase3D = {
  scene: null,
  camera: null,
  renderer: null,
  charGroup: null,
  rotY: 0.25,
  dragging: false,
  lastX: 0,

  init() {
    const canvas = document.getElementById('home-3d-canvas');
    if (!canvas || typeof THREE === 'undefined') return;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050914);
    this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 60);
    this.camera.position.set(0, 1.65, 3.8);
    this.camera.lookAt(0, 1.15, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 36), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 }));
    floor.rotation.x = -Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.22, 36), new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02;
    const amb = new THREE.AmbientLight(0x94a3b8, 0.85);
    const keyLight = new THREE.SpotLight(0x38bdf8, 4.5, 18, 0.7); keyLight.position.set(2.5, 5.2, 3.5);
    this.scene.add(floor, ring, amb, keyLight);

    this.refreshCharacter();

    canvas.addEventListener('pointerdown', (e) => { this.dragging = true; this.lastX = e.clientX; });
    window.addEventListener('pointerup', () => { this.dragging = false; });
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.rotY += (e.clientX - this.lastX) * 0.012;
      this.lastX = e.clientX;
    });

    const resizeLobby = () => {
      if (!this.renderer || !this.camera) return;
      const w = Math.max(320, window.innerWidth);
      const h = Math.max(200, window.innerHeight);
      this.camera.aspect = w / h;
      this.camera.position.set(0, 1.35, w > h ? 3.55 : 4.3);
      this.camera.lookAt(0, 1.12, 0);
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    resizeLobby();
    window.addEventListener('resize', resizeLobby);
    document.addEventListener('fullscreenchange', () => setTimeout(resizeLobby, 120));

    const loop = () => {
      if (!this.renderer) return;
      requestAnimationFrame(loop);
      const menu = document.getElementById('menu-screen');
      if (!menu || menu.classList.contains('hidden')) return;
      if (this.charGroup) {
        if (!this.dragging) this.rotY += 0.004;
        this.charGroup.rotation.y = this.rotY;
      }
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  },

  refreshCharacter() {
    if (!this.scene) return;
    if (this.charGroup) this.scene.remove(this.charGroup);
    const suit = window.AgentProfile ? AgentProfile.getEquippedSuit() : { color: 0x0284c7, visor: 0x38bdf8 };
    const built = buildTacticalCharacter({ role: AgentProfile.load().role || 'SCOUT' });
    built.grp.children[0].material.color.setHex(suit.color);
    built.grp.children[2].material.color.setHex(suit.visor);
    this.charGroup = built.grp;
    this.scene.add(this.charGroup);
  }
};
window.HomeShowcase3D = HomeShowcase3D;
if (document.readyState === 'loading') { window.addEventListener('DOMContentLoaded', () => HomeShowcase3D.init()); } else { HomeShowcase3D.init(); }
