export type GameSoundType =
  | 'tick'
  | 'correct'
  | 'close'
  | 'round_start'
  | 'turn_end'
  | 'victory'
  | 'join';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) {
      audioCtx = new Ctor();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  type: OscillatorType = 'sine',
  gainPeak = 0.1
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + startOffset);
  gain.gain.exponentialRampToValueAtTime(gainPeak, ctx.currentTime + startOffset + 0.015);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    ctx.currentTime + startOffset + duration
  );
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + startOffset);
  osc.stop(ctx.currentTime + startOffset + duration + 0.02);
}

export function playGameSound(sound: GameSoundType, muted: boolean): void {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  switch (sound) {
    case 'tick':
      playTone(ctx, 760, 0, 0.06, 'triangle', 0.05);
      break;
    case 'correct':
      playTone(ctx, 523.25, 0, 0.11, 'sine', 0.12);
      playTone(ctx, 659.25, 0.08, 0.12, 'sine', 0.12);
      playTone(ctx, 783.99, 0.16, 0.22, 'sine', 0.13);
      break;
    case 'close':
      playTone(ctx, 440, 0, 0.09, 'triangle', 0.08);
      playTone(ctx, 493.88, 0.08, 0.11, 'triangle', 0.08);
      break;
    case 'round_start':
      playTone(ctx, 392, 0, 0.1, 'sine', 0.09);
      playTone(ctx, 523.25, 0.09, 0.16, 'sine', 0.1);
      break;
    case 'turn_end':
      playTone(ctx, 587.33, 0, 0.12, 'triangle', 0.09);
      playTone(ctx, 440, 0.11, 0.18, 'triangle', 0.08);
      break;
    case 'victory':
      playTone(ctx, 523.25, 0, 0.12, 'sine', 0.12);
      playTone(ctx, 659.25, 0.11, 0.12, 'sine', 0.12);
      playTone(ctx, 783.99, 0.22, 0.12, 'sine', 0.12);
      playTone(ctx, 1046.5, 0.34, 0.35, 'sine', 0.14);
      break;
    case 'join':
      playTone(ctx, 587.33, 0, 0.08, 'sine', 0.07);
      break;
  }
}
