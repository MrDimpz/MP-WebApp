import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PuzzleTile } from '../game/types';
import { CheckFeedbackState, TileFragment } from './TileFragment';

interface CrosswordBoardProps {
  tileOrder: number[];
  solvedTiles: PuzzleTile[];
  tileCols: number;
  tileRows: number;
  selectedSlot: number | null;
  lockedSlots: Set<number>;
  pinnedSlots: Set<number>;
  checkFeedback: Map<number, CheckFeedbackState>;
  settledSlots: Set<number>;
  isSolved: boolean;
  darkMode: boolean;
  onSwap: (fromSlot: number, toSlot: number) => void;
  onSelectSlot: (slotIndex: number | null) => void;
  onDragStartAudio: () => void;
  onInvalidDropAudio: () => void;
}

interface ActiveDrag {
  fromSlot: number;
  tileId: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  liftY: number;
  pointerId: number;
  initialX: number;
  initialY: number;
}

const DRAG_THRESHOLD_PX = 6;
const TOUCH_LIFT_OFFSET_PX = 34;

export const CrosswordBoard: React.FC<CrosswordBoardProps> = ({
  tileOrder,
  solvedTiles,
  tileCols,
  tileRows,
  selectedSlot,
  lockedSlots,
  pinnedSlots,
  checkFeedback,
  settledSlots,
  isSolved,
  darkMode,
  onSwap,
  onSelectSlot,
  onDragStartAudio,
  onInvalidDropAudio,
}) => {
  const slotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const slotRectsRef = useRef<Array<DOMRect | null>>([]);
  const floatingRef = useRef<HTMLDivElement | null>(null);

  const pendingDragRef = useRef<{
    slotIndex: number;
    tileId: number;
    pointerId: number;
    startX: number;
    startY: number;
    rect: DOMRect;
    isTouch: boolean;
  } | null>(null);

  const activeDragRef = useRef<ActiveDrag | null>(null);
  const hoverSlotRef = useRef<number | null>(null);

  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);

  const isImmovable = useCallback(
    (slotIndex: number) => isSolved || lockedSlots.has(slotIndex) || pinnedSlots.has(slotIndex),
    [isSolved, lockedSlots, pinnedSlots]
  );

  const cacheSlotRects = useCallback(() => {
    slotRectsRef.current = slotRefs.current.map((el) => (el ? el.getBoundingClientRect() : null));
  }, []);

  const findSlotAtPoint = useCallback((clientX: number, clientY: number): number | null => {
    const rects = slotRectsRef.current;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (!r) continue;
      const pad = 4;
      if (
        clientX >= r.left - pad &&
        clientX <= r.right + pad &&
        clientY >= r.top - pad &&
        clientY <= r.bottom + pad
      ) {
        return i;
      }
    }
    return null;
  }, []);

  const updateFloatingPosition = useCallback((clientX: number, clientY: number, drag: ActiveDrag) => {
    const el = floatingRef.current;
    if (!el) return;
    const x = clientX - drag.offsetX;
    const y = clientY - drag.offsetY - drag.liftY;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1.06)`;
  }, []);

  const handleTapSlot = useCallback(
    (slotIndex: number) => {
      if (isSolved) return;
      if (lockedSlots.has(slotIndex)) {
        onInvalidDropAudio();
        return;
      }

      if (selectedSlot === null) {
        onSelectSlot(slotIndex);
        onDragStartAudio();
        return;
      }

      if (selectedSlot === slotIndex) {
        onSelectSlot(null);
        return;
      }

      // If either the currently selected tile or target is pinned, just switch selection cleanly
      if (pinnedSlots.has(selectedSlot) || pinnedSlots.has(slotIndex)) {
        onSelectSlot(slotIndex);
        onInvalidDropAudio();
        return;
      }

      onSwap(selectedSlot, slotIndex);
      onSelectSlot(null);
    },
    [isSolved, lockedSlots, pinnedSlots, selectedSlot, onSelectSlot, onSwap, onDragStartAudio, onInvalidDropAudio]
  );

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const pending = pendingDragRef.current;
      let drag = activeDragRef.current;

      if (pending && !drag && e.pointerId === pending.pointerId) {
        const dx = e.clientX - pending.startX;
        const dy = e.clientY - pending.startY;
        if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
          if (isImmovable(pending.slotIndex)) {
            pendingDragRef.current = null;
            onInvalidDropAudio();
            return;
          }

          cacheSlotRects();
          const liftY = pending.isTouch ? TOUCH_LIFT_OFFSET_PX : 0;
          const started: ActiveDrag = {
            fromSlot: pending.slotIndex,
            tileId: pending.tileId,
            width: pending.rect.width,
            height: pending.rect.height,
            offsetX: pending.startX - pending.rect.left,
            offsetY: pending.startY - pending.rect.top,
            liftY,
            pointerId: pending.pointerId,
            initialX: e.clientX - (pending.startX - pending.rect.left),
            initialY: e.clientY - (pending.startY - pending.rect.top) - liftY,
          };
          activeDragRef.current = started;
          pendingDragRef.current = null;
          setActiveDrag(started);
          onSelectSlot(null);
          onDragStartAudio();
          drag = started;
        }
      }

      if (drag && e.pointerId === drag.pointerId) {
        e.preventDefault();
        updateFloatingPosition(e.clientX, e.clientY, drag);

        const centerX = e.clientX - drag.offsetX + drag.width / 2;
        const centerY = e.clientY - drag.offsetY - drag.liftY + drag.height / 2;
        const target = findSlotAtPoint(centerX, centerY);

        const validTarget =
          target !== null && target !== drag.fromSlot && !isImmovable(target) ? target : null;

        if (validTarget !== hoverSlotRef.current) {
          hoverSlotRef.current = validTarget;
          setHoverSlot(validTarget);
        }
      }
    }

    function finishPointer(e: PointerEvent, cancelled: boolean) {
      const pending = pendingDragRef.current;
      const drag = activeDragRef.current;

      if (pending && e.pointerId === pending.pointerId) {
        const tappedSlot = pending.slotIndex;
        pendingDragRef.current = null;
        if (!cancelled) {
          handleTapSlot(tappedSlot);
        }
        return;
      }

      if (drag && e.pointerId === drag.pointerId) {
        const fromSlot = drag.fromSlot;
        const targetSlot = hoverSlotRef.current;

        activeDragRef.current = null;
        hoverSlotRef.current = null;
        setActiveDrag(null);
        setHoverSlot(null);

        if (!cancelled && targetSlot !== null && targetSlot !== fromSlot && !isImmovable(targetSlot)) {
          onSwap(fromSlot, targetSlot);
        } else if (!cancelled && targetSlot === null) {
          onInvalidDropAudio();
        }
      }
    }

    const onPointerUp = (e: PointerEvent) => finishPointer(e, false);
    const onPointerCancel = (e: PointerEvent) => finishPointer(e, true);

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [
    cacheSlotRects,
    findSlotAtPoint,
    handleTapSlot,
    isImmovable,
    onDragStartAudio,
    onInvalidDropAudio,
    onSelectSlot,
    onSwap,
    updateFloatingPosition,
  ]);

  const handleSlotPointerDown = (slotIndex: number, tileId: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (isSolved) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    pendingDragRef.current = {
      slotIndex,
      tileId,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      rect,
      isTouch: e.pointerType === 'touch',
    };
  };

  const handleSlotKeyDown = (slotIndex: number) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (isSolved) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTapSlot(slotIndex);
      return;
    }
    let nextSlot: number | null = null;
    const total = tileRows * tileCols;
    if (e.key === 'ArrowRight' && (slotIndex + 1) % tileCols !== 0) nextSlot = slotIndex + 1;
    if (e.key === 'ArrowLeft' && slotIndex % tileCols !== 0) nextSlot = slotIndex - 1;
    if (e.key === 'ArrowDown' && slotIndex + tileCols < total) nextSlot = slotIndex + tileCols;
    if (e.key === 'ArrowUp' && slotIndex - tileCols >= 0) nextSlot = slotIndex - tileCols;

    if (nextSlot !== null) {
      e.preventDefault();
      slotRefs.current[nextSlot]?.focus();
    }
  };

  const boardMaxWidthClass =
    tileRows === 5
      ? 'max-w-[392px] sm:max-w-[420px]'
      : tileRows === 4
        ? 'max-w-[404px] sm:max-w-[440px]'
        : 'max-w-[412px] sm:max-w-[456px]';

  const compactLetters = tileRows === 5;

  return (
    <div className="flex w-full justify-center">
      <div
        className={`w-full ${boardMaxWidthClass} transition-all duration-300 ease-out ${
          isSolved
            ? 'rounded-lg border-2 border-[#F6C915] bg-[#160424] p-0 shadow-[0_14px_34px_-10px_rgba(246,201,21,0.35)]'
            : darkMode
              ? 'rounded-2xl border-2 border-[#D4A437]/45 bg-[#220636] p-2.5 sm:p-3.5 shadow-[0_16px_38px_rgba(8,1,15,0.55)]'
              : 'rounded-2xl border-2 border-[#D4A437]/65 bg-[#EDE3F5] p-2.5 sm:p-3.5 shadow-[inset_0_1px_3px_rgba(43,9,56,0.12)]'
        }`}
        role="grid"
        aria-label={`Crossword jigsaw board, ${tileCols} columns by ${tileRows} rows of 3 by 3 word fragments`}
      >
        <div
          className={`grid transition-all duration-300 ease-out ${
            isSolved ? 'gap-0' : 'gap-2 sm:gap-2.5'
          }`}
          style={{ gridTemplateColumns: `repeat(${tileCols}, minmax(0, 1fr))` }}
        >
          {tileOrder.map((tileId, slotIndex) => {
            const tile = solvedTiles[tileId];
            const isLocked = lockedSlots.has(slotIndex);
            const isPinned = pinnedSlots.has(slotIndex);
            const isDraggingSource = activeDrag?.fromSlot === slotIndex;
            const isDropTarget = hoverSlot === slotIndex;
            const isSelected = selectedSlot === slotIndex;
            const checkState = checkFeedback.get(slotIndex) ?? null;
            const justSettled = settledSlots.has(slotIndex);

            const tileSummary = tile.cells
              .map((r) => r.map((c) => (c === '#' ? 'blank' : c)).join(' '))
              .join(', ');

            return (
              <button
                key={`slot-${slotIndex}`}
                ref={(el) => {
                  slotRefs.current[slotIndex] = el;
                }}
                type="button"
                role="gridcell"
                aria-label={`Slot ${slotIndex + 1}, fragment ${tileSummary}${
                  isLocked ? ', locked' : isPinned ? ', pinned' : ''
                }${isSelected ? ', selected' : ''}`}
                aria-pressed={isSelected}
                onPointerDown={handleSlotPointerDown(slotIndex, tileId)}
                onKeyDown={handleSlotKeyDown(slotIndex)}
                style={{ touchAction: 'none' }}
                className={`group relative block w-full p-0 text-left focus-visible:z-10 ${
                  isSolved
                    ? 'cursor-default'
                    : isLocked
                      ? 'cursor-not-allowed'
                      : 'cursor-grab active:cursor-grabbing'
                }`}
              >
                <TileFragment
                  tile={tile}
                  isSelected={isSelected}
                  isDropTarget={isDropTarget}
                  isLocked={isLocked}
                  isPinned={isPinned}
                  isDraggingSource={isDraggingSource}
                  isSolved={isSolved}
                  justSettled={justSettled}
                  checkState={checkState}
                  compact={compactLetters}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Compositor-accelerated floating tile clone during touch/mouse drag */}
      {activeDrag && (
        <div
          ref={floatingRef}
          className="pointer-events-none fixed left-0 top-0 z-50 will-change-transform"
          style={{
            width: `${activeDrag.width}px`,
            height: `${activeDrag.height}px`,
            transform: `translate3d(${activeDrag.initialX}px, ${activeDrag.initialY}px, 0) scale(1.06)`,
          }}
          aria-hidden="true"
        >
          <TileFragment
            tile={solvedTiles[activeDrag.tileId]}
            isFloating
            compact={compactLetters}
          />
        </div>
      )}
    </div>
  );
};
