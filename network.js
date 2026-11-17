const Net = {
  peer: null,
  myId: null,
  isHost: false,
  connections: [],
  hostConn: null,
  players: {},
  roles: ['SCOUT', 'HACKER', 'ENGINEER', 'MEDIC'],
  colors: [0x38bdf8, 0xfacc15, 0x4ade80, 0xf472b6],

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

  createRoom() {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.isHost = true;
    this.peer = new Peer('SB-' + code);

    this.peer.on('open', (id) => {
      this.myId = id;
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
    if (code.length < 4) return alert('4-अक्षरों का SQUAD CODE डालें!');

    this.isHost = false;
    this.peer = new Peer();

    this.peer.on('open', (id) => {
      this.myId = id;
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
          if (this.players[id]) this.players[id].downed = pData.downed;
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
    } else if (data.type === 'GAMEOVER') {
      Game3D.triggerEnd(data.win, data.reason);
    }
  },

  broadcast(msg) {
    this.connections.forEach(c => { if (c.open) c.send(msg); });
  },

  sendToHost(msg) {
    if (this.hostConn && this.hostConn.open) this.hostConn.send(msg);
  },

  showWaitingRoom(code) {
    document.getElementById('lobby-actions').classList.add('hidden');
    document.getElementById('waiting-room').classList.remove('hidden');
    document.getElementById('display-code').textContent = code;
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
