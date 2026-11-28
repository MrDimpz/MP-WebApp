/**
 * Procedural Web Audio API synthesizer for tactile crossword feedback.
 * Provides crisp mechanical key clicks, navigation ticks, word completion chords,
 * hint chimes, and quest fanfares without external audio dependencies.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = true;

  constructor() {
    try {
      const saved = localStorage.getItem('colossal_crossword_muted');
      if (saved === 'false') {
        this.muted = false;
      }
    } catch {
      // Ignore storage errors
    }
  }

  private getContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem('colossal_crossword_muted', String(this.muted));
    } catch {
      // Ignore storage errors
    }
    return this.muted;
  }

  /** Crisp fountain-pen / mechanical keystroke sound */
  public playKeyPress(charIndex: number = 0): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Subtle pitch variation based on letter
    const baseFreq = 320 + (charIndex % 12) * 14;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.045);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /** Soft backspace / erase brush sound */
  public playBackspace(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.055);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  /** Subtle cell focus navigation tick */
  public playStep(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.022);

    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.025);
  }

  /** Warm harmonic triad when a word is solved */
  public playWordSolved(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.055;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.09, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.32);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.34);
    });
  }

  /** Shimmering chime when using an assistive hint */
  public playHint(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [587.33, 880.0]; // D5 -> A5

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.07;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.07, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.25);
    });
  }

  /** Rich brass-like arpeggio when completing a Quest or Puzzle */
  public playQuestComplete(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880, 1108.73]; // A major fanfare

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.075;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.11, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.48);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
  }

  /** Audio context for milestone fanfares/explosions (plays unless explicitly muted by the user) */
  private getCelebrationContext(): AudioContext | null {
    try {
      if (localStorage.getItem('colossal_crossword_muted') === 'true') return null;
    } catch {
      // Ignore storage errors
    }
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /** Dramatic explosion + mischievous comic reveal sting for the secret 25x200 trapdoor */
  public playSecretExplosion(): void {
    const ctx = this.getCelebrationContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Sub-bass boom drop
    const boomOsc = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boomOsc.type = 'sine';
    boomOsc.frequency.setValueAtTime(150, now);
    boomOsc.frequency.exponentialRampToValueAtTime(32, now + 0.65);
    boomGain.gain.setValueAtTime(0.28, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    boomOsc.connect(boomGain);
    boomGain.connect(ctx.destination);
    boomOsc.start(now);
    boomOsc.stop(now + 0.72);

    // 2. Filtered explosion crackle burst
    const bufferSize = Math.floor(ctx.sampleRate * 0.55);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.16));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.55);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.22, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);

    // 3. Mischievous comic brass sting ("da-da-da-DAAA!")
    const stingNotes: Array<[number, number, number]> = [
      [392.0, 0.28, 0.14],   // G4
      [466.16, 0.42, 0.14],  // Bb4
      [523.25, 0.56, 0.14],  // C5
      [622.25, 0.72, 0.52],  // Eb5 cheeky dramatic chord
      [311.13, 0.72, 0.52],  // Eb4
      [932.33, 0.74, 0.48],  // Bb5 sparkle
    ];

    for (const [freq, offset, dur] of stingNotes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + offset;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2400, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.085, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

      osc.connect(lp);
      lp.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.03);
    }
  }

  /** Triumphant multi-voice royal brass & bell fanfare for completing the extended Colossal Atlas */
  public playGrandFanfare(): void {
    const ctx = this.getCelebrationContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Heroic trumpet melody (C major royal fanfare)
    const melody: Array<[number, number, number, number]> = [
      [523.25, 0.0, 0.18, 0.11],    // C5
      [523.25, 0.19, 0.14, 0.10],   // C5
      [523.25, 0.34, 0.14, 0.10],   // C5
      [659.25, 0.5, 0.36, 0.12],    // E5
      [587.33, 0.88, 0.18, 0.11],   // D5
      [659.25, 1.08, 0.18, 0.11],   // E5
      [783.99, 1.28, 0.44, 0.13],   // G5
      [659.25, 1.74, 0.18, 0.11],   // E5
      [783.99, 1.94, 0.22, 0.12],   // G5
      [1046.5, 2.2, 1.15, 0.14],    // C6 triumphant hold!
    ];

    // Warm harmonic brass backing chords
    const harmony: Array<[number, number, number, number]> = [
      [261.63, 0.0, 0.46, 0.07],    // C4
      [329.63, 0.5, 0.36, 0.08],    // E4
      [293.66, 0.88, 0.36, 0.07],   // D4
      [392.0, 1.28, 0.44, 0.08],    // G4
      [261.63, 2.2, 1.15, 0.09],    // C4 final chord
      [329.63, 2.2, 1.15, 0.08],    // E4 final chord
      [392.0, 2.2, 1.15, 0.08],     // G4 final chord
      [523.25, 2.2, 1.15, 0.08],    // C5 final chord
    ];

    const playVoice = (
      freq: number,
      offset: number,
      dur: number,
      vol: number,
      type: OscillatorType
    ) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const start = now + offset;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(type === 'sawtooth' ? 2200 : 3600, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.025);
      gain.gain.setValueAtTime(vol * 0.85, start + Math.max(0.04, dur * 0.7));
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.04);
    };

    for (const [f, o, d, v] of melody) playVoice(f, o, d, v, 'sawtooth');
    for (const [f, o, d, v] of harmony) playVoice(f, o, d, v, 'triangle');

    // Shimmering bell cascade on the final chord
    const bells = [1046.5, 1318.51, 1567.98, 2093.0];
    bells.forEach((freq, idx) => {
      playVoice(freq, 2.24 + idx * 0.09, 0.85, 0.055, 'sine');
    });
  }
}

export const sound = new SoundEngine();
