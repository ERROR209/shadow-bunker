const Net = {
  peer: null,
  isHost: false,
  roomCode: '',
  myId: '',
  myName: 'Agent',
  connections: [],
  hostConn: null,
  players: {},

  roles: ['SCOUT', 'HACKER', 'ENGINEER', 'MEDIC'],
  colors: ['#38bdf8', '#4ade80', '#fb923c', '#e879f9'],

  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  },

  createRoom(name) {
    this.isHost = true;
    this.myName = name || 'Host';
    this.roomCode = this.generateCode();
    const peerId = `SBUNKER3D_${this.roomCode}`;

    this.peer = new Peer(peerId);
    this.peer.on('open', (id) => {
      this.myId = id;
      this.players[id] = {
        id,
        name: this.myName,
        role: this.roles[0],
        color: this.colors[0],
        x: -18,
        z: -18,
        yaw: 0,
        torch: true,
        hiding: false,
        downed: false
      };
      this.updateLobbyUI();
    });

    this.peer.on('connection', (conn) => {
      if (Object.keys(this.players).length >= 4) {
        conn.on('open', () => conn.send({ type: 'FULL' }));
        return;
      }
      this.connections.push(conn);
      conn.on('data', (data) => this.handleHostData(conn, data));
      conn.on('close', () => {
        delete this.players[conn.peer];
        this.connections = this.connections.filter(c => c !== conn);
        this.broadcast({ type: 'ROSTER', players: this.players });
        this.updateLobbyUI();
      });
    });
  },

  joinRoom(code, name) {
    this.isHost = false;
    this.myName = name || 'Agent';
    this.roomCode = code.toUpperCase();
    const hostPeerId = `SBUNKER3D_${this.roomCode}`;

    this.peer = new Peer();
    this.peer.on('open', (id) => {
      this.myId = id;
      this.hostConn = this.peer.connect(hostPeerId);

      this.hostConn.on('open', () => {
        this.hostConn.send({ type: 'JOIN', id: this.myId, name: this.myName });
        document.getElementById('lobby-actions').classList.add('hidden');
        document.getElementById('waiting-room').classList.remove('hidden');
        document.getElementById('display-code').textContent = this.roomCode;
        document.getElementById('start-game-btn').classList.add('hidden');
        document.getElementById('wait-msg').classList.remove('hidden');
      });

      this.hostConn.on('data', (data) => this.handleClientData(data));
    });
  },

  handleHostData(conn, data) {
    if (data.type === 'JOIN') {
      const idx = Object.keys(this.players).length;
      this.players[data.id] = {
        id: data.id,
        name: data.name,
        role: this.roles[idx % 4],
        color: this.colors[idx % 4],
        x: -18 + idx * 1.5,
        z: -18,
        yaw: 0,
        torch: true,
        hiding: false,
        downed: false
      };
      this.broadcast({ type: 'ROSTER', players: this.players });
      this.updateLobbyUI();
    } else if (data.type === 'MOVE') {
      if (this.players[data.id]) {
        Object.assign(this.players[data.id], data.state);
      }
    } else if (data.type === 'UNLOCK') {
      Game3D.unlockTerminal(data.lockIdx);
      this.broadcast({ type: 'UNLOCK', lockIdx: data.lockIdx });
    } else if (data.type === 'REVIVE') {
      if (this.players[data.targetId]) {
        this.players[data.targetId].downed = false;
      }
    } else if (data.type === 'RADIO') {
      Game3D.showRadioToast(data.sender, data.msg);
      this.broadcast(data);
    }
  },

  handleClientData(data) {
    if (data.type === 'FULL') {
      alert('यह 3D बंकर 4 खिलाड़ियों से भरा है!');
      location.reload();
    } else if (data.type === 'ROSTER') {
      this.players = data.players;
      this.updateLobbyUI();
    } else if (data.type === 'START') {
      Game3D.start(data.codes, data.noteSpots);
    } else if (data.type === 'STATE') {
      Object.keys(data.players).forEach(pid => {
        if (pid !== this.myId) {
          this.players[pid] = data.players[pid];
        } else if (this.players[pid]) {
          this.players[pid].downed = data.players[pid].downed;
        }
      });
      Game3D.hunter.x = data.hunter.x;
      Game3D.hunter.z = data.hunter.z;
      Game3D.hunter.yaw = data.hunter.yaw;
    } else if (data.type === 'UNLOCK') {
      Game3D.unlockTerminal(data.lockIdx);
    } else if (data.type === 'RADIO') {
      Game3D.showRadioToast(data.sender, data.msg);
    } else if (data.type === 'GAMEOVER') {
      Game3D.triggerEnd(data.win, data.reason);
    }
  },

  broadcast(payload) {
    this.connections.forEach(c => {
      if (c.open) c.send(payload);
    });
  },

  sendToHost(payload) {
    if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(payload);
    }
  },

  updateLobbyUI() {
    document.getElementById('lobby-actions').classList.add('hidden');
    document.getElementById('waiting-room').classList.remove('hidden');
    document.getElementById('display-code').textContent = this.roomCode;

    const list = document.getElementById('squad-list');
    list.innerHTML = '';
    const ids = Object.keys(this.players);
    document.getElementById('player-count').textContent = ids.length;

    ids.forEach(id => {
      const p = this.players[id];
      const li = document.createElement('li');
      li.innerHTML = `<span>${p.name} ${id === this.myId ? '(You)' : ''}</span><strong style="color:${p.color}">${p.role}</strong>`;
      list.appendChild(li);
    });
  }
};

document.getElementById('create-room-btn').addEventListener('click', () => {
  Net.createRoom(document.getElementById('player-name').value.trim());
});

document.getElementById('join-room-btn').addEventListener('click', () => {
  const name = document.getElementById('player-name').value.trim();
  const code = document.getElementById('room-code-input').value.trim();
  if (code.length < 4) return alert('4-अंकों का कोड डालें!');
  Net.joinRoom(code, name);
});

document.getElementById('copy-code-btn').addEventListener('click', () => {
  navigator.clipboard?.writeText(Net.roomCode);
  document.getElementById('copy-code-btn').textContent = 'COPIED!';
});

document.getElementById('start-game-btn').addEventListener('click', () => {
  if (!Net.isHost) return;
  const codes = [
    String(Math.floor(100 + Math.random() * 900)),
    String(Math.floor(100 + Math.random() * 900)),
    String(Math.floor(100 + Math.random() * 900))
  ];

  // Randomize 3D desk locations where Secret Notes spawn
  const spots = [
    { x: -18, z: 16 }, { x: 0, z: -18 }, { x: 18, z: 16 },
    { x: 0, z: 18 }, { x: -16, z: 0 }, { x: 16, z: -12 }
  ].sort(() => Math.random() - 0.5);

  const noteSpots = [spots[0], spots[1], spots[2]];
  Game3D.start(codes, noteSpots);
  Net.broadcast({ type: 'START', codes, noteSpots });
});
