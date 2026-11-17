// storage.js — the best score, kept in localStorage.
//
// Wrapped in try/catch on both sides: private windows and file:// pages can
// refuse storage, and a refused best score must never break the game.

const BEST_KEY = 'mothlight.bestScore.v1';

export function loadBestScore() {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    const value = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function saveBestScore(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(Math.floor(score)));
  } catch {
    // Storage refused: the run still counts, it just is not remembered.
  }
}
