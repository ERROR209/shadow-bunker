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

const Game3D = {
  scene: null,
  camera: null,
  renderer: null,
  flashlight: null,
  flashTarget: null,
  running: false,

  codes: ['123', '456', '789'],
  activeLockIdx: -1,
  enteredPin: '',
  sprinting: false,
  joy: { x: 0, y: 0, active: false },
  lookTouchId: null,
  lastLookX: 0,

  // 3D Wall Boxes { x, z, w, d }
  wallBoxes: [
    // Outer Perimeter (48x48 meters)
    { x: 0, z: -24, w: 48, d: 1.5 },
    { x: 0, z: 24, w: 48, d: 1.5 },
    { x: -24, z: 0, w: 1.5, d: 48 },
    { x: 24, z: 0, w: 1.5, d: 48 },
    // Interior 3D Bunker Corridors & Rooms
    { x: -10, z: -12, w: 1.2, d: 18 },
    { x: -10, z: 12, w: 1.2, d: 16 },
    { x: 4, z: -15, w: 1.2, d: 14 },
    { x: 4, z: 8, w: 1.2, d: 22 },
    { x: 12, z: -4, w: 14, d: 1.2 },
    { x: -17, z: 4, w: 12, d: 1.2 }
  ],

  notes: [],
  terminals: [],
  lockers: [
    { x: -13, z: -2 },
    { x: 2, z: 0 },
    { x: 14, z: -10 }
  ],
  exitPos: { x: 20, z: -20 },
  exitMesh: null,

  // 3D Shadow Hunter Monster
  hunter: { x: 14, z: 14, yaw: 0, patrolAngle: 0, mesh: null },
  teammateMeshes: {},
  bobTimer: 0,

  start(codes, noteSpots) {
    this.codes = codes;
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    const me = Net.players[Net.myId];
    document.getElementById('role-badge').textContent = me.role;

    this.initThree(noteSpots);
    this.setupControls();
    this.running = true;
    requestAnimationFrame(() => this.loop());
  },

  initThree(noteSpots) {
    const container = document.getElementById('three-container');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060912);
    this.scene.fog = new THREE.FogExp2(0x060912, 0.042);

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 60);
    this.camera.position.set(Net.players[Net.myId].x, 1.65, Net.players[Net.myId].z);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // Ambient Bunker Visibility (So screen is never pitch black!)
    const hemiLight = new THREE.HemisphereLight(0x334155, 0x0f172a, 0.85);
    this.scene.add(hemiLight);

    // Red Emergency Ceiling Lights across bunker
    [[-16, -16], [0, 0], [16, 16], [18, -18], [-16, 16]].forEach(([lx, lz]) => {
      const pLight = new THREE.PointLight(0xdc2626, 2.2, 16);
      pLight.position.set(lx, 3.6, lz);
      this.scene.add(pLight);

      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      bulb.position.set(lx, 3.85, lz);
      this.scene.add(bulb);
    });

    // Player's 3D Tactical Flashlight
    this.flashlight = new THREE.SpotLight(0xfffbeb, 6.5, 28, Math.PI / 4.2, 0.45, 1);
    this.flashTarget = new THREE.Object3D();
    this.scene.add(this.flashlight);
    this.scene.add(this.flashTarget);
    this.flashlight.target = this.flashTarget;

    // Concrete Floor & Ceiling
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(48, 24, 0x334155, 0x0f172a);
    grid.position.y = 0.01;
    this.scene.add(grid);

    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshStandardMaterial({ color: 0x0f172a })
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = 4;
    this.scene.add(ceil);

    // Build 3D Bunker Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    this.wallBoxes.forEach(b => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, 4, b.d), wallMat);
      mesh.position.set(b.x, 2, b.z);
      this.scene.add(mesh);
    });

    // Build 3D Hiding Lockers
    const lockerMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.5, roughness: 0.4 });
    this.lockers.forEach(lk => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.4, 1.1), lockerMat);
      mesh.position.set(lk.x, 1.2, lk.z);
      this.scene.add(mesh);
    });

    // Build 3D Glowing Secret Notes on Pedestals
    const logs = [
      'जनरेटर ओवरराइड लॉग #1: पहले सिक्योरिटी गेट का पासवर्ड नीचे है:',
      'सावधान! Shadow Hunter रोशनी देखकर दौड़ता है। गेट #2 का कोड:',
      'अगर वो पीछे पड़े तो नीले मेटल लॉकर के पास जाकर USE दबाएं! गेट #3 का कोड:'
    ];
    this.notes = noteSpots.map((pos, i) => {
      const ped = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x475569 })
      );
      ped.position.set(pos.x, 0.5, pos.z);
      this.scene.add(ped);

      const paper = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.08, 0.7),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
      );
      paper.position.set(pos.x, 1.08, pos.z);
      this.scene.add(paper);

      const glow = new THREE.PointLight(0xfacc15, 1.8, 6);
      glow.position.set(pos.x, 1.6, pos.z);
      this.scene.add(glow);

      return { id: i, x: pos.x, z: pos.z, mesh: paper, found: false, title: `SECRET FILE #${i + 1}`, text: logs[i], code: this.codes[i] };
    });

    // Build 3D Security Terminals
    const termCoords = [{ x: -19, z: 19 }, { x: 0, z: -21 }, { x: 19, z: 19 }];
    this.terminals = termCoords.map((pos, i) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 2.1, 0.8),
        new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0x7c2d12 })
      );
      mesh.position.set(pos.x, 1.05, pos.z);
      this.scene.add(mesh);
      return { id: i, x: pos.x, z: pos.z, unlocked: false, mesh };
    });

    // Build 3D Exit Gate Portal
    this.exitMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 1.8, 3.6, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0.45 })
    );
    this.exitMesh.position.set(this.exitPos.x, 1.8, this.exitPos.z);
    this.scene.add(this.exitMesh);

    // Build 3D Shadow Hunter Monster (Tall Dark Figure + Glowing Red Eyes)
    const hunterGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.65, 2.6, 12),
      new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 })
    );
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

  setupControls() {
    // Left Thumb Virtual Joystick
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

    // Right Thumb Swipe Anywhere to Rotate 3D Camera (360° Look)
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

    // Interact Button
    document.getElementById('interact-btn').addEventListener('click', () => {
      SFX.init();
      const me = Net.players[Net.myId];
      if (!me || me.downed) return;

      // Hide / Unhide in Locker
      if (me.hiding) {
        me.hiding = false;
        me.torch = true;
        this.flashlight.visible = true;
        document.getElementById('objective-banner').textContent = 'आप लॉकर से बाहर आ गए हैं';
        return;
      }
      for (const lk of this.lockers) {
        if (Math.hypot(lk.x - me.x, lk.z - me.z) < 2.6) {
          me.hiding = true;
          me.torch = false;
          this.flashlight.visible = false;
          document.getElementById('objective-banner').textContent = '🔒 लॉकर के अंदर सुरक्षित छुपे हैं';
          return;
        }
      }

      // Read Secret Note
      for (const n of this.notes) {
        if (Math.hypot(n.x - me.x, n.z - me.z) < 2.8) {
          n.found = true;
          n.mesh.material.color.setHex(0x4ade80);
          SFX.tone(540, 'sine', 0.1, 0.08);
          document.getElementById('note-title').textContent = n.title;
          document.getElementById('note-body').textContent = n.text;
          document.getElementById('note-code-reveal').textContent = n.code;
          document.getElementById('note-modal').classList.remove('hidden');
          const count = this.notes.filter(x => x.found).length;
          document.getElementById('objective-banner').textContent = `📄 Secret Notes मिले: ${count}/3`;
          return;
        }
      }

      // Revive Teammate
      for (const p of Object.values(Net.players)) {
        if (p.id !== Net.myId && p.downed && Math.hypot(p.x - me.x, p.z - me.z) < 3) {
          p.downed = false;
          if (!Net.isHost) Net.sendToHost({ type: 'REVIVE', targetId: p.id });
          this.showRadioToast('SYSTEM', `${p.name} को बचा लिया गया!`);
          return;
        }
      }

      // Open Terminal Keypad
      this.terminals.forEach((t, idx) => {
        if (!t.unlocked && Math.hypot(t.x - me.x, t.z - me.z) < 3) {
          this.activeLockIdx = idx;
          this.enteredPin = '';
          document.getElementById('puzzle-title').textContent = `SECURITY TERMINAL #${idx + 1}`;
          document.getElementById('keypad-display').textContent = '_ _ _';
          document.getElementById('puzzle-modal').classList.remove('hidden');
        }
      });
    });

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

  unlockTerminal(idx) {
    const t = this.terminals[idx];
    if (t) {
      t.unlocked = true;
      t.mesh.material.color.setHex(0x22c55e);
      t.mesh.material.emissive.setHex(0x14532d);
    }
    const count = this.terminals.filter(x => x.unlocked).length;
    document.getElementById('locks-status').textContent = `🔒 LOCKS: ${count}/3`;
    this.showRadioToast('SYSTEM', `🔓 Security Terminal #${idx + 1} खुल गया!`);
    if (count === 3 && this.exitMesh) {
      this.exitMesh.material.color.setHex(0x22c55e);
      document.getElementById('objective-banner').textContent = '🚪 EXIT GATE खुल गया! हरे पोर्टल में भागें!';
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

  update() {
    const me = Net.players[Net.myId];
    if (!me) return;

    // 3D First-Person Movement relative to Camera Yaw
    if (!me.downed && !me.hiding && this.joy.active) {
      const speed = (this.sprinting ? 0.14 : 0.085) * (me.role === 'SCOUT' ? 1.15 : 1);
      const forwardX = -Math.sin(me.yaw);
      const forwardZ = -Math.cos(me.yaw);
      const rightX = Math.cos(me.yaw);
      const rightZ = -Math.sin(me.yaw);

      const moveX = (forwardX * -this.joy.y + rightX * this.joy.x) * speed;
      const moveZ = (forwardZ * -this.joy.y + rightZ * this.joy.x) * speed;

      if (!this.collides3D(me.x + moveX, me.z)) me.x += moveX;
      if (!this.collides3D(me.x, me.z + moveZ)) me.z += moveZ;

      this.bobTimer += this.sprinting ? 0.24 : 0.14;
      SFX.step(this.sprinting);
    }

    // Update 3D Camera & Flashlight Position
    const bobY = this.joy.active ? Math.sin(this.bobTimer) * 0.06 : 0;
    this.camera.position.set(me.x, (me.downed ? 0.6 : 1.65) + bobY, me.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = me.yaw;

    this.flashlight.position.copy(this.camera.position);
    this.flashTarget.position.set(
      me.x - Math.sin(me.yaw) * 10,
      1.5,
      me.z - Math.cos(me.yaw) * 10
    );

    // Show Nearby Interaction Prompt
    const nearSomething =
      this.notes.some(n => Math.hypot(n.x - me.x, n.z - me.z) < 2.8) ||
      this.terminals.some(t => !t.unlocked && Math.hypot(t.x - me.x, t.z - me.z) < 3) ||
      this.lockers.some(lk => Math.hypot(lk.x - me.x, lk.z - me.z) < 2.6);
    document.getElementById('interact-hint').classList.toggle('hidden', !nearSomething);

    // Rotate 3D Secret Notes
    this.notes.forEach(n => { if (n.mesh) n.mesh.rotation.y += 0.03; });

    // Host updates 3D Shadow Hunter AI
    if (Net.isHost) {
      let nearest = null;
      let minDist = 999;

      Object.values(Net.players).forEach(p => {
        if (p.downed || p.hiding) return;
        const d = Math.hypot(p.x - this.hunter.x, p.z - this.hunter.z);
        const range = p.torch ? 16 : 7;
        if (d < range && d < minDist) {
          minDist = d;
          nearest = p;
        }
      });

      if (nearest) {
        this.hunter.yaw = Math.atan2(nearest.x - this.hunter.x, nearest.z - this.hunter.z);
        const hx = this.hunter.x + Math.sin(this.hunter.yaw) * 0.082;
        const hz = this.hunter.z + Math.cos(this.hunter.yaw) * 0.082;
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
        Net.broadcast({ type: 'GAMEOVER', win: false, reason: 'Shadow Hunter ने पूरी टीम को पकड़ लिया!' });
        this.triggerEnd(false, 'Shadow Hunter ने पूरी टीम को पकड़ लिया!');
      }

      const allUnlocked = this.terminals.every(t => t.unlocked);
      const atExit = allPlayers.some(p => !p.downed && Math.hypot(p.x - this.exitPos.x, p.z - this.exitPos.z) < 2.6);
      if (allUnlocked && atExit) {
        Net.broadcast({ type: 'GAMEOVER', win: true, reason: 'सभी 3D लॉक खुल गए और टीम सुरक्षित बाहर निकल गई!' });
        this.triggerEnd(true, 'सभी 3D लॉक खुल गए और टीम सुरक्षित बाहर निकल गई!');
      }

      Net.broadcast({ type: 'STATE', players: Net.players, hunter: { x: this.hunter.x, z: this.hunter.z, yaw: this.hunter.yaw } });
    } else {
      Net.sendToHost({
        type: 'MOVE',
        id: Net.myId,
        state: { x: me.x, z: me.z, yaw: me.yaw, torch: me.torch, hiding: me.hiding }
      });
    }

    // Update 3D Hunter Mesh
    if (this.hunter.mesh) {
      this.hunter.mesh.position.set(this.hunter.x, 0, this.hunter.z);
      this.hunter.mesh.rotation.y = this.hunter.yaw;
    }

    // Update Other Players' 3D Avatars
    Object.values(Net.players).forEach(p => {
      if (p.id === Net.myId) return;
      if (!this.teammateMeshes[p.id]) {
        const grp = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, 1.7, 10),
          new THREE.MeshStandardMaterial({ color: p.color })
        );
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

    // Heartbeat & Red Danger Vignette
    const distToHunter = Math.hypot(me.x - this.hunter.x, me.z - this.hunter.z);
    const overlay = document.getElementById('danger-overlay');
    if (distToHunter < 14 && !me.hiding) {
      const intensity = Math.floor((1 - distToHunter / 14) * 110);
      overlay.style.boxShadow = `inset 0 0 ${intensity}px rgba(220, 38, 38, 0.9)`;
      SFX.heartbeat(distToHunter);
    } else {
      overlay.style.boxShadow = 'none';
    }
  },

  triggerEnd(win, reason) {
    this.running = false;
    document.getElementById('end-title').textContent = win ? '🎉 3D BUNKER ESCAPED!' : '💀 SQUAD ELIMINATED';
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
