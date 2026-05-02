const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const startButton = document.getElementById("startButton");

const W = canvas.width;
const H = canvas.height;
const TAU = Math.PI * 2;
const PLAYER_START_LIVES = 6;
const IS_MOBILE_BROWSER = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const BGM_VOLUME = IS_MOBILE_BROWSER ? 0.68 : 0.58;
const SE_VOLUME_SCALE = IS_MOBILE_BROWSER ? 0.48 : 1;
const WEAPON_SE_VOLUME_SCALE = IS_MOBILE_BROWSER ? 0.55 : 1;
const MAX_ENEMY_BULLETS = IS_MOBILE_BROWSER ? 240 : 360;
const MAX_PARTICLES = IS_MOBILE_BROWSER ? 110 : 340;
const MAX_HIT_SPARKS = IS_MOBILE_BROWSER ? 12 : 52;
const MAX_EXPLOSIONS = IS_MOBILE_BROWSER ? 8 : 34;
const EXTRA_LIFE_INTERVAL = 100000000;
const HYPER_GAUGE_MAX = 1000;
const HYPER_STOCK_MAX = 5;
const HYPER_ITEM_DROP_Y = 130;
const HYPER_DURATION = 12;
const COMBO_HOLD_SECONDS = 3;
const PLAYER_HITBOX_OFFSET_X = 5;
const PLAYER_HITBOX_OFFSET_Y = -6;
const BOSS_HP_MULTIPLIER = 2;
const MIDBOSS_HP_MULTIPLIER = 3;
const BOSS_BULLET_SPEED_MULTIPLIER = 1.14;
const BOSS_SHIFT_HP_RATIO = 0.66;
const BOSS_SHIFT_INTERVAL_MULTIPLIER = 0.9;
const BOSS_SHIFT_BULLET_SPEED_MULTIPLIER = 1.08;
const BOSS_ENRAGE_HP_RATIO = 0.33;
const BOSS_ENRAGE_INTERVAL_MULTIPLIER = 0.62;
const BOSS_ENRAGE_BULLET_SPEED_MULTIPLIER = 1.24;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const pointSegmentDistance = (p, a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
  const x = a.x + dx * t;
  const y = a.y + dy * t;
  return Math.hypot(p.x - x, p.y - y);
};
const rand = (min, max) => min + Math.random() * (max - min);
const dist2 = (a, b) => {
  if (!a || !b || a.x === undefined || b.x === undefined) return Infinity;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};
const playerHitbox = () => ({
  x: player.x + PLAYER_HITBOX_OFFSET_X,
  y: player.y + PLAYER_HITBOX_OFFSET_Y,
  r: player.r,
});

let running = false;
let paused = false;
let last = performance.now();
let time = 0;
let shake = 0;
let flash = 0;
let pointerActive = false;
let pointerLastX = 0;
let pointerLastY = 0;
let pointerDeltaX = 0;
let pointerDeltaY = 0;
let pointerSwipeTimer = 0;
let bossPhaseClock = 0;
let bulletClock = 0;
let enemyClock = 0;
let pickupClock = 0;
let phase = "stage";
let phaseTimer = 0;
let phaseBanner = 0;
let stageNo = 1;
let stageWaveIndex = 0;
let stageCombatWaveStep = 0;
let stageScroll = 0;
let lifePickupsThisStage = 0;
let bossDeathClock = 0;
let gameOverClock = 0;
let creditScroll = 0;
let bgmFade = null;
let stageFade = 0;
let nextStageNo = 1;
let perfMode = IS_MOBILE_BROWSER ? 1 : 0;
let perfLowTimer = 0;
let perfGoodTimer = 0;
let lastHitSparkAt = 0;
let lastExplosionAt = 0;
let bossDeathBoomStep = 0;

const STAGE_DURATION = 62;
const STAGE_WAVES = [
  { t: 0.8, type: "sweep", side: -1 },
  { t: 3.8, type: "sweep", side: 1 },
  { t: 5.7, type: "cross" },
  { t: 6.4, type: "exoticA" },
  { t: 7.2, type: "v" },
  { t: 9.6, type: "rain" },
  { t: 11.5, type: "ambush" },
  { t: 13.4, type: "medium" },
  { t: 15.5, type: "sweep", side: -1 },
  { t: 17.1, type: "pincer" },
  { t: 19.0, type: "v" },
  { t: 20.8, type: "exoticB" },
  { t: 22.0, type: "item", drop: "power" },
  { t: 23.0, type: "ambush" },
  { t: 25.0, type: "medium" },
  { t: 27.0, type: "sweep", side: 1 },
  { t: 28.2, type: "exoticMix" },
  { t: 29.2, type: "cross" },
  { t: 31.0, type: "v" },
  { t: 33.0, type: "rain" },
  { t: 34.5, type: "item", drop: "bomb" },
  { t: 38.0, type: "midboss" },
  { t: 43.5, type: "midboss2" },
  { t: 45.0, type: "exoticMix" },
  { t: 46.2, type: "pincer" },
  { t: 48.0, type: "item", drop: "life" },
  { t: 50.0, type: "ambush" },
  { t: 52.0, type: "cross" },
  { t: 53.0, type: "exoticMix" },
  { t: 54.0, type: "item", drop: "score" },
  { t: 55.1, type: "rain" },
  { t: 56.5, type: "final" },
];
const STAGE_5_WAVES = [
  { t: 0.8, type: "sweep", side: -1 },
  { t: 3.8, type: "sweep", side: 1 },
  { t: 5.8, type: "cross" },
  { t: 6.3, type: "exoticA" },
  { t: 7.0, type: "v" },
  { t: 9.0, type: "rain" },
  { t: 10.8, type: "ambush" },
  { t: 13.2, type: "medium" },
  { t: 15.4, type: "pincer" },
  { t: 17.2, type: "sweep", side: -1 },
  { t: 20.6, type: "v" },
  { t: 21.6, type: "exoticB" },
  { t: 22.4, type: "cross" },
  { t: 24.0, type: "item", drop: "power" },
  { t: 26.5, type: "ambush" },
  { t: 28.0, type: "rain" },
  { t: 30.0, type: "medium" },
  { t: 34.5, type: "midboss" },
  { t: 38.8, type: "pincer" },
  { t: 40.2, type: "exoticMix" },
  { t: 42.0, type: "sweep", side: 1 },
  { t: 44.0, type: "cross" },
  { t: 47.0, type: "item", drop: "hyperCharge" },
  { t: 50.5, type: "v" },
  { t: 52.5, type: "rain" },
  { t: 55.5, type: "midboss2" },
  { t: 58.4, type: "exoticMix" },
  { t: 59.8, type: "pincer" },
  { t: 64.0, type: "ambush" },
  { t: 67.2, type: "cross" },
  { t: 68.8, type: "exoticA" },
  { t: 70.0, type: "medium" },
  { t: 73.0, type: "rain" },
  { t: 76.0, type: "item", drop: "bomb" },
  { t: 79.0, type: "pincer" },
  { t: 80.2, type: "exoticB" },
  { t: 82.0, type: "final" },
  { t: 88.0, type: "item", drop: "score" },
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
const bossParts = [];
const bossPartBeams = [];
const shockwaves = [];
const particles = [];
const damageTexts = [];

const spriteSheet = new Image();
spriteSheet.src = "assets/sprite-sheet.png";
spriteSheet.onload = () => render();

const colonySheet = new Image();
colonySheet.src = "assets/colony-props.png";
colonySheet.onload = () => render();

const stageSpriteSheet = new Image();
stageSpriteSheet.src = "assets/stage-sprites.png";
stageSpriteSheet.onload = () => render();

const stageBackgroundSheet = new Image();
stageBackgroundSheet.src = "assets/stage-backgrounds.png";
stageBackgroundSheet.onload = () => render();

const stage5AssetSheet = new Image();
stage5AssetSheet.src = "assets/stage5-assets.png";
stage5AssetSheet.onload = () => render();

const midbossItemSheet = new Image();
midbossItemSheet.src = "assets/midboss-item-sprites.png";
midbossItemSheet.onload = () => render();

const itemSheet = new Image();
itemSheet.src = "assets/item-sprites.png";
itemSheet.onload = () => render();

const hyperChargeImage = new Image();
hyperChargeImage.src = "assets/hyper-charge.png";
hyperChargeImage.onload = () => render();

const hyperStockImage = new Image();
hyperStockImage.src = "assets/hyper-stock.png";
hyperStockImage.onload = () => render();

const bossExplosionSheet = new Image();
bossExplosionSheet.src = "assets/boss-death-explosion-sheet.png";
bossExplosionSheet.onload = () => render();

const bossPartSheet = new Image();
bossPartSheet.src = "assets/boss-parts.png";
bossPartSheet.onload = () => render();

const stageExtraEnemySheet = new Image();
stageExtraEnemySheet.src = "assets/stage-extra-enemies.png";
stageExtraEnemySheet.onload = () => render();

const bgm = {
  stage1: new Audio("BGM/BGM_Stage1_最初の警報.mp3"),
  boss1: new Audio("BGM/BGM_Stage1BOSS_弾幕の門.mp3"),
  stage2: new Audio("BGM/BGM_Stage2_雷光の回廊.mp3"),
  boss2: new Audio("BGM/BGM_Stage2BOSS_終幕の砲火.mp3"),
  stage3: new Audio("BGM/BGM_Stage3_弾幕の回廊.mp3"),
  boss3: new Audio("BGM/BGM_Stage3BOSS_鋼の中枢.mp3"),
  stage4: new Audio("BGM/BGM_Stage4_雷鳴の第四幕.mp3"),
  boss4: new Audio("BGM/BGM_Stage4BOSS_鋼牙の咆哮.mp3"),
  stage5: new Audio("BGM/BGM_Stage5_最終砲台.mp3"),
  boss5: new Audio("BGM/BGM_Stage5BOSS_黒鋼の終幕.mp3"),
  allclear: new Audio("BGM/BGM_ALLCLEAR_残響のクリア.mp3"),
};
const hyperSe = {
  start: new Audio("SE/hyper発動時のSE.m4a"),
  loop: new Audio("SE/hyper発動中.m4a"),
};
const weaponSe = {
  normalVulcan: new Audio("SE/通常バルカン.m4a"),
  normalBeam: new Audio("SE/通常ビーム中.m4a"),
  hyperVulcan: new Audio("SE/hyperバルカン音.m4a"),
  hyperBeam: hyperSe.loop,
};
const gameSe = {
  explodeSmall: createAudioPool("SE/小爆発.m4a", 5, 0.18),
  explodeMedium: createAudioPool("SE/中爆発.m4a", 4, 0.34),
  explodeLarge: createAudioPool("SE/大爆発.m4a", 3, 0.86),
  enemyHit: createAudioPool("SE/敵に弾が当たった時のSE.mp3", 8, 0.62),
  bombStart: createAudioPool("SE/ボム発動音.mp3", 3, 0.82),
  playerHit: createAudioPool("SE/自機被弾.mp3", 3, 0.86),
};
const seMix = {
  explosionTimes: [],
  impactTimes: [],
};
let currentBgm = null;
let currentWeaponSe = null;
let audioContext = null;
let bgmUnlocked = false;
let bgmPlaySerial = 0;
let pendingBgmName = null;
const touchBombButton = { x: W - 176, y: H - 126, w: 154, h: 72 };
for (const track of Object.values(bgm)) {
  track.loop = true;
  track.volume = BGM_VOLUME;
  track.preload = "auto";
}
hyperSe.start.volume = 0.88 * SE_VOLUME_SCALE;
hyperSe.start.preload = "auto";
for (const track of Object.values(weaponSe)) {
  track.loop = true;
  track.preload = "auto";
}
weaponSe.normalVulcan.volume = 0.1 * WEAPON_SE_VOLUME_SCALE;
weaponSe.normalBeam.volume = 0.2 * WEAPON_SE_VOLUME_SCALE;
weaponSe.hyperVulcan.volume = 0.18 * WEAPON_SE_VOLUME_SCALE;
weaponSe.hyperBeam.volume = 0.62 * WEAPON_SE_VOLUME_SCALE;

function createAudioPool(src, size = 4, baseVolume = 1) {
  return {
    index: 0,
    baseVolume,
    tracks: Array.from({ length: size }, () => {
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.volume = baseVolume;
      return audio;
    }),
  };
}

function ensureAudio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();
  unlockBgm();
}

function unlockBgm() {
  if (bgmUnlocked) return;
  bgmUnlocked = true;
  for (const track of Object.values(bgm)) track.load();
  for (const track of Object.values(hyperSe)) track.load();
  for (const track of Object.values(weaponSe)) track.load();
  for (const pool of Object.values(gameSe)) {
    for (const track of pool.tracks) track.load();
  }
}

function requestMediaLoad(track) {
  if (!track || track.loadRequested) return;
  track.loadRequested = true;
  track.load();
}

function makeNoiseSource(duration) {
  const sampleRate = audioContext.sampleRate;
  const buffer = audioContext.createBuffer(1, Math.max(1, Math.floor(sampleRate * duration)), sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  return source;
}

function addOscLayer(now, {
  type = "sine",
  from = 440,
  to = 220,
  duration = 0.12,
  volume = 0.2,
  attack = 0.004,
  filterType = "lowpass",
  filterFrom = 2200,
  filterTo = 900,
}) {
  const osc = audioContext.createOscillator();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  osc.type = type;
  filter.type = filterType;
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
  filter.frequency.setValueAtTime(filterFrom, now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(1, filterTo), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function addNoiseLayer(now, {
  duration = 0.12,
  volume = 0.2,
  attack = 0.003,
  filterType = "bandpass",
  filterFrequency = 1600,
  filterQ = 0.9,
}) {
  const noise = makeNoiseSource(duration);
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFrequency, now);
  filter.Q.setValueAtTime(filterQ, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);
  noise.start(now);
  noise.stop(now + duration + 0.02);
}

function playAudioPool(pool, volume = 1) {
  if (!pool || !pool.tracks.length) return;
  const track = pool.tracks[pool.index];
  if (IS_MOBILE_BROWSER && !mediaReady(track)) {
    requestMediaLoad(track);
    return;
  }
  pool.index = (pool.index + 1) % pool.tracks.length;
  track.pause();
  track.currentTime = 0;
  track.volume = clamp(pool.baseVolume * volume * SE_VOLUME_SCALE, 0, 1);
  track.play().catch(() => {});
}

function perfScale() {
  return perfMode >= 2 ? 0.46 : perfMode >= 1 ? 0.68 : 1;
}

function isLiteRender() {
  return perfMode >= 1;
}

function isVeryLiteRender() {
  return perfMode >= 2;
}

function particleLimit() {
  return Math.max(IS_MOBILE_BROWSER ? 38 : 70, Math.floor(MAX_PARTICLES * perfScale()));
}

function canAddParticle(extra = 1) {
  return particles.length + extra <= particleLimit();
}

function mediaReady(track) {
  return track && track.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
}

function enemyBulletLimit() {
  const phaseScale = phase === "boss" ? (boss.enraged ? 0.78 : boss.shifted ? 0.68 : 0.62) : phase === "bossDeath" ? 0.35 : 1;
  return Math.max(IS_MOBILE_BROWSER ? 120 : 180, Math.floor(MAX_ENEMY_BULLETS * phaseScale * perfScale()));
}

function explosionStackGain() {
  const now = performance.now() / 1000;
  const windowSeconds = IS_MOBILE_BROWSER || perfMode > 0 ? 0.34 : 0.18;
  seMix.explosionTimes = seMix.explosionTimes.filter((t) => now - t < windowSeconds);
  const stack = seMix.explosionTimes.length;
  if ((IS_MOBILE_BROWSER || perfMode > 0) && stack >= (perfMode >= 2 ? 1 : 2)) return 0;
  seMix.explosionTimes.push(now);
  if (stack === 0) return 1;
  if (stack === 1) return IS_MOBILE_BROWSER || perfMode > 0 ? 0.32 : 0.72;
  if (stack === 2) return IS_MOBILE_BROWSER || perfMode > 0 ? 0.18 : 0.52;
  return IS_MOBILE_BROWSER || perfMode > 0 ? 0.1 : 0.36;
}

function playExplosionPool(pool, volume = 1) {
  const gain = explosionStackGain();
  if (gain <= 0) return;
  playAudioPool(pool, volume * gain);
}

function impactStackGain() {
  const now = performance.now() / 1000;
  const windowSeconds = IS_MOBILE_BROWSER || perfMode > 0 ? 0.18 : 0.08;
  seMix.impactTimes = seMix.impactTimes.filter((t) => now - t < windowSeconds);
  const stack = seMix.impactTimes.length;
  if ((IS_MOBILE_BROWSER || perfMode > 0) && stack >= (perfMode >= 2 ? 2 : 3)) return 0;
  seMix.impactTimes.push(now);
  if (stack === 0) return 1;
  if (stack === 1) return IS_MOBILE_BROWSER || perfMode > 0 ? 0.32 : 0.62;
  if (stack === 2) return IS_MOBILE_BROWSER || perfMode > 0 ? 0.18 : 0.42;
  return IS_MOBILE_BROWSER || perfMode > 0 ? 0.1 : 0.26;
}

function playEnemyHitSe(volume = 0.16) {
  const gain = impactStackGain();
  if (gain <= 0) return;
  playAudioPool(gameSe.enemyHit, volume * gain);
}

function playExplosionSe(volume = 0.3) {
  if (volume >= 0.42) {
    playExplosionPool(gameSe.explodeLarge, volume / 0.5);
  } else if (volume >= 0.28) {
    playExplosionPool(gameSe.explodeMedium, volume / 0.34);
  } else {
    playExplosionPool(gameSe.explodeSmall, volume / 0.24);
  }
}

function playSfx(type, volume = 0.35) {
  if (type === "hit") {
    playEnemyHitSe(volume / 0.16);
    return;
  }
  if (type === "explode") {
    playExplosionSe(volume);
    return;
  }
  if (type === "missilehit") {
    playEnemyHitSe(volume / 0.24);
    return;
  }
  if (type === "mega") {
    playExplosionPool(gameSe.explodeLarge, volume / 0.46);
  }
  if (type === "bomb") {
    playAudioPool(gameSe.bombStart, volume / 0.5);
  }
  if (type === "playerhit") {
    playAudioPool(gameSe.playerHit, volume / 0.42);
    return;
  }
  if (!audioContext) return;
  try {
    const now = audioContext.currentTime;
    if (type === "hit") {
      addNoiseLayer(now, { duration: 0.09, volume: volume * 1.15, filterType: "bandpass", filterFrequency: 2300, filterQ: 1.7 });
      addNoiseLayer(now, { duration: 0.045, volume: volume * 0.8, filterType: "highpass", filterFrequency: 4200, filterQ: 0.7 });
      addOscLayer(now, { type: "square", from: 980, to: 150, duration: 0.075, volume: volume * 0.95, filterFrom: 3400, filterTo: 900 });
      addOscLayer(now + 0.012, { type: "sawtooth", from: 170, to: 80, duration: 0.11, volume: volume * 0.45, filterFrom: 850, filterTo: 320 });
      return;
    }
    if (type === "explode") {
      addNoiseLayer(now, { duration: 0.42, volume: volume * 1.9, filterType: "lowpass", filterFrequency: 1400, filterQ: 0.6 });
      addNoiseLayer(now + 0.018, { duration: 0.18, volume: volume * 1.2, filterType: "bandpass", filterFrequency: 2600, filterQ: 0.9 });
      addOscLayer(now, { type: "sawtooth", from: 150, to: 38, duration: 0.4, volume: volume * 1.65, filterFrom: 1000, filterTo: 180 });
      addOscLayer(now + 0.025, { type: "triangle", from: 72, to: 32, duration: 0.5, volume: volume * 0.9, filterFrom: 420, filterTo: 120 });
      return;
    }
    if (type === "missilehit") {
      addOscLayer(now, { type: "sawtooth", from: 210, to: 42, duration: 0.34, volume: volume * 1.8, filterFrom: 1200, filterTo: 190 });
      addNoiseLayer(now, { duration: 0.28, volume: volume * 1.55, filterType: "lowpass", filterFrequency: 1700, filterQ: 0.7 });
      addNoiseLayer(now + 0.008, { duration: 0.085, volume: volume * 1.15, filterType: "highpass", filterFrequency: 3600, filterQ: 0.8 });
      addOscLayer(now + 0.018, { type: "square", from: 520, to: 95, duration: 0.12, volume: volume * 0.7, filterFrom: 2200, filterTo: 650 });
      return;
    }
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    let stopAt = now + 0.09;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(type === "mega" || type === "bomb" ? 1400 : type === "explode" || type === "playerhit" ? 900 : type === "missile" ? 1600 : 2600, now);
    gain.gain.setValueAtTime(0.0001, now);

    if (type === "mega" || type === "bomb") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(type === "bomb" ? 130 : 90, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.62);
      filter.frequency.exponentialRampToValueAtTime(260, now + 0.5);
      gain.gain.exponentialRampToValueAtTime(volume * 1.8, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
      stopAt = now + 0.74;
    } else if (type === "explode" || type === "playerhit") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(type === "playerhit" ? 260 : 180, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.34);
      gain.gain.exponentialRampToValueAtTime(volume * 1.45, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      stopAt = now + 0.4;
    } else if (type === "missile") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(volume * 0.65, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
      stopAt = now + 0.14;
    } else if (type === "life") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(760, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(volume * 0.7, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      stopAt = now + 0.24;
    } else if (type === "pickup") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(980, now);
      osc.frequency.exponentialRampToValueAtTime(1680, now + 0.08);
      filter.frequency.exponentialRampToValueAtTime(3200, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(volume * 0.95, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      stopAt = now + 0.18;
    } else {
      osc.type = "square";
      osc.frequency.setValueAtTime(type === "hit" ? 1320 : 920, now);
      osc.frequency.exponentialRampToValueAtTime(type === "hit" ? 260 : 520, now + 0.075);
      filter.frequency.exponentialRampToValueAtTime(1200, now + 0.07);
      gain.gain.exponentialRampToValueAtTime(volume * (type === "hit" ? 1.45 : 1), now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
      stopAt = now + 0.12;
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

const colonySprites = {
  platformA: { sx: 20, sy: 84, sw: 565, sh: 390 },
  platformB: { sx: 612, sy: 86, sw: 600, sh: 390 },
  ring: { sx: 314, sy: 526, sw: 620, sh: 298 },
  turret: { sx: 34, sy: 744, sw: 330, sh: 438 },
  dock: { sx: 782, sy: 890, sw: 380, sh: 260 },
};

const stageAssetSprites = {
  s2Small: { sx: 45, sy: 160, sw: 175, sh: 188 },
  s2Medium: { sx: 332, sy: 86, sw: 287, sh: 322 },
  s2Boss: { sx: 698, sy: 17, sw: 526, sh: 405 },
  s3Small: { sx: 50, sy: 542, sw: 162, sh: 189 },
  s3Medium: { sx: 310, sy: 494, sw: 316, sh: 287 },
  s3Boss: { sx: 719, sy: 426, sw: 478, sh: 399 },
  s4Small: { sx: 48, sy: 931, sw: 164, sh: 181 },
  s4Medium: { sx: 307, sy: 879, sw: 324, sh: 265 },
  s4Boss: { sx: 653, sy: 813, sw: 594, sh: 421 },
};

const stage5AssetSprites = {
  s5Boss: { sx: 60, sy: 18, sw: 1134, sh: 640 },
  s5MidbossA: { sx: 88, sy: 548, sw: 468, sh: 354 },
  s5MidbossB: { sx: 720, sy: 532, sw: 436, sh: 378 },
  s5Small: { sx: 166, sy: 954, sw: 190, sh: 168 },
  s5Medium: { sx: 485, sy: 943, sw: 270, sh: 212 },
  s5Bg: { sx: 862, sy: 952, sw: 258, sh: 258 },
};

const midbossItemSprites = {
  mb1: { sx: 42, sy: 56, sw: 270, sh: 446 },
  mb2: { sx: 392, sy: 58, sw: 274, sh: 478 },
  mb3: { sx: 738, sy: 118, sw: 292, sh: 366 },
  mb4: { sx: 1110, sy: 92, sw: 296, sh: 404 },
  carrierPower: { sx: 90, sy: 676, sw: 164, sh: 188 },
  carrierBomb: { sx: 430, sy: 680, sw: 172, sh: 190 },
  carrierLife: { sx: 782, sy: 672, sw: 176, sh: 194 },
  carrierScore: { sx: 1126, sy: 672, sw: 184, sh: 194 },
};

const itemSprites = {
  power: { sx: 61, sy: 159, sw: 443, sh: 449 },
  bomb: { sx: 534, sy: 159, sw: 416, sh: 453 },
  life: { sx: 1030, sy: 159, sw: 365, sh: 447 },
  score: { sx: 1464, sy: 177, sw: 409, sh: 417 },
};

const EXTRA_ENEMY_SPRITES = {
  s1Jelly: { col: 0, row: 0 },
  s1Shell: { col: 1, row: 0 },
  s2Manta: { col: 2, row: 0 },
  s2Orb: { col: 3, row: 0 },
  s3Mask: { col: 4, row: 0 },
  s3Moth: { col: 0, row: 1 },
  s4Spider: { col: 1, row: 1 },
  s4Saw: { col: 2, row: 1 },
  s5Angel: { col: 3, row: 1 },
  s5Hive: { col: 4, row: 1 },
};

const EXTRA_ENEMY_DEFS = {
  s1Jelly: { stage: 1, hp: 110, r: 30, w: 92, h: 92, move: "float", attack: "droplet" },
  s1Shell: { stage: 1, hp: 145, r: 30, w: 88, h: 88, move: "coil", attack: "spiral" },
  s2Manta: { stage: 2, hp: 135, r: 32, w: 108, h: 82, move: "swoop", attack: "fork" },
  s2Orb: { stage: 2, hp: 165, r: 30, w: 90, h: 90, move: "node", attack: "magnet" },
  s3Mask: { stage: 3, hp: 155, r: 32, w: 86, h: 108, move: "wraith", attack: "curse" },
  s3Moth: { stage: 3, hp: 175, r: 34, w: 112, h: 94, move: "flutter", attack: "crystal" },
  s4Spider: { stage: 4, hp: 210, r: 34, w: 106, h: 90, move: "walker", attack: "web" },
  s4Saw: { stage: 4, hp: 230, r: 36, w: 98, h: 98, move: "saw", attack: "sawring" },
  s5Angel: { stage: 5, hp: 235, r: 34, w: 104, h: 100, move: "halo", attack: "halo" },
  s5Hive: { stage: 5, hp: 275, r: 42, w: 116, h: 104, move: "hive", attack: "swarm" },
};

const EXTRA_ENEMY_KEYS = {
  1: ["s1Jelly", "s1Shell"],
  2: ["s2Manta", "s2Orb"],
  3: ["s3Mask", "s3Moth"],
  4: ["s4Spider", "s4Saw"],
  5: ["s5Angel", "s5Hive"],
};

const BOSS_PART_LOADOUTS = {
  1: [
    { relX: -86, relY: 22, sprite: 4, hp: 1450, r: 34, w: 76, h: 76, attack: "turret", interval: 1.12, side: -1 },
    { relX: 86, relY: 22, sprite: 4, hp: 1450, r: 34, w: 76, h: 76, attack: "turret", interval: 1.12, side: 1 },
  ],
  2: [
    { relX: -92, relY: 18, sprite: 1, hp: 1650, r: 36, w: 82, h: 78, attack: "missile", interval: 1.35, side: -1 },
    { relX: 92, relY: 18, sprite: 1, hp: 1650, r: 36, w: 82, h: 78, attack: "missile", interval: 1.35, side: 1 },
    { relX: 0, relY: -46, sprite: 8, hp: 1850, r: 38, w: 82, h: 82, attack: "missile", interval: 1.65, side: 0 },
  ],
  3: [
    { relX: -108, relY: 4, sprite: 2, hp: 1750, r: 36, w: 82, h: 90, attack: "ram", interval: 2.2, side: -1 },
    { relX: 108, relY: 4, sprite: 2, hp: 1750, r: 36, w: 82, h: 90, attack: "ram", interval: 2.45, side: 1 },
    { relX: 0, relY: -54, sprite: 5, hp: 1600, r: 34, w: 80, h: 86, attack: "ram", interval: 2.7, side: 0 },
  ],
  4: [
    { relX: -132, relY: 0, sprite: 6, hp: 2150, r: 38, w: 96, h: 70, attack: "beam", interval: 2.35, side: -1 },
    { relX: 132, relY: 0, sprite: 6, hp: 2150, r: 38, w: 96, h: 70, attack: "beam", interval: 2.35, side: 1 },
    { relX: 0, relY: -58, sprite: 11, hp: 2350, r: 42, w: 92, h: 92, attack: "beam", interval: 2.75, side: 0 },
  ],
  5: [
    { relX: -170, relY: -18, sprite: 4, hp: 2350, r: 34, w: 78, h: 78, attack: "turret", interval: 0.95, side: -1 },
    { relX: 170, relY: -18, sprite: 1, hp: 2450, r: 36, w: 84, h: 78, attack: "missile", interval: 1.12, side: 1 },
    { relX: -96, relY: 54, sprite: 2, hp: 2350, r: 36, w: 80, h: 88, attack: "ram", interval: 2.0, side: -1 },
    { relX: 96, relY: 54, sprite: 6, hp: 2500, r: 38, w: 96, h: 70, attack: "beam", interval: 2.0, side: 1 },
    { relX: 0, relY: -68, sprite: 8, hp: 2600, r: 42, w: 90, h: 90, attack: "mine", interval: 1.7, side: 0 },
    { relX: 0, relY: 46, sprite: 11, hp: 2850, r: 44, w: 94, h: 94, attack: "beam", interval: 2.55, side: 0 },
  ],
};

const STAGES = [
  {
    no: 1,
    title: "ABYSSAL DEEP",
    stageBgm: "stage1",
    bossBgm: "boss1",
    bg: { sx: 0, sy: 0 },
    smallSprite: "enemyA",
    mediumSprite: "enemyC",
    bossSprite: "boss",
    midbossSprite: "mb1",
    midbossAltSprite: "s5MidbossA",
    bossW: 380,
    bossH: 346,
    bossR: 68,
    bossHp: 13500 * BOSS_HP_MULTIPLIER,
    enemyHp: 1,
    enemySpeed: 1,
    fireRate: 1.18,
    bossInterval: 0.24,
    bulletSpeed: 1.26,
  },
  {
    no: 2,
    title: "LIGHTNING CORRIDOR",
    stageBgm: "stage2",
    bossBgm: "boss2",
    bg: { sx: 627, sy: 0 },
    smallSprite: "s2Small",
    mediumSprite: "s2Medium",
    bossSprite: "s2Boss",
    midbossSprite: "mb2",
    midbossAltSprite: "s5MidbossB",
    bossW: 420,
    bossH: 324,
    bossR: 76,
    bossHp: 17700 * BOSS_HP_MULTIPLIER,
    enemyHp: 1.18,
    enemySpeed: 1.08,
    fireRate: 1.16,
    bossInterval: 0.245,
    bulletSpeed: 1.39,
  },
  {
    no: 3,
    title: "CRIMSON CORRIDOR",
    stageBgm: "stage3",
    bossBgm: "boss3",
    bg: { sx: 0, sy: 627 },
    smallSprite: "s3Small",
    mediumSprite: "s3Medium",
    bossSprite: "s3Boss",
    midbossSprite: "mb3",
    midbossAltSprite: "s5MidbossA",
    bossW: 430,
    bossH: 360,
    bossR: 84,
    bossHp: 22200 * BOSS_HP_MULTIPLIER,
    enemyHp: 1.36,
    enemySpeed: 1.15,
    fireRate: 1.14,
    bossInterval: 0.255,
    bulletSpeed: 1.52,
  },
  {
    no: 4,
    title: "STEEL FANG FORTRESS",
    stageBgm: "stage4",
    bossBgm: "boss4",
    bg: { sx: 627, sy: 627 },
    smallSprite: "s4Small",
    mediumSprite: "s4Medium",
    bossSprite: "s4Boss",
    midbossSprite: "mb4",
    midbossAltSprite: "s5MidbossB",
    bossW: 520,
    bossH: 368,
    bossR: 104,
    bossHp: 28500 * BOSS_HP_MULTIPLIER,
    enemyHp: 1.62,
    enemySpeed: 1.24,
    fireRate: 1.12,
    bossInterval: 0.265,
    bulletSpeed: 1.66,
  },
  {
    no: 5,
    title: "FINAL GUN PLATFORM",
    stageBgm: "stage5",
    bossBgm: "boss5",
    bg: { sx: 862, sy: 952, sw: 258, sh: 258, sheet: "stage5" },
    smallSprite: "s5Small",
    mediumSprite: "s5Medium",
    bossSprite: "s5Boss",
    midbossSprite: "s5MidbossA",
    midbossAltSprite: "s5MidbossB",
    bossW: 620,
    bossH: 320,
    bossR: 118,
    bossHp: 42750 * BOSS_HP_MULTIPLIER,
    enemyHp: 1.95,
    enemySpeed: 1.38,
    fireRate: 1.08,
    bossInterval: 0.28,
    bulletSpeed: 1.86,
    duration: 93,
    waves: STAGE_5_WAVES,
  },
];

const player = {
  x: W / 2,
  y: H - 120,
  r: 6,
  lives: PLAYER_START_LIVES,
  bombs: 2,
  power: 5,
  invuln: 1.6,
  fireCooldown: 0,
  missileCooldown: 0,
  focus: false,
  laserActive: false,
  score: 0,
  nextLifeScore: EXTRA_LIFE_INTERVAL,
  chain: 0,
  comboTimer: 0,
  hyperGauge: 0,
  hyperStock: 0,
  hyperTime: 0,
  hyperLevel: 0,
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
  visible: false,
  shifted: false,
  enraged: false,
};

function currentStage() {
  return STAGES[Math.min(stageNo, STAGES.length) - 1];
}

function stageDuration() {
  return currentStage().duration || STAGE_DURATION;
}

function stageWaves() {
  return currentStage().waves || STAGE_WAVES;
}

function hyperAttackMultiplier() {
  return player.hyperTime > 0 ? 1 + player.hyperLevel * 0.35 : 1;
}

function hyperRankMultiplier() {
  return player.hyperTime > 0 ? 1 + player.hyperLevel * 0.04 : 1;
}

function normalizeHyperRankedBullets() {
  for (const b of enemyBullets) {
    if (!b.rank || b.rank <= 1) continue;
    b.vx /= b.rank;
    b.vy /= b.rank;
    b.rank = 1;
  }
}

function comboHoldTime() {
  return COMBO_HOLD_SECONDS;
}

function comboDecayRate() {
  return player.hyperTime > 0 ? Math.max(0.25, 0.72 - player.hyperLevel * 0.08) : 1;
}

function addComboHits(amount = 1) {
  const boosted = player.hyperTime > 0 ? amount * (1 + player.hyperLevel) : amount;
  player.chain += boosted;
  player.comboTimer = comboHoldTime();
}

function addHyperGauge(amount) {
  if (player.hyperStock >= HYPER_STOCK_MAX) return;
  player.hyperGauge = Math.min(HYPER_GAUGE_MAX, player.hyperGauge + amount);
  if (player.hyperGauge >= HYPER_GAUGE_MAX) {
    player.hyperGauge = 0;
    spawnHyperPickup();
  }
}

function resetBgmTrack(track) {
  track.pause();
  track.currentTime = 0;
  track.volume = BGM_VOLUME;
  track.muted = false;
}

function resetOtherBgmTracks(keep = null) {
  for (const track of Object.values(bgm)) {
    if (track !== keep) resetBgmTrack(track);
  }
}

function playBgm(name) {
  const next = bgm[name];
  if (!next) return;
  const playSerial = ++bgmPlaySerial;
  if (IS_MOBILE_BROWSER && !mediaReady(next)) {
    pendingBgmName = name;
    requestMediaLoad(next);
    currentBgm = null;
    return;
  }
  pendingBgmName = null;
  if (bgmFade) {
    resetBgmTrack(bgmFade.track);
    bgmFade = null;
  }
  resetOtherBgmTracks(next);
  next.muted = false;
  next.volume = BGM_VOLUME;
  currentBgm = next;
  currentBgm.currentTime = 0;
  currentBgm.play()
    .then(() => {
      if (playSerial === bgmPlaySerial && currentBgm === next) resetOtherBgmTracks(next);
    })
    .catch(() => {
      if (playSerial === bgmPlaySerial && currentBgm === next) currentBgm = null;
    });
}

function stopBgm() {
  bgmPlaySerial++;
  bgmFade = null;
  pendingBgmName = null;
  currentBgm = null;
  resetOtherBgmTracks();
}

function playHyperStartSe() {
  if (IS_MOBILE_BROWSER && !mediaReady(hyperSe.start)) {
    requestMediaLoad(hyperSe.start);
    return;
  }
  hyperSe.start.pause();
  hyperSe.start.currentTime = 0;
  hyperSe.start.play().catch(() => {});
}

function shouldPlayWeaponSe() {
  return running && !paused && (phase === "stage" || phase === "silence" || phase === "boss");
}

function desiredWeaponSe() {
  if (!shouldPlayWeaponSe()) return null;
  if (player.hyperTime > 0) return player.laserActive ? weaponSe.hyperBeam : weaponSe.hyperVulcan;
  return player.laserActive ? weaponSe.normalBeam : weaponSe.normalVulcan;
}

function updateWeaponLoopSe() {
  const next = desiredWeaponSe();
  if (currentWeaponSe === next) return;
  if (currentWeaponSe) {
    currentWeaponSe.pause();
    currentWeaponSe.currentTime = 0;
  }
  if (next && IS_MOBILE_BROWSER && !mediaReady(next)) {
    requestMediaLoad(next);
    currentWeaponSe = null;
    return;
  }
  currentWeaponSe = next;
  if (currentWeaponSe) currentWeaponSe.play().catch(() => {});
}

function stopWeaponLoopSe() {
  for (const track of Object.values(weaponSe)) {
    track.pause();
    track.currentTime = 0;
  }
  currentWeaponSe = null;
}

function stopHyperLoopSe() {
  stopWeaponLoopSe();
}

function fadeOutBgm(duration = 2.2) {
  if (!currentBgm) return;
  bgmPlaySerial++;
  pendingBgmName = null;
  if (bgmFade) resetBgmTrack(bgmFade.track);
  resetOtherBgmTracks(currentBgm);
  bgmFade = { track: currentBgm, duration, timer: 0, from: currentBgm.volume || BGM_VOLUME };
  currentBgm = null;
}

function updateBgmFade(dt) {
  retryPendingBgm();
  if (!bgmFade) return;
  bgmFade.timer += dt;
  const pct = clamp(bgmFade.timer / bgmFade.duration, 0, 1);
  bgmFade.track.volume = bgmFade.from * (1 - pct);
  if (pct >= 1) {
    bgmFade.track.pause();
    bgmFade.track.currentTime = 0;
    bgmFade.track.volume = BGM_VOLUME;
    bgmFade = null;
  }
}

function addScore(amount) {
  player.score += amount;
  while (player.score >= player.nextLifeScore) {
    player.lives = Math.min(9, player.lives + 1);
    player.nextLifeScore += EXTRA_LIFE_INTERVAL;
    spawnHitSpark(player.x, player.y - 30, "#ff6588", 1.4);
    playSfx("life", 0.24);
  }
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
  player.lives = PLAYER_START_LIVES;
  player.bombs = 2;
  player.power = 5;
  player.invuln = 2;
  player.fireCooldown = 0;
  player.missileCooldown = 0;
  player.laserActive = false;
  player.score = 0;
  player.nextLifeScore = EXTRA_LIFE_INTERVAL;
  player.chain = 0;
  player.comboTimer = 0;
  player.hyperGauge = 0;
  player.hyperStock = 0;
  player.hyperTime = 0;
  player.hyperLevel = 0;
  player.graze = 0;
  stageNo = 1;
  boss.x = W / 2;
  boss.y = -260;
  boss.maxHp = currentStage().bossHp;
  boss.hp = boss.maxHp;
  boss.r = currentStage().bossR;
  boss.corePulse = 0;
  boss.shifted = false;
  boss.enraged = false;
  time = 0;
  shake = 0;
  flash = 0;
  bossPhaseClock = 0;
  bossDeathClock = 0;
  gameOverClock = 0;
  creditScroll = 0;
  bgmFade = null;
  stageFade = 0;
  nextStageNo = 1;
  stopWeaponLoopSe();
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
  bossParts.length = 0;
  bossPartBeams.length = 0;
  shockwaves.length = 0;
  particles.length = 0;
  damageTexts.length = 0;
  initStars();
}

function startGame() {
  if (running) return;
  ensureAudio();
  resetGame();
  running = true;
  paused = false;
  overlay.classList.add("hidden");
  last = performance.now();
  requestAnimationFrame(loop);
}

function retryPendingBgm() {
  if (!pendingBgmName) return;
  const pending = bgm[pendingBgmName];
  if (!pending) {
    pendingBgmName = null;
    return;
  }
  if (IS_MOBILE_BROWSER && !mediaReady(pending)) {
    requestMediaLoad(pending);
    return;
  }
  const name = pendingBgmName;
  pendingBgmName = null;
  playBgm(name);
}

function beginStage() {
  const def = currentStage();
  phase = "stage";
  phaseTimer = 0;
  phaseBanner = 2.2;
  stageWaveIndex = 0;
  stageCombatWaveStep = 0;
  lifePickupsThisStage = 0;
  stageScroll = 0;
  boss.x = W / 2;
  boss.y = -260;
  boss.maxHp = def.bossHp;
  boss.hp = boss.maxHp;
  boss.r = def.bossR;
  boss.shifted = false;
  boss.enraged = false;
  bulletClock = 0;
  enemyClock = 0;
  pickupClock = 0;
  enemyBullets.length = 0;
  enemies.length = 0;
  missiles.length = 0;
  bossParts.length = 0;
  bossPartBeams.length = 0;
  boss.visible = false;
  playBgm(def.stageBgm);
}

function beginStageFadeOut() {
  nextStageNo = stageNo + 1;
  phase = "stageTransition";
  phaseTimer = 0;
  phaseBanner = 0;
  playerBullets.length = 0;
  missiles.length = 0;
  enemyBullets.length = 0;
  enemies.length = 0;
}

function beginSilencePhase() {
  phase = "silence";
  phaseTimer = 0;
  phaseBanner = 2.4;
  enemyClock = 0;
  pickupClock = 0;
  fadeOutBgm(2.8);
}

function beginBossPhase() {
  const def = currentStage();
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
  boss.maxHp = def.bossHp;
  boss.hp = boss.maxHp;
  boss.r = def.bossR;
  boss.visible = true;
  boss.shifted = false;
  boss.enraged = false;
  initBossParts(def);
  playBgm(def.bossBgm);
}

function clearStage() {
  if (phase === "bossDeath" || phase === "clear") return;
  phase = "bossDeath";
  phaseTimer = 0;
  bossDeathClock = 0;
  bossDeathBoomStep = 0;
  phaseBanner = 0;
  enemyBullets.length = 0;
  enemies.length = 0;
  bossParts.length = 0;
  bossPartBeams.length = 0;
  playerBullets.length = 0;
  missiles.length = 0;
  player.invuln = Math.max(player.invuln, 8);
  addScore(100000);
  fadeOutBgm(6.6);
}

function beginStageClear() {
  phase = "clear";
  phaseTimer = 0;
  phaseBanner = 3.2;
  enemyBullets.length = 0;
  enemies.length = 0;
  playerBullets.length = 0;
  missiles.length = 0;
  bossParts.length = 0;
  bossPartBeams.length = 0;
  boss.visible = false;
  addScore(250000 + stageNo * 50000);
  player.bombs = Math.min(4, player.bombs + 1);
}

function advanceStage() {
  if (stageNo >= STAGES.length) {
    beginCredits();
    return;
  }
  beginStageFadeOut();
}

function completeStageTransition() {
  stageNo = nextStageNo;
  boss.maxHp = currentStage().bossHp;
  boss.shifted = false;
  boss.enraged = false;
  player.invuln = 2.2;
  player.chain = 0;
  player.comboTimer = 0;
  stageFade = 1;
  beginStage();
}

function beginCredits() {
  phase = "credits";
  phaseTimer = 0;
  phaseBanner = 0;
  creditScroll = H + 80;
  player.hyperTime = 0;
  player.hyperLevel = 0;
  stopHyperLoopSe();
  enemyBullets.length = 0;
  enemies.length = 0;
  playerBullets.length = 0;
  missiles.length = 0;
  bossParts.length = 0;
  bossPartBeams.length = 0;
  playBgm("allclear");
}

startButton.addEventListener("click", startGame);
window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  const modifierOnly = event.code.startsWith("Shift") || event.code.startsWith("Control") || event.code.startsWith("Alt") || event.code.startsWith("Meta");
  if (!running && !event.repeat && !modifierOnly) {
    event.preventDefault();
    startGame();
    return;
  }
  if (event.code === "Space") {
    event.preventDefault();
    if (!running) startGame();
  }
  if (event.code === "KeyX") useBombButton();
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

function isTouchBombButton(p) {
  return IS_MOBILE_BROWSER &&
    p.x >= touchBombButton.x &&
    p.x <= touchBombButton.x + touchBombButton.w &&
    p.y >= touchBombButton.y &&
    p.y <= touchBombButton.y + touchBombButton.h;
}

canvas.addEventListener("pointerdown", (event) => {
  ensureAudio();
  const p = pointerToGame(event);
  if (isTouchBombButton(p)) {
    useBombButton();
    return;
  }
  pointerActive = true;
  canvas.setPointerCapture(event.pointerId);
  pointerLastX = p.x;
  pointerLastY = p.y;
  pointerDeltaX = 0;
  pointerDeltaY = 0;
  pointerSwipeTimer = 0;
});
canvas.addEventListener("pointermove", (event) => {
  if (!pointerActive) return;
  const p = pointerToGame(event);
  const dx = p.x - pointerLastX;
  const dy = p.y - pointerLastY;
  pointerDeltaX += dx;
  pointerDeltaY += dy;
  if (Math.hypot(dx, dy) > 0.25) pointerSwipeTimer = 0.12;
  pointerLastX = p.x;
  pointerLastY = p.y;
});
canvas.addEventListener("pointerup", () => {
  pointerActive = false;
  pointerDeltaX = 0;
  pointerDeltaY = 0;
  pointerSwipeTimer = 0;
});
canvas.addEventListener("pointercancel", () => {
  pointerActive = false;
  pointerDeltaX = 0;
  pointerDeltaY = 0;
  pointerSwipeTimer = 0;
});

function loop(now) {
  const rawDt = (now - last) / 1000;
  updatePerfMode(rawDt);
  const dt = Math.min(0.033, rawDt);
  last = now;
  if (running && !paused) update(dt);
  else updateWeaponLoopSe();
  render();
  if (running) requestAnimationFrame(loop);
}

function updatePerfMode(rawDt) {
  if (!running || !Number.isFinite(rawDt) || rawDt <= 0) return;
  if (rawDt > 1 / 48) {
    perfLowTimer += rawDt;
    perfGoodTimer = 0;
  } else if (rawDt < 1 / 57) {
    perfGoodTimer += rawDt;
    perfLowTimer = Math.max(0, perfLowTimer - rawDt * 0.8);
  } else {
    perfLowTimer = Math.max(0, perfLowTimer - rawDt * 0.35);
    perfGoodTimer = 0;
  }
  if (perfLowTimer > 0.75) {
    perfMode = IS_MOBILE_BROWSER ? 2 : Math.max(perfMode, 1);
  } else if (perfGoodTimer > 2.4) {
    perfMode = IS_MOBILE_BROWSER ? 1 : 0;
  }
}

function update(dt) {
  time += dt;
  phaseTimer += dt;
  updateBgmFade(dt);
  phaseBanner = Math.max(0, phaseBanner - dt);
  stageFade = Math.max(0, stageFade - dt * 0.85);
  if (phase === "boss") bossPhaseClock += dt;
  if (phase === "bossDeath") bossDeathClock += dt;
  if (phase === "gameover") gameOverClock += dt;
  const wasHyperActive = player.hyperTime > 0;
  player.hyperTime = Math.max(0, player.hyperTime - dt);
  if (wasHyperActive && player.hyperTime <= 0) {
    normalizeHyperRankedBullets();
    player.hyperLevel = 0;
    stopHyperLoopSe();
  }
  player.comboTimer = Math.max(0, player.comboTimer - dt * comboDecayRate());
  if (player.comboTimer <= 0) player.chain = 0;
  bulletClock += dt;
  enemyClock += dt;
  pickupClock += dt;
  stageScroll += (phase === "stage" ? 105 : phase === "silence" ? 58 : 28) * dt;
  shake = Math.max(0, shake - dt * 20);
  flash = Math.max(0, flash - dt * 2.8);
  player.invuln = Math.max(0, player.invuln - dt);
  boss.corePulse += dt;
  if (phase !== "gameover" && phase !== "credits" && phase !== "stageTransition") updatePlayer(dt);
  if (phase === "stage" && phaseTimer >= stageDuration()) beginSilencePhase();
  if (phase === "silence" && phaseTimer > 4.2) beginBossPhase();
  if (phase === "stageTransition" && phaseTimer > 1.15) completeStageTransition();
  if (phase === "boss") updateBoss(dt);
  if (phase === "bossDeath") updateBossDeath(dt);
  if (phase === "credits") updateCredits(dt);
  if (phase === "stage" || phase === "boss") updateSpawns(dt);
  updateEntities(dt);
  if (phase !== "bossDeath" && phase !== "gameover" && phase !== "credits" && phase !== "stageTransition") collide();
  if (phase === "gameover" && gameOverClock > 2.8) showGameOverOverlay();
  if (phase === "clear" && phaseTimer > 4.4) advanceStage();
  updateWeaponLoopSe();
}

function updatePlayer(dt) {
  player.focus = keys.has("ShiftLeft") || keys.has("ShiftRight");
  pointerSwipeTimer = Math.max(0, pointerSwipeTimer - dt);
  player.laserActive = player.focus || pointerSwipeTimer > 0;
  let dx = 0;
  let dy = 0;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) dx += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) dy += 1;

  if (pointerActive) {
    player.x += pointerDeltaX;
    player.y += pointerDeltaY;
    pointerDeltaX = 0;
    pointerDeltaY = 0;
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
    const hyperRate = player.hyperTime > 0 ? 1 + player.hyperLevel * 0.12 : 1;
    player.fireCooldown = (player.laserActive ? 0.075 : 0.095) / hyperRate;
  }
}

function firePlayer() {
  const weaponDamageMul = 2;
  const missileDamageMul = hyperAttackMultiplier();
  const muzzle = playerHitbox();
  if (player.laserActive) {
    const hyperWidth = player.hyperTime > 0 ? 1 + player.hyperLevel * 0.12 : 1;
    beams.push({ x: muzzle.x, y: muzzle.y - 28, life: 0.1, max: 0.1, w: 18 * hyperWidth, damage: 5.2 * weaponDamageMul });
    beams.push({ x: muzzle.x - 18, y: muzzle.y - 22, life: 0.1, max: 0.1, w: 8 * hyperWidth, damage: 2.4 * weaponDamageMul });
    beams.push({ x: muzzle.x + 18, y: muzzle.y - 22, life: 0.1, max: 0.1, w: 8 * hyperWidth, damage: 2.4 * weaponDamageMul });
  } else {
    const volleys = player.hyperTime > 0 ? [-7, 7] : [0];
    for (const volleyOffset of volleys) {
      for (const ox of [-25, 0, 25]) {
        playerBullets.push({ x: muzzle.x + ox + volleyOffset, y: muzzle.y - 16, vx: ox * 0.18, vy: -850, r: 4, damage: (ox === 0 ? 12 : 7) * weaponDamageMul });
      }
      if (player.power >= 5) {
        playerBullets.push({ x: muzzle.x - 34 + volleyOffset, y: muzzle.y - 2, vx: -38, vy: -730, r: 3, damage: 5 * weaponDamageMul });
        playerBullets.push({ x: muzzle.x + 34 + volleyOffset, y: muzzle.y - 2, vx: 38, vy: -730, r: 3, damage: 5 * weaponDamageMul });
      }
    }
  }
  if (player.power >= 8 && player.missileCooldown <= 0) {
    missiles.push({ x: player.x - 28, y: player.y + 4, vx: -130, vy: -330, r: 7, damage: 28 * missileDamageMul, life: 2.8, turn: 7.5, smoke: 0 });
    missiles.push({ x: player.x + 28, y: player.y + 4, vx: 130, vy: -330, r: 7, damage: 28 * missileDamageMul, life: 2.8, turn: 7.5, smoke: 0 });
    player.missileCooldown = player.laserActive ? 0.42 : 0.34;
    playSfx("missile", 0.12);
  }
}

function updateBossPhaseShift(def) {
  if (!boss.visible || boss.maxHp <= 0) return false;
  if (!boss.shifted && boss.hp <= boss.maxHp * BOSS_SHIFT_HP_RATIO) {
    boss.shifted = true;
    bossPhaseClock = 0;
    bulletClock = def.bossInterval;
    flash = Math.max(flash, 0.45);
    shake = Math.max(shake, 18);
    shockwaves.push({ x: boss.x, y: boss.y, life: 0.72, max: 0.72, radius: 12, color: "#62eaff" });
    shockwaves.push({ x: boss.x, y: boss.y, life: 1.05, max: 1.05, radius: 38, color: "#ffe66d" });
    const count = 8 + def.no * 2;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + time * 0.25;
      spawnBullet(boss.x, boss.y + 20, a, 112 + (i % 2) * 22, i % 2 ? "#62eaff" : "#ffe66d", 6, "ring");
    }
  }
  return boss.shifted;
}

function updateBossEnrage(def) {
  if (!boss.visible || boss.maxHp <= 0) return false;
  if (!boss.enraged && boss.hp <= boss.maxHp * BOSS_ENRAGE_HP_RATIO) {
    boss.enraged = true;
    bossPhaseClock = 0;
    bulletClock = def.bossInterval;
    flash = Math.max(flash, 0.9);
    shake = Math.max(shake, 30);
    shockwaves.push({ x: boss.x, y: boss.y, life: 0.9, max: 0.9, radius: 18, color: "#ff355e" });
    shockwaves.push({ x: boss.x, y: boss.y, life: 1.2, max: 1.2, radius: 46, color: "#ffe66d" });

    const count = 15 + def.no * 2;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + time * 0.55;
      spawnBullet(boss.x, boss.y + 24, a, 158 + (i % 3) * 32, i % 2 ? "#ff355e" : "#ffe66d", 5, i % 3 ? "needle" : "ring");
    }
  }
  return boss.enraged;
}

function updateBoss(dt) {
  const def = currentStage();
  const shifted = updateBossPhaseShift(def);
  const enraged = updateBossEnrage(def);
  const moveTime = time * (enraged ? 1.32 : shifted ? 1.12 : 1);

  // ── ステージ別 BOSS 移動 ──────────────────────────────────
  if (def.no === 1) {
    // ゆっくり左右往復（チュートリアル的、読みやすい動き）
    boss.x = W / 2 + Math.sin(moveTime * 0.9) * (enraged ? 118 : 76) + Math.sin(moveTime * 1.7) * (enraged ? 34 : 16);
  } else if (def.no === 2) {
    // 左右端に素早く張り付く動き（カーテンとの相乗効果）
    boss.x = W / 2 + Math.sin(moveTime * 1.6) * 220 + Math.sin(moveTime * 3.1) * (enraged ? 52 : 22);
  } else if (def.no === 3) {
    // 円弧を描いて回り込む（自機狙い弾との組み合わせ）
    boss.x = W / 2 + Math.cos(moveTime * 1.2) * 195 + Math.sin(moveTime * 2.5) * (enraged ? 62 : 28);
  } else if (def.no === 4) {
    // 不規則な大振り移動（変容弾との混乱演出）
    boss.x = W / 2 + Math.sin(moveTime * 0.7) * 230 + Math.sin(moveTime * 2.9 + 1.2) * (enraged ? 82 : 46);
  } else {
    // S5: 広域・高速移動（全方位脅威）
    boss.x = W / 2 + Math.sin(moveTime * 1.4) * 250 + Math.sin(moveTime * 3.8 + 0.8) * (enraged ? 92 : 54);
  }
  boss.x = clamp(boss.x, def.bossR + 24, W - def.bossR - 24);

  const targetY = (enraged ? 204 : 224) + Math.sin(moveTime * 1.1) * (enraged ? 30 : 15);
  boss.y += (targetY - boss.y) * Math.min(1, dt * (enraged ? 3.7 : shifted ? 3 : 2.5));
  updateBossParts(dt, def);

  // ── ステージ別 弾幕パターンセット ───────────────────────
  const interval = def.bossInterval * (enraged ? BOSS_ENRAGE_INTERVAL_MULTIPLIER : shifted ? BOSS_SHIFT_INTERVAL_MULTIPLIER : 1);
  if (bulletClock > interval) {
    bulletClock = 0;

    if (enraged) {
      bossEnrageAttack(def.no);
      return;
    }

    if (shifted) {
      bossShiftAttack(def.no);
      return;
    }

    if (def.no === 1) {
      // S1「幾何学」: 美しい秩序、隙間が見えるパターン
      const p = Math.floor((bossPhaseClock / 6.2) % 4);
      if (p === 0) s1SymmetryFan();
      if (p === 1) s1DiamondGrid();
      if (p === 2) s1MirrorBox();
      if (p === 3) s1PrismPulse();

    } else if (def.no === 2) {
      // S2「洪水」: 量と密度による圧迫、画面を埋め尽くす
      const p = Math.floor((bossPhaseClock / 5.4) % 4);
      if (p === 0) s2WallSpread();
      if (p === 1) s2RandomFlood();
      if (p === 2) s2ColumnSurge();
      if (p === 3) s2TwinCurtain();

    } else if (def.no === 3) {
      // S3「呪い」: 全弾自機狙い、動き続けることが解答
      const p = Math.floor((bossPhaseClock / 5.8) % 4);
      if (p === 0) s3TrackerFan();
      if (p === 1) s3HomingSpiral();
      if (p === 2) s3CurseCross();
      if (p === 3) s3TripleTracker();

    } else if (def.no === 4) {
      // S4「変容」: 速弾と遅弾の混在、安全圏が消える
      const p = Math.floor((bossPhaseClock / 5.2) % 5);
      if (p === 0) s4SlowFastMix();
      if (p === 1) s4AccelSpiral();
      if (p === 2) s4SplitRing();
      if (p === 3) crossingLasers();
      if (p === 4) s4GravityWell();

    } else {
      // S5「侵食」: 全パターン統合＋専用、時間が経つほど苦しい
      const p = Math.floor((bossPhaseClock / 4.6) % 7);
      if (p === 0) spiralBurst();
      if (p === 1) s2WallSpread();
      if (p === 2) s3TrackerFan();
      if (p === 3) s4SplitRing();
      if (p === 4) crossingLasers();
      if (p === 5) s5OmniBlast();
      if (p === 6) s5DarkCurtain();
    }
  }
}

function bossShiftAttack(no) {
  const phaseLen = no >= 5 ? 2.45 : no >= 4 ? 2.65 : no >= 3 ? 2.85 : no >= 2 ? 3.05 : 3.25;
  const p = Math.floor((bossPhaseClock / phaseLen) % 4);

  if (no === 1) {
    s1ShiftAttack(p);
  } else if (no === 2) {
    s2ShiftAttack(p);
  } else if (no === 3) {
    s3ShiftAttack(p);
  } else if (no === 4) {
    s4ShiftAttack(p);
  } else {
    if (p === 0) shiftOrbitFan(18, 160, 0.24);
    if (p === 1) shiftLaneRain(9, 178, 0.28);
    if (p === 2) shiftAimedSweep(4, 254, 0.082);
    if (p === 3) shiftSideRain(5, 238);
  }
}

function shiftOrbitFan(count, speed, spread) {
  const base = time * 4.7;
  for (let i = 0; i < count; i++) {
    const a = base + (i / count) * TAU;
    spawnBullet(boss.x, boss.y + 18, a, speed + (i % 3) * 24, i % 2 ? "#62eaff" : "#ff7a30", 6, "petal");
    if (i % 3 === 0) spawnBullet(boss.x, boss.y + 18, a + spread, speed * 0.72, "#ad5cff", 7, "orb");
  }
}

function shiftAimedSweep(width, speed, step) {
  const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
  for (let side = -1; side <= 1; side += 2) {
    for (let i = -width; i <= width; i++) {
      spawnBullet(boss.x + side * 72, boss.y + 28, aim + i * step + side * 0.05, speed + Math.abs(i) * 14, side > 0 ? "#ffe66d" : "#8ff6ff", 5, "needle");
    }
  }
}

function shiftLaneRain(lanes, speed, wobble) {
  for (let i = 0; i < lanes; i++) {
    const x = 58 + i * ((W - 116) / Math.max(1, lanes - 1));
    const sway = Math.sin(time * 2.4 + i * 0.75) * wobble;
    spawnBullet(x, boss.y + 36, Math.PI / 2 + sway, speed + (i % 2) * 28, i % 2 ? "#ff4fcf" : "#62eaff", 6, "ring");
  }
}

function shiftCrossBurst(count, speed) {
  const base = bossPhaseClock * 0.95;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + base;
    spawnBullet(boss.x, boss.y + 12, a, speed + (i % 4) * 18, i % 2 ? "#ff355e" : "#ffe66d", 5, i % 3 ? "needle" : "star");
  }
}

function shiftSideRain(rows, speed) {
  for (let i = 0; i < rows; i++) {
    const y = 160 + i * ((H * 0.52) / Math.max(1, rows - 1));
    const sway = Math.sin(time * 2.2 + i) * 0.16;
    spawnBullet(-24, y, 0.12 + sway, speed + i * 16, "#ff8642", 5, "wave");
    spawnBullet(W + 24, y + 22, Math.PI - 0.12 - sway, speed + i * 16, "#ad5cff", 5, "wave");
  }
}

function bossEnrageAttack(no) {
  const phaseLen = no >= 5 ? 1.65 : no >= 4 ? 1.85 : no >= 3 ? 2.0 : no >= 2 ? 2.15 : 2.35;
  const p = Math.floor((bossPhaseClock / phaseLen) % 5);

  if (no === 1) {
    s1EnrageAttack(p);
  } else if (no === 2) {
    s2EnrageAttack(p);
  } else if (no === 3) {
    s3EnrageAttack(p);
  } else if (no === 4) {
    s4EnrageAttack(p);
  } else {
    if (p === 0) enrageSpiral(21, 7.4, 186, 0.2);
    if (p === 1) enrageLaneCurtain(10, 210, 0.34);
    if (p === 2) enrageAimedFan(5, 2, 288, 0.074);
    if (p === 3) enrageSlowFastTrap(20);
    if (p === 4) enrageRandomBurst(14, 165, 292);
  }
}

function enrageSpiral(count, turnSpeed, baseSpeed, forkOffset) {
  const base = time * turnSpeed;
  for (let i = 0; i < count; i++) {
    const a = base + (i / count) * TAU;
    const spd = baseSpeed + (i % 4) * 28;
    spawnBullet(boss.x, boss.y + 18, a, spd, i % 2 ? "#ff355e" : "#ffe66d", 5, i % 3 ? "needle" : "ring");
    if (i % 2 === 0) spawnBullet(boss.x, boss.y + 18, -a + time * 0.7 + forkOffset, spd * 0.86, "#ad5cff", 6, "orb");
  }
}

function enrageAimedFan(width, rows, speed, step) {
  const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
  const rowMid = (rows - 1) / 2;
  for (let row = 0; row < rows; row++) {
    const originX = boss.x + (row - rowMid) * 58;
    for (let i = -width; i <= width; i++) {
      const a = aim + i * step + (row - rowMid) * 0.035;
      spawnBullet(originX, boss.y + 30, a, speed + Math.abs(i) * 12 + row * 18, row % 2 ? "#62eaff" : "#ff4fcf", 5, "needle");
    }
  }
}

function enrageLaneCurtain(lanes, speed, wobble) {
  for (let i = 0; i < lanes; i++) {
    const x = 44 + i * ((W - 88) / Math.max(1, lanes - 1));
    const sway = Math.sin(time * 3.1 + i * 0.8) * wobble;
    spawnBullet(x, boss.y + 30, Math.PI / 2 + sway, speed + (i % 3) * 24, i % 2 ? "#ffe66d" : "#62eaff", 6, "ring");
    if (i % 2 === 0) spawnBullet(x, H * 0.1, Math.PI / 2 - sway * 0.55, speed * 0.72, "#ff355e", 7, "petal");
  }
}

function enrageSideClamp(rows, speed) {
  for (let i = 0; i < rows; i++) {
    const y = 155 + i * ((H * 0.52) / Math.max(1, rows - 1));
    const leftAim = Math.atan2(player.y - y, player.x + 36);
    const rightAim = Math.atan2(player.y - y, player.x - (W + 36));
    spawnBullet(-34, y, leftAim, speed + i * 14, "#ff8642", 5, "wave");
    spawnBullet(W + 34, y + 24, rightAim, speed + i * 14, "#ad5cff", 5, "wave");
  }
}

function enrageSnapRing(count, speed) {
  const offset = bossPhaseClock * 1.6;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + offset;
    spawnBullet(boss.x, boss.y + 12, a, speed + (i % 2) * 34, i % 2 ? "#ff355e" : "#8ff6ff", 5, i % 2 ? "needle" : "star");
  }
}

function enrageRandomBurst(count, minSpeed, maxSpeed) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, TAU);
    spawnBullet(boss.x + rand(-66, 66), boss.y + rand(-20, 34), a, rand(minSpeed, maxSpeed), i % 2 ? "#ff9f45" : "#ff4fcf", 6, "petal");
  }
}

function enrageTrackerNeedles(rows, speed) {
  const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
  for (let row = 0; row < rows; row++) {
    const delayAngle = aim + Math.sin(time * 2.7 + row) * 0.22;
    for (let i = -2; i <= 2; i++) {
      spawnBullet(boss.x + (row - (rows - 1) / 2) * 42, boss.y + 24, delayAngle + i * 0.08, speed + row * 18 + Math.abs(i) * 16, "#ff355e", 5, "needle");
    }
  }
}

function enrageSlowFastTrap(count) {
  const base = time * 3.4;
  for (let i = 0; i < count; i++) {
    const a = base + (i / count) * TAU;
    if (i % 3 === 0) {
      spawnBullet(boss.x, boss.y, a, 92, "#ad5cff", 8, "orb");
    } else {
      spawnBullet(boss.x, boss.y, a + Math.sin(time + i) * 0.08, 292 + (i % 2) * 48, "#ff355e", 5, "needle");
    }
  }
}

function initBossParts(def) {
  bossParts.length = 0;
  bossPartBeams.length = 0;
  const loadout = BOSS_PART_LOADOUTS[def.no] || [];
  loadout.forEach((part, index) => {
    const phaseOffset = rand(0, TAU);
    const home = {
      x: boss.x + part.relX,
      y: boss.y + part.relY,
    };
    bossParts.push({
      ...part,
      x: home.x,
      y: home.y,
      hp: Math.round(part.hp * (1 + def.no * 0.04)),
      maxHp: Math.round(part.hp * (1 + def.no * 0.04)),
      fireClock: rand(0, part.interval * 0.55),
      state: "attached",
      t: 0,
      phaseOffset,
      hitFlash: 0,
      index,
    });
  });
}

function bossPartHome(part) {
  const bob = Math.sin(time * 2.1 + part.phaseOffset) * 5;
  const sway = Math.cos(time * 1.7 + part.phaseOffset) * 3;
  return {
    x: boss.x + part.relX + sway,
    y: boss.y + part.relY + bob,
  };
}

function updateBossParts(dt, def) {
  updateBossPartBeams(dt);
  for (const part of bossParts) {
    if (!part || part.dead) continue;
    part.t += dt;
    part.hitFlash = Math.max(0, part.hitFlash - dt * 8);

    if (part.state === "charging") {
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.chargeTime -= dt;
      if (part.trailClock === undefined) part.trailClock = 0;
      part.trailClock -= dt;
      if (part.trailClock <= 0) {
        part.trailClock = 0.08;
        spawnBullet(part.x, part.y, rand(0, TAU), rand(68, 110), "#ff4fcf", 5, "orb");
      }
      const hitbox = playerHitbox();
      if (player.invuln <= 0 && dist2(part, hitbox) < (part.r + hitbox.r + 2) ** 2) {
        hitPlayer();
        part.state = "returning";
      }
      if (part.chargeTime <= 0 || part.x < -90 || part.x > W + 90 || part.y < -90 || part.y > H + 90) {
        part.state = "returning";
      }
      continue;
    }

    const home = bossPartHome(part);
    if (part.state === "returning") {
      part.x += (home.x - part.x) * Math.min(1, dt * 4.8);
      part.y += (home.y - part.y) * Math.min(1, dt * 4.8);
      if (Math.hypot(part.x - home.x, part.y - home.y) < 8) part.state = "attached";
      continue;
    }

    part.x = home.x;
    part.y = home.y;
    const phaseBoost = boss.enraged ? 0.82 : boss.shifted ? 0.95 : 1.08;
    part.fireClock += dt;
    if (part.fireClock > part.interval * phaseBoost) {
      part.fireClock = 0;
      bossPartAttack(part, def);
    }
  }
}

function updateBossPartBeams(dt) {
  for (const beam of bossPartBeams) {
    beam.age += dt;
    beam.life -= dt;
    const active = beam.age >= beam.warm;
    if (!active) continue;
    const hitbox = playerHitbox();
    const a = { x: beam.x, y: beam.y };
    const b = { x: beam.x + Math.cos(beam.angle) * beam.length, y: beam.y + Math.sin(beam.angle) * beam.length };
    if (player.invuln <= 0 && pointSegmentDistance(hitbox, a, b) < hitbox.r + beam.width * 0.42) {
      hitPlayer();
      beam.life = Math.min(beam.life, 0.12);
    }
  }
  removeWhere(bossPartBeams, (beam) => beam.life <= 0);
}

function bossPartAttack(part, def) {
  const aim = Math.atan2(player.y - part.y, player.x - part.x);
  const rank = boss.enraged ? 1.06 : boss.shifted ? 1 : 0.96;
  if (part.attack === "turret") {
    const spread = def.no >= 5 ? 0.11 : 0.14;
    const width = def.no >= 5 ? 3 : 2;
    for (let i = -width; i <= width; i++) {
      spawnBullet(part.x, part.y, aim + i * spread + part.side * 0.04, 185 * rank + Math.abs(i) * 16, part.side >= 0 ? "#62eaff" : "#ff7a30", 5, "needle");
    }
    spawnBullet(part.x, part.y, time * 3.2 + part.side, 118 * rank, "#ffe66d", 7, "ring");
    return;
  }

  if (part.attack === "missile") {
    for (let i = -1; i <= 1; i++) {
      const a = aim + i * 0.18 + Math.sin(time + i) * 0.035;
      spawnBullet(part.x + i * 8, part.y, a, (210 + Math.abs(i) * 34) * rank, "#ff9f45", 6, "wave");
    }
    for (let i = 0; i < 3; i++) {
      spawnBullet(part.x, part.y, Math.PI / 2 + (i - 1) * 0.16, (132 + i * 18) * rank, "#ff355e", 5, "star");
    }
    return;
  }

  if (part.attack === "ram") {
    part.state = "charging";
    part.chargeTime = boss.enraged ? 0.86 : 1.05;
    const speed = (boss.enraged ? 470 : boss.shifted ? 430 : 390) * (0.95 + def.no * 0.03);
    part.vx = Math.cos(aim) * speed;
    part.vy = Math.sin(aim) * speed;
    part.trailClock = 0;
    shockwaves.push({ x: part.x, y: part.y, life: 0.42, max: 0.42, radius: 10, color: "#ff4fcf" });
    return;
  }

  if (part.attack === "beam") {
    bossPartBeams.push({
      x: part.x,
      y: part.y,
      angle: aim + part.side * 0.03,
      length: 1500,
      width: boss.enraged ? 24 : boss.shifted ? 21 : 18,
      warm: 0.32,
      age: 0,
      life: boss.enraged ? 0.82 : 0.92,
      max: boss.enraged ? 0.82 : 0.92,
      color: part.side === 0 ? "#ffe66d" : part.side > 0 ? "#62eaff" : "#ff4fcf",
    });
    return;
  }

  if (part.attack === "mine") {
    const count = def.no >= 5 ? 7 : 5;
    const offset = time * 0.7;
    for (let i = 0; i < count; i++) {
      const a = offset + (i / count) * TAU;
      spawnBullet(part.x, part.y, a, (72 + (i % 3) * 22) * rank, i % 2 ? "#ad5cff" : "#ffe66d", 8, "orb");
      if (boss.shifted || boss.enraged) spawnBullet(part.x, part.y, a + Math.PI / count, 180 * rank, "#ff355e", 5, "needle");
    }
  }
}

function damageBossPart(part, amount) {
  if (!part || part.dead) return;
  part.hp = Math.max(0, part.hp - amount);
  part.hitFlash = 1;
  addScore(amount * 18);
  addComboHits(1);
  addHyperGauge(0.72);
  if (Math.random() < 0.32) spawnHitSpark(part.x + rand(-part.r, part.r), part.y + rand(-part.r, part.r), "#ffdf65", 0.9);
  if (part.hp <= 0) killBossPart(part);
}

function killBossPart(part) {
  if (part.dead) return;
  part.dead = true;
  addScore(45000 + currentStage().no * 6500);
  addComboHits(18);
  massiveExplosion(part.x, part.y, 1.05);
  playSfx("explode", 0.38);
  scatterPickups(part.x, part.y, "hyperCharge", currentStage().no >= 5 ? 2 : 1, { speedMultiplier: 0.85, magnetDelay: 0.35 });
  shockwaves.push({ x: part.x, y: part.y, life: 0.78, max: 0.78, radius: 16, color: "#b46cff" });
}

function hitBossPartByCircle(projectile, damage, sparkColor = "#8df8ff", sparkScale = 0.85) {
  let best = null;
  let bestD = Infinity;
  for (const part of bossParts) {
    if (!part || part.dead || part.hp <= 0) continue;
    const d = dist2(projectile, part);
    if (d < (part.r + projectile.r) ** 2 && d < bestD) {
      best = part;
      bestD = d;
    }
  }
  if (!best) return false;
  spawnHitSpark(projectile.x, projectile.y, sparkColor, sparkScale);
  damageBossPart(best, damage);
  return true;
}

function updateBossDeath(dt) {
  boss.y += Math.sin(time * 9) * 8 * dt;
  shake = Math.max(shake, bossDeathClock < 5.8 ? 12 : 24);
  playBossDeathBeats();
  if (bossDeathClock < 5.6 && bulletClock > (IS_MOBILE_BROWSER ? 0.22 : 0.12)) {
    bulletClock = 0;
    const ox = rand(-boss.r * 1.5, boss.r * 1.5);
    const oy = rand(-boss.r * 0.9, boss.r * 0.9);
    const scale = bossDeathClock > 4.1 ? rand(1.15, 1.75) : bossDeathClock > 2.2 ? rand(0.85, 1.35) : rand(0.6, 1.05);
    bossExplosionBurst(boss.x + ox, boss.y + oy, scale, bossDeathClock > 3 ? 1.2 : 0.9);
    if (Math.random() < (IS_MOBILE_BROWSER ? 0.45 : 0.72)) playBossDeathPop(scale);
  }
  if (bossDeathClock >= 5.6 && boss.visible) {
    boss.visible = false;
    flash = 1;
    shake = 42;
    shockwaves.push({ x: boss.x, y: boss.y, life: 1.35, max: 1.35, radius: 24, color: "#fff2a8" });
    shockwaves.push({ x: boss.x, y: boss.y, life: 1.7, max: 1.7, radius: 54, color: "#ff7c33" });
    shockwaves.push({ x: boss.x, y: boss.y, life: 2.1, max: 2.1, radius: 12, color: "#8df8ff" });
    bossExplosionBurst(boss.x, boss.y, 5.2, 2.8);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + rand(-0.12, 0.12);
      bossExplosionBurst(boss.x + Math.cos(a) * boss.r * 0.95, boss.y + Math.sin(a) * boss.r * 0.55, rand(1.15, 1.85), 0.9);
    }
    playBossDeathFinalSound();
  }
  if (bossDeathClock > 7.4) beginStageClear();
}

function playBossDeathBeats() {
  const beats = [0.12, 0.75, 1.35, 2.05, 2.85, 3.65, 4.42, 5.08];
  while (bossDeathBoomStep < beats.length && bossDeathClock >= beats[bossDeathBoomStep]) {
    const step = bossDeathBoomStep++;
    if (step < 2) playAudioPool(gameSe.explodeSmall, 0.9);
    else if (step < 5) playAudioPool(gameSe.explodeMedium, 0.9);
    else playAudioPool(gameSe.explodeLarge, 0.78);
  }
}

function playBossDeathPop(scale = 1) {
  if (scale > 1.35) playAudioPool(gameSe.explodeMedium, 0.48);
  else playAudioPool(gameSe.explodeSmall, 0.55);
}

function playBossDeathFinalSound() {
  playAudioPool(gameSe.explodeMedium, 0.95);
  window.setTimeout(() => playAudioPool(gameSe.explodeSmall, 0.75), 70);
  window.setTimeout(() => playAudioPool(gameSe.explodeMedium, 0.9), 140);
  window.setTimeout(() => playAudioPool(gameSe.explodeLarge, 1), 220);
  window.setTimeout(() => playAudioPool(gameSe.explodeLarge, 0.85), 420);
}

function updateCredits(dt) {
  creditScroll -= 46 * dt;
  player.y += (H - 155 - player.y) * Math.min(1, dt * 1.4);
  player.x += (W / 2 - player.x) * Math.min(1, dt * 1.4);
  if (phaseTimer > 34) {
    running = false;
    overlay.querySelector("h1").textContent = "ALL CLEAR";
    overlay.querySelector("p").textContent = `SCORE ${formatScore(player.score)}`;
    startButton.textContent = "RESTART";
    overlay.classList.remove("hidden");
  }
}

// S1は密度を抑えた単純螺旋、S2以降も増え方を緩やかにする
function spiralBurst() {
  const no = currentStage().no;
  const count = 8 + no; // S1:9, S2:10, S3:11, S4:12, S5:13
  const base = time * (2.8 + no * 0.22);
  for (let i = 0; i < count; i++) {
    const a = base + (i / count) * TAU;
    spawnBullet(boss.x, boss.y + 18, a, 140 + (i % 2) * 30, "#ff7a30", 7, "needle");
    if (no >= 2) {
      // S2以降だけ逆回転を追加
      spawnBullet(boss.x, boss.y + 18, -a + time, 112, "#ff35cf", 6, "orb");
    }
  }
}

// S1は控えめな花弁、S2以降も密度を上げすぎない
function flowerBurst() {
  const no = currentStage().no;
  const count = 12 + no * 2; // S1:14, S2:16, S3:18, S4:20, S5:22
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + Math.sin(time * 2) * (0.2 + no * 0.08);
    const speed = 95 + 60 * Math.sin(i * 1.7 + time) ** 2;
    spawnBullet(boss.x, boss.y, a, speed, i % 3 ? "#ff4fcf" : "#62eaff", 6, "petal");
  }
}

function aimedFans() {
  const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
  const fanWidth = currentStage().no >= 3 ? 2 : 1;
  for (let fan = -fanWidth; fan <= fanWidth; fan++) {
    for (let i = -2; i <= 2; i++) {
      spawnBullet(boss.x + fan * 17, boss.y + 34, aim + i * 0.11 + fan * 0.03, 205 + Math.abs(i) * 18, fan % 2 ? "#ff4d7e" : "#8ff6ff", 6, "needle");
    }
  }
}

function helixStorm() {
  const arms = currentStage().no >= 4 ? 4 : 3;
  for (let arm = 0; arm < arms; arm++) {
    const a = time * 4.2 + arm * TAU / arms;
    for (let i = 0; i < 4; i++) {
      spawnBullet(boss.x, boss.y, a + i * 0.12, 128 + i * 24, arm % 2 ? "#ad5cff" : "#ff8642", 5, "orb");
    }
  }
}

function curtainRain() {
  const lanes = 6 + Math.ceil(currentStage().no / 2);
  for (let i = 0; i < lanes; i++) {
    const x = 70 + i * ((W - 140) / Math.max(1, lanes - 1));
    const sway = Math.sin(time * 2.6 + i) * 0.18;
    spawnBullet(x, boss.y + 40, Math.PI / 2 + sway, 118 + (i % 3) * 24, i % 2 ? "#ffe66d" : "#62eaff", 7, "ring");
  }
}

function crossingLasers() {
  const base = Math.atan2(player.y - boss.y, player.x - boss.x);
  for (let i = -2; i <= 2; i++) {
    spawnBullet(boss.x - 82, boss.y + 22, base + i * 0.18 + 0.3, 235, "#ff355e", 5, "laser");
    spawnBullet(boss.x + 82, boss.y + 22, base - i * 0.18 - 0.3, 235, "#ad5cff", 5, "laser");
  }
  for (let i = 0; i < 6; i++) {
    spawnBullet(boss.x, boss.y + 36, (i / 6) * TAU + time, 105, "#ffec8b", 6, "star");
  }
}

// ═══════════════════════════════════════════════
//  S1 専用パターン
// ═══════════════════════════════════════════════

// 左右2点から対称扇: 幾何学的な美しさ、隙間が視認しやすい
function s1SymmetryFan() {
  const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
  for (let side = -1; side <= 1; side += 2) {
    for (let i = -3; i <= 3; i++) {
      spawnBullet(
        boss.x + side * 58, boss.y + 30,
        aim + i * 0.09,
        155 + Math.abs(i) * 14,
        side > 0 ? "#62eaff" : "#ff7a30",
        6, "needle"
      );
    }
  }
}

function s1DiamondGrid() {
  const anchors = [-72, 0, 72];
  for (let row = 0; row < anchors.length; row++) {
    const x = boss.x + anchors[row];
    const y = boss.y + 18 + row * 12;
    for (const angle of [Math.PI / 2 - 0.42, Math.PI / 2 + 0.42]) {
      spawnBullet(x, y, angle, 118 + row * 12, row % 2 ? "#62eaff" : "#ffe66d", 6, "ring");
    }
  }
}

function s1MirrorBox() {
  const rows = [190, 265, 340];
  rows.forEach((y, i) => {
    const sway = Math.sin(time * 1.8 + i) * 0.08;
    spawnBullet(38, y, sway, 132 + i * 12, "#62eaff", 5, "needle");
    spawnBullet(W - 38, y, Math.PI - sway, 132 + i * 12, "#ff7a30", 5, "needle");
  });
}

function s1PrismPulse() {
  const points = [-84, -28, 28, 84];
  points.forEach((ox, i) => {
    const angle = Math.PI / 2 + (i - 1.5) * 0.13 + Math.sin(time * 2 + i) * 0.04;
    spawnBullet(boss.x + ox, boss.y + 18, angle, 136 + (i % 2) * 18, i % 2 ? "#8ff6ff" : "#fff2a8", 6, "star");
  });
}

function s1CompassNeedles(count, speed) {
  for (let i = 0; i < count; i++) {
    const ox = (i - (count - 1) / 2) * 34;
    const lean = (i - (count - 1) / 2) * 0.055;
    spawnBullet(boss.x + ox, boss.y + 26, Math.PI / 2 + lean, speed + Math.abs(ox) * 0.12, i % 2 ? "#62eaff" : "#ffe66d", 5, "needle");
  }
}

function s1ShiftAttack(p) {
  if (p === 0) {
    s1DiamondGrid();
    return;
  }
  if (p === 1) {
    s1CompassNeedles(7, 150);
    return;
  }
  if (p === 2) {
    s1MirrorBox();
    spawnBullet(boss.x, boss.y + 28, Math.PI / 2, 168, "#ffe66d", 6, "ring");
    return;
  }
  for (let i = -2; i <= 2; i++) {
    spawnBullet(boss.x - 64, boss.y + 28, Math.PI / 2 + i * 0.1, 158 + Math.abs(i) * 12, "#ff7a30", 5, "needle");
    spawnBullet(boss.x + 64, boss.y + 28, Math.PI / 2 - i * 0.1, 158 + Math.abs(i) * 12, "#62eaff", 5, "needle");
  }
}

function s1EnrageAttack(p) {
  if (p === 0) {
    s1CompassNeedles(9, 178);
    s1PrismPulse();
    return;
  }
  if (p === 1) {
    for (let side = -1; side <= 1; side += 2) {
      for (let i = -3; i <= 3; i++) {
        spawnBullet(boss.x + side * 76, boss.y + 30, Math.PI / 2 + i * 0.085 + side * 0.04, 178 + Math.abs(i) * 12, side > 0 ? "#62eaff" : "#ff7a30", 5, "needle");
      }
    }
    return;
  }
  if (p === 2) {
    s1MirrorBox();
    s1PrismPulse();
    return;
  }
  if (p === 3) {
    for (const x of [boss.x - 88, boss.x, boss.x + 88]) {
      spawnBullet(x, boss.y + 18, Math.PI / 2 - 0.22, 154, "#8ff6ff", 6, "ring");
      spawnBullet(x, boss.y + 18, Math.PI / 2 + 0.22, 154, "#fff2a8", 6, "ring");
    }
    return;
  }
  s1DiamondGrid();
  s1PrismPulse();
}

// ═══════════════════════════════════════════════
//  S2 専用パターン（洪水・量の暴力）
// ═══════════════════════════════════════════════

// 【変更後】角度を均等に割り当てず「意図的に2箇所の隙間」を作る
function s2WallSpread() {
  const count = 12;
  const offset = time * 0.75;
  const gapAngle1 = Math.PI / 2; // 下方向に隙間
  const gapAngle2 = Math.PI / 2 + Math.PI; // 上方向にも隙間
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + offset;
    // 隙間の付近(±0.25rad)は発射しない
    const distToGap1 = Math.abs(((a - gapAngle1 + Math.PI) % TAU) - Math.PI);
    const distToGap2 = Math.abs(((a - gapAngle2 + Math.PI) % TAU) - Math.PI);
    if (distToGap1 < 0.25 || distToGap2 < 0.25) continue;
    const spd = 80 + (i % 3) * 22;
    spawnBullet(boss.x, boss.y, a, spd, i % 2 ? "#ffe66d" : "#ff8c00", 6, "orb");
  }
}

// ランダムばらまきは少数にして「逃げ場のある密度」に
function s2RandomFlood() {
  const count = 8;
  for (let i = 0; i < count; i++) {
    const a = rand(0, TAU);
    const spd = rand(62, 105);
    spawnBullet(boss.x + rand(-28, 28), boss.y + rand(-14, 14), a, spd, "#ff9f45", 7, "petal");
  }
}

// 2波、各10発。隙間を揃えて「抜けるライン」を作る
function s2BurstRing() {
  [0, Math.PI / 12].forEach((offset, waveIdx) => { // 2波に削減
    const count = 10;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + offset;
      const spd = 160 + waveIdx * 30;
      spawnBullet(boss.x, boss.y, a, spd, "#ffec8b", 6, "ring");
    }
  });
}

// 上下二重カーテン: S1カーテンの強化版、上下から挟み込む
function s2TwinCurtain() {
  const cadence = Math.floor(bossPhaseClock / currentStage().bossInterval);
  if (cadence % 2 === 1) return;
  const lanes = 5;
  for (let i = 0; i < lanes; i++) {
    if (i === Math.floor(lanes / 2)) continue;
    const x = 74 + i * ((W - 148) / (lanes - 1));
    const swayTop = Math.sin(time * 1.8 + i * 0.85) * 0.14;
    spawnBullet(x, 0, Math.PI / 2 + swayTop, 90, "#ff7a30", 6, "ring");
    if (i % 2 === 0) {
      const swayBot = Math.sin(time * 1.5 + i * 1.1) * 0.11;
      spawnBullet(x + 34, H * 0.13, Math.PI / 2 + swayBot, 74, "#ff4fcf", 6, "ring");
    }
  }
}

function s2ColumnSurge() {
  const lanes = 6;
  const gap = Math.floor((bossPhaseClock * 1.2) % lanes);
  for (let i = 0; i < lanes; i++) {
    if (i === gap) continue;
    const x = 58 + i * ((W - 116) / (lanes - 1));
    const sway = Math.sin(time * 1.7 + i) * 0.11;
    spawnBullet(x, 8, Math.PI / 2 + sway, 116 + (i % 2) * 18, i % 2 ? "#62eaff" : "#ff9f45", 7, "petal");
  }
}

function s2ShiftAttack(p) {
  if (p === 0) {
    s2ColumnSurge();
    return;
  }
  if (p === 1) {
    const rows = [180, 270, 360, 450];
    rows.forEach((y, i) => {
      const speed = 142 + i * 10;
      spawnBullet(-28, y, 0.08 + Math.sin(time + i) * 0.07, speed, "#62eaff", 6, "wave");
      if (i % 2 === 0) spawnBullet(W + 28, y + 28, Math.PI - 0.08, speed * 0.92, "#ff9f45", 6, "wave");
    });
    return;
  }
  if (p === 2) {
    for (let i = 0; i < 9; i++) {
      spawnBullet(rand(58, W - 58), boss.y + rand(8, 46), Math.PI / 2 + rand(-0.18, 0.18), rand(112, 166), i % 2 ? "#ffe66d" : "#62eaff", 6, "ring");
    }
    return;
  }
  s2TwinCurtain();
}

function s2EnrageAttack(p) {
  if (p === 0) {
    const lanes = 8;
    const gap = Math.floor((bossPhaseClock * 1.6) % lanes);
    for (let i = 0; i < lanes; i++) {
      if (i === gap || i === gap + 1) continue;
      const x = 44 + i * ((W - 88) / (lanes - 1));
      spawnBullet(x, 0, Math.PI / 2 + Math.sin(time * 2 + i) * 0.14, 154, "#62eaff", 6, "ring");
    }
    return;
  }
  if (p === 1) {
    for (let i = 0; i < 5; i++) {
      const y = 170 + i * 72;
      spawnBullet(-32, y, 0.12, 190 + i * 12, "#ff9f45", 5, "wave");
      spawnBullet(W + 32, y + 36, Math.PI - 0.12, 190 + i * 12, "#62eaff", 5, "wave");
    }
    return;
  }
  if (p === 2) {
    for (let i = 0; i < 13; i++) {
      spawnBullet(rand(44, W - 44), boss.y + rand(-10, 52), Math.PI / 2 + rand(-0.26, 0.26), rand(142, 206), i % 2 ? "#ffe66d" : "#62eaff", 6, "petal");
    }
    return;
  }
  if (p === 3) {
    s2ColumnSurge();
    for (let i = 0; i < 4; i++) spawnBullet(boss.x + (i - 1.5) * 52, boss.y + 36, Math.PI / 2, 214, "#ff9f45", 5, "needle");
    return;
  }
  s2TwinCurtain();
  s2ColumnSurge();
}

// ═══════════════════════════════════════════════
//  S3 専用パターン（自機狙い・動き続けることが解答）
// ═══════════════════════════════════════════════

// 3方向自機狙い扇: 動くほど弾がばらける
function s3TrackerFan() {
  const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
  const colors = ["#ff355e", "#ad5cff", "#62eaff"];
  for (let wave = 0; wave < 3; wave++) {
    for (let i = -1; i <= 1; i++) {
      spawnBullet(
        boss.x, boss.y + 26,
        aim + i * 0.12 + wave * (TAU / 3),
        168 + wave * 20,
        colors[wave], 6, "needle"
      );
    }
  }
}

// 自機方向の緩やか螺旋: 逃げ続けると自然に散る
function s3HomingSpiral() {
  const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
  const count = 10;
  for (let i = 0; i < count; i++) {
    const a = aim + (i / count) * TAU * 0.32 + Math.sin(time * 1.9) * 0.38;
    spawnBullet(boss.x, boss.y, a, 95 + i * 9, "#ff4d7e", 7, "orb");
  }
}

// 5方向挟み込み: 同じ場所に留まると詰む
function s3TripleTracker() {
  const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
  const offsets = [-60, -30, 0, 30, 60];
  offsets.forEach(deg => {
    const a = aim + (deg * Math.PI) / 180;
    spawnBullet(boss.x, boss.y + 20, a, 188, "#8ff6ff", 5, "laser");
  });
}

function s3CurseCross() {
  const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
  const ghosts = [
    { x: boss.x - 84, y: boss.y + 12 },
    { x: boss.x + 84, y: boss.y + 12 },
    { x: boss.x, y: boss.y + 58 },
  ];
  ghosts.forEach((g, idx) => {
    for (let i = -1; i <= 1; i++) {
      spawnBullet(g.x, g.y, aim + i * 0.13 + (idx - 1) * 0.05, 170 + idx * 18, idx % 2 ? "#ad5cff" : "#ff4fcf", 5, "needle");
    }
  });
}

function s3ShiftAttack(p) {
  const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
  if (p === 0) {
    for (let i = -3; i <= 3; i++) spawnBullet(boss.x, boss.y + 30, aim + i * 0.075, 204 + Math.abs(i) * 10, "#ff4fcf", 5, "needle");
    return;
  }
  if (p === 1) {
    const origins = [-92, -46, 46, 92];
    origins.forEach((ox, i) => {
      const a = Math.atan2(player.y - (boss.y + 26), player.x - (boss.x + ox));
      spawnBullet(boss.x + ox, boss.y + 26, a + Math.sin(time + i) * 0.08, 188 + i * 14, "#8ff6ff", 5, "laser");
    });
    return;
  }
  if (p === 2) {
    s3CurseCross();
    return;
  }
  for (let i = 0; i < 8; i++) {
    const a = aim + (i - 3.5) * 0.055;
    spawnBullet(boss.x + Math.sin(i) * 70, boss.y + 24, a, 162 + i * 10, i % 2 ? "#ad5cff" : "#ff355e", 6, "orb");
  }
}

function s3EnrageAttack(p) {
  const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
  if (p === 0) {
    for (let row = 0; row < 3; row++) {
      for (let i = -2; i <= 2; i++) spawnBullet(boss.x + (row - 1) * 48, boss.y + 24, aim + i * 0.075 + row * 0.035, 220 + row * 18, "#ff355e", 5, "needle");
    }
    return;
  }
  if (p === 1) {
    for (const x of [48, W - 48, boss.x]) {
      const a = Math.atan2(player.y - boss.y, player.x - x);
      spawnBullet(x, boss.y + 20, a, 242, "#8ff6ff", 5, "laser");
      spawnBullet(x, boss.y + 20, a + 0.11, 194, "#ad5cff", 6, "orb");
    }
    return;
  }
  if (p === 2) {
    s3CurseCross();
    s3TripleTracker();
    return;
  }
  if (p === 3) {
    for (let i = 0; i < 10; i++) {
      const a = aim + Math.sin(time * 2.5 + i) * 0.28;
      spawnBullet(boss.x + (i - 4.5) * 18, boss.y + 26, a, 176 + i * 12, "#ff4fcf", 5, "needle");
    }
    return;
  }
  s3HomingSpiral();
}

// ═══════════════════════════════════════════════
//  S4 専用パターン（変容・安全圏が消える）
// ═══════════════════════════════════════════════

// 遅弾と速弾の層: 安全に見えた場所が後から塞がれる
function s4SlowFastMix() {
  const count = 14;
  const base = time * 2.2;
  for (let i = 0; i < count; i++) {
    const a = base + (i / count) * TAU;
    // 偶数インデックスは遅い大玉、奇数は速い針
    if (i % 2 === 0) {
      spawnBullet(boss.x, boss.y, a, 68, "#ad5cff", 8, "orb");
    } else {
      spawnBullet(boss.x, boss.y, a + 0.16, 230, "#ff4d7e", 5, "needle");
    }
  }
}

// 外側ほど速い螺旋: 内側（近距離）が相対的に安全
function s4AccelSpiral() {
  const arms = 4;
  const base = time * 3.8;
  for (let arm = 0; arm < arms; arm++) {
    const aBase = base + arm * (TAU / arms);
    for (let i = 0; i < 4; i++) {
      const spd = 88 + i * 44;
      spawnBullet(boss.x, boss.y, aBase + i * 0.1, spd,
        arm % 2 ? "#ff8642" : "#62eaff", 6, "orb");
    }
  }
}

// 2種の弾を交互に、合計12発。速弾と遅弾の隙間で避ける
function s4SplitRing() {
  const count = 12;
  const offset = bossPhaseClock * 0.6;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + offset;
    if (i % 2 === 0) {
      spawnBullet(boss.x, boss.y, a, 70, "#ad5cff", 8, "orb");     // 遅い大玉
    } else {
      spawnBullet(boss.x, boss.y, a + Math.PI / count, 200, "#ff355e", 5, "needle"); // 速い針
    }
  }
}

function s4GravityWell() {
  const count = 9;
  const base = time * 1.8;
  for (let i = 0; i < count; i++) {
    const a = base + (i / count) * TAU;
    spawnBullet(boss.x + Math.cos(a) * 58, boss.y + Math.sin(a) * 28, a + Math.PI / 2, 96 + (i % 3) * 42, i % 2 ? "#ad5cff" : "#ff8642", 7, "orb");
  }
}

function s4ShiftAttack(p) {
  if (p === 0) {
    s4SlowFastMix();
    return;
  }
  if (p === 1) {
    for (let arm = 0; arm < 4; arm++) {
      const base = time * 3.2 + arm * TAU / 4;
      for (let i = 0; i < 3; i++) spawnBullet(boss.x, boss.y + 12, base + i * 0.12, 118 + i * 62, arm % 2 ? "#ff8642" : "#62eaff", 5, "needle");
    }
    return;
  }
  if (p === 2) {
    crossingLasers();
    return;
  }
  s4GravityWell();
  s4SplitRing();
}

function s4EnrageAttack(p) {
  if (p === 0) {
    const count = 16;
    const base = time * 4.1;
    for (let i = 0; i < count; i++) {
      const a = base + (i / count) * TAU;
      const speed = i % 2 === 0 ? 86 : 248;
      spawnBullet(boss.x, boss.y, a + (i % 2 ? 0.12 : 0), speed, i % 2 ? "#ff355e" : "#ad5cff", i % 2 ? 5 : 8, i % 2 ? "needle" : "orb");
    }
    return;
  }
  if (p === 1) {
    for (let i = -2; i <= 2; i++) {
      spawnBullet(boss.x - 92, boss.y + 22, Math.PI / 2 + i * 0.15, 230 + Math.abs(i) * 22, "#ff8642", 5, "laser");
      spawnBullet(boss.x + 92, boss.y + 22, Math.PI / 2 - i * 0.15, 230 + Math.abs(i) * 22, "#ad5cff", 5, "laser");
    }
    return;
  }
  if (p === 2) {
    s4GravityWell();
    return;
  }
  if (p === 3) {
    const count = 14;
    for (let i = 0; i < count; i++) {
      const a = bossPhaseClock * 1.2 + (i / count) * TAU;
      spawnBullet(boss.x, boss.y + 10, a, 122 + (i % 4) * 42, "#62eaff", 6, i % 2 ? "wave" : "star");
    }
    return;
  }
  s4SlowFastMix();
  crossingLasers();
}

// ═══════════════════════════════════════════════
//  S5 専用パターン（統合・侵食）
// ═══════════════════════════════════════════════

// 15発に削減、速度差で「すり抜けレーン」を作る
function s5OmniBlast() {
  const count = 15;
  const offset = time * 0.5;
  const colors = ["#ff355e", "#ad5cff", "#ffe66d", "#62eaff"];
  const speeds = [75, 135, 205];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + offset;
    const speedIndex = i % speeds.length;
    const spd = speeds[speedIndex];
    spawnBullet(boss.x, boss.y, a, spd, colors[i % 4], 6, speedIndex === 2 ? "needle" : "orb");
  }
}

// カーテンを7レーン（奇数なので中央に隙間あり）、自機狙いは3発
function s5DarkCurtain() {
  const lanes = 7;
  for (let i = 0; i < lanes; i++) {
    const x = 60 + i * ((W - 120) / (lanes - 1));
    const sway = Math.sin(time * 1.6 + i * 0.9) * 0.22;
    spawnBullet(x, boss.y + 50, Math.PI / 2 + sway, 52, i % 2 ? "#ff355e" : "#ad5cff", 8, "petal");
  }
  // 自機狙いは3発だけ（中央＋左右1発ずつ）
  const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
  for (let i = -1; i <= 1; i++) {
    spawnBullet(boss.x, boss.y + 30, aim + i * 0.18, 145, "#ffe66d", 6, "needle");
  }
}

function spawnBullet(x, y, angle, speed, color, r, kind) {
  if (enemyBullets.length >= enemyBulletLimit()) return;
  const def = currentStage();
  const rank = hyperRankMultiplier();
  const bossSpeed = phase === "boss" ? (boss.enraged ? BOSS_ENRAGE_BULLET_SPEED_MULTIPLIER : boss.shifted ? BOSS_SHIFT_BULLET_SPEED_MULTIPLIER : BOSS_BULLET_SPEED_MULTIPLIER) : 1;
  enemyBullets.push({
    x,
    y,
    vx: Math.cos(angle) * speed * def.bulletSpeed * rank * bossSpeed,
    vy: Math.sin(angle) * speed * def.bulletSpeed * rank * bossSpeed,
    r,
    color,
    kind,
    rank,
    age: 0,
    graze: false,
  });
}

function updateSpawns(dt) {
  const def = currentStage();
  if (phase === "stage") {
    updateStageSpawns();
  } else if (phase === "boss" && enemyClock > 8.0) {
    enemyClock = 0;
    const side = Math.random() > 0.5 ? -1 : 1;
    spawnEnemy(side < 0 ? -46 : W + 46, rand(360, 600), side * -rand(100, 150) * def.enemySpeed, rand(-12, 28), side, 55, "small");
  }
}

function updateStageSpawns() {
  const def = currentStage();
  const no = def.no;
  const waves = stageWaves();
  while (stageWaveIndex < waves.length && phaseTimer >= waves[stageWaveIndex].t) {
    const wave = waves[stageWaveIndex];
    if (shouldSpawnStageWave(wave)) spawnStageWave(wave);
    stageWaveIndex++;
  }

  // ランダム湧きは控えめにして、固定ウェーブの間に余白を作る
  const spawnInterval = no === 1 ? 2.45 : no === 2 ? 2.08 : no === 3 ? 2.16 : no === 4 ? 2.24 : 1.92;

  if (enemyClock > spawnInterval) {
    enemyClock = 0;

    if (no === 1) {
      const r = Math.random();
      if (r < 0.12) {
        spawnExtraEnemy(0, rand(95, W - 95), -56, rand(-28, 28) * def.enemySpeed, 120 * def.enemySpeed);
      } else if (r < 0.24) {
        const side = Math.random() > 0.5 ? -1 : 1;
        spawnExtraEnemy(1, side < 0 ? -58 : W + 58, rand(220, 660), side * -120 * def.enemySpeed, rand(-10, 28));
      } else if (r < 0.30) {
        const side = Math.random() > 0.5 ? -1 : 1;
        spawnExtraEnemy(0, rand(105, W - 105), -64, rand(-20, 20) * def.enemySpeed, 112 * def.enemySpeed);
        spawnExtraEnemy(1, side < 0 ? -62 : W + 62, rand(250, 620), side * -108 * def.enemySpeed, rand(-8, 22));
      } else if (r < 0.52) {
        spawnEnemy(rand(90, W - 90), -42, rand(-34, 34) * def.enemySpeed, rand(135, 180) * def.enemySpeed, 1, 42, "small");
      } else if (r < 0.76) {
        spawnEnemy(-42, rand(250, 720), rand(118, 170) * def.enemySpeed, rand(-8, 34), 1, 42, "small");
        spawnEnemy(W + 42, rand(250, 720), -rand(118, 170) * def.enemySpeed, rand(-8, 34), -1, 42, "small");
      } else {
        const side = Math.random() > 0.5 ? -1 : 1;
        spawnEnemy(side < 0 ? -42 : W + 42, rand(190, 760), side * -rand(140, 205) * def.enemySpeed, rand(-10, 42), side, 42, "small");
      }

    } else if (no === 2) {
      const r = Math.random();
      if (r < 0.12) {
        const side = Math.random() > 0.5 ? -1 : 1;
        spawnExtraEnemy(0, side < 0 ? -70 : W + 70, rand(170, 600), side * -250 * def.enemySpeed, rand(18, 58));
      } else if (r < 0.24) {
        spawnExtraEnemy(1, rand(100, W - 100), -64, rand(-18, 18) * def.enemySpeed, 126 * def.enemySpeed);
      } else if (r < 0.31) {
        const side = Math.random() > 0.5 ? -1 : 1;
        spawnExtraEnemy(0, side < 0 ? -72 : W + 72, rand(180, 560), side * -228 * def.enemySpeed, rand(14, 48));
        spawnExtraEnemy(1, rand(110, W - 110), -70, rand(-14, 14) * def.enemySpeed, 118 * def.enemySpeed);
      } else if (r < 0.52) {
        const side = Math.random() > 0.5 ? -1 : 1;
        spawnEnemy(side < 0 ? -42 : W + 42, rand(150, 720), side * -rand(190, 270) * def.enemySpeed, rand(-12, 34), side, 42, "small");
        spawnEnemy(side < 0 ? -58 : W + 58, rand(150, 720), side * -rand(160, 230) * def.enemySpeed, rand(20, 58), side, 42, "small");
      } else if (r < 0.76) {
        spawnEnemy(rand(90, W - 90), -42, rand(-70, 70) * def.enemySpeed, rand(190, 250) * def.enemySpeed, 1, 42, "small");
      } else {
        spawnEnemy(-42, rand(180, 670), rand(210, 280) * def.enemySpeed, rand(-14, 24), 1, 42, "small");
        spawnEnemy(W + 42, rand(180, 670), -rand(210, 280) * def.enemySpeed, rand(-14, 24), -1, 42, "small");
      }

    } else if (no === 3) {
      const r = Math.random();
      if (r < 0.12) {
        const side = Math.random() > 0.5 ? -1 : 1;
        spawnExtraEnemy(0, side < 0 ? -62 : W + 62, rand(190, 620), side * -142 * def.enemySpeed, rand(-16, 32));
      } else if (r < 0.24) {
        spawnExtraEnemy(1, rand(80, W - 80), -70, rand(-48, 48) * def.enemySpeed, 146 * def.enemySpeed);
      } else if (r < 0.31) {
        const side = Math.random() > 0.5 ? -1 : 1;
        spawnExtraEnemy(0, side < 0 ? -66 : W + 66, rand(210, 610), side * -132 * def.enemySpeed, rand(-12, 26));
        spawnExtraEnemy(1, rand(90, W - 90), -76, rand(-40, 40) * def.enemySpeed, 136 * def.enemySpeed);
      } else if (r < 0.52) {
        spawnEnemy(rand(80, W - 80), -42, rand(-34, 34) * def.enemySpeed, rand(170, 235) * def.enemySpeed, 1, 46, "small");
        spawnEnemy(rand(80, W - 80), -72, rand(-34, 34) * def.enemySpeed, rand(150, 205) * def.enemySpeed, -1, 46, "small");
      } else if (r < 0.76) {
        const y = rand(210, 680);
        spawnEnemy(-42, y, rand(165, 230) * def.enemySpeed, rand(-20, 35), 1, 46, "small");
        spawnEnemy(W + 42, y + rand(-50, 50), -rand(165, 230) * def.enemySpeed, rand(-20, 35), -1, 46, "small");
      } else {
        const side = Math.random() > 0.5 ? -1 : 1;
        spawnEnemy(side < 0 ? -42 : W + 42, rand(180, 700), side * -rand(155, 225) * def.enemySpeed, rand(-10, 48), side, 46, "small");
      }

    } else if (no === 4) {
      const r = Math.random();
      const side = Math.random() > 0.5 ? -1 : 1;
      if (r < 0.12) {
        spawnExtraEnemy(0, rand(90, W - 90), -68, rand(-34, 34) * def.enemySpeed, 104 * def.enemySpeed);
      } else if (r < 0.24) {
        spawnExtraEnemy(1, side < 0 ? -66 : W + 66, rand(210, 620), side * -150 * def.enemySpeed, rand(-8, 24));
      } else if (r < 0.31) {
        spawnExtraEnemy(0, rand(100, W - 100), -74, rand(-26, 26) * def.enemySpeed, 98 * def.enemySpeed);
        spawnExtraEnemy(1, side < 0 ? -70 : W + 70, rand(230, 610), side * -138 * def.enemySpeed, rand(-6, 20));
      } else if (r < 0.51) {
        spawnEnemy(side < 0 ? -60 : W + 60, rand(200, 600), side * -rand(100, 150) * def.enemySpeed, rand(-5, 26), side, 260, "medium");
      } else if (r < 0.76) {
        spawnEnemy(rand(75, W - 75), -42, rand(-55, 55) * def.enemySpeed, rand(185, 245) * def.enemySpeed, 1, 50, "small");
        spawnEnemy(side < 0 ? -42 : W + 42, rand(200, 700), side * -rand(175, 245) * def.enemySpeed, rand(-12, 42), side, 50, "small");
      } else {
        spawnEnemy(side < 0 ? -42 : W + 42, rand(160, 720), side * -rand(160, 230) * def.enemySpeed, rand(-10, 42), side, 50, "small");
      }

    } else {
      const r = Math.random();
      if (r < 0.12) {
        spawnExtraEnemy(0, rand(90, W - 90), -72, rand(-46, 46) * def.enemySpeed, 150 * def.enemySpeed);
      } else if (r < 0.24) {
        const side = Math.random() > 0.5 ? -1 : 1;
        spawnExtraEnemy(1, side < 0 ? -78 : W + 78, rand(190, 620), side * -118 * def.enemySpeed, rand(-8, 24));
      } else if (r < 0.32) {
        const side = Math.random() > 0.5 ? -1 : 1;
        spawnExtraEnemy(0, rand(90, W - 90), -78, rand(-38, 38) * def.enemySpeed, 136 * def.enemySpeed);
        spawnExtraEnemy(1, side < 0 ? -82 : W + 82, rand(210, 600), side * -110 * def.enemySpeed, rand(-6, 20));
      } else if (r < 0.52) {
        spawnEnemy(rand(60, W - 60), -42, rand(-48, 48) * def.enemySpeed, rand(190, 260) * def.enemySpeed, 1, 52, "small");
        spawnEnemy(rand(60, W - 60), -84, rand(-48, 48) * def.enemySpeed, rand(170, 235) * def.enemySpeed, -1, 52, "small");
      } else if (r < 0.76) {
        spawnEnemy(-42, rand(160, 700), rand(210, 285) * def.enemySpeed, rand(-16, 34), 1, 52, "small");
        spawnEnemy(W + 42, rand(160, 700), -rand(210, 285) * def.enemySpeed, rand(-16, 34), -1, 52, "small");
      } else if (r < 0.88) {
        const side = Math.random() > 0.5 ? -1 : 1;
        spawnEnemy(side < 0 ? -62 : W + 62, rand(220, 600), side * -rand(115, 160) * def.enemySpeed, rand(-6, 24), side, 260, "medium");
      } else {
        const side = Math.random() > 0.5 ? -1 : 1;
        spawnEnemy(side < 0 ? -42 : W + 42, rand(150, 700), side * -rand(220, 310) * def.enemySpeed, rand(-20, 42), side, 52, "small");
      }
    }
  }
}

function shouldSpawnStageWave(wave) {
  if (wave.type === "item" || wave.type === "midboss" || wave.type === "midboss2" || wave.type === "final") return true;
  stageCombatWaveStep++;
  return stageCombatWaveStep % 2 === 1;
}

function spawnExtraEnemy(slot, x, y, vx, vy, options = {}) {
  const def = currentStage();
  const keys = EXTRA_ENEMY_KEYS[def.no] || EXTRA_ENEMY_KEYS[1];
  const spriteKey = keys[clamp(slot, 0, keys.length - 1)];
  const extra = EXTRA_ENEMY_DEFS[spriteKey];
  const side = options.side ?? (vx < 0 ? -1 : 1);
  spawnEnemy(x, y, vx, vy, side, options.hp ?? extra.hp, "extra", spriteKey);
}

function spawnExtraWave(wave) {
  const def = currentStage();
  const no = def.no;
  const slots = wave.type === "exoticA" ? [0] : wave.type === "exoticB" ? [1] : [0, 1];
  for (const slot of slots) {
    const count = wave.type === "exoticMix" ? (no >= 5 ? 2 : 1) : no >= 4 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const spread = count <= 2 ? 170 : 130;
      const x = W / 2 + (i - (count - 1) / 2) * spread + (slot ? 34 : -34);
      const y = -72 - i * 48 - slot * 32;
      const vx = (i - (count - 1) / 2) * (slot ? 18 : -18) * def.enemySpeed;
      const vy = (112 + no * 10 + slot * 18) * def.enemySpeed;
      spawnExtraEnemy(slot, clamp(x, 62, W - 62), y, vx, vy, { side: slot ? 1 : -1 });
    }
  }
}

function spawnStageWave(wave) {
  const def = currentStage();
  const no = def.no;

  // ── item / midboss / midboss2 は全ステージ共通 ────────────
  if (wave.type === "exoticA" || wave.type === "exoticB" || wave.type === "exoticMix") {
    spawnExtraWave(wave);
    return;
  }
  if (wave.type === "midboss") {
    spawnEnemy(W / 2, -150, 0, 68 * def.enemySpeed, 1, 1750 * MIDBOSS_HP_MULTIPLIER, "midboss", def.midbossSprite);
    return;
  }
  if (wave.type === "midboss2") {
    spawnEnemy(W / 2, -160, 0, 74 * def.enemySpeed, -1, 2050 * MIDBOSS_HP_MULTIPLIER, "midboss", def.midbossAltSprite || def.midbossSprite);
    return;
  }
  if (wave.type === "item") {
    const spriteMap = { power: "carrierPower", bomb: "carrierBomb", life: "carrierLife", score: "carrierScore", hyperCharge: "carrierScore" };
    const x = wave.drop === "bomb" ? W * 0.72 : wave.drop === "life" ? W * 0.28 : W / 2;
    spawnEnemy(x, -72, rand(-32, 32), 105 * def.enemySpeed, 1, 130, "carrier", spriteMap[wave.drop], wave.drop);
    return;
  }

  // ── sweep ─────────────────────────────────────────────────
  if (wave.type === "sweep") {
    if (no === 1) {
      // S1: 横一列で素直に横断（5機、低速）
      for (let i = 0; i < 5; i++) {
        const y = 200 + i * 80;
        const x = wave.side < 0 ? -50 : W + 50;
        spawnEnemy(x, y, wave.side * -140 * def.enemySpeed, 20 * def.enemySpeed, wave.side, 46, "small", def.smallSprite);
      }
    } else if (no === 2) {
      // S2: 高速で斜めに突撃（7機、速い）
      for (let i = 0; i < 7; i++) {
        const y = 120 + i * 55;
        const x = wave.side < 0 ? -60 - i * 20 : W + 60 + i * 20;
        spawnEnemy(x, y, wave.side * -220 * def.enemySpeed, (50 + i * 8) * def.enemySpeed, wave.side, 46, "small", def.smallSprite);
      }
    } else if (no === 3) {
      // S3: 上下から挟む2列sweep（各4機）
      for (let i = 0; i < 4; i++) {
        const x = wave.side < 0 ? -50 : W + 50;
        spawnEnemy(x, 160 + i * 90, wave.side * -175 * def.enemySpeed, 30 * def.enemySpeed, wave.side, 46, "small", def.smallSprite);
        spawnEnemy(x, 180 + i * 90, wave.side * -155 * def.enemySpeed, -25 * def.enemySpeed, wave.side, 46, "small", def.smallSprite);
      }
    } else if (no === 4) {
      // S4: 大型機がゆっくり横断（中型3機）
      for (let i = 0; i < 3; i++) {
        const x = wave.side < 0 ? -70 : W + 70;
        spawnEnemy(x, 220 + i * 140, wave.side * -110 * def.enemySpeed, 15 * def.enemySpeed, wave.side, 260, "medium", def.mediumSprite);
      }
    } else {
      // S5: 高速＋縦に長い斜め列（8機）
      for (let i = 0; i < 8; i++) {
        const y = 100 + i * 72;
        const x = wave.side < 0 ? -60 - i * 30 : W + 60 + i * 30;
        spawnEnemy(x, y, wave.side * -240 * def.enemySpeed, (40 + i * 10) * def.enemySpeed, wave.side, 52, "small", def.smallSprite);
      }
    }
  }

  // ── v ─────────────────────────────────────────────────────
  if (wave.type === "v") {
    if (no === 1) {
      // S1: 緩やかなV字（7機、ゆっくり降下）
      for (let i = -3; i <= 3; i++) {
        spawnEnemy(W / 2 + i * 52, -60 - Math.abs(i) * 20, i * 18 * def.enemySpeed, 130 * def.enemySpeed, i < 0 ? -1 : 1, 46, "small", def.smallSprite);
      }
    } else if (no === 2) {
      // S2: 2重V字（内側と外側）
      for (let i = -3; i <= 3; i++) {
        spawnEnemy(W / 2 + i * 48, -60 - Math.abs(i) * 24, i * 28 * def.enemySpeed, (150 + Math.abs(i) * 8) * def.enemySpeed, i < 0 ? -1 : 1, 46, "small", def.smallSprite);
        spawnEnemy(W / 2 + i * 82, -80 - Math.abs(i) * 24, i * 22 * def.enemySpeed, (135 + Math.abs(i) * 8) * def.enemySpeed, i < 0 ? -1 : 1, 46, "small", def.smallSprite);
      }
    } else if (no === 3) {
      // S3: 包囲V字（上から9機＋横から4機）
      for (let i = -4; i <= 4; i++) {
        spawnEnemy(W / 2 + i * 42, -70 - Math.abs(i) * 26, i * 30 * def.enemySpeed, (160 + Math.abs(i) * 10) * def.enemySpeed, i < 0 ? -1 : 1, 50, "small", def.smallSprite);
      }
      for (let i = 0; i < 2; i++) {
        spawnEnemy(i === 0 ? -50 : W + 50, rand(300, 500), (i === 0 ? 1 : -1) * 160 * def.enemySpeed, 0, i === 0 ? 1 : -1, 50, "small", def.smallSprite);
      }
    } else if (no === 4) {
      // S4: 中型機のV字（5機）
      for (let i = -2; i <= 2; i++) {
        spawnEnemy(W / 2 + i * 110, -80 - Math.abs(i) * 30, i * 15 * def.enemySpeed, 88 * def.enemySpeed, i < 0 ? -1 : 1, 260, "medium", def.mediumSprite);
      }
    } else {
      // S5: 3重V字・密集（各列7機）
      for (let layer = 0; layer < 3; layer++) {
        for (let i = -3; i <= 3; i++) {
          spawnEnemy(W / 2 + i * 44, -60 - Math.abs(i) * 22 - layer * 100, i * 26 * def.enemySpeed, (155 + Math.abs(i) * 9) * def.enemySpeed, i < 0 ? -1 : 1, 52, "small", def.smallSprite);
        }
      }
    }
  }

  // ── ambush ────────────────────────────────────────────────
  if (wave.type === "ambush") {
    if (no === 1) {
      // S1: 左右から4機ずつゆっくり（計8機、低速）
      for (let i = 0; i < 4; i++) {
        spawnEnemy(-50, 280 + i * 100, 130 * def.enemySpeed, -10, 1, 38, "small", def.smallSprite);
        spawnEnemy(W + 50, 280 + i * 100, -130 * def.enemySpeed, -10, -1, 38, "small", def.smallSprite);
      }
    } else if (no === 2) {
      // S2: 左右から高速で交差・すれ違い（6機ずつ）
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? -1 : 1;
        spawnEnemy(side < 0 ? -52 : W + 52, 200 + i * 80, side * -240 * def.enemySpeed, -15, side, 38, "small", def.smallSprite);
      }
    } else if (no === 3) {
      // S3: 上下左右4方向同時出現（包囲感）
      for (let i = 0; i < 3; i++) {
        spawnEnemy(-52, 240 + i * 120, 190 * def.enemySpeed, 0, 1, 42, "small", def.smallSprite);
        spawnEnemy(W + 52, 240 + i * 120, -190 * def.enemySpeed, 0, -1, 42, "small", def.smallSprite);
        spawnEnemy(120 + i * 200, -52, 0, 190 * def.enemySpeed, 1, 42, "small", def.smallSprite);
      }
    } else if (no === 4) {
      // S4: 中型機が左右から2機ずつ＋小型6機
      for (let i = 0; i < 2; i++) {
        spawnEnemy(i === 0 ? -70 : W + 70, 320 + i * 180, (i === 0 ? 1 : -1) * 120 * def.enemySpeed, 0, i === 0 ? 1 : -1, 260, "medium", def.mediumSprite);
      }
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? -1 : 1;
        spawnEnemy(side < 0 ? -52 : W + 52, 220 + i * 90, side * -200 * def.enemySpeed, -10, side, 38, "small", def.smallSprite);
      }
    } else {
      // S5: 全方位高速包囲（10機）
      for (let i = 0; i < 5; i++) {
        spawnEnemy(-52, 180 + i * 110, 230 * def.enemySpeed, rand(-20, 20), 1, 52, "small", def.smallSprite);
        spawnEnemy(W + 52, 180 + i * 110, -230 * def.enemySpeed, rand(-20, 20), -1, 52, "small", def.smallSprite);
      }
    }
  }

  // ── medium ────────────────────────────────────────────────
  if (wave.type === "medium") {
    if (no === 1) {
      // S1: 中型1機のみ（入門）
      spawnEnemy(W / 2, -110, 0, 88 * def.enemySpeed, 1, 260, "medium", def.mediumSprite);
    } else if (no === 2) {
      // S2: 左右から2機、速めに突進
      spawnEnemy(160, -110, 18, 100 * def.enemySpeed, -1, 260, "medium", def.mediumSprite);
      spawnEnemy(W - 160, -110, -18, 100 * def.enemySpeed, 1, 260, "medium", def.mediumSprite);
    } else if (no === 3) {
      // S3: 3機が三角陣形
      spawnEnemy(W / 2, -80, 0, 92 * def.enemySpeed, 1, 260, "medium", def.mediumSprite);
      spawnEnemy(180, -160, 12, 85 * def.enemySpeed, -1, 260, "medium", def.mediumSprite);
      spawnEnemy(W - 180, -160, -12, 85 * def.enemySpeed, 1, 260, "medium", def.mediumSprite);
    } else if (no === 4) {
      // S4: 4機が横列（幅広く展開）
      for (let i = 0; i < 4; i++) {
        spawnEnemy(100 + i * 175, -110 - i * 40, (i - 1.5) * 10, 90 * def.enemySpeed, i < 2 ? -1 : 1, 260, "medium", def.mediumSprite);
      }
    } else {
      // S5: 3機三角＋小型6機随伴
      spawnEnemy(W / 2, -80, 0, 95 * def.enemySpeed, 1, 260, "medium", def.mediumSprite);
      spawnEnemy(180, -160, 14, 88 * def.enemySpeed, -1, 260, "medium", def.mediumSprite);
      spawnEnemy(W - 180, -160, -14, 88 * def.enemySpeed, 1, 260, "medium", def.mediumSprite);
      for (let i = 0; i < 6; i++) {
        spawnEnemy(80 + i * 115, -220, (i - 2.5) * 20 * def.enemySpeed, 160 * def.enemySpeed, i < 3 ? -1 : 1, 46, "small", def.smallSprite);
      }
    }
  }

  // ── cross ─────────────────────────────────────────────────
  if (wave.type === "cross") {
    if (no === 1) {
      for (let i = 0; i < 4; i++) {
        const side = i % 2 ? -1 : 1;
        spawnEnemy(side < 0 ? -48 : W + 48, 190 + i * 105, side * -165 * def.enemySpeed, (20 + i * 8) * def.enemySpeed, side, 44, "small", def.smallSprite);
      }
    } else if (no === 2) {
      for (let i = 0; i < 6; i++) {
        const y = 145 + i * 72;
        spawnEnemy(-52 - i * 12, y, (215 + i * 12) * def.enemySpeed, 34 * def.enemySpeed, 1, 46, "small", def.smallSprite);
        spawnEnemy(W + 52 + i * 12, y + 34, -(215 + i * 12) * def.enemySpeed, -18 * def.enemySpeed, -1, 46, "small", def.smallSprite);
      }
    } else if (no === 3) {
      for (let i = 0; i < 5; i++) {
        spawnEnemy(100 + i * 130, -58 - i * 24, (i - 2) * 34 * def.enemySpeed, 182 * def.enemySpeed, i < 2 ? -1 : 1, 50, "small", def.smallSprite);
      }
      for (let i = 0; i < 3; i++) {
        spawnEnemy(-52, 270 + i * 120, 205 * def.enemySpeed, -22 * def.enemySpeed, 1, 46, "small", def.smallSprite);
        spawnEnemy(W + 52, 310 + i * 120, -205 * def.enemySpeed, 22 * def.enemySpeed, -1, 46, "small", def.smallSprite);
      }
    } else if (no === 4) {
      spawnEnemy(-68, 260, 128 * def.enemySpeed, 8 * def.enemySpeed, 1, 260, "medium", def.mediumSprite);
      spawnEnemy(W + 68, 460, -128 * def.enemySpeed, -8 * def.enemySpeed, -1, 260, "medium", def.mediumSprite);
      for (let i = 0; i < 8; i++) {
        const side = i % 2 ? -1 : 1;
        spawnEnemy(side < 0 ? -52 : W + 52, 150 + i * 72, side * -230 * def.enemySpeed, (i % 2 ? -16 : 28) * def.enemySpeed, side, 50, "small", def.smallSprite);
      }
    } else {
      for (let i = 0; i < 8; i++) {
        const y = 135 + i * 76;
        spawnEnemy(-56 - i * 16, y, (245 + i * 10) * def.enemySpeed, 35 * def.enemySpeed, 1, 54, "small", def.smallSprite);
        spawnEnemy(W + 56 + i * 16, y + 38, -(245 + i * 10) * def.enemySpeed, -25 * def.enemySpeed, -1, 54, "small", def.smallSprite);
      }
      for (let i = 0; i < 4; i++) {
        spawnEnemy(120 + i * 160, -72 - i * 45, (i - 1.5) * 42 * def.enemySpeed, 210 * def.enemySpeed, i < 2 ? -1 : 1, 54, "small", def.smallSprite);
      }
    }
  }

  // ── rain ──────────────────────────────────────────────────
  if (wave.type === "rain") {
    if (no === 1) {
      for (let i = 0; i < 6; i++) {
        spawnEnemy(88 + i * 108, -55 - i * 24, (i % 2 ? 28 : -28) * def.enemySpeed, 150 * def.enemySpeed, i % 2 ? 1 : -1, 44, "small", def.smallSprite);
      }
    } else if (no === 2) {
      for (let i = 0; i < 9; i++) {
        spawnEnemy(66 + i * 74, -60 - (i % 3) * 46, (i % 2 ? 52 : -52) * def.enemySpeed, (185 + (i % 3) * 18) * def.enemySpeed, i % 2 ? 1 : -1, 46, "small", def.smallSprite);
      }
    } else if (no === 3) {
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < 7; i++) {
          spawnEnemy(70 + i * 96, -60 - row * 100, (i - 3) * 22 * def.enemySpeed, (165 + row * 30) * def.enemySpeed, i < 3 ? -1 : 1, 48, "small", def.smallSprite);
        }
      }
      spawnEnemy(-56, 410, 205 * def.enemySpeed, -18 * def.enemySpeed, 1, 48, "small", def.smallSprite);
      spawnEnemy(W + 56, 410, -205 * def.enemySpeed, -18 * def.enemySpeed, -1, 48, "small", def.smallSprite);
    } else if (no === 4) {
      for (let i = 0; i < 8; i++) {
        spawnEnemy(78 + i * 82, -62 - (i % 2) * 58, (i - 3.5) * 28 * def.enemySpeed, 198 * def.enemySpeed, i < 4 ? -1 : 1, 52, "small", def.smallSprite);
      }
      spawnEnemy(W * 0.35, -118, -10 * def.enemySpeed, 102 * def.enemySpeed, -1, 260, "medium", def.mediumSprite);
      spawnEnemy(W * 0.65, -118, 10 * def.enemySpeed, 102 * def.enemySpeed, 1, 260, "medium", def.mediumSprite);
    } else {
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < 9; i++) {
          spawnEnemy(62 + i * 75, -62 - row * 100 - (i % 2) * 24, (i - 4) * 28 * def.enemySpeed, (205 + row * 34) * def.enemySpeed, i < 4 ? -1 : 1, 56, "small", def.smallSprite);
        }
      }
      spawnEnemy(W / 2, -130, 0, 112 * def.enemySpeed, 1, 260, "medium", def.mediumSprite);
    }
  }

  // ── pincer ────────────────────────────────────────────────
  if (wave.type === "pincer") {
    if (no === 1) {
      for (let i = 0; i < 3; i++) {
        const y = 290 + i * 125;
        spawnEnemy(-50, y, 155 * def.enemySpeed, 4 * def.enemySpeed, 1, 44, "small", def.smallSprite);
        spawnEnemy(W + 50, y + 40, -155 * def.enemySpeed, -4 * def.enemySpeed, -1, 44, "small", def.smallSprite);
      }
      spawnEnemy(W / 2, -65, 0, 145 * def.enemySpeed, 1, 44, "small", def.smallSprite);
    } else if (no === 2) {
      for (let i = 0; i < 5; i++) {
        const y = 205 + i * 82;
        spawnEnemy(-52, y, 235 * def.enemySpeed, -12 * def.enemySpeed, 1, 46, "small", def.smallSprite);
        spawnEnemy(W + 52, y + 28, -235 * def.enemySpeed, 12 * def.enemySpeed, -1, 46, "small", def.smallSprite);
      }
      for (let i = 0; i < 3; i++) spawnEnemy(180 + i * 180, -62, (i - 1) * 44 * def.enemySpeed, 205 * def.enemySpeed, i < 1 ? -1 : 1, 46, "small", def.smallSprite);
    } else if (no === 3) {
      for (let i = 0; i < 4; i++) {
        spawnEnemy(-56, 210 + i * 112, 220 * def.enemySpeed, rand(-22, 22), 1, 50, "small", def.smallSprite);
        spawnEnemy(W + 56, 210 + i * 112, -220 * def.enemySpeed, rand(-22, 22), -1, 50, "small", def.smallSprite);
        spawnEnemy(140 + i * 145, -56, rand(-24, 24), 195 * def.enemySpeed, i < 2 ? -1 : 1, 50, "small", def.smallSprite);
      }
    } else if (no === 4) {
      spawnEnemy(-74, 300, 132 * def.enemySpeed, 0, 1, 260, "medium", def.mediumSprite);
      spawnEnemy(W + 74, 300, -132 * def.enemySpeed, 0, -1, 260, "medium", def.mediumSprite);
      spawnEnemy(W / 2, -105, 0, 104 * def.enemySpeed, 1, 260, "medium", def.mediumSprite);
      for (let i = 0; i < 8; i++) {
        const side = i % 2 ? -1 : 1;
        spawnEnemy(side < 0 ? -52 : W + 52, 170 + i * 72, side * -230 * def.enemySpeed, rand(-18, 26), side, 50, "small", def.smallSprite);
      }
    } else {
      for (let i = 0; i < 6; i++) {
        const y = 160 + i * 86;
        spawnEnemy(-58, y, 260 * def.enemySpeed, rand(-24, 24), 1, 56, "small", def.smallSprite);
        spawnEnemy(W + 58, y + 34, -260 * def.enemySpeed, rand(-24, 24), -1, 56, "small", def.smallSprite);
      }
      spawnEnemy(W * 0.28, -112, 18 * def.enemySpeed, 118 * def.enemySpeed, -1, 260, "medium", def.mediumSprite);
      spawnEnemy(W * 0.72, -112, -18 * def.enemySpeed, 118 * def.enemySpeed, 1, 260, "medium", def.mediumSprite);
      for (let i = 0; i < 5; i++) spawnEnemy(95 + i * 130, -65 - i * 28, (i - 2) * 40 * def.enemySpeed, 220 * def.enemySpeed, i < 2 ? -1 : 1, 56, "small", def.smallSprite);
    }
  }

  // ── final ─────────────────────────────────────────────────
  if (wave.type === "final") {
    if (no <= 2) {
      // S1・S2: 2列グリッドを薄めて、ボス前に余白を残す
      for (let ring = 0; ring < 2; ring++) {
        for (let i = 0; i < 5; i++) {
          spawnEnemy(148 + i * 105, -70 - ring * 130, (i - 2) * 14 * def.enemySpeed, (178 + ring * 18) * def.enemySpeed, i < 2 ? -1 : 1, 62, "small", def.smallSprite);
        }
      }
    } else if (no === 3) {
      // S3: 包囲環を半分に抑える
      for (let i = 0; i < 5; i++) {
        spawnEnemy(148 + i * 105, -70, (i - 2) * 14 * def.enemySpeed, 180 * def.enemySpeed, i < 2 ? -1 : 1, 62, "small", def.smallSprite);
      }
      for (let i = 0; i < 2; i++) {
        spawnEnemy(-52, 250 + i * 160, 170 * def.enemySpeed, 0, 1, 52, "small", def.smallSprite);
        spawnEnemy(W + 52, 250 + i * 160, -170 * def.enemySpeed, 0, -1, 52, "small", def.smallSprite);
      }
    } else if (no === 4) {
      // S4: 中型2機＋小型6機まで減らす
      for (let i = 0; i < 2; i++) {
        spawnEnemy(220 + i * 290, -110 - i * 70, (i - 0.5) * 12, 86 * def.enemySpeed, i === 0 ? -1 : 1, 260, "medium", def.mediumSprite);
      }
      for (let ring = 0; ring < 1; ring++) {
        for (let i = 0; i < 6; i++) {
          const x = wave.side < 0 ? -52 : W + 52;
          spawnEnemy(x, 180 + i * 90 + ring * 50, (wave.side ?? 1) * -180 * def.enemySpeed, -10, wave.side ?? 1, 46, "small", def.smallSprite);
        }
      }
    } else {
      // S5: 最終面も道中密度を抑え、2列グリッドに縮小
      for (let ring = 0; ring < 2; ring++) {
        for (let i = 0; i < 7; i++) {
          spawnEnemy(92 + i * 92, -70 - ring * 120, (i - 3) * 16 * def.enemySpeed, (185 + ring * 22) * def.enemySpeed, i < 3 ? -1 : 1, 62, "small", def.smallSprite);
        }
      }
    }
  }
}

function spawnEnemy(x, y, vx, vy, side, hp, size = "small", spriteKey = null, drop = null) {
  const def = currentStage();
  const extraDef = EXTRA_ENEMY_DEFS[spriteKey];
  const isMedium = size === "medium";
  const isMidboss = size === "midboss";
  const isCarrier = size === "carrier";
  const isExtra = size === "extra";
  const scaledHp = Math.round(hp * def.enemyHp);
  enemies.push({
    x,
    y,
    vx,
    vy,
    r: isExtra ? extraDef.r : isMidboss ? 64 : isCarrier ? 28 : isMedium ? 34 : 18,
    hp: scaledHp,
    maxHp: scaledHp,
    t: 0,
    side,
    size,
    extraKey: extraDef ? spriteKey : null,
    moveKind: extraDef ? extraDef.move : null,
    attackKind: extraDef ? extraDef.attack : null,
    spriteKey: spriteKey || (isMidboss ? def.midbossSprite : isMedium ? def.mediumSprite : def.smallSprite),
    drop,
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
    } else if (b.kind === "wave") {
      const a = Math.atan2(b.vy, b.vx) + Math.sin(b.age * 7) * 0.012;
      const speed = Math.hypot(b.vx, b.vy);
      b.vx = Math.cos(a) * speed;
      b.vy = Math.sin(a) * speed;
    } else if (b.kind === "ring") {
      b.r = Math.min(12, b.r + dt * 2.2);
    }
  });
  for (const e of enemies) {
    e.t += dt;
    e.hitFlash = Math.max(0, e.hitFlash - dt * 8);
    e.fireClock += dt;
    if (e.size === "extra") {
      const drift = e.moveKind === "float" ? 62 : e.moveKind === "coil" ? 34 : e.moveKind === "swoop" ? 82 : e.moveKind === "wraith" ? 48 : e.moveKind === "flutter" ? 70 : e.moveKind === "saw" ? 56 : 38;
      const freq = e.moveKind === "flutter" ? 5.8 : e.moveKind === "swoop" ? 4.4 : e.moveKind === "hive" ? 1.9 : 3.2;
      e.x += e.vx * dt + Math.sin(e.t * freq + e.y * 0.012) * drift * dt;
      e.y += e.vy * dt + Math.cos(e.t * (freq * 0.7)) * (e.moveKind === "walker" ? 18 : 10) * dt;
      if (e.moveKind === "node" || e.moveKind === "hive") e.vx *= 0.995;
    } else {
      e.x += e.vx * dt;
      e.y += Math.sin(e.t * (e.size === "medium" || e.size === "midboss" ? 2.4 : 5)) * (e.size === "midboss" ? 8 : e.size === "medium" ? 18 : 42) * dt + e.vy * dt;
    }
    if (e.size === "midboss" && e.y > 210) {
      e.y += (210 - e.y) * Math.min(1, dt * 2);
      e.vy *= 0.96;
    }
    const fireInterval = ((e.size === "midboss" ? 0.48 : e.size === "carrier" ? 1.7 : e.size === "medium" ? 1.0 : e.size === "extra" ? 1.02 : 1.45) * currentStage().fireRate) / hyperRankMultiplier();
    if ((phase === "stage" || phase === "boss") && e.fireClock > fireInterval && e.x > 34 && e.x < W - 34 && e.y > 44 && e.y < H - 110) fireEnemy(e);
  }
  for (const p of pickups) {
    p.magnetDelay = Math.max(0, (p.magnetDelay || 0) - dt);
    if (p.magnetDelay <= 0 && (player.laserActive || p.y > H * 0.62)) {
      const a = Math.atan2(player.y - p.y, player.x - p.x);
      p.vx = (p.vx || 0) * 0.88 + Math.cos(a) * 320 * 0.12;
      p.vy = p.vy * 0.88 + Math.sin(a) * 320 * 0.12;
    } else {
      p.vy += 55 * dt;
    }
    p.y += p.vy * dt;
    p.x += (p.vx || 0) * dt + Math.sin(time * 3 + p.y * 0.02) * 30 * dt;
  }
  decayList(explosions, dt);
  decayList(hitSparks, dt);
  decayList(beams, dt);
  decayList(shockwaves, dt);
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
      m.smoke = isLiteRender() ? 0.07 : 0.035;
      if (canAddParticle()) particles.push({ x: m.x, y: m.y, vx: rand(-25, 25) - m.vx * 0.05, vy: rand(-25, 25) - m.vy * 0.05, life: isLiteRender() ? 0.25 : 0.38, color: "#ffad45" });
    }
  }
}

function findMissileTarget(m) {
  let best = null;
  let bestD = Infinity;
  for (const e of enemies) {
    if (!e || e.dead || e.hp <= 0) continue;
    const d = dist2(m, e);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  if (phase === "boss") {
    for (const part of bossParts) {
      if (!part || part.dead || part.hp <= 0) continue;
      const d = dist2(m, part);
      if (d < bestD) {
        bestD = d;
        best = part;
      }
    }
  }
  if (phase === "boss" && boss.visible && boss.hp > 0) {
    const d = dist2(m, boss);
    if (d < bestD) best = boss;
  }
  return best;
}

function fireEnemy(e) {
  e.fireClock = 0;
  const no = currentStage().no;
  const a = Math.atan2(player.y - e.y, player.x - e.x);

  // ── キャリア: 全ステージ共通 ──────────────────────────────
  if (e.size === "carrier") {
    spawnBullet(e.x, e.y, a, 165, "#ffad45", 5, "star");
    return;
  }

  if (e.size === "extra") {
    fireExtraEnemy(e, a);
    return;
  }

  // ── ミッドボス: 案D ステージ別射撃 ───────────────────────
  if (e.size === "midboss") {
    if (no === 1) {
      // S1: 放射状2リング（控えめ、ゆっくり）
      for (let ring = 0; ring < 2; ring++) {
        for (let i = 0; i < 8; i++) {
          spawnBullet(e.x, e.y + 18, (i / 8) * TAU + time * 1.3 + ring * 0.16, 118 + ring * 48, ring ? "#ff4fcf" : "#62eaff", 6, "petal");
        }
      }
    } else if (no === 2) {
      // S2: 高速リング1種 + 自機狙い扇（速さで圧迫）
      for (let i = 0; i < 10; i++) {
        spawnBullet(e.x, e.y + 18, (i / 10) * TAU + time * 2.0, 185, "#ffe66d", 6, "ring");
      }
      for (let i = -1; i <= 1; i++) {
        spawnBullet(e.x, e.y + 18, a + i * 0.14, 210, "#ff4fcf", 5, "needle");
      }
    } else if (no === 3) {
      // S3: 自機狙い多方向（動き続けることが解答）
      for (let i = -2; i <= 2; i++) {
        spawnBullet(e.x, e.y + 18, a + i * 0.11, 190 + Math.abs(i) * 14, "#ff355e", 6, "needle");
      }
    } else if (no === 4) {
      // S4: 遅弾 + 速弾少数の混合（安全圏が消える）
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * TAU + time * 0.8;
        spawnBullet(e.x, e.y + 18, angle, 72, "#ad5cff", 8, "orb");
      }
      for (let i = -1; i <= 1; i++) {
        spawnBullet(e.x, e.y + 18, a + i * 0.2, 230, "#ff355e", 5, "needle");
      }
    } else {
      // S5: S2〜S4をランダム切り替え
      const r = Math.floor(time * 0.4) % 3;
      if (r === 0) {
        for (let i = 0; i < 10; i++) spawnBullet(e.x, e.y + 18, (i / 10) * TAU + time * 2.0, 185, "#ffe66d", 6, "ring");
        for (let i = -1; i <= 1; i++) spawnBullet(e.x, e.y + 18, a + i * 0.14, 210, "#ff4fcf", 5, "needle");
      } else if (r === 1) {
        for (let i = -2; i <= 2; i++) spawnBullet(e.x, e.y + 18, a + i * 0.11, 190 + Math.abs(i) * 14, "#ff355e", 6, "needle");
      } else {
        for (let i = 0; i < 8; i++) spawnBullet(e.x, e.y + 18, (i / 8) * TAU + time * 0.8, 72, "#ad5cff", 8, "orb");
        for (let i = -1; i <= 1; i++) spawnBullet(e.x, e.y + 18, a + i * 0.2, 230, "#ff355e", 5, "needle");
      }
    }
    return;
  }

  // ── 中型: 全ステージ共通（密度を抑えた3way）───────────────
  if (e.size === "medium") {
    for (let i = -1; i <= 1; i++) {
      spawnBullet(e.x, e.y + 10, a + i * 0.16, 175 + Math.abs(i) * 20, i % 2 ? "#ff4fcf" : "#62eaff", 6, i === 0 ? "ring" : "petal");
    }
    return;
  }

  // ── 小型: 案A ステージ別射撃スタイル ─────────────────────
  if (no === 1) {
    // S1: 自機狙い1発、遅め（素直で読める）
    spawnBullet(e.x, e.y, a, 220, "#ffad45", 5, "needle");

  } else if (no === 2) {
    // S2: 2way拡散（横断中に弾が広がる）
    spawnBullet(e.x, e.y, a - 0.16, 230, "#ff8c00", 5, "wave");
    spawnBullet(e.x, e.y, a + 0.16, 230, "#ff8c00", 5, "wave");

  } else if (no === 3) {
    // S3: 自機狙い1発（追尾圧は残しつつ密度を下げる）
    spawnBullet(e.x, e.y, a, 240, "#ff355e", 5, "needle");

  } else if (no === 4) {
    // S4: 自機狙い1発
    spawnBullet(e.x, e.y, a, 235, "#ad5cff", 5, "needle");

  } else {
    // S5: 自機狙い1発
    spawnBullet(e.x, e.y, a, 245, "#ff355e", 5, "needle");
  }
}

function fireExtraEnemy(e, aim) {
  const kind = e.attackKind;
  if (kind === "droplet") {
    for (let i = -1; i <= 1; i++) spawnBullet(e.x, e.y + 12, aim + i * 0.16, 118 + Math.abs(i) * 16, "#62eaff", 6, "petal");
    return;
  }
  if (kind === "spiral") {
    for (let i = 0; i < 6; i++) {
      const a = time * 1.8 + (i / 6) * TAU;
      spawnBullet(e.x, e.y, a, 84 + (i % 2) * 18, "#ad5cff", 7, "orb");
    }
    return;
  }
  if (kind === "fork") {
    for (let i = -2; i <= 2; i++) spawnBullet(e.x, e.y, aim + i * 0.1, 166 + Math.abs(i) * 16, i % 2 ? "#ffe66d" : "#62eaff", 5, "wave");
    return;
  }
  if (kind === "magnet") {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.sin(time) * 0.35;
      if (i % 2 === 0) spawnBullet(e.x, e.y, a, 92, "#ffe66d", 6, "ring");
    }
    spawnBullet(e.x, e.y, aim, 190, "#62eaff", 5, "needle");
    return;
  }
  if (kind === "curse") {
    for (let i = -2; i <= 2; i++) spawnBullet(e.x, e.y + 6, aim + i * 0.13, 150 + Math.abs(i) * 22, "#ff4fcf", 6, "needle");
    return;
  }
  if (kind === "crystal") {
    for (let i = -3; i <= 3; i++) spawnBullet(e.x, e.y, Math.PI / 2 + i * 0.16 + Math.sin(time) * 0.08, 132 + Math.abs(i) * 12, "#d886ff", 6, "petal");
    return;
  }
  if (kind === "web") {
    for (let i = -1; i <= 1; i++) spawnBullet(e.x, e.y + 10, aim + i * 0.2, 160, "#ff9f45", 5, "wave");
    spawnBullet(e.x, e.y, Math.PI / 2, 92, "#ad5cff", 8, "orb");
    return;
  }
  if (kind === "sawring") {
    for (let i = 0; i < 10; i += 2) spawnBullet(e.x, e.y, (i / 10) * TAU + time * 1.4, 154, "#ff8642", 5, "star");
    return;
  }
  if (kind === "halo") {
    for (let i = -2; i <= 2; i++) spawnBullet(e.x, e.y, aim + i * 0.09, 186 + Math.abs(i) * 18, i % 2 ? "#ad5cff" : "#62eaff", 5, "needle");
    for (let i = 0; i < 4; i++) spawnBullet(e.x, e.y, (i / 4) * TAU + time, 104, "#ffe66d", 6, "ring");
    return;
  }
  if (kind === "swarm") {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + time * 0.6;
      spawnBullet(e.x + Math.cos(a) * 24, e.y + Math.sin(a) * 18, a, 122, i % 2 ? "#62eaff" : "#ad5cff", 6, "orb");
    }
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
  removeWhere(bossPartBeams, (b) => b.life <= 0);
  removeWhere(bossParts, (p) => p.dead);
  removeWhere(shockwaves, (s) => s.life <= 0);
  removeWhere(particles, (p) => p.life <= 0);
  removeWhere(damageTexts, (d) => d.life <= 0);
  trimList(particles, particleLimit());
  trimList(hitSparks, Math.max(IS_MOBILE_BROWSER ? 4 : 10, Math.floor(MAX_HIT_SPARKS * perfScale())));
  trimList(explosions, phase === "bossDeath" ? (IS_MOBILE_BROWSER ? 10 : 28) : Math.max(IS_MOBILE_BROWSER ? 3 : 8, Math.floor(MAX_EXPLOSIONS * perfScale())));
  trimList(shockwaves, phase === "bossDeath" ? 10 : isVeryLiteRender() ? 4 : 8);
}

function removeWhere(list, predicate) {
  for (let i = list.length - 1; i >= 0; i--) {
    if (predicate(list[i])) list.splice(i, 1);
  }
}

function trimList(list, max) {
  if (list.length > max) list.splice(0, list.length - max);
}

function collide() {
  for (const beam of beams) {
    if (phase === "boss") {
      for (const part of bossParts) {
        if (!part || part.dead || part.hp <= 0) continue;
        if (Math.abs(beam.x - part.x) < part.r + beam.w * 0.5 && part.y < beam.y + 20) {
          damageBossPart(part, beam.damage * 0.9);
          if (Math.random() < 0.18) spawnHitSpark(beam.x + rand(-14, 14), part.y, "#bffcff", 0.62);
        }
      }
    }
    if (phase === "boss" && boss.visible && Math.abs(beam.x - boss.x) < boss.r * 0.9 && boss.y < beam.y) {
      damageBoss(beam.damage);
      addComboHits(1);
      addHyperGauge(0.62);
      if (Math.random() < 0.12) spawnHitSpark(beam.x + rand(-18, 18), boss.y + rand(-30, 30), "#bffcff", 0.6);
    }
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      if (Math.abs(beam.x - e.x) < e.r + beam.w * 0.5 && e.y < beam.y + 20) {
        e.hp -= beam.damage * (e.size === "midboss" ? 0.85 : 1.2);
        e.hitFlash = 1;
        addComboHits(1);
        addHyperGauge(e.size === "midboss" ? 1.1 : e.size === "extra" ? 0.82 : 0.68);
        if (Math.random() < 0.16) spawnHitSpark(e.x + rand(-e.r, e.r), e.y, "#bffcff", e.size === "midboss" ? 0.85 : 0.55);
        if (e.hp <= 0) killEnemy(e);
      }
    }
  }
  for (let i = playerBullets.length - 1; i >= 0; i--) {
    const b = playerBullets[i];
    if (!b) continue;
    if (phase === "boss" && hitBossPartByCircle(b, b.damage, "#8df8ff", 0.85)) {
      playerBullets.splice(i, 1);
      playSfx("hit", 0.16);
      continue;
    }
    if (phase === "boss" && boss.visible && dist2(b, boss) < (boss.r + b.r) ** 2) {
      playerBullets.splice(i, 1);
      spawnHitSpark(b.x, b.y, "#8df8ff", 0.85);
      playSfx("hit", 0.16);
      damageBoss(b.damage);
      addHyperGauge(0.42);
      continue;
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (!e || e.dead || e.hp <= 0) continue;
      if (dist2(b, e) < (e.r + b.r) ** 2) {
        e.hp -= b.damage;
        e.hitFlash = 1;
        spawnHitSpark(b.x, b.y, e.size === "medium" ? "#ffdf65" : "#8df8ff", e.size === "medium" ? 1.25 : 0.75);
        playSfx("hit", e.size === "medium" ? 0.18 : 0.12);
        addHyperGauge(e.size === "midboss" ? 0.8 : e.size === "extra" ? 0.62 : e.size === "medium" ? 0.65 : 0.42);
        playerBullets.splice(i, 1);
        if (e.hp <= 0) killEnemy(e);
        break;
      }
    }
  }
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    if (!m) continue;
    let consumed = false;
    if (phase === "boss" && hitBossPartByCircle(m, m.damage, "#ffad45", 1.15)) {
      missiles.splice(i, 1);
      playSfx("missilehit", 0.17);
      continue;
    }
    if (phase === "boss" && boss.visible && dist2(m, boss) < (boss.r + m.r) ** 2) {
      missiles.splice(i, 1);
      spawnHitSpark(m.x, m.y, "#ffad45", 1.25);
      playSfx("missilehit", 0.18);
      damageBoss(m.damage);
      addHyperGauge(1.0);
      continue;
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (!e || e.dead || e.hp <= 0) continue;
      if (dist2(m, e) < (e.r + m.r) ** 2) {
        e.hp -= m.damage;
        e.hitFlash = 1;
        spawnHitSpark(m.x, m.y, "#ffad45", 1.15);
        playSfx("missilehit", 0.17);
        addHyperGauge(e.size === "midboss" ? 1.2 : e.size === "extra" ? 1.0 : 0.8);
        missiles.splice(i, 1);
        consumed = true;
        if (e.hp <= 0) killEnemy(e);
        break;
      }
    }
    if (consumed) continue;
  }
  const hitbox = playerHitbox();
  for (const b of enemyBullets) {
    const d = Math.sqrt(dist2(b, hitbox));
    if (!b.graze && d < 32 && d > hitbox.r + b.r) {
      b.graze = true;
      player.graze++;
      addScore(240);
      if (canAddParticle()) particles.push({ x: player.x, y: player.y, vx: rand(-60, 60), vy: rand(-90, 20), life: isLiteRender() ? 0.22 : 0.35, color: "#8df8ff" });
    }
    if (player.invuln <= 0 && d < hitbox.r + b.r) {
      hitPlayer();
      break;
    }
  }
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    if ((p.magnetDelay || 0) > 0) continue;
    if (dist2(p, player) < (p.r + 18) ** 2) {
      if (p.type === "bomb") player.bombs = Math.min(4, player.bombs + 1);
      else if (p.type === "hyper") player.hyperStock = Math.min(HYPER_STOCK_MAX, player.hyperStock + 1);
      else if (p.type === "hyperCharge") addHyperGauge(96);
      else if (p.type === "life") player.lives = Math.min(9, player.lives + 1);
      else if (p.type === "score") addScore(50000);
      else player.power = Math.min(8, player.power + 1);
      addScore(p.type === "score" ? 0 : 2500);
      playSfx(p.type === "life" ? "life" : "pickup", p.type === "hyper" || p.type === "hyperCharge" ? 0.22 : 0.15);
      pickups.splice(i, 1);
    }
  }
}

function damageBoss(amount) {
  if (phase !== "boss") return;
  boss.hp = Math.max(0, boss.hp - amount);
  addScore(amount * 23);
  if (Math.random() < 0.24) spawnHitSpark(boss.x + rand(-42, 42), boss.y + rand(-38, 38), "#ffdf65", 0.9);
  if (boss.hp <= 0) {
    addComboHits(80);
    addScore(100000);
    clearStage();
  }
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  e.hp = -999;
  addScore(e.size === "midboss" ? 85000 : e.size === "extra" ? 34000 : e.size === "medium" ? 26000 : e.size === "carrier" ? 16000 : 8200);
  addComboHits(e.size === "midboss" ? 24 : e.size === "extra" ? 12 : e.size === "medium" ? 9 : 4);
  massiveExplosion(e.x, e.y, e.size === "midboss" ? 1.4 : e.size === "extra" ? 0.9 : e.size === "medium" ? 0.95 : 0.5);
  playSfx("explode", e.size === "midboss" ? 0.34 : e.size === "extra" ? 0.3 : e.size === "medium" ? 0.3 : 0.22);
  if (e.drop) scatterPickups(e.x, e.y, e.drop, 1);
  if (e.size === "midboss") scatterPickups(e.x, e.y, "hyperCharge", 1);
  if (e.size === "extra" && Math.random() < 0.35) scatterPickups(e.x, e.y, "hyperCharge", 1, { speedMultiplier: 0.7, magnetDelay: 0.35 });

  // 案B: ステージ別 死亡時ばらまき（小型のみ）
  if (e.size === "small") {
    const no = currentStage().no;
    const a = Math.atan2(player.y - e.y, player.x - e.x);
    if (no === 2) {
      // S2: ランダム1発ばらまき
      spawnBullet(e.x, e.y, rand(0, TAU), rand(80, 140), "#ff8c00", 6, "orb");
    } else if (no === 3) {
      // S3: 自機方向に1発（倒しても追ってくる）
      spawnBullet(e.x, e.y, a, 180, "#ff355e", 6, "needle");
    } else if (no === 4) {
      // S4: 2方向放出
      for (let i = 0; i < 2; i++) {
        spawnBullet(e.x, e.y, (i / 2) * TAU, 120, "#ad5cff", 6, "orb");
      }
    } else if (no === 5) {
      // S5: S2〜S4のランダム混合
      const r = Math.floor(Math.random() * 3);
      if (r === 0) {
        spawnBullet(e.x, e.y, rand(0, TAU), rand(80, 140), "#ff8c00", 6, "orb");
      } else if (r === 1) {
        spawnBullet(e.x, e.y, a, 180, "#ff355e", 6, "needle");
      } else {
        for (let i = 0; i < 2; i++) spawnBullet(e.x, e.y, (i / 2) * TAU, 120, "#ad5cff", 6, "orb");
      }
    }
    // S1は何も出ない（現状通り）
  }
}

function scatterPickups(x, y, type, count, options = {}) {
  const speedMultiplier = options.speedMultiplier || 1;
  const magnetDelay = options.magnetDelay ?? 0.45;
  for (let i = 0; i < count; i++) {
    if (type === "life" && lifePickupsThisStage >= 1) return;
    if (type === "life") lifePickupsThisStage++;
    const a = (i / count) * TAU - Math.PI / 2 + (options.angleOffset || 0);
    pickups.push({
      x,
      y,
      vx: Math.cos(a) * rand(55, 170) * speedMultiplier,
      vy: Math.sin(a) * rand(50, 150) * speedMultiplier - (options.upwardBoost ?? 30),
      r: type === "life" ? 12 : 9,
      type,
      magnetDelay,
    });
  }
}

function spawnHyperPickup() {
  pickups.push({
    x: W / 2,
    y: HYPER_ITEM_DROP_Y,
    vx: rand(-36, 36),
    vy: 72,
    r: 13,
    type: "hyper",
    magnetDelay: 0.2,
  });
  spawnHitSpark(W / 2, HYPER_ITEM_DROP_Y, "#b46cff", 1.6);
  playSfx("life", 0.24);
}

function spawnHitSpark(x, y, color = "#8df8ff", scale = 1) {
  const now = performance.now() / 1000;
  if (IS_MOBILE_BROWSER || perfMode > 0) {
    const minGap = perfMode >= 2 ? 0.07 : 0.045;
    if (now - lastHitSparkAt < minGap) return;
    if (hitSparks.length >= (perfMode >= 2 ? 6 : 9)) return;
    lastHitSparkAt = now;
  }
  hitSparks.push({ x, y, life: (isLiteRender() ? 0.11 : 0.18) * scale, max: (isLiteRender() ? 0.11 : 0.18) * scale, scale, color });
  const baseCount = IS_MOBILE_BROWSER || perfMode > 0 ? 1.4 : 6;
  const count = Math.max(IS_MOBILE_BROWSER || perfMode > 0 ? 0 : 1, Math.floor(baseCount * scale * perfScale()));
  for (let i = 0; i < count && canAddParticle(); i++) {
    const a = rand(0, TAU);
    const s = rand(35, 150) * scale;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: isLiteRender() ? rand(0.08, 0.16) : rand(0.16, 0.34), color });
  }
}

function hitPlayer() {
  player.lives--;
  const lostPower = Math.min(player.power, 3);
  player.power = Math.max(0, player.power - 3);
  player.invuln = 2.4;
  player.chain = 0;
  player.comboTimer = 0;
  shake = 22;
  flash = 0.95;
  massiveExplosion(player.x, player.y, 1.15);
  shockwaves.push({ x: player.x, y: player.y, life: 0.7, max: 0.7, radius: 22, color: "#ff5f91" });
  playSfx("playerhit", 0.42);
  scatterPickups(player.x, player.y, "power", lostPower + 3, {
    speedMultiplier: 2.25,
    magnetDelay: 1.35,
    upwardBoost: 90,
    angleOffset: Math.PI / 7,
  });
  enemyBullets.length = Math.floor(enemyBullets.length * 0.42);
  if (player.lives <= 0) {
    phase = "gameover";
    phaseTimer = 0;
    gameOverClock = 0;
    player.invuln = 999;
    player.hyperTime = 0;
    player.hyperLevel = 0;
    stopHyperLoopSe();
    fadeOutBgm(2.4);
  }
}

function showGameOverOverlay() {
  running = false;
  overlay.querySelector("h1").textContent = "MISSION LOST";
  overlay.querySelector("p").textContent = `SCORE ${formatScore(player.score)}`;
  startButton.textContent = "RETRY";
  overlay.classList.remove("hidden");
}

function useBombButton() {
  if (player.hyperStock > 0) {
    useHyper();
    return;
  }
  useBomb();
}

function useHyper() {
  if (!running || player.hyperStock <= 0 || phase === "gameover" || phase === "credits") return;
  const spent = player.hyperStock;
  player.hyperStock = 0;
  player.hyperLevel = spent;
  player.hyperTime = HYPER_DURATION;
  player.invuln = Math.max(player.invuln, phase === "boss" ? 120 / 60 : 80 / 60);
  flash = 0.72;
  shake = 14 + spent * 2;
  playHyperStartSe();
  const removed = enemyBullets.splice(0, enemyBullets.length);
  const burstStep = isLiteRender() ? 6 : 3;
  for (let i = 0; i < removed.length && canAddParticle(); i += burstStep) {
    particles.push({ x: removed[i].x, y: removed[i].y, vx: rand(-210, 210), vy: rand(-250, 100), life: rand(0.3, 0.72), color: i % 2 ? "#b46cff" : "#8df8ff" });
  }
  hyperSurgeEffect(spent);
}

function hyperSurgeEffect(level) {
  shockwaves.push({ x: player.x, y: player.y, life: 0.72, max: 0.72, radius: 18, color: "#d7b7ff" });
  shockwaves.push({ x: player.x, y: player.y, life: 1.05, max: 1.05, radius: 44, color: "#ffe66d" });
  shockwaves.push({ x: player.x, y: player.y, life: 1.28, max: 1.28, radius: 8, color: "#8df8ff" });
  const count = Math.floor((54 + level * 10) * perfScale());
  for (let i = 0; i < count && canAddParticle(); i++) {
    const a = (i / count) * TAU + rand(-0.08, 0.08);
    const speed = rand(120, 330) * (i % 3 === 0 ? 1.25 : 1);
    const color = i % 4 === 0 ? "#ffe66d" : i % 4 === 1 ? "#d7b7ff" : i % 4 === 2 ? "#8df8ff" : "#b46cff";
    particles.push({
      x: player.x + Math.cos(a) * rand(8, 34),
      y: player.y + Math.sin(a) * rand(8, 34),
      vx: Math.cos(a + Math.PI * 0.5) * speed * 0.35 + Math.cos(a) * speed,
      vy: Math.sin(a + Math.PI * 0.5) * speed * 0.35 + Math.sin(a) * speed,
      life: rand(0.45, 1.05),
      color,
    });
  }
}

function useBomb() {
  if (!running || player.bombs <= 0 || phase === "gameover" || phase === "credits") return;
  player.bombs--;
  player.invuln = 1.4;
  flash = 1.2;
  shake = 30;
  playSfx("bomb", 0.5);
  shockwaves.push({ x: player.x, y: player.y, life: 0.95, max: 0.95, radius: 35, color: "#8df8ff" });
  shockwaves.push({ x: player.x, y: player.y, life: 1.25, max: 1.25, radius: 10, color: "#ff5bd8" });
  massiveExplosion(player.x, player.y - 120, 2.4);
  const removed = enemyBullets.splice(0, enemyBullets.length);
  for (let i = 0; i < removed.length && canAddParticle(); i += isLiteRender() ? 8 : 5) {
    particles.push({ x: removed[i].x, y: removed[i].y, vx: rand(-150, 150), vy: rand(-180, 80), life: rand(0.35, 0.8), color: removed[i].color });
  }
  if (phase === "boss") {
    boss.hp = Math.max(0, boss.hp - 560);
    massiveExplosion(boss.x, boss.y, 1.8);
    for (const part of bossParts) damageBossPart(part, 420);
    if (boss.hp <= 0) clearStage();
  }
  for (const e of enemies) {
    e.hp -= e.size === "midboss" ? 260 : 999;
    e.hitFlash = 1;
    if (e.hp <= 0) killEnemy(e);
  }
}

function massiveExplosion(x, y, scale = 1) {
  const now = performance.now() / 1000;
  if ((IS_MOBILE_BROWSER || perfMode > 0) && now - lastExplosionAt < (perfMode >= 2 ? 0.11 : 0.07)) {
    scale *= 0.75;
  }
  lastExplosionAt = now;
  explosions.push({ x, y, life: (isLiteRender() ? 0.38 : 0.7) * scale, max: (isLiteRender() ? 0.38 : 0.7) * scale, scale });
  const baseCount = IS_MOBILE_BROWSER || perfMode > 0 ? 5 : 34;
  const count = Math.max(isLiteRender() ? 1 : 5, Math.floor(baseCount * scale * perfScale()));
  for (let i = 0; i < count && canAddParticle(); i++) {
    const a = rand(0, TAU);
    const s = rand(50, 260) * scale;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: isLiteRender() ? rand(0.18, 0.36) : rand(0.3, 0.9), color: Math.random() > 0.45 ? "#ff7c33" : "#7df4ff" });
  }
}

function bossExplosionBurst(x, y, scale = 1, intensity = 1) {
  const frame = Math.floor(rand(0, 4));
  explosions.push({ x, y, life: 0.72 * scale, max: 0.72 * scale, scale: scale * 1.45, bossArt: true, frame, rot: rand(-0.55, 0.55) });
  explosions.push({ x, y, life: 0.62 * scale, max: 0.62 * scale, scale });
  if (scale > 1.2) {
    shockwaves.push({ x, y, life: 0.62 + scale * 0.16, max: 0.62 + scale * 0.16, radius: 14 + scale * 8, color: scale > 2 ? "#fff2a8" : "#ff9a42" });
  }
  const cap = IS_MOBILE_BROWSER ? 18 : 42;
  const count = Math.min(cap, Math.max(5, Math.floor(18 * scale * intensity * perfScale())));
  for (let i = 0; i < count && canAddParticle(); i++) {
    const a = rand(0, TAU);
    const s = rand(80, 360) * scale;
    const hot = Math.random() > 0.34;
    particles.push({
      x: x + Math.cos(a) * rand(0, 18) * scale,
      y: y + Math.sin(a) * rand(0, 14) * scale,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - rand(10, 85) * scale,
      life: rand(0.28, 0.85) * (isLiteRender() ? 0.68 : 1),
      color: hot ? "#ffb23f" : Math.random() > 0.5 ? "#fff2a8" : "#7df4ff",
    });
  }
}

function render() {
  ctx.save();
  if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
  drawBackground();
  if (currentStage().no === 1) drawStructures();
  if ((phase === "boss" || phase === "bossDeath") && boss.visible) drawBoss();
  if (phase === "boss") drawBossParts();
  drawEnemies();
  drawPickups();
  drawPlayerBullets();
  drawBeams();
  drawBossPartBeams();
  drawEnemyBullets();
  drawPlayer();
  drawEffects();
  ctx.restore();
  if (phase !== "credits") drawHud();
  drawTouchControls();
  drawPhaseText();
  if (phase === "gameover") drawGameOverEffect();
  if (phase === "credits") drawCredits();
  if (paused) drawPause();
  if (flash > 0) {
    ctx.fillStyle = `rgba(160, 240, 255, ${flash * 0.22})`;
    ctx.fillRect(0, 0, W, H);
  }
  drawStageFade();
}

function drawBackground() {
  const def = currentStage();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#05051a");
  g.addColorStop(0.45, "#071936");
  g.addColorStop(1, "#020712");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const bgSheet = def.bg.sheet === "stage5" ? stage5AssetSheet : stageBackgroundSheet;
  if (bgSheet.complete && bgSheet.naturalWidth) {
    const tileH = H + 32;
    const rawScroll = phase === "stage" || phase === "silence" ? stageScroll * 0.2 : time * 5;
    const offset = rawScroll % tileH;
    const baseTile = Math.floor(rawScroll / tileH);
    const sx = def.bg.sx + (def.bg.sheet === "stage5" ? 0 : 12);
    const sy = def.bg.sy + (def.bg.sheet === "stage5" ? 0 : 12);
    const sw = def.bg.sw || 603;
    const sh = def.bg.sh || 603;
    ctx.save();
    ctx.globalAlpha = def.no === 1 ? 0.52 : def.no === 5 ? 0.82 : 0.74;
    for (let i = -1; i <= 1; i++) {
      const y = offset + i * tileH - tileH;
      const flip = Math.abs(baseTile + i) % 2 === 1;
      if (flip) {
        ctx.save();
        ctx.translate(0, y + tileH);
        ctx.scale(1, -1);
        ctx.drawImage(bgSheet, sx, sy, sw, sh, 0, 0, W, tileH);
        ctx.restore();
      } else {
        ctx.drawImage(bgSheet, sx, sy, sw, sh, 0, y, W, tileH);
      }
    }
    ctx.restore();
    const veil = ctx.createLinearGradient(0, 0, 0, H);
    veil.addColorStop(0, "rgba(3, 5, 18, 0.34)");
    veil.addColorStop(0.48, "rgba(0, 0, 0, 0.05)");
    veil.addColorStop(1, "rgba(1, 5, 14, 0.55)");
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, W, H);
  }

  if (!isLiteRender()) {
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
  }

  for (const s of stars) {
    ctx.fillStyle = s.c;
    ctx.globalAlpha = 0.35 + s.z * 0.45;
    ctx.fillRect(s.x, s.y, s.z * 1.5, s.z * 1.5);
  }
  ctx.globalAlpha = 1;
}

function drawStageFade() {
  let alpha = stageFade;
  if (phase === "stageTransition") alpha = clamp(phaseTimer / 0.85, 0, 1);
  if (alpha <= 0) return;
  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${clamp(alpha, 0, 1)})`;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawStructures() {
  if (isVeryLiteRender()) return;
  const loop = H + 360;
  const offset = phase === "stage" ? stageScroll % loop : 0;
  for (let lane = -1; lane <= 1; lane++) {
    const y = lane * loop + offset;
    drawStation(-90, 110 + y, 0.72);
    drawStation(W + 90, 130 + y, -0.72);
    drawColonyProp(colonySprites.dock, W - 82, 510 + y, 176, 118, -0.08, true);
    drawColonyProp(colonySprites.turret, 86, 600 + y, 132, 172, 0.06, true);
    drawColonyProp(colonySprites.ring, W / 2, 890 + y, 250, 120, 0.03, true, 0.58);
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

function drawColonyProp(s, x, y, w, h, rotation = 0, centered = false, alpha = 0.9) {
  if (!colonySheet.complete || !colonySheet.naturalWidth) {
    drawPlatform(x, y, 1);
    return;
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.shadowColor = "#4fdfff";
  ctx.shadowBlur = isLiteRender() ? 0 : 8;
  const dx = centered ? -w / 2 : 0;
  const dy = centered ? -h / 2 : 0;
  ctx.drawImage(colonySheet, s.sx, s.sy, s.sw, s.sh, dx, dy, w, h);
  ctx.restore();
}

function drawBoss() {
  const def = currentStage();
  const sprite = sprites[def.bossSprite] || stageAssetSprites[def.bossSprite] || stage5AssetSprites[def.bossSprite];
  const sheet = sprites[def.bossSprite] ? spriteSheet : stageAssetSprites[def.bossSprite] ? stageSpriteSheet : stage5AssetSheet;
  if (sheet.complete && sheet.naturalWidth && sprite) {
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.scale(1 + Math.sin(boss.corePulse * 8) * 0.025, 1 + Math.sin(boss.corePulse * 8) * 0.025);
    drawSpriteFrom(sheet, sprite, 0, 0, def.bossW, def.bossH, 0, true);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(boss.x, boss.y);
  const pulse = 1 + Math.sin(boss.corePulse * 8) * 0.045;
  ctx.scale(pulse, pulse);
  ctx.shadowColor = "#ff5bc8";
  ctx.shadowBlur = isLiteRender() ? 6 : 28;
  const spikeCount = isLiteRender() ? 10 : 18;
  for (let i = 0; i < spikeCount; i++) {
    const a = (i / spikeCount) * TAU + Math.sin(time * 1.6) * 0.2;
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
  ctx.shadowBlur = isLiteRender() ? 6 : 25;
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
    const extraDef = EXTRA_ENEMY_DEFS[e.spriteKey];
    const extraSprite = EXTRA_ENEMY_SPRITES[e.spriteKey];
    if (extraDef && extraSprite && stageExtraEnemySheet.complete && stageExtraEnemySheet.naturalWidth) {
      const cellW = Math.floor(stageExtraEnemySheet.naturalWidth / 5);
      const cellH = Math.floor(stageExtraEnemySheet.naturalHeight / 2);
      const w = extraDef.w;
      const h = extraDef.h;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(e.side < 0 ? -1 : 1, 1);
      const rot = e.moveKind === "saw" ? e.t * 2.2 : e.moveKind === "flutter" ? Math.sin(e.t * 7) * 0.12 : Math.sin(e.t * 4) * 0.06;
      ctx.shadowColor = e.hitFlash > 0 ? "#fff2a8" : extraDef.stage >= 5 ? "#ad5cff" : extraDef.stage >= 4 ? "#ff9f45" : extraDef.stage >= 3 ? "#ff4fcf" : "#62eaff";
      ctx.shadowBlur = isLiteRender() ? 6 : 18;
      drawSpriteFrom(stageExtraEnemySheet, {
        sx: extraSprite.col * cellW,
        sy: extraSprite.row * cellH,
        sw: cellW,
        sh: cellH,
      }, 0, 0, w, h, rot, true);
      if (e.hitFlash > 0) {
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = e.hitFlash * 0.7;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.4, h * 0.34, 0, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      drawBar(-w * 0.34, h * 0.45 + 8, w * 0.68, 5, e.hp / e.maxHp, "#ff713d", "#b46cff");
      ctx.restore();
      continue;
    }
    const sprite = sprites[e.spriteKey] || stageAssetSprites[e.spriteKey] || stage5AssetSprites[e.spriteKey] || midbossItemSprites[e.spriteKey];
    const sheet = sprites[e.spriteKey] ? spriteSheet : stageAssetSprites[e.spriteKey] ? stageSpriteSheet : stage5AssetSprites[e.spriteKey] ? stage5AssetSheet : midbossItemSheet;
    if (sheet.complete && sheet.naturalWidth && sprite) {
      const w = e.size === "midboss" ? 238 : e.size === "carrier" ? 92 : e.size === "medium" ? 138 : 88;
      const h = e.size === "midboss" ? 244 : e.size === "carrier" ? 92 : e.size === "medium" ? 116 : 78;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(e.side < 0 ? -1 : 1, 1);
      drawSpriteFrom(sheet, sprite, 0, 0, w, h, Math.sin(e.t * 5) * 0.08, true);
      if (e.hitFlash > 0) {
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = e.hitFlash * 0.72;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.42, h * 0.36, 0, 0, TAU);
        ctx.fill();
      }
      if (e.size === "medium" || e.size === "midboss") {
        ctx.globalCompositeOperation = "source-over";
        drawBar(-w * 0.36, h * 0.5 + 8, w * 0.72, 6, e.hp / e.maxHp, "#ff713d", "#7df4ff");
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

function drawHyperAura() {
  if (player.hyperTime <= 0) return;
  if (isVeryLiteRender()) return;
  const pulse = 0.5 + Math.sin(time * 10) * 0.5;
  const remain = clamp(player.hyperTime / HYPER_DURATION, 0, 1);
  ctx.save();
  if (!isLiteRender()) ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.35 + pulse * 0.25;
  ctx.shadowColor = "#ffe66d";
  ctx.shadowBlur = isLiteRender() ? 8 + pulse * 4 : 28 + pulse * 16;
  ctx.strokeStyle = "rgba(255, 230, 109, 0.78)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 38 + pulse * 8, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 0.22 + remain * 0.18;
  ctx.strokeStyle = "rgba(180, 108, 255, 0.9)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 24 + pulse * 4, 58 + pulse * 8, time * 1.8, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, 58 + pulse * 6, 24 + pulse * 4, -time * 1.5, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawBossParts() {
  if (!bossPartSheet.complete || !bossPartSheet.naturalWidth) {
    drawBossPartFallbacks();
    return;
  }
  const cols = 4;
  const rows = 3;
  const cellW = bossPartSheet.naturalWidth / cols;
  const cellH = bossPartSheet.naturalHeight / rows;
  for (const part of bossParts) {
    if (!part || part.dead || part.hp <= 0) continue;
    const col = part.sprite % cols;
    const row = Math.floor(part.sprite / cols);
    ctx.save();
    ctx.translate(part.x, part.y);
    const a = part.state === "charging" ? Math.atan2(part.vy, part.vx) + Math.PI / 2 : Math.sin(time * 1.8 + part.phaseOffset) * 0.06;
    ctx.rotate(a);
    ctx.shadowColor = part.hitFlash > 0 ? "#fff2a8" : part.attack === "beam" ? "#62eaff" : part.attack === "ram" ? "#ff4fcf" : "#ffe66d";
    ctx.shadowBlur = isLiteRender() ? 7 : 22;
    if (part.hitFlash > 0) ctx.globalAlpha = 0.68 + Math.sin(time * 80) * 0.18;
    ctx.drawImage(bossPartSheet, col * cellW, row * cellH, cellW, cellH, -part.w / 2, -part.h / 2, part.w, part.h);
    ctx.restore();

    ctx.save();
    const barW = part.w * 0.72;
    drawBar(part.x - barW / 2, part.y + part.h * 0.48, barW, 5, part.hp / part.maxHp, "#ff713d", "#b46cff");
    ctx.restore();
  }
}

function drawBossPartFallbacks() {
  for (const part of bossParts) {
    if (!part || part.dead || part.hp <= 0) continue;
    ctx.save();
    ctx.translate(part.x, part.y);
    ctx.shadowColor = "#62eaff";
    ctx.shadowBlur = isLiteRender() ? 6 : 18;
    ctx.fillStyle = part.hitFlash > 0 ? "#fff2a8" : "#2b3846";
    ctx.strokeStyle = "#8df8ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-part.w / 2, -part.h / 2, part.w, part.h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawBossPartBeams() {
  if (!bossPartBeams.length) return;
  ctx.save();
  if (!isVeryLiteRender()) ctx.globalCompositeOperation = "screen";
  for (const beam of bossPartBeams) {
    const warmRatio = clamp(beam.age / beam.warm, 0, 1);
    const active = beam.age >= beam.warm;
    const x2 = beam.x + Math.cos(beam.angle) * beam.length;
    const y2 = beam.y + Math.sin(beam.angle) * beam.length;
    ctx.globalAlpha = active ? clamp(beam.life / Math.max(0.001, beam.max - beam.warm), 0.25, 0.95) : 0.25 + warmRatio * 0.34;
    ctx.strokeStyle = active ? beam.color : "rgba(255, 238, 120, 0.72)";
    ctx.shadowColor = active ? beam.color : "#ffe66d";
    ctx.shadowBlur = isLiteRender() ? 8 : active ? 30 : 16;
    ctx.lineWidth = active ? beam.width : 3 + warmRatio * 5;
    ctx.beginPath();
    ctx.moveTo(beam.x, beam.y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    if (active && !isLiteRender()) {
      ctx.globalAlpha *= 0.55;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = Math.max(3, beam.width * 0.28);
      ctx.beginPath();
      ctx.moveTo(beam.x, beam.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPlayer() {
  if (spriteSheet.complete && spriteSheet.naturalWidth) {
    ctx.save();
    ctx.translate(player.x, player.y);
    if (player.invuln > 0 && Math.floor(time * 18) % 2 === 0) ctx.globalAlpha = 0.5;
    drawHyperAura();
    ctx.shadowColor = "#62f0ff";
    ctx.shadowBlur = isLiteRender() ? 6 : 22;
    drawSprite(sprites.player, 0, 0, 76, 104, 0, true);
    ctx.shadowBlur = 0;
    if (player.laserActive) {
      ctx.strokeStyle = "rgba(255, 87, 217, 0.86)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(PLAYER_HITBOX_OFFSET_X, PLAYER_HITBOX_OFFSET_Y, 28, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = "#ff4ddb";
    ctx.beginPath();
    ctx.arc(PLAYER_HITBOX_OFFSET_X, PLAYER_HITBOX_OFFSET_Y, player.r, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.invuln > 0 && Math.floor(time * 18) % 2 === 0) ctx.globalAlpha = 0.45;
  drawHyperAura();
  ctx.shadowColor = "#62f0ff";
  ctx.shadowBlur = isLiteRender() ? 5 : 20;
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
  if (player.laserActive) {
    ctx.strokeStyle = "rgba(255, 87, 217, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(PLAYER_HITBOX_OFFSET_X, PLAYER_HITBOX_OFFSET_Y, 26, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = "#ff4ddb";
  ctx.beginPath();
  ctx.arc(PLAYER_HITBOX_OFFSET_X, PLAYER_HITBOX_OFFSET_Y, player.r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawPlayerBullets() {
  ctx.save();
  const hyper = player.hyperTime > 0;
  ctx.shadowColor = hyper ? "#ffe66d" : "#5ff2ff";
  ctx.shadowBlur = isLiteRender() ? (hyper ? 8 : 4) : hyper ? 26 : 14;
  if (hyper && !isVeryLiteRender()) ctx.globalCompositeOperation = "screen";
  for (const b of playerBullets) {
    ctx.fillStyle = hyper ? "#fff8ba" : "#bdfcff";
    ctx.fillRect(b.x - (hyper ? 3 : 2), b.y - 14, hyper ? 6 : 4, 22);
    ctx.fillStyle = hyper ? "#ffb21f" : "#3aa5ff";
    ctx.fillRect(b.x - (hyper ? 2 : 1), b.y - 22, hyper ? 4 : 2, 14);
    if (hyper) {
      ctx.fillStyle = "rgba(255, 235, 80, 0.36)";
      ctx.fillRect(b.x - 7, b.y - 18, 14, 26);
    }
  }
  ctx.restore();

  ctx.save();
  for (const m of missiles) {
    const a = Math.atan2(m.vy, m.vx) + Math.PI / 2;
    ctx.translate(m.x, m.y);
    ctx.rotate(a);
    ctx.shadowColor = hyper ? "#ffe66d" : "#ffad45";
    ctx.shadowBlur = isLiteRender() ? 4 : hyper ? 28 : 18;
    if (hyper && !isVeryLiteRender()) ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = hyper ? "#fff3a4" : "#f7fbff";
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hyper ? "#ffd22f" : "#ff7b2e";
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
  if (!isVeryLiteRender()) ctx.globalCompositeOperation = "screen";
  const hyper = player.hyperTime > 0;
  for (const b of beams) {
    ctx.globalAlpha = clamp(b.life / (b.max || 0.1), 0, 1);
    if (isLiteRender()) {
      ctx.strokeStyle = hyper ? "rgba(255, 226, 70, 0.86)" : "rgba(160, 246, 255, 0.78)";
      ctx.shadowBlur = isVeryLiteRender() ? 0 : hyper ? 12 : 7;
      ctx.shadowColor = hyper ? "#ffe66d" : "#8df8ff";
      ctx.lineWidth = hyper ? b.w * 1.05 : b.w * 0.9;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x, 0);
      ctx.stroke();
      continue;
    }
    const g = ctx.createLinearGradient(b.x, 0, b.x, b.y);
    if (hyper) {
      g.addColorStop(0, "rgba(255, 238, 64, 0)");
      g.addColorStop(0.42, "rgba(255, 205, 38, 0.82)");
      g.addColorStop(0.72, "rgba(255, 111, 33, 0.7)");
      g.addColorStop(1, "rgba(255, 255, 210, 1)");
    } else {
      g.addColorStop(0, "rgba(111, 240, 255, 0)");
      g.addColorStop(0.55, "rgba(255, 72, 220, 0.55)");
      g.addColorStop(1, "rgba(210, 255, 255, 0.95)");
    }
    ctx.strokeStyle = g;
    ctx.shadowColor = hyper ? "#ffe66d" : "#8df8ff";
    ctx.shadowBlur = hyper ? 42 : 24;
    ctx.lineWidth = hyper ? b.w * 1.35 : b.w;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + Math.sin(time * 30) * 6, 0);
    ctx.stroke();
    ctx.strokeStyle = hyper ? "rgba(255,255,235,1)" : "rgba(255,255,255,0.9)";
    ctx.lineWidth = Math.max(2, b.w * (hyper ? 0.48 : 0.34));
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + Math.sin(time * 42) * 3, 0);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawEnemyBullets() {
  ctx.save();
  const bulletGlow = isVeryLiteRender() ? 0 : isLiteRender() || phase === "boss" ? 5 : 12;
  for (const b of enemyBullets) {
    ctx.shadowColor = b.color;
    ctx.shadowBlur = bulletGlow;
    ctx.fillStyle = b.color;
    if (b.kind === "ring") {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.lineWidth = 3;
      ctx.strokeStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 1.55, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.36, 0, TAU);
      ctx.fill();
      ctx.restore();
      continue;
    }
    if (b.kind === "laser") {
      const a = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(a);
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = b.color;
      ctx.fillRect(-18, -b.r * 0.8, 42, b.r * 1.6);
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.fillRect(-12, -1.5, 26, 3);
      ctx.restore();
      continue;
    }
    if (b.kind === "star") {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.age * 6);
      ctx.globalCompositeOperation = "screen";
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? b.r * 0.7 : b.r * 1.75;
        const a = i * TAU / 10 - Math.PI / 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      continue;
    }
    if (b.kind === "wave") {
      const a = Math.atan2(b.vy, b.vx) + Math.PI / 2;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(a + Math.sin(b.age * 9) * 0.35);
      ctx.globalCompositeOperation = "screen";
      ctx.beginPath();
      ctx.ellipse(0, 0, b.r * 1.65, b.r * 3.05, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.72)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, b.r * 0.85, b.r * 2.2, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
      continue;
    }
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
    const sprite = itemSprites[p.type] || itemSprites.power;
    ctx.save();
    ctx.translate(p.x, p.y);
    const color = p.type === "hyper" || p.type === "hyperCharge" ? "#b46cff" : p.type === "bomb" ? "#ff9b32" : p.type === "life" ? "#ff5f82" : p.type === "score" ? "#ffe66d" : "#69f6ff";
    ctx.shadowColor = color;
    ctx.shadowBlur = isLiteRender() ? 6 : 18;
    if (p.type === "hyper" && hyperStockImage.complete && hyperStockImage.naturalWidth) {
      ctx.rotate(Math.sin(time * 2.4) * 0.08);
      ctx.shadowColor = "#ffe66d";
      ctx.shadowBlur = isLiteRender() ? 8 : 24;
      ctx.drawImage(hyperStockImage, 150, 150, 960, 960, -32, -32, 64, 64);
      ctx.restore();
      continue;
    }
    if (p.type === "hyperCharge" && hyperChargeImage.complete && hyperChargeImage.naturalWidth) {
      ctx.rotate(Math.sin(time * 3) * 0.1);
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(hyperChargeImage, 240, 145, 780, 940, -34, -41, 68, 82);
      ctx.restore();
      continue;
    }
    if (p.type !== "hyper" && p.type !== "hyperCharge" && itemSheet.complete && itemSheet.naturalWidth && sprite) {
      ctx.rotate(Math.sin(time * 3) * 0.12);
      drawSpriteFrom(itemSheet, sprite, 0, 0, p.type === "score" ? 52 : 48, p.type === "life" ? 50 : 48, 0, true);
      ctx.restore();
      continue;
    }
    ctx.rotate(time * 4);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(13, 0);
    ctx.lineTo(0, 13);
    ctx.lineTo(-13, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    if (p.type === "life") {
      ctx.fillRect(-8, -2, 16, 4);
      ctx.fillRect(-2, -8, 4, 16);
    } else if (p.type === "hyper" || p.type === "hyperCharge") {
      ctx.font = "900 15px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.type === "hyper" ? "H" : "+", 0, 1);
    } else if (p.type === "bomb") {
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, TAU);
      ctx.fill();
    } else if (p.type === "score") {
      ctx.font = "900 13px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("$", 0, 1);
    } else {
      ctx.fillRect(-3, -3, 6, 6);
    }
    ctx.restore();
  }
}

function drawEffects() {
  if (!isVeryLiteRender()) for (const w of shockwaves) {
    const k = 1 - w.life / w.max;
    ctx.save();
    if (!isLiteRender()) ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = w.color;
    ctx.shadowColor = w.color;
    ctx.shadowBlur = isLiteRender() ? 8 : 32;
    ctx.lineWidth = 9 * (1 - k) + 2;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.radius + k * 520, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  const sparkStep = isVeryLiteRender() ? 2 : 1;
  for (let si = 0; si < hitSparks.length; si += sparkStep) {
    const s = hitSparks[si];
    const k = 1 - s.life / s.max;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.globalAlpha = 1 - k;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = isLiteRender() ? 4 : 18;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 3 * s.scale;
    const rays = isLiteRender() ? 3 : 5;
    for (let i = 0; i < rays; i++) {
      const a = i * TAU / rays + k * 2.4;
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
  const particleStep = isVeryLiteRender() ? 2 : 1;
  for (let pi = 0; pi < particles.length; pi += particleStep) {
    const p = particles[pi];
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
    if (e.bossArt && bossExplosionSheet.complete && bossExplosionSheet.naturalWidth) {
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = clamp((1 - k) * 1.25, 0, 1);
      ctx.rotate((e.rot || 0) + k * 0.45);
      const cols = 2;
      const frame = e.frame || 0;
      const sw = bossExplosionSheet.naturalWidth / cols;
      const sh = bossExplosionSheet.naturalHeight / 2;
      const sx = (frame % cols) * sw;
      const sy = Math.floor(frame / cols) * sh;
      const size = (260 + k * 180) * e.scale;
      ctx.drawImage(bossExplosionSheet, sx, sy, sw, sh, -size / 2, -size / 2, size, size);
      ctx.globalAlpha = clamp((1 - k) * 0.72, 0, 0.72);
      ctx.rotate(-0.25);
      ctx.drawImage(bossExplosionSheet, sx, sy, sw, sh, -size * 0.38, -size * 0.38, size * 0.76, size * 0.76);
      ctx.restore();
      continue;
    }
    if (spriteSheet.complete && spriteSheet.naturalWidth && !isLiteRender()) {
      ctx.rotate(k * 0.4);
      drawSprite(sprites.explosion, 0, 0, 150 * e.scale * (0.55 + k), 120 * e.scale * (0.55 + k), 0, true);
      ctx.restore();
      continue;
    }
    ctx.shadowColor = "#ff9a42";
    ctx.shadowBlur = isLiteRender() ? 0 : 28;
    if (isLiteRender()) {
      ctx.fillStyle = `rgba(255, 154, 66, ${0.72 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(0, 0, 52 * e.scale * (0.28 + k), 0, TAU);
      ctx.fill();
      ctx.restore();
      continue;
    }
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

function drawGameOverEffect() {
  const a = clamp(gameOverClock / 2.4, 0, 1);
  ctx.save();
  ctx.fillStyle = `rgba(4, 0, 8, ${0.62 * a})`;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.shadowColor = "#ff3b6a";
  ctx.shadowBlur = 26;
  ctx.fillStyle = `rgba(255, 230, 238, ${a})`;
  ctx.font = "900 52px Segoe UI, sans-serif";
  ctx.fillText("MISSION LOST", W / 2, H * 0.46);
  ctx.font = "900 20px Segoe UI, sans-serif";
  ctx.fillStyle = `rgba(255, 130, 160, ${a})`;
  ctx.fillText("SIGNAL FADING", W / 2, H * 0.46 + 42);
  ctx.restore();
}

function drawCredits() {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.shadowColor = "#7df4ff";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#efffff";
  ctx.font = "900 42px Segoe UI, sans-serif";
  ctx.fillText("ALL CLEAR", W / 2, creditScroll);
  ctx.font = "900 22px Segoe UI, sans-serif";
  const lines = [
    "SHOOTHING DANMAKU 1",
    "PILOT: AEGIS-01",
    "SPRITE ART: IMAGE 2.0",
    "BGM: RESONANT CLEAR",
    `FINAL SCORE ${formatScore(player.score)}`,
    "THANK YOU FOR PLAYING",
  ];
  lines.forEach((line, i) => {
    ctx.fillStyle = i === lines.length - 1 ? "#ffec9b" : "#bffcff";
    ctx.fillText(line, W / 2, creditScroll + 86 + i * 54);
  });
  ctx.restore();
}

function drawHud() {
  const def = currentStage();
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
  ctx.fillText(phase === "boss" || phase === "bossDeath" ? `${def.title} CORE` : phase === "credits" ? "ALL CLEAR" : `STAGE ${stageNo}`, W / 2, 26);
  if (phase === "boss" || phase === "bossDeath") {
    drawBar(W / 2 - 150, 36, 300, 18, boss.hp / boss.maxHp, "#f04b4d", "#79eaff");
  } else if (phase === "stage" || phase === "silence") {
    drawBar(W / 2 - 150, 36, 300, 18, phaseTimer / stageDuration(), "#53dfff", "#79eaff");
  }
  drawBar(12, 72, 184, 14, player.hyperGauge / HYPER_GAUGE_MAX, "#b46cff", "#d7b7ff");
  ctx.textAlign = "left";
  ctx.fillText(`HYPER: ${player.hyperStock}/${HYPER_STOCK_MAX}${player.hyperTime > 0 ? ` x${player.hyperLevel}` : ""}`, 12, 108);
  ctx.textAlign = "right";
  ctx.fillText(phase === "boss" || phase === "bossDeath" ? "BOSS" : "PHASE", W - 14, 28);
  if (phase === "boss") drawBar(W - 214, 38, 200, 16, boss.hp / boss.maxHp, "#ff842f", "#77eaff");
  ctx.fillText(phase === "stage" ? def.title : phase === "silence" ? "SILENCE" : phase === "boss" ? "BOSS PHASE" : phase === "bossDeath" ? "CORE COLLAPSE" : phase === "credits" ? "STAFF ROLL" : "STAGE CLEAR", W - 14, 82);
  drawBar(W - 214, H - 58, 194, 14, player.comboTimer / COMBO_HOLD_SECONDS, "#ffe66d", "#fff2a4");
  ctx.fillText(`CHAIN: ${Math.floor(player.chain)}`, W - 20, H - 18);
  ctx.restore();
}

function drawTouchControls() {
  if (!IS_MOBILE_BROWSER || phase === "credits") return;
  const b = touchBombButton;
  const hyperReady = player.hyperStock > 0;
  const ready = running && (player.bombs > 0 || hyperReady) && phase !== "gameover";
  ctx.save();
  ctx.globalAlpha = ready ? 0.86 : 0.42;
  ctx.fillStyle = "rgba(8, 18, 36, 0.82)";
  ctx.strokeStyle = ready ? "#ffb35c" : "rgba(210, 235, 242, 0.55)";
  ctx.lineWidth = 3;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = ready ? "#ffe2a8" : "#b8cbd2";
  ctx.shadowColor = ready ? "#ff6d36" : "transparent";
  ctx.shadowBlur = ready ? 13 : 0;
  ctx.textAlign = "center";
  ctx.font = "900 24px Segoe UI, sans-serif";
  ctx.fillText(hyperReady ? "HYPER" : "BOMB", b.x + b.w / 2, b.y + 31);
  ctx.font = "900 18px Segoe UI, sans-serif";
  ctx.fillText(`${hyperReady ? player.hyperStock : player.bombs}`, b.x + b.w / 2, b.y + 56);
  ctx.restore();
}

function drawPhaseText() {
  if (phaseBanner <= 0) return;
  const def = currentStage();
  const alpha = clamp(phaseBanner / 1.2, 0, 1);
  let title = "";
  let sub = "";
  if (phase === "stage") {
    title = `STAGE ${stageNo}`;
    sub = def.title;
  } else if (phase === "silence") {
    title = "SILENCE";
    sub = "BOSS SIGNAL APPROACHING";
  } else if (phase === "boss") {
    title = "WARNING";
    sub = `${def.title} BOSS`;
  } else if (phase === "bossDeath") {
    title = "CORE COLLAPSE";
    sub = "CHAIN REACTION";
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
  drawSpriteFrom(spriteSheet, s, x, y, w, h, rotation, centered);
}

function drawSpriteFrom(sheet, s, x, y, w, h, rotation = 0, centered = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  const dx = centered ? -w / 2 : 0;
  const dy = centered ? -h / 2 : 0;
  ctx.drawImage(sheet, s.sx, s.sy, s.sw, s.sh, dx, dy, w, h);
  ctx.restore();
}

function heartText(lives) {
  return "♥".repeat(Math.max(0, lives)).padEnd(PLAYER_START_LIVES, "♡");
}

initStars();
render();

if (new URLSearchParams(location.search).has("demo")) {
  const params = new URLSearchParams(location.search);
  resetGame();
  const requestedStage = Number(params.get("stage"));
  if (Number.isInteger(requestedStage) && requestedStage >= 1 && requestedStage <= STAGES.length) {
    stageNo = requestedStage;
    boss.maxHp = currentStage().bossHp;
    boss.hp = boss.maxHp;
    boss.r = currentStage().bossR;
    boss.shifted = false;
    boss.enraged = false;
  }
  running = true;
  player.invuln = 999;
  stopBgm();
  overlay.style.display = "none";
  if (params.get("demo") === "boss") beginBossPhase();
  if (params.get("demo") === "clear") {
    beginBossPhase();
    clearStage();
  }
  if (params.get("demo") === "credits") beginCredits();
  if (params.get("demo") === "mid") player.power = 8;
  const frames = params.get("demo") === "mid" ? 900 : params.get("demo") === "clear" ? 520 : params.get("demo") === "credits" ? 260 : params.get("demo") === "stage" || params.get("demo") === "1" ? 150 : 90;
  for (let i = 0; i < frames; i++) update(1 / 60);
  last = performance.now();
  requestAnimationFrame(loop);
}
