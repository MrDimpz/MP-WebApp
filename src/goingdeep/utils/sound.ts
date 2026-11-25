class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.08,
    delay = 0
  ) {
    const ctx = this.getContext();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  public tap() {
    this.playTone(440, 0.055, 'triangle', 0.045);
  }

  public deselect() {
    this.playTone(330, 0.05, 'triangle', 0.035);
  }

  public error() {
    this.playTone(185, 0.14, 'sawtooth', 0.045, 0);
    this.playTone(155, 0.18, 'sawtooth', 0.045, 0.09);
  }

  public unlock() {
    this.playTone(523.25, 0.12, 'triangle', 0.065, 0);
    this.playTone(659.25, 0.14, 'triangle', 0.065, 0.075);
    this.playTone(783.99, 0.22, 'sine', 0.07, 0.15);
  }

  public groupSolved() {
    this.playTone(440, 0.14, 'sine', 0.06, 0);
    this.playTone(554.37, 0.14, 'sine', 0.06, 0.07);
    this.playTone(659.25, 0.24, 'sine', 0.075, 0.14);
  }

  public victory() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.28, 'sine', 0.065, idx * 0.09);
    });
  }
}

export const sound = new SoundEngine();
