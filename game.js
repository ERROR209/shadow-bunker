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
      this.loadMp3('step', 'sounds/step.mp3', false, 0.55);
      this.loadMp3('monster_step', 'sounds/monster_step.mp3', false, 0.85);
      this.loadMp3('ambience', 'sounds/ambience.mp3', true, 0.35);
      this.loadMp3('scream', 'sounds/scream.mp3', false, 0.95);
      this.loadMp3('stun', 'sounds/stun.mp3', false, 0.85);
      this.loadMp3('heartbeat', 'sounds/heartbeat.mp3', false, 1.0);
      this.loadMp3('helicopter', 'sounds/helicopter.mp3', true, 0.85);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
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

  updateHelicopter(active, dist = 0, isTakeoff = false) {
    const tr = this.tracks.helicopter;
    if (!tr || !tr._ready) return;
    if (!active) {
      if (!tr.paused) { tr.pause(); tr.currentTime = 0; }
      return;
    }
    const prox = Math.max(0.25, Math.min(1.0, (28 - dist) / 22));
    tr.volume = isTakeoff ? 1.0 : prox * 0.9;
    tr.playbackRate = isTakeoff ? 1.32 : 1.0;
    if (tr.paused) tr.play().catch(() => {});
  },

  heartbeat(dist) {
    const now = performance.now();
    const interval = Math.max(680, dist * 85);
    if (now - this.lastBeat < interval) return;
    this.lastBeat = now;
    const vol = Math.max(0.45, Math.min(1.0, (15 - dist) / 11));
    if (this.playMp3('heartbeat', vol)) return;
    this.tone(82, 'sine', 0.16, 0.85 * vol, 38, 0);
    this.tone(68, 'sine', 0.19, 0.72 * vol, 32, 0.17);
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

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.78, 0.32), suitMat);
  torso.position.y = 1.18;
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.56, 0.36), armorMat);
  vest.position.y = 1.24;
  const chestCore = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.38), visorMat);
  chestCore.position.y = 1.26;

  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.54, 0.22), armorMat);
  pack.position.set(0, 1.24, 0.24);
  const packCell = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.42, 10), visorMat);
  packCell.position.set(0.1, 1.24, 0.35);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skinMat);
  head.position.y = 1.82;
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.24, 0.41), armorMat);
  helmet.position.set(0, 1.92, 0.01);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.06), visorMat);
  visor.position.set(0, 1.83, -0.18);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.37, 1.5, 0);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.58, 0.15), suitMat);
  armL.position.y = -0.25;
  const gloveL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.15), armorMat);
  gloveL.position.y = -0.56;
  const torchProp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, 0.24, 10),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.6 })
  );
  torchProp.rotation.x = Math.PI / 2;
  torchProp.position.set(0, -0.56, -0.12);
  leftArmPivot.add(armL, gloveL, torchProp);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.37, 1.5, 0);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.58, 0.15), suitMat);
  armR.position.y = -0.25;
  const gloveR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.15), armorMat);
  gloveR.position.y = -0.56;
  const stunProp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, 0.28), visorMat);
  stunProp.position.set(0, -0.54, -0.14);
  rightArmPivot.add(armR, gloveR, stunProp);

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
  rotor: null,
  running: false,
  joy: { active: false, dx: 0, dy: 0 },
  keys: {},
  localPos: { x: 0, z: 3.5, yaw: 0 },
  lastSync: 0,

  init() {
    if (this.running) return;
    const container = document.getElementById('lobby-3d-bg');
    if (!container || typeof THREE === 'undefined') return;
    this.running = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b172a);
    this.scene.fog = new THREE.FogExp2(0x0b172a, 0.022);

    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 120);
    this.camera.rotation.order = 'YXZ';

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // Twilight Sky & Island Lighting
    this.scene.add(new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 1.25));
    const dirLight = new THREE.DirectionalLight(0xfef08a, 1.4);
    dirLight.position.set(15, 25, 12);
    this.scene.add(dirLight);

    // Ocean Water Surrounding Spawn Island
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 240),
      new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.25, metalness: 0.6 })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.6;
    this.scene.add(ocean);

    // Spawn Island Concrete Helipad & Ground
    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(18, 20, 0.8, 32),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 })
    );
    island.position.y = -0.4;
    this.scene.add(island);

    // Glowing Helipad Circle + 'H' Marking
    const padRing = new THREE.Mesh(
      new THREE.RingGeometry(4.4, 4.9, 36),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
    );
    padRing.rotation.x = -Math.PI / 2;
    padRing.position.set(0, 0.02, -4);
    const hL = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 3.2), new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide }));
    hL.rotation.x = -Math.PI / 2; hL.position.set(-1.0, 0.02, -4);
    const hR = hL.clone(); hR.position.x = 1.0;
    const hC = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.6), new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide }));
    hC.rotation.x = -Math.PI / 2; hC.position.set(0, 0.02, -4);
    this.scene.add(padRing, hL, hR, hC);

    // Detailed 3D Military Rescue Helicopter on Helipad
    const heli = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.35 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.3 });
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.35, 3.8), hullMat);
    body.position.y = 1.25;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.05, 1.4), glassMat);
    nose.position.set(0, 1.15, -2.1);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 3.2), hullMat);
    tail.position.set(0, 1.45, 3.2);
    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.7), darkMat);
    tailFin.position.set(0, 1.85, 4.5);

    // Landing Skids
    const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 3.6), darkMat);
    skidL.position.set(-0.95, 0.12, -0.2);
    const skidR = skidL.clone(); skidR.position.x = 0.95;

    // Main Rotor + Mast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.4, 10), darkMat);
    mast.position.set(0, 2.05, 0);
    this.rotor = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.06, 0.32), darkMat);
    this.rotor.position.set(0, 2.25, 0);

    const heliSpot = new THREE.PointLight(0x38bdf8, 3.5, 18);
    heliSpot.position.set(0, 4.5, 1);

    heli.add(body, nose, tail, tailFin, skidL, skidR, mast, this.rotor, heliSpot);
    heli.position.set(0, 0, -5.5);
    heli.rotation.y = 0.55;
    this.scene.add(heli);

    // Bright Island Floodlights so characters & gear shine clearly
    const islandFill = new THREE.PointLight(0xffffff, 2.2, 26);
    islandFill.position.set(0, 5.5, 5.5);
    this.scene.add(islandFill);

        // Touch Joystick & Swipe Look for Spawn Island (Multi-touch safe)
    const lookZone = document.getElementById('lobby-look-zone');
    let lookId = null, lastX = 0;
    if (lookZone) {
      lookZone.addEventListener('touchstart', (e) => {
        const t = e.changedTouches[0];
        lookId = t.identifier; lastX = t.clientX;
      }, { passive: true });
      lookZone.addEventListener('touchmove', (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === lookId) {
            this.localPos.yaw -= (t.clientX - lastX) * 0.008;
            lastX = t.clientX;
          }
        }
      }, { passive: true });
      lookZone.addEventListener('touchend', (e) => {
        for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null;
      }, { passive: true });
    }

    const joyZone = document.getElementById('lobby-joy-zone');
    const stick = document.getElementById('lobby-joy-stick');
    let joyId = null;
    if (joyZone && stick) {
      const updateJoy = (t) => {
        const r = joyZone.getBoundingClientRect();
        let dx = t.clientX - (r.left + r.width / 2);
        let dy = t.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy);
        if (d > 34) { dx = (dx / d) * 34; dy = (dy / d) * 34; }
        stick.style.transform = `translate(${dx}px, ${dy}px)`;
        this.joy.dx = dx / 34;
        this.joy.dy = dy / 34;
      };
      joyZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const t = e.changedTouches[0];
        joyId = t.identifier;
        this.joy.active = true;
        updateJoy(t);
      }, { passive: false });
      joyZone.addEventListener('touchmove', (e) => {
        if (!this.joy.active) return;
        e.preventDefault();
        e.stopPropagation();
        for (const t of e.changedTouches) {
          if (t.identifier === joyId) updateJoy(t);
        }
      }, { passive: false });
      const endJoy = (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === joyId) {
            joyId = null;
            this.joy.active = false;
            this.joy.dx = 0;
            this.joy.dy = 0;
            stick.style.transform = 'translate(0,0)';
          }
        }
      };
      joyZone.addEventListener('touchend', endJoy);
      joyZone.addEventListener('touchcancel', endJoy);
    }

        window.addEventListener('keydown', (e) => {
      if (document.activeElement && ['INPUT', 'SELECT'].includes(document.activeElement.tagName)) return;
      this.keys[e.code] = true;
      if (e.code === 'KeyR') document.getElementById('ready-toggle-btn')?.click();
      if (e.code === 'Enter') document.getElementById('start-game-btn')?.click();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    // PC Mouse Look on Spawn Island (Pointer Lock + Click-Drag fallback)
    if (lookZone) {
      let mouseDown = false;
      lookZone.addEventListener('mousedown', (e) => {
        mouseDown = true;
        if (document.pointerLockElement !== lookZone && lookZone.requestPointerLock) {
          lookZone.requestPointerLock().catch?.(() => {});
        }
      });
      window.addEventListener('mouseup', () => { mouseDown = false; });
      window.addEventListener('mousemove', (e) => {
        if (!this.running || document.getElementById('lobby-screen').classList.contains('hidden')) return;
        if (document.pointerLockElement === lookZone || mouseDown) {
          this.localPos.yaw -= e.movementX * 0.0032;
        }
      });
    }

    // Bind Role Selector & Ready Toggle
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
        readyBtn.textContent = me.ready ? '✅ READY' : '⏳ WAIT';
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
    const active = new Set();
    const list = Object.values(players || {});
    list.forEach((p, idx) => {
      active.add(p.id);
      const old = this.avatars[p.id];
      if (!old || old.role !== p.role || old.ready !== p.ready) {
        if (old) this.scene.remove(old.grp);
        const built = buildTacticalCharacter(p, true);
        const startX = p.lx ?? (-2.4 + idx * 1.6);
        const startZ = p.lz ?? 4.5;
        built.grp.position.set(startX, 0, startZ);
        this.scene.add(built.grp);
        this.avatars[p.id] = { ...built, role: p.role, ready: p.ready, prevX: startX, prevZ: startZ };
      }
    });
    for (const id of Object.keys(this.avatars)) {
      if (!active.has(id)) {
        this.scene.remove(this.avatars[id].grp);
        delete this.avatars[id];
      }
    }
  },

  updateCameraAspect() {
    if (!this.camera || !this.renderer) return;
    const w = window.innerWidth, h = window.innerHeight;
    if (Math.abs(this.camera.aspect - w / h) > 0.01) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    }
  },

  animate() {
    this.updateCameraAspect();
    if (!this.running) return;
    requestAnimationFrame(() => this.animate());
    if (document.getElementById('lobby-screen').classList.contains('hidden')) {
      this.running = false;
      return;
    }

    if (this.rotor) this.rotor.rotation.y += 0.25;

    const me = Net.players[Net.myId];
    if (me) {
      if (!this.avatars[Net.myId]) this.syncSquad(Net.players);
      let fwd = 0, str = 0;
      if (this.keys['KeyW'] || this.keys['ArrowUp']) fwd += 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) fwd -= 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) str -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) str += 1;
      if (this.joy.active) { fwd -= this.joy.dy; str += this.joy.dx; }

      const sin = Math.sin(this.localPos.yaw), cos = Math.cos(this.localPos.yaw);
      const mx = (-fwd * sin + str * cos);
      const mz = (-fwd * cos - str * sin);
      const len = Math.hypot(mx, mz);
      if (len > 0.05) {
        const nx = this.localPos.x + (mx / len) * 0.12;
        const nz = this.localPos.z + (mz / len) * 0.12;
        if (Math.hypot(nx, nz) < 15.5) {
          this.localPos.x = nx;
          this.localPos.z = nz;
        }
        me.lyaw = Math.atan2(-mx, -mz);
      } else {
        me.lyaw = me.lyaw ?? this.localPos.yaw;
      }
      me.lx = this.localPos.x;
      me.lz = this.localPos.z;

      // Frame Character in center of screen with Helicopter & Island in background
      const camDist = window.innerHeight > window.innerWidth ? 5.2 : 3.8;
      this.camera.position.set(
        this.localPos.x + Math.sin(this.localPos.yaw) * camDist,
        2.15,
        this.localPos.z + Math.cos(this.localPos.yaw) * camDist
      );
      this.camera.lookAt(this.localPos.x, 1.15, this.localPos.z);

      const now = performance.now();
      if (now - this.lastSync > 65) {
        this.lastSync = now;
        const pkt = { type: 'LOBBY_MOVE', id: Net.myId, lx: me.lx, lz: me.lz, lyaw: me.lyaw };
        if (Net.isHost) Net.broadcast(pkt); else Net.sendToHost(pkt);
      }
    } else {
      // Orbit camera before room creation
      const t = performance.now() * 0.0004;
      this.camera.position.set(Math.sin(t) * 11, 4.2, Math.cos(t) * 11);
      this.camera.lookAt(0, 1.2, -2);
    }

    // Update & Animate all squadmates walking around Spawn Island
    for (const p of Object.values(Net.players || {})) {
      const av = this.avatars[p.id];
      if (!av) continue;
      const tx = p.lx ?? av.grp.position.x;
      const tz = p.lz ?? av.grp.position.z;
      const moved = Math.hypot(tx - av.prevX, tz - av.prevZ) > 0.01;
      av.prevX = tx; av.prevZ = tz;
      av.grp.position.x = THREE.MathUtils.lerp(av.grp.position.x, tx, 0.3);
      av.grp.position.z = THREE.MathUtils.lerp(av.grp.position.z, tz, 0.3);
      av.grp.rotation.y = p.lyaw ?? 0;
      if (typeof Game3D !== 'undefined' && Game3D.animateCharacterLimbs) {
        Game3D.animateCharacterLimbs(av, moved);
      }
    }

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
  hunter: { x: 32, z: -32, yaw: 0, mesh: null, limbs: null, walkCycle: 0, stunnedUntil: 0, stuckFrames: 0, aiState: 'PATROL', goalX: 28, goalZ: 24, scanUntil: 0, investigateUntil: 0 },
  level: 1,
  battery: 100,
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
        playerPos: me ? { x: me.x, z: me.z } : { x: -18, z: 18 },
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
    this.inCutscene = true;
    const overlay = document.getElementById('cutscene-overlay');
    const hud = document.getElementById('hud');
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
      this.stunCharges = 2;
      document.getElementById('stun-status').textContent = '🔫 2/2';
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

    this.hemiLight = new THREE.HemisphereLight(0x334155, 0x05080f, 0.08);
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

    window.addEventListener('resize', () => {
      if (!this.renderer || !this.camera) return;
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    if (!this.animStarted) {
      this.animStarted = true;
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

    const floorTex = makeTexture('floor', lvl);
    floorTex.repeat.set(22, 22);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 }));
    floor.rotation.x = -Math.PI / 2;
    this.mapGroup.add(floor);

    const wallTex = makeTexture('wall', lvl);
    const wallHeight = lvl === 3 ? 2.0 : 4.2;
    this.addWall(0, -40, 80, 1.2, wallTex, wallHeight);
    this.addWall(0, 40, 80, 1.2, wallTex, wallHeight);
    this.addWall(-40, 0, 1.2, 80, wallTex, wallHeight);
    this.addWall(40, 0, 1.2, 80, wallTex, wallHeight);

    if (lvl === 1) {
      this.scene.background = new THREE.Color(0x020408);
      this.scene.fog = new THREE.FogExp2(0x020408, 0.052);

      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: makeTexture('ceil'), side: THREE.DoubleSide }));
      ceil.rotation.x = Math.PI / 2; ceil.position.y = 4.2;
      this.mapGroup.add(ceil);

      // Spacious Lab Wings & Corridors (wide doorways so player & monster never get stuck)
      this.addWall(-16, 18, 22, 0.9, wallTex);
      this.addWall(16, 18, 22, 0.9, wallTex);
      this.addWall(-18, -10, 0.9, 24, wallTex);
      this.addWall(14, -12, 24, 0.9, wallTex);
      this.addWall(24, 4, 0.9, 20, wallTex);
      this.addWall(-4, -26, 20, 0.9, wallTex);
      this.addWall(0, 2, 12, 0.9, wallTex);

      // 8 Safe Lockers spread across all sectors
      this.addSafeLockers([
        { x: -34, z: 24 }, { x: -34, z: 4 }, { x: -8, z: 12 }, { x: 8, z: 12 },
        { x: 18, z: -20 }, { x: 34, z: 22 }, { x: -12, z: -32 }, { x: 34, z: -8 }
      ]);

      // Stage 1: Power Fuse & Main Generator
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

      // Stage 2 (NEW): 3 Encrypted Data Drives + Main Server Console
      const driveSpots = [{ x: -32, z: -20 }, { x: 6, z: -6 }, { x: 32, z: 28 }];
      driveSpots.forEach((ds, idx) => {
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

      // Stage 3: Dr. Verma Logs & 3 Security Terminals
      const logTexts = [
        'Dr. Verma Log #1: Subject-0 tracks flashlight beams & sprinting footsteps. Terminal #1 code:',
        'Dr. Verma Log #2: Upload all 3 Purple Data Drives at the North Server first! Terminal #2 code:',
        'Dr. Verma Log #3: Final override code for Terminal #3 before Bio-Reactor elevator:'
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
      this.scene.background = new THREE.Color(0x090203);
      this.scene.fog = new THREE.FogExp2(0x090203, 0.048);

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
        { x: -35, z: -12 }, { x: -35, z: 12 }, { x: 35, z: -12 }, { x: 35, z: 12 },
        { x: -12, z: -35 }, { x: 12, z: 35 }
      ]);

      // Stage 1 (NEW): 2 Golden Override Keycards + Reactor Control Switch
      const cardSpots = [{ x: -28, z: 28 }, { x: 28, z: -28 }];
      cardSpots.forEach((cs, idx) => {
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

      // Stage 2: 6 Overheating Coolant Valves
      this.addLaserGrid(-16, 0, 6.5, 0.12);
      this.addLaserGrid(16, 0, 6.5, 0.12);
      const valveSpots = [
        { x: -31, z: -31 }, { x: 31, z: -31 }, { x: -31, z: 31 },
        { x: 31, z: 31 }, { x: -31, z: 0 }, { x: 31, z: 0 }
      ];
      valveSpots.forEach((vs, idx) => {
        const stand = new THREE.Mesh(
          new THREE.CylinderGeometry(0.75, 0.85, 1.35, 14),
          new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 })
        );
        stand.position.set(vs.x, 0.675, vs.z);
        const wheel = new THREE.Mesh(
          new THREE.TorusGeometry(0.5, 0.1, 10, 20),
          new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.95 })
        );
        wheel.position.set(vs.x, 1.5, vs.z);
        const vLight = new THREE.PointLight(0xef4444, 1.8, 8);
        vLight.position.set(vs.x, 2.1, vs.z);
        this.mapGroup.add(stand, wheel, vLight);
        this.valves.push({ x: vs.x, z: vs.z, idx, fixed: false, wheel, light: vLight });
      });

      this.createExitDoorWithBeacon(0, -39.2);

    } else if (lvl === 3) {
      this.scene.background = new THREE.Color(0x060b16);
      this.scene.fog = new THREE.FogExp2(0x060b16, 0.016);

      const padOuter = new THREE.Mesh(
        new THREE.RingGeometry(4.8, 5.6, 36),
        new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
      );
      padOuter.rotation.x = -Math.PI / 2;
      padOuter.position.y = 0.03;

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

      const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.5, 4.4), hullMat);
      body.position.y = 1.25;
      const nose = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.15, 1.4), glassMat);
      nose.position.set(0, 1.15, -2.35);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.55, 3.4), hullMat);
      tail.position.set(0, 1.45, 3.5);
      const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 0.75), darkMat);
      tailFin.position.set(0, 1.9, 4.9);

      const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 4.0), darkMat);
      skidL.position.set(-1.1, 0.08, -0.2);
      const skidR = skidL.clone(); skidR.position.x = 1.1;

      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.45, 10), darkMat);
      mast.position.set(0, 2.15, 0);
      const rotor = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.08, 0.36), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      rotor.position.set(0, 2.38, 0);

      const searchLight = new THREE.PointLight(0xfacc15, 5.5, 28);
      searchLight.position.set(0, 0.5, 0);

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
        new THREE.MeshStandardMaterial({
          color: isBat ? 0x22c55e : 0xc084fc,
          emissive: isBat ? 0x16a34a : 0x9333ea,
          emissiveIntensity: 1.2
        })
      );
      mesh.position.set(ps.x, 0.65, ps.z);
      this.mapGroup.add(mesh);
      this.pickups.push({ ...ps, mesh, taken: false });
    });

    [
      { x: -24, z: 24 }, { x: 24, z: 24 }, { x: -24, z: -24 }, { x: 24, z: -24 }
    ].forEach(lc => {
      const pLight = new THREE.PointLight(lvl === 2 ? 0xfb923c : 0x64748b, lvl === 3 ? 0.55 : 0.14, 18);
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
    bindInstantTouch('interact-btn', () => this.interact());
    bindInstantTouch('stun-btn', () => this.fireStun());
    bindInstantTouch('cam-toggle-btn', () => {
      this.thirdPerson = !this.thirdPerson;
      document.getElementById('cam-toggle-btn').textContent = this.thirdPerson ? '🎥 3RD' : '🎥 1ST';
    });
    bindInstantTouch('mic-btn', () => Net.toggleMic());

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
    } else if (act.type === 'DRIVE') {
      act.drive.taken = true;
      act.drive.mesh.visible = false;
      act.drive.light.visible = false;
      this.drivesCollected++;
      this.stats.objectives++;
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
      this.keycardsCollected++;
      this.stats.objectives++;
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
    if (this.hemiLight) this.hemiLight.intensity = 0.22;
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
    this.buildLevelMap(2);
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

    const spawns = [{ x: -18, z: 18 }, { x: -16, z: 18 }, { x: -18, z: 16 }, { x: -16, z: 16 }];
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

      if ((me.boarded || this.heliTakeoff) && this.chopperGroup) {
        specBar.classList.add('hidden');
        hint.classList.add('hidden');
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
          } else if (this.level === 2) {
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
            if (this.level === 3) {
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
          const mSpeed = this.level === 3 ? 0.086 : 0.072;
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
