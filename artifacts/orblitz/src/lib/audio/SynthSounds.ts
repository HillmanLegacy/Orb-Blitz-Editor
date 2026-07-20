// ═══════════════════════════════════════════════════════════════════════════════
// Orblitz Audio Engine — HD Modern Arcade Sound Design
// ═══════════════════════════════════════════════════════════════════════════════
//
// Architecture:
//   AudioContext
//     └─ masterCompressor (threshold −12 dB, ratio 6:1)
//        └─ masterGain (0.85)
//           ├─ dry signal path (all SFX → masterGain)
//           └─ reverb send (ConvolverNode → reverbReturn → masterGain)
//
// Design principles:
//   • Every impact has a click transient (attack), body, and tail
//   • Waveshaper distortion adds character without harsh digital clipping
//   • Resonant filter sweeps give the vintage-synth quality
//   • ±pitch randomisation prevents repetitive machine-gun feel
//   • Master compressor keeps dynamics punchy and consistent
//   • Throttles on hot paths prevent audio-thread flooding during rapid fire
// ═══════════════════════════════════════════════════════════════════════════════

// ── Audio context + master bus ────────────────────────────────────────────────

let _ctx: AudioContext | null = null;
let _masterGain: GainNode | null = null;
let _masterComp: DynamicsCompressorNode | null = null;
let _reverbNode: ConvolverNode | null = null;
let _reverbReturn: GainNode | null = null;

function getAudioContext(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') {
    _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    _setupMasterBus(_ctx);
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function _setupMasterBus(ctx: AudioContext) {
  // Compressor/limiter — punchy, consistent loudness
  _masterComp = ctx.createDynamicsCompressor();
  _masterComp.threshold.value = -12;
  _masterComp.knee.value      = 8;
  _masterComp.ratio.value     = 6;
  _masterComp.attack.value    = 0.003;
  _masterComp.release.value   = 0.15;
  _masterComp.connect(ctx.destination);

  // Master gain
  _masterGain = ctx.createGain();
  _masterGain.gain.value = 0.85;
  _masterGain.connect(_masterComp);

  // Reverb bus
  _reverbNode   = ctx.createConvolver();
  _reverbNode.buffer = _makeReverbIR(ctx, 0.9, 2.0);
  _reverbReturn = ctx.createGain();
  _reverbReturn.gain.value = 0.22;
  _reverbNode.connect(_reverbReturn);
  _reverbReturn.connect(_masterGain);
}

/** Returns the master gain node (guaranteed non-null after init). */
function dst(ctx: AudioContext): AudioNode {
  if (!_masterGain) _setupMasterBus(ctx);
  return _masterGain!;
}

/** Returns the reverb send input, or null if unavailable. */
function rev(): AudioNode | null {
  return _reverbNode;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Soft-clip waveshaper — adds harmonic saturation without harsh clipping. */
function _distCurve(amount: number): Float32Array {
  const n = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

/** Exponentially-decaying stereo noise — works as a convolution reverb IR. */
function _makeReverbIR(ctx: AudioContext, decay: number, dur: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len  = Math.ceil(rate * dur);
  const buf  = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

/** Raw white-noise AudioBuffer. */
function _makeNoiseBuf(ctx: AudioContext, dur: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len  = Math.ceil(rate * dur);
  const buf  = ctx.createBuffer(1, len, rate);
  const d    = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// ── Noise buffer pool (keyed by duration, invalidated on ctx change) ──────────

type NoiseEntry = { buf: AudioBuffer; ctx: AudioContext | null };
const _noisePool: Record<string, NoiseEntry> = {
  xs:  { buf: null!, ctx: null },   // 0.05 s – click/transient
  sm:  { buf: null!, ctx: null },   // 0.15 s – hit
  md:  { buf: null!, ctx: null },   // 0.4 s  – explosion body
  lg:  { buf: null!, ctx: null },   // 1.0 s  – sustained noise
};
const _poolDur: Record<string, number> = { xs: 0.05, sm: 0.15, md: 0.4, lg: 1.0 };

function noise(ctx: AudioContext, key: 'xs' | 'sm' | 'md' | 'lg'): AudioBuffer {
  const e = _noisePool[key];
  if (e.ctx !== ctx) { e.buf = _makeNoiseBuf(ctx, _poolDur[key]); e.ctx = ctx; }
  return e.buf;
}

// ── Per-sound throttle timestamps ─────────────────────────────────────────────
let _tShoot  = 0;   // 30 ms  – shoot
let _tHit    = 0;   // 75 ms  – hit
let _tNearM  = 0;   // 200 ms – near miss (quiet)

// ── Convenience: pitch randomisation ─────────────────────────────────────────
function _pr(semis: number): number { return Math.pow(2, semis / 12); }
function _rand(lo: number, hi: number) { return lo + Math.random() * (hi - lo); }
function _rv(semis: number): number { return _pr(_rand(-semis, semis)); }

// ─────────────────────────────────────────────────────────────────────────────
// COMBAT SOUNDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Player laser shot — crisp sci-fi plasma with pitch sweep + subtle saturation.
 */
export function playShootSound(volume = 0.25) {
  const now = performance.now();
  if (now - _tShoot < 30) return;
  _tShoot = now;
  try {
    const ctx = getAudioContext();
    const d   = dst(ctx);
    const t   = ctx.currentTime;
    const pv  = _rv(1.5);   // ±1.5 semitone pitch variation

    // Layer 1 — square body (main pitch sweep)
    const o1 = ctx.createOscillator();
    o1.type = 'square';
    o1.frequency.setValueAtTime(1400 * pv, t);
    o1.frequency.exponentialRampToValueAtTime(240 * pv, t + 0.08);

    // Layer 2 — saw harmonic (adds bite)
    const o2 = ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.setValueAtTime(700 * pv, t);
    o2.frequency.exponentialRampToValueAtTime(120 * pv, t + 0.07);

    // Layer 3 — sine click transient (sharp attack definition)
    const ck = ctx.createOscillator();
    ck.type = 'sine';
    ck.frequency.setValueAtTime(5200 * pv, t);
    ck.frequency.exponentialRampToValueAtTime(900 * pv, t + 0.012);

    // Waveshaper — subtle saturation gives the "laser" character
    const ws = ctx.createWaveShaper();
    ws.curve = _distCurve(12);

    // Lowpass sweep
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(8000, t);
    lp.frequency.exponentialRampToValueAtTime(1000, t + 0.09);
    lp.Q.value = 1.5;

    // Envelope
    const g  = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume * 0.72, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

    const gck = ctx.createGain();
    gck.gain.setValueAtTime(volume * 0.5, t);
    gck.gain.exponentialRampToValueAtTime(0.001, t + 0.018);

    o1.connect(ws); o2.connect(ws);
    ws.connect(lp); lp.connect(g); g.connect(d);
    ck.connect(gck); gck.connect(d);

    const stop = t + 0.13;
    o1.start(t); o1.stop(stop);
    o2.start(t); o2.stop(stop - 0.02);
    ck.start(t); ck.stop(t + 0.025);
  } catch (_) {}
}

/**
 * Projectile-on-orb hit — metallic crunch: distorted saw body + noise texture.
 */
export function playHitSound(volume = 0.3) {
  const now = performance.now();
  if (now - _tHit < 75) return;
  _tHit = now;
  try {
    const ctx = getAudioContext();
    const d   = dst(ctx);
    const r   = rev();
    const t   = ctx.currentTime;
    const pv  = _rv(2.5);

    // Distorted thud
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.setValueAtTime(380 * pv, t);
    o1.frequency.exponentialRampToValueAtTime(68 * pv, t + 0.14);

    const o2 = ctx.createOscillator();
    o2.type = 'square';
    o2.frequency.setValueAtTime(760 * pv, t);
    o2.frequency.exponentialRampToValueAtTime(135 * pv, t + 0.1);

    const ws = ctx.createWaveShaper();
    ws.curve = _distCurve(30);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(5000, t);
    lp.frequency.exponentialRampToValueAtTime(320, t + 0.16);
    lp.Q.value = 4.5;

    const g = ctx.createGain();
    g.gain.setValueAtTime(volume * 0.65, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    // Noise texture
    const ns = ctx.createBufferSource();
    ns.buffer = noise(ctx, 'sm');
    const nb = ctx.createBiquadFilter();
    nb.type = 'bandpass';
    nb.frequency.value = 1600;
    nb.Q.value = 1.5;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(volume * 0.35, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

    // Click transient
    const ck = ctx.createOscillator();
    ck.type = 'sine';
    ck.frequency.setValueAtTime(3200 * pv, t);
    ck.frequency.exponentialRampToValueAtTime(600 * pv, t + 0.012);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(volume * 0.55, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.018);

    o1.connect(ws); o2.connect(ws);
    ws.connect(lp); lp.connect(g); g.connect(d);
    if (r) { g.connect(r); }
    ns.connect(nb); nb.connect(ng); ng.connect(d);
    ck.connect(cg); cg.connect(d);

    const stop = t + 0.22;
    o1.start(t); o1.stop(stop);
    o2.start(t); o2.stop(stop - 0.04);
    ns.start(t); ns.stop(t + 0.14);
    ck.start(t); ck.stop(t + 0.025);
  } catch (_) {}
}

/**
 * Player projectile hits boss — heavy sub thud + metallic ring + reverb.
 */
export function playBossHitSound(volume = 0.4) {
  try {
    const ctx = getAudioContext();
    const d   = dst(ctx);
    const r   = rev();
    const t   = ctx.currentTime;

    // Sub kick: sine pitch drops to near-zero (physical impact feel)
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(95, t);
    sub.frequency.exponentialRampToValueAtTime(22, t + 0.38);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(volume * 1.1, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    // Metallic body — distorted oscillator cluster
    const om = ctx.createOscillator();
    om.type = 'sawtooth';
    om.frequency.setValueAtTime(460, t);
    om.frequency.exponentialRampToValueAtTime(90, t + 0.22);
    const om2 = ctx.createOscillator();
    om2.type = 'square';
    om2.frequency.setValueAtTime(680, t);
    om2.frequency.exponentialRampToValueAtTime(120, t + 0.18);
    const mws = ctx.createWaveShaper();
    mws.curve = _distCurve(42);
    const mlp = ctx.createBiquadFilter();
    mlp.type = 'lowpass';
    mlp.frequency.setValueAtTime(4500, t);
    mlp.frequency.exponentialRampToValueAtTime(180, t + 0.25);
    mlp.Q.value = 5;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(volume * 0.7, t);
    mg.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    // Noise burst (texture)
    const ns = ctx.createBufferSource();
    ns.buffer = noise(ctx, 'md');
    const nhp = ctx.createBiquadFilter();
    nhp.type = 'highpass';
    nhp.frequency.value = 2000;
    const nhpg = ctx.createGain();
    nhpg.gain.setValueAtTime(volume * 0.45, t);
    nhpg.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    // Shimmer ring (metallic overtone)
    const shi = ctx.createOscillator();
    shi.type = 'sine';
    shi.frequency.setValueAtTime(3600, t);
    shi.frequency.linearRampToValueAtTime(2800, t + 0.18);
    const shg = ctx.createGain();
    shg.gain.setValueAtTime(volume * 0.22, t);
    shg.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    sub.connect(sg);           sg.connect(d);
    om.connect(mws); om2.connect(mws);
    mws.connect(mlp); mlp.connect(mg); mg.connect(d);
    if (r) { mg.connect(r); sub.connect(sg); /* already connected */ }
    ns.connect(nhp); nhp.connect(nhpg); nhpg.connect(d);
    shi.connect(shg); shg.connect(d);
    if (r) { shg.connect(r); }

    sub.start(t);  sub.stop(t + 0.42);
    om.start(t);   om.stop(t + 0.30);
    om2.start(t);  om2.stop(t + 0.26);
    ns.start(t);   ns.stop(t + 0.24);
    shi.start(t);  shi.stop(t + 0.22);
  } catch (_) {}
}

/**
 * Dark orb destroyed — mini explosion: noise sweep + tonal decay + reverb.
 */
export function playOrbDestroySound(volume = 0.3) {
  try {
    const ctx = getAudioContext();
    const d   = dst(ctx);
    const r   = rev();
    const t   = ctx.currentTime;
    const pv  = _rv(2.0);

    // Noise explosion body
    const ns  = ctx.createBufferSource();
    ns.buffer = noise(ctx, 'md');
    const nlp = ctx.createBiquadFilter();
    nlp.type  = 'lowpass';
    nlp.frequency.setValueAtTime(5500, t);
    nlp.frequency.exponentialRampToValueAtTime(80, t + 0.28);
    const ng  = ctx.createGain();
    ng.gain.setValueAtTime(volume * 0.85, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.30);

    // Tonal decay
    const ot  = ctx.createOscillator();
    ot.type   = 'sine';
    ot.frequency.setValueAtTime(300 * pv, t);
    ot.frequency.exponentialRampToValueAtTime(42 * pv, t + 0.24);
    const og  = ctx.createGain();
    og.gain.setValueAtTime(volume * 0.6, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.26);

    // Harmonic scatter — 3 short tones at random pitches
    [1, 1.26, 1.59].forEach((ratio, i) => {
      const freq = _rand(300, 800) * pv * ratio;
      const os   = ctx.createOscillator();
      os.type = i % 2 === 0 ? 'sine' : 'triangle';
      os.frequency.setValueAtTime(freq, t);
      os.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.12);
      const gs = ctx.createGain();
      gs.gain.setValueAtTime(volume * 0.28, t);
      gs.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      os.connect(gs); gs.connect(d);
      os.start(t); os.stop(t + 0.15);
    });

    // Click transient
    const ck  = ctx.createOscillator();
    ck.type   = 'sine';
    ck.frequency.setValueAtTime(3800 * pv, t);
    ck.frequency.exponentialRampToValueAtTime(700 * pv, t + 0.01);
    const cg  = ctx.createGain();
    cg.gain.setValueAtTime(volume * 0.65, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.015);

    ns.connect(nlp); nlp.connect(ng); ng.connect(d);
    if (r) { ng.connect(r); }
    ot.connect(og); og.connect(d);
    if (r) { og.connect(r); }
    ck.connect(cg); cg.connect(d);

    ns.start(t); ns.stop(t + 0.32);
    ot.start(t); ot.stop(t + 0.28);
    ck.start(t); ck.stop(t + 0.02);
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYER STATE SOUNDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Player takes damage — gut-punch: distorted noise burst + vibrato + sub.
 */
export function playPlayerDamageSound(volume = 0.5) {
  try {
    const ctx = getAudioContext();
    const d   = dst(ctx);
    const r   = rev();
    const t   = ctx.currentTime;

    // Distorted body
    const ob  = ctx.createOscillator();
    ob.type   = 'sawtooth';
    ob.frequency.setValueAtTime(220, t);
    ob.frequency.exponentialRampToValueAtTime(32, t + 0.35);
    const ws  = ctx.createWaveShaper();
    ws.curve  = _distCurve(48);
    const lp  = ctx.createBiquadFilter();
    lp.type   = 'lowpass';
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + 0.38);
    lp.Q.value = 2.5;
    const bg  = ctx.createGain();
    bg.gain.setValueAtTime(volume * 0.8, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    // Sub
    const sub = ctx.createOscillator();
    sub.type  = 'sine';
    sub.frequency.setValueAtTime(70, t);
    sub.frequency.exponentialRampToValueAtTime(18, t + 0.3);
    const sg  = ctx.createGain();
    sg.gain.setValueAtTime(volume * 0.9, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    // Noise impact
    const ns  = ctx.createBufferSource();
    ns.buffer = noise(ctx, 'md');
    const nhp = ctx.createBiquadFilter();
    nhp.type  = 'highpass';
    nhp.frequency.value = 2500;
    const nlp = ctx.createBiquadFilter();
    nlp.type  = 'lowpass';
    nlp.frequency.setValueAtTime(8000, t);
    nlp.frequency.exponentialRampToValueAtTime(180, t + 0.36);
    const ng  = ctx.createGain();
    ng.gain.setValueAtTime(volume * 0.7, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    ob.connect(ws); ws.connect(lp); lp.connect(bg); bg.connect(d);
    sub.connect(sg); sg.connect(d);
    ns.connect(nhp); nhp.connect(nlp); nlp.connect(ng); ng.connect(d);
    if (r) { bg.connect(r); }

    ob.start(t);  ob.stop(t + 0.42);
    sub.start(t); sub.stop(t + 0.34);
    ns.start(t);  ns.stop(t + 0.40);
  } catch (_) {}
}

/**
 * Power-up collected — ascending chiptune fanfare: 5-note Sine/Square arpeggio.
 */
export function playPowerUpSound(volume = 0.3) {
  try {
    const ctx  = getAudioContext();
    const d    = dst(ctx);
    const r    = rev();
    const t    = ctx.currentTime;
    // C5 E5 G5 B5 C6
    const notes = [523.25, 659.26, 783.99, 987.77, 1046.50];
    const dur   = 0.078;

    notes.forEach((freq, i) => {
      const nt = t + i * dur;

      const si = ctx.createOscillator();
      si.type = 'sine';
      si.frequency.setValueAtTime(freq, nt);
      si.frequency.linearRampToValueAtTime(freq * 1.04, nt + dur);

      const sq = ctx.createOscillator();
      sq.type = 'square';
      sq.frequency.setValueAtTime(freq * 1.005, nt); // very slight detune

      // High shimmer at 2× freq
      const sh = ctx.createOscillator();
      sh.type = 'sine';
      sh.frequency.setValueAtTime(freq * 2, nt);
      sh.frequency.linearRampToValueAtTime(freq * 2.05, nt + dur);

      const g  = ctx.createGain();
      g.gain.setValueAtTime(0, nt);
      g.gain.linearRampToValueAtTime(volume * 0.55, nt + 0.005);
      g.gain.setValueAtTime(volume * 0.55, nt + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.001, nt + dur * 1.3);

      const sg = ctx.createGain();
      sg.gain.setValueAtTime(volume * 0.2, nt);
      sg.gain.exponentialRampToValueAtTime(0.001, nt + dur * 1.1);

      si.connect(g); sq.connect(g); g.connect(d);
      sh.connect(sg); sg.connect(d);
      if (i === notes.length - 1 && r) { g.connect(r); sg.connect(r); }

      si.start(nt); si.stop(nt + dur * 1.5);
      sq.start(nt); sq.stop(nt + dur * 1.5);
      sh.start(nt); sh.stop(nt + dur * 1.5);
    });
  } catch (_) {}
}

/** Healing orb collected — ascending warm sine arpeggios. */
export function playHealSound(volume = 0.25) {
  try {
    const ctx   = getAudioContext();
    const d     = dst(ctx);
    const r     = rev();
    const t     = ctx.currentTime;
    const notes = [392, 523, 659, 784]; // G4 C5 E5 G5
    notes.forEach((f, i) => {
      const nt = t + i * 0.09;
      const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 1.003;
      const g  = ctx.createGain();
      g.gain.setValueAtTime(0, nt);
      g.gain.linearRampToValueAtTime(volume * 0.4, nt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, nt + 0.25);
      o1.connect(g); o2.connect(g); g.connect(d);
      if (r && i === notes.length - 1) g.connect(r);
      o1.start(nt); o1.stop(nt + 0.28);
      o2.start(nt); o2.stop(nt + 0.28);
    });
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME STATE SOUNDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Level complete — triumphant arpeggio + held chord.
 */
export function playLevelCompleteSound(volume = 0.35) {
  try {
    const ctx   = getAudioContext();
    const d     = dst(ctx);
    const r     = rev();
    const t     = ctx.currentTime;
    // C5 E5 G5 C6
    const notes = [523.25, 659.26, 783.99, 1046.50];
    const noteDur = 0.1;

    notes.forEach((freq, i) => {
      const nt = t + i * noteDur;

      const si = ctx.createOscillator(); si.type = 'sine';
      si.frequency.setValueAtTime(freq, nt);
      const tr = ctx.createOscillator(); tr.type = 'triangle';
      tr.frequency.setValueAtTime(freq * 1.002, nt);
      const hi = ctx.createOscillator(); hi.type = 'sine';
      hi.frequency.setValueAtTime(freq * 2, nt);

      const g  = ctx.createGain();
      g.gain.setValueAtTime(0, nt);
      g.gain.linearRampToValueAtTime(volume * 0.6, nt + 0.008);
      g.gain.setValueAtTime(volume * 0.6, nt + noteDur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.001, nt + noteDur * 1.8);

      const hg = ctx.createGain();
      hg.gain.setValueAtTime(volume * 0.2, nt);
      hg.gain.exponentialRampToValueAtTime(0.001, nt + noteDur);

      si.connect(g); tr.connect(g); g.connect(d);
      hi.connect(hg); hg.connect(d);
      if (r) { g.connect(r); }

      si.start(nt); si.stop(nt + noteDur * 2.2);
      tr.start(nt); tr.stop(nt + noteDur * 2.2);
      hi.start(nt); hi.stop(nt + noteDur * 1.2);
    });

    // Held chord — all notes together after the arpeggio
    const holdStart = t + notes.length * noteDur;
    notes.forEach((freq) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, holdStart);
      g.gain.linearRampToValueAtTime(volume * 0.35, holdStart + 0.02);
      g.gain.setValueAtTime(volume * 0.35, holdStart + 0.35);
      g.gain.exponentialRampToValueAtTime(0.001, holdStart + 0.75);
      o.connect(g); g.connect(d);
      if (r) g.connect(r);
      o.start(holdStart); o.stop(holdStart + 0.8);
    });
  } catch (_) {}
}

/**
 * Game over — dramatic chromatic descent + sub undertow + reverb.
 */
export function playGameOverSound(volume = 0.35) {
  try {
    const ctx   = getAudioContext();
    const d     = dst(ctx);
    const r     = rev();
    const t     = ctx.currentTime;
    // A4 G4 F4 Eb4 D4 C4 B3 (descending minor)
    const notes = [440, 392, 349.2, 311.1, 293.7, 261.6, 246.9];
    const noteDur = 0.2;

    // Sub undertow — held throughout
    const sub = ctx.createOscillator();
    sub.type  = 'sine';
    sub.frequency.setValueAtTime(55, t);
    sub.frequency.exponentialRampToValueAtTime(28, t + notes.length * noteDur + 0.6);
    const sg  = ctx.createGain();
    sg.gain.setValueAtTime(0, t);
    sg.gain.linearRampToValueAtTime(volume * 0.7, t + 0.05);
    sg.gain.setValueAtTime(volume * 0.7, t + notes.length * noteDur);
    sg.gain.exponentialRampToValueAtTime(0.001, t + notes.length * noteDur + 0.8);
    sub.connect(sg); sg.connect(d);
    sub.start(t); sub.stop(t + notes.length * noteDur + 0.9);

    // Descending melody
    notes.forEach((freq, i) => {
      const nt = t + i * noteDur;
      const o  = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(freq, nt);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2400, nt);
      lp.frequency.exponentialRampToValueAtTime(500, nt + noteDur * 1.4);
      lp.Q.value = 2;
      const g  = ctx.createGain();
      g.gain.setValueAtTime(0, nt);
      g.gain.linearRampToValueAtTime(volume * 0.5, nt + 0.01);
      g.gain.setValueAtTime(volume * 0.5, nt + noteDur * 0.8);
      g.gain.exponentialRampToValueAtTime(0.001, nt + noteDur * 1.6);
      o.connect(lp); lp.connect(g); g.connect(d);
      if (r && i > 4) g.connect(r);
      o.start(nt); o.stop(nt + noteDur * 1.8);
    });
  } catch (_) {}
}

/**
 * Boss defeated — epic multi-layer fanfare: explosion → chord → arpeggio → shimmer.
 */
export function playBossDefeatSound(volume = 0.4) {
  try {
    const ctx   = getAudioContext();
    const d     = dst(ctx);
    const r     = rev();
    const t     = ctx.currentTime;

    // ── Phase 1: noise explosion (0 – 0.5 s) ─────────────────────────────
    const ns    = ctx.createBufferSource();
    ns.buffer   = noise(ctx, 'lg');
    const nlp   = ctx.createBiquadFilter(); nlp.type = 'lowpass';
    nlp.frequency.setValueAtTime(6000, t);
    nlp.frequency.exponentialRampToValueAtTime(80, t + 0.5);
    const ng    = ctx.createGain();
    ng.gain.setValueAtTime(volume * 1.2, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    ns.connect(nlp); nlp.connect(ng); ng.connect(d);
    if (r) ng.connect(r);
    ns.start(t); ns.stop(t + 0.52);

    // Sub boom
    const subb = ctx.createOscillator(); subb.type = 'sine';
    subb.frequency.setValueAtTime(80, t);
    subb.frequency.exponentialRampToValueAtTime(22, t + 0.5);
    const sbg = ctx.createGain();
    sbg.gain.setValueAtTime(volume * 1.0, t);
    sbg.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    subb.connect(sbg); sbg.connect(d);
    subb.start(t); subb.stop(t + 0.58);

    // ── Phase 2: Major chord C4-E4-G4-C5 (0.35 s) ────────────────────────
    const chordT = t + 0.38;
    [261.6, 329.6, 392, 523.25].forEach((freq) => {
      const oc = ctx.createOscillator(); oc.type = 'sine';
      oc.frequency.value = freq;
      const gc = ctx.createGain();
      gc.gain.setValueAtTime(0, chordT);
      gc.gain.linearRampToValueAtTime(volume * 0.4, chordT + 0.04);
      gc.gain.setValueAtTime(volume * 0.4, chordT + 0.45);
      gc.gain.exponentialRampToValueAtTime(0.001, chordT + 0.9);
      oc.connect(gc); gc.connect(d);
      if (r) gc.connect(r);
      oc.start(chordT); oc.stop(chordT + 1.0);
    });

    // ── Phase 3: Ascending arpeggio A3→A5 (0.7 s) ────────────────────────
    const arpT  = t + 0.72;
    const arpN  = [220, 261.6, 329.6, 440, 523.25, 659.26, 880, 1047]; // A3…C6…A5
    const arpD  = 0.1;
    arpN.forEach((freq, i) => {
      const at = arpT + i * arpD;
      const oa = ctx.createOscillator(); oa.type = i % 2 === 0 ? 'sine' : 'triangle';
      oa.frequency.setValueAtTime(freq, at);
      oa.frequency.linearRampToValueAtTime(freq * 1.04, at + arpD);
      const ga = ctx.createGain();
      ga.gain.setValueAtTime(0, at);
      ga.gain.linearRampToValueAtTime(volume * 0.45, at + 0.008);
      ga.gain.exponentialRampToValueAtTime(0.001, at + arpD * 1.6);
      oa.connect(ga); ga.connect(d);
      if (r && i > 5) ga.connect(r);
      oa.start(at); oa.stop(at + arpD * 2);
    });

    // ── Phase 4: Shimmer sparkle (0.5 s → 1.8 s) ─────────────────────────
    const shimT = t + 0.5;
    for (let i = 0; i < 8; i++) {
      const st  = shimT + i * 0.16;
      const os  = ctx.createOscillator(); os.type = 'sine';
      os.frequency.value = _rand(2200, 4400);
      const gs  = ctx.createGain();
      gs.gain.setValueAtTime(0, st);
      gs.gain.linearRampToValueAtTime(volume * 0.18, st + 0.005);
      gs.gain.exponentialRampToValueAtTime(0.001, st + 0.14);
      os.connect(gs); gs.connect(d);
      if (r) gs.connect(r);
      os.start(st); os.stop(st + 0.16);
    }
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// ABILITY / ITEM SOUNDS
// ─────────────────────────────────────────────────────────────────────────────

/** Shield activated — upward sine sweep, resonant. */
export function playShieldActivateSound(volume = 0.28) {
  try {
    const ctx = getAudioContext(); const d = dst(ctx); const r = rev(); const t = ctx.currentTime;
    [0, 0.04, 0.08].forEach((offset, i) => {
      const nt = t + offset;
      const baseF = 600 + i * 200;
      const o  = ctx.createOscillator(); o.type = i < 2 ? 'sine' : 'triangle';
      o.frequency.setValueAtTime(baseF, nt);
      o.frequency.exponentialRampToValueAtTime(baseF * 3.5, nt + 0.45);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2000 + i * 400, nt);
      lp.frequency.exponentialRampToValueAtTime(8000, nt + 0.45);
      lp.Q.value = 5 - i;
      const g  = ctx.createGain();
      g.gain.setValueAtTime(volume * 0.4, nt);
      g.gain.setValueAtTime(volume * 0.4, nt + 0.35);
      g.gain.exponentialRampToValueAtTime(0.001, nt + 0.55);
      o.connect(lp); lp.connect(g); g.connect(d);
      if (r) g.connect(r);
      o.start(nt); o.stop(nt + 0.58);
    });
  } catch (_) {}
}

/** Defense orb activated — multi-oscillator upward sweep. */
export function playDefenseActivateSound(volume = 0.28) { playShieldActivateSound(volume); }

/** Teleport — rapid pitch chaos + noise crackle. */
export function playTeleportSound(volume = 0.3) {
  try {
    const ctx = getAudioContext(); const d = dst(ctx); const r = rev(); const t = ctx.currentTime;

    const o1 = ctx.createOscillator(); o1.type = 'sine';
    o1.frequency.setValueAtTime(1400, t);
    o1.frequency.exponentialRampToValueAtTime(80, t + 0.08);
    o1.frequency.exponentialRampToValueAtTime(2400, t + 0.12);
    o1.frequency.exponentialRampToValueAtTime(350, t + 0.22);

    const o2 = ctx.createOscillator(); o2.type = 'square';
    o2.frequency.setValueAtTime(900, t);
    o2.frequency.exponentialRampToValueAtTime(2800, t + 0.1);
    o2.frequency.exponentialRampToValueAtTime(120, t + 0.2);

    const ns  = ctx.createBufferSource(); ns.buffer = noise(ctx, 'sm');
    const nhp = ctx.createBiquadFilter(); nhp.type = 'highpass'; nhp.frequency.value = 4000;
    const nlp = ctx.createBiquadFilter(); nlp.type = 'lowpass';
    nlp.frequency.setValueAtTime(8000, t);
    nlp.frequency.exponentialRampToValueAtTime(200, t + 0.25);

    const g  = ctx.createGain();
    g.gain.setValueAtTime(volume * 0.5, t);
    g.gain.setValueAtTime(volume * 0.5, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    const ng = ctx.createGain();
    ng.gain.setValueAtTime(volume * 0.4, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    o1.connect(g); o2.connect(g); g.connect(d);
    ns.connect(nhp); nhp.connect(nlp); nlp.connect(ng); ng.connect(d);
    if (r) { g.connect(r); ng.connect(r); }

    o1.start(t); o1.stop(t + 0.32);
    o2.start(t); o2.stop(t + 0.28);
    ns.start(t); ns.stop(t + 0.30);
  } catch (_) {}
}

/** Charge-up — rising sine + triangle over 0.5 s. */
export function playChargeUpSound(volume = 0.25) {
  try {
    const ctx = getAudioContext(); const d = dst(ctx); const r = rev(); const t = ctx.currentTime;
    const o1 = ctx.createOscillator(); o1.type = 'sine';
    o1.frequency.setValueAtTime(320, t); o1.frequency.exponentialRampToValueAtTime(2400, t + 0.5);
    const o2 = ctx.createOscillator(); o2.type = 'triangle';
    o2.frequency.setValueAtTime(160, t); o2.frequency.exponentialRampToValueAtTime(1200, t + 0.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(800, t); lp.frequency.exponentialRampToValueAtTime(8000, t + 0.5);
    lp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume * 0.3, t); g.gain.linearRampToValueAtTime(volume * 0.65, t + 0.48);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.58);
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(d);
    if (r) g.connect(r);
    o1.start(t); o1.stop(t + 0.6); o2.start(t); o2.stop(t + 0.6);
  } catch (_) {}
}

/** Energy burst — rapid Saw/Square burst cluster. */
export function playEnergyBurstSound(volume = 0.3) {
  try {
    const ctx = getAudioContext(); const d = dst(ctx); const r = rev(); const t = ctx.currentTime;
    [0, 0.04, 0.08, 0.12, 0.16].forEach((off, i) => {
      const nt = t + off;
      const freq = 880 * Math.pow(0.75, i);
      const o = ctx.createOscillator(); o.type = i % 2 === 0 ? 'sawtooth' : 'square';
      o.frequency.setValueAtTime(freq, nt);
      o.frequency.exponentialRampToValueAtTime(freq * 0.4, nt + 0.12);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3000, nt); lp.frequency.exponentialRampToValueAtTime(400, nt + 0.14);
      const g = ctx.createGain();
      g.gain.setValueAtTime(volume * 0.45, nt); g.gain.exponentialRampToValueAtTime(0.001, nt + 0.16);
      o.connect(lp); lp.connect(g); g.connect(d);
      if (r && i === 0) g.connect(r);
      o.start(nt); o.stop(nt + 0.18);
    });
  } catch (_) {}
}

/** Power-down — sawtooth pitch descend. */
export function playPowerDownSound(volume = 0.25) {
  try {
    const ctx = getAudioContext(); const d = dst(ctx); const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(85, t + 0.45);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(200, t + 0.48);
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume * 0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(lp); lp.connect(g); g.connect(d);
    o.start(t); o.stop(t + 0.52);
  } catch (_) {}
}

/** Warning beep — urgent alternating square tones. */
export function playWarningSound(volume = 0.22) {
  try {
    const ctx = getAudioContext(); const d = dst(ctx); const t = ctx.currentTime;
    [0, 0.18].forEach((off) => {
      const nt = t + off;
      const o  = ctx.createOscillator(); o.type = 'square';
      o.frequency.value = off === 0 ? 920 : 700;
      const g  = ctx.createGain();
      g.gain.setValueAtTime(volume * 0.5, nt); g.gain.exponentialRampToValueAtTime(0.001, nt + 0.14);
      o.connect(g); g.connect(d);
      o.start(nt); o.stop(nt + 0.16);
    });
  } catch (_) {}
}

/** Critical hit — heavy distortion burst + high shimmer. */
export function playCriticalHitSound(volume = 0.42) {
  try {
    const ctx = getAudioContext(); const d = dst(ctx); const r = rev(); const t = ctx.currentTime;
    const pv  = _rv(1.0);
    const o1  = ctx.createOscillator(); o1.type = 'sawtooth';
    o1.frequency.setValueAtTime(500 * pv, t); o1.frequency.exponentialRampToValueAtTime(80 * pv, t + 0.2);
    const o2  = ctx.createOscillator(); o2.type = 'square';
    o2.frequency.setValueAtTime(750 * pv, t); o2.frequency.exponentialRampToValueAtTime(120 * pv, t + 0.18);
    const o3  = ctx.createOscillator(); o3.type = 'triangle';
    o3.frequency.setValueAtTime(1200 * pv, t); o3.frequency.exponentialRampToValueAtTime(200 * pv, t + 0.16);
    const ws  = ctx.createWaveShaper(); ws.curve = _distCurve(18);
    const lp  = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(6000, t); lp.frequency.exponentialRampToValueAtTime(400, t + 0.22);
    lp.Q.value = 5;
    const g   = ctx.createGain();
    g.gain.setValueAtTime(volume * 0.85, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o1.connect(ws); o2.connect(ws); o3.connect(ws);
    ws.connect(lp); lp.connect(g); g.connect(d);
    if (r) g.connect(r);
    [o1, o2, o3].forEach(o => { o.start(t); o.stop(t + 0.32); });
  } catch (_) {}
}

/** Near miss — high sine flash. */
export function playNearMissSound(volume = 0.18) {
  const now = performance.now();
  if (now - _tNearM < 200) return;
  _tNearM = now;
  try {
    const ctx = getAudioContext(); const d = dst(ctx); const t = ctx.currentTime;
    const o   = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 1900;
    const bp  = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 2;
    const g   = ctx.createGain();
    g.gain.setValueAtTime(volume * 0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(bp); bp.connect(g); g.connect(d);
    o.start(t); o.stop(t + 0.1);
  } catch (_) {}
}

/** Combo — Sine trio, pitch increases with comboCount.
 *  NOTE: useAudio.tsx calls playComboSound(count, volume) so params are swapped
 *  vs the original file. The call site passes (comboCount, volume). */
export function playComboSound(comboCount = 1, volume = 0.25) {
  try {
    const ctx = getAudioContext(); const d = dst(ctx); const r = rev(); const t = ctx.currentTime;
    const baseFreq = 440 * Math.pow(2, Math.min(comboCount - 1, 8) / 8);
    [1, 1.26, 1.587].forEach((ratio, i) => {
      const nt = t + i * 0.06;
      const o  = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(baseFreq * ratio, nt);
      o.frequency.linearRampToValueAtTime(baseFreq * ratio * 1.03, nt + 0.15);
      const g  = ctx.createGain();
      g.gain.setValueAtTime(volume * 0.4, nt); g.gain.exponentialRampToValueAtTime(0.001, nt + 0.22);
      o.connect(g); g.connect(d);
      if (r && i === 2) g.connect(r);
      o.start(nt); o.stop(nt + 0.25);
    });
  } catch (_) {}
}

/** Coin collected — stepping arpeggio. */
export function playCoinSound(volume = 0.22) {
  try {
    const ctx = getAudioContext(); const d = dst(ctx); const t = ctx.currentTime;
    [1400, 1760, 2200].forEach((f, i) => {
      const nt = t + i * 0.055;
      const o  = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g  = ctx.createGain();
      g.gain.setValueAtTime(volume * 0.45, nt); g.gain.exponentialRampToValueAtTime(0.001, nt + 0.1);
      o.connect(g); g.connect(d);
      o.start(nt); o.stop(nt + 0.12);
    });
  } catch (_) {}
}

/** Menu select / UI click. */
export function playMenuSelectSound(volume = 0.2) {
  try {
    const ctx = getAudioContext(); const d = dst(ctx); const t = ctx.currentTime;
    const o   = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(820, t); o.frequency.exponentialRampToValueAtTime(1280, t + 0.06);
    const g   = ctx.createGain();
    g.gain.setValueAtTime(volume * 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g); g.connect(d);
    o.start(t); o.stop(t + 0.12);
  } catch (_) {}
}

/** Pause game. */
export function playPauseSound(volume = 0.2) {
  try {
    const ctx = getAudioContext(); const d = dst(ctx); const t = ctx.currentTime;
    [640, 440].forEach((f, i) => {
      const nt = t + i * 0.07;
      const o  = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g  = ctx.createGain();
      g.gain.setValueAtTime(volume * 0.4, nt); g.gain.exponentialRampToValueAtTime(0.001, nt + 0.12);
      o.connect(g); g.connect(d);
      o.start(nt); o.stop(nt + 0.14);
    });
  } catch (_) {}
}

/** Boss attack telegraph — sawtooth sweep. */
export function playBossAttackSound(volume = 0.28) {
  try {
    const ctx = getAudioContext(); const d = dst(ctx); const r = rev(); const t = ctx.currentTime;
    const o   = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.28);
    const lp  = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(4000, t + 0.12);
    lp.Q.value = 3;
    const g   = ctx.createGain();
    g.gain.setValueAtTime(volume * 0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(lp); lp.connect(g); g.connect(d);
    if (r) g.connect(r);
    o.start(t); o.stop(t + 0.38);
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// INTRO / TITLE SOUNDS
// ─────────────────────────────────────────────────────────────────────────────

/** Startup intro sequence — 8-note Square/Triangle melody + sparkles. */
export function playIntroSound(volume = 0.22) {
  try {
    const ctx   = getAudioContext(); const d = dst(ctx); const r = rev(); const t = ctx.currentTime;
    const notes = [220, 261.6, 329.6, 392, 440, 523.25, 659.26, 880];
    const dur   = 0.14;
    notes.forEach((freq, i) => {
      const nt = t + i * dur;
      const o  = ctx.createOscillator(); o.type = i % 2 === 0 ? 'square' : 'triangle';
      o.frequency.setValueAtTime(freq, nt);
      const g  = ctx.createGain();
      g.gain.setValueAtTime(0, nt);
      g.gain.linearRampToValueAtTime(volume * 0.4, nt + 0.01);
      g.gain.setValueAtTime(volume * 0.4, nt + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.001, nt + dur * 1.4);
      o.connect(g); g.connect(d);
      if (r && i > 5) g.connect(r);
      o.start(nt); o.stop(nt + dur * 1.6);
    });
  } catch (_) {}
}

/** Tap-to-start prompt — 4-note ascending sine sweep. */
export function playTapToStartSound(volume = 0.2) {
  try {
    const ctx = getAudioContext(); const d = dst(ctx); const t = ctx.currentTime;
    [440, 523.25, 659.26, 880].forEach((f, i) => {
      const nt = t + i * 0.09;
      const o  = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f, nt); o.frequency.linearRampToValueAtTime(f * 1.05, nt + 0.12);
      const g  = ctx.createGain();
      g.gain.setValueAtTime(volume * 0.4, nt); g.gain.exponentialRampToValueAtTime(0.001, nt + 0.18);
      o.connect(g); g.connect(d);
      o.start(nt); o.stop(nt + 0.20);
    });
  } catch (_) {}
}

/** Orb whoosh fly-by — bandpass noise sweep. */
export function playOrbWhooshSound(volume = 0.2) {
  try {
    const ctx = getAudioContext(); const d = dst(ctx); const r = rev(); const t = ctx.currentTime;
    const ns  = ctx.createBufferSource(); ns.buffer = noise(ctx, 'sm');
    const bp  = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(280, t); bp.frequency.exponentialRampToValueAtTime(1400, t + 0.08);
    bp.frequency.exponentialRampToValueAtTime(380, t + 0.22);
    bp.Q.value = 2;
    const g   = ctx.createGain();
    g.gain.setValueAtTime(volume * 0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    ns.connect(bp); bp.connect(g); g.connect(d);
    if (r) g.connect(r);
    ns.start(t); ns.stop(t + 0.30);
  } catch (_) {}
}

/** Orbs converging — 5-note Sine/Triangle layers. */
export function playOrbConvergeSound(volume = 0.2) {
  try {
    const ctx   = getAudioContext(); const d = dst(ctx); const r = rev(); const t = ctx.currentTime;
    const notes = [220, 277.2, 329.6, 392, 440];
    notes.forEach((f, i) => {
      const nt = t + i * 0.06;
      const o  = ctx.createOscillator(); o.type = i % 2 === 0 ? 'sine' : 'triangle';
      o.frequency.setValueAtTime(f, nt); o.frequency.exponentialRampToValueAtTime(f * 1.6, nt + 0.35);
      const g  = ctx.createGain();
      g.gain.setValueAtTime(volume * 0.3, nt); g.gain.exponentialRampToValueAtTime(0.001, nt + 0.4);
      o.connect(g); g.connect(d);
      if (r && i === notes.length - 1) g.connect(r);
      o.start(nt); o.stop(nt + 0.45);
    });
  } catch (_) {}
}

/** Ring expand effect — sine + triangle descending. */
export function playRingExpandSound(volume = 0.18) {
  try {
    const ctx = getAudioContext(); const d = dst(ctx); const r = rev(); const t = ctx.currentTime;
    [840, 560].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(180, t + 0.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(volume * 0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      o.connect(g); g.connect(d);
      if (r) g.connect(r);
      o.start(t); o.stop(t + 0.58);
    });
  } catch (_) {}
}

/** Sparkle — high-frequency sine bursts. */
export function playSparkleSound(volume = 0.15) {
  try {
    const ctx = getAudioContext(); const d = dst(ctx); const t = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const nt = t + i * 0.04;
      const o  = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = _rand(2200, 4200);
      const g  = ctx.createGain();
      g.gain.setValueAtTime(volume * 0.35, nt); g.gain.exponentialRampToValueAtTime(0.001, nt + 0.07);
      o.connect(g); g.connect(d);
      o.start(nt); o.stop(nt + 0.08);
    }
  } catch (_) {}
}

/** Sparkle explosion — dense high-frequency burst. */
export function playSparkleExplosionSound(volume = 0.22) {
  try {
    const ctx = getAudioContext(); const d = dst(ctx); const r = rev(); const t = ctx.currentTime;
    for (let i = 0; i < 8; i++) {
      const nt = t + i * 0.025;
      const o  = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = _rand(2000, 4800);
      const g  = ctx.createGain();
      g.gain.setValueAtTime(volume * 0.3, nt); g.gain.exponentialRampToValueAtTime(0.001, nt + 0.09);
      o.connect(g); g.connect(d);
      if (r && i === 0) g.connect(r);
      o.start(nt); o.stop(nt + 0.1);
    }
  } catch (_) {}
}

/** Title reveal animation — Square/Triangle notes + high Sine shimmer. */
export function playTitleRevealSound(volume = 0.2) {
  try {
    const ctx   = getAudioContext(); const d = dst(ctx); const r = rev(); const t = ctx.currentTime;
    const notes = [261.6, 329.6, 392, 523.25];
    notes.forEach((f, i) => {
      const nt = t + i * 0.1;
      const o1 = ctx.createOscillator(); o1.type = 'square'; o1.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2;
      const g  = ctx.createGain();
      g.gain.setValueAtTime(0, nt); g.gain.linearRampToValueAtTime(volume * 0.38, nt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, nt + 0.35);
      o1.connect(g); o2.connect(g); g.connect(d);
      if (r && i === notes.length - 1) g.connect(r);
      o1.start(nt); o1.stop(nt + 0.38); o2.start(nt); o2.stop(nt + 0.38);
    });
  } catch (_) {}
}

/** Whoosh-by — broadening bandpass noise fly-by. */
export function playWhooshBySound(volume = 0.18) { playOrbWhooshSound(volume); }

// ─────────────────────────────────────────────────────────────────────────────
// MUSIC SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

// Scheduled-ahead-of-time step sequencer with WAA precision timing
const LOOKAHEAD   = 0.1;   // seconds to schedule ahead
const SCHED_INTV  = 60;    // ms between scheduler calls

// ── Shared SynthMusicNode type matching useAudio.tsx's expectations ───────────
export type SynthMusicNode = {
  start:        () => void;
  stop:         () => void;
  fadeIn:       () => void;
  fadeOut:      (onComplete?: () => void) => void;
  setIntensity?: (i: number) => void;
};

const FADE_TIME = 1.2; // seconds for music crossfade

/**
 * Gameplay music — "Cyber Pulse" — HD arcade action feel at 135 BPM.
 *
 * Layers:  kick (sub + click) · snare + rim · open/closed hi-hat ·
 *          sawtooth bass with filter envelope · square lead arpeggio ·
 *          sine chord stabs
 *
 * Chord progression (Am – F – C – G, 4 steps each = 16-step loop)
 */
export function createGameplayMusicNode(targetVol = 0.2): SynthMusicNode {
  try {
    const ctx   = getAudioContext();
    const mgain = ctx.createGain();
    mgain.gain.value = 0;
    mgain.connect(dst(ctx));
    if (rev()) mgain.connect(rev()!);

    let running = true;
    let active  = false;

    const BPM  = 135;
    const STEP = 60 / BPM / 2; // eighth note ≈ 0.222 s

    // ── 16-step patterns (2 bars of 4/4) ────────────────────────────────
    const KICK_PAT  = [1,0,0,0, 1,0,1,0, 1,0,0,0, 1,0,1,0]; // syncopated
    const SNARE_PAT = [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0];
    const OHAT_PAT  = [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0]; // open on snare
    const CHAT_PAT  = [1,1,0,1, 1,1,0,1, 1,1,0,1, 1,1,0,1]; // closed fills

    // Bass: Am – F – C – G  (root per chord block)
    const BASS_F: number[] = [
      110, 110, 110, 110,      // A2
      87.3, 87.3, 87.3, 87.3, // F2
      130.8, 130.8, 130.8, 130.8, // C3
      98,  98,  98,  98,       // G2
    ];

    // Lead arpeggio ascending per chord (square wave)
    const LEAD_F: number[] = [
      440,   523.25, 659.26, 880,     // Am: A4 C5 E5 A5
      349.2,  440,   523.25, 698.46,  // F:  F4 A4 C5 F5
      261.6,  329.6,  392,   523.25,  // C:  C4 E4 G4 C5
      392,   493.88, 587.33, 783.99,  // G:  G4 B4 D5 G5
    ];

    // Chord stab tones (triggered on beat 1 of each chord block)
    const STAB_CHORDS: number[][] = [
      [220, 261.6, 329.6],   // Am (A3 C4 E4)
      [174.6, 220,  261.6],  // F  (F3 A3 C4)
      [130.8, 196,  261.6],  // C  (C3 G3 C4)
      [98,   146.8, 196],    // G  (G2 D3 G3)
    ];

    let step  = 0;
    let nextT = ctx.currentTime + 0.1;

    function schedKick(t: number) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(175, t);
      o.frequency.exponentialRampToValueAtTime(30, t + 0.27);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.65, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
      o.connect(g); g.connect(mgain);
      o.start(t); o.stop(t + 0.32);
      const ns = ctx.createBufferSource(); ns.buffer = noise(ctx, 'xs');
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4000;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.32, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.016);
      ns.connect(hp); hp.connect(ng); ng.connect(mgain);
      ns.start(t); ns.stop(t + 0.020);
    }

    function schedSnare(t: number) {
      const ns = ctx.createBufferSource(); ns.buffer = noise(ctx, 'sm');
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
      const lp = ctx.createBiquadFilter(); lp.type  = 'lowpass';
      lp.frequency.setValueAtTime(8500, t); lp.frequency.exponentialRampToValueAtTime(2400, t + 0.14);
      const g  = ctx.createGain();
      g.gain.setValueAtTime(0.52, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      ns.connect(hp); hp.connect(lp); lp.connect(g); g.connect(mgain);
      ns.start(t); ns.stop(t + 0.17);
      const o  = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 200;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.35, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      o.connect(og); og.connect(mgain);
      o.start(t); o.stop(t + 0.09);
    }

    function schedHat(t: number, open: boolean) {
      const dur = open ? 0.085 : 0.026;
      const ns  = ctx.createBufferSource(); ns.buffer = noise(ctx, 'xs');
      const hp  = ctx.createBiquadFilter(); hp.type = 'highpass';
      hp.frequency.value = open ? 6000 : 9000;
      const g   = ctx.createGain();
      g.gain.setValueAtTime(open ? 0.20 : 0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      ns.connect(hp); hp.connect(g); g.connect(mgain);
      ns.start(t); ns.stop(t + dur + 0.004);
    }

    function schedBass(t: number, freq: number) {
      const o  = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
      const ws = ctx.createWaveShaper(); ws.curve = _distCurve(10);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(600, t); lp.frequency.exponentialRampToValueAtTime(170, t + STEP * 0.85);
      lp.Q.value = 2.5;
      const g  = ctx.createGain();
      g.gain.setValueAtTime(0.42, t);
      g.gain.setValueAtTime(0.42, t + STEP * 0.78);
      g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 0.95);
      o.connect(ws); ws.connect(lp); lp.connect(g); g.connect(mgain);
      o.start(t); o.stop(t + STEP);
    }

    function schedLead(t: number, freq: number) {
      const o  = ctx.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(freq, t);
      o.frequency.linearRampToValueAtTime(freq * 1.014, t + STEP * 0.75);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3800, t); lp.frequency.exponentialRampToValueAtTime(1500, t + STEP * 0.88);
      lp.Q.value = 1.4;
      const g  = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.005);
      g.gain.setValueAtTime(0.14, t + STEP * 0.72);
      g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 0.93);
      o.connect(lp); lp.connect(g); g.connect(mgain);
      o.start(t); o.stop(t + STEP);
    }

    function schedStab(t: number, freqs: number[]) {
      freqs.forEach(freq => {
        const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
        const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = freq * 1.002;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(800, t + STEP * 3.8);
        lp.Q.value = 0.8;
        const g  = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.06, t + 0.012);
        g.gain.setValueAtTime(0.06, t + STEP * 3.5);
        g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 3.95);
        o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(mgain);
        o1.start(t); o1.stop(t + STEP * 4.0);
        o2.start(t); o2.stop(t + STEP * 4.0);
      });
    }

    function schedule() {
      while (active && nextT < ctx.currentTime + LOOKAHEAD) {
        if (KICK_PAT[step])  schedKick(nextT);
        if (SNARE_PAT[step]) schedSnare(nextT);
        if (OHAT_PAT[step])  schedHat(nextT, true);
        if (CHAT_PAT[step])  schedHat(nextT, false);
        schedBass(nextT, BASS_F[step]);
        schedLead(nextT, LEAD_F[step]);
        if (step % 4 === 0)  schedStab(nextT, STAB_CHORDS[step / 4]);
        step = (step + 1) % 16;
        nextT += STEP;
      }
      if (!active) nextT = Math.max(nextT, ctx.currentTime + 0.05);
      if (running) setTimeout(schedule, SCHED_INTV);
    }

    schedule();

    return {
      start:   () => {},
      stop:    () => { running = false; try { mgain.disconnect(); } catch (_) {} },
      fadeIn:  () => {
        active = true;
        nextT  = ctx.currentTime + 0.05;
        mgain.gain.cancelScheduledValues(ctx.currentTime);
        mgain.gain.setValueAtTime(mgain.gain.value, ctx.currentTime);
        mgain.gain.linearRampToValueAtTime(targetVol, ctx.currentTime + FADE_TIME);
      },
      fadeOut: (onComplete?: () => void) => {
        mgain.gain.cancelScheduledValues(ctx.currentTime);
        mgain.gain.setValueAtTime(mgain.gain.value, ctx.currentTime);
        mgain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_TIME);
        setTimeout(() => { active = false; onComplete?.(); }, (FADE_TIME + 0.1) * 1000);
      },
    };
  } catch (_) {
    return { start: () => {}, stop: () => {}, fadeIn: () => {}, fadeOut: (cb) => { cb?.(); } };
  }
}

/**
 * Menu music — "Neon Plaza" — HD arcade lobby feel at 128 BPM.
 *
 * Layers:  kick · snare · closed hi-hat · synth bass (saw+dist) ·
 *          square-wave lead melody · triangle arpeggio · sine pad chords
 *
 * Chord progression (16 steps = 2 bars, loops):
 *   Dm | Am | B♭ | C  — each chord holds for 4 eighth-note steps
 */
export function createMenuMusicNode(targetVol = 0.2): SynthMusicNode {
  try {
    const ctx   = getAudioContext();
    const mgain = ctx.createGain();
    mgain.gain.value = 0;
    mgain.connect(dst(ctx));
    if (rev()) mgain.connect(rev()!);

    let running = true;
    let active  = false;

    const BPM  = 128;
    const STEP = 60 / BPM / 2; // eighth note ≈ 0.234 s

    // ── 16-step patterns (2 bars of 4/4) ────────────────────────────────
    const KICK_PAT  = [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0]; // beats 1 & 3
    const SNARE_PAT = [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0]; // beats 2 & 4
    const HAT_PAT   = [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1]; // all 8ths

    // Pad chords: one chord per 4-step block
    const CHORD_PADS: number[][] = [
      [146.8, 220, 293.7],  // Dm  (D3 A3 D4)
      [110,   164.8, 220],  // Am  (A2 E3 A3)
      [116.5, 174.6, 233.1],// B♭  (B♭2 F3 B♭3)
      [130.8, 196,   261.6],// C   (C3 G3 C4)
    ];

    // Lead melody — square wave, one note per step
    const LEAD: number[] = [
      587.33, 698.46, 880,    587.33,  // Dm:  D5 F5 A5 D5
       440,   523.25, 659.26,  440,    // Am:  A4 C5 E5 A4
      466.16, 587.33, 698.46, 466.16,  // B♭:  B♭4 D5 F5 B♭4
      523.25, 659.26, 783.99, 1046.5,  // C:   C5 E5 G5 C6
    ];

    // Triangle arpeggio — one note per step (chord tones, octave below lead)
    const ARP: number[] = [
      293.7, 349.2, 440,   587.33,   // Dm  arp
      220,   261.6, 329.6,  440,     // Am  arp
      233.1, 293.7, 349.2, 466.16,   // B♭  arp
      261.6, 329.6, 392,   523.25,   // C   arp
    ];

    // Bass — sawtooth + waveshaper, one note per step (same root held 4 steps)
    const BASS: number[] = [
       73.4,  73.4,  73.4,  73.4,   // D2
       55,    55,    55,    55,      // A1
       58.3,  58.3,  58.3,  58.3,   // B♭1
       65.4,  65.4,  65.4,  65.4,   // C2
    ];

    let step  = 0;
    let nextT = ctx.currentTime + 0.1;

    function schedKick(t: number) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(165, t);
      o.frequency.exponentialRampToValueAtTime(30, t + 0.25);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.60, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.connect(g); g.connect(mgain);
      o.start(t); o.stop(t + 0.30);
      // Transient click
      const ns = ctx.createBufferSource(); ns.buffer = noise(ctx, 'xs');
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4500;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.30, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.016);
      ns.connect(hp); hp.connect(ng); ng.connect(mgain);
      ns.start(t); ns.stop(t + 0.020);
    }

    function schedSnare(t: number) {
      const ns = ctx.createBufferSource(); ns.buffer = noise(ctx, 'sm');
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
      const lp = ctx.createBiquadFilter(); lp.type  = 'lowpass';
      lp.frequency.setValueAtTime(8500, t); lp.frequency.exponentialRampToValueAtTime(2400, t + 0.13);
      const g  = ctx.createGain();
      g.gain.setValueAtTime(0.50, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      ns.connect(hp); hp.connect(lp); lp.connect(g); g.connect(mgain);
      ns.start(t); ns.stop(t + 0.16);
      // Snare tone
      const o  = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 195;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.34, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      o.connect(og); og.connect(mgain);
      o.start(t); o.stop(t + 0.09);
    }

    function schedHat(t: number) {
      const ns = ctx.createBufferSource(); ns.buffer = noise(ctx, 'xs');
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 9500;
      const g  = ctx.createGain();
      g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.022);
      ns.connect(hp); hp.connect(g); g.connect(mgain);
      ns.start(t); ns.stop(t + 0.028);
    }

    function schedBass(t: number, freq: number) {
      const o  = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
      const ws = ctx.createWaveShaper(); ws.curve = _distCurve(10);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(650, t); lp.frequency.exponentialRampToValueAtTime(160, t + STEP * 0.85);
      lp.Q.value = 2.5;
      const g  = ctx.createGain();
      g.gain.setValueAtTime(0.45, t);
      g.gain.setValueAtTime(0.45, t + STEP * 0.78);
      g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 0.95);
      o.connect(ws); ws.connect(lp); lp.connect(g); g.connect(mgain);
      o.start(t); o.stop(t + STEP);
    }

    function schedLead(t: number, freq: number) {
      const o  = ctx.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(freq, t);
      o.frequency.linearRampToValueAtTime(freq * 1.012, t + STEP * 0.8);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(1800, t + STEP * 0.88);
      lp.Q.value = 1.2;
      const g  = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.13, t + 0.005);
      g.gain.setValueAtTime(0.13, t + STEP * 0.72);
      g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 0.94);
      o.connect(lp); lp.connect(g); g.connect(mgain);
      o.start(t); o.stop(t + STEP);
    }

    function schedArp(t: number, freq: number) {
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.065, t); g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 1.35);
      o.connect(g); g.connect(mgain);
      o.start(t); o.stop(t + STEP * 1.4);
    }

    function schedPad(t: number, freqs: number[]) {
      freqs.forEach(freq => {
        const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 1.003;
        const g  = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.048, t + 0.12);
        g.gain.setValueAtTime(0.048, t + STEP * 3.6);
        g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 4.05);
        o1.connect(g); o2.connect(g); g.connect(mgain);
        o1.start(t); o1.stop(t + STEP * 4.1);
        o2.start(t); o2.stop(t + STEP * 4.1);
      });
    }

    function schedule() {
      while (active && nextT < ctx.currentTime + LOOKAHEAD) {
        if (KICK_PAT[step])  schedKick(nextT);
        if (SNARE_PAT[step]) schedSnare(nextT);
        if (HAT_PAT[step])   schedHat(nextT);
        schedBass(nextT, BASS[step]);
        schedLead(nextT, LEAD[step]);
        schedArp(nextT, ARP[step]);
        if (step % 4 === 0) schedPad(nextT, CHORD_PADS[step / 4]);
        step = (step + 1) % 16;
        nextT += STEP;
      }
      if (!active) nextT = Math.max(nextT, ctx.currentTime + 0.05);
      if (running) setTimeout(schedule, SCHED_INTV);
    }

    schedule();

    return {
      start:   () => {},
      stop:    () => { running = false; try { mgain.disconnect(); } catch (_) {} },
      fadeIn:  () => {
        active = true;
        nextT  = ctx.currentTime + 0.05;
        mgain.gain.cancelScheduledValues(ctx.currentTime);
        mgain.gain.setValueAtTime(mgain.gain.value, ctx.currentTime);
        mgain.gain.linearRampToValueAtTime(targetVol, ctx.currentTime + FADE_TIME);
      },
      fadeOut: (onComplete?: () => void) => {
        mgain.gain.cancelScheduledValues(ctx.currentTime);
        mgain.gain.setValueAtTime(mgain.gain.value, ctx.currentTime);
        mgain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_TIME);
        setTimeout(() => { active = false; onComplete?.(); }, (FADE_TIME + 0.1) * 1000);
      },
    };
  } catch (_) {
    return { start: () => {}, stop: () => {}, fadeIn: () => {}, fadeOut: (cb) => { cb?.(); } };
  }
}

/**
 * Gameplay music — "Vector Storm" — HD bullet-hell / shmup feel at 148 BPM.
 *
 * Layers:  heavy kick (sub + click) · snare · open & closed hi-hat ·
 *          distorted sawtooth bass · sub-sine bass octave down ·
 *          square-wave lead arpeggio · sine chord stabs · intensity gate
 *
 * 16-step pattern = 2 bars.  Intensity 0–1 thickens chord stabs + bass drive.
 */
export function createBossMusicNode(targetVol = 0.18): SynthMusicNode {
  try {
    const ctx   = getAudioContext();
    const mgain = ctx.createGain();
    mgain.gain.value = 0;
    mgain.connect(dst(ctx));
    if (rev()) mgain.connect(rev()!);

    let running   = true;
    let active    = false;
    let intensity = 0.5;

    const BPM  = 148;
    const STEP = 60 / BPM / 2; // eighth note ≈ 0.203 s

    // ── 16-step patterns (2 bars of 4/4) ────────────────────────────────
    // Kick: beat 1 every bar + syncopated hit on the "and" of 2 in bar 2
    const KICK_PAT  = [1,0,0,0, 1,0,1,0, 1,0,0,0, 1,0,1,0];
    const SNARE_PAT = [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0];
    const OHAT_PAT  = [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0]; // open on snare
    const CHAT_PAT  = [1,1,0,1, 1,1,0,1, 1,1,0,1, 1,1,0,1]; // closed fills

    // Bass: Am – G – F – Em  (4 steps each)
    const BASS_F: number[] = [
      110, 110, 110, 110,    // A2
       98,  98,  98,  98,    // G2
      87.3,87.3,87.3,87.3,  // F2
      82.4,82.4,82.4,82.4,  // E2
    ];

    // Lead arpeggio ascending then descending across the phrase
    const LEAD_F: number[] = [
      440,  523.25, 659.26, 880,      // Am:  A4 C5 E5 A5
      392,  493.88, 587.33, 783.99,   // G:   G4 B4 D5 G5
      349.2, 440,  523.25, 698.46,    // F:   F4 A4 C5 F5
      329.6, 440,  493.88, 659.26,    // Em:  E4 A4 B4 E5
    ];

    // Chord stab tones (fired on beat 1 of each chord block = steps 0,4,8,12)
    const STAB_CHORDS: number[][] = [
      [220, 261.6, 329.6],   // Am  (A3 C4 E4)
      [196, 246.9, 293.7],   // G   (G3 B3 D4)
      [174.6, 220, 261.6],   // F   (F3 A3 C4)
      [164.8, 196, 246.9],   // Em  (E3 G3 B3)
    ];

    let step  = 0;
    let nextT = ctx.currentTime + 0.1;

    function schedKick(t: number) {
      // Sub sine — heavy thud
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(190, t);
      o.frequency.exponentialRampToValueAtTime(32, t + 0.30);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.72, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
      o.connect(g); g.connect(mgain);
      o.start(t); o.stop(t + 0.36);
      // Sharp click transient
      const ns = ctx.createBufferSource(); ns.buffer = noise(ctx, 'xs');
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.38, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.018);
      ns.connect(hp); hp.connect(ng); ng.connect(mgain);
      ns.start(t); ns.stop(t + 0.022);
    }

    function schedSnare(t: number) {
      const ns = ctx.createBufferSource(); ns.buffer = noise(ctx, 'sm');
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1600;
      const lp = ctx.createBiquadFilter(); lp.type  = 'lowpass';
      lp.frequency.setValueAtTime(9000, t); lp.frequency.exponentialRampToValueAtTime(2200, t + 0.16);
      const g  = ctx.createGain();
      g.gain.setValueAtTime(0.58, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
      ns.connect(hp); hp.connect(lp); lp.connect(g); g.connect(mgain);
      ns.start(t); ns.stop(t + 0.19);
      // Rim tone
      const o  = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 210;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.40, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(og); og.connect(mgain);
      o.start(t); o.stop(t + 0.10);
    }

    function schedHat(t: number, open: boolean) {
      const dur = open ? 0.095 : 0.028;
      const ns  = ctx.createBufferSource(); ns.buffer = noise(ctx, 'xs');
      const hp  = ctx.createBiquadFilter(); hp.type = 'highpass';
      hp.frequency.value = open ? 5800 : 9000;
      const g   = ctx.createGain();
      g.gain.setValueAtTime(open ? 0.22 : 0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      ns.connect(hp); hp.connect(g); g.connect(mgain);
      ns.start(t); ns.stop(t + dur + 0.005);
    }

    function schedBass(t: number, freq: number) {
      const v   = 0.38 + intensity * 0.18;
      // Sawtooth main with filter envelope
      const o   = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
      const ws  = ctx.createWaveShaper(); ws.curve = _distCurve(12);
      const lp  = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(700 + intensity * 400, t);
      lp.frequency.exponentialRampToValueAtTime(180, t + STEP * 0.85);
      lp.Q.value = 3;
      const g   = ctx.createGain();
      g.gain.setValueAtTime(v, t);
      g.gain.setValueAtTime(v, t + STEP * 0.76);
      g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 0.95);
      o.connect(ws); ws.connect(lp); lp.connect(g); g.connect(mgain);
      o.start(t); o.stop(t + STEP);
      // Sub octave sine — adds weight on low end
      const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = freq * 0.5;
      const sg  = ctx.createGain();
      sg.gain.setValueAtTime(v * 0.55, t); sg.gain.exponentialRampToValueAtTime(0.001, t + STEP * 0.90);
      sub.connect(sg); sg.connect(mgain);
      sub.start(t); sub.stop(t + STEP);
    }

    function schedLead(t: number, freq: number) {
      const v  = 0.14 + intensity * 0.10;
      const o  = ctx.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(freq, t);
      o.frequency.linearRampToValueAtTime(freq * 1.018, t + STEP * 0.5);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3800, t); lp.frequency.exponentialRampToValueAtTime(1400, t + STEP * 0.85);
      lp.Q.value = 1.8;
      const ws = ctx.createWaveShaper(); ws.curve = _distCurve(7);
      const g  = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + 0.005);
      g.gain.setValueAtTime(v, t + STEP * 0.70);
      g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 0.93);
      o.connect(ws); ws.connect(lp); lp.connect(g); g.connect(mgain);
      o.start(t); o.stop(t + STEP);
    }

    function schedStab(t: number, freqs: number[]) {
      const v = 0.06 + intensity * 0.06;
      freqs.forEach(freq => {
        const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
        const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = freq * 1.002;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.setValueAtTime(2800, t); lp.frequency.exponentialRampToValueAtTime(900, t + STEP * 3.8);
        lp.Q.value = 0.8;
        const g  = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(v, t + 0.012);
        g.gain.setValueAtTime(v, t + STEP * 3.5);
        g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 3.95);
        o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(mgain);
        o1.start(t); o1.stop(t + STEP * 4.0);
        o2.start(t); o2.stop(t + STEP * 4.0);
      });
    }

    function schedule() {
      while (active && nextT < ctx.currentTime + LOOKAHEAD) {
        if (KICK_PAT[step])  schedKick(nextT);
        if (SNARE_PAT[step]) schedSnare(nextT);
        if (OHAT_PAT[step])  schedHat(nextT, true);
        if (CHAT_PAT[step])  schedHat(nextT, false);
        schedBass(nextT, BASS_F[step]);
        // Lead plays every step; on off-beats skip when intensity is low
        if (step % 2 === 0 || intensity > 0.45) schedLead(nextT, LEAD_F[step]);
        if (step % 4 === 0) schedStab(nextT, STAB_CHORDS[step / 4]);
        step = (step + 1) % 16;
        nextT += STEP;
      }
      if (!active) nextT = Math.max(nextT, ctx.currentTime + 0.05);
      if (running) setTimeout(schedule, SCHED_INTV);
    }

    schedule();
    return {
      start:        () => {},
      stop:         () => { running = false; try { mgain.disconnect(); } catch (_) {} },
      fadeIn:       () => {
        active = true;
        nextT  = ctx.currentTime + 0.05;
        mgain.gain.cancelScheduledValues(ctx.currentTime);
        mgain.gain.setValueAtTime(mgain.gain.value, ctx.currentTime);
        mgain.gain.linearRampToValueAtTime(targetVol, ctx.currentTime + FADE_TIME);
      },
      fadeOut:      (onComplete?: () => void) => {
        mgain.gain.cancelScheduledValues(ctx.currentTime);
        mgain.gain.setValueAtTime(mgain.gain.value, ctx.currentTime);
        mgain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_TIME);
        setTimeout(() => { active = false; onComplete?.(); }, (FADE_TIME + 0.1) * 1000);
      },
      setIntensity: (i: number) => { intensity = Math.max(0, Math.min(1, i)); },
    };
  } catch (_) {
    return { start: () => {}, stop: () => {}, fadeIn: () => {}, fadeOut: (cb) => { cb?.(); } };
  }
}

// ── Legacy aliases (kept for backward compat with useAudio.tsx) ───────────────

export { _makeNoiseBuf as createNoiseBuffer };

/** Set the master output volume (0–1). Safe to call before any audio is initialised. */
export function setMasterVolume(v: number): void {
  if (_masterGain) _masterGain.gain.value = Math.max(0, Math.min(1, v)) * 0.85;
}
