// Original WebAudio synth music for Bandar Nusa. A slow minor-key pad,
// a simple bass line and a soft drum pulse, all synthesized live — no
// audio files and no copyrighted material.

const CHORDS = [
  [220.0, 261.63, 329.63], // A minor
  [174.61, 220.0, 261.63], // F major
  [196.0, 246.94, 293.66], // G major (as D minor colour)
  [164.81, 220.0, 261.63], // E minor
];
const BASS = [55.0, 43.65, 49.0, 41.2];
const BAR_SECONDS = 4;

export function createMusic() {
  let ctx = null;
  let master = null;
  let padGain = null;
  let timer = null;
  let bar = 0;
  let step = 0;
  let enabled = true;
  let started = false;

  function ensure() {
    if (ctx) return true;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    padGain = ctx.createGain();
    padGain.gain.value = 0.08;
    padGain.connect(master);
    return true;
  }

  function playPad(freqs) {
    if (!ctx) return;
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.8);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + BAR_SECONDS + 0.5);
      osc.connect(g);
      g.connect(padGain);
      osc.start();
      osc.stop(ctx.currentTime + BAR_SECONDS + 0.6);
    }
  }

  function playBass(freq) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.14, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    osc.connect(filter);
    filter.connect(g);
    g.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + 1);
  }

  function playHat() {
    if (!ctx) return;
    const dur = 0.05;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
  }

  function tick() {
    if (!ctx || !enabled) return;
    if (step === 0) {
      playPad(CHORDS[bar % CHORDS.length]);
      playBass(BASS[bar % BASS.length]);
    }
    if (step % 2 === 0) playHat();
    if (step === 4) playBass(BASS[bar % BASS.length] * 1.5);
    step += 1;
    if (step >= 8) {
      step = 0;
      bar += 1;
    }
  }

  return {
    start() {
      if (started) {
        if (ctx && ctx.state === 'suspended') ctx.resume();
        return;
      }
      if (!ensure()) return;
      started = true;
      ctx.resume();
      timer = window.setInterval(tick, (BAR_SECONDS * 1000) / 8);
      tick();
    },
    toggle() {
      enabled = !enabled;
      if (master) master.gain.value = enabled ? 0.5 : 0;
      return enabled;
    },
    isEnabled() {
      return enabled;
    },
    stop() {
      if (timer) window.clearInterval(timer);
      timer = null;
      started = false;
    },
  };
}
