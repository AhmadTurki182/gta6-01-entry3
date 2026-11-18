// audioEngine: all sound is synthesized with WebAudio — no audio files.
// Sirens, gunshots, engine hum, footsteps, and three procedural radio stations.
export function createAudioEngine() {
  let ctx = null;
  let master = null;
  let radioGain = null;
  let sfxGain = null;
  let muted = false;
  let station = 0;
  let radioTimer = null;
  let step = 0;

  const STATIONS = [
    { name: 'PALOMA FM 88.2 — Sunset Drive', bpm: 96, root: 55, wave: 'sawtooth', minor: true },
    { name: 'RADIO CORAL 101.5 — Latin Heat', bpm: 124, root: 65.41, wave: 'square', minor: false },
    { name: 'TALK BAY 640 — The Night Desk', bpm: 70, root: 49, wave: 'triangle', minor: true },
  ];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.9;
      sfxGain.connect(master);
      radioGain = ctx.createGain();
      radioGain.gain.value = 0.16;
      radioGain.connect(master);
      return true;
    } catch (err) {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, lowpass = 1200) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(sfxGain);
    src.start(t0);
  }

  const CHORDS_MINOR = [[0, 3, 7], [5, 8, 12], [3, 7, 10], [7, 10, 14]];
  const CHORDS_MAJOR = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [3, 7, 10]];

  function radioBeat() {
    if (!ctx || muted) return;
    const st = STATIONS[station];
    const beat = 60 / st.bpm;
    const chords = st.minor ? CHORDS_MINOR : CHORDS_MAJOR;
    const chord = chords[step % chords.length];
    const root = st.root;
    // Bass note.
    const bass = ctx.createOscillator();
    const bg = ctx.createGain();
    bass.type = 'sine';
    bass.frequency.value = root * Math.pow(2, chord[0] / 12);
    bg.gain.setValueAtTime(0.5, ctx.currentTime);
    bg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + beat * 0.9);
    bass.connect(bg); bg.connect(radioGain);
    bass.start(); bass.stop(ctx.currentTime + beat);
    // Arpeggio sparkle, every other beat.
    if (step % 2 === 0) {
      const arp = ctx.createOscillator();
      const ag = ctx.createGain();
      arp.type = st.wave;
      arp.frequency.value = root * 4 * Math.pow(2, chord[(step / 2) % 3 | 0] / 12);
      ag.gain.setValueAtTime(0.12, ctx.currentTime);
      ag.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + beat * 0.5);
      arp.connect(ag); ag.connect(radioGain);
      arp.start(); arp.stop(ctx.currentTime + beat * 0.5);
    }
    // Hat tick.
    const len = Math.floor(ctx.sampleRate * 0.03);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 6000;
    const hg = ctx.createGain(); hg.gain.value = 0.08;
    src.connect(hp); hp.connect(hg); hg.connect(radioGain);
    src.start();
    step += 1;
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    stationName() { return STATIONS[station].name; },
    nextStation() {
      station = (station + 1) % STATIONS.length;
      return STATIONS[station].name;
    },
    startRadio() {
      if (!ensure() || radioTimer) return;
      radioTimer = setInterval(radioBeat, 60000 / STATIONS[station].bpm);
    },
    stopRadio() { if (radioTimer) { clearInterval(radioTimer); radioTimer = null; } },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
    shoot(weapon) {
      if (weapon === 'shotgun') { noise(0.25, 0.9, 900); tone(120, 0.18, 'square', 0.5, 0, 40); }
      else if (weapon === 'rifle') { noise(0.14, 0.7, 1800); tone(220, 0.1, 'square', 0.35, 0, 60); }
      else if (weapon === 'smg') { noise(0.08, 0.55, 2200); }
      else { noise(0.12, 0.6, 1500); tone(180, 0.08, 'square', 0.3, 0, 50); }
    },
    explosion() { noise(0.9, 1.0, 500); tone(70, 0.8, 'sine', 0.9, 0, 28); },
    sirenBlip() { tone(880, 0.18, 'sine', 0.25, 0, 660); tone(660, 0.18, 'sine', 0.25, 0.18, 880); },
    pickup() { tone(660, 0.09, 'sine', 0.4); tone(990, 0.14, 'sine', 0.4, 0.09); },
    missionComplete() {
      tone(523, 0.15, 'triangle', 0.5); tone(659, 0.15, 'triangle', 0.5, 0.15);
      tone(784, 0.3, 'triangle', 0.5, 0.3);
    },
    missionFail() { tone(392, 0.3, 'sawtooth', 0.4, 0, 196); tone(196, 0.5, 'sawtooth', 0.4, 0.3, 98); },
    crash() { noise(0.3, 0.8, 700); tone(90, 0.25, 'square', 0.4, 0, 45); },
    engineStart() { tone(60, 0.4, 'sawtooth', 0.3, 0, 120); },
    door() { noise(0.08, 0.3, 800); },
    cash() { tone(880, 0.08, 'sine', 0.4); tone(1320, 0.12, 'sine', 0.4, 0.08); },
    busted() { tone(440, 0.4, 'square', 0.3, 0, 220); },
  };
}
