/**
 * Self-contained procedural Web Audio synthesizer for WORDLOCK.
 * Zero external audio assets — all mechanical clicks, relays, and deadbolt
 * slides are synthesized in real time via Web Audio API oscillators and noise.
 */

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (!this.muted) {
      this.ensureContext();
    }
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // Ignore autoplay restriction until user gesture
      });
    }
    if (!this.noiseBuffer && this.ctx) {
      const length = Math.floor(this.ctx.sampleRate * 0.25);
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }
    return this.ctx;
  }

  /**
   * Tumbler Click: Crisp metallic ratchet transient
   * Bandpass-filtered white noise burst + pitched sine ping 1800Hz -> 600Hz over 35ms.
   */
  public playTumblerClick(pitchJitter = 0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;

    // 1. Bandpass metallic noise transient
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(3200 + pitchJitter * 180, now);
    bandpass.Q.setValueAtTime(3.2, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(0.24, now + 0.003);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);

    noise.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.032);

    // 2. Pitched steel detent ping (1800Hz -> 600Hz over 35ms)
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800 + pitchJitter * 90, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.035);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.18, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.042);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.046);

    // 3. Subtle low housing body knock
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(210, now + 0.004);
    body.frequency.exponentialRampToValueAtTime(85, now + 0.04);

    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.12, now + 0.004);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    body.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    body.start(now + 0.004);
    body.stop(now + 0.05);
  }

  /**
   * Subtle Mechanical Drag Detent Tick: Light brushed-steel pawl click
   * played while sliding a conveyor belt across slat boundaries.
   */
  public playDragTick(pitchJitter = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1450 + pitchJitter * 120, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.018);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.085, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.025);
  }

  /**
   * Row Validated (Amber Lock-In): Warm analog relay clunk + subtle harmonic chime (440Hz + 659Hz)
   */
  public playRowValid(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + 0.035;

    // Analog relay clunk
    const clunk = ctx.createOscillator();
    clunk.type = 'triangle';
    clunk.frequency.setValueAtTime(155, now);
    clunk.frequency.exponentialRampToValueAtTime(62, now + 0.055);

    const clunkGain = ctx.createGain();
    clunkGain.gain.setValueAtTime(0.18, now);
    clunkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    clunk.connect(clunkGain);
    clunkGain.connect(ctx.destination);
    clunk.start(now);
    clunk.stop(now + 0.07);

    // Harmonic chime (440Hz + 659Hz)
    const freqs = [440, 659.25];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + 0.015);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now + 0.015);
      gain.gain.linearRampToValueAtTime(idx === 0 ? 0.1 : 0.075, now + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 0.015);
      osc.stop(now + 0.4);
    });
  }

  /**
   * Master Key Pin Green: Precision mechanical tick-ping (1046Hz)
   */
  public playPinGreen(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + 0.05;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, now);

    const overtone = ctx.createOscillator();
    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(2093, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    const overGain = ctx.createGain();
    overGain.gain.setValueAtTime(0.035, now);
    overGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    overtone.connect(overGain);
    gain.connect(ctx.destination);
    overGain.connect(ctx.destination);

    osc.start(now);
    overtone.start(now);
    osc.stop(now + 0.26);
    overtone.stop(now + 0.14);
  }

  /**
   * Brass Release Lever Pull: Heavy mechanical linkage throw
   */
  public playLeverPull(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;

    // Ratchet slide
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.linearRampToValueAtTime(420, now + 0.18);
    filter.Q.setValueAtTime(2.0, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(0.16, now + 0.03);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.22);

    // Bottom stop brass clunk
    const stopOsc = ctx.createOscillator();
    stopOsc.type = 'triangle';
    stopOsc.frequency.setValueAtTime(140, now + 0.17);
    stopOsc.frequency.exponentialRampToValueAtTime(52, now + 0.27);

    const stopGain = ctx.createGain();
    stopGain.gain.setValueAtTime(0.24, now + 0.17);
    stopGain.gain.exponentialRampToValueAtTime(0.001, now + 0.29);

    stopOsc.connect(stopGain);
    stopGain.connect(ctx.destination);
    stopOsc.start(now + 0.17);
    stopOsc.stop(now + 0.31);
  }

  /**
   * Vault Unlocked: Heavy motorized deadbolt slide (low-pass sawtooth rumble)
   * followed by a triumphant metallic chord swell.
   */
  public playVaultUnlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Motorized deadbolt slide (low-pass sawtooth rumble)
    const motor = ctx.createOscillator();
    motor.type = 'sawtooth';
    motor.frequency.setValueAtTime(68, now);
    motor.frequency.linearRampToValueAtTime(92, now + 0.32);
    motor.frequency.exponentialRampToValueAtTime(48, now + 0.65);

    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(240, now);
    lpf.frequency.linearRampToValueAtTime(420, now + 0.25);
    lpf.frequency.exponentialRampToValueAtTime(120, now + 0.68);

    const motorGain = ctx.createGain();
    motorGain.gain.setValueAtTime(0.001, now);
    motorGain.gain.linearRampToValueAtTime(0.22, now + 0.06);
    motorGain.gain.setValueAtTime(0.2, now + 0.42);
    motorGain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);

    motor.connect(lpf);
    lpf.connect(motorGain);
    motorGain.connect(ctx.destination);
    motor.start(now);
    motor.stop(now + 0.75);

    // Heavy bolt-retracted thud at t+0.55s
    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(115, now + 0.54);
    thud.frequency.exponentialRampToValueAtTime(38, now + 0.74);

    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0.32, now + 0.54);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.78);

    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.start(now + 0.54);
    thud.stop(now + 0.8);

    // 2. Triumphant metallic chord swell (C4, G4, B4, D5, E5)
    const chord = [261.63, 392.0, 493.88, 587.33, 659.25];
    const chordStart = now + 0.48;
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, chordStart + i * 0.045);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, chordStart + i * 0.045);
      gain.gain.linearRampToValueAtTime(0.085, chordStart + i * 0.045 + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, chordStart + 1.85);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(chordStart + i * 0.045);
      osc.stop(chordStart + 1.9);
    });
  }

  /**
   * Out of Clicks (Lockout): Heavy dull steel thud (90Hz damped sine)
   */
  public playLockout(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + 0.04;

    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(90, now);
    thud.frequency.exponentialRampToValueAtTime(42, now + 0.34);

    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0.36, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.start(now);
    thud.stop(now + 0.4);

    // Secondary muffled latch lock
    const latch = ctx.createOscillator();
    latch.type = 'triangle';
    latch.frequency.setValueAtTime(165, now + 0.09);
    latch.frequency.exponentialRampToValueAtTime(75, now + 0.22);

    const latchGain = ctx.createGain();
    latchGain.gain.setValueAtTime(0.14, now + 0.09);
    latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    latch.connect(latchGain);
    latchGain.connect(ctx.destination);
    latch.start(now + 0.09);
    latch.stop(now + 0.26);
  }
}

export const soundEngine = new SoundEngine();
