import { CrosswordGame } from '@/components/crossword/crossword-game';

export default function CrosswordPage() {
  return (
    <main aria-label="Crossword solo game" className="relative min-h-[100dvh] overflow-x-hidden">
      {/* 25% Opacity Missing Piece Background Watermark */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 flex items-center justify-center z-0 overflow-hidden"
      >
        <img
          src="/assets/aistudio/3d_logo_944e5372.png"
          alt=""
          className="w-[340px] h-[340px] sm:w-[640px] sm:h-[640px] object-contain opacity-25 select-none"
        />
      </div>
      <div className="relative z-10">
        <CrosswordGame />
      </div>
    </main>
  );
}
