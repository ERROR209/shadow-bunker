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
        // Create 1-second noise buffer for realistic footsteps & horror scream
        const len = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  },
  noise(dur, filterFreq, filterType = 'bandpass', vol = 0.35) {
    this.init();
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + dur);
  },
  tone(freq, type, dur, vol = 0.25, endFreq = null) {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  },
  ambientDrip() {
    const now = performance.now();
    if (now - this.lastAmbient < 8000) return;
    this.lastAmbient = now;
    if (Math.random() > 0.5) {
      this.tone(1350, 'sine', 0.09, 0.08, 1750);
    } else {
      this.noise(0.5, 180, 'lowpass', 0.14);
    }
  },
  jumpscareScream() {
    // Realistic Horror Screech + Heavy Slam (No cartoon whistle!)
    this.noise(0.85, 1200, 'bandpass', 0.85);
    this.noise(0.6, 140, 'lowpass', 0.9);
    this.tone(190, 'sawtooth', 0.75, 0.55, 72);
    this.tone(245, 'sawtooth', 0.65, 0.45, 85);
  },
  stunZap() {
    this.noise(0.22, 2400, 'highpass', 0.4);
    this.tone(680, 'sawtooth', 0.22, 0.28, 180);
  },
  siren() {
    this.tone(580, 'sawtooth', 0.35, 0.24, 390);
    setTimeout(() => this.tone(440, 'sawtooth', 0.35, 0.24, 310), 350);
  },
  step(sprinting) {
    const now = performance.now();
    if (now - this.lastStep < (sprinting ? 260 : 420)) return;
    this.lastStep = now;
    // Crisp concrete boot step + heel tap (cuts clearly through heartbeat)
    this.noise(0.075, sprinting ? 1400 : 1050, 'bandpass', sprinting ? 0.55 : 0.38);
    this.tone(150, 'triangle', 0.055, sprinting ? 0.32 : 0.22, 60);
  },
  heartbeat(dist) {
    const now = performance.now();
    const interval = Math.max(420, dist * 55);
    if (now - this.lastBeat < interval) return;
    this.lastBeat = now;
    // Deep Lub-Dub chest thump
    this.tone(115, 'sine', 0.15, 0.52, 52);
    setTimeout(() => this.tone(95, 'sine', 0.18, 0.42, 45), 145);
  }
};

window.addEventListener('touchstart', () => SFX.init(), { passive: true });
window.addEventListener('pointerdown', () => SFX.init(), { passive: true });

function makeTexture(type) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  if (type === 'concrete') {
    ctx.fillStyle = '#293548';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.18)';
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
    }
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 252);
    ctx.fillStyle = 'rgba(120, 53, 15, 0.3)';
    ctx.fillRect(30, 100, 20, 120);
  } else if (type === 'floor') {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, 128, 128);
    ctx.strokeRect(128, 128, 128, 128);
    ctx.strokeRect(128, 0, 128, 128);
    ctx.strokeRect(0, 128, 128, 128);
  } else if (type === 'locker') {
    ctx.fillStyle = '#0369a1';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#0f172a';
    for (let y = 30; y < 100; y += 14) ctx.fillRect(40, y, 176, 6);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(195, 120, 16, 36);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (type === 'floor') tex.repeat.set(16, 16);
  if (type === 'concrete') tex.repeat.set(3, 1);
  return tex;
}

const Game3D = {
  scene: null,
  camera: null,
  renderer: null,
  flashlight: null,
  flashTarget: null,
  handGroup: null,
  stunBeamMesh: null,
  running: false,

  level: 1,
  battery: 100,
  batteries: [],
  hasFuse: false,
  powerRestored: false,
  selfDestructActive: false,
  escapeTimeLeft: 60,
  lastTick: 0,

  codes: ['123', '456', '789'],
  activeLockIdx: -1,
  enteredPin: '',
  sprinting: false,
  stunCharges: 3,
  joy: { x: 0, y: 0, active: false },
  keys: { w: false, a: false, s: false, d: false, run: false },
  lookTouchId: null,
  lastLookX: 0,

  wallBoxes: [
    { x: 0, z: -24, w: 48, d: 1.5 },
    { x: 0, z: 24, w: 48, d: 1.5 },
    { x: -24, z: 0, w: 1.5, d: 48 },
    { x: 24, z: 0, w: 1.5, d: 48 },
    { x: -10, z: -12, w: 1.2, d: 18 },
    { x: -10, z: 12, w: 1.2, d: 16 },
    { x: 4, z: -15, w: 1.2, d: 14 },
    { x: 4, z: 8, w: 1.2, d: 22 },
    { x: 12, z: -4, w: 14, d: 1.2 },
    { x: -17, z: 4, w: 12, d: 1.2 }
  ],

  fuseObj: null,
  generatorPos: { x: -19, z: -12 },
  generatorMesh: null,
  notes: [],
  terminals: [],
  lockers: [
    { x: -13, z: -2 },
    { x: 2, z: 0 },
    { x: 14, z: -10 }
  ],
  exitPos: { x: 20, z: -20 },
  exitMesh: null,

  hunter: { x: 14, z: 14, yaw: 0, patrolAngle: 0, stunnedUntil: 0, mesh: null },
  teammateMeshes: {},
  bobTimer: 0,
  radarAngle: 0,
  lastNetSync: 0,
  lastVentJump: 0,

  start(codes, noteSpots, fuseSpot) {
    this.codes = codes;
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('story-intro').classList.remove('hidden');

    const storyText = 'सुविधाओं से लैस सेक्टर-09 लैब में जैविक हथियारों का परीक्षण चल रहा था।\n\nअचानक "Subject-0" बेकाबू हो गया। आपकी टीम को इस डरावने रहस्य से पर्दा उठाने के लिए 3 सुरक्षा कोड डिकोड करने होंगे।\n\nसावधान: दौड़ने (RUN) की आवाज़ और टॉर्च की रोशनी से वह सीधे आपकी ओर हमला करेगा—और टॉर्च की बैटरी सीमित है!';
    let idx = 0;
    const el = document.getElementById('story-typewriter');
    el.innerHTML = '';
    const typeInt = setInterval(() => {
      if (idx < storyText.length) {
        el.innerHTML += storyText[idx] === '\n' ? '<br>' : storyText[idx];
        idx++;
      } else {
        clearInterval(typeInt);
      }
    }, 20);

    document.getElementById('enter-bunker-btn').onclick = () => {
      clearInterval(typeInt);
      SFX.init();
      document.getElementById('story-intro').classList.add('hidden');
      document.getElementById('game-screen').classList.remove('hidden');

      document.body.requestPointerLock?.();

      const me = Net.players[Net.myId];
      document.getElementById('role-badge').textContent = me.role;

      if (me.role === 'HACKER') {
        this.stunCharges = 4;
        document.getElementById('stun-status').textContent = '🔫 4/4';
      }

      this.initThree(noteSpots, fuseSpot);
      this.setupControls();
      this.running = true;
      requestAnimationFrame(() => this.loop());
    };
  },

  initThree(noteSpots, fuseSpot) {
    const container = document.getElementById('three-container');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x04070e);
    this.scene.fog = new THREE.FogExp2(0x04070e, 0.036);

    this.camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 65);
    this.camera.position.set(Net.players[Net.myId].x, 1.65, Net.players[Net.myId].z);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0x475569, 0x0f172a, 0.85);
    this.scene.add(hemiLight);

    [[-16, -16], [0, 0], [16, 16], [18, -18], [-16, 16]].forEach(([lx, lz]) => {
      const pLight = new THREE.PointLight(0xdc2626, 2.2, 18);
      pLight.position.set(lx, 3.6, lz);
      this.scene.add(pLight);

      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      bulb.position.set(lx, 3.85, lz);
      this.scene.add(bulb);
    });

    this.handGroup = new THREE.Group();
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.35), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    leftArm.position.set(-0.24, -0.22, -0.35);
    const torchBody = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.28, 12), new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8 }));
    torchBody.rotation.x = Math.PI / 2;
    torchBody.position.set(-0.24, -0.20, -0.52);

    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.35), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    rightArm.position.set(0.24, -0.22, -0.35);
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.34), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 }));
    gunBody.position.set(0.24, -0.19, -0.52);
    const gunCore = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.035, 0.24), new THREE.MeshBasicMaterial({ color: 0xc084fc }));
    gunCore.position.set(0.24, -0.14, -0.52);

    this.stunBeamMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.06, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.85 })
    );
    this.stunBeamMesh.rotation.x = Math.PI / 2;
    this.stunBeamMesh.position.set(0.24, -0.16, -6.5);
    this.stunBeamMesh.visible = false;

    this.handGroup.add(leftArm, torchBody, rightArm, gunBody, gunCore, this.stunBeamMesh);
    this.camera.add(this.handGroup);

    this.flashlight = new THREE.SpotLight(0xfffbeb, 7.8, 30, Math.PI / 4, 0.45, 1);
    this.flashTarget = new THREE.Object3D();
    this.scene.add(this.flashlight);
    this.scene.add(this.flashTarget);
    this.flashlight.target = this.flashTarget;

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshStandardMaterial({ map: makeTexture('floor'), roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = 4;
    this.scene.add(ceil);

    const wallTex = makeTexture('concrete');
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.75 });
    this.wallBoxes.forEach(b => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, 4, b.d), wallMat);
      mesh.position.set(b.x, 2, b.z);
      this.scene.add(mesh);
    });

    const lockerMat = new THREE.MeshStandardMaterial({ map: makeTexture('locker'), metalness: 0.5 });
    this.lockers.forEach(lk => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.4, 1.1), lockerMat);
      mesh.position.set(lk.x, 1.2, lk.z);
      this.scene.add(mesh);
    });

    const batCoords = [{ x: -6, z: -18 }, { x: 10, z: 6 }, { x: -18, z: 10 }, { x: 16, z: -14 }];
    this.batteries = batCoords.map(pos => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.36, 10),
        new THREE.MeshBasicMaterial({ color: 0x4ade80 })
      );
      mesh.position.set(pos.x, 0.65, pos.z);
      this.scene.add(mesh);
      return { x: pos.x, z: pos.z, mesh, collected: false };
    });

    const fuseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.65, 12), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    fuseMesh.position.set(fuseSpot.x, 1.1, fuseSpot.z);
    this.scene.add(fuseMesh);
    const fuseGlow = new THREE.PointLight(0x38bdf8, 2.2, 7);
    fuseGlow.position.set(fuseSpot.x, 1.5, fuseSpot.z);
    this.scene.add(fuseGlow);
    this.fuseObj = { x: fuseSpot.x, z: fuseSpot.z, mesh: fuseMesh, light: fuseGlow, picked: false };

    this.generatorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 1.2), new THREE.MeshStandardMaterial({ color: 0x475569, emissive: 0x7f1d1d }));
    this.generatorMesh.position.set(this.generatorPos.x, 1.1, this.generatorPos.z);
    this.scene.add(this.generatorMesh);

    const logs = [
      'डॉ. वर्मा (लॉग #1): "Subject-0 दौड़ने वालों के कदमों की आवाज़ दूर से सुन लेता है! लॉकर में छुपें। एग्ज़िट लॉक #1 कोड:"',
      'डॉ. वर्मा (लॉग #2): "टॉर्च की बैटरी खत्म होने से पहले हरे बैटरी सेल उठाते रहें। लॉक #2 कोड:"',
      'डॉ. वर्मा (लॉग #3): "तीनों लॉक खुलते ही 60 सेकंड का ऑटो-डिस्ट्रक्ट शुरू हो जाएगा! लॉक #3 कोड:"'
    ];
    this.notes = noteSpots.map((pos, i) => {
      const ped = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: wallTex }));
      ped.position.set(pos.x, 0.5, pos.z);
      this.scene.add(ped);

      const paper = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.7), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
      paper.position.set(pos.x, 1.08, pos.z);
      this.scene.add(paper);

      const glow = new THREE.PointLight(0xfacc15, 2, 7);
      glow.position.set(pos.x, 1.6, pos.z);
      this.scene.add(glow);

      return { id: i, x: pos.x, z: pos.z, mesh: paper, found: false, title: `DR. VERMA LOG #${i + 1}`, text: logs[i], code: this.codes[i] };
    });

    const termCoords = [{ x: -19, z: 19 }, { x: 0, z: -21 }, { x: 19, z: 19 }];
    this.terminals = termCoords.map((pos, i) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.8), new THREE.MeshStandardMaterial({ color: 0x334155 }));
      mesh.position.set(pos.x, 1.05, pos.z);
      this.scene.add(mesh);
      return { id: i, x: pos.x, z: pos.z, unlocked: false, mesh };
    });

    this.exitMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 1.8, 3.6, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0.45 })
    );
    this.exitMesh.position.set(this.exitPos.x, 1.8, this.exitPos.z);
    this.scene.add(this.exitMesh);

    // SCARY ANIMATED MUTANT MONSTER (SUBJECT-0)
    const hunterGroup = new THREE.Group();
    const fleshMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85, metalness: 0.25 });
    const veinMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });

    const mTorso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.05, 0.42), fleshMat);
    mTorso.position.set(0, 1.48, 0.08);
    mTorso.rotation.x = 0.28;

    const spine1 = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.36, 6), veinMat);
    spine1.position.set(0, 1.85, -0.18); spine1.rotation.x = -0.6;
    const spine2 = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.32, 6), veinMat);
    spine2.position.set(0, 1.5, -0.22); spine2.rotation.x = -0.6;

    const mHead = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.42), fleshMat);
    mHead.position.set(0, 2.15, 0.26);
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), veinMat);
    leftEye.position.set(-0.1, 2.18, 0.47);
    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), veinMat);
    rightEye.position.set(0.1, 2.18, 0.47);

    const mArmGeo = new THREE.BoxGeometry(0.15, 1.15, 0.15);
    const mLeftArm = new THREE.Mesh(mArmGeo, fleshMat);
    mLeftArm.position.set(-0.45, 1.35, 0.22);
    mLeftArm.rotation.x = -0.45;
    const lClaw = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.38, 5), veinMat);
    lClaw.position.set(0, -0.65, 0.08); lClaw.rotation.x = 0.5;
    mLeftArm.add(lClaw);

    const mRightArm = new THREE.Mesh(mArmGeo, fleshMat);
    mRightArm.position.set(0.45, 1.35, 0.22);
    mRightArm.rotation.x = -0.45;
    const rClaw = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.38, 5), veinMat);
    rClaw.position.set(0, -0.65, 0.08); rClaw.rotation.x = 0.5;
    mRightArm.add(rClaw);

    const mLegGeo = new THREE.BoxGeometry(0.2, 0.98, 0.22);
    const mLeftLeg = new THREE.Mesh(mLegGeo, fleshMat);
    mLeftLeg.position.set(-0.2, 0.5, 0);
    const mRightLeg = new THREE.Mesh(mLegGeo, fleshMat);
    mRightLeg.position.set(0.2, 0.5, 0);

    const hunterGlow = new THREE.PointLight(0xff0000, 3.0, 10);
    hunterGlow.position.set(0, 2.1, 0.4);

    hunterGroup.add(mTorso, spine1, spine2, mHead, leftEye, rightEye, mLeftArm, mRightArm, mLeftLeg, mRightLeg, hunterGlow);
    hunterGroup.userData = { mLeftArm, mRightArm, mLeftLeg, mRightLeg, phase: 0 };
    hunterGroup.position.set(this.hunter.x, 0, this.hunter.z);
    this.scene.add(hunterGroup);
    this.hunter.mesh = hunterGroup;

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  },

  restorePower() {
    if (this.powerRestored) return;
    this.powerRestored = true;
    this.generatorMesh.material.emissive.setHex(0x16a34a);
    this.terminals.forEach(t => {
      t.mesh.material.color.setHex(0xf97316);
      t.mesh.material.emissive.setHex(0x7c2d12);
    });
    document.getElementById('locks-status').textContent = '🔒 0/3';
    document.getElementById('objective-banner').textContent = 'CHAPTER 2: Dr. Verma के 3 गुप्त लॉग्स ढूंढें और टर्मिनल अनलॉक करें';
    SFX.tone(660, 'triangle', 0.3, 0.14);
    this.showRadioToast('SYSTEM', '⚡ जनरेटर चालू हो गया है! अब कोड डिकोड करें!');
  },

  setupControls() {
    const zone = document.getElementById('joystick-zone');
    const stick = document.getElementById('joystick-stick');
    const maxR = 36;

    const handleJoy = (e) => {
      e.preventDefault();
      e.stopPropagation();
      SFX.init();
      const touch = e.targetTouches[0];
      const rect = zone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = touch.clientX - cx;
      let dy = touch.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }
      stick.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy.x = dx / maxR;
      this.joy.y = dy / maxR;
      this.joy.active = true;
    };

    zone.addEventListener('touchstart', handleJoy, { passive: false });
    zone.addEventListener('touchmove', handleJoy, { passive: false });
    zone.addEventListener('touchend', (e) => {
      e.stopPropagation();
      stick.style.transform = 'translate(0px, 0px)';
      this.joy = { x: 0, y: 0, active: false };
    });

    const lookZone = document.getElementById('look-zone');
    lookZone.addEventListener('touchstart', (e) => {
      SFX.init();
      const t = e.changedTouches[0];
      this.lookTouchId = t.identifier;
      this.lastLookX = t.clientX;
    }, { passive: true });

    lookZone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.lookTouchId) {
          const dx = t.clientX - this.lastLookX;
          this.lastLookX = t.clientX;
          const me = Net.players[Net.myId];
          if (me) me.yaw -= dx * 0.0065;
        }
      }
    }, { passive: true });

    window.addEventListener('keydown', (e) => {
      SFX.init();
      const k = e.key.toLowerCase();
      const noteModal = document.getElementById('note-modal');
      const puzzleModal = document.getElementById('puzzle-modal');

      if (!noteModal.classList.contains('hidden')) {
        if (e.key === 'Enter' || e.key === 'Escape' || k === 'e') {
          noteModal.classList.add('hidden');
        }
        return;
      }

      if (!puzzleModal.classList.contains('hidden')) {
        if (e.key >= '0' && e.key <= '9') {
          this.handleKeypadInput(e.key);
        } else if (e.key === 'Escape' || k === 'x') {
          puzzleModal.classList.add('hidden');
        } else if (e.key === 'Backspace') {
          this.enteredPin = '';
          document.getElementById('keypad-display').textContent = '_ _ _';
        }
        return;
      }

      if (k === 'w' || k === 'arrowup') this.keys.w = true;
      if (k === 's' || k === 'arrowdown') this.keys.s = true;
      if (k === 'a' || k === 'arrowleft') this.keys.a = true;
      if (k === 'd' || k === 'arrowright') this.keys.d = true;
      if (e.shiftKey) this.keys.run = true;
      if (k === 'e' || k === ' ') this.triggerInteract();
      if (k === 'f') document.getElementById('torch-btn').click();
      if (k === 'q') this.fireStun();
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') this.keys.w = false;
      if (k === 's' || k === 'arrowdown') this.keys.s = false;
      if (k === 'a' || k === 'arrowleft') this.keys.a = false;
      if (k === 'd' || k === 'arrowright') this.keys.d = false;
      if (!e.shiftKey) this.keys.run = false;
    });

    window.addEventListener('click', () => {
      if (!document.pointerLockElement) {
        document.body.requestPointerLock?.();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === document.body) {
        const dx = e.movementX || e.veux || 0;
        const me = Net.players[Net.myId];
        if (me) me.yaw -= dx * 0.0032;
      }
    });

    document.getElementById('mic-btn').addEventListener('click', () => Net.toggleMic());
    document.getElementById('stun-btn').addEventListener('click', () => this.fireStun());

    const sprintBtn = document.getElementById('sprint-btn');
    sprintBtn.addEventListener('touchstart', (e) => { e.preventDefault(); SFX.init(); this.sprinting = true; });
    sprintBtn.addEventListener('touchend', () => { this.sprinting = false; });

    document.getElementById('torch-btn').addEventListener('click', (e) => {
      SFX.init();
      const me = Net.players[Net.myId];
      if (!me || me.downed || me.hiding || this.battery <= 0) return;
      me.torch = !me.torch;
      this.flashlight.visible = me.torch;
      SFX.tone(620, 'square', 0.04, 0.06);
      e.currentTarget.classList.toggle('torch-on', me.torch);
    });

    document.getElementById('interact-btn').addEventListener('click', () => this.triggerInteract());

    document.getElementById('close-note-btn').addEventListener('click', () => {
      document.getElementById('note-modal').classList.add('hidden');
    });

    document.querySelectorAll('.radio-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        SFX.init();
        const me = Net.players[Net.myId];
        const msg = btn.dataset.msg;
        this.showRadioToast(me.name, msg);
        if (Net.isHost) Net.broadcast({ type: 'RADIO', sender: me.name, msg });
        else Net.sendToHost({ type: 'RADIO', sender: me.name, msg });
      });
    });

    document.querySelectorAll('.key').forEach(k => {
      k.addEventListener('click', () => {
        SFX.init();
        if (k.classList.contains('close')) {
          document.getElementById('puzzle-modal').classList.add('hidden');
          return;
        }
        if (k.classList.contains('clear')) {
          this.enteredPin = '';
          document.getElementById('keypad-display').textContent = '_ _ _';
          return;
        }
        const val = k.dataset.val;
        if (val !== undefined) this.handleKeypadInput(val);
      });
    });
  },

  handleKeypadInput(val) {
    SFX.tone(740, 'sine', 0.05, 0.07);
    if (this.enteredPin.length < 3) this.enteredPin += val;
    document.getElementById('keypad-display').textContent = this.enteredPin.padEnd(3, '_').split('').join(' ');

    if (this.enteredPin.length === 3) {
      if (this.enteredPin === this.codes[this.activeLockIdx]) {
        SFX.tone(980, 'triangle', 0.2, 0.1);
        this.unlockTerminal(this.activeLockIdx);
        if (Net.isHost) Net.broadcast({ type: 'UNLOCK', lockIdx: this.activeLockIdx });
        else Net.sendToHost({ type: 'UNLOCK', lockIdx: this.activeLockIdx });
        document.getElementById('puzzle-modal').classList.add('hidden');
      } else {
        SFX.tone(150, 'sawtooth', 0.25, 0.1);
        this.enteredPin = '';
        document.getElementById('keypad-display').textContent = 'ERR';
      }
    }
  },

  fireStun() {
    SFX.init();
    const me = Net.players[Net.myId];
    if (!me || me.downed || me.hiding || this.stunCharges <= 0) return;

    this.stunCharges--;
    const maxCharges = me.role === 'HACKER' ? 4 : 3;
    document.getElementById('stun-status').textContent = `🔫 ${this.stunCharges}/${maxCharges}`;
    SFX.stunZap();

    this.stunBeamMesh.visible = true;
    setTimeout(() => { this.stunBeamMesh.visible = false; }, 220);

    const dist = Math.hypot(this.hunter.x - me.x, this.hunter.z - me.z);
    if (dist < 13) {
      this.hunter.stunnedUntil = performance.now() + 5000;
      this.showRadioToast('STUN GUN', '⚡ Subject-0 5 सेकंड के लिए फ्रीज़ हो गया!');
    } else {
      this.showRadioToast('STUN GUN', '⚡ निशाना चूक गया!');
    }
  },

  triggerInteract() {
    SFX.init();
    const me = Net.players[Net.myId];
    if (!me || me.downed) return;

    if (me.hiding) {
      me.hiding = false;
      if (this.battery > 0) {
        me.torch = true;
        this.flashlight.visible = true;
      }
      return;
    }
    for (const lk of this.lockers) {
      if (Math.hypot(lk.x - me.x, lk.z - me.z) < 2.6) {
        me.hiding = true;
        me.torch = false;
        this.flashlight.visible = false;
        this.showRadioToast('STEALTH', '🔒 आप मेटल लॉकर के अंदर छुप गए हैं');
        return;
      }
    }

    for (const bat of this.batteries) {
      if (!bat.collected && Math.hypot(bat.x - me.x, bat.z - me.z) < 2.5) {
        bat.collected = true;
        bat.mesh.visible = false;
        this.battery = Math.min(100, this.battery + 45);
        SFX.tone(860, 'sine', 0.14, 0.1);
        this.showRadioToast('BATTERY', '🔋 +45% टॉर्च बैटरी रिचार्ज हुई!');
        return;
      }
    }

    if (this.fuseObj && !this.fuseObj.picked && Math.hypot(this.fuseObj.x - me.x, this.fuseObj.z - me.z) < 2.8) {
      this.fuseObj.picked = true;
      this.fuseObj.mesh.visible = false;
      this.fuseObj.light.visible = false;
      this.hasFuse = true;
      SFX.tone(780, 'sine', 0.15, 0.1);
      document.getElementById('objective-banner').textContent = '🔋 फ्यूज़ मिल गया! जनरेटर पर जाकर [USE/E] दबाएं';
      this.showRadioToast('MISSION', '🔋 Power Fuse उठा लिया!');
      return;
    }

    if (!this.powerRestored && Math.hypot(this.generatorPos.x - me.x, this.generatorPos.z - me.z) < 3) {
      if (this.hasFuse || me.role === 'ENGINEER') {
        this.restorePower();
        if (Net.isHost) Net.broadcast({ type: 'POWER_ON' });
        else Net.sendToHost({ type: 'POWER_ON' });
      } else {
        this.showRadioToast('GENERATOR', '❌ पहले नीला Power Fuse ढूंढें!');
      }
      return;
    }

    for (const p of Object.values(Net.players)) {
      if (p.id !== Net.myId && p.downed && Math.hypot(p.x - me.x, p.z - me.z) < 3) {
        p.downed = false;
        if (!Net.isHost) Net.sendToHost({ type: 'REVIVE', targetId: p.id });
        this.showRadioToast('MEDIC', `❤️ ${p.name} को बचा लिया गया!`);
        return;
      }
    }

    for (const n of this.notes) {
      if (Math.hypot(n.x - me.x, n.z - me.z) < 2.8) {
        n.found = true;
        n.mesh.material.color.setHex(0x4ade80);
        SFX.tone(540, 'sine', 0.1, 0.08);
        document.getElementById('note-title').textContent = n.title;
        document.getElementById('note-body').textContent = n.text;
        document.getElementById('note-code-reveal').textContent = n.code;
        document.getElementById('note-modal').classList.remove('hidden');
        return;
      }
    }

    this.terminals.forEach((t, idx) => {
      if (!t.unlocked && Math.hypot(t.x - me.x, t.z - me.z) < 3) {
        if (!this.powerRestored) {
          this.showRadioToast('TERMINAL', '⚠️ बिजली बंद है! पहले जनरेटर चालू करें!');
          return;
        }
        this.activeLockIdx = idx;
        this.enteredPin = '';
        document.getElementById('puzzle-title').textContent = `SECURITY TERMINAL #${idx + 1}`;
        document.getElementById('keypad-display').textContent = '_ _ _';
        document.getElementById('puzzle-modal').classList.remove('hidden');
      }
    });
  },

  unlockTerminal(idx) {
    const t = this.terminals[idx];
    if (t) {
      t.unlocked = true;
      t.mesh.material.color.setHex(0x22c55e);
      t.mesh.material.emissive.setHex(0x14532d);
    }
    const count = this.terminals.filter(x => x.unlocked).length;
    document.getElementById('locks-status').textContent = `🔒 ${count}/3`;
    this.showRadioToast('SYSTEM', `🔓 Security Lock #${idx + 1} खुल गया!`);

    if (count === 3 && !this.selfDestructActive) {
      this.selfDestructActive = true;
      this.lastTick = performance.now();
      document.getElementById('timer-badge').classList.remove('hidden');
      if (this.exitMesh) this.exitMesh.material.color.setHex(0x22c55e);
      document.getElementById('objective-banner').textContent = '☢️ CHAPTER 3: SELF-DESTRUCT! 60 सेकंड में लिफ्ट तक भागो!';
      SFX.siren();
    }
  },

  showRadioToast(sender, msg) {
    const toast = document.getElementById('radio-toast');
    toast.textContent = `${sender}: ${msg}`;
    toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.add('hidden'), 3400);
  },

  collides3D(nx, nz, pad = 0.65) {
    return this.wallBoxes.some(b =>
      Math.abs(nx - b.x) < (b.w / 2 + pad) && Math.abs(nz - b.z) < (b.d / 2 + pad)
    );
  },

  drawMotionRadar(me) {
    const rc = document.getElementById('radar-canvas');
    if (!rc) return;
    const ctx = rc.getContext('2d');
    const r = 42.5;
    ctx.clearRect(0, 0, 85, 85);

    this.radarAngle += 0.05;
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(r, r, 18, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(r, r, 38, 0, Math.PI * 2); ctx.stroke();

    ctx.strokeStyle = 'rgba(74, 222, 128, 0.7)';
    ctx.beginPath();
    ctx.moveTo(r, r);
    ctx.lineTo(r + Math.cos(this.radarAngle) * 40, r + Math.sin(this.radarAngle) * 40);
    ctx.stroke();

    const radarRange = me.role === 'SCOUT' ? 52 : 40;
    const plot = (wx, wz, color, size = 3) => {
      const dx = wx - me.x;
      const dz = wz - me.z;
      const cos = Math.cos(me.yaw);
      const sin = Math.sin(me.yaw);
      const rx = (dx * cos - dz * sin) * 1.8;
      const rz = (dx * sin + dz * cos) * 1.8;
      if (Math.hypot(rx, rz) > radarRange) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(r + rx, r + rz, size, 0, Math.PI * 2);
      ctx.fill();
    };

    this.batteries.forEach(b => { if (!b.collected) plot(b.x, b.z, '#22c55e', 2.2); });

    if (!this.powerRestored) {
      if (this.fuseObj && !this.fuseObj.picked) plot(this.fuseObj.x, this.fuseObj.z, '#38bdf8', 3.5);
      plot(this.generatorPos.x, this.generatorPos.z, '#f43f5e', 3.5);
    } else {
      this.notes.forEach(n => { if (!n.found) plot(n.x, n.z, '#facc15', 2.5); });
      this.terminals.forEach(t => { if (!t.unlocked) plot(t.x, t.z, '#fb923c', 2.5); });
    }
    if (this.selfDestructActive) plot(this.exitPos.x, this.exitPos.z, '#4ade80', 4);

    Object.values(Net.players).forEach(p => { if (p.id !== Net.myId) plot(p.x, p.z, '#38bdf8', 3); });
    if (Math.sin(performance.now() * 0.012) > -0.3) plot(this.hunter.x, this.hunter.z, '#ef4444', 4);

    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.moveTo(r, r - 4);
    ctx.lineTo(r - 3, r + 3);
    ctx.lineTo(r + 3, r + 3);
    ctx.closePath();
    ctx.fill();
  },

  update() {
    const me = Net.players[Net.myId];
    if (!me) return;

    SFX.ambientDrip();
    Net.updateVoiceProximity(me);

    if (me.torch && this.battery > 0) {
      const drainRate = me.role === 'ENGINEER' ? 0.016 : 0.024;
      this.battery = Math.max(0, this.battery - drainRate);
      const batEl = document.getElementById('battery-badge');
      batEl.textContent = `🔋 ${Math.ceil(this.battery)}%`;
      batEl.classList.toggle('low', this.battery < 22);

      if (this.battery < 20) {
        this.flashlight.intensity = Math.random() > 0.25 ? 6.5 : 0.8;
      } else {
        this.flashlight.intensity = 7.8;
      }

      if (this.battery <= 0) {
        me.torch = false;
        this.flashlight.visible = false;
        document.getElementById('torch-btn').classList.remove('torch-on');
        this.showRadioToast('TORCH', '⚠️ टॉर्च की बैटरी खत्म हो गई! हरा बैटरी सेल ढूंढें!');
      }
    }

    if (this.selfDestructActive) {
      const now = performance.now();
      if (now - this.lastTick >= 1000) {
        this.lastTick = now;
        this.escapeTimeLeft--;
        document.getElementById('timer-badge').textContent = `☢️ ${this.escapeTimeLeft}s`;
        if (this.escapeTimeLeft % 5 === 0) SFX.siren();
        if (this.escapeTimeLeft <= 0 && Net.isHost) {
          if (this.level === 3) {
            Net.broadcast({ type: 'GAMEOVER', win: true, reason: '🚁 रेस्क्यू हेलीकॉप्टर आ गया! आपकी टीम ने तीनों लेवल जीत लिए!' });
            this.triggerEnd(true, '🚁 रेस्क्यू हेलीकॉप्टर आ गया! आपकी टीम ने तीनों लेवल जीत लिए!');
          } else {
            Net.broadcast({ type: 'GAMEOVER', win: false, reason: 'समय खत्म! Sector-09 नष्ट हो गया!' });
            this.triggerEnd(false, 'समय खत्म! Sector-09 नष्ट हो गया!');
          }
        }
      }
    }

    const isRunning = this.sprinting || this.keys.run;
    const speed = (isRunning ? 0.145 : 0.085) * (me.role === 'SCOUT' ? 1.2 : 1);
    let moveX = 0, moveZ = 0;

    const forwardX = -Math.sin(me.yaw);
    const forwardZ = -Math.cos(me.yaw);
    const rightX = Math.cos(me.yaw);
    const rightZ = -Math.sin(me.yaw);

    if (this.joy.active) {
      moveX = (forwardX * -this.joy.y + rightX * this.joy.x) * speed;
      moveZ = (forwardZ * -this.joy.y + rightZ * this.joy.x) * speed;
    } else {
      if (this.keys.w) { moveX += forwardX * speed; moveZ += forwardZ * speed; }
      if (this.keys.s) { moveX -= forwardX * speed; moveZ -= forwardZ * speed; }
      if (this.keys.a) { moveX -= rightX * speed; moveZ -= rightZ * speed; }
      if (this.keys.d) { moveX += rightX * speed; moveZ += rightZ * speed; }
    }

    me.makingNoise = false;
    if ((moveX !== 0 || moveZ !== 0) && !me.downed && !me.hiding) {
      if (!this.collides3D(me.x + moveX, me.z)) me.x += moveX;
      if (!this.collides3D(me.x, me.z + moveZ)) me.z += moveZ;
      this.bobTimer += isRunning ? 0.24 : 0.14;
      SFX.step(isRunning);
      if (isRunning || Net.voiceLoud) me.makingNoise = true;
    }

    const bobY = (moveX !== 0 || moveZ !== 0 || this.joy.active) ? Math.sin(this.bobTimer) * 0.05 : 0;
    this.camera.position.set(me.x, (me.downed ? 0.6 : 1.65) + bobY, me.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = me.yaw;

    if (this.handGroup) {
      this.handGroup.position.y = Math.sin(this.bobTimer) * 0.015;
    }

    this.flashlight.position.copy(this.camera.position);
    this.flashTarget.position.set(me.x - Math.sin(me.yaw) * 10, 1.5, me.z - Math.cos(me.yaw) * 10);

    const nearSomething =
      this.batteries.some(b => !b.collected && Math.hypot(b.x - me.x, b.z - me.z) < 2.5) ||
      (this.fuseObj && !this.fuseObj.picked && Math.hypot(this.fuseObj.x - me.x, this.fuseObj.z - me.z) < 2.8) ||
      (!this.powerRestored && Math.hypot(this.generatorPos.x - me.x, this.generatorPos.z - me.z) < 3) ||
      this.notes.some(n => Math.hypot(n.x - me.x, n.z - me.z) < 2.8) ||
      this.terminals.some(t => !t.unlocked && Math.hypot(t.x - me.x, t.z - me.z) < 3) ||
      this.lockers.some(lk => Math.hypot(lk.x - me.x, lk.z - me.z) < 2.6);
    document.getElementById('interact-hint').classList.toggle('hidden', !nearSomething);

    if (this.fuseObj && this.fuseObj.mesh) this.fuseObj.mesh.rotation.y += 0.05;
    this.notes.forEach(n => { if (n.mesh) n.mesh.rotation.y += 0.03; });
    this.batteries.forEach(b => { if (!b.collected) b.mesh.rotation.y += 0.04; });

    const isStunned = performance.now() < this.hunter.stunnedUntil;
    if (Net.isHost && !isStunned) {
      let nearest = null;
      let minDist = 999;

      Object.values(Net.players).forEach(p => {
        if (p.downed || p.hiding) return;
        const d = Math.hypot(p.x - this.hunter.x, p.z - this.hunter.z);
        const range = (this.selfDestructActive || this.level === 2) ? 30 : (p.makingNoise ? 22 : (p.torch ? 16 : 6.5));
        if (d < range && d < minDist) {
          minDist = d;
          nearest = p;
        }
      });

      if (nearest) {
        this.hunter.yaw = Math.atan2(nearest.x - this.hunter.x, nearest.z - this.hunter.z);
        const hSpeed = (this.selfDestructActive || this.level === 2) ? 0.098 : 0.082;
        const hx = this.hunter.x + Math.sin(this.hunter.yaw) * hSpeed;
        const hz = this.hunter.z + Math.cos(this.hunter.yaw) * hSpeed;
        if (!this.collides3D(hx, this.hunter.z, 0.7)) this.hunter.x = hx;
        if (!this.collides3D(this.hunter.x, hz, 0.7)) this.hunter.z = hz;

        if (minDist < 1.35) {
          nearest.downed = true;
          if (nearest.id === Net.myId) this.triggerJumpscare();
        }
      } else {
        const nowV = performance.now();
        if (nowV - this.lastVentJump > 35000) {
          this.lastVentJump = nowV;
          const farSpots = [{ x: 20, z: 20 }, { x: -20, z: -20 }, { x: 20, z: -12 }, { x: -20, z: 12 }];
          const safeSpots = farSpots.filter(s =>
            Object.values(Net.players).every(p => Math.hypot(p.x - s.x, p.z - s.z) > 15) &&
            this.lockers.every(lk => Math.hypot(lk.x - s.x, lk.z - s.z) > 8)
          );
          if (safeSpots.length > 0) {
            const v = safeSpots[Math.floor(Math.random() * safeSpots.length)];
            this.hunter.x = v.x; this.hunter.z = v.z;
          }
        }
        this.hunter.patrolAngle += 0.012;
        this.hunter.yaw = this.hunter.patrolAngle;
        const px = this.hunter.x + Math.sin(this.hunter.patrolAngle) * 0.045;
        const pz = this.hunter.z + Math.cos(this.hunter.patrolAngle) * 0.045;
        if (!this.collides3D(px, pz, 0.7)) {
          this.hunter.x = px;
          this.hunter.z = pz;
        } else {
          this.hunter.patrolAngle += Math.PI / 2;
        }
      }

      const allPlayers = Object.values(Net.players);
      if (allPlayers.length > 0 && allPlayers.every(p => p.downed)) {
        Net.broadcast({ type: 'GAMEOVER', win: false, reason: 'Subject-0 ने पूरी टीम को खत्म कर दिया!' });
        this.triggerEnd(false, 'Subject-0 ने पूरी टीम को खत्म कर दिया!');
      }

      const allUnlocked = this.terminals.every(t => t.unlocked);
      const atExit = allPlayers.some(p => !p.downed && Math.hypot(p.x - this.exitPos.x, p.z - this.exitPos.z) < 2.6);
      if (allUnlocked && atExit) {
        if (this.level === 1) {
          this.startLevel2();
          Net.broadcast({ type: 'LEVEL_2' });
        } else if (this.level === 2) {
          this.startLevel3();
          Net.broadcast({ type: 'LEVEL_3' });
        }
      }

      const nowSync = performance.now();
      if (nowSync - this.lastNetSync > 50) {
        this.lastNetSync = nowSync;
        Net.broadcast({ type: 'STATE', players: Net.players, hunter: { x: this.hunter.x, z: this.hunter.z, yaw: this.hunter.yaw } });
      }
    } else if (!Net.isHost) {
      const nowSync = performance.now();
      if (nowSync - this.lastNetSync > 50) {
        this.lastNetSync = nowSync;
        Net.sendToHost({
          type: 'MOVE',
          id: Net.myId,
          state: { x: me.x, z: me.z, yaw: me.yaw, torch: me.torch, hiding: me.hiding, makingNoise: me.makingNoise }
        });
      }
    }

    if (this.hunter.mesh) {
      this.hunter.mesh.position.x = THREE.MathUtils.lerp(this.hunter.mesh.position.x, this.hunter.x, 0.22);
      this.hunter.mesh.position.z = THREE.MathUtils.lerp(this.hunter.mesh.position.z, this.hunter.z, 0.22);
      const hDiff = Math.atan2(Math.sin(this.hunter.yaw - this.hunter.mesh.rotation.y), Math.cos(this.hunter.yaw - this.hunter.mesh.rotation.y));
      this.hunter.mesh.rotation.y += hDiff * 0.22;
      const hud = this.hunter.mesh.userData;
      if (hud && !isStunned) {
        hud.phase += 0.16;
        hud.mLeftLeg.rotation.x = Math.sin(hud.phase) * 0.55;
        hud.mRightLeg.rotation.x = -Math.sin(hud.phase) * 0.55;
        hud.mLeftArm.rotation.x = -0.45 + Math.cos(hud.phase) * 0.35;
        hud.mRightArm.rotation.x = -0.45 - Math.cos(hud.phase) * 0.35;
      }
    }

    Object.values(Net.players).forEach(p => {
      if (p.id === Net.myId) return;
      if (!this.teammateMeshes[p.id]) {
        const grp = new THREE.Group();
        const suitMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });
        const armorMat = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.45, metalness: 0.4 });
        const gearMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.7, metalness: 0.15 });
        const detailMat = new THREE.MeshBasicMaterial({ color: p.color });

        // Tactical Torso & Armored Plate Carrier
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.62, 0.28), suitMat);
        torso.position.y = 1.12;
        const vest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.44, 0.32), armorMat);
        vest.position.y = 1.16;

        // Chest Mag Pouches
        const pouch1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.06), gearMat);
        pouch1.position.set(-0.13, -0.11, -0.18);
        const pouch2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.06), gearMat);
        pouch2.position.set(0.13, -0.11, -0.18);
        vest.add(pouch1, pouch2);

        // Shoulder Guard Pads
        const lShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.18), armorMat);
        lShoulder.position.set(-0.29, 1.34, 0);
        const rShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.18), armorMat);
        rShoulder.position.set(0.29, 1.34, 0);

        // Survival Backpack + Radio Antenna
        const backpack = new THREE.Group();
        backpack.position.set(0, 1.16, 0.2);
        const packBody = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.18), gearMat);
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.32, 6), gearMat);
        antenna.position.set(0.12, 0.32, -0.04);
        backpack.add(packBody, antenna);

        // Spec-Ops Helmet, Balaclava Mask & Dual Glowing NVG Lenses
        const headGroup = new THREE.Group();
        headGroup.position.y = 1.62;
        const mask = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), suitMat);
        const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.185, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), armorMat);
        helmet.position.y = 0.02;

        const nvGoggles = new THREE.Group();
        nvGoggles.position.set(0, -0.01, -0.15);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 0.08), gearMat);
        const lensL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.06, 8), detailMat);
        lensL.rotation.x = Math.PI / 2;
        lensL.position.set(-0.065, 0, -0.03);
        const lensR = lensL.clone();
        lensR.position.x = 0.065;
        nvGoggles.add(frame, lensL, lensR);
        headGroup.add(mask, helmet, nvGoggles);

        // Legs with Knee Pads & Combat Boots
        const legGeo = new THREE.BoxGeometry(0.15, 0.52, 0.16);
        const leftLeg = new THREE.Group();
        leftLeg.position.set(-0.13, 0.78, 0);
        const lLegUpper = new THREE.Mesh(legGeo, suitMat);
        lLegUpper.position.y = -0.12;
        const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.18, 0.24), gearMat);
        lBoot.position.set(0, -0.42, -0.03);
        const lKnee = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.18), armorMat);
        lKnee.position.set(0, -0.22, -0.04);
        leftLeg.add(lLegUpper, lBoot, lKnee);

        const rightLeg = new THREE.Group();
        rightLeg.position.set(0.13, 0.78, 0);
        const rLegUpper = new THREE.Mesh(legGeo, suitMat);
        rLegUpper.position.y = -0.12;
        const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.18, 0.24), gearMat);
        rBoot.position.set(0, -0.42, -0.03);
        const rKnee = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.18), armorMat);
        rKnee.position.set(0, -0.22, -0.04);
        rightLeg.add(rLegUpper, rBoot, rKnee);

        // Arms & Tactical Flashlight
        const armGeo = new THREE.BoxGeometry(0.12, 0.54, 0.13);
        const leftArm = new THREE.Mesh(armGeo, suitMat);
        leftArm.position.set(-0.31, 1.12, 0);

        const rightArmGroup = new THREE.Group();
        rightArmGroup.position.set(0.31, 1.32, 0);
        const rightArm = new THREE.Mesh(armGeo, suitMat);
        rightArm.position.set(0, -0.22, -0.12);
        rightArm.rotation.x = Math.PI / 3;
        const gloveR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), gearMat);
        gloveR.position.set(0, -0.25, -0.12);
        rightArm.add(gloveR);

        const torchProp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
        torchProp.rotation.x = Math.PI / 2;
        torchProp.position.set(0, -0.34, -0.34);
        const torchLight = new THREE.PointLight(0xfffbeb, 1.8, 7);
        torchLight.position.set(0, -0.34, -0.55);
        rightArmGroup.add(rightArm, torchProp, torchLight);

        // Agent Name Tag
        const canvas = document.createElement("canvas");
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.fillRect(28, 12, 200, 40);
        ctx.font = "bold 24px monospace";
        ctx.fillStyle = "#10b981";
        ctx.textAlign = "center";
        ctx.fillText(p.name, 128, 40);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
        sprite.scale.set(1.5, 0.38, 1);
        sprite.position.y = 2.15;

        grp.add(torso, vest, lShoulder, rShoulder, backpack, headGroup, leftLeg, rightLeg, leftArm, rightArmGroup, sprite);
        grp.userData = { leftLeg, rightLeg, leftArm, torchLight, lastX: p.x, lastZ: p.z, walkPhase: 0 };
        this.scene.add(grp);
        this.teammateMeshes[p.id] = grp;
      }
      const m = this.teammateMeshes[p.id];
      m.visible = !p.hiding;
      const ud = m.userData;
      m.position.x = THREE.MathUtils.lerp(m.position.x, p.x, 0.24);
      m.position.z = THREE.MathUtils.lerp(m.position.z, p.z, 0.24);
      m.position.y = THREE.MathUtils.lerp(m.position.y, p.downed ? -0.85 : 0, 0.2);
      const angleDiff = Math.atan2(Math.sin(p.yaw - m.rotation.y), Math.cos(p.yaw - m.rotation.y));
      m.rotation.y += angleDiff * 0.24;

      const moved = Math.hypot(m.position.x - ud.lastX, m.position.z - ud.lastZ);
      ud.lastX = m.position.x;
      ud.lastZ = m.position.z;
      if (moved > 0.003) {
        ud.walkPhase += 0.22;
        ud.leftLeg.rotation.x = Math.sin(ud.walkPhase) * 0.55;
        ud.rightLeg.rotation.x = -Math.sin(ud.walkPhase) * 0.55;
        ud.leftArm.rotation.x = -Math.sin(ud.walkPhase) * 0.4;
      } else {
        ud.leftLeg.rotation.x = THREE.MathUtils.lerp(ud.leftLeg.rotation.x, 0, 0.2);
        ud.rightLeg.rotation.x = THREE.MathUtils.lerp(ud.rightLeg.rotation.x, 0, 0.2);
        ud.leftArm.rotation.x = THREE.MathUtils.lerp(ud.leftArm.rotation.x, 0, 0.2);
      }
      ud.torchLight.visible = !!p.torch;
    });

    this.drawMotionRadar(me);

    const distToHunter = Math.hypot(me.x - this.hunter.x, me.z - this.hunter.z);
    const overlay = document.getElementById('danger-overlay');
    if ((distToHunter < 14 && !me.hiding && !isStunned) || this.selfDestructActive) {
      const intensity = this.selfDestructActive ? 85 : Math.floor((1 - distToHunter / 14) * 110);
      overlay.style.boxShadow = `inset 0 0 ${intensity}px rgba(220, 38, 38, 0.9)`;
      if (distToHunter < 14 && !me.hiding && !isStunned) SFX.heartbeat(distToHunter);
    } else {
      overlay.style.boxShadow = 'none';
    }
  },

  startLevel2() {
    this.level = 2;
    this.selfDestructActive = false;
    this.powerRestored = false;
    this.hasFuse = false;
    this.escapeTimeLeft = 50;
    document.getElementById('timer-badge').classList.add('hidden');
    document.getElementById('locks-status').textContent = '⚡ LVL-2 OFF';
    document.getElementById('objective-banner').textContent = '🔥 LEVEL 2 (BIO-REACTOR CORE): नया फ्यूज़ ढूंढें — Subject-0 अब और तेज़ है!';

    const me = Net.players[Net.myId];
    if (me) { me.x = -18; me.z = 18; }
    this.hunter.x = 16; this.hunter.z = 16;

    if (this.fuseObj) {
      this.fuseObj.picked = false;
      this.fuseObj.x = 14; this.fuseObj.z = -16;
      this.fuseObj.mesh.position.set(14, 1.1, -16);
      this.fuseObj.light.position.set(14, 1.5, -16);
      this.fuseObj.mesh.visible = true;
      this.fuseObj.light.visible = true;
    }
    this.generatorMesh.material.emissive.setHex(0x7f1d1d);
    this.codes = [
      String(Math.floor(100 + Math.random() * 899)),
      String(Math.floor(100 + Math.random() * 899)),
      String(Math.floor(100 + Math.random() * 899))
    ];
    const newSpots = [{ x: -16, z: 0 }, { x: 8, z: -18 }, { x: 16, z: 10 }];
    this.notes.forEach((n, i) => {
      n.found = false;
      n.x = newSpots[i].x; n.z = newSpots[i].z;
      n.code = this.codes[i];
      n.mesh.position.set(n.x, 1.08, n.z);
      n.mesh.material.color.setHex(0xfacc15);
    });
    this.terminals.forEach(t => {
      t.unlocked = false;
      t.mesh.material.color.setHex(0x334155);
      t.mesh.material.emissive.setHex(0x000000);
    });
    if (this.exitMesh) this.exitMesh.material.color.setHex(0xef4444);
    this.scene.fog = new THREE.FogExp2(0x140505, 0.042);
    SFX.siren();
    this.showRadioToast('LEVEL 2', '⚠️ BIO-REACTOR CORE में प्रवेश! लाल धुंध और तेज़ Subject-0 से बचें!');
  },

  triggerJumpscare() {
    SFX.jumpscareScream();
    const ov = document.getElementById('jumpscare-overlay');
    ov.classList.remove('hidden');
    setTimeout(() => ov.classList.add('hidden'), 1400);
  },

  startLevel3() {
    this.level = 3;
    this.selfDestructActive = true;
    this.escapeTimeLeft = 45;
    this.lastTick = performance.now();
    document.getElementById('timer-badge').classList.remove('hidden');
    document.getElementById('timer-badge').textContent = '🚁 45s';
    document.getElementById('locks-status').textContent = '🚁 HELIPAD';
    document.getElementById('objective-banner').textContent = '🚁 LEVEL 3 (SURFACE HELIPAD): 45 सेकंड तक ज़िंदा बचें—हेलीकॉप्टर आ रहा है!';

    const me = Net.players[Net.myId];
    if (me) { me.x = 0; me.z = 0; me.downed = false; }
    this.hunter.x = 18; this.hunter.z = -18;
    this.scene.background = new THREE.Color(0x090d16);
    this.scene.fog = new THREE.FogExp2(0x090d16, 0.025);
    SFX.siren();
    this.showRadioToast('LEVEL 3', '🚁 SURFACE HELIPAD! 45 सेकंड तक Subject-0 से बचकर रहें!');
  },

  triggerEnd(win, reason) {
    this.running = false;
    document.getElementById('end-title').textContent = win ? '🚁 SECTOR-09 ESCAPED!' : '💀 MISSION FAILED';
    document.getElementById('end-title').style.color = win ? '#4ade80' : '#ef4444';
    document.getElementById('end-desc').textContent = reason;
    document.getElementById('end-modal').classList.remove('hidden');
  },

  loop() {
    if (!this.running) return;
    this.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.loop());
  }
};
