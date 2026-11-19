window.toggleFullScreen = function() {
  const docEl = document.documentElement;
  if (!document.fullscreenElement) {
    docEl.requestFullscreen?.().catch(() => {});
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
};


const SFX = {
  ctx: null,
  masterGain: null,
  muted: false,
  ambienceStarted: false,
  lastStep: 0,

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.85;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.ambienceStarted && this.ctx) {
      this.startDarkAmbience();
    }
  },

  toggleMute() {
    this.init();
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime, 0.05);
    }
    const btn = document.getElementById('sfx-toggle-btn');
    if (btn) btn.textContent = this.muted ? '🔇 MUTE' : '🔊 SFX';
  },

  startDarkAmbience() {
    if (!this.ctx || this.ambienceStarted) return;
    this.ambienceStarted = true;
    const now = this.ctx.currentTime;

    // 1. Deep Cinematic Sub-Bass Bunker Drone (52Hz + 78Hz Fifth Harmonic)
    const subOsc1 = this.ctx.createOscillator();
    const subOsc2 = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const droneFilter = this.ctx.createBiquadFilter();
    const droneGain = this.ctx.createGain();

    subOsc1.type = 'sine';
    subOsc1.frequency.setValueAtTime(52, now);
    subOsc2.type = 'triangle';
    subOsc2.frequency.setValueAtTime(78, now);

    // Slow breathing modulation so the drone feels alive and eerie
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.14, now);
    lfoGain.gain.setValueAtTime(18, now);
    lfo.connect(lfoGain);
    lfoGain.connect(droneFilter.frequency);

    droneFilter.type = 'lowpass';
    droneFilter.frequency.setValueAtTime(115, now);
    droneGain.gain.setValueAtTime(0.11, now);

    subOsc1.connect(droneFilter);
    subOsc2.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(this.masterGain);

    subOsc1.start(now);
    subOsc2.start(now);
    lfo.start(now);

    // 2. Filtered Cold Air / Ventilation Whisper (Brown/Pink-style smooth noise)
    const bufferSize = this.ctx.sampleRate * 3;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 2.8;
    }

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    noiseSrc.loop = true;

    const airFilter = this.ctx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.frequency.setValueAtTime(220, now);
    airFilter.Q.setValueAtTime(1.8, now);

    const airGain = this.ctx.createGain();
    airGain.gain.setValueAtTime(0.045, now);

    noiseSrc.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(this.masterGain);
    noiseSrc.start(now);

    // 3. Occasional Distant Bunker Metal Creak / Eerie Echo
    setInterval(() => {
      if (this.muted || !this.ctx || document.hidden) return;
      if (Math.random() < 0.45) {
        this.playDistantEcho();
      }
    }, 9500);
  },

  playDistantEcho() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    const baseFreq = 95 + Math.random() * 65;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.62, now + 1.8);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.032, now + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.9);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.95);
  },

  tone(freq, type = 'sine', dur = 0.16, vol = 0.16, endFreq = null) {
    this.init();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    // Soften harsh square/sawtooth waves through a warm lowpass filter
    osc.type = type === 'square' ? 'triangle' : type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol * 0.75, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  },

  step(running = false) {
    const nowMs = performance.now();
    const interval = running ? 295 : 470;
    if (nowMs - this.lastStep < interval) return;
    this.lastStep = nowMs;

    this.init();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    // Realistic Heavy Tactical Boot Thud (Low-frequency membrane punch)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const startF = running ? 115 : 92;
    osc.frequency.setValueAtTime(startF + Math.random() * 12, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.09);

    gain.gain.setValueAtTime(running ? 0.11 : 0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  },

  torchClick() {
    // Crisp mechanical double-click switch sound
    this.tone(1150, 'triangle', 0.035, 0.14, 620);
    setTimeout(() => this.tone(1480, 'sine', 0.03, 0.11, 900), 32);
  },

  stunBlast() {
    // High-voltage electric arc discharge
    this.tone(420, 'sawtooth', 0.28, 0.22, 95);
    this.tone(880, 'triangle', 0.18, 0.15, 210);
  },

  growl() {
    // Deep terrifying Subject-0 sub-bass roar
    this.tone(92, 'sawtooth', 0.75, 0.26, 38);
    setTimeout(() => this.tone(68, 'triangle', 0.65, 0.22, 32), 110);
  },

  siren() {
    // Warm cinematic facility warning klaxon (not piercing!)
    this.tone(440, 'triangle', 0.35, 0.18, 580);
    setTimeout(() => this.tone(580, 'triangle', 0.38, 0.18, 410), 360);
  },

    pickup() {
    this.tone(520, 'sine', 0.14, 0.16, 780);
    setTimeout(() => this.tone(780, 'sine', 0.18, 0.16, 1040), 90);
  },

  lastDrip: 0,
  ambientDrip() {
    const now = performance.now();
    if (now - this.lastDrip < 7500) return;
    this.lastDrip = now;
    if (Math.random() < 0.5) this.tone(980, 'sine', 0.06, 0.04, 1450);
  },

  lastMonsterStep: 0,
  monsterStep(dist) {
    if (dist > 20) return;
    const now = performance.now();
    const gap = Math.max(260, dist * 35);
    if (now - this.lastMonsterStep < gap) return;
    this.lastMonsterStep = now;
    this.tone(72, 'sine', 0.12, Math.min(0.22, (20 - dist) * 0.012), 32);
  },

  lastBeat: 0,
  heartbeat(dist) {
    const now = performance.now();
    const gap = Math.max(320, dist * 55);
    if (now - this.lastBeat < gap) return;
    this.lastBeat = now;
    this.tone(64, 'sine', 0.11, 0.18, 42);
    setTimeout(() => this.tone(58, 'sine', 0.12, 0.14, 38), 130);
  },

  jumpscareScream() {
    this.tone(240, 'sawtooth', 0.55, 0.28, 75);
    this.tone(520, 'triangle', 0.45, 0.22, 140);
  },

  stunZap() {
    this.stunBlast();
  },

  updateHelicopter() {}
};

function makeTexture(kind = 'wall', lvl = 1) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  if (kind === 'floor') {
    ctx.fillStyle = lvl === 3 ? '#1c1917' : (lvl === 2 ? '#06201a' : '#0f172a');
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(148,163,184,0.16)';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 60, 60); ctx.strokeRect(66, 2, 60, 60);
    ctx.strokeRect(2, 66, 60, 60); ctx.strokeRect(66, 66, 60, 60);
  } else if (kind === 'ceil') {
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 58, 128, 12);
  } else {
    ctx.fillStyle = lvl === 3 ? '#292524' : (lvl === 2 ? '#0f2922' : '#1e293b');
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = lvl === 3 ? '#ea580c' : (lvl === 2 ? '#22c55e' : '#eab308');
    ctx.fillRect(0, 96, 128, 8);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
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

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.34), suitMat);
  torso.position.y = 1.12;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat);
  head.position.y = 1.76;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.06), visorMat);
  visor.position.set(0, 1.78, -0.21);

  const leftLegPivot = new THREE.Group(); leftLegPivot.position.set(-0.16, 0.72, 0);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.22), darkMat); legL.position.y = -0.36;
  leftLegPivot.add(legL);

  const rightLegPivot = new THREE.Group(); rightLegPivot.position.set(0.16, 0.72, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.22), darkMat); legR.position.y = -0.36;
  rightLegPivot.add(legR);

  const leftArmPivot = new THREE.Group(); leftArmPivot.position.set(-0.42, 1.46, 0);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.18), suitMat); armL.position.y = -0.33;
  leftArmPivot.add(armL);

  const rightArmPivot = new THREE.Group(); rightArmPivot.position.set(0.42, 1.46, 0);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.18), suitMat); armR.position.y = -0.33;
  rightArmPivot.add(armR);

  grp.add(torso, head, visor, leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot);
  return { grp, limbs: { leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot } };
}

const Lobby3D = {
  localPos: { x: 0, z: 3.8 },
  init() {},
  syncSquad() {}
};
window.Lobby3D = Lobby3D;

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
  hunter: { x: 32, z: -32, yaw: 0, mesh: null, limbs: null, walkCycle: 0, stunnedUntil: 0, stuckFrames: 0, aiState: 'PATROL', goalX: 28, goalZ: 24, scanUntil: 0, investigateUntil: 0 },
  level: 1,
  battery: 100,
  stamina: 100,
  sanity: 100,
  crouching: false,
  inCCTV: false,
  cctvIdx: 0,
  flares: [],
  activePing: null,
  sensorRevealUntil: 0,
  lastHallucination: 0,
  sanity: 100,
  crouching: false,
  inCCTV: false,
  cctvIdx: 0,
  flares: [],
  activePing: null,
  sensorRevealUntil: 0,
  lastHallucination: 0,
  nvgActive: false,
  skillCooldownUntil: 0,
  scoutBuffUntil: 0,
  empUntil: 0,
  decoyPos: null,
  decoyUntil: 0,
  bioSamples: [],
  samplesCollected: 0,
  blastSwitches: [],
  switchesActivated: 0,
  intelBoxes: [],
  agentXP: parseInt(localStorage.getItem('sb_agent_xp') || '0', 10),
  matchStartTime: 0,
  lastHeartbeat: 0,
  stunCharges: 2,
  hasFuse: false,
  powerRestored: false,
  drivesCollected: 0,
  drivesUploaded: false,
  dataDrives: [],
  serverMesh: null,
  keycardsCollected: 0,
  reactorUnlocked: false,
  keycards: [],
  reactorSwitchMesh: null,
  fuseMesh: null,
  genMesh: null,
  exitMesh: null,
  exitBeacon: null,
  exitPos: { x: 20, z: -21.7 },
  lockers: [],
  notes: [],
  terminals: [],
  valves: [],
  pickups: [],
  lasers: [],
  lastLaserAlert: 0,
  chopperGroup: null,
  chopperRotor: null,
  heliLanded: false,
  heliTakeoff: false,
  heliTakeoffStart: 0,
  inCutscene: false,
  cutsceneTimer: null,
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
        playerPos: me ? { x: me.x, z: me.z } : { x: -32, z: 32 },
        savedAt: Date.now()
      };
      localStorage.setItem('sb_checkpoint_v1', JSON.stringify(state));
    } catch (e) {}
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
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
        screen.orientation?.lock?.('landscape').catch(() => {});
      }
    } catch (e) {}
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

  playCutscene(lvl, onFinish) {
    this.inCutscene = false;
    const hud = document.getElementById('hud');
    if (hud) hud.classList.remove('hidden');
    const ov = document.getElementById('cutscene-overlay');
    if (ov) { ov.classList.add('hidden'); ov.style.display = 'none'; }
    this.levelStartGrace = performance.now() + 4000;
    this.showRadioToast('SECTOR-09', lvl === 1 ? '🎬 Mission Start: Find Blue Power Fuse & Restore Generator!' : ('🎬 Level ' + lvl + ' Started!'));
    if (onFinish) onFinish();
    return;
    const chapEl = document.getElementById('cutscene-chapter');
    const spkEl = document.getElementById('cutscene-speaker');
    const subEl = document.getElementById('cutscene-subtitle');
    const skipBtn = document.getElementById('skip-cutscene-btn');

    if (hud) hud.classList.add('hidden');
    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.style.display = 'flex';
    }

    const scripts = {
      1: [
        { t: 0, chap: '🎬 PROLOGUE: PROJECT TITAN (2029)', spk: '📡 HQ COMMAND', sub: 'Sector-09 research bunker went dark 2 hours ago. Dr. Verma is missing.', cam: [-32, 3.2, 34], look: [-34, 1.2, 34] },
        { t: 2800, chap: '🎬 LEVEL 1: THE DEAD LAB', spk: '📡 HQ COMMAND', sub: 'Restore the Main Generator, upload 3 Purple Data Drives to North Server & unlock 3 Terminals.', cam: [0, 3.6, -24], look: [0, 1.2, -34] },
        { t: 5600, chap: '⚠️ THREAT DETECTED: SUBJECT-0', spk: '🎙️ DR. VERMA (RECORDING)', sub: 'It hunts flashlight beams and sprinting footsteps... Hide in Green Lockers to survive!', cam: [26, 2.8, -24], look: [32, 1.4, -32] }
      ],
      2: [
        { t: 0, chap: '🎬 LEVEL 2: BIO-REACTOR MELTDOWN', spk: '🚨 BUNKER AI', sub: 'Core temperature critical! Find 2 Golden Keycards, unlock South Switch & seal 6 Coolant Valves!', cam: [0, 4.5, 16], look: [0, 2.0, 0] },
        { t: 3200, chap: '⚠️ SUBJECT-0 APPROACHING', spk: '📡 HQ COMMAND', sub: 'Watch out for red Laser Tripwires—tripping them alerts Subject-0 immediately!', cam: [-24, 3.0, 24], look: [-31, 1.4, 31] }
      ],
      3: [
        { t: 0, chap: '🎬 FINAL LEVEL: ROOFTOP EXTRACTION', spk: '🚁 RESCUE PILOT', sub: 'Chopper inbound to Helipad H! Hold the rooftop for 52 seconds until landing!', cam: [14, 5.5, 14], look: [0, 1.2, 0] },
        { t: 3000, chap: '⚠️ FINAL STAND', spk: '📡 HQ COMMAND', sub: 'Subject-0 climbed the elevator shaft! Survive until the chopper lands and press [USE] to board!', cam: [24, 3.2, -24], look: [32, 1.4, -32] }
      ]
    };

    const shots = scripts[lvl] || scripts[1];
    const totalDur = lvl === 1 ? 8200 : 5800;
    this.cutsceneShots = shots;
    this.cutsceneStart = performance.now();

    const applyShot = (s) => {
      if (chapEl) chapEl.textContent = s.chap;
      if (spkEl) spkEl.textContent = s.spk;
      if (subEl) subEl.textContent = s.sub;
      if (typeof SFX !== 'undefined' && SFX.tone) SFX.tone(520, 'sine', 0.12, 0.18, 680);
    };
    applyShot(shots[0]);

    const timers = shots.slice(1).map(s => setTimeout(() => { if (this.inCutscene) applyShot(s); }, s.t));

    const finishCutscene = () => {
      if (!this.inCutscene) return;
      this.inCutscene = false;
      timers.forEach(clearTimeout);
      if (this.cutsceneTimer) clearTimeout(this.cutsceneTimer);
      if (overlay) {
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
      }
      if (hud) hud.classList.remove('hidden');
      this.levelStartGrace = performance.now() + 4000;
      if (onFinish) onFinish();
    };

    if (skipBtn) skipBtn.onclick = finishCutscene;
    this.cutsceneTimer = setTimeout(finishCutscene, totalDur);
  },

  start(codes, noteSpots, fuseSpot) {
    this.codes = codes;
    this.savedNoteSpots = noteSpots;
    this.savedFuseSpot = fuseSpot;
    document.getElementById('menu-screen')?.classList.add('hidden');
    document.getElementById('lobby-screen')?.classList.add('hidden');
    document.getElementById('game-screen')?.classList.remove('hidden');
    if (typeof SFX !== 'undefined') SFX.init();
    this.init3D(noteSpots, fuseSpot);
    return;

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
      this.stunCharges = 2;
      document.getElementById('stun-status').textContent = '🔫 2/2';
    }

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 90);
    this.camera.rotation.order = 'YXZ';

    const container = document.getElementById('three-container');
    container.innerHTML = '';
    container.style.position = 'absolute';
    container.style.inset = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = '1';
    container.style.position = 'absolute';
    container.style.inset = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = '1';
    const hudEl = document.getElementById('hud');
    if (hudEl) { hudEl.classList.remove('hidden'); hudEl.style.display = 'block'; }
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(this.renderer.domElement);

    this.hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x334155, 1.35);
    this.scene.add(this.hemiLight);

    this.flashlight = new THREE.SpotLight(0xfffbeb, 7.5, 36, Math.PI / 4.0, 0.32, 0.95);
    this.flashlight.position.set(0, 0, 0);
    this.flashlight.target.position.set(0, 0, -1);
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlight.target);

    // Prominent First-Person Tactical Hands, Flashlight & Electric Stun Gun
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

    // Full 3D Spec-Ops Self-Character Body (for 3rd-Person Mode)
    this.selfAvatar = this.createTeammateAvatar(me || { name: 'YOU', role: myRole });
    this.selfAvatar.grp.visible = false;

    this.scene.add(this.camera);

    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);

    this.levelStartGrace = performance.now() + 5000;
    const initSpawns = [{ x: -32, z: 32 }, { x: -30, z: 32 }, { x: -32, z: 30 }, { x: -30, z: 30 }];
    Object.values(Net.players).forEach((p, idx) => { const sp = initSpawns[idx % 4]; p.x = sp.x; p.z = sp.z; });
    this.buildLevelMap(1, noteSpots, fuseSpot);
    this.buildMonster();
    this.setupControls();

    const syncViewport = () => {
      if (!this.renderer || !this.camera) return;
      const w = Math.max(300, window.innerWidth);
      const h = Math.max(200, window.innerHeight);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    syncViewport();
    window.addEventListener('resize', syncViewport);

    if (!this.animStarted) {
      this.animStarted = true;
      this.matchStartTime = performance.now();
    if (window.AgentProfile) AgentProfile.recordMatchStart();
    this.updateRankUI();
    this.animate();
      this.playCutscene(1, () => {
        if (window.innerWidth > 900) {
          this.showRadioToast('PC CONTROLS', '🖱️ Click screen for Mouse Look • WASD Move • Shift Run • E Use • F Torch • Q/Right-Click Stun • V Cam • M Mic • 1-4 Radio');
        }
      });
      if (false) {
        this.showRadioToast('PC CONTROLS', '🖱️ Click screen for Mouse Look • WASD Move • Shift Run • E Use • F Torch • Q/Right-Click Stun • V Cam • M Mic • 1-4 Radio');
      }
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
    this.dataDrives = [];
    this.keycards = [];
    this.bioSamples = [];
    this.blastSwitches = [];
    this.intelBoxes = [];
    this.flares = [];
    this.cctvConsoles = [];
    this.flares = [];
    this.cctvConsoles = [];
    this.pickups = [];
    this.lasers = [];
    this.exitBeacon = null;
    this.chopperGroup = null;
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
    this.exitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 3.3, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x0f172a })
    );
    this.exitMesh.position.set(x, 1.65, z);
    this.mapGroup.add(this.exitMesh);

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

  addLaserGrid(x, z, w, d) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.08, d),
      new THREE.MeshBasicMaterial({ color: 0xff0033, transparent: true, opacity: 0.78 })
    );
    mesh.position.set(x, 1.05, z);
    const glow = new THREE.PointLight(0xff0033, 1.4, 5);
    glow.position.set(x, 1.2, z);
    this.mapGroup.add(mesh, glow);
    this.lasers.push({ minX: x - w / 2 - 0.25, maxX: x + w / 2 + 0.25, minZ: z - d / 2 - 0.25, maxZ: z + d / 2 + 0.25 });
  },

  buildLevelMap(lvl, noteSpots = this.savedNoteSpots || [{ x: -30, z: -28 }, { x: 4, z: 28 }, { x: 30, z: 8 }], fuseSpot = this.savedFuseSpot || { x: -28, z: -6 }) {
    this.clearMap();
    this.level = lvl;
    this.configureMonsterVariant(lvl);
    // Add Live CCTV Security Monitor Desk near spawn corridor
    const cctvDesk = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 1.1, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x22c55e, emissiveIntensity: 0.65 })
    );
    cctvDesk.position.set(-24, 0.55, 34);
    this.mapGroup.add(cctvDesk);
    this.cctvConsoles.push({ x: -24, z: 34, mesh: cctvDesk });


    const floorTex = makeTexture('floor', lvl);
    floorTex.repeat.set(22, 22);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 }));
    floor.rotation.x = -Math.PI / 2;
    this.mapGroup.add(floor);

    const wallTex = makeTexture('wall', lvl);
    const wallHeight = lvl === 5 ? 2.0 : 4.2;
    this.addWall(0, -40, 80, 1.2, wallTex, wallHeight);
    this.addWall(0, 40, 80, 1.2, wallTex, wallHeight);
    this.addWall(-40, 0, 1.2, 80, wallTex, wallHeight);
    this.addWall(40, 0, 1.2, 80, wallTex, wallHeight);

    // Add 2 Bonus Secret Intel Briefcases in every level for extra XP!
    const intelCandidates = [
      { x: -34, z: -34 }, { x: 34, z: 34 }, { x: -22, z: 6 }, { x: 22, z: -14 }, { x: 0, z: 22 }
    ].sort(() => Math.random() - 0.5);
    [intelCandidates[0], intelCandidates[1]].forEach((ic, idx) => {
      const bMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.25, 0.45),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 1.4 })
      );
      bMesh.position.set(ic.x, 0.9, ic.z);
      this.mapGroup.add(bMesh);
      this.intelBoxes.push({ x: ic.x, z: ic.z, idx, taken: false, mesh: bMesh });
    });

    if (lvl === 1) {
      this.scene.background = new THREE.Color(0x020408);
      this.scene.fog = new THREE.FogExp2(0x0f172a, 0.014);
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: makeTexture('ceil'), side: THREE.DoubleSide }));
      ceil.rotation.x = Math.PI / 2; ceil.position.y = 4.2;
      this.mapGroup.add(ceil);

      this.addWall(-16, 18, 22, 0.9, wallTex);
      this.addWall(16, 18, 22, 0.9, wallTex);
      this.addWall(-18, -10, 0.9, 24, wallTex);
      this.addWall(14, -12, 24, 0.9, wallTex);
      this.addWall(24, 4, 0.9, 20, wallTex);
      this.addWall(-4, -26, 20, 0.9, wallTex);
      this.addWall(0, 2, 12, 0.9, wallTex);

      this.addSafeLockers([
        { x: -34, z: 24 }, { x: -34, z: 4 }, { x: -8, z: 12 }, { x: 8, z: 12 },
        { x: 18, z: -20 }, { x: 34, z: 22 }, { x: -12, z: -32 }, { x: 34, z: -8 }
      ]);

      this.fuseMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.75, 12),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.5 })
      );
      this.fuseMesh.position.set(fuseSpot.x, 0.95, fuseSpot.z);
      const fuseLight = new THREE.PointLight(0x38bdf8, 2.2, 8);
      fuseLight.position.set(fuseSpot.x, 1.3, fuseSpot.z);
      this.mapGroup.add(this.fuseMesh, fuseLight);

      this.genMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 1.9, 1.3),
        new THREE.MeshStandardMaterial({ color: 0x991b1b, emissive: 0xdc2626, emissiveIntensity: 0.9 })
      );
      this.genMesh.position.set(-34, 0.95, 34);
      this.mapGroup.add(this.genMesh);

      const drivePool = [
        { x: -32, z: -20 }, { x: 6, z: -6 }, { x: 32, z: 28 },
        { x: -14, z: 28 }, { x: 28, z: -26 }, { x: -26, z: 6 }
      ].sort(() => Math.random() - 0.5);
      [drivePool[0], drivePool[1], drivePool[2]].forEach((ds, idx) => {
        const dMesh = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.36, 0),
          new THREE.MeshStandardMaterial({ color: 0xc084fc, emissive: 0x9333ea, emissiveIntensity: 1.4 })
        );
        dMesh.position.set(ds.x, 1.0, ds.z);
        const dLight = new THREE.PointLight(0xc084fc, 1.6, 6);
        dLight.position.set(ds.x, 1.3, ds.z);
        this.mapGroup.add(dMesh, dLight);
        this.dataDrives.push({ x: ds.x, z: ds.z, idx, taken: false, mesh: dMesh, light: dLight });
      });

      this.serverMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 2.0, 1.1),
        new THREE.MeshStandardMaterial({ color: 0x581c87, emissive: 0x7e22ce, emissiveIntensity: 0.85 })
      );
      this.serverMesh.position.set(0, 1.0, -34);
      this.mapGroup.add(this.serverMesh);

      const logTexts = [
        'Dr. Verma Log #1: Subject-0 hunts light & sprinting footsteps. Terminal #1 code:',
        'Dr. Verma Log #2: Upload all 3 Data Drives at North Server first! Terminal #2 code:',
        'Dr. Verma Log #3: Final override code for Terminal #3 before Medical Quarantine:'
      ];
      noteSpots.forEach((spot, idx) => {
        const stand = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.85, 1.0), new THREE.MeshStandardMaterial({ map: wallTex }));
        stand.position.set(spot.x, 0.425, spot.z);
        const paper = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.6), new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 0.85 }));
        paper.position.set(spot.x, 0.88, spot.z);
        this.mapGroup.add(stand, paper);
        this.notes.push({ x: spot.x, z: spot.z, idx, text: logTexts[idx] });
      });

      const termSpots = [{ x: -10, z: 35 }, { x: 18, z: 35 }, { x: 35, z: -6 }];
      termSpots.forEach((spot, idx) => {
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.7, 0.9), new THREE.MeshStandardMaterial({ color: 0xb91c1c, emissive: 0xef4444, emissiveIntensity: 0.7 }));
        box.position.set(spot.x, 0.85, spot.z);
        this.mapGroup.add(box);
        this.terminals.push({ x: spot.x, z: spot.z, idx, mesh: box });
      });

      this.addLaserGrid(-2, 18, 5.0, 0.12);
      this.addLaserGrid(24, -18, 0.12, 7.0);
      this.createExitDoorWithBeacon(34, -39.2);

    } else if (lvl === 2) {
      // LEVEL 2: MEDICAL QUARANTINE WING (4 Bio-Containment Samples)
      this.scene.background = new THREE.Color(0x020a08);
      this.scene.fog = new THREE.FogExp2(0x0f172a, 0.014);
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: makeTexture('ceil'), side: THREE.DoubleSide }));
      ceil.rotation.x = Math.PI / 2; ceil.position.y = 4.2;
      this.mapGroup.add(ceil);

      this.addWall(-18, 16, 18, 0.9, wallTex);
      this.addWall(18, 16, 18, 0.9, wallTex);
      this.addWall(-18, -16, 18, 0.9, wallTex);
      this.addWall(18, -16, 18, 0.9, wallTex);
      this.addWall(0, 0, 0.9, 22, wallTex);

      this.addSafeLockers([
        { x: -34, z: 0 }, { x: 34, z: 0 }, { x: -10, z: 28 }, { x: 10, z: -28 }, { x: -28, z: -28 }, { x: 28, z: 28 }
      ]);

      const sampleSpots = [
        { x: -30, z: -26 }, { x: 30, z: -26 }, { x: 30, z: 26 }, { x: -12, z: 6 }
      ];
      sampleSpots.forEach((ss, idx) => {
        const vial = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.28, 0.85, 14),
          new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x22c55e, emissiveIntensity: 1.5 })
        );
        vial.position.set(ss.x, 1.0, ss.z);
        const sLight = new THREE.PointLight(0x22c55e, 1.8, 7);
        sLight.position.set(ss.x, 1.4, ss.z);
        this.mapGroup.add(vial, sLight);
        this.bioSamples.push({ x: ss.x, z: ss.z, idx, taken: false, mesh: vial, light: sLight });
      });

      this.addLaserGrid(-18, 0, 7.0, 0.12);
      this.addLaserGrid(18, 0, 7.0, 0.12);
      this.createExitDoorWithBeacon(0, -39.2);

    } else if (lvl === 3) {
      // LEVEL 3: BIO-REACTOR CORE (2 Golden Keycards + South Switch + 6 Coolant Valves)
      this.scene.background = new THREE.Color(0x090203);
      this.scene.fog = new THREE.FogExp2(0x0f172a, 0.014);
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: makeTexture('ceil'), side: THREE.DoubleSide }));
      ceil.rotation.x = Math.PI / 2; ceil.position.y = 4.2;
      this.mapGroup.add(ceil);

      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(3.2, 3.2, 4.2, 24),
        new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 1.3, transparent: true, opacity: 0.85 })
      );
      core.position.set(0, 2.1, 0);
      const coreLight = new THREE.PointLight(0xf97316, 4.5, 32);
      coreLight.position.set(0, 2.4, 0);
      this.mapGroup.add(core, coreLight);
      this.wallBoxes.push({ minX: -3.4, maxX: 3.4, minZ: -3.4, maxZ: 3.4 });

      const pillars = [
        { x: -16, z: -16 }, { x: 16, z: -16 }, { x: -16, z: 16 }, { x: 16, z: 16 },
        { x: 0, z: -24 }, { x: 0, z: 24 }, { x: -24, z: 0 }, { x: 24, z: 0 }
      ];
      pillars.forEach(p => this.addWall(p.x, p.z, 3.2, 3.2, wallTex));

      this.addSafeLockers([
        { x: -35, z: -12 }, { x: -35, z: 12 }, { x: 35, z: -12 }, { x: 35, z: 12 }, { x: -12, z: -35 }, { x: 12, z: 35 }
      ]);

      const cardPool = [{ x: -28, z: 28 }, { x: 28, z: -28 }, { x: -28, z: -24 }, { x: 26, z: 26 }].sort(() => Math.random() - 0.5);
      [cardPool[0], cardPool[1]].forEach((cs, idx) => {
        const kMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.35, 0.08),
          new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 1.5 })
        );
        kMesh.position.set(cs.x, 1.05, cs.z);
        const kLight = new THREE.PointLight(0xfacc15, 1.8, 6);
        kLight.position.set(cs.x, 1.3, cs.z);
        this.mapGroup.add(kMesh, kLight);
        this.keycards.push({ x: cs.x, z: cs.z, idx, taken: false, mesh: kMesh, light: kLight });
      });

      this.reactorSwitchMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 1.8, 1.1),
        new THREE.MeshStandardMaterial({ color: 0xb45309, emissive: 0xf59e0b, emissiveIntensity: 0.9 })
      );
      this.reactorSwitchMesh.position.set(0, 0.9, 34);
      this.mapGroup.add(this.reactorSwitchMesh);

      this.addLaserGrid(-16, 0, 6.5, 0.12);
      this.addLaserGrid(16, 0, 6.5, 0.12);
      const valveSpots = [
        { x: -31, z: -31 }, { x: 31, z: -31 }, { x: -31, z: 31 },
        { x: 31, z: 31 }, { x: -31, z: 0 }, { x: 31, z: 0 }
      ];
      valveSpots.forEach((vs, idx) => {
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 1.35, 14), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 }));
        stand.position.set(vs.x, 0.675, vs.z);
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.1, 10, 20), new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.95 }));
        wheel.position.set(vs.x, 1.5, vs.z);
        const vLight = new THREE.PointLight(0xef4444, 1.8, 8);
        vLight.position.set(vs.x, 2.1, vs.z);
        this.mapGroup.add(stand, wheel, vLight);
        this.valves.push({ x: vs.x, z: vs.z, idx, fixed: false, wheel, light: vLight });
      });

      this.createExitDoorWithBeacon(0, -39.2);

    } else if (lvl === 4) {
      // LEVEL 4: FLOODED COMMAND TUNNEL (4 Blast Override Switches)
      this.scene.background = new THREE.Color(0x040712);
      this.scene.fog = new THREE.FogExp2(0x0f172a, 0.014);
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: makeTexture('ceil'), side: THREE.DoubleSide }));
      ceil.rotation.x = Math.PI / 2; ceil.position.y = 4.2;
      this.mapGroup.add(ceil);

      this.addWall(-14, 22, 24, 0.9, wallTex);
      this.addWall(14, 10, 24, 0.9, wallTex);
      this.addWall(-14, -6, 24, 0.9, wallTex);
      this.addWall(14, -22, 24, 0.9, wallTex);

      this.addSafeLockers([
        { x: -34, z: 14 }, { x: 34, z: 2 }, { x: -34, z: -14 }, { x: 34, z: -30 }, { x: 0, z: 32 }
      ]);

      const swSpots = [
        { x: -28, z: 14 }, { x: 28, z: 2 }, { x: -28, z: -14 }, { x: 28, z: -28 }
      ];
      swSpots.forEach((sw, idx) => {
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 1.7, 0.8),
          new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x38bdf8, emissiveIntensity: 1.0 })
        );
        box.position.set(sw.x, 0.85, sw.z);
        this.mapGroup.add(box);
        this.blastSwitches.push({ x: sw.x, z: sw.z, idx, active: false, mesh: box });
      });

      this.addLaserGrid(0, 16, 0.12, 8.0);
      this.addLaserGrid(0, -14, 0.12, 8.0);
      this.createExitDoorWithBeacon(-32, -39.2);

    } else if (lvl === 5) {
      // LEVEL 5: ROOFTOP HELIPAD EXTRACTION
      this.scene.background = new THREE.Color(0x060b16);
      this.scene.fog = new THREE.FogExp2(0x0f172a, 0.014);

      const padOuter = new THREE.Mesh(new THREE.RingGeometry(4.8, 5.6, 36), new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide }));
      padOuter.rotation.x = -Math.PI / 2; padOuter.position.y = 0.03;
      const hBar1 = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 3.8), new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide }));
      hBar1.rotation.x = -Math.PI / 2; hBar1.position.set(-1.15, 0.03, 0);
      const hBar2 = hBar1.clone(); hBar2.position.set(1.15, 0.03, 0);
      const hCross = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.75), new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide }));
      hCross.rotation.x = -Math.PI / 2; hCross.position.set(0, 0.03, 0);
      const heliLight = new THREE.PointLight(0x38bdf8, 4.0, 42);
      heliLight.position.set(0, 7, 0);
      this.mapGroup.add(padOuter, hBar1, hBar2, hCross, heliLight);

      const crates = [
        { x: -14, z: -14 }, { x: 14, z: -14 }, { x: -14, z: 14 }, { x: 14, z: 14 },
        { x: -24, z: 0 }, { x: 24, z: 0 }, { x: 0, z: -24 }, { x: 0, z: 24 }
      ];
      crates.forEach(c => this.addWall(c.x, c.z, 3.2, 3.2, wallTex, 2.3));
      this.addSafeLockers([{ x: -32, z: -32 }, { x: 32, z: 32 }, { x: -32, z: 32 }, { x: 32, z: -32 }]);

      this.heliLanded = false;
      this.heliTakeoff = false;
      const heli = new THREE.Group();
      const hullMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.35 });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85 });
      const glassMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

      const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.5, 4.4), hullMat); body.position.y = 1.25;
      const nose = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.15, 1.4), glassMat); nose.position.set(0, 1.15, -2.35);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.55, 3.4), hullMat); tail.position.set(0, 1.45, 3.5);
      const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 0.75), darkMat); tailFin.position.set(0, 1.9, 4.9);
      const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 4.0), darkMat); skidL.position.set(-1.1, 0.08, -0.2);
      const skidR = skidL.clone(); skidR.position.x = 1.1;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.45, 10), darkMat); mast.position.set(0, 2.15, 0);
      const rotor = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.08, 0.36), new THREE.MeshBasicMaterial({ color: 0x38bdf8 })); rotor.position.set(0, 2.38, 0);
      const searchLight = new THREE.PointLight(0xfacc15, 5.5, 28); searchLight.position.set(0, 0.5, 0);

      heli.add(body, nose, tail, tailFin, skidL, skidR, mast, rotor, searchLight);
      heli.position.set(0, 22, 0);
      this.mapGroup.add(heli);
      this.chopperGroup = heli;
      this.chopperRotor = rotor;
    }

    const pickupSpots = [
      { x: -24, z: 22, kind: 'BATTERY' }, { x: 26, z: -18, kind: 'BATTERY' }, { x: 0, z: 10, kind: 'BATTERY' },
      { x: -20, z: -28, kind: 'STUN' }, { x: 24, z: 26, kind: 'STUN' }, { x: -10, z: 20, kind: 'STUN' }
    ];
    pickupSpots.forEach(ps => {
      const isBat = ps.kind === 'BATTERY';
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshStandardMaterial({ color: isBat ? 0x22c55e : 0xc084fc, emissive: isBat ? 0x16a34a : 0x9333ea, emissiveIntensity: 1.2 })
      );
      mesh.position.set(ps.x, 0.65, ps.z);
      this.mapGroup.add(mesh);
      this.pickups.push({ ...ps, mesh, taken: false });
    });

    [
      { x: -24, z: 24 }, { x: 24, z: 24 }, { x: -24, z: -24 }, { x: 24, z: -24 }
    ].forEach(lc => {
      const pLight = new THREE.PointLight(lvl === 3 ? 0xfb923c : 0x64748b, lvl === 5 ? 0.55 : 0.14, 18);
      pLight.position.set(lc.x, 3.6, lc.z);
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
        this.animateCharacterLimbs(tm, moved);
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

  pickNextPatrolWaypoint() {
    const waypoints = this.level === 2
      ? [
          { x: -30, z: -30 }, { x: 30, z: -30 }, { x: -30, z: 30 }, { x: 30, z: 30 },
          { x: 0, z: -32 }, { x: 0, z: 32 }, { x: -32, z: 0 }, { x: 32, z: 0 }
        ]
      : [
          { x: -30, z: 30 }, { x: -30, z: -30 }, { x: 30, z: -30 }, { x: 30, z: 30 },
          { x: 0, z: 28 }, { x: 0, z: -24 }, { x: -26, z: 4 }, { x: 26, z: 4 }
        ];
    const choices = waypoints.filter(w => Math.hypot(w.x - this.hunter.x, w.z - this.hunter.z) > 6);
    const next = choices[Math.floor(Math.random() * choices.length)] || waypoints[0];
    this.hunter.goalX = next.x;
    this.hunter.goalZ = next.z;
  },

  moveHunterToward(tx, tz, speed) {
    let ang = Math.atan2(tx - this.hunter.x, tz - this.hunter.z);
    const lookAhead = 1.35;
    const frontBlocked = this.checkCollision(this.hunter.x + Math.sin(ang) * lookAhead, this.hunter.z + Math.cos(ang) * lookAhead);
    if (frontBlocked) {
      const leftFree = !this.checkCollision(this.hunter.x + Math.sin(ang + 0.75) * lookAhead, this.hunter.z + Math.cos(ang + 0.75) * lookAhead);
      const rightFree = !this.checkCollision(this.hunter.x + Math.sin(ang - 0.75) * lookAhead, this.hunter.z + Math.cos(ang - 0.75) * lookAhead);
      if (leftFree) ang += 0.85;
      else if (rightFree) ang -= 0.85;
      else ang += Math.PI * 0.65;
    }

    this.hunter.yaw = ang;
    const prevX = this.hunter.x, prevZ = this.hunter.z;
    const nx = this.hunter.x + Math.sin(ang) * speed;
    const nz = this.hunter.z + Math.cos(ang) * speed;
    if (!this.checkCollision(nx, this.hunter.z)) this.hunter.x = nx;
    if (!this.checkCollision(this.hunter.x, nz)) this.hunter.z = nz;

    if (Math.hypot(this.hunter.x - prevX, this.hunter.z - prevZ) < 0.008) {
      this.hunter.stuckFrames++;
      if (this.hunter.stuckFrames > 30) {
        this.pickNextPatrolWaypoint();
        this.hunter.stuckFrames = 0;
      }
    } else {
      this.hunter.stuckFrames = 0;
    }
  },

  buildMonster() {
    const grp = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.3 });
    const clawMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.4 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.3, 0.48), skin);
    torso.position.y = 1.48;
    torso.rotation.x = 0.22;

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.54, 0.54), skin);
    head.position.set(0, 2.34, 0.16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), eyeMat);
    eyeL.position.set(-0.14, 2.38, 0.43);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.14;

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
      if (document.activeElement && ['INPUT', 'SELECT'].includes(document.activeElement.tagName)) return;
      this.keys[e.code] = true;
      if (e.code === 'KeyF') this.toggleTorch();
      if (e.code === 'KeyE' || e.code === 'Enter') this.interact();
      if (e.code === 'KeyQ') this.fireStun();
      if (e.code === 'KeyV') document.getElementById('cam-toggle-btn')?.click();
      if (e.code === 'KeyM') Net.toggleMic();
      if (e.code === 'KeyC' || e.code === 'Escape') {
        document.getElementById('note-modal')?.classList.add('hidden');
        document.getElementById('puzzle-modal')?.classList.add('hidden');
      }
      if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
        const idx = Number(e.code.replace('Digit', '')) - 1;
        document.querySelectorAll('.radio-btn')[idx]?.click();
      }
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
          me.yaw -= (t.clientX - lastTouchX) * 0.0068;
          this.camera.rotation.x = Math.max(-0.9, Math.min(0.9, this.camera.rotation.x - (t.clientY - lastTouchY) * 0.0045));
          lastTouchX = t.clientX;
          lastTouchY = t.clientY;
        }
      }
    }, { passive: true });
    const endLookTouch = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === lookTouchId) lookTouchId = null;
      }
    };
    lookZone.addEventListener('touchend', endLookTouch, { passive: true });
    lookZone.addEventListener('touchcancel', endLookTouch, { passive: true });

    // PC Mouse Look (Pointer Lock + Drag fallback) & Right-Click Stun
    let pcMouseDown = false;
    lookZone.addEventListener('mousedown', (e) => {
      if (e.button === 2) { this.fireStun(); return; }
      pcMouseDown = true;
      const modalOpen = !document.getElementById('note-modal').classList.contains('hidden') ||
                        !document.getElementById('puzzle-modal').classList.contains('hidden') ||
                        !document.getElementById('end-modal').classList.contains('hidden');
      if (!modalOpen && document.pointerLockElement !== lookZone && lookZone.requestPointerLock) {
        lookZone.requestPointerLock().catch?.(() => {});
      }
    });
    lookZone.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mouseup', () => { pcMouseDown = false; });
    window.addEventListener('mousemove', (e) => {
      const me = Net.players[Net.myId];
      if (!me || this.gameOver) return;
      if (document.pointerLockElement === lookZone || pcMouseDown) {
        me.yaw -= e.movementX * 0.0026;
        this.camera.rotation.x = Math.max(-0.95, Math.min(0.95, this.camera.rotation.x - e.movementY * 0.0022));
      }
    });

    // True 4-Finger Multi-Touch Joystick (locked to touch.identifier)
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
      e.preventDefault();
      e.stopPropagation();
      if (joyTouchId !== null) return;
      const t = e.changedTouches[0];
      joyTouchId = t.identifier;
      this.joy.active = true;
      updateJoyStick(t);
    }, { passive: false });
    joyZone.addEventListener('touchmove', (e) => {
      if (!this.joy.active || joyTouchId === null) return;
      e.preventDefault();
      e.stopPropagation();
      for (const t of e.changedTouches) {
        if (t.identifier === joyTouchId) updateJoyStick(t);
      }
    }, { passive: false });
    const resetJoy = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyTouchId) {
          joyTouchId = null;
          this.joy.active = false;
          this.joy.dx = 0;
          this.joy.dy = 0;
          stick.style.transform = 'translate(0,0)';
        }
      }
    };
    joyZone.addEventListener('touchend', resetJoy);
    joyZone.addEventListener('touchcancel', resetJoy);

    // 0ms Instant Multi-Touch Action Buttons (works simultaneously while holding Joystick + Sprint!)
    const bindInstantTouch = (id, fn) => {
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
      el.onclick = () => {
        const now = performance.now();
        if (now - lastFire < 250) return;
        lastFire = now;
        fn();
      };
    };

    bindInstantTouch('torch-btn', () => this.toggleTorch());
    bindInstantTouch('use-btn', () => this.interact());
    bindInstantTouch('interact-btn', () => this.interact());
    bindInstantTouch('stun-btn', () => this.fireStun());
    bindInstantTouch('cam-toggle-btn', () => {
      this.thirdPerson = !this.thirdPerson;
      document.getElementById('cam-toggle-btn').textContent = this.thirdPerson ? '🎥 3RD' : '🎥 1ST';
    });
    bindInstantTouch('mic-btn', () => Net.toggleMic());
    bindInstantTouch('nvg-toggle-btn', () => this.toggleNightVision());
    bindInstantTouch('crouch-btn', () => this.toggleCrouch());
    bindInstantTouch('ping-btn', () => this.sendTacticalPing());
    bindInstantTouch('flare-btn', () => this.dropFlare());
    bindInstantTouch('skill-btn', () => this.activateClassSkill());
    const cctvNext = document.getElementById('cctv-next-btn');
    const cctvExit = document.getElementById('cctv-exit-btn');
    if (cctvNext) cctvNext.onclick = () => { this.cctvIdx++; this.updateCCTVLabel(); };
    if (cctvExit) cctvExit.onclick = () => this.closeCCTV();

    const runBtn = document.getElementById('run-btn');
    if (runBtn) {
      let runTouchId = null;
      runBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        runTouchId = e.changedTouches[0].identifier;
        this.sprinting = true;
        runBtn.style.background = '#dc2626';
      }, { passive: false });
      const endRun = (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === runTouchId) {
            runTouchId = null;
            this.sprinting = false;
            runBtn.style.background = '';
          }
        }
      };
      runBtn.addEventListener('touchend', endRun);
      runBtn.addEventListener('touchcancel', endRun);
      runBtn.onmousedown = () => { this.sprinting = true; };
      runBtn.onmouseup = () => { this.sprinting = false; };
    }

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

    document.getElementById('spectate-next-btn').onclick = () => { this.spectateIndex++; };

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

    this.playCutscene(1);
  },

  setupHudCustomizer() {
    const fsBtn = document.getElementById('fs-rotate-btn');
    const editBtn = document.getElementById('edit-hud-btn');
    const editorBar = document.getElementById('hud-editor-bar');
    const saveBtn = document.getElementById('save-hud-btn');
    const resetBtn = document.getElementById('reset-hud-btn');
    const gameScreen = document.getElementById('game-screen');

    if (fsBtn) fsBtn.onclick = async () => {
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
    if (editBtn) editBtn.onclick = () => {
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

    if (saveBtn) saveBtn.onclick = () => {
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

    if (resetBtn) resetBtn.onclick = () => {
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
    document.getElementById('stun-status').textContent = `🔫 ${this.stunCharges}`;
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
      this.hunter.stunnedUntil = performance.now() + 4000;
      this.stats.stuns++;
      this.showRadioToast('STUN HIT', '⚡ ELECTRIC SHOCK! Subject-0 frozen for 4.0s—MOVE!');
    } else {
      this.showRadioToast('STUN', '⚡ Electric Arc fired—target too far!');
    }
  },

  emitTaskSync(payload) {
    const pkt = { type: 'TASK_SYNC', by: Net.players[Net.myId]?.name || 'Teammate', ...payload };
    if (Net.isHost) {
      Net.broadcast(pkt);
    } else {
      Net.sendToHost(pkt);
    }
  },

  applyRemoteTask(data) {
    if (!data || !data.task) return;
    if (data.task === 'FUSE') {
      if (!this.hasFuse) {
        this.hasFuse = true;
        if (this.fuseMesh) this.fuseMesh.visible = false;
        this.showRadioToast('SQUAD SYNC', `🔋 ${data.by} picked up the Blue Power Fuse!`);
      }
    } else if (data.task === 'GEN') {
      if (!this.powerRestored) {
        this.powerRestored = true;
      this.emitTaskSync({ task: 'GEN' });
        if (this.hemiLight) this.hemiLight.intensity = this.powerRestored ? 1.85 : 1.35;
        if (this.genMesh) {
          this.genMesh.material.color.setHex(0x16a34a);
          this.genMesh.material.emissive.setHex(0x22c55e);
        }
        document.getElementById('objective-banner').textContent = 'CHAPTER 2: Collect 3 Purple Data Drives & upload at North Server!';
        this.showRadioToast('SQUAD SYNC', `⚡ ${data.by} restored Main Generator Power!`);
      }
    } else if (data.task === 'DRIVE') {
      const d = this.dataDrives && this.dataDrives[data.idx];
      if (d && !d.taken) {
        d.taken = true;
        if (d.mesh) d.mesh.visible = false;
        if (d.light) d.light.visible = false;
        this.drivesCollected = this.dataDrives.filter(x => x.taken).length;
        this.showRadioToast('SQUAD SYNC', `💾 ${data.by} grabbed Data Drive #${data.idx + 1} (${this.drivesCollected}/3)!`);
      }
    } else if (data.task === 'SERVER') {
      if (!this.drivesUploaded) {
        this.drivesCollected = 3;
        this.drivesUploaded = true;
      this.emitTaskSync({ task: 'SERVER' });
        if (this.serverMesh) {
          this.serverMesh.material.color.setHex(0x16a34a);
          this.serverMesh.material.emissive.setHex(0x22c55e);
        }
        document.getElementById('objective-banner').textContent = 'CHAPTER 3: Read Dr. Verma logs & unlock all 3 Terminals!';
        this.showRadioToast('SQUAD SYNC', `🖥️ ${data.by} uploaded all Data Drives! Terminals unlocked!`);
      }
    } else if (data.task === 'KEYCARD') {
      const k = this.keycards && this.keycards[data.idx];
      if (k && !k.taken) {
        k.taken = true;
        if (k.mesh) k.mesh.visible = false;
        if (k.light) k.light.visible = false;
        this.keycardsCollected = this.keycards.filter(x => x.taken).length;
        this.showRadioToast('SQUAD SYNC', `🔑 ${data.by} found Golden Keycard #${data.idx + 1} (${this.keycardsCollected}/2)!`);
      }
    } else if (data.task === 'SAMPLE') {
      const s = this.bioSamples && this.bioSamples[data.idx];
      if (s && !s.taken) {
        s.taken = true; s.mesh.visible = false; s.light.visible = false;
        this.samplesCollected = this.bioSamples.filter(x => x.taken).length;
        if (this.samplesCollected >= 4) this.openExitDoor();
        this.showRadioToast('SQUAD SYNC', `☣️ ${data.by} secured Bio-Sample (${this.samplesCollected}/4)!`);
      }
    } else if (data.task === 'SWITCH') {
      const sw = this.blastSwitches && this.blastSwitches[data.idx];
      if (sw && !sw.active) {
        sw.active = true;
        sw.mesh.material.color.setHex(0x16a34a); sw.mesh.material.emissive.setHex(0x22c55e);
        this.switchesActivated = this.blastSwitches.filter(x => x.active).length;
        if (this.switchesActivated >= 4) this.openExitDoor();
        this.showRadioToast('SQUAD SYNC', `🌊 ${data.by} overrode Blast Switch (${this.switchesActivated}/4)!`);
      }
    } else if (data.task === 'REACTOR_SWITCH') {
      if (!this.reactorUnlocked) {
        this.keycardsCollected = 2;
        this.reactorUnlocked = true;
      this.emitTaskSync({ task: 'REACTOR_SWITCH' });
        if (this.reactorSwitchMesh) {
          this.reactorSwitchMesh.material.color.setHex(0x16a34a);
          this.reactorSwitchMesh.material.emissive.setHex(0x22c55e);
        }
        document.getElementById('objective-banner').textContent = '☢️ LEVEL 2: Now seal all 6 Coolant Valves!';
        this.showRadioToast('SQUAD SYNC', `🎛️ ${data.by} unlocked the Valve Pressure System!`);
      }
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
      if (me.boarded) return;
      me.boarded = true;
      me.hiding = true;
      me.x = 0;
      me.z = 0;
      this.showRadioToast('EXTRACTION', '🚁 You got into the Rescue Helicopter! Safe from Subject-0!');
      if (Net.isHost) {
        Net.broadcast({ type: 'SQUAD', players: Net.players });
        this.checkHeliTakeoff();
      } else {
        Net.sendToHost({ type: 'BOARD_HELI', id: Net.myId });
      }
    } else if (act.type === 'FUSE') {
      this.hasFuse = true;
      this.fuseMesh.visible = false;
      this.emitTaskSync({ task: 'FUSE' });
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
    } else if (act.type === 'CCTV') {
      this.openCCTV();
    } else if (act.type === 'CCTV') {
      this.openCCTV();
    } else if (act.type === 'INTEL') {
      act.box.taken = true;
      act.box.mesh.visible = false;
      this.awardXP(150, 'Secret Intel Found');
      SFX.pickup();
    } else if (act.type === 'SAMPLE') {
      act.sample.taken = true;
      act.sample.mesh.visible = false;
      act.sample.light.visible = false;
      this.samplesCollected = this.bioSamples.filter(s => s.taken).length;
      SFX.pickup();
      this.emitTaskSync({ task: 'SAMPLE', idx: act.sample.idx });
      if (this.samplesCollected >= 4) {
        this.openExitDoor();
        document.getElementById('objective-banner').textContent = '🚪 MEDICAL EXIT UNLOCKED! Sprint to the North Green Beacon!';
        this.showRadioToast('MEDICAL WING', '✅ All 4 Bio-Samples secured! North Quarantine Exit is OPEN!');
      } else {
        this.showRadioToast('BIO-SAMPLE', `☣️ Collected Bio-Sample (${this.samplesCollected}/4)!`);
      }
    } else if (act.type === 'SWITCH') {
      act.sw.active = true;
      act.sw.mesh.material.color.setHex(0x16a34a);
      act.sw.mesh.material.emissive.setHex(0x22c55e);
      this.switchesActivated = this.blastSwitches.filter(s => s.active).length;
      SFX.pickup();
      this.emitTaskSync({ task: 'SWITCH', idx: act.sw.idx });
      if (this.switchesActivated >= 4) {
        this.openExitDoor();
        document.getElementById('objective-banner').textContent = '🚁 ROOF ELEVATOR UNLOCKED! Run to North-West Green Beacon!';
        this.showRadioToast('TUNNEL', '✅ All 4 Blast Switches overridden! Elevator to Rooftop is OPEN!');
      } else {
        this.showRadioToast('BLAST SWITCH', `🌊 Switch #${act.sw.idx + 1} overridden (${this.switchesActivated}/4)!`);
      }
    } else if (act.type === 'DRIVE') {
      act.drive.taken = true;
      act.drive.mesh.visible = false;
      act.drive.light.visible = false;
      this.drivesCollected = this.dataDrives.filter(x => x.taken).length;
      this.stats.objectives++;
      this.emitTaskSync({ task: 'DRIVE', idx: act.drive.idx });
      SFX.tone(680, 'sine', 0.2, 0.25, 920);
      this.showRadioToast('DATA DRIVE', `💾 Collected Encrypted Drive (${this.drivesCollected}/3)!`);
    } else if (act.type === 'SERVER') {
      if (!this.powerRestored) return this.showRadioToast('OFFLINE', '⚠️ Restore Generator Power first!');
      if (this.drivesCollected < 3) return this.showRadioToast('SERVER', `⚠️ Collect all 3 Purple Data Drives first (${this.drivesCollected}/3)!`);
      this.drivesUploaded = true;
      this.serverMesh.material.color.setHex(0x16a34a);
      this.serverMesh.material.emissive.setHex(0x22c55e);
      document.getElementById('objective-banner').textContent = 'CHAPTER 3: Read Dr. Verma logs & unlock all 3 Terminals!';
      this.showRadioToast('SERVER', '✅ All 3 Data Drives uploaded! Security Terminals unlocked!');
    } else if (act.type === 'KEYCARD') {
      act.card.taken = true;
      act.card.mesh.visible = false;
      act.card.light.visible = false;
      this.keycardsCollected = this.keycards.filter(x => x.taken).length;
      this.stats.objectives++;
      this.emitTaskSync({ task: 'KEYCARD', idx: act.card.idx });
      SFX.tone(740, 'triangle', 0.22, 0.25, 1020);
      this.showRadioToast('KEYCARD', `🔑 Picked up Golden Override Keycard (${this.keycardsCollected}/2)!`);
    } else if (act.type === 'REACTOR_SWITCH') {
      if (this.keycardsCollected < 2) return this.showRadioToast('LOCKED', `⚠️ Find both Golden Keycards first (${this.keycardsCollected}/2)!`);
      this.reactorUnlocked = true;
      this.reactorSwitchMesh.material.color.setHex(0x16a34a);
      this.reactorSwitchMesh.material.emissive.setHex(0x22c55e);
      document.getElementById('objective-banner').textContent = '☢️ LEVEL 2: Now seal all 6 Coolant Valves!';
      this.showRadioToast('REACTOR', '✅ Valve Pressure Locks released! Seal all 6 Coolant Valves!');
    } else if (act.type === 'VALVE') {
      if (!this.reactorUnlocked) return this.showRadioToast('LOCKED', '⚠️ Collect 2 Keycards & activate the South Reactor Switch first!');
      this.fixValve(act.valve.idx);
      if (Net.isHost) Net.broadcast({ type: 'UNLOCK', lockIdx: act.valve.idx });
      else Net.sendToHost({ type: 'UNLOCK', lockIdx: act.valve.idx });
    } else if (act.type === 'TERM') {
      if (!this.powerRestored) return this.showRadioToast('LOCKED', '⚠️ Restore Generator power first!');
      if (!this.drivesUploaded) return this.showRadioToast('LOCKED', '⚠️ Upload 3 Data Drives at the North Server Console first!');
      this.activeTerminalIdx = act.term.idx;
      this.typedCode = '';
      this.updateKeypadUI();
      document.getElementById('puzzle-title').textContent = `SECURITY TERMINAL #${act.term.idx + 1}`;
      document.getElementById('puzzle-modal').classList.remove('hidden');

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
    if (this.hemiLight) this.hemiLight.intensity = this.powerRestored ? 1.85 : 1.35;
    this.genMesh.material.color.setHex(0x16a34a);
    this.genMesh.material.emissive.setHex(0x22c55e);
    document.getElementById('locks-status').textContent = '⚡ ON (0/3)';
    document.getElementById('objective-banner').textContent = 'CHAPTER 2: Collect 3 Purple Data Drives & upload at North Server!';
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
    document.getElementById('locks-status').textContent = `☢️ VALVES ${fixedCount}/6`;
    if (fixedCount === 6) {
      this.openExitDoor('🚨 ALL 6 COOLANT VALVES SEALED! 48s TO REACH THE GREEN EXIT BEAM!');
    } else {
      document.getElementById('objective-banner').textContent = `☢️ HARDCORE LEVEL 2: Seal all 6 Coolant Valves (${fixedCount}/6)`;
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
    this.escapeTimeLeft = this.level === 2 ? 48 : 52;
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
    this.keycardsCollected = 0;
    this.reactorUnlocked = false;
    this.selfDestructActive = false;
    document.getElementById('timer-badge').classList.add('hidden');
    document.getElementById('locks-status').textContent = '☢️ VALVES 0/6';
    document.getElementById('objective-banner').textContent = '☢️ LEVEL 2: Find 2 Golden Keycards, unlock South Switch & seal 6 Coolant Valves!';
    this.buildLevelMap(5);
    this.stunCharges = 2;
    document.getElementById('stun-status').textContent = '🔫 2/2';
    this.levelStartGrace = performance.now() + 5000;
    const safeSpots = [{ x: -34, z: -8 }, { x: -34, z: 8 }, { x: -32, z: -8 }, { x: -32, z: 8 }];
    Object.values(Net.players).forEach((p, idx) => {
      const sp = safeSpots[idx % 4];
      p.x = sp.x; p.z = sp.z; p.downed = false; p.hiding = false;
    });
    this.hunter.x = 34; this.hunter.z = 6;
    this.hunter.stuckFrames = 0;
    this.pickNextPatrolWaypoint();
    this.saveCheckpoint();
    this.showRadioToast('LEVEL 2', '☢️ BIO-REACTOR CORE! Seal all 4 Coolant Valves!');
  },

  startLevel3() {
    this.buildLevelMap(3);
    this.selfDestructActive = true;
    this.escapeTimeLeft = 52;
    this.lastTick = performance.now();
    this.stunCharges = 2;
    document.getElementById('stun-status').textContent = '🔫 2/2';
    document.getElementById('timer-badge').classList.remove('hidden');
    document.getElementById('locks-status').textContent = '🚁 HELIPAD';
    document.getElementById('objective-banner').textContent = '🚁 LEVEL 3 (ROOFTOP HELIPAD): HARDCORE EXTRACTION: EXTRACTION: Survive 52s until chopper lands!';
    Object.values(Net.players).forEach((p, idx) => {
      p.x = -2 + idx * 1.4; p.z = 2; p.downed = false; p.hiding = false; p.boarded = false;
    });
    this.hunter.x = 32; this.hunter.z = -32; this.levelStartGrace = performance.now() + 4000;
    SFX.siren();
    this.saveCheckpoint();
    this.showRadioToast('LEVEL 3', '🚁 ROOFTOP HELIPAD! Hold out for 52 seconds on the rooftop!');
  },

  triggerJumpscare() {
    SFX.jumpscareScream();
    const ov = document.getElementById('jumpscare-overlay');
    ov.classList.remove('hidden');
    setTimeout(() => ov.classList.add('hidden'), 1300);
  },

  checkHeliTakeoff() {
    if (this.heliTakeoff || this.level !== 3) return;
    const alivePlayers = Object.values(Net.players).filter(p => !p.downed);
    if (alivePlayers.length > 0 && alivePlayers.every(p => p.boarded)) {
      if (Net.isHost) Net.broadcast({ type: 'HELI_TAKEOFF' });
      this.startHeliTakeoff();
    }
  },

  startHeliTakeoff() {
    if (this.heliTakeoff) return;
    this.heliTakeoff = true;
    this.heliTakeoffStart = performance.now();
    this.selfDestructActive = false;
    SFX.siren();
    this.showRadioToast('EXTRACTION', '🚁 ALL AGENTS BOARDED! TAKING OFF!');
    setTimeout(() => {
      const msg = '🚁 Squad extracted by Rescue Helicopter! All 3 levels cleared!';
      if (Net.isHost) Net.broadcast({ type: 'GAMEOVER', win: true, reason: msg });
      this.triggerEnd(true, msg);
    }, 3000);
  },

  triggerEnd(win, reason) {
    if (this.gameOver) return;
    SFX.updateHelicopter(false);
    this.gameOver = true;
    document.getElementById('spectate-bar').classList.add('hidden');
    document.getElementById('locker-overlay')?.classList.add('hidden');
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
    SFX.updateHelicopter(false);
    document.getElementById('end-modal').classList.add('hidden');
    document.getElementById('spectate-bar').classList.add('hidden');
    document.getElementById('locker-overlay')?.classList.add('hidden');
    document.getElementById('jumpscare-overlay').classList.add('hidden');
    document.getElementById('timer-badge').classList.add('hidden');
    this.gameOver = false;
    this.battery = 100;
    this.stamina = 100;
    this.stunCharges = 2;
    this.hasFuse = false;
    this.powerRestored = false;
    this.drivesCollected = 0;
    this.drivesUploaded = false;
    this.keycardsCollected = 0;
    this.reactorUnlocked = false;
    this.selfDestructActive = false;
    this.locks = [false, false, false];
    this.stats = { stuns: 0, objectives: 0, revives: 0 };
    this.codes = codes;
    this.buildLevelMap(1, noteSpots, fuseSpot);
    this.hunter.x = 32; this.hunter.z = -32; this.hunter.stunnedUntil = 0; this.levelStartGrace = performance.now() + 5000;

    const spawns = [{ x: -32, z: 32 }, { x: -16, z: 18 }, { x: -18, z: 16 }, { x: -16, z: 16 }];
    Object.values(Net.players).forEach((p, idx) => {
      const sp = spawns[idx % 4];
      p.x = sp.x; p.z = sp.z; p.downed = false; p.hiding = false; p.boarded = false; p.torch = true;
    });

    document.getElementById('battery-badge').textContent = '🔋 100%';
    document.getElementById('locks-status').textContent = '⚡ OFF';
    document.getElementById('stun-status').textContent = '🔫 2/2';
    document.getElementById('objective-banner').textContent = 'CHAPTER 1: Find the blue POWER FUSE in the dark storage room';
    this.showRadioToast('MISSION', '🔄 New round started! Good luck, Squad!');
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
    const radarScale = me.role === 'SCOUT' ? 0.85 : 1.4;

    if (this.selfDestructActive && this.level < 3) {
      const ex = this.exitPos.x - me.x;
      const ez = this.exitPos.z - me.z;
      const erx = (ex * cos - ez * sin) * radarScale;
      const erz = (ex * sin + ez * cos) * radarScale;
      const ed = Math.hypot(erx, erz);
      const ec = ed > 36 ? 36 / ed : 1;
      ctx.fillStyle = '#4ade80';
      ctx.beginPath(); ctx.arc(cx + erx * ec, cy + erz * ec, 4.5, 0, Math.PI * 2); ctx.fill();
    }

    for (const p of Object.values(Net.players)) {
      if (p.id === Net.myId || p.hiding) continue;
      const px = p.x - me.x;
      const pz = p.z - me.z;
      const prx = (px * cos - pz * sin) * radarScale;
      const prz = (px * sin + pz * cos) * radarScale;
      const pd = Math.hypot(prx, prz);
      const pc = pd > 36 ? 36 / pd : 1;
      ctx.fillStyle = p.downed ? '#facc15' : '#38bdf8';
      ctx.beginPath(); ctx.arc(cx + prx * pc, cy + prz * pc, 3.8, 0, Math.PI * 2); ctx.fill();
    }

    const dx = this.hunter.x - me.x;
    const dz = this.hunter.z - me.z;
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

      this.valves.forEach(v => { if (!v.fixed) v.wheel.rotation.y += 0.02; });
      if (this.exitBeacon && this.exitBeacon.visible) this.exitBeacon.rotation.y += 0.03;
      this.pickups.forEach(pk => { if (!pk.taken) pk.mesh.rotation.y += 0.03; });
      this.dataDrives.forEach(d => { if (!d.taken) d.mesh.rotation.y += 0.04; });
      this.keycards.forEach(k => { if (!k.taken) k.mesh.rotation.y += 0.04; });

      if (this.level === 3 && this.chopperGroup) {
        const heliActive = this.heliTakeoff || this.escapeTimeLeft <= 15;
        const heliDist = Math.hypot(me.x, me.z) + Math.max(0, this.chopperGroup.position.y * 0.6);
        SFX.updateHelicopter(heliActive, heliDist, this.heliTakeoff);
        this.chopperRotor.rotation.y += this.heliTakeoff ? 0.65 : 0.38;
        if (this.heliTakeoff) {
          this.chopperGroup.position.y += 0.14;
          this.chopperGroup.position.z -= 0.05;
          this.chopperGroup.rotation.x = THREE.MathUtils.lerp(this.chopperGroup.rotation.x, -0.18, 0.04);
        } else {
          const targetY = this.escapeTimeLeft <= 15 ? 0.05 : 22;
          this.chopperGroup.position.y = THREE.MathUtils.lerp(this.chopperGroup.position.y, targetY, 0.035);
          if (!this.heliLanded && this.chopperGroup.position.y < 0.35) {
            this.heliLanded = true;
            this.showRadioToast('HELICOPTER', '🚁 Rescue Helicopter landed on Helipad! Press [USE] to Get In!');
          }
        }
      }

      const aliveTeammates = Object.values(Net.players).filter(p => p.id !== Net.myId && !p.downed);
      const specBar = document.getElementById('spectate-bar');

      if (this.inCCTV && this.cctvFeeds) {
        const feed = this.cctvFeeds[this.cctvIdx % this.cctvFeeds.length];
        const pan = Math.sin(performance.now() * 0.0015) * 3.5;
        this.camera.position.set(feed.pos[0], feed.pos[1], feed.pos[2]);
        this.camera.lookAt(feed.look[0] + pan, feed.look[1], feed.look[2]);
        this.renderer.render(this.scene, this.camera);
        return;
      }
      if ((me.boarded || this.heliTakeoff) && this.chopperGroup) {
        specBar.classList.add('hidden');
        document.getElementById('interact-hint')?.classList.add('hidden');
        const cy = this.chopperGroup.position.y;
        const cz = this.chopperGroup.position.z;
        this.camera.position.set(6.5, Math.max(2.4, cy + 1.8), cz + 7.5);
        this.camera.lookAt(0, cy + 1.2, cz);
      } else if (me.downed && aliveTeammates.length > 0) {
        specBar.classList.remove('hidden');
        const targetMate = aliveTeammates[this.spectateIndex % aliveTeammates.length];
        document.getElementById('spectate-target-name').textContent = `${targetMate.name} (${targetMate.role})`;
        this.camera.position.set(targetMate.x, 1.75, targetMate.z);
        this.camera.rotation.y = targetMate.yaw;
      } else {
        specBar.classList.add('hidden');

        let fwd = 0, str = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) fwd += 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) fwd -= 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) str -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) str += 1;
        if (this.joy.active) { fwd -= this.joy.dy; str += this.joy.dx; }

        const isRunning = (this.keys['ShiftLeft'] || this.sprinting) && !me.downed && !me.hiding;
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
        const isMoving = Math.hypot(this.velX, this.velZ) > 0.004;
        if (isMoving) {
          const nx = me.x + this.velX;
          const nz = me.z + this.velZ;
          if (!this.checkCollision(nx, me.z)) me.x = nx;
          if (!this.checkCollision(me.x, nz)) me.z = nz;
          this.walkBob += isRunning ? 0.24 : 0.15;
          SFX.step(isRunning);
          if (isRunning || Net.voiceLoud) me.makingNoise = true;
        }

        if (!me.downed && !me.hiding && this.lasers.length > 0) {
          for (const lz of this.lasers) {
            if (me.x > lz.minX && me.x < lz.maxX && me.z > lz.minZ && me.z < lz.maxZ) {
              me.makingNoise = true;
              if (performance.now() - this.lastLaserAlert > 3500) {
                this.lastLaserAlert = performance.now();
                SFX.siren();
                this.showRadioToast('SECURITY ALARM', '🚨 LASER TRIPWIRE TRIGGERED! Subject-0 heard your location!');
                if (Net.isHost) {
                  this.hunter.goalX = me.x;
                  this.hunter.goalZ = me.z;
                  this.hunter.investigateUntil = performance.now() + 6500;
                }
              }
              break;
            }
          }
        }

        const bob = me.downed ? 0 : Math.sin(this.walkBob) * 0.04;
        if (this.playerHandGroup) {
          this.playerHandGroup.position.y = Math.sin(this.walkBob * 2) * 0.015;
          this.playerHandGroup.position.x = Math.cos(this.walkBob) * 0.015;
        }
                // Hide all First-Person meshes attached to camera in 3RD Person, and auto-fit X position to screen aspect in 1ST Person
        const aspectScale = Math.min(1.0, Math.max(0.46, this.camera.aspect / 1.35));
        this.camera.children.forEach(child => {
          if (!child.isLight && child.type !== 'Object3D') {
            child.visible = !this.thirdPerson;
            if (!this.thirdPerson) {
              if (child.userData.baseX === undefined) child.userData.baseX = child.position.x;
              child.position.x = child.userData.baseX * aspectScale;
            }
          }
        });
        if (this.handGroup) {
          this.handGroup.visible = !this.thirdPerson;
          if (!this.thirdPerson) {
            if (this.handGroup.userData.baseX === undefined) this.handGroup.userData.baseX = this.handGroup.position.x;
            this.handGroup.position.x = this.handGroup.userData.baseX * aspectScale;
          }
        }
        if (this.thirdPerson) {
          if (this.selfAvatar) {
            this.selfAvatar.grp.visible = !me.hiding;
            this.selfAvatar.grp.position.set(me.x, me.downed ? 0.25 : 0, me.z);
            this.selfAvatar.grp.rotation.y = me.yaw;
            this.selfAvatar.grp.rotation.x = me.downed ? -Math.PI / 2 : 0;
            this.animateCharacterLimbs(this.selfAvatar, isMoving && !me.downed);
          }
          const camDist = 2.6;
          this.camera.position.set(me.x + Math.sin(me.yaw) * camDist, 2.25 + bob, me.z + Math.cos(me.yaw) * camDist);
          this.camera.rotation.y = me.yaw;
        } else {
          if (this.selfAvatar) this.selfAvatar.grp.visible = false;
          this.camera.position.set(me.x, (me.downed ? 0.55 : 1.62) + bob, me.z);
          this.camera.rotation.y = me.yaw;
        }
      }

      if (me.torch && this.battery > 0 && !me.downed) {
        this.battery = Math.max(0, this.battery - 0.017);
        if (this.battery === 0) { me.torch = false; this.flashlight.visible = false; }
        document.getElementById('battery-badge').textContent = `🔋 ${Math.ceil(this.battery)}%`;
      }

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
        if (!this.nearAction && this.level === 1 && Math.hypot(-34 - me.x, 34 - me.z) < 2.8) {
          this.nearAction = { type: 'GEN' };
          hint.textContent = '⚡ [USE] Activate Generator';
        }
        if (!this.nearAction && this.cctvConsoles) {
          for (const c of this.cctvConsoles) {
            if (Math.hypot(c.x - me.x, c.z - me.z) < 2.4) {
              this.nearAction = { type: 'CCTV' };
              hint.textContent = '📹 [USE] Open Live Bunker CCTV Cameras';
              break;
            }
          }
        }
        if (!this.nearAction && this.cctvConsoles) {
          for (const c of this.cctvConsoles) {
            if (Math.hypot(c.x - me.x, c.z - me.z) < 2.4) {
              this.nearAction = { type: 'CCTV' };
              hint.textContent = '📹 [USE] Open Live Bunker CCTV Cameras';
              break;
            }
          }
        }
        if (!this.nearAction && this.intelBoxes) {
          for (const b of this.intelBoxes) {
            if (!b.taken && Math.hypot(b.x - me.x, b.z - me.z) < 2.3) {
              this.nearAction = { type: 'INTEL', box: b };
              hint.textContent = '💼 [USE] Grab Secret Intel (+150 XP)';
              break;
            }
          }
        }
        if (!this.nearAction && this.level === 2 && this.bioSamples) {
          for (const s of this.bioSamples) {
            if (!s.taken && Math.hypot(s.x - me.x, s.z - me.z) < 2.4) {
              this.nearAction = { type: 'SAMPLE', sample: s };
              hint.textContent = `☣️ [USE] Collect Bio-Sample #${s.idx + 1}`;
              break;
            }
          }
        }
        if (!this.nearAction && this.level === 4 && this.blastSwitches) {
          for (const sw of this.blastSwitches) {
            if (!sw.active && Math.hypot(sw.x - me.x, sw.z - me.z) < 2.5) {
              this.nearAction = { type: 'SWITCH', sw };
              hint.textContent = `🌊 [USE] Override Blast Switch #${sw.idx + 1}`;
              break;
            }
          }
        }
        if (!this.nearAction && this.level === 1) {
          for (const d of this.dataDrives) {
            if (!d.taken && Math.hypot(d.x - me.x, d.z - me.z) < 2.4) {
              this.nearAction = { type: 'DRIVE', drive: d };
              hint.textContent = `💾 [USE] Grab Data Drive #${d.idx + 1}`;
              break;
            }
          }
        }
        if (!this.nearAction && this.level === 1 && !this.drivesUploaded && Math.hypot(0 - me.x, -34 - me.z) < 2.8) {
          this.nearAction = { type: 'SERVER' };
          hint.textContent = `🖥️ [USE] Upload Data Drives (${this.drivesCollected}/3)`;
        }
        if (!this.nearAction && this.level === 2) {
          for (const k of this.keycards) {
            if (!k.taken && Math.hypot(k.x - me.x, k.z - me.z) < 2.4) {
              this.nearAction = { type: 'KEYCARD', card: k };
              hint.textContent = `🔑 [USE] Grab Golden Keycard #${k.idx + 1}`;
              break;
            }
          }
        }
        if (!this.nearAction && this.level === 2 && !this.reactorUnlocked && Math.hypot(0 - me.x, 34 - me.z) < 2.8) {
          this.nearAction = { type: 'REACTOR_SWITCH' };
          hint.textContent = `🎛️ [USE] Unlock Valve System (${this.keycardsCollected}/2 Keycards)`;
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
          for (const pk of this.pickups) {
            if (!pk.taken && Math.hypot(pk.x - me.x, pk.z - me.z) < 2.2) {
              this.nearAction = { type: 'PICKUP', item: pk };
              hint.textContent = pk.kind === 'BATTERY' ? '🔋 [USE] Grab Battery (+40%)' : '⚡ [USE] Grab Stun Cell (+1)';
              break;
            }
          }
        }
        if (!this.nearAction && this.level === 3 && !me.boarded && this.heliLanded && Math.hypot(me.x, me.z) < 4.8) {
          this.nearAction = { type: 'BOARD_HELI' };
          hint.textContent = '🚁 [USE] GET IN HELICOPTER!';
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

      if (this.selfDestructActive && this.level < 3) {
        const meAtExit = !me.downed && Math.hypot(this.exitPos.x - me.x, this.exitPos.z - me.z) < 3.4;
        const anyoneAtExit = meAtExit || Object.values(Net.players).some(p => !p.downed && Math.hypot(this.exitPos.x - p.x, this.exitPos.z - p.z) < 3.4);
        if (anyoneAtExit) {
          if (this.level === 1) {
            this.startLevel2();
            if (Net.isHost) Net.broadcast({ type: 'LEVEL_2' });
            else Net.sendToHost({ type: 'LEVEL_2' });
          } else if (this.level === 3) {
            this.startLevel3();
            if (Net.isHost) Net.broadcast({ type: 'LEVEL_3' });
            else Net.sendToHost({ type: 'LEVEL_3' });
          }
        }
      }

      if (this.selfDestructActive) {
        const now = performance.now();
        if (now - this.lastTick >= 1000) {
          this.lastTick = now;
          this.escapeTimeLeft = Math.max(0, this.escapeTimeLeft - 1);
          document.getElementById('timer-badge').textContent = (this.level === 3 ? '🚁 ' : '☢️ ') + `${this.escapeTimeLeft}s`;
          if (this.escapeTimeLeft <= 0 && Net.isHost) {
            if (this.level === 5) {
              const anyBoarded = Object.values(Net.players).some(p => p.boarded);
              if (anyBoarded) {
                Net.broadcast({ type: 'HELI_TAKEOFF' });
                this.startHeliTakeoff();
              } else {
                const msg = '🚁 Helicopter had to abort! Nobody boarded in time!';
                Net.broadcast({ type: 'GAMEOVER', win: false, reason: msg });
                this.triggerEnd(false, msg);
              }
            } else {
              const msg = 'Time is up! Facility meltdown triggered!';
              Net.broadcast({ type: 'GAMEOVER', win: false, reason: msg });
              this.triggerEnd(false, msg);
            }
          }
        }
      }

      const isStunned = performance.now() < this.hunter.stunnedUntil;
      if (this.hunter.mesh && this.hunter.limbs) {
        if (isStunned) {
          this.hunter.mesh.position.y = -0.38;
          this.hunter.mesh.rotation.z = (Math.random() - 0.5) * 0.18;
        } else {
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

      if (Net.isHost && !isStunned && (!this.levelStartGrace || performance.now() > this.levelStartGrace)) {
          if (this.decoyPos && performance.now() < this.decoyUntil) {
            this.moveHunterToward(this.decoyPos.x, this.decoyPos.z, 0.084);
          }
        const nowAI = performance.now();
        let target = null, minDist = 999;

        for (const p of Object.values(Net.players)) {
          if (p.downed || p.hiding || p.boarded) continue;
          const d = Math.hypot(p.x - this.hunter.x, p.z - this.hunter.z);
          const angleToPlayer = Math.atan2(p.x - this.hunter.x, p.z - this.hunter.z);
          const angleDiff = Math.abs(Math.atan2(Math.sin(angleToPlayer - this.hunter.yaw), Math.cos(angleToPlayer - this.hunter.yaw)));
          const inFront = angleDiff < 1.25;
          const detectRange = this.level === 3 ? 28 : (p.makingNoise ? 22 : (inFront ? (p.torch ? 17 : 9.5) : 4.2));
          if (d < detectRange && d < minDist) { minDist = d; target = p; }
        }

        if (target) {
          this.hunter.aiState = 'CHASE';
          this.hunter.goalX = target.x;
          this.hunter.goalZ = target.z;
          this.hunter.investigateUntil = nowAI + 4200;
          const mSpeed = this.level === 5 ? 0.088 : (this.level === 4 ? 0.080 : 0.072);
          this.moveHunterToward(target.x, target.z, mSpeed);

          if (minDist < 1.35) {
            target.downed = true;
            this.hunter.aiState = 'PATROL';
            this.pickNextPatrolWaypoint();
            if (target.id === Net.myId) this.triggerJumpscare();
          }
        } else if (nowAI < this.hunter.investigateUntil) {
          this.hunter.aiState = 'INVESTIGATE';
          const distToLast = Math.hypot(this.hunter.goalX - this.hunter.x, this.hunter.goalZ - this.hunter.z);
          if (distToLast > 1.4) this.moveHunterToward(this.hunter.goalX, this.hunter.goalZ, 0.062);
          else this.hunter.yaw += Math.sin(nowAI * 0.006) * 0.045;
        } else if (nowAI < this.hunter.scanUntil) {
          this.hunter.aiState = 'SCAN';
          this.hunter.yaw += Math.sin(nowAI * 0.004) * 0.03;
        } else {
          this.hunter.aiState = 'PATROL';
          const distGoal = Math.hypot(this.hunter.goalX - this.hunter.x, this.hunter.goalZ - this.hunter.z);
          if (distGoal < 1.8) {
            this.hunter.scanUntil = nowAI + 1800;
            this.pickNextPatrolWaypoint();
          } else {
            this.moveHunterToward(this.hunter.goalX, this.hunter.goalZ, 0.052);
          }
        }

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
        danger.style.boxShadow = `inset 0 0 ${Math.round((15 - dMonster) * 9)}px rgba(220,38,38,0.65)`;
      } else {
        danger.style.boxShadow = 'none';
      }

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
    this.scene.fog = new THREE.FogExp2(0x0f172a, 0.014);

    this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 60);
    this.camera.position.set(0, 1.65, 3.8);
    this.camera.lookAt(0, 1.15, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Bunker Helipad / Armory Pedestal Stage
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(14, 36),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.4 })
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.05, 1.22, 36),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    this.scene.add(ring);

    const amb = new THREE.AmbientLight(0x94a3b8, 0.75);
    const keyLight = new THREE.SpotLight(0x38bdf8, 4.5, 18, 0.7);
    keyLight.position.set(2.5, 5.2, 3.5);
    const rimLight = new THREE.PointLight(0xfacc15, 2.2, 12);
    rimLight.position.set(-2.5, 2.8, -2.2);
    this.scene.add(amb, keyLight, rimLight);

    this.refreshCharacter();

    // Drag to rotate 3D character 360 degrees
    canvas.addEventListener('pointerdown', (e) => { this.dragging = true; this.lastX = e.clientX; });
    window.addEventListener('pointerup', () => { this.dragging = false; });
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.rotY += (e.clientX - this.lastX) * 0.012;
      this.lastX = e.clientX;
    });

    const loop = () => {
      requestAnimationFrame(loop);
      const menu = document.getElementById('menu-screen');
      if (!menu || menu.classList.contains('hidden')) return;
      if (this.camera && this.renderer) {
        const w = window.innerWidth, h = window.innerHeight;
        if (Math.abs(this.camera.aspect - w / h) > 0.01) {
          this.camera.aspect = w / h;
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(w, h);
        }
      }
      if (this.charGroup) {
        if (!this.dragging) this.rotY += 0.004;
        this.charGroup.rotation.y = this.rotY;
        this.charGroup.position.y = Math.sin(performance.now() * 0.003) * 0.035;
      }
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  },

  refreshCharacter() {
    if (!this.scene) return;
    if (this.charGroup) this.scene.remove(this.charGroup);
    const suit = window.AgentProfile ? AgentProfile.getEquippedSuit() : { color: 0x0284c7, visor: 0x38bdf8 };
    const role = window.AgentProfile ? (AgentProfile.load().role || 'SCOUT') : 'SCOUT';

    const g = new THREE.Group();
    const suitMat = new THREE.MeshStandardMaterial({ color: suit.color, roughness: 0.45, metalness: 0.35 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfde68a });
    const visorMat = new THREE.MeshBasicMaterial({ color: suit.visor });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.85, 0.38), suitMat); torso.position.y = 1.15;
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.24), darkMat); pack.position.set(0, 1.2, -0.28);
    const packCore = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.36, 0.05), visorMat); packCore.position.set(0, 1.2, -0.41);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), skinMat); head.position.y = 1.84;
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.24, 0.52), darkMat); helmet.position.y = 1.98;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.08), visorMat); visor.position.set(0, 1.84, 0.24);

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), suitMat); legL.position.set(-0.18, 0.36, 0);
    const legR = legL.clone(); legR.position.x = 0.18;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.22), suitMat); armL.position.set(-0.46, 1.15, 0);
    const armR = armL.clone(); armR.position.x = 0.46;
    const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.32, 10), darkMat);
    torch.rotation.x = Math.PI / 2; torch.position.set(0.46, 0.82, 0.18);

    // Role Shoulder Badge
    const roleBadgeColor = role === 'MEDIC' ? 0x22c55e : (role === 'ENGINEER' ? 0xf59e0b : (role === 'TECH' ? 0xa855f7 : 0x38bdf8));
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.3), new THREE.MeshBasicMaterial({ color: roleBadgeColor }));
    pad.position.set(-0.46, 1.52, 0);

    g.add(torso, pack, packCore, head, helmet, visor, legL, legR, armL, armR, torch, pad);
    this.charGroup = g;
    this.scene.add(g);
  }
};
window.HomeShowcase3D = HomeShowcase3D;
if (document.readyState === 'loading') { window.addEventListener('DOMContentLoaded', () => HomeShowcase3D.init()); } else { HomeShowcase3D.init(); }
