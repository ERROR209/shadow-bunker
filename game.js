const SFX = {
  ctx: null,
  lastStep: 0,
  lastBeat: 0,
  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(freq, type, dur, vol = 0.08) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  },
  stunZap() {
    this.tone(880, 'sawtooth', 0.25, 0.16);
    setTimeout(() => this.tone(420, 'square', 0.25, 0.14), 80);
    navigator.vibrate?.([60, 40, 80]);
  },
  siren() {
    this.tone(520, 'sawtooth', 0.35, 0.14);
    setTimeout(() => this.tone(380, 'sawtooth', 0.35, 0.14), 350);
  },
  step(sprinting) {
    const now = performance.now();
    if (now - this.lastStep < (sprinting ? 260 : 420)) return;
    this.lastStep = now;
    this.tone(sprinting ? 105 : 80, 'triangle', 0.07, 0.06);
  },
  heartbeat(dist) {
    const now = performance.now();
    const interval = Math.max(280, dist * 45);
    if (now - this.lastBeat < interval) return;
    this.lastBeat = now;
    this.tone(55, 'sine', 0.14, 0.2);
    setTimeout(() => this.tone(46, 'sine', 0.18, 0.15), 130);
    navigator.vibrate?.(45);
  }
};

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
  lastLookY: 0,
  isMouseDown: false,

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

  start(codes, noteSpots, fuseSpot) {
    this.codes = codes;
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('story-intro').classList.remove('hidden');

    const storyText = 'सुविधाओं से लैस सेक्टर-09 लैब में जैविक हथियारों का परीक्षण चल रहा था।\n\nअचानक "Subject-0" बेकाबू हो गया और उसने पूरी सुरक्षा प्रणाली तबाह कर दी। आपकी टीम को इस डरावने रहस्य से पर्दा उठाने और जिंदा बाहर निकलने के लिए 3 सुरक्षा कोड डिकोड करने होंगे।\n\nसावधान रहें: वह अंधेरे में आपकी टॉर्च की रोशनी देखकर हमला करता है!';
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

      const me = Net.players[Net.myId];
      document.getElementById('role-badge').textContent = me.role;

      this.initThree(noteSpots, fuseSpot);
      this.setupControls();
      this.running = true;
      requestAnimationFrame(() => this.loop());
    };
  },

  initThree(noteSpots, fuseSpot) {
    const container = document.getElementById('three-container');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050811);
    this.scene.fog = new THREE.FogExp2(0x050811, 0.034);

    this.camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 65);
    this.camera.position.set(Net.players[Net.myId].x, 1.65, Net.players[Net.myId].z);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0x475569, 0x0f172a, 0.95);
    this.scene.add(hemiLight);

    [[-16, -16], [0, 0], [16, 16], [18, -18], [-16, 16]].forEach(([lx, lz]) => {
      const pLight = new THREE.PointLight(0xdc2626, 2.4, 18);
      pLight.position.set(lx, 3.6, lz);
      this.scene.add(pLight);

      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      bulb.position.set(lx, 3.85, lz);
      this.scene.add(bulb);
    });

    // Visible 3D Hands
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

    this.flashlight = new THREE.SpotLight(0xfffbeb, 7.5, 30, Math.PI / 4, 0.45, 1);
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

    // Power Fuse
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

    // Dr. Verma's Logs
    const logs = [
      'डॉ. वर्मा (लॉग #1): "Subject-0 की आँखें संवेदनशीलता खो चुकी हैं लेकिन सुनने की शक्ति तेज है। मुख्य एग्ज़िट लॉक #1 का कोड है:"',
      'डॉ. वर्मा (लॉग #2): "हमने पल्स स्टन गन बनाई है जो इसे कुछ पलों के लिए रोक सकती है। लॉक #2 का कोड है:"',
      'डॉ. वर्मा (लॉग #3): "सिस्टम में ऑटो-डिस्ट्रक्ट लगा है। तीनों लॉक खुलते ही 60 सेकंड में लिफ्ट तक पहुँचना होगा! लॉक #3 का कोड है:"'
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

    // Subject-0 Monster
    const hunterGroup = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 2.6, 12), new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 }));
    body.position.y = 1.3;
    hunterGroup.add(body);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeMat);
    leftEye.position.set(-0.16, 2.25, 0.42);
    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeMat);
    rightEye.position.set(0.16, 2.25, 0.42);
    hunterGroup.add(leftEye, rightEye);
    const hunterGlow = new THREE.PointLight(0xff0000, 2.5, 9);
    hunterGlow.position.set(0, 2, 0);
    hunterGroup.add(hunterGlow);
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
    // Mobile Touch Joystick
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

    // Mobile Swipe Look Zone
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

    // PC Keyboard WASD & Mouse Support
    window.addEventListener('keydown', (e) => {
      SFX.init();
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') this.keys.w = true;
      if (k === 's' || k === 'arrowdown') this.keys.s = true;
      if (k === 'a' || k === 'arrowleft') this.keys.a = true;
      if (k === 'd' || k === 'arrowright') this.keys.d = true;
      if (e.shiftKey) this.keys.run = true;
      if (k === 'e' || k === ' ') this.triggerInteract();
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') this.keys.w = false;
      if (k === 's' || k === 'arrowdown') this.keys.s = false;
      if (k === 'a' || k === 'arrowleft') this.keys.a = false;
      if (k === 'd' || k === 'arrowright') this.keys.d = false;
      if (!e.shiftKey) this.keys.run = false;
    });

    // PC Mouse Look (Click & Drag or PointerLock)
    window.addEventListener('mousedown', (e) => { this.isMouseDown = true; this.lastLookX = e.clientX; });
    window.addEventListener('mouseup', () => { this.isMouseDown = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.isMouseDown) return;
      const dx = e.clientX - this.lastLookX;
      this.lastLookX = e.clientX;
      const me = Net.players[Net.myId];
      if (me) me.yaw -= dx * 0.0035;
    });

    // Stun Button Action
    document.getElementById('stun-btn').addEventListener('click', () => this.fireStun());

    // Sprint
    const sprintBtn = document.getElementById('sprint-btn');
    sprintBtn.addEventListener('touchstart', (e) => { e.preventDefault(); SFX.init(); this.sprinting = true; });
    sprintBtn.addEventListener('touchend', () => { this.sprinting = false; });

    // Torch Toggle
    document.getElementById('torch-btn').addEventListener('click', (e) => {
      SFX.init();
      const me = Net.players[Net.myId];
      if (!me || me.downed || me.hiding) return;
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
        const val = k.textContent;
        if (k.classList.contains('close')) {
          document.getElementById('puzzle-modal').classList.add('hidden');
          return;
        }
        SFX.tone(740, 'sine', 0.05, 0.07);
        if (k.classList.contains('clear')) this.enteredPin = '';
        else if (this.enteredPin.length < 3) this.enteredPin += val;
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
      });
    });
  },

  fireStun() {
    SFX.init();
    const me = Net.players[Net.myId];
    if (!me || me.downed || me.hiding || this.stunCharges <= 0) return;

    this.stunCharges--;
    document.getElementById('stun-status').textContent = `🔫 ${this.stunCharges}/3`;
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
      me.torch = true;
      this.flashlight.visible = true;
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
      if (this.hasFuse) {
        this.restorePower();
        if (Net.isHost) Net.broadcast({ type: 'POWER_ON' });
        else Net.sendToHost({ type: 'POWER_ON' });
      } else {
        this.showRadioToast('GENERATOR', '❌ पहले नीला Power Fuse ढूंढें!');
      }
      return;
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
    const r = 53;
    ctx.clearRect(0, 0, 106, 106);

    this.radarAngle += 0.05;
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(r, r, 23, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(r, r, 45, 0, Math.PI * 2); ctx.stroke();

    ctx.strokeStyle = 'rgba(74, 222, 128, 0.7)';
    ctx.beginPath();
    ctx.moveTo(r, r);
    ctx.lineTo(r + Math.cos(this.radarAngle) * 50, r + Math.sin(this.radarAngle) * 50);
    ctx.stroke();

    const plot = (wx, wz, color, size = 3.5) => {
      const dx = wx - me.x;
      const dz = wz - me.z;
      const cos = Math.cos(me.yaw);
      const sin = Math.sin(me.yaw);
      const rx = (dx * cos - dz * sin) * 2.0;
      const rz = (dx * sin + dz * cos) * 2.0;
      if (Math.hypot(rx, rz) > 46) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(r + rx, r + rz, size, 0, Math.PI * 2);
      ctx.fill();
    };

    if (!this.powerRestored) {
      if (this.fuseObj && !this.fuseObj.picked) plot(this.fuseObj.x, this.fuseObj.z, '#38bdf8', 4);
      plot(this.generatorPos.x, this.generatorPos.z, '#f43f5e', 4);
    } else {
      this.notes.forEach(n => { if (!n.found) plot(n.x, n.z, '#facc15', 3); });
      this.terminals.forEach(t => { if (!t.unlocked) plot(t.x, t.z, '#fb923c', 3); });
    }
    if (this.selfDestructActive) plot(this.exitPos.x, this.exitPos.z, '#4ade80', 5);

    Object.values(Net.players).forEach(p => { if (p.id !== Net.myId) plot(p.x, p.z, '#38bdf8', 3.5); });
    if (Math.sin(performance.now() * 0.012) > -0.3) plot(this.hunter.x, this.hunter.z, '#ef4444', 4.5);

    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.moveTo(r, r - 5);
    ctx.lineTo(r - 4, r + 4);
    ctx.lineTo(r + 4, r + 4);
    ctx.closePath();
    ctx.fill();
  },

  update() {
    const me = Net.players[Net.myId];
    if (!me) return;

    if (this.selfDestructActive) {
      const now = performance.now();
      if (now - this.lastTick >= 1000) {
        this.lastTick = now;
        this.escapeTimeLeft--;
        document.getElementById('timer-badge').textContent = `☢️ ${this.escapeTimeLeft}s`;
        if (this.escapeTimeLeft % 5 === 0) SFX.siren();
        if (this.escapeTimeLeft <= 0 && Net.isHost) {
          Net.broadcast({ type: 'GAMEOVER', win: false, reason: 'समय खत्म! Sector-09 नष्ट हो गया!' });
          this.triggerEnd(false, 'समय खत्म! Sector-09 नष्ट हो गया!');
        }
      }
    }

    // Keyboard WASD movement + Mobile Joystick movement
    const isRunning = this.sprinting || this.keys.run;
    const speed = (isRunning ? 0.14 : 0.085) * (me.role === 'SCOUT' ? 1.15 : 1);
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

    if (moveX !== 0 || moveZ !== 0) {
      if (!this.collides3D(me.x + moveX, me.z)) me.x += moveX;
      if (!this.collides3D(me.x, me.z + moveZ)) me.z += moveZ;
      this.bobTimer += isRunning ? 0.24 : 0.14;
      SFX.step(isRunning);
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
      (this.fuseObj && !this.fuseObj.picked && Math.hypot(this.fuseObj.x - me.x, this.fuseObj.z - me.z) < 2.8) ||
      (!this.powerRestored && Math.hypot(this.generatorPos.x - me.x, this.generatorPos.z - me.z) < 3) ||
      this.notes.some(n => Math.hypot(n.x - me.x, n.z - me.z) < 2.8) ||
      this.terminals.some(t => !t.unlocked && Math.hypot(t.x - me.x, t.z - me.z) < 3) ||
      this.lockers.some(lk => Math.hypot(lk.x - me.x, lk.z - me.z) < 2.6);
    document.getElementById('interact-hint').classList.toggle('hidden', !nearSomething);

    if (this.fuseObj && this.fuseObj.mesh) this.fuseObj.mesh.rotation.y += 0.05;
    this.notes.forEach(n => { if (n.mesh) n.mesh.rotation.y += 0.03; });

    const isStunned = performance.now() < this.hunter.stunnedUntil;
    if (Net.isHost && !isStunned) {
      let nearest = null;
      let minDist = 999;

      Object.values(Net.players).forEach(p => {
        if (p.downed || p.hiding) return;
        const d = Math.hypot(p.x - this.hunter.x, p.z - this.hunter.z);
        const range = this.selfDestructActive ? 28 : (p.torch ? 16 : 7);
        if (d < range && d < minDist) {
          minDist = d;
          nearest = p;
        }
      });

      if (nearest) {
        this.hunter.yaw = Math.atan2(nearest.x - this.hunter.x, nearest.z - this.hunter.z);
        const hSpeed = this.selfDestructActive ? 0.095 : 0.08;
        const hx = this.hunter.x + Math.sin(this.hunter.yaw) * hSpeed;
        const hz = this.hunter.z + Math.cos(this.hunter.yaw) * hSpeed;
        if (!this.collides3D(hx, this.hunter.z, 0.7)) this.hunter.x = hx;
        if (!this.collides3D(this.hunter.x, hz, 0.7)) this.hunter.z = hz;

        if (minDist < 1.35) nearest.downed = true;
      } else {
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
        Net.broadcast({ type: 'GAMEOVER', win: true, reason: 'शाबाश! आपकी टीम ने Sector-09 का रहस्य सुलझाया और सुरक्षित बाहर निकल आए!' });
        this.triggerEnd(true, 'शाबाश! आपकी टीम ने Sector-09 का रहस्य सुलझाया और सुरक्षित बाहर निकल आए!');
      }

      Net.broadcast({ type: 'STATE', players: Net.players, hunter: { x: this.hunter.x, z: this.hunter.z, yaw: this.hunter.yaw } });
    } else if (!Net.isHost) {
      Net.sendToHost({
        type: 'MOVE',
        id: Net.myId,
        state: { x: me.x, z: me.z, yaw: me.yaw, torch: me.torch, hiding: me.hiding }
      });
    }

    if (this.hunter.mesh) {
      this.hunter.mesh.position.set(this.hunter.x, 0, this.hunter.z);
      this.hunter.mesh.rotation.y = this.hunter.yaw;
    }

    Object.values(Net.players).forEach(p => {
      if (p.id === Net.myId) return;
      if (!this.teammateMeshes[p.id]) {
        const grp = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.7, 10), new THREE.MeshStandardMaterial({ color: p.color }));
        body.position.y = 0.85;
        grp.add(body);
        this.scene.add(grp);
        this.teammateMeshes[p.id] = grp;
      }
      const m = this.teammateMeshes[p.id];
      m.visible = !p.hiding;
      m.position.set(p.x, 0, p.z);
      m.rotation.y = p.yaw;
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
