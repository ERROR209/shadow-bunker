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
    const peerId = `SBUNKER_${this.roomCode}`;

    this.peer = new Peer(peerId);
    this.peer.on('open', (id) => {
      this.myId = id;
      this.players[id] = {
        id,
        name: this.myName,
        role: this.roles[0],
        color: this.colors[0],
        x: 150,
        y: 150,
        angle: 0,
        torch: true,
        hiding: false,
        downed: false,
        walkPhase: 0
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
    const hostPeerId = `SBUNKER_${this.roomCode}`;

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
        x: 150 + idx * 32,
        y: 150,
        angle: 0,
        torch: true,
        hiding: false,
        downed: false,
        walkPhase: 0
      };
      this.broadcast({ type: 'ROSTER', players: this.players });
      this.updateLobbyUI();
    } else if (data.type === 'MOVE') {
      if (this.players[data.id]) {
        Object.assign(this.players[data.id], data.state);
      }
    } else if (data.type === 'UNLOCK') {
      Game.unlockTerminal(data.lockIdx);
      this.broadcast({ type: 'UNLOCK', lockIdx: data.lockIdx });
    } else if (data.type === 'REVIVE') {
      if (this.players[data.targetId]) {
        this.players[data.targetId].downed = false;
      }
    } else if (data.type === 'RADIO') {
      Game.showRadioToast(data.sender, data.msg);
      this.broadcast(data);
    }
  },

  handleClientData(data) {
    if (data.type === 'FULL') {
      alert('यह बंकर 4 खिलाड़ियों से भरा है!');
      location.reload();
    } else if (data.type === 'ROSTER') {
      this.players = data.players;
      this.updateLobbyUI();
    } else if (data.type === 'START') {
      Game.start(data.codes, data.notePositions);
    } else if (data.type === 'STATE') {
      Object.keys(data.players).forEach(pid => {
        if (pid !== this.myId) {
          this.players[pid] = data.players[pid];
        } else if (this.players[pid]) {
          this.players[pid].downed = data.players[pid].downed;
        }
      });
      Game.hunter.x = data.hunter.x;
      Game.hunter.y = data.hunter.y;
      Game.hunter.angle = data.hunter.angle;
      Game.hunter.chasing = data.hunter.chasing;
    } else if (data.type === 'UNLOCK') {
      Game.unlockTerminal(data.lockIdx);
    } else if (data.type === 'RADIO') {
      Game.showRadioToast(data.sender, data.msg);
    } else if (data.type === 'GAMEOVER') {
      Game.triggerEnd(data.win, data.reason);
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

  // Randomize where the 3 Secret Notes are hidden inside bunker rooms!
  const spotPool = [
    { x: 110, y: 580 }, { x: 250, y: 310 }, { x: 480, y: 120 },
    { x: 580, y: 650 }, { x: 890, y: 120 }, { x: 1260, y: 460 },
    { x: 1120, y: 900 }, { x: 430, y: 890 }
  ].sort(() => Math.random() - 0.5);

  const notePositions = [spotPool[0], spotPool[1], spotPool[2]];

  Game.start(codes, notePositions);
  Net.broadcast({ type: 'START', codes, notePositions });
});
