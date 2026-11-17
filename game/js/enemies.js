// enemies.js — the shadow creatures that swarm the garden, and how each
// kind hunts.
//
//   mite    — a spiked beetle that walks straight at the moth, wobbling.
//   darter  — a slim dart that circles, flashes a warning, then lunges.
//   brood   — a slow egg sac; when it bursts it splits into two mites.
//   spitter — a violet bulb that keeps its distance and spits embers.
//
// Enemies fade in through a swirl portal (state.portals, owned by waves.js)
// before they can move or be hit, so nothing ever appears on top of the
// player without warning.

import { rand } from './rng.js';

export const ENEMY_KINDS = {
  mite: { hp: 2, speed: 94, radius: 14, score: 50, color: '#8d6bff', nectar: 1 },
  darter: { hp: 2, speed: 74, radius: 12, score: 80, color: '#ff6b9d', nectar: 1 },
  brood: { hp: 7, speed: 40, radius: 25, score: 150, color: '#2dd4bf', nectar: 3 },
  spitter: { hp: 3, speed: 58, radius: 15, score: 120, color: '#c77dff', nectar: 2 },
};

export function createEnemy(kind, x, y, wave) {
  const base = ENEMY_KINDS[kind];
  const hpBonus = Math.floor((wave - 1) * 0.45);
  const hp = kind === 'mite' || kind === 'darter'
    ? base.hp + (wave >= 6 ? 1 : 0)
    : base.hp + hpBonus;
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    hp,
    maxHp: hp,
    radius: base.radius,
    score: base.score,
    color: base.color,
    nectar: base.nectar,
    t: rand(10),
    phase: rand(Math.PI * 2),
    flash: 0,
    mode: 'stalk', // darter: stalk -> warn -> lunge -> rest
    modeT: rand(0.5, 1.2),
    aimX: 0,
    aimY: 0,
    fireT: rand(1.2, 2.4),
  };
}

function steer(enemy, tx, ty, speed, dt, agility = 6) {
  const dx = tx - enemy.x;
  const dy = ty - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  const k = Math.min(1, agility * dt);
  enemy.vx += ((dx / dist) * speed - enemy.vx) * k;
  enemy.vy += ((dy / dist) * speed - enemy.vy) * k;
}

export function updateEnemies(state, dt) {
  const player = state.player;
  const list = state.enemies;

  for (const e of list) {
    e.t += dt;
    if (e.flash > 0) e.flash = Math.max(0, e.flash - dt * 6);
    const base = ENEMY_KINDS[e.kind];
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (e.kind === 'mite') {
      const wobble = Math.sin(e.t * 5 + e.phase) * 34;
      steer(e, player.x - (dy / dist) * wobble, player.y + (dx / dist) * wobble, base.speed, dt);
    } else if (e.kind === 'brood') {
      const wobble = Math.sin(e.t * 2 + e.phase) * 18;
      steer(e, player.x - (dy / dist) * wobble, player.y + (dx / dist) * wobble, base.speed, dt);
    } else if (e.kind === 'darter') {
      e.modeT -= dt;
      if (e.mode === 'stalk') {
        steer(e, player.x, player.y, base.speed, dt);
        if (e.modeT <= 0 && dist < 340) {
          e.mode = 'warn';
          e.modeT = 0.35;
          e.aimX = dx / dist;
          e.aimY = dy / dist;
        }
      } else if (e.mode === 'warn') {
        e.vx *= 0.8;
        e.vy *= 0.8;
        e.aimX = dx / dist;
        e.aimY = dy / dist;
        if (e.modeT <= 0) {
          e.mode = 'lunge';
          e.modeT = 0.32;
          e.vx = e.aimX * 470;
          e.vy = e.aimY * 470;
        }
      } else if (e.mode === 'lunge') {
        if (e.modeT <= 0) {
          e.mode = 'rest';
          e.modeT = 0.55;
        }
      } else {
        e.vx *= Math.max(0, 1 - 4 * dt);
        e.vy *= Math.max(0, 1 - 4 * dt);
        if (e.modeT <= 0) {
          e.mode = 'stalk';
          e.modeT = rand(0.7, 1.3);
        }
      }
    } else if (e.kind === 'spitter') {
      const want = 250;
      const radial = dist > want + 30 ? 1 : dist < want - 30 ? -1 : 0;
      const strafe = Math.sin(e.t * 0.9 + e.phase) > 0 ? 1 : -1;
      const tx = e.x + (dx / dist) * radial * 60 - (dy / dist) * strafe * 60;
      const ty = e.y + (dy / dist) * radial * 60 + (dx / dist) * strafe * 60;
      steer(e, tx, ty, base.speed, dt, 3.5);
      e.fireT -= dt;
      if (e.fireT <= 0 && dist < 430) {
        e.fireT = rand(1.9, 2.6);
        state.enemyBullets.push({
          x: e.x,
          y: e.y,
          vx: (dx / dist) * 265,
          vy: (dy / dist) * 265,
          life: 3.4,
          radius: 5.5,
        });
        state.sound?.hit();
      }
    }

    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.x = Math.max(24, Math.min(state.width - 24, e.x));
    e.y = Math.max(24, Math.min(state.height - 24, e.y));
  }

  // Separation: soft push so a swarm reads as bodies, not one blob.
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.radius + b.radius - 2;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < min * min) {
        const d = Math.sqrt(d2);
        const push = ((min - d) / d) * 0.5;
        a.x -= dx * push * 0.5;
        a.y -= dy * push * 0.5;
        b.x += dx * push * 0.5;
        b.y += dy * push * 0.5;
      }
    }
  }
}

// The swirl a creature steps through before it exists. Drawn from
// state.portals, which waves.js counts down.
export function drawPortals(ctx, state, now) {
  for (const portal of state.portals) {
    const base = ENEMY_KINDS[portal.kind];
    const k = 1 - portal.t / 0.6;
    ctx.save();
    ctx.translate(portal.x, portal.y);
    ctx.rotate(now * 5 + portal.x);
    ctx.globalAlpha = 0.35 + 0.65 * k;
    ctx.strokeStyle = base.color;
    ctx.lineWidth = 2.5;
    for (let arm = 0; arm < 3; arm++) {
      ctx.beginPath();
      ctx.arc(0, 0, 6 + k * base.radius * 0.9, arm * 2.1, arm * 2.1 + 1.7);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawMite(ctx, e, angle) {
  ctx.rotate(angle);
  ctx.fillStyle = '#2a1b4d';
  ctx.strokeStyle = e.color;
  ctx.lineWidth = 2;
  for (let s = 0; s < 8; s++) {
    const a = (s / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9);
    ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff5d5d';
  ctx.beginPath();
  ctx.arc(5, -4, 2.2, 0, Math.PI * 2);
  ctx.arc(5, 4, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawDarter(ctx, e, angle, now) {
  ctx.rotate(angle);
  const warning = e.mode === 'warn';
  ctx.fillStyle = warning ? '#ffd166' : '#4d1030';
  ctx.strokeStyle = e.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -8);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (warning) {
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(now * 40);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(4, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawBrood(ctx, e, now) {
  const pulse = 1 + Math.sin(e.t * 3.2) * 0.05;
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#0d3038';
  ctx.strokeStyle = e.color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(45, 212, 191, 0.5)';
  for (let i = 0; i < 3; i++) {
    const a = e.t * 0.8 + (i * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 10, Math.sin(a) * 10, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#d9fff8';
  ctx.beginPath();
  ctx.arc(0, 0, 3.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpitter(ctx, e, angle, now) {
  ctx.rotate(angle);
  ctx.fillStyle = '#33134d';
  ctx.strokeStyle = e.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const charge = 1 - Math.min(1, e.fireT / 2.2);
  ctx.fillStyle = '#9d4edd';
  ctx.beginPath();
  ctx.arc(10, 0, 4 + charge * 3.4 + Math.sin(now * 6) * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#efd9ff';
  ctx.beginPath();
  ctx.arc(10, 0, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

export function drawEnemies(ctx, state, now) {
  const player = state.player;
  for (const e of state.enemies) {
    const angle = Math.atan2(player.y - e.y, player.x - e.x);
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 10;
    if (e.kind === 'mite') drawMite(ctx, e, angle);
    else if (e.kind === 'darter') drawDarter(ctx, e, angle, now);
    else if (e.kind === 'brood') drawBrood(ctx, e, now);
    else drawSpitter(ctx, e, angle, now);
    ctx.restore();

    if (e.flash > 0) {
      ctx.globalAlpha = Math.min(0.85, e.flash);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * 0.95, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (e.maxHp >= 5 && e.hp < e.maxHp) {
      const w = e.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(e.x - e.radius, e.y - e.radius - 11, w, 4);
      ctx.fillStyle = '#2dd4bf';
      ctx.fillRect(e.x - e.radius, e.y - e.radius - 11, (w * e.hp) / e.maxHp, 4);
    }
  }
}
