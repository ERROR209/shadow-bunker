const Net = {
  peer: null,
  isHost: true,
  myId: 'local-' + Math.random().toString(36).slice(2, 7),
  roomCode: '',
  difficulty: 'NORMAL',
  connections: {},
  players: {},
  localStream: null,
  micEnabled: false,
  voiceCalls: {},
  voiceEls: {},

  iceConfig: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  },

  initUI() {
    const saved = window.AgentProfile ? AgentProfile.load() : { name: '3RROR', role: 'SCOUT' };
    const nameIn = document.getElementById('player-name');
    if (nameIn) {
      nameIn.value = saved.name;
      nameIn.oninput = () => {
        if (window.AgentProfile) AgentProfile.setName(nameIn.value);
        if (this.players[this.myId]) {
          this.players[this.myId].name = nameIn.value.trim() || 'Agent';
          this.renderLobby();
        }
      };
    }

    this.players[this.myId] = {
      id: this.myId,
      name: saved.name || '3RROR',
      role: saved.role || 'SCOUT',
      x: -32, z: 32, yaw: 0, torch: true, hiding: false, downed: false
    };
    this.renderLobby();

    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.difficulty = btn.dataset.diff || 'NORMAL';
        if (this.isHost) this.broadcast({ type: 'LOBBY_SYNC', players: this.players, difficulty: this.difficulty });
      };
    });

    document.querySelectorAll('.role-btn').forEach(btn => {
      if (btn.dataset.role === saved.role) btn.classList.add('active');
      btn.onclick = () => {
        document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const role = btn.dataset.role;
        if (window.AgentProfile) AgentProfile.setRole(role);
        if (this.players[this.myId]) {
          this.players[this.myId].role = role;
          this.renderLobby();
          if (this.isHost) this.broadcast({ type: 'LOBBY_SYNC', players: this.players, difficulty: this.difficulty });
          else this.sendToHost({ type: 'ROLE_UPDATE', id: this.myId, role, name: this.players[this.myId].name });
        }
      };
    });

    const createBtn = document.getElementById('create-room-btn');
    if (createBtn) createBtn.onclick = () => this.createRoom();

    const copyBtn = document.getElementById('copy-code-btn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        if (!this.roomCode) return;
        navigator.clipboard?.writeText(this.roomCode).catch(() => {});
        copyBtn.textContent = 'COPIED!';
        setTimeout(() => { copyBtn.textContent = 'COPY'; }, 1500);
      };
    }

    const joinToggle = document.getElementById('join-toggle-btn');
    const joinBox = document.getElementById('join-box');
    if (joinToggle && joinBox) {
      joinToggle.onclick = () => joinBox.classList.toggle('hidden');
    }

    const joinBtn = document.getElementById('join-room-btn');
    if (joinBtn) {
      joinBtn.onclick = () => {
        const code = (document.getElementById('room-code-input')?.value || '').trim().toUpperCase();
        if (code.length < 4) return alert('Enter 4-letter Room Code!');
        this.joinRoom(code);
      };
    }

    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
      startBtn.onclick = () => {
        if (!this.isHost) return;
        const codes = this.generateCodes();
        const spotOrder = this.generateSpotOrder();
        this.broadcast({ type: 'START_GAME', codes, spotOrder, players: this.players, difficulty: this.difficulty });
        Game3D.start(codes, spotOrder);
      };
    }
  },

  generateCodes() {
    return [0, 1, 2].map(() => String(Math.floor(100 + Math.random() * 900)));
  },

  generateSpotOrder() {
    const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  createRoom() {
    if (typeof Peer === 'undefined') return alert('PeerJS loading... wait 2s and tap Create Team again.');
    if (this.peer) { try { this.peer.destroy(); } catch (e) {} }
    this.isHost = true;
    this.connections = {};
    this.roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const badge = document.getElementById('room-code-badge');
    const copyBtn = document.getElementById('copy-code-btn');
    if (badge) { badge.textContent = 'CODE: ' + this.roomCode; badge.classList.remove('hidden'); }
    if (copyBtn) copyBtn.classList.remove('hidden');

    this.peer = new Peer('SB09-' + this.roomCode, { config: this.iceConfig, debug: 1 });
    this.peer.on('open', (id) => {
      const oldMe = this.players[this.myId] || { name: '3RROR', role: 'SCOUT' };
      delete this.players[this.myId];
      this.myId = id;
      this.players[id] = { ...oldMe, id, x: -33, z: 31, yaw: -Math.PI / 2, torch: true, hiding: false, downed: false };
      this.renderLobby();
    });
    this.peer.on('error', (err) => {
      if (err.type === 'unavailable-id') this.createRoom();
    });
    this.peer.on('connection', (conn) => this.setupConnection(conn));
    this.peer.on('call', (call) => this.answerVoiceCall(call));
  },

  joinRoom(code, attempt = 1) {
    if (typeof Peer === 'undefined') return alert('PeerJS still loading...');
    if (this.peer) { try { this.peer.destroy(); } catch (e) {} }
    this.isHost = false;
    this.roomCode = code;

    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.textContent = attempt > 1 ? `🔄 RETRYING (${attempt}/3)...` : '⏳ CONNECTING TO HOST...';
    }

    this.peer = new Peer(undefined, { config: this.iceConfig, debug: 1 });
    this.peer.on('open', (id) => {
      const oldMe = this.players[this.myId] || { name: 'Agent', role: 'SCOUT' };
      delete this.players[this.myId];
      this.myId = id;
      this.players[id] = { ...oldMe, id, x: -29, z: 31, yaw: Math.PI / 2, torch: true, hiding: false, downed: false };
      this.renderLobby();

      const conn = this.peer.connect('SB09-' + code, { reliable: true });
      let connected = false;

      const timeout = setTimeout(() => {
        if (!connected) {
          if (attempt < 3) {
            this.joinRoom(code, attempt + 1);
          } else {
            if (startBtn) {
              startBtn.disabled = false;
              startBtn.textContent = '❌ HOST NOT FOUND (TAP TO RETRY)';
              startBtn.onclick = () => this.joinRoom(code, 1);
            }
            alert('Host unreachable! Make sure your friend keeps the Shadow Bunker lobby screen open on their phone.');
          }
        }
      }, 6500);

      conn.on('open', () => {
        connected = true;
        clearTimeout(timeout);
        this.connections['HOST'] = conn;
        const badge = document.getElementById('room-code-badge');
        if (badge) { badge.textContent = 'CODE: ' + code; badge.classList.remove('hidden'); }
        if (startBtn) {
          startBtn.disabled = true;
          startBtn.textContent = '✅ JOINED! WAITING FOR HOST TO START...';
        }
        conn.send({ type: 'HELLO', player: this.players[this.myId] });
      });

      conn.on('data', (data) => this.handleData(data, conn));
      conn.on('close', () => {
        if (startBtn && !Game3D.animStarted) {
          startBtn.disabled = false;
          startBtn.textContent = '⚠️ DISCONNECTED (TAP TO REJOIN)';
          startBtn.onclick = () => this.joinRoom(code, 1);
        }
      });
    });

    this.peer.on('error', (err) => {
      if (err.type === 'peer-unavailable' && attempt < 3) {
        setTimeout(() => this.joinRoom(code, attempt + 1), 1200);
      } else if (startBtn) {
        startBtn.disabled = false;
        startBtn.textContent = '❌ INVALID CODE / HOST OFFLINE';
        startBtn.onclick = () => this.joinRoom(code, 1);
      }
    });
    this.peer.on('call', (call) => this.answerVoiceCall(call));
  },

  setupConnection(conn) {
    conn.on('open', () => {
      this.connections[conn.peer] = conn;
      conn.send({ type: 'LOBBY_SYNC', players: this.players, difficulty: this.difficulty });
    });
    conn.on('data', (data) => this.handleData(data, conn));
    conn.on('close', () => {
      delete this.connections[conn.peer];
      delete this.players[conn.peer];
      this.renderLobby();
      this.broadcast({ type: 'LOBBY_SYNC', players: this.players, difficulty: this.difficulty });
    });
  },

  handleData(data, conn) {
    if (!data || !data.type) return;
    if (data.type === 'HELLO' && this.isHost) {
      if (Object.keys(this.players).length >= 4) return;
      this.players[data.player.id] = data.player;
      this.renderLobby();
      this.broadcast({ type: 'LOBBY_SYNC', players: this.players, difficulty: this.difficulty });
      if (Game3D.animStarted && !Game3D.gameOver) {
        conn.send({
          type: 'START_GAME',
          codes: Game3D.codes,
          spotOrder: Game3D.spotOrder,
          players: this.players,
          difficulty: this.difficulty
        });
      }
    } else if (data.type === 'ROLE_UPDATE' && this.isHost) {
      if (this.players[data.id]) {
        this.players[data.id].role = data.role;
        if (data.name) this.players[data.id].name = data.name;
        this.renderLobby();
        this.broadcast({ type: 'LOBBY_SYNC', players: this.players, difficulty: this.difficulty });
      }
    } else if (data.type === 'LOBBY_SYNC') {
      const meLocal = this.players[this.myId];
      this.players = data.players || {};
      if (meLocal && !this.players[this.myId]) this.players[this.myId] = meLocal;
      if (data.difficulty) this.difficulty = data.difficulty;
      this.renderLobby();
    } else if (data.type === 'START_GAME') {
      if (data.players) this.players = data.players;
      if (data.difficulty) this.difficulty = data.difficulty;
      Game3D.start(data.codes, data.spotOrder);
    } else if (data.type === 'MOVE' && this.isHost) {
      if (this.players[data.id]) Object.assign(this.players[data.id], data.state);
    } else if (data.type === 'STATE') {
      Object.entries(data.players || {}).forEach(([id, st]) => {
        if (id === this.myId) {
          if (this.players[id]) this.players[id].downed = st.downed;
        } else {
          this.players[id] = st;
        }
      });
      if (data.hunter && Game3D.hunter) {
        Game3D.hunter.x = data.hunter.x;
        Game3D.hunter.z = data.hunter.z;
        Game3D.hunter.yaw = data.hunter.yaw;
        Game3D.hunter.stunnedUntil = data.hunter.stunnedUntil || 0;
      }
    } else if (data.type === 'RADIO') {
      Game3D.showRadioToast(data.sender, data.msg);
    } else if (data.type === 'WORLD_EVENT') {
      Game3D.applyNetworkEvent(data);
      if (this.isHost) this.broadcast(data, conn?.peer);
    }
  },

  broadcast(msg, excludePeer = null) {
    Object.entries(this.connections).forEach(([peerId, c]) => {
      if (peerId !== excludePeer && c && c.open) {
        try { c.send(msg); } catch (e) {}
      }
    });
  },

  sendToHost(msg) {
    const h = this.connections['HOST'];
    if (h && h.open) {
      try { h.send(msg); } catch (e) {}
    }
  },

  sendEvent(msg) {
    if (this.isHost) this.broadcast(msg);
    else this.sendToHost(msg);
  },

  renderLobby() {
    const list = document.getElementById('lobby-player-list');
    if (!list) return;
    const arr = Object.values(this.players);
    let html = '';
    for (let i = 0; i < 4; i++) {
      const p = arr[i];
      if (p) {
        const isMe = p.id === this.myId;
        html += `<div class="slot-row filled"><span>#${i + 1} ${p.name} ${isMe ? '(YOU)' : ''}</span><span style="color:#38bdf8">${p.role} ✅</span></div>`;
      } else {
        html += `<div class="slot-row empty">#${i + 1} [OPEN SQUAD SLOT]</div>`;
      }
    }
    list.innerHTML = html;
  },

  async toggleMic() {
    const btn = document.getElementById('mic-btn');
    try {
      if (!this.localStream) {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.micEnabled = true;
        Object.keys(this.players).forEach(pid => {
          if (pid !== this.myId && this.peer) {
            const call = this.peer.call(pid, this.localStream);
            if (call) this.bindVoiceStream(call);
          }
        });
      } else {
        this.micEnabled = !this.micEnabled;
        this.localStream.getAudioTracks().forEach(t => { t.enabled = this.micEnabled; });
      }
      if (btn) {
        btn.textContent = this.micEnabled ? '🎙️ MIC ON' : '🔇 MIC OFF';
        btn.classList.toggle('mic-on', this.micEnabled);
      }
    } catch (e) {
      alert('Allow Microphone permission in browser to use Proximity Voice Chat!');
    }
  },

  answerVoiceCall(call) {
    call.answer(this.localStream || undefined);
    this.bindVoiceStream(call);
  },

  bindVoiceStream(call) {
    this.voiceCalls[call.peer] = call;
    call.on('stream', (remoteStream) => {
      let aud = this.voiceEls[call.peer];
      if (!aud) {
        aud = document.createElement('audio');
        aud.autoplay = true;
        document.body.appendChild(aud);
        this.voiceEls[call.peer] = aud;
      }
      aud.srcObject = remoteStream;
    });
  },

  updateVoiceProximity(me) {
    if (!me) return;
    Object.entries(this.voiceEls).forEach(([peerId, aud]) => {
      const other = this.players[peerId];
      if (!other || !aud) return;
      const dist = Math.hypot((other.x || 0) - me.x, (other.z || 0) - me.z);
      aud.volume = Math.max(0.05, Math.min(1, 1 - dist / 28));
    });
  }
};
window.Net = Net;
if (document.readyState === 'loading') { window.addEventListener('DOMContentLoaded', () => Net.initUI()); } else { Net.initUI(); }
