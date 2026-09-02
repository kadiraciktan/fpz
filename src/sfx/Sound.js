/**
 * Sound.js
 * Procedural sound effects via the Web Audio API (no audio files needed).
 * All sounds are synthesized: gunshots, reloads, hits, and a low war ambience.
 *
 * Usage:
 *   const sfx = new Sfx();
 *   sfx.unlock();          // call on first user gesture (pointer lock click)
 *   sfx.shoot('Pistol');
 *   sfx.reloadStart(); sfx.reloadEnd();
 *   sfx.enemyHit(); sfx.enemyDeath();
 *   sfx.startAmbience();
 */
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    // Per-category mix buses (all feed master): effects / music / ambience.
    this.busSfx = null;
    this.busMusic = null;
    this.busAmb = null;
    this._volume = 0.5;
    this._mix = { sfx: 1, music: 1, ambience: 1 };
    this._ambienceNodes = [];
    this._music = null;
  }

  /** Create the AudioContext lazily (must happen after a user gesture). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this._volume ?? 0.5;
    this.master.connect(this.ctx.destination);
    this.busSfx = this._makeBus(this._mix.sfx);
    this.busMusic = this._makeBus(this._mix.music);
    this.busAmb = this._makeBus(this._mix.ambience);
  }

  _makeBus(vol) {
    const bus = this.ctx.createGain();
    bus.gain.value = Math.max(0, Math.min(1, vol ?? 1));
    bus.connect(this.master);
    return bus;
  }

  _now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** Master volume 0..1 (settings menu). */
  setVolume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this._volume;
  }

  /**
   * Per-category mix 0..1 (settings menu): { sfx, music, ambience }.
   * Effective level of a sound = master × its category bus.
   */
  setMix(mix) {
    for (const key of ['sfx', 'music', 'ambience']) {
      if (!(key in mix)) continue;
      this._mix[key] = Math.max(0, Math.min(1, mix[key]));
    }
    if (!this.busSfx) return; // unlocked() will apply _mix at creation
    this.busSfx.gain.value = this._mix.sfx;
    this.busMusic.gain.value = this._mix.music;
    this.busAmb.gain.value = this._mix.ambience;
  }

  /** Tear down the audio graph when the run ends (a fresh Sfx is built per run). */
  dispose() {
    this.stopMusic();
    for (const n of this._ambienceNodes) {
      try { if (n.stop) n.stop(); } catch { /* already stopped */ }
    }
    this._ambienceNodes.length = 0;
    if (this.ctx) {
      try { this.ctx.close(); } catch { /* ignore */ }
      this.ctx = null;
      this.master = null;
      this.busSfx = this.busMusic = this.busAmb = null;
    }
  }

  // ── Procedural tension music ──────────────────────────────────────────
  // A low drone + an eighth-note minor bass sequence whose tempo and
  // register rise with the wave count. Scheduled from a setInterval
  // look-ahead loop so it never glitches on frame hitches.

  /** @param {number} [intensity] 0..1 (round / 12) */
  startMusic(intensity = 0.2) {
    if (!this.ctx || this._music) return;
    const t = this._now();
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(0.14, t + 4);
    out.connect(this.busMusic);

    // Continuous minor drone (A1 + E2, detuned saws through a lowpass)
    const droneFilter = this.ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 220;
    droneFilter.connect(out);
    const oscs = [];
    for (const [freq, detune, vol] of [[55, -6, 0.5], [55, 7, 0.4], [82.4, 0, 0.25]]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      osc.connect(g).connect(droneFilter);
      osc.start(t);
      oscs.push(osc, g);
    }

    this._music = {
      out, droneFilter, oscs,
      intensity,
      step: 0,
      nextTime: t + 0.12,
      timer: setInterval(() => this._musicTick(), 90),
    };
  }

  /** Tempo/register follow the wave intensity (0..1). */
  setMusicIntensity(x) {
    if (this._music) this._music.intensity = Math.max(0, Math.min(1, x));
  }

  stopMusic() {
    const m = this._music;
    if (!m) return;
    this._music = null;
    clearInterval(m.timer);
    if (!this.ctx) return;
    const t = this._now();
    m.out.gain.cancelScheduledValues(t);
    m.out.gain.setValueAtTime(m.out.gain.value, t);
    m.out.gain.linearRampToValueAtTime(0.0001, t + 0.8);
    for (const n of m.oscs) if (n.stop) n.stop(t + 1);
  }

  _musicTick() {
    const m = this._music;
    if (!m || !this.ctx) return;
    // A-minor bass sequence, one pitch per beat (every 2 eighth steps).
    const BASS = [55, 55, 65.41, 55, 73.42, 65.41, 55, 49];
    const LEAD = [220, 261.63, 293.66, 329.63];
    const stepDur = 60 / (72 + 52 * m.intensity) / 2;
    while (m.nextTime < this.ctx.currentTime + 0.3) {
      const t = m.nextTime;
      const beat = Math.floor(m.step / 2) % BASS.length;
      this._musicNote(t, BASS[beat], stepDur * 1.8, 300, 0.16);
      // Tension lead: only at higher intensity, on off-steps.
      if (m.intensity > 0.35 && m.step % 4 === 2) {
        this._musicNote(
          t,
          LEAD[Math.floor(m.step / 4) % LEAD.length],
          stepDur,
          1800,
          0.045 + 0.05 * m.intensity
        );
      }
      m.step++;
      m.nextTime += stepDur;
    }
  }

  _musicNote(t, freq, dur, cutoff, vol) {
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(lp).connect(g).connect(this._music.out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /**
   * Gunshot: sharp crack transient + body burst + deep chest thump + a
   * short tail echo, for a punchy street-echo feel.
   * Different weapons get slightly different pitch/length.
   */
  shoot(weaponName = 'Pistol') {
    if (!this.ctx) return;
    const t = this._now();
    const profiles = {
      Pistol: { noise: 0.09, bp: 1800, thump: 120, crack: 0.5, tail: 0.1 },
      Rifle: { noise: 0.14, bp: 1200, thump: 90, crack: 0.55, tail: 0.14 },
      Shotgun: { noise: 0.2, bp: 800, thump: 62, crack: 0.75, tail: 0.22 },
      Thompson: { noise: 0.07, bp: 2200, thump: 140, crack: 0.45, tail: 0.08 },
      M4A1: { noise: 0.1, bp: 1600, thump: 108, crack: 0.52, tail: 0.11 },
      MP5: { noise: 0.06, bp: 2500, thump: 150, crack: 0.42, tail: 0.07 },
      Cal50: { noise: 0.3, bp: 520, thump: 48, crack: 0.9, tail: 0.34 },
      LSW: { noise: 0.12, bp: 1050, thump: 82, crack: 0.6, tail: 0.16 },
    };
    const p = profiles[weaponName] || profiles.Pistol;

    // Noise burst (body of the shot)
    const noise = this._noiseBuffer(p.noise + 0.05);
    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = p.bp;
    bp.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + p.noise);
    src.connect(bp).connect(g).connect(this.busSfx);
    src.start(t);
    src.stop(t + p.noise + 0.05);

    // High crack transient: the initial "shot" snap that hits first
    const crackBuf = this._noiseBuffer(0.02);
    const crack = this.ctx.createBufferSource();
    crack.buffer = crackBuf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(p.crack, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    crack.connect(hp).connect(cg).connect(this.busSfx);
    crack.start(t);
    crack.stop(t + 0.03);

    // Low thump (chest hit)
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(p.thump, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.14);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.7, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(og).connect(this.busSfx);
    osc.start(t);
    osc.stop(t + 0.2);

    // Tail echo: a quieter, darker copy of the burst a few ms later
    const tailBuf = this._noiseBuffer(p.tail);
    const tail = this.ctx.createBufferSource();
    tail.buffer = tailBuf;
    const tlp = this.ctx.createBiquadFilter();
    tlp.type = 'lowpass';
    tlp.frequency.value = p.bp * 0.5;
    const tg = this.ctx.createGain();
    const te = t + 0.035;
    tg.gain.setValueAtTime(0.16, te);
    tg.gain.exponentialRampToValueAtTime(0.001, te + p.tail);
    tail.connect(tlp).connect(tg).connect(this.busSfx);
    tail.start(te);
    tail.stop(te + p.tail + 0.02);
  }

  /**
   * Suppressed gunshot: muffled mechanical click + low-pressure hiss,
   * no crack and no tail echo.
   */
  shootSuppressed(weaponName = 'Pistol') {
    if (!this.ctx) return;
    const t = this._now();

    // Muffled body: low-passed short noise
    const noise = this._noiseBuffer(0.08);
    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.45, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    src.connect(lp).connect(g).connect(this.busSfx);
    src.start(t);
    src.stop(t + 0.1);

    // Gas hiss
    const hiss = this._noiseBuffer(0.12);
    const hsrc = this.ctx.createBufferSource();
    hsrc.buffer = hiss;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 1.2;
    const hg = this.ctx.createGain();
    hg.gain.setValueAtTime(0.18, t + 0.01);
    hg.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    hsrc.connect(bp).connect(hg).connect(this.busSfx);
    hsrc.start(t + 0.01);
    hsrc.stop(t + 0.14);

    // Soft mechanical thump
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.07);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.28, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(og).connect(this.busSfx);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  /** Reload start: a mechanical clack. */
  reloadStart() {
    if (!this.ctx) return;
    const t = this._now();
    this._clack(t, 900, 0.05, 0.4);
  }

  /** Reload end: a firmer snap (magazine seated / bolt closed). */
  reloadEnd() {
    if (!this.ctx) return;
    const t = this._now();
    this._clack(t, 500, 0.08, 0.6);
    this._clack(t + 0.06, 1400, 0.04, 0.35);
  }

  /** Enemy hit: meaty impact — low thud + wet splat + subtle crunch. */
  enemyHit() {
    if (!this.ctx) return;
    const t = this._now();
    // Low body thud
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(g).connect(this.busSfx);
    osc.start(t);
    osc.stop(t + 0.13);
    // Wet splat: short mid-band noise
    this._clack(t + 0.005, 700, 0.06, 0.5);
    // Subtle crunch layer
    this._clack(t + 0.012, 2600, 0.03, 0.22);
  }

  /** Enemy death: heavier impact + guttural groan. */
  enemyDeath() {
    if (!this.ctx) return;
    const t = this._now();
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.25);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.65, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g).connect(this.busSfx);
    osc.start(t);
    osc.stop(t + 0.32);
    // Guttural groan layered under the thud
    const groan = this.ctx.createOscillator();
    groan.type = 'sawtooth';
    groan.frequency.setValueAtTime(110, t + 0.02);
    groan.frequency.exponentialRampToValueAtTime(55, t + 0.35);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    const gg = this.ctx.createGain();
    gg.gain.setValueAtTime(0.18, t + 0.02);
    gg.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    groan.connect(lp).connect(gg).connect(this.busSfx);
    groan.start(t + 0.02);
    groan.stop(t + 0.42);
    this._clack(t, 500, 0.09, 0.55);
  }

  /** Player hurt: dull thwack + short tinnitus ring. */
  playerHurt() {
    if (!this.ctx) return;
    const t = this._now();
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.1);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(lp).connect(g).connect(this.busSfx);
    osc.start(t);
    osc.stop(t + 0.15);
    // Ringing ear
    const ring = this.ctx.createOscillator();
    ring.type = 'sine';
    ring.frequency.value = 1900;
    const rg = this.ctx.createGain();
    rg.gain.setValueAtTime(0.08, t);
    rg.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    ring.connect(rg).connect(this.busSfx);
    ring.start(t);
    ring.stop(t + 0.36);
  }

  /** Power-up pickup: a short rising blip. */
  powerUp() {
    if (!this.ctx) return;
    const t = this._now();
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, t);
    osc.frequency.exponentialRampToValueAtTime(1000, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g).connect(this.busSfx);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  /**
   * Low war ambience: a filtered noise bed (distant wind / rumble) plus a
   * very slow low pulse. Starts once; safe to call repeatedly.
   */
  startAmbience() {
    if (!this.ctx || this._ambienceNodes.length) return;
    const t = this._now();

    // Filtered noise bed
    const noise = this._noiseBuffer(2.0, true);
    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 300;
    const g = this.ctx.createGain();
    g.gain.value = 0.06;
    src.connect(lp).connect(g).connect(this.busAmb);
    src.start(t);
    this._ambienceNodes.push(src, lp, g);

    // Slow low pulse (distant explosions / rumble)
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 38;
    const og = this.ctx.createGain();
    og.gain.value = 0.04;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.15;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(og.gain);
    osc.connect(og).connect(this.busAmb);
    osc.start(t);
    lfo.start(t);
    this._ambienceNodes.push(osc, og, lfo, lfoGain);
  }

  /**
   * Zombie growl: detuned guttural murmur, played by nearby walkers.
   * @param {number} vol
   * @param {number} pan - -1 (left) .. +1 (right) relative to the camera
   */
  zombieGrowl(vol = 0.3, pan = 0) {
    if (!this.ctx) return;
    const t = this._now();
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(70 + Math.random() * 40, t);
    osc.frequency.linearRampToValueAtTime(50, t + 0.55);
    const wob = this.ctx.createOscillator(); // throat wobble
    wob.frequency.value = 9 + Math.random() * 5;
    const wobG = this.ctx.createGain();
    wobG.gain.value = 14;
    wob.connect(wobG).connect(osc.frequency);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 340;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc.connect(lp).connect(g).connect(this._panner(pan));
    osc.start(t);
    wob.start(t);
    osc.stop(t + 0.75);
    wob.stop(t + 0.75);
  }

  /**
   * Stereo placement for a one-shot: pan -1..+1 relative to the listener.
   * StereoPannerNode is near-universal but degrade gracefully without it.
   */
  _panner(pan = 0) {
    if (!this.ctx || !this.busSfx) return this.master;
    const p = Math.max(-1, Math.min(1, pan || 0));
    if (!p || !this.ctx.createStereoPanner) return this.busSfx;
    const node = this.ctx.createStereoPanner();
    node.pan.value = p;
    node.connect(this.busSfx);
    return node;
  }

  /** Zombie death scream: rising-then-falling guttural shriek. */
  zombieScream() {
    if (!this.ctx) return;
    const t = this._now();
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.12);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.55);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700;
    bp.Q.value = 3.0;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(bp).connect(g).connect(this.busSfx);
    osc.start(t);
    osc.stop(t + 0.65);
    this.zombieGrowl(0.22);
  }

  /** Headcrab chirp: short high-pitched shriek, classic squeaky vermin. */
  headcrabChirp(vol = 0.22, pan = 0) {
    if (!this.ctx) return;
    const t = this._now();
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(850, t);
    osc.frequency.exponentialRampToValueAtTime(1500, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(480, t + 0.3);
    const vib = this.ctx.createOscillator(); // flutter
    vib.frequency.value = 28 + Math.random() * 10;
    const vibG = this.ctx.createGain();
    vibG.gain.value = 90;
    vib.connect(vibG).connect(osc.frequency);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1300;
    bp.Q.value = 4.0;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc.connect(bp).connect(g).connect(this._panner(pan));
    osc.start(t);
    vib.start(t);
    osc.stop(t + 0.35);
    vib.stop(t + 0.35);
  }

  /** Bomber detonation: boom + debris crackle. */
  explosion() {
    if (!this.ctx) return;
    const t = this._now();
    // Boom: big low-passed noise slam
    const noise = this._noiseBuffer(0.55);
    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1600, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + 0.5);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(1.0, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    src.connect(lp).connect(g).connect(this.busSfx);
    src.start(t);
    src.stop(t + 0.6);
    // Sub-bass chest punch
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(85, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.35);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.9, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(og).connect(this.busSfx);
    osc.start(t);
    osc.stop(t + 0.45);
    // Debris crackle tail
    for (let i = 0; i < 4; i++) {
      this._clack(t + 0.12 + Math.random() * 0.35, 1800 + Math.random() * 1500, 0.03, 0.15);
    }
  }

  /** Ray Gun: descending sci-fi zap with a bright attack. */
  rayShot() {
    if (!this.ctx) return;
    const t = this._now();
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.16);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 2.5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(bp).connect(g).connect(this.busSfx);
    osc.start(t);
    osc.stop(t + 0.22);
    // Bright crackle layer
    this._clack(t, 3200, 0.06, 0.25);
    this._clack(t + 0.03, 1800, 0.08, 0.15);
  }

  /** Shock round: electric crackle (hit or chain arc). */
  zap(vol = 0.4, pan = 0) {
    if (!this.ctx) return;
    const t = this._now();
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.exponentialRampToValueAtTime(500, t + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(g).connect(this._panner(pan));
    osc.start(t);
    osc.stop(t + 0.14);
    this._clack(t, 4200, 0.05, vol * 0.6);
    this._clack(t + 0.04, 2600, 0.04, vol * 0.4);
  }

  /** Dragon's Breath: short flame whoosh. */
  flame() {
    if (!this.ctx) return;
    const t = this._now();
    const noise = this._noiseBuffer(0.22);
    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(220, t + 0.2);
    bp.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    src.connect(bp).connect(g).connect(this.busSfx);
    src.start(t);
    src.stop(t + 0.24);
  }

  /** Boss roar: long guttural bellow that rattles the sub-bass. */
  bossRoar() {
    if (!this.ctx) return;
    const t = this._now();
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(70, t);
    osc.frequency.linearRampToValueAtTime(130, t + 0.3);
    osc.frequency.exponentialRampToValueAtTime(48, t + 1.1);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    osc.connect(lp).connect(g).connect(this.busSfx);
    osc.start(t);
    osc.stop(t + 1.25);
    // Sub-bass chest rumble under the bellow
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(45, t);
    sub.frequency.exponentialRampToValueAtTime(26, t + 1.0);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.4, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    sub.connect(sg).connect(this.busSfx);
    sub.start(t);
    sub.stop(t + 1.15);
  }

  /** Thunder: long rolling low rumble with a crack up front. */
  thunder() {
    if (!this.ctx) return;
    const t = this._now();
    const noise = this._noiseBuffer(1.2);
    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(90, t + 1.1);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    src.connect(lp).connect(g).connect(this.busAmb);
    src.start(t);
    src.stop(t + 1.25);
    this._clack(t, 2500, 0.08, 0.3);
  }

  /** Looping rain bed: level follows the weather intensity (0 = silent). */
  setRain(level) {
    if (!this.ctx) return;
    const lv = Math.max(0, Math.min(1, level));
    if (lv <= 0 && !this._rain) return;
    if (!this._rain) {
      const noise = this._noiseBuffer(2.0, true);
      const src = this.ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2200;
      bp.Q.value = 0.4;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      src.connect(bp).connect(g).connect(this.busAmb);
      src.start();
      this._rain = { src, g };
      this._ambienceNodes.push(src);
    }
    this._rain.g.gain.linearRampToValueAtTime(
      lv * 0.12,
      this._now() + 1.5
    );
  }

  /** Melee swing: filtered air whoosh. */
  meleeWhoosh() {
    if (!this.ctx) return;
    const t = this._now();
    const noise = this._noiseBuffer(0.18);
    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + 0.12);
    bp.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
    src.connect(bp).connect(g).connect(this.busSfx);
    src.start(t);
    src.stop(t + 0.2);
  }

  /** Low heartbeat thump (lub-dub) for critical HP state. */
  heartbeat() {
    if (!this.ctx) return;
    const t = this._now();
    for (const [off, vol] of [[0, 0.5], [0.16, 0.32]]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(58, t + off);
      osc.frequency.exponentialRampToValueAtTime(32, t + off + 0.1);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t + off);
      g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.12);
      osc.connect(g).connect(this.busSfx);
      osc.start(t + off);
      osc.stop(t + off + 0.14);
    }
  }

  /** Noisemaker: metallic clatter of a can hitting the ground. */
  clatter(big = false) {
    if (!this.ctx) return;
    const t = this._now();
    const n = big ? 4 : 2;
    for (let i = 0; i < n; i++) {
      this._clack(t + i * (0.05 + Math.random() * 0.05), 2400 + Math.random() * 1800, 0.04, big ? 0.5 : 0.25);
    }
  }

  /** Weapon swap: stock/hand rustle plus two metal bolt clacks. */
  weaponSwap() {
    if (!this.ctx) return;
    const t = this._now();
    const noise = this._noiseBuffer(0.16);
    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.14);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.connect(lp).connect(g).connect(this.busSfx);
    src.start(t);
    src.stop(t + 0.16);
    this._clack(t + 0.02, 1300, 0.05, 0.3);
    this._clack(t + 0.2, 1900, 0.05, 0.24);
  }

  /** Menu/Gunsmith UI blip (hover-level click). */
  uiClick() {
    if (!this.ctx) return;
    const t = this._now();
    this._clack(t, 1800, 0.03, 0.22);
  }

  /** Gunsmith equip confirm: two-tone rising blip. */
  uiConfirm() {
    if (!this.ctx) return;
    const t = this._now();
    for (const [off, f] of [[0, 760], [0.07, 1140]]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.16, t + off);
      g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.09);
      osc.connect(g).connect(this.busSfx);
      osc.start(t + off);
      osc.stop(t + off + 0.1);
    }
    this._clack(t + 0.02, 1500, 0.03, 0.18);
  }

  /** Locked/invalid selection: short low buzz. */
  uiDeny() {
    if (!this.ctx) return;
    const t = this._now();
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.12);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(lp).connect(g).connect(this.busSfx);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  /** A short filtered click (used for reload mechanics). */
  _clack(t, freq, dur, vol) {
    const noise = this._noiseBuffer(dur + 0.02);
    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 2.0;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(bp).connect(g).connect(this.busSfx);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /**
   * White-noise buffer — cached. Shooting used to fill a brand-new random
   * buffer (Math.random × 44k samples × 3) on every layer of every shot.
   * Several per-second-rounded variants per length keep repeats from
   * sounding identical during full-auto.
   * @param {number} seconds
   * @param {boolean} [loop] - mark as loopable (ambience)
   */
  _noiseBuffer(seconds, loop = false) {
    if (loop) {
      if (!this._loopNoise) this._loopNoise = this._makeNoise(seconds);
      return this._loopNoise;
    }
    if (!this._noiseCache) this._noiseCache = new Map();
    const key = Math.max(1, Math.ceil(seconds * 20)); // 50 ms buckets (rounded up)
    let variants = this._noiseCache.get(key);
    if (!variants) {
      const dur = key / 20;
      variants = [this._makeNoise(dur), this._makeNoise(dur), this._makeNoise(dur)];
      this._noiseCache.set(key, variants);
    }
    this._noiseVariant = ((this._noiseVariant || 0) + 1) % variants.length;
    return variants[this._noiseVariant];
  }

  /** Fresh random white-noise buffer of the given length. */
  _makeNoise(seconds) {
    const rate = this.ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = this.ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }
}
