// audio.js — every sound in Mothlight is synthesized with WebAudio.
//
// There are no audio files. Effects are small oscillator and noise gestures;
// the music is a slow generative loop (a four-chord bass walk with sparse
// pentatonic plucks) scheduled a fraction of a second ahead of the clock.
// The context stays locked until the player's first key or click, as
// browsers require, and every call is a no-op before that.

const PENTATONIC = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
const BASS_WALK = [55.0, 43.65, 65.41, 49.0]; // A1, F1, C2, G1 — one chord a bar
const PAD_CHORDS = [
  [110.0, 164.81, 261.63],
  [87.31, 130.81, 220.0],
  [130.81, 196.0, 329.63],
  [98.0, 146.83, 246.94],
];

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.musicTimer = null;
    this.nextNoteTime = 0;
    this.step = 0;
    this.melodyIndex = 3;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    this.ctx = new AudioCtor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);

    const length = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 120);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  tone({ freq, end = null, dur = 0.15, type = 'sine', gain = 0.2, delay = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (end !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, end), t0 + dur);
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.2, freq = 1200, gain = 0.2, delay = 0, sweepTo = null }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, t0);
    if (sweepTo !== null) filter.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    filter.Q.value = 0.8;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(amp).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // --- effects -----------------------------------------------------------

  shoot() {
    this.tone({ freq: 740, end: 240, dur: 0.09, type: 'square', gain: 0.05 });
  }

  hit() {
    this.noise({ dur: 0.06, freq: 2600, gain: 0.08 });
  }

  explode(big = false) {
    this.noise({ dur: big ? 0.4 : 0.22, freq: big ? 500 : 800, gain: big ? 0.3 : 0.18, sweepTo: 90 });
    this.tone({ freq: big ? 120 : 160, end: 40, dur: big ? 0.35 : 0.2, type: 'sine', gain: 0.25 });
  }

  pickup() {
    this.tone({ freq: 880, dur: 0.07, type: 'sine', gain: 0.08 });
    this.tone({ freq: 1318, dur: 0.1, type: 'sine', gain: 0.07, delay: 0.05 });
  }

  powerup() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      this.tone({ freq, dur: 0.14, type: 'triangle', gain: 0.12, delay: i * 0.06 });
    });
  }

  hurt() {
    this.tone({ freq: 300, end: 70, dur: 0.28, type: 'sawtooth', gain: 0.2 });
    this.noise({ dur: 0.2, freq: 300, gain: 0.15, sweepTo: 80 });
  }

  dash() {
    this.noise({ dur: 0.16, freq: 500, gain: 0.1, sweepTo: 2400 });
  }

  waveHorn() {
    this.tone({ freq: 196, dur: 0.4, type: 'triangle', gain: 0.16 });
    this.tone({ freq: 294, dur: 0.45, type: 'triangle', gain: 0.14, delay: 0.09 });
  }

  gameOver() {
    [392.0, 329.63, 261.63, 196.0].forEach((freq, i) => {
      this.tone({ freq, dur: 0.34, type: 'triangle', gain: 0.16, delay: i * 0.17 });
    });
  }

  victory() {
    [261.63, 329.63, 392.0, 523.25, 659.25, 783.99].forEach((freq, i) => {
      this.tone({ freq, dur: 0.3, type: 'triangle', gain: 0.14, delay: i * 0.11 });
    });
  }

  uiClick() {
    this.tone({ freq: 660, dur: 0.06, type: 'sine', gain: 0.09 });
  }

  // --- music -------------------------------------------------------------

  scheduleMusic() {
    if (!this.ctx) return;
    const stepDur = 60 / 96 / 2; // 96 BPM, eighth notes
    while (this.nextNoteTime < this.ctx.currentTime + 0.3) {
      this.playStep(this.step, this.nextNoteTime);
      this.nextNoteTime += stepDur;
      this.step = (this.step + 1) % 64; // 4 bars of 16 eighths
    }
  }

  playStep(step, t0) {
    const delay = Math.max(0, t0 - this.ctx.currentTime);
    const bar = Math.floor(step / 16);
    const inBar = step % 16;
    if (inBar === 0) {
      this.tone({ freq: BASS_WALK[bar], dur: 1.6, type: 'sine', gain: 0.16, delay });
      for (const freq of PAD_CHORDS[bar]) {
        this.tone({ freq, dur: 1.9, type: 'triangle', gain: 0.028, delay });
      }
    }
    if (inBar === 8) {
      this.tone({ freq: BASS_WALK[bar], dur: 0.8, type: 'sine', gain: 0.1, delay });
    }
    // Sparse plucked melody: a slow random walk on the pentatonic ladder.
    if (inBar % 2 === 0 && Math.random() < 0.42) {
      this.melodyIndex += Math.floor(Math.random() * 3) - 1;
      this.melodyIndex = Math.max(0, Math.min(PENTATONIC.length - 1, this.melodyIndex));
      this.tone({
        freq: PENTATONIC[this.melodyIndex],
        dur: 0.5,
        type: 'sine',
        gain: 0.05,
        delay,
      });
    }
  }
}
