// effects.js — particles, floating score text, screen shake, nectar orbs
// and power-up drops: the layer that makes every action answer back.
//
// Nothing here knows the rules of the game. main.js spawns effects when
// things happen; this file only moves and draws them.

import { rand, chance } from './rng.js';

export const PICKUP_KINDS = ['spread', 'rapid', 'shield', 'bloom', 'burst'];

const PICKUP_STYLE = {
  spread: { color: '#ff9de2', glyph: 'W', label: 'WIDE WINGS' },
  rapid: { color: '#7df0ff', glyph: 'R', label: 'RAPID FIRE' },
  shield: { color: '#9db4ff', glyph: 'S', label: 'AEGIS VEIL' },
  bloom: { color: '#8dff9d', glyph: '+', label: 'BLOOM HEART' },
  burst: { color: '#ffd76a', glyph: 'B', label: 'LANTERN BURST' },
};

export function pickupStyle(kind) {
  return PICKUP_STYLE[kind];
}

// --- particles -----------------------------------------------------------

export function spawnBurst(state, x, y, color, count = 14, speed = 260) {
  for (let i = 0; i < count; i++) {
    const angle = rand(Math.PI * 2);
    const v = rand(0.25, 1) * speed;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: 0,
      maxLife: rand(0.3, 0.75),
      size: rand(1.5, 3.6),
      color,
      drag: 3.2,
      shape: 'spark',
    });
  }
}

export function spawnPetals(state, x, y, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = rand(Math.PI * 2);
    const v = rand(30, 130);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v - 40,
      life: 0,
      maxLife: rand(0.7, 1.4),
      size: rand(2.5, 5),
      color: '#ffb7d5',
      drag: 1.2,
      shape: 'petal',
      spin: rand(-4, 4),
      rot: rand(Math.PI * 2),
    });
  }
}

export function spawnTrailDot(state, x, y, color, size = 5, life = 0.35) {
  state.particles.push({
    x,
    y,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: life,
    size,
    color,
    drag: 0,
    shape: 'glow',
  });
}

export function updateParticles(state, dt) {
  const list = state.particles;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life += dt;
    if (p.life >= p.maxLife) {
      list.splice(i, 1);
      continue;
    }
    const dragK = Math.max(0, 1 - p.drag * dt);
    p.vx *= dragK;
    p.vy *= dragK;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.rot !== undefined) p.rot += p.spin * dt;
  }
}

export function drawParticles(ctx, state) {
  for (const p of state.particles) {
    const fade = 1 - p.life / p.maxLife;
    ctx.globalAlpha = fade;
    ctx.fillStyle = p.color;
    if (p.shape === 'petal') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot || 0);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (p.shape === 'glow') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * fade + 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;
}

// --- floating text ---------------------------------------------------------

export function spawnFloatText(state, x, y, text, color = '#ffe9a8', size = 16) {
  state.floatTexts.push({ x, y, vy: -46, life: 0, maxLife: 0.9, text, color, size });
}

export function updateFloatTexts(state, dt) {
  const list = state.floatTexts;
  for (let i = list.length - 1; i >= 0; i--) {
    const t = list[i];
    t.life += dt;
    t.y += t.vy * dt;
    if (t.life >= t.maxLife) list.splice(i, 1);
  }
}

export function drawFloatTexts(ctx, state) {
  ctx.textAlign = 'center';
  for (const t of state.floatTexts) {
    const fade = 1 - t.life / t.maxLife;
    ctx.globalAlpha = Math.min(1, fade * 1.6);
    ctx.font = `bold ${t.size}px system-ui, sans-serif`;
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

// --- screen shake ----------------------------------------------------------

export function addShake(state, magnitude, duration = 0.25) {
  if (magnitude > state.shake.mag || state.shake.t <= 0) {
    state.shake.mag = magnitude;
    state.shake.dur = duration;
    state.shake.t = duration;
  }
}

export function updateShake(state, dt) {
  if (state.shake.t > 0) state.shake.t = Math.max(0, state.shake.t - dt);
}

export function shakeOffset(state) {
  if (state.shake.t <= 0) return { x: 0, y: 0 };
  const k = (state.shake.t / state.shake.dur) * state.shake.mag;
  return { x: rand(-k, k), y: rand(-k, k) };
}

// --- nectar orbs -------------------------------------------------------------

export function dropNectar(state, x, y, count = 1) {
  for (let i = 0; i < count; i++) {
    const angle = rand(Math.PI * 2);
    const v = rand(40, 150);
    state.orbs.push({
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      t: rand(10),
      life: 9,
    });
  }
}

// Orbs drift, then fly to the moth when it comes close. Collection is
// reported through state.addScore so main.js owns the score and the
// every-25-nectar heal.
export function updateOrbs(state, dt) {
  const player = state.player;
  const list = state.orbs;
  for (let i = list.length - 1; i >= 0; i--) {
    const orb = list[i];
    orb.t += dt;
    orb.life -= dt;
    if (orb.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    const dx = player.x - orb.x;
    const dy = player.y - orb.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 150) {
      const pull = 620 * (1 - dist / 170);
      orb.vx += (dx / (dist || 1)) * pull * dt * 4;
      orb.vy += (dy / (dist || 1)) * pull * dt * 4;
    }
    orb.vx *= Math.max(0, 1 - 2.4 * dt);
    orb.vy *= Math.max(0, 1 - 2.4 * dt);
    orb.x += orb.vx * dt;
    orb.y += orb.vy * dt;
    if (dist < 30) {
      list.splice(i, 1);
      state.nectar += 1;
      if (state.addScore) state.addScore(10, orb.x, orb.y, false);
      if (state.sound) state.sound.pickup();
    }
  }
}

export function drawOrbs(ctx, state, now) {
  for (const orb of state.orbs) {
    const pulse = 1 + Math.sin(now * 6 + orb.t * 4) * 0.18;
    const blink = orb.life < 2 ? (Math.sin(now * 18) > 0 ? 1 : 0.25) : 1;
    ctx.globalAlpha = blink;
    ctx.fillStyle = '#ffd76a';
    ctx.shadowColor = '#ffb52e';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, 5 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(orb.x - 1.5, orb.y - 1.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// --- power-up drops ----------------------------------------------------------

export function maybeDropPickup(state, x, y) {
  if (!chance(0.085)) return;
  const kinds = PICKUP_KINDS.filter((kind) => {
    if (kind === 'bloom' && state.player.hp >= state.player.maxHp) return false;
    if (kind === 'shield' && state.player.shield) return false;
    return true;
  });
  if (kinds.length === 0) return;
  const kind = kinds[Math.floor(rand(kinds.length))];
  state.pickups.push({ x, y, kind, t: rand(10), life: 10 });
}

export function updatePickups(state, dt) {
  const list = state.pickups;
  for (let i = list.length - 1; i >= 0; i--) {
    list[i].t += dt;
    list[i].life -= dt;
    if (list[i].life <= 0) list.splice(i, 1);
  }
}

export function drawPickups(ctx, state, now) {
  for (const drop of state.pickups) {
    const style = PICKUP_STYLE[drop.kind];
    const bob = Math.sin(now * 3 + drop.t * 2) * 3;
    const blink = drop.life < 2.5 ? (Math.sin(now * 16) > 0 ? 1 : 0.3) : 1;
    ctx.globalAlpha = blink;
    ctx.save();
    ctx.translate(drop.x, drop.y + bob);
    ctx.fillStyle = 'rgba(10, 12, 30, 0.85)';
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = style.color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = style.color;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.glyph, 0, 1);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'alphabetic';
}
