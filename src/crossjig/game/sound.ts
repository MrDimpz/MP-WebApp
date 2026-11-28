let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType,
  gainPeak: number,
  delay = 0,
  freqEnd?: number
) {
  const ctx = getContext();
  if (!ctx) return;

  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(freqEnd, start + duration);
  }

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(gainPeak, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export const soundFX = {
  pickup(enabled: boolean) {
    if (!enabled) return;
    playTone(210, 0.05, 'sine', 0.06, 0, 290);
  },
  swap(enabled: boolean) {
    if (!enabled) return;
    playTone(340, 0.055, 'triangle', 0.075, 0, 230);
    playTone(170, 0.04, 'sine', 0.05, 0.012);
  },
  wordLinked(enabled: boolean) {
    if (!enabled) return;
    playTone(523.25, 0.11, 'sine', 0.055, 0.02);
    playTone(659.25, 0.14, 'sine', 0.055, 0.09);
  },
  hint(enabled: boolean) {
    if (!enabled) return;
    playTone(392.0, 0.1, 'triangle', 0.06, 0);
    playTone(587.33, 0.16, 'triangle', 0.06, 0.08);
  },
  bump(enabled: boolean) {
    if (!enabled) return;
    playTone(140, 0.065, 'sine', 0.05, 0, 100);
  },
  solved(enabled: boolean) {
    if (!enabled) return;
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
    notes.forEach((n, idx) => {
      playTone(n, 0.24, 'triangle', 0.07, idx * 0.075);
    });
  },
};
