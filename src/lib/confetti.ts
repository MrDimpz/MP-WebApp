import confetti from 'canvas-confetti';

export const BRAND_CONFETTI_COLORS = [
  '#F6C915', // Brushed metallic gold
  '#FDE047', // Bright gold
  '#7E22CE', // Royal purple
  '#C084FC', // Soft lavender
  '#10B981', // Emerald
  '#FBF6E8', // Porcelain cream
];

export const HIGH_SCORE_CONFETTI_COLORS = [
  '#F6C915',
  '#FDE047',
  '#F59E0B',
  '#7E22CE',
  '#C084FC',
  '#10B981',
  '#FFFFFF',
];

type ConfettiTier = 'puzzle' | 'daily' | 'high-score';

let lastConfettiAt = 0;
let lastConfettiTier: ConfettiTier | null = null;
const COOLDOWN_MS = 1400;

export function isConfettiPermitted(force = false): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return false;
    }
    if (!force) {
      const cleanPath = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      if (cleanPath === '/overlay' || cleanPath.endsWith('/overlay')) {
        return false;
      }
    }
  } catch {
    return false;
  }
  return true;
}

function safeFire(options: confetti.Options) {
  try {
    void confetti({
      disableForReducedMotion: true,
      zIndex: 9999,
      ...options,
    });
  } catch {
    // Ignore canvas errors in headless/restricted environments
  }
}

/**
 * Triggers a crisp celebratory confetti burst when a user completes a puzzle.
 */
export function triggerPuzzleConfetti(opts?: {
  colors?: string[];
  force?: boolean;
}): boolean {
  if (!isConfettiPermitted(opts?.force)) return false;

  const now = Date.now();
  if (now - lastConfettiAt < COOLDOWN_MS) return false;
  lastConfettiAt = now;
  lastConfettiTier = 'puzzle';

  const colors = opts?.colors || BRAND_CONFETTI_COLORS;

  safeFire({
    particleCount: 70,
    spread: 74,
    startVelocity: 42,
    origin: { x: 0.5, y: 0.62 },
    colors,
  });

  window.setTimeout(() => {
    safeFire({
      particleCount: 28,
      angle: 60,
      spread: 52,
      startVelocity: 38,
      origin: { x: 0.14, y: 0.66 },
      colors,
    });
    safeFire({
      particleCount: 28,
      angle: 120,
      spread: 52,
      startVelocity: 38,
      origin: { x: 0.86, y: 0.66 },
      colors,
    });
  }, 150);

  return true;
}

/**
 * Triggers a twin-cannon celebration when a user completes a Daily Puzzle.
 */
export function triggerDailyPuzzleConfetti(opts?: {
  colors?: string[];
  force?: boolean;
}): boolean {
  if (!isConfettiPermitted(opts?.force)) return false;

  const now = Date.now();
  if (now - lastConfettiAt < COOLDOWN_MS && lastConfettiTier !== 'puzzle') {
    return false;
  }
  lastConfettiAt = now;
  lastConfettiTier = 'daily';

  const colors = opts?.colors || BRAND_CONFETTI_COLORS;

  safeFire({
    particleCount: 85,
    spread: 82,
    startVelocity: 46,
    origin: { x: 0.5, y: 0.58 },
    colors,
  });

  safeFire({
    particleCount: 40,
    angle: 60,
    spread: 58,
    startVelocity: 45,
    origin: { x: 0.12, y: 0.68 },
    colors,
  });
  safeFire({
    particleCount: 40,
    angle: 120,
    spread: 58,
    startVelocity: 45,
    origin: { x: 0.88, y: 0.68 },
    colors,
  });

  window.setTimeout(() => {
    safeFire({
      particleCount: 55,
      spread: 96,
      startVelocity: 36,
      origin: { x: 0.5, y: 0.45 },
      colors,
    });
  }, 220);

  return true;
}

/**
 * Triggers a multi-wave star & golden fanfare when a user achieves a New High Score.
 */
export function triggerNewHighScoreConfetti(opts?: {
  colors?: string[];
  force?: boolean;
}): boolean {
  if (!isConfettiPermitted(opts?.force)) return false;

  const now = Date.now();
  const colors = opts?.colors || HIGH_SCORE_CONFETTI_COLORS;

  if (now - lastConfettiAt < COOLDOWN_MS) {
    if (lastConfettiTier === 'high-score') {
      return false;
    }
    lastConfettiAt = now;
    lastConfettiTier = 'high-score';
    window.setTimeout(() => {
      safeFire({
        particleCount: 48,
        spread: 110,
        startVelocity: 38,
        scalar: 1.25,
        shapes: ['star', 'circle'],
        origin: { x: 0.5, y: 0.4 },
        colors,
      });
    }, 260);
    return true;
  }

  lastConfettiAt = now;
  lastConfettiTier = 'high-score';

  // Wave 1: Vigorous twin side cannons
  safeFire({
    particleCount: 55,
    angle: 60,
    spread: 64,
    startVelocity: 52,
    scalar: 1.15,
    shapes: ['star', 'circle'],
    origin: { x: 0.1, y: 0.7 },
    colors,
  });
  safeFire({
    particleCount: 55,
    angle: 120,
    spread: 64,
    startVelocity: 52,
    scalar: 1.15,
    shapes: ['star', 'circle'],
    origin: { x: 0.9, y: 0.7 },
    colors,
  });

  // Wave 2: Center gold star fountain
  window.setTimeout(() => {
    safeFire({
      particleCount: 70,
      spread: 100,
      startVelocity: 44,
      scalar: 1.22,
      shapes: ['star', 'circle'],
      origin: { x: 0.5, y: 0.48 },
      colors,
    });
  }, 180);

  // Wave 3: Top star shower finale
  window.setTimeout(() => {
    safeFire({
      particleCount: 36,
      spread: 120,
      startVelocity: 26,
      gravity: 0.8,
      scalar: 1.15,
      shapes: ['star'],
      origin: { x: 0.5, y: 0.25 },
      colors: ['#F6C915', '#FDE047', '#F59E0B', '#FFFFFF'],
    });
  }, 420);

  return true;
}

/**
 * Unified victory trigger: selects the strongest celebration appropriate
 * for completing a puzzle, daily puzzle, and/or achieving a new high score.
 */
export function triggerVictoryConfetti(params?: {
  isDaily?: boolean;
  isNewHighScore?: boolean;
  colors?: string[];
  force?: boolean;
}): boolean {
  if (params?.isNewHighScore) {
    return triggerNewHighScoreConfetti({
      colors: params.colors,
      force: params.force,
    });
  }
  if (params?.isDaily) {
    return triggerDailyPuzzleConfetti({
      colors: params.colors,
      force: params.force,
    });
  }
  return triggerPuzzleConfetti({
    colors: params?.colors,
    force: params?.force,
  });
}
