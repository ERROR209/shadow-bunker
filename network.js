const Net = {
  peer: null,
  myId: null,
  isHost: false,
  connections: [],
  hostConn: null,
  players: {},
  roles: ['SCOUT', 'HACKER', 'ENGINEER', 'MEDIC'],
  colors: [0x38bdf8, 0xfacc15, 0x4ade80, 0xf472b6],

  localStream: null,
  micEnabled: false,
  voiceLoud: false,
  audioElements: {},
  analyser: null,

  initLobby() {
    document.getElementById('create-room-btn').onclick = () => this.createRoom();
    document.getElementById('join-room-btn').onclick = () => this.joinRoom();
    document.getElementById('copy-code-btn').onclick = () => {
      const code = document.getElementById('display-code').textContent;
      navigator.clipboard?.writeText(code);
      document.getElementById('copy-code-btn').textContent = 'COPIED!';
      setTimeout(() => document.getElementById('copy-code-btn').textContent = 'COPY', 1500);
    };
    document.getElementById('start-game-btn').onclick = () => this.startMission();
  },

  getName() {
    const val = document.getElementById('player-name').value.trim();
    return val || 'Agent-' + Math.floor(10 + Math.random() * 89);
  },

  setupIncomingCalls() {
    this.peer.on('call', (call) => {
      call.answer(this.localStream || undefined);
      call.on('stream', (remoteStream) => {
        this.attachRemoteAudio(call.peer, remoteStream);
      });
    });
  },

  attachRemoteAudio(peerId, stream) {
    let audio = this.audioElements[peerId];
    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      audio.playsInline = true;
      document.body.appendChild(audio);
      this.audioElements[peerId] = audio;
    }
    audio.srcObject = stream;
  },

  async toggleMic() {
    const btn = document.getElementById('mic-btn');
    if (!this.micEnabled) {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.micEnabled = true;
        btn.classList.add('on');
        btn.textContent = '🎤 ON';

        // Setup Loudness Detector so Monster hears loud talking!
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const src = audioCtx.createMediaStreamSource(this.localStream);
        this.analyser = audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        src.connect(this.analyser);

        // Call all connected teammates
        Object.keys(this.players).forEach(pid => {
          if (pid !== this.myId && this.peer) {
            const call = this.peer.call(pid, this.localStream);
            call?.on('stream', (rem) => this.attachRemoteAudio(pid, rem));
          }
        });
      } catch (err) {
        alert('Microphone permission denied! Please allow mic access in browser settings.');
      }
    } else {
      this.micEnabled = false;
      this.voiceLoud = false;
      btn.classList.remove('on', 'loud');
      btn.textContent = '🎤 OFF';
      if (this.localStream) {
        this.localStream.getTracks().forEach(t => t.stop());
        this.localStream = null;
      }
    }
  },

  updateVoiceProximity(me) {
    // Check own mic volume
    if (this.micEnabled && this.analyser) {
      const data = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const btn = document.getElementById('mic-btn');
      if (avg > 38) {
        this.voiceLoud = true;
        btn.classList.add('loud');
        btn.textContent = '🔊 LOUD!';
      } else {
        this.voiceLoud = false;
        btn.classList.remove('loud');
        btn.textContent = '🎤 ON';
      }
    }

    // Adjust teammate voice volume by distance (Proximity Voice)
    for (const [pid, audio] of Object.entries(this.audioElements)) {
      const p = this.players[pid];
      if (!p) continue;
      const dist = Math.hypot(p.x - me.x, p.z - me.z);
      audio.volume = Math.max(0.05, Math.min(1, 1 - dist / 24));
    }
  },

  createRoom() {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.isHost = true;
    this.peer = new Peer('SB-' + code);

    this.peer.on('open', (id) => {
      this.myId = id;
      this.setupIncomingCalls();
      this.players[id] = {
        id, name: this.getName(), role: this.roles[0], color: this.colors[0],
        x: -18, z: 18, yaw: 0, torch: true, hiding: false, downed: false, makingNoise: false
      };
      this.showWaitingRoom(code);
    });

    this.peer.on('connection', (conn) => {
      this.connections.push(conn);
      conn.on('data', (data) => this.handleHostData(conn, data));
      conn.on('close', () => {
        delete this.players[conn.peer];
        this.broadcast({ type: 'LOBBY_UPDATE', players: this.players });
        this.renderSquad();
      });
    });

    this.peer.on('error', () => alert('रूम बनाने में त्रुटि! कृपया दोबारा प्रयास करें।'));
  },

  joinRoom() {
    const code = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (code.length < 4) return alert('Please enter a valid 4-character SQUAD CODE!');

    this.isHost = false;
    this.peer = new Peer();

    this.peer.on('open', (id) => {
      this.myId = id;
      this.setupIncomingCalls();
      const conn = this.peer.connect('SB-' + code, { reliable: true });
      this.hostConn = conn;

      conn.on('open', () => {
        this.showWaitingRoom(code);
        document.getElementById('start-game-btn').classList.add('hidden');
        document.getElementById('wait-msg').classList.remove('hidden');
        conn.send({ type: 'JOIN', id, name: this.getName() });
      });

      conn.on('data', (data) => this.handleClientData(data));
      conn.on('error', () => alert('Squad Code गलत है या Host ऑफलाइन है!'));
    });
  },

  handleHostData(conn, data) {
    if (data.type === 'JOIN') {
      const idx = Object.keys(this.players).length % 4;
      const spawns = [{ x: -18, z: 18 }, { x: -16, z: 18 }, { x: -18, z: 16 }, { x: -16, z: 16 }];
      this.players[data.id] = {
        id: data.id,
        name: data.name,
        role: this.roles[idx],
        color: this.colors[idx],
        x: spawns[idx].x,
        z: spawns[idx].z,
        yaw: 0,
        torch: true,
        hiding: false,
        downed: false,
        makingNoise: false
      };
      this.renderSquad();
      this.broadcast({ type: 'LOBBY_UPDATE', players: this.players });
    } else if (data.type === 'MOVE' && this.players[data.id]) {
      Object.assign(this.players[data.id], data.state);
    } else if (data.type === 'LOBBY_MOVE') {
      if (this.players[data.id]) {
        this.players[data.id].lx = data.lx;
        this.players[data.id].lz = data.lz;
        this.players[data.id].lyaw = data.lyaw;
        if (this.isHost) this.broadcast(data);
      }
    } else if (data.type === 'ROLE_UPDATE') {
      if (this.players[data.id]) {
        this.players[data.id].role = data.role;
        this.players[data.id].ready = data.ready;
        this.updateSquadUI();
        if (this.isHost) this.broadcast({ type: 'SQUAD', players: this.players });
      if (conn && conn.open) conn.send({ type: 'SQUAD', players: this.players });
      }
    } else if (data.type === 'RADIO') {
      Game3D.showRadioToast(data.sender, data.msg);
      this.broadcast(data);
    } else if (data.type === 'POWER_ON') {
      Game3D.restorePower();
      this.broadcast(data);
    } else if (data.type === 'UNLOCK') {
      Game3D.unlockTerminal(data.lockIdx);
      this.broadcast(data);
    } else if (data.type === 'REVIVE' && this.players[data.targetId]) {
      this.players[data.targetId].downed = false;
      this.broadcast({ type: 'STATE', players: this.players, hunter: Game3D.hunter });
    }
  },

  handleClientData(data) {
    if (data.type === 'LOBBY_UPDATE') {
      this.players = data.players;
      this.renderSquad();
    } else if (data.type === 'START') {
      this.players = data.players;
      Game3D.start(data.codes, data.noteSpots, data.fuseSpot);
    } else if (data.type === 'STATE') {
      for (const [id, pData] of Object.entries(data.players)) {
        if (id === this.myId) {
          if (this.players[id]) {
            if (!this.players[id].downed && pData.downed) Game3D.triggerJumpscare();
            this.players[id].downed = pData.downed;
          }
        } else {
          this.players[id] = pData;
        }
      }
      if (data.hunter) {
        Game3D.hunter.x = data.hunter.x;
        Game3D.hunter.z = data.hunter.z;
        Game3D.hunter.yaw = data.hunter.yaw;
      }
    } else if (data.type === 'RADIO') {
      Game3D.showRadioToast(data.sender, data.msg);
    } else if (data.type === 'POWER_ON') {
      Game3D.restorePower();
    } else if (data.type === 'UNLOCK') {
      Game3D.unlockTerminal(data.lockIdx);
    } else if (data.type === 'LEVEL_2') {
      Game3D.startLevel2();
    } else if (data.type === 'LEVEL_3') {
      Game3D.startLevel3();
    } else if (data.type === 'GAMEOVER') {
      Game3D.triggerEnd(data.win, data.reason);
    } else if (data.type === 'RESTART') {
      this.players = data.players;
      Game3D.resetAndRestart(data.codes, data.noteSpots, data.fuseSpot);
    }
  },

  broadcast(msg) {
    this.connections.forEach(c => { if (c.open) c.send(msg); });
  },

  sendToHost(msg) {
    if (this.hostConn && this.hostConn.open) this.hostConn.send(msg);
  },

  showWaitingRoom(code) {
    document.getElementById('lobby-setup-card')?.classList.add('hidden');
      document.getElementById('lobby-setup-form')?.classList.add('hidden');
      document.getElementById('lobby-actions').classList.add('hidden');
    const setupCard = document.getElementById('lobby-setup-card');
      if (setupCard) { setupCard.classList.add('hidden'); setupCard.style.display = 'none'; }
      document.getElementById('waiting-room').classList.remove('hidden');
    document.getElementById('display-code').textContent = code;
      this.saveRoomSession(code, true, name);
    this.renderSquad();
  },

  renderSquad() {
    const list = document.getElementById('squad-list');
    const arr = Object.values(this.players);
    document.getElementById('player-count').textContent = arr.length;
    list.innerHTML = arr.map(p => `
      <li>
        <span>${p.name} ${p.id === this.myId ? '(You)' : ''}</span>
        <strong style="color:#38bdf8">${p.role}</strong>
      </li>
    `).join('');
  },

  startMission() {
    const codes = [
      String(Math.floor(100 + Math.random() * 899)),
      String(Math.floor(100 + Math.random() * 899)),
      String(Math.floor(100 + Math.random() * 899))
    ];
    const fuseSpot = { x: -16, z: -4 };
    const noteSpots = [
      { x: -18, z: -18 },
      { x: 0, z: 16 },
      { x: 18, z: 4 }
    ];
    this.broadcast({ type: 'START', players: this.players, codes, noteSpots, fuseSpot });
    Game3D.start(codes, noteSpots, fuseSpot);
  }
};

window.addEventListener('DOMContentLoaded', () => Net.initLobby());

window.addEventListener('DOMContentLoaded', () => {
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
          if (sess.isHost) {
            Net.createRoom(sess.name);
          } else {
            document.getElementById('room-code-input').value = sess.code;
            Net.joinRoom(sess.code, sess.name);
          }
        };
      }
    }
  } catch (e) {}
});
window.addEventListener('DOMContentLoaded', () => {
  const roleSel = document.getElementById('role-select');
  const readyBtn = document.getElementById('ready-toggle-btn');
  if (roleSel) {
    roleSel.addEventListener('change', () => {
      const me = Net.players[Net.myId];
      if (!me) return;
      me.role = roleSel.value;
      Net.updateSquadUI();
      const pkt = { type: 'ROLE_UPDATE', id: Net.myId, role: me.role, ready: me.ready };
      if (Net.isHost) Net.broadcast(pkt); else Net.sendToHost(pkt);
    });
  }
  if (readyBtn) {
    readyBtn.addEventListener('click', () => {
      const me = Net.players[Net.myId];
      if (!me) return;
      me.ready = !me.ready;
      readyBtn.textContent = me.ready ? '✅ READY' : '⏳ WAIT';
      readyBtn.style.background = me.ready ? '#16a34a' : '#b45309';
      Net.updateSquadUI();
      const pkt = { type: 'ROLE_UPDATE', id: Net.myId, role: me.role, ready: me.ready };
      if (Net.isHost) Net.broadcast(pkt); else Net.sendToHost(pkt);
    });
  }
});
