class SoundFxEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private tone(
    freq: number,
    endFreq: number,
    durationMs: number,
    gainPeak: number,
    type: OscillatorType = 'triangle',
    delayMs: number = 0
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const start = ctx.currentTime + delayMs / 1000;
    const stop = start + durationMs / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), stop);
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(gainPeak, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, stop);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(stop + 0.01);
  }

  playSelect() {
    this.tone(540, 480, 26, 0.035, 'sine');
  }

  playPlace() {
    this.tone(330, 520, 55, 0.075, 'triangle');
  }

  playRemove() {
    this.tone(310, 190, 50, 0.06, 'sine');
  }

  playHint() {
    this.tone(587.33, 587.33, 120, 0.07, 'sine', 0);
    this.tone(880, 880, 160, 0.06, 'sine', 55);
  }

  playError() {
    this.tone(175, 130, 120, 0.08, 'sawtooth');
  }

  playWordValid() {
    this.tone(523.25, 523.25, 110, 0.06, 'triangle', 0);
    this.tone(659.25, 659.25, 130, 0.06, 'triangle', 60);
  }

  playVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.tone(n, n, 240, 0.08, 'triangle', idx * 75);
    });
  }
}

export const soundFx = new SoundFxEngine();
