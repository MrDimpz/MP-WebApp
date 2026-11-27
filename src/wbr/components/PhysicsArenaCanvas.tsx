import { useEffect, useMemo, useRef } from 'react';
import { Crown, RotateCcw, Skull, Swords } from 'lucide-react';
import { WinTallyBadge } from '@/components/interactive-games/win-tally-badge';
import { SmoothMarquee } from '@/components/smooth-marquee';
import { generateProfilePicture } from '../data/avatarGenerator';
import { PhysicsArenaEngine } from '../engine/physicsArena';
import { soundEngine } from '../engine/soundEngine';
import { ArenaFeedbackEvent, GamePhase, Player, WordFlashEvent } from '../types/game';

interface PhysicsArenaCanvasProps {
  players: Player[];
  wave: number;
  phase: GamePhase;
  timeRemaining: number;
  feedbackEvent: ArenaFeedbackEvent | null;
  wordFlashes: WordFlashEvent[];
  waveEliminatedPlayers: Player[];
  champion: Player | null;
  wipeoutMessage: string | null;
  waitingForStart?: boolean;
  isOverlay?: boolean;
}

export function PhysicsArenaCanvas({
  players,
  wave,
  phase,
  timeRemaining,
  feedbackEvent,
  wordFlashes,
  waveEliminatedPlayers,
  champion,
  wipeoutMessage,
  waitingForStart = false,
  isOverlay = false,
}: PhysicsArenaCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<PhysicsArenaEngine | null>(null);
  const lastFeedbackTsRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const engine = new PhysicsArenaEngine(canvas, isOverlay, () => {
      if (!isOverlay) {
        soundEngine.playExplosion();
      }
    });
    engineRef.current = engine;
    engine.start();

    const resizeObserver = new ResizeObserver(() => {
      engine.resize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      engine.stop();
      engineRef.current = null;
    };
  }, [isOverlay]);

  useEffect(() => {
    engineRef.current?.setOverlayMode(isOverlay);
  }, [isOverlay]);

  useEffect(() => {
    engineRef.current?.setPhaseState(phase, timeRemaining);
  }, [phase, timeRemaining]);

  useEffect(() => {
    engineRef.current?.syncPlayers(players);
  }, [players]);

  useEffect(() => {
    if (!feedbackEvent || !engineRef.current) return;
    if (feedbackEvent.timestamp === lastFeedbackTsRef.current) return;
    lastFeedbackTsRef.current = feedbackEvent.timestamp;
    const engine = engineRef.current;

    switch (feedbackEvent.type) {
      case 'SAFE':
        if (feedbackEvent.playerId && feedbackEvent.text) {
          engine.triggerSafeWord(feedbackEvent.playerId, feedbackEvent.text);
        }
        break;
      case 'TAKEN':
        if (feedbackEvent.playerId) {
          engine.triggerFeedback(feedbackEvent.playerId, 'TAKEN!', '#F6C915');
        }
        break;
      case 'INVALID':
        if (feedbackEvent.playerId) {
          engine.triggerFeedback(feedbackEvent.playerId, 'INVALID!', '#FF2A6D');
        }
        break;
      case 'BANNED':
        if (feedbackEvent.playerId) {
          engine.triggerFeedback(
            feedbackEvent.playerId,
            feedbackEvent.text || 'BANNED!',
            '#FF2A6D'
          );
        }
        break;
      case 'BATTLE':
        if (feedbackEvent.playerIds && feedbackEvent.playerIds.length > 0) {
          engine.startBattleSequence(feedbackEvent.playerIds, 2.6);
        }
        break;
      case 'ELIMINATE':
        if (feedbackEvent.playerIds && feedbackEvent.playerIds.length > 0) {
          engine.triggerEliminations(feedbackEvent.playerIds);
        }
        break;
      case 'REVIVE':
        engine.triggerReviveFlash();
        break;
      case 'VICTORY':
        engine.triggerVictoryBurst();
        break;
      default:
        break;
    }
  }, [feedbackEvent]);

  const aliveCount = players.filter((p) => p.alive).length;
  const knockedOutPlayers = useMemo(
    () =>
      players
        .filter((p) => !p.alive)
        .sort((a, b) => (b.eliminatedAt || 0) - (a.eliminatedAt || 0)),
    [players]
  );

  const flashBySlot = useMemo(() => {
    const slots: Array<WordFlashEvent | null> = Array(10).fill(null);
    for (const item of wordFlashes) {
      if (item.slot >= 0 && item.slot < 10) {
        slots[item.slot] = item;
      }
    }
    return slots;
  }, [wordFlashes]);

  const renderFlashCard = (flash: WordFlashEvent | null, slotIndex: number) => {
    if (!flash) {
      return <div key={`empty-${slotIndex}`} className="min-w-0" />;
    }
    return (
      <div
        key={flash.id}
        className="flex items-center gap-1.5 min-w-0 rounded-xl bg-[#180424]/84 border border-[#F6C915]/90 px-2 py-0.5 shadow-md overflow-hidden"
      >
        <img
          src={flash.avatarUrl || generateProfilePicture(flash.username)}
          alt={flash.username}
          referrerPolicy="no-referrer"
          className="w-6 h-6 rounded-full object-cover border-2 shrink-0"
          style={{ borderColor: flash.color || '#F6C915' }}
        />
        <div className="min-w-0 text-left leading-tight">
          <div className="text-[9px] font-bold text-purple-200/90 truncate">
            @{flash.username.replace(/^@/, '')}
          </div>
          <div className="font-display font-black text-xs sm:text-sm leading-tight tracking-wide text-[#F6C915] uppercase truncate">
            {flash.word}
          </div>
        </div>
      </div>
    );
  };

  // Dynamic sizing config so every single eliminated player fits on the In Memoriam board at once
  const memorialLayout = useMemo(() => {
    const count = waveEliminatedPlayers.length;
    if (count <= 1) {
      return {
        compactRow: false,
        gridClass: 'grid-cols-1 max-w-[180px] gap-1.5',
        cardClass: 'px-2.5 py-2 rounded-xl',
        avatarClass: 'w-11 h-11 border-2',
        skullWrapClass: 'w-4 h-4 -bottom-1 -right-1',
        skullIconClass: 'w-2.5 h-2.5',
        nameClass: 'mt-1.5 text-xs',
      };
    }
    if (count <= 4) {
      return {
        compactRow: false,
        gridClass: 'grid-cols-2 gap-1.5',
        cardClass: 'px-2 py-1.5 rounded-xl',
        avatarClass: 'w-9 h-9 border-2',
        skullWrapClass: 'w-4 h-4 -bottom-1 -right-1',
        skullIconClass: 'w-2.5 h-2.5',
        nameClass: 'mt-1 text-[11px]',
      };
    }
    if (count <= 9) {
      return {
        compactRow: false,
        gridClass: 'grid-cols-3 gap-1.5',
        cardClass: 'px-1.5 py-1 rounded-xl',
        avatarClass: 'w-7 h-7 border-2',
        skullWrapClass: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5',
        skullIconClass: 'w-2 h-2',
        nameClass: 'mt-1 text-[9.5px]',
      };
    }
    if (count <= 16) {
      return {
        compactRow: false,
        gridClass: 'grid-cols-4 gap-1',
        cardClass: 'px-1 py-1 rounded-lg',
        avatarClass: 'w-6 h-6 border',
        skullWrapClass: 'w-3 h-3 -bottom-0.5 -right-0.5',
        skullIconClass: 'w-2 h-2',
        nameClass: 'mt-0.5 text-[8.5px]',
      };
    }
    if (count <= 30) {
      return {
        compactRow: true,
        gridClass: 'grid-cols-3 gap-1',
        cardClass: 'px-1.5 py-0.5 rounded-lg gap-1.5',
        avatarClass: 'w-4 h-4 border',
        skullWrapClass: '',
        skullIconClass: '',
        nameClass: 'text-[9.5px] leading-tight',
      };
    }
    if (count <= 52) {
      return {
        compactRow: true,
        gridClass: 'grid-cols-4 gap-1',
        cardClass: 'px-1 py-0.5 rounded-md gap-1',
        avatarClass: 'w-3.5 h-3.5 border',
        skullWrapClass: '',
        skullIconClass: '',
        nameClass: 'text-[8px] leading-tight',
      };
    }
    return {
      compactRow: true,
      gridClass: 'grid-cols-5 gap-0.5',
      cardClass: 'px-1 py-px rounded gap-1',
      avatarClass: 'w-3 h-3 border',
      skullWrapClass: '',
      skullIconClass: '',
      nameClass: 'text-[7px] leading-none',
    };
  }, [waveEliminatedPlayers.length]);

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 w-full px-2 py-0.5 relative overflow-hidden"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* 2-Column Full-Arena Flashed Used Words (10 Simultaneous Slots) */}
      {(phase === 'ACTIVE_WAVE' || phase === 'LAG_GRACE') && wordFlashes.length > 0 && (
        <div
          className={`absolute inset-x-2 top-1.5 ${
            knockedOutPlayers.length > 0 ? 'bottom-9' : 'bottom-1.5'
          } z-20 grid grid-cols-2 grid-rows-5 gap-1 items-center pointer-events-none`}
        >
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((slotIndex) =>
            renderFlashCard(flashBySlot[slotIndex], slotIndex)
          )}
        </div>
      )}

      {/* Subtle Battle Sequence Indicator */}
      {phase === 'ELIMINATION' && !wipeoutMessage && waveEliminatedPlayers.length > 0 && (
        <div className="absolute inset-x-3 top-2 z-20 flex justify-center pointer-events-none">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#24061B]/92 border border-[#FF2A6D] px-3 py-1 shadow-lg">
            <Swords className="w-3.5 h-3.5 text-[#FF2A6D] shrink-0" />
            <span className="font-display font-black text-xs tracking-wider uppercase text-white">
              ARENA BATTLE · <span className="text-[#FF2A6D]">{waveEliminatedPlayers.length} TARGETS</span>
            </span>
          </div>
        </div>
      )}

      {/* 3-Second In Memoriam Popup Showing All Knocked-Out Players Dynamically Resized */}
      {phase === 'MEMORIAL' && waveEliminatedPlayers.length > 0 && (
        <div
          className={`absolute inset-x-2 top-1.5 ${
            knockedOutPlayers.length > 0 ? 'bottom-9' : 'bottom-1.5'
          } z-30 flex items-center justify-center pointer-events-none`}
        >
          <div className="w-full max-h-full rounded-2xl bg-[#160322]/96 border-2 border-[#FF2A6D]/80 px-2.5 py-2 shadow-2xl flex flex-col items-center overflow-hidden">
            <div className="flex items-center justify-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#FF2A6D] shrink-0">
              <Skull className="w-3.5 h-3.5 shrink-0" />
              <span>IN MEMORIAM · WAVE {wave}</span>
            </div>
            <div className="font-display font-black text-base sm:text-lg leading-tight text-white uppercase tracking-tight mt-0.5 shrink-0">
              {waveEliminatedPlayers.length}{' '}
              {waveEliminatedPlayers.length === 1 ? 'PLAYER' : 'PLAYERS'} KNOCKED OUT
            </div>

            <div
              className={`mt-1.5 w-full flex-1 min-h-0 grid content-center overflow-hidden ${memorialLayout.gridClass}`}
            >
              {waveEliminatedPlayers.map((p) =>
                memorialLayout.compactRow ? (
                  <div
                    key={p.id}
                    className={`flex items-center bg-[#24062D]/90 border border-[#FF2A6D]/45 min-w-0 overflow-hidden ${memorialLayout.cardClass}`}
                  >
                    <img
                      src={p.avatarUrl || generateProfilePicture(p.username)}
                      alt={p.username}
                      referrerPolicy="no-referrer"
                      className={`rounded-full object-cover border-[#FF2A6D]/80 grayscale opacity-90 shrink-0 ${memorialLayout.avatarClass}`}
                    />
                    <span
                      className={`font-bold text-rose-100/95 truncate min-w-0 ${memorialLayout.nameClass}`}
                    >
                      @{p.username.replace(/^@/, '')}
                    </span>
                  </div>
                ) : (
                  <div
                    key={p.id}
                    className={`flex flex-col items-center justify-center bg-[#24062D]/90 border border-[#FF2A6D]/45 text-center min-w-0 overflow-hidden ${memorialLayout.cardClass}`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={p.avatarUrl || generateProfilePicture(p.username)}
                        alt={p.username}
                        referrerPolicy="no-referrer"
                        className={`rounded-full object-cover border-[#FF2A6D]/80 grayscale opacity-90 ${memorialLayout.avatarClass}`}
                      />
                      <span
                        className={`absolute rounded-full bg-[#FF2A6D] text-white flex items-center justify-center shadow ${memorialLayout.skullWrapClass}`}
                      >
                        <Skull className={memorialLayout.skullIconClass} />
                      </span>
                    </div>
                    <span
                      className={`font-bold text-rose-100/95 truncate max-w-full ${memorialLayout.nameClass}`}
                    >
                      @{p.username.replace(/^@/, '')}
                    </span>
                  </div>
                )
              )}
            </div>

            <div className="mt-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-purple-200/75 shrink-0">
              {aliveCount <= 1
                ? 'Crowning champion...'
                : `Next wave in ${Math.max(1, Math.ceil(timeRemaining))}s...`}
            </div>
          </div>
        </div>
      )}

      {/* Empty Lobby Helper Overlay */}
      {phase === 'LOBBY' && aliveCount === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
          <p className="font-display font-black text-2xl uppercase tracking-wide text-[#F6C915]">
            {waitingForStart ? 'LOBBY READY' : 'ARENA OPEN'}
          </p>
          <p className="text-xs text-purple-200/85 mt-1 max-w-[245px]">
            {waitingForStart
              ? 'Viewers can type in chat to join. Press Start when ready to launch the countdown.'
              : 'Waiting for TikTok LIVE chatters — or toggle Bot Simulator in the Host Drawer below.'}
          </p>
        </div>
      )}

      {/* Wipeout Revive Dramatic Overlay */}
      {wipeoutMessage && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4 z-20">
          <div className="bg-[#1B052C]/94 border-2 border-[#F6C915] rounded-2xl px-5 py-3.5 text-center shadow-lg">
            <div className="flex items-center justify-center gap-1.5 text-[#F6C915] text-xs font-extrabold uppercase tracking-widest">
              <RotateCcw className="w-4 h-4" />
              <span>EMERGENCY SAVE</span>
            </div>
            <p className="font-display font-black text-2xl text-white uppercase tracking-tight mt-0.5">
              {wipeoutMessage}
            </p>
          </div>
        </div>
      )}

      {/* Round Champion Banner Overlay with Win Tally */}
      {phase === 'VICTORY' && champion && (
        <div
          className={`absolute inset-x-4 ${
            knockedOutPlayers.length > 0 ? 'bottom-11' : 'bottom-4'
          } flex flex-col items-center pointer-events-none z-20`}
        >
          <div className="bg-[#1B052C]/95 border-2 border-[#F6C915] rounded-xl px-4 py-2.5 text-center shadow-xl flex flex-col items-center">
            <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F6C915]">
              <Crown className="w-3.5 h-3.5" />
              <span>ROUND CHAMPION</span>
            </div>
            <div className="flex items-center justify-center gap-2 mt-1">
              <img
                src={champion.avatarUrl || generateProfilePicture(champion.username)}
                alt={champion.username}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover border-2 border-[#F6C915] shrink-0"
              />
              <div className="font-display font-black text-[24px] leading-tight text-white tracking-tight">
                {champion.username.replace(/^@/, '')}
              </div>
            </div>
            <WinTallyBadge
              gameId="wbr"
              winnerName={champion.username}
              className="mt-1.5"
            />
          </div>
        </div>
      )}

      {/* Side-to-Side Scrolling Knockout Marquee of Eliminated Players */}
      {knockedOutPlayers.length > 0 && (
        <div className="absolute inset-x-2 bottom-1 z-20 pointer-events-none">
          <div className="flex items-center gap-1.5 rounded-lg bg-[#180424]/92 border border-[#FF2A6D]/45 px-2 py-1 overflow-hidden">
            <span className="inline-flex items-center gap-1 text-[9.5px] font-black uppercase tracking-wider text-[#FF2A6D] shrink-0 whitespace-nowrap pr-1 border-r border-white/10">
              <Skull className="w-3 h-3 shrink-0" />
              <span>OUT ({knockedOutPlayers.length})</span>
            </span>
            <div className="flex-1 min-w-0 overflow-hidden">
              <SmoothMarquee
                items={knockedOutPlayers}
                getItemKey={(p) => `${p.id}-${p.eliminatedAt || 0}`}
                speedPxPerSec={42}
                gapPx={12}
                heightClassName="h-[22px]"
                order="newest-first"
                ariaLabel="Knocked out players marquee"
                renderItem={(p) => (
                  <span className="inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                    <img
                      src={p.avatarUrl || generateProfilePicture(p.username)}
                      alt={p.username}
                      referrerPolicy="no-referrer"
                      className="w-4 h-4 rounded-full object-cover border border-[#FF2A6D]/60 grayscale opacity-80 shrink-0"
                    />
                    <span className="text-[10.5px] font-bold text-rose-200/85 line-through decoration-[#FF2A6D]/80">
                      {p.username.replace(/^@/, '')}
                    </span>
                    {p.eliminatedWave && (
                      <span className="font-mono text-[9px] font-bold text-[#FF2A6D]/80">
                        W{p.eliminatedWave}
                      </span>
                    )}
                    <span className="text-purple-400/40 text-[10px]">·</span>
                  </span>
                )}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
