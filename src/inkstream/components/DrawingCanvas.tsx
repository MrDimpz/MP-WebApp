import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Eraser,
  ExternalLink,
  EyeOff,
  PaintBucket,
  Pencil,
  Redo2,
  Save,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Undo2,
} from 'lucide-react';
import type {
  CanvasCommand,
  DrawingTool,
  NormalizedPoint,
  RoomClientState,
  StrokeCommand,
} from '../shared/types.ts';
import { SKRIBBL_COLORS } from '../shared/words.ts';
import {
  applyCanvasCommand,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  clearCanvasToWhite,
  downloadDataUrl,
  drawStrokeCommand,
  renderCommandsToCanvas,
  renderCommandsToDataUrl,
} from '../utils/canvasEngine.ts';

interface LiveSegmentPayload {
  strokeId: string;
  tool: string;
  color: string;
  size: number;
  seed: number;
  points: NormalizedPoint[];
}

interface DrawingCanvasProps {
  room: RoomClientState;
  currentUserId: string;
  isOwner: boolean;
  canDraw: boolean;
  streamerPopupUrl: string | null;
  onEmitCommand: (cmd: CanvasCommand) => void;
  onEmitLiveSegment: (segment: LiveSegmentPayload) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onSelectWord: (index: number) => void;
  onReact: (reaction: 'like' | 'dislike') => void;
  onSaveArtwork: (dataUrl: string, word: string, artistName: string) => Promise<void>;
  onFinishSoloTurn: () => void;
  liveSegmentEvent: LiveSegmentPayload | null;
  lobbyContent?: React.ReactNode;
}

const SIZE_PRESETS = [3, 7, 14, 24, 38];

const DRAWING_TOOLS: Array<{
  id: DrawingTool;
  label: string;
  shortcut: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'pencil', label: 'Pencil', shortcut: 'P', icon: Pencil },
  { id: 'eraser', label: 'Eraser', shortcut: 'E', icon: Eraser },
  { id: 'fill', label: 'Fill', shortcut: 'F', icon: PaintBucket },
];

function makeId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  room,
  currentUserId,
  isOwner,
  canDraw,
  streamerPopupUrl,
  onEmitCommand,
  onEmitLiveSegment,
  onUndo,
  onRedo,
  onClear,
  onSelectWord,
  onReact,
  onSaveArtwork,
  onFinishSoloTurn,
  liveSegmentEvent,
  lobbyContent,
}) => {
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [tool, setTool] = useState<DrawingTool>('pencil');
  const [color, setColor] = useState<string>('#0F172A');
  const [size, setSize] = useState<number>(8);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [savingArt, setSavingArt] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [copiedPopupLink, setCopiedPopupLink] = useState(false);

  const isDrawingRef = useRef(false);
  const activeStrokeIdRef = useRef<string>('');
  const activeSeedRef = useRef<number>(1337);
  const strokePointsRef = useRef<NormalizedPoint[]>([]);
  const lastLiveEmitRef = useRef<number>(0);

  // Re-render authoritative canvas commands whenever room.commands changes
  useEffect(() => {
    const base = baseCanvasRef.current;
    if (!base) return;
    const ctx = base.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    renderCommandsToCanvas(ctx, room.commands);
    const preview = previewCanvasRef.current;
    if (preview) {
      const pctx = preview.getContext('2d');
      pctx?.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }, [room.commands, room.turnNumber, room.phase]);

  // Render incoming live stroke segments from remote active drawer on preview canvas
  useEffect(() => {
    if (!liveSegmentEvent || canDraw) return;
    const preview = previewCanvasRef.current;
    if (!preview) return;
    const pctx = preview.getContext('2d');
    if (!pctx) return;
    pctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawStrokeCommand(pctx, {
      id: liveSegmentEvent.strokeId,
      kind: 'stroke',
      tool: liveSegmentEvent.tool === 'eraser' ? 'eraser' : 'pencil',
      color: liveSegmentEvent.color,
      size: liveSegmentEvent.size,
      seed: liveSegmentEvent.seed,
      points: liveSegmentEvent.points,
    });
  }, [liveSegmentEvent, canDraw]);

  useEffect(() => {
    setSavedNotice(false);
  }, [room.turnNumber, room.phase]);

  // Keyboard shortcuts when drawing
  useEffect(() => {
    if (!canDraw) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        onRedo();
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'p' || key === 'b') setTool('pencil');
      else if (key === 'e') setTool('eraser');
      else if (key === 'f' || key === 'g') setTool('fill');
      else if (key === '[') setSize((prev) => Math.max(1, prev - 3));
      else if (key === ']') setSize((prev) => Math.min(48, prev + 3));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canDraw, onUndo, onRedo]);

  const selectColor = useCallback((hex: string) => {
    setColor(hex.toUpperCase());
    setTool((curr) => (curr === 'eraser' ? 'pencil' : curr));
  }, []);

  const getNormalizedPoint = (e: React.PointerEvent<HTMLCanvasElement>): NormalizedPoint => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || room.phase !== 'DRAWING') return;
    if (e.button !== 0) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getNormalizedPoint(e);

    if (tool === 'fill') {
      const fillCmd: CanvasCommand = {
        id: makeId(),
        kind: 'fill',
        color,
        x: pt.x,
        y: pt.y,
      };
      const base = baseCanvasRef.current;
      const ctx = base?.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        applyCanvasCommand(ctx, fillCmd);
      }
      onEmitCommand(fillCmd);
      return;
    }

    isDrawingRef.current = true;
    activeStrokeIdRef.current = makeId();
    activeSeedRef.current = Math.floor(Math.random() * 999_999) + 1;
    strokePointsRef.current = [pt];

    const preview = previewCanvasRef.current;
    const pctx = preview?.getContext('2d');
    if (pctx) {
      pctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawStrokeCommand(pctx, {
        id: activeStrokeIdRef.current,
        kind: 'stroke',
        tool: tool === 'eraser' ? 'eraser' : 'pencil',
        color: tool === 'eraser' ? '#FFFFFF' : color,
        size,
        seed: activeSeedRef.current,
        points: [pt],
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCursorPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });

    if (!isDrawingRef.current || !canDraw || room.phase !== 'DRAWING') return;
    const pt = getNormalizedPoint(e);
    const preview = previewCanvasRef.current;
    const pctx = preview?.getContext('2d');
    if (!pctx) return;

    const pts = strokePointsRef.current;
    const last = pts[pts.length - 1];
    if (
      last &&
      Math.hypot((pt.x - last.x) * CANVAS_WIDTH, (pt.y - last.y) * CANVAS_HEIGHT) < 1.2
    ) {
      return;
    }

    pts.push(pt);
    if (pts.length > 1000) {
      commitFreehandStroke();
      activeStrokeIdRef.current = makeId();
      activeSeedRef.current = Math.floor(Math.random() * 999_999) + 1;
      strokePointsRef.current = [pt];
      return;
    }

    pctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawStrokeCommand(pctx, {
      id: activeStrokeIdRef.current,
      kind: 'stroke',
      tool: tool === 'eraser' ? 'eraser' : 'pencil',
      color: tool === 'eraser' ? '#FFFFFF' : color,
      size,
      seed: activeSeedRef.current,
      points: pts,
    });

    const now = performance.now();
    if (now - lastLiveEmitRef.current > 45) {
      lastLiveEmitRef.current = now;
      onEmitLiveSegment({
        strokeId: activeStrokeIdRef.current,
        tool: tool === 'eraser' ? 'eraser' : 'pencil',
        color: tool === 'eraser' ? '#FFFFFF' : color,
        size,
        seed: activeSeedRef.current,
        points: pts.slice(-60),
      });
    }
  };

  const commitFreehandStroke = () => {
    const pts = strokePointsRef.current;
    if (pts.length === 0) return;

    const strokeCmd: StrokeCommand = {
      id: activeStrokeIdRef.current,
      kind: 'stroke',
      tool: tool === 'eraser' ? 'eraser' : 'pencil',
      color: tool === 'eraser' ? '#FFFFFF' : color,
      size,
      seed: activeSeedRef.current,
      points: [...pts],
    };

    const base = baseCanvasRef.current;
    const bctx = base?.getContext('2d', { willReadFrequently: true });
    if (bctx) {
      drawStrokeCommand(bctx, strokeCmd);
    }
    const preview = previewCanvasRef.current;
    preview?.getContext('2d')?.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    onEmitCommand(strokeCmd);
    strokePointsRef.current = [];
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    commitFreehandStroke();
  };

  const handleClearClick = () => {
    if (!canDraw) return;
    const base = baseCanvasRef.current;
    const bctx = base?.getContext('2d', { willReadFrequently: true });
    if (bctx) clearCanvasToWhite(bctx);
    onClear();
  };

  const handleDownloadCurrent = (framed: boolean) => {
    const drawer = room.players.find((p) => p.id === room.drawerId);
    const word = room.turnSummary?.word ?? room.secretWord ?? 'sketch';
    const artist = room.turnSummary?.drawerName ?? drawer?.username ?? 'artist';
    const hideWord = room.settings.streamerMode && isOwner && canDraw && room.phase === 'DRAWING';
    const dataUrl = renderCommandsToDataUrl(room.commands, {
      framed,
      word: (room.phase === 'TURN_SUMMARY' || (canDraw && !hideWord)) ? word : 'InkStream Drawing',
      artistName: artist,
      roomName: room.settings.name,
    });
    downloadDataUrl(dataUrl, `inkstream-${hideWord ? 'sketch' : word}-${artist}`);
  };

  const handleCopyPopupLink = async () => {
    if (!streamerPopupUrl) return;
    try {
      await navigator.clipboard.writeText(streamerPopupUrl);
      setCopiedPopupLink(true);
      setTimeout(() => setCopiedPopupLink(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleSaveCurrentToGallery = async () => {
    const drawer = room.players.find((p) => p.id === room.drawerId);
    const word = room.turnSummary?.word ?? room.secretWord ?? 'Sketch';
    const artist = room.turnSummary?.drawerName ?? drawer?.username ?? 'Artist';
    const dataUrl = renderCommandsToDataUrl(room.commands, { framed: false });
    setSavingArt(true);
    try {
      await onSaveArtwork(dataUrl, word, artist);
      setSavedNotice(true);
    } finally {
      setSavingArt(false);
    }
  };

  const activeDrawer = room.players.find((p) => p.id === room.drawerId);
  const showBrushCursor =
    canDraw && room.phase === 'DRAWING' && cursorPos !== null && tool !== 'fill';

  if (room.phase === 'LOBBY' && lobbyContent) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
        {lobbyContent}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 min-w-0">
      {/* Canvas Stage */}
      <div className="relative bg-white border border-slate-300 rounded-xl overflow-hidden select-none">
        {/* Top subtle canvas utility bar */}
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-200 bg-[#19042a] text-xs">
          <div className="flex items-center gap-2 text-slate-600 min-w-0">
            {room.phase === 'DRAWING' && (
              <>
                <span className="font-semibold text-slate-900 truncate">
                  {canDraw ? 'Your turn to draw' : `${activeDrawer?.username ?? 'Artist'} is drawing`}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums text-slate-500">
                  {room.commands.length} {room.commands.length === 1 ? 'stroke' : 'strokes'}
                </span>
                {!room.hasFirstStroke && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-[#F6C915] truncate">
                      {canDraw ? 'Draw 1st stroke to open guesses' : 'Guesses open on 1st stroke'}
                    </span>
                  </>
                )}
              </>
            )}
            {room.phase === 'WORD_SELECT' && (
              <span className="font-semibold text-slate-900">
                {canDraw
                  ? 'Pick a word to draw'
                  : `${activeDrawer?.username ?? 'Artist'} is selecting a word`}
              </span>
            )}
            {room.phase === 'TURN_SUMMARY' && room.turnSummary && (
              <span className="font-semibold text-slate-900">
                Word revealed: {room.turnSummary.word}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!canDraw && (room.phase === 'DRAWING' || room.phase === 'TURN_SUMMARY') && (
              <div className="flex items-center gap-1 mr-1">
                <button
                  type="button"
                  onClick={() => onReact('like')}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    room.myReaction === 'like'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                  title="Like this drawing"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span>Like</span>
                </button>
                <button
                  type="button"
                  onClick={() => onReact('dislike')}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    room.myReaction === 'dislike'
                      ? 'bg-rose-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-rose-700'
                  }`}
                  title="Dislike this drawing"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {canDraw && room.isSoloMode && room.phase === 'DRAWING' && (
              <button
                type="button"
                onClick={onFinishSoloTurn}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Finish Sketch
              </button>
            )}

            {room.commands.length > 0 && (
              <button
                type="button"
                onClick={() => handleDownloadCurrent(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-medium hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer"
                title="Download artwork as PNG"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PNG</span>
              </button>
            )}
          </div>
        </div>

        {/* 4:3 Responsive Drawing Surface */}
        <div
          className="relative w-full aspect-[4/3] bg-white inkstream-canvas-stage inkstream-keep-white overflow-hidden touch-none"
          onPointerLeave={() => setCursorPos(null)}
        >
          <canvas
            ref={baseCanvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="absolute inset-0 w-full h-full block"
          />
          <canvas
            ref={previewCanvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`absolute inset-0 w-full h-full block ${
              canDraw && room.phase === 'DRAWING'
                ? tool === 'fill'
                  ? 'cursor-crosshair'
                  : 'cursor-none'
                : 'cursor-default'
            }`}
          />

          {/* Live brush size preview cursor ring */}
          {showBrushCursor && cursorPos && (
            <div
              className="pointer-events-none absolute rounded-full border border-slate-900/80 shadow-[0_0_0_1px_rgba(255,255,255,0.9)]"
              style={{
                width: Math.max(6, size),
                height: Math.max(6, size),
                left: cursorPos.x,
                top: cursorPos.y,
                transform: 'translate(-50%, -50%)',
                backgroundColor:
                  tool === 'eraser' ? 'rgba(255,255,255,0.65)' : `${color}28`,
              }}
            />
          )}

          {/* WORD_SELECT Overlay */}
          {room.phase === 'WORD_SELECT' && (
            <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px] flex items-center justify-center p-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-lg w-full text-center">
                {canDraw && room.settings.streamerMode && isOwner ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                      <EyeOff className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-blue-600">
                        Stream Safe Mode · {room.timeRemaining}s to pick
                      </p>
                      <h2 className="text-xl font-bold text-slate-900 mt-1">
                        Word choices hidden from stream
                      </h2>
                      <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                        Select your word privately in your separate Streamer Word Picker popup so
                        viewers cannot see your choices.
                      </p>
                    </div>
                    {streamerPopupUrl && (
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                        <a
                          href={streamerPopupUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open Private Word Popup
                        </a>
                        <button
                          type="button"
                          onClick={handleCopyPopupLink}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                        >
                          {copiedPopupLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedPopupLink ? 'Copied' : 'Copy Popup Link'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : canDraw ? (
                  <>
                    <p className="text-xs font-medium text-blue-600 mb-1">
                      Round {room.currentRound} of {room.totalRounds} · {room.timeRemaining}s to pick
                    </p>
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">
                      Choose a word to draw
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {room.wordOptions.map((word, idx) => (
                        <button
                          key={word}
                          type="button"
                          onClick={() => onSelectWord(idx)}
                          className="px-4 py-3.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-blue-600 hover:border-blue-600 hover:text-white text-slate-900 font-semibold text-base capitalize transition-colors cursor-pointer"
                        >
                          {word}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-medium text-slate-500 mb-1">
                      Round {room.currentRound} of {room.totalRounds}
                    </p>
                    <h2 className="text-xl font-bold text-slate-900">
                      {activeDrawer?.username ?? 'Artist'} is choosing a word
                    </h2>
                    <p className="text-sm text-slate-600 mt-1.5 tabular-nums">
                      Starting in {room.timeRemaining}s
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TURN_SUMMARY Overlay */}
          {room.phase === 'TURN_SUMMARY' && room.turnSummary && (
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-5">
              <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full">
                <div className="text-center border-b border-slate-200 pb-4">
                  <p className="text-xs font-medium text-slate-500">
                    {room.turnSummary.reason === 'all_guessed'
                      ? 'Everyone guessed it'
                      : room.turnSummary.reason === 'solo_finished'
                        ? 'Sketch complete'
                        : room.turnSummary.reason === 'drawer_left'
                          ? 'Drawer left the room'
                          : 'Time is up'}
                    {' · '}Next turn in {room.timeRemaining}s
                  </p>
                  <h2 className="text-2xl font-bold text-slate-900 mt-1 capitalize">
                    {room.turnSummary.word}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Drawn by {room.turnSummary.drawerName}
                  </p>
                </div>

                <div className="py-3 max-h-40 overflow-y-auto thin-scrollbar divide-y divide-slate-100">
                  {room.turnSummary.scoreDeltas.map((delta) => (
                    <div
                      key={delta.playerId}
                      className="flex items-center justify-between py-1.5 text-sm"
                    >
                      <span
                        className={`font-medium ${
                          delta.playerId === currentUserId
                            ? 'text-blue-700'
                            : 'text-slate-800'
                        }`}
                      >
                        {delta.username}
                      </span>
                      <span
                        className={`font-mono-tabular font-semibold ${
                          delta.points > 0 ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      >
                        {delta.points > 0 ? `+${delta.points}` : '0'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadCurrent(true)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PNG
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCurrentToGallery}
                    disabled={savingArt || savedNotice}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      savedNotice
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {savedNotice ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Saved to Gallery
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        {savingArt ? 'Saving...' : 'Save Artwork'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Streamlined Drawing Toolbar: Pencil, Eraser, Fill + Colors + Thickness */}
      {canDraw && room.phase === 'DRAWING' && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-3">
          {/* Row 1: Pencil / Eraser / Fill + Undo / Redo / Clear */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5" role="group" aria-label="Drawing tools">
              {DRAWING_TOOLS.map((t) => {
                const Icon = t.icon;
                const active = tool === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTool(t.id)}
                    title={`${t.label} (${t.shortcut})`}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onUndo}
                disabled={!room.canUndo}
                title="Undo (Ctrl+Z)"
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Undo2 className="w-4 h-4" />
                <span className="hidden sm:inline">Undo</span>
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={!room.canRedo}
                title="Redo (Ctrl+Y)"
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Redo2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleClearClick}
                title="Clear canvas"
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-rose-400/50 bg-rose-950/70 text-xs font-semibold text-rose-200 hover:bg-rose-900/80 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
          </div>

          {/* Row 2: 13 Basic Colors on One Line */}
          <div className="pt-2 border-t border-slate-100">
            <div
              className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-1.5 w-full"
              role="group"
              aria-label="Color palette"
            >
              {SKRIBBL_COLORS.map((hex) => {
                const active = color.toLowerCase() === hex.toLowerCase() && tool !== 'eraser';
                return (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => selectColor(hex)}
                    title={hex}
                    className={`w-full h-7 rounded-md transition-transform cursor-pointer ${
                      active
                        ? 'ring-2 ring-blue-600 ring-offset-1 scale-105 z-10'
                        : 'border border-slate-300/90 hover:scale-105'
                    }`}
                    style={{ backgroundColor: hex }}
                    aria-label={`Color ${hex}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Row 3: Line Thickness Controls */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2" role="group" aria-label="Brush size presets">
              {SIZE_PRESETS.map((preset) => {
                const active = Math.abs(size - preset) <= 1;
                const dotPx = Math.max(5, Math.min(20, Math.round(preset * 0.55)));
                const upperColor = color.toUpperCase();
                const isLightInk =
                  upperColor === '#FFFFFF' ||
                  upperColor === '#FDE047' ||
                  upperColor === '#FEF08A';
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSize(preset)}
                    title={`Thickness ${preset}px`}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer inkstream-keep-white bg-white ${
                      active
                        ? 'ring-2 ring-[#F6C915] border-2 border-[#F6C915] shadow-[0_0_12px_rgba(246,201,21,0.45)] scale-105'
                        : 'border border-purple-200/80 opacity-90 hover:opacity-100 hover:border-[#F6C915]'
                    }`}
                  >
                    <span
                      className="rounded-full block"
                      style={{
                        width: dotPx,
                        height: dotPx,
                        backgroundColor: tool === 'eraser' ? '#E2E8F0' : color,
                        border:
                          tool === 'eraser'
                            ? '1.5px dashed #4C1D95'
                            : isLightInk
                              ? '1.5px solid #4C1D95'
                              : '1px solid rgba(15, 23, 42, 0.25)',
                      }}
                    />
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2.5 flex-1 max-w-xs justify-end">
              <input
                type="range"
                min={1}
                max={48}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                aria-label="Adjust line thickness"
                className="flex-1 accent-[#F6C915] cursor-pointer"
              />
              <span className="font-mono-tabular text-xs font-bold text-[#F6C915] bg-[#130321] border border-[#D4A437]/45 rounded-md px-2 py-1 min-w-[44px] text-center">
                {size}px
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
