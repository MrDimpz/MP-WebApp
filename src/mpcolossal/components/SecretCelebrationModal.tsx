import React, { useEffect, useRef, useState } from 'react';
import { Award, Compass, Sparkles, Trophy, Volume2 } from 'lucide-react';
import secretCartoonImg from '@/assets/images/colossal_secret_cartoon_1795884805225.jpg';
import finaleCartoonImg from '@/assets/images/colossal_finale_cartoon_1795884806708.jpg';

export type SecretModalVariant = 'reveal' | 'finale';

interface SecretCelebrationModalProps {
  variant: SecretModalVariant | null;
  secretWordCount: number;
  totalWordsSolved: number;
  elapsedSeconds: number;
  atlasScore: number;
  onPrimaryAction: () => void;
  onReplayFanfare?: () => void;
  onOpenLeaderboard?: () => void;
  onReturnToTitle?: () => void;
}

interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  vRot: number;
  color: string;
  shape: 'star' | 'ribbon' | 'circle' | 'spark';
  alpha: number;
  decay: number;
  gravity: number;
}

interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
}

const EXPLOSION_COLORS = [
  '#F6C915',
  '#FF4D6D',
  '#10B981',
  '#A855F7',
  '#38BDF8',
  '#FB923C',
  '#FEF08A',
];

function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outerR: number,
  innerR: number,
  points: number
) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

export const SecretCelebrationModal: React.FC<SecretCelebrationModalProps> = ({
  variant,
  secretWordCount,
  totalWordsSolved,
  elapsedSeconds,
  atlasScore,
  onPrimaryAction,
  onReplayFanfare,
  onOpenLeaderboard,
  onReturnToTitle,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [variant]);

  // Multi-wave high-energy firework & comic starburst explosion canvas
  useEffect(() => {
    if (!variant) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const particles: BurstParticle[] = [];
    const rings: ShockwaveRing[] = [];
    const timers: number[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const spawnExplosion = (cx: number, cy: number, count: number, power = 1) => {
      rings.push({
        x: cx,
        y: cy,
        radius: 12,
        maxRadius: Math.min(canvas.width, canvas.height) * 0.42 * power,
        color: EXPLOSION_COLORS[Math.floor(Math.random() * EXPLOSION_COLORS.length)],
        alpha: 0.95,
      });

      const shapes: BurstParticle['shape'][] = ['star', 'ribbon', 'circle', 'spark'];
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
        const speed = (3.5 + Math.random() * 11.5) * power;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2.2 * power,
          size: 5 + Math.random() * 9,
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.28,
          color: EXPLOSION_COLORS[Math.floor(Math.random() * EXPLOSION_COLORS.length)],
          shape: shapes[i % shapes.length],
          alpha: 1,
          decay: 0.008 + Math.random() * 0.009,
          gravity: 0.14 + Math.random() * 0.08,
        });
      }
    };

    // Initial centerpiece mega-blast
    spawnExplosion(canvas.width * 0.5, canvas.height * 0.46, 110, 1.25);

    // Choreographed multi-wave bursts
    const waveSchedule: Array<[number, number, number, number, number]> = [
      [260, 0.22, 0.34, 65, 1.0],
      [480, 0.78, 0.32, 65, 1.0],
      [820, 0.32, 0.68, 60, 0.95],
      [1120, 0.68, 0.65, 60, 0.95],
      [1520, 0.5, 0.24, 90, 1.15],
    ];
    if (variant === 'finale') {
      waveSchedule.push(
        [2050, 0.18, 0.52, 70, 1.05],
        [2400, 0.82, 0.52, 70, 1.05],
        [2850, 0.5, 0.42, 110, 1.25]
      );
    }

    for (const [delay, rx, ry, cnt, pwr] of waveSchedule) {
      timers.push(
        window.setTimeout(() => {
          spawnExplosion(canvas.width * rx, canvas.height * ry, cnt, pwr);
        }, delay)
      );
    }

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Expanding shockwave rings
      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        ring.radius += (ring.maxRadius - ring.radius) * 0.12 + 4;
        ring.alpha *= 0.92;
        if (ring.alpha < 0.02 || ring.radius >= ring.maxRadius) {
          rings.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = ring.alpha;
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.982;
        p.vy = p.vy * 0.985 + p.gravity;
        p.rotation += p.vRot;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;

        if (p.shape === 'star') {
          drawStar(ctx, 0, 0, p.size, p.size * 0.44, 5);
        } else if (p.shape === 'ribbon') {
          ctx.fillRect(-p.size * 0.7, -p.size * 0.28, p.size * 1.4, p.size * 0.56);
        } else if (p.shape === 'spark') {
          drawStar(ctx, 0, 0, p.size * 1.15, p.size * 0.25, 4);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      animId = window.requestAnimationFrame(tick);
    };

    animId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [variant]);

  if (!variant) return null;

  const isReveal = variant === 'reveal';
  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const rem = secs % 60;
    if (hrs > 0) {
      return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(rem).padStart(2, '0')}s`;
    }
    return `${String(mins).padStart(2, '0')}m ${String(rem).padStart(2, '0')}s`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isReveal ? 'Hidden Extension Unlocked' : 'Colossal Atlas Completed'}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#12031D]/85 backdrop-blur-sm overflow-y-auto"
    >
      {/* Full-screen Visual Explosion Canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
      />

      {/* Comic Pop-Up Card */}
      <div className="relative z-10 w-full max-w-lg animate-in zoom-in-75 fade-in duration-300">
        {/* Comic starburst accent frame behind card */}
        <div
          className={`relative rounded-3xl border-4 border-[#1D0830] shadow-[10px_10px_0px_#1D0830] overflow-hidden ${
            isReveal
              ? 'bg-gradient-to-b from-[#FFF8D6] via-[#FFFDF2] to-[#FCE7F3] text-[#1D0830]'
              : 'bg-gradient-to-b from-[#FEF9C3] via-[#FFFDF5] to-[#ECFDF5] text-[#1D0830]'
          }`}
        >
          {/* Top Comic Action Banner */}
          <div
            className={`px-5 py-3 border-b-4 border-[#1D0830] flex items-center justify-between gap-2 ${
              isReveal ? 'bg-[#F6C915] text-[#1D0830]' : 'bg-[#2B0938] text-[#F6C915]'
            }`}
          >
            <div className="flex items-center gap-2 font-black tracking-tight text-sm">
              {isReveal ? (
                <>
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>PLOT TWIST!</span>
                </>
              ) : (
                <>
                  <Trophy className="w-4 h-4 shrink-0" />
                  <span>GRAND CHAMPION</span>
                </>
              )}
            </div>
            <span className="font-mono-tabular text-xs font-extrabold">
              {isReveal ? '+25 × 200 VAULT' : `${totalWordsSolved.toLocaleString()} WORDS`}
            </span>
          </div>

          <div className="p-6 sm:p-7 flex flex-col items-center text-center space-y-5">
            {/* Cartoon Illustration */}
            <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-2xl border-4 border-[#1D0830] shadow-[6px_6px_0px_#1D0830] overflow-hidden bg-[#2B0938] shrink-0">
              {!imgFailed ? (
                <img
                  src={isReveal ? secretCartoonImg : finaleCartoonImg}
                  alt={
                    isReveal
                      ? 'Mischievous puzzle master opening a hidden trapdoor under a crossword grid'
                      : 'Golden crossword champion trophy surrounded by fanfare trumpets and fireworks'
                  }
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#3b0d47] to-[#1D0830] text-[#F6C915] p-4">
                  {isReveal ? <Compass className="w-12 h-12" /> : <Award className="w-12 h-12" />}
                </div>
              )}
            </div>

            {isReveal ? (
              <>
                {/* Comic Speech Bubble */}
                <div className="relative bg-white border-4 border-[#1D0830] rounded-2xl px-5 py-4 shadow-[5px_5px_0px_#1D0830]">
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight text-[#1D0830] [text-wrap:balance]">
                    “You really thought I&apos;d make it that easy!”
                  </h2>
                </div>

                <p className="text-sm sm:text-base font-semibold text-[#3b0d47] leading-relaxed max-w-md">
                  A hidden <strong className="font-extrabold">25 × 200</strong> underground vault
                  with <strong className="font-extrabold">{secretWordCount.toLocaleString()} brand-new clues</strong>{' '}
                  just cracked open beneath the bottom of the Colossal Atlas.
                </p>

                <button
                  type="button"
                  onClick={onPrimaryAction}
                  className="w-full sm:w-auto px-7 py-3.5 text-base font-black text-[#1D0830] bg-[#F6C915] hover:bg-[#FFE047] active:translate-y-0.5 border-4 border-[#1D0830] rounded-2xl shadow-[5px_5px_0px_#1D0830] transition-transform cursor-pointer whitespace-nowrap"
                >
                  Bring It On!
                </button>
              </>
            ) : (
              <>
                <div className="space-y-2.5">
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight text-[#1D0830] [text-wrap:balance]">
                    Congratulations! You Conquered the Entire Colossal Atlas!
                  </h2>
                  <p className="text-sm font-semibold text-[#3b0d47] leading-relaxed max-w-md mx-auto">
                    Every single clue across the 200×200 broadsheet and the hidden 25×200 vault has
                    been solved.
                  </p>
                </div>

                {/* Prominent Closing Question */}
                <div className="w-full bg-[#2B0938] text-[#F6C915] border-4 border-[#1D0830] rounded-2xl px-5 py-4 shadow-[5px_5px_0px_#1D0830]">
                  <p className="text-xl sm:text-2xl font-black tracking-tight">
                    What are you going to do now?
                  </p>
                </div>

                {/* Clean Tabular Summary */}
                <div className="w-full grid grid-cols-3 gap-2.5 text-center font-mono-tabular">
                  <div className="p-2.5 bg-white border-2 border-[#1D0830] rounded-xl">
                    <div className="text-[11px] font-bold text-[#581c6b]">Words</div>
                    <div className="text-base font-black text-[#1D0830]">
                      {totalWordsSolved.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-2.5 bg-white border-2 border-[#1D0830] rounded-xl">
                    <div className="text-[11px] font-bold text-[#581c6b]">Time</div>
                    <div className="text-base font-black text-[#1D0830]">
                      {formatTime(elapsedSeconds)}
                    </div>
                  </div>
                  <div className="p-2.5 bg-white border-2 border-[#1D0830] rounded-xl">
                    <div className="text-[11px] font-bold text-[#581c6b]">Score</div>
                    <div className="text-base font-black text-[#1D0830]">
                      {atlasScore.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="w-full flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={onPrimaryAction}
                    className="px-5 py-2.5 text-sm font-black text-[#1D0830] bg-[#F6C915] hover:bg-[#FFE047] border-3 border-[#1D0830] rounded-xl shadow-[4px_4px_0px_#1D0830] transition-transform active:translate-y-0.5 cursor-pointer whitespace-nowrap"
                  >
                    Inspect Completed Board
                  </button>
                  {onReplayFanfare && (
                    <button
                      type="button"
                      onClick={onReplayFanfare}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-extrabold text-[#1D0830] bg-white hover:bg-amber-50 border-3 border-[#1D0830] rounded-xl shadow-[4px_4px_0px_#1D0830] transition-transform active:translate-y-0.5 cursor-pointer whitespace-nowrap"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>Fanfare</span>
                    </button>
                  )}
                  {onOpenLeaderboard && (
                    <button
                      type="button"
                      onClick={onOpenLeaderboard}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-extrabold text-[#1D0830] bg-emerald-200 hover:bg-emerald-300 border-3 border-[#1D0830] rounded-xl shadow-[4px_4px_0px_#1D0830] transition-transform active:translate-y-0.5 cursor-pointer whitespace-nowrap"
                    >
                      <Trophy className="w-4 h-4" />
                      <span>Leaderboard</span>
                    </button>
                  )}
                  {onReturnToTitle && (
                    <button
                      type="button"
                      onClick={onReturnToTitle}
                      className="px-4 py-2.5 text-sm font-bold text-[#3b0d47] hover:underline cursor-pointer whitespace-nowrap"
                    >
                      Title Screen
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
