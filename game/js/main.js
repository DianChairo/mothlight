// main.js — Mothlight's engine room: the game state, the fixed-step loop,
// collisions, scoring, and the screen-to-screen flow.
//
// The loop runs the simulation at a fixed 60 steps a second (accumulated
// from requestAnimationFrame) so the game plays the same on every display.
// Rendering reads the state; the state changes only inside stepGame().
//
// A ?shot=<scene>&seed=<n> query builds one deterministic scene instead of
// starting at the title — that is how the entry's screenshots are taken:
// the same code, the same garden, a scripted pilot at the controls.

import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { seedRandom } from './rng.js';
import { loadBestScore, saveBestScore } from './storage.js';
import {
  createBackground,
  createVignette,
  createFireflies,
  drawFireflies,
  drawBullets,
} from './render.js';
import { createPlayer, updatePlayer, drawPlayer } from './player.js';
import { updateEnemies, drawEnemies, drawPortals, createEnemy } from './enemies.js';
import { startWave, updateSpawning, waveCleared, FINAL_WAVE } from './waves.js';
import {
  spawnBurst,
  spawnPetals,
  updateParticles,
  drawParticles,
  spawnFloatText,
  updateFloatTexts,
  drawFloatTexts,
  addShake,
  updateShake,
  shakeOffset,
  dropNectar,
  updateOrbs,
  drawOrbs,
  maybeDropPickup,
  updatePickups,
  drawPickups,
  pickupStyle,
} from './effects.js';
import { drawHUD, drawBanner, drawTitle, drawPaused, drawGameOver, drawVictory } from './hud.js';

const WIDTH = 1280;
const HEIGHT = 720;
const STEP = 1 / 60;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input(canvas);
const sound = new SoundEngine();

function createState() {
  const state = {
    mode: 'title',
    width: WIDTH,
    height: HEIGHT,
    now: 0,
    time: 0,
    score: 0,
    best: loadBestScore(),
    kills: 0,
    nectar: 0,
    nextHealAt: 25,
    combo: 0,
    comboT: 0,
    wave: 0,
    endless: false,
    player: createPlayer(WIDTH / 2, HEIGHT / 2),
    enemies: [],
    bullets: [],
    enemyBullets: [],
    particles: [],
    floatTexts: [],
    orbs: [],
    pickups: [],
    portals: [],
    spawnQueue: [],
    spawnTimer: 0,
    spawnInterval: 0.9,
    banner: null,
    shake: { t: 0, dur: 0.25, mag: 0 },
    hurtFlash: 0,
    burstFlash: 0,
    betweenT: 0,
    muted: false,
    sound,
    background: createBackground(WIDTH, HEIGHT),
    vignette: createVignette(WIDTH, HEIGHT),
    fireflies: createFireflies(22, WIDTH, HEIGHT),
  };
  state.addScore = (points, x, y, useCombo) => {
    const mul = useCombo ? Math.min(5, 1 + Math.floor(state.combo / 10)) : 1;
    const gained = points * mul;
    state.score += gained;
    if (useCombo && points >= 50) {
      spawnFloatText(state, x, y - 14, `+${gained}`, '#ffe9a8', 15);
    }
  };
  return state;
}

const state = createState();

function startRun() {
  const fresh = createState();
  fresh.best = state.best;
  fresh.background = state.background;
  fresh.vignette = state.vignette;
  fresh.fireflies = state.fireflies;
  fresh.muted = state.muted;
  Object.assign(state, fresh);
  state.mode = 'playing';
  startWave(state, 1);
}

// --- combat -----------------------------------------------------------------

function killEnemy(enemy) {
  enemy.dead = true;
  state.kills += 1;
  state.combo += 1;
  state.comboT = 3;
  state.addScore(enemy.score, enemy.x, enemy.y, true);
  spawnBurst(state, enemy.x, enemy.y, enemy.color, enemy.kind === 'brood' ? 26 : 15, enemy.kind === 'brood' ? 320 : 250);
  if (enemy.kind === 'brood') {
    spawnPetals(state, enemy.x, enemy.y, 6);
    addShake(state, 4.5, 0.22);
    for (const side of [-1, 1]) {
      const mite = createEnemy('mite', enemy.x + side * 18, enemy.y + side * 8, state.wave);
      mite.vx = side * 120;
      state.enemies.push(mite);
    }
  }
  dropNectar(state, enemy.x, enemy.y, enemy.nectar);
  maybeDropPickup(state, enemy.x, enemy.y);
  sound.explode(enemy.kind === 'brood');
}

function damagePlayer() {
  const p = state.player;
  if (p.invulnT > 0 || state.mode !== 'playing') return;
  if (p.shield) {
    p.shield = false;
    p.invulnT = 1.1;
    spawnBurst(state, p.x, p.y, '#9db4ff', 18, 240);
    spawnFloatText(state, p.x, p.y - 26, 'VEIL SPENT', '#9db4ff', 15);
    sound.explode(false);
    return;
  }
  p.hp -= 1;
  p.invulnT = 1.3;
  state.hurtFlash = 1;
  state.combo = 0;
  state.comboT = 0;
  addShake(state, 7, 0.3);
  spawnPetals(state, p.x, p.y, 10);
  sound.hurt();
  if (p.hp <= 0) {
    state.mode = 'over';
    spawnBurst(state, p.x, p.y, '#ffd76a', 46, 380);
    spawnPetals(state, p.x, p.y, 16);
    addShake(state, 11, 0.45);
    if (Math.floor(state.score) > state.best) {
      state.best = Math.floor(state.score);
      saveBestScore(state.best);
    }
    sound.gameOver();
  }
}

function applyPickup(drop) {
  const p = state.player;
  const style = pickupStyle(drop.kind);
  if (drop.kind === 'spread') p.spreadT = 12;
  else if (drop.kind === 'rapid') p.rapidT = 12;
  else if (drop.kind === 'shield') p.shield = true;
  else if (drop.kind === 'bloom') {
    p.hp = Math.min(p.maxHp, p.hp + 1);
    spawnPetals(state, p.x, p.y, 12);
  } else if (drop.kind === 'burst') {
    state.burstFlash = 0.85;
    addShake(state, 10, 0.35);
    for (const enemy of state.enemies) {
      enemy.hp -= 3;
      enemy.flash = 1;
      if (enemy.hp <= 0 && !enemy.dead) killEnemy(enemy);
    }
    sweepDead();
  }
  spawnFloatText(state, p.x, p.y - 30, style.label, style.color, 16);
  spawnBurst(state, drop.x, drop.y, style.color, 12, 200);
  sound.powerup();
}

function sweepDead() {
  if (state.enemies.some((e) => e.dead)) {
    state.enemies = state.enemies.filter((e) => !e.dead);
  }
}

function stepGame(dt, controls) {
  state.time += dt;
  updatePlayer(state, dt, controls);
  updateSpawning(state, dt);
  updateEnemies(state, dt);

  // Player bolts.
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -24 || b.x > WIDTH + 24 || b.y < -24 || b.y > HEIGHT + 24) {
      state.bullets.splice(i, 1);
    }
  }
  for (const b of state.bullets) {
    for (const e of state.enemies) {
      if (e.dead) continue;
      const rr = b.radius + e.radius;
      if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 < rr * rr) {
        b.life = 0;
        e.hp -= b.dmg;
        e.flash = 1;
        spawnBurst(state, b.x, b.y, e.color, 3, 150);
        sound.hit();
        if (e.hp <= 0) killEnemy(e);
        break;
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
  sweepDead();

  // Enemy embers.
  for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
    const b = state.enemyBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    const rr = b.radius + state.player.radius - 3;
    if ((b.x - state.player.x) ** 2 + (b.y - state.player.y) ** 2 < rr * rr) {
      state.enemyBullets.splice(i, 1);
      damagePlayer();
      continue;
    }
    if (b.life <= 0 || b.x < -30 || b.x > WIDTH + 30 || b.y < -30 || b.y > HEIGHT + 30) {
      state.enemyBullets.splice(i, 1);
    }
  }

  // Bodies against the moth.
  for (const e of state.enemies) {
    const rr = e.radius + state.player.radius - 3;
    if ((e.x - state.player.x) ** 2 + (e.y - state.player.y) ** 2 < rr * rr) {
      damagePlayer();
      e.vx = -e.vx * 0.6 - (state.player.x - e.x) * 2;
      e.vy = -e.vy * 0.6 - (state.player.y - e.y) * 2;
    }
  }

  updateOrbs(state, dt);
  while (state.nectar >= state.nextHealAt) {
    state.nextHealAt += 25;
    if (state.player.hp < state.player.maxHp) {
      state.player.hp += 1;
      spawnFloatText(state, state.player.x, state.player.y - 30, '+1 HP', '#8dff9d', 16);
      spawnPetals(state, state.player.x, state.player.y, 10);
      sound.powerup();
    } else {
      state.addScore(250, state.player.x, state.player.y, false);
      spawnFloatText(state, state.player.x, state.player.y - 30, 'NECTAR BONUS +250', '#ffd76a', 15);
    }
  }

  updatePickups(state, dt);
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const drop = state.pickups[i];
    if (Math.hypot(drop.x - state.player.x, drop.y - state.player.y) < 34) {
      state.pickups.splice(i, 1);
      applyPickup(drop);
    }
  }

  if (state.comboT > 0) {
    state.comboT -= dt;
    if (state.comboT <= 0) state.combo = 0;
  }
  if (state.banner) {
    state.banner.t += dt;
    if (state.banner.t >= state.banner.dur) state.banner = null;
  }
  state.hurtFlash = Math.max(0, state.hurtFlash - dt * 2.6);
  state.burstFlash = Math.max(0, state.burstFlash - dt * 2.2);

  // Wave flow: a cleared garden breathes, then the next wave comes — or,
  // at the tenth, the dawn.
  if (state.mode === 'playing' && waveCleared(state)) {
    if (state.wave >= FINAL_WAVE && !state.endless) {
      state.mode = 'win';
      if (Math.floor(state.score) > state.best) {
        state.best = Math.floor(state.score);
        saveBestScore(state.best);
      }
      for (let i = 0; i < 5; i++) {
        spawnPetals(state, 200 + i * 220, 200 + (i % 3) * 120, 10);
      }
      sound.victory();
    } else if (state.betweenT <= 0) {
      state.betweenT = 1.6;
    }
  }
  if (state.betweenT > 0) {
    state.betweenT -= dt;
    if (state.betweenT <= 0 && state.mode === 'playing') {
      startWave(state, state.wave + 1);
    }
  }
}

// --- controls -----------------------------------------------------------------

function readControls() {
  const moveX = (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0);
  const moveY = (input.down('KeyS', 'ArrowDown') ? 1 : 0) - (input.down('KeyW', 'ArrowUp') ? 1 : 0);
  return {
    moveX,
    moveY,
    aimX: input.mouse.x,
    aimY: input.mouse.y,
    firing: input.mouse.down || input.down('Space'),
    dash: input.pressed('ShiftLeft', 'ShiftRight'),
  };
}

function handleModeKeys() {
  if (input.pressed('KeyM')) {
    state.muted = !state.muted;
    sound.setMuted(state.muted);
  }
  if (state.mode === 'title') {
    if (input.mouse.clicked || input.pressed('Enter', 'Space')) {
      sound.unlock();
      sound.uiClick();
      startRun();
    }
  } else if (state.mode === 'playing') {
    if (input.pressed('KeyP', 'Escape')) state.mode = 'paused';
  } else if (state.mode === 'paused') {
    if (input.pressed('KeyP', 'Escape')) state.mode = 'playing';
  } else if (state.mode === 'over') {
    if (input.pressed('Enter', 'KeyR')) {
      sound.uiClick();
      startRun();
    }
  } else if (state.mode === 'win') {
    if (input.pressed('Enter')) {
      sound.uiClick();
      state.endless = true;
      state.mode = 'playing';
      startWave(state, FINAL_WAVE + 1);
    } else if (input.pressed('KeyR')) {
      sound.uiClick();
      startRun();
    }
  }
}

// --- rendering ------------------------------------------------------------------

function render() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const offset = shakeOffset(state);
  ctx.save();
  ctx.translate(offset.x, offset.y);
  ctx.drawImage(state.background, 0, 0);
  drawFireflies(ctx, state.fireflies, state.now);
  drawPortals(ctx, state, state.now);
  drawOrbs(ctx, state, state.now);
  drawPickups(ctx, state, state.now);
  drawBullets(ctx, state);
  drawEnemies(ctx, state, state.now);
  if (state.mode !== 'over') drawPlayer(ctx, state, state.now);
  drawParticles(ctx, state);
  drawFloatTexts(ctx, state);
  ctx.restore();
  ctx.drawImage(state.vignette, 0, 0);

  if (state.burstFlash > 0) {
    ctx.fillStyle = `rgba(255, 240, 200, ${0.5 * state.burstFlash})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  if (state.mode === 'title') {
    // The pose circles the title; face along its velocity.
    const moth = {
      x: WIDTH / 2 + Math.cos(state.now * 0.45) * 150,
      y: 356 + Math.sin(state.now * 0.8) * 13,
      face: Math.atan2(Math.cos(state.now * 0.8) * 10.4, -Math.sin(state.now * 0.45) * 67.5),
      wingPhase: state.now * 11,
    };
    drawTitle(ctx, state, moth);
  } else if (state.mode === 'playing' || state.mode === 'paused') {
    drawHUD(ctx, state);
    drawBanner(ctx, state);
    if (state.mode === 'paused') drawPaused(ctx, state);
  } else if (state.mode === 'over') {
    drawGameOver(ctx, state);
  } else if (state.mode === 'win') {
    drawVictory(ctx, state);
  }
}

// --- screenshot scenes ------------------------------------------------------------

const params = new URLSearchParams(window.location.search);
const shotScene = params.get('shot');
let shotReadyFrames = -1; // frames still to render before __shotReady

function botControls() {
  const p = state.player;
  let target = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      target = e;
    }
  }
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  const ang = Math.atan2(p.y - cy, p.x - cx) + Math.PI / 2;
  return {
    moveX: Math.cos(ang) * 0.8 - (p.x - cx) / 900,
    moveY: Math.sin(ang) * 0.8 - (p.y - cy) / 900,
    aimX: target ? target.x : cx,
    aimY: target ? target.y : cy,
    firing: true,
    dash: false,
  };
}

function setupShot(scene) {
  seedRandom(Number.parseInt(params.get('seed') || '1', 10) || 1);
  // Rebuild the seeded scenery now the stream is deterministic.
  state.background = createBackground(WIDTH, HEIGHT);
  state.fireflies = createFireflies(22, WIDTH, HEIGHT);

  if (scene === 'title') {
    shotReadyFrames = 50;
  } else if (scene === 'play') {
    startRun();
    for (let i = 0; i < 230; i++) stepGame(STEP, botControls());
    if (state.mode !== 'playing') {
      state.mode = 'playing';
      state.player.hp = 4;
    }
    state.player.hp = Math.max(state.player.hp, 4);
    state.combo = 14;
    state.comboT = 2.4;
    state.banner = null;
    dropNectar(state, state.player.x + 60, state.player.y - 30, 3);
    shotReadyFrames = 8;
  } else if (scene === 'over') {
    startRun();
    const idle = { moveX: 0, moveY: 0, aimX: WIDTH / 2, aimY: 0, firing: false, dash: false };
    for (let i = 0; i < 100; i++) stepGame(STEP, idle);
    state.score = 8730;
    state.kills = 132;
    state.nectar = 214;
    state.wave = 7;
    state.time = 196.4;
    state.best = 9100;
    state.mode = 'over';
    shotReadyFrames = 8;
  } else if (scene === 'win') {
    state.score = 12480;
    state.kills = 214;
    state.nectar = 486;
    state.wave = FINAL_WAVE;
    state.time = 342.5;
    state.best = 12480;
    state.mode = 'win';
    for (let i = 0; i < 6; i++) {
      spawnPetals(state, 160 + i * 190, 150 + (i % 3) * 130, 9);
    }
    shotReadyFrames = 10;
  }
}

if (shotScene) setupShot(shotScene);

// --- the loop -----------------------------------------------------------------------

let lastStamp = performance.now();
let accumulator = 0;

function frame(stamp) {
  const realDt = Math.min(0.1, (stamp - lastStamp) / 1000);
  lastStamp = stamp;
  state.now += realDt;

  if (input.anyGesture) sound.unlock();
  handleModeKeys();

  if (state.mode === 'playing') {
    accumulator += realDt;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      stepGame(STEP, readControls());
      accumulator -= STEP;
      steps += 1;
      if (state.mode !== 'playing') {
        accumulator = 0;
        break;
      }
    }
  } else {
    // Screens still breathe: particles settle, petals fall.
    updateParticles(state, realDt);
    updateFloatTexts(state, realDt);
  }
  updateShake(state, realDt);
  if (state.mode === 'playing') {
    updateParticles(state, realDt);
    updateFloatTexts(state, realDt);
  }

  render();
  input.endFrame();

  if (shotReadyFrames > 0) {
    shotReadyFrames -= 1;
    if (shotReadyFrames === 0) window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
