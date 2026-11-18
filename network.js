const Net = {
  peer: null,
  myId: null,
  isHost: false,
  roomCode: '',
  conns: [],
  hostConn: null,
  players: {},
  localStream: null,
  micEnabled: false,
  voiceLoud: false,
  isConnecting: false,
  squadColors: ['#38bdf8', '#4ade80', '#facc15', '#f472b6'],
  getPlayerColor(id) {
    const ids = Object.keys(this.players).sort();
    const idx = Math.max(0, ids.indexOf(id));
    return this.squadColors[idx % this.squadColors.length];
  },
  getPlayerNumber(id) {
    const ids = Object.keys(this.players).sort();
    return Math.max(1, ids.indexOf(id) + 1);
  },
  deployTimer: null,
  reconnectLoop: null,
  getDeviceUid() {
    let uid = sessionStorage.getItem('sb_device_uid');
    if (!uid) { uid = Math.random().toString(36).slice(2, 8).toUpperCase(); sessionStorage.setItem('sb_device_uid', uid); }
    return uid;
  },

  saveRoomSession(code, isHost, name) {
    try {
      sessionStorage.setItem('sb_active_room', JSON.stringify({ code, isHost, name, ts: Date.now() }));
    } catch (e) {}
  },

  clearRoomSession() {
    sessionStorage.removeItem('sb_active_room');
  },

  hideSetupCard() {
    const setupCard = document.getElementById('lobby-setup-card');
    if (setupCard) {
      setupCard.classList.add('hidden');
      setupCard.style.display = 'none';
    }
    const setupForm = document.getElementById('lobby-setup-form');
    if (setupForm) setupForm.classList.add('hidden');
    const actions = document.getElementById('lobby-actions');
    if (actions) actions.classList.add('hidden');
    document.getElementById('waiting-room')?.classList.remove('hidden');
  },

  initUI() {
    const createBtn = document.getElementById('create-room-btn');
    const joinBtn = document.getElementById('join-room-btn');
    const copyBtn = document.getElementById('copy-code-btn');
    const startBtn = document.getElementById('start-game-btn');

    if (createBtn) {
      createBtn.onclick = () => {
        if (this.isConnecting || this.roomCode) return;
        this.isConnecting = true;
        createBtn.disabled = true;
        if (joinBtn) joinBtn.disabled = true;
        const name = document.getElementById('player-name')?.value.trim() || ('Agent-' + Math.floor(10 + Math.random() * 89));
        this.createRoom(name);
      };
    }

    if (joinBtn) {
      joinBtn.onclick = () => {
        if (this.isConnecting || this.roomCode) return;
        const name = document.getElementById('player-name')?.value.trim() || ('Agent-' + Math.floor(10 + Math.random() * 89));
        const code = document.getElementById('room-code-input')?.value.trim().toUpperCase();
        if (!code || code.length < 4) return alert('Enter valid 4-letter Squad Code!');
        this.isConnecting = true;
        joinBtn.disabled = true;
        if (createBtn) createBtn.disabled = true;
        this.joinRoom(code, name);
      };
    }

    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard?.writeText(this.roomCode);
        copyBtn.textContent = 'COPIED!';
        setTimeout(() => (copyBtn.textContent = 'COPY'), 1500);
      };
    }

    if (startBtn) {
      startBtn.onclick = () => {
        if (!this.isHost || this.deployTimer) return;
        startBtn.disabled = true;
        let sec = 10;
        this.broadcast({ type: 'DEPLOY_COUNTDOWN', sec });
        this.showDeployCountdown(sec);
        this.deployTimer = setInterval(() => {
          sec--;
          if (sec > 0) {
            this.broadcast({ type: 'DEPLOY_COUNTDOWN', sec });
            this.showDeployCountdown(sec);
          } else {
            clearInterval(this.deployTimer);
            this.deployTimer = null;
            document.getElementById('deploy-countdown-banner')?.classList.add('hidden');
            const codes = [
              String(Math.floor(100 + Math.random() * 899)),
              String(Math.floor(100 + Math.random() * 899)),
              String(Math.floor(100 + Math.random() * 899))
            ];
            const pool = [
              { x: -28, z: -6 }, { x: -30, z: -28 }, { x: 4, z: 28 }, { x: 30, z: 8 },
              { x: -10, z: -30 }, { x: 26, z: -22 }, { x: -26, z: 12 }, { x: 14, z: 26 }
            ].sort(() => Math.random() - 0.5);
            const fuseSpot = pool[0];
            const noteSpots = [pool[1], pool[2], pool[3]];
            this.broadcast({ type: 'START', players: this.players, codes, noteSpots, fuseSpot });
            Game3D.start(codes, noteSpots, fuseSpot);
          }
        }, 1000);
      };
    }

    const manRecBtn = document.getElementById('manual-reconnect-btn');
    if (manRecBtn) {
      manRecBtn.onclick = () => {
        if (this.isHost || !this.roomCode) return;
        manRecBtn.textContent = '⏳ SYNCING...';
        this.reconnectToHost();
        setTimeout(() => { manRecBtn.textContent = '🔄 RECONNECT'; }, 2000);
      };
    }

    const roleSel = document.getElementById('role-select');
    const readyBtn = document.getElementById('ready-toggle-btn');
    if (roleSel) {
      roleSel.addEventListener('change', () => {
        const me = this.players[this.myId];
        if (!me) return;
        me.role = roleSel.value;
        this.updateSquadUI();
        const pkt = { type: 'ROLE_UPDATE', id: this.myId, role: me.role, ready: me.ready };
        if (this.isHost) this.broadcast(pkt); else this.sendToHost(pkt);
      });
    }
    if (readyBtn) {
      readyBtn.addEventListener('click', () => {
        const me = this.players[this.myId];
        if (!me) return;
        me.ready = !me.ready;
        readyBtn.textContent = me.ready ? '✅ READY' : '⏳ WAIT';
        readyBtn.style.background = me.ready ? '#16a34a' : '#b45309';
        this.updateSquadUI();
        const pkt = { type: 'ROLE_UPDATE', id: this.myId, role: me.role, ready: me.ready };
        if (this.isHost) this.broadcast(pkt); else this.sendToHost(pkt);
      });
    }
  },

  showDeployCountdown(sec) {
    const banner = document.getElementById('deploy-countdown-banner');
    const secEl = document.getElementById('deploy-sec');
    if (banner && secEl) {
      secEl.textContent = sec;
      banner.classList.remove('hidden');
    }
    if (typeof SFX !== 'undefined' && SFX.tone) {
      SFX.tone(sec <= 3 ? 880 : 560, 'sine', 0.14, 0.22);
    }
  },

  reconnectToHost() {
    if (this.isHost || !this.roomCode || !this.peer || this.peer.destroyed) return;
    const hostId = 'sb09_host_' + this.roomCode;
    if (this.hostConn && this.hostConn.open) {
      this.sendToHost({ type: 'JOIN', player: this.players[this.myId] });
      return;
    }
    try {
      const conn = this.peer.connect(hostId, { reliable: true });
      this.hostConn = conn;
      conn.on('open', () => {
        this.sendToHost({ type: 'JOIN', player: this.players[this.myId] });
      });
      conn.on('data', (data) => this.handleClientData(data));
    } catch (e) {}
  },

  createRoom(name) {
    this.isHost = true;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    this.roomCode = code;
    this.myId = 'sb09_host_' + code;

    this.players = {
      [this.myId]: {
        id: this.myId,
        name,
        role: document.getElementById('role-select')?.value || 'SCOUT',
        ready: true,
        x: -32, z: 32, yaw: 0,
        lx: -1.2, lz: 3.8, lyaw: 0,
        torch: true, downed: false, hiding: false, boarded: false
      }
    };

    document.getElementById('display-code').textContent = code;
    this.hideSetupCard();
    document.getElementById('start-game-btn')?.classList.remove('hidden');
    document.getElementById('wait-msg')?.classList.add('hidden');
    this.saveRoomSession(code, true, name);
    this.updateSquadUI();

    if (typeof Lobby3D !== 'undefined') {
      Lobby3D.init();
      Lobby3D.syncSquad(this.players);
    }

    if (typeof Peer !== 'undefined') {
      if (this.peer) this.peer.destroy();
      this.peer = new Peer(this.myId);
      this.peer.on('connection', (conn) => {
        this.conns.push(conn);
        conn.on('data', (data) => this.handleHostData(conn, data));
        conn.on('open', () => {
          conn.send({ type: 'SQUAD', players: this.players });
        });
        conn.on('close', () => {
          this.conns = this.conns.filter(c => c !== conn);
        });
      });
    }
  },

  joinRoom(rawCode, name) {
    const code = rawCode.trim().toUpperCase();
    this.isHost = false;
    this.roomCode = code;
    this.myId = 'sb09_agent_' + this.getDeviceUid();

    // Immediately register joining player so Spawn Island renders avatar & movement at 0ms!
    this.players = {
      [this.myId]: {
        id: this.myId,
        name,
        role: document.getElementById('role-select')?.value || 'SCOUT',
        ready: true,
        x: -16, z: 18, yaw: 0,
        lx: 1.4, lz: 3.8, lyaw: 0,
        torch: true, downed: false, hiding: false
      }
    };

    document.getElementById('display-code').textContent = code;
    this.hideSetupCard();
    document.getElementById('start-game-btn')?.classList.add('hidden');
    document.getElementById('wait-msg')?.classList.remove('hidden');
    document.getElementById('manual-reconnect-btn')?.classList.remove('hidden');
    if (this.reconnectLoop) clearInterval(this.reconnectLoop);
    this.reconnectLoop = setInterval(() => {
      if (this.isHost || !this.roomCode) return;
      const inLobby = !document.getElementById('lobby-screen')?.classList.contains('hidden');
      const disconnected = !this.hostConn || !this.hostConn.open;
      if (inLobby || disconnected) {
        this.reconnectToHost();
      }
    }, 3000);
    this.saveRoomSession(code, false, name);
    this.updateSquadUI();

    if (typeof Lobby3D !== 'undefined') {
      Lobby3D.init();
      Lobby3D.localPos.x = 1.4;
      Lobby3D.localPos.z = 3.8;
      Lobby3D.syncSquad(this.players);
    }

    if (typeof Peer !== 'undefined') {
      if (this.peer) this.peer.destroy();
      this.peer = new Peer(this.myId);
      this.peer.on('open', () => {
        const hostId = 'sb09_host_' + code;
        const conn = this.peer.connect(hostId, { reliable: true });
        this.hostConn = conn;
        conn.on('open', () => {
          this.sendToHost({ type: 'JOIN', player: this.players[this.myId] });
        });
        conn.on('data', (data) => this.handleClientData(data));
      });
    }
  },

  broadcast(data) {
    this.conns.forEach(c => {
      if (c && c.open) {
        try { c.send(data); } catch (e) {}
      }
    });
  },

  sendToHost(data) {
    if (this.hostConn && this.hostConn.open) {
      try { this.hostConn.send(data); } catch (e) {}
    }
  },

  handleHostData(conn, data) {
    if (!data || !data.type) return;
    if (data.type === 'JOIN' && data.player) {
      const pid = data.player.id;
      if (!this.players[pid] && Object.keys(this.players).length >= 4) {
        if (conn && conn.open) conn.send({ type: 'ROOM_FULL' });
        return;
      }
      this.players[pid] = data.player;
      this.updateSquadUI();
      this.broadcast({ type: 'SQUAD', players: this.players });
      if (conn && conn.open) conn.send({ type: 'SQUAD', players: this.players });

      if (typeof Game3D !== 'undefined' && Game3D.scene && !Game3D.gameOver) {
        conn.send({
          type: 'REJOIN_LIVE',
          players: this.players,
          level: Game3D.level,
          codes: Game3D.codes,
          powerRestored: Game3D.powerRestored,
          locks: Game3D.locks,
          hunter: { x: Game3D.hunter.x, z: Game3D.hunter.z, yaw: Game3D.hunter.yaw }
        });
      }
    } else if (data.type === 'LOBBY_MOVE') {
      if (this.players[data.id]) {
        this.players[data.id].lx = data.lx;
        this.players[data.id].lz = data.lz;
        this.players[data.id].lyaw = data.lyaw;
        this.broadcast(data);
      }
    } else if (data.type === 'ROLE_UPDATE') {
      if (this.players[data.id]) {
        this.players[data.id].role = data.role;
        this.players[data.id].ready = data.ready;
        this.updateSquadUI();
        this.broadcast({ type: 'SQUAD', players: this.players });
      }
    } else if (data.type === 'MOVE') {
      if (this.players[data.id]) Object.assign(this.players[data.id], data.state);
    } else if (data.type === 'POWER_ON') {
      Game3D.restorePower();
      this.broadcast(data);
    } else if (data.type === 'UNLOCK') {
      Game3D.unlockTerminal(data.lockIdx);
      this.broadcast(data);
    } else if (data.type === 'LEVEL_2') {
      Game3D.startLevel2();
      this.broadcast(data);
    } else if (data.type === 'LEVEL_3') {
      Game3D.startLevel3();
      this.broadcast(data);
        } else if (data.type === 'BOARD_HELI') {
      if (this.players[data.id]) {
        this.players[data.id].boarded = true;
        this.players[data.id].hiding = true;
        this.broadcast({ type: 'SQUAD', players: this.players });
        if (typeof Game3D !== 'undefined' && Game3D.checkHeliTakeoff) {
          Game3D.checkHeliTakeoff();
        }
      }
    } else if (data.type === 'HELI_TAKEOFF') {
      if (typeof Game3D !== 'undefined' && Game3D.startHeliTakeoff) {
        Game3D.startHeliTakeoff();
      }
    } else if (data.type === 'REVIVE') {
      if (this.players[data.targetId]) this.players[data.targetId].downed = false;
    } else if (data.type === 'RADIO') {
      Game3D.showRadioToast(data.sender, data.msg);
      this.broadcast(data);
    }
  },

  handleClientData(data) {
    if (!data || !data.type) return;
    if (data.type === 'ROOM_FULL') {
      alert('⚠️ Squad is full (4/4 players)!');
      this.isConnecting = false;
      this.roomCode = '';
      location.reload();
      return;
    }
    if (data.type === 'DEPLOY_COUNTDOWN') {
      this.showDeployCountdown(data.sec);
      return;
    }
    if (data.type === 'SQUAD') {
      const myBackup = this.players[this.myId];
      this.players = { ...data.players };
      if (myBackup) {
        this.players[this.myId] = { ...this.players[this.myId], ...myBackup };
      }
      this.updateSquadUI();
    } else if (data.type === 'LOBBY_MOVE') {
      if (data.id !== this.myId && this.players[data.id]) {
        this.players[data.id].lx = data.lx;
        this.players[data.id].lz = data.lz;
        this.players[data.id].lyaw = data.lyaw;
      }
    } else if (data.type === 'ROLE_UPDATE') {
      if (this.players[data.id]) {
        this.players[data.id].role = data.role;
        this.players[data.id].ready = data.ready;
        this.updateSquadUI();
      }
    } else if (data.type === 'REJOIN_LIVE') {
      const myBackup = this.players[this.myId];
      this.players = { ...data.players };
      if (myBackup && !this.players[this.myId]) this.players[this.myId] = myBackup;
      document.getElementById('landing-screen')?.classList.add('hidden');
      document.getElementById('lobby-screen').classList.add('hidden');
      document.getElementById('story-intro').classList.add('hidden');
      document.getElementById('game-screen').classList.remove('hidden');
      const noteSpots = [{ x: -18, z: -18 }, { x: 0, z: 16 }, { x: 18, z: 4 }];
      const fuseSpot = { x: -16, z: -4 };
      Game3D.codes = data.codes;
      Game3D.init3D(noteSpots, fuseSpot);
      if (data.level === 2) Game3D.startLevel2();
      else if (data.level === 3) Game3D.startLevel3();
      else {
        if (data.powerRestored) Game3D.restorePower();
        if (Array.isArray(data.locks)) data.locks.forEach((u, i) => { if (u) Game3D.unlockTerminal(i); });
      }
      Game3D.showRadioToast('RECONNECTED', '🔄 Back in live squad match!');
    } else if (data.type === 'START') {
      const myBackup = this.players[this.myId];
      this.players = { ...data.players };
      if (myBackup && !this.players[this.myId]) this.players[this.myId] = myBackup;
      document.getElementById('deploy-countdown-banner')?.classList.add('hidden');
      Game3D.start(data.codes, data.noteSpots, data.fuseSpot);
    } else if (data.type === 'RESTART') {
      this.players = data.players;
      Game3D.resetAndRestart(data.codes, data.noteSpots, data.fuseSpot);
    } else if (data.type === 'STATE') {
      for (const [id, p] of Object.entries(data.players)) {
        if (id === this.myId && this.players[id]) {
          this.players[id].downed = p.downed;
        } else {
          this.players[id] = p;
        }
      }
      if (data.hunter && Game3D.hunter) {
        Game3D.hunter.x = data.hunter.x;
        Game3D.hunter.z = data.hunter.z;
        Game3D.hunter.yaw = data.hunter.yaw;
      }
    } else if (data.type === 'POWER_ON') {
      Game3D.restorePower();
    } else if (data.type === 'UNLOCK') {
      Game3D.unlockTerminal(data.lockIdx);
    } else if (data.type === 'LEVEL_2') {
      Game3D.startLevel2();
    } else if (data.type === 'LEVEL_3') {
      Game3D.startLevel3();
    } else if (data.type === 'RADIO') {
      Game3D.showRadioToast(data.sender, data.msg);
        } else if (data.type === 'HELI_TAKEOFF') {
      if (typeof Game3D !== 'undefined' && Game3D.startHeliTakeoff) {
        Game3D.startHeliTakeoff();
      }
    } else if (data.type === 'GAMEOVER') {
      Game3D.triggerEnd(data.win, data.reason);
    }
  },

  updateSquadUI() {
    const list = document.getElementById('squad-list');
    const countEl = document.getElementById('player-count');
    const arr = Object.values(this.players);
    if (countEl) countEl.textContent = arr.length;
    if (list) {
      list.innerHTML = arr.map(p =>
        `<li><span>${p.name} ${p.id === this.myId ? '(You)' : ''} ${p.ready ? '✅' : '⏳'}</span><strong style="color:#38bdf8">${p.role}</strong></li>`
      ).join('');
    }
    if (typeof Lobby3D !== 'undefined') Lobby3D.syncSquad(this.players);
  },

  async toggleMic() {
    const btn = document.getElementById('mic-btn');
    if (!this.micEnabled) {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.micEnabled = true;
        btn.textContent = '🎤 ON';
        btn.classList.add('on');
        if (this.peer) {
          Object.keys(this.players).forEach(pid => {
            if (pid !== this.myId) {
              const call = this.peer.call(pid, this.localStream);
              if (call) call.on('stream', (rem) => this.attachRemoteAudio(pid, rem));
            }
          });
        }
      } catch (e) {
        alert('Microphone permission denied!');
      }
    } else {
      this.micEnabled = false;
      btn.textContent = '🎤 OFF';
      btn.classList.remove('on');
      if (this.localStream) this.localStream.getTracks().forEach(t => t.stop());
    }
  },

  attachRemoteAudio(pid, stream) {
    let audio = document.getElementById('voice_' + pid);
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = 'voice_' + pid;
      audio.autoplay = true;
      document.body.appendChild(audio);
    }
    audio.srcObject = stream;
  },

  updateVoiceProximity(me) {
    if (!me) return;
    for (const p of Object.values(this.players)) {
      if (p.id === this.myId) continue;
      const el = document.getElementById('voice_' + p.id);
      if (el) {
        const d = Math.hypot(p.x - me.x, p.z - me.z);
        el.volume = Math.max(0.05, Math.min(1, (22 - d) / 22));
      }
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  Net.initUI();
  try {
    const rawRoom = sessionStorage.getItem('sb_active_room');
    const rBtn = document.getElementById('rejoin-squad-btn');
    if (rawRoom && rBtn) {
      const sess = JSON.parse(rawRoom);
      if (Date.now() - sess.ts < 30 * 60 * 1000) {
        rBtn.textContent = `🔄 REJOIN LIVE SQUAD (${sess.code})`;
        rBtn.classList.remove('hidden');
        rBtn.onclick = () => {
          document.getElementById('landing-screen')?.classList.add('hidden');
          document.getElementById('lobby-screen').classList.remove('hidden');
          const nameInp = document.getElementById('player-name');
          if (nameInp && sess.name) nameInp.value = sess.name;
          if (sess.isHost) Net.createRoom(sess.name);
          else Net.joinRoom(sess.code, sess.name);
        };
      }
    }
  } catch (e) {}
});
