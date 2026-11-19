// All sound is synthesized live with WebAudio: an original A-minor groove at
// 112 BPM, engine hum, police sirens, punches, crashes and jingles. No files.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let noiseBuf = null;
  let muted = false;
  let step = 0;
  let nextTime = 0;
  const BPM = 112;
  const SPB = 60 / BPM / 4; // one 16th note
  // A minor: Am – F – C – G, one bar each.
  const ROOTS = [55, 43.65, 65.41, 49];
  const CHORDS = [
    [220, 261.63, 329.63],
    [174.61, 220, 261.63],
    [261.63, 329.63, 392],
    [196, 246.94, 293.66],
  ];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.32;
      musicGain.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      // Engine: a low sawtooth through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 400;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine that swings between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 750;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      nextTime = ctx.currentTime + 0.1;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, when, dur, type, gain, dest) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g);
    g.connect(dest || musicGain);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  function noise(when, dur, gain, filterFreq) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    s.connect(f);
    f.connect(g);
    g.connect(master);
    s.start(when);
    s.stop(when + dur + 0.05);
  }

  function scheduleStep() {
    if (!ctx) return;
    const bar = Math.floor(step / 16) % 4;
    const beat = step % 16;
    const when = nextTime;
    // Bass on beats 0, 3, 6, 8, 11, 14 of each bar.
    if ([0, 3, 6, 8, 11, 14].includes(beat)) {
      tone(ROOTS[bar], when, SPB * 2.2, 'triangle', 0.5);
    }
    // Pad chord at the top of each bar.
    if (beat === 0) {
      for (const f of CHORDS[bar]) tone(f, when, SPB * 15, 'sine', 0.07);
    }
    // Hat on every off-beat 8th.
    if (beat % 2 === 1) noise(when, 0.03, 0.05, 8000);
    // Snare-ish noise on beats 4 and 12.
    if (beat === 4 || beat === 12) noise(when, 0.09, 0.12, 2500);
    step += 1;
    nextTime += SPB;
  }

  return {
    get muted() {
      return muted;
    },
    // Call on the first user gesture; also starts the groove.
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') void ctx.resume();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    // Called every frame with the driving state.
    update(dt, { speed, wanted, driving }) {
      if (!ctx || muted) return;
      while (nextTime < ctx.currentTime + 0.15) scheduleStep();
      if (engineGain) {
        engineGain.gain.value = driving ? 0.04 + Math.min(0.09, speed * 0.004) : 0.015;
        engineOsc.frequency.value = 55 + speed * 4.5;
      }
      if (sirenGain) {
        sirenGain.gain.value = wanted > 0 ? 0.045 : 0;
        if (wanted > 0) {
          sirenOsc.frequency.value = Math.sin(performance.now() / 280) > 0 ? 950 : 700;
        }
      }
    },
    punch() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      noise(t, 0.08, 0.3, 1200);
      tone(120, t, 0.1, 'sine', 0.4, master);
    },
    crash() {
      if (!ctx || muted) return;
      noise(ctx.currentTime, 0.25, 0.35, 900);
    },
    pickup() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      tone(880, t, 0.09, 'sine', 0.25);
      tone(1318.5, t + 0.09, 0.14, 'sine', 0.25);
    },
    jingle() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.11, 0.22, 'triangle', 0.28));
    },
    busted() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      [392, 311.13, 261.63].forEach((f, i) => tone(f, t + i * 0.16, 0.3, 'sawtooth', 0.16));
    },
    fanfare() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      [440, 554.37, 659.25, 880, 1108.7].forEach((f, i) => tone(f, t + i * 0.12, 0.35, 'triangle', 0.26));
    },
  };
}
