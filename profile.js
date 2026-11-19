const AgentProfile = {
  key: 'sb09_agent_profile_v1',
  defaults: {
    name: '3RROR',
    role: 'SCOUT',
    xp: 0,
    wins: 0,
    bestSec: null,
    played: 0,
    suit: 'default'
  },

  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(this.key) || '{}');
      return { ...this.defaults, ...raw };
    } catch (e) {
      return { ...this.defaults };
    }
  },

  save(data) {
    try {
      localStorage.setItem(this.key, JSON.stringify({ ...this.load(), ...data }));
    } catch (e) {}
    this.renderUI();
  },

  setName(name) {
    const clean = String(name || '').trim().slice(0, 12) || '3RROR';
    this.save({ name: clean });
  },

  setRole(role) {
    const valid = ['SCOUT', 'ENGINEER', 'MEDIC', 'TECH'];
    this.save({ role: valid.includes(role) ? role : 'SCOUT' });
  },

  addXP(amount) {
    const cur = this.load();
    this.save({ xp: Math.max(0, (cur.xp || 0) + (Number(amount) || 0)) });
  },

  recordVictory(seconds) {
    const cur = this.load();
    const prevBest = cur.bestSec;
    const nextBest = typeof seconds === 'number' && seconds > 0
      ? (prevBest ? Math.min(prevBest, seconds) : seconds)
      : prevBest;
    this.save({
      wins: (cur.wins || 0) + 1,
      played: (cur.played || 0) + 1,
      bestSec: nextBest
    });
  },

  getEquippedSuit() {
    const suits = {
      default: { color: 0x0284c7, visor: 0x38bdf8 },
      crimson: { color: 0xdc2626, visor: 0xfca5a5 },
      emerald: { color: 0x16a34a, visor: 0x86efac }
    };
    const cur = this.load();
    return suits[cur.suit] || suits.default;
  },

  renderUI() {
    const d = this.load();
    const nameIn = document.getElementById('player-name');
    if (nameIn && document.activeElement !== nameIn) nameIn.value = d.name;

    const xpEl = document.getElementById('stat-xp');
    const winsEl = document.getElementById('stat-wins');
    const bestEl = document.getElementById('stat-best');
    const playedEl = document.getElementById('stat-played');
    const rankEl = document.getElementById('rank-badge');
    const barEl = document.getElementById('xp-bar-fill');

    if (xpEl) xpEl.textContent = String(d.xp || 0);
    if (winsEl) winsEl.textContent = String(d.wins || 0);
    if (playedEl) playedEl.textContent = String(d.played || 0);
    if (bestEl) {
      if (typeof d.bestSec === 'number') {
        const m = String(Math.floor(d.bestSec / 60)).padStart(2, '0');
        const s = String(d.bestSec % 60).padStart(2, '0');
        bestEl.textContent = `${m}:${s}`;
      } else {
        bestEl.textContent = '--:--';
      }
    }

    const xp = d.xp || 0;
    const rankName = xp >= 3000 ? 'VANGUARD' : (xp >= 1200 ? 'OPERATIVE' : 'ROOKIE');
    if (rankEl) rankEl.textContent = `🏆 ${rankName}`;
    if (barEl) barEl.style.width = `${Math.min(100, (xp % 1000) / 10)}%`;
  },

  init() {
    this.renderUI();
    const saveBtn = document.getElementById('save-profile-btn');
    const nameIn = document.getElementById('player-name');
    if (saveBtn && nameIn) {
      saveBtn.onclick = () => {
        this.setName(nameIn.value);
        if (window.Net && Net.players && Net.players[Net.myId]) {
          Net.players[Net.myId].name = this.load().name;
          Net.renderLobby?.();
        }
        if (window.HomeShowcase3D && HomeShowcase3D.refreshCharacter) {
          HomeShowcase3D.refreshCharacter();
        }
      };
    }

    const roleTips = {
      SCOUT: '🏃 Shadow Dash: 1.5x Speed + Silent Steps',
      ENGINEER: '🔧 Sonic Decoy: Lure threat away for 11s',
      MEDIC: '💉 Adrenaline Surge: Revive squad & restore Sanity',
      TECH: '⚡ EMP Pulse: 100% Battery & disrupt threat'
    };
    const tipEl = document.getElementById('role-desc');
    document.querySelectorAll('.role-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (tipEl && roleTips[btn.dataset.role]) tipEl.textContent = roleTips[btn.dataset.role];
      });
    });
  }
};
window.AgentProfile = AgentProfile;
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => AgentProfile.init());
} else {
  AgentProfile.init();
}
