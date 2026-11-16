// Synthesized Horror Sound Engine (No external audio files needed)
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
    if (now - this.lastStep < (sprinting ? 230 : 370)) return;
    this.lastStep = now;
    this.tone(sprinting ? 110 : 85, 'triangle', 0.06, 0.05);
  },
  heartbeat(dist) {
    const now = performance.now();
    const interval = Math.max(280, dist * 2.4);
    if (now - this.lastBeat < interval) return;
    this.lastBeat = now;
    this.tone(58, 'sine', 0.14, 0.18);
    setTimeout(() => this.tone(48, 'sine', 0.18, 0.14), 130);
    navigator.vibrate?.(45);
  }
};

const Game = {
  canvas: document.getElementById('game-canvas'),
  ctx: null,
  running: false,
  codes: ['123', '456', '789'],
  activeLockIdx: -1,
  enteredPin: '',
  sprinting: false,
  stamina: 100,
  joy: { x: 0, y: 0, active: false },

  worldW: 1500,
  worldH: 1100,
  walls: [
    { x: 0, y: 0, w: 1500, h: 32 },
    { x: 0, y: 1068, w: 1500, h: 32 },
    { x: 0, y: 0, w: 32, h: 1100 },
    { x: 1468, y: 0, w: 32, h: 1100 },
    // Bunker Rooms & Corridors
    { x: 320, y: 32, w: 28, h: 350 },
    { x: 320, y: 500, w: 28, h: 568 },
    { x: 700, y: 210, w: 28, h: 590 },
    { x: 700, y: 210, w: 390, h: 28 },
    { x: 1062, y: 370, w: 28, h: 698 },
    { x: 348, y: 760, w: 220, h: 28 },
    { x: 1090, y: 650, w: 220, h: 28 }
  ],

  // Secret Notes scattered in dark rooms (Players MUST find them!)
  notes: [],

  // Hiding Lockers (Safe from Shadow Hunter when inside)
  lockers: [
    { x: 260, y: 440 },
    { x: 640, y: 490 },
    { x: 1130, y: 310 }
  ],

  terminals: [
    { id: 0, x: 210, y: 920, unlocked: false, label: 'LOCK #1' },
    { id: 1, x: 900, y: 310, unlocked: false, label: 'LOCK #2' },
    { id: 2, x: 1340, y: 940, unlocked: false, label: 'LOCK #3' }
  ],

  exitGate: { x: 1360, y: 120, r: 46 },
  hunter: { x: 950, y: 720, angle: 0, chasing: false, patrolAngle: 0 },

  start(codes, notePositions) {
    this.codes = codes;
    const logs = [
      'बंकर जनरेटर फेल हो गया है। सिक्योरिटी गेट #1 का ओवरराइड कोड नीचे दर्ज है:',
      'Shadow Hunter रोशनी और कदमों की आवाज़ से शिकार करता है! गेट #2 का कोड:',
      'अगर वो पीछे पड़े तो मेटल लॉकर में छुप जाना! आखिरी गेट #3 का कोड:'
    ];

    this.notes = notePositions.map((pos, i) => ({
      id: i,
      x: pos.x,
      y: pos.y,
      found: false,
      title: `CLASSIFIED NOTE #${i + 1}`,
      text: logs[i],
      code: codes[i]
    }));

    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    const me = Net.players[Net.myId];
    document.getElementById('role-badge').textContent = me.role;

    this.setupControls();
    this.running = true;
    requestAnimationFrame(() => this.loop());
  },

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  setupControls() {
    const zone = document.getElementById('joystick-zone');
    const stick = document.getElementById('joystick-stick');
    const maxR = 36;

    const handleTouch = (e) => {
      e.preventDefault();
      SFX.init();
      const touch = e.touches[0];
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

    zone.addEventListener('touchstart', handleTouch, { passive: false });
    zone.addEventListener('touchmove', handleTouch, { passive: false });
    zone.addEventListener('touchend', () => {
      stick.style.transform = 'translate(0px, 0px)';
      this.joy = { x: 0, y: 0, active: false };
    });

    // Sprint Button
    const sprintBtn = document.getElementById('sprint-btn');
    sprintBtn.addEventListener('touchstart', (e) => { e.preventDefault(); SFX.init(); this.sprinting = true; });
    sprintBtn.addEventListener('touchend', () => { this.sprinting = false; });

    // Torch Toggle
    document.getElementById('torch-btn').addEventListener('click', (e) => {
      SFX.init();
      const me = Net.players[Net.myId];
      if (!me || me.downed || me.hiding) return;
      me.torch = !me.torch;
      SFX.tone(600, 'square', 0.04, 0.06);
      e.currentTarget.classList.toggle('torch-on', me.torch);
    });

    // Interact Button (Read Secret Note / Hide in Locker / Unlock Terminal / Revive)
    document.getElementById('interact-btn').addEventListener('click', () => {
      SFX.init();
      const me = Net.players[Net.myId];
      if (!me || me.downed) return;

      // 1. Toggle Hiding inside nearby Locker
      if (me.hiding) {
        me.hiding = false;
        me.torch = true;
        document.getElementById('objective-banner').textContent = 'आप लॉकर से बाहर आ गए हैं';
        return;
      }
      for (const lk of this.lockers) {
        if (Math.hypot(lk.x - me.x, lk.y - me.y) < 58) {
          me.hiding = true;
          me.torch = false;
          me.x = lk.x;
          me.y = lk.y;
          SFX.tone(180, 'sawtooth', 0.12, 0.08);
          document.getElementById('objective-banner').textContent = '🔒 लॉकर के अंदर छुपे हैं (USE दबाकर बाहर आएं)';
          return;
        }
      }

      // 2. Inspect Secret Note
      for (const note of this.notes) {
        if (Math.hypot(note.x - me.x, note.y - me.y) < 60) {
          note.found = true;
          SFX.tone(520, 'sine', 0.1, 0.08);
          document.getElementById('note-title').textContent = note.title;
          document.getElementById('note-body').textContent = note.text;
          document.getElementById('note-code-reveal').textContent = note.code;
          document.getElementById('note-modal').classList.remove('hidden');
          const foundCount = this.notes.filter(n => n.found).length;
          document.getElementById('objective-banner').textContent = `📄 Notes मिले: ${foundCount}/3`;
          return;
        }
      }

      // 3. Revive Downed Teammate
      for (const p of Object.values(Net.players)) {
        if (p.id !== Net.myId && p.downed && Math.hypot(p.x - me.x, p.y - me.y) < 65) {
          p.downed = false;
          if (!Net.isHost) Net.sendToHost({ type: 'REVIVE', targetId: p.id });
          this.showRadioToast('SYSTEM', `${p.name} को बचा लिया गया!`);
          return;
        }
      }

      // 4. Open Security Terminal Keypad
      this.terminals.forEach((t, idx) => {
        if (!t.unlocked && Math.hypot(t.x - me.x, t.y - me.y) < 65) {
          this.openKeypad(idx);
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
        if (k.classList.contains('clear')) {
          this.enteredPin = '';
        } else if (this.enteredPin.length < 3) {
          this.enteredPin += val;
        }
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
            document.getElementById('keypad-display').textContent = 'WRONG';
          }
        }
      });
    });
  },

  openKeypad(idx) {
    this.activeLockIdx = idx;
    this.enteredPin = '';
    document.getElementById('puzzle-title').textContent = `SECURITY LOCK #${idx + 1}`;
    document.getElementById('keypad-display').textContent = '_ _ _';
    document.getElementById('puzzle-modal').classList.remove('hidden');
  },

  unlockTerminal(idx) {
    if (this.terminals[idx]) this.terminals[idx].unlocked = true;
    const count = this.terminals.filter(t => t.unlocked).length;
    document.getElementById('locks-status').textContent = `🔒 LOCKS: ${count}/3`;
    this.showRadioToast('SYSTEM', `🔓 Security Lock #${idx + 1} अनलॉक हो गया!`);
    if (count === 3) {
      document.getElementById('objective-banner').textContent = '🚪 मुख्य EXIT GATE खुल गया है! बाहर भागो!';
    }
  },

  showRadioToast(sender, msg) {
    const toast = document.getElementById('radio-toast');
    toast.textContent = `${sender}: ${msg}`;
    toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.add('hidden'), 3400);
  },

  collidesWall(nx, ny, r = 16) {
    return this.walls.some(w =>
      nx + r > w.x && nx - r < w.x + w.w && ny + r > w.y && ny - r < w.y + w.h
    );
  },

  update() {
    const me = Net.players[Net.myId];
    if (!me) return;

    // Stamina & Movement
    if (!me.downed && !me.hiding && this.joy.active) {
      const canSprint = this.sprinting && this.stamina > 5;
      if (canSprint) this.stamina = Math.max(0, this.stamina - 0.55);
      else this.stamina = Math.min(100, this.stamina + 0.25);

      const baseSpeed = me.role === 'SCOUT' ? 3.2 : 2.7;
      const speed = canSprint ? baseSpeed * 1.48 : baseSpeed;
      const nx = me.x + this.joy.x * speed;
      const ny = me.y + this.joy.y * speed;
      if (!this.collidesWall(nx, me.y)) me.x = nx;
      if (!this.collidesWall(me.x, ny)) me.y = ny;
      me.angle = Math.atan2(this.joy.y, this.joy.x);
      me.walkPhase += canSprint ? 0.28 : 0.16;
      SFX.step(canSprint);
    } else {
      this.stamina = Math.min(100, this.stamina + 0.35);
    }

    // Host updates Shadow Hunter AI
    if (Net.isHost) {
      let nearest = null;
      let minDist = 9999;

      Object.values(Net.players).forEach(p => {
        if (p.downed || p.hiding) return; // Hidden players cannot be detected!
        const d = Math.hypot(p.x - this.hunter.x, p.y - this.hunter.y);
        const detectRange = p.torch ? 360 : 130;
        if (d < detectRange && d < minDist) {
          minDist = d;
          nearest = p;
        }
      });

      if (nearest) {
        this.hunter.chasing = true;
        this.hunter.angle = Math.atan2(nearest.y - this.hunter.y, nearest.x - this.hunter.x);
        const hx = this.hunter.x + Math.cos(this.hunter.angle) * 2.55;
        const hy = this.hunter.y + Math.sin(this.hunter.angle) * 2.55;
        if (!this.collidesWall(hx, this.hunter.y, 18)) this.hunter.x = hx;
        if (!this.collidesWall(this.hunter.x, hy, 18)) this.hunter.y = hy;

        if (minDist < 28) {
          nearest.downed = true;
        }
      } else {
        this.hunter.chasing = false;
        this.hunter.patrolAngle += 0.014;
        this.hunter.angle = this.hunter.patrolAngle;
        const px = this.hunter.x + Math.cos(this.hunter.patrolAngle) * 1.45;
        const py = this.hunter.y + Math.sin(this.hunter.patrolAngle) * 1.45;
        if (!this.collidesWall(px, py, 18)) {
          this.hunter.x = px;
          this.hunter.y = py;
        } else {
          this.hunter.patrolAngle += Math.PI / 2;
        }
      }

      const allPlayers = Object.values(Net.players);
      if (allPlayers.length > 0 && allPlayers.every(p => p.downed)) {
        Net.broadcast({ type: 'GAMEOVER', win: false, reason: 'Shadow Hunter ने पूरी टीम को अंधेरे में खत्म कर दिया!' });
        this.triggerEnd(false, 'Shadow Hunter ने पूरी टीम को अंधेरे में खत्म कर दिया!');
      }

      const allUnlocked = this.terminals.every(t => t.unlocked);
      const atExit = allPlayers.some(p => !p.downed && Math.hypot(p.x - this.exitGate.x, p.y - this.exitGate.y) < 58);
      if (allUnlocked && atExit) {
        Net.broadcast({ type: 'GAMEOVER', win: true, reason: 'आपकी टीम ने सभी सीक्रेट कोड डिकोड किए और बंकर से बच निकले!' });
        this.triggerEnd(true, 'आपकी टीम ने सभी सीक्रेट कोड डिकोड किए और बंकर से बच निकले!');
      }

      Net.broadcast({ type: 'STATE', players: Net.players, hunter: this.hunter });
    } else {
      Net.sendToHost({
        type: 'MOVE',
        id: Net.myId,
        state: { x: me.x, y: me.y, angle: me.angle, torch: me.torch, hiding: me.hiding, walkPhase: me.walkPhase }
      });
    }

    // Heartbeat & Red Danger Vignette
    const hunterDist = Math.hypot(me.x - this.hunter.x, me.y - this.hunter.y);
    const overlay = document.getElementById('danger-overlay');
    if (hunterDist < 310 && !me.hiding) {
      const intensity = Math.floor((1 - hunterDist / 310) * 110);
      overlay.style.boxShadow = `inset 0 0 ${intensity}px rgba(220, 38, 38, 0.9)`;
      SFX.heartbeat(hunterDist);
    } else {
      overlay.style.boxShadow = 'none';
    }
  },

  drawAgent(ctx, p) {
    if (p.hiding) return;
    ctx.save();
    ctx.translate(p.x, p.y);

    // Name tag above head
    ctx.fillStyle = p.downed ? '#94a3b8' : '#f8fafc';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.downed ? `${p.name} [DOWN]` : p.name, 0, -26);

    ctx.rotate(p.angle);

    // Animated feet
    const stride = Math.sin(p.walkPhase || 0) * 6;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-6 + stride, -11, 8, 5);
    ctx.fillRect(-6 - stride, 6, 8, 5);

    // Tactical Jacket / Shoulders
    ctx.fillStyle = p.downed ? '#475569' : p.color;
    ctx.beginPath();
    ctx.roundRect(-10, -14, 20, 28, 7);
    ctx.fill();

    // Head & Helmet
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(2, 0, 9, 0, Math.PI * 2);
    ctx.fill();

    // Flashlight held in right hand
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(8, 7, 10, 4);
    if (p.torch && !p.downed) {
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(19, 9, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  drawHunter(ctx) {
    const h = this.hunter;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.angle);

    // Dark Shadow Aura
    const aura = ctx.createRadialGradient(0, 0, 6, 0, 0, 38);
    aura.addColorStop(0, 'rgba(220, 38, 38, 0.7)');
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 38, 0, Math.PI * 2);
    ctx.fill();

    // Monster Body & Claws
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(10, -12); ctx.lineTo(24, -16);
    ctx.moveTo(10, 12); ctx.lineTo(24, 16);
    ctx.stroke();

    // Glowing Red Eyes
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(9, -5, 3, 0, Math.PI * 2);
    ctx.arc(9, 5, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const me = Net.players[Net.myId];
    if (!me) return;

    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    const camX = w / 2 - me.x;
    const camY = h / 2 - me.y;
    ctx.translate(camX, camY);

    // Metallic Bunker Floor Tiles
    ctx.fillStyle = '#0f1623';
    ctx.fillRect(0, 0, this.worldW, this.worldH);
    ctx.strokeStyle = '#182234';
    ctx.lineWidth = 1;
    for (let x = 0; x <= this.worldW; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.worldH); ctx.stroke();
    }
    for (let y = 0; y <= this.worldH; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.worldW, y); ctx.stroke();
    }

    // Hiding Metal Lockers
    this.lockers.forEach(lk => {
      ctx.fillStyle = '#334155';
      ctx.fillRect(lk.x - 18, lk.y - 18, 36, 36);
      ctx.strokeStyle = '#64748b';
      ctx.strokeRect(lk.x - 18, lk.y - 18, 36, 36);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LOCKER', lk.x, lk.y + 3);
    });

    // Hidden Secret Notes on Desks/Floor
    this.notes.forEach(n => {
      ctx.fillStyle = n.found ? '#4ade80' : '#fef08a';
      ctx.fillRect(n.x - 11, n.y - 14, 22, 28);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DOC', n.x, n.y + 3);
    });

    // Exit Gate
    const allUnlocked = this.terminals.every(t => t.unlocked);
    ctx.fillStyle = allUnlocked ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.22)';
    ctx.beginPath();
    ctx.arc(this.exitGate.x, this.exitGate.y, this.exitGate.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(allUnlocked ? 'EXIT OPEN' : 'EXIT SEALED', this.exitGate.x, this.exitGate.y + 4);

    // Security Terminals
    this.terminals.forEach(t => {
      ctx.fillStyle = t.unlocked ? '#16a34a' : '#d97706';
      ctx.fillRect(t.x - 16, t.y - 16, 32, 32);
      ctx.fillStyle = '#fff';
      ctx.fillText(t.label, t.x, t.y - 22);
    });

    // Reinforced Bunker Walls
    this.walls.forEach(wall => {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
    });

    this.drawHunter(ctx);
    Object.values(Net.players).forEach(p => this.drawAgent(ctx, p));

    ctx.restore();

    // Pitch Black Darkness + Flashlight Cone
    const darkCanvas = document.createElement('canvas');
    darkCanvas.width = w;
    darkCanvas.height = h;
    const dCtx = darkCanvas.getContext('2d');

    dCtx.fillStyle = 'rgba(1, 3, 8, 0.97)';
    dCtx.fillRect(0, 0, w, h);

    dCtx.globalCompositeOperation = 'destination-out';
    Object.values(Net.players).forEach(p => {
      const sx = p.x + camX;
      const sy = p.y + camY;

      const auraR = p.hiding ? 45 : 62;
      const aura = dCtx.createRadialGradient(sx, sy, 8, sx, sy, auraR);
      aura.addColorStop(0, 'rgba(0,0,0,1)');
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      dCtx.fillStyle = aura;
      dCtx.beginPath();
      dCtx.arc(sx, sy, auraR, 0, Math.PI * 2);
      dCtx.fill();

      if (p.torch && !p.downed && !p.hiding) {
        const range = p.role === 'SCOUT' ? 330 : 260;
        const grad = dCtx.createRadialGradient(sx, sy, 12, sx, sy, range);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        dCtx.fillStyle = grad;
        dCtx.beginPath();
        dCtx.moveTo(sx, sy);
        dCtx.arc(sx, sy, range, p.angle - 0.42, p.angle + 0.42);
        dCtx.closePath();
        dCtx.fill();
      }
    });

    ctx.drawImage(darkCanvas, 0, 0);

    // Stamina Bar at bottom center
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fillRect(w / 2 - 60, h - 18, 120, 6);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(w / 2 - 60, h - 18, (this.stamina / 100) * 120, 6);
  },

  triggerEnd(win, reason) {
    this.running = false;
    document.getElementById('end-title').textContent = win ? '🎉 BUNKER ESCAPED!' : '💀 SQUAD WIPED OUT';
    document.getElementById('end-title').style.color = win ? '#4ade80' : '#ef4444';
    document.getElementById('end-desc').textContent = reason;
    document.getElementById('end-modal').classList.remove('hidden');
  },

  loop() {
    if (!this.running) return;
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }
};
