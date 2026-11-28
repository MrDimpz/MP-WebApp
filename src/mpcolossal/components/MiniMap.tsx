import React, { useEffect, useRef, useState } from 'react';
import { CrosswordPuzzle, PlacedWord, SCALE_CONFIG } from '../utils/crosswordGenerator';
import { Compass, Maximize2, Minimize2, X } from 'lucide-react';

interface MiniMapProps {
  puzzle: CrosswordPuzzle;
  userGrid: Record<string, string>;
  activeWord: PlacedWord | null;
  viewportRect: {
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
  };
  onCenterCell: (row: number, col: number) => void;
  onClose?: () => void;
}

export const MiniMap: React.FC<MiniMapProps> = ({
  puzzle,
  userGrid,
  activeWord,
  viewportRect,
  onCenterCell,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const boardCols = puzzle.cols || puzzle.size;
  const boardRows = puzzle.rows || puzzle.size;
  const canvasWidth = expanded ? 300 : 210;
  const canvasHeight = Math.round(canvasWidth * (boardRows / boardCols));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { cells } = puzzle;
    const scaleX = canvasWidth / boardCols;
    const scaleY = canvasHeight / boardRows;

    // Royal Obsidian background
    ctx.fillStyle = '#11031A';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw sector grid hairlines
    const sectorsPerSide = SCALE_CONFIG[puzzle.scale].sectorsPerSide;
    const sectorSpan = boardCols / sectorsPerSide;
    ctx.strokeStyle = 'rgba(212, 164, 55, 0.25)';
    ctx.lineWidth = 1;
    for (let i = 1; i < sectorsPerSide; i++) {
      const posX = Math.floor(i * sectorSpan * scaleX) + 0.5;
      ctx.beginPath();
      ctx.moveTo(posX, 0);
      ctx.lineTo(posX, canvasHeight);
      ctx.stroke();

      const posY = Math.floor(i * sectorSpan * scaleY) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, posY);
      ctx.lineTo(canvasWidth, posY);
      ctx.stroke();
    }

    // Highlight secret vault seam line when extended
    if (puzzle.secretStartRow !== undefined) {
      const seamY = Math.floor(puzzle.secretStartRow * scaleY) + 0.5;
      ctx.strokeStyle = '#F6C915';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, seamY);
      ctx.lineTo(canvasWidth, seamY);
      ctx.stroke();
    }

    // Render every crossword cell
    const cellW = Math.max(1, scaleX);
    const cellH = Math.max(1, scaleY);
    for (let r = 0; r < boardRows; r++) {
      const rowCells = cells[r];
      if (!rowCells) continue;
      for (let c = 0; c < boardCols; c++) {
        const cell = rowCells[c];
        if (!cell || !cell.solution) continue;

        const key = `${r},${c}`;
        const val = userGrid[key];

        if (val === cell.solution) {
          ctx.fillStyle = '#10B981'; // Emerald solved
        } else if (val) {
          ctx.fillStyle = '#C084FC'; // Violet entered
        } else if (cell.isQuestCell) {
          ctx.fillStyle = '#D97706'; // Quest highlight
        } else if (puzzle.secretStartRow !== undefined && r >= puzzle.secretStartRow) {
          ctx.fillStyle = '#A855F7'; // Secret vault unsolved square
        } else {
          ctx.fillStyle = '#6B4C80'; // Unsolved playable square
        }

        ctx.fillRect(c * scaleX, r * scaleY, cellW, cellH);
      }
    }

    // Highlight active word on minimap
    if (activeWord) {
      ctx.fillStyle = '#F6C915';
      const dr = activeWord.direction === 'down' ? 1 : 0;
      const dc = activeWord.direction === 'across' ? 1 : 0;
      for (let i = 0; i < activeWord.length; i++) {
        const r = activeWord.row + dr * i;
        const c = activeWord.col + dc * i;
        ctx.fillRect(
          c * scaleX - 0.5,
          r * scaleY - 0.5,
          Math.max(2.5, cellW + 1),
          Math.max(2.5, cellH + 1)
        );
      }
    }

    // Draw current camera viewport reticle
    const vx = Math.max(0, viewportRect.startCol * scaleX);
    const vy = Math.max(0, viewportRect.startRow * scaleY);
    const vw = Math.min(canvasWidth - vx, (viewportRect.endCol - viewportRect.startCol) * scaleX);
    const vh = Math.min(canvasHeight - vy, (viewportRect.endRow - viewportRect.startRow) * scaleY);

    ctx.strokeStyle = '#F6C915';
    ctx.lineWidth = 2;
    ctx.strokeRect(vx, vy, Math.max(8, vw), Math.max(8, vh));
    ctx.fillStyle = 'rgba(246, 201, 21, 0.14)';
    ctx.fillRect(vx, vy, Math.max(8, vw), Math.max(8, vh));
  }, [puzzle, userGrid, activeWord, viewportRect, canvasWidth, canvasHeight, boardCols, boardRows]);

  const handlePointerToGrid = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvasWidth, e.clientX - rect.left));
    const y = Math.max(0, Math.min(canvasHeight, e.clientY - rect.top));

    const targetCol = Math.floor((x / canvasWidth) * boardCols);
    const targetRow = Math.floor((y / canvasHeight) * boardRows);
    onCenterCell(targetRow, targetCol);
  };

  return (
    <div className="bg-white/95 dark:bg-[#1a0624]/95 border-2 border-purple-300 dark:border-[#D4A437]/60 rounded-xl p-3 shadow-2xl select-none text-[#2B0938] dark:text-[#F5F3F7]">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#3b0d47] dark:text-white">
          <Compass className="w-3.5 h-3.5 text-amber-500 dark:text-[#F6C915] shrink-0" />
          <span className="whitespace-nowrap">Atlas Radar ({boardRows}×{boardCols})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            title={expanded ? 'Compact Radar' : 'Expand Radar'}
            className="p-1 text-slate-600 dark:text-purple-300 hover:text-[#3b0d47] dark:hover:text-white rounded transition-colors cursor-pointer"
          >
            {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close Atlas Radar"
              className="p-1 text-slate-600 dark:text-purple-300 hover:text-[#3b0d47] dark:hover:text-white rounded transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="relative rounded-lg overflow-hidden border border-purple-300 dark:border-purple-800 bg-[#11031A]">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setIsDragging(true);
            handlePointerToGrid(e);
          }}
          onPointerMove={(e) => {
            if (!isDragging) return;
            handlePointerToGrid(e);
          }}
          onPointerUp={(e) => {
            e.currentTarget.releasePointerCapture(e.pointerId);
            setIsDragging(false);
          }}
          className="block cursor-crosshair touch-none"
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600 dark:text-purple-300 font-mono-tabular">
        <span>R{Math.max(1, viewportRect.startRow + 1)} · C{Math.max(1, viewportRect.startCol + 1)}</span>
        <span className="text-amber-600 dark:text-[#F6C915] font-semibold">Click/Drag to Jump</span>
      </div>
    </div>
  );
};
