const SFX = {
  ctx: null,
  noiseBuffer: null,
  lastStep: 0,
  lastMonsterStep: 0,
  lastBeat: 0,
  lastAmbient: 0,
  tracks: {},
  ambienceStarted: false,

  loadMp3(name, path, loop = false, baseVol = 0.7) {
    const audio = new Audio(path);
    audio.loop = loop;
    audio.preload = 'auto';
    audio.volume = baseVol;
    audio._ready = false;
    audio.addEventListener('canplaythrough', () => { audio._ready = true; }, { once: true });
    audio.addEventListener('error', () => { audio._ready = false; }, { once: true });
    this.tracks[name] = audio;
  },

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
      // Preload Real Horror MP3 Files from /sounds/ folder
      this.loadMp3('step', 'sounds/step.mp3', false, 0.55);
      this.loadMp3('monster_step', 'sounds/monster_step.mp3', false, 0.85);
      this.loadMp3('ambience', 'sounds/ambience.mp3', true, 0.35);
      this.loadMp3('scream', 'sounds/scream.mp3', false, 0.95);
      this.loadMp3('stun', 'sounds/stun.mp3', false, 0.85);
      this.loadMp3('heartbeat', 'sounds/heartbeat.mp3', false, 1.0);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    // Start looping Dark Horror Ambience Drone once user touches screen
    if (!this.ambienceStarted && this.tracks.ambience && this.tracks.ambience._ready) {
      this.tracks.ambience.play().then(() => { this.ambienceStarted = true; }).catch(() => {});
    }
  },

  playMp3(name, volume = null, rate = 1.0) {
    const tr = this.tracks[name];
    if (tr && tr._ready) {
      try {
        const clone = tr.cloneNode();
        clone.volume = Math.max(0, Math.min(1, volume !== null ? volume : tr.volume));
        clone.playbackRate = rate;
        clone.play().catch(() => {});
        return true;
      } catch (e) {}
    }
    return false;
  },

  noise(dur, filterFreq, filterType = 'lowpass', vol = 0.35, q = 1.0) {
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
    if (!this.ambienceStarted && this.tracks.ambience && this.tracks.ambience._ready) {
      this.tracks.ambience.play().then(() => { this.ambienceStarted = true; }).catch(() => {});
    }
    if (this.ambienceStarted) return;
    const now = performance.now();
    if (now - this.lastAmbient < 9000) return;
    this.lastAmbient = now;
    this.tone(1150, 'sine', 0.08, 0.05, 1650);
  },

  jumpscareScream() {
    this.init();
    if (this.playMp3('scream', 0.95)) return;
    // Fallback if scream.mp3 not yet added
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(460, now);
    osc1.frequency.exponentialRampToValueAtTime(840, now + 0.14);
    osc1.frequency.exponentialRampToValueAtTime(320, now + 0.85);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.65, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc1.connect(gain);
    gain.connect(this.ctx.destination);
    osc1.start(now); osc1.stop(now + 0.85);
  },

  stunZap() {
    this.init();
    if (this.playMp3('stun', 0.85)) return;
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
    if (this.playMp3('step', sprinting ? 0.65 : 0.4, sprinting ? 1.25 : 0.95)) return;
    const p = 0.92 + Math.random() * 0.16;
    this.noise(0.1, (sprinting ? 460 : 350) * p, 'lowpass', sprinting ? 0.45 : 0.3, 0.8);
    this.tone(88 * p, 'sine', 0.08, sprinting ? 0.32 : 0.2, 38);
  },

  monsterStep(dist) {
    if (dist > 18) return;
    const now = performance.now();
    const interval = Math.max(360, dist * 45);
    if (now - this.lastMonsterStep < interval) return;
    this.lastMonsterStep = now;
    const vol = Math.max(0.08, Math.min(0.95, (18 - dist) / 18));
    if (this.playMp3('monster_step', vol, 0.92)) return;
    this.tone(62, 'sine', 0.14, vol * 0.7, 28);
    this.noise(0.12, 220, 'lowpass', vol * 0.45);
  },

  heartbeat(dist) {
    const now = performance.now();
    const interval = Math.max(680, dist * 85);
    if (now - this.lastBeat < interval) return;
    this.lastBeat = now;
    const vol = Math.max(0.45, Math.min(1.0, (15 - dist) / 11));
    if (this.playMp3('heartbeat', vol)) return;
    this.tone(72, 'sine', 0.16, 0.55 * vol, 36, 0);
    this.tone(62, 'sine', 0.19, 0.42 * vol, 32, 0.17);
  }
};

window.addEventListener('touchstart', () => SFX.init(), { passive: true });
window.addEventListener('pointerdown', () => SFX.init(), { passive: true });
window.addEventListener('DOMContentLoaded', () => {
  const raw = localStorage.getItem('sb_checkpoint_v1');
  const btn = document.getElementById('resume-mission-btn');
  if (raw && btn) {
    try {
      const cp = JSON.parse(raw);
      btn.textContent = `▶️ RESUME CHECKPOINT (LEVEL ${cp.level})`;
      btn.classList.remove('hidden');
      btn.onclick = () => Game3D.loadCheckpoint(cp);
    } catch (e) {}
  }
});

function makeTexture(type, theme = 1) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  if (type === 'wall') {
    ctx.fillStyle = theme === 2 ? '#2b1215' : theme === 3 ? '#1e293b' : '#243042';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#090d14';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 248, 380);
    ctx.strokeRect(260, 4, 248, 380);
    ctx.fillStyle = theme === 2 ? '#f97316' : theme === 3 ? '#38bdf8' : '#eab308';
    ctx.fillRect(0, 392, 512, 42);
    ctx.fillStyle = '#09090b';
    for (let i = -64; i < 560; i += 48) {
      ctx.beginPath();
      ctx.moveTo(i, 392); ctx.lineTo(i + 24, 392);
      ctx.lineTo(i + 4, 434); ctx.lineTo(i - 20, 434);
      ctx.closePath(); ctx.fill();
    }
  } else if (type === 'floor') {
    ctx.fillStyle = theme === 2 ? '#1f1012' : theme === 3 ? '#161e2b' : '#18212f';
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

function buildTacticalCharacter(player, isLobby = false) {
  const grp = new THREE.Group();
  const roleColors = {
    SCOUT: { suit: 0x0369a1, accent: 0x38bdf8 },
    ENGINEER: { suit: 0xb45309, accent: 0xfacc15 },
    MEDIC: { suit: 0x15803d, accent: 0x4ade80 }
  };
  const pal = roleColors[player?.role] || roleColors.SCOUT;

  const suitMat = new THREE.MeshStandardMaterial({ color: pal.suit, roughness: 0.45, metalness: 0.25 });
  const armorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.65 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.55 });
  const visorMat = new THREE.MeshBasicMaterial({ color: pal.accent });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.7 });

  // Torso + Tactical Armor Vest
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.78, 0.32), suitMat);
  torso.position.y = 1.18;
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.56, 0.36), armorMat);
  vest.position.y = 1.24;
  const chestCore = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.38), visorMat);
  chestCore.position.y = 1.26;

  // Tactical Backpack + Glowing Oxygen/Battery Tank (Looks awesome in 3rd-person view!)
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.54, 0.22), armorMat);
  pack.position.set(0, 1.24, 0.24);
  const packCell = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.42, 10), visorMat);
  packCell.position.set(0.1, 1.24, 0.35);

  // Head + Spec-Ops Helmet + Glowing Visor
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skinMat);
  head.position.y = 1.82;
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.24, 0.41), armorMat);
  helmet.position.set(0, 1.92, 0.01);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.06), visorMat);
  visor.position.set(0, 1.83, -0.18);

  // Articulated Left Arm (Pivots at shoulder) + Flashlight
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.37, 1.5, 0);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.58, 0.15), suitMat);
  armL.position.y = -0.25;
  const gloveL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.15), armorMat);
  gloveL.position.y = -0.56;
  const torchProp = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.24, 10), new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.6 }));
  torchProp.rotation.x = Math.PI / 2;
  torchProp.position.set(0, -0.56, -0.12);
  leftArmPivot.add(armL, gloveL, torchProp);

  // Articulated Right Arm (Pivots at shoulder) + Electric Stun Gun
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.37, 1.5, 0);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.58, 0.15), suitMat);
  armR.position.y = -0.25;
  const gloveR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.15), armorMat);
  gloveR.position.y = -0.56;
  const stunProp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, 0.28), visorMat);
  stunProp.position.set(0, -0.54, -0.14);
  rightArmPivot.add(armR, gloveR, stunProp);

  // Articulated Left & Right Legs (Pivot at hip) + Tactical Boots
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.16, 0.78, 0);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), suitMat);
  legL.position.y = -0.31;
  const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.28), bootMat);
  bootL.position.set(0, -0.68, -0.03);
  leftLegPivot.add(legL, bootL);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.16, 0.78, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), suitMat);
  legR.position.y = -0.31;
  const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.28), bootMat);
  bootR.position.set(0, -0.68, -0.03);
  rightLegPivot.add(legR, bootR);

  // Sleek Floating Nameplate
  const cvs = document.createElement('canvas');
  cvs.width = 256; cvs.height = 68;
  const ctx = cvs.getContext('2d');
  ctx.fillStyle = 'rgba(2, 6, 23, 0.82)';
  ctx.fillRect(18, 8, 220, 52);
  ctx.strokeStyle = isLobby ? (player?.ready ? '#4ade80' : '#facc15') : '#38bdf8';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 8, 220, 52);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(player?.name || 'Agent', 128, 33);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(isLobby ? `[${player?.role || 'SCOUT'}] ${player?.ready ? 'READY' : 'WAIT'}` : (player?.role || 'SCOUT'), 128, 53);

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cvs), transparent: true }));
  sprite.position.set(0, 2.38, 0);
  sprite.scale.set(1.55, 0.42, 1);

  grp.add(torso, vest, chestCore, pack, packCell, head, helmet, visor, leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot, sprite);
  return {
    grp,
    limbs: { leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot },
    lastX: player?.x || 0,
    lastZ: player?.z || 0,
    stride: 0
  };
}

const Lobby3D = {
  scene: null,
  camera: null,
  renderer: null,
  avatars: {},
  running: false,
  init() {
    if (this.running) return;
    const container = document.getElementById('lobby-3d-bg');
    if (!container || typeof THREE === 'undefined') return;
    this.running = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060a14);
    this.scene.fog = new THREE.FogExp2(0x060a14, 0.04);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 60);
    this.camera.position.set(0, 2.3, 6.2);
    this.camera.lookAt(0, 1.1, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 1.2));
    const spot = new THREE.SpotLight(0x38bdf8, 4.5, 25, Math.PI / 4, 0.4);
    spot.position.set(0, 7, 4);
    this.scene.add(spot);

    // BGMI-style glowing circular tactical platform
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 4.2, 0.25, 32),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.3 })
    );
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3.5, 3.75, 32),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.14;
    this.scene.add(platform, ring);

    // Bind Role Selector & Ready Button in Lobby
    const roleSel = document.getElementById('role-select');
    const readyBtn = document.getElementById('ready-toggle-btn');
    if (roleSel) {
      roleSel.onchange = () => {
        const me = Net.players[Net.myId];
        if (!me) return;
        me.role = roleSel.value;
        Net.updateSquadUI();
        const pkt = { type: 'ROLE_UPDATE', id: Net.myId, role: me.role, ready: me.ready };
        if (Net.isHost) Net.broadcast(pkt); else Net.sendToHost(pkt);
      };
    }
    if (readyBtn) {
      readyBtn.onclick = () => {
        const me = Net.players[Net.myId];
        if (!me) return;
        me.ready = !me.ready;
        readyBtn.textContent = me.ready ? '✅ READY' : '⏳ NOT READY';
        readyBtn.style.background = me.ready ? '#16a34a' : '#b45309';
        Net.updateSquadUI();
        const pkt = { type: 'ROLE_UPDATE', id: Net.myId, role: me.role, ready: me.ready };
        if (Net.isHost) Net.broadcast(pkt); else Net.sendToHost(pkt);
      };
    }

    this.syncSquad(Net.players);
    this.animate();
  },
  syncSquad(players) {
    if (!this.scene) return;
    Object.values(this.avatars).forEach(m => this.scene.remove(m));
    this.avatars = {};

    const list = Object.values(players || {});
    const slots = [
      { x: -0.9, z: 0.4 }, { x: 0.9, z: 0.4 },
      { x: -2.2, z: -0.4 }, { x: 2.2, z: -0.4 }
    ];
    list.forEach((p, idx) => {
      const built = buildTacticalCharacter(p, true);
      const pos = slots[idx % 4];
      built.grp.position.set(pos.x, 0.12, pos.z);
      built.grp.rotation.y = (idx % 2 === 0 ? -0.18 : 0.18);
      this.scene.add(built.grp);
      this.avatars[p.id] = built;
    });
  },
    animate() {
    if (!this.running) return;
    requestAnimationFrame(() => this.animate());
    if (document.getElementById('lobby-screen').classList.contains('hidden')) {
      this.running = false;
      return;
    }
    const t = performance.now() * 0.0015;
    Object.values(this.avatars).forEach((av, i) => {
      av.grp.position.y = 0.12 + Math.sin(t * 2 + i) * 0.02;
      av.limbs.leftArmPivot.rotation.x = Math.sin(t * 1.8 + i) * 0.08;
      av.limbs.rightArmPivot.rotation.x = -Math.sin(t * 1.8 + i) * 0.08 - 0.15;
    });
    this.renderer.render(this.scene, this.camera);
  }
};

const Game3D = {
  scene: null,
  camera: null,
  renderer: null,
  flashlight: null,
  playerHandGroup: null,
  selfAvatar: null,
  thirdPerson: false,
  mapGroup: null,
  wallBoxes: [],
  teammateMeshes: {},
  hunter: { x: 18, z: -18, yaw: 0, mesh: null, limbs: null, walkCycle: 0, stunnedUntil: 0, stuckFrames: 0, aiState: 'PATROL', goalX: -16, goalZ: 16, scanUntil: 0, investigateUntil: 0 },
  level: 1,
  battery: 100,
  stunCharges: 3,
  hasFuse: false,
  powerRestored: false,
  fuseMesh: null,
  genMesh: null,
  exitMesh: null,
  exitBeacon: null,
  exitPos: { x: 20, z: -23.2 },
  lockers: [],
  notes: [],
  terminals: [],
  valves: [],
  pickups: [],
  chopperGroup: null,
  chopperRotor: null,
  turboUntil: 0,
  stats: { stuns: 0, objectives: 0, revives: 0 },
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
  spectateIndex: 0,
  fpsFrames: 0,
  fpsLastTime: performance.now(),
  keys: {},
  joy: { active: false, dx: 0, dy: 0 },
  sprinting: false,
  nearAction: null,
  animStarted: false,

  saveCheckpoint() {
    try {
      const me = Net.players[Net.myId];
      const state = {
        level: this.level,
        battery: this.battery,
        stunCharges: this.stunCharges,
        hasFuse: this.hasFuse,
        powerRestored: this.powerRestored,
        locks: this.locks,
        codes: this.codes,
        playerPos: me ? { x: me.x, z: me.z } : { x: -18, z: 18 },
        savedAt: Date.now()
      };
      localStorage.setItem('sb_checkpoint_v1', JSON.stringify(state));
    } catch (e) {}
  },

  clearCheckpoint() {
    localStorage.removeItem('sb_checkpoint_v1');
  },

  loadCheckpoint(cp) {
    document.getElementById('landing-screen')?.classList.add('hidden');
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    if (!Net.myId) {
      Net.myId = 'solo_' + Math.floor(Math.random() * 9999);
      Net.isHost = true;
      const pName = document.getElementById('player-name')?.value.trim() || 'Agent-09';
      Net.players[Net.myId] = { id: Net.myId, name: pName, role: 'SCOUT', x: cp.playerPos.x, z: cp.playerPos.z, yaw: 0, torch: true, downed: false, hiding: false };
    }

    const noteSpots = [{ x: -18, z: -18 }, { x: 0, z: 16 }, { x: 18, z: 4 }];
    const fuseSpot = { x: -16, z: -4 };
    this.codes = cp.codes || ['123', '456', '789'];
    this.init3D(noteSpots, fuseSpot);

    this.battery = cp.battery ?? 100;
    this.stunCharges = cp.stunCharges ?? 3;
    document.getElementById('battery-badge').textContent = `🔋 ${Math.ceil(this.battery)}%`;
    document.getElementById('stun-status').textContent = `🔫 ${this.stunCharges}/3`;

    if (cp.level === 2) {
      this.startLevel2();
    } else if (cp.level === 3) {
      this.startLevel3();
    } else {
      if (cp.hasFuse) { this.hasFuse = true; if (this.fuseMesh) this.fuseMesh.visible = false; }
      if (cp.powerRestored) this.restorePower();
      if (Array.isArray(cp.locks)) {
        cp.locks.forEach((unlocked, i) => { if (unlocked) this.unlockTerminal(i); });
      }
      const me = Net.players[Net.myId];
      if (me && cp.playerPos && !this.checkCollision(cp.playerPos.x, cp.playerPos.z)) {
        me.x = cp.playerPos.x; me.z = cp.playerPos.z;
      }
    }
    this.showRadioToast('CHECKPOINT', `💾 Restored Level ${this.level} progress!`);
  },

  start(codes, noteSpots, fuseSpot) {
    this.codes = codes;
    this.savedNoteSpots = noteSpots;
    this.savedFuseSpot = fuseSpot;
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('story-intro').classList.remove('hidden');

    const lines = '11:48 PM — Sector-09 has suffered a catastrophic breach. Conquer 3 distinct zones: 1) Sector-09 Tech Lab, 2) Overheating Bio-Reactor Core, and 3) Rooftop Helicopter Extraction!';
    let i = 0;
    const target = document.getElementById('story-typewriter');
    target.textContent = '';
    const typer = setInterval(() => {
      target.textContent += lines.charAt(i++);
      if (i >= lines.length) clearInterval(typer);
    }, 16);

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
    const myRole = me ? me.role : 'SCOUT';
    document.getElementById('role-badge').textContent = myRole;
    if (myRole === 'ENGINEER') {
      this.stunCharges = 4;
      document.getElementById('stun-status').textContent = '🔫 4/4';
    }

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 90);
    this.camera.rotation.order = 'YXZ';

    const container = document.getElementById('three-container');
    container.innerHTML = '';
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0x94a3b8, 0x1e293b, 0.95));

    this.flashlight = new THREE.SpotLight(0xfffbeb, 6.0, 34, Math.PI / 4.2, 0.35, 1.0);
    this.flashlight.position.set(0, 0, 0);
    this.flashlight.target.position.set(0, 0, -1);
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlight.target);

    // 1. Prominent First-Person Tactical Hands, Flashlight & Electric Stun Gun
    this.playerHandGroup = new THREE.Group();
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.6 });

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.46), sleeveMat);
    leftArm.position.set(-0.3, -0.22, -0.38);
    const torchTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.04, 0.26, 12),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.5 })
    );
    torchTube.rotation.x = Math.PI / 2;
    torchTube.position.set(-0.3, -0.18, -0.56);

    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.46), sleeveMat);
    rightArm.position.set(0.3, -0.22, -0.38);
    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.12), gloveMat);
    rightHand.position.set(0.3, -0.21, -0.62);
    const stunGun = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.11, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.8 })
    );
    stunGun.position.set(0.3, -0.15, -0.62);

    this.playerHandGroup.add(leftArm, torchTube, rightArm, rightHand, stunGun);
    this.camera.add(this.playerHandGroup);

    // 2. Full 3D Self-Character Body (Visible in 3rd-Person Mode!)
    this.selfAvatar = this.createTeammateAvatar(me || { name: 'YOU' });
    this.selfAvatar.grp.visible = false;
    this.scene.add(this.camera);

    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);

    this.buildLevelMap(1, noteSpots, fuseSpot);
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

  clearMap() {
    while (this.mapGroup.children.length > 0) {
      this.mapGroup.remove(this.mapGroup.children[0]);
    }
    this.wallBoxes = [];
    this.lockers = [];
    this.notes = [];
    this.terminals = [];
    this.valves = [];
    this.flickerLights = [];
    this.exitBeacon = null;
  },

  addWall(x, z, w, d, wallTex, h = 4.0) {
    const t = wallTex.clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(1, Math.round(Math.max(w, d) / 4)), 1);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 }));
    mesh.position.set(x, h / 2, z);
    this.mapGroup.add(mesh);
    this.wallBoxes.push({ minX: x - w / 2 - 0.45, maxX: x + w / 2 + 0.45, minZ: z - d / 2 - 0.45, maxZ: z + d / 2 + 0.45 });
  },

  addSafeLockers(spots) {
    spots.forEach(l => {
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
      this.mapGroup.add(grp);
      this.lockers.push(l);
    });
  },

  createExitDoorWithBeacon(x, z) {
    this.exitPos = { x, z };
    this.exitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 3.3, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x0f172a })
    );
    this.exitMesh.position.set(x, 1.65, z);
    this.mapGroup.add(this.exitMesh);

    // Towering Sky-Beam Beacon (Hidden until unlocked, then glows bright green so player ALWAYS sees where Exit is!)
    const beaconGrp = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.85, 14, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.42, side: THREE.DoubleSide })
    );
    beam.position.y = 7;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.6, 24),
      new THREE.MeshBasicMaterial({ color: 0x4ade80, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    const pLight = new THREE.PointLight(0x22c55e, 4.0, 22);
    pLight.position.y = 2.8;
    beaconGrp.add(beam, ring, pLight);
    const ringZ = z > 0 ? z - 1.6 : z + 1.6;
    beaconGrp.position.set(x, 0, ringZ);
    this.exitPos = { x, z: ringZ };
    beaconGrp.visible = false;
    this.mapGroup.add(beaconGrp);
    this.exitBeacon = beaconGrp;
  },

  buildLevelMap(lvl, noteSpots = this.savedNoteSpots, fuseSpot = this.savedFuseSpot) {
    this.clearMap();
    this.level = lvl;

    const floorTex = makeTexture('floor', lvl);
    floorTex.repeat.set(14, 14);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(48, 48), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 }));
    floor.rotation.x = -Math.PI / 2;
    this.mapGroup.add(floor);

    const wallTex = makeTexture('wall', lvl);

    // Outer Perimeter Walls
    const wallHeight = lvl === 3 ? 1.8 : 4.0;
    this.addWall(0, -24, 48, 1, wallTex, wallHeight);
    this.addWall(0, 24, 48, 1, wallTex, wallHeight);
    this.addWall(-24, 0, 1, 48, wallTex, wallHeight);
    this.addWall(24, 0, 1, 48, wallTex, wallHeight);

    if (lvl === 1) {
      // LEVEL 1: SECTOR-09 TECH LAB
      this.scene.background = new THREE.Color(0x090e17);
      this.scene.fog = new THREE.FogExp2(0x090e17, 0.025);

      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(48, 48), new THREE.MeshStandardMaterial({ map: makeTexture('ceil'), side: THREE.DoubleSide }));
      ceil.rotation.x = Math.PI / 2; ceil.position.y = 4.0;
      this.mapGroup.add(ceil);

      this.addWall(-8, 10, 14, 0.8, wallTex);
      this.addWall(8, 10, 12, 0.8, wallTex);
      this.addWall(-10, -6, 0.8, 14, wallTex);
      this.addWall(6, -8, 14, 0.8, wallTex);
      this.addWall(14, 2, 0.8, 12, wallTex);
      this.addWall(-2, -16, 12, 0.8, wallTex);

      this.addSafeLockers([{ x: -20, z: 6 }, { x: -2, z: 6 }, { x: 10, z: -12 }, { x: 20, z: 14 }]);

      // Blue Power Fuse
      this.fuseMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 0.7, 12),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.4 })
      );
      this.fuseMesh.position.set(fuseSpot.x, 0.95, fuseSpot.z);
      const fuseLight = new THREE.PointLight(0x38bdf8, 2.0, 7);
      fuseLight.position.set(fuseSpot.x, 1.3, fuseSpot.z);
      this.mapGroup.add(this.fuseMesh, fuseLight);

      // Generator
      this.genMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 1.8, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x991b1b, emissive: 0xdc2626, emissiveIntensity: 0.8 })
      );
      this.genMesh.position.set(-20, 0.9, 20);
      this.mapGroup.add(this.genMesh);

      // 3 Logs & 3 Terminals
      const logTexts = [
        'Dr. Verma Log #1: Subject-0 hunts by sound. Use the blue code below on Terminal #1:',
        'Dr. Verma Log #2: Stun Gun freezes Subject-0 with high-voltage arcs. Terminal #2 code:',
        'Dr. Verma Log #3: Final override code for Terminal #3 before Bio-Reactor elevator:'
      ];
      noteSpots.forEach((spot, idx) => {
        const stand = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.85, 0.9), new THREE.MeshStandardMaterial({ map: wallTex }));
        stand.position.set(spot.x, 0.425, spot.z);
        const paper = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.55), new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 0.75 }));
        paper.position.set(spot.x, 0.88, spot.z);
        this.mapGroup.add(stand, paper);
        this.notes.push({ x: spot.x, z: spot.z, idx, text: logTexts[idx] });
      });

      const termSpots = [{ x: -6, z: 21 }, { x: 12, z: 21 }, { x: 21, z: -4 }];
      termSpots.forEach((spot, idx) => {
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.6, 0.8), new THREE.MeshStandardMaterial({ color: 0xb91c1c, emissive: 0xef4444, emissiveIntensity: 0.65 }));
        box.position.set(spot.x, 0.8, spot.z);
        this.mapGroup.add(box);
        this.terminals.push({ x: spot.x, z: spot.z, idx, mesh: box });
      });

      this.createExitDoorWithBeacon(20, -23.3);

    } else if (lvl === 2) {
      // LEVEL 2: RADIOACTIVE BIO-REACTOR CORE (Completely New Circular Pillar Layout + Valve Sabotage!)
      this.scene.background = new THREE.Color(0x1a0709);
      this.scene.fog = new THREE.FogExp2(0x1a0709, 0.024);

      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(48, 48), new THREE.MeshStandardMaterial({ map: makeTexture('ceil'), side: THREE.DoubleSide }));
      ceil.rotation.x = Math.PI / 2; ceil.position.y = 4.0;
      this.mapGroup.add(ceil);

      // Massive Glowing Reactor Core in Center
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.2, 4.0, 24),
        new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 1.2, transparent: true, opacity: 0.85 })
      );
      core.position.set(0, 2.0, 0);
      const coreLight = new THREE.PointLight(0xf97316, 4.0, 24);
      coreLight.position.set(0, 2.2, 0);
      this.mapGroup.add(core, coreLight);
      this.wallBoxes.push({ minX: -2.4, maxX: 2.4, minZ: -2.4, maxZ: 2.4 });

      // Symmetric Reactor Cooling Pillars (New Open Arena Feel)
      const pillars = [
        { x: -10, z: -10 }, { x: 10, z: -10 }, { x: -10, z: 10 }, { x: 10, z: 10 },
        { x: 0, z: -15 }, { x: 0, z: 15 }, { x: -15, z: 0 }, { x: 15, z: 0 }
      ];
      pillars.forEach(p => this.addWall(p.x, p.z, 2.4, 2.4, wallTex));

      this.addSafeLockers([{ x: -21, z: 0 }, { x: 21, z: 0 }, { x: 0, z: -21 }, { x: 0, z: 21 }]);

      // NEW TASK FOR LEVEL 2: Turn 4 Overheated Coolant Valves (No keypad codes—direct valve pressure release!)
      const valveSpots = [
        { x: -18, z: -18 }, { x: 18, z: -18 }, { x: -18, z: 18 }, { x: 18, z: 18 }
      ];
      valveSpots.forEach((vs, idx) => {
        const stand = new THREE.Mesh(
          new THREE.CylinderGeometry(0.65, 0.75, 1.3, 14),
          new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 })
        );
        stand.position.set(vs.x, 0.65, vs.z);
        const wheel = new THREE.Mesh(
          new THREE.TorusGeometry(0.45, 0.09, 10, 20),
          new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.9 })
        );
        wheel.position.set(vs.x, 1.45, vs.z);
        const vLight = new THREE.PointLight(0xef4444, 1.6, 7);
        vLight.position.set(vs.x, 2.0, vs.z);
        this.mapGroup.add(stand, wheel, vLight);
        this.valves.push({ x: vs.x, z: vs.z, idx, fixed: false, wheel, light: vLight });
      });

      this.createExitDoorWithBeacon(0, -23.3);

    } else if (lvl === 3) {
      // LEVEL 3: OPEN ROOFTOP HELIPAD (Night Sky, Searchlight & Extraction Pad!)
      this.scene.background = new THREE.Color(0x060b16);
      this.scene.fog = new THREE.FogExp2(0x060b16, 0.018);

      // Glowing Yellow & Cyan Helipad Landing Circle
      const padOuter = new THREE.Mesh(
        new THREE.RingGeometry(4.2, 4.9, 36),
        new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
      );
      padOuter.rotation.x = -Math.PI / 2;
      padOuter.position.y = 0.03;

      const hBar1 = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 3.6), new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide }));
      hBar1.rotation.x = -Math.PI / 2; hBar1.position.set(-1.1, 0.03, 0);
      const hBar2 = hBar1.clone(); hBar2.position.set(1.1, 0.03, 0);
      const hCross = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.7), new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide }));
      hCross.rotation.x = -Math.PI / 2; hCross.position.set(0, 0.03, 0);

      const heliLight = new THREE.PointLight(0x38bdf8, 3.5, 32);
      heliLight.position.set(0, 6, 0);
      this.mapGroup.add(padOuter, hBar1, hBar2, hCross, heliLight);

      // Rooftop Cover Crates & Supply Containers
      const crates = [
        { x: -9, z: -9 }, { x: 9, z: -9 }, { x: -9, z: 9 }, { x: 9, z: 9 },
        { x: -16, z: 0 }, { x: 16, z: 0 }
      ];
      crates.forEach(c => this.addWall(c.x, c.z, 2.6, 2.6, wallTex, 2.2));
      this.addSafeLockers([{ x: -20, z: -20 }, { x: 20, z: 20 }]);

      // 3D Rescue Helicopter (Descends during final 15 seconds!)
      const heli = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.5, 4.8), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 }));
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 3.2), new THREE.MeshStandardMaterial({ color: 0x334155 }));
      tail.position.set(0, 0.2, 3.6);
      const rotor = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.08, 0.35), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      rotor.position.set(0, 0.95, 0);
      const searchLight = new THREE.PointLight(0xfacc15, 5, 25);
      searchLight.position.set(0, -1.2, 0);
      heli.add(body, tail, rotor, searchLight);
      heli.position.set(0, 18, 0);
      this.mapGroup.add(heli);
      this.chopperGroup = heli;
      this.chopperRotor = rotor;
    }

    // Spawn Spare Batteries (+40%) & Stun Cells (+1 Charge) across rooms
    this.pickups = [];
    const pickupSpots = [
      { x: -16, z: 12, kind: 'BATTERY' }, { x: 16, z: -10, kind: 'BATTERY' },
      { x: -12, z: -18, kind: 'STUN' }, { x: 14, z: 18, kind: 'STUN' }
    ];
    pickupSpots.forEach(ps => {
      const isBat = ps.kind === 'BATTERY';
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.45, 0.45),
        new THREE.MeshStandardMaterial({
          color: isBat ? 0x22c55e : 0xc084fc,
          emissive: isBat ? 0x16a34a : 0x9333ea,
          emissiveIntensity: 1.1
        })
      );
      mesh.position.set(ps.x, 0.65, ps.z);
      this.mapGroup.add(mesh);
      this.pickups.push({ ...ps, mesh, taken: false });
    });

    // Corridor / Arena Lights
    [
      { x: -14, z: 14 }, { x: 14, z: 14 }, { x: -14, z: -14 }, { x: 14, z: -14 }
    ].forEach(lc => {
      const pLight = new THREE.PointLight(lvl === 2 ? 0xfb923c : 0x93c5fd, 1.35, 20);
      pLight.position.set(lc.x, 3.5, lc.z);
      this.mapGroup.add(pLight);
    });
  },

  createTeammateAvatar(player) {
    const built = buildTacticalCharacter(player, false);
    const torchLight = new THREE.PointLight(0xbae6fd, 1.8, 9);
    torchLight.position.set(-0.35, 1.35, -0.6);
    built.grp.add(torchLight);
    this.scene.add(built.grp);
    return { grp: built.grp, limbs: built.limbs, torchLight, lastX: player.x || 0, lastZ: player.z || 0, stride: 0 };
  },

  animateCharacterLimbs(charObj, x, z, isMoving) {
    if (!charObj || !charObj.limbs) return;
    if (isMoving) {
      charObj.stride += 0.22;
      const swing = Math.sin(charObj.stride) * 0.65;
      charObj.limbs.leftLegPivot.rotation.x = swing;
      charObj.limbs.rightLegPivot.rotation.x = -swing;
      charObj.limbs.leftArmPivot.rotation.x = -swing * 0.75;
      charObj.limbs.rightArmPivot.rotation.x = swing * 0.75 - 0.25;
    } else {
      charObj.limbs.leftLegPivot.rotation.x = THREE.MathUtils.lerp(charObj.limbs.leftLegPivot.rotation.x, 0, 0.2);
      charObj.limbs.rightLegPivot.rotation.x = THREE.MathUtils.lerp(charObj.limbs.rightLegPivot.rotation.x, 0, 0.2);
      charObj.limbs.leftArmPivot.rotation.x = THREE.MathUtils.lerp(charObj.limbs.leftArmPivot.rotation.x, 0, 0.2);
      charObj.limbs.rightArmPivot.rotation.x = THREE.MathUtils.lerp(charObj.limbs.rightArmPivot.rotation.x, -0.2, 0.2);
    }
  },

  syncTeammates() {
    if (!this.scene) return;
    const activeIds = new Set();

    for (const p of Object.values(Net.players)) {
      if (p.id === Net.myId) continue;
      activeIds.add(p.id);

      if (!this.teammateMeshes[p.id]) {
        this.teammateMeshes[p.id] = this.createTeammateAvatar(p);
      }
      const tm = this.teammateMeshes[p.id];
      tm.grp.visible = !p.hiding;
      const moved = Math.hypot(p.x - tm.lastX, p.z - tm.lastZ) > 0.008;
      tm.lastX = p.x;
      tm.lastZ = p.z;

      tm.grp.position.x = THREE.MathUtils.lerp(tm.grp.position.x, p.x, 0.3);
      tm.grp.position.z = THREE.MathUtils.lerp(tm.grp.position.z, p.z, 0.3);
      tm.grp.rotation.y = p.yaw || 0;

      if (p.downed) {
        tm.grp.rotation.x = -Math.PI / 2;
        tm.grp.position.y = 0.25;
      } else {
        tm.grp.rotation.x = 0;
        tm.grp.position.y = 0;
        this.animateCharacterLimbs(tm, p.x, p.z, moved);
      }
      tm.torchLight.visible = !!p.torch && !p.downed;
    }

    for (const id of Object.keys(this.teammateMeshes)) {
      if (!activeIds.has(id)) {
        this.scene.remove(this.teammateMeshes[id].grp);
        delete this.teammateMeshes[id];
      }
    }
  },

    buildMonster() {
    const grp = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.3 });
    const clawMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.4 });

    // Hunched Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.3, 0.48), skin);
    torso.position.y = 1.48;
    torso.rotation.x = 0.22;

    // Head with Glowing Red Eyes
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.54, 0.54), skin);
    head.position.set(0, 2.34, 0.16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), eyeMat);
    eyeL.position.set(-0.14, 2.38, 0.43);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.14;

    // Articulated Limbs (Pivot at shoulder/hip so arms & legs swing naturally!)
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.15, 0.2), clawMat);
    armL.position.set(-0.56, 1.42, 0.12);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.15, 0.2), clawMat);
    armR.position.set(0.56, 1.42, 0.12);

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.9, 0.24), skin);
    legL.position.set(-0.22, 0.45, 0);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.9, 0.24), skin);
    legR.position.set(0.22, 0.45, 0);

    const aura = new THREE.PointLight(0xff0000, 2.2, 8);
    aura.position.set(0, 1.8, 0.3);

    grp.add(torso, head, eyeL, eyeR, armL, armR, legL, legR, aura);
    grp.position.set(this.hunter.x, 0, this.hunter.z);
    this.scene.add(grp);
    this.hunter.mesh = grp;
    this.hunter.limbs = { armL, armR, legL, legR, torso, head };
  },

  setupControls() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyF') this.toggleTorch();
      if (e.code === 'KeyE') this.interact();
      if (e.code === 'KeyQ') this.fireStun();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    const lookZone = document.getElementById('look-zone');
    let lookId = null, lastX = 0, lastY = 0;
    lookZone.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      lookId = t.identifier; lastX = t.clientX; lastY = t.clientY;
    }, { passive: true });
    lookZone.addEventListener('touchmove', (e) => {
      const me = Net.players[Net.myId];
      if (!me) return;
      for (const t of e.changedTouches) {
        if (t.identifier === lookId) {
          me.yaw -= (t.clientX - lastX) * 0.0062;
          this.camera.rotation.x = Math.max(-0.9, Math.min(0.9, this.camera.rotation.x - (t.clientY - lastY) * 0.0048));
          lastX = t.clientX; lastY = t.clientY;
        }
      }
    }, { passive: true });

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
    const resetJoy = () => { this.joy.active = false; this.joy.dx = 0; this.joy.dy = 0; stick.style.transform = 'translate(0,0)'; };
    joyZone.addEventListener('touchend', resetJoy);
    joyZone.addEventListener('touchcancel', resetJoy);

    document.getElementById('torch-btn').addEventListener('click', () => this.toggleTorch());
    document.getElementById('interact-btn').addEventListener('click', () => this.interact());
    document.getElementById('stun-btn').addEventListener('click', () => this.fireStun());
    document.getElementById('mic-btn').addEventListener('click', () => Net.toggleMic());
    const camBtn = document.getElementById('cam-toggle-btn');
    if (camBtn) {
      camBtn.onclick = () => {
        this.thirdPerson = !this.thirdPerson;
        camBtn.textContent = this.thirdPerson ? '🎥 3RD' : '🎥 1ST';
        camBtn.classList.toggle('on', this.thirdPerson);
        if (this.playerHandGroup) this.playerHandGroup.visible = !this.thirdPerson;
        if (this.selfAvatar) this.selfAvatar.grp.visible = this.thirdPerson && !Net.players[Net.myId]?.hiding;
      };
    }

    const sprintBtn = document.getElementById('sprint-btn');
    sprintBtn.addEventListener('touchstart', (e) => {
      if (document.getElementById('game-screen').classList.contains('hud-editing')) return;
      e.preventDefault();
      this.sprinting = true;
    }, { passive: false });
    sprintBtn.addEventListener('touchend', () => { this.sprinting = false; });

    document.querySelectorAll('.radio-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const me = Net.players[Net.myId];
        const msg = btn.dataset.msg;
        this.showRadioToast(me ? me.name : 'You', msg);
        if (Net.isHost) Net.broadcast({ type: 'RADIO', sender: me.name, msg });
        else Net.sendToHost({ type: 'RADIO', sender: me.name, msg });
      });
    });

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

    // Spectate Next Teammate Button
    document.getElementById('spectate-next-btn').onclick = () => {
      this.spectateIndex++;
    };

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
        el.style.left = ol + 'px'; el.style.top = ot + 'px';
        el.style.right = 'auto'; el.style.bottom = 'auto';
      }, { passive: false, capture: true });

      el.addEventListener('touchmove', (e) => {
        if (!isEditing) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const t = e.touches[0];
        const nl = Math.max(4, Math.min(window.innerWidth - el.offsetWidth - 4, ol + (t.clientX - sx)));
        const nt = Math.max(4, Math.min(window.innerHeight - el.offsetHeight - 4, ot + (t.clientY - sy)));
        el.style.left = nl + 'px'; el.style.top = nt + 'px';
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
      this.stats.stuns++;
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
      document.getElementById('locker-overlay')?.classList.toggle('hidden', !me.hiding);
      this.showRadioToast('STEALTH', me.hiding ? '🔒 Hidden inside Safe Locker!' : '🚪 Exited Safe Locker.');
    } else if (act.type === 'PICKUP') {
      act.item.taken = true;
      act.item.mesh.visible = false;
      if (act.item.kind === 'BATTERY') {
        this.battery = Math.min(100, this.battery + 40);
        document.getElementById('battery-badge').textContent = `🔋 ${Math.ceil(this.battery)}%`;
        this.showRadioToast('SUPPLY', '🔋 Picked up Spare Battery (+40%)!');
      } else {
        this.stunCharges++;
        document.getElementById('stun-status').textContent = `🔫 ${this.stunCharges}`;
        this.showRadioToast('SUPPLY', '⚡ Picked up Stun Cell (+1 Charge)!');
      }
    } else if (act.type === 'BOARD_HELI') {
      const msg = '🚁 Squad boarded the Rescue Helicopter! All 3 levels cleared!';
      if (Net.isHost) Net.broadcast({ type: 'GAMEOVER', win: true, reason: msg });
      this.triggerEnd(true, msg);
    } else if (act.type === 'FUSE') {
      this.hasFuse = true;
      this.fuseMesh.visible = false;
      document.getElementById('objective-banner').textContent = 'CHAPTER 2: Activate the main GENERATOR (red glowing box)';
      this.saveCheckpoint();
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
    } else if (act.type === 'VALVE') {
      this.fixValve(act.valve.idx);
      if (Net.isHost) Net.broadcast({ type: 'UNLOCK', lockIdx: act.valve.idx });
      else Net.sendToHost({ type: 'UNLOCK', lockIdx: act.valve.idx });
    } else if (act.type === 'REVIVE') {
      act.target.downed = false;
      this.stats.revives++;
      if (me.role === 'MEDIC') {
        this.turboUntil = performance.now() + 6000;
        this.battery = Math.min(100, this.battery + 35);
        this.showRadioToast('MEDIC PERK', `💉 Revived ${act.target.name} + 6s Turbo Speed & +35% Battery!`);
      } else {
        this.showRadioToast('MEDIC', `💉 Revived ${act.target.name}!`);
      }
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
    this.saveCheckpoint();
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

  fixValve(idx) {
    const v = this.valves[idx];
    if (!v || v.fixed) return;
    v.fixed = true;
    this.stats.objectives++;
    v.wheel.material.color.setHex(0x22c55e);
    v.wheel.material.emissive.setHex(0x16a34a);
    v.light.color.setHex(0x22c55e);
    SFX.tone(520, 'triangle', 0.25, 0.22, 780);

    const fixedCount = this.valves.filter(x => x.fixed).length;
    document.getElementById('locks-status').textContent = `☢️ VALVES ${fixedCount}/4`;
    if (fixedCount === 4) {
      this.openExitDoor('🚨 ALL 4 COOLANT VALVES SEALED! Follow the GREEN LIGHT BEAM to the Exit!');
    } else {
      document.getElementById('objective-banner').textContent = `☢️ LEVEL 2: Turn remaining Coolant Valves (${fixedCount}/4)`;
    }
  },

  unlockTerminal(idx) {
    if (this.level === 2) return this.fixValve(idx);
    if (this.locks[idx]) return;
    this.locks[idx] = true;
    this.stats.objectives++;
    const t = this.terminals[idx];
    if (t) {
      t.mesh.material.color.setHex(0x16a34a);
      t.mesh.material.emissive.setHex(0x22c55e);
    }
    const count = this.locks.filter(Boolean).length;
    document.getElementById('locks-status').textContent = `🔓 ${count}/3`;
    if (count === 3) {
      this.openExitDoor('🚨 ALL TERMINALS UNLOCKED! Follow the GREEN SKY-BEAM to the Exit Gate!');
    } else {
      document.getElementById('objective-banner').textContent = `CHAPTER 3: Unlock remaining terminals (${count}/3)`;
    }
  },

  openExitDoor(bannerMsg) {
    this.selfDestructActive = true;
    this.escapeTimeLeft = 65;
    this.lastTick = performance.now();
    if (this.exitMesh) {
      this.exitMesh.material.color.setHex(0x22c55e);
      this.exitMesh.material.emissive.setHex(0x4ade80);
    }
    if (this.exitBeacon) this.exitBeacon.visible = true;
    document.getElementById('timer-badge').classList.remove('hidden');
    document.getElementById('objective-banner').textContent = bannerMsg;
    SFX.siren();
  },

  startLevel2() {
    this.selfDestructActive = false;
    document.getElementById('timer-badge').classList.add('hidden');
    document.getElementById('locks-status').textContent = '☢️ VALVES 0/4';
    document.getElementById('objective-banner').textContent = '☢️ LEVEL 2 (BIO-REACTOR): Turn all 4 red Coolant Valves to stop meltdown!';
    this.buildLevelMap(2);
    this.stunCharges = 3;
    document.getElementById('stun-status').textContent = '🔫 3/3';
    const safeSpots = [
      { x: -20, z: -6 }, { x: -20, z: 6 }, { x: -18, z: -6 }, { x: -18, z: 6 }
    ];
    Object.values(Net.players).forEach((p, idx) => {
      const sp = safeSpots[idx % 4];
      p.x = sp.x; p.z = sp.z; p.downed = false; p.hiding = false;
    });
    // Spawn Monster in completely open corridor away from all pillars
    this.hunter.x = 20; this.hunter.z = 6;
    this.hunter.stuckFrames = 0;
    this.saveCheckpoint();
    this.showRadioToast('LEVEL 2', '☢️ BIO-REACTOR CORE! Seal all 4 Coolant Valves!');
  },

  startLevel3() {
    this.buildLevelMap(3);
    this.selfDestructActive = true;
    this.escapeTimeLeft = 45;
    this.lastTick = performance.now();
    this.stunCharges = 3;
    document.getElementById('stun-status').textContent = '🔫 3/3';
    document.getElementById('timer-badge').classList.remove('hidden');
    document.getElementById('locks-status').textContent = '🚁 HELIPAD';
    document.getElementById('objective-banner').textContent = '🚁 LEVEL 3 (ROOFTOP HELIPAD): Survive 45s until helicopter extraction!';
    Object.values(Net.players).forEach((p, idx) => {
      p.x = -2 + idx * 1.4; p.z = 2; p.downed = false; p.hiding = false;
    });
    this.hunter.x = 18; this.hunter.z = -18;
    SFX.siren();
    this.saveCheckpoint();
    this.showRadioToast('LEVEL 3', '🚁 ROOFTOP HELIPAD! Hold out for 45 seconds!');
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
    document.getElementById('spectate-bar').classList.add('hidden');
    document.getElementById('jumpscare-overlay').classList.add('hidden');
    document.getElementById('end-title').textContent = win ? '🏆 MISSION ACCOMPLISHED' : '💀 SQUAD WIPED OUT';
    document.getElementById('end-title').style.color = win ? '#4ade80' : '#ef4444';
    document.getElementById('end-desc').textContent = reason;
    const mvpBox = document.getElementById('mvp-summary');
    if (mvpBox) {
      mvpBox.innerHTML = `
        <div style="color:#facc15;font-weight:800;margin-bottom:4px;">🏆 YOUR MATCH STATS (${Net.players[Net.myId]?.role || 'AGENT'})</div>
        <div class="mvp-row"><span>⚡ Subject-0 Stuns:</span><strong>${this.stats.stuns}</strong></div>
        <div class="mvp-row"><span>🔓 Terminals / Valves Fixed:</span><strong>${this.stats.objectives}</strong></div>
        <div class="mvp-row"><span>💉 Squadmates Revived:</span><strong>${this.stats.revives}</strong></div>
      `;
    }
    document.getElementById('end-modal').classList.remove('hidden');
  },

  resetAndRestart(codes, noteSpots, fuseSpot) {
    document.getElementById('end-modal').classList.add('hidden');
    document.getElementById('spectate-bar').classList.add('hidden');
    document.getElementById('jumpscare-overlay').classList.add('hidden');
    document.getElementById('timer-badge').classList.add('hidden');
    this.gameOver = false;
    this.battery = 100;
    this.stunCharges = 3;
    this.hasFuse = false;
    this.powerRestored = false;
    this.selfDestructActive = false;
    this.locks = [false, false, false];
    this.codes = codes;
    this.buildLevelMap(1, noteSpots, fuseSpot);
    this.hunter.x = 18; this.hunter.z = -18; this.hunter.stunnedUntil = 0;

    const spawns = [{ x: -18, z: 18 }, { x: -16, z: 18 }, { x: -18, z: 16 }, { x: -16, z: 16 }];
    Object.values(Net.players).forEach((p, idx) => {
      const sp = spawns[idx % 4];
      p.x = sp.x; p.z = sp.z; p.downed = false; p.hiding = false; p.torch = true;
    });

    document.getElementById('battery-badge').textContent = '🔋 100%';
    document.getElementById('locks-status').textContent = '⚡ OFF';
    document.getElementById('stun-status').textContent = '🔫 3/3';
    document.getElementById('objective-banner').textContent = 'CHAPTER 1: Find the blue POWER FUSE in the dark storage room';
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

    const ang = performance.now() * 0.003;
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.6)';
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * 40, cy + Math.sin(ang) * 40); ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();

    const cos = Math.cos(-me.yaw), sin = Math.sin(-me.yaw);

    // Show bright green Exit Waypoint dot on Radar when Exit Door unlocks!
    if (this.selfDestructActive && this.level < 3) {
      const ex = this.exitPos.x - me.x;
      const ez = this.exitPos.z - me.z;
      const erx = (ex * cos - ez * sin) * 1.4;
      const erz = (ex * sin + ez * cos) * 1.4;
      const ed = Math.hypot(erx, erz);
      const ec = ed > 36 ? 36 / ed : 1;
      ctx.fillStyle = '#4ade80';
      ctx.beginPath(); ctx.arc(cx + erx * ec, cy + erz * ec, 4.5, 0, Math.PI * 2); ctx.fill();
    }

    // Teammates Blue Dots on Radar
    for (const p of Object.values(Net.players)) {
      if (p.id === Net.myId || p.hiding) continue;
      const px = p.x - me.x;
      const pz = p.z - me.z;
      const prx = (px * cos - pz * sin) * 1.4;
      const prz = (px * sin + pz * cos) * 1.4;
      const pd = Math.hypot(prx, prz);
      const pc = pd > 36 ? 36 / pd : 1;
      ctx.fillStyle = p.downed ? '#facc15' : '#38bdf8';
      ctx.beginPath(); ctx.arc(cx + prx * pc, cy + prz * pc, 3.8, 0, Math.PI * 2); ctx.fill();
    }

    // Monster Dot
    const dx = this.hunter.x - me.x;
    const dz = this.hunter.z - me.z;
    const radarScale = me.role === 'SCOUT' ? 0.85 : 1.4;
    const rx = (dx * cos - dz * sin) * radarScale;
    const rz = (dx * sin + dz * cos) * radarScale;
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
      this.syncTeammates();

      // Rotate Level 2 Valves for visual polish
      this.valves.forEach(v => { if (!v.fixed) v.wheel.rotation.y += 0.02; });
      if (this.exitBeacon && this.exitBeacon.visible) this.exitBeacon.rotation.y += 0.03;

      // Check if Local Player is Downed -> Activate Live Teammate Spectate Mode!
      const aliveTeammates = Object.values(Net.players).filter(p => p.id !== Net.myId && !p.downed);
      const specBar = document.getElementById('spectate-bar');

      if (me.downed && aliveTeammates.length > 0) {
        specBar.classList.remove('hidden');
        const targetMate = aliveTeammates[this.spectateIndex % aliveTeammates.length];
        document.getElementById('spectate-target-name').textContent = `${targetMate.name} (${targetMate.role})`;
        this.camera.position.set(targetMate.x, 1.75, targetMate.z);
        this.camera.rotation.y = targetMate.yaw;
      } else {
        specBar.classList.add('hidden');

        // Normal Alive Movement
        let fwd = 0, str = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) fwd += 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) fwd -= 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) str -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) str += 1;
        if (this.joy.active) { fwd -= this.joy.dy; str += this.joy.dx; }

        const isRunning = (this.keys['ShiftLeft'] || this.sprinting) && !me.downed && !me.hiding;
        this.pickups.forEach(pk => { if (!pk.taken) pk.mesh.rotation.y += 0.03; });
        if (this.level === 3 && this.chopperGroup) {
          this.chopperRotor.rotation.y += 0.35;
          const targetY = this.escapeTimeLeft <= 12 ? 1.1 : 18;
          this.chopperGroup.position.y = THREE.MathUtils.lerp(this.chopperGroup.position.y, targetY, 0.03);
        }
        const turboBoost = performance.now() < this.turboUntil ? 1.35 : 1.0;
        const speed = (me.downed ? 0.02 : me.hiding ? 0 : (isRunning ? 0.125 : 0.075)) * turboBoost;

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
        if (this.playerHandGroup) {
          this.playerHandGroup.position.y = Math.sin(this.walkBob * 2) * 0.015;
          this.playerHandGroup.position.x = Math.cos(this.walkBob) * 0.015;
        }
        if (this.thirdPerson) {
          if (this.selfAvatar) {
            this.selfAvatar.grp.visible = !me.hiding;
            this.selfAvatar.grp.position.set(me.x, me.downed ? 0.25 : 0, me.z);
            this.selfAvatar.grp.rotation.y = me.yaw;
            this.selfAvatar.grp.rotation.x = me.downed ? -Math.PI / 2 : 0;
            this.animateCharacterLimbs(this.selfAvatar, me.x, me.z, Math.hypot(this.velX, this.velZ) > 0.004 && !me.downed);
          }
          // Over-the-shoulder 3rd-Person Camera
          const camDist = 2.6;
          const cx = me.x + Math.sin(me.yaw) * camDist;
          const cz = me.z + Math.cos(me.yaw) * camDist;
          this.camera.position.set(cx, 2.25 + bob, cz);
          this.camera.rotation.y = me.yaw;
        } else {
          if (this.selfAvatar) this.selfAvatar.grp.visible = false;
          this.camera.position.set(me.x, (me.downed ? 0.55 : 1.62) + bob, me.z);
          this.camera.rotation.y = me.yaw;
        }
      }

      // Battery Drain
      if (me.torch && this.battery > 0 && !me.downed) {
        this.battery = Math.max(0, this.battery - 0.012);
        if (this.battery === 0) { me.torch = false; this.flashlight.visible = false; }
        document.getElementById('battery-badge').textContent = `🔋 ${Math.ceil(this.battery)}%`;
      }

      // Context Interaction Hint
      this.nearAction = null;
      const hint = document.getElementById('interact-hint');
      if (!me.downed) {
        for (const lk of this.lockers) {
          if (Math.hypot(lk.x - me.x, lk.z - me.z) < 2.2) {
            this.nearAction = { type: 'LOCKER' };
            hint.textContent = me.hiding ? '🚪 [USE] Exit Safe Locker' : '🔒 [USE] Hide in Safe Locker';
            break;
          }
        }
        if (!this.nearAction && this.level === 1 && !this.hasFuse && this.fuseMesh && Math.hypot(this.fuseMesh.position.x - me.x, this.fuseMesh.position.z - me.z) < 2.2) {
          this.nearAction = { type: 'FUSE' };
          hint.textContent = '🔋 [USE] Pick up Power Fuse';
        }
        if (!this.nearAction && this.level === 1 && Math.hypot(-20 - me.x, 20 - me.z) < 2.6) {
          this.nearAction = { type: 'GEN' };
          hint.textContent = '⚡ [USE] Activate Generator';
        }
        if (!this.nearAction && this.level === 1) {
          for (const n of this.notes) {
            if (Math.hypot(n.x - me.x, n.z - me.z) < 2.2) {
              this.nearAction = { type: 'NOTE', note: n };
              hint.textContent = `📄 [USE] Read Log #${n.idx + 1}`;
              break;
            }
          }
        }
        if (!this.nearAction && this.level === 1) {
          for (const t of this.terminals) {
            if (Math.hypot(t.x - me.x, t.z - me.z) < 2.2) {
              this.nearAction = { type: 'TERM', term: t };
              hint.textContent = `💻 [USE] Terminal #${t.idx + 1}`;
              break;
            }
          }
        }
        if (!this.nearAction && this.level === 2) {
          for (const v of this.valves) {
            if (!v.fixed && Math.hypot(v.x - me.x, v.z - me.z) < 2.4) {
              this.nearAction = { type: 'VALVE', valve: v };
              hint.textContent = `🔧 [USE] Seal Coolant Valve #${v.idx + 1}`;
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
      }
      hint.classList.toggle('hidden', !this.nearAction);

      // Exit Gate Check (Stepping inside the Green Ring immediately advances the squad!)
      if (this.selfDestructActive && this.level < 3) {
        const meAtExit = !me.downed && Math.hypot(this.exitPos.x - me.x, this.exitPos.z - me.z) < 3.4;
        const anyoneAtExit = meAtExit || Object.values(Net.players).some(p => !p.downed && Math.hypot(this.exitPos.x - p.x, this.exitPos.z - p.z) < 3.4);
        if (anyoneAtExit) {
          if (this.level === 1) {
            this.startLevel2();
            if (Net.isHost) Net.broadcast({ type: 'LEVEL_2' });
            else Net.sendToHost({ type: 'LEVEL_2' });
          } else if (this.level === 2) {
            this.startLevel3();
            if (Net.isHost) Net.broadcast({ type: 'LEVEL_3' });
            else Net.sendToHost({ type: 'LEVEL_3' });
          }
        }
      }

      // Countdown Timer
      if (this.selfDestructActive) {
        const now = performance.now();
        if (now - this.lastTick >= 1000) {
          this.lastTick = now;
          this.escapeTimeLeft = Math.max(0, this.escapeTimeLeft - 1);
          document.getElementById('timer-badge').textContent = (this.level === 3 ? '🚁 ' : '☢️ ') + `${this.escapeTimeLeft}s`;
          if (this.escapeTimeLeft <= 0 && Net.isHost) {
            if (this.level === 3) {
              const msg = '🚁 Rescue Helicopter arrived! Your squad cleared all 3 levels!';
              Net.broadcast({ type: 'GAMEOVER', win: true, reason: msg });
              this.triggerEnd(true, msg);
            } else {
              const msg = 'Time is up! Facility meltdown triggered!';
              Net.broadcast({ type: 'GAMEOVER', win: false, reason: msg });
              this.triggerEnd(false, msg);
            }
          }
        }
      }

      // Monster AI & Realistic Limb Striding Animation
      const isStunned = performance.now() < this.hunter.stunnedUntil;
      if (this.hunter.mesh && this.hunter.limbs) {
        if (isStunned) {
          this.hunter.mesh.position.y = -0.38;
          this.hunter.mesh.rotation.z = (Math.random() - 0.5) * 0.18;
          if (Math.random() > 0.35) {
            const sp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.06), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
            sp.position.set(this.hunter.x + (Math.random() - 0.5), 0.6 + Math.random() * 1.5, this.hunter.z + (Math.random() - 0.5));
            this.scene.add(sp);
            setTimeout(() => this.scene.remove(sp), 100);
          }
        } else {
          // Natural Predator Walking Stride & Body Bob!
          this.hunter.walkCycle += 0.16;
          const swing = Math.sin(this.hunter.walkCycle) * 0.55;
          this.hunter.limbs.legL.rotation.x = swing;
          this.hunter.limbs.legR.rotation.x = -swing;
          this.hunter.limbs.armL.rotation.x = -swing * 0.85 - 0.25;
          this.hunter.limbs.armR.rotation.x = swing * 0.85 - 0.25;
          this.hunter.mesh.position.y = Math.abs(Math.sin(this.hunter.walkCycle)) * 0.09;
          this.hunter.mesh.rotation.z = Math.cos(this.hunter.walkCycle) * 0.05;
        }
        const aura = this.hunter.mesh.children.find(c => c.isPointLight);
        if (aura) aura.color.setHex(isStunned ? 0x38bdf8 : 0xff0000);
      }

      if (Net.isHost && !isStunned) {
        const nowAI = performance.now();
        let target = null, minDist = 999;

        for (const p of Object.values(Net.players)) {
          if (p.downed || p.hiding) continue;
          const d = Math.hypot(p.x - this.hunter.x, p.z - this.hunter.z);
          // Wider sight/hearing range in front of monster, narrower behind
          const angleToPlayer = Math.atan2(p.x - this.hunter.x, p.z - this.hunter.z);
          const angleDiff = Math.abs(Math.atan2(Math.sin(angleToPlayer - this.hunter.yaw), Math.cos(angleToPlayer - this.hunter.yaw)));
          const inFront = angleDiff < 1.25;
          const detectRange = this.level === 3 ? 34 : (p.makingNoise ? 26 : (inFront ? (p.torch ? 18 : 11) : 6.5));
          if (d < detectRange && d < minDist) { minDist = d; target = p; }
        }

        if (target) {
          // STATE 1: CHASE PLAYER & REMEMBER LAST SEEN POSITION
          this.hunter.aiState = 'CHASE';
          this.hunter.goalX = target.x;
          this.hunter.goalZ = target.z;
          this.hunter.investigateUntil = nowAI + 4200;

          const mSpeed = this.level === 3 ? 0.098 : 0.078;
          this.moveHunterToward(target.x, target.z, mSpeed);

          if (minDist < 1.35) {
            target.downed = true;
            this.hunter.aiState = 'PATROL';
            this.pickNextPatrolWaypoint();
            if (target.id === Net.myId) this.triggerJumpscare();
          }
        } else if (nowAI < this.hunter.investigateUntil) {
          // STATE 2: INVESTIGATE LAST KNOWN SPOT (e.g. if player hid in locker or turned corner)
          this.hunter.aiState = 'INVESTIGATE';
          const distToLast = Math.hypot(this.hunter.goalX - this.hunter.x, this.hunter.goalZ - this.hunter.z);
          if (distToLast > 1.4) {
            this.moveHunterToward(this.hunter.goalX, this.hunter.goalZ, 0.068);
          } else {
            // Look left and right suspiciously around the locker/corner
            this.hunter.yaw += Math.sin(nowAI * 0.006) * 0.045;
          }
        } else if (nowAI < this.hunter.scanUntil) {
          // STATE 3: ROOM SCANNING PAUSE
          this.hunter.aiState = 'SCAN';
          this.hunter.yaw += Math.sin(nowAI * 0.004) * 0.03;
        } else {
          // STATE 4: TACTICAL ROOM-TO-ROOM PATROL
          this.hunter.aiState = 'PATROL';
          const distGoal = Math.hypot(this.hunter.goalX - this.hunter.x, this.hunter.goalZ - this.hunter.z);
          if (distGoal < 1.8) {
            this.hunter.scanUntil = nowAI + 1800;
            this.pickNextPatrolWaypoint();
          } else {
            this.moveHunterToward(this.hunter.goalX, this.hunter.goalZ, 0.055);
          }
        }

        // Only trigger Squad Wipe Game Over when EVERY player in the team is downed!
        const allPlayers = Object.values(Net.players);
        if (allPlayers.length > 0 && allPlayers.every(p => p.downed)) {
          const msg = 'Squad wiped! Subject-0 caught everyone.';
          Net.broadcast({ type: 'GAMEOVER', win: false, reason: msg });
          this.triggerEnd(false, msg);
        }
      }

      if (this.hunter.mesh) {
        this.hunter.mesh.position.x = THREE.MathUtils.lerp(this.hunter.mesh.position.x, this.hunter.x, 0.25);
        this.hunter.mesh.position.z = THREE.MathUtils.lerp(this.hunter.mesh.position.z, this.hunter.z, 0.25);
        this.hunter.mesh.rotation.y = this.hunter.yaw;
      }

      const dMonster = Math.hypot(this.hunter.x - me.x, this.hunter.z - me.z);
      if (!isStunned) SFX.monsterStep(dMonster);
      const danger = document.getElementById('danger-overlay');
      if (dMonster < 15 && !me.hiding && !me.downed) {
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
