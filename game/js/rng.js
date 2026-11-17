// rng.js — a tiny seedable random source.
//
// Normal play runs on Math.random. Screenshot scenes call seedRandom() so a
// scene built from ?shot=...&seed=n comes out the same on every load: the
// garden, the fireflies and the scripted fight are all drawn from this one
// stream, never from the wall clock.

let stream = Math.random;

export function seedRandom(seed) {
  let a = (seed >>> 0) || 1;
  stream = function mulberry32() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rand(min = 1, max) {
  if (max === undefined) {
    max = min;
    min = 0;
  }
  return min + stream() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

export function chance(p) {
  return stream() < p;
}

export function pick(list) {
  return list[Math.floor(stream() * list.length) % list.length];
}

export function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(stream() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
