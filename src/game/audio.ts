/**
 * 100% Procedural Web Audio API Sound Effects & Music
 * Zero external mp3 dependencies
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private isBgmPlaying = false;
  private bgmTimer: number | null = null;
  private micStream: MediaStream | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private micCheckLoop: number | null = null;
  private micThreshold = 0.45; // RMS threshold for shout detection
  private lastCheersTime = 0;

  private master: GainNode | null = null;
  private masterVolume = 1;

  /** Master bus every sound routes through, so the settings slider controls all SFX/BGM. */
  private out(ctx: AudioContext): GainNode {
    if (!this.master) {
      this.master = ctx.createGain();
      this.master.gain.value = this.masterVolume;
      this.master.connect(ctx.destination);
    }
    return this.master;
  }

  setMasterVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.master) this.master.gain.value = this.masterVolume;
  }

  getMasterVolume() {
    return this.masterVolume;
  }

  private noiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const size = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // ---- Lobby / menu UI SFX ----

  private hoverToggle = false;

  // Hover: alternates a chopstick "cạch" tap and an ice-cube "leng keng"
  playUiHover() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;
    this.hoverToggle = !this.hoverToggle;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    if (this.hoverToggle) {
      osc.type = 'square';
      osc.frequency.setValueAtTime(1900, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.03);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(3200 + Math.random() * 600, now);
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    }
    osc.connect(gain);
    gain.connect(this.out(ctx));
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Click: beer cap popping "Bóc..." followed by a "Xììì" fizz
  playBottleOpen() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    const pop = ctx.createOscillator();
    const popGain = ctx.createGain();
    pop.type = 'sine';
    pop.frequency.setValueAtTime(420, now);
    pop.frequency.exponentialRampToValueAtTime(90, now + 0.07);
    popGain.gain.setValueAtTime(0.35, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    pop.connect(popGain);
    popGain.connect(this.out(ctx));
    pop.start(now);
    pop.stop(now + 0.1);

    const fizz = ctx.createBufferSource();
    fizz.buffer = this.noiseBuffer(ctx, 0.55);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4200;
    const fizzGain = ctx.createGain();
    fizzGain.gain.setValueAtTime(0.001, now + 0.05);
    fizzGain.gain.linearRampToValueAtTime(0.09, now + 0.1);
    fizzGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    fizz.connect(hp);
    hp.connect(fizzGain);
    fizzGain.connect(this.out(ctx));
    fizz.start(now + 0.05);
    fizz.stop(now + 0.6);
  }

  // Flickering neon sign "xẹt xẹt"
  playNeonBuzz() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;
    const hum = ctx.createOscillator();
    const humGain = ctx.createGain();
    hum.type = 'sawtooth';
    hum.frequency.value = 120;
    humGain.gain.setValueAtTime(0.0001, now);
    [0, 0.06, 0.1, 0.17].forEach((t, i) => {
      humGain.gain.setValueAtTime(i % 2 === 0 ? 0.035 : 0.0001, now + t);
    });
    humGain.gain.setValueAtTime(0.0001, now + 0.24);
    hum.connect(humGain);
    humGain.connect(this.out(ctx));
    hum.start(now);
    hum.stop(now + 0.25);

    const crackle = ctx.createBufferSource();
    crackle.buffer = this.noiseBuffer(ctx, 0.2);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    const cGain = ctx.createGain();
    cGain.gain.setValueAtTime(0.05, now);
    cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    crackle.connect(bp);
    bp.connect(cGain);
    cGain.connect(this.out(ctx));
    crackle.start(now);
    crackle.stop(now + 0.2);
  }

  // Whole table shouting "DZÔÔÔ!" in unison: a crowd of formant-filtered voices
  playCrowdDzo() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;
    for (let v = 0; v < 7; v++) {
      const start = now + Math.random() * 0.08;
      const base = 120 + Math.random() * 150;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(base * 0.8, start);
      osc.frequency.linearRampToValueAtTime(base * 1.25, start + 0.25);
      osc.frequency.linearRampToValueAtTime(base * 1.1, start + 1.1);
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, start);
      out.gain.linearRampToValueAtTime(0.05, start + 0.08);
      out.gain.setValueAtTime(0.05, start + 0.85);
      out.gain.exponentialRampToValueAtTime(0.001, start + 1.3);
      // "Ô" vowel formants
      [480, 820].forEach((f) => {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = f;
        bp.Q.value = 6;
        osc.connect(bp);
        bp.connect(out);
      });
      out.connect(this.out(ctx));
      osc.start(start);
      osc.stop(start + 1.35);
    }
    this.playCheer();
    setTimeout(() => this.playClink(1.1), 650);
  }

  private initCtx(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Metallic & crystal beer mug clink "KENG!"
  playClink(pitchMultiplier = 1.0) {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    // Harmonic strike 1: High crisp impact
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(2600 * pitchMultiplier, now);
    osc1.frequency.exponentialRampToValueAtTime(2200 * pitchMultiplier, now + 0.35);

    gain1.gain.setValueAtTime(0.7, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc1.connect(gain1);
    gain1.connect(this.out(ctx));
    osc1.start(now);
    osc1.stop(now + 0.7);

    // Harmonic strike 2: Glass overtone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(3950 * pitchMultiplier, now);
    osc2.frequency.exponentialRampToValueAtTime(3400 * pitchMultiplier, now + 0.25);

    gain2.gain.setValueAtTime(0.35, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc2.connect(gain2);
    gain2.connect(this.out(ctx));
    osc2.start(now);
    osc2.stop(now + 0.5);

    // Thud resonance: mug bottom impact
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(450 * pitchMultiplier, now);
    osc3.frequency.exponentialRampToValueAtTime(180, now + 0.12);

    gain3.gain.setValueAtTime(0.4, now);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc3.connect(gain3);
    gain3.connect(this.out(ctx));
    osc3.start(now);
    osc3.stop(now + 0.25);
  }

  // Beer pour & fizzy foam sound
  playPour() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;
    const duration = 1.2;

    // Noise buffer for fizz
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.linearRampToValueAtTime(2400, now + duration);
    filter.Q.value = 3.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.out(ctx));

    noise.start(now);
    noise.stop(now + duration);
  }

  // Gulping swallow sound
  playGulp() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.18);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain);
    gain.connect(this.out(ctx));

    osc.start(now);
    osc.stop(now + 0.22);
  }

  // Crocodile toy jaw snap "KHẬP!"
  playSnap() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);

    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.connect(gain);
    gain.connect(this.out(ctx));

    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Dice shake & rattle
  playDiceShake() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    for (let i = 0; i < 4; i++) {
      const clickTime = now + i * 0.08 + Math.random() * 0.03;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800 + Math.random() * 600, clickTime);
      gain.gain.setValueAtTime(0.3, clickTime);
      gain.gain.exponentialRampToValueAtTime(0.01, clickTime + 0.05);

      osc.connect(gain);
      gain.connect(this.out(ctx));
      osc.start(clickTime);
      osc.stop(clickTime + 0.06);
    }
  }

  // Service bell "DING DONG!"
  playBell() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.setValueAtTime(1150, now + 0.25);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.connect(gain);
    gain.connect(this.out(ctx));

    osc.start(now);
    osc.stop(now + 1.3);
  }

  // Drunk hiccup
  playHiccup() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.1);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.2);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    osc.connect(gain);
    gain.connect(this.out(ctx));

    osc.start(now);
    osc.stop(now + 0.24);
  }

  // Collective crowd cheer "1 2 3 DZÔÔÔ!" with 3-stage clink -> gulp -> slam audio
  playCheer() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    // Rhythm chants ("1, 2, 3... DZÔ!")
    const chordPitches = [330, 415, 493, 659];
    chordPitches.forEach((pitch, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.linearRampToValueAtTime(pitch * 1.28, now + 0.65);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95 + idx * 0.08);

      osc.connect(gain);
      gain.connect(this.out(ctx));
      osc.start(now);
      osc.stop(now + 1.15);
    });

    // Phase 1 (0.3s - 0.55s): Multi-glass clinks "KENG! KENG!"
    setTimeout(() => this.playClink(1.0), 280);
    setTimeout(() => this.playClink(1.14), 360);
    setTimeout(() => this.playClink(0.92), 440);

    // Phase 2 (0.9s - 1.8s): 3 rhythmic gulps "ỰC... ỰC... ỰC!"
    setTimeout(() => this.playGulp(), 900);
    setTimeout(() => this.playGulp(), 1250);
    setTimeout(() => this.playGulp(), 1600);

    // Phase 3 (2.05s): Slam mug down on stainless steel table "CỘP! KHÀ!"
    setTimeout(() => this.playMugSlam(), 2050);
  }

  // Slam glass mug down onto stainless steel table ("CỘP!")
  playMugSlam() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.14);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.16);

    osc.connect(gain);
    gain.connect(this.out(ctx));
    osc.start(now);
    osc.stop(now + 0.18);
  }

  // Slap / snatch bill sound
  playSlap() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(this.out(ctx));
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // Wooden bamboo chopsticks clacking "CẠCH CẠCH!"
  playChopstickClack() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    [0, 0.065].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const baseFreq = idx === 0 ? 1150 : 1380;
      osc.frequency.setValueAtTime(baseFreq, now + offset);
      osc.frequency.exponentialRampToValueAtTime(380, now + offset + 0.045);

      gain.gain.setValueAtTime(0.45, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.005, now + offset + 0.05);

      osc.connect(gain);
      gain.connect(this.out(ctx));
      osc.start(now + offset);
      osc.stop(now + offset + 0.055);
    });
  }

  // Crispy snack crunch (eating peanuts, chicken feet, green mango)
  playCrunch() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    for (let bite = 0; bite < 3; bite++) {
      const start = now + bite * 0.11;
      const dur = 0.075;
      const bufferSize = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400 + bite * 250, start);
      filter.Q.value = 2.2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.45, start);
      gain.gain.exponentialRampToValueAtTime(0.01, start + dur);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.out(ctx));
      noise.start(start);
      noise.stop(start + dur);
    }
  }

  // Spicy chili trap sizzle & whistle
  playSpicySizzle() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(1450, now + 0.35);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    osc.connect(gain);
    gain.connect(this.out(ctx));
    osc.start(now);
    osc.stop(now + 0.42);
  }

  // Ice water splash / Cold towel slap ("XOẸT! ÀO!")
  playSplash() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;
    const duration = 0.55;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.45));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(650, now + duration);
    filter.Q.value = 1.6;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.out(ctx));
    noise.start(now);
    noise.stop(now + duration);
  }

  // Plastic stool tumble & crash ("RẦM!")
  playChairFall() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    [0, 0.14].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(i === 0 ? 220 : 140, now + offset);
      osc.frequency.exponentialRampToValueAtTime(38, now + offset + 0.25);

      gain.gain.setValueAtTime(0.65, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.28);

      osc.connect(gain);
      gain.connect(this.out(ctx));
      osc.start(now + offset);
      osc.stop(now + offset + 0.3);
    });
  }

  // Headbutt / Throw impact ("BỐP!")
  playHeadbutt() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.16);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.connect(gain);
    gain.connect(this.out(ctx));
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Table-slapping laugh ("HA HA HA!")
  playLaugh() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;
    [0, 0.15, 0.3, 0.46].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const base = 360 - idx * 25;
      osc.frequency.setValueAtTime(base, now + offset);
      osc.frequency.exponentialRampToValueAtTime(base * 0.72, now + offset + 0.11);

      gain.gain.setValueAtTime(0.32, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.12);

      osc.connect(gain);
      gain.connect(this.out(ctx));
      osc.start(now + offset);
      osc.stop(now + offset + 0.13);
    });
  }

  // Street motorbike double horn ("BÍP BÍP!")
  playHornBeep() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;
    [0, 0.16].forEach((offset) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(440, now + offset);
      osc2.frequency.setValueAtTime(554.37, now + offset);

      gain.gain.setValueAtTime(0.26, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.11);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.out(ctx));
      osc1.start(now + offset);
      osc2.start(now + offset);
      osc1.stop(now + offset + 0.12);
      osc2.stop(now + offset + 0.12);
    });
  }

  // Urban inspection patrol siren ("Ò Ó O... PHƯỜNG ĐI DẸP VỈA HÈ!")
  playSiren() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.linearRampToValueAtTime(960, now + 0.35);
    osc.frequency.linearRampToValueAtTime(620, now + 0.7);
    osc.frequency.linearRampToValueAtTime(960, now + 1.05);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.15);

    osc.connect(gain);
    gain.connect(this.out(ctx));
    osc.start(now);
    osc.stop(now + 1.2);
  }

  // Cậu Vàng dog happy bark ("GÂU GÂU!")
  playDogBark() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;
    [0, 0.16].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const f = idx === 0 ? 310 : 350;
      osc.frequency.setValueAtTime(f, now + offset);
      osc.frequency.exponentialRampToValueAtTime(115, now + offset + 0.09);

      gain.gain.setValueAtTime(0.45, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.1);

      osc.connect(gain);
      gain.connect(this.out(ctx));
      osc.start(now + offset);
      osc.stop(now + offset + 0.11);
    });
  }

  // Loa Kẹo Kéo Vinahouse / Bolero bass & echo riff
  playKaraokeBeat() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;
    const notes = [196, 246.94, 293.66, 392, 293.66, 392];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.13);

      gain.gain.setValueAtTime(0.25, now + idx * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.13 + 0.11);

      osc.connect(gain);
      gain.connect(this.out(ctx));
      osc.start(now + idx * 0.13);
      osc.stop(now + idx * 0.13 + 0.12);
    });
  }

  // Animalese / Minions-style gibberish TTS per character ("léo nhéo", slurred when drunk)
  playAnimaleseBlip(charCode: number, alcoholLevel: number) {
    const ctx = this.initCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const drunkRatio = Math.min(1, Math.max(0, alcoholLevel / 100));
    osc.type = drunkRatio > 0.6 ? 'sawtooth' : 'triangle';

    // Map character code to cute high-pitched frequency (420Hz - 760Hz), warped when drunk
    const baseFreq = 440 + ((charCode * 37) % 320);
    const drunkDetune = (Math.random() - 0.5) * drunkRatio * 260;
    const startFreq = Math.max(180, baseFreq + drunkDetune - drunkRatio * 90);
    const dur = 0.042 + drunkRatio * 0.035;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.linearRampToValueAtTime(
      startFreq * (drunkRatio > 0.5 ? 0.72 : 1.14),
      now + dur
    );

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + dur);

    osc.connect(gain);
    gain.connect(this.out(ctx));
    osc.start(now);
    osc.stop(now + dur + 0.005);
  }

  // Slamming hand onto stainless steel table when shouting with "!" or ALL CAPS ("RẦM!")
  playTableSlam() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(195, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.22);

    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.connect(gain);
    gain.connect(this.out(ctx));
    osc.start(now);
    osc.stop(now + 0.26);
  }

  // Gentle acoustic guitar street vibe background music
  toggleBGM(enable: boolean) {
    if (enable) {
      if (this.isBgmPlaying) return;
      const ctx = this.initCtx();
      this.isBgmPlaying = true;
      this.bgmGain = ctx.createGain();
      this.bgmGain.gain.setValueAtTime(0.08, ctx.currentTime);
      this.bgmGain.connect(this.out(ctx));

      // Chords loop: C - Am - F - G (Chill Vietnam acoustic vibe)
      const chords = [
        [261.63, 329.63, 392.00], // C
        [220.00, 261.63, 329.63], // Am
        [174.61, 220.00, 261.63], // F
        [196.00, 246.94, 293.66], // G
      ];

      let chordIdx = 0;
      const playNextChord = () => {
        if (!this.isBgmPlaying || !this.ctx || !this.bgmGain) return;
        const now = this.ctx.currentTime;
        const currentChord = chords[chordIdx % chords.length];
        chordIdx++;

        currentChord.forEach((note, nIdx) => {
          const osc = this.ctx!.createOscillator();
          const noteGain = this.ctx!.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(note, now + nIdx * 0.12);

          noteGain.gain.setValueAtTime(0.001, now + nIdx * 0.12);
          noteGain.gain.linearRampToValueAtTime(0.12, now + nIdx * 0.12 + 0.08);
          noteGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

          osc.connect(noteGain);
          noteGain.connect(this.bgmGain!);

          osc.start(now + nIdx * 0.12);
          osc.stop(now + 2.0);
        });

        this.bgmTimer = window.setTimeout(playNextChord, 1800);
      };

      playNextChord();
    } else {
      this.isBgmPlaying = false;
      if (this.bgmTimer) {
        clearTimeout(this.bgmTimer);
        this.bgmTimer = null;
      }
      if (this.bgmGain) {
        this.bgmGain.disconnect();
        this.bgmGain = null;
      }
    }
  }

  // Real-time Mic Cheers ("1 2 3 DZÔ!" Voice Trigger & Lip-Sync Volume)
  async startMicCheers(
    onCheers: (volume: number) => void,
    onError?: (err: unknown) => void,
    onVolumeChange?: (rms: number) => void
  ) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.micStream = stream;
      const ctx = this.initCtx();
      const source = ctx.createMediaStreamSource(stream);
      this.micAnalyser = ctx.createAnalyser();
      this.micAnalyser.fftSize = 512;
      source.connect(this.micAnalyser);

      const dataArray = new Uint8Array(this.micAnalyser.fftSize);

      const checkMic = () => {
        if (!this.micAnalyser) return;
        this.micAnalyser.getByteTimeDomainData(dataArray);

        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const norm = (dataArray[i] - 128) / 128;
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        onVolumeChange?.(Math.min(1, rms * 2.5));

        const now = Date.now();
        if (rms > this.micThreshold && now - this.lastCheersTime > 2500) {
          this.lastCheersTime = now;
          onCheers(rms);
        }

        this.micCheckLoop = requestAnimationFrame(checkMic);
      };

      checkMic();
      return true;
    } catch (err) {
      console.warn('Microphone permission or access error:', err);
      onError?.(err);
      return false;
    }
  }

  stopMicCheers() {
    if (this.micCheckLoop) {
      cancelAnimationFrame(this.micCheckLoop);
      this.micCheckLoop = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    this.micAnalyser = null;
  }

  // Nhạc kịch tính + Voice-line gọi "Chủ quán ơiiii! Cho xin cái bill!"
  playCallBillDramatic() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    // 1. Dramatic street-pub brass sting ("Tèn Ten Ten!")
    const stingNotes = [440, 554.37, 659.25, 880];
    stingNotes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const t0 = now + i * 0.075;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.18, t0);
      gain.gain.exponentialRampToValueAtTime(0.008, t0 + 0.35);
      osc.connect(gain);
      gain.connect(this.out(ctx));
      osc.start(t0);
      osc.stop(t0 + 0.36);
    });

    // 2. Expressive Animalese shout cadence ("Chủ quán ơiiii!")
    [0.32, 0.42, 0.52, 0.64, 0.78].forEach((offset, idx) => {
      setTimeout(() => {
        this.playAnimaleseBlip(70 + idx * 7, 55);
      }, offset * 1000);
    });
  }

  // Tiếng xé đôi tờ hóa đơn cái rẹt ("RẸT RẸT!")
  playPaperRip() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    const duration = 0.28;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.sin((i / bufferSize) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.linearRampToValueAtTime(3600, now + duration);
    filter.Q.value = 3.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.02, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.out(ctx));
    noise.start(now);
    noise.stop(now + duration);
  }

  // Tiếng dập mộc đỏ chót "BÁC BỎ! NHẬU TIẾP!"
  playStampSlam() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.22);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);

    osc.connect(gain);
    gain.connect(this.out(ctx));
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // Tiếng két bia nhựa đỏ rơi từ trên trời xuống đất "RẦM! LENG KENG!"
  playCrateDropCrash() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    // Heavy plastic crate thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.32);
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.34);
    osc.connect(gain);
    gain.connect(this.out(ctx));
    osc.start(now);
    osc.stop(now + 0.35);

    // Glass bottles rattling inside the crate
    [0.06, 0.13, 0.21, 0.29].forEach((offset, idx) => {
      const bOsc = ctx.createOscillator();
      const bGain = ctx.createGain();
      bOsc.type = 'sine';
      bOsc.frequency.setValueAtTime(2100 + idx * 320, now + offset);
      bOsc.frequency.exponentialRampToValueAtTime(1750, now + offset + 0.08);
      bGain.gain.setValueAtTime(0.22, now + offset);
      bGain.gain.exponentialRampToValueAtTime(0.008, now + offset + 0.09);
      bOsc.connect(bGain);
      bGain.connect(this.out(ctx));
      bOsc.start(now + offset);
      bOsc.stop(now + offset + 0.095);
    });
  }

  // Tiếng huýt sáo / gõ chén gọi chủ quán mang bill ra
  playWhistleAndBowlClink() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    // Two-tone street whistle
    const whistle = ctx.createOscillator();
    const wGain = ctx.createGain();
    whistle.type = 'sine';
    whistle.frequency.setValueAtTime(1400, now);
    whistle.frequency.linearRampToValueAtTime(2350, now + 0.16);
    whistle.frequency.setValueAtTime(1850, now + 0.2);
    whistle.frequency.linearRampToValueAtTime(2600, now + 0.38);

    wGain.gain.setValueAtTime(0.24, now);
    wGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    whistle.connect(wGain);
    wGain.connect(this.out(ctx));
    whistle.start(now);
    whistle.stop(now + 0.42);

    // Ceramic bowl clink
    this.playChopstickClack();
  }

  // Tiếng đạp cần khởi động / đề xe máy đời cũ: "Khặc khặc... Bành bành bành!"
  playKickstartCough(started: boolean) {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    // Starter crank "Khặc khặc"
    [0, 0.11].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(95 + idx * 18, now + offset);
      osc.frequency.exponentialRampToValueAtTime(42, now + offset + 0.08);
      gain.gain.setValueAtTime(0.35, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.09);
      osc.connect(gain);
      gain.connect(this.out(ctx));
      osc.start(now + offset);
      osc.stop(now + offset + 0.1);
    });

    if (started) {
      // Exhaust pop "Bành bành bành!"
      [0.24, 0.36, 0.47, 0.58].forEach((offset, i) => {
        const pop = ctx.createOscillator();
        const pGain = ctx.createGain();
        pop.type = 'square';
        const base = 110 + i * 22;
        pop.frequency.setValueAtTime(base, now + offset);
        pop.frequency.exponentialRampToValueAtTime(58, now + offset + 0.09);
        pGain.gain.setValueAtTime(0.42, now + offset);
        pGain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.1);
        pop.connect(pGain);
        pGain.connect(this.out(ctx));
        pop.start(now + offset);
        pop.stop(now + offset + 0.11);
      });
    }
  }

  // Tiếng vặn ga pô nổ giòn tan ("RÈN RÈN BÀNH BÀNH!")
  playEngineRev(speedRatio = 0.5) {
    const ctx = this.initCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    const startFreq = 85 + speedRatio * 140;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.linearRampToValueAtTime(startFreq * 1.35, now + 0.14);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.008, now + 0.18);
    osc.connect(gain);
    gain.connect(this.out(ctx));
    osc.start(now);
    osc.stop(now + 0.19);
  }

  // Tiếng quên gạt chân chống (F) quệt mặt đường tóe lửa & trượt bánh xoè ("XOẸT! RẦM!")
  playKickstandScrape() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    const scrape = ctx.createBufferSource();
    scrape.buffer = this.noiseBuffer(ctx, 0.38);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2800, now);
    bp.frequency.linearRampToValueAtTime(1400, now + 0.35);
    bp.Q.value = 4.0;

    const sGain = ctx.createGain();
    sGain.gain.setValueAtTime(0.55, now);
    sGain.gain.exponentialRampToValueAtTime(0.01, now + 0.38);

    scrape.connect(bp);
    bp.connect(sGain);
    sGain.connect(this.out(ctx));
    scrape.start(now);
    scrape.stop(now + 0.39);

    setTimeout(() => this.playChairFall(), 180);
  }

  // Tiếng xe ôm công nghệ phóng tới thắng "Kítttt!" trước cửa nhà
  playGrabBrakeScreech() {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1650, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.35);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.008, now + 0.38);

    osc.connect(gain);
    gain.connect(this.out(ctx));
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // Tiếng còi tuýt CSGT + Máy đo nồng độ cồn "TÍT TÍT TÍT — BÁO ĐỘNG ĐỎ 999 mg/L!"
  playPoliceWhistleAndBreathalyzer(isAlarmBeepOnly = false) {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    if (!isAlarmBeepOnly) {
      // "Tuýt tuýt tuýt!" whistle
      [0, 0.16, 0.32].forEach((offset) => {
        const w = ctx.createOscillator();
        const wGain = ctx.createGain();
        w.type = 'sine';
        w.frequency.setValueAtTime(2750, now + offset);
        w.frequency.setValueAtTime(2950, now + offset + 0.05);
        wGain.gain.setValueAtTime(0.32, now + offset);
        wGain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.12);
        w.connect(wGain);
        wGain.connect(this.out(ctx));
        w.start(now + offset);
        w.stop(now + offset + 0.13);
      });
    }

    // High-pitched digital breathalyzer red alert "TÍT TÍT TÍT TÍT!"
    const baseDelay = isAlarmBeepOnly ? 0 : 0.48;
    [0, 0.11, 0.22, 0.33].forEach((offset, idx) => {
      const beep = ctx.createOscillator();
      const bGain = ctx.createGain();
      beep.type = 'square';
      beep.frequency.setValueAtTime(idx === 3 ? 1980 : 1580, now + baseDelay + offset);
      bGain.gain.setValueAtTime(0.26, now + baseDelay + offset);
      bGain.gain.exponentialRampToValueAtTime(
        0.008,
        now + baseDelay + offset + (idx === 3 ? 0.24 : 0.08)
      );
      beep.connect(bGain);
      bGain.connect(this.out(ctx));
      beep.start(now + baseDelay + offset);
      beep.stop(now + baseDelay + offset + (idx === 3 ? 0.25 : 0.09));
    });
  }
}

export const sound = new SoundEngine();


