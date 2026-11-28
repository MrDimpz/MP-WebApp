import React, { useEffect, useRef } from 'react';

interface VictoryCelebrationProps {
  active: boolean;
}

interface ConfettiPiece {
  kind: 'confetti';
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  tiltAngle: number;
  tiltSpeed: number;
  gravity: number;
  drag: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface FireworkSpark {
  kind: 'spark';
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  gravity: number;
  drag: number;
  alpha: number;
  life: number;
  maxLife: number;
}

type Particle = ConfettiPiece | FireworkSpark;

const CELEBRATION_COLORS = [
  '#F6C915', // Royal Gold
  '#D4A437', // Antique Gold
  '#10B981', // Emerald
  '#9333EA', // Royal Amethyst
  '#E11D48', // Crimson
  '#38BDF8', // Sky Star
  '#FAF7F0', // Warm Ivory
];

export const VictoryCelebration: React.FC<VictoryCelebrationProps> = ({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = [];

    const spawnConfettiVolley = (originX: number, originY: number, dirX: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const spread = (Math.random() - 0.5) * 0.95;
        const angle = -Math.PI / 2 + dirX * 0.42 + spread;
        const speed = 7 + Math.random() * 10.5;
        const isSquareChip = Math.random() < 0.3;
        particles.push({
          kind: 'confetti',
          x: originX + (Math.random() - 0.5) * 24,
          y: originY + (Math.random() - 0.5) * 16,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (2 + Math.random() * 2.5),
          width: isSquareChip ? 7 + Math.random() * 3 : 5 + Math.random() * 4,
          height: isSquareChip ? 7 + Math.random() * 3 : 10 + Math.random() * 6,
          color: CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.22,
          tiltAngle: Math.random() * Math.PI * 2,
          tiltSpeed: 0.08 + Math.random() * 0.14,
          gravity: 0.22 + Math.random() * 0.08,
          drag: 0.985,
          alpha: 1,
          life: 0,
          maxLife: 135 + Math.floor(Math.random() * 65),
        });
      }
    };

    const spawnFireworkBurst = (cx: number, cy: number, accentColor?: string) => {
      const sparkCount = 34;
      const primary =
        accentColor ?? CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)];
      const secondary = '#F6C915';

      for (let i = 0; i < sparkCount; i++) {
        const theta = (i / sparkCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.14;
        const ringLayer = i % 3 === 0 ? 0.62 : 1;
        const speed = (3.4 + Math.random() * 4.2) * ringLayer;
        particles.push({
          kind: 'spark',
          x: cx,
          y: cy,
          prevX: cx,
          prevY: cy,
          vx: Math.cos(theta) * speed,
          vy: Math.sin(theta) * speed,
          radius: 1.8 + Math.random() * 1.6,
          color: i % 4 === 0 ? secondary : primary,
          gravity: 0.095,
          drag: 0.955,
          alpha: 1,
          life: 0,
          maxLife: 48 + Math.floor(Math.random() * 24),
        });
      }
    };

    const launchY = Math.min(height * 0.78, height - 80);
    spawnConfettiVolley(width * 0.16, launchY, 1, 52);
    spawnConfettiVolley(width * 0.84, launchY, -1, 52);

    const burstTimers: number[] = [];
    const scheduleBurst = (delayMs: number, rx: number, ry: number, color: string) => {
      const id = window.setTimeout(() => {
        spawnFireworkBurst(width * rx, height * ry, color);
      }, delayMs);
      burstTimers.push(id);
    };

    scheduleBurst(240, 0.32, 0.26, '#F6C915');
    scheduleBurst(600, 0.68, 0.22, '#10B981');
    scheduleBurst(980, 0.5, 0.3, '#9333EA');

    let rafId = 0;
    let lastTime = performance.now();
    let burstsFinished = false;
    const finishFlagTimer = window.setTimeout(() => {
      burstsFinished = true;
    }, 1100);
    burstTimers.push(finishFlagTimer);

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 16.667, 2.2);
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;

        if (p.life >= p.maxLife || p.y > height + 40) {
          particles.splice(i, 1);
          continue;
        }

        const dragFactor = Math.pow(p.drag, dt);

        if (p.kind === 'confetti') {
          p.vx *= dragFactor;
          p.vy = p.vy * dragFactor + p.gravity * dt;
          p.x += p.vx * dt + Math.sin(p.tiltAngle) * 0.65 * dt;
          p.y += p.vy * dt;
          p.rotation += p.rotationSpeed * dt;
          p.tiltAngle += p.tiltSpeed * dt;

          const fadeStart = p.maxLife * 0.72;
          p.alpha =
            p.life > fadeStart
              ? Math.max(0, 1 - (p.life - fadeStart) / (p.maxLife - fadeStart))
              : 1;

          const scaleY = Math.cos(p.tiltAngle);
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.scale(1, Math.abs(scaleY) < 0.18 ? 0.18 : scaleY);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
          ctx.restore();
        } else {
          p.prevX = p.x;
          p.prevY = p.y;
          p.vx *= dragFactor;
          p.vy = p.vy * dragFactor + p.gravity * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;

          const progress = p.life / p.maxLife;
          p.alpha = Math.max(0, 1 - progress * progress);

          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.radius;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.prevX, p.prevY);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();

          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 0.75, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      if (particles.length > 0 || !burstsFinished) {
        rafId = window.requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    rafId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(rafId);
      burstTimers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('resize', resize);
      ctx.clearRect(0, 0, width, height);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-40"
      aria-hidden="true"
    />
  );
};
