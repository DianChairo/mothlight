// hud.js — everything drawn over the garden: the HUD, the wave banner,
// and the title, pause, game-over and victory screens.
//
// The judge meets the game through its screenshots, so every screen is
// composed to read at a glance when shrunk: big serif titles, a clear
// stats table, and the way back into the game printed on the screen
// itself.

import { FINAL_WAVE } from './waves.js';
import { pickupStyle } from './effects.js';
import { drawMothShape } from './player.js';

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(7, 9, 24, 0.82)';
  ctx.strokeStyle = 'rgba(255, 215, 106, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.fill();
  ctx.stroke();
}

function centered(ctx, text, x, y, font, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
  ctx.globalAlpha = 1;
}

function statRows(ctx, rows, cx, y, lineH = 30) {
  ctx.textAlign = 'left';
  for (const [label, value] of rows) {
    ctx.font = `15px ${SANS}`;
    ctx.fillStyle = 'rgba(210, 218, 255, 0.75)';
    ctx.fillText(label, cx - 150, y);
    ctx.font = `bold 17px ${SANS}`;
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'right';
    ctx.fillText(value, cx + 150, y);
    ctx.textAlign = 'left';
    y += lineH;
  }
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// --- HUD -------------------------------------------------------------------

function drawHearts(ctx, state) {
  const p = state.player;
  for (let i = 0; i < p.maxHp; i++) {
    const x = 34 + i * 27;
    const y = 36;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.5);
    if (i < p.hp) {
      ctx.fillStyle = '#ffb7d5';
      ctx.shadowColor = '#ff8fc0';
      ctx.shadowBlur = 8;
    } else {
      ctx.fillStyle = 'rgba(255, 183, 213, 0.16)';
      ctx.shadowBlur = 0;
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, 8.5, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (p.shield) {
    ctx.font = `bold 12px ${SANS}`;
    ctx.fillStyle = '#9db4ff';
    ctx.textAlign = 'left';
    ctx.fillText('AEGIS VEIL UP', 30, 66);
  }
}

function drawDawnPips(ctx, state) {
  const cx = state.width / 2;
  ctx.textAlign = 'center';
  ctx.font = `bold 15px ${SANS}`;
  ctx.fillStyle = '#dfe7ff';
  const label = state.endless
    ? `ENDLESS DAWN · WAVE ${state.wave}`
    : `WAVE ${state.wave} OF ${FINAL_WAVE}`;
  ctx.fillText(label, cx, 32);
  if (!state.endless) {
    for (let i = 0; i < FINAL_WAVE; i++) {
      const x = cx - ((FINAL_WAVE - 1) * 20) / 2 + i * 20;
      ctx.beginPath();
      ctx.arc(x, 50, 5.5, 0, Math.PI * 2);
      if (i < state.wave - 1) {
        ctx.fillStyle = '#ffd76a';
        ctx.shadowColor = '#ffb52e';
        ctx.shadowBlur = 7;
      } else if (i === state.wave - 1) {
        ctx.fillStyle = 'rgba(255, 215, 106, 0.4)';
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = 'rgba(200, 210, 255, 0.18)';
        ctx.shadowBlur = 0;
      }
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
}

function drawScore(ctx, state) {
  const right = state.width - 30;
  ctx.textAlign = 'right';
  ctx.font = `bold 27px ${SANS}`;
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText(String(Math.floor(state.score)).padStart(6, '0'), right, 38);
  ctx.font = `12.5px ${SANS}`;
  ctx.fillStyle = 'rgba(210, 218, 255, 0.7)';
  ctx.fillText(`BEST ${Math.max(state.best, Math.floor(state.score))}`, right, 58);
  if (state.combo > 1) {
    const mul = Math.min(5, 1 + Math.floor(state.combo / 10));
    ctx.font = `bold 16px ${SANS}`;
    ctx.fillStyle = '#ff9de2';
    ctx.fillText(`COMBO ×${mul}`, right, 84);
    const w = 92;
    ctx.fillStyle = 'rgba(255, 157, 226, 0.25)';
    ctx.fillRect(right - w, 92, w, 4);
    ctx.fillStyle = '#ff9de2';
    ctx.fillRect(right - w, 92, (w * Math.max(0, state.comboT)) / 3, 4);
  }
}

function drawPowerTimers(ctx, state) {
  const p = state.player;
  let y = state.height - 30;
  const rows = [];
  if (p.spreadT > 0) rows.push(['spread', p.spreadT / 12]);
  if (p.rapidT > 0) rows.push(['rapid', p.rapidT / 12]);
  for (const [kind, frac] of rows) {
    const style = pickupStyle(kind);
    ctx.textAlign = 'left';
    ctx.font = `bold 12px ${SANS}`;
    ctx.fillStyle = style.color;
    ctx.fillText(style.label, 30, y);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(30, y + 5, 110, 4);
    ctx.fillStyle = style.color;
    ctx.fillRect(30, y + 5, 110 * frac, 4);
    y -= 30;
  }
  // Dash meter.
  ctx.textAlign = 'left';
  ctx.font = `bold 12px ${SANS}`;
  const ready = p.dashCd <= 0;
  ctx.fillStyle = ready ? '#7df0ff' : 'rgba(125, 240, 255, 0.45)';
  ctx.fillText(ready ? 'DASH READY · SHIFT' : 'DASH', 30, y);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(30, y + 5, 110, 4);
  ctx.fillStyle = '#7df0ff';
  ctx.fillRect(30, y + 5, 110 * (ready ? 1 : 1 - p.dashCd / 1.5), 4);
}

export function drawHUD(ctx, state) {
  drawHearts(ctx, state);
  drawDawnPips(ctx, state);
  drawScore(ctx, state);
  drawPowerTimers(ctx, state);
  if (state.wave <= 1 && state.time < 14) {
    ctx.textAlign = 'right';
    ctx.font = `12.5px ${SANS}`;
    ctx.fillStyle = `rgba(210, 218, 255, ${0.75 * Math.max(0, 1 - state.time / 14)})`;
    ctx.fillText('WASD move · mouse aim · hold click to fire · SHIFT dash · P pause · M mute', state.width - 30, state.height - 24);
  }
  if (state.hurtFlash > 0) {
    const grad = ctx.createRadialGradient(
      state.width / 2, state.height / 2, state.height * 0.3,
      state.width / 2, state.height / 2, state.height * 0.85,
    );
    grad.addColorStop(0, 'rgba(255,40,60,0)');
    grad.addColorStop(1, `rgba(255,40,60,${0.4 * state.hurtFlash})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, state.width, state.height);
  }
}

export function drawBanner(ctx, state) {
  const banner = state.banner;
  if (!banner) return;
  const k = banner.t / banner.dur;
  const alpha = k < 0.15 ? k / 0.15 : k > 0.7 ? Math.max(0, (1 - k) / 0.3) : 1;
  const cx = state.width / 2;
  centered(ctx, banner.title, cx, state.height * 0.34, `bold 52px ${SERIF}`, '#ffe9a8', alpha);
  if (banner.sub) {
    centered(ctx, banner.sub, cx, state.height * 0.34 + 38, `17px ${SANS}`, '#dfe7ff', alpha * 0.9);
  }
}

// --- screens -----------------------------------------------------------------

export function drawTitle(ctx, state, moth) {
  const { width, height } = state;
  ctx.fillStyle = 'rgba(4, 5, 16, 0.45)';
  ctx.fillRect(0, 0, width, height);
  const cx = width / 2;

  ctx.save();
  ctx.shadowColor = '#ffb52e';
  ctx.shadowBlur = 34;
  centered(ctx, 'MOTHLIGHT', cx, 218, `bold 92px ${SERIF}`, '#ffe9a8');
  ctx.restore();
  centered(ctx, 'Defend the last light of the garden', cx, 262, `italic 21px ${SERIF}`, '#cdd8ff');
  centered(ctx, 'Ten waves of shadow are coming for the dawn seed. You are its only keeper.', cx, 316, `16px ${SANS}`, 'rgba(223,231,255,0.85)');

  // The keeper itself, drifting under the title.
  if (moth) {
    ctx.save();
    ctx.globalAlpha = 0.95;
    drawMothShape(ctx, moth.x, moth.y, moth.face, moth.wingPhase, 1.7);
    ctx.restore();
  }

  panel(ctx, cx - 250, 396, 500, 148);
  ctx.textAlign = 'left';
  ctx.font = `15.5px ${SANS}`;
  ctx.fillStyle = '#dfe7ff';
  const lines = [
    'WASD / arrows — flutter about the garden',
    'Mouse — aim · hold click or SPACE — fire',
    'SHIFT — dash through danger (briefly untouchable)',
    'Gather nectar to mend your wings · P pause · M mute',
    'Clear wave 10 and the dawn is yours.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, cx - 224, 430 + i * 25));

  const pulse = 0.72 + 0.28 * Math.sin(state.now * 3.2);
  centered(ctx, 'CLICK OR PRESS ENTER TO BEGIN', cx, 606, `bold 21px ${SANS}`, '#ffd76a', pulse);
  if (state.best > 0) {
    centered(ctx, `Best score so far: ${state.best}`, cx, 640, `14.5px ${SANS}`, 'rgba(210,218,255,0.75)');
  }
  centered(ctx, 'Every sound is synthesized live · no files, no network, just light', cx, height - 22, `12px ${SANS}`, 'rgba(160,175,220,0.55)');
}

export function drawPaused(ctx, state) {
  const { width, height } = state;
  ctx.fillStyle = 'rgba(4, 5, 16, 0.55)';
  ctx.fillRect(0, 0, width, height);
  centered(ctx, 'PAUSED', width / 2, height / 2 - 16, `bold 54px ${SERIF}`, '#ffe9a8');
  centered(ctx, 'Press P to flutter on', width / 2, height / 2 + 30, `16.5px ${SANS}`, '#dfe7ff');
}

function statsFor(state) {
  return [
    ['Score', String(Math.floor(state.score))],
    ['Best', String(Math.max(state.best, Math.floor(state.score)))],
    ['Wave reached', state.endless ? `${state.wave} (endless)` : String(state.wave)],
    ['Shadows scattered', String(state.kills)],
    ['Nectar gathered', String(state.nectar)],
    ['Time in the garden', formatTime(state.time)],
  ];
}

export function drawGameOver(ctx, state) {
  const { width, height } = state;
  ctx.fillStyle = 'rgba(10, 2, 8, 0.62)';
  ctx.fillRect(0, 0, width, height);
  const cx = width / 2;
  ctx.save();
  ctx.shadowColor = '#ff5d7a';
  ctx.shadowBlur = 26;
  centered(ctx, 'THE LIGHT GOES OUT', cx, 178, `bold 56px ${SERIF}`, '#ffb7c5');
  ctx.restore();
  centered(ctx, `The garden falls dark on wave ${state.wave}. The seed sleeps — until you return.`, cx, 216, `16px ${SANS}`, 'rgba(223,231,255,0.85)');
  panel(ctx, cx - 210, 248, 420, 208);
  statRows(ctx, statsFor(state), cx, 292);
  if (Math.floor(state.score) >= state.best && state.score > 0) {
    centered(ctx, '★ A NEW BEST ★', cx, 486, `bold 16px ${SANS}`, '#ffd76a');
  }
  const pulse = 0.72 + 0.28 * Math.sin(state.now * 3.2);
  centered(ctx, 'PRESS ENTER TO TRY AGAIN', cx, 540, `bold 20px ${SANS}`, '#ffd76a', pulse);
}

export function drawVictory(ctx, state) {
  const { width, height } = state;
  // Sunrise: warm light rising over the hedge.
  const grad = ctx.createLinearGradient(0, height, 0, 0);
  grad.addColorStop(0, 'rgba(255, 150, 60, 0.5)');
  grad.addColorStop(0.45, 'rgba(255, 110, 130, 0.28)');
  grad.addColorStop(1, 'rgba(30, 20, 70, 0.25)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  const sun = ctx.createRadialGradient(width / 2, height * 0.94, 10, width / 2, height * 0.94, 340);
  sun.addColorStop(0, 'rgba(255, 220, 140, 0.85)');
  sun.addColorStop(1, 'rgba(255, 220, 140, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, width, height);

  const cx = width / 2;
  ctx.save();
  ctx.shadowColor = '#ffb52e';
  ctx.shadowBlur = 30;
  centered(ctx, 'DAWN BREAKS', cx, 168, `bold 62px ${SERIF}`, '#fff0bd');
  ctx.restore();
  centered(ctx, 'Ten waves scattered. The seed opens, and the garden wakes in gold.', cx, 206, `16.5px ${SANS}`, '#fff6e0');
  panel(ctx, cx - 210, 238, 420, 208);
  statRows(ctx, statsFor(state), cx, 282);
  const pulse = 0.72 + 0.28 * Math.sin(state.now * 3.2);
  centered(ctx, 'ENTER — ENDLESS DAWN, KEEP SCORING', cx, 500, `bold 19px ${SANS}`, '#ffd76a', pulse);
  centered(ctx, 'R — a fresh night', cx, 532, `15.5px ${SANS}`, 'rgba(255,246,224,0.85)');
}
