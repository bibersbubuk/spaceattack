'use strict';

// Fullscreen extends the logical arena without stretching ships or formations.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 960, H = 640;
const arena = document.querySelector('.arena');
const ui = Object.fromEntries(['score', 'wave', 'health', 'overlay', 'announcement', 'eyebrow', 'screen-title', 'screen-copy', 'start-controls', 'action', 'screen-hint', 'sound'].map(id => [id, document.getElementById(id)]));
const keys = new Set();
let state = 'start', score = 0, wave = 0, player;
let enemies = [], bullets = [], enemyBullets = [], particles = [], pickups = [];
let swarmTime = 0, waveDelay = 0, messageTimer = 0;
const formationNames = ['RECTANGLE', 'TRIANGLE', 'RING', 'SQUARE', 'HEXAGON', 'CUBE'];
let shake = 0, flash = 0, elapsed = 0, lastTime = 0;
const stars = Array.from({ length: 115 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: Math.random() }));
const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

let fullscreenBusy = false;
async function toggleFullscreen() {
  if (fullscreenBusy) return;
  fullscreenBusy = true;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await arena.requestFullscreen();
  } catch (_) {
    document.getElementById('fullscreen-help').textContent = 'Fullscreen unavailable in this browser';
  } finally { fullscreenBusy = false; }
}
function resizeArena() {
  const oldW = W, oldH = H;
  const fullscreen = document.fullscreenElement === arena;
  const ratio = fullscreen ? window.innerWidth / window.innerHeight : 1.5;
  W = Math.max(960, 640 * ratio);
  H = Math.max(640, 960 / ratio);
  const shift = (W - oldW) / 2;
  // Recenter existing objects together so toggling cannot break a formation.
  for (const list of [enemies, bullets, enemyBullets, particles, pickups]) {
    for (const object of list) object.x += shift;
  }
  if (player) {
    player.x = clamp(player.x + shift, 24, W - 24);
    player.y = clamp(player.y + H - oldH, 92, H - 28);
  }
  for (const star of stars) { star.x *= W / oldW; star.y *= H / oldH; }
  // Keep roughly the same star density, with a small fixed upper bound.
  const count = Math.min(350, Math.round(115 * W * H / (960 * 640)));
  while (stars.length < count) stars.push({ x: Math.random() * W, y: Math.random() * H, z: Math.random() });
  stars.length = count;
  canvas.width = Math.round(W); canvas.height = Math.round(H);
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
}
document.addEventListener('fullscreenchange', () => {
  keys.clear(); resizeArena();
  document.getElementById('fullscreen-help').textContent = 'Fullscreen';
});
window.addEventListener('resize', resizeArena);

// Audio is optional; unsupported/blocked audio never stops a game.
let audio = null, muted = false;
let gameOverVoice = null;
function stopGameOverMelody() {
  if (!gameOverVoice) return;
  const { osc, gain } = gameOverVoice;
  gameOverVoice = null;
  try {
    gain.gain.cancelScheduledValues(audio.currentTime);
    gain.gain.setValueAtTime(0, audio.currentTime);
    osc.stop();
  } catch (_) { /* The voice may already have finished. */ }
}
function playGameOverMelody() {
  stopGameOverMelody();
  if (muted || !audio || audio.state !== 'running') return;
  try {
    const osc = audio.createOscillator(), gain = audio.createGain();
    const voice = { osc, gain };
    gameOverVoice = voice;
    osc.type = 'square';
    // E5, C5, B4, A4: a short descending minor phrase, with a longer last note.
    const notes = [[659.25, 0, 0.16], [523.25, 0.22, 0.16],
      [493.88, 0.44, 0.2], [440, 0.72, 0.42]];
    const now = audio.currentTime;
    gain.gain.setValueAtTime(0, now);
    for (const [frequency, offset, duration] of notes) {
      const start = now + offset;
      osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.035, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      gain.gain.setValueAtTime(0, start + duration + 0.005);
    }
    osc.connect(gain); gain.connect(audio.destination);
    osc.onended = () => {
      osc.disconnect(); gain.disconnect();
      if (gameOverVoice === voice) gameOverVoice = null;
    };
    osc.start(now); osc.stop(now + 1.16);
  } catch (_) { stopGameOverMelody(); }
}
function unlockAudio() {
  try {
    if (!audio) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (Audio) audio = new Audio();
    }
    if (audio && audio.state === 'suspended') audio.resume().catch(() => {});
  } catch (_) { audio = null; }
}
function sound(kind) {
  if (muted || !audio || audio.state !== 'running') return;
  const settings = {
    fire: [650, 280, 0.065, 0.025, 'square'],
    explode: [150, 40, 0.16, 0.07, 'sawtooth'],
    damage: [220, 65, 0.24, 0.08, 'square'],
    heal: [420, 840, 0.18, 0.045, 'sine']
  };
  try {
    const [from, to, duration, volume, type] = settings[kind];
    const osc = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
    osc.type = type;
    // Vary shots and explosions by up to one semitone, preserving their sweeps.
    const pitch = kind === 'fire' || kind === 'explode' ? 2 ** (rand(-1, 1) / 12) : 1;
    osc.frequency.setValueAtTime(from * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(to * pitch, now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain); gain.connect(audio.destination);
    osc.start(now); osc.stop(now + duration + 0.01);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  } catch (_) { /* Sound is never required for play. */ }
}
function toggleSound() {
  muted = !muted;
  if (muted) stopGameOverMelody();
  ui.sound.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  ui.sound.setAttribute('aria-pressed', String(muted));
  if (!muted) unlockAudio();
}
ui.sound.addEventListener('click', toggleSound);

function updateHUD() {
  ui.score.textContent = String(score).padStart(6, '0');
  ui.wave.textContent = String(wave).padStart(2, '0');
  ui.health.textContent = '● '.repeat(player.hp) + '○ '.repeat(3 - player.hp);
  ui.health.setAttribute('aria-label', `${player.hp} health remaining`);
}
function startGame() {
  stopGameOverMelody();
  unlockAudio(); keys.clear();
  score = 0; wave = 0; elapsed = 0; shake = 0; flash = 0;
  enemies = []; bullets = []; enemyBullets = []; particles = []; pickups = [];
  player = { x: W / 2, y: H - 90, r: 14, hp: 3, invincible: 1.2, cooldown: 0 };
  waveDelay = 0; state = 'playing';
  ui.overlay.hidden = true;
  nextWave();
}
function nextWave() {
  wave++;
  swarmTime = 0; waveDelay = 0;
  const shape = (wave - 1) % formationNames.length;
  const points = formationPoints(shape, Math.min(8 + wave * 2, 28));
  enemies = points.map(([homeX, homeY], index) => {
    // Alternating roles guarantee a mixed swarm, including the first wave.
    const type = (index + wave) % 3 === 0 ? 'weaver' : 'scout';
    return { x: W / 2 + homeX, y: 245 + homeY, homeX, homeY,
      r: type === 'weaver' ? 19 : 17, type, index, shots: 0,
      fireTimer: 1.7 + (index % 3) * 0.48 + Math.floor(index / 3) * 0.09,
      muzzle: 0, dead: false };
  });
  ui.announcement.textContent = `WAVE ${String(wave).padStart(2, '0')}`;
  messageTimer = 2;
  updateHUD();
}
function showScreen(title, copy, button, eyebrow, hint) {
  ui['screen-title'].textContent = title;
  ui['screen-copy'].textContent = copy;
  ui.action.textContent = button;
  ui.eyebrow.textContent = eyebrow;
  ui['screen-hint'].textContent = hint;
  ui['start-controls'].hidden = true;
  ui.overlay.hidden = false;
}
function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused'; keys.clear();
  showScreen('Flight paused.', 'Take a breath. Your ship is right where you left it.', 'RESUME FLIGHT ↗', 'STANDING BY', 'Enter, P or Esc to resume');
}
function resumeGame() {
  unlockAudio(); keys.clear(); state = 'playing'; ui.overlay.hidden = true;
}
function gameOver() {
  state = 'over'; keys.clear(); ui.announcement.textContent = '';
  playGameOverMelody();
  showScreen('Signal lost.', `Final score: ${score.toLocaleString()} · Reached wave ${wave}`, 'FLY AGAIN ↗', 'PATROL COMPLETE', 'or press Enter to try again');
}
ui.action.addEventListener('click', () => state === 'paused' ? resumeGame() : startGame());
const controlKeys = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyP', 'KeyF', 'Escape'];
window.addEventListener('keydown', event => {
  if (controlKeys.includes(event.code)) event.preventDefault();
  if (event.repeat) return;
  if (event.code === 'KeyF') { toggleFullscreen(); return; }
  if (event.code === 'KeyM') { toggleSound(); return; }
  if (event.code === 'Enter' && state !== 'playing') {
    // Let a focused button keep its normal keyboard activation.
    if (document.activeElement.tagName === 'BUTTON') return;
    state === 'paused' ? resumeGame() : startGame(); return;
  }
  if (event.code === 'KeyP' || event.code === 'Escape') {
    if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame();
    return;
  }
  if (state === 'playing') keys.add(event.code);
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', pauseGame);
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

function burst(x, y, color, count = 18, reach = 1) {
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2), speed = rand(45, 220) * reach, life = rand(0.2, 0.6) * Math.sqrt(reach);
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, color, size: rand(1.5, 4) });
  }
}
function explodeEnemy(enemy, canDropHull) {
  burst(enemy.x, enemy.y, enemy.type === 'weaver' ? '#c5a0ff' : '#ffae7d', 32, 1.55);
  // Only shot-down weavers drop repairs, not collisions with the player.
  const dropChance = Math.max(0, 26 - wave) / 100;
  if (canDropHull && enemy.type === 'weaver' && Math.random() < dropChance) {
    pickups.push({ x: enemy.x, y: enemy.y, r: 15 });
  }
}
function damagePlayer() {
  if (player.invincible > 0 || state !== 'playing') return;
  player.hp--; player.invincible = 1.5; flash = 0.25; shake = 9;
  burst(player.x, player.y, '#ff8b91', 26); updateHUD();
  if (player.hp <= 0) gameOver(); else sound('damage');
}
function hit(a, b) { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < (a.r + b.r) ** 2; }
// Distribute ships along geometric edges, keeping every corner occupied.
function formationPoints(shape, count) {
  if (shape === 2) return Array.from({ length: count }, (_, i) => {
    const a = i / count * Math.PI * 2;
    return [Math.cos(a) * 235, Math.sin(a) * 110];
  });
  const outlines = [
    [[-230, -90], [230, -90], [230, 90], [-230, 90]],
    [[0, -120], [240, 105], [-240, 105]],
    [],
    [[-110, -110], [110, -110], [110, 110], [-110, 110]],
    [[-125, -105], [125, -105], [240, 0], [125, 105], [-125, 105], [-240, 0]],
    // Two offset squares and their connecting edges: a projected cube.
    [[-130, -65], [40, -65], [40, 105], [-130, 105],
      [-40, -115], [130, -115], [130, 55], [-40, 55]]
  ];
  const vertices = outlines[shape];
  const edges = shape === 5
    ? [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]
    : vertices.map((_, i) => [i, (i + 1) % vertices.length]);
  const divisions = edges.map(() => 1);
  for (let extra = vertices.length; extra < count; extra++) {
    let longest = 0, selected = 0;
    edges.forEach(([a, b], i) => {
      const gap = Math.hypot(vertices[a][0] - vertices[b][0], vertices[a][1] - vertices[b][1]) / divisions[i];
      if (gap > longest) { longest = gap; selected = i; }
    });
    divisions[selected]++;
  }
  const points = vertices.map(p => [...p]);
  edges.forEach(([a, b], i) => {
    for (let step = 1; step < divisions[i]; step++) {
      const t = step / divisions[i];
      points.push([vertices[a][0] * (1 - t) + vertices[b][0] * t,
        vertices[a][1] * (1 - t) + vertices[b][1] * t]);
    }
  });
  return points;
}
function fireEnemy(enemy) {
  // Three staggered groups produce rippling volleys instead of a solid wall.
  const speed = 185 + Math.min(wave - 1, 15) * 9;
  let angle = Math.PI / 2 + Math.sin(swarmTime * 1.5) * 0.38;
  if (enemy.type === 'weaver') angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const fan = enemy.type === 'weaver' && wave >= 2 && enemy.shots % 2 === 0;
  const offsets = fan ? (wave >= 4 ? [-0.22, 0, 0.22] : [-0.13, 0.13]) : [0];
  for (const offset of offsets) {
    if (enemyBullets.length >= 180) break;
    enemyBullets.push({ x: enemy.x, y: enemy.y + 15,
      vx: Math.cos(angle + offset) * speed, vy: Math.sin(angle + offset) * speed,
      r: 6, color: enemy.type === 'weaver' ? '#c6a0ff' : '#ff9b7d' });
  }
  enemy.shots++; enemy.muzzle = 0.12;
  enemy.fireTimer = Math.max(2.6, 4.2 - wave * 0.16);
}
function update(dt) {
  if (state !== 'paused') elapsed += dt;
  if (state !== 'paused') {
    for (const star of stars) { star.y += (15 + star.z * 55) * dt; if (star.y > H) { star.y = 0; star.x = Math.random() * W; } }
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    particles = particles.filter(p => p.life > 0);
    shake = Math.max(0, shake - dt * 35); flash = Math.max(0, flash - dt);
  }
  if (state !== 'playing') return;
  messageTimer -= dt;
  if (messageTimer <= 0) ui.announcement.textContent = '';
  player.invincible = Math.max(0, player.invincible - dt);
  let dx = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  let dy = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
  const length = Math.hypot(dx, dy) || 1;
  player.x = clamp(player.x + dx / length * 340 * dt, 24, W - 24);
  player.y = clamp(player.y + dy / length * 340 * dt, 92, H - 28);
  player.cooldown -= dt;
  if (keys.has('Space') && player.cooldown <= 0) {
    bullets.push({ x: player.x, y: player.y - 23, r: 5 });
    player.cooldown = 0.15; sound('fire');
  }
  swarmTime += dt;
  const beat = swarmTime * (0.8 + Math.min(wave, 15) * 0.035);
  const turn = Math.sin(beat * 0.7) * 0.12;
  const breathe = 1 + Math.sin(beat * 1.6) * 0.045;
  const centerX = W / 2 + Math.sin(beat) * (75 + Math.min(wave, 12) * 4);
  const centerY = 245 + Math.sin(beat * 1.3) * 20;
  for (const bullet of bullets) bullet.y -= 660 * dt;
  for (const enemy of enemies) {
    // Shared translation, rotation and breathing preserve the silhouette.
    enemy.x = centerX + (enemy.homeX * Math.cos(turn) - enemy.homeY * Math.sin(turn)) * breathe;
    enemy.y = centerY + (enemy.homeX * Math.sin(turn) + enemy.homeY * Math.cos(turn)) * breathe;
    enemy.muzzle = Math.max(0, enemy.muzzle - dt);
    enemy.fireTimer -= dt;
    // Close-range shots are held until there is room to react.
    if (enemy.fireTimer <= 0 && Math.hypot(enemy.x - player.x, enemy.y - player.y) > 100) fireEnemy(enemy);
    for (const bullet of bullets) {
      if (swarmTime >= 1.2 && !bullet.dead && !enemy.dead && hit(bullet, enemy)) {
        enemy.dead = true; bullet.dead = true;
        score += enemy.type === 'weaver' ? 150 : 100;
        explodeEnemy(enemy, true);
        sound('explode'); updateHUD();
      }
    }
    if (swarmTime >= 1.2 && !enemy.dead && hit(enemy, player)) {
      enemy.dead = true; explodeEnemy(enemy, false); damagePlayer();
      if (state === 'over') return;
    }
  }
  for (const bullet of enemyBullets) {
    bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt;
    if (hit(bullet, player)) { bullet.dead = true; damagePlayer(); }
    if (state === 'over') return;
  }
  bullets = bullets.filter(b => !b.dead && b.y > -20);
  enemies = enemies.filter(e => !e.dead && e.y < H + 35);
  enemyBullets = enemyBullets.filter(b => !b.dead && b.y > -30 && b.y < H + 30 && b.x > -30 && b.x < W + 30);
  for (const pickup of pickups) {
    pickup.y += 95 * dt;
    if (hit(pickup, player)) {
      pickup.dead = true;
      if (player.hp < 3) {
        player.hp++; updateHUD(); sound('heal');
        burst(player.x, player.y, '#80ebd2', 12);
      }
    }
  }
  // Drops persist between waves, but disappear once missed or collected.
  pickups = pickups.filter(p => !p.dead && p.y - p.r < H && p.x + p.r > 0 && p.x - p.r < W);
  if (state === 'playing' && enemies.length === 0) {
    if (waveDelay === 0) { waveDelay = 2.4; enemyBullets = []; ui.announcement.textContent = 'SECTOR CLEAR'; messageTimer = 2; }
    waveDelay -= dt;
    if (waveDelay <= 0) nextWave();
  }
}

function polygon(points, fill, stroke) {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}
function drawShip(x, y) {
  ctx.save(); ctx.translate(x, y);
  if (player && player.invincible > 0) {
    ctx.strokeStyle = '#8ef5e5'; ctx.globalAlpha = 0.35 + Math.sin(elapsed * 24) * 0.15;
    ctx.beginPath(); ctx.arc(0, 0, 29, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 0.7;
  }
  const flame = 13 + Math.sin(elapsed * 48) * 5;
  polygon([[-7, 15], [0, 18 + flame], [7, 15]], '#52ddce');
  polygon([[-3, 15], [0, 24 + flame / 2], [3, 15]], '#d5ffea');
  polygon([[0, -24], [19, 18], [7, 12], [0, 17], [-7, 12], [-19, 18]], '#b2e4e4', '#e6fffa');
  polygon([[0, -17], [6, 8], [0, 4], [-6, 8]], '#174d63');
  ctx.restore();
}
// Generate a tiny, stationary grain tile once to hide 8-bit gradient banding.
// Soft-light blends around neutral gray without washing out the dark sky.
const lightGrain = (() => {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 128;
  const tileContext = tile.getContext('2d');
  const pixels = tileContext.createImageData(128, 128);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const gray = Math.floor(Math.random() * 256);
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = gray;
    pixels.data[i + 3] = 255;
  }
  tileContext.putImageData(pixels, 0, 0);
  return ctx.createPattern(tile, 'repeat');
})();

function drawPlayerLight() {
  const x = player ? player.x : W / 2;
  const y = player ? player.y : H - 90;
  // Approximate 70% coverage, widening toward edges as the circle is clipped.
  const edgeOffset = Math.hypot(x - W / 2, y - H / 2);
  const radius = Math.sqrt(W * H * 0.7 / Math.PI) + edgeOffset * 0.65;
  const shade = ctx.createRadialGradient(x, y, 40, x, y, radius);
  // A continuous eased curve avoids visible changes in slope at a few stops.
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    const eased = t * t;
    const opacity = 0.5 * eased * eased * (3 - 2 * eased);
    shade.addColorStop(t, `rgba(0, 0, 0, ${opacity})`);
  }
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  if (lightGrain) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.075;
    ctx.fillStyle = lightGrain;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}
function draw() {
  ctx.fillStyle = '#080f20'; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.7, H * 0.25, 0, W * 0.7, H * 0.25, 600);
  glow.addColorStop(0, '#182443'); glow.addColorStop(1, '#080f20'); ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#749db808'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (const star of stars) { ctx.globalAlpha = 0.2 + star.z * 0.65; ctx.fillStyle = '#b7d8ef'; ctx.fillRect(star.x, star.y, star.z > 0.8 ? 2 : 1, 1 + star.z * 2); }
  ctx.globalAlpha = 1; ctx.save();
  if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
  for (const b of bullets) {
    ctx.fillStyle = '#6ff0d4'; ctx.fillRect(b.x - 3, b.y - 12, 6, 20);
    ctx.fillStyle = '#e1fff3'; ctx.fillRect(b.x - 1, b.y - 12, 2, 15);
  }
  for (const e of enemies) {
    ctx.save(); ctx.translate(e.x, e.y);
    if (swarmTime < 1.2) {
      ctx.globalAlpha = 0.25 + 0.75 * swarmTime / 1.2;
      ctx.strokeStyle = '#9ce9df'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, 23 + (1 - swarmTime / 1.2) * 16, 0, Math.PI * 2); ctx.stroke();
    }
    // A small charge halo telegraphs each shot; no extra particle objects.
    if (e.fireTimer < 0.4 || e.muzzle > 0) {
      ctx.fillStyle = e.type === 'weaver' ? '#c6a0ff' : '#ff9b7d';
      ctx.globalAlpha = e.muzzle > 0 ? 0.85 : 0.22;
      ctx.beginPath(); ctx.arc(0, 17, e.muzzle > 0 ? 10 : 7, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (e.type === 'weaver') {
      polygon([[0, 22], [-21, -4], [-13, -17], [0, -9], [13, -17], [21, -4]], '#45345f', '#bf9af1');
      polygon([[-5, -1], [0, 10], [5, -1]], '#dfc3ff');
    } else {
      polygon([[0, 19], [-19, -13], [-7, -7], [0, -14], [7, -7], [19, -13]], '#5a3544', '#ff9e80');
      polygon([[-4, -5], [0, 8], [4, -5]], '#ffcb9b');
    }
    ctx.restore();
  }
  for (const b of enemyBullets) {
    ctx.strokeStyle = b.color; ctx.lineWidth = 3; ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.055, b.y - b.vy * 0.055); ctx.stroke();
    ctx.globalAlpha = 0.65; ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffd0ae'; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  for (const p of pickups) {
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.strokeStyle = '#80ebd2'; ctx.lineWidth = 2;
    ctx.globalAlpha = 0.18 + Math.sin(elapsed * 5) * 0.06;
    ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    polygon([[0, -16], [16, 0], [0, 16], [-16, 0]], '#123b3c', '#80ebd2');
    ctx.fillStyle = '#c4ffeb'; ctx.fillRect(-7, -2, 14, 4); ctx.fillRect(-2, -7, 4, 14);
    ctx.restore();
  }
  if (player && player.hp > 0) drawShip(player.x, player.y);
  else if (state === 'start') drawShip(W / 2, H - 90);
  for (const p of particles) { ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }
  ctx.globalAlpha = 1; ctx.restore();
  drawPlayerLight();
  if (flash > 0) { ctx.fillStyle = `rgba(255, 65, 93, ${flash * 0.7})`; ctx.fillRect(0, 0, W, H); }
}
function frame(time) {
  const dt = Math.min((time - lastTime) / 1000 || 0, 0.033);
  lastTime = time; update(dt); draw(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
