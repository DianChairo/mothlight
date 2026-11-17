// waves.js — the ten waves of the night, and the endless ones after.
//
// Each wave is a recipe of creature kinds. The recipe is shuffled into a
// spawn queue and fed into the garden one portal at a time from the hedge,
// always far from the moth, so pressure builds steadily instead of landing
// all at once. Clearing wave 10 wins the game; endless waves scale the
// recipe up forever.

import { rand, shuffle } from './rng.js';
import { createEnemy } from './enemies.js';

const WAVE_RECIPES = [
  { mite: 6 },
  { mite: 9, darter: 2 },
  { mite: 11, darter: 4 },
  { mite: 12, darter: 4, brood: 2 },
  { mite: 13, darter: 6, brood: 2, spitter: 2 },
  { mite: 15, darter: 7, brood: 3, spitter: 3 },
  { mite: 17, darter: 9, brood: 3, spitter: 4 },
  { mite: 19, darter: 10, brood: 4, spitter: 5 },
  { mite: 21, darter: 12, brood: 5, spitter: 6 },
  { mite: 24, darter: 14, brood: 6, spitter: 8 },
];

export const FINAL_WAVE = WAVE_RECIPES.length;

export function waveRecipe(wave) {
  if (wave <= FINAL_WAVE) return WAVE_RECIPES[wave - 1];
  const scale = 1 + (wave - FINAL_WAVE) * 0.16;
  const last = WAVE_RECIPES[FINAL_WAVE - 1];
  const out = {};
  for (const kind of Object.keys(last)) out[kind] = Math.round(last[kind] * scale);
  return out;
}

export function startWave(state, wave) {
  state.wave = wave;
  const recipe = waveRecipe(wave);
  const queue = [];
  for (const [kind, count] of Object.entries(recipe)) {
    for (let i = 0; i < count; i++) queue.push(kind);
  }
  state.spawnQueue = shuffle(queue);
  state.spawnTimer = 0.4;
  state.spawnInterval = Math.max(0.34, 0.95 - wave * 0.05);
  state.banner = {
    title: wave > FINAL_WAVE ? `ENDLESS WAVE ${wave}` : `WAVE ${wave}`,
    sub: wave === 1
      ? 'Hold the garden until dawn'
      : wave === FINAL_WAVE
        ? 'The last wave — bring back the dawn'
        : '',
    t: 0,
    dur: 2.3,
  };
  state.sound?.waveHorn();
}

function spawnPoint(state) {
  const { width, height, player } = state;
  let x = 0;
  let y = 0;
  for (let tries = 0; tries < 12; tries++) {
    const side = Math.floor(rand(4));
    if (side === 0) { x = rand(50, width - 50); y = 46; }
    else if (side === 1) { x = rand(50, width - 50); y = height - 46; }
    else if (side === 2) { x = 46; y = rand(50, height - 50); }
    else { x = width - 46; y = rand(50, height - 50); }
    if (Math.hypot(x - player.x, y - player.y) > 240) break;
  }
  return { x, y };
}

export function updateSpawning(state, dt) {
  if (state.spawnQueue.length > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = state.spawnInterval * rand(0.75, 1.25);
      const kind = state.spawnQueue.shift();
      const point = spawnPoint(state);
      state.portals.push({ x: point.x, y: point.y, kind, t: 0.6 });
    }
  }
  for (let i = state.portals.length - 1; i >= 0; i--) {
    const portal = state.portals[i];
    portal.t -= dt;
    if (portal.t <= 0) {
      state.portals.splice(i, 1);
      state.enemies.push(createEnemy(portal.kind, portal.x, portal.y, state.wave));
    }
  }
}

export function waveCleared(state) {
  return state.spawnQueue.length === 0 && state.portals.length === 0 && state.enemies.length === 0;
}
