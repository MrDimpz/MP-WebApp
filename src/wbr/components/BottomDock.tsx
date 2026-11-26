import {
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  SkipForward,
  SlidersHorizontal,
  Terminal,
  Trash2,
} from 'lucide-react';

export type HostDrawerTab = 'chat' | 'store' | 'rules' | 'bridge';

interface BottomDockProps {
  isPaused: boolean;
  waitingForStart?: boolean;
  controlsCollapsed: boolean;
  coins: number;
  simEnabled: boolean;
  isLiveConnected?: boolean;
  isOverlay?: boolean;
  onTogglePause: () => void;
  onResetToLobby: () => void;
  onSkipPhase: () => void;
  onForceNewPrompt: () => void;
  onClearLeaderboard: () => void;
  onToggleCollapse: () => void;
  onOpenDrawer: (tab: HostDrawerTab) => void;
}

export function BottomDock({
  isPaused,
  waitingForStart = false,
  controlsCollapsed,
  coins,
  simEnabled,
  isLiveConnected = false,
  isOverlay = false,
  onTogglePause,
  onResetToLobby,
  onSkipPhase,
  onForceNewPrompt,
  onClearLeaderboard,
  onToggleCollapse,
  onOpenDrawer,
}: BottomDockProps) {
  if (isOverlay) {
    return null;
  }

  return (
    <footer className="w-full shrink-0 px-3 pt-1.5 pb-2 flex flex-col gap-1.5 border-t border-[#F6C915]/25 bg-[#180424]/96 relative z-20">
      {/* Compact Coins & Host Collapse Strip */}
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-purple-200/75">
        <span className="font-mono tabular-nums text-[#F6C915]">
          {coins} COINS
        </span>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-0.5 text-purple-200/75 hover:text-[#F6C915] transition-colors cursor-pointer"
          title={controlsCollapsed ? 'Expand host controls' : 'Collapse host controls'}
        >
          <span>HOST CONTROLS</span>
          {controlsCollapsed ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Double-Layered Streamer Host Controls (2 Rows x 4 Columns) */}
      {!controlsCollapsed && (
        <div className="flex flex-col gap-1.5 w-full">
          {/* Layer 1: Round & Flow Controls */}
          <div className="grid grid-cols-4 gap-1.5 w-full">
            <button
              type="button"
              onClick={onTogglePause}
              title={
                waitingForStart
                  ? 'Start Game from Lobby'
                  : isPaused
                    ? 'Resume Auto-Loop'
                    : 'Pause Auto-Loop'
              }
              className={`h-8 px-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                isPaused
                  ? 'bg-[#F6C915] text-[#180424]'
                  : 'bg-[#2B0938] hover:bg-[#3A0E4D] text-purple-100 border border-[#D4A437]/30'
              }`}
            >
              {isPaused ? (
                <Play className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Pause className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">
                {waitingForStart ? 'Start' : isPaused ? 'Play' : 'Pause'}
              </span>
            </button>

            <button
              type="button"
              onClick={onResetToLobby}
              title="Reset to Lobby & Hold Until Start"
              className="h-8 px-1.5 rounded-lg text-[11px] font-bold bg-[#2B0938] hover:bg-[#3A0E4D] text-purple-100 border border-[#D4A437]/30 flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#F6C915] shrink-0" />
              <span className="truncate">Reset</span>
            </button>

            <button
              type="button"
              onClick={onSkipPhase}
              title="Skip Current Wave / Phase"
              className="h-8 px-1.5 rounded-lg text-[11px] font-bold bg-[#2B0938] hover:bg-[#3A0E4D] text-purple-100 border border-[#D4A437]/30 flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <SkipForward className="w-3.5 h-3.5 text-[#F6C915] shrink-0" />
              <span className="truncate">Skip</span>
            </button>

            <button
              type="button"
              onClick={onForceNewPrompt}
              title="Force New Prompt"
              className="h-8 px-1.5 rounded-lg text-[11px] font-bold bg-[#2B0938] hover:bg-[#3A0E4D] text-purple-100 border border-[#D4A437]/30 flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#F6C915] shrink-0" />
              <span className="truncate">Prompt</span>
            </button>
          </div>

          {/* Layer 2: Studio, Rules, Leaderboard & Bridge Controls */}
          <div className="grid grid-cols-4 gap-1.5 w-full">
            <button
              type="button"
              onClick={() => onOpenDrawer('store')}
              title="Themed Avatar Store"
              className="h-8 px-1.5 rounded-lg text-[11px] font-bold bg-[#2B0938] hover:bg-[#3A0E4D] text-[#F6C915] border border-[#F6C915]/40 flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Store</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenDrawer('rules')}
              title="Customize Game Rules"
              className="h-8 px-1.5 rounded-lg text-[11px] font-bold bg-[#2B0938] hover:bg-[#3A0E4D] text-purple-100 border border-[#D4A437]/30 flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#F6C915] shrink-0" />
              <span className="truncate">Rules</span>
            </button>

            <button
              type="button"
              onClick={onClearLeaderboard}
              title="Clear Session Hall of Fame"
              className="h-8 px-1.5 rounded-lg text-[11px] font-bold bg-[#2B0938] hover:bg-[#431032] text-purple-200 hover:text-[#FF2A6D] border border-[#D4A437]/30 flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Clear</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenDrawer(isLiveConnected ? 'bridge' : 'chat')}
              title="Open Chat Simulator & TikTok LIVE Bridge"
              className={`h-8 px-1.5 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                isLiveConnected
                  ? 'bg-emerald-400 hover:bg-emerald-300 text-[#180424]'
                  : 'bg-[#F6C915] hover:bg-[#FFE047] text-[#180424]'
              }`}
            >
              {isLiveConnected ? (
                <Radio className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Terminal className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">
                {isLiveConnected ? 'LIVE' : simEnabled ? 'Chat' : 'Bridge'}
              </span>
            </button>
          </div>
        </div>
      )}
    </footer>
  );
}
