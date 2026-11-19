const AgentProfile = {
  KEY: 'sb09_agent_profile_v1',
  suits: [
    { id: 'DEFAULT', name: 'Standard Issue Navy', cost: 0, color: 0x0284c7, visor: 0x38bdf8 },
    { id: 'STEALTH', name: 'Phantom Night Ops', cost: 250, color: 0x1e293b, visor: 0x22c55e },
    { id: 'ARCTIC', name: 'Himalayan White Ghost', cost: 600, color: 0xe2e8f0, visor: 0x0ea5e9 },
    { id: 'CRIMSON', name: 'Red Viper Spec-Ops', cost: 1100, color: 0xb91c1c, visor: 0xfacc15 },
    { id: 'COMMANDER', name: 'Sector-09 Gold Elite', cost: 2000, color: 0xd97706, visor: 0xfef08a }
  ],
  getEquippedSuit() {
    const d = this.load();
    if (!d.unlockedSuits) d.unlockedSuits = ['DEFAULT'];
    if (!d.equippedSuit) d.equippedSuit = 'DEFAULT';
    return this.suits.find(s => s.id === d.equippedSuit) || this.suits[0];
  },
  data: null,

  load() {
    if (this.data) return this.data;
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) this.data = JSON.parse(raw);
    } catch (e) {}
    if (!this.data) {
      const legacyXP = parseInt(localStorage.getItem('sb_agent_xp') || '0', 10);
      this.data = {
        uid: Math.random().toString(36).slice(2, 8).toUpperCase(),
        name: '',
        role: 'SCOUT',
        xp: legacyXP,
        wins: 0,
        matches: 0,
        bestTimeSec: null
      };
      this.save();
    }
    return this.data;
  },

  save() {
    if (!this.data) return;
    localStorage.setItem(this.KEY, JSON.stringify(this.data));
    localStorage.setItem('sb_agent_xp', String(this.data.xp || 0));
    this.renderCard();
  },

  getRankInfo(xp = this.load().xp) {
    if (xp >= 2500) return { title: 'SECTOR-09 COMMANDER', pct: 100 };
    if (xp >= 1200) return { title: 'SHADOW HUNTER', pct: Math.round(((xp - 1200) / 1300) * 100) };
    if (xp >= 450) return { title: 'FIELD AGENT', pct: Math.round(((xp - 450) / 750) * 100) };
    return { title: 'ROOKIE', pct: Math.max(6, Math.round((xp / 450) * 100)) };
  },

  formatTime(sec) {
    if (!sec || sec <= 0) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  },

  recordMatchStart() {
    const d = this.load();
    d.matches = (d.matches || 0) + 1;
    this.save();
  },

  recordVictory(elapsedSec) {
    const d = this.load();
    d.wins = (d.wins || 0) + 1;
    let isRecord = false;
    if (elapsedSec > 10 && (!d.bestTimeSec || elapsedSec < d.bestTimeSec)) {
      d.bestTimeSec = Math.round(elapsedSec);
      isRecord = true;
    }
    this.save();
    return isRecord;
  },

  addXP(pts) {
    const d = this.load();
    d.xp = (d.xp || 0) + pts;
    this.save();
    return d.xp;
  },

  renderCard() {
    const d = this.load();
    const r = this.getRankInfo(d.xp);
    const badge = document.getElementById('prof-rank-badge');
    const idEl = document.getElementById('prof-agent-id');
    const bar = document.getElementById('prof-xp-bar');
    const xpEl = document.getElementById('stat-xp');
    const winEl = document.getElementById('stat-wins');
    const timeEl = document.getElementById('stat-best-time');
    const matchEl = document.getElementById('stat-matches');

    if (badge) badge.textContent = '🎖️ ' + r.title;
    if (idEl) idEl.textContent = 'ID: #' + d.uid;
    if (bar) bar.style.width = r.pct + '%';
    if (xpEl) xpEl.textContent = d.xp;
    if (winEl) winEl.textContent = d.wins || 0;
    if (timeEl) timeEl.textContent = this.formatTime(d.bestTimeSec);
    if (matchEl) matchEl.textContent = d.matches || 0;
  },

  exportCode() {
    return btoa(JSON.stringify(this.load()));
  },

  importCode(code) {
    try {
      const parsed = JSON.parse(atob(code.trim()));
      if (parsed && typeof parsed.xp === 'number') {
        this.data = { ...this.load(), ...parsed };
        this.save();
        const nameInp = document.getElementById('player-name');
        if (nameInp && this.data.name) nameInp.value = this.data.name;
        return true;
      }
    } catch (e) {}
    return false;
  }
};
window.AgentProfile = AgentProfile;

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
  isConnecting: false,
  difficulty: 'NORMAL',
  reconnectLoop: null,

  getDeviceUid() {
    return AgentProfile.load().uid;
  },

  generateSpotOrder() {
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].sort(() => Math.random() - 0.5);
  },

  generateCodes() {
    return [
      String(Math.floor(100 + Math.random() * 899)),
      String(Math.floor(100 + Math.random() * 899)),
      String(Math.floor(100 + Math.random() * 899))
    ];
  },

  initUI() {
    const createBtn = document.getElementById('create-room-btn');
    const joinBtn = document.getElementById('join-room-btn');
    const startBtn = document.getElementById('start-game-btn');

    const prof = AgentProfile.load();
    AgentProfile.renderCard();
    const nameInput = document.getElementById('player-name');
    if (nameInput) {
      if (prof.name) nameInput.value = prof.name;
      nameInput.addEventListener('input', () => {
        prof.name = nameInput.value.trim();
        AgentProfile.save();
      });
    }

    const backupBtn = document.getElementById('backup-profile-btn');
    if (backupBtn) {
      backupBtn.onclick = () => {
        const code = AgentProfile.exportCode();
        const pasted = prompt(
          '📋 YOUR AGENT SAVE CODE (Copy & keep safe):\n\n' + code + '\n\n👇 Or paste a Save Code below to restore:',
          code
        );
        if (pasted && pasted !== code) {
          if (AgentProfile.importCode(pasted)) alert('✅ Agent Profile Restored!');
          else alert('❌ Invalid Save Code!');
        }
      };
    }

    const roleDescs = {
      SCOUT: '🏃 Shadow Dash: 1.5x Speed + Silent Steps',
      ENGINEER: '🔧 Sonic Decoy: Lures Subject-0 away for 11s',
      MEDIC: '💉 Adrenaline Surge: 100% Sanity & Stamina',
      TECH: '⚡ EMP Pulse: 100% Battery & Stuns Monster'
    };

    const renderHomeSquadSlots = () => {
      const slotList = document.getElementById('home-slot-list');
      const roomTag = document.getElementById('home-room-tag');
      if (slotList) {
        const list = Object.values(this.players || {});
        const meProf = AgentProfile.load();
        const slots = list.length ? list : [{ name: meProf.name || 'YOU', role: meProf.role || 'SCOUT' }];
        slotList.innerHTML = [0, 1, 2, 3].map(i => {
          const p = slots[i];
          if (p) return `<div style="display:flex;justify-content:space-between;background:rgba(15,23,42,0.9);padding:3px 6px;border-radius:5px;font-size:0.62rem;"><span style="color:#f8fafc;font-weight:800;">#${i + 1} ${p.name}</span><span style="color:#38bdf8;font-weight:800;">${p.role} ✅</span></div>`;
          return `<div style="background:rgba(15,23,42,0.45);padding:3px 6px;border-radius:5px;font-size:0.6rem;color:#475569;">#${i + 1} [OPEN SQUAD SLOT]</div>`;
        }).join('');
      }
      if (startBtn) {
        const count = Object.keys(this.players || {}).length;
        if (this.roomCode && !this.isHost) {
          startBtn.disabled = true;
          startBtn.textContent = '⏳ WAITING FOR HOST...';
          startBtn.style.background = '#334155';
        } else if (this.roomCode && count > 1) {
          startBtn.disabled = false;
          startBtn.textContent = `▶ START TEAM MATCH (${count} PLAYERS)`;
          startBtn.style.background = 'linear-gradient(135deg,#0284c7,#1d4ed8)';
        } else {
          startBtn.disabled = false;
          startBtn.textContent = '▶ START MATCH (SOLO)';
          startBtn.style.background = 'linear-gradient(135deg,#16a34a,#15803d)';
        }
      }
      if (roomTag) {
        if (this.roomCode) {
          roomTag.innerHTML = `CODE: <b style="color:#facc15;letter-spacing:1.5px;">${this.roomCode}</b> <button type="button" id="home-copy-code-btn" style="background:#0284c7;border:none;color:#fff;font-size:0.58rem;padding:2px 6px;border-radius:4px;margin-left:4px;cursor:pointer;">COPY</button>`;
          setTimeout(() => {
            const cb = document.getElementById('home-copy-code-btn');
            if (cb) cb.onclick = () => {
              navigator.clipboard?.writeText(this.roomCode);
              cb.textContent = 'COPIED!';
              setTimeout(() => (cb.textContent = 'COPY'), 1500);
            };
          }, 0);
        } else {
          roomTag.textContent = 'SOLO READY';
        }
      }
    };
    renderHomeSquadSlots();
    this.renderHomeSquadSlots = renderHomeSquadSlots;

    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.onclick = () => {
        this.difficulty = btn.dataset.diff || 'NORMAL';
        document.querySelectorAll('.diff-btn').forEach(b => {
          const active = b.dataset.diff === this.difficulty;
          b.style.background = active ? (this.difficulty === 'INFERNO' ? '#dc2626' : (this.difficulty === 'NIGHTMARE' ? '#ea580c' : '#16a34a')) : 'transparent';
          b.style.color = active ? '#fff' : '#94a3b8';
        });
      };
    });

    document.querySelectorAll('.home-role-btn').forEach(btn => {
      const applyActiveStyle = () => {
        const cur = AgentProfile.load().role || 'SCOUT';
        document.querySelectorAll('.home-role-btn').forEach(b => {
          const active = b.dataset.role === cur;
          b.style.background = active ? '#0284c7' : 'rgba(15,23,42,0.88)';
          b.style.borderColor = active ? '#38bdf8' : '#475569';
          b.style.color = active ? '#fff' : '#cbd5e1';
        });
        const descEl = document.getElementById('home-role-desc');
        if (descEl) descEl.textContent = roleDescs[cur] || '';
      };
      applyActiveStyle();
      btn.onclick = () => {
        const r = btn.dataset.role;
        AgentProfile.load().role = r;
        AgentProfile.save();
        applyActiveStyle();
        if (this.players[this.myId]) {
          this.players[this.myId].role = r;
          const pkt = { type: 'ROLE_UPDATE', id: this.myId, role: r };
          if (this.isHost) this.broadcast(pkt); else this.sendToHost(pkt);
        }
        renderHomeSquadSlots();
        if (window.HomeShowcase3D) HomeShowcase3D.refreshCharacter();
      };
    });

    const renderShop = () => {
      const list = document.getElementById('suit-shop-list');
      if (!list) return;
      const d = AgentProfile.load();
      if (!d.unlockedSuits) d.unlockedSuits = ['DEFAULT'];
      list.innerHTML = AgentProfile.suits.map(s => {
        const unlocked = d.unlockedSuits.includes(s.id);
        const equipped = d.equippedSuit === s.id;
        const hex = '#' + s.color.toString(16).padStart(6, '0');
        let btnHtml = '';
        if (equipped) btnHtml = '<span style="background:#16a34a;color:#fff;padding:4px 9px;border-radius:6px;font-size:0.68rem;font-weight:800;">EQUIPPED</span>';
        else if (unlocked) btnHtml = `<button type="button" data-suit="${s.id}" class="equip-suit-btn" style="background:#0284c7;border:none;color:#fff;padding:4px 10px;border-radius:6px;font-size:0.68rem;font-weight:800;cursor:pointer;">EQUIP</button>`;
        else btnHtml = `<button type="button" data-suit="${s.id}" class="buy-suit-btn" style="background:#eab308;border:none;color:#090d16;padding:4px 10px;border-radius:6px;font-size:0.68rem;font-weight:900;cursor:pointer;">🔓 ${s.cost} XP</button>`;
        return `<div style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:7px 9px;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="width:16px;height:16px;border-radius:4px;background:${hex};border:1px solid #fff;display:inline-block;"></span>
            <div><div style="color:#f8fafc;font-size:0.75rem;font-weight:800;">${s.name}</div><div style="color:#94a3b8;font-size:0.64rem;">${s.cost === 0 ? 'Free Standard Gear' : s.cost + ' XP Required'}</div></div>
          </div>
          ${btnHtml}
        </div>`;
      }).join('');

      list.querySelectorAll('.buy-suit-btn').forEach(b => {
        b.onclick = () => {
          const suit = AgentProfile.suits.find(x => x.id === b.dataset.suit);
          if (!suit) return;
          if ((d.xp || 0) < suit.cost) return alert(`⚠️ Need ${suit.cost} XP to unlock ${suit.name}!`);
          d.unlockedSuits.push(suit.id);
          d.equippedSuit = suit.id;
          AgentProfile.save();
          renderShop();
          if (window.HomeShowcase3D) HomeShowcase3D.refreshCharacter();
        };
      });
      list.querySelectorAll('.equip-suit-btn').forEach(b => {
        b.onclick = () => {
          d.equippedSuit = b.dataset.suit;
          AgentProfile.save();
          renderShop();
          if (window.HomeShowcase3D) HomeShowcase3D.refreshCharacter();
        };
      });
    };

    document.getElementById('toggle-shop-btn')?.addEventListener('click', () => {
      const dr = document.getElementById('armory-drawer');
      if (dr) { dr.classList.toggle('hidden'); renderShop(); }
    });
    document.getElementById('close-shop-btn')?.addEventListener('click', () => {
      document.getElementById('armory-drawer')?.classList.add('hidden');
    });

    document.getElementById('open-join-btn')?.addEventListener('click', () => {
      const row = document.getElementById('join-input-row');
      if (!row) return;
      const isHidden = row.classList.contains('hidden') || row.style.display === 'none';
      row.classList.remove('hidden');
      row.style.display = isHidden ? 'flex' : 'none';
    });

    const launchSmartMatch = () => {
      if (this.roomCode && !this.isHost) return;
      if (typeof SFX !== 'undefined') SFX.init();
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
          screen.orientation?.lock?.('landscape').catch(() => {});
        }
      } catch (e) {}

      const name = document.getElementById('player-name')?.value.trim() || AgentProfile.load().name || ('Agent-' + Math.floor(10 + Math.random() * 89));
      const role = AgentProfile.load().role || 'SCOUT';
      AgentProfile.load().name = name;
      AgentProfile.recordMatchStart();

      if (!this.roomCode) {
        this.isHost = true;
        this.myId = this.getDeviceUid();
        this.players = {
          [this.myId]: { id: this.myId, name, role, x: -33, z: 31, yaw: -Math.PI / 2, torch: true, downed: false, hiding: false }
        };
      } else if (this.players[this.myId]) {
        this.players[this.myId].name = name;
        this.players[this.myId].role = role;
      }

      const codes = this.generateCodes();
      const spotOrder = this.generateSpotOrder();

      if (this.roomCode && this.isHost) {
        this.broadcast({ type: 'START', players: this.players, codes, spotOrder, difficulty: this.difficulty });
      }
      Game3D.start(codes, spotOrder);
    };
    if (startBtn) startBtn.onclick = launchSmartMatch;

    if (createBtn) {
      createBtn.onclick = () => {
        if (this.isConnecting || this.roomCode) return;
        this.isConnecting = true;
        createBtn.disabled = true;
        if (joinBtn) joinBtn.disabled = true;
        const name = document.getElementById('player-name')?.value.trim() || AgentProfile.load().name || ('Agent-' + Math.floor(10 + Math.random() * 89));
        AgentProfile.load().name = name; AgentProfile.save();
        this.createRoom(name);
      };
    }

    if (joinBtn) {
      joinBtn.onclick = () => {
        if (this.isConnecting || this.roomCode) return;
        const name = document.getElementById('player-name')?.value.trim() || AgentProfile.load().name || ('Agent-' + Math.floor(10 + Math.random() * 89));
        AgentProfile.load().name = name; AgentProfile.save();
        const code = document.getElementById('room-code-input')?.value.trim().toUpperCase();
        if (!code || code.length < 4) return alert('Enter valid 4-letter Squad Code!');
        this.isConnecting = true;
        joinBtn.disabled = true;
        if (createBtn) createBtn.disabled = true;
        this.joinRoom(code, name);
      };
    }
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
        role: AgentProfile.load().role || 'SCOUT',
        x: -33, z: 31, yaw: -Math.PI / 2,
        torch: true, downed: false, hiding: false
      }
    };

    const cBtn = document.getElementById('create-room-btn');
    if (cBtn) { cBtn.disabled = false; cBtn.textContent = '📋 CODE: ' + code; cBtn.style.borderColor = '#4ade80'; cBtn.style.color = '#4ade80'; }
    if (this.renderHomeSquadSlots) this.renderHomeSquadSlots();

    if (typeof Peer !== 'undefined') {
      if (this.peer) this.peer.destroy();
      this.peer = new Peer(this.myId);
      this.peer.on('connection', (conn) => {
        this.conns.push(conn);
        conn.on('data', (data) => this.handleHostData(conn, data));
        conn.on('open', () => conn.send({ type: 'SQUAD', players: this.players }));
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

    this.players = {
      [this.myId]: {
        id: this.myId,
        name,
        role: AgentProfile.load().role || 'SCOUT',
        x: -29, z: 31, yaw: Math.PI / 2,
        torch: true, downed: false, hiding: false
      }
    };
    if (this.renderHomeSquadSlots) this.renderHomeSquadSlots();

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

  sendEvent(data) {
    if (this.isHost) this.broadcast(data);
    else this.sendToHost(data);
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
      if (this.renderHomeSquadSlots) this.renderHomeSquadSlots();
      this.broadcast({ type: 'SQUAD', players: this.players });
      if (conn && conn.open) conn.send({ type: 'SQUAD', players: this.players });
    } else if (data.type === 'ROLE_UPDATE') {
      if (this.players[data.id]) {
        this.players[data.id].role = data.role;
        if (this.renderHomeSquadSlots) this.renderHomeSquadSlots();
        this.broadcast({ type: 'SQUAD', players: this.players });
      }
    } else if (data.type === 'MOVE') {
      if (this.players[data.id]) Object.assign(this.players[data.id], data.state);
    } else if (data.type === 'WORLD_EVENT') {
      if (typeof Game3D !== 'undefined' && Game3D.applyNetworkEvent) {
        Game3D.applyNetworkEvent(data);
      }
      this.broadcast(data);
    } else if (data.type === 'RADIO') {
      if (typeof Game3D !== 'undefined') Game3D.showRadioToast(data.sender, data.msg);
      this.broadcast(data);
    }
  },

  handleClientData(data) {
    if (!data || !data.type) return;

    if (data.type === 'ROOM_FULL') {
      alert('⚠️ Squad is full (4/4 players)!');
      location.reload();
      return;
    }
    if (data.type === 'SQUAD') {
      const myBackup = this.players[this.myId];
      this.players = { ...data.players };
      if (myBackup) this.players[this.myId] = { ...this.players[this.myId], ...myBackup };
      if (this.renderHomeSquadSlots) this.renderHomeSquadSlots();
    } else if (data.type === 'START') {
      this.difficulty = data.difficulty || 'NORMAL';
      const myBackup = this.players[this.myId];
      this.players = { ...data.players };
      if (myBackup && !this.players[this.myId]) this.players[this.myId] = myBackup;
      AgentProfile.recordMatchStart();
      Game3D.start(data.codes, data.spotOrder);
    } else if (data.type === 'STATE') {
      if (data.players) {
        for (const [pid, pdata] of Object.entries(data.players)) {
          if (pid === this.myId) {
            if (this.players[this.myId]) this.players[this.myId].downed = pdata.downed;
            continue;
          }
          if (!this.players[pid]) this.players[pid] = { ...pdata };
          else Object.assign(this.players[pid], pdata);
        }
      }
      if (data.hunter && Game3D.hunter) {
        Game3D.hunter.x = data.hunter.x;
        Game3D.hunter.z = data.hunter.z;
        Game3D.hunter.yaw = data.hunter.yaw;
        Game3D.hunter.stunnedUntil = data.hunter.stunnedUntil || 0;
      }
    } else if (data.type === 'WORLD_EVENT') {
      if (typeof Game3D !== 'undefined' && Game3D.applyNetworkEvent) {
        Game3D.applyNetworkEvent(data);
      }
    } else if (data.type === 'RADIO') {
      if (typeof Game3D !== 'undefined') Game3D.showRadioToast(data.sender, data.msg);
    }
  },

  async toggleMic() {
    const btn = document.getElementById('mic-btn');
    if (!this.micEnabled) {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.micEnabled = true;
        if (btn) { btn.textContent = '🎤 ON'; btn.classList.add('on'); }
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
      if (btn) { btn.textContent = '🎤 OFF'; btn.classList.remove('on'); }
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

window.addEventListener('DOMContentLoaded', () => Net.initUI());
