// render.js — the night garden itself: a pre-rendered backdrop, ambient
// fireflies, glow helpers and the two kinds of shot in flight.
//
// The backdrop is painted once into an offscreen canvas (it never changes
// during a run), so the per-frame cost of the scene is one drawImage plus
// the vignette. Everything is drawn in code — there are no image assets.

import { rand, chance } from './rng.js';

export function drawGlowCircle(ctx, x, y, radius, color, alpha = 0.5) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function createBackground(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#0a0e27');
  sky.addColorStop(0.55, '#101736');
  sky.addColorStop(1, '#0a1122');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // The moon, high over the garden, and its halo.
  drawGlowCircle(ctx, width * 0.82, height * 0.14, 190, '#cdd8ff', 0.16);
  ctx.fillStyle = '#e8edff';
  ctx.beginPath();
  ctx.arc(width * 0.82, height * 0.14, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,175,220,0.5)';
  ctx.beginPath();
  ctx.arc(width * 0.82 - 10, height * 0.14 - 6, 6, 0, Math.PI * 2);
  ctx.arc(width * 0.82 + 9, height * 0.14 + 11, 4, 0, Math.PI * 2);
  ctx.fill();

  // Stars.
  for (let i = 0; i < 130; i++) {
    ctx.globalAlpha = rand(0.15, 0.8);
    ctx.fillStyle = '#dfe7ff';
    const s = rand(0.6, 1.9);
    ctx.fillRect(rand(width), rand(height * 0.62), s, s);
  }
  ctx.globalAlpha = 1;

  // Ground speckles and dew.
  for (let i = 0; i < 260; i++) {
    ctx.globalAlpha = rand(0.04, 0.13);
    ctx.fillStyle = chance(0.5) ? '#7fd4a8' : '#a8c8ff';
    ctx.beginPath();
    ctx.arc(rand(width), rand(height), rand(0.8, 2.4), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Tiny night flowers scattered over the lawn.
  const petalColors = ['#ff9de2', '#b49aff', '#7df0ff', '#ffd76a'];
  for (let i = 0; i < 46; i++) {
    const x = rand(30, width - 30);
    const y = rand(30, height - 30);
    ctx.fillStyle = petalColors[i % petalColors.length];
    ctx.globalAlpha = 0.55;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // The hedge: a soft dark border of leaves the moth cannot cross.
  ctx.strokeStyle = 'rgba(6, 16, 12, 0.9)';
  ctx.lineWidth = 34;
  ctx.strokeRect(0, 0, width, height);
  for (let i = 0; i < 380; i++) {
    const side = i % 4;
    let x;
    let y;
    if (side === 0) { x = rand(width); y = rand(20); }
    else if (side === 1) { x = rand(width); y = height - rand(20); }
    else if (side === 2) { x = rand(20); y = rand(height); }
    else { x = width - rand(20); y = rand(height); }
    ctx.fillStyle = `rgba(${20 + rand(30)}, ${70 + rand(50)}, ${40 + rand(30)}, 0.8)`;
    ctx.beginPath();
    ctx.ellipse(x, y, rand(4, 9), rand(2.5, 5), rand(Math.PI), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(140, 255, 190, 0.14)';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, width - 36, height - 36);

  return canvas;
}

export function createVignette(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(
    width / 2, height / 2, height * 0.42,
    width / 2, height / 2, height * 0.95,
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(2,3,10,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  return canvas;
}

export function createFireflies(count, width, height) {
  const flies = [];
  for (let i = 0; i < count; i++) {
    flies.push({
      x: rand(width),
      y: rand(height),
      phase: rand(Math.PI * 2),
      speed: rand(0.3, 0.9),
      drift: rand(6, 20),
    });
  }
  return flies;
}

export function drawFireflies(ctx, flies, now) {
  for (const fly of flies) {
    const x = fly.x + Math.sin(now * fly.speed + fly.phase) * fly.drift;
    const y = fly.y + Math.cos(now * fly.speed * 0.8 + fly.phase * 1.7) * fly.drift * 0.6;
    const glow = 0.35 + 0.65 * Math.abs(Math.sin(now * 0.9 + fly.phase * 2.3));
    drawGlowCircle(ctx, x, y, 12, '#ffe98a', 0.35 * glow);
    ctx.globalAlpha = glow;
    ctx.fillStyle = '#ffedb0';
    ctx.beginPath();
    ctx.arc(x, y, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Player shots are teardrops of light; enemy shots are violet embers.
export function drawBullets(ctx, state) {
  for (const b of state.bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.fillStyle = '#ffd76a';
    ctx.shadowColor = '#ffb52e';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.ellipse(1.5, 0, 3.6, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const b of state.enemyBullets) {
    ctx.fillStyle = '#c77dff';
    ctx.shadowColor = '#9d4edd';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#efd9ff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}
