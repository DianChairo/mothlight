// player.js — the moth of light: movement, dash, firing and drawing.
//
// The moth is steered by a controls object built fresh each frame in
// main.js ({moveX, moveY, aimX, aimY, firing, dash}) so the same code path
// serves the real keyboard and mouse, and the scripted pilot that flies
// the screenshot scenes.

import { spawnTrailDot } from './effects.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 14,
    hp: 5,
    maxHp: 5,
    face: -Math.PI / 2,
    fireCd: 0,
    dashT: 0,
    dashCd: 0,
    invulnT: 0,
    spreadT: 0,
    rapidT: 0,
    shield: false,
    wingPhase: 0,
    trailT: 0,
  };
}

const SPEED = 268;
const DASH_SPEED = 900;

export function updatePlayer(state, dt, controls) {
  const p = state.player;

  p.fireCd = Math.max(0, p.fireCd - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.invulnT = Math.max(0, p.invulnT - dt);
  p.spreadT = Math.max(0, p.spreadT - dt);
  p.rapidT = Math.max(0, p.rapidT - dt);

  const moveLen = Math.hypot(controls.moveX, controls.moveY);
  const mx = moveLen > 0 ? controls.moveX / moveLen : 0;
  const my = moveLen > 0 ? controls.moveY / moveLen : 0;

  // Dash: a short burst along the move direction (or the aim, standing
  // still), untouchable while it lasts, on a 1.5 s cooldown.
  if (controls.dash && p.dashCd <= 0 && p.dashT <= 0) {
    const dx = moveLen > 0 ? mx : Math.cos(p.face);
    const dy = moveLen > 0 ? my : Math.sin(p.face);
    p.dashT = 0.16;
    p.dashCd = 1.5;
    p.invulnT = Math.max(p.invulnT, 0.24);
    p.vx = dx * DASH_SPEED;
    p.vy = dy * DASH_SPEED;
    state.sound?.dash();
  }

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.trailT -= dt;
    if (p.trailT <= 0) {
      p.trailT = 0.018;
      spawnTrailDot(state, p.x, p.y, '#ffd76a', 10, 0.3);
    }
  } else {
    const blend = Math.min(1, 14 * dt);
    p.vx += (mx * SPEED - p.vx) * blend;
    p.vy += (my * SPEED - p.vy) * blend;
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = Math.max(30, Math.min(state.width - 30, p.x));
  p.y = Math.max(30, Math.min(state.height - 30, p.y));

  p.face = Math.atan2(controls.aimY - p.y, controls.aimX - p.x);
  const speedNow = Math.hypot(p.vx, p.vy);
  p.wingPhase += dt * (8 + speedNow * 0.055);

  // Firing: golden bolts toward the aim. Spread wings triple the fan,
  // rapid fire shortens the cooldown; both are timed power-ups.
  if (controls.firing && p.fireCd <= 0) {
    p.fireCd = p.rapidT > 0 ? 0.105 : 0.185;
    const spreadAngles = p.spreadT > 0 ? [-0.17, 0, 0.17] : [0];
    for (const offset of spreadAngles) {
      const a = p.face + offset;
      state.bullets.push({
        x: p.x + Math.cos(p.face) * 18,
        y: p.y + Math.sin(p.face) * 18,
        vx: Math.cos(a) * 660,
        vy: Math.sin(a) * 660,
        life: 0.95,
        radius: 5,
        dmg: 1,
      });
    }
    state.sound?.shoot();
  }
}

// The moth shape on its own, so the title and victory screens can show it
// drifting without a live player behind them.
export function drawMothShape(ctx, x, y, face, wingPhase, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const flap = Math.sin(wingPhase) * 0.55;
  ctx.fillStyle = 'rgba(255, 215, 106, 0.30)';
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * (0.85 + flap * 0.5));
    ctx.beginPath();
    ctx.ellipse(side * 13, -3, 15, 7.5, side * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.rotate(side * (0.5 - flap * 0.35));
    ctx.beginPath();
    ctx.ellipse(side * 10, 7, 10.5, 5.5, side * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.rotate(face + Math.PI / 2);
  const body = ctx.createLinearGradient(0, -14, 0, 14);
  body.addColorStop(0, '#ffe9a8');
  body.addColorStop(1, '#e8963c');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 6.4, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(0, -11, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e8963c';
  ctx.lineWidth = 1.6;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 2.4, -14);
    ctx.quadraticCurveTo(side * 8, -22, side * 12, -20);
    ctx.stroke();
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.arc(side * 12, -20, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawPlayer(ctx, state, now) {
  const p = state.player;

  // Aura of light the moth carries into the dark.
  const aura = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 74);
  aura.addColorStop(0, 'rgba(255, 205, 92, 0.30)');
  aura.addColorStop(1, 'rgba(255, 205, 92, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 74, 0, Math.PI * 2);
  ctx.fill();

  if (p.invulnT > 0 && p.dashT <= 0 && Math.sin(now * 30) > 0.2) {
    ctx.globalAlpha = 0.35;
  }
  drawMothShape(ctx, p.x, p.y, p.face, p.wingPhase);
  ctx.globalAlpha = 1;

  if (p.shield) {
    ctx.strokeStyle = 'rgba(157, 180, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    ctx.lineDashOffset = -now * 26;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 25 + Math.sin(now * 4) * 1.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
