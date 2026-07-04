let audioContext: AudioContext | null = null;

// ── Per-sound throttle timestamps + shared buffer cache ───────────────────────
// playHitSound fires on every projectile collision and playShootSound fires on
// every player shot. During rapid fire these can exceed 10–20 calls/frame.
// Each call allocates new Web Audio nodes AND (for hit) a ~6 600-element
// Float32Array noise buffer, flooding both the audio thread and the GC.
// Fixes:
//   • Throttle: skip calls that arrive within the minimum perceptible interval.
//   • Buffer cache: allocate the hit noise buffer once per AudioContext lifetime.
let _lastHitTime   = 0;
let _lastShootTime = 0;
let _hitNoiseBuf:    AudioBuffer  | null = null;
let _hitNoiseBufCtx: AudioContext | null = null; // invalidate cache if ctx changes

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

export function playShootSound(volume = 0.25) {
  const _now = performance.now();
  if (_now - _lastShootTime < 30) return; // max ~33 shots/sec audible
  _lastShootTime = _now;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(220, now + 0.08);
    
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(1200, now);
    osc2.frequency.exponentialRampToValueAtTime(300, now + 0.06);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4000, now);
    filter.frequency.exponentialRampToValueAtTime(800, now + 0.1);
    filter.Q.value = 2;
    
    gain.gain.setValueAtTime(volume * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.15);
    osc2.stop(now + 0.15);
  } catch (e) {}
}

export function playHitSound(volume = 0.3) {
  // Throttle: human perception cannot distinguish separate hits < ~60 ms apart.
  // Skipping surplus calls avoids flooding the audio thread with node allocation.
  const _now = performance.now();
  if (_now - _lastHitTime < 75) return; // max ~13 audible hits/sec
  _lastHitTime = _now;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    // Reuse the cached noise buffer — avoids allocating a new ~6 600-element
    // Float32Array on every hit (the single biggest per-call GC pressure source).
    // Invalidate the cache if the AudioContext was recreated.
    if (!_hitNoiseBuf || _hitNoiseBufCtx !== ctx) {
      _hitNoiseBuf    = createNoiseBuffer(ctx, 0.15);
      _hitNoiseBufCtx = ctx;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = _hitNoiseBuf;
    
    const gain = ctx.createGain();
    const noiseGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const noiseFilter = ctx.createBiquadFilter();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(600, now);
    osc1.frequency.exponentialRampToValueAtTime(120, now + 0.1);
    
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(400, now);
    osc2.frequency.exponentialRampToValueAtTime(80, now + 0.12);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    filter.Q.value = 3;
    
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(2000, now);
    noiseFilter.Q.value = 1;
    
    gain.gain.setValueAtTime(volume * 0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    
    noiseGain.gain.setValueAtTime(volume * 0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    
    osc1.start(now);
    osc2.start(now);
    noiseSource.start(now);
    osc1.stop(now + 0.2);
    osc2.stop(now + 0.2);
    noiseSource.stop(now + 0.2);
  } catch (e) {}
}

export function playOrbDestroySound(volume = 0.25) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(800, now);
    osc1.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(1200, now);
    osc2.frequency.exponentialRampToValueAtTime(100, now + 0.2);
    
    osc3.type = 'sawtooth';
    osc3.frequency.setValueAtTime(600, now);
    osc3.frequency.exponentialRampToValueAtTime(50, now + 0.25);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(5000, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.2);
    filter.Q.value = 4;
    
    gain.gain.setValueAtTime(volume * 0.5, now);
    gain.gain.linearRampToValueAtTime(volume * 0.7, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
    osc3.stop(now + 0.35);
  } catch (e) {}
}

export function playCoinSound(volume = 0.2) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.setValueAtTime(1800, now + 0.06);
    osc.frequency.setValueAtTime(2200, now + 0.12);
    
    gain.gain.setValueAtTime(volume, now);
    gain.gain.setValueAtTime(volume * 0.8, now + 0.06);
    gain.gain.setValueAtTime(volume * 0.6, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.3);
  } catch (e) {}
}

export function playPowerUpSound(volume = 0.35) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      const startTime = now + i * 0.08;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume * 0.7, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  } catch (e) {}
}

export function playMenuSelectSound(volume = 0.2) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.setValueAtTime(1200, now + 0.04);
    
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.15);
  } catch (e) {}
}

export function playPlayerDamageSound(volume = 0.4) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const noise = createNoiseBuffer(ctx, 0.3);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noise;
    
    const gain = ctx.createGain();
    const noiseGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(200, now);
    osc1.frequency.exponentialRampToValueAtTime(60, now + 0.3);
    
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(150, now);
    osc2.frequency.exponentialRampToValueAtTime(40, now + 0.35);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.3);
    filter.Q.value = 2;
    
    gain.gain.setValueAtTime(volume * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    
    noiseGain.gain.setValueAtTime(volume * 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    noiseSource.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    
    osc1.start(now);
    osc2.start(now);
    noiseSource.start(now);
    osc1.stop(now + 0.45);
    osc2.stop(now + 0.45);
    noiseSource.stop(now + 0.45);
  } catch (e) {}
}

export function playBossHitSound(volume = 0.35) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const distortion = ctx.createWaveShaper();
    
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(300, now);
    osc1.frequency.exponentialRampToValueAtTime(80, now + 0.2);
    
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(450, now);
    osc2.frequency.exponentialRampToValueAtTime(100, now + 0.18);
    
    distortion.curve = makeDistortionCurve(20);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.25);
    filter.Q.value = 5;
    
    gain.gain.setValueAtTime(volume * 0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    osc1.connect(distortion);
    osc2.connect(distortion);
    distortion.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  } catch (e) {}
}

export function playLevelCompleteSound(volume = 0.4) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const notes = [523, 659, 784, 880, 1047, 1319]; // C5 to E6
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      osc2.type = 'triangle';
      osc2.frequency.value = freq * 1.005; // slight detune for richness
      
      const startTime = now + i * 0.1;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume * 0.5, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
      
      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc2.start(startTime);
      osc.stop(startTime + 0.55);
      osc2.stop(startTime + 0.55);
    });
  } catch (e) {}
}

export function playGameOverSound(volume = 0.4) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const notes = [440, 415, 392, 349, 330, 294]; // A4 descending
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      
      const startTime = now + i * 0.15;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume * 0.4, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + 0.45);
    });
  } catch (e) {}
}

export function playBossDefeatSound(volume = 0.5) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    for (let i = 0; i < 8; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = i % 2 === 0 ? 'square' : 'sawtooth';
      const baseFreq = 200 + Math.random() * 600;
      osc.frequency.setValueAtTime(baseFreq, now + i * 0.05);
      osc.frequency.exponentialRampToValueAtTime(50 + Math.random() * 100, now + i * 0.05 + 0.15);
      
      gain.gain.setValueAtTime(volume * 0.3, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.2);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.25);
    }
    
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      const startTime = now + 0.5 + i * 0.1;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume * 0.6, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + 0.45);
    });
  } catch (e) {}
}

export function playDefenseActivateSound(volume = 0.3) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(400, now);
    osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
    
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(600, now);
    osc2.frequency.exponentialRampToValueAtTime(1600, now + 0.12);
    
    gain.gain.setValueAtTime(volume * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.3);
    osc2.stop(now + 0.3);
  } catch (e) {}
}

export function playPauseSound(volume = 0.2) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.setValueAtTime(400, now + 0.08);
    
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.25);
  } catch (e) {}
}

export function playBossAttackSound(volume = 0.3) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, now);
    filter.Q.value = 3;
    
    gain.gain.setValueAtTime(volume * 0.5, now);
    gain.gain.linearRampToValueAtTime(volume * 0.8, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.3);
  } catch (e) {}
}

function createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const bufferSize = sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  return buffer;
}

function makeDistortionCurve(amount: number): Float32Array {
  const samples = 256;
  const curve = new Float32Array(samples);
  
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  
  return curve;
}

export function createMenuMusicNode(volume = 0.16): { start: () => void; stop: () => void; fadeIn: () => void; fadeOut: (onComplete?: () => void) => void } {
  let isPlaying = false;
  let intervalId: number | null = null;
  let currentNotes: { osc: OscillatorNode; gain: GainNode }[] = [];
  let masterVolume = volume;
  let fadeIntervalId: number | null = null;
  
  const chillMelody = [
    { note: 329.63, dur: 0.8 }, { note: 0, dur: 0.4 },
    { note: 392.00, dur: 0.6 }, { note: 349.23, dur: 0.6 },
    { note: 293.66, dur: 1.0 }, { note: 0, dur: 0.6 },
    { note: 349.23, dur: 0.8 }, { note: 329.63, dur: 0.8 },
    { note: 261.63, dur: 1.2 }, { note: 0, dur: 0.8 },
    { note: 293.66, dur: 0.6 }, { note: 349.23, dur: 0.6 },
    { note: 392.00, dur: 1.0 }, { note: 0, dur: 0.4 },
    { note: 329.63, dur: 0.8 }, { note: 293.66, dur: 1.0 },
  ];
  
  const pad = [
    { note: 130.81, dur: 2.4 },
    { note: 146.83, dur: 2.4 },
    { note: 123.47, dur: 2.4 },
    { note: 130.81, dur: 2.4 },
  ];
  
  let melodyIndex = 0;
  let padIndex = 0;
  let tickCount = 0;
  
  const playChillNote = (freq: number, duration: number, type: OscillatorType, vol: number) => {
    if (freq === 0) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const reverb = ctx.createConvolver();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      filter.Q.value = 0.5;
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.15);
      gain.gain.setValueAtTime(vol * 0.8, now + duration * 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration * 1.2);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + duration * 1.3);
      
      currentNotes.push({ osc, gain });
      setTimeout(() => {
        const idx = currentNotes.findIndex(n => n.osc === osc);
        if (idx !== -1) currentNotes.splice(idx, 1);
      }, duration * 1300 + 100);
    } catch (e) {}
  };
  
  const playPadNote = (freq: number, duration: number, vol: number) => {
    if (freq === 0) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq * 2.01, now);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, now);
      filter.Q.value = 0.3;
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.5);
      gain.gain.setValueAtTime(vol * 0.7, now + duration * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration + 0.1);
      osc2.stop(now + duration + 0.1);
      
      currentNotes.push({ osc: osc1, gain });
    } catch (e) {}
  };
  
  const tick = () => {
    if (!isPlaying) return;
    
    const m = chillMelody[melodyIndex];
    playChillNote(m.note, m.dur, 'sine', masterVolume * 0.25);
    melodyIndex = (melodyIndex + 1) % chillMelody.length;
    
    if (tickCount % 6 === 0) {
      const p = pad[padIndex];
      playPadNote(p.note, p.dur, masterVolume * 0.15);
      padIndex = (padIndex + 1) % pad.length;
    }
    
    if (tickCount % 8 === 0 && Math.random() > 0.5) {
      playChillNote(523.25 + Math.random() * 200, 0.3, 'sine', masterVolume * 0.08);
    }
    
    tickCount++;
  };
  
  const stopFade = () => {
    if (fadeIntervalId !== null) {
      clearInterval(fadeIntervalId);
      fadeIntervalId = null;
    }
  };
  
  return {
    start: () => {
      if (isPlaying) return;
      isPlaying = true;
      masterVolume = volume;
      melodyIndex = 0;
      padIndex = 0;
      tickCount = 0;
      tick();
      intervalId = window.setInterval(tick, 400);
    },
    stop: () => {
      isPlaying = false;
      stopFade();
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      currentNotes.forEach(({ gain }) => {
        try {
          const ctx = getAudioContext();
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        } catch (e) {}
      });
      currentNotes = [];
    },
    fadeIn: () => {
      stopFade();
      if (!isPlaying) {
        isPlaying = true;
        masterVolume = 0;
        melodyIndex = 0;
        padIndex = 0;
        tickCount = 0;
        tick();
        intervalId = window.setInterval(tick, 400);
      }
      const targetVolume = volume;
      const steps = 25;
      const stepDuration = 1000 / steps;
      let currentStep = 0;
      
      fadeIntervalId = window.setInterval(() => {
        currentStep++;
        const progress = currentStep / steps;
        masterVolume = targetVolume * (1 - Math.pow(1 - progress, 2));
        
        if (currentStep >= steps) {
          stopFade();
          masterVolume = targetVolume;
        }
      }, stepDuration);
    },
    fadeOut: (onComplete?: () => void) => {
      stopFade();
      if (!isPlaying) {
        onComplete?.();
        return;
      }
      const startVolume = masterVolume;
      const steps = 25;
      const stepDuration = 1000 / steps;
      let currentStep = 0;
      
      fadeIntervalId = window.setInterval(() => {
        currentStep++;
        const progress = currentStep / steps;
        masterVolume = startVolume * (1 - progress);
        
        if (currentStep >= steps) {
          stopFade();
          masterVolume = 0;
          isPlaying = false;
          if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
          }
          currentNotes.forEach(({ gain }) => {
            try {
              const ctx = getAudioContext();
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            } catch (e) {}
          });
          currentNotes = [];
          onComplete?.();
        }
      }, stepDuration);
    }
  };
}

export function playIntroSound(volume = 0.35) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const blockNotes = [
      { freq: 440, time: 0, dur: 0.08 },
      { freq: 523, time: 0.1, dur: 0.08 },
      { freq: 392, time: 0.2, dur: 0.08 },
      { freq: 587, time: 0.3, dur: 0.1 },
      { freq: 494, time: 0.45, dur: 0.08 },
      { freq: 659, time: 0.55, dur: 0.1 },
      { freq: 784, time: 0.7, dur: 0.12 },
      { freq: 880, time: 0.85, dur: 0.15 },
    ];
    
    blockNotes.forEach(({ freq, time, dur }, i) => {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + time);
      osc.frequency.setValueAtTime(freq * 1.02, now + time + dur * 0.5);
      
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 0.5, now + time);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(4000, now + time);
      filter.frequency.exponentialRampToValueAtTime(1500, now + time + dur);
      filter.Q.value = 4;
      
      const noteVol = volume * (0.4 + i * 0.06);
      gain.gain.setValueAtTime(0, now + time);
      gain.gain.linearRampToValueAtTime(noteVol, now + time + 0.008);
      gain.gain.setValueAtTime(noteVol * 0.9, now + time + dur * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
      
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + time);
      osc2.start(now + time);
      osc.stop(now + time + dur + 0.05);
      osc2.stop(now + time + dur + 0.05);
    });
    
    for (let i = 0; i < 6; i++) {
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      const clickFilter = ctx.createBiquadFilter();
      
      const clickTime = blockNotes[i]?.time || 0.1 * i;
      clickOsc.type = 'square';
      clickOsc.frequency.setValueAtTime(1800 + Math.random() * 400, now + clickTime);
      clickOsc.frequency.exponentialRampToValueAtTime(800, now + clickTime + 0.025);
      
      clickFilter.type = 'highpass';
      clickFilter.frequency.value = 600;
      clickFilter.Q.value = 2;
      
      clickGain.gain.setValueAtTime(volume * 0.2, now + clickTime);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + clickTime + 0.035);
      
      clickOsc.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(ctx.destination);
      
      clickOsc.start(now + clickTime);
      clickOsc.stop(now + clickTime + 0.05);
    }
  } catch (e) {}
}

export function playTapToStartSound(volume = 0.25) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const notes = [
      { freq: 659, time: 0, dur: 0.12 },
      { freq: 784, time: 0.08, dur: 0.12 },
      { freq: 988, time: 0.16, dur: 0.18 },
      { freq: 1175, time: 0.28, dur: 0.22 },
    ];
    
    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + time);
      
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, now + time);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(5000, now + time);
      filter.frequency.exponentialRampToValueAtTime(2000, now + time + dur);
      filter.Q.value = 1;
      
      gain.gain.setValueAtTime(0, now + time);
      gain.gain.linearRampToValueAtTime(volume * 0.5, now + time + 0.015);
      gain.gain.setValueAtTime(volume * 0.4, now + time + dur * 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
      
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + time);
      osc2.start(now + time);
      osc.stop(now + time + dur + 0.05);
      osc2.stop(now + time + dur + 0.05);
    });
    
    const shimmerOsc = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    
    shimmerOsc.type = 'sine';
    shimmerOsc.frequency.setValueAtTime(2400, now + 0.35);
    shimmerOsc.frequency.exponentialRampToValueAtTime(3200, now + 0.5);
    
    shimmerGain.gain.setValueAtTime(0, now + 0.35);
    shimmerGain.gain.linearRampToValueAtTime(volume * 0.1, now + 0.38);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    
    shimmerOsc.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);
    
    shimmerOsc.start(now + 0.35);
    shimmerOsc.stop(now + 0.6);
  } catch (e) {}
}

export function playOrbWhooshSound(volume = 0.2) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const noise = createNoiseBuffer(ctx, 0.4);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noise;
    
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.35);
    filter.Q.value = 2;
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    
    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    noiseSource.start(now);
    noiseSource.stop(now + 0.45);
  } catch (e) {}
}

export function playOrbConvergeSound(volume = 0.3) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const convergeNotes = [
      { freq: 220, time: 0, dur: 0.15 },
      { freq: 330, time: 0.08, dur: 0.15 },
      { freq: 440, time: 0.16, dur: 0.18 },
      { freq: 554, time: 0.26, dur: 0.2 },
      { freq: 660, time: 0.38, dur: 0.25 },
    ];
    
    convergeNotes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + time);
      osc.frequency.setValueAtTime(freq * 1.01, now + time + dur * 0.5);
      
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 1.5, now + time);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3000, now + time);
      filter.frequency.exponentialRampToValueAtTime(1200, now + time + dur);
      filter.Q.value = 2;
      
      gain.gain.setValueAtTime(0, now + time);
      gain.gain.linearRampToValueAtTime(volume * 0.4, now + time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
      
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + time);
      osc2.start(now + time);
      osc.stop(now + time + dur + 0.05);
      osc2.stop(now + time + dur + 0.05);
    });
  } catch (e) {}
}

export function playRingExpandSound(volume = 0.2) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.5);
    
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1200, now);
    osc2.frequency.exponentialRampToValueAtTime(300, now + 0.4);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4000, now);
    filter.frequency.exponentialRampToValueAtTime(600, now + 0.5);
    filter.Q.value = 3;
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.03);
    gain.gain.setValueAtTime(volume * 0.6, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.6);
    osc2.stop(now + 0.6);
  } catch (e) {}
}

export function playSparkleSound(volume = 0.15) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      const baseFreq = 2000 + Math.random() * 2000;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now + i * 0.06);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + i * 0.06 + 0.08);
      
      gain.gain.setValueAtTime(0, now + i * 0.06);
      gain.gain.linearRampToValueAtTime(volume * 0.5, now + i * 0.06 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.1);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.12);
    }
  } catch (e) {}
}

export function playTitleRevealSound(volume = 0.3) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const notes = [
      { freq: 392, time: 0, dur: 0.1 },
      { freq: 494, time: 0.06, dur: 0.1 },
      { freq: 587, time: 0.12, dur: 0.12 },
      { freq: 784, time: 0.2, dur: 0.18 },
      { freq: 988, time: 0.32, dur: 0.25 },
    ];
    
    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + time);
      
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, now + time);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(5000, now + time);
      filter.frequency.exponentialRampToValueAtTime(2500, now + time + dur);
      filter.Q.value = 2;
      
      gain.gain.setValueAtTime(0, now + time);
      gain.gain.linearRampToValueAtTime(volume * 0.5, now + time + 0.01);
      gain.gain.setValueAtTime(volume * 0.4, now + time + dur * 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
      
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + time);
      osc2.start(now + time);
      osc.stop(now + time + dur + 0.05);
      osc2.stop(now + time + dur + 0.05);
    });
    
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    const shimmerFilter = ctx.createBiquadFilter();
    
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(3000, now + 0.5);
    shimmer.frequency.linearRampToValueAtTime(4500, now + 0.8);
    
    shimmerFilter.type = 'bandpass';
    shimmerFilter.frequency.value = 3500;
    shimmerFilter.Q.value = 5;
    
    shimmerGain.gain.setValueAtTime(0, now + 0.5);
    shimmerGain.gain.linearRampToValueAtTime(volume * 0.15, now + 0.55);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    
    shimmer.connect(shimmerFilter);
    shimmerFilter.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);
    
    shimmer.start(now + 0.5);
    shimmer.stop(now + 0.95);
  } catch (e) {}
}

export function createBossMusicNode(volume = 0.18): { start: () => void; stop: () => void; fadeIn: () => void; fadeOut: (onComplete?: () => void) => void } {
  let isPlaying = false;
  let intervalId: number | null = null;
  let currentNotes: { osc: OscillatorNode; gain: GainNode }[] = [];
  let masterVolume = volume;
  let fadeIntervalId: number | null = null;
  
  const epicMelody = [
    { note: 196.00, dur: 0.3 },
    { note: 233.08, dur: 0.3 },
    { note: 261.63, dur: 0.4 },
    { note: 293.66, dur: 0.3 },
    { note: 349.23, dur: 0.5 },
    { note: 293.66, dur: 0.3 },
    { note: 261.63, dur: 0.4 },
    { note: 233.08, dur: 0.3 },
    { note: 196.00, dur: 0.5 },
    { note: 0, dur: 0.2 },
    { note: 261.63, dur: 0.3 },
    { note: 329.63, dur: 0.4 },
    { note: 392.00, dur: 0.5 },
    { note: 349.23, dur: 0.3 },
    { note: 293.66, dur: 0.4 },
    { note: 261.63, dur: 0.5 },
  ];
  
  const bassDrum = [
    { note: 80, dur: 0.15 },
    { note: 0, dur: 0.15 },
    { note: 0, dur: 0.15 },
    { note: 80, dur: 0.15 },
    { note: 0, dur: 0.15 },
    { note: 80, dur: 0.15 },
    { note: 0, dur: 0.15 },
    { note: 0, dur: 0.15 },
  ];
  
  let melodyIndex = 0;
  let bassIndex = 0;
  let tickCount = 0;
  
  const playBossNote = (freq: number, duration: number, type: OscillatorType, vol: number) => {
    if (freq === 0) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const distortion = ctx.createWaveShaper();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.setValueAtTime(freq * 1.02, now + duration * 0.5);
      
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(freq * 0.5, now);
      
      distortion.curve = makeDistortionCurve(8);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1500, now);
      filter.frequency.exponentialRampToValueAtTime(600, now + duration);
      filter.Q.value = 3;
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.02);
      gain.gain.setValueAtTime(vol * 0.8, now + duration * 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration * 1.1);
      
      osc.connect(distortion);
      osc2.connect(distortion);
      distortion.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc2.start(now);
      osc.stop(now + duration * 1.2);
      osc2.stop(now + duration * 1.2);
      
      currentNotes.push({ osc, gain });
      setTimeout(() => {
        const idx = currentNotes.findIndex(n => n.osc === osc);
        if (idx !== -1) currentNotes.splice(idx, 1);
      }, duration * 1200 + 100);
    } catch (e) {}
  };
  
  const playBassDrum = (freq: number, vol: number) => {
    if (freq === 0) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
      
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {}
  };
  
  const tick = () => {
    if (!isPlaying) return;
    
    if (tickCount % 2 === 0) {
      const m = epicMelody[melodyIndex];
      playBossNote(m.note, m.dur, 'square', masterVolume * 0.35);
      melodyIndex = (melodyIndex + 1) % epicMelody.length;
    }
    
    const b = bassDrum[bassIndex];
    playBassDrum(b.note, masterVolume * 0.5);
    bassIndex = (bassIndex + 1) % bassDrum.length;
    
    if (tickCount % 4 === 0) {
      try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const noise = createNoiseBuffer(ctx, 0.05);
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noise;
        const noiseGain = ctx.createGain();
        const noiseFilter = ctx.createBiquadFilter();
        
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 8000;
        
        noiseGain.gain.setValueAtTime(masterVolume * 0.15, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        
        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        
        noiseSource.start(now);
        noiseSource.stop(now + 0.06);
      } catch (e) {}
    }
    
    tickCount++;
  };
  
  const stopFade = () => {
    if (fadeIntervalId !== null) {
      clearInterval(fadeIntervalId);
      fadeIntervalId = null;
    }
  };
  
  return {
    start: () => {
      if (isPlaying) return;
      isPlaying = true;
      masterVolume = volume;
      melodyIndex = 0;
      bassIndex = 0;
      tickCount = 0;
      tick();
      intervalId = window.setInterval(tick, 180);
    },
    stop: () => {
      isPlaying = false;
      stopFade();
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      currentNotes.forEach(({ gain }) => {
        try {
          const ctx = getAudioContext();
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        } catch (e) {}
      });
      currentNotes = [];
    },
    fadeIn: () => {
      stopFade();
      if (!isPlaying) {
        isPlaying = true;
        masterVolume = 0;
        melodyIndex = 0;
        bassIndex = 0;
        tickCount = 0;
        tick();
        intervalId = window.setInterval(tick, 180);
      }
      const targetVolume = volume;
      const steps = 20;
      const stepDuration = 800 / steps;
      let currentStep = 0;
      
      fadeIntervalId = window.setInterval(() => {
        currentStep++;
        const progress = currentStep / steps;
        masterVolume = targetVolume * (1 - Math.pow(1 - progress, 2));
        
        if (currentStep >= steps) {
          stopFade();
          masterVolume = targetVolume;
        }
      }, stepDuration);
    },
    fadeOut: (onComplete?: () => void) => {
      stopFade();
      if (!isPlaying) {
        onComplete?.();
        return;
      }
      const startVolume = masterVolume;
      const steps = 20;
      const stepDuration = 800 / steps;
      let currentStep = 0;
      
      fadeIntervalId = window.setInterval(() => {
        currentStep++;
        const progress = currentStep / steps;
        masterVolume = startVolume * (1 - progress);
        
        if (currentStep >= steps) {
          stopFade();
          masterVolume = 0;
          isPlaying = false;
          if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
          }
          currentNotes.forEach(({ gain }) => {
            try {
              const ctx = getAudioContext();
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            } catch (e) {}
          });
          currentNotes = [];
          onComplete?.();
        }
      }, stepDuration);
    }
  };
}

export function playShieldActivateSound(volume = 0.3) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(200, now);
    osc1.frequency.exponentialRampToValueAtTime(800, now + 0.15);
    osc1.frequency.exponentialRampToValueAtTime(600, now + 0.3);
    
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(400, now);
    osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.12);
    
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(600, now + 0.1);
    osc3.frequency.exponentialRampToValueAtTime(1600, now + 0.25);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(4000, now + 0.15);
    filter.frequency.exponentialRampToValueAtTime(1500, now + 0.35);
    filter.Q.value = 4;
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.6, now + 0.02);
    gain.gain.setValueAtTime(volume * 0.5, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    
    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc1.start(now);
    osc2.start(now);
    osc3.start(now + 0.1);
    osc1.stop(now + 0.45);
    osc2.stop(now + 0.45);
    osc3.stop(now + 0.45);
  } catch (e) {}
}

export function playTeleportSound(volume = 0.35) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const noise = createNoiseBuffer(ctx, 0.3);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noise;
    
    const gain = ctx.createGain();
    const noiseGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const noiseFilter = ctx.createBiquadFilter();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1200, now);
    osc1.frequency.exponentialRampToValueAtTime(100, now + 0.15);
    osc1.frequency.exponentialRampToValueAtTime(2000, now + 0.25);
    osc1.frequency.exponentialRampToValueAtTime(400, now + 0.35);
    
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(800, now);
    osc2.frequency.exponentialRampToValueAtTime(2400, now + 0.2);
    
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, now);
    filter.frequency.exponentialRampToValueAtTime(2500, now + 0.15);
    filter.frequency.exponentialRampToValueAtTime(800, now + 0.35);
    filter.Q.value = 3;
    
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(3000, now);
    noiseFilter.Q.value = 2;
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.5, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    
    noiseGain.gain.setValueAtTime(volume * 0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    
    osc1.start(now);
    osc2.start(now);
    noiseSource.start(now);
    osc1.stop(now + 0.45);
    osc2.stop(now + 0.45);
    noiseSource.stop(now + 0.45);
  } catch (e) {}
}

export function playComboSound(comboCount: number, volume = 0.25) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const pitchMult = 1 + Math.min(comboCount, 10) * 0.08;
    const baseFreq = 660 * pitchMult;
    
    const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5];
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.04);
      
      gain.gain.setValueAtTime(0, now + i * 0.04);
      gain.gain.linearRampToValueAtTime(volume * (0.5 + comboCount * 0.02), now + i * 0.04 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.15);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.2);
    });
  } catch (e) {}
}

export function playCriticalHitSound(volume = 0.4) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const distortion = ctx.createWaveShaper();
    
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(400, now);
    osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
    osc1.frequency.exponentialRampToValueAtTime(200, now + 0.2);
    
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(600, now);
    osc2.frequency.exponentialRampToValueAtTime(100, now + 0.15);
    
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(1000, now);
    osc3.frequency.exponentialRampToValueAtTime(300, now + 0.1);
    
    distortion.curve = makeDistortionCurve(15);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4000, now);
    filter.frequency.exponentialRampToValueAtTime(1000, now + 0.2);
    filter.Q.value = 5;
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.7, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    osc1.connect(distortion);
    osc2.connect(distortion);
    osc3.connect(distortion);
    distortion.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
    osc3.stop(now + 0.35);
  } catch (e) {}
}

export function playNearMissSound(volume = 0.2) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
    
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.Q.value = 5;
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.25);
  } catch (e) {}
}

export function playChargeUpSound(volume = 0.25) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(100, now);
    osc1.frequency.exponentialRampToValueAtTime(800, now + 0.5);
    
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(150, now);
    osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.5);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(3000, now + 0.5);
    filter.Q.value = 4;
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.3, now + 0.05);
    gain.gain.linearRampToValueAtTime(volume * 0.6, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  } catch (e) {}
}

export function playEnergyBurstSound(volume = 0.35) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    for (let i = 0; i < 5; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      const startFreq = 800 + i * 200;
      osc.type = i % 2 === 0 ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(startFreq, now + i * 0.03);
      osc.frequency.exponentialRampToValueAtTime(startFreq * 0.3, now + i * 0.03 + 0.15);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(4000 - i * 400, now + i * 0.03);
      filter.Q.value = 3;
      
      gain.gain.setValueAtTime(volume * (0.4 - i * 0.05), now + i * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.03 + 0.2);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + i * 0.03);
      osc.stop(now + i * 0.03 + 0.25);
    }
  } catch (e) {}
}

export function playWhooshBySound(volume = 0.15) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const noise = createNoiseBuffer(ctx, 0.25);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noise;
    
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(2000, now + 0.1);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.2);
    filter.Q.value = 3;
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    
    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    noiseSource.start(now);
    noiseSource.stop(now + 0.3);
  } catch (e) {}
}

export function playPowerDownSound(volume = 0.25) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.4);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.4);
    filter.Q.value = 2;
    
    gain.gain.setValueAtTime(volume * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.5);
  } catch (e) {}
}

export function playWarningSound(volume = 0.3) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now + i * 0.15);
      osc.frequency.setValueAtTime(660, now + i * 0.15 + 0.075);
      
      gain.gain.setValueAtTime(0, now + i * 0.15);
      gain.gain.linearRampToValueAtTime(volume * 0.4, now + i * 0.15 + 0.01);
      gain.gain.setValueAtTime(volume * 0.4, now + i * 0.15 + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.14);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.15);
    }
  } catch (e) {}
}

export function playHealSound(volume = 0.3) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const notes = [523, 659, 784, 1047];
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      osc2.type = 'triangle';
      osc2.frequency.value = freq * 2;
      
      const startTime = now + i * 0.1;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume * 0.4, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);
      
      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc2.start(startTime);
      osc.stop(startTime + 0.4);
      osc2.stop(startTime + 0.4);
    });
    
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(2000, now + 0.4);
    shimmer.frequency.linearRampToValueAtTime(3000, now + 0.6);
    
    shimmerGain.gain.setValueAtTime(0, now + 0.4);
    shimmerGain.gain.linearRampToValueAtTime(volume * 0.15, now + 0.45);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    
    shimmer.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);
    
    shimmer.start(now + 0.4);
    shimmer.stop(now + 0.75);
  } catch (e) {}
}

export function playSparkleExplosionSound(volume = 0.5) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const masterGain = ctx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(ctx.destination);
    
    for (let i = 0; i < 12; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.type = 'sine';
      const baseFreq = 1200 + Math.random() * 2000;
      const startTime = now + i * 0.04 + Math.random() * 0.02;
      
      osc.frequency.setValueAtTime(baseFreq, startTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, startTime + 0.05);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.3, startTime + 0.25);
      
      filter.type = 'highpass';
      filter.frequency.value = 800;
      filter.Q.value = 1;
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      
      osc.start(startTime);
      osc.stop(startTime + 0.35);
    }
    
    for (let i = 0; i < 8; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      const freq = 2000 + i * 300;
      const startTime = now + 0.05 + i * 0.06;
      
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 2, startTime + 0.03);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, startTime + 0.15);
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);
      
      osc.connect(gain);
      gain.connect(masterGain);
      
      osc.start(startTime);
      osc.stop(startTime + 0.25);
    }
    
    const shimmerNoise = createNoiseBuffer(ctx, 0.8);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = shimmerNoise;
    
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(3000, now);
    noiseFilter.frequency.linearRampToValueAtTime(6000, now + 0.2);
    noiseFilter.frequency.exponentialRampToValueAtTime(1500, now + 0.6);
    noiseFilter.Q.value = 2;
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.08, now + 0.05);
    noiseGain.gain.linearRampToValueAtTime(0.04, now + 0.3);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    
    noiseSource.start(now);
    noiseSource.stop(now + 0.8);
    
    const chimeNotes = [1047, 1319, 1568, 2093, 2637];
    chimeNotes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      const startTime = now + 0.1 + i * 0.08;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
      
      osc.connect(gain);
      gain.connect(masterGain);
      
      osc.start(startTime);
      osc.stop(startTime + 0.55);
    });
    
  } catch (e) {}
}
