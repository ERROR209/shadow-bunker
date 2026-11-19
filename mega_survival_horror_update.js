const fs = require("fs");

// 1. Update index.html with Difficulty Selector, Daily Contract, Crouch/Ping/Gadget buttons, Sanity Meter & Live CCTV Overlay
let html = fs.readFileSync("index.html", "utf8");

// Add Difficulty Selector + Daily Contract inside 3D Home Lobby right above START SOLO button
const diffAndContractHTML = `
        <!-- Difficulty Mode Selector (Normal / Nightmare / Inferno) -->
        <div style="display:flex;gap:4px;width:100%;background:rgba(9,13,22,0.9);padding:4px;border-radius:8px;border:1px solid #334155;">
          <button type="button" class="diff-btn" data-diff="NORMAL" style="flex:1;background:#16a34a;border:none;color:#fff;font-weight:900;font-size:0.64rem;padding:5px 2px;border-radius:6px;cursor:pointer;">🟢 NORMAL</button>
          <button type="button" class="diff-btn" data-diff="NIGHTMARE" style="flex:1;background:transparent;border:none;color:#94a3b8;font-weight:800;font-size:0.64rem;padding:5px 2px;border-radius:6px;cursor:pointer;">🟠 NIGHTMARE</button>
          <button type="button" class="diff-btn" data-diff="INFERNO" style="flex:1;background:transparent;border:none;color:#94a3b8;font-weight:800;font-size:0.64rem;padding:5px 2px;border-radius:6px;cursor:pointer;">🔴 INFERNO 3x</button>
        </div>
        <div id="daily-contract-box" style="width:100%;background:rgba(15,23,42,0.88);border:1px dashed #facc15;color:#fef08a;font-size:0.64rem;padding:4px 8px;border-radius:7px;text-align:left;">
          📜 <b>CONTRACT:</b> Extract with &gt;50% Sanity (+300 XP)
        </div>`;

if (!html.includes("class=\"diff-btn\"")) {
  html = html.replace(
    '<button id="solo-or-squad-start-btn"',
    diffAndContractHTML + '\n        <button id="solo-or-squad-start-btn"'
  );
}

// Add Sanity indicator to Waypoint Compass bar
if (!html.includes("id=\"sanity-text\"")) {
  html = html.replace(
    '<span id="stamina-text" style="color:#4ade80;">100%</span>',
    '<span id="stamina-text" style="color:#4ade80;">100%</span>\n      <span style="color:#475569;">|</span>\n      <span>🧠 SANITY:</span><span id="sanity-text" style="color:#38bdf8;">100%</span>'
  );
}

// Add Crouch, 3D Ping & Flare/Gadget buttons to HUD action controls
if (!html.includes("id=\"ping-btn\"")) {
  html = html.replace(
    '<button id="skill-btn"',
    '<button id="crouch-btn" class="action-btn" style="background:rgba(100,116,139,0.28);border-color:#94a3b8;color:#f1f5f9;">🧍 CROUCH</button>\n        <button id="ping-btn" class="action-btn" style="background:rgba(250,204,21,0.25);border-color:#facc15;color:#fef08a;">📍 PING</button>\n        <button id="flare-btn" class="action-btn" style="background:rgba(239,68,68,0.28);border-color:#ef4444;color:#fecaca;">🧨 FLARE</button>\n        <button id="skill-btn"'
  );
}

// Add Live CCTV Camera Monitor Overlay
if (!html.includes("id=\"cctv-modal\"")) {
  const cctvModalHTML = `
    <!-- Live CCTV Security Camera Feed Overlay -->
    <div id="cctv-modal" class="hidden" style="position:fixed;inset:0;z-index:75;pointer-events:none;flex-direction:column;justify-content:space-between;border:6px solid #22c55e;">
      <div style="background:rgba(2,6,23,0.88);padding:10px 16px;display:flex;justify-content:space-between;align-items:center;pointer-events:auto;">
        <span id="cctv-cam-label" style="color:#4ade80;font-family:monospace;font-weight:900;font-size:0.92rem;">📹 CAM-01: NORTH CORRIDOR [LIVE REC ●]</span>
        <div style="display:flex;gap:8px;">
          <button id="cctv-next-btn" class="mini-btn" style="background:#0284c7;border:1px solid #38bdf8;">NEXT CAM ⏭️</button>
          <button id="cctv-exit-btn" class="mini-btn" style="background:#dc2626;border:1px solid #f87171;">EXIT CCTV ✕</button>
        </div>
      </div>
      <div style="background:rgba(2,6,23,0.75);padding:6px;text-align:center;color:#4ade80;font-family:monospace;font-size:0.75rem;">
        SECURITY OVERRIDE ACTIVE • SPOT MONSTER & GUIDE YOUR SQUAD OVER VOICE/RADIO
      </div>
    </div>`;
  html = html.replace('<div id="game-screen" class="screen hidden">', '<div id="game-screen" class="screen hidden">\n' + cctvModalHTML);
}

fs.writeFileSync("index.html", html);

// 2. Update network.js to store selected Difficulty Mode & relay PING + FLARE + SENSOR events across squad
let net = fs.readFileSync("network.js", "utf8");

if (!net.includes("difficulty: 'NORMAL'")) {
  net = net.replace("  isConnecting: false,", "  isConnecting: false,\n  difficulty: 'NORMAL',");
}

// Wire Difficulty Selector buttons on Home 3D Lobby
const diffSelectorLogic = `
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.onclick = () => {
        this.difficulty = btn.dataset.diff || 'NORMAL';
        document.querySelectorAll('.diff-btn').forEach(b => {
          const active = b.dataset.diff === this.difficulty;
          b.style.background = active ? (this.difficulty === 'INFERNO' ? '#dc2626' : (this.difficulty === 'NIGHTMARE' ? '#ea580c' : '#16a34a')) : 'transparent';
          b.style.color = active ? '#fff' : '#94a3b8';
        });
      };
    });`;

if (!net.includes("querySelectorAll('.diff-btn')")) {
  net = net.replace("    renderHomeSquadSlots();", "    renderHomeSquadSlots();" + diffSelectorLogic);
}

// Relay PING and GADGET packets between Host and Teammates
if (!net.includes("data.type === 'TACTICAL_PING'")) {
  net = net.replace(
    "    if (data.type === 'CLASS_SKILL') {",
    `    if (data.type === 'TACTICAL_PING' || data.type === 'DEPLOY_GADGET') {
      if (typeof Game3D !== 'undefined' && Game3D.applyRemoteGadgetOrPing) {
        Game3D.applyRemoteGadgetOrPing(data);
      }
      if (this.isHost) this.broadcast(data);
      return;
    }
    if (data.type === 'CLASS_SKILL') {`
  );
  const parts = net.split("    if (data.type === 'CLASS_SKILL') {");
  if (parts.length === 3) {
    net = parts[0] + "    if (data.type === 'CLASS_SKILL') {" + parts[1] +
      `    if (data.type === 'TACTICAL_PING' || data.type === 'DEPLOY_GADGET') {
      if (typeof Game3D !== 'undefined' && Game3D.applyRemoteGadgetOrPing) {
        Game3D.applyRemoteGadgetOrPing(data);
      }
      return;
    }
    if (data.type === 'CLASS_SKILL') {` + parts[2];
  }
}

fs.writeFileSync("network.js", net);

// 3. Upgrade game.js with Monster Variants, Crouch Stealth, Sanity Hallucinations, Live CCTV, 3D Pings, Flares & Difficulty Modifiers
let game = fs.readFileSync("game.js", "utf8");

game = game.replace(
  "stamina: 100,",
  `stamina: 100,
  sanity: 100,
  crouching: false,
  inCCTV: false,
  cctvIdx: 0,
  flares: [],
  activePing: null,
  sensorRevealUntil: 0,
  lastHallucination: 0,`
);

game = game.replace(
  "this.intelBoxes = [];",
  "this.intelBoxes = [];\n    this.flares = [];\n    this.cctvConsoles = [];"
);

// Add Monster Variant Appearance Updater, CCTV System, Crouch, 3D Ping & Flare Methods
const megaSystemsCode = `  configureMonsterVariant(lvl) {
    if (!this.hunterMesh) return;
    const diff = Net.difficulty || 'NORMAL';
    const diffMult = diff === 'INFERNO' ? 1.24 : (diff === 'NIGHTMARE' ? 1.12 : 1.0);
    // Scale monster silhouette & glow color per level variant
    if (lvl === 2) {
      // THE WATCHER (Blind Sound Hunter - Pale Cyan Glow, Tall Slender)
      this.hunterMesh.scale.set(0.95, 1.15, 0.95);
      this.hunterVariant = 'THE WATCHER (BLIND SOUND HUNTER)';
      this.hunterSpeedMult = 1.05 * diffMult;
    } else if (lvl === 4) {
      // STALKER CRAWLER (Low fast runner, blinded by direct flashlight)
      this.hunterMesh.scale.set(1.25, 0.65, 1.35);
      this.hunterVariant = 'STALKER CRAWLER (LIGHT SENSITIVE)';
      this.hunterSpeedMult = 1.18 * diffMult;
    } else if (lvl === 5) {
      // TITAN PRIME BOSS (Massive Rooftop Final Boss)
      this.hunterMesh.scale.set(1.45, 1.38, 1.45);
      this.hunterVariant = 'TITAN PRIME (APEX BOSS)';
      this.hunterSpeedMult = 1.22 * diffMult;
    } else {
      this.hunterMesh.scale.set(1.0, 1.0, 1.0);
      this.hunterVariant = 'SUBJECT-0';
      this.hunterSpeedMult = 1.0 * diffMult;
    }
  },

  toggleCrouch() {
    this.crouching = !this.crouching;
    const btn = document.getElementById('crouch-btn');
    if (btn) {
      btn.style.background = this.crouching ? '#0284c7' : 'rgba(100,116,139,0.28)';
      btn.textContent = this.crouching ? '🧎 CROUCHED' : '🧍 CROUCH';
    }
  },

  dropFlare() {
    const me = Net.players[Net.myId];
    if (!me || me.downed || this.inCutscene) return;
    if (this.lastFlareTime && performance.now() - this.lastFlareTime < 15000) {
      return this.showRadioToast('FLARE', '⏳ Next Red Flare ready in a few seconds!');
    }
    this.lastFlareTime = performance.now();
    this.spawnFlareAt(me.x, me.z, me.name);
    const pkt = { type: 'DEPLOY_GADGET', kind: 'FLARE', x: me.x, z: me.z, by: me.name };
    if (Net.isHost) Net.broadcast(pkt); else Net.sendToHost(pkt);
  },

  spawnFlareAt(x, z, by) {
    const fLight = new THREE.PointLight(0xef4444, 5.2, 22);
    fLight.position.set(x, 0.6, z);
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.45, 8),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    stick.rotation.z = Math.PI / 2;
    stick.position.set(x, 0.1, z);
    this.mapGroup.add(fLight, stick);
    this.flares.push({ x, z, light: fLight, mesh: stick, until: performance.now() + 20000 });
    this.decoyPos = { x, z };
    this.decoyUntil = performance.now() + 9000;
    SFX.torchClick();
    this.showRadioToast('FLARE LIT', \`🧨 \${by} lit a Red Flare! Restores Sanity & lures threat!\`);
  },

  sendTacticalPing() {
    const me = Net.players[Net.myId];
    if (!me || this.inCutscene) return;
    const px = Math.max(-38, Math.min(38, me.x - Math.sin(me.yaw) * 6.5));
    const pz = Math.max(-38, Math.min(38, me.z - Math.cos(me.yaw) * 6.5));
    this.set3DPing(px, pz, me.name);
    const pkt = { type: 'TACTICAL_PING', x: px, z: pz, by: me.name };
    if (Net.isHost) Net.broadcast(pkt); else Net.sendToHost(pkt);
  },

  set3DPing(x, z, by) {
    if (this.pingMesh) this.mapGroup.remove(this.pingMesh);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.72, 24),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.08, z);
    this.mapGroup.add(ring);
    this.pingMesh = ring;
    this.activePing = { x, z, until: performance.now() + 12000 };
    SFX.tone(920, 'sine', 0.12, 0.18, 1280);
    this.showRadioToast('TACTICAL PING', \`📍 \${by} marked a location on radar!\`);
  },

  applyRemoteGadgetOrPing(data) {
    if (data.type === 'TACTICAL_PING') this.set3DPing(data.x, data.z, data.by);
    if (data.type === 'DEPLOY_GADGET' && data.kind === 'FLARE') this.spawnFlareAt(data.x, data.z, data.by);
  },

  openCCTV() {
    this.inCCTV = true;
    this.cctvIdx = 0;
    const modal = document.getElementById('cctv-modal');
    if (modal) { modal.classList.remove('hidden'); modal.style.display = 'flex'; }
    this.updateCCTVLabel();
  },

  closeCCTV() {
    this.inCCTV = false;
    const modal = document.getElementById('cctv-modal');
    if (modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }
  },

  updateCCTVLabel() {
    const cams = [
      { name: 'CAM-01: NORTH-WEST LAB', pos: [-30, 3.6, -30], look: [-10, 1.0, -10] },
      { name: 'CAM-02: NORTH-EAST SECTOR', pos: [30, 3.6, -30], look: [10, 1.0, -10] },
      { name: 'CAM-03: CENTRAL CORRIDOR', pos: [0, 3.8, 22], look: [0, 1.0, -8] },
      { name: 'CAM-04: SOUTH-EAST WING', pos: [30, 3.6, 30], look: [10, 1.0, 10] }
    ];
    this.cctvFeeds = cams;
    const lbl = document.getElementById('cctv-cam-label');
    if (lbl) lbl.textContent = \`📹 \${cams[this.cctvIdx % cams.length].name} [LIVE ●]\`;
  },

  awardXP(pts, reason) {`;

if (!game.includes("configureMonsterVariant(")) {
  game = game.replace("  awardXP(pts, reason) {", megaSystemsCode);
}

// Configure monster variant & spawn a CCTV Security Monitor Console on every level
game = game.replace(
  "this.clearMap();\n    this.level = lvl;",
  `this.clearMap();
    this.level = lvl;
    this.configureMonsterVariant(lvl);
    // Add Live CCTV Security Monitor Desk near spawn corridor
    const cctvDesk = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 1.1, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x22c55e, emissiveIntensity: 0.65 })
    );
    cctvDesk.position.set(-24, 0.55, 34);
    this.mapGroup.add(cctvDesk);
    this.cctvConsoles.push({ x: -24, z: 34, mesh: cctvDesk });`
);

// Add CCTV proximity interaction hint & handler
game = game.replace(
  "if (!this.nearAction && this.intelBoxes) {",
  `if (!this.nearAction && this.cctvConsoles) {
          for (const c of this.cctvConsoles) {
            if (Math.hypot(c.x - me.x, c.z - me.z) < 2.4) {
              this.nearAction = { type: 'CCTV' };
              hint.textContent = '📹 [USE] Open Live Bunker CCTV Cameras';
              break;
            }
          }
        }
        if (!this.nearAction && this.intelBoxes) {`
);

game = game.replace(
  "} else if (act.type === 'INTEL') {",
  `} else if (act.type === 'CCTV') {
      this.openCCTV();
    } else if (act.type === 'INTEL') {`
);

// Render CCTV camera feed when inCCTV is true
game = game.replace(
  "if (this.inCutscene && this.cutsceneShots) {",
  `if (this.inCCTV && this.cctvFeeds) {
        const feed = this.cctvFeeds[this.cctvIdx % this.cctvFeeds.length];
        const pan = Math.sin(performance.now() * 0.0015) * 3.5;
        this.camera.position.set(feed.pos[0], feed.pos[1], feed.pos[2]);
        this.camera.lookAt(feed.look[0] + pan, feed.look[1], feed.look[2]);
        this.renderer.render(this.scene, this.camera);
        return;
      }
      if (this.inCutscene && this.cutsceneShots) {`
);

// Update Sanity meter, Crouch stealth, Stalker flashlight blind, Inferno radar hide & Tactical Ping on minimap
const sanityAndStealthUpdate = `    // 4. Sanity / Fear Meter & Hallucination Audio
    const nearTeammate = Object.values(Net.players).some(p => p.id !== Net.myId && Math.hypot(p.x - me.x, p.z - me.z) < 10);
    const nearFlare = this.flares && this.flares.some(f => performance.now() < f.until && Math.hypot(f.x - me.x, f.z - me.z) < 12);
    if (me.torch || nearTeammate || nearFlare || this.nvgActive) {
      this.sanity = Math.min(100, (this.sanity || 100) + 0.04);
    } else {
      this.sanity = Math.max(0, (this.sanity || 100) - 0.055);
    }
    const sanEl = document.getElementById('sanity-text');
    if (sanEl) {
      const sVal = Math.round(this.sanity);
      sanEl.textContent = sVal + '%';
      sanEl.style.color = sVal < 30 ? '#ef4444' : (sVal < 60 ? '#facc15' : '#38bdf8');
    }
    if (this.sanity < 35 && performance.now() - (this.lastHallucination || 0) > 11000) {
      this.lastHallucination = performance.now();
      if (typeof SFX !== 'undefined' && SFX.playDistantEcho) SFX.playDistantEcho();
      this.showRadioToast('LOW SANITY', '🧠 Fear rising! Turn on Torch, light a Flare, or regroup with Squad!');
    }`;

game = game.replace(
  "const vig = document.getElementById('terror-vignette');",
  sanityAndStealthUpdate + "\n    const vig = document.getElementById('terror-vignette');"
);

// Crouch movement speed & camera eye height + Watcher blind stealth
game = game.replace(
  "const speed = (isRunning ? 0.155 : 0.080) * scoutMult;",
  "const crouchMult = this.crouching ? 0.52 : 1.0;\n        const speed = (isRunning ? 0.155 : 0.080) * scoutMult * crouchMult;"
);
game = game.replace(
  "me.makingNoise = isRunning && !me.hiding && (performance.now() >= this.scoutBuffUntil);",
  "me.makingNoise = !this.crouching && (isRunning || (this.level === 2 && isMoving)) && !me.hiding && (performance.now() >= this.scoutBuffUntil);"
);
game = game.replace(
  "const camY = 1.62 + (isMoving ? Math.sin(performance.now() * (isRunning ? 0.016 : 0.01)) * 0.055 : 0);",
  "const baseEye = this.crouching ? 0.98 : 1.62;\n        const camY = baseEye + (isMoving ? Math.sin(performance.now() * (isRunning ? 0.016 : 0.01)) * 0.045 : 0);"
);

// Hide Monster dot on radar in INFERNO mode (unless revealed by Ping or Flare) & draw Active Ping on Minimap
game = game.replace(
  "if (this.hunter) {",
  "if (this.hunter && ((Net.difficulty || 'NORMAL') !== 'INFERNO' || performance.now() < this.sensorRevealUntil)) {"
);
game = game.replace(
  "// Draw all teammates + self with distinct BGMI squad colors & directional arrows",
  `if (this.activePing && performance.now() < this.activePing.until) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx + this.activePing.x * scale, cy + this.activePing.z * scale, 5 + Math.sin(performance.now() * 0.015) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Draw all teammates + self with distinct BGMI squad colors & directional arrows`
);

// Apply Difficulty XP Multiplier (1.0x Normal, 1.75x Nightmare, 3.0x Inferno) + Daily Contract bonus on Victory
game = game.replace(
  "this.awardXP(isNewRecord ? 750 : 500, isNewRecord ? `NEW RECORD ${fmt}!` : `Extracted in ${fmt}`);",
  `const diff = Net.difficulty || 'NORMAL';
            const mult = diff === 'INFERNO' ? 3.0 : (diff === 'NIGHTMARE' ? 1.75 : 1.0);
            const contractBonus = (this.sanity || 0) >= 50 ? 300 : 0;
            const totalXP = Math.round(((isNewRecord ? 750 : 500) + contractBonus) * mult);
            this.awardXP(totalXP, isNewRecord ? \`NEW RECORD \${fmt} (\${diff})!\` : \`Extracted [\${diff}] in \${fmt}\`);`
);

// Bind Crouch, Ping, Flare & CCTV buttons
game = game.replace(
  "bindInstantTouch('nvg-toggle-btn', () => this.toggleNightVision());",
  `bindInstantTouch('nvg-toggle-btn', () => this.toggleNightVision());
    bindInstantTouch('crouch-btn', () => this.toggleCrouch());
    bindInstantTouch('ping-btn', () => this.sendTacticalPing());
    bindInstantTouch('flare-btn', () => this.dropFlare());
    const cctvNext = document.getElementById('cctv-next-btn');
    const cctvExit = document.getElementById('cctv-exit-btn');
    if (cctvNext) cctvNext.onclick = () => { this.cctvIdx++; this.updateCCTVLabel(); };
    if (cctvExit) cctvExit.onclick = () => this.closeCCTV();`
);

fs.writeFileSync("game.js", game);
console.log("SUCCESS: Monster Variants, Crouch Stealth, Live CCTV, 3D Pings, Flares, Sanity & Difficulty Modes deployed!");
