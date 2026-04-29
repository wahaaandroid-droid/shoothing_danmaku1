const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const startButton = document.getElementById("startButton");

const W = canvas.width;
const H = canvas.height;
const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rand = (min, max) => min + Math.random() * (max - min);
const dist2 = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

let running = false;
let paused = false;
let last = performance.now();
let time = 0;
let shake = 0;
let flash = 0;
let pointerActive = false;
let bossPhaseClock = 0;
let bulletClock = 0;
let enemyClock = 0;
let pickupClock = 0;
let phase = "stage";
let phaseTimer = 0;
let phaseBanner = 0;
let stageNo = 1;
let stageWaveIndex = 0;
let stageScroll = 0;

const STAGE_DURATION = 42;
const STAGE_WAVES = [
  { t: 0.8, type: "sweep", side: -1 },
  { t: 3.8, type: "sweep", side: 1 },
  { t: 7.2, type: "v" },
  { t: 11.5, type: "ambush" },
  { t: 13.4, type: "mid" },
  { t: 15.5, type: "sweep", side: -1 },
  { t: 19.0, type: "v" },
  { t: 23.0, type: "ambush" },
  { t: 25.0, type: "mid" },
  { t: 27.0, type: "sweep", side: 1 },
  { t: 31.0, type: "v" },
  { t: 35.5, type: "final" },
];

const keys = new Set();
const stars = [];
const playerBullets = [];
const missiles = [];
const enemyBullets = [];
const enemies = [];
const explosions = [];
const hitSparks = [];
const pickups = [];
const beams = [];
const particles = [];
const damageTexts = [];

const spriteSheet = new Image();
spriteSheet.src = "assets/sprite-sheet.png";
spriteSheet.onload = () => render();

const bgm = {
  stage: new Audio("BGM/BGM_Stage1_最初の警報.mp3"),
  boss: new Audio("BGM/BGM_Stage1BOSS_弾幕の門.mp3"),
};
let currentBgm = null;
let audioContext = null;
for (const track of Object.values(bgm)) {
  track.loop = true;
  track.volume = 0.58;
}

function ensureAudio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();
}

function playSfx(type, volume = 0.35) {
  if (!audioContext) return;
  try {
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    let stopAt = now + 0.09;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(type === "explode" ? 900 : type === "missile" ? 1600 : 2200, now);
    gain.gain.setValueAtTime(0.0001, now);

    if (type === "explode") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.28);
      gain.gain.exponentialRampToValueAtTime(volume * 1.35, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      stopAt = now + 0.34;
    } else if (type === "missile") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(volume * 0.65, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
      stopAt = now + 0.14;
    } else {
      osc.type = "square";
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.055);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      stopAt = now + 0.09;
    }
    osc.start(now);
    osc.stop(stopAt);
  } catch {
    // Audio failures should never interrupt gameplay.
  }
}

const sprites = {
  player: { sx: 72, sy: 162, sw: 325, sh: 430 },
  boss: { sx: 456, sy: 18, sw: 680, sh: 620 },
  enemyA: { sx: 72, sy: 684, sw: 250, sh: 225 },
  enemyB: { sx: 430, sy: 690, sw: 292, sh: 202 },
  enemyC: { sx: 812, sy: 688, sw: 265, sh: 210 },
  bulletCyan: { sx: 92, sy: 948, sw: 130, sh: 225 },
  bulletPink: { sx: 360, sy: 946, sw: 130, sh: 218 },
  explosion: { sx: 560, sy: 938, sw: 320, sh: 250 },
  power: { sx: 960, sy: 964, sw: 224, sh: 232 },
};

const player = {
  x: W / 2,
  y: H - 120,
  r: 6,
  lives: 3,
  bombs: 2,
  power: 5,
  invuln: 1.6,
  fireCooldown: 0,
  missileCooldown: 0,
  focus: false,
  score: 8765432,
  chain: 0,
  graze: 0,
  targetX: W / 2,
  targetY: H - 88,
};

const boss = {
  x: W / 2,
  y: -260,
  r: 68,
  hp: 9000,
  maxHp: 9000,
  corePulse: 0,
};

function playBgm(name) {
  const next = bgm[name];
  if (!next || currentBgm === next) return;
  if (currentBgm) {
    currentBgm.pause();
    currentBgm.currentTime = 0;
  }
  currentBgm = next;
  currentBgm.currentTime = 0;
  currentBgm.play().catch(() => {});
}

function stopBgm() {
  if (!currentBgm) return;
  currentBgm.pause();
  currentBgm.currentTime = 0;
  currentBgm = null;
}

function initStars() {
  stars.length = 0;
  for (let i = 0; i < 270; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      z: rand(0.2, 1.4),
      c: Math.random() > 0.8 ? "#8ef7ff" : "#ffffff",
    });
  }
}

function resetGame() {
  player.x = W / 2;
  player.y = H - 120;
  player.targetX = player.x;
  player.targetY = player.y;
  player.lives = 3;
  player.bombs = 2;
  player.power = 5;
  player.invuln = 2;
  player.fireCooldown = 0;
  player.missileCooldown = 0;
  player.score = 8765432;
  player.chain = 0;
  player.graze = 0;
  boss.x = W / 2;
  boss.y = -260;
  boss.maxHp = 9000;
  boss.hp = boss.maxHp;
  boss.corePulse = 0;
  stageNo = 1;
  time = 0;
  shake = 0;
  flash = 0;
  bossPhaseClock = 0;
  bulletClock = 0;
  enemyClock = 0;
  pickupClock = 0;
  beginStage();
  playerBullets.length = 0;
  missiles.length = 0;
  enemyBullets.length = 0;
  enemies.length = 0;
  explosions.length = 0;
  hitSparks.length = 0;
  pickups.length = 0;
  beams.length = 0;
  particles.length = 0;
  damageTexts.length = 0;
  initStars();
}

function startGame() {
  ensureAudio();
  resetGame();
  running = true;
  paused = false;
  playBgm("stage");
  overlay.classList.add("hidden");
  last = performance.now();
  requestAnimationFrame(loop);
}

function beginStage() {
  phase = "stage";
  phaseTimer = 0;
  phaseBanner = 2.2;
  stageWaveIndex = 0;
  stageScroll = 0;
  boss.x = W / 2;
  boss.y = -260;
  boss.hp = boss.maxHp;
  bulletClock = 0;
  enemyClock = 0;
  pickupClock = 0;
  enemyBullets.length = 0;
  enemies.length = 0;
  missiles.length = 0;
  playBgm("stage");
}

function beginBossPhase() {
  phase = "boss";
  phaseTimer = 0;
  phaseBanner = 2.4;
  bossPhaseClock = 0;
  bulletClock = 0;
  enemyClock = 0;
  enemyBullets.length = 0;
  enemies.length = 0;
  missiles.length = 0;
  boss.x = W / 2;
  boss.y = -230;
  boss.hp = boss.maxHp;
  playBgm("boss");
}

function clearStage() {
  phase = "clear";
  phaseTimer = 0;
  phaseBanner = 3.2;
  enemyBullets.length = 0;
  enemies.length = 0;
  playerBullets.length = 0;
  missiles.length = 0;
  player.score += 250000 + stageNo * 50000;
  player.bombs = Math.min(4, player.bombs + 1);
  stopBgm();
  massiveExplosion(boss.x, boss.y, 1.8);
}

function advanceStage() {
  stageNo++;
  boss.maxHp = 9000 + (stageNo - 1) * 2200;
  player.invuln = 2.2;
  player.chain = 0;
  beginStage();
}

startButton.addEventListener("click", startGame);
window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "Space") {
    event.preventDefault();
    if (!running) startGame();
  }
  if (event.code === "KeyX") useBomb();
  if (event.code === "KeyP") paused = !paused;
});
window.addEventListener("keyup", (event) => keys.delete(event.code));

function pointerToGame(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * W,
    y: ((event.clientY - rect.top) / rect.height) * H,
  };
}

canvas.addEventListener("pointerdown", (event) => {
  pointerActive = true;
  canvas.setPointerCapture(event.pointerId);
  const p = pointerToGame(event);
  player.targetX = p.x;
  player.targetY = p.y;
});
canvas.addEventListener("pointermove", (event) => {
  if (!pointerActive) return;
  const p = pointerToGame(event);
  player.targetX = p.x;
  player.targetY = p.y;
});
canvas.addEventListener("pointerup", () => {
  pointerActive = false;
});

function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (running && !paused) update(dt);
  render();
  if (running) requestAnimationFrame(loop);
}

function update(dt) {
  time += dt;
  phaseTimer += dt;
  phaseBanner = Math.max(0, phaseBanner - dt);
  if (phase === "boss") bossPhaseClock += dt;
  bulletClock += dt;
  enemyClock += dt;
  pickupClock += dt;
  stageScroll += (phase === "stage" ? 105 : 28) * dt;
  shake = Math.max(0, shake - dt * 20);
  flash = Math.max(0, flash - dt * 2.8);
  player.invuln = Math.max(0, player.invuln - dt);
  boss.corePulse += dt;
  updatePlayer(dt);
  if (phase === "stage" && phaseTimer >= STAGE_DURATION) beginBossPhase();
  if (phase === "boss") updateBoss(dt);
  updateSpawns(dt);
  updateEntities(dt);
  collide();
  if (phase === "clear" && phaseTimer > 4.4) advanceStage();
}

function updatePlayer(dt) {
  player.focus = keys.has("ShiftLeft") || keys.has("ShiftRight");
  let dx = 0;
  let dy = 0;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) dx += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) dy += 1;

  if (pointerActive) {
    player.x += (player.targetX - player.x) * Math.min(1, dt * 18);
    player.y += (player.targetY - player.y) * Math.min(1, dt * 18);
  } else if (dx || dy) {
    const len = Math.hypot(dx, dy) || 1;
    const speed = player.focus ? 210 : 355;
    player.x += (dx / len) * speed * dt;
    player.y += (dy / len) * speed * dt;
  }
  player.x = clamp(player.x, 42, W - 42);
  player.y = clamp(player.y, 78, H - 34);

  player.fireCooldown -= dt;
  player.missileCooldown -= dt;
  if (player.fireCooldown <= 0) {
    firePlayer();
    player.fireCooldown = player.focus ? 0.075 : 0.095;
  }
}

function firePlayer() {
  const spread = player.focus ? 11 : 25;
  const offsets = [-spread, 0, spread];
  for (const ox of offsets) {
    playerBullets.push({ x: player.x + ox, y: player.y - 22, vx: ox * 0.18, vy: -850, r: 4, damage: ox === 0 ? 12 : 7 });
  }
  if (player.power >= 5) {
    playerBullets.push({ x: player.x - 34, y: player.y - 8, vx: -38, vy: -730, r: 3, damage: 5 });
    playerBullets.push({ x: player.x + 34, y: player.y - 8, vx: 38, vy: -730, r: 3, damage: 5 });
  }
  if (player.power >= 8 && player.missileCooldown <= 0) {
    missiles.push({ x: player.x - 28, y: player.y + 4, vx: -130, vy: -330, r: 7, damage: 28, life: 2.8, turn: 7.5, smoke: 0 });
    missiles.push({ x: player.x + 28, y: player.y + 4, vx: 130, vy: -330, r: 7, damage: 28, life: 2.8, turn: 7.5, smoke: 0 });
    player.missileCooldown = player.focus ? 0.42 : 0.34;
    playSfx("missile", 0.12);
  }
  if (player.focus) {
    beams.push({ x: player.x, y: player.y - 34, life: 0.08, w: 8 });
  }
}

function updateBoss(dt) {
  boss.x = W / 2 + Math.sin(time * 0.9) * 76 + Math.sin(time * 1.7) * 16;
  const targetY = 224 + Math.sin(time * 1.1) * 15;
  boss.y += (targetY - boss.y) * Math.min(1, dt * 2.5);
  if (bulletClock > 0.18) {
    bulletClock = 0;
    const phase = Math.floor((bossPhaseClock / 7) % 4);
    if (phase === 0) spiralBurst();
    if (phase === 1) flowerBurst();
    if (phase === 2) aimedFans();
    if (phase === 3) helixStorm();
  }
}

function spiralBurst() {
  const base = time * 3.8;
  for (let i = 0; i < 22; i++) {
    const a = base + (i / 22) * TAU;
    spawnBullet(boss.x, boss.y + 18, a, 158 + (i % 2) * 38, "#ff7a30", 7, "needle");
    spawnBullet(boss.x, boss.y + 18, -a + time, 126, "#ff35cf", 6, "orb");
  }
}

function flowerBurst() {
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * TAU + Math.sin(time * 2) * 0.6;
    const speed = 105 + 90 * Math.sin(i * 1.7 + time) ** 2;
    spawnBullet(boss.x, boss.y, a, speed, i % 3 ? "#ff4fcf" : "#62eaff", 6, "petal");
  }
}

function aimedFans() {
  const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
  for (let fan = -2; fan <= 2; fan++) {
    for (let i = -3; i <= 3; i++) {
      spawnBullet(boss.x + fan * 17, boss.y + 34, aim + i * 0.11 + fan * 0.03, 205 + Math.abs(i) * 18, fan % 2 ? "#ff4d7e" : "#8ff6ff", 6, "needle");
    }
  }
}

function helixStorm() {
  for (let arm = 0; arm < 4; arm++) {
    const a = time * 4.2 + arm * Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      spawnBullet(boss.x, boss.y, a + i * 0.12, 128 + i * 24, arm % 2 ? "#ad5cff" : "#ff8642", 5, "orb");
    }
  }
}

function spawnBullet(x, y, angle, speed, color, r, kind) {
  enemyBullets.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r,
    color,
    kind,
    age: 0,
    graze: false,
  });
}

function updateSpawns(dt) {
  if (phase === "stage") {
    updateStageSpawns();
  } else if (phase === "boss" && enemyClock > 5.5) {
    enemyClock = 0;
    const side = Math.random() > 0.5 ? -1 : 1;
    spawnEnemy(side < 0 ? -46 : W + 46, rand(360, 600), side * -rand(100, 150), rand(-12, 28), side, 55, "small");
  }
  if (pickupClock > 9) {
    pickupClock = 0;
    pickups.push({ x: rand(160, W - 160), y: -20, vy: 96, r: 10, type: Math.random() > 0.65 ? "bomb" : "power" });
  }
}

function updateStageSpawns() {
  while (stageWaveIndex < STAGE_WAVES.length && phaseTimer >= STAGE_WAVES[stageWaveIndex].t) {
    spawnStageWave(STAGE_WAVES[stageWaveIndex]);
    stageWaveIndex++;
  }
  if (enemyClock > 1.15) {
    enemyClock = 0;
    const side = Math.random() > 0.5 ? -1 : 1;
    spawnEnemy(side < 0 ? -42 : W + 42, rand(190, 760), side * -rand(120, 185), rand(-10, 42), side, 42, "small");
  }
}

function spawnStageWave(wave) {
  if (wave.type === "sweep") {
    for (let i = 0; i < 7; i++) {
      const y = 150 + i * 62;
      const x = wave.side < 0 ? -60 - i * 26 : W + 60 + i * 26;
      spawnEnemy(x, y, wave.side * -170, 35 + i * 5, wave.side, 46, "small", i % 2 ? "enemyA" : "enemyB");
    }
  }
  if (wave.type === "v") {
    for (let i = -4; i <= 4; i++) {
      spawnEnemy(W / 2 + i * 44, -80 - Math.abs(i) * 28, i * 32, 165 + Math.abs(i) * 10, i < 0 ? -1 : 1, 50, "small", i % 3 ? "enemyB" : "enemyA");
    }
  }
  if (wave.type === "ambush") {
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? -1 : 1;
      spawnEnemy(side < 0 ? -52 : W + 52, 260 + i * 68, side * -210, -20, side, 38, "small", side < 0 ? "enemyA" : "enemyB");
    }
  }
  if (wave.type === "final") {
    for (let ring = 0; ring < 2; ring++) {
      for (let i = 0; i < 9; i++) {
        spawnEnemy(78 + i * 70, -70 - ring * 130, (i - 4) * 16, 190 + ring * 24, i < 4 ? -1 : 1, 62, "small", i % 2 ? "enemyA" : "enemyB");
      }
    }
  }
  if (wave.type === "mid") {
    for (let i = 0; i < 3; i++) {
      spawnEnemy(155 + i * 205, -110 - i * 70, (i - 1) * 18, 92, i === 0 ? -1 : 1, 260, "medium", "enemyC");
    }
  }
}

function spawnEnemy(x, y, vx, vy, side, hp, size = "small", spriteKey = null) {
  const isMedium = size === "medium";
  enemies.push({
    x,
    y,
    vx,
    vy,
    r: isMedium ? 34 : 18,
    hp,
    maxHp: hp,
    t: 0,
    side,
    size,
    spriteKey: spriteKey || (isMedium ? "enemyC" : side < 0 ? "enemyA" : "enemyB"),
    hitFlash: 0,
    fireClock: rand(0, 0.5),
  });
}

function updateEntities(dt) {
  for (const s of stars) {
    s.y += (phase === "stage" ? 68 : 18) * s.z * dt;
    if (s.y > H) {
      s.y = 0;
      s.x = Math.random() * W;
    }
  }
  moveList(playerBullets, dt);
  updateMissiles(dt);
  moveList(enemyBullets, dt, (b) => {
    b.age += dt;
    if (b.kind === "petal") {
      b.vx += Math.sin(b.age * 7) * 8 * dt;
      b.vy += Math.cos(b.age * 5) * 8 * dt;
    }
  });
  for (const e of enemies) {
    e.t += dt;
    e.hitFlash = Math.max(0, e.hitFlash - dt * 8);
    e.fireClock += dt;
    e.x += e.vx * dt;
    e.y += Math.sin(e.t * (e.size === "medium" ? 2.4 : 5)) * (e.size === "medium" ? 18 : 42) * dt + e.vy * dt;
    const fireInterval = e.size === "medium" ? 0.72 : 1.15;
    if (e.fireClock > fireInterval) fireEnemy(e);
  }
  for (const p of pickups) {
    p.y += p.vy * dt;
    p.x += Math.sin(time * 3 + p.y * 0.02) * 30 * dt;
  }
  decayList(explosions, dt);
  decayList(hitSparks, dt);
  decayList(beams, dt);
  decayList(particles, dt);
  decayList(damageTexts, dt);
  cull();
}

function updateMissiles(dt) {
  for (const m of missiles) {
    m.life -= dt;
    m.smoke -= dt;
    const target = findMissileTarget(m);
    if (target) {
      const speed = Math.max(360, Math.hypot(m.vx, m.vy));
      const desired = Math.atan2(target.y - m.y, target.x - m.x);
      const current = Math.atan2(m.vy, m.vx);
      let diff = desired - current;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      const next = current + clamp(diff, -m.turn * dt, m.turn * dt);
      m.vx = Math.cos(next) * speed;
      m.vy = Math.sin(next) * speed;
    }
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    if (m.smoke <= 0) {
      m.smoke = 0.035;
      particles.push({ x: m.x, y: m.y, vx: rand(-25, 25) - m.vx * 0.05, vy: rand(-25, 25) - m.vy * 0.05, life: 0.38, color: "#ffad45" });
    }
  }
}

function findMissileTarget(m) {
  let best = null;
  let bestD = Infinity;
  for (const e of enemies) {
    const d = dist2(m, e);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  if (phase === "boss" && boss.hp > 0) {
    const d = dist2(m, boss);
    if (d < bestD) best = boss;
  }
  return best;
}

function fireEnemy(e) {
  e.fireClock = 0;
  const a = Math.atan2(player.y - e.y, player.x - e.x);
  if (e.size === "medium") {
    for (let i = -2; i <= 2; i++) {
      spawnBullet(e.x, e.y + 10, a + i * 0.16, 175 + Math.abs(i) * 20, i % 2 ? "#ff4fcf" : "#62eaff", 6, "petal");
    }
  } else {
    spawnBullet(e.x, e.y, a, phase === "stage" ? 250 : 230, "#ffad45", 5, "needle");
  }
}

function moveList(list, dt, extra) {
  for (const item of list) {
    if (extra) extra(item);
    item.x += item.vx * dt;
    item.y += item.vy * dt;
  }
}

function decayList(list, dt) {
  for (const item of list) item.life -= dt;
}

function cull() {
  removeWhere(playerBullets, (b) => b.y < -60 || b.x < -80 || b.x > W + 80);
  removeWhere(missiles, (m) => m.life <= 0 || m.y < -140 || m.x < -140 || m.x > W + 140 || m.y > H + 140);
  removeWhere(enemyBullets, (b) => b.y > H + 80 || b.y < -100 || b.x < -120 || b.x > W + 120);
  removeWhere(enemies, (e) => e.x < -90 || e.x > W + 90 || e.hp <= 0);
  removeWhere(pickups, (p) => p.y > H + 40);
  removeWhere(explosions, (e) => e.life <= 0);
  removeWhere(hitSparks, (s) => s.life <= 0);
  removeWhere(beams, (b) => b.life <= 0);
  removeWhere(particles, (p) => p.life <= 0);
  removeWhere(damageTexts, (d) => d.life <= 0);
}

function removeWhere(list, predicate) {
  for (let i = list.length - 1; i >= 0; i--) {
    if (predicate(list[i])) list.splice(i, 1);
  }
}

function collide() {
  for (let i = playerBullets.length - 1; i >= 0; i--) {
    const b = playerBullets[i];
    if (phase === "boss" && dist2(b, boss) < (boss.r + b.r) ** 2) {
      playerBullets.splice(i, 1);
      spawnHitSpark(b.x, b.y, "#8df8ff", 0.85);
      playSfx("hit", 0.16);
      damageBoss(b.damage);
      continue;
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (dist2(b, e) < (e.r + b.r) ** 2) {
        e.hp -= b.damage;
        e.hitFlash = 1;
        spawnHitSpark(b.x, b.y, e.size === "medium" ? "#ffdf65" : "#8df8ff", e.size === "medium" ? 1.25 : 0.75);
        playSfx("hit", e.size === "medium" ? 0.18 : 0.12);
        playerBullets.splice(i, 1);
        if (e.hp <= 0) killEnemy(e);
        break;
      }
    }
  }
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    let consumed = false;
    if (phase === "boss" && dist2(m, boss) < (boss.r + m.r) ** 2) {
      missiles.splice(i, 1);
      spawnHitSpark(m.x, m.y, "#ffad45", 1.25);
      playSfx("explode", 0.16);
      damageBoss(m.damage);
      continue;
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (dist2(m, e) < (e.r + m.r) ** 2) {
        e.hp -= m.damage;
        e.hitFlash = 1;
        spawnHitSpark(m.x, m.y, "#ffad45", 1.15);
        playSfx("explode", 0.15);
        missiles.splice(i, 1);
        consumed = true;
        if (e.hp <= 0) killEnemy(e);
        break;
      }
    }
    if (consumed) continue;
  }
  for (const b of enemyBullets) {
    const d = Math.sqrt(dist2(b, player));
    if (!b.graze && d < 32 && d > player.r + b.r) {
      b.graze = true;
      player.graze++;
      player.score += 240;
      player.chain++;
      particles.push({ x: player.x, y: player.y, vx: rand(-60, 60), vy: rand(-90, 20), life: 0.35, color: "#8df8ff" });
    }
    if (player.invuln <= 0 && d < player.r + b.r) {
      hitPlayer();
      break;
    }
  }
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    if (dist2(p, player) < (p.r + 18) ** 2) {
      if (p.type === "bomb") player.bombs = Math.min(4, player.bombs + 1);
      else player.power = Math.min(8, player.power + 1);
      player.score += 2500;
      pickups.splice(i, 1);
    }
  }
}

function damageBoss(amount) {
  if (phase !== "boss") return;
  boss.hp = Math.max(0, boss.hp - amount);
  player.score += amount * 23;
  player.chain++;
  if (Math.random() < 0.24) spawnHitSpark(boss.x + rand(-42, 42), boss.y + rand(-38, 38), "#ffdf65", 0.9);
  if (boss.hp <= 0) {
    player.score += 100000;
    clearStage();
  }
}

function killEnemy(e) {
  player.score += e.size === "medium" ? 26000 : 8200;
  player.chain += e.size === "medium" ? 9 : 4;
  massiveExplosion(e.x, e.y, e.size === "medium" ? 0.95 : 0.5);
  playSfx("explode", e.size === "medium" ? 0.3 : 0.22);
  if (Math.random() < 0.35) pickups.push({ x: e.x, y: e.y, vy: 105, r: 9, type: "power" });
}

function spawnHitSpark(x, y, color = "#8df8ff", scale = 1) {
  hitSparks.push({ x, y, life: 0.18 * scale, max: 0.18 * scale, scale, color });
  for (let i = 0; i < 6 * scale; i++) {
    const a = rand(0, TAU);
    const s = rand(35, 150) * scale;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.16, 0.34), color });
  }
}

function hitPlayer() {
  player.lives--;
  player.invuln = 2.4;
  player.chain = 0;
  shake = 14;
  flash = 0.4;
  massiveExplosion(player.x, player.y, 0.7);
  playSfx("explode", 0.28);
  enemyBullets.length = Math.floor(enemyBullets.length * 0.42);
  if (player.lives <= 0) {
    running = false;
    overlay.querySelector("h1").textContent = "MISSION LOST";
    overlay.querySelector("p").textContent = `SCORE ${formatScore(player.score)}`;
    startButton.textContent = "RETRY";
    overlay.classList.remove("hidden");
    stopBgm();
  }
}

function useBomb() {
  if (!running || player.bombs <= 0) return;
  player.bombs--;
  player.invuln = 1.4;
  flash = 0.8;
  shake = 18;
  playSfx("explode", 0.34);
  const removed = enemyBullets.splice(0, enemyBullets.length);
  for (let i = 0; i < removed.length; i += 5) {
    particles.push({ x: removed[i].x, y: removed[i].y, vx: rand(-150, 150), vy: rand(-180, 80), life: rand(0.35, 0.8), color: removed[i].color });
  }
  if (phase === "boss") {
    boss.hp = Math.max(0, boss.hp - 280);
    massiveExplosion(boss.x, boss.y, 1.3);
    if (boss.hp <= 0) clearStage();
  }
}

function massiveExplosion(x, y, scale = 1) {
  explosions.push({ x, y, life: 0.7 * scale, max: 0.7 * scale, scale });
  for (let i = 0; i < 34 * scale; i++) {
    const a = rand(0, TAU);
    const s = rand(50, 260) * scale;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.9), color: Math.random() > 0.45 ? "#ff7c33" : "#7df4ff" });
  }
}

function render() {
  ctx.save();
  if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
  drawBackground();
  drawStructures();
  if (phase === "boss") drawBoss();
  drawEnemies();
  drawPickups();
  drawPlayerBullets();
  drawBeams();
  drawEnemyBullets();
  drawPlayer();
  drawEffects();
  ctx.restore();
  drawHud();
  drawPhaseText();
  if (paused) drawPause();
  if (flash > 0) {
    ctx.fillStyle = `rgba(160, 240, 255, ${flash * 0.22})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#05051a");
  g.addColorStop(0.45, "#071936");
  g.addColorStop(1, "#020712");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(940, 142);
  ctx.rotate(time * 0.035);
  for (let i = 0; i < 42; i++) {
    ctx.strokeStyle = `rgba(${90 + i * 3}, ${150 + i}, 255, ${0.08 - i * 0.001})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 24 + i * 4.5, 8 + i * 2, i * 0.09, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();

  for (const s of stars) {
    ctx.fillStyle = s.c;
    ctx.globalAlpha = 0.35 + s.z * 0.45;
    ctx.fillRect(s.x, s.y, s.z * 1.5, s.z * 1.5);
  }
  ctx.globalAlpha = 1;
}

function drawStructures() {
  const loop = H + 360;
  const offset = phase === "stage" ? stageScroll % loop : 0;
  for (let lane = -1; lane <= 1; lane++) {
    const y = lane * loop + offset;
    drawStation(-90, 110 + y, 0.72);
    drawStation(W + 90, 130 + y, -0.72);
    drawPlatform(W - 118, 520 + y, -0.82);
    drawPlatform(112, 600 + y, 0.82);
  }
}

function drawStation(x, y, side) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(side, Math.abs(side));
  ctx.fillStyle = "#172135";
  ctx.strokeStyle = "#34445c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 35);
  ctx.lineTo(92, 0);
  ctx.lineTo(128, 162);
  ctx.lineTo(62, 306);
  ctx.lineTo(-24, 285);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#26364f";
  for (let i = 0; i < 8; i++) ctx.fillRect(40 + i * 10, 108 + i * 19, 42, 8);
  ctx.fillStyle = "#ff8854";
  ctx.fillRect(88, 318, 46, 7);
  ctx.fillStyle = "#6eefff";
  ctx.fillRect(120, 264, 11, 42);
  ctx.restore();
}

function drawPlatform(x, y, side) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(side, 1);
  ctx.fillStyle = "#1a2841";
  ctx.strokeStyle = "#4a5d78";
  ctx.lineWidth = 2;
  ctx.fillRect(-6, 0, 150, 34);
  ctx.strokeRect(-6, 0, 150, 34);
  ctx.fillStyle = "#0d1424";
  ctx.fillRect(18, 34, 98, 18);
  ctx.fillStyle = "#ff7839";
  ctx.fillRect(16, 8, 42, 5);
  ctx.fillStyle = "#56dcff";
  ctx.beginPath();
  ctx.arc(132, 18, 13, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawBoss() {
  if (spriteSheet.complete && spriteSheet.naturalWidth) {
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.scale(1 + Math.sin(boss.corePulse * 8) * 0.025, 1 + Math.sin(boss.corePulse * 8) * 0.025);
    drawSprite(sprites.boss, 0, 0, 380, 346, 0, true);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(boss.x, boss.y);
  const pulse = 1 + Math.sin(boss.corePulse * 8) * 0.045;
  ctx.scale(pulse, pulse);
  ctx.shadowColor = "#ff5bc8";
  ctx.shadowBlur = 28;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU + Math.sin(time * 1.6) * 0.2;
    drawWingSpike(Math.cos(a) * 50, Math.sin(a) * 36 + 12, a, i % 2 ? "#ff7a3f" : "#ffd06e");
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#51676a";
  ctx.strokeStyle = "#b8f9e8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 58, 72, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#223746";
  ctx.beginPath();
  ctx.ellipse(-48, 2, 30, 48, -0.55, 0, TAU);
  ctx.ellipse(48, 2, 30, 48, 0.55, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#ff5fe0";
  ctx.shadowColor = "#ff4bd5";
  ctx.shadowBlur = 25;
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.lineTo(22, 4);
  ctx.lineTo(0, 44);
  ctx.lineTo(-22, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ecfff6";
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(0, 2, 10 + Math.sin(time * 12) * 3, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawWingSpike(x, y, a, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(78, 0);
  ctx.lineTo(0, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEnemies() {
  for (const e of enemies) {
    if (spriteSheet.complete && spriteSheet.naturalWidth) {
      const s = sprites[e.spriteKey] || sprites.enemyA;
      const w = e.size === "medium" ? 128 : 86;
      const h = e.size === "medium" ? 102 : 72;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(e.side < 0 ? -1 : 1, 1);
      drawSprite(s, 0, 0, w, h, Math.sin(e.t * 5) * 0.08, true);
      if (e.hitFlash > 0) {
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = e.hitFlash * 0.72;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.42, h * 0.36, 0, 0, TAU);
        ctx.fill();
      }
      if (e.size === "medium") {
        ctx.globalCompositeOperation = "source-over";
        drawBar(-48, h * 0.5 + 8, 96, 6, e.hp / e.maxHp, "#ff713d", "#7df4ff");
      }
      ctx.restore();
      continue;
    }
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.side * 0.18 + Math.sin(e.t * 8) * 0.08);
    ctx.fillStyle = "#b9c6d4";
    ctx.strokeStyle = "#29364c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(24 * -e.side, 0);
    ctx.lineTo(-18 * -e.side, -12);
    ctx.lineTo(-12 * -e.side, 0);
    ctx.lineTo(-18 * -e.side, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ff8b42";
    ctx.fillRect(-4, -4, 10, 8);
    ctx.restore();
  }
}

function drawPlayer() {
  if (spriteSheet.complete && spriteSheet.naturalWidth) {
    ctx.save();
    ctx.translate(player.x, player.y);
    if (player.invuln > 0 && Math.floor(time * 18) % 2 === 0) ctx.globalAlpha = 0.5;
    ctx.shadowColor = "#62f0ff";
    ctx.shadowBlur = 22;
    drawSprite(sprites.player, 0, 0, 76, 104, 0, true);
    ctx.shadowBlur = 0;
    if (player.focus) {
      ctx.strokeStyle = "rgba(255, 87, 217, 0.86)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = "#ff4ddb";
    ctx.beginPath();
    ctx.arc(0, 0, player.r, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.invuln > 0 && Math.floor(time * 18) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.shadowColor = "#62f0ff";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#d8f8ff";
  ctx.strokeStyle = "#2ca6ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(18, 20);
  ctx.lineTo(0, 12);
  ctx.lineTo(-18, 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ff9652";
  ctx.fillRect(-4, 18, 8, 16);
  ctx.shadowBlur = 0;
  if (player.focus) {
    ctx.strokeStyle = "rgba(255, 87, 217, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = "#ff4ddb";
  ctx.beginPath();
  ctx.arc(0, 0, player.r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawPlayerBullets() {
  ctx.save();
  ctx.shadowColor = "#5ff2ff";
  ctx.shadowBlur = 14;
  for (const b of playerBullets) {
    ctx.fillStyle = "#bdfcff";
    ctx.fillRect(b.x - 2, b.y - 14, 4, 22);
    ctx.fillStyle = "#3aa5ff";
    ctx.fillRect(b.x - 1, b.y - 20, 2, 12);
  }
  ctx.restore();

  ctx.save();
  for (const m of missiles) {
    const a = Math.atan2(m.vy, m.vx) + Math.PI / 2;
    ctx.translate(m.x, m.y);
    ctx.rotate(a);
    ctx.shadowColor = "#ffad45";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#f7fbff";
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff7b2e";
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.lineTo(6, 18);
    ctx.lineTo(0, 14);
    ctx.lineTo(-6, 18);
    ctx.closePath();
    ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  ctx.restore();
}

function drawBeams() {
  ctx.save();
  for (const b of beams) {
    ctx.globalAlpha = b.life / 0.08;
    const g = ctx.createLinearGradient(b.x, 0, b.x, b.y);
    g.addColorStop(0, "rgba(111, 240, 255, 0)");
    g.addColorStop(1, "rgba(111, 240, 255, 0.85)");
    ctx.strokeStyle = g;
    ctx.lineWidth = b.w;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + Math.sin(time * 30) * 6, 0);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawEnemyBullets() {
  ctx.save();
  for (const b of enemyBullets) {
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = b.color;
    if (spriteSheet.complete && spriteSheet.naturalWidth) {
      const s = b.color === "#62eaff" || b.color === "#8ff6ff" ? sprites.bulletCyan : sprites.bulletPink;
      const a = Math.atan2(b.vy, b.vx) + Math.PI / 2;
      drawSprite(s, b.x, b.y, b.r * 4.7, b.r * 8.2, a, true);
      continue;
    }
    if (b.kind === "needle") {
      const a = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, 0, b.r * 2.6, b.r, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#fff3b6";
      ctx.globalAlpha = 0.55;
      ctx.fillRect(-b.r * 1.2, -1, b.r * 1.9, 2);
      ctx.restore();
      ctx.globalAlpha = 1;
    } else if (b.kind === "petal") {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.age * 4);
      ctx.beginPath();
      ctx.ellipse(0, 0, b.r * 1.1, b.r * 2.1, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.36, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

function drawPickups() {
  for (const p of pickups) {
    if (spriteSheet.complete && spriteSheet.naturalWidth) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(time * 2.5);
      ctx.shadowColor = p.type === "bomb" ? "#ff5bd8" : "#69f6ff";
      ctx.shadowBlur = 18;
      drawSprite(sprites.power, 0, 0, 44, 46, 0, true);
      ctx.restore();
      continue;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(time * 4);
    ctx.shadowColor = p.type === "bomb" ? "#ff5bd8" : "#69f6ff";
    ctx.shadowBlur = 18;
    ctx.fillStyle = p.type === "bomb" ? "#ff5bd8" : "#69f6ff";
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(13, 0);
    ctx.lineTo(0, 13);
    ctx.lineTo(-13, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }
}

function drawEffects() {
  for (const s of hitSparks) {
    const k = 1 - s.life / s.max;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.globalAlpha = 1 - k;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 3 * s.scale;
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 + k * 2.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 5 * s.scale, Math.sin(a) * 5 * s.scale);
      ctx.lineTo(Math.cos(a) * (22 + k * 22) * s.scale, Math.sin(a) * (22 + k * 22) * s.scale);
      ctx.stroke();
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, (8 + k * 10) * s.scale, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life * 2, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    p.x += p.vx / 60;
    p.y += p.vy / 60;
  }
  ctx.globalAlpha = 1;
  for (const e of explosions) {
    const k = 1 - e.life / e.max;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.globalAlpha = 1 - k;
    if (spriteSheet.complete && spriteSheet.naturalWidth) {
      ctx.rotate(k * 0.4);
      drawSprite(sprites.explosion, 0, 0, 150 * e.scale * (0.55 + k), 120 * e.scale * (0.55 + k), 0, true);
      ctx.restore();
      continue;
    }
    ctx.shadowColor = "#ff9a42";
    ctx.shadowBlur = 28;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 86 * e.scale * (0.3 + k));
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.22, "#ffe06f");
    g.addColorStop(0.56, "#ff6537");
    g.addColorStop(1, "rgba(255, 55, 80, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 86 * e.scale * (0.3 + k), 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function drawHud() {
  ctx.save();
  ctx.font = "900 21px Segoe UI, sans-serif";
  ctx.fillStyle = "#d9fbff";
  ctx.shadowColor = "#77eaff";
  ctx.shadowBlur = 8;
  ctx.fillText(`SCORE: ${formatScore(player.score)}`, 12, 30);
  ctx.fillText(`LIVES: ${player.lives} (${heartText(player.lives)})`, 12, 58);
  ctx.fillText(`POWER: [${">".repeat(player.power).padEnd(8, "|")}]`, 12, H - 46);
  ctx.fillText(`BOMB: ${player.bombs}`, 12, H - 17);
  ctx.textAlign = "center";
  ctx.fillText(phase === "boss" ? "GIGAS CORE" : `STAGE ${stageNo}`, W / 2, 26);
  if (phase === "boss") {
    drawBar(W / 2 - 150, 36, 300, 18, boss.hp / boss.maxHp, "#f04b4d", "#79eaff");
  } else if (phase === "stage") {
    drawBar(W / 2 - 150, 36, 300, 18, phaseTimer / STAGE_DURATION, "#53dfff", "#79eaff");
  }
  ctx.textAlign = "right";
  ctx.fillText(phase === "boss" ? "BOSS" : "PHASE", W - 14, 28);
  if (phase === "boss") drawBar(W - 214, 38, 200, 16, boss.hp / boss.maxHp, "#ff842f", "#77eaff");
  ctx.fillText(phase === "stage" ? "STAGE PHASE" : phase === "boss" ? "BOSS PHASE" : "STAGE CLEAR", W - 14, 82);
  ctx.fillText(`CHAIN: ${player.chain}`, W - 20, H - 18);
  ctx.restore();
}

function drawPhaseText() {
  if (phaseBanner <= 0) return;
  const alpha = clamp(phaseBanner / 1.2, 0, 1);
  let title = "";
  let sub = "";
  if (phase === "stage") {
    title = `STAGE ${stageNo}`;
    sub = "FIRST ALARM";
  } else if (phase === "boss") {
    title = "WARNING";
    sub = "BULLET GATE OPEN";
  } else if (phase === "clear") {
    title = "STAGE CLEAR";
    sub = "PROCEEDING TO NEXT STAGE";
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.shadowColor = phase === "boss" ? "#ff4bc1" : "#72f2ff";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#ecfeff";
  ctx.font = "900 56px Segoe UI, sans-serif";
  ctx.fillText(title, W / 2, H * 0.45);
  ctx.fillStyle = phase === "boss" ? "#ff8fda" : "#9df6ff";
  ctx.font = "900 22px Segoe UI, sans-serif";
  ctx.fillText(sub, W / 2, H * 0.45 + 42);
  ctx.restore();
}

function drawBar(x, y, w, h, pct, fill, edge) {
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2;
  ctx.fillStyle = "rgba(7, 15, 31, 0.86)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 4, y + 4, Math.max(0, (w - 8) * pct), h - 8);
  ctx.restore();
}

function drawPause() {
  ctx.save();
  ctx.fillStyle = "rgba(2, 8, 18, 0.55)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#e8feff";
  ctx.font = "900 52px Segoe UI, sans-serif";
  ctx.fillText("PAUSED", W / 2, H / 2);
  ctx.restore();
}

function formatScore(score) {
  return Math.floor(score).toLocaleString("en-US").padStart(9, "0");
}

function drawSprite(s, x, y, w, h, rotation = 0, centered = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  const dx = centered ? -w / 2 : 0;
  const dy = centered ? -h / 2 : 0;
  ctx.drawImage(spriteSheet, s.sx, s.sy, s.sw, s.sh, dx, dy, w, h);
  ctx.restore();
}

function heartText(lives) {
  return "♥".repeat(Math.max(0, lives)).padEnd(3, "♡");
}

initStars();
render();

if (new URLSearchParams(location.search).has("demo")) {
  const params = new URLSearchParams(location.search);
  resetGame();
  running = true;
  player.invuln = 999;
  stopBgm();
  overlay.style.display = "none";
  if (params.get("demo") === "boss") beginBossPhase();
  if (params.get("demo") === "clear") {
    beginBossPhase();
    clearStage();
  }
  if (params.get("demo") === "mid") player.power = 8;
  const frames = params.get("demo") === "mid" ? 900 : params.get("demo") === "stage" || params.get("demo") === "1" ? 150 : 90;
  for (let i = 0; i < frames; i++) update(1 / 60);
  last = performance.now();
  requestAnimationFrame(loop);
}
