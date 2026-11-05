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
    gain1.connect(ctx.destination);
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
    gain2.connect(ctx.destination);
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
    gain3.connect(ctx.destination);
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
    gain.connect(ctx.destination);

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
    gain.connect(ctx.destination);

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
    gain.connect(ctx.destination);

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
      gain.connect(ctx.destination);
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
    gain.connect(ctx.destination);

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
    gain.connect(ctx.destination);

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
      gain.connect(ctx.destination);
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
    gain.connect(ctx.destination);
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
    gain.connect(ctx.destination);
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
      gain.connect(ctx.destination);
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
      gain.connect(ctx.destination);
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
    gain.connect(ctx.destination);
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
    gain.connect(ctx.destination);
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
      gain.connect(ctx.destination);
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
    gain.connect(ctx.destination);
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
      gain.connect(ctx.destination);
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
      gain.connect(ctx.destination);
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
    gain.connect(ctx.destination);
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
      gain.connect(ctx.destination);
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
      gain.connect(ctx.destination);
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
    gain.connect(ctx.destination);
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
    gain.connect(ctx.destination);
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
      this.bgmGain.connect(ctx.destination);

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
}

export const sound = new SoundEngine();

