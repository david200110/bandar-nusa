// All sound is synthesized live with WebAudio — no audio files, no licensed
// music. A small step sequencer plays an original groove (bass, pads, hats) and
// the effects are short oscillator/noise bursts. Nothing starts until the player
// presses a button, because browsers block audio before a gesture.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let musicOn = false;
  let step = 0;
  let nextStepTime = 0;

  // Original groove in A minor, 112 BPM, 16 steps a bar. Bass walks the roots;
  // the pad holds two-note chords; the hats tick on the off-beats.
  const BPM = 112;
  const STEP_SECONDS = 60 / BPM / 4;
  const BASS = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 65.41, 0];
  const PAD = [
    [220, 261.63], [220, 261.63], [174.61, 220], [174.61, 220],
    [196, 246.94], [196, 246.94], [164.81, 220], [164.81, 220],
    [220, 261.63], [220, 261.63], [174.61, 220], [174.61, 220],
    [196, 246.94], [196, 246.94], [246.94, 293.66], [246.94, 293.66],
  ];

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioContext();
    } catch {
      return false;
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineGain.connect(master);
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 50;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineOsc.start();
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenGain.connect(master);
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 700;
    sirenOsc.connect(sirenGain);
    sirenOsc.start();
    nextStepTime = ctx.currentTime + 0.1;
    return true;
  }

  function tone(freq, duration, type, volume, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  function noiseBurst(duration, volume, filterFreq) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t);
  }

  function scheduleStep(index, time) {
    const bass = BASS[index % 16];
    if (bass > 0) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = bass;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + STEP_SECONDS * 1.8);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start(time);
      osc.stop(time + STEP_SECONDS * 2);
    }
    if (index % 8 === 0) {
      const chord = PAD[index % 16];
      for (const freq of chord) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 900;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.linearRampToValueAtTime(0.12, time + 0.3);
        gain.gain.linearRampToValueAtTime(0.0001, time + STEP_SECONDS * 8);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(musicGain);
        osc.start(time);
        osc.stop(time + STEP_SECONDS * 8);
      }
    }
    if (index % 4 === 2) {
      const length = Math.floor(ctx.sampleRate * 0.03);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 6000;
      const gain = ctx.createGain();
      gain.gain.value = 0.25;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(musicGain);
      source.start(time);
    }
  }

  function update() {
    if (!ctx || !musicOn) return;
    while (nextStepTime < ctx.currentTime + 0.15) {
      scheduleStep(step, nextStepTime);
      step = (step + 1) % 16;
      nextStepTime += STEP_SECONDS;
    }
  }

  function setMusic(on) {
    musicOn = on;
    if (on) ensure();
  }

  function setMuted(value) {
    muted = value;
    if (master) master.gain.value = muted ? 0 : 0.9;
    return muted;
  }

  function isMuted() {
    return muted;
  }

  function engine(speed01, driving) {
    if (!ctx) return;
    engineGain.gain.setTargetAtTime(driving ? 0.05 + speed01 * 0.06 : 0, ctx.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(45 + speed01 * 110, ctx.currentTime, 0.1);
  }

  function siren(on) {
    if (!ctx) return;
    sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.2);
    if (on) sirenOsc.frequency.setTargetAtTime(620 + (Math.sin(ctx.currentTime * 4) * 0.5 + 0.5) * 260, ctx.currentTime, 0.05);
  }

  function punch() {
    noiseBurst(0.12, 0.5, 500);
    tone(90, 0.12, 'sine', 0.5);
  }

  function pickup() {
    tone(880, 0.12, 'sine', 0.3);
    tone(1318.5, 0.18, 'sine', 0.3, 0.08);
  }

  function crash() {
    noiseBurst(0.25, 0.6, 900);
    tone(60, 0.2, 'sine', 0.5);
  }

  function click() {
    tone(1200, 0.05, 'square', 0.12);
  }

  function jingle() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => tone(freq, 0.22, 'triangle', 0.3, i * 0.11));
  }

  function fail() {
    const notes = [392, 311.13, 261.63];
    notes.forEach((freq, i) => tone(freq, 0.3, 'triangle', 0.3, i * 0.16));
  }

  return { ensure, update, setMusic, setMuted, isMuted, engine, siren, punch, pickup, crash, click, jingle, fail };
}
