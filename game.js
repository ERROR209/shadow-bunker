const Game = {
  canvas: document.getElementById('game-canvas'),
  ctx: null,
  running: false,
  codes: ['123', '456', '789'],
  activeLockIdx: -1,
  enteredPin: '',
  joy: { x: 0, y: 0, active: false },

  worldW: 1400,
  worldH: 1000,
  walls: [
    { x: 0, y: 0, w: 1400, h: 30 },
    { x: 0, y: 970, w: 1400, h: 30 },
    { x: 0, y: 0, w: 30, h: 1000 },
    { x: 1370, y: 0, w: 30, h: 1000 },
    { x: 320, y: 30, w: 28, h: 340 },
    { x: 320, y: 490, w: 28, h: 480 },
    { x: 680, y: 220, w: 28, h: 560 },
    { x: 680, y: 220, w: 360, h: 28 },
    { x: 1020, y: 380, w: 28, h: 590 },
    { x: 348, y: 740, w: 210, h: 28 }
  ],

  terminals: [
    { id: 0, x: 220, y: 840, unlocked: false, label: 'LOCK #1' },
    { id: 1, x: 860, y: 330, unlocked: false, label: 'LOCK #2' },
    { id: 2, x: 1220, y: 850, unlocked: false, label: 'LOCK #3' }
  ],

  exitGate: { x: 1280, y: 120, r: 42 },
  hunter: { x: 920, y: 650, speed: 1.85, patrolAngle: 0 },

  start(codes, myClue) {
    this.codes = codes;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    const me = Net.players[Net.myId];
    document.getElementById('role-badge').textContent = me.role;
    document.getElementById('clue-banner').innerHTML = `YOUR CLUE: <strong>${myClue}</strong>`;

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

    document.getElementById('torch-btn').addEventListener('click', (e) => {
      const me = Net.players[Net.myId];
      if (!me || me.downed) return;
      me.torch = !me.torch;
      e.currentTarget.classList.toggle('torch-on', me.torch);
    });

    document.getElementById('interact-btn').addEventListener('click', () => {
      const me = Net.players[Net.myId];
      if (!me || me.downed) return;

      Object.values(Net.players).forEach(p => {
        if (p.id !== Net.myId && p.downed && Math.hypot(p.x - me.x, p.y - me.y) < 65) {
          p.downed = false;
          if (!Net.isHost) Net.sendToHost({ type: 'REVIVE', targetId: p.id });
          this.showRadioToast('SYSTEM', `${p.name} को Revive कर दिया गया!`);
        }
      });

      this.terminals.forEach((t, idx) => {
        if (!t.unlocked && Math.hypot(t.x - me.x, t.y - me.y) < 65) {
          this.openKeypad(idx);
        }
      });
    });

    document.querySelectorAll('.radio-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const me = Net.players[Net.myId];
        const msg = btn.dataset.msg;
        this.showRadioToast(me.name, msg);
        if (Net.isHost) Net.broadcast({ type: 'RADIO', sender: me.name, msg });
        else Net.sendToHost({ type: 'RADIO', sender: me.name, msg });
      });
    });

    document.querySelectorAll('.key').forEach(k => {
      k.addEventListener('click', () => {
        const val = k.textContent;
        if (k.classList.contains('close')) {
          document.getElementById('puzzle-modal').classList.add('hidden');
          return;
        }
        if (k.classList.contains('clear')) {
          this.enteredPin = '';
        } else if (this.enteredPin.length < 3) {
          this.enteredPin += val;
        }
        document.getElementById('keypad-display').textContent = this.enteredPin.padEnd(3, '_').split('').join(' ');

        if (this.enteredPin.length === 3) {
          if (this.enteredPin === this.codes[this.activeLockIdx]) {
            this.unlockTerminal(this.activeLockIdx);
            if (Net.isHost) Net.broadcast({ type: 'UNLOCK', lockIdx: this.activeLockIdx });
            else Net.sendToHost({ type: 'UNLOCK', lockIdx: this.activeLockIdx });
            document.getElementById('puzzle-modal').classList.add('hidden');
          } else {
            this.enteredPin = '';
            document.getElementById('keypad-display').textContent = 'ERR';
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
    document.getElementById('locks-status').textContent = `🔒 LOCKS: ${count} / 3`;
    this.showRadioToast('SYSTEM', `🔓 Security Lock #${idx + 1} खुल गया!`);
  },

  showRadioToast(sender, msg) {
    const toast = document.getElementById('radio-toast');
    toast.textContent = `${sender}: ${msg}`;
    toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
  },

  collidesWall(nx, ny, r = 16) {
    return this.walls.some(w =>
      nx + r > w.x && nx - r < w.x + w.w && ny + r > w.y && ny - r < w.y + w.h
    );
  },

  update() {
    const me = Net.players[Net.myId];
    if (!me) return;

    if (!me.downed && this.joy.active) {
      const speed = me.role === 'SCOUT' ? 3.5 : 2.9;
      const nx = me.x + this.joy.x * speed;
      const ny = me.y + this.joy.y * speed;
      if (!this.collidesWall(nx, me.y)) me.x = nx;
      if (!this.collidesWall(me.x, ny)) me.y = ny;
      me.angle = Math.atan2(this.joy.y, this.joy.x);
    }

    if (Net.isHost) {
      let nearest = null;
      let minDist = 9999;

      Object.values(Net.players).forEach(p => {
        if (p.downed) return;
        const d = Math.hypot(p.x - this.hunter.x, p.y - this.hunter.y);
        const detectRange = p.torch ? 340 : 140;
        if (d < detectRange && d < minDist) {
          minDist = d;
          nearest = p;
        }
      });

      if (nearest) {
        const ang = Math.atan2(nearest.y - this.hunter.y, nearest.x - this.hunter.x);
        const hx = this.hunter.x + Math.cos(ang) * 2.35;
        const hy = this.hunter.y + Math.sin(ang) * 2.35;
        if (!this.collidesWall(hx, this.hunter.y, 18)) this.hunter.x = hx;
        if (!this.collidesWall(this.hunter.x, hy, 18)) this.hunter.y = hy;

        if (minDist < 28) {
          nearest.downed = true;
        }
      } else {
        this.hunter.patrolAngle += 0.015;
        const px = this.hunter.x + Math.cos(this.hunter.patrolAngle) * 1.4;
        const py = this.hunter.y + Math.sin(this.hunter.patrolAngle) * 1.4;
        if (!this.collidesWall(px, py, 18)) {
          this.hunter.x = px;
          this.hunter.y = py;
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
      const atExit = allPlayers.some(p => !p.downed && Math.hypot(p.x - this.exitGate.x, p.y - this.exitGate.y) < 55);
      if (allUnlocked && atExit) {
        Net.broadcast({ type: 'GAMEOVER', win: true, reason: 'सभी 3 लॉक खुल गए और टीम सुरक्षित बाहर निकल गई!' });
        this.triggerEnd(true, 'सभी 3 लॉक खुल गए और टीम सुरक्षित बाहर निकल गई!');
      }

      Net.broadcast({ type: 'STATE', players: Net.players, hunter: this.hunter });
    } else {
      Net.sendToHost({
        type: 'MOVE',
        id: Net.myId,
        state: { x: me.x, y: me.y, angle: me.angle, torch: me.torch }
      });
    }

    const hunterDist = Math.hypot(me.x - this.hunter.x, me.y - this.hunter.y);
    const overlay = document.getElementById('danger-overlay');
    if (hunterDist < 280) {
      const intensity = Math.floor((1 - hunterDist / 280) * 90);
      overlay.style.boxShadow = `inset 0 0 ${intensity}px rgba(220, 38, 38, 0.85)`;
    } else {
      overlay.style.boxShadow = 'none';
    }
  },

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const me = Net.players[Net.myId];
    if (!me) return;

    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    const camX = w / 2 - me.x;
    const camY = h / 2 - me.y;
    ctx.translate(camX, camY);

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1;
    for (let x = 0; x <= this.worldW; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.worldH); ctx.stroke();
    }
    for (let y = 0; y <= this.worldH; y += 50) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.worldW, y); ctx.stroke();
    }

    const allUnlocked = this.terminals.every(t => t.unlocked);
    ctx.fillStyle = allUnlocked ? 'rgba(34, 197, 94, 0.28)' : 'rgba(239, 68, 68, 0.2)';
    ctx.beginPath();
    ctx.arc(this.exitGate.x, this.exitGate.y, this.exitGate.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(allUnlocked ? 'EXIT OPEN' : 'EXIT LOCKED', this.exitGate.x, this.exitGate.y + 4);

    this.terminals.forEach(t => {
      ctx.fillStyle = t.unlocked ? '#22c55e' : '#f59e0b';
      ctx.fillRect(t.x - 16, t.y - 16, 32, 32);
      ctx.fillStyle = '#fff';
      ctx.fillText(t.label, t.x, t.y - 22);
    });

    ctx.fillStyle = '#1e293b';
    this.walls.forEach(wall => ctx.fillRect(wall.x, wall.y, wall.w, wall.h));

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(this.hunter.x, this.hunter.y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fca5a5';
    ctx.fillText('HUNTER', this.hunter.x, this.hunter.y - 24);

    Object.values(Net.players).forEach(p => {
      ctx.fillStyle = p.downed ? '#64748b' : p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(p.downed ? `${p.name} (DOWN)` : p.name, p.x, p.y - 22);
    });

    ctx.restore();

    const darkCanvas = document.createElement('canvas');
    darkCanvas.width = w;
    darkCanvas.height = h;
    const dCtx = darkCanvas.getContext('2d');

    dCtx.fillStyle = 'rgba(2, 4, 10, 0.96)';
    dCtx.fillRect(0, 0, w, h);

    dCtx.globalCompositeOperation = 'destination-out';
    Object.values(Net.players).forEach(p => {
      const sx = p.x + camX;
      const sy = p.y + camY;

      const aura = dCtx.createRadialGradient(sx, sy, 10, sx, sy, 65);
      aura.addColorStop(0, 'rgba(0,0,0,1)');
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      dCtx.fillStyle = aura;
      dCtx.beginPath();
      dCtx.arc(sx, sy, 65, 0, Math.PI * 2);
      dCtx.fill();

      if (p.torch && !p.downed) {
        const range = p.role === 'SCOUT' ? 320 : 250;
        const grad = dCtx.createRadialGradient(sx, sy, 15, sx, sy, range);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        dCtx.fillStyle = grad;
        dCtx.beginPath();
        dCtx.moveTo(sx, sy);
        dCtx.arc(sx, sy, range, p.angle - 0.45, p.angle + 0.45);
        dCtx.closePath();
        dCtx.fill();
      }
    });

    ctx.drawImage(darkCanvas, 0, 0);
  },

  triggerEnd(win, reason) {
    this.running = false;
    document.getElementById('end-title').textContent = win ? '🎉 MISSION ESCAPED!' : '💀 SQUAD ELIMINATED';
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
